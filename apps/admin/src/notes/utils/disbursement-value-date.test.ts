import {
  defaultDisbursementValueDate,
  disbursementValueDateError,
  noteNeedsDisbursementValueDate,
} from "./disbursement-value-date";

describe("disbursement value date UI helpers", () => {
  it("requires the field only for tenure notes", () => {
    expect(noteNeedsDisbursementValueDate({ tenureDays: 90 })).toBe(true);
    expect(noteNeedsDisbursementValueDate({ tenureDays: null })).toBe(false);
    expect(noteNeedsDisbursementValueDate({})).toBe(false);
  });

  it("defaults to the Malaysia calendar today across the MY midnight boundary", () => {
    expect(defaultDisbursementValueDate(new Date("2026-08-23T16:00:00.000Z"))).toBe("2026-08-24");
    expect(defaultDisbursementValueDate(new Date("2026-08-23T15:59:59.000Z"))).toBe("2026-08-23");
  });

  it("surfaces a human-readable future-date error", () => {
    expect(disbursementValueDateError("2026-08-25", new Date("2026-08-23T16:00:00.000Z"))).toMatch(
      /cannot be in the future/
    );
    expect(disbursementValueDateError("2026-08-24", new Date("2026-08-23T16:00:00.000Z"))).toBeNull();
  });
});
