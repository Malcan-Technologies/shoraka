import {
  GatewayOrganizationType,
  GatewayPayment,
  GatewayPaymentPurpose,
  GatewayPaymentStatus,
  InvestorBalanceTransactionSource,
  InvestorOrganization,
  NameCheckResult,
  NoteLedgerDirection,
  OrganizationType,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { randomUUID } from "crypto";
import { getCurlecConfig } from "../../config/curlec";
import { AppError } from "../../lib/http/error-handler";
import { prisma as defaultPrisma } from "../../lib/prisma";
import { creditInvestorBalance } from "../notes/investor-balance";
import { postLedgerEntry } from "../notes/ledger";
import { createCurlecClient } from "./curlec-client";
import { CreateInvestorDepositInput } from "./deposit-schemas";
import { myrToSen } from "./money";
import { assertTransition } from "./state";

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

export function resolveInvestorExpectedName(org: InvestorOrganization): string | null {
  if (org.type === OrganizationType.COMPANY) {
    const data = org.corporate_onboarding_data;
    if (data && typeof data === "object" && !Array.isArray(data)) {
      const basicInfo = (data as { basicInfo?: { businessName?: string } }).basicInfo;
      const businessName = basicInfo?.businessName?.trim();
      if (businessName) return businessName;
    }
  }

  const parts = [org.first_name, org.middle_name, org.last_name]
    .map((part) => part?.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

export async function creditCompletedDeposit(
  tx: Prisma.TransactionClient,
  gatewayPayment: GatewayPayment,
  opts?: { nameCheckResult?: NameCheckResult; actorUserId?: string }
) {
  assertTransition(gatewayPayment.status, GatewayPaymentStatus.COMPLETED);

  if (!gatewayPayment.investor_organization_id) {
    throw new AppError(
      500,
      "GATEWAY_PAYMENT_INVALID",
      "Investor deposit is missing organization"
    );
  }

  const amount = decimalToNumber(gatewayPayment.amount);
  const orgId = gatewayPayment.investor_organization_id;

  await tx.investorOrganization.update({
    where: { id: orgId },
    data: { deposit_received: true },
  });

  const balanceTransaction = await creditInvestorBalance(tx, {
    investorOrganizationId: orgId,
    amount,
    source: InvestorBalanceTransactionSource.GATEWAY_DEPOSIT,
    idempotencyKey: `gateway-deposit:balance:${gatewayPayment.id}`,
    metadata: {
      gatewayPaymentId: gatewayPayment.id,
      curlecOrderId: gatewayPayment.curlec_order_id,
      curlecPaymentId: gatewayPayment.curlec_payment_id,
    },
  });

  await postLedgerEntry(tx, {
    accountCode: "INVESTOR_POOL",
    direction: NoteLedgerDirection.CREDIT,
    amount,
    description: "Investor gateway deposit received into investor pool",
    idempotencyKey: `gateway-deposit:ledger:${gatewayPayment.id}`,
    gatewayPaymentId: gatewayPayment.id,
    metadata: {
      gatewayPaymentId: gatewayPayment.id,
      investorOrganizationId: orgId,
      investorBalanceTransactionId: balanceTransaction.id,
      source: InvestorBalanceTransactionSource.GATEWAY_DEPOSIT,
      ...(opts?.actorUserId ? { actorUserId: opts.actorUserId } : {}),
    },
  });

  await tx.gatewayPayment.update({
    where: { id: gatewayPayment.id },
    data: {
      status: GatewayPaymentStatus.COMPLETED,
      name_check_result: opts?.nameCheckResult ?? NameCheckResult.PASS,
      name_check_at: new Date(),
    },
  });
}
