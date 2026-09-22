import {
  GatewayPaymentPurpose,
  GatewayPaymentReceiptStatus,
  PrismaClient,
} from "@prisma/client";
import type { ActorContext } from "../deposit-service";
import { AppError } from "../../../lib/http/error-handler";
import { prisma as defaultPrisma } from "../../../lib/prisma";
import { generatePresignedDownloadUrl, generatePresignedViewUrl } from "../../../lib/s3/client";

type ReceiptMode = "view" | "download";

function fileNameFromReceiptNumber(receipt_number: string | null | undefined) {
  return receipt_number ? `${receipt_number}.pdf` : null;
}

export async function getIssuerOnboardingFeeReceiptPdfUrl(
  actor: ActorContext,
  gatewayPaymentId: string,
  mode: ReceiptMode,
  db: PrismaClient = defaultPrisma
): Promise<{
  url: string | null;
  expiresIn: number | null;
  fileName: string | null;
  mode: ReceiptMode;
  hasPdf: boolean;
  receiptStatus: GatewayPaymentReceiptStatus | null;
}> {
  const payment = await db.gatewayPayment.findFirst({
    where: {
      id: gatewayPaymentId,
      purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
    },
    select: { issuer_organization_id: true },
  });

  if (!payment?.issuer_organization_id) {
    throw new AppError(404, "ONBOARDING_FEE_NOT_FOUND", "Onboarding fee not found");
  }

  const issuerOrg = await db.issuerOrganization.findFirst({
    where: {
      id: payment.issuer_organization_id,
      OR: [{ owner_user_id: actor.userId }, { members: { some: { user_id: actor.userId } } }],
    },
    select: { id: true },
  });

  if (!issuerOrg) {
    // Avoid leaking existence.
    throw new AppError(404, "ONBOARDING_FEE_NOT_FOUND", "Onboarding fee not found");
  }

  const receipt = await db.gatewayPaymentReceipt.findUnique({
    where: { gateway_payment_id: gatewayPaymentId },
    select: {
      receipt_number: true,
      pdf_s3_key: true,
      status: true,
    },
  });

  if (!receipt?.pdf_s3_key) {
    return {
      url: null,
      expiresIn: null,
      fileName: fileNameFromReceiptNumber(receipt?.receipt_number),
      mode,
      hasPdf: false,
      receiptStatus: receipt?.status ?? null,
    };
  }

  const fileName = fileNameFromReceiptNumber(receipt.receipt_number);
  if (mode === "download") {
    const result = await generatePresignedDownloadUrl({
      key: receipt.pdf_s3_key,
      fileName: fileName ?? "receipt.pdf",
    });
    return {
      url: result.downloadUrl,
      expiresIn: result.expiresIn,
      fileName,
      mode,
      hasPdf: true,
      receiptStatus: receipt.status,
    };
  }

  const result = await generatePresignedViewUrl({ key: receipt.pdf_s3_key });
  return {
    url: result.viewUrl,
    expiresIn: result.expiresIn,
    fileName,
    mode,
    hasPdf: true,
    receiptStatus: receipt.status,
  };
}

export async function getIssuerApplicationProcessingFeeReceiptPdfUrl(
  actor: ActorContext,
  applicationId: string,
  gatewayPaymentId: string,
  mode: ReceiptMode,
  db: PrismaClient = defaultPrisma
): Promise<{
  url: string | null;
  expiresIn: number | null;
  fileName: string | null;
  mode: ReceiptMode;
  hasPdf: boolean;
  receiptStatus: GatewayPaymentReceiptStatus | null;
}> {
  const application = await db.application.findFirst({
    where: {
      id: applicationId,
      issuer_organization: {
        OR: [{ owner_user_id: actor.userId }, { members: { some: { user_id: actor.userId } } }],
      },
    },
    select: { id: true },
  });

  if (!application) {
    throw new AppError(404, "PROCESSING_FEE_NOT_FOUND", "Application not found");
  }

  const payment = await db.gatewayPayment.findFirst({
    where: {
      id: gatewayPaymentId,
      purpose: GatewayPaymentPurpose.APPLICATION_PROCESSING_FEE,
      application_id: applicationId,
    },
    select: { id: true },
  });

  if (!payment) {
    throw new AppError(404, "PROCESSING_FEE_NOT_FOUND", "Processing fee not found");
  }

  const receipt = await db.gatewayPaymentReceipt.findUnique({
    where: { gateway_payment_id: gatewayPaymentId },
    select: {
      receipt_number: true,
      pdf_s3_key: true,
      status: true,
    },
  });

  if (!receipt?.pdf_s3_key) {
    return {
      url: null,
      expiresIn: null,
      fileName: fileNameFromReceiptNumber(receipt?.receipt_number),
      mode,
      hasPdf: false,
      receiptStatus: receipt?.status ?? null,
    };
  }

  const fileName = fileNameFromReceiptNumber(receipt.receipt_number);
  if (mode === "download") {
    const result = await generatePresignedDownloadUrl({
      key: receipt.pdf_s3_key,
      fileName: fileName ?? "receipt.pdf",
    });
    return {
      url: result.downloadUrl,
      expiresIn: result.expiresIn,
      fileName,
      mode,
      hasPdf: true,
      receiptStatus: receipt.status,
    };
  }

  const result = await generatePresignedViewUrl({ key: receipt.pdf_s3_key });
  return {
    url: result.viewUrl,
    expiresIn: result.expiresIn,
    fileName,
    mode,
    hasPdf: true,
    receiptStatus: receipt.status,
  };
}

