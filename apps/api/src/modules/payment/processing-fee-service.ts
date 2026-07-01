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

async function getApplicationProcessingFeeAmount(db: PrismaClient) {
  const settings = await db.platformFinanceSetting.upsert({
    where: { key: "DEFAULT" },
    update: {},
    create: { key: "DEFAULT" },
  });

  return decimalToNumber(settings.application_processing_fee_amount);
}

async function findExistingProcessingFeePayment(db: PrismaClient, applicationId: string) {
  return db.gatewayPayment.findFirst({
    where: {
      purpose: GatewayPaymentPurpose.APPLICATION_PROCESSING_FEE,
      application_id: applicationId,
      status: { not: GatewayPaymentStatus.FAILED },
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

export async function createApplicationProcessingFee(
  actor: ActorContext,
  applicationId: string,
  db: PrismaClient = defaultPrisma
) {
  const application = await assertApplicationAccess(db, actor, applicationId);

  const completed = await db.gatewayPayment.findFirst({
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

  const existing = await findExistingProcessingFeePayment(db, applicationId);
  if (existing) {
    return mapGatewayPaymentResponse(existing);
  }

  const amount = await getApplicationProcessingFeeAmount(db);

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
    db
  );
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
