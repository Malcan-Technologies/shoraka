import crypto from "crypto";
import { prisma } from "../../lib/prisma";
import { putS3ObjectBuffer } from "../../lib/s3/client";
import { logger } from "../../lib/logger";
import { submitOrder, getOrderStatus, getCertificatePdf } from "./shoraka-stp-client";
import type { ShorakaSubmitOrderValues } from "./shoraka-stp-types";
import { AppError } from "../../lib/http/error-handler";

import type { Prisma } from "@prisma/client";

export const SHORAKA_PROVIDER_STATUSES = {
  ACTIVE: "Active",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  PENDING_SELL: "Pending Sell",
  TAKE_DELIVERY: "Take Delivery",
} as const;

export type ShorakaProviderStatus =
  (typeof SHORAKA_PROVIDER_STATUSES)[keyof typeof SHORAKA_PROVIDER_STATUSES] | "Unknown";

export const SHORAKA_PROVIDER_MEANINGS = {
  MATCHING_IN_PROGRESS: "MATCHING_IN_PROGRESS",
  COMPLETED_CERTIFICATE_READY: "COMPLETED_CERTIFICATE_READY",
  CANCELLED_REVIEW_REQUIRED: "CANCELLED_REVIEW_REQUIRED",
  PENDING_SELL_REVIEW_OR_RETRY: "PENDING_SELL_REVIEW_OR_RETRY",
  TAKE_DELIVERY_REVIEW_REQUIRED: "TAKE_DELIVERY_REVIEW_REQUIRED",
  UNKNOWN_REVIEW_REQUIRED: "UNKNOWN_REVIEW_REQUIRED",
} as const;

export type ShorakaOperationalMeaning =
  (typeof SHORAKA_PROVIDER_MEANINGS)[keyof typeof SHORAKA_PROVIDER_MEANINGS];

function sha256HexBuffer(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function numberFromJson(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/,/g, "").trim();
    if (!cleaned) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function formatMoney2(n: number): string {
  // Provider expects fixed 2 decimals.
  return n.toFixed(2);
}

function valueDateDDMMYYYY(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

export function normalizeProviderStatus(raw: unknown): ShorakaProviderStatus {
  if (raw == null) return "Unknown";
  if (typeof raw !== "string") return "Unknown";
  const s = raw.trim().toLowerCase();
  if (!s) return "Unknown";

  if (s === "active") return SHORAKA_PROVIDER_STATUSES.ACTIVE;
  if (s === "completed") return SHORAKA_PROVIDER_STATUSES.COMPLETED;
  if (s === "cancelled") return SHORAKA_PROVIDER_STATUSES.CANCELLED;

  if (s === "pending sell" || (s.includes("pending") && s.includes("sell"))) {
    return SHORAKA_PROVIDER_STATUSES.PENDING_SELL;
  }

  if (s === "take delivery" || (s.includes("take") && s.includes("delivery"))) {
    return SHORAKA_PROVIDER_STATUSES.TAKE_DELIVERY;
  }

  return "Unknown";
}

export function getMalaysiaCutoffWarning(now: Date): string | null {
  // Malaysia time: daily maintenance/cutoff around 23:30 - 00:30
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const hourStr = parts.find((p) => p.type === "hour")?.value ?? "0";
  const minuteStr = parts.find((p) => p.type === "minute")?.value ?? "0";
  const hour = Number(hourStr);
  const minute = Number(minuteStr);

  const inWindow =
    (hour === 23 && minute >= 30) ||
    (hour === 0 && minute >= 0 && minute < 30);

  if (!inWindow) return null;

  return "Shoraka orders cannot be submitted between 11:30 PM and 12:30 AM MYT because orders may remain Active and require cancellation. Please submit after 12:30 AM.";
}

async function resolveOwnershipForIssuerDisbursement(args: {
  withdrawalMetadata: Record<string, unknown> | null;
  issuerOrganizationId: string | null | undefined;
}): Promise<string> {
  const fromMeta = args.withdrawalMetadata?.issuerOrganizationName;
  if (typeof fromMeta === "string" && fromMeta.trim()) return fromMeta.trim();

  if (args.issuerOrganizationId) {
    const issuer = await prisma.issuerOrganization.findUnique({
      where: { id: args.issuerOrganizationId },
      select: { name: true },
    });
    if (issuer?.name && issuer.name.trim()) return issuer.name.trim();
  }

  return "Unknown Issuer";
}

export function deriveOperationalStatus(args: {
  providerStatusRaw: unknown;
  hasCertificate: boolean;
  certificateMissing: boolean;
  cutoffWarning: string | null;
}): {
  providerStatus: ShorakaProviderStatus;
  label: string;
  nextAction: string;
  meaning: ShorakaOperationalMeaning;
  canFetchCertificate: boolean;
  hasCertificate: boolean;
  requiresManualReview: boolean;
  cutoffWarning: string | null;
} {
  const providerStatus = normalizeProviderStatus(args.providerStatusRaw);
  const hasCertificate = args.hasCertificate;
  const certificateMissing = args.certificateMissing;

  if (providerStatus === SHORAKA_PROVIDER_STATUSES.ACTIVE) {
    return {
      providerStatus,
      label: "Matching in progress",
      meaning: SHORAKA_PROVIDER_MEANINGS.MATCHING_IN_PROGRESS,
      nextAction: "Query status again later",
      canFetchCertificate: false,
      hasCertificate,
      requiresManualReview: false,
      cutoffWarning: args.cutoffWarning,
    };
  }

  if (providerStatus === SHORAKA_PROVIDER_STATUSES.COMPLETED) {
    return {
      providerStatus,
      label: "Completed",
      meaning: SHORAKA_PROVIDER_MEANINGS.COMPLETED_CERTIFICATE_READY,
      nextAction: "Fetch certificate",
      canFetchCertificate: certificateMissing,
      hasCertificate,
      requiresManualReview: false,
      cutoffWarning: args.cutoffWarning,
    };
  }

  if (providerStatus === SHORAKA_PROVIDER_STATUSES.CANCELLED) {
    return {
      providerStatus,
      label: "Cancelled",
      meaning: SHORAKA_PROVIDER_MEANINGS.CANCELLED_REVIEW_REQUIRED,
      nextAction: "Manual review required",
      canFetchCertificate: false,
      hasCertificate,
      requiresManualReview: true,
      cutoffWarning: args.cutoffWarning,
    };
  }

  if (providerStatus === SHORAKA_PROVIDER_STATUSES.PENDING_SELL) {
    return {
      providerStatus,
      label: "Pending Sell",
      meaning: SHORAKA_PROVIDER_MEANINGS.PENDING_SELL_REVIEW_OR_RETRY,
      nextAction: "Query status again later; manual review if stuck",
      canFetchCertificate: false,
      hasCertificate,
      requiresManualReview: false,
      cutoffWarning: args.cutoffWarning,
    };
  }

  if (providerStatus === SHORAKA_PROVIDER_STATUSES.TAKE_DELIVERY) {
    return {
      providerStatus,
      label: "Take Delivery",
      meaning: SHORAKA_PROVIDER_MEANINGS.TAKE_DELIVERY_REVIEW_REQUIRED,
      nextAction: "Manual review required",
      canFetchCertificate: false,
      hasCertificate,
      requiresManualReview: true,
      cutoffWarning: args.cutoffWarning,
    };
  }

  return {
    providerStatus,
    label: "Unknown — Manual review required",
    meaning: SHORAKA_PROVIDER_MEANINGS.UNKNOWN_REVIEW_REQUIRED,
    nextAction: "Manual review required",
    canFetchCertificate: false,
    hasCertificate,
    requiresManualReview: true,
    cutoffWarning: args.cutoffWarning,
  };
}

function getStringFromJson(payload: unknown, key: string): string | null {
  const rec = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
  if (!rec) return null;
  const v = rec[key];
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

function getOperationalParsedFields(args: {
  submitRequestPayload: unknown;
  statusResponsePayload: unknown;
  certificateS3Key: string | null;
}) {
  const ownershipName = getStringFromJson(args.submitRequestPayload, "ownership");
  const valueDate = getStringFromJson(args.submitRequestPayload, "value_date");
  const orderAmount = getStringFromJson(args.submitRequestPayload, "order_amount");
  const murabahaAmount = getStringFromJson(args.submitRequestPayload, "murabaha_amount");

  const orderDate =
    getStringFromJson(args.submitRequestPayload, "order_date") ||
    getStringFromJson(args.submitRequestPayload, "orderDate") ||
    getStringFromJson(args.statusResponsePayload, "order_date") ||
    getStringFromJson(args.statusResponsePayload, "orderDate") ||
    null;

  const cancelDate =
    getStringFromJson(args.statusResponsePayload, "cancelDate") ||
    getStringFromJson(args.statusResponsePayload, "cancel_date") ||
    null;

  // Phase 1 doesn't have a confirmed response contract for certificate details.
  const certificateDetails1 =
    getStringFromJson(args.statusResponsePayload, "certificateDetail1") ||
    getStringFromJson(args.statusResponsePayload, "certificate_details_1") ||
    null;
  const certificateDetails2 =
    getStringFromJson(args.statusResponsePayload, "certificateDetail2") ||
    getStringFromJson(args.statusResponsePayload, "certificate_details_2") ||
    null;
  const certificateDetails3 =
    getStringFromJson(args.statusResponsePayload, "certificateDetail3") ||
    getStringFromJson(args.statusResponsePayload, "certificate_details_3") ||
    null;

  return {
    orderDate,
    valueDate,
    cancelDate,
    ownershipName,
    orderAmount,
    murabahaAmount,
    certificateUrl: args.certificateS3Key,
    certificateDetails1,
    certificateDetails2,
    certificateDetails3,
  };
}

type SubmitOrderResult = {
  tradeOrder: {
    id: string;
    withdrawal_instruction_id: string;
    provider_order_id: string | null;
    status: string;
    submitted_at: Date | null;
    callback_payload: Prisma.JsonValue | null;
    callback_received_at: Date | null;
    certificate_s3_key: string | null;
    certificate_file_sha256: string | null;
    provider_certificate_id: string | null;
    certificate_uploaded_at: Date | null;
  };
  operationalStatus: ReturnType<typeof deriveOperationalStatus>;
  cutoffWarning: string | null;
};

type ShorakaStateResponse = {
  tradeOrder: {
    id: string;
    withdrawal_instruction_id: string;
    note_id: string;
    provider_order_id: string | null;
    status: string;
    idempotency_key: string;
    submitted_at: Date | null;
    status_last_checked_at: Date | null;
    callback_payload: Prisma.JsonValue | null;
    callback_received_at: Date | null;
    submit_request_payload: unknown;
    submit_response_payload: unknown;
    status_response_payload: unknown;
    certificate_s3_key: string | null;
    certificate_file_sha256: string | null;
    provider_certificate_id: string | null;
    certificate_uploaded_at: Date | null;
    created_at: Date;
    updated_at: Date;
  };
  operationalStatus: ReturnType<typeof deriveOperationalStatus>;
  parsed: ReturnType<typeof getOperationalParsedFields>;
  cutoffWarning: string | null;
};

export class ShorakaStpService {
  private getWithdrawalsError() {
    return new Error("Withdrawal not found");
  }

  async getStateForWithdrawal(withdrawalInstructionId: string): Promise<ShorakaStateResponse | null> {
    const tradeOrder = await prisma.shorakaTradeOrder.findUnique({
      where: { withdrawal_instruction_id: withdrawalInstructionId },
    });

    if (!tradeOrder) return null;

    const cutoffWarning = getMalaysiaCutoffWarning(new Date());
    const hasCertificate = Boolean(tradeOrder.certificate_s3_key);
    const certificateMissing = !tradeOrder.certificate_s3_key;

    return {
      tradeOrder: {
        id: tradeOrder.id,
        withdrawal_instruction_id: tradeOrder.withdrawal_instruction_id,
        note_id: tradeOrder.note_id,
        provider_order_id: tradeOrder.provider_order_id,
        status: tradeOrder.status,
        idempotency_key: tradeOrder.idempotency_key,
        submitted_at: tradeOrder.submitted_at,
        status_last_checked_at: tradeOrder.status_last_checked_at,
        callback_payload: tradeOrder.callback_payload as Prisma.JsonValue | null,
        callback_received_at: tradeOrder.callback_received_at,
        submit_request_payload: tradeOrder.submit_request_payload,
        submit_response_payload: tradeOrder.submit_response_payload,
        status_response_payload: tradeOrder.status_response_payload,
        certificate_s3_key: tradeOrder.certificate_s3_key,
        certificate_file_sha256: tradeOrder.certificate_file_sha256,
        provider_certificate_id: tradeOrder.provider_certificate_id,
        certificate_uploaded_at: tradeOrder.certificate_uploaded_at,
        created_at: tradeOrder.created_at,
        updated_at: tradeOrder.updated_at,
      },
      operationalStatus: deriveOperationalStatus({
        providerStatusRaw: tradeOrder.status,
        hasCertificate,
        certificateMissing,
        cutoffWarning,
      }),
      parsed: getOperationalParsedFields({
        submitRequestPayload: tradeOrder.submit_request_payload,
        statusResponsePayload: tradeOrder.status_response_payload,
        certificateS3Key: tradeOrder.certificate_s3_key,
      }),
      cutoffWarning,
    };
  }

  private async loadWithdrawalForStp(withdrawalInstructionId: string) {
    const withdrawal = await prisma.withdrawalInstruction.findUnique({
      where: { id: withdrawalInstructionId },
      select: {
        id: true,
        note_id: true,
        withdrawal_type: true,
        metadata: true,
        beneficiary_snapshot: true,
        issuer_organization_id: true,
      },
    });
    if (!withdrawal) throw this.getWithdrawalsError();
    return withdrawal;
  }

  async submitOrderForWithdrawal(withdrawalInstructionId: string): Promise<SubmitOrderResult> {
    const withdrawal = await this.loadWithdrawalForStp(withdrawalInstructionId);
    // Enforce Phase 1 scope: only ISSUER_DISBURSEMENT.
    if (withdrawal.withdrawal_type !== "ISSUER_DISBURSEMENT") {
      throw new Error("Invalid withdrawal_type for shoraka submitorder");
    }

    const now = new Date();
    const cutoffWarning = getMalaysiaCutoffWarning(now);
    if (cutoffWarning) {
      throw new AppError(
        400,
        "SHORAKA_CUTOFF_WINDOW",
        cutoffWarning
      );
    }

    const withdrawalMetadata = asRecord(withdrawal.metadata);
    const grossFundedAmount = numberFromJson(withdrawalMetadata?.grossFundedAmount);
    if (grossFundedAmount == null) {
      throw new Error("Missing metadata.grossFundedAmount for shoraka submitorder");
    }

    const existing = await prisma.shorakaTradeOrder.findUnique({
      where: { withdrawal_instruction_id: withdrawalInstructionId },
    });

    if (existing?.provider_order_id) {
      const cutoffWarning = getMalaysiaCutoffWarning(new Date());
      const hasCertificate = Boolean(existing.certificate_s3_key);
      const certificateMissing = !existing.certificate_s3_key;
      return {
        tradeOrder: {
          id: existing.id,
          withdrawal_instruction_id: existing.withdrawal_instruction_id,
          provider_order_id: existing.provider_order_id,
          status: existing.status,
          submitted_at: existing.submitted_at,
          callback_payload: existing.callback_payload as Prisma.JsonValue | null,
          callback_received_at: existing.callback_received_at,
          certificate_s3_key: existing.certificate_s3_key,
          certificate_file_sha256: existing.certificate_file_sha256,
          provider_certificate_id: existing.provider_certificate_id,
          certificate_uploaded_at: existing.certificate_uploaded_at,
        },
        operationalStatus: deriveOperationalStatus({
          providerStatusRaw: existing.status,
          hasCertificate,
          certificateMissing,
          cutoffWarning,
        }),
        cutoffWarning,
      };
    }

    // Safe window: capture warning (should be null) and continue.
    // Note: `getMalaysiaCutoffWarning` only returns a value inside the unsafe window.
    const ownership = await resolveOwnershipForIssuerDisbursement({
      withdrawalMetadata,
      issuerOrganizationId: withdrawal.issuer_organization_id,
    });

    const values: ShorakaSubmitOrderValues = {
      product_type: "FINANCING",
      commodity_type: "000-COPPER",
      ownership,
      value_date: valueDateDDMMYYYY(now),
      order_currency: "MYR",
      order_amount: formatMoney2(grossFundedAmount),
      murabaha_amount: formatMoney2(grossFundedAmount),
      tenor: "O/N",
      tenor_other: "",
      tenor_other_unit: "",
      order_type: "Buy & Sell",
    };

    // Save request payload excluding secret/signature source.
    const submitRequestPayload: Prisma.JsonObject = values as unknown as Prisma.JsonObject;

    // Submit to provider.
    const { response } = await submitOrder({ values });

    const providerOrderId = typeof response.orderId === "string" ? response.orderId : null;
    if (!providerOrderId) {
      throw new Error("Shoraka submitorder response missing orderId");
    }

    const providerStatusRaw = response.status;
    const providerStatusStr = typeof providerStatusRaw === "string" ? providerStatusRaw : "SUBMITTED";

    if (!existing) {
      const created = await prisma.shorakaTradeOrder.create({
        data: {
          withdrawal_instruction_id: withdrawalInstructionId,
          note_id: withdrawal.note_id ?? "unknown-note",
          provider_order_id: providerOrderId,
          status: providerStatusStr,
          idempotency_key: `shoraka:submit:${withdrawalInstructionId}`,
          submit_request_payload: submitRequestPayload,
          submit_response_payload: response as unknown as Prisma.JsonObject,
          submitted_at: now,
        },
      });

      return {
        tradeOrder: {
          id: created.id,
          withdrawal_instruction_id: created.withdrawal_instruction_id,
          provider_order_id: created.provider_order_id,
          status: created.status,
          submitted_at: created.submitted_at,
          callback_payload: created.callback_payload as Prisma.JsonValue | null,
          callback_received_at: created.callback_received_at,
          certificate_s3_key: created.certificate_s3_key,
          certificate_file_sha256: created.certificate_file_sha256,
          provider_certificate_id: created.provider_certificate_id,
          certificate_uploaded_at: created.certificate_uploaded_at,
        },
        operationalStatus: deriveOperationalStatus({
          providerStatusRaw: created.status,
          hasCertificate: Boolean(created.certificate_s3_key),
          certificateMissing: !created.certificate_s3_key,
          cutoffWarning,
        }),
        cutoffWarning,
      };
    }

    const updated = await prisma.shorakaTradeOrder.update({
      where: { withdrawal_instruction_id: withdrawalInstructionId },
      data: {
        provider_order_id: providerOrderId,
        status: providerStatusStr,
        submit_request_payload: submitRequestPayload,
        submit_response_payload: response as unknown as Prisma.JsonObject,
        submitted_at: now,
      },
    });

    logger.info(
      { withdrawalInstructionId, providerOrderId },
      "Shoraka submitorder persisted"
    );

    return {
      tradeOrder: {
        id: updated.id,
        withdrawal_instruction_id: updated.withdrawal_instruction_id,
        provider_order_id: updated.provider_order_id,
        status: updated.status,
        submitted_at: updated.submitted_at,
        callback_payload: updated.callback_payload as Prisma.JsonValue | null,
        callback_received_at: updated.callback_received_at,
        certificate_s3_key: updated.certificate_s3_key,
        certificate_file_sha256: updated.certificate_file_sha256,
        provider_certificate_id: updated.provider_certificate_id,
        certificate_uploaded_at: updated.certificate_uploaded_at,
      },
      operationalStatus: deriveOperationalStatus({
        providerStatusRaw: updated.status,
        hasCertificate: Boolean(updated.certificate_s3_key),
        certificateMissing: !updated.certificate_s3_key,
        cutoffWarning,
      }),
      cutoffWarning,
    };
  }

  async queryStatusForWithdrawal(withdrawalInstructionId: string): Promise<ShorakaStateResponse> {
    const withdrawal = await this.loadWithdrawalForStp(withdrawalInstructionId);
    if (withdrawal.withdrawal_type !== "ISSUER_DISBURSEMENT") {
      throw new Error("Invalid withdrawal_type for shoraka query-status");
    }

    const tradeOrder = await prisma.shorakaTradeOrder.findUnique({
      where: { withdrawal_instruction_id: withdrawalInstructionId },
    });
    if (!tradeOrder?.provider_order_id) throw new Error("Missing ShorakaTradeOrder/provider_order_id");

    const response = await getOrderStatus({ orderId: tradeOrder.provider_order_id });
    const now = new Date();

    const providerStatusRaw = response.status;
    const providerStatusStr = typeof providerStatusRaw === "string" ? providerStatusRaw : tradeOrder.status;

    await prisma.shorakaTradeOrder.update({
      where: { withdrawal_instruction_id: withdrawalInstructionId },
      data: {
        status_response_payload: response as unknown as Prisma.JsonObject,
        status_last_checked_at: now,
        status: providerStatusStr,
      },
    });

    return (await this.getStateForWithdrawal(withdrawalInstructionId)) as ShorakaStateResponse;
  }

  async fetchCertificateForWithdrawal(withdrawalInstructionId: string): Promise<ShorakaStateResponse> {
    const withdrawal = await this.loadWithdrawalForStp(withdrawalInstructionId);
    if (withdrawal.withdrawal_type !== "ISSUER_DISBURSEMENT") {
      throw new Error("Invalid withdrawal_type for shoraka fetch-certificate");
    }

    const tradeOrder = await prisma.shorakaTradeOrder.findUnique({
      where: { withdrawal_instruction_id: withdrawalInstructionId },
    });
    if (!tradeOrder?.provider_order_id) throw new Error("Missing ShorakaTradeOrder/provider_order_id");

    const providerStatus = normalizeProviderStatus(tradeOrder.status);
    if (providerStatus !== SHORAKA_PROVIDER_STATUSES.COMPLETED) {
      throw new AppError(
        400,
        "SHORAKA_STATUS_INVALID",
        `Shoraka certificate can only be fetched after the order status is Completed. Current status: ${tradeOrder.status}.`
      );
    }

    if (tradeOrder.certificate_s3_key) {
      return (await this.getStateForWithdrawal(withdrawalInstructionId)) as ShorakaStateResponse;
    }

    const pdfBuffer = await getCertificatePdf({ orderId: tradeOrder.provider_order_id });
    const sha256 = sha256HexBuffer(pdfBuffer);

    const providerOrderId = tradeOrder.provider_order_id;
    const timestamp = Date.now();
    const key = `shoraka-certificates/${withdrawalInstructionId}/${providerOrderId}-${timestamp}.pdf`;

    await putS3ObjectBuffer({
      key,
      body: pdfBuffer,
      contentType: "application/pdf",
    });

    // Provider_certificate_id is optional; only store when present.
    const providerCertificateId: string | null = null;
    const uploadedAt = new Date();

    await prisma.shorakaTradeOrder.update({
      where: { withdrawal_instruction_id: withdrawalInstructionId },
      data: {
        certificate_s3_key: key,
        certificate_file_sha256: sha256,
        provider_certificate_id: providerCertificateId,
        certificate_uploaded_at: uploadedAt,
      },
    });

    return (await this.getStateForWithdrawal(withdrawalInstructionId)) as ShorakaStateResponse;
  }
}

export const shorakaStpService = new ShorakaStpService();

