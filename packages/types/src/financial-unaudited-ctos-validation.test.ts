import { addDays, format } from "date-fns";
import {
  formatFinancialFyPeriodDisplay,
  getFinancialYearEndAllowedWindow,
  getFinancialYearEndValidationError,
  isFinancialYearPeriodOpen,
} from "./financial-unaudited-ctos-validation";

function parseIsoLocal(iso: string): Date {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7)) - 1;
  const d = Number(iso.slice(8, 10));
  return new Date(y, m, d);
}

function assertWindowMatchesValidation(ref: Date) {
  const { minIso, maxIso } = getFinancialYearEndAllowedWindow(ref);
  expect(getFinancialYearEndValidationError(minIso, ref)).toBeNull();
  expect(getFinancialYearEndValidationError(maxIso, ref)).toBeNull();
  const dayAfterMax = format(addDays(parseIsoLocal(maxIso), 1), "yyyy-MM-dd");
  expect(getFinancialYearEndValidationError(dayAfterMax, ref)).not.toBeNull();
  const dayBeforeMin = format(addDays(parseIsoLocal(minIso), -1), "yyyy-MM-dd");
  expect(getFinancialYearEndValidationError(dayBeforeMin, ref)).toBe("not_future");
}

describe("getFinancialYearEndAllowedWindow", () => {
  it("keeps ordinary Sep 2026 bounds (tomorrow through last started period)", () => {
    const ref = new Date(2026, 8, 18);
    expect(getFinancialYearEndAllowedWindow(ref)).toEqual({
      minIso: "2026-09-19",
      maxIso: "2027-09-17",
    });
    assertWindowMatchesValidation(ref);
  });

  it("uses 2028-02-29 as max when ref is 2027-03-01 (leap day accepted by validation)", () => {
    const ref = new Date(2027, 2, 1);
    expect(getFinancialYearEndAllowedWindow(ref)).toEqual({
      minIso: "2027-03-02",
      maxIso: "2028-02-29",
    });
    expect(getFinancialYearEndValidationError("2028-02-29", ref)).toBeNull();
    expect(getFinancialYearEndValidationError("2028-03-01", ref)).toBe("beyond_window");
    assertWindowMatchesValidation(ref);
  });

  it("does not extend onto 2028-02-29 when ref is 2027-02-28", () => {
    const ref = new Date(2027, 1, 28);
    expect(getFinancialYearEndAllowedWindow(ref)).toEqual({
      minIso: "2027-03-01",
      maxIso: "2028-02-27",
    });
    expect(getFinancialYearEndValidationError("2028-02-29", ref)).toBe("beyond_window");
    assertWindowMatchesValidation(ref);
  });

  it("clips the day after a leap-day ref to 2029-02-28", () => {
    const ref = new Date(2028, 1, 29);
    expect(getFinancialYearEndAllowedWindow(ref)).toEqual({
      minIso: "2028-03-01",
      maxIso: "2029-02-28",
    });
    assertWindowMatchesValidation(ref);
  });
});

describe("formatFinancialFyPeriodDisplay", () => {
  const q = { financial_year_end: "2027-05-31" };
  const ref = new Date(2026, 8, 18);

  it("shows the full closed year and clamps an in-progress year to as-at", () => {
    expect(isFinancialYearPeriodOpen(q, 2026, ref)).toBe(false);
    expect(formatFinancialFyPeriodDisplay(q, 2026)).toBe("1 Jun 2025 – 31 May 2026");
    expect(formatFinancialFyPeriodDisplay(q, 2026, { clampEndTo: ref })).toBe("1 Jun 2025 – 31 May 2026");
    expect(isFinancialYearPeriodOpen(q, 2027, ref)).toBe(true);
    expect(formatFinancialFyPeriodDisplay(q, 2027)).toBe("1 Jun 2026 – 31 May 2027");
    expect(formatFinancialFyPeriodDisplay(q, 2027, { clampEndTo: ref })).toBe("1 Jun 2026 – 18 Sep 2026");
  });

  it("does not clamp an unstarted year (avoids reversed 1 Jan 2027 – 18 Sep 2026)", () => {
    const beyondWindowQ = { financial_year_end: "2027-12-31" };
    expect(isFinancialYearPeriodOpen(beyondWindowQ, 2027, ref)).toBe(false);
    expect(formatFinancialFyPeriodDisplay(beyondWindowQ, 2027)).toBe("1 Jan 2027 – 31 Dec 2027");
    expect(formatFinancialFyPeriodDisplay(beyondWindowQ, 2027, { clampEndTo: ref })).toBe(
      "1 Jan 2027 – 31 Dec 2027"
    );
  });
});
