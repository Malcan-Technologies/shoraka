import {
  actualSettlementDateError,
  defaultActualSettlementDate,
  noteNeedsActualSettlementDate,
} from "./actual-settlement-date";

describe("actual settlement date UI helpers", () => {
  const now = new Date("2026-08-23T16:00:00.000Z");

  it("requires the field only for tenure notes", () => {
    expect(noteNeedsActualSettlementDate({ tenureDays: 90 })).toBe(true);
    expect(noteNeedsActualSettlementDate({ tenureDays: null })).toBe(false);
    expect(noteNeedsActualSettlementDate({})).toBe(false);
  });

  it("defaults to Malaysia today, or the latest included receipt when earlier", () => {
    expect(defaultActualSettlementDate(null, now)).toBe("2026-08-24");
    expect(defaultActualSettlementDate("2026-08-22T00:00:00.000Z", now)).toBe("2026-08-22");
  });

  it("rejects future dates and dates before disbursement or the latest receipt", () => {
    expect(actualSettlementDateError("2026-08-25", { now })).toMatch(/cannot be in the future/);
    expect(
      actualSettlementDateError("2026-08-19", {
        now,
        disbursementDate: "2026-08-20T00:00:00.000Z",
      })
    ).toMatch(/cannot be before the disbursement date/);
    expect(
      actualSettlementDateError("2026-08-21", {
        now,
        latestIncludedReceiptDate: "2026-08-22T00:00:00.000Z",
      })
    ).toMatch(/cannot be earlier than the latest included receipt/);
    expect(
      actualSettlementDateError("2026-08-24", {
        now,
        disbursementDate: "2026-08-20T00:00:00.000Z",
        latestIncludedReceiptDate: "2026-08-22T00:00:00.000Z",
      })
    ).toBeNull();
  });
});
