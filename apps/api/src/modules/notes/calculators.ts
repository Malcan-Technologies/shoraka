export interface SettlementWaterfallInput {
  grossReceiptAmount: number;
  fundedPrincipal: number;
  profitRatePercent: number;
  serviceFeeRatePercent: number;
  tawidhAmount?: number;
  gharamahAmount?: number;
}

export function calculateSettlementWaterfall(input: SettlementWaterfallInput) {
  const investorPrincipal = Math.min(input.fundedPrincipal, input.grossReceiptAmount);
  const investorProfitGross = input.fundedPrincipal * (input.profitRatePercent / 100);
  const serviceFeeAmount = investorProfitGross * (input.serviceFeeRatePercent / 100);
  const investorProfitNet = investorProfitGross - serviceFeeAmount;
  const tawidhAmount = input.tawidhAmount ?? 0;
  const gharamahAmount = input.gharamahAmount ?? 0;
  const issuerResidualAmount = Math.max(
    0,
    input.grossReceiptAmount - investorPrincipal - investorProfitGross - tawidhAmount - gharamahAmount
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
    investorPrincipal,
    investorProfitGross,
    serviceFeeAmount,
    investorProfitNet,
    tawidhAmount,
    gharamahAmount,
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
  const rawLateDays = Math.ceil(
    (input.receiptDate.getTime() - input.dueDate.getTime()) / (1000 * 60 * 60 * 24)
  );
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

export function meetsMinimumFunding(fundedAmount: number, targetAmount: number, minimumFundingPercent = 80) {
  if (targetAmount <= 0) return false;
  return (fundedAmount / targetAmount) * 100 >= minimumFundingPercent;
}

