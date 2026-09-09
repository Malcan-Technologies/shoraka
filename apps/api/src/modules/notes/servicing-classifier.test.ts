import { DpdBucket, NoteServicingStatus, NoteStatus } from "@prisma/client";
import {
  calendarDateInTimeZone,
  calendarDaysBetween,
  classifyServicing,
  dpdBucketFromDays,
  shouldAdvanceServicing,
} from "./servicing-classifier";

function note(overrides: Partial<Parameters<typeof classifyServicing>[0]> = {}) {
  return {
    servicing_status: NoteServicingStatus.CURRENT,
    status: NoteStatus.ACTIVE,
    grace_period_days: 7,
    arrears_threshold_days: 14,
    tawidh_rate_cap_percent: 1,
    gharamah_rate_cap_percent: 9,
    due_date: new Date("2026-01-01T00:00:00.000Z"),
    receipt_amount: 100_000,
    applied_tawidh_amount: 0,
    applied_gharamah_amount: 0,
    waived_tawidh_amount: 0,
    waived_gharamah_amount: 0,
    ...overrides,
  };
}

describe("dpdBucketFromDays", () => {
  it("maps buckets", () => {
    expect(dpdBucketFromDays(0)).toBe(DpdBucket.CURRENT);
    expect(dpdBucketFromDays(1)).toBe(DpdBucket.DPD_1_30);
    expect(dpdBucketFromDays(30)).toBe(DpdBucket.DPD_1_30);
    expect(dpdBucketFromDays(31)).toBe(DpdBucket.DPD_31_60);
    expect(dpdBucketFromDays(61)).toBe(DpdBucket.DPD_61_90);
    expect(dpdBucketFromDays(91)).toBe(DpdBucket.DPD_90_PLUS);
  });
});

describe("shouldAdvanceServicing", () => {
  it("never downgrades or touches terminal states", () => {
    expect(
      shouldAdvanceServicing(NoteServicingStatus.LATE, NoteServicingStatus.OVERDUE)
    ).toBe(false);
    expect(
      shouldAdvanceServicing(NoteServicingStatus.ARREARS, NoteServicingStatus.LATE)
    ).toBe(false);
    expect(
      shouldAdvanceServicing(NoteServicingStatus.DEFAULTED, NoteServicingStatus.ARREARS)
    ).toBe(false);
    expect(
      shouldAdvanceServicing(NoteServicingStatus.SETTLED, NoteServicingStatus.CURRENT)
    ).toBe(false);
  });

  it("advances CURRENT → OVERDUE → LATE → ARREARS", () => {
    expect(
      shouldAdvanceServicing(NoteServicingStatus.CURRENT, NoteServicingStatus.OVERDUE)
    ).toBe(true);
    expect(
      shouldAdvanceServicing(NoteServicingStatus.OVERDUE, NoteServicingStatus.LATE)
    ).toBe(true);
    expect(
      shouldAdvanceServicing(NoteServicingStatus.LATE, NoteServicingStatus.ARREARS)
    ).toBe(true);
    expect(
      shouldAdvanceServicing(NoteServicingStatus.PARTIAL, NoteServicingStatus.OVERDUE)
    ).toBe(true);
  });
});

describe("classifyServicing", () => {
  it("stays CURRENT on the due date", () => {
    const result = classifyServicing(note(), new Date("2026-01-01T00:00:00.000Z"));
    expect(result.servicingStatus).toBe(NoteServicingStatus.CURRENT);
    expect(result.daysPastDue).toBe(0);
    expect(result.daysUntilDue).toBe(0);
    expect(result.indicativeTawidhAmount).toBe(0);
  });

  it("is OVERDUE on day 1 past due inside grace", () => {
    const result = classifyServicing(note(), new Date("2026-01-02T00:00:00.000Z"));
    expect(result.servicingStatus).toBe(NoteServicingStatus.OVERDUE);
    expect(result.daysPastDue).toBe(1);
    expect(result.daysAfterGrace).toBe(0);
    expect(result.noteStatus).toBeNull();
  });

  it("stays OVERDUE on the last grace day", () => {
    const result = classifyServicing(note(), new Date("2026-01-08T00:00:00.000Z"));
    expect(result.servicingStatus).toBe(NoteServicingStatus.OVERDUE);
    expect(result.daysPastDue).toBe(7);
    expect(result.daysAfterGrace).toBe(0);
  });

  it("is LATE the day after grace ends", () => {
    const result = classifyServicing(note(), new Date("2026-01-09T00:00:00.000Z"));
    expect(result.servicingStatus).toBe(NoteServicingStatus.LATE);
    expect(result.daysAfterGrace).toBe(1);
    expect(result.indicativeTawidhAmount).toBeGreaterThan(0);
  });

  it("is ARREARS once daysAfterGrace reaches the threshold", () => {
    const result = classifyServicing(note(), new Date("2026-01-22T00:00:00.000Z"));
    expect(result.servicingStatus).toBe(NoteServicingStatus.ARREARS);
    expect(result.daysAfterGrace).toBe(14);
    expect(result.noteStatus).toBe(NoteStatus.ARREARS);
  });

  it("marks SC default after 90 DPD", () => {
    const result = classifyServicing(note(), new Date("2026-04-02T00:00:00.000Z"));
    expect(result.daysPastDue).toBe(91);
    expect(result.isScDefault).toBe(true);
    expect(result.dpdBucket).toBe(DpdBucket.DPD_90_PLUS);
  });

  it("subtracts applied and waived amounts from indicative caps", () => {
    const uncapped = classifyServicing(note(), new Date("2026-01-09T00:00:00.000Z"));
    const capped = classifyServicing(
      note({
        applied_tawidh_amount: uncapped.indicativeTawidhAmount,
        waived_gharamah_amount: uncapped.indicativeGharamahAmount,
      }),
      new Date("2026-01-09T00:00:00.000Z")
    );
    expect(capped.indicativeTawidhAmount).toBe(0);
    expect(capped.indicativeGharamahAmount).toBe(0);
  });

  it("returns CURRENT with no due date", () => {
    const result = classifyServicing(note({ due_date: null }), new Date("2026-01-09T00:00:00.000Z"));
    expect(result.servicingStatus).toBe(NoteServicingStatus.CURRENT);
    expect(result.dueDate).toBeNull();
    expect(result.daysUntilDue).toBeNull();
  });

  it("reports T-7 and T-1 days until due", () => {
    expect(classifyServicing(note(), new Date("2025-12-25T00:00:00.000Z")).daysUntilDue).toBe(7);
    expect(classifyServicing(note(), new Date("2025-12-31T00:00:00.000Z")).daysUntilDue).toBe(1);
  });

  it("uses the Malaysia calendar date when the UTC clock is still the previous day", () => {
    const justAfterMidnightMyt = new Date("2026-01-01T16:30:00.000Z");
    const result = classifyServicing(note(), justAfterMidnightMyt);
    expect(result.servicingStatus).toBe(NoteServicingStatus.OVERDUE);
    expect(result.daysPastDue).toBe(1);
  });

  it("rounds indicative Ta'widh and Gharamah to two decimals", () => {
    const result = classifyServicing(note(), new Date("2026-01-09T00:00:00.000Z"));
    expect(result.indicativeTawidhAmount).toBe(2.74);
    expect(result.indicativeGharamahAmount).toBe(24.66);
  });
});

describe("calendarDateInTimeZone", () => {
  it("uses the MYT calendar date", () => {
    const justAfterMidnightMyt = new Date("2026-01-01T16:30:00.000Z");
    expect(calendarDateInTimeZone(justAfterMidnightMyt).toISOString()).toBe(
      "2026-01-02T00:00:00.000Z"
    );
  });
});

describe("calendarDaysBetween", () => {
  it("counts Malaysia calendar days, not UTC midnight deltas", () => {
    const markedAfternoonMyt = new Date("2026-09-07T02:00:00.000Z");
    const asOf = new Date("2026-09-09T00:00:00.000Z");
    expect(calendarDaysBetween(markedAfternoonMyt, asOf)).toBe(2);
  });
});
