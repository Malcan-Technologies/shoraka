import {
  allocateExcessLateChargePayment,
  allocateRoundedShares,
  frozenExcessLateChargeTotal,
  remainingExcessLateChargeSplit,
} from "./excess-late-charge-allocation";

describe("excess late charge allocation", () => {
  it("keeps the frozen total equal to the rounded Ta'widh + Gharamah sum", () => {
    expect(frozenExcessLateChargeTotal(10.006, 0.004)).toBe(10.01);
  });

  it("fills remaining Ta'widh before Gharamah across multiple payments", () => {
    const frozen = {
      excessTawidhAmount: 100,
      excessGharamahAmount: 40,
      tawidhInvestorSharePercent: 25,
    };
    const first = allocateExcessLateChargePayment({
      ...frozen,
      priorPaidAmount: 0,
      paymentAmount: 80,
    });
    expect(first).toEqual({
      tawidhAmount: 80,
      tawidhInvestorAmount: 20,
      tawidhAccountAmount: 60,
      gharamahAmount: 0,
      allocatedTotal: 80,
    });

    const remainingAfterFirst = remainingExcessLateChargeSplit(frozen, 80);
    expect(remainingAfterFirst).toEqual({ remainingTawidh: 20, remainingGharamah: 40 });

    const second = allocateExcessLateChargePayment({
      ...frozen,
      priorPaidAmount: 80,
      paymentAmount: 60,
    });
    expect(second).toEqual({
      tawidhAmount: 20,
      tawidhInvestorAmount: 5,
      tawidhAccountAmount: 15,
      gharamahAmount: 40,
      allocatedTotal: 60,
    });
  });

  it("does not allocate beyond the frozen remaining split", () => {
    const allocation = allocateExcessLateChargePayment({
      excessTawidhAmount: 10,
      excessGharamahAmount: 5,
      tawidhInvestorSharePercent: 0,
      priorPaidAmount: 12,
      paymentAmount: 10,
    });
    expect(allocation.allocatedTotal).toBe(3);
    expect(allocation.tawidhAmount).toBe(0);
    expect(allocation.gharamahAmount).toBe(3);
  });

  it("assigns 2dp residual to the last positive investor weight", () => {
    expect(allocateRoundedShares(10.01, [1, 1, 1])).toEqual([3.34, 3.34, 3.33]);
  });
});
