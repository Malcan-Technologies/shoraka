import { meetsMinimumFunding as meetsMinimumFundingWithTolerance } from "@cashsouk/types";

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

  return {
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
