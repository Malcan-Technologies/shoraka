import {
  computeNetExpectedReturnRatePercent,
  formatInvestorReturnRatePercent,
  roundNoteMoney,
} from "./note-expected-return";

export type InvestorReturnBreakdownAmounts = {
  principal: number;
  profitGross: number;
  serviceFee: number;
  profitNet: number;
  tawidh: number;
  totalPayout: number;
  grossProfitRatePercent: number;
  serviceFeeRatePercent: number;
  netExpectedReturnRatePercent: number | null;
  profitDays: number;
};

/** Derive gross profit and service fee from net profit using the note's service fee rate. */
export function deriveGrossProfitAndServiceFeeFromNet(
  profitNet: number,
  serviceFeeRatePercent: number
): { profitGross: number; serviceFee: number } {
  if (profitNet <= 0) {
    return { profitGross: 0, serviceFee: 0 };
  }
  const feeRate = Math.max(0, serviceFeeRatePercent);
  if (feeRate <= 0 || feeRate >= 100) {
    return { profitGross: roundNoteMoney(profitNet, 2), serviceFee: 0 };
  }
  const profitGross = roundNoteMoney(profitNet / (1 - feeRate / 100), 2);
  return {
    profitGross,
    serviceFee: roundNoteMoney(profitGross - profitNet, 2),
  };
}

/** Illustrative expected payout composition for a commit amount and profit accrual window. */
export function computeIllustrativeInvestorReturnBreakdown(input: {
  principal: number;
  profitRatePercent: number | null | undefined;
  serviceFeeRatePercent: number | null | undefined;
  profitDays: number;
}): InvestorReturnBreakdownAmounts {
  const principal = Math.max(0, input.principal);
  const grossProfitRatePercent = input.profitRatePercent ?? 0;
  const serviceFeeRatePercent = input.serviceFeeRatePercent ?? 0;
  const profitDays = Math.max(0, input.profitDays);
  const profitGross = roundNoteMoney(
    principal * (grossProfitRatePercent / 100) * (profitDays / 365),
    2
  );
  const serviceFee = roundNoteMoney(profitGross * (serviceFeeRatePercent / 100), 2);
  const profitNet = roundNoteMoney(Math.max(0, profitGross - serviceFee), 2);
  const netExpectedReturnRatePercent = computeNetExpectedReturnRatePercent(
    grossProfitRatePercent,
    serviceFeeRatePercent
  );

  return {
    principal: roundNoteMoney(principal, 2),
    profitGross,
    serviceFee,
    profitNet,
    tawidh: 0,
    totalPayout: roundNoteMoney(principal + profitNet, 2),
    grossProfitRatePercent,
    serviceFeeRatePercent,
    netExpectedReturnRatePercent,
    profitDays,
  };
}

export function formatServiceFeeRateLabel(serviceFeeRatePercent: number): string {
  const rate = formatInvestorReturnRatePercent(serviceFeeRatePercent);
  return rate === "-" ? "0.0%" : rate;
}
