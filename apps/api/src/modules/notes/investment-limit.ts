import {
  GatewayPaymentPurpose,
  GatewayPaymentStatus,
  NoteInvestmentStatus,
  NoteStatus,
  Prisma,
  PrismaClient,
  type ScInvestorCategory,
} from "@prisma/client";
import {
  INVESTMENT_LIMIT_TIER_LABELS,
  investmentLimitTierFor,
  moneyAmountExceeds,
  roundNoteMoney,
  type InvestmentLimitTier,
  type InvestorInvestmentLimit,
} from "@cashsouk/types";
import { AppError } from "../../lib/http/error-handler";
import { prisma as defaultPrisma } from "../../lib/prisma";

export const PENDING_INVESTMENT_LIMIT_DEPOSIT_STATUSES: GatewayPaymentStatus[] = [
  GatewayPaymentStatus.CREATED,
  GatewayPaymentStatus.PAID,
  GatewayPaymentStatus.NAME_CHECK_PENDING,
  GatewayPaymentStatus.HELD,
];

type DbClient = PrismaClient | Prisma.TransactionClient;

type ActorContext = {
  userId: string;
};

export type InvestmentHeadroomInput = {
  tier: InvestmentLimitTier;
  limit: number | null;
  outstandingPrincipal: number;
  walletBalance: number;
  pendingDeposits: number;
  minDepositAmount: number;
  maxDepositAmount: number;
};

function toNumber(value: unknown): number {
  if (value instanceof Prisma.Decimal) return value.toNumber();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toNumberOrNull(value: unknown): number | null {
  if (value == null) return null;
  return toNumber(value);
}

function formatRm(amount: number): string {
  return `RM ${roundNoteMoney(amount).toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function buildInvestmentHeadroom(input: InvestmentHeadroomInput): InvestorInvestmentLimit {
  const outstandingPrincipal = roundNoteMoney(Math.max(0, input.outstandingPrincipal));
  const walletBalance = roundNoteMoney(Math.max(0, input.walletBalance));
  const pendingDeposits = roundNoteMoney(Math.max(0, input.pendingDeposits));
  const minDepositAmount = roundNoteMoney(Math.max(0, input.minDepositAmount));
  const txnMax = roundNoteMoney(Math.max(0, input.maxDepositAmount));
  const limit = input.limit == null ? null : roundNoteMoney(Math.max(0, input.limit));

  const investHeadroom =
    limit == null ? null : roundNoteMoney(Math.max(0, limit - outstandingPrincipal));
  const depositHeadroom =
    limit == null
      ? null
      : roundNoteMoney(Math.max(0, limit - outstandingPrincipal - walletBalance - pendingDeposits));
  const depositMaxAmount =
    depositHeadroom == null ? txnMax : roundNoteMoney(Math.min(txnMax, depositHeadroom));

  return {
    tier: input.tier,
    limit,
    outstandingPrincipal,
    walletBalance,
    pendingDeposits,
    investHeadroom,
    depositHeadroom,
    depositMaxAmount,
    minDepositAmount,
  };
}

export function investmentLimitExceededMessage(input: {
  action: "invest" | "deposit";
  remaining: number;
  tier: InvestmentLimitTier;
  limit: number;
}): string {
  const verb = input.action === "invest" ? "invest" : "deposit";
  const tierLabel = INVESTMENT_LIMIT_TIER_LABELS[input.tier];
  return `You can ${verb} up to ${formatRm(input.remaining)} more under your ${tierLabel} limit of ${formatRm(input.limit)}.`;
}

export async function lockInvestorInvestmentLimit(
  tx: Prisma.TransactionClient,
  investorOrganizationId: string
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`investment-limit:${investorOrganizationId}`}))`;
}

async function loadSettings(db: DbClient) {
  const settings = await db.platformFinanceSetting.upsert({
    where: { key: "DEFAULT" },
    update: {},
    create: { key: "DEFAULT" },
  });
  return {
    retail: toNumberOrNull(settings.retail_investment_limit_amount),
    angel: toNumberOrNull(settings.angel_investment_limit_amount),
    sophisticated: toNumberOrNull(settings.sophisticated_investment_limit_amount),
    minDepositAmount: toNumber(settings.investor_min_deposit_amount),
    maxDepositAmount: toNumber(settings.investor_max_deposit_amount),
  };
}

function limitForTier(
  tier: InvestmentLimitTier,
  settings: { retail: number | null; angel: number | null; sophisticated: number | null }
): number | null {
  if (tier === "ANGEL") return settings.angel;
  if (tier === "SOPHISTICATED") return settings.sophisticated;
  return settings.retail;
}

export async function computeInvestmentHeadroom(
  investorOrganizationId: string,
  db: DbClient = defaultPrisma,
  options?: { excludeIntentKey?: string }
): Promise<InvestorInvestmentLimit> {
  const [org, settings, outstandingAgg, balance, pendingAgg] = await Promise.all([
    db.investorOrganization.findUnique({
      where: { id: investorOrganizationId },
      select: { sc_investor_category: true },
    }),
    loadSettings(db),
    db.noteInvestment.aggregate({
      where: {
        investor_organization_id: investorOrganizationId,
        status: { in: [NoteInvestmentStatus.COMMITTED, NoteInvestmentStatus.CONFIRMED] },
        note: { status: { not: NoteStatus.DEFAULTED } },
      },
      _sum: { amount: true },
    }),
    db.investorBalance.findUnique({
      where: { investor_organization_id: investorOrganizationId },
      select: { available_amount: true },
    }),
    db.gatewayPayment.aggregate({
      where: {
        purpose: GatewayPaymentPurpose.INVESTOR_DEPOSIT,
        investor_organization_id: investorOrganizationId,
        status: { in: PENDING_INVESTMENT_LIMIT_DEPOSIT_STATUSES },
        ...(options?.excludeIntentKey ? { idempotency_key: { not: options.excludeIntentKey } } : {}),
      },
      _sum: { amount: true },
    }),
  ]);

  if (!org) {
    throw new AppError(404, "INVESTOR_ORG_NOT_FOUND", "Investor organization not found");
  }

  const tier = investmentLimitTierFor(org.sc_investor_category as ScInvestorCategory | null);
  return buildInvestmentHeadroom({
    tier,
    limit: limitForTier(tier, settings),
    outstandingPrincipal: toNumber(outstandingAgg._sum.amount),
    walletBalance: toNumber(balance?.available_amount),
    pendingDeposits: toNumber(pendingAgg._sum.amount),
    minDepositAmount: settings.minDepositAmount,
    maxDepositAmount: settings.maxDepositAmount,
  });
}

export async function assertInvestmentWithinLimit(
  tx: Prisma.TransactionClient,
  input: { investorOrganizationId: string; amount: number }
) {
  const headroom = await computeInvestmentHeadroom(input.investorOrganizationId, tx);
  if (headroom.limit == null || headroom.investHeadroom == null) return;
  if (!moneyAmountExceeds(input.amount, headroom.investHeadroom)) return;
  throw new AppError(
    422,
    "INVESTMENT_LIMIT_EXCEEDED",
    investmentLimitExceededMessage({
      action: "invest",
      remaining: headroom.investHeadroom,
      tier: headroom.tier,
      limit: headroom.limit,
    }),
    {
      tier: headroom.tier,
      limit: headroom.limit,
      outstandingPrincipal: headroom.outstandingPrincipal,
      remaining: headroom.investHeadroom,
    }
  );
}

export async function assertDepositWithinLimit(
  tx: Prisma.TransactionClient,
  input: { investorOrganizationId: string; amount: number; excludeIntentKey?: string }
) {
  const headroom = await computeInvestmentHeadroom(input.investorOrganizationId, tx, {
    excludeIntentKey: input.excludeIntentKey,
  });
  if (headroom.limit == null || headroom.depositHeadroom == null) return;

  const remaining = headroom.depositHeadroom;
  const blockedBecauseHeadroomBelowMin = remaining < headroom.minDepositAmount - 1e-9;
  if (!blockedBecauseHeadroomBelowMin && !moneyAmountExceeds(input.amount, remaining)) {
    return;
  }

  throw new AppError(
    422,
    "DEPOSIT_LIMIT_EXCEEDED",
    investmentLimitExceededMessage({
      action: "deposit",
      remaining,
      tier: headroom.tier,
      limit: headroom.limit,
    }),
    {
      tier: headroom.tier,
      limit: headroom.limit,
      outstandingPrincipal: headroom.outstandingPrincipal,
      walletBalance: headroom.walletBalance,
      pendingDeposits: headroom.pendingDeposits,
      remaining,
      depositMaxAmount: headroom.depositMaxAmount,
      minDepositAmount: headroom.minDepositAmount,
    }
  );
}

async function assertInvestorOrgAccess(
  db: DbClient,
  actor: ActorContext,
  investorOrganizationId: string
) {
  const investorOrg = await db.investorOrganization.findFirst({
    where: {
      id: investorOrganizationId,
      OR: [{ owner_user_id: actor.userId }, { members: { some: { user_id: actor.userId } } }],
    },
    select: { id: true },
  });
  if (!investorOrg) {
    throw new AppError(403, "INVESTOR_ORG_FORBIDDEN", "Investor organization not accessible");
  }
}

export async function getInvestorInvestmentLimit(
  actor: ActorContext,
  investorOrganizationId: string,
  db: DbClient = defaultPrisma
): Promise<InvestorInvestmentLimit> {
  await assertInvestorOrgAccess(db, actor, investorOrganizationId);
  return computeInvestmentHeadroom(investorOrganizationId, db);
}
