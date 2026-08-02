import {
  GatewayPaymentPurpose,
  GatewayPaymentReceiptStatus,
  GatewayPaymentStatus,
  OrganizationType,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { logger } from "../../../lib/logger";
import { prisma as defaultPrisma } from "../../../lib/prisma";
import { putS3ObjectBuffer } from "../../../lib/s3/client";
import { resolveInvestorExpectedName } from "../deposit-service";
import { TRUSTEE_LETTER_MOCK_DEFAULTS } from "../../notes/trustee-letters/trustee-letter.mock-config";
import { loadReceiptMerchantDetails } from "./receipt-merchant-config";
import { buildPaymentReceiptHtml } from "./receipt-html-template";
import { allocateReceiptNumber, getMalaysiaDateKey } from "./receipt-number";
import {
  getReceiptPurposeLabel,
  getReceiptRelatedEntityType,
} from "./receipt-purpose";
import { renderReceiptHtmlToPdfBuffer } from "./render-receipt-html-to-pdf";

const MALAYSIA_TZ = "Asia/Kuala_Lumpur";

function buildCompanyName(org: {
  type: OrganizationType;
  name: string | null;
  corporate_onboarding_data: unknown;
}): string | null {
  if (org.type !== OrganizationType.COMPANY) return null;
  if (org.name?.trim()) return org.name.trim();
  const data = org.corporate_onboarding_data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const businessName = (data as { basicInfo?: { businessName?: string } }).basicInfo
      ?.businessName?.trim();
    if (businessName) return businessName;
  }
  return null;
}

function formatMalaysiaDateTime(value: Date): string {
  return new Intl.DateTimeFormat("en-MY", {
    timeZone: MALAYSIA_TZ,
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(value);
}

function formatAmountLabel(amount: Prisma.Decimal | number, currency: string): string {
  let numeric: number;
  if (amount instanceof Prisma.Decimal) {
    numeric = amount.toNumber();
  } else if (typeof amount === "number") {
    numeric = amount;
  } else if (
    amount &&
    typeof amount === "object" &&
    "toNumber" in amount &&
    typeof (amount as { toNumber: unknown }).toNumber === "function"
  ) {
    numeric = (amount as { toNumber: () => number }).toNumber();
  } else {
    numeric = Number(amount);
  }
  const fixed = numeric.toFixed(2);
  const [whole, fraction] = fixed.split(".");
  const withSeparators = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (currency === "MYR") {
    return `RM ${withSeparators}.${fraction}`;
  }
  return `${currency} ${withSeparators}.${fraction}`;
}

function buildS3Key(receiptNumber: string, now: Date = new Date()): string {
  const dateKey = getMalaysiaDateKey(now);
  const year = dateKey.slice(0, 4);
  const month = dateKey.slice(4, 6);
  return `receipts/${year}/${month}/${receiptNumber}.pdf`;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  );
}

type PaymentForReceipt = Prisma.GatewayPaymentGetPayload<{
  include: {
    investor_organization: { include: { owner: true } };
    issuer_organization: { include: { owner: true } };
    application: true;
  };
}>;

function resolvePayerSnapshot(payment: PaymentForReceipt): {
  payerName: string | null;
  payerCompanyName: string | null;
  payerEmail: string | null;
  payerPhone: string | null;
  relatedEntityId: string;
  relatedReference: string;
  walletCredited: boolean;
} {
  if (payment.purpose === GatewayPaymentPurpose.INVESTOR_DEPOSIT) {
    const org = payment.investor_organization;
    if (!org) {
      throw new Error("Investor deposit receipt is missing investor organization");
    }
    const companyName = buildCompanyName(org);
    const personName = resolveInvestorExpectedName(org);
    const metadataReceipt =
      payment.metadata &&
      typeof payment.metadata === "object" &&
      !Array.isArray(payment.metadata) &&
      typeof (payment.metadata as { receipt?: unknown }).receipt === "string"
        ? (payment.metadata as { receipt: string }).receipt
        : null;

    return {
      payerName: payment.payer_name ?? personName,
      payerCompanyName: companyName,
      payerEmail: org.owner?.email ?? null,
      payerPhone: org.phone_number ?? org.owner?.phone ?? null,
      relatedEntityId: org.id,
      relatedReference: metadataReceipt ?? payment.id,
      walletCredited: payment.status === GatewayPaymentStatus.COMPLETED,
    };
  }

  if (payment.purpose === GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE) {
    const org = payment.issuer_organization;
    if (!org) {
      throw new Error("Issuer fee receipt is missing issuer organization");
    }
    const companyName = buildCompanyName(org) ?? org.name?.trim() ?? null;
    const personName = [org.first_name, org.middle_name, org.last_name]
      .map((p) => p?.trim())
      .filter(Boolean)
      .join(" ");

    return {
      payerName: personName || payment.payer_name,
      payerCompanyName: companyName,
      payerEmail: org.owner?.email ?? null,
      payerPhone: org.phone_number ?? org.owner?.phone ?? null,
      relatedEntityId: org.id,
      relatedReference: org.registration_number?.trim() || org.name?.trim() || org.id,
      walletCredited: false,
    };
  }

  const application = payment.application;
  const org = payment.issuer_organization;
  if (!application) {
    throw new Error("Processing fee receipt is missing application");
  }

  const companyName = org
    ? buildCompanyName(org) ?? org.name?.trim() ?? null
    : null;
  const personName = org
    ? [org.first_name, org.middle_name, org.last_name]
        .map((p) => p?.trim())
        .filter(Boolean)
        .join(" ")
    : "";

  return {
    payerName: personName || payment.payer_name,
    payerCompanyName: companyName,
    payerEmail: org?.owner?.email ?? null,
    payerPhone: org?.phone_number ?? org?.owner?.phone ?? null,
    relatedEntityId: application.id,
    relatedReference: application.id,
    walletCredited: false,
  };
}

async function loadPaymentForReceipt(
  gatewayPaymentId: string,
  db: PrismaClient
): Promise<PaymentForReceipt | null> {
  return db.gatewayPayment.findUnique({
    where: { id: gatewayPaymentId },
    include: {
      investor_organization: { include: { owner: true } },
      issuer_organization: { include: { owner: true } },
      application: true,
    },
  });
}

async function createPendingReceiptRow(
  payment: PaymentForReceipt,
  db: PrismaClient
) {
  const snapshot = resolvePayerSnapshot(payment);
  const purposeLabel = getReceiptPurposeLabel(payment.purpose);
  const relatedEntityType = getReceiptRelatedEntityType(payment.purpose);
  const paymentDate = payment.updated_at;

  return db.$transaction(async (tx) => {
    const existing = await tx.gatewayPaymentReceipt.findUnique({
      where: { gateway_payment_id: payment.id },
    });
    if (existing) {
      return existing;
    }

    const receiptNumber = await allocateReceiptNumber(tx, paymentDate);

    try {
      return await tx.gatewayPaymentReceipt.create({
        data: {
          receipt_number: receiptNumber,
          gateway_payment_id: payment.id,
          payment_purpose: payment.purpose,
          purpose_label: purposeLabel,
          payer_name: snapshot.payerName,
          payer_company_name: snapshot.payerCompanyName,
          payer_email: snapshot.payerEmail,
          payer_phone: snapshot.payerPhone,
          amount: payment.amount,
          currency: payment.currency,
          payment_method: payment.method,
          payment_date: paymentDate,
          curlec_payment_id: payment.curlec_payment_id,
          curlec_order_id: payment.curlec_order_id,
          related_entity_type: relatedEntityType,
          related_entity_id: snapshot.relatedEntityId,
          related_reference: snapshot.relatedReference,
          wallet_credited: snapshot.walletCredited,
          status: GatewayPaymentReceiptStatus.PENDING,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        const raced = await tx.gatewayPaymentReceipt.findUnique({
          where: { gateway_payment_id: payment.id },
        });
        if (raced) return raced;
      }
      throw error;
    }
  });
}

/**
 * Ensure a receipt exists for a COMPLETED gateway payment and generate/upload the PDF.
 * Safe to call repeatedly — never creates a second receipt for the same payment.
 */
export async function generateGatewayPaymentReceipt(
  gatewayPaymentId: string,
  db: PrismaClient = defaultPrisma
) {
  const payment = await loadPaymentForReceipt(gatewayPaymentId, db);
  if (!payment) {
    logger.warn({ gatewayPaymentId }, "Receipt skipped — gateway payment not found");
    return null;
  }

  if (
    payment.status !== GatewayPaymentStatus.COMPLETED &&
    payment.status !== GatewayPaymentStatus.REFUNDED
  ) {
    logger.info(
      { gatewayPaymentId, status: payment.status },
      "Receipt skipped — payment not COMPLETED/REFUNDED"
    );
    return null;
  }

  if (payment.status === GatewayPaymentStatus.REFUNDED) {
    const existing = await db.gatewayPaymentReceipt.findUnique({
      where: { gateway_payment_id: gatewayPaymentId },
    });
    if (!existing) {
      logger.info(
        { gatewayPaymentId },
        "Receipt skipped — refunded payment has no prior receipt row"
      );
      return null;
    }
  }

  const receipt = await createPendingReceiptRow(payment, db);

  if (
    receipt.status === GatewayPaymentReceiptStatus.GENERATED ||
    (receipt.status === GatewayPaymentReceiptStatus.REFUNDED && receipt.pdf_s3_key)
  ) {
    return receipt;
  }

  const preserveRefunded = receipt.status === GatewayPaymentReceiptStatus.REFUNDED;

  try {
    const financeSettings = await db.platformFinanceSetting.findUnique({
      where: { key: "DEFAULT" },
    });
    const configuredDisplayName =
      financeSettings?.trustee_letter_config &&
      typeof financeSettings.trustee_letter_config === "object" &&
      !Array.isArray(financeSettings.trustee_letter_config)
        ? (
            financeSettings.trustee_letter_config as {
              platformDisplayName?: string;
            }
          ).platformDisplayName
        : null;

    const merchant = loadReceiptMerchantDetails(
      configuredDisplayName ?? TRUSTEE_LETTER_MOCK_DEFAULTS.platformDisplayName
    );

    const amountLabel = formatAmountLabel(receipt.amount, receipt.currency);
    const html = buildPaymentReceiptHtml({
      receiptNumber: receipt.receipt_number,
      receiptDateLabel: formatMalaysiaDateTime(receipt.created_at),
      merchant,
      payerName: receipt.payer_name,
      payerCompanyName: receipt.payer_company_name,
      payerEmail: receipt.payer_email,
      payerPhone: receipt.payer_phone,
      purposeLabel: receipt.purpose_label,
      amountLabel,
      currency: receipt.currency,
      paymentMethod: receipt.payment_method,
      paymentStatus: "Paid",
      paymentDateLabel: formatMalaysiaDateTime(receipt.payment_date),
      curlecPaymentId: receipt.curlec_payment_id,
      curlecOrderId: receipt.curlec_order_id,
      relatedReference: receipt.related_reference,
      walletCreditStatus:
        receipt.payment_purpose === GatewayPaymentPurpose.INVESTOR_DEPOSIT &&
        receipt.wallet_credited
          ? "Credited"
          : null,
    });

    const pdf = await renderReceiptHtmlToPdfBuffer(html);
    const s3Key = receipt.pdf_s3_key ?? buildS3Key(receipt.receipt_number);

    await putS3ObjectBuffer({
      key: s3Key,
      body: pdf,
      contentType: "application/pdf",
    });

    return db.gatewayPaymentReceipt.update({
      where: { id: receipt.id },
      data: {
        pdf_s3_key: s3Key,
        status: preserveRefunded
          ? GatewayPaymentReceiptStatus.REFUNDED
          : GatewayPaymentReceiptStatus.GENERATED,
        generation_error: null,
        generated_at: new Date(),
        merchant_snapshot: merchant as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(
      {
        gatewayPaymentId,
        receiptId: receipt.id,
        receiptNumber: receipt.receipt_number,
        error: message,
      },
      "Payment receipt PDF generation failed"
    );

    if (preserveRefunded) {
      return db.gatewayPaymentReceipt.update({
        where: { id: receipt.id },
        data: {
          generation_error: message.slice(0, 500),
        },
      });
    }

    return db.gatewayPaymentReceipt.update({
      where: { id: receipt.id },
      data: {
        status: GatewayPaymentReceiptStatus.FAILED,
        generation_error: message.slice(0, 500),
      },
    });
  }
}

/** Fire-and-forget wrapper so webhook handlers stay fast. */
export function scheduleGatewayPaymentReceipt(
  gatewayPaymentId: string,
  db: PrismaClient = defaultPrisma
): void {
  void generateGatewayPaymentReceipt(gatewayPaymentId, db).catch((error) => {
    logger.error(
      {
        gatewayPaymentId,
        error: error instanceof Error ? error.message : String(error),
      },
      "Unhandled receipt generation error"
    );
  });
}

export async function markGatewayPaymentReceiptRefunded(
  gatewayPaymentId: string,
  input: { refundReference?: string | null; refundAmount?: Prisma.Decimal | number | null; refundedAt?: Date },
  db: PrismaClient = defaultPrisma
) {
  const receipt = await db.gatewayPaymentReceipt.findUnique({
    where: { gateway_payment_id: gatewayPaymentId },
  });
  if (!receipt) {
    return null;
  }

  return db.gatewayPaymentReceipt.update({
    where: { id: receipt.id },
    data: {
      status: GatewayPaymentReceiptStatus.REFUNDED,
      refund_reference: input.refundReference ?? receipt.refund_reference,
      refund_amount:
        input.refundAmount !== undefined && input.refundAmount !== null
          ? input.refundAmount
          : receipt.refund_amount,
      refunded_at: input.refundedAt ?? new Date(),
    },
  });
}

export async function retryFailedGatewayPaymentReceipts(
  db: PrismaClient = defaultPrisma,
  limit = 20
) {
  const rows = await db.gatewayPaymentReceipt.findMany({
    where: {
      status: {
        in: [GatewayPaymentReceiptStatus.PENDING, GatewayPaymentReceiptStatus.FAILED],
      },
    },
    orderBy: { created_at: "asc" },
    take: limit,
    select: { gateway_payment_id: true, receipt_number: true },
  });

  let succeeded = 0;
  let failed = 0;

  for (const row of rows) {
    const result = await generateGatewayPaymentReceipt(row.gateway_payment_id, db);
    if (result?.status === GatewayPaymentReceiptStatus.GENERATED) {
      succeeded += 1;
    } else {
      failed += 1;
    }
  }

  return { attempted: rows.length, succeeded, failed };
}
