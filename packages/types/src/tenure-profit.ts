import { NOTE_MONEY_DECIMALS } from "./note-money";
import { roundNoteMoney } from "./note-expected-return";

function money(value: number) {
  return roundNoteMoney(value, NOTE_MONEY_DECIMALS);
}

export function estimateTenureLateFeeHeadroom(input: {
  settlementAmount: number;
  fundedPrincipal: number;
  annualRatePercent: number;
  profitDays: number;
  invoiceFaceValue: number;
}): number {
  const fundedPrincipal = Math.max(0, input.fundedPrincipal);
  const annualRatePercent = Math.max(0, input.annualRatePercent);
  const profitDays = Math.max(0, input.profitDays);
  const uncappedGrossProfit = money(
    fundedPrincipal * (annualRatePercent / 100) * (profitDays / 365)
  );
  const ceilingAmount = money(Math.max(0, input.invoiceFaceValue - fundedPrincipal));
  const investorProfitGross = money(Math.min(uncappedGrossProfit, ceilingAmount));
  return money(Math.max(0, input.settlementAmount - fundedPrincipal - investorProfitGross));
}

export function formatUtcCalendarDay(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${date.getUTCDate()} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export type ProfitWindowClassification = "EARLY" | "ON_MATURITY" | "GRACE" | "LATE";

export function profitWindowClassificationLabel(
  classification: ProfitWindowClassification | null | undefined
): string | null {
  if (classification === "EARLY") return "Early settlement";
  if (classification === "ON_MATURITY") return "Settled on maturity";
  if (classification === "GRACE") return "Settled in grace";
  if (classification === "LATE") return "Late settlement";
  return null;
}

export function profitWindowClassificationTooltip(
  classification: ProfitWindowClassification | null | undefined
): string | null {
  if (classification === "EARLY") {
    return "Funds cleared before the original maturity date, so profit stopped on the cleared date.";
  }
  if (classification === "ON_MATURITY") {
    return "Funds cleared on the original maturity date.";
  }
  if (classification === "GRACE") {
    return "Funds cleared during the grace period. Profit stopped at maturity and no late charges apply.";
  }
  if (classification === "LATE") {
    return "Funds cleared after the grace period, so profit continued to the cleared date. Late charges may apply.";
  }
  return null;
}

export function formatProfitAccruedCopy(input: {
  startDate: Date | string | null | undefined;
  endDate: Date | string | null | undefined;
  profitDays: number;
}): string | null {
  const start = formatUtcCalendarDay(input.startDate);
  const end = formatUtcCalendarDay(input.endDate);
  if (!start || !end) return null;
  const days = Math.max(0, input.profitDays);
  return `Profit accrued: ${start} – ${end} (${days} day${days === 1 ? "" : "s"})`;
}
