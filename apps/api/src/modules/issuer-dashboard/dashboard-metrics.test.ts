import {
  buildIssuerDashboardBook,
  computeCostOfFinancingYtd,
  computeFacilityLimitSummary,
  computeFundingProgress,
  computeNextRepayment,
  computeOutstandingOverTime,
  computeRepaymentSchedule,
  isInstantInMytYear,
  type IssuerBookNoteInput,
} from "./dashboard-metrics";

function note(overrides: Partial<IssuerBookNoteInput> = {}): IssuerBookNoteInput {
  return {
    id: "note-1",
    noteReference: "NOTE-1",
    status: "ACTIVE",
    fundingStatus: "FUNDED",
    servicingStatus: "CURRENT",
    fundedAmount: 100_000,
    targetAmount: 100_000,
    recoveredPrincipal: 0,
    recoveredProfit: 0,
    profitRatePercent: 12,
    tenureDays: 90,
    maturityDate: new Date("2026-10-01T00:00:00.000Z"),
    paymasterSnapshot: { name: "Acme Paymaster" },
    ...overrides,
  };
}

describe("isInstantInMytYear", () => {
  it("uses the MYT year across the UTC evening boundary", () => {
    const now = new Date("2026-01-01T10:00:00.000Z");
    expect(isInstantInMytYear(new Date("2025-12-31T16:30:00.000Z"), now)).toBe(true);
    expect(isInstantInMytYear(new Date("2025-12-31T15:30:00.000Z"), now)).toBe(false);
  });
});

describe("computeNextRepayment", () => {
  it("picks the earliest live due date and remaining MYT days", () => {
    const now = new Date("2026-09-09T02:00:00.000Z");
    const result = computeNextRepayment(
      [
        note({
          id: "later",
          noteReference: "NOTE-2",
          maturityDate: new Date("2026-11-01T00:00:00.000Z"),
        }),
        note({ maturityDate: new Date("2026-10-01T00:00:00.000Z") }),
        note({
          id: "repaid",
          noteReference: "NOTE-R",
          status: "REPAID",
          servicingStatus: "SETTLED",
          maturityDate: new Date("2026-09-10T00:00:00.000Z"),
        }),
      ],
      now
    );
    expect(result?.noteId).toBe("note-1");
    expect(result?.dueDate).toBe("2026-10-01");
    expect(result?.daysRemaining).toBe(22);
    expect(result?.paymasterName).toBe("Acme Paymaster");
    expect(result?.amount).toBeGreaterThan(100_000);
    expect(result?.profit).toBeGreaterThan(0);
  });

  it("counts remaining days on the MYT date, not UTC midnight", () => {
    const now = new Date("2026-09-30T16:30:00.000Z");
    const result = computeNextRepayment(
      [note({ maturityDate: new Date("2026-10-01T00:00:00.000Z") })],
      now
    );
    expect(malaysiaToday(now)).toBe("2026-10-01");
    expect(result?.dueDate).toBe("2026-10-01");
    expect(result?.daysRemaining).toBe(0);
  });
});

function malaysiaToday(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

describe("computeRepaymentSchedule", () => {
  it("returns upcoming MYT months that have due notes, up to 4", () => {
    const now = new Date("2026-09-09T02:00:00.000Z");
    const schedule = computeRepaymentSchedule(
      [
        note({ maturityDate: new Date("2026-09-20T00:00:00.000Z"), profitRatePercent: 0 }),
        note({
          id: "note-2",
          noteReference: "NOTE-2",
          maturityDate: new Date("2026-11-02T00:00:00.000Z"),
          profitRatePercent: 0,
        }),
      ],
      now
    );
    expect(schedule.map((row) => row.yearMonth)).toEqual(["2026-09", "2026-11"]);
    expect(schedule[0].count).toBe(1);
    expect(schedule[0].amount).toBe(100_000);
  });

  it("includes earlier overdue balances in the current month due-now bucket", () => {
    const schedule = computeRepaymentSchedule(
      [
        note({
          maturityDate: new Date("2026-08-20T00:00:00.000Z"),
          profitRatePercent: 0,
          servicingStatus: "ARREARS",
          status: "ARREARS",
        }),
        note({
          id: "current-month",
          noteReference: "NOTE-2",
          maturityDate: new Date("2026-09-20T00:00:00.000Z"),
          profitRatePercent: 0,
        }),
      ],
      new Date("2026-09-09T02:00:00.000Z")
    );

    expect(schedule[0]).toEqual({
      yearMonth: "2026-09",
      label: "Sep 2026",
      amount: 200_000,
      count: 2,
    });
  });
});

describe("computeFundingProgress", () => {
  it("includes open listings and funded notes awaiting disbursement", () => {
    const now = new Date("2026-09-09T02:00:00.000Z");
    const rows = computeFundingProgress(
      [
        note({
          status: "PUBLISHED",
          fundingStatus: "OPEN",
          fundedAmount: 40_000,
          targetAmount: 100_000,
          listingClosesAt: new Date("2026-09-16T00:00:00.000Z"),
        }),
        note({
          id: "note-2",
          noteReference: "NOTE-2",
          status: "FUNDING",
          fundingStatus: "FUNDED",
          fundedAmount: 100_000,
          targetAmount: 100_000,
        }),
        note({ id: "live", noteReference: "NOTE-L", status: "ACTIVE" }),
      ],
      now
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      noteId: "note-1",
      status: "open",
      percent: 40,
      daysLeft: 7,
    });
    expect(rows[1]).toMatchObject({ noteId: "note-2", status: "funded", percent: 100 });
  });

  it("includes pending listing and failed funding, and excludes live notes", () => {
    const now = new Date("2026-09-09T02:00:00.000Z");
    const rows = computeFundingProgress(
      [
        note({
          id: "pending",
          noteReference: "NOTE-P",
          status: "DRAFT",
          listingStatus: "NOT_LISTED",
          fundingStatus: "NOT_OPEN",
          fundedAmount: 0,
          targetAmount: 50_000,
        }),
        note({
          id: "failed",
          noteReference: "NOTE-F",
          status: "FAILED_FUNDING",
          fundingStatus: "FAILED",
          fundedAmount: 10_000,
          targetAmount: 80_000,
        }),
        note({ id: "live", noteReference: "NOTE-L", status: "ACTIVE" }),
        note({
          id: "repaid",
          noteReference: "NOTE-R",
          status: "REPAID",
          servicingStatus: "SETTLED",
        }),
      ],
      now
    );
    expect(rows.map((row) => row.noteId)).toEqual(["failed", "pending"]);
    expect(rows[0].status).toBe("failed");
    expect(rows[1].status).toBe("pending_listing");
  });
});

describe("computeOutstandingOverTime", () => {
  const now = new Date("2026-09-09T02:00:00.000Z");

  it("returns [] when fewer than two month-end points exist", () => {
    expect(
      computeOutstandingOverTime(
        [{ noteId: "a", snapshotDate: new Date("2026-08-31T00:00:00.000Z"), outstandingTotal: 10 }],
        50_000,
        now
      )
    ).toEqual([]);
  });

  it("sums the last snapshot in each month and repeats the current limit", () => {
    const points = computeOutstandingOverTime(
      [
        { noteId: "a", snapshotDate: new Date("2026-07-15T00:00:00.000Z"), outstandingTotal: 10 },
        { noteId: "a", snapshotDate: new Date("2026-07-31T00:00:00.000Z"), outstandingTotal: 8 },
        { noteId: "b", snapshotDate: new Date("2026-07-20T00:00:00.000Z"), outstandingTotal: 4 },
        { noteId: "a", snapshotDate: new Date("2026-08-31T00:00:00.000Z"), outstandingTotal: 5 },
        { noteId: "b", snapshotDate: new Date("2026-08-31T00:00:00.000Z"), outstandingTotal: 2 },
      ],
      50_000,
      now
    );
    expect(points).toEqual([
      { date: "2026-07-31", drawn: 12, limit: 50_000 },
      { date: "2026-08-31", drawn: 7, limit: 50_000 },
    ]);
  });

  it("uses a later zero snapshot in the same month after settlement", () => {
    const points = computeOutstandingOverTime(
      [
        { noteId: "a", snapshotDate: new Date("2026-07-09T00:00:00.000Z"), outstandingTotal: 10_000 },
        { noteId: "a", snapshotDate: new Date("2026-07-10T00:00:00.000Z"), outstandingTotal: 0 },
        { noteId: "b", snapshotDate: new Date("2026-08-31T00:00:00.000Z"), outstandingTotal: 4_000 },
      ],
      50_000,
      now
    );
    expect(points).toEqual([
      { date: "2026-07-31", drawn: 0, limit: 50_000 },
      { date: "2026-08-31", drawn: 4_000, limit: 50_000 },
    ]);
  });
});

describe("computeCostOfFinancingYtd", () => {
  it("sums live categories and annualizes against amount drawn this year", () => {
    const result = computeCostOfFinancingYtd({
      now: new Date("2026-09-09T02:00:00.000Z"),
      profitOnNotes: 100.004,
      drawdownFees: 20,
      facilityFees: 10,
      tawidh: 5,
      amountDrawnThisYear: 1_000,
    });
    expect(result).toEqual({
      year: 2026,
      total: 135,
      profitOnNotes: 100,
      drawdownFees: 20,
      facilityFees: 10,
      tawidh: 5,
      effectivePercent: 13.5,
    });
  });

  it("returns a null effective percent when nothing was drawn this year", () => {
    expect(
      computeCostOfFinancingYtd({
        now: new Date("2026-01-01T16:30:00.000Z"),
        profitOnNotes: 10,
        drawdownFees: 0,
        facilityFees: 0,
        tawidh: 0,
        amountDrawnThisYear: 0,
      }).effectivePercent
    ).toBeNull();
  });
});

describe("computeFacilityLimitSummary", () => {
  it("returns nulls when the issuer has no facilities", () => {
    expect(computeFacilityLimitSummary({ approved: [], available: [], drawn: [] })).toEqual({
      availableLimit: null,
      approvedLimit: null,
      drawnAmount: null,
      drawnPercent: null,
    });
  });

  it("sums approved, available, and drawn facility amounts", () => {
    expect(
      computeFacilityLimitSummary({
        approved: [100_000, 50_000],
        available: [40_000, 10_000],
        drawn: [60_000, 40_000],
      })
    ).toEqual({
      approvedLimit: 150_000,
      availableLimit: 50_000,
      drawnAmount: 100_000,
      drawnPercent: 66.67,
    });
  });
});

describe("buildIssuerDashboardBook", () => {
  it("assembles additive book fields from live notes and snapshots", () => {
    const now = new Date("2026-09-09T02:00:00.000Z");
    const book = buildIssuerDashboardBook({
      now,
      notes: [note({ profitRatePercent: 0 })],
      snapshots: [
        { noteId: "note-1", snapshotDate: new Date("2026-07-31T00:00:00.000Z"), outstandingTotal: 90_000 },
        { noteId: "note-1", snapshotDate: new Date("2026-08-31T00:00:00.000Z"), outstandingTotal: 80_000 },
      ],
      facility: computeFacilityLimitSummary({
        approved: [200_000],
        available: [100_000],
        drawn: [100_000],
      }),
      cost: {
        now,
        profitOnNotes: 0,
        drawdownFees: 0,
        facilityFees: 0,
        tawidh: 0,
        amountDrawnThisYear: 0,
      },
    });
    expect(book.liveNoteCount).toBe(1);
    expect(book.outstandingAmount).toBe(100_000);
    expect(book.outstandingOverTime).toHaveLength(2);
    expect(book.nextRepayment?.noteId).toBe("note-1");
    expect(book.approvedLimit).toBe(200_000);
  });
});
