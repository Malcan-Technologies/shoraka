import {
  FINANCING_TENURE_DAYS_OPTIONS,
  FINANCING_TENURE_MAX_DAYS,
  FINANCING_TENURE_MIN_DAYS,
  FINANCING_TENURE_STEP_DAYS,
  formatFinancingTenureDaysLabel,
  formatFinancingTenureFromDisbursement,
  isValidFinancingTenureDays,
  malaysiaCalendarDaysRemaining,
  parseFinancingTenureDays,
  parseMalaysiaCalendarDate,
  resolveFinancingTenureDays,
  smallestFinancingTenureDaysCovering,
  validateFinancingTenureAgainstDueDate,
} from "./financing-tenure";

describe("financing tenure options", () => {
  it("lists 30 through 180 inclusive in 15-day steps without duplicates", () => {
    expect(FINANCING_TENURE_DAYS_OPTIONS[0]).toBe(FINANCING_TENURE_MIN_DAYS);
    expect(FINANCING_TENURE_DAYS_OPTIONS.at(-1)).toBe(FINANCING_TENURE_MAX_DAYS);
    expect(FINANCING_TENURE_DAYS_OPTIONS).toEqual([
      30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180,
    ]);
    expect(new Set(FINANCING_TENURE_DAYS_OPTIONS).size).toBe(
      FINANCING_TENURE_DAYS_OPTIONS.length
    );
    expect(
      FINANCING_TENURE_DAYS_OPTIONS.every(
        (days, index, all) =>
          index === 0 || days - all[index - 1] === FINANCING_TENURE_STEP_DAYS
      )
    ).toBe(true);
  });

  it("accepts only integers on the published step range", () => {
    expect(isValidFinancingTenureDays(90)).toBe(true);
    expect(isValidFinancingTenureDays(30)).toBe(true);
    expect(isValidFinancingTenureDays(180)).toBe(true);
    expect(isValidFinancingTenureDays(29)).toBe(false);
    expect(isValidFinancingTenureDays(181)).toBe(false);
    expect(isValidFinancingTenureDays(40)).toBe(false);
    expect(isValidFinancingTenureDays(90.5)).toBe(false);
  });
});

describe("malaysia calendar days remaining", () => {
  it("counts calendar days from an application date to a yyyy-MM-dd due date", () => {
    expect(malaysiaCalendarDaysRemaining("2026-08-24", "2026-11-22")).toBe(90);
    expect(malaysiaCalendarDaysRemaining("2026-08-24", "2026-08-24")).toBe(0);
    expect(malaysiaCalendarDaysRemaining("2026-08-24", "2026-08-25")).toBe(1);
  });

  it("treats d/M/yyyy as the same Malaysia calendar date", () => {
    expect(malaysiaCalendarDaysRemaining("24/8/2026", "22/11/2026")).toBe(90);
    expect(parseMalaysiaCalendarDate("24/8/2026")).toEqual({
      year: 2026,
      month: 8,
      day: 24,
    });
  });

  it("uses Malaysia calendar parts for Date instants near midnight UTC", () => {
    // 2026-08-23T16:00:00.000Z is 24 Aug 2026 00:00 MYT.
    const applicationInstant = new Date("2026-08-23T16:00:00.000Z");
    expect(malaysiaCalendarDaysRemaining(applicationInstant, "2026-11-22")).toBe(90);
  });

  it("rejects impossible calendar dates", () => {
    expect(parseMalaysiaCalendarDate("2026-02-31")).toBeNull();
    expect(malaysiaCalendarDaysRemaining("2026-08-24", "2026-02-31")).toBeNull();
  });
});

describe("validateFinancingTenureAgainstDueDate", () => {
  const referenceDate = new Date("2026-08-24T02:00:00.000Z");

  it("accepts a published option that covers the due-date interval", () => {
    expect(
      validateFinancingTenureAgainstDueDate({
        tenureDays: 90,
        maturityDate: "2026-11-22",
        referenceDate,
      })
    ).toEqual({ ok: true, tenureDays: 90, daysRemaining: 90 });
    expect(
      validateFinancingTenureAgainstDueDate({
        tenureDays: 105,
        maturityDate: "2026-11-22",
        referenceDate,
      }).ok
    ).toBe(true);
  });

  it("accepts boundary options 30 and 180 when they cover remaining days", () => {
    expect(
      validateFinancingTenureAgainstDueDate({
        tenureDays: 30,
        maturityDate: "2026-09-23",
        referenceDate,
      }).ok
    ).toBe(true);
    expect(
      validateFinancingTenureAgainstDueDate({
        tenureDays: 180,
        maturityDate: "2027-02-20",
        referenceDate,
      }).ok
    ).toBe(true);
  });

  it("rejects a missing tenure, invalid step, and tenure shorter than remaining days", () => {
    expect(
      validateFinancingTenureAgainstDueDate({
        tenureDays: undefined,
        maturityDate: "2026-11-22",
        referenceDate,
      })
    ).toEqual({ ok: false, message: "Financing tenure is required." });
    expect(
      validateFinancingTenureAgainstDueDate({
        tenureDays: 40,
        maturityDate: "2026-11-22",
        referenceDate,
      }).message
    ).toMatch(/15-day steps/);
    expect(
      validateFinancingTenureAgainstDueDate({
        tenureDays: 75,
        maturityDate: "2026-11-22",
        referenceDate,
      }).message
    ).toBe(
      "Financing tenure must be at least 90 days to cover the time until the invoice due date."
    );
  });

  it("rejects a due date beyond the maximum published tenure", () => {
    expect(
      validateFinancingTenureAgainstDueDate({
        tenureDays: 180,
        maturityDate: "2027-03-01",
        referenceDate,
      }).message
    ).toMatch(/more than 180 days away/);
  });

  it("rejects a past due date and accepts today and a future due date", () => {
    expect(
      validateFinancingTenureAgainstDueDate({
        tenureDays: 30,
        maturityDate: "2026-08-23",
        referenceDate,
      })
    ).toEqual({
      ok: false,
      message: "Invoice due date cannot be in the past.",
    });
    expect(
      validateFinancingTenureAgainstDueDate({
        tenureDays: 30,
        maturityDate: "2026-08-24",
        referenceDate,
      })
    ).toEqual({ ok: true, tenureDays: 30, daysRemaining: 0 });
    expect(
      validateFinancingTenureAgainstDueDate({
        tenureDays: 30,
        maturityDate: "2026-08-25",
        referenceDate,
      })
    ).toEqual({ ok: true, tenureDays: 30, daysRemaining: 1 });
  });
});

describe("financing tenure display and resolvers", () => {
  it("formats selected and frozen offer copy", () => {
    expect(formatFinancingTenureDaysLabel(90)).toBe("90 days");
    expect(formatFinancingTenureFromDisbursement(90)).toBe("90 days from disbursement");
  });

  it("prefers offer tenure over invoice-requested tenure", () => {
    expect(
      resolveFinancingTenureDays(
        { financing_tenure_days: 105 },
        { financing_tenure_days: 90 }
      )
    ).toBe(105);
    expect(resolveFinancingTenureDays(null, { financing_tenure_days: 90 })).toBe(90);
    expect(resolveFinancingTenureDays({ financing_tenure_days: 40 }, { financing_tenure_days: 90 })).toBe(
      90
    );
  });

  it("picks the smallest covering option and parses numeric strings", () => {
    expect(smallestFinancingTenureDaysCovering(1)).toBe(30);
    expect(smallestFinancingTenureDaysCovering(90)).toBe(90);
    expect(smallestFinancingTenureDaysCovering(91)).toBe(105);
    expect(smallestFinancingTenureDaysCovering(181)).toBeNull();
    expect(parseFinancingTenureDays("90")).toBe(90);
    expect(parseFinancingTenureDays("90.5")).toBeNull();
  });
});
