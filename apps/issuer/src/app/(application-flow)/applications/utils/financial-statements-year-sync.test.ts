import { getIssuerFinancialTabYears } from "@cashsouk/types";
import {
  financialStatementsContinueHint,
  resolveIssuerFinancialYearsToShow,
  reuseUnchangedYearForms,
} from "./financial-statements-year-sync";

describe("resolveIssuerFinancialYearsToShow", () => {
  const q = { financial_year_end: "2027-03-31" };
  const ref = new Date(2026, 8, 18);

  it("uses the live FYE window on the editable path and ignores stored form keys", () => {
    const years = resolveIssuerFinancialYearsToShow({
      readOnly: false,
      formsByYear: { "2020": {}, "2021": {} },
      questionnaire: q,
      ref,
    });
    expect(years).toEqual(getIssuerFinancialTabYears(q, ref));
    expect(years).not.toEqual([2020, 2021]);
  });

  it("returns stored form years when amendment keeps the submitted FYE", () => {
    expect(
      resolveIssuerFinancialYearsToShow({
        readOnly: false,
        preserveStoredYears: true,
        formsByYear: { "2026": {}, "2027": {} },
        questionnaire: q,
        ref,
      })
    ).toEqual([2026, 2027]);
  });

  it("returns stored form years in readOnly without live window validation", () => {
    expect(
      resolveIssuerFinancialYearsToShow({
        readOnly: true,
        formsByYear: { "2020": {}, "2021": {} },
        questionnaire: q,
        ref,
      })
    ).toEqual([2020, 2021]);
  });

  it("returns no editable years until a questionnaire is present", () => {
    expect(
      resolveIssuerFinancialYearsToShow({
        readOnly: false,
        formsByYear: { "2026": {} },
        questionnaire: null,
        ref,
      })
    ).toEqual([]);
  });
});

describe("reuseUnchangedYearForms", () => {
  it("returns the previous object when year keys and pldd/values are unchanged", () => {
    const prev = {
      "2026": { pldd: "2026-03-31", turnover: "1,000.00" },
      "2027": { pldd: "2027-03-31", turnover: "" },
    };
    const next = {
      "2026": { pldd: "2026-03-31", turnover: "1,000.00" },
      "2027": { pldd: "2027-03-31", turnover: "" },
    };
    expect(reuseUnchangedYearForms(prev, next)).toBe(prev);
  });

  it("returns the next object when pldd, values, or year keys change", () => {
    const prev = { "2026": { pldd: "2026-03-31", turnover: "1" } };
    const nextPldd = { "2026": { pldd: "2026-12-31", turnover: "1" } };
    const nextValue = { "2026": { pldd: "2026-03-31", turnover: "2" } };
    const nextYears = { "2027": { pldd: "2027-03-31", turnover: "1" } };
    expect(reuseUnchangedYearForms(prev, nextPldd)).toBe(nextPldd);
    expect(reuseUnchangedYearForms(prev, nextValue)).toBe(nextValue);
    expect(reuseUnchangedYearForms(prev, nextYears)).toBe(nextYears);
  });
});

describe("financialStatementsContinueHint", () => {
  it("names the first incomplete required year without listing fields", () => {
    expect(
      financialStatementsContinueHint({
        readOnly: false,
        nextFinancialYearEndComplete: false,
        firstIncompleteYear: undefined,
      })
    ).toBe("Complete the next financial year end");
    expect(
      financialStatementsContinueHint({
        readOnly: false,
        nextFinancialYearEndComplete: true,
        firstIncompleteYear: 2027,
      })
    ).toBe("Complete FY2027");
    expect(
      financialStatementsContinueHint({
        readOnly: false,
        nextFinancialYearEndComplete: true,
        firstIncompleteYear: undefined,
      })
    ).toBeNull();
    expect(
      financialStatementsContinueHint({
        readOnly: true,
        nextFinancialYearEndComplete: false,
        firstIncompleteYear: 2026,
      })
    ).toBeNull();
  });
});
