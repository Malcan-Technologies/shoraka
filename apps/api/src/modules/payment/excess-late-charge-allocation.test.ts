import {
  allocateExcessLateChargePayment,
  allocateRoundedShares,
  frozenExcessLateChargeTotal,
  remainingExcessLateChargeSplit,
  remainingFrozenSplitAfterWaivers,
  remainingWaivableExcessLateChargeSplit,
  postedSettlementWaiverLimits,
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

  it("reduces the frozen split by component waivers so leftover still allocates", () => {
    const posted = { excessTawidhAmount: 80, excessGharamahAmount: 20 };
    const net = remainingFrozenSplitAfterWaivers({
      ...posted,
      waivedTawidhAmount: 10,
      waivedGharamahAmount: 0,
    });
    const splitTotal = frozenExcessLateChargeTotal(net.excessTawidhAmount, net.excessGharamahAmount);
    const owedAmount = frozenExcessLateChargeTotal(posted.excessTawidhAmount, posted.excessGharamahAmount) - 10;
    expect(splitTotal).toBe(owedAmount);

    const allocation = allocateExcessLateChargePayment({
      ...net,
      tawidhInvestorSharePercent: 0,
      priorPaidAmount: 0,
      paymentAmount: owedAmount,
    });
    expect(allocation.allocatedTotal).toBe(90);
    expect(allocation.tawidhAmount).toBe(70);
    expect(allocation.gharamahAmount).toBe(20);
  });

  it("subtracts ordered Ta'widh-then-Gharamah payments from waivable components", () => {
    expect(
      remainingWaivableExcessLateChargeSplit({
        excessTawidhAmount: 100,
        excessGharamahAmount: 100,
        waivedTawidhAmount: 0,
        waivedGharamahAmount: 0,
        paidAmount: 100,
      })
    ).toEqual({ remainingTawidh: 0, remainingGharamah: 100 });
  });

  it("uses the locked settlement aggregate so a second waiver cannot overwrite the first", () => {
    const first = postedSettlementWaiverLimits({
      excessTawidhAmount: 100,
      excessGharamahAmount: 100,
      excessLateChargeAmount: 200,
      paidAmount: 0,
      waivedAmount: 0,
      waivedTawidhAmount: 0,
      waivedGharamahAmount: 0,
    });
    expect(first.remainingExcess).toBe(200);
    const afterFirst = postedSettlementWaiverLimits({
      excessTawidhAmount: 100,
      excessGharamahAmount: 100,
      excessLateChargeAmount: 200,
      paidAmount: 0,
      waivedAmount: 80,
      waivedTawidhAmount: 80,
      waivedGharamahAmount: 0,
    });
    expect(afterFirst.remainingExcess).toBe(120);
    expect(afterFirst.remainingTawidhAmount).toBe(20);
  });

  it("assigns 2dp residual to the last positive investor weight", () => {
    expect(allocateRoundedShares(10.01, [1, 1, 1])).toEqual([3.34, 3.34, 3.33]);
  });
});
