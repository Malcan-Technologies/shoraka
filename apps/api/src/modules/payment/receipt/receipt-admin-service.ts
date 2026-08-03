import {
  GatewayPaymentPurpose,
  GatewayPaymentReceiptStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { AppError } from "../../../lib/http/error-handler";
import { prisma as defaultPrisma } from "../../../lib/prisma";
import {
  generatePresignedDownloadUrl,
  generatePresignedViewUrl,
} from "../../../lib/s3/client";
import { ListGatewayPaymentReceiptsQuery } from "./receipt-admin-schemas";
import { getReceiptRelatedReferenceLabel } from "./receipt-purpose";
import { generateGatewayPaymentReceipt } from "./receipt-service";

function decimalToNumber(value: Prisma.Decimal): number {
  return value.toNumber();
}

function mapReceipt(receipt: {
  id: string;
  receipt_number: string;
  gateway_payment_id: string;
  payment_purpose: GatewayPaymentPurpose;
  purpose_label: string;
  payer_name: string | null;
  payer_company_name: string | null;
  payer_email: string | null;
  payer_phone: string | null;
  amount: Prisma.Decimal;
  currency: string;
  payment_method: string | null;
  payment_date: Date;
  curlec_payment_id: string | null;
  curlec_order_id: string;
  related_entity_type: string;
  related_entity_id: string;
  related_reference: string;
  wallet_credited: boolean;
  pdf_s3_key: string | null;
  status: GatewayPaymentReceiptStatus;
  generation_error: string | null;
  generated_at: Date | null;
  refund_reference: string | null;
  refund_amount: Prisma.Decimal | null;
  refunded_at: Date | null;
  created_at: Date;
  updated_at: Date;
}) {
  return {
    id: receipt.id,
    receiptNumber: receipt.receipt_number,
    gatewayPaymentId: receipt.gateway_payment_id,
    paymentPurpose: receipt.payment_purpose,
    purposeLabel: receipt.purpose_label,
    payerName: receipt.payer_name,
    payerCompanyName: receipt.payer_company_name,
    payerEmail: receipt.payer_email,
    payerPhone: receipt.payer_phone,
    amount: decimalToNumber(receipt.amount),
    currency: receipt.currency,
    paymentMethod: receipt.payment_method,
    paymentDate: receipt.payment_date.toISOString(),
    curlecPaymentId: receipt.curlec_payment_id,
    curlecOrderId: receipt.curlec_order_id,
    relatedEntityType: receipt.related_entity_type,
    relatedEntityId: receipt.related_entity_id,
    relatedReference: receipt.related_reference?.trim() || null,
    relatedReferenceLabel: getReceiptRelatedReferenceLabel(receipt.payment_purpose),
    walletCredited: receipt.wallet_credited,
    hasPdf: Boolean(receipt.pdf_s3_key),
    status: receipt.status,
    generationError: receipt.generation_error,
    generatedAt: receipt.generated_at?.toISOString() ?? null,
    refundReference: receipt.refund_reference,
    refundAmount:
      receipt.refund_amount !== null ? decimalToNumber(receipt.refund_amount) : null,
    refundedAt: receipt.refunded_at?.toISOString() ?? null,
    createdAt: receipt.created_at.toISOString(),
    updatedAt: receipt.updated_at.toISOString(),
  };
}

export async function listGatewayPaymentReceipts(
  query: ListGatewayPaymentReceiptsQuery,
  db: PrismaClient = defaultPrisma
) {
  const where: Prisma.GatewayPaymentReceiptWhereInput = {};

  if (query.receiptNumber) {
    where.receipt_number = { contains: query.receiptNumber, mode: "insensitive" };
  }
  if (query.purpose) where.payment_purpose = query.purpose;
  if (query.status) where.status = query.status;
  if (query.payer) {
    where.OR = [
      { payer_name: { contains: query.payer, mode: "insensitive" } },
      { payer_company_name: { contains: query.payer, mode: "insensitive" } },
      { payer_email: { contains: query.payer, mode: "insensitive" } },
    ];
  }
  if (query.from || query.to) {
    where.payment_date = {
      ...(query.from ? { gte: new Date(query.from) } : {}),
      ...(query.to ? { lte: new Date(query.to) } : {}),
    };
  }

  const skip = (query.page - 1) * query.pageSize;
  const [items, total] = await Promise.all([
    db.gatewayPaymentReceipt.findMany({
      where,
      orderBy: { payment_date: "desc" },
      skip,
      take: query.pageSize,
    }),
    db.gatewayPaymentReceipt.count({ where }),
  ]);

  return {
    items: items.map(mapReceipt),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function getGatewayPaymentReceipt(
  receiptId: string,
  db: PrismaClient = defaultPrisma
) {
  const receipt = await db.gatewayPaymentReceipt.findUnique({
    where: { id: receiptId },
  });
  if (!receipt) {
    throw new AppError(404, "RECEIPT_NOT_FOUND", "Payment receipt not found");
  }
  return mapReceipt(receipt);
}

export async function getGatewayPaymentReceiptByPaymentId(
  gatewayPaymentId: string,
  db: PrismaClient = defaultPrisma
) {
  const receipt = await db.gatewayPaymentReceipt.findUnique({
    where: { gateway_payment_id: gatewayPaymentId },
  });
  if (!receipt) {
    throw new AppError(404, "RECEIPT_NOT_FOUND", "Payment receipt not found");
  }
  return mapReceipt(receipt);
}

export async function getGatewayPaymentReceiptPdfUrl(
  receiptId: string,
  mode: "view" | "download",
  db: PrismaClient = defaultPrisma
) {
  const receipt = await db.gatewayPaymentReceipt.findUnique({
    where: { id: receiptId },
  });
  if (!receipt) {
    throw new AppError(404, "RECEIPT_NOT_FOUND", "Payment receipt not found");
  }
  if (!receipt.pdf_s3_key) {
    throw new AppError(409, "RECEIPT_PDF_UNAVAILABLE", "Receipt PDF is not available yet");
  }

  const fileName = `${receipt.receipt_number}.pdf`;
  if (mode === "download") {
    const result = await generatePresignedDownloadUrl({
      key: receipt.pdf_s3_key,
      fileName,
    });
    return {
      url: result.downloadUrl,
      expiresIn: result.expiresIn,
      fileName,
      mode,
    };
  }

  const result = await generatePresignedViewUrl({ key: receipt.pdf_s3_key });
  return {
    url: result.viewUrl,
    expiresIn: result.expiresIn,
    fileName,
    mode,
  };
}

export async function retryGatewayPaymentReceiptGeneration(
  receiptId: string,
  db: PrismaClient = defaultPrisma
) {
  const receipt = await db.gatewayPaymentReceipt.findUnique({
    where: { id: receiptId },
  });
  if (!receipt) {
    throw new AppError(404, "RECEIPT_NOT_FOUND", "Payment receipt not found");
  }

  const updated = await generateGatewayPaymentReceipt(receipt.gateway_payment_id, db);
  if (!updated) {
    throw new AppError(422, "RECEIPT_RETRY_FAILED", "Receipt could not be regenerated");
  }
  return mapReceipt(updated);
}
