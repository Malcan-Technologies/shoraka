import { allocateProRataNoteMoney, NOTE_MONEY_DECIMALS, roundNoteMoney } from "@cashsouk/types";

function money(value: number) {
  return roundNoteMoney(Math.max(0, value), NOTE_MONEY_DECIMALS);
}

export type ExcessLateChargeFrozenSplit = {
  excessTawidhAmount: number;
  excessGharamahAmount: number;
  tawidhInvestorSharePercent: number;
};

export type ExcessLateChargePaymentAllocation = {
  tawidhAmount: number;
  tawidhInvestorAmount: number;
  tawidhAccountAmount: number;
  gharamahAmount: number;
  allocatedTotal: number;
};

function applyOrdered(remaining: number, due: number) {
  const applied = money(Math.min(remaining, due));
  return { applied, remaining: money(remaining - applied) };
}

export function frozenExcessLateChargeTotal(tawidhAmount: number, gharamahAmount: number) {
  return money(money(tawidhAmount) + money(gharamahAmount));
}

export function remainingExcessLateChargeSplit(
  frozen: Pick<ExcessLateChargeFrozenSplit, "excessTawidhAmount" | "excessGharamahAmount">,
  priorPaidAmount: number
) {
  const tawidhDue = money(frozen.excessTawidhAmount);
  const gharamahDue = money(frozen.excessGharamahAmount);
  const tawidh = applyOrdered(money(priorPaidAmount), tawidhDue);
  const gharamah = applyOrdered(tawidh.remaining, gharamahDue);
  return {
    remainingTawidh: money(tawidhDue - tawidh.applied),
    remainingGharamah: money(gharamahDue - gharamah.applied),
  };
}

/**
 * Ordered fill: remaining Ta'widh first, then remaining Gharamah.
 * Uses prior paid so multi-payments never double-allocate. 2dp residual goes
 * to the Ta'widh account bucket, then Gharamah if Ta'widh is already closed.
 */
export function allocateExcessLateChargePayment(input: {
  excessTawidhAmount: number;
  excessGharamahAmount: number;
  tawidhInvestorSharePercent: number;
  priorPaidAmount: number;
  paymentAmount: number;
}): ExcessLateChargePaymentAllocation {
  const remaining = remainingExcessLateChargeSplit(input, input.priorPaidAmount);
  const tawidh = applyOrdered(money(input.paymentAmount), remaining.remainingTawidh);
  const gharamah = applyOrdered(tawidh.remaining, remaining.remainingGharamah);
  const tawidhAmount = tawidh.applied;
  const gharamahAmount = gharamah.applied;
  const percent = Math.min(100, Math.max(0, input.tawidhInvestorSharePercent));
  const tawidhInvestorAmount = money(tawidhAmount * (percent / 100));
  let tawidhAccountAmount = money(tawidhAmount - tawidhInvestorAmount);
  const tawidhResidual = money(tawidhAmount - tawidhInvestorAmount - tawidhAccountAmount);
  if (tawidhResidual !== 0) {
    tawidhAccountAmount = money(tawidhAccountAmount + tawidhResidual);
  }
  return {
    tawidhAmount,
    tawidhInvestorAmount,
    tawidhAccountAmount,
    gharamahAmount,
    allocatedTotal: money(tawidhAmount + gharamahAmount),
  };
}

export function allocateRoundedShares(total: number, weights: number[]): number[] {
  return allocateProRataNoteMoney(money(total), weights.map((weight) => Math.max(0, weight)));
}
