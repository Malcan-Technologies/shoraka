import {
  estimateTenureLateFeeHeadroom as estimateTenureLateFeeHeadroomShared,
  meetsMinimumFunding as meetsMinimumFundingWithTolerance,
  NOTE_MONEY_DECIMALS,
  roundNoteMoney,
} from "@cashsouk/types";

export interface SettlementWaterfallInput {
  grossReceiptAmount: number;
  fundedPrincipal: number;
  profitRatePercent: number;
  profitStartDate: Date;
  profitMaturityDate: Date;
  serviceFeeRatePercent: number;
  tawidhAmount?: number;
  tawidhInvestorSharePercent?: number;
  gharamahAmount?: number;
}

const DAY_MS = 1000 * 60 * 60 * 24;

function utcStartOfDayMs(date: Date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function money(value: number) {
  return roundNoteMoney(value, NOTE_MONEY_DECIMALS);
}

function addUtcCalendarDays(date: Date, days: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

function assertUtcMidnightDate(value: Date, label: string) {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new Error(`${label} must be a valid Date`);
  }
}

export type ProfitWindowClassification = "EARLY" | "ON_MATURITY" | "GRACE" | "LATE";

export interface ResolveProfitWindowInput {
  startDate: Date;
  maturityDate: Date;
  clearedDate: Date;
  graceDays: number;
}

export interface ProfitWindow {
  startDate: Date;
  endDate: Date;
  graceEndDate: Date;
  profitDays: number;
  classification: ProfitWindowClassification;
}

/**
 * Tenure-note profit window from Malaysia calendar dates stored as UTC midnight.
 * Does not convert timezones.
 */
export function resolveProfitWindow(input: ResolveProfitWindowInput): ProfitWindow {
  assertUtcMidnightDate(input.startDate, "startDate");
  assertUtcMidnightDate(input.maturityDate, "maturityDate");
  assertUtcMidnightDate(input.clearedDate, "clearedDate");
  if (!Number.isInteger(input.graceDays) || input.graceDays < 0) {
    throw new Error("graceDays must be a non-negative integer");
  }

  const startDate = new Date(utcStartOfDayMs(input.startDate));
  const maturityDate = new Date(utcStartOfDayMs(input.maturityDate));
  const clearedDate = new Date(utcStartOfDayMs(input.clearedDate));
  const graceEndDate = addUtcCalendarDays(maturityDate, input.graceDays);

  const clearedMs = clearedDate.getTime();
  const maturityMs = maturityDate.getTime();
  const graceEndMs = graceEndDate.getTime();

  let endDate: Date;
  let classification: ProfitWindowClassification;
  if (clearedMs <= maturityMs) {
    endDate = clearedDate;
    classification = clearedMs < maturityMs ? "EARLY" : "ON_MATURITY";
  } else if (clearedMs <= graceEndMs) {
    endDate = maturityDate;
    classification = "GRACE";
  } else {
    endDate = clearedDate;
    classification = "LATE";
  }

  return {
    startDate,
    endDate,
    graceEndDate,
    profitDays: calculateCalendarDayCount(startDate, endDate),
    classification,
  };
}

export interface CeilingAwareGrossProfitInput {
  fundedPrincipal: number;
  annualRatePercent: number;
  profitDays: number;
  invoiceFaceValue: number;
}

export interface CeilingAwareGrossProfit {
  uncappedGrossProfit: number;
  ceilingAmount: number;
  investorProfitGross: number;
  capped: boolean;
}

export function estimateTenureLateFeeHeadroom(input: {
  settlementAmount: number;
  fundedPrincipal: number;
  annualRatePercent: number;
  profitDays: number;
  invoiceFaceValue: number;
}): number {
  return estimateTenureLateFeeHeadroomShared(input);
}

export function calculateCeilingAwareGrossProfit(
  input: CeilingAwareGrossProfitInput
): CeilingAwareGrossProfit {
  const fundedPrincipal = Math.max(0, input.fundedPrincipal);
  const annualRatePercent = Math.max(0, input.annualRatePercent);
  const profitDays = Math.max(0, input.profitDays);
  const uncappedGrossProfit = money(
    fundedPrincipal * (annualRatePercent / 100) * (profitDays / 365)
  );
  const ceilingAmount = money(Math.max(0, input.invoiceFaceValue - fundedPrincipal));
  const investorProfitGross = money(Math.min(uncappedGrossProfit, ceilingAmount));
  return {
    uncappedGrossProfit,
    ceilingAmount,
    investorProfitGross,
    capped: uncappedGrossProfit > ceilingAmount,
  };
}

export interface PostGraceSettlementAllocationInput {
  receiptAmount: number;
  tawidhAmount: number;
  investorProfitGross: number;
  fundedPrincipal: number;
  gharamahAmount: number;
  serviceFeeRatePercent: number;
  tawidhInvestorSharePercent?: number;
}

export interface PostGraceSettlementAllocation {
  appliedTawidhAmount: number;
  unpaidTawidhAmount: number;
  appliedProfitGross: number;
  unpaidProfitGross: number;
  serviceFeeAmount: number;
  investorProfitNet: number;
  appliedPrincipal: number;
  unpaidPrincipal: number;
  appliedGharamahAmount: number;
  unpaidGharamahAmount: number;
  excessLateChargeAmount: number;
  tawidhInvestorSharePercent: number;
  tawidhInvestorAmount: number;
  tawidhAccountAmount: number;
  issuerResidualAmount: number;
  unappliedAmount: number;
}

function applyDue(remaining: number, due: number) {
  const applied = money(Math.min(remaining, due));
  return { applied, remaining: money(remaining - applied) };
}

/**
 * Post-grace under-recovery order: Ta'widh → accrued gross profit → principal → Gharamah.
 * Service fee is taken from applied profit, not as a separate receipt bucket.
 * Excess late charges = unpaid Ta'widh + unpaid Gharamah.
 */
export function allocatePostGraceSettlement(
  input: PostGraceSettlementAllocationInput
): PostGraceSettlementAllocation {
  const receiptAmount = money(Math.max(0, input.receiptAmount));
  const tawidhDue = money(Math.max(0, input.tawidhAmount));
  const profitDue = money(Math.max(0, input.investorProfitGross));
  const principalDue = money(Math.max(0, input.fundedPrincipal));
  const gharamahDue = money(Math.max(0, input.gharamahAmount));
  const tawidhInvestorSharePercent = Math.min(
    100,
    Math.max(0, input.tawidhInvestorSharePercent ?? 0)
  );

  let remaining = receiptAmount;
  const tawidh = applyDue(remaining, tawidhDue);
  remaining = tawidh.remaining;
  const profit = applyDue(remaining, profitDue);
  remaining = profit.remaining;
  const principal = applyDue(remaining, principalDue);
  remaining = principal.remaining;
  const gharamah = applyDue(remaining, gharamahDue);
  remaining = gharamah.remaining;

  const appliedTawidhAmount = tawidh.applied;
  const appliedProfitGross = profit.applied;
  const appliedPrincipal = principal.applied;
  const appliedGharamahAmount = gharamah.applied;
  const unpaidTawidhAmount = money(tawidhDue - appliedTawidhAmount);
  const unpaidProfitGross = money(profitDue - appliedProfitGross);
  const unpaidPrincipal = money(principalDue - appliedPrincipal);
  const unpaidGharamahAmount = money(gharamahDue - appliedGharamahAmount);
  const serviceFeeAmount = money(appliedProfitGross * (Math.max(0, input.serviceFeeRatePercent) / 100));
  const investorProfitNet = money(appliedProfitGross - serviceFeeAmount);
  const tawidhInvestorAmount = money(appliedTawidhAmount * (tawidhInvestorSharePercent / 100));
  const tawidhAccountAmount = money(appliedTawidhAmount - tawidhInvestorAmount);
  const issuerResidualAmount = remaining;
  const unappliedAmount = money(
    Math.max(
      0,
      receiptAmount -
        appliedTawidhAmount -
        appliedProfitGross -
        appliedPrincipal -
        appliedGharamahAmount -
        issuerResidualAmount
    )
  );

  return {
    appliedTawidhAmount,
    unpaidTawidhAmount,
    appliedProfitGross,
    unpaidProfitGross,
    serviceFeeAmount,
    investorProfitNet,
    appliedPrincipal,
    unpaidPrincipal,
    appliedGharamahAmount,
    unpaidGharamahAmount,
    excessLateChargeAmount: money(unpaidTawidhAmount + unpaidGharamahAmount),
    tawidhInvestorSharePercent,
    tawidhInvestorAmount,
    tawidhAccountAmount,
    issuerResidualAmount,
    unappliedAmount,
  };
}

export interface TenureSettlementWaterfallInput {
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
}

export interface TenureSettlementWaterfallResult extends SettlementWaterfallResult {
  classification: ProfitWindowClassification;
  ceilingAmount: number;
  ceilingUsedAmount: number;
  ceilingRemainingAmount: number;
  actualSettlementDate: Date;
  excessLateChargeAmount: number;
  unpaidTawidhAmount: number;
  unpaidGharamahAmount: number;
  unpaidPrincipal: number;
  unpaidProfitGross: number;
  investorObligationCovered: boolean;
}

export function calculateTenureSettlementWaterfall(
  input: TenureSettlementWaterfallInput
): TenureSettlementWaterfallResult {
  const window = resolveProfitWindow({
    startDate: input.startDate,
    maturityDate: input.maturityDate,
    clearedDate: input.clearedDate,
    graceDays: input.graceDays,
  });
  const ceiling = calculateCeilingAwareGrossProfit({
    fundedPrincipal: input.fundedPrincipal,
    annualRatePercent: input.profitRatePercent,
    profitDays: window.profitDays,
    invoiceFaceValue: input.invoiceFaceValue,
  });
  const ceilingUsedAmount = ceiling.investorProfitGross;
  const ceilingRemainingAmount = money(Math.max(0, ceiling.ceilingAmount - ceilingUsedAmount));
  const applyLateCharges = window.classification === "LATE";
  const tawidhAmount = applyLateCharges ? money(Math.max(0, input.tawidhAmount ?? 0)) : 0;
  const gharamahAmount = applyLateCharges ? money(Math.max(0, input.gharamahAmount ?? 0)) : 0;

  if (applyLateCharges) {
    const allocation = allocatePostGraceSettlement({
      receiptAmount: input.grossReceiptAmount,
      tawidhAmount,
      investorProfitGross: ceiling.investorProfitGross,
      fundedPrincipal: input.fundedPrincipal,
      gharamahAmount,
      serviceFeeRatePercent: input.serviceFeeRatePercent,
      tawidhInvestorSharePercent: input.tawidhInvestorSharePercent,
    });
    const waterfall = reconcileSettlementWaterfall({
      grossReceiptAmount: input.grossReceiptAmount,
      investorPrincipal: allocation.appliedPrincipal,
      profitStartDate: window.startDate,
      profitMaturityDate: window.endDate,
      profitDays: window.profitDays,
      annualProfitRatePercent: input.profitRatePercent,
      investorProfitGross: allocation.appliedProfitGross,
      serviceFeeAmount: allocation.serviceFeeAmount,
      investorProfitNet: allocation.investorProfitNet,
      tawidhAmount: allocation.appliedTawidhAmount,
      tawidhInvestorSharePercent: allocation.tawidhInvestorSharePercent,
      tawidhInvestorAmount: allocation.tawidhInvestorAmount,
      tawidhAccountAmount: allocation.tawidhAccountAmount,
      gharamahAmount: allocation.appliedGharamahAmount,
      investorPoolTotal: 0,
      availableLateFeeHeadroomAmount: 0,
      settlementShortfallAmount: 0,
      issuerResidualAmount: allocation.issuerResidualAmount,
      unappliedAmount: allocation.unappliedAmount,
    });
    return {
      ...waterfall,
      classification: window.classification,
      ceilingAmount: ceiling.ceilingAmount,
      ceilingUsedAmount,
      ceilingRemainingAmount,
      actualSettlementDate: new Date(utcStartOfDayMs(input.clearedDate)),
      excessLateChargeAmount: allocation.excessLateChargeAmount,
      unpaidTawidhAmount: allocation.unpaidTawidhAmount,
      unpaidGharamahAmount: allocation.unpaidGharamahAmount,
      unpaidPrincipal: allocation.unpaidPrincipal,
      unpaidProfitGross: allocation.unpaidProfitGross,
      investorObligationCovered:
        allocation.unpaidPrincipal <= 0.005 && allocation.unpaidProfitGross <= 0.005,
    };
  }

  const investorPrincipal = money(Math.min(input.fundedPrincipal, input.grossReceiptAmount));
  const investorProfitGross = ceiling.investorProfitGross;
  const serviceFeeAmount = money(
    investorProfitGross * (Math.max(0, input.serviceFeeRatePercent) / 100)
  );
  const investorProfitNet = money(investorProfitGross - serviceFeeAmount);
  const tawidhInvestorSharePercent = Math.min(
    100,
    Math.max(0, input.tawidhInvestorSharePercent ?? 0)
  );
  const waterfall = reconcileSettlementWaterfall({
    grossReceiptAmount: input.grossReceiptAmount,
    investorPrincipal,
    profitStartDate: window.startDate,
    profitMaturityDate: window.endDate,
    profitDays: window.profitDays,
    annualProfitRatePercent: input.profitRatePercent,
    investorProfitGross,
    serviceFeeAmount,
    investorProfitNet,
    tawidhAmount: 0,
    tawidhInvestorSharePercent,
    tawidhInvestorAmount: 0,
    tawidhAccountAmount: 0,
    gharamahAmount: 0,
    investorPoolTotal: 0,
    availableLateFeeHeadroomAmount: 0,
    settlementShortfallAmount: 0,
    issuerResidualAmount: 0,
    unappliedAmount: 0,
  });
  const unpaidPrincipal = money(Math.max(0, input.fundedPrincipal - waterfall.investorPrincipal));
  const unpaidProfitGross = money(
    Math.max(0, investorProfitGross - waterfall.investorProfitGross)
  );
  return {
    ...waterfall,
    classification: window.classification,
    ceilingAmount: ceiling.ceilingAmount,
    ceilingUsedAmount,
    ceilingRemainingAmount,
    actualSettlementDate: new Date(utcStartOfDayMs(input.clearedDate)),
    excessLateChargeAmount: 0,
    unpaidTawidhAmount: 0,
    unpaidGharamahAmount: 0,
    unpaidPrincipal,
    unpaidProfitGross,
    investorObligationCovered: unpaidPrincipal <= 0.005 && unpaidProfitGross <= 0.005,
  };
}

export function calculateCalendarDayCount(startDate: Date, endDate: Date) {
  if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) return 0;
  return Math.max(0, Math.floor((utcStartOfDayMs(endDate) - utcStartOfDayMs(startDate)) / DAY_MS));
}

export function calculateSettlementWaterfall(input: SettlementWaterfallInput) {
  const investorPrincipal = Math.min(input.fundedPrincipal, input.grossReceiptAmount);
  const profitDays = calculateCalendarDayCount(input.profitStartDate, input.profitMaturityDate);
  const investorProfitGross =
    input.fundedPrincipal * (input.profitRatePercent / 100) * (profitDays / 365);
  const serviceFeeAmount = investorProfitGross * (input.serviceFeeRatePercent / 100);
  const investorProfitNet = investorProfitGross - serviceFeeAmount;
  const tawidhAmount = input.tawidhAmount ?? 0;
  const tawidhInvestorSharePercent = Math.min(
    100,
    Math.max(0, input.tawidhInvestorSharePercent ?? 0)
  );
  const tawidhInvestorAmount = tawidhAmount * (tawidhInvestorSharePercent / 100);
  const tawidhAccountAmount = tawidhAmount - tawidhInvestorAmount;
  const gharamahAmount = input.gharamahAmount ?? 0;
  const investorPoolTotal = investorPrincipal + investorProfitNet + tawidhInvestorAmount;
  const availableLateFeeHeadroomAmount = Math.max(
    0,
    input.grossReceiptAmount - investorPrincipal - investorProfitGross
  );
  const allocationTotal = investorPrincipal + investorProfitGross + tawidhAmount + gharamahAmount;
  const settlementShortfallAmount = Math.max(0, allocationTotal - input.grossReceiptAmount);
  const issuerResidualAmount = Math.max(
    0,
    input.grossReceiptAmount -
      investorPrincipal -
      investorProfitGross -
      tawidhAmount -
      gharamahAmount
  );
  const unappliedAmount = Math.max(
    0,
    input.grossReceiptAmount -
      investorPrincipal -
      investorProfitGross -
      tawidhAmount -
      gharamahAmount -
      issuerResidualAmount
  );

  return reconcileSettlementWaterfall({
    grossReceiptAmount: input.grossReceiptAmount,
    investorPrincipal,
    profitStartDate: input.profitStartDate,
    profitMaturityDate: input.profitMaturityDate,
    profitDays,
    annualProfitRatePercent: input.profitRatePercent,
    investorProfitGross,
    serviceFeeAmount,
    investorProfitNet,
    tawidhAmount,
    tawidhInvestorSharePercent,
    tawidhInvestorAmount,
    tawidhAccountAmount,
    gharamahAmount,
    investorPoolTotal,
    availableLateFeeHeadroomAmount,
    settlementShortfallAmount,
    issuerResidualAmount,
    unappliedAmount,
  });
}

export type SettlementWaterfallResult = {
  grossReceiptAmount: number;
  investorPrincipal: number;
  profitStartDate: Date;
  profitMaturityDate: Date;
  profitDays: number;
  annualProfitRatePercent: number;
  investorProfitGross: number;
  serviceFeeAmount: number;
  investorProfitNet: number;
  tawidhAmount: number;
  tawidhInvestorSharePercent: number;
  tawidhInvestorAmount: number;
  tawidhAccountAmount: number;
  gharamahAmount: number;
  investorPoolTotal: number;
  availableLateFeeHeadroomAmount: number;
  settlementShortfallAmount: number;
  issuerResidualAmount: number;
  unappliedAmount: number;
};

/**
 * Round settlement lines to MYR 2dp and set issuer residual to the remainder so
 * principal + net profit + service fee + late fees + issuer residual = gross receipt
 * (matches what postSettlementLedger debits from the repayment pool).
 */
export function reconcileSettlementWaterfall(
  waterfall: SettlementWaterfallResult
): SettlementWaterfallResult {
  const grossReceiptAmount = roundNoteMoney(waterfall.grossReceiptAmount, NOTE_MONEY_DECIMALS);
  const investorPrincipal = roundNoteMoney(waterfall.investorPrincipal, NOTE_MONEY_DECIMALS);
  const investorProfitGross = roundNoteMoney(waterfall.investorProfitGross, NOTE_MONEY_DECIMALS);
  const serviceFeeAmount = roundNoteMoney(waterfall.serviceFeeAmount, NOTE_MONEY_DECIMALS);
  const investorProfitNet = roundNoteMoney(
    investorProfitGross - serviceFeeAmount,
    NOTE_MONEY_DECIMALS
  );
  const tawidhAmount = roundNoteMoney(waterfall.tawidhAmount, NOTE_MONEY_DECIMALS);
  const gharamahAmount = roundNoteMoney(waterfall.gharamahAmount, NOTE_MONEY_DECIMALS);
  const tawidhInvestorAmount = roundNoteMoney(waterfall.tawidhInvestorAmount, NOTE_MONEY_DECIMALS);
  const tawidhAccountAmount = roundNoteMoney(
    tawidhAmount - tawidhInvestorAmount,
    NOTE_MONEY_DECIMALS
  );

  const issuerResidualAmount = Math.max(
    0,
    roundNoteMoney(
      grossReceiptAmount -
        investorPrincipal -
        investorProfitNet -
        serviceFeeAmount -
        tawidhAmount -
        gharamahAmount,
      NOTE_MONEY_DECIMALS
    )
  );
  const unappliedAmount = Math.max(
    0,
    roundNoteMoney(
      grossReceiptAmount -
        investorPrincipal -
        investorProfitNet -
        serviceFeeAmount -
        tawidhAmount -
        gharamahAmount -
        issuerResidualAmount,
      NOTE_MONEY_DECIMALS
    )
  );

  return {
    ...waterfall,
    grossReceiptAmount,
    investorPrincipal,
    investorProfitGross,
    serviceFeeAmount,
    investorProfitNet,
    tawidhAmount,
    tawidhInvestorAmount,
    tawidhAccountAmount,
    gharamahAmount,
    issuerResidualAmount,
    unappliedAmount,
    investorPoolTotal: roundNoteMoney(
      investorPrincipal + investorProfitNet + tawidhInvestorAmount,
      NOTE_MONEY_DECIMALS
    ),
    availableLateFeeHeadroomAmount: roundNoteMoney(
      Math.max(0, grossReceiptAmount - investorPrincipal - investorProfitGross),
      NOTE_MONEY_DECIMALS
    ),
    settlementShortfallAmount: roundNoteMoney(
      Math.max(
        0,
        investorPrincipal + investorProfitGross + tawidhAmount + gharamahAmount - grossReceiptAmount
      ),
      NOTE_MONEY_DECIMALS
    ),
  };
}

export interface LateChargeInput {
  receiptAmount: number;
  dueDate: Date;
  receiptDate: Date;
  gracePeriodDays: number;
  tawidhRateCapPercent: number;
  gharamahRateCapPercent: number;
  tawidhAmount?: number;
  gharamahAmount?: number;
}

export function calculateLateCharge(input: LateChargeInput) {
  const rawLateDays = calculateCalendarDayCount(input.dueDate, input.receiptDate);
  const daysLate = Math.max(0, rawLateDays - input.gracePeriodDays);
  const annualFactor = daysLate / 365;
  const tawidhCap = input.receiptAmount * (input.tawidhRateCapPercent / 100) * annualFactor;
  const gharamahCap = input.receiptAmount * (input.gharamahRateCapPercent / 100) * annualFactor;

  return {
    daysLate,
    tawidhCap,
    gharamahCap,
    tawidhAmount: Math.min(input.tawidhAmount ?? tawidhCap, tawidhCap),
    gharamahAmount: Math.min(input.gharamahAmount ?? gharamahCap, gharamahCap),
  };
}

export function meetsMinimumFunding(
  fundedAmount: number,
  targetAmount: number,
  minimumFundingPercent = 80
) {
  return meetsMinimumFundingWithTolerance(fundedAmount, targetAmount, minimumFundingPercent);
}

export { buildSettlementInvestorAllocations } from "@cashsouk/types";

export type SettlementAllocationRow = {
  investmentId: string;
  investorOrganizationId: string;
  principal: number;
  profitNet: number;
  tawidhInvestorShare: number;
};

/** Split investor pool across confirmed investments; principal uses waterfall total, not raw commit sum. */
export function buildSettlementAllocations(input: {
  investments: Array<{ id: string; investorOrganizationId: string; amount: number }>;
  investorPrincipal: number;
  investorProfitNet: number;
  tawidhInvestorAmount: number;
}): SettlementAllocationRow[] {
  const eligiblePrincipal = input.investments.reduce((sum, investment) => sum + investment.amount, 0);
  if (eligiblePrincipal <= 0.005) return [];

  return input.investments.map((investment) => {
    const ratio = investment.amount / eligiblePrincipal;
    return {
      investmentId: investment.id,
      investorOrganizationId: investment.investorOrganizationId,
      principal: input.investorPrincipal * ratio,
      profitNet: input.investorProfitNet * ratio,
      tawidhInvestorShare: input.tawidhInvestorAmount * ratio,
    };
  });
}

function parseCalculatorDate(value: unknown): Date | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  if (typeof value !== "string" || value.length === 0) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

/**
 * Calendar days the investment was outstanding: profit start → actual settlement date.
 * Falls back to posted settlement profit days, never contractual tenure.
 */
export function resolveActualReturnProfitDays(input: {
  profitStartDate?: Date | string | null;
  actualSettlementDate?: Date | string | null;
  fallbackProfitDays?: number | null;
}): number | null {
  const start = parseCalculatorDate(input.profitStartDate);
  const settled = parseCalculatorDate(input.actualSettlementDate);
  if (start && settled) {
    const days = calculateCalendarDayCount(start, settled);
    if (days > 0) return days;
  }
  const fallback = input.fallbackProfitDays;
  if (fallback != null && Number.isFinite(fallback) && fallback > 0) return fallback;
  return null;
}

/** Annualized actual return using settlement-date days, including investor Ta'widh. */
export function computeActualReturnRatePercent(input: {
  investedPrincipal: number;
  receivedProfitNetAmount: number;
  receivedTawidhCompensationAmount: number;
  profitDays: number | null;
}): number | null {
  const { investedPrincipal, receivedProfitNetAmount, receivedTawidhCompensationAmount } = input;
  if (investedPrincipal <= 0) return null;
  const profitDays = input.profitDays;
  if (profitDays == null || !Number.isFinite(profitDays) || profitDays <= 0) return null;

  const receivedReturnAmount = receivedProfitNetAmount + receivedTawidhCompensationAmount;
  if (receivedReturnAmount <= 0) return null;

  return (receivedReturnAmount / investedPrincipal) * (365 / profitDays) * 100;
}

/** Scale Syariah-capped late fees to fit repayment headroom after principal and gross profit. */
export function capLateFeeSuggestionsByHeadroom(input: {
  remainingTawidhAmount: number;
  remainingGharamahAmount: number;
  availableLateFeeHeadroomAmount: number | null;
}) {
  const { remainingTawidhAmount, remainingGharamahAmount, availableLateFeeHeadroomAmount } = input;
  if (availableLateFeeHeadroomAmount == null) {
    return {
      suggestedTawidhAmount: remainingTawidhAmount,
      suggestedGharamahAmount: remainingGharamahAmount,
    };
  }
  const remainingTotal = remainingTawidhAmount + remainingGharamahAmount;
  if (remainingTotal <= 0.005) {
    return { suggestedTawidhAmount: 0, suggestedGharamahAmount: 0 };
  }
  if (availableLateFeeHeadroomAmount + 0.005 >= remainingTotal) {
    return {
      suggestedTawidhAmount: remainingTawidhAmount,
      suggestedGharamahAmount: remainingGharamahAmount,
    };
  }
  const scale = availableLateFeeHeadroomAmount / remainingTotal;
  return {
    suggestedTawidhAmount: remainingTawidhAmount * scale,
    suggestedGharamahAmount: remainingGharamahAmount * scale,
  };
}
