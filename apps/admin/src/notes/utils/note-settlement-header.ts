import { formatCurrency } from "@cashsouk/config";
import {
  formatInvestorReturnRatePercent,
  formatNoteDateEnMy,
  isNoteSettlementPosted,
  NoteSettlementStatus,
  type NoteDetail,
  type NoteSettlement,
} from "@cashsouk/types";

const MONEY_TOLERANCE = 0.005;

export type NoteSettlementPayoutRow = {
  label: string;
  value: string;
};

export type NoteSettlementPayoutHeaderModel = {
  totalLabel: string;
  totalValue: string;
  returnLabel: string;
  returnValue: string;
  returnHint?: string;
  rows: NoteSettlementPayoutRow[];
};

export type NoteSettlementSummaryCard = {
  label: string;
  value: string;
  hint?: string;
};

function postedSettlement(note: NoteDetail): NoteSettlement | null {
  return note.settlements?.find((item) => item.status === NoteSettlementStatus.POSTED) ?? null;
}

export function resolveAdminNoteSettlementDate(note: NoteDetail): string | null {
  const settlement = postedSettlement(note);
  return formatNoteDateEnMy(
    settlement?.actualSettlementDate ??
      note.settlementSummary?.actualSettlementDate ??
      note.repaidAt ??
      settlement?.postedAt ??
      note.settlementSummary?.postedAt
  );
}

function resolveInvestorEarnedAmounts(note: NoteDetail): {
  principal: number;
  earned: number;
  profitDays: number | null;
} | null {
  const settlement = postedSettlement(note);
  const summary = note.settlementSummary;
  if (!settlement && !summary) return null;

  const principal = settlement?.investorPrincipal ?? note.fundedAmount;
  if (!(principal > MONEY_TOLERANCE)) return null;

  const earned =
    settlement != null
      ? settlement.investorProfitNet + settlement.tawidhInvestorAmount
      : Math.max(0, (summary?.investorPoolAmount ?? 0) - principal);
  const profitDays = settlement?.profitDays ?? summary?.profitDays ?? null;
  return { principal, earned, profitDays };
}

export function resolveAdminNoteInvestorReturnPercent(note: NoteDetail): number | null {
  const amounts = resolveInvestorEarnedAmounts(note);
  if (!amounts) return null;
  if (amounts.earned <= MONEY_TOLERANCE) return 0;
  if (
    amounts.profitDays != null &&
    Number.isFinite(amounts.profitDays) &&
    amounts.profitDays > 0
  ) {
    return (amounts.earned / amounts.principal) * (365 / amounts.profitDays) * 100;
  }
  return (amounts.earned / amounts.principal) * 100;
}

export function getNoteSettlementDateSummary(note: NoteDetail): NoteSettlementSummaryCard {
  return {
    label: "Settlement date",
    value: resolveAdminNoteSettlementDate(note) ?? "—",
    hint: "When repayment cleared",
  };
}

export function getNoteInvestorReturnSummary(note: NoteDetail): NoteSettlementSummaryCard {
  const amounts = resolveInvestorEarnedAmounts(note);
  const rate = resolveAdminNoteInvestorReturnPercent(note);
  const days =
    amounts?.profitDays != null && amounts.profitDays > 0 ? amounts.profitDays : null;
  return {
    label: "Investor return",
    value: formatInvestorReturnRatePercent(rate),
    hint: days != null ? `p.a. actual · ${days} days` : "p.a. actual",
  };
}

export function getNoteSettlementPayoutHeader(
  note: NoteDetail
): NoteSettlementPayoutHeaderModel | null {
  if (!isNoteSettlementPosted(note)) return null;
  const settlement = postedSettlement(note);
  const summary = note.settlementSummary;
  if (!settlement && !summary) return null;

  const totalReceived = settlement?.grossReceiptAmount ?? summary?.grossReceiptAmount ?? 0;
  const investors =
    summary?.investorPoolAmount ??
    (settlement
      ? settlement.investorPrincipal +
        settlement.investorProfitNet +
        settlement.tawidhInvestorAmount
      : 0);
  const serviceFee = settlement?.serviceFeeAmount ?? summary?.operatingAccountAmount ?? 0;
  const tawidh = settlement?.tawidhAccountAmount ?? summary?.tawidhAccountAmount ?? 0;
  const gharamah = settlement?.gharamahAmount ?? summary?.gharamahAccountAmount ?? 0;
  const residual = settlement?.issuerResidualAmount ?? summary?.issuerResidualAmount ?? 0;
  const unapplied = settlement?.unappliedAmount ?? summary?.unappliedAmount ?? 0;

  const rows: NoteSettlementPayoutRow[] = [
    { label: "Investors", value: formatCurrency(investors) },
    { label: "Service fee", value: formatCurrency(serviceFee) },
    { label: "Ta'widh", value: formatCurrency(tawidh) },
    { label: "Gharamah", value: formatCurrency(gharamah) },
    { label: "Issuer residual", value: formatCurrency(residual) },
  ];
  if (unapplied > MONEY_TOLERANCE) {
    rows.push({ label: "Unapplied", value: formatCurrency(unapplied) });
  }

  const investorReturn = getNoteInvestorReturnSummary(note);
  return {
    totalLabel: "Total received",
    totalValue: formatCurrency(totalReceived),
    returnLabel: investorReturn.label,
    returnValue: investorReturn.value,
    returnHint: investorReturn.hint,
    rows,
  };
}
