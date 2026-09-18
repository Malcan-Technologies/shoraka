import { addDays, format, startOfDay } from "date-fns";
import { FINANCIAL_YEAR_END_ERROR_MESSAGES } from "@cashsouk/types";
import {
  getApplicationFlowFinancialYearEndError,
  isFinancialYearEndDisplayDirtyAgainstSnapshot,
  newApplicationOrgPrefillFinancialYearEnd,
  storedFinancialFormYears,
} from "./application-flow-dates";

describe("getApplicationFlowFinancialYearEndError", () => {
  it("returns invalid for empty or unparseable display dates", () => {
    expect(getApplicationFlowFinancialYearEndError("")).toBe("invalid");
    expect(getApplicationFlowFinancialYearEndError("not-a-date")).toBe("invalid");
    expect(getApplicationFlowFinancialYearEndError("32/13/2026")).toBe("invalid");
  });

  it("returns not_future for today and earlier", () => {
    const today = format(startOfDay(new Date()), "d/M/yyyy");
    const yesterday = format(addDays(startOfDay(new Date()), -1), "d/M/yyyy");
    expect(getApplicationFlowFinancialYearEndError(today)).toBe("not_future");
    expect(getApplicationFlowFinancialYearEndError(yesterday)).toBe("not_future");
  });

  it("returns beyond_window for +400 days and accepts +120 days", () => {
    const far = format(addDays(startOfDay(new Date()), 400), "d/M/yyyy");
    const near = format(addDays(startOfDay(new Date()), 120), "d/M/yyyy");
    expect(getApplicationFlowFinancialYearEndError(far)).toBe("beyond_window");
    expect(getApplicationFlowFinancialYearEndError(near)).toBeNull();
  });

  it("maps codes to the shared messages used by the FYE field", () => {
    expect(FINANCIAL_YEAR_END_ERROR_MESSAGES.beyond_window).toBe(
      "Financial year end must be within the next 12 months."
    );
  });
});

describe("newApplicationOrgPrefillFinancialYearEnd", () => {
  const ref = new Date(2026, 8, 18);

  it("seeds a valid org FYE that is still inside the live window", () => {
    expect(
      newApplicationOrgPrefillFinancialYearEnd({ financial_year_end: "2027-03-31" }, ref)
    ).toBe("2027-03-31");
  });

  it("does not seed a past or beyond-window org FYE", () => {
    expect(
      newApplicationOrgPrefillFinancialYearEnd({ financial_year_end: "2026-06-30" }, ref)
    ).toBe("");
    expect(
      newApplicationOrgPrefillFinancialYearEnd({ financial_year_end: "2027-12-31" }, ref)
    ).toBe("");
  });
});

describe("storedFinancialFormYears", () => {
  it("returns numeric keys sorted oldest to newest and ignores non-year keys", () => {
    expect(storedFinancialFormYears({ "2027": {}, "2026": {}, extra: {} })).toEqual([2026, 2027]);
    expect(storedFinancialFormYears({})).toEqual([]);
    expect(storedFinancialFormYears(null)).toEqual([]);
  });
});

describe("isFinancialYearEndDisplayDirtyAgainstSnapshot", () => {
  const staleQ = { financial_year_end: "2027-12-31" };

  it("is clean when the displayed ISO matches the shape snapshot, even if the FYE is stale", () => {
    expect(isFinancialYearEndDisplayDirtyAgainstSnapshot("2027-12-31", staleQ)).toBe(false);
  });

  it("is dirty once the displayed ISO differs from the snapshot", () => {
    expect(isFinancialYearEndDisplayDirtyAgainstSnapshot("2027-06-30", staleQ)).toBe(true);
    expect(isFinancialYearEndDisplayDirtyAgainstSnapshot(null, staleQ)).toBe(true);
  });

  it("treats an empty snapshot FYE as clean only when the display ISO is also empty", () => {
    expect(isFinancialYearEndDisplayDirtyAgainstSnapshot(null, { financial_year_end: "" })).toBe(false);
    expect(isFinancialYearEndDisplayDirtyAgainstSnapshot("2027-12-31", { financial_year_end: "" })).toBe(
      true
    );
  });
});
