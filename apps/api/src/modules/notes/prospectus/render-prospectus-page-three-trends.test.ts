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

function composeFromYears(
  years: Record<string, Record<string, unknown>>,
  extras?: {
    prospectusFinancialInputs?: ProspectusPageThreeTrendsInputExtras["prospectusFinancialInputs"];
    page2FinancialOverrides?: ProspectusPageThreeTrendsInputExtras["page2FinancialOverrides"];
  }
) {
  const financialSource = financialSourceFromYearBlocks(years, {
    financialYearEnd: "2024-12-31",
  });
  return {
    incomeStatement: buildProspectusPageThreeIncomeStatement({ financialSource }),
    balanceSheet: buildProspectusPageThreeBalanceSheet({ financialSource }),
    coverageEfficiency: buildProspectusPageThreeCoverageEfficiency({
      financialSource,
      prospectusFinancialInputs: extras?.prospectusFinancialInputs,
      page2FinancialOverrides: extras?.page2FinancialOverrides,
    }),
    financialSource,
    prospectusFinancialInputs: extras?.prospectusFinancialInputs,
    page2FinancialOverrides: extras?.page2FinancialOverrides,
  };
}

type ProspectusPageThreeTrendsInputExtras = {
  prospectusFinancialInputs?: {
    years?: Record<string, Record<string, string | number | null | undefined>>;
  } | null;
  page2FinancialOverrides?: Record<
    string,
    {
      interestCoverage?: number | null;
      dscr?: number | null;
      receivablesDays?: number | null;
    }
  > | null;
};

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

  it("keeps income/balance trends unavailable and allows coverage when three values exist", () => {
    const data = buildProspectusPageThreeTrends(SAMPLE_PROSPECTUS_PAGE_THREE_TRENDS_INPUT);
    for (const item of data.trends.slice(0, 16)) {
      expect(item.approved).toBe(false);
      expect(item.direction).toBe("unavailable");
      expect(item.trend).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    }
    const roe = data.trends.find((t) => t.metricKey === "return_on_equity");
    expect(roe?.approved).toBe(true);
    expect(roe?.direction).toBe("up");
  });

  it("computes Interest Coverage favourable up from Page 2 overrides", () => {
    const data = buildProspectusPageThreeTrends(
      composeFromYears(
        {
          "2022": { turnover: 1, plnpat: 1, bsqpuc: 1 },
          "2023": { turnover: 1, plnpat: 1, bsqpuc: 1 },
          "2024": { turnover: 1, plnpat: 1, bsqpuc: 1 },
        },
        {
          page2FinancialOverrides: {
            "2022-12-31": { interestCoverage: 2 },
            "2023-12-31": { interestCoverage: 3 },
            "2024-12-31": { interestCoverage: 4 },
          },
        }
      )
    );
    const ic = data.trends.find((t) => t.metricKey === "interest_coverage");
    expect(ic).toMatchObject({
      direction: "up",
      consistency: "consistent",
      interpretation: "favourable",
      approved: true,
    });
  });

  it("computes Receivables Days favourable down from Page 2 overrides", () => {
    const data = buildProspectusPageThreeTrends(
      composeFromYears(
        {
          "2022": { turnover: 1, plnpat: 1, bsqpuc: 1 },
          "2023": { turnover: 1, plnpat: 1, bsqpuc: 1 },
          "2024": { turnover: 1, plnpat: 1, bsqpuc: 1 },
        },
        {
          page2FinancialOverrides: {
            "2022-12-31": { receivablesDays: 90 },
            "2023-12-31": { receivablesDays: 70 },
            "2024-12-31": { receivablesDays: 50 },
          },
        }
      )
    );
    const days = data.trends.find((t) => t.metricKey === "receivables_days");
    expect(days).toMatchObject({
      direction: "down",
      consistency: "consistent",
      interpretation: "favourable",
      approved: true,
    });
  });

  it("marks coverage unavailable when officer values are missing", () => {
    const data = buildProspectusPageThreeTrends(
      composeFromYears({
        "2022": { turnover: 1, plnpat: 1, bsqpuc: 1 },
        "2023": { turnover: 1, plnpat: 1, bsqpuc: 1 },
        "2024": { turnover: 1, plnpat: 1, bsqpuc: 1 },
      })
    );
    const ocf = data.trends.find((t) => t.metricKey === "operating_cash_flow");
    expect(ocf?.approved).toBe(false);
    expect(ocf?.direction).toBe("unavailable");
  });

  it("does not reverse-parse formatted display strings", () => {
    const moduleSource = readFileSync(
      join(__dirname, "prospectus-page-three-trends.ts"),
      "utf8"
    );
    expect(moduleSource).not.toMatch(/replace\(/);
    expect(moduleSource).not.toMatch(/Number\(/);
    expect(moduleSource).toContain("numericValueForCoverageRow");
    expect(
      PROSPECTUS_PAGE_THREE_TRENDS_AUDIT.source.formattedValueReverseParsingAllowed
    ).toBe(false);
    expect(PROSPECTUS_PAGE_THREE_TRENDS_AUDIT.display.arrowsAllowed).toBe(true);
    expect(PROSPECTUS_PAGE_THREE_TRENDS_AUDIT.display.heroiconsRequired).toBe(true);
    expect(PROSPECTUS_PAGE_THREE_TRENDS_AUDIT.snapshot.trendOutputsFrozen).toBe(true);
  });

  it("hides audit metadata from standalone trends HTML", () => {
    const data = buildProspectusPageThreeTrends(SAMPLE_PROSPECTUS_PAGE_THREE_TRENDS_INPUT);
    const html = buildProspectusPageThreeTrendsDocument(data);
    expect(html).toContain("Revenue");
    expect(html).toContain("Return on Equity");
    expect(html).not.toContain("higher_is_better_candidate");
    expect(html).not.toContain("candidateInterpretationClass");
    expect(html).not.toContain("profit_after_tax");
    expect(html).not.toContain("operating_cash_flow");
  });
});
