import { computeActualReturnRatePercent } from "./calculators";
import {
  averageNetAnnualReturnPercent,
  computeAtRisk,
  computeCashflowNext90Days,
  idleDaysSince,
  malaysiaDateKey,
  principalEventsFromConfirmationsAndReturns,
  reconstructPrincipalOnDates,
  returnsSinceDate,
  sumReturnsEarned,
  uniqueSettlementsById,
  ytdChangePercent,
  portfolioTotalBefore,
  type HoldingForDashboard,
} from "./investor-dashboard-metrics";

function holding(overrides: Partial<HoldingForDashboard> = {}): HoldingForDashboard {
  return {
    investmentId: overrides.investmentId ?? overrides.noteId ?? "inv-1",
    noteId: "note-1",
    noteReference: "NOTE-1",
    issuerName: "Issuer Co",
    noteStatus: "ACTIVE",
    servicingStatus: "CURRENT",
    daysPastDue: 0,
    confirmedAmount: 10_000,
    fundedAmount: 10_000,
    recoveredPrincipal: 0,
    recoveredProfit: 0,
    profitRatePercent: 12,
    serviceFeeRatePercent: 15,
    tenureDays: 90,
    maturityDate: new Date("2026-12-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("malaysiaDateKey", () => {
  it("uses the MYT calendar date when UTC is still the previous evening", () => {
    expect(malaysiaDateKey(new Date("2026-01-01T15:59:00.000Z"))).toBe("2026-01-01");
    expect(malaysiaDateKey(new Date("2026-01-01T16:00:00.000Z"))).toBe("2026-01-02");
  });
});

describe("idleDaysSince", () => {
  it("counts MYT calendar days since the last posted movement", () => {
    const lastPosted = new Date("2026-01-01T15:30:00.000Z");
    const now = new Date("2026-01-03T10:00:00.000Z");
    expect(idleDaysSince(lastPosted, now)).toBe(2);
  });

  it("treats a UTC evening that is already the next MYT day as same-day idle 0", () => {
    const lastPosted = new Date("2026-01-01T16:30:00.000Z");
    const now = new Date("2026-01-02T02:00:00.000Z");
    expect(idleDaysSince(lastPosted, now)).toBe(0);
  });

  it("returns null when there are no movements", () => {
    expect(idleDaysSince(null, new Date("2026-01-02T00:00:00.000Z"))).toBeNull();
  });
});

describe("ytdChangePercent", () => {
  it("returns the percent change against the MYT year-start total", () => {
    expect(ytdChangePercent(120, 100)).toBe(20);
    expect(ytdChangePercent(80, 100)).toBe(-20);
  });

  it("returns null when the start total cannot be used as a base", () => {
    expect(ytdChangePercent(100, null)).toBeNull();
    expect(ytdChangePercent(100, 0)).toBeNull();
  });
});

describe("portfolioTotalBefore", () => {
  it("applies only movements before the MYT year-start instant", () => {
    const yearStart = new Date("2025-12-31T16:00:00.000Z");
    expect(
      portfolioTotalBefore(
        100,
        [
          { at: new Date("2025-12-31T15:30:00.000Z"), delta: 10 },
          { at: new Date("2025-12-31T16:30:00.000Z"), delta: 25 },
        ],
        yearStart
      )
    ).toBe(110);
  });
});

describe("returnsSinceDate", () => {
  it("returns the MYT date of the first confirmation", () => {
    expect(returnsSinceDate(new Date("2026-01-01T16:05:00.000Z"))).toBe("2026-01-02");
    expect(returnsSinceDate(null)).toBeNull();
  });
});

describe("sumReturnsEarned", () => {
  it("sums net profit allocated to the investor orgs", () => {
    expect(
      sumReturnsEarned(
        [
          { investorOrganizationId: "a", principal: 1000, profitNet: 12.345, tawidhInvestorShare: 1 },
          { investorOrganizationId: "b", principal: 1000, profitNet: 50, tawidhInvestorShare: 0 },
          { investorOrganizationId: "a", principal: 500, profitNet: 7.655, tawidhInvestorShare: 0 },
        ],
        new Set(["a"])
      )
    ).toBe(20);
  });
});

describe("uniqueSettlementsById", () => {
  it("keeps one settlement when several holdings share the same note", () => {
    const settlement = { id: "set-1", preview_snapshot: { allocations: [] } };
    const unique = uniqueSettlementsById([
      { note: { settlements: [settlement] } },
      { note: { settlements: [settlement] } },
    ]);
    expect(unique).toHaveLength(1);
    expect(unique[0]?.id).toBe("set-1");
  });
});

describe("averageNetAnnualReturnPercent", () => {
  it("weights realized annual returns by invested principal", () => {
    const small: Parameters<typeof computeActualReturnRatePercent>[0] = {
      investedPrincipal: 100,
      receivedProfitNetAmount: 10,
      receivedTawidhCompensationAmount: 0,
      profitDays: 365,
    };
    const large: Parameters<typeof computeActualReturnRatePercent>[0] = {
      investedPrincipal: 200,
      receivedProfitNetAmount: 40,
      receivedTawidhCompensationAmount: 0,
      profitDays: 365,
    };
    expect(averageNetAnnualReturnPercent([small, large])).toBe(
      roundWeighted([
        [computeActualReturnRatePercent(small)!, 100],
        [computeActualReturnRatePercent(large)!, 200],
      ])
    );
  });

  it("returns null when no settled investment has a computable rate", () => {
    expect(
      averageNetAnnualReturnPercent([
        {
          investedPrincipal: 100,
          receivedProfitNetAmount: 0,
          receivedTawidhCompensationAmount: 0,
          profitDays: 90,
        },
      ])
    ).toBeNull();
  });
});

function roundWeighted(rows: Array<[number, number]>): number {
  const weight = rows.reduce((sum, [, w]) => sum + w, 0);
  const weighted = rows.reduce((sum, [rate, w]) => sum + rate * w, 0);
  return Math.round((weighted / weight) * 100) / 100;
}

describe("reconstructPrincipalOnDates", () => {
  it("carries confirmations and principal returns forward, forcing the last point live", () => {
    const events = principalEventsFromConfirmationsAndReturns({
      confirmations: [
        { confirmedAt: new Date("2026-01-01T16:30:00.000Z"), amount: 1000 },
        { confirmedAt: new Date("2026-02-01T00:00:00.000Z"), amount: 500 },
      ],
      principalReturns: [{ postedAt: new Date("2026-03-01T00:00:00.000Z"), principal: 1000 }],
    });
    expect(reconstructPrincipalOnDates(events, ["2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01"], 400)).toEqual([
      0, 1500, 500, 400,
    ]);
  });

  it("does not invent confirmations without confirmedAt", () => {
    const events = principalEventsFromConfirmationsAndReturns({
      confirmations: [{ confirmedAt: null, amount: 9000 }],
      principalReturns: [],
    });
    expect(reconstructPrincipalOnDates(events, ["2026-01-01", "2026-01-02"], 9000)).toEqual([0, 9000]);
  });
});

describe("computeAtRisk", () => {
  it("uses remaining outstanding share on overdue notes", () => {
    const result = computeAtRisk(
      [
        holding({
          servicingStatus: "LATE",
          daysPastDue: 9,
          confirmedAmount: 50_000,
          fundedAmount: 100_000,
          profitRatePercent: 0,
        }),
        holding({
          noteId: "note-2",
          noteReference: "NOTE-2",
          servicingStatus: "CURRENT",
          confirmedAmount: 20_000,
        }),
      ],
      80_000
    );
    expect(result.count).toBe(1);
    expect(result.amount).toBe(50_000);
    expect(result.percent).toBe(62.5);
    expect(result.maxDaysPastDue).toBe(9);
  });

  it("falls back to confirmed amount when remaining outstanding is 0", () => {
    const result = computeAtRisk(
      [
        holding({
          noteStatus: "DEFAULTED",
          servicingStatus: "DEFAULTED",
          daysPastDue: 120,
          recoveredPrincipal: 10_000,
          recoveredProfit: 10_000,
          profitRatePercent: 0,
        }),
      ],
      10_000
    );
    expect(result.amount).toBe(10_000);
    expect(result.maxDaysPastDue).toBe(120);
  });

  it("returns zeros when nothing is at risk", () => {
    expect(computeAtRisk([holding()], 50_000)).toEqual({
      amount: 0,
      percent: 0,
      count: 0,
      maxDaysPastDue: null,
    });
  });

  it("counts unique notes when one overdue note has multiple holdings", () => {
    const result = computeAtRisk(
      [
        holding({
          investmentId: "inv-a",
          servicingStatus: "ARREARS",
          daysPastDue: 40,
          confirmedAmount: 40_000,
          fundedAmount: 100_000,
          profitRatePercent: 0,
        }),
        holding({
          investmentId: "inv-b",
          servicingStatus: "ARREARS",
          daysPastDue: 40,
          confirmedAmount: 60_000,
          fundedAmount: 100_000,
          profitRatePercent: 0,
        }),
      ],
      100_000
    );
    expect(result.count).toBe(1);
    expect(result.amount).toBe(100_000);
  });
});

describe("computeCashflowNext90Days", () => {
  it("buckets live confirmed notes into MYT months inside the next 90 days", () => {
    const now = new Date("2026-09-09T02:00:00.000Z");
    const result = computeCashflowNext90Days(
      [
        holding({
          maturityDate: new Date("2026-09-20T00:00:00.000Z"),
          profitRatePercent: 0,
        }),
        holding({
          noteId: "note-2",
          noteReference: "NOTE-2",
          maturityDate: new Date("2026-11-01T00:00:00.000Z"),
          confirmedAmount: 5_000,
          fundedAmount: 5_000,
          profitRatePercent: 0,
        }),
        holding({
          noteId: "december",
          noteReference: "NOTE-DEC",
          maturityDate: new Date("2026-12-08T00:00:00.000Z"),
          confirmedAmount: 2_000,
          fundedAmount: 2_000,
          profitRatePercent: 0,
        }),
        holding({
          noteId: "too-far",
          noteReference: "NOTE-FAR",
          maturityDate: new Date("2026-12-09T00:00:00.000Z"),
          confirmedAmount: 3_000,
          fundedAmount: 3_000,
          profitRatePercent: 0,
        }),
        holding({
          noteId: "overdue",
          noteReference: "NOTE-OD",
          servicingStatus: "OVERDUE",
          daysPastDue: 8,
          maturityDate: new Date("2026-09-01T00:00:00.000Z"),
          profitRatePercent: 0,
        }),
        holding({
          noteId: "settled",
          noteReference: "NOTE-S",
          noteStatus: "REPAID",
          servicingStatus: "SETTLED",
          maturityDate: new Date("2026-09-15T00:00:00.000Z"),
        }),
      ],
      now
    );
    expect(result.months.map((month) => month.yearMonth)).toEqual([
      "2026-09",
      "2026-10",
      "2026-11",
      "2026-12",
    ]);
    expect(result.months[0]).toMatchObject({ yearMonth: "2026-09", count: 1, amount: 10_000 });
    expect(result.months[1]).toMatchObject({ yearMonth: "2026-10", count: 0, amount: 0 });
    expect(result.months[2]).toMatchObject({ yearMonth: "2026-11", count: 1, amount: 5_000 });
    expect(result.months[3]).toMatchObject({ yearMonth: "2026-12", count: 1, amount: 2_000 });
    expect(result.totalAmount).toBe(17_000);
    expect(result.noteCount).toBe(3);
    expect(result.upcoming.map((row) => row.noteReference)).toEqual([
      "NOTE-1",
      "NOTE-2",
      "NOTE-DEC",
    ]);
    expect(result.upcoming[0].profit).toBe(0);
  });

  it("keeps separate upcoming rows when two holdings share a note and due date", () => {
    const now = new Date("2026-09-09T02:00:00.000Z");
    const result = computeCashflowNext90Days(
      [
        holding({
          investmentId: "inv-a",
          maturityDate: new Date("2026-09-20T00:00:00.000Z"),
          confirmedAmount: 50_000,
          fundedAmount: 55_000,
          profitRatePercent: 0,
        }),
        holding({
          investmentId: "inv-b",
          maturityDate: new Date("2026-09-20T00:00:00.000Z"),
          confirmedAmount: 5_000,
          fundedAmount: 55_000,
          profitRatePercent: 0,
        }),
      ],
      now
    );
    expect(result.upcoming.map((row) => row.investmentId)).toEqual(["inv-b", "inv-a"]);
    expect(result.upcoming.map((row) => row.amount)).toEqual([5_000, 50_000]);
    expect(result.noteCount).toBe(2);
  });

  it("nets remaining profit at the note service-fee rate", () => {
    const now = new Date("2026-09-09T02:00:00.000Z");
    const result = computeCashflowNext90Days(
      [
        holding({
          maturityDate: new Date("2026-10-01T00:00:00.000Z"),
          profitRatePercent: 10,
          serviceFeeRatePercent: 20,
          tenureDays: 365,
        }),
      ],
      now
    );
    expect(result.upcoming[0]?.profit).toBe(800);
    expect(result.upcoming[0]?.amount).toBe(10_800);
    expect(result.months[1]).toMatchObject({ yearMonth: "2026-10", amount: 10_800, count: 1 });
  });

  it("keeps a UTC evening due date on the next MYT calendar day", () => {
    const now = new Date("2026-01-01T10:00:00.000Z");
    const result = computeCashflowNext90Days(
      [
        holding({
          maturityDate: new Date("2026-01-01T16:30:00.000Z"),
          profitRatePercent: 0,
        }),
      ],
      now
    );
    expect(result.upcoming[0].dueDate).toBe("2026-01-02");
    expect(result.months[0].yearMonth).toBe("2026-01");
    expect(result.months[0].count).toBe(1);
  });
});
