import {
  InvestorBalanceTransactionDirection,
  InvestorBalanceTransactionSource,
  NoteInvestmentStatus,
  NoteServicingStatus,
  NoteSettlementStatus,
  Prisma,
  type InvestorOrganization,
} from "@prisma/client";
import {
  computeNetExpectedReturnRatePercent,
  SC_INVESTOR_CATEGORY_LABELS,
  type ReportQuery,
  type ReportResult,
  type ScInvestorCategory,
} from "@cashsouk/types";
import { prisma } from "../../lib/prisma";
import { parseSettlementAllocations } from "../notes/investment-settlement-confirmation/snapshot";
import { resolveInvestorExpectedName } from "../payment/deposit-service";
import { postedAtRange, percentOf, reportDefinition, toNumber } from "./report-shared";

export function isExternalCashAdded(source: InvestorBalanceTransactionSource): boolean {
  return (
    source === InvestorBalanceTransactionSource.GATEWAY_DEPOSIT ||
    source === InvestorBalanceTransactionSource.MANUAL_TOPUP
  );
}

export function isWithdrawalSource(source: InvestorBalanceTransactionSource): boolean {
  return source === InvestorBalanceTransactionSource.INVESTOR_WITHDRAWAL_REQUEST;
}

export function isCompletedRefund(
  source: InvestorBalanceTransactionSource,
  direction: InvestorBalanceTransactionDirection
): boolean {
  return (
    source === InvestorBalanceTransactionSource.GATEWAY_DEPOSIT_REFUND &&
    direction === InvestorBalanceTransactionDirection.OUT
  );
}

export function weightedExpectedNetRate(
  holdings: Array<{ amount: number; profitRatePercent: number | null; serviceFeeRatePercent: number }>
): number | null {
  let weighted = 0;
  let weight = 0;
  for (const holding of holdings) {
    const rate = computeNetExpectedReturnRatePercent(
      holding.profitRatePercent,
      holding.serviceFeeRatePercent
    );
    if (rate == null) continue;
    weighted += holding.amount * rate;
    weight += holding.amount;
  }
  return weight > 0 ? weighted / weight : null;
}

function categoryLabel(category: ScInvestorCategory | null): string {
  if (!category) return "Not recorded";
  return SC_INVESTOR_CATEGORY_LABELS[category];
}

export async function runInvestorBook(query: ReportQuery): Promise<ReportResult> {
  const report = reportDefinition("investor_book");
  const range = postedAtRange(query);

  const [walletOrgs, investmentOrgIds] = await Promise.all([
    prisma.investorOrganization.findMany({
      where: { investor_balance: { isNot: null } },
      select: investorOrgSelect,
    }),
    prisma.noteInvestment.findMany({
      distinct: ["investor_organization_id"],
      select: { investor_organization_id: true },
    }),
  ]);

  const walletIds = new Set(walletOrgs.map((org) => org.id));
  const missingIds = investmentOrgIds
    .map((row) => row.investor_organization_id)
    .filter((id) => !walletIds.has(id));
  const extraOrgs =
    missingIds.length > 0
      ? await prisma.investorOrganization.findMany({
          where: { id: { in: missingIds } },
          select: investorOrgSelect,
        })
      : [];
  const orgs = [...walletOrgs, ...extraOrgs];
  const orgIds = orgs.map((org) => org.id);

  const [investments, settlements, cashMovements] = await Promise.all([
    prisma.noteInvestment.findMany({
      where: { investor_organization_id: { in: orgIds } },
      select: {
        investor_organization_id: true,
        status: true,
        amount: true,
        note: {
          select: {
            servicing_status: true,
            profit_rate_percent: true,
            service_fee_rate_percent: true,
          },
        },
      },
    }),
    prisma.noteSettlement.findMany({
      where: {
        status: NoteSettlementStatus.POSTED,
        ...(range ? { posted_at: { gte: range.gte, lt: range.lt } } : {}),
      },
      select: { preview_snapshot: true },
    }),
    prisma.investorBalanceTransaction.findMany({
      where: {
        investor_organization_id: { in: orgIds },
        ...(range ? { posted_at: { gte: range.gte, lt: range.lt } } : {}),
      },
      select: {
        investor_organization_id: true,
        direction: true,
        amount: true,
        source: true,
      },
    }),
  ]);

  const realised = new Map<string, { principal: number; profitNet: number; tawidh: number }>();
  for (const settlement of settlements) {
    for (const allocation of parseSettlementAllocations(settlement.preview_snapshot)) {
      const current = realised.get(allocation.investorOrganizationId) ?? {
        principal: 0,
        profitNet: 0,
        tawidh: 0,
      };
      current.principal += allocation.principal;
      current.profitNet += allocation.profitNet;
      current.tawidh += allocation.tawidhInvestorShare;
      realised.set(allocation.investorOrganizationId, current);
    }
  }

  const cashByOrg = new Map<string, { added: number; withdrawals: number; refunds: number }>();
  let cashAdded = 0;
  let withdrawals = 0;
  let refunds = 0;
  for (const movement of cashMovements) {
    const amount = toNumber(movement.amount);
    const current = cashByOrg.get(movement.investor_organization_id) ?? {
      added: 0,
      withdrawals: 0,
      refunds: 0,
    };
    if (isExternalCashAdded(movement.source) && movement.direction === InvestorBalanceTransactionDirection.IN) {
      current.added += amount;
      cashAdded += amount;
    } else if (
      isWithdrawalSource(movement.source) &&
      movement.direction === InvestorBalanceTransactionDirection.OUT
    ) {
      current.withdrawals += amount;
      withdrawals += amount;
    } else if (isCompletedRefund(movement.source, movement.direction)) {
      current.refunds += amount;
      refunds += amount;
    }
    cashByOrg.set(movement.investor_organization_id, current);
  }

  const investmentsByOrg = new Map<string, typeof investments>();
  for (const investment of investments) {
    const list = investmentsByOrg.get(investment.investor_organization_id) ?? [];
    list.push(investment);
    investmentsByOrg.set(investment.investor_organization_id, list);
  }

  const rows = orgs.map((org) => {
    const orgInvestments = investmentsByOrg.get(org.id) ?? [];
    const reserved = orgInvestments
      .filter((item) => item.status === NoteInvestmentStatus.COMMITTED)
      .reduce((sum, item) => sum + toNumber(item.amount), 0);
    const activeConfirmed = orgInvestments.filter(
      (item) =>
        item.status === NoteInvestmentStatus.CONFIRMED &&
        item.note.servicing_status !== NoteServicingStatus.SETTLED
    );
    const confirmedAmount = activeConfirmed.reduce((sum, item) => sum + toNumber(item.amount), 0);
    const realisedRow = realised.get(org.id);
    return {
      investorOrganizationId: org.id,
      investorName:
        resolveInvestorExpectedName(org as unknown as InvestorOrganization) ?? org.name ?? "Not recorded",
      investorCategory: categoryLabel(org.sc_investor_category),
      availableCash: toNumber(org.investor_balance?.available_amount),
      reservedAmount: reserved,
      confirmedAmount,
      activeNoteCount: activeConfirmed.length,
      expectedNetRatePercent: weightedExpectedNetRate(
        activeConfirmed.map((item) => ({
          amount: toNumber(item.amount),
          profitRatePercent: item.note.profit_rate_percent == null ? null : toNumber(item.note.profit_rate_percent),
          serviceFeeRatePercent: toNumber(item.note.service_fee_rate_percent),
        }))
      ),
      realisedPrincipal: realisedRow?.principal ?? 0,
      realisedProfitNet: realisedRow?.profitNet ?? 0,
      realisedTawidh: realisedRow?.tawidh ?? 0,
    };
  });

  const investedCount = rows.filter((row) => (investmentsByOrg.get(String(row.investorOrganizationId)) ?? []).length > 0)
    .length;
  const availableCash = rows.reduce((sum, row) => sum + Number(row.availableCash), 0);
  const realisedProfit = rows.reduce((sum, row) => sum + Number(row.realisedProfitNet), 0);

  return {
    key: "investor_book",
    title: report.title,
    from: query.from ?? null,
    to: query.to ?? null,
    generatedAt: new Date().toISOString(),
    columns: report.columns,
    rows,
    summaries: [
      { label: "Investors", count: rows.length },
      { label: "Invested", count: investedCount, percent: percentOf(investedCount, rows.length) },
      { label: "Never invested", count: rows.length - investedCount },
      { label: "Available cash", amount: availableCash },
      { label: "Cash added", amount: cashAdded },
      { label: "Withdrawals", amount: withdrawals },
      { label: "Refunds", amount: refunds },
      { label: "Realised net profit", amount: realisedProfit },
    ],
  };
}

const investorOrgSelect = {
  id: true,
  type: true,
  name: true,
  first_name: true,
  middle_name: true,
  last_name: true,
  legal_name_on_id: true,
  sc_investor_category: true,
  corporate_onboarding_data: true,
  investor_balance: { select: { available_amount: true } },
} satisfies Prisma.InvestorOrganizationSelect;
