import {
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

/** Total return % on invested principal from net profit and investor Ta'widh share. */
export function computeActualReturnRatePercent(input: {
  investedPrincipal: number;
  receivedProfitNetAmount: number;
  receivedTawidhCompensationAmount: number;
}): number | null {
  const { investedPrincipal, receivedProfitNetAmount, receivedTawidhCompensationAmount } = input;
  if (investedPrincipal <= 0) return null;

  const receivedReturnAmount = receivedProfitNetAmount + receivedTawidhCompensationAmount;
  if (receivedReturnAmount <= 0) return null;

  return (receivedReturnAmount / investedPrincipal) * 100;
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
