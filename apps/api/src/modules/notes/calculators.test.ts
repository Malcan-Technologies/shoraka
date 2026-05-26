import {
  buildSettlementAllocations,
  buildSettlementInvestorAllocations,
  calculateCalendarDayCount,
  calculateLateCharge,
  calculateSettlementWaterfall,
  capLateFeeSuggestionsByHeadroom,
  computeActualReturnRatePercent,
  meetsMinimumFunding,
} from "./calculators";

describe("note lifecycle calculators", () => {
  it("enforces the minimum funding threshold with half-cent tolerance", () => {
    expect(meetsMinimumFunding(80_000, 100_000)).toBe(true);
    expect(meetsMinimumFunding(79_999.5, 100_000, 80)).toBe(true);
    expect(meetsMinimumFunding(79_990, 100_000, 80)).toBe(false);
  });

  it("splits settlement into investor, service fee, syariah, and issuer residual buckets", () => {
    const result = calculateSettlementWaterfall({
      grossReceiptAmount: 100_000,
      fundedPrincipal: 60_000,
      profitRatePercent: 10,
      profitStartDate: new Date("2026-01-01T00:00:00.000Z"),
      profitMaturityDate: new Date("2027-01-01T00:00:00.000Z"),
      serviceFeeRatePercent: 15,
      tawidhAmount: 200,
      tawidhInvestorSharePercent: 25,
      gharamahAmount: 300,
    });

    expect(result.grossReceiptAmount).toBe(100_000);
    expect(result.investorPrincipal).toBe(60_000);
    expect(result.profitDays).toBe(365);
    expect(result.investorProfitGross).toBe(6_000);
    expect(result.serviceFeeAmount).toBe(900);
    expect(result.investorProfitNet).toBe(5_100);
    expect(result.tawidhAmount).toBe(200);
    expect(result.tawidhInvestorAmount).toBe(50);
    expect(result.tawidhAccountAmount).toBe(150);
    expect(result.gharamahAmount).toBe(300);
    expect(result.investorPoolTotal).toBe(65_150);
    expect(result.availableLateFeeHeadroomAmount).toBe(34_000);
    expect(result.settlementShortfallAmount).toBe(0);
    expect(result.issuerResidualAmount).toBe(33_500);
  });

  it("prorates annual profit to the locked maturity date", () => {
    const result = calculateSettlementWaterfall({
      grossReceiptAmount: 100_000,
      fundedPrincipal: 60_000,
      profitRatePercent: 12,
      profitStartDate: new Date("2026-01-01T00:00:00.000Z"),
      profitMaturityDate: new Date("2026-04-01T00:00:00.000Z"),
      serviceFeeRatePercent: 10,
    });

    expect(result.profitDays).toBe(90);
    expect(result.investorProfitGross).toBe(1_775.34);
    expect(result.serviceFeeAmount).toBe(177.53);
    expect(result.investorProfitNet).toBe(1_597.81);
  });

  it("reconciles settlement so repayment ledger debits equal gross receipt", () => {
    const result = calculateSettlementWaterfall({
      grossReceiptAmount: 79_677.88,
      fundedPrincipal: 47_806.73,
      profitRatePercent: 10,
      profitStartDate: new Date("2026-01-01T00:00:00.000Z"),
      profitMaturityDate: new Date("2026-05-21T00:00:00.000Z"),
      serviceFeeRatePercent: 15,
    });

    const repaymentDebits =
      result.investorPrincipal +
      result.investorProfitNet +
      result.serviceFeeAmount +
      result.tawidhAmount +
      result.gharamahAmount +
      result.issuerResidualAmount;

    expect(repaymentDebits).toBe(result.grossReceiptAmount);
    expect(result.unappliedAmount).toBe(0);
    expect(result.investorProfitNet + result.serviceFeeAmount).toBe(result.investorProfitGross);
  });

  it("allocates profit and Ta'widh only across eligible investments and scales principal to the waterfall", () => {
    const allocations = buildSettlementAllocations({
      investments: [
        { id: "inv-a", investorOrganizationId: "org-a", amount: 40_000 },
        { id: "inv-b", investorOrganizationId: "org-b", amount: 20_000 },
      ],
      investorPrincipal: 50_000,
      investorProfitNet: 5_000,
      tawidhInvestorAmount: 100,
    });

    expect(allocations).toHaveLength(2);
    const totalPrincipal = allocations.reduce((sum, row) => sum + row.principal, 0);
    const totalProfit = allocations.reduce((sum, row) => sum + row.profitNet, 0);
    const totalTawidh = allocations.reduce((sum, row) => sum + row.tawidhInvestorShare, 0);
    expect(totalPrincipal).toBeCloseTo(50_000, 2);
    expect(totalProfit).toBeCloseTo(5_000, 2);
    expect(totalTawidh).toBeCloseTo(100, 2);
    expect(allocations[0].profitNet / allocations[1].profitNet).toBeCloseTo(2, 5);
  });

  it("counts whole UTC calendar days without partial-day drift", () => {
    expect(
      calculateCalendarDayCount(
        new Date("2026-01-01T23:59:00.000Z"),
        new Date("2026-01-02T00:01:00.000Z")
      )
    ).toBe(1);
    expect(
      calculateCalendarDayCount(
        new Date("2026-01-01T00:01:00.000Z"),
        new Date("2026-01-01T23:59:00.000Z")
      )
    ).toBe(0);
  });

  it("does not charge an extra overdue day for same-calendar-day partial timestamps", () => {
    const result = calculateLateCharge({
      receiptAmount: 100_000,
      dueDate: new Date("2026-01-01T00:00:00.000Z"),
      receiptDate: new Date("2026-01-01T23:59:00.000Z"),
      gracePeriodDays: 0,
      tawidhRateCapPercent: 1,
      gharamahRateCapPercent: 9,
    });

    expect(result.daysLate).toBe(0);
    expect(result.tawidhAmount).toBe(0);
    expect(result.gharamahAmount).toBe(0);
  });

  it("reports a settlement shortfall when receipt cannot cover principal, profit, and late charges", () => {
    const result = calculateSettlementWaterfall({
      grossReceiptAmount: 60_000,
      fundedPrincipal: 60_000,
      profitRatePercent: 10,
      profitStartDate: new Date("2026-01-01T00:00:00.000Z"),
      profitMaturityDate: new Date("2027-01-01T00:00:00.000Z"),
      serviceFeeRatePercent: 15,
      tawidhAmount: 200,
      gharamahAmount: 300,
    });

    expect(result.investorProfitGross).toBe(6_000);
    expect(result.issuerResidualAmount).toBe(0);
    expect(result.settlementShortfallAmount).toBe(6_500);
  });

  it("keeps issuer residual unchanged when Ta'widh is shared with investors", () => {
    const base = {
      grossReceiptAmount: 100_000,
      fundedPrincipal: 60_000,
      profitRatePercent: 10,
      profitStartDate: new Date("2026-01-01T00:00:00.000Z"),
      profitMaturityDate: new Date("2027-01-01T00:00:00.000Z"),
      serviceFeeRatePercent: 15,
      tawidhAmount: 1_000,
      gharamahAmount: 500,
    };

    const allToBucket = calculateSettlementWaterfall(base);
    const splitToInvestors = calculateSettlementWaterfall({
      ...base,
      tawidhInvestorSharePercent: 40,
    });

    expect(splitToInvestors.tawidhInvestorAmount).toBe(400);
    expect(splitToInvestors.tawidhAccountAmount).toBe(600);
    expect(splitToInvestors.issuerResidualAmount).toBe(allToBucket.issuerResidualAmount);
  });

  it("reports zero late-fee headroom when invoice equals funded principal plus full-term profit", () => {
    const result = calculateSettlementWaterfall({
      grossReceiptAmount: 110_000,
      fundedPrincipal: 100_000,
      profitRatePercent: 10,
      profitStartDate: new Date("2026-01-01T00:00:00.000Z"),
      profitMaturityDate: new Date("2027-01-01T00:00:00.000Z"),
      serviceFeeRatePercent: 15,
    });

    expect(result.availableLateFeeHeadroomAmount).toBe(0);
    expect(result.settlementShortfallAmount).toBe(0);
  });

  it("scales suggested late fees down to settlement headroom", () => {
    const capped = capLateFeeSuggestionsByHeadroom({
      remainingTawidhAmount: 200,
      remainingGharamahAmount: 300,
      availableLateFeeHeadroomAmount: 100,
    });

    expect(capped.suggestedTawidhAmount).toBeCloseTo(40, 6);
    expect(capped.suggestedGharamahAmount).toBeCloseTo(60, 6);
  });

  it("caps manually entered ta'widh and gharamah at configured rates after grace period", () => {
    const result = calculateLateCharge({
      receiptAmount: 100_000,
      dueDate: new Date("2026-01-01T00:00:00.000Z"),
      receiptDate: new Date("2026-01-18T00:00:00.000Z"),
      gracePeriodDays: 7,
      tawidhRateCapPercent: 1,
      gharamahRateCapPercent: 9,
      tawidhAmount: 999,
      gharamahAmount: 999,
    });

    expect(result.daysLate).toBe(10);
    expect(result.tawidhAmount).toBeCloseTo(27.39726027, 6);
    expect(result.gharamahAmount).toBeCloseTo(246.57534247, 6);
  });

  it("builds cent-safe investor allocations for partial principal receipts", () => {
    const waterfall = calculateSettlementWaterfall({
      grossReceiptAmount: 60_000,
      fundedPrincipal: 100_000,
      profitRatePercent: 10,
      profitStartDate: new Date("2026-01-01T00:00:00.000Z"),
      profitMaturityDate: new Date("2027-01-01T00:00:00.000Z"),
      serviceFeeRatePercent: 15,
      tawidhAmount: 0,
      gharamahAmount: 0,
    });
    const allocations = buildSettlementInvestorAllocations({
      investments: [
        {
          investmentId: "inv-a",
          investorOrganizationId: "org-a",
          amount: 50_000,
        },
        {
          investmentId: "inv-b",
          investorOrganizationId: "org-b",
          amount: 50_000,
        },
      ],
      investorPrincipal: waterfall.investorPrincipal,
      investorProfitNet: waterfall.investorProfitNet,
    });

    expect(allocations.reduce((sum, row) => sum + row.principal, 0)).toBe(
      waterfall.investorPrincipal
    );
    expect(allocations.reduce((sum, row) => sum + row.profitNet, 0)).toBe(
      waterfall.investorProfitNet
    );
    expect(allocations.every((row) => row.principal < row.amount)).toBe(true);
  });

  it("includes investor Ta'widh compensation in actual return rate", () => {
    expect(
      computeActualReturnRatePercent({
        investedPrincipal: 10_000,
        receivedProfitNetAmount: 500,
        receivedTawidhCompensationAmount: 100,
      })
    ).toBe(6);

    expect(
      computeActualReturnRatePercent({
        investedPrincipal: 10_000,
        receivedProfitNetAmount: 0,
        receivedTawidhCompensationAmount: 250,
      })
    ).toBe(2.5);
  });

  it("returns null actual return rate when no investor return has been received", () => {
    expect(
      computeActualReturnRatePercent({
        investedPrincipal: 10_000,
        receivedProfitNetAmount: 0,
        receivedTawidhCompensationAmount: 0,
      })
    ).toBeNull();
  });
});
