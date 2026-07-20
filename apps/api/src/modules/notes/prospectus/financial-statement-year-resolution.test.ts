/**
 * Shared Admin Financial Statements / Prospectus year-resolution tests.
 */

import {
  buildNormalizedFinancialStatementYearSet,
  findMissingSsmExpectedUnauditedYears,
  FINANCIAL_STATEMENT_SOURCE_FOOTER,
  formatMissingSsmUnauditedYearsOpsWarning,
  resolveFinancialStatementSourceFooter,
  selectLatestNormalizedFinancialStatementYears,
} from "@cashsouk/types";

function ctosRow(year: number, turnover: number) {
  return {
    financial_year: year,
    dates: { pldd: `${year}-12-31`, bsdd: null as null },
    account: { turnover, plnpat: 10, bsqpuc: 100, bscatot: 50, curlib: 25 },
  };
}

describe("financial-statement-year-resolution (Admin FS + Prospectus)", () => {
  it("combines CTOS and SSM unaudited years with CTOS precedence", () => {
    const years = buildNormalizedFinancialStatementYearSet({
      financialStatements: {
        questionnaire: { financial_year_end: "2025-12-31" },
        unaudited_by_year: {
          "2024": { turnover: 111 },
          "2025": { turnover: 222 },
        },
      },
      ctosFinancials: [ctosRow(2023, 1), ctosRow(2024, 999)],
      ref: new Date("2025-03-01T00:00:00.000Z"),
    });
    expect(years.map((y) => ({ year: y.year, source: y.recordSource }))).toEqual([
      { year: 2023, source: "ctos_audited" },
      { year: 2024, source: "ctos_audited" },
      { year: 2025, source: "unaudited_management" },
    ]);
    expect(years.find((y) => y.year === 2024)?.rawFinancials.turnover).toBe(999);
  });

  it("uses stable FYE ISO identifiers", () => {
    const years = buildNormalizedFinancialStatementYearSet({
      financialStatements: {
        questionnaire: { financial_year_end: "2025-06-30" },
        unaudited_by_year: { "2025": { turnover: 1 } },
      },
      ctosFinancials: [],
      ref: new Date("2025-01-15T00:00:00.000Z"),
    });
    expect(years.some((y) => y.year === 2025)).toBe(true);
    expect(years.find((y) => y.year === 2025)?.financialYearEndIso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("selects latest three ascending", () => {
    const available = buildNormalizedFinancialStatementYearSet({
      financialStatements: {
        questionnaire: { financial_year_end: "2027-12-31" },
        unaudited_by_year: {},
      },
      ctosFinancials: [ctosRow(2020, 1), ctosRow(2021, 2), ctosRow(2022, 3), ctosRow(2023, 4)],
    });
    expect(selectLatestNormalizedFinancialStatementYears(available, 3).map((y) => y.year)).toEqual(
      [2021, 2022, 2023]
    );
  });

  it("builds narrow source footers", () => {
    expect(
      resolveFinancialStatementSourceFooter([{ recordSource: "ctos_audited" }])
    ).toBe(FINANCIAL_STATEMENT_SOURCE_FOOTER.audited);
    expect(
      resolveFinancialStatementSourceFooter([{ recordSource: "unaudited_management" }])
    ).toBe(FINANCIAL_STATEMENT_SOURCE_FOOTER.management);
    expect(
      resolveFinancialStatementSourceFooter([
        { recordSource: "ctos_audited" },
        { recordSource: "unaudited_management" },
      ])
    ).toBe(FINANCIAL_STATEMENT_SOURCE_FOOTER.mixed);
    expect(resolveFinancialStatementSourceFooter([])).toBe(
      FINANCIAL_STATEMENT_SOURCE_FOOTER.neutral
    );
  });

  it("omits missing SSM-expected unaudited years and reports them for Ops", () => {
    // SSM expects FY2025 + FY2026 (before deadline). FY2026 has no stored block.
    const input = {
      financialStatements: {
        questionnaire: { financial_year_end: "2026-12-31" },
        unaudited_by_year: {
          "2025": { turnover: 500, plnpat: 50, pldd: "2025-12-31" },
        },
      },
      ctosFinancials: [ctosRow(2023, 1), ctosRow(2024, 2)],
      ref: new Date("2026-03-01T00:00:00.000Z"),
    };

    const available = buildNormalizedFinancialStatementYearSet(input);
    expect(available.map((y) => y.year)).toEqual([2023, 2024, 2025]);
    expect(available.map((y) => y.recordSource)).toEqual([
      "ctos_audited",
      "ctos_audited",
      "unaudited_management",
    ]);
    expect(selectLatestNormalizedFinancialStatementYears(available, 3).map((y) => y.year)).toEqual(
      [2023, 2024, 2025]
    );

    expect(findMissingSsmExpectedUnauditedYears(input)).toEqual([2026]);
    expect(formatMissingSsmUnauditedYearsOpsWarning([2026])).toContain("FY2026");
    expect(formatMissingSsmUnauditedYearsOpsWarning([2026])).toContain("does not block approval");
  });

  it("does not treat an empty unaudited block as actual data", () => {
    const years = buildNormalizedFinancialStatementYearSet({
      financialStatements: {
        questionnaire: { financial_year_end: "2025-12-31" },
        unaudited_by_year: {
          "2025": { pldd: "2025-12-31" },
        },
      },
      ctosFinancials: [ctosRow(2023, 1), ctosRow(2024, 2)],
      ref: new Date("2025-03-01T00:00:00.000Z"),
    });
    expect(years.map((y) => y.year)).toEqual([2023, 2024]);
    expect(
      findMissingSsmExpectedUnauditedYears({
        financialStatements: {
          questionnaire: { financial_year_end: "2025-12-31" },
          unaudited_by_year: { "2025": { pldd: "2025-12-31" } },
        },
        ctosFinancials: [ctosRow(2023, 1), ctosRow(2024, 2)],
        ref: new Date("2025-03-01T00:00:00.000Z"),
      })
    ).toEqual([2025]);
  });
});
