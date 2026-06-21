import {
  GatewayOrganizationType,
  GatewayPayment,
  GatewayPaymentPurpose,
  GatewayPaymentStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { randomUUID } from "crypto";
import { getCurlecConfig } from "../../config/curlec";
import { AppError } from "../../lib/http/error-handler";
import { prisma as defaultPrisma } from "../../lib/prisma";
import { createCurlecClient } from "./curlec-client";
import { CreateInvestorDepositInput } from "./deposit-schemas";
import { myrToSen } from "./money";

export type ActorContext = {
  userId: string;
  role?: string;
  portal?: string;
  correlationId?: string;
};

function decimalToNumber(value: Prisma.Decimal): number {
  return value.toNumber();
}

function mapDepositResponse(payment: GatewayPayment) {
  return {
    id: payment.id,
    status: payment.status,
    purpose: payment.purpose,
    amount: decimalToNumber(payment.amount),
    currency: payment.currency,
    curlecOrderId: payment.curlec_order_id,
    curlecKeyId: getCurlecConfig().keyId,
    investorOrganizationId: payment.investor_organization_id,
    nameCheckResult: payment.name_check_result,
    payerName: payment.payer_name,
    createdAt: payment.created_at.toISOString(),
    updatedAt: payment.updated_at.toISOString(),
  };
}

async function assertInvestorOrgAccess(
  db: PrismaClient,
  actor: ActorContext,
  investorOrganizationId: string
) {
  const investorOrg = await db.investorOrganization.findFirst({
    where: {
      id: investorOrganizationId,
      OR: [{ owner_user_id: actor.userId }, { members: { some: { user_id: actor.userId } } }],
    },
  });

  if (!investorOrg) {
    throw new AppError(403, "INVESTOR_ORG_FORBIDDEN", "Investor organization not accessible");
  }

  return investorOrg;
}

async function getDepositLimits(db: PrismaClient) {
  const settings = await db.platformFinanceSetting.upsert({
    where: { key: "DEFAULT" },
    update: {},
    create: { key: "DEFAULT" },
  });

  return {
    minAmount: decimalToNumber(settings.investor_min_deposit_amount),
    maxAmount: decimalToNumber(settings.investor_max_deposit_amount),
  };
}

export async function createInvestorDeposit(
  actor: ActorContext,
  input: CreateInvestorDepositInput,
  db: PrismaClient = defaultPrisma
) {
  await assertInvestorOrgAccess(db, actor, input.investorOrganizationId);

  const { minAmount, maxAmount } = await getDepositLimits(db);
  if (input.amount < minAmount) {
    throw new AppError(
      400,
      "DEPOSIT_BELOW_MINIMUM",
      `Minimum deposit amount is RM ${minAmount}`
    );
  }
  if (input.amount > maxAmount) {
    throw new AppError(
      400,
      "DEPOSIT_ABOVE_MAXIMUM",
      `Maximum deposit amount is RM ${maxAmount}`
    );
  }

  const receipt = `dep_${randomUUID().replace(/-/g, "").slice(0, 24)}`;
  const curlecClient = createCurlecClient();
  const order = await curlecClient.createOrder({
    amountSen: myrToSen(input.amount),
    currency: "MYR",
    receipt,
    notes: {
      purpose: GatewayPaymentPurpose.INVESTOR_DEPOSIT,
      investorOrganizationId: input.investorOrganizationId,
    },
  });

  const payment = await db.gatewayPayment.create({
    data: {
      purpose: GatewayPaymentPurpose.INVESTOR_DEPOSIT,
      organization_type: GatewayOrganizationType.INVESTOR,
      investor_organization_id: input.investorOrganizationId,
      amount: new Prisma.Decimal(input.amount.toFixed(6)),
      currency: "MYR",
      status: GatewayPaymentStatus.CREATED,
      curlec_order_id: order.id,
      idempotency_key: `curlec:order:${order.id}`,
      metadata: {
        actorUserId: actor.userId,
        receipt,
      },
    },
  });

  return mapDepositResponse(payment);
}

export async function getInvestorDeposit(
  actor: ActorContext,
  depositId: string,
  db: PrismaClient = defaultPrisma
) {
  const payment = await db.gatewayPayment.findFirst({
    where: {
      id: depositId,
      purpose: GatewayPaymentPurpose.INVESTOR_DEPOSIT,
      investor_organization: {
        OR: [{ owner_user_id: actor.userId }, { members: { some: { user_id: actor.userId } } }],
      },
    },
  });

  if (!payment) {
    throw new AppError(404, "DEPOSIT_NOT_FOUND", "Deposit not found");
  }

  return mapDepositResponse(payment);
}
