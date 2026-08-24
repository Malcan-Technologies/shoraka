import {
  defaultActualSettlementYmd,
  malaysiaCalendarYmdFromInstant,
  resolveDefaultActualSettlementYmd,
  validateActualSettlementDate,
} from "./actual-settlement-date";

describe("validateActualSettlementDate", () => {
  const now = new Date("2026-08-23T16:00:00.000Z");

  it("accepts today in Malaysia and stores UTC midnight", () => {
    expect(validateActualSettlementDate("2026-08-24", { now })).toEqual({
      ok: true,
      ymd: "2026-08-24",
      date: new Date("2026-08-24T00:00:00.000Z"),
    });
  });

  it("rejects future, malformed, and impossible dates", () => {
    expect(validateActualSettlementDate("2026-08-25", { now }).message).toMatch(
      /cannot be in the future/
    );
    expect(validateActualSettlementDate("24/08/2026", { now }).message).toMatch(/yyyy-MM-dd/);
    expect(validateActualSettlementDate("2026-02-31", { now }).message).toMatch(
      /not a valid calendar date/
    );
    expect(validateActualSettlementDate("", { now }).message).toMatch(/required/);
  });

  it("rejects dates before disbursement or before the latest included receipt", () => {
    expect(
      validateActualSettlementDate("2026-08-19", {
        now,
        disbursementDate: "2026-08-20T00:00:00.000Z",
      }).message
    ).toMatch(/cannot be before the disbursement date/);
    expect(
      validateActualSettlementDate("2026-08-21", {
        now,
        latestIncludedReceiptDate: "2026-08-22T00:00:00.000Z",
      }).message
    ).toMatch(/cannot be earlier than the latest included receipt/);
  });

  it("accepts the same or later date than the latest included receipt", () => {
    expect(
      validateActualSettlementDate("2026-08-22", {
        now,
        disbursementDate: "2026-08-20T00:00:00.000Z",
        latestIncludedReceiptDate: "2026-08-22T00:00:00.000Z",
      }).ok
    ).toBe(true);
    expect(
      validateActualSettlementDate("2026-08-24", {
        now,
        latestIncludedReceiptDate: "2026-08-22T00:00:00.000Z",
      }).ok
    ).toBe(true);
  });
});

describe("malaysiaCalendarYmdFromInstant", () => {
  it("keeps UTC-midnight dates on the stored calendar day", () => {
    expect(malaysiaCalendarYmdFromInstant(new Date("2026-08-20T00:00:00.000Z"))).toBe("2026-08-20");
  });
});

describe("resolveDefaultActualSettlementYmd", () => {
  const now = new Date("2026-08-23T16:00:00.000Z");

  it("defaults to Malaysia today when no receipts exist", () => {
    expect(resolveDefaultActualSettlementYmd(null, now)).toBe("2026-08-24");
    expect(defaultActualSettlementYmd(null, now)).toBe("2026-08-24");
  });

  it("defaults to the latest included receipt when that date is not in the future", () => {
    expect(resolveDefaultActualSettlementYmd("2026-08-22T00:00:00.000Z", now)).toBe("2026-08-22");
  });
});
