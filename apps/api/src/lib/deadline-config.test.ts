import {
  assertOfferDeadlineReminderHourValid,
  computePhaseDeadlineExpiresAt,
  computeReminderFireAt,
  formatPhaseDeadlineAbsolute,
  formatPhaseDeadlineDateDDMMYYYY,
  isPhaseDeadlineExpired,
  mytCalendarDaysUntilDeadline,
} from "@cashsouk/types";

describe("MYT calendar phase deadlines", () => {
  it("expires at next-day midnight MYT after N calendar days", () => {
    expect(computePhaseDeadlineExpiresAt("2026-07-30T06:00:00.000Z", 7)).toBe(
      "2026-08-06T16:00:00.000Z"
    );
  });

  it("handles month rollover", () => {
    expect(computePhaseDeadlineExpiresAt("2026-01-28T10:00:00.000Z", 7)).toBe(
      "2026-02-04T16:00:00.000Z"
    );
  });

  it("formats inclusive deadline as 11:59 PM on the last valid day", () => {
    const expiresAt = computePhaseDeadlineExpiresAt("2026-07-30T06:00:00.000Z", 7);
    expect(formatPhaseDeadlineAbsolute(expiresAt)).toBe("06 Aug 2026, 11:59 PM");
    expect(formatPhaseDeadlineDateDDMMYYYY(expiresAt)).toBe("06/08/2026");
  });

  it("treats expiry as exclusive at midnight boundary", () => {
    const expiresAt = "2026-08-06T16:00:00.000Z";
    expect(isPhaseDeadlineExpired(expiresAt, new Date("2026-08-06T15:59:59.999Z"))).toBe(false);
    expect(isPhaseDeadlineExpired(expiresAt, new Date("2026-08-06T16:00:00.000Z"))).toBe(true);
  });

  it("fires reminders on calendar day offsets at the configured hour", () => {
    const expiresAt = computePhaseDeadlineExpiresAt("2026-07-30T06:00:00.000Z", 7);
    const fireAt = computeReminderFireAt(expiresAt, 1, 9);
    expect(fireAt.toISOString()).toBe("2026-08-05T01:00:00.000Z");
  });

  it("fires same-day reminder at the configured hour on the deadline date", () => {
    const expiresAt = computePhaseDeadlineExpiresAt("2026-07-30T06:00:00.000Z", 7);
    const fireAt = computeReminderFireAt(expiresAt, 0, 9);
    expect(fireAt.toISOString()).toBe("2026-08-06T01:00:00.000Z");
  });

  it("counts calendar days until the inclusive deadline date", () => {
    const expiresAt = computePhaseDeadlineExpiresAt("2026-07-22T06:00:00.000Z", 7);
    expect(mytCalendarDaysUntilDeadline(expiresAt, new Date("2026-07-22T06:00:00.000Z"))).toBe(7);
    expect(mytCalendarDaysUntilDeadline(expiresAt, new Date("2026-07-29T06:00:00.000Z"))).toBe(0);
  });

  it("validates platform reminder hour", () => {
    expect(() => assertOfferDeadlineReminderHourValid(9)).not.toThrow();
    expect(() => assertOfferDeadlineReminderHourValid(-1)).toThrow();
    expect(() => assertOfferDeadlineReminderHourValid(24)).toThrow();
    expect(() => assertOfferDeadlineReminderHourValid(9.5)).toThrow();
  });
});
