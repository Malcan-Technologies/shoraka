import {
  GatewayPaymentPurpose,
  NoteLedgerAccountType,
  NoteLedgerDirection,
  Prisma,
} from "@prisma/client";
import type { ReportQuery, ReportResult, ReportSummaryRow } from "@cashsouk/types";
import { prisma } from "../../lib/prisma";
import { postedAtRange, reportDefinition, toNumber } from "./report-shared";

export const TRUST_BUCKET_ORDER: NoteLedgerAccountType[] = [
  NoteLedgerAccountType.INVESTOR_POOL,
  NoteLedgerAccountType.REPAYMENT_POOL,
  NoteLedgerAccountType.OPERATING_ACCOUNT,
  NoteLedgerAccountType.TAWIDH_ACCOUNT,
  NoteLedgerAccountType.GHARAMAH_ACCOUNT,
  NoteLedgerAccountType.ISSUER_PAYABLE,
];

export const TRUST_BUCKET_LABELS: Record<NoteLedgerAccountType, string> = {
  INVESTOR_POOL: "Investor Pool",
  REPAYMENT_POOL: "Repayment Pool",
  OPERATING_ACCOUNT: "Operating",
  TAWIDH_ACCOUNT: "Ta'widh",
  GHARAMAH_ACCOUNT: "Gharamah",
  ISSUER_PAYABLE: "Issuer Payable",
};

export type TrustRevenueKind =
  | "drawdown"
  | "service_fee"
  | "onboarding"
  | "processing"
  | "facility"
  | "issuer_residual"
  | "tawidh"
  | "gharamah"
  | "other";

export function classifyTrustMovement(input: {
  accountCode: string;
  direction: NoteLedgerDirection;
  description: string;
  settlementId: string | null;
  gatewayPurpose: GatewayPaymentPurpose | null;
}): TrustRevenueKind {
  if (input.direction !== NoteLedgerDirection.CREDIT) return "other";
  if (input.accountCode === NoteLedgerAccountType.ISSUER_PAYABLE && input.settlementId) {
    return "issuer_residual";
  }
  if (input.accountCode === NoteLedgerAccountType.TAWIDH_ACCOUNT && input.settlementId) {
    return "tawidh";
  }
  if (input.accountCode === NoteLedgerAccountType.GHARAMAH_ACCOUNT && input.settlementId) {
    return "gharamah";
  }
  if (input.accountCode !== NoteLedgerAccountType.OPERATING_ACCOUNT) return "other";
  if (input.gatewayPurpose === GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE) return "onboarding";
  if (input.gatewayPurpose === GatewayPaymentPurpose.APPLICATION_PROCESSING_FEE) return "processing";
  if (input.gatewayPurpose === GatewayPaymentPurpose.FACILITY_FEE) return "facility";
  if (input.settlementId && /service fee/i.test(input.description)) return "service_fee";
  if (/drawdown fee/i.test(input.description)) return "drawdown";
  if (/facility fee/i.test(input.description)) return "facility";
  return "other";
}

export function ledgerSignedBalance(credits: number, debits: number): number {
  return credits - debits;
}

export function ledgerClosing(opening: number, credits: number, debits: number): number {
  return opening + credits - debits;
}

type AggRow = { account_id: string; direction: NoteLedgerDirection; _sum: { amount: Prisma.Decimal | null } };

function totalsByAccount(rows: AggRow[]) {
  const map = new Map<string, { credits: number; debits: number }>();
  for (const row of rows) {
    const current = map.get(row.account_id) ?? { credits: 0, debits: 0 };
    const amount = toNumber(row._sum.amount);
    if (row.direction === NoteLedgerDirection.CREDIT) current.credits += amount;
    else current.debits += amount;
    map.set(row.account_id, current);
  }
  return map;
}

export async function runTrustRevenue(query: ReportQuery): Promise<ReportResult> {
  const report = reportDefinition("trust_revenue");
  const range = postedAtRange(query);
  const accounts = await prisma.noteLedgerAccount.findMany({
    where: { code: { in: TRUST_BUCKET_ORDER } },
    select: { id: true, code: true, name: true },
  });
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const accountIds = accounts.map((account) => account.id);

  const [openingRows, periodRows, periodCredits] = await Promise.all([
    range
      ? prisma.noteLedgerEntry.groupBy({
          by: ["account_id", "direction"],
          where: { account_id: { in: accountIds }, posted_at: { lt: range.gte } },
          _sum: { amount: true },
        })
      : Promise.resolve([] as AggRow[]),
    range
      ? prisma.noteLedgerEntry.groupBy({
          by: ["account_id", "direction"],
          where: { account_id: { in: accountIds }, posted_at: { gte: range.gte, lt: range.lt } },
          _sum: { amount: true },
        })
      : prisma.noteLedgerEntry.groupBy({
          by: ["account_id", "direction"],
          where: { account_id: { in: accountIds } },
          _sum: { amount: true },
        }),
    prisma.noteLedgerEntry.findMany({
      where: {
        account_id: { in: accountIds },
        direction: NoteLedgerDirection.CREDIT,
        ...(range ? { posted_at: { gte: range.gte, lt: range.lt } } : {}),
        OR: [
          { gateway_payment_id: { not: null } },
          { settlement_id: { not: null } },
          { description: { contains: "Drawdown fee", mode: "insensitive" } },
          { description: { contains: "Facility fee", mode: "insensitive" } },
          { description: { contains: "Service fee", mode: "insensitive" } },
        ],
      },
      select: {
        account_id: true,
        amount: true,
        description: true,
        settlement_id: true,
        gateway_payment_id: true,
      },
    }),
  ]);

  const openingByAccount = totalsByAccount(openingRows);
  const periodByAccount = totalsByAccount(periodRows);

  const gatewayIds = periodCredits
    .map((entry) => entry.gateway_payment_id)
    .filter((id): id is string => Boolean(id));
  const gatewayPayments =
    gatewayIds.length > 0
      ? await prisma.gatewayPayment.findMany({
          where: { id: { in: gatewayIds } },
          select: { id: true, purpose: true },
        })
      : [];
  const purposeByPayment = new Map(gatewayPayments.map((payment) => [payment.id, payment.purpose]));

  const revenue: Record<Exclude<TrustRevenueKind, "other">, number> = {
    drawdown: 0,
    service_fee: 0,
    onboarding: 0,
    processing: 0,
    facility: 0,
    issuer_residual: 0,
    tawidh: 0,
    gharamah: 0,
  };
  for (const entry of periodCredits) {
    const account = accountById.get(entry.account_id);
    if (!account) continue;
    const kind = classifyTrustMovement({
      accountCode: account.code,
      direction: NoteLedgerDirection.CREDIT,
      description: entry.description,
      settlementId: entry.settlement_id,
      gatewayPurpose: entry.gateway_payment_id
        ? purposeByPayment.get(entry.gateway_payment_id) ?? null
        : null,
    });
    if (kind === "other") continue;
    revenue[kind] += toNumber(entry.amount);
  }

  const rows = TRUST_BUCKET_ORDER.flatMap((code) => {
    const account = accounts.find((item) => item.code === code);
    if (!account) return [];
    const openingTotals = openingByAccount.get(account.id) ?? { credits: 0, debits: 0 };
    const periodTotals = periodByAccount.get(account.id) ?? { credits: 0, debits: 0 };
    const opening = ledgerSignedBalance(openingTotals.credits, openingTotals.debits);
    return [
      {
        bucket: TRUST_BUCKET_LABELS[code] ?? account.name,
        opening,
        credits: periodTotals.credits,
        debits: periodTotals.debits,
        closing: ledgerClosing(opening, periodTotals.credits, periodTotals.debits),
      },
    ];
  });

  const summaries: ReportSummaryRow[] = [
    { label: "Drawdown fee", amount: revenue.drawdown },
    { label: "Service fee", amount: revenue.service_fee },
    { label: "Onboarding fee", amount: revenue.onboarding },
    { label: "Processing fee", amount: revenue.processing },
    { label: "Facility fee", amount: revenue.facility },
    { label: "Issuer residual", amount: revenue.issuer_residual },
    { label: "Ta'widh", amount: revenue.tawidh },
    { label: "Gharamah", amount: revenue.gharamah },
  ];

  return {
    key: "trust_revenue",
    title: report.title,
    from: query.from ?? null,
    to: query.to ?? null,
    generatedAt: new Date().toISOString(),
    columns: report.columns,
    rows,
    summaries,
  };
}
