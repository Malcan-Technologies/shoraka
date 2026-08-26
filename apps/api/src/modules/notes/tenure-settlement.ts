import {
  isTenureBackedNote,
  malaysiaCalendarYmdFromInstant,
  malaysiaTodayYmd,
  parseMalaysiaYmdToUtcMidnight,
  validateActualSettlementDate,
} from "@cashsouk/types";
import { AppError } from "../../lib/http/error-handler";
import {
  calculateTenureSettlementWaterfall,
  estimateTenureLateFeeHeadroom,
  resolveProfitWindow,
  type TenureSettlementWaterfallResult,
} from "./calculators";

export function isTenureNote(tenureDays: number | null | undefined): boolean {
  return isTenureBackedNote(tenureDays);
}

export function resolveTenureProfitStartDate(note: {
  disbursement_value_date?: Date | null;
  activated_at?: Date | null;
}): Date | null {
  return note.disbursement_value_date ?? note.activated_at ?? null;
}

export function latestIncludedReceiptDate(
  payments: Array<{ receipt_date: Date | string }>
): Date | null {
  let latest: Date | null = null;
  let latestYmd = "";
  for (const payment of payments) {
    const ymd = malaysiaCalendarYmdFromInstant(payment.receipt_date);
    if (!ymd) continue;
    if (!latest || ymd > latestYmd) {
      latestYmd = ymd;
      latest =
        payment.receipt_date instanceof Date
          ? payment.receipt_date
          : parseMalaysiaYmdToUtcMidnight(ymd);
    }
  }
  return latest;
}

export function resolveTenureClearedDate(input: {
  actualSettlementDate?: string | null;
  receiptDate?: string | null;
  now?: Date;
  disbursementDate?: Date | null;
  latestIncludedReceiptDate?: Date | null;
  required?: boolean;
}): Date {
  const fallbackYmd =
    input.actualSettlementDate ??
    malaysiaCalendarYmdFromInstant(input.receiptDate ?? null) ??
    (input.required === false ? malaysiaTodayYmd(input.now) : null);
  const validated = validateActualSettlementDate(fallbackYmd, {
    now: input.now,
    disbursementDate: input.disbursementDate,
    latestIncludedReceiptDate: input.latestIncludedReceiptDate,
  });
  if (validated.ok) return validated.date;
  throw new AppError(422, "ACTUAL_SETTLEMENT_DATE_INVALID", validated.message);
}

export function classifyTenureClearedDate(input: {
  startDate: Date;
  maturityDate: Date;
  clearedDate: Date;
  graceDays: number;
}) {
  return resolveProfitWindow({
    startDate: input.startDate,
    maturityDate: input.maturityDate,
    clearedDate: input.clearedDate,
    graceDays: input.graceDays,
  }).classification;
}

export function assertTenurePartialReceiptAllowed(input: {
  classification: "EARLY" | "ON_MATURITY" | "GRACE" | "LATE";
  openReceiptAmount: number;
  invoiceSettlementAmount: number;
}): void {
  if (input.classification === "LATE") return;
  if (input.invoiceSettlementAmount <= 0) return;
  if (input.openReceiptAmount + 0.005 < input.invoiceSettlementAmount) {
    throw new AppError(
      422,
      "PARTIAL_REPAYMENT_NOT_ALLOWED",
      "Before the grace period ends, the recorded receipt must cover the full invoice settlement amount. Partial receipts can accumulate only after grace."
    );
  }
}

export function assertTenureInvestorObligationCovered(
  result: Pick<TenureSettlementWaterfallResult, "investorObligationCovered" | "classification">
): void {
  if (result.investorObligationCovered) return;
  throw new AppError(
    422,
    "SETTLEMENT_INVESTOR_SHORTFALL",
    result.classification === "LATE"
      ? "Final settlement needs enough receipts to cover investor principal and accrued profit. Unpaid late charges can be billed separately."
      : "Settlement receipt is not enough to cover investor principal and accrued profit"
  );
}

export function buildTenureSettlementWaterfall(input: {
  grossReceiptAmount: number;
  fundedPrincipal: number;
  invoiceFaceValue: number;
  profitRatePercent: number;
  startDate: Date;
  maturityDate: Date;
  clearedDate: Date;
  graceDays: number;
  serviceFeeRatePercent: number;
  tawidhAmount?: number;
  tawidhInvestorSharePercent?: number;
  gharamahAmount?: number;
}): TenureSettlementWaterfallResult {
  return calculateTenureSettlementWaterfall(input);
}

export function resolveTenureLateFeeHeadroom(input: {
  settlementAmount: number;
  fundedPrincipal: number;
  annualRatePercent: number;
  startDate: Date;
  maturityDate: Date;
  clearedDate: Date;
  graceDays: number;
  invoiceFaceValue: number;
}): number {
  const window = resolveProfitWindow({
    startDate: input.startDate,
    maturityDate: input.maturityDate,
    clearedDate: input.clearedDate,
    graceDays: input.graceDays,
  });
  return estimateTenureLateFeeHeadroom({
    settlementAmount: input.settlementAmount,
    fundedPrincipal: input.fundedPrincipal,
    annualRatePercent: input.annualRatePercent,
    profitDays: window.profitDays,
    invoiceFaceValue: input.invoiceFaceValue,
  });
}
