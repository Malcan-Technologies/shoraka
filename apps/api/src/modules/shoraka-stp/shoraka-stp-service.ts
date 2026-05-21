import crypto from "crypto";
import { prisma } from "../../lib/prisma";
import { putS3ObjectBuffer } from "../../lib/s3/client";
import { logger } from "../../lib/logger";
import { submitOrder, getOrderStatus, getCertificatePdf } from "./shoraka-stp-client";
import type { ShorakaSubmitOrderValues } from "./shoraka-stp-types";

import type { Prisma } from "@prisma/client";

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

type SubmitOrderResult = {
  tradeOrder: {
    id: string;
    withdrawal_instruction_id: string;
    provider_order_id: string | null;
    status: string;
    submitted_at: Date | null;
  };
  certificate: { certificate_s3_key: string } | null;
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
    submit_request_payload: unknown;
    submit_response_payload: unknown;
    status_response_payload: unknown;
    created_at: Date;
    updated_at: Date;
  };
  certificate: {
    id: string;
    certificate_s3_key: string;
    certificate_file_sha256: string | null;
    provider_certificate_id: string | null;
    created_at: Date;
  } | null;
};

export class ShorakaStpService {
  private getWithdrawalsError() {
    return new Error("Withdrawal not found");
  }

  async getStateForWithdrawal(withdrawalInstructionId: string): Promise<ShorakaStateResponse | null> {
    const tradeOrder = await prisma.shorakaTradeOrder.findUnique({
      where: { withdrawal_instruction_id: withdrawalInstructionId },
      include: { certificate: true },
    });

    if (!tradeOrder) return null;

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
        submit_request_payload: tradeOrder.submit_request_payload,
        submit_response_payload: tradeOrder.submit_response_payload,
        status_response_payload: tradeOrder.status_response_payload,
        created_at: tradeOrder.created_at,
        updated_at: tradeOrder.updated_at,
      },
      certificate: tradeOrder.certificate
        ? {
            id: tradeOrder.certificate.id,
            certificate_s3_key: tradeOrder.certificate.certificate_s3_key,
            certificate_file_sha256: tradeOrder.certificate.certificate_file_sha256,
            provider_certificate_id: tradeOrder.certificate.provider_certificate_id,
            created_at: tradeOrder.certificate.created_at,
          }
        : null,
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

    const withdrawalMetadata = asRecord(withdrawal.metadata);
    const grossFundedAmount = numberFromJson(withdrawalMetadata?.grossFundedAmount);
    if (grossFundedAmount == null) {
      throw new Error("Missing metadata.grossFundedAmount for shoraka submitorder");
    }

    const existing = await prisma.shorakaTradeOrder.findUnique({
      where: { withdrawal_instruction_id: withdrawalInstructionId },
      include: { certificate: true },
    });

    if (existing?.provider_order_id) {
      return {
        tradeOrder: {
          id: existing.id,
          withdrawal_instruction_id: existing.withdrawal_instruction_id,
          provider_order_id: existing.provider_order_id,
          status: existing.status,
          submitted_at: existing.submitted_at,
        },
        certificate: existing.certificate ? { certificate_s3_key: existing.certificate.certificate_s3_key } : null,
      };
    }

    const now = new Date();
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
        include: { certificate: true },
      });

      return {
        tradeOrder: {
          id: created.id,
          withdrawal_instruction_id: created.withdrawal_instruction_id,
          provider_order_id: created.provider_order_id,
          status: created.status,
          submitted_at: created.submitted_at,
        },
        certificate: null,
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
      include: { certificate: true },
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
      },
      certificate: updated.certificate ? { certificate_s3_key: updated.certificate.certificate_s3_key } : null,
    };
  }

  async queryStatusForWithdrawal(withdrawalInstructionId: string): Promise<ShorakaStateResponse> {
    const withdrawal = await this.loadWithdrawalForStp(withdrawalInstructionId);
    if (withdrawal.withdrawal_type !== "ISSUER_DISBURSEMENT") {
      throw new Error("Invalid withdrawal_type for shoraka query-status");
    }

    const tradeOrder = await prisma.shorakaTradeOrder.findUnique({
      where: { withdrawal_instruction_id: withdrawalInstructionId },
      include: { certificate: true },
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
      include: { certificate: true },
    });
    if (!tradeOrder?.provider_order_id) throw new Error("Missing ShorakaTradeOrder/provider_order_id");
    if (tradeOrder.certificate) {
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

    await prisma.shorakaCertificate.create({
      data: {
        shoraka_trade_order_id: tradeOrder.id,
        certificate_s3_key: key,
        certificate_file_sha256: sha256,
        provider_certificate_id: providerCertificateId,
      },
    });

    return (await this.getStateForWithdrawal(withdrawalInstructionId)) as ShorakaStateResponse;
  }
}

export const shorakaStpService = new ShorakaStpService();

