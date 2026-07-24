import { readFileSync } from "node:fs";
import { join } from "node:path";
import { financialSourceFromYearBlocks } from "./prospectus-financial-comparison-test-helpers";
import { buildProspectusPageThreeBalanceSheet } from "./prospectus-page-three-balance-sheet";
import { PROSPECTUS_PAGE_THREE_BALANCE_SHEET_ROW_KEYS } from "./prospectus-page-three-balance-sheet.types";
import { buildProspectusPageThreeCoverageEfficiency } from "./prospectus-page-three-coverage-efficiency";
import { PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_ROW_KEYS } from "./prospectus-page-three-coverage-efficiency.types";
import { buildProspectusPageThreeIncomeStatement } from "./prospectus-page-three-income-statement";
import { PROSPECTUS_PAGE_THREE_INCOME_STATEMENT_ROW_KEYS } from "./prospectus-page-three-income-statement.types";
import { buildProspectusPageThreeTrends } from "./prospectus-page-three-trends";
import { SAMPLE_PROSPECTUS_PAGE_THREE_TRENDS_INPUT } from "./prospectus-page-three-trends.sample-data";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_PAGE_THREE_TREND_METRIC_KEYS,
  PROSPECTUS_PAGE_THREE_TRENDS_AUDIT,
  PROSPECTUS_PAGE_THREE_TRENDS_SECTION_HEADING,
} from "./prospectus-page-three-trends.types";
import { buildProspectusPageThreeTrendsDocument } from "./render-prospectus-page-three-trends";

function composeFromYears(years: Record<string, Record<string, unknown>>) {
  const financialSource = financialSourceFromYearBlocks(years, {
    financialYearEnd: "2024-12-31",
  });
  return {
    incomeStatement: buildProspectusPageThreeIncomeStatement({ financialSource }),
    balanceSheet: buildProspectusPageThreeBalanceSheet({ financialSource }),
    coverageEfficiency: buildProspectusPageThreeCoverageEfficiency({ financialSource }),
  };
}

describe("prospectus Page 3 trends (DATA STAGE 5)", () => {
  it("uses static FINANCIAL TRENDS heading", () => {
    const data = buildProspectusPageThreeTrends(SAMPLE_PROSPECTUS_PAGE_THREE_TRENDS_INPUT);
    expect(data.sectionHeading).toBe("FINANCIAL TRENDS");
    expect(data.sectionHeading).toBe(PROSPECTUS_PAGE_THREE_TRENDS_SECTION_HEADING);
  });

  it("includes every Stage 2–4 metric once in section order", () => {
    const data = buildProspectusPageThreeTrends(SAMPLE_PROSPECTUS_PAGE_THREE_TRENDS_INPUT);
    const keys = data.trends.map((t) => t.metricKey);
    expect(keys).toEqual([...PROSPECTUS_PAGE_THREE_TREND_METRIC_KEYS]);
    expect(keys.slice(0, 7)).toEqual([...PROSPECTUS_PAGE_THREE_INCOME_STATEMENT_ROW_KEYS]);
    expect(keys.slice(7, 16)).toEqual([...PROSPECTUS_PAGE_THREE_BALANCE_SHEET_ROW_KEYS]);
    expect(keys.slice(16)).toEqual([...PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_ROW_KEYS]);
    expect(keys).toHaveLength(26);
    expect(new Set(keys).size).toBe(26);
  });

  it("keeps every visible trend and interpretation as —", () => {
    const data = buildProspectusPageThreeTrends(SAMPLE_PROSPECTUS_PAGE_THREE_TRENDS_INPUT);
    for (const item of data.trends) {
      expect(item.trend).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
      expect(item.trend).toBe("—");
      expect(item.interpretation).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
      expect(item.direction).toBeNull();
      expect(item.approved).toBe(false);
    }
  });

  it("does not generate arrows, directional colours, or movement wording", () => {
    const html = buildProspectusPageThreeTrendsDocument(
      buildProspectusPageThreeTrends(SAMPLE_PROSPECTUS_PAGE_THREE_TRENDS_INPUT)
    );
    expect(html).not.toMatch(/[↑↓▲▼→←]/);
    expect(html).not.toMatch(/green|red|#0f0|#f00|color:/i);
    expect(html).not.toMatch(/\bUp\b|\bDown\b|\bStable\b|\bFlat\b/i);
    expect(html).not.toMatch(/Improving|Declining|Favourable|Unfavorable|Unfavourable/i);
    expect(html).not.toMatch(/\bPositive\b|\bNegative\b/i);
    expect(PROSPECTUS_PAGE_THREE_TRENDS_AUDIT.display.arrowsAllowed).toBe(false);
    expect(PROSPECTUS_PAGE_THREE_TRENDS_AUDIT.display.directionalColoursAllowed).toBe(false);
    expect(PROSPECTUS_PAGE_THREE_TRENDS_AUDIT.display.generatedInterpretationAllowed).toBe(
      false
    );
  });

  it("keeps DNA for increasing, decreasing, and sign-change movements", () => {
    const increasing = buildProspectusPageThreeTrends(
      composeFromYears({
        "2022": { turnover: 1_000_000, plnpat: 100_000, bsqpuc: 1_000_000, curlib: 100_000 },
        "2023": { turnover: 2_000_000, plnpat: 200_000, bsqpuc: 1_000_000, curlib: 200_000 },
        "2024": { turnover: 3_000_000, plnpat: 300_000, bsqpuc: 1_000_000, curlib: 300_000 },
      })
    );
    expect(increasing.trends.every((t) => t.trend === PROSPECTUS_DATA_NOT_AVAILABLE)).toBe(
      true
    );

    const decreasing = buildProspectusPageThreeTrends(
      composeFromYears({
        "2022": { turnover: 3_000_000, plnpat: 300_000, bsqpuc: 1_000_000, curlib: 300_000 },
        "2023": { turnover: 2_000_000, plnpat: 200_000, bsqpuc: 1_000_000, curlib: 200_000 },
        "2024": { turnover: 1_000_000, plnpat: 100_000, bsqpuc: 1_000_000, curlib: 100_000 },
      })
    );
    expect(decreasing.trends.every((t) => t.trend === PROSPECTUS_DATA_NOT_AVAILABLE)).toBe(
      true
    );

    const signChange = buildProspectusPageThreeTrends(
      composeFromYears({
        "2022": { turnover: 1_000_000, plnpat: -100_000, bsqpuc: 1_000_000 },
        "2023": { turnover: 1_000_000, plnpat: 100_000, bsqpuc: 1_000_000 },
        "2024": { turnover: 1_000_000, plnpat: -50_000, bsqpuc: 1_000_000 },
      })
    );
    expect(signChange.trends.every((t) => t.trend === PROSPECTUS_DATA_NOT_AVAILABLE)).toBe(
      true
    );
  });

  it("keeps DNA for one, two, three years, zeros, and missing values", () => {
    const cases = [
      composeFromYears({ "2024": { turnover: 1, plnpat: 1, bsqpuc: 1 } }),
      composeFromYears({
        "2023": { turnover: 1, plnpat: 1, bsqpuc: 1 },
        "2024": { turnover: 2, plnpat: 2, bsqpuc: 1 },
      }),
      composeFromYears({
        "2022": { turnover: 0, plnpat: 0, bsqpuc: 0, curlib: 0, bscatot: 0 },
        "2023": { turnover: 0, plnpat: 0, bsqpuc: 0, curlib: 0, bscatot: 0 },
        "2024": { turnover: 0, plnpat: 0, bsqpuc: 0, curlib: 0, bscatot: 0 },
      }),
      composeFromYears({
        "2022": { turnover: 1 },
        "2024": { turnover: 2 },
      }),
      composeFromYears({
        "2022": { turnover: 1, plnpat: 1 },
        "2023": {},
        "2024": { bsqpuc: 1 },
      }),
    ];

    for (const input of cases) {
      const data = buildProspectusPageThreeTrends(input);
      expect(data.trends.every((t) => t.trend === PROSPECTUS_DATA_NOT_AVAILABLE)).toBe(true);
    }
  });

  it("composes Stage 2–4 outputs without remapping, year selection, Application parse, CTOS, Prisma, or reverse-parsing", () => {
    const moduleSource = readFileSync(
      join(__dirname, "prospectus-page-three-trends.ts"),
      "utf8"
    );
    expect(moduleSource).not.toMatch(/selectProspectusFinancialComparisonYears/);
    expect(moduleSource).not.toMatch(/unaudited_by_year/);
    expect(moduleSource).not.toMatch(/buildProspectusFinancialComparisonSource/);
    expect(moduleSource).not.toMatch(/parseProspectusFinancialNumber/);
    expect(moduleSource).not.toMatch(/formatProspectusMoneyMyr/);
    expect(moduleSource).not.toMatch(/calculateReturnOnEquity/);
    expect(moduleSource).not.toMatch(/prisma/i);
    expect(moduleSource).not.toMatch(/replace\(/);
    expect(moduleSource).not.toMatch(/Number\(/);
    expect(PROSPECTUS_PAGE_THREE_TRENDS_AUDIT.source.composedFromPageThreeSections).toBe(
      true
    );
    expect(PROSPECTUS_PAGE_THREE_TRENDS_AUDIT.source.rawFinancialSourceReadDirectly).toBe(
      false
    );
    expect(
      PROSPECTUS_PAGE_THREE_TRENDS_AUDIT.source.formattedValueReverseParsingAllowed
    ).toBe(false);
    expect(PROSPECTUS_PAGE_THREE_TRENDS_AUDIT.rules.genericHigherIsBetterAllowed).toBe(
      false
    );
    expect(PROSPECTUS_PAGE_THREE_TRENDS_AUDIT.snapshot.trendOutputsFrozen).toBe(false);
    expect(PROSPECTUS_PAGE_THREE_TRENDS_AUDIT.snapshot.ruleVersionAvailable).toBe(false);

    const withCtos = buildProspectusPageThreeTrends({
      ...SAMPLE_PROSPECTUS_PAGE_THREE_TRENDS_INPUT,
      ctosFinancials: { financials: [{ financial_year: 2020, turnover: 9_999_999 }] },
    });
    expect(withCtos.trends.every((t) => t.trend === PROSPECTUS_DATA_NOT_AVAILABLE)).toBe(
      true
    );
  });

  it("hides audit and does not display raw metric keys or debug JSON in HTML", () => {
    const data = buildProspectusPageThreeTrends(SAMPLE_PROSPECTUS_PAGE_THREE_TRENDS_INPUT);
    const html = buildProspectusPageThreeTrendsDocument(data);
    expect(html).toContain("—");
    expect(html).toContain("Revenue");
    expect(html).toContain("Return on Equity");
    expect(html).not.toContain("higher_is_better_candidate");
    expect(html).not.toContain("candidateInterpretationClass");
    expect(html).not.toContain("pending_product_finance_legal_approval");
    expect(html).not.toContain("profit_after_tax");
    expect(html).not.toContain("operating_cash_flow");
    expect(html).not.toMatch(/\{[\s\S]*"metricKey"/);
  });
});
