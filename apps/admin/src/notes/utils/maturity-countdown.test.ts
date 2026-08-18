import {
  calendarDaysUntilMaturity,
  formatMaturityCountdown,
  formatPaymentDueHint,
  isActiveNearMaturity,
  isNoteInArrears,
  maturityCountdownClass,
  NEAR_MATURITY_DAYS,
} from "./maturity-countdown";

const NOW = new Date(2026, 7, 18, 15, 30, 0);

function isoDaysFromNow(days: number): string {
  return new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + days, 12, 0, 0).toISOString();
}

describe("maturity countdown", () => {
  it("returns signed local calendar days until maturity", () => {
    expect(calendarDaysUntilMaturity(isoDaysFromNow(12), NOW)).toBe(12);
    expect(calendarDaysUntilMaturity(isoDaysFromNow(0), NOW)).toBe(0);
    expect(calendarDaysUntilMaturity(isoDaysFromNow(-5), NOW)).toBe(-5);
  });

  it("returns null for missing or invalid dates", () => {
    expect(calendarDaysUntilMaturity(null, NOW)).toBeNull();
    expect(calendarDaysUntilMaturity("not-a-date", NOW)).toBeNull();
  });

  it("formats upcoming, today, and past maturity", () => {
    expect(formatMaturityCountdown(isoDaysFromNow(12), NOW)).toBe("in 12 days");
    expect(formatMaturityCountdown(isoDaysFromNow(1), NOW)).toBe("in 1 day");
    expect(formatMaturityCountdown(isoDaysFromNow(0), NOW)).toBe("today");
    expect(formatMaturityCountdown(isoDaysFromNow(-1), NOW)).toBe("1 day ago");
    expect(formatMaturityCountdown(isoDaysFromNow(-5), NOW)).toBe("5 days ago");
  });

  it("formats payment-due header hints", () => {
    expect(formatPaymentDueHint(isoDaysFromNow(12), NOW)).toBe("Due in 12 days");
    expect(formatPaymentDueHint(isoDaysFromNow(1), NOW)).toBe("Due in 1 day");
    expect(formatPaymentDueHint(isoDaysFromNow(0), NOW)).toBe("Due today");
    expect(formatPaymentDueHint(isoDaysFromNow(-1), NOW)).toBe("Overdue by 1 day");
    expect(formatPaymentDueHint(isoDaysFromNow(-5), NOW)).toBe("Overdue by 5 days");
    expect(formatPaymentDueHint(null, NOW)).toBeNull();
  });

  it("colours past due red and near maturity yellow, including the date", () => {
    expect(maturityCountdownClass(NEAR_MATURITY_DAYS + 1)).toBe("text-muted-foreground");
    expect(maturityCountdownClass(NEAR_MATURITY_DAYS + 1, { variant: "date" })).toBe("");
    expect(maturityCountdownClass(NEAR_MATURITY_DAYS)).toBe("text-status-action-text");
    expect(maturityCountdownClass(NEAR_MATURITY_DAYS, { variant: "date" })).toBe(
      "text-status-action-text"
    );
    expect(maturityCountdownClass(0)).toBe("text-status-action-text");
    expect(maturityCountdownClass(-1)).toBe("text-status-rejected-text");
    expect(maturityCountdownClass(-1, { variant: "date" })).toBe("text-status-rejected-text");
    expect(maturityCountdownClass(-1, { highlight: false, variant: "date" })).toBe("");
    expect(maturityCountdownClass(-1, { highlight: false })).toBe("text-muted-foreground");
    expect(maturityCountdownClass(null)).toBe("text-muted-foreground");
    expect(maturityCountdownClass(-1, { settled: true, variant: "date" })).toBe(
      "text-status-success-text"
    );
    expect(maturityCountdownClass(5, { settled: true })).toBe("text-status-success-text");
  });

  it("flags arrears and active notes at or within 30 days of maturity", () => {
    expect(isNoteInArrears({ status: "ARREARS", servicingStatus: "CURRENT" })).toBe(true);
    expect(isNoteInArrears({ status: "ACTIVE", servicingStatus: "ARREARS" })).toBe(true);
    expect(isNoteInArrears({ status: "ACTIVE", servicingStatus: "CURRENT" })).toBe(false);

    expect(
      isActiveNearMaturity({ status: "ACTIVE", maturityDate: isoDaysFromNow(30) }, NOW)
    ).toBe(true);
    expect(
      isActiveNearMaturity({ status: "ACTIVE", maturityDate: isoDaysFromNow(-2) }, NOW)
    ).toBe(true);
    expect(
      isActiveNearMaturity({ status: "ACTIVE", maturityDate: isoDaysFromNow(31) }, NOW)
    ).toBe(false);
    expect(
      isActiveNearMaturity({ status: "PUBLISHED", maturityDate: isoDaysFromNow(5) }, NOW)
    ).toBe(false);
  });
});
