import { NOTE_MONEY_DECIMALS, roundNoteMoney } from "@cashsouk/types";
import {
  allocatePostGraceSettlement,
  calculateCalendarDayCount,
  calculateCeilingAwareGrossProfit,
  calculateSettlementWaterfall,
  calculateTenureSettlementWaterfall,
  resolveProfitWindow,
} from "./calculators";

const START = new Date("2026-01-01T00:00:00.000Z");
const MATURITY = new Date("2026-04-01T00:00:00.000Z");
const GRACE_DAYS = 7;

function utcDate(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`);
}

describe("resolveProfitWindow", () => {
  it("stops profit at the cleared date when repayment is early", () => {
    const clearedDate = utcDate("2026-03-01");
    const window = resolveProfitWindow({
      startDate: START,
      maturityDate: MATURITY,
      clearedDate,
      graceDays: GRACE_DAYS,
    });

    expect(window.classification).toBe("EARLY");
    expect(window.endDate.toISOString()).toBe(clearedDate.toISOString());
    expect(window.profitDays).toBe(calculateCalendarDayCount(START, clearedDate));
    expect(window.profitDays).toBe(59);
  });

  it("classifies exact maturity as ON_MATURITY and uses the cleared date", () => {
    const window = resolveProfitWindow({
      startDate: START,
      maturityDate: MATURITY,
      clearedDate: MATURITY,
      graceDays: GRACE_DAYS,
    });

    expect(window.classification).toBe("ON_MATURITY");
    expect(window.endDate.toISOString()).toBe(MATURITY.toISOString());
    expect(window.profitDays).toBe(90);
  });

  it("stops profit at maturity on the last grace day", () => {
    const graceEnd = utcDate("2026-04-08");
    const window = resolveProfitWindow({
      startDate: START,
      maturityDate: MATURITY,
      clearedDate: graceEnd,
      graceDays: GRACE_DAYS,
    });

    expect(window.classification).toBe("GRACE");
    expect(window.endDate.toISOString()).toBe(MATURITY.toISOString());
    expect(window.graceEndDate.toISOString()).toBe(graceEnd.toISOString());
    expect(window.profitDays).toBe(90);
  });

  it("continues profit to the cleared date on the first day after grace", () => {
    const firstLateDay = utcDate("2026-04-09");
    const window = resolveProfitWindow({
      startDate: START,
      maturityDate: MATURITY,
      clearedDate: firstLateDay,
      graceDays: GRACE_DAYS,
    });

    expect(window.classification).toBe("LATE");
    expect(window.endDate.toISOString()).toBe(firstLateDay.toISOString());
    expect(window.profitDays).toBe(calculateCalendarDayCount(START, firstLateDay));
    expect(window.profitDays).toBe(98);
  });

  it("continues profit to a later cleared date", () => {
    const clearedDate = utcDate("2026-05-01");
    const window = resolveProfitWindow({
      startDate: START,
      maturityDate: MATURITY,
      clearedDate,
      graceDays: GRACE_DAYS,
    });

    expect(window.classification).toBe("LATE");
    expect(window.endDate.toISOString()).toBe(clearedDate.toISOString());
    expect(window.profitDays).toBe(120);
  });

  it("rejects invalid dates and negative grace", () => {
    expect(() =>
      resolveProfitWindow({
        startDate: new Date("not-a-date"),
        maturityDate: MATURITY,
        clearedDate: START,
        graceDays: GRACE_DAYS,
      })
    ).toThrow(/startDate must be a valid Date/);
    expect(() =>
      resolveProfitWindow({
        startDate: START,
        maturityDate: MATURITY,
        clearedDate: utcDate("2026-03-01"),
        graceDays: -1,
      })
    ).toThrow(/graceDays must be a non-negative integer/);
  });

  it("returns zero profit days when the resolved window is reversed", () => {
    const window = resolveProfitWindow({
      startDate: utcDate("2026-05-01"),
      maturityDate: MATURITY,
      clearedDate: utcDate("2026-03-01"),
      graceDays: GRACE_DAYS,
    });

    expect(window.classification).toBe("EARLY");
    expect(window.profitDays).toBe(0);
  });
});

describe("calculateCeilingAwareGrossProfit", () => {
  it("accrues uncapped profit below the RM100k / RM80k ceiling", () => {
    const result = calculateCeilingAwareGrossProfit({
      fundedPrincipal: 80_000,
      annualRatePercent: 10,
      profitDays: 365,
      invoiceFaceValue: 100_000,
    });

    expect(result.ceilingAmount).toBe(20_000);
    expect(result.uncappedGrossProfit).toBe(8_000);
    expect(result.investorProfitGross).toBe(8_000);
    expect(result.capped).toBe(false);
  });

  it("caps gross profit at invoice face minus funded principal", () => {
    const result = calculateCeilingAwareGrossProfit({
      fundedPrincipal: 80_000,
      annualRatePercent: 50,
      profitDays: 365,
      invoiceFaceValue: 100_000,
    });

    expect(result.uncappedGrossProfit).toBe(40_000);
    expect(result.ceilingAmount).toBe(20_000);
    expect(result.investorProfitGross).toBe(20_000);
    expect(result.capped).toBe(true);
  });
});

describe("allocatePostGraceSettlement", () => {
  const fullDue = {
    tawidhAmount: 200,
    investorProfitGross: 1_000,
    fundedPrincipal: 80_000,
    gharamahAmount: 300,
    serviceFeeRatePercent: 15,
    tawidhInvestorSharePercent: 25,
  };

  it("applies Ta'widh before profit, principal, and Gharamah", () => {
    const result = allocatePostGraceSettlement({
      ...fullDue,
      receiptAmount: 500,
    });

    expect(result.appliedTawidhAmount).toBe(200);
    expect(result.unpaidTawidhAmount).toBe(0);
    expect(result.appliedProfitGross).toBe(300);
    expect(result.unpaidProfitGross).toBe(700);
    expect(result.serviceFeeAmount).toBe(45);
    expect(result.investorProfitNet).toBe(255);
    expect(result.appliedPrincipal).toBe(0);
    expect(result.unpaidPrincipal).toBe(80_000);
    expect(result.appliedGharamahAmount).toBe(0);
    expect(result.unpaidGharamahAmount).toBe(300);
    expect(result.excessLateChargeAmount).toBe(300);
    expect(result.tawidhInvestorAmount).toBe(50);
    expect(result.tawidhAccountAmount).toBe(150);
    expect(result.issuerResidualAmount).toBe(0);
  });

  it("bills unpaid Ta'widh and Gharamah as excess late charges on shortfall", () => {
    const result = allocatePostGraceSettlement({
      ...fullDue,
      receiptAmount: 100,
    });

    expect(result.appliedTawidhAmount).toBe(100);
    expect(result.unpaidTawidhAmount).toBe(100);
    expect(result.appliedProfitGross).toBe(0);
    expect(result.appliedPrincipal).toBe(0);
    expect(result.appliedGharamahAmount).toBe(0);
    expect(result.excessLateChargeAmount).toBe(400);
  });

  it("pays Gharamah last and reports leftover receipt as issuer residual", () => {
    const result = allocatePostGraceSettlement({
      ...fullDue,
      receiptAmount: 81_600,
    });

    expect(result.appliedTawidhAmount).toBe(200);
    expect(result.appliedProfitGross).toBe(1_000);
    expect(result.appliedPrincipal).toBe(80_000);
    expect(result.appliedGharamahAmount).toBe(300);
    expect(result.excessLateChargeAmount).toBe(0);
    expect(result.issuerResidualAmount).toBe(100);
    expect(result.unappliedAmount).toBe(0);
    expect(result.serviceFeeAmount).toBe(150);
    expect(result.investorProfitNet).toBe(850);
  });

  it("rounds each applied bucket with shared note money helpers", () => {
    const result = allocatePostGraceSettlement({
      receiptAmount: 10.004,
      tawidhAmount: 10.006,
      investorProfitGross: 1.004,
      fundedPrincipal: 0,
      gharamahAmount: 0.009,
      serviceFeeRatePercent: 15,
    });

    expect(result.appliedTawidhAmount).toBe(roundNoteMoney(10.004, NOTE_MONEY_DECIMALS));
    expect(result.unpaidTawidhAmount).toBe(roundNoteMoney(10.01 - 10, NOTE_MONEY_DECIMALS));
    expect(result.appliedProfitGross).toBe(0);
    expect(result.unpaidGharamahAmount).toBe(0.01);
    expect(result.excessLateChargeAmount).toBe(
      roundNoteMoney(result.unpaidTawidhAmount + result.unpaidGharamahAmount, NOTE_MONEY_DECIMALS)
    );
  });
});

describe("calculateTenureSettlementWaterfall", () => {
  const base = {
    fundedPrincipal: 80_000,
    invoiceFaceValue: 100_000,
    profitRatePercent: 10,
    startDate: START,
    maturityDate: MATURITY,
    graceDays: GRACE_DAYS,
    serviceFeeRatePercent: 15,
    tawidhAmount: 200,
    tawidhInvestorSharePercent: 25,
    gharamahAmount: 300,
  };

  it("stops profit at the cleared date for early settlement and requires a full invoice receipt", () => {
    const result = calculateTenureSettlementWaterfall({
      ...base,
      grossReceiptAmount: 100_000,
      clearedDate: utcDate("2026-03-01"),
    });
    expect(result.classification).toBe("EARLY");
    expect(result.profitDays).toBe(59);
    expect(result.investorProfitGross).toBe(
      roundNoteMoney(80_000 * 0.1 * (59 / 365), NOTE_MONEY_DECIMALS)
    );
    expect(result.serviceFeeAmount).toBe(
      roundNoteMoney(result.investorProfitGross * 0.15, NOTE_MONEY_DECIMALS)
    );
    expect(result.tawidhAmount).toBe(0);
    expect(result.gharamahAmount).toBe(0);
    expect(result.excessLateChargeAmount).toBe(0);
    expect(result.investorObligationCovered).toBe(true);
    expect(result.investorPrincipal + result.investorProfitGross + result.issuerResidualAmount).toBe(
      result.grossReceiptAmount
    );
  });

  it("classifies exact maturity and the last grace day without late charges", () => {
    const onMaturity = calculateTenureSettlementWaterfall({
      ...base,
      grossReceiptAmount: 100_000,
      clearedDate: MATURITY,
    });
    expect(onMaturity.classification).toBe("ON_MATURITY");
    expect(onMaturity.profitDays).toBe(90);
    expect(onMaturity.excessLateChargeAmount).toBe(0);

    const graceEnd = calculateTenureSettlementWaterfall({
      ...base,
      grossReceiptAmount: 100_000,
      clearedDate: utcDate("2026-04-08"),
    });
    expect(graceEnd.classification).toBe("GRACE");
    expect(graceEnd.profitDays).toBe(90);
    expect(graceEnd.tawidhAmount).toBe(0);
  });

  it("continues profit on the first day after grace and applies the post-grace allocation order", () => {
    const result = calculateTenureSettlementWaterfall({
      ...base,
      grossReceiptAmount: 82_500,
      clearedDate: utcDate("2026-04-09"),
    });
    expect(result.classification).toBe("LATE");
    expect(result.profitDays).toBe(98);
    expect(result.tawidhAmount).toBe(200);
    expect(result.investorPrincipal).toBe(80_000);
    expect(result.unpaidPrincipal).toBe(0);
    expect(result.unpaidProfitGross).toBe(0);
    expect(result.excessLateChargeAmount).toBeGreaterThan(0);
    expect(result.investorObligationCovered).toBe(true);
  });

  it("blocks investor-obligation coverage when a late receipt does not reach principal", () => {
    const result = calculateTenureSettlementWaterfall({
      ...base,
      grossReceiptAmount: 1_000,
      clearedDate: utcDate("2026-04-09"),
    });
    expect(result.classification).toBe("LATE");
    expect(result.investorPrincipal).toBe(0);
    expect(result.unpaidPrincipal).toBe(80_000);
    expect(result.investorObligationCovered).toBe(false);
    expect(result.excessLateChargeAmount).toBeGreaterThan(0);
  });

  it("caps late profit at the RM100k / RM80k ceiling", () => {
    const result = calculateTenureSettlementWaterfall({
      ...base,
      profitRatePercent: 50,
      grossReceiptAmount: 100_000,
      clearedDate: utcDate("2027-01-01"),
    });
    expect(result.classification).toBe("LATE");
    expect(result.ceilingAmount).toBe(20_000);
    expect(result.ceilingUsedAmount).toBe(20_000);
    expect(result.ceilingRemainingAmount).toBe(0);
    expect(result.investorProfitGross).toBe(20_000);
  });

  it("reconciles late-fee ledger lines to the receipt after rounding", () => {
    const result = calculateTenureSettlementWaterfall({
      ...base,
      tawidhAmount: 200,
      gharamahAmount: 300,
      grossReceiptAmount: 81_500,
      clearedDate: utcDate("2026-05-01"),
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
  });
});

describe("legacy calculateSettlementWaterfall unchanged", () => {
  it("still splits a full receipt without the post-grace allocation order", () => {
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

    expect(result.investorPrincipal).toBe(60_000);
    expect(result.investorProfitGross).toBe(6_000);
    expect(result.issuerResidualAmount).toBe(33_500);
    expect(result.settlementShortfallAmount).toBe(0);
  });
});
