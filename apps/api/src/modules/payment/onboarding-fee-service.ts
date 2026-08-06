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
import { syncGatewayPaymentFromCurlec } from "./webhook-service";

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

async function getIssuerOnboardingFeeAmount(db: PrismaClient | Prisma.TransactionClient) {
  const settings = await db.platformFinanceSetting.upsert({
    where: { key: "DEFAULT" },
    update: {},
    create: { key: "DEFAULT" },
  });

  return decimalToNumber(settings.issuer_onboarding_fee_amount);
}

async function findExistingOnboardingFeePayment(
  db: PrismaClient | Prisma.TransactionClient,
  issuerOrganizationId: string
) {
  const reusableStatuses = [GatewayPaymentStatus.CREATED, GatewayPaymentStatus.PAID];
  return db.gatewayPayment.findFirst({
    where: {
      purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
      issuer_organization_id: issuerOrganizationId,
      status: { in: reusableStatuses },
    },
    orderBy: { created_at: "desc" },
  });
}

async function findBlockingOnboardingFeePayment(
  db: PrismaClient | Prisma.TransactionClient,
  issuerOrganizationId: string
) {
  return db.gatewayPayment.findFirst({
    where: {
      purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
      issuer_organization_id: issuerOrganizationId,
      status: {
        in: [GatewayPaymentStatus.HELD, GatewayPaymentStatus.REFUND_INITIATED],
      },
    },
    orderBy: { created_at: "desc" },
  });
}

/**
 * Authoritative gate for issuer onboarding progression (eKYB start/retry, etc.).
 * Unpaid, refunded, pending-refund, and held fees all block advancement.
 */
export async function assertIssuerOnboardingFeePaid(
  db: PrismaClient | Prisma.TransactionClient,
  issuerOrganizationId: string
) {
  const issuerOrg = await db.issuerOrganization.findUnique({
    where: { id: issuerOrganizationId },
    select: { id: true, onboarding_fee_paid_at: true },
  });
  if (!issuerOrg) {
    throw new AppError(404, "ISSUER_ORG_NOT_FOUND", "Issuer organization not found");
  }

  const blocking = await findBlockingOnboardingFeePayment(db, issuerOrganizationId);
  if (blocking || !issuerOrg.onboarding_fee_paid_at) {
    throw new AppError(
      402,
      "ONBOARDING_FEE_REQUIRED",
      "Your onboarding fee was refunded or is unpaid. Please make a new payment to continue."
    );
  }
}

export async function clearIssuerOnboardingFeePaidAt(
  tx: Prisma.TransactionClient,
  issuerOrganizationId: string
) {
  await tx.issuerOrganization.update({
    where: { id: issuerOrganizationId },
    data: { onboarding_fee_paid_at: null },
  });
}

export async function restoreIssuerOnboardingFeePaidAt(
  tx: Prisma.TransactionClient,
  issuerOrganizationId: string,
  paidAt?: Date | string | null
) {
  await tx.issuerOrganization.update({
    where: { id: issuerOrganizationId },
    data: {
      onboarding_fee_paid_at:
        paidAt instanceof Date ? paidAt : paidAt ? new Date(paidAt) : new Date(),
    },
  });
}

export async function createIssuerOnboardingFee(
  actor: ActorContext,
  input: CreateIssuerOnboardingFeeInput,
  db: PrismaClient = defaultPrisma
) {
  const issuerOrg = await assertIssuerOrgAccess(db, actor, input.issuerOrganizationId);

  if (!issuerOrg.tnc_accepted) {
    throw new AppError(
      402,
      "TNC_REQUIRED",
      "Terms and Conditions must be accepted before paying the onboarding fee"
    );
  }

  return db.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT id FROM issuer_organizations
      WHERE id = ${input.issuerOrganizationId}
      FOR UPDATE
    `;

    if (issuerOrg.onboarding_fee_paid_at) {
      const completed = await tx.gatewayPayment.findFirst({
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

    const blocking = await findBlockingOnboardingFeePayment(tx, input.issuerOrganizationId);
    if (blocking) {
      throw new AppError(
        409,
        "ONBOARDING_FEE_CAPTURE_MISMATCH_HELD",
        blocking.status === GatewayPaymentStatus.REFUND_INITIATED
          ? "A mismatched onboarding fee refund is still pending. Do not create another payment order."
          : "A captured onboarding fee payment needs attention. Do not create another payment order.",
        { gatewayPaymentId: blocking.id, status: blocking.status }
      );
    }

    const existing = await findExistingOnboardingFeePayment(tx, input.issuerOrganizationId);
    if (existing) {
      return mapGatewayPaymentResponse(existing);
    }

    const amount = await getIssuerOnboardingFeeAmount(tx);

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
      tx
    );
  });
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

  const synced = await syncGatewayPaymentFromCurlec(payment, db);
  return mapGatewayPaymentResponse(synced);
}

export async function getIssuerOnboardingFeeStatus(
  actor: ActorContext,
  issuerOrganizationId: string,
  db: PrismaClient = defaultPrisma
) {
  const issuerOrg = await assertIssuerOrgAccess(db, actor, issuerOrganizationId);
  const amount = await getIssuerOnboardingFeeAmount(db);

  const latest = await db.gatewayPayment.findFirst({
    where: {
      purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
      issuer_organization_id: issuerOrganizationId,
    },
    orderBy: { created_at: "desc" },
  });

  return {
    amount,
    latestPayment: latest ? mapGatewayPaymentResponse(latest) : null,
    isPaid: Boolean(issuerOrg.onboarding_fee_paid_at),
    isUnderReview:
      latest?.status === GatewayPaymentStatus.HELD ||
      latest?.status === GatewayPaymentStatus.REFUND_INITIATED,
    requiresRepayment:
      !issuerOrg.onboarding_fee_paid_at &&
      latest?.status === GatewayPaymentStatus.REFUNDED,
  };
}
