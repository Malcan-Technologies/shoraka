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
import { CreateIssuerOnboardingFeeInput } from "./onboarding-fee-schemas";
import { createGatewayOrder, mapGatewayPaymentResponse } from "./gateway-order-service";

function decimalToNumber(value: Prisma.Decimal): number {
  return value.toNumber();
}

async function assertIssuerOrgAccess(
  db: PrismaClient,
  actor: ActorContext,
  issuerOrganizationId: string
) {
  const issuerOrg = await db.issuerOrganization.findFirst({
    where: {
      id: issuerOrganizationId,
      OR: [{ owner_user_id: actor.userId }, { members: { some: { user_id: actor.userId } } }],
    },
  });

  if (!issuerOrg) {
    throw new AppError(403, "ISSUER_ORG_FORBIDDEN", "Issuer organization not accessible");
  }

  return issuerOrg;
}

async function getIssuerOnboardingFeeAmount(db: PrismaClient) {
  const settings = await db.platformFinanceSetting.upsert({
    where: { key: "DEFAULT" },
    update: {},
    create: { key: "DEFAULT" },
  });

  return decimalToNumber(settings.issuer_onboarding_fee_amount);
}

async function findExistingOnboardingFeePayment(
  db: PrismaClient,
  issuerOrganizationId: string
) {
  return db.gatewayPayment.findFirst({
    where: {
      purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
      issuer_organization_id: issuerOrganizationId,
      status: { not: GatewayPaymentStatus.FAILED },
    },
    orderBy: { created_at: "desc" },
  });
}

export async function createIssuerOnboardingFee(
  actor: ActorContext,
  input: CreateIssuerOnboardingFeeInput,
  db: PrismaClient = defaultPrisma
) {
  const issuerOrg = await assertIssuerOrgAccess(db, actor, input.issuerOrganizationId);

  if (issuerOrg.onboarding_fee_paid_at) {
    const completed = await db.gatewayPayment.findFirst({
      where: {
        purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
        issuer_organization_id: input.issuerOrganizationId,
        status: GatewayPaymentStatus.COMPLETED,
      },
      orderBy: { created_at: "desc" },
    });

    if (completed) {
      return mapGatewayPaymentResponse(completed);
    }
  }

  const existing = await findExistingOnboardingFeePayment(db, input.issuerOrganizationId);
  if (existing) {
    return mapGatewayPaymentResponse(existing);
  }

  const amount = await getIssuerOnboardingFeeAmount(db);

  return createGatewayOrder(
    actor,
    {
      purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
      organizationType: GatewayOrganizationType.ISSUER,
      amount,
      receiptPrefix: "fee",
      notes: {
        issuerOrganizationId: input.issuerOrganizationId,
      },
      issuerOrganizationId: input.issuerOrganizationId,
    },
    db
  );
}

export async function getIssuerOnboardingFee(
  actor: ActorContext,
  feePaymentId: string,
  db: PrismaClient = defaultPrisma
) {
  const payment = await db.gatewayPayment.findFirst({
    where: {
      id: feePaymentId,
      purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
      issuer_organization: {
        OR: [{ owner_user_id: actor.userId }, { members: { some: { user_id: actor.userId } } }],
      },
    },
  });

  if (!payment) {
    throw new AppError(404, "ONBOARDING_FEE_NOT_FOUND", "Onboarding fee payment not found");
  }

  return mapGatewayPaymentResponse(payment);
}
