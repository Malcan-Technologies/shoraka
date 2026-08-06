import {
  GatewayOrganizationType,
  GatewayPaymentPurpose,
  GatewayPaymentStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { AppError } from "../../lib/http/error-handler";
import { prisma as defaultPrisma } from "../../lib/prisma";
import type { ActorContext } from "./deposit-service";
import { createGatewayOrder, mapGatewayPaymentResponse } from "./gateway-order-service";
import { syncGatewayPaymentFromCurlec } from "./webhook-service";

function decimalToNumber(value: Prisma.Decimal): number {
  return value.toNumber();
}

async function assertApplicationAccess(
  db: PrismaClient,
  actor: ActorContext,
  applicationId: string
) {
  const application = await db.application.findFirst({
    where: {
      id: applicationId,
      issuer_organization: {
        OR: [{ owner_user_id: actor.userId }, { members: { some: { user_id: actor.userId } } }],
      },
    },
    select: {
      id: true,
      issuer_organization_id: true,
    },
  });

  if (!application) {
    throw new AppError(403, "APPLICATION_FORBIDDEN", "Application not accessible");
  }

  return application;
}

async function getApplicationProcessingFeeAmount(db: PrismaClient | Prisma.TransactionClient) {
  const settings = await db.platformFinanceSetting.upsert({
    where: { key: "DEFAULT" },
    update: {},
    create: { key: "DEFAULT" },
  });

  return decimalToNumber(settings.application_processing_fee_amount);
}

async function findExistingProcessingFeePayment(
  db: PrismaClient | Prisma.TransactionClient,
  applicationId: string
) {
  const reusableStatuses = [GatewayPaymentStatus.CREATED, GatewayPaymentStatus.PAID];
  return db.gatewayPayment.findFirst({
    where: {
      purpose: GatewayPaymentPurpose.APPLICATION_PROCESSING_FEE,
      application_id: applicationId,
      status: { in: reusableStatuses },
    },
    orderBy: { created_at: "desc" },
  });
}

export async function hasCompletedApplicationProcessingFee(
  applicationId: string,
  db: PrismaClient = defaultPrisma
) {
  const completed = await db.gatewayPayment.findFirst({
    where: {
      application_id: applicationId,
      purpose: GatewayPaymentPurpose.APPLICATION_PROCESSING_FEE,
      status: GatewayPaymentStatus.COMPLETED,
    },
    select: { id: true },
  });

  return Boolean(completed);
}

export async function assertApplicationProcessingFeePaid(
  applicationId: string,
  db: PrismaClient = defaultPrisma
) {
  const paid = await hasCompletedApplicationProcessingFee(applicationId, db);
  if (!paid) {
    throw new AppError(
      402,
      "PROCESSING_FEE_REQUIRED",
      "Application processing fee must be paid before submitting"
    );
  }
}

async function findBlockingProcessingFeePayment(
  db: PrismaClient | Prisma.TransactionClient,
  applicationId: string
) {
  return db.gatewayPayment.findFirst({
    where: {
      purpose: GatewayPaymentPurpose.APPLICATION_PROCESSING_FEE,
      application_id: applicationId,
      status: {
        in: [GatewayPaymentStatus.HELD, GatewayPaymentStatus.REFUND_INITIATED],
      },
    },
    orderBy: { created_at: "desc" },
  });
}

export async function createApplicationProcessingFee(
  actor: ActorContext,
  applicationId: string,
  db: PrismaClient = defaultPrisma
) {
  const application = await assertApplicationAccess(db, actor, applicationId);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT id FROM applications
      WHERE id = ${applicationId}
      FOR UPDATE
    `;

    const completed = await tx.gatewayPayment.findFirst({
      where: {
        purpose: GatewayPaymentPurpose.APPLICATION_PROCESSING_FEE,
        application_id: applicationId,
        status: GatewayPaymentStatus.COMPLETED,
      },
      orderBy: { created_at: "desc" },
    });

    if (completed) {
      return mapGatewayPaymentResponse(completed);
    }

    const blocking = await findBlockingProcessingFeePayment(tx, applicationId);
    if (blocking) {
      throw new AppError(
        409,
        "PROCESSING_FEE_CAPTURE_MISMATCH_HELD",
        blocking.status === GatewayPaymentStatus.REFUND_INITIATED
          ? "A mismatched application processing fee refund is still pending. Do not create another payment order."
          : "A captured application processing fee payment needs attention. Do not create another payment order.",
        { gatewayPaymentId: blocking.id, status: blocking.status }
      );
    }

    const existing = await findExistingProcessingFeePayment(tx, applicationId);
    if (existing) {
      return mapGatewayPaymentResponse(existing);
    }

    const amount = await getApplicationProcessingFeeAmount(tx);

    return createGatewayOrder(
      actor,
      {
        purpose: GatewayPaymentPurpose.APPLICATION_PROCESSING_FEE,
        organizationType: GatewayOrganizationType.ISSUER,
        amount,
        receiptPrefix: "pf",
        notes: {
          applicationId,
          issuerOrganizationId: application.issuer_organization_id,
        },
        issuerOrganizationId: application.issuer_organization_id,
        applicationId,
      },
      tx
    );
  });
}

export async function getApplicationProcessingFee(
  actor: ActorContext,
  applicationId: string,
  feePaymentId: string,
  db: PrismaClient = defaultPrisma
) {
  await assertApplicationAccess(db, actor, applicationId);

  const payment = await db.gatewayPayment.findFirst({
    where: {
      id: feePaymentId,
      application_id: applicationId,
      purpose: GatewayPaymentPurpose.APPLICATION_PROCESSING_FEE,
    },
  });

  if (!payment) {
    throw new AppError(
      404,
      "PROCESSING_FEE_NOT_FOUND",
      "Application processing fee payment not found"
    );
  }

  const synced = await syncGatewayPaymentFromCurlec(payment, db);
  return mapGatewayPaymentResponse(synced);
}
