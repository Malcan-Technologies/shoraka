/**
 * Page 3 Coverage & Efficiency — source classification, formatters, Page 2 reuse.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { calculateReturnOnEquity } from "@cashsouk/types";
import {
  buildProspectusFinancialComparisonMetrics,
  formatProspectusFinancialMultiple,
  formatProspectusFinancialPercentFromPoints,
  formatProspectusFinancialPercentFromRatio,
  formatProspectusMyrMillions,
} from "./prospectus-financial-comparison-metrics";
import { financialSourceFromYearBlocks } from "./prospectus-financial-comparison-test-helpers";
import { buildProspectusPageThreeCoverageEfficiency } from "./prospectus-page-three-coverage-efficiency";
import {
  SAMPLE_PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_INPUT,
  SAMPLE_PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_SOURCE,
} from "./prospectus-page-three-coverage-efficiency.sample-data";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_ROW_KEYS,
  PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_SECTION_HEADING,
} from "./prospectus-page-three-coverage-efficiency.types";
import { buildProspectusPageThreeCoverageEfficiencyDocument } from "./render-prospectus-page-three-coverage-efficiency";

function row(
  data: ReturnType<typeof buildProspectusPageThreeCoverageEfficiency>,
  key: string
) {
  return data.rows.find((r) => r.key === key);
}

function sourceFromYears(
  years: Record<string, Record<string, unknown>>,
  financialYearEnd = "2024-12-31"
) {
  return financialSourceFromYearBlocks(years, { financialYearEnd });
}

describe("prospectus Page 3 coverage/efficiency", () => {
  it("uses static section heading and exact ten-row order", () => {
    const data = buildProspectusPageThreeCoverageEfficiency(
      SAMPLE_PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_INPUT
    );
    expect(data.sectionHeading).toBe("CASH FLOW, COVERAGE AND EFFICIENCY");
    expect(data.sectionHeading).toBe(
      PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_SECTION_HEADING
    );
    expect(data.rows.map((r) => r.key)).toEqual([
      ...PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_ROW_KEYS,
    ]);
    expect(data.rows.map((r) => r.label)).toEqual([
      "Operating Cash Flow",
      "Free Cash Flow",
      "Interest Coverage",
      "DSCR",
      "Debt / Equity",
      "Return on Equity",
      "Return on Assets",
      "Receivables Days",
      "Payables Days",
      "Asset Turnover",
    ]);
  });

  it("reuses the same three years as Page 2 source", () => {
    const source = SAMPLE_PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_SOURCE;
    const data = buildProspectusPageThreeCoverageEfficiency({ financialSource: source });
    expect(data.years.map((y) => y.year)).toEqual(source.years.map((y) => y.year));
  });

  it("formats six officer fields with correct units", () => {
    const source = sourceFromYears({
      "2024": { plnpat: 1_200_000, bsqpuc: 2_000_000, turnover: 10_000_000 },
    });
    const data = buildProspectusPageThreeCoverageEfficiency({
      financialSource: source,
      prospectusFinancialInputs: {
        years: {
          "2024": {
            operatingCashFlow: 1_400_000,
            freeCashFlow: 1_100_000,
            debtEquity: 0.24,
            returnOnAssets: 4.8,
            payablesDays: 48,
            assetTurnover: 1.72,
          },
        },
      },
    });
    expect(row(data, "operating_cash_flow")?.values[0]).toBe(
      formatProspectusMyrMillions(1_400_000)
    );
    expect(row(data, "free_cash_flow")?.values[0]).toBe(formatProspectusMyrMillions(1_100_000));
    expect(row(data, "debt_equity")?.values[0]).toBe(formatProspectusFinancialMultiple(0.24));
    expect(row(data, "return_on_assets")?.values[0]).toBe(
      formatProspectusFinancialPercentFromPoints(4.8)
    );
    expect(row(data, "payables_days")?.values[0]).toBe("48");
    expect(row(data, "asset_turnover")?.values[0]).toBe(
      formatProspectusFinancialMultiple(1.72)
    );
  });

  it("reuses Page 2 Interest Coverage, DSCR, and Receivables Days", () => {
    const source = sourceFromYears({
      "2024": { plnpat: 1_200_000, bsqpuc: 2_000_000, turnover: 10_000_000 },
    });
    const overrides = {
      "2024-12-31": {
        interestCoverage: 12.1,
        dscr: 1.42,
        receivablesDays: 74,
      },
    };
    const page2 = buildProspectusFinancialComparisonMetrics({
      source,
      officerOverrides: overrides,
    });
    const page3 = buildProspectusPageThreeCoverageEfficiency({
      financialSource: source,
      page2FinancialOverrides: overrides,
      prospectusFinancialInputs: {
        years: {
          "2024": {
            // Must be ignored — removed Page 3 duplicates
            interestCoverage: 99,
            dscr: 99,
            receivablesDays: 99,
          } as Record<string, number>,
        },
      },
    });

    expect(row(page3, "interest_coverage")?.values[0]).toBe(
      page2.rows.find((r) => r.key === "interestCoverage")?.values[0]
    );
    expect(row(page3, "dscr")?.values[0]).toBe(
      page2.rows.find((r) => r.key === "dscr")?.values[0]
    );
    expect(row(page3, "receivables_days")?.values[0]).toBe(
      page2.rows.find((r) => r.key === "receivablesDays")?.values[0]
    );
    expect(row(page3, "interest_coverage")?.values[0]).toBe("12.1x");
    expect(row(page3, "dscr")?.values[0]).toBe("1.42x");
    expect(row(page3, "receivables_days")?.values[0]).toBe("74");
  });

  it("uses resolveApplicationFinancialReturnOnEquityRatio and matches Page 2", () => {
    const source = SAMPLE_PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_SOURCE;
    const page3 = buildProspectusPageThreeCoverageEfficiency({ financialSource: source });
    const page2 = buildProspectusFinancialComparisonMetrics({ source });

    expect(row(page3, "return_on_equity")?.values).toEqual(
      page2.rows.find((r) => r.key === "roe")?.values
    );
    expect(row(page3, "return_on_equity")?.values[0]).toBe(
      formatProspectusFinancialPercentFromRatio(
        calculateReturnOnEquity(1_200_000, 2_000_000)
      )
    );

    const flat = buildProspectusPageThreeCoverageEfficiency({
      financialSource: sourceFromYears({
        "2024": {
          return_on_equity: 15.2,
          plnpat: 1,
          bsqpuc: 100,
        },
      }),
    });
    expect(row(flat, "return_on_equity")?.values[0]).toBe("15.2%");

    const missingPat = buildProspectusPageThreeCoverageEfficiency({
      financialSource: sourceFromYears({ "2024": { bsqpuc: 2_000_000 } }),
    });
    expect(row(missingPat, "return_on_equity")?.values[0]).toBe("0%");

    const zeroEquity = buildProspectusPageThreeCoverageEfficiency({
      financialSource: sourceFromYears({ "2024": { plnpat: 100, bsqpuc: 0 } }),
    });
    expect(row(zeroEquity, "return_on_equity")?.values[0]).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);

    const moduleSource = readFileSync(
      join(__dirname, "prospectus-page-three-coverage-efficiency.ts"),
      "utf8"
    );
    expect(moduleSource).toMatch(/resolveApplicationFinancialReturnOnEquityRatio/);
    expect(moduleSource).not.toMatch(/plnpat\s*\/\s*bsqpuc/);
  });

  it("shows DNA for missing officer and Page 2 values; accepts zero", () => {
    const source = sourceFromYears({
      "2024": { plnpat: 0, bsqpuc: 2_000_000 },
    });
    const empty = buildProspectusPageThreeCoverageEfficiency({ financialSource: source });
    expect(row(empty, "operating_cash_flow")?.values[0]).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(row(empty, "interest_coverage")?.values[0]).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);

    const zero = buildProspectusPageThreeCoverageEfficiency({
      financialSource: source,
      prospectusFinancialInputs: {
        years: {
          "2024": {
            operatingCashFlow: 0,
            freeCashFlow: 0,
            debtEquity: 0,
            returnOnAssets: 0,
            payablesDays: 0,
            assetTurnover: 0,
          },
        },
      },
      page2FinancialOverrides: {
        "2024": { interestCoverage: 0, dscr: 0, receivablesDays: 0 },
      },
    });
    expect(row(zero, "operating_cash_flow")?.values[0]).toBe("0");
    expect(row(zero, "debt_equity")?.values[0]).toBe("0x");
    expect(row(zero, "return_on_assets")?.values[0]).toBe("0%");
    expect(row(zero, "interest_coverage")?.values[0]).toBe("0x");
    expect(row(zero, "receivables_days")?.values[0]).toBe("0");
  });

  it("does not invent formulas or write Application/CTOS lookups in the module", () => {
    const moduleSource = readFileSync(
      join(__dirname, "prospectus-page-three-coverage-efficiency.ts"),
      "utf8"
    );
    expect(moduleSource).not.toMatch(/selectProspectusFinancialComparisonYears/);
    expect(moduleSource).not.toMatch(/unaudited_by_year/);
    expect(moduleSource).not.toMatch(/prisma/i);
    expect(moduleSource).not.toMatch(/OCF\s*-\s*capex/i);
    expect(moduleSource).not.toMatch(/calculateGearing/);
  });

  it("renders HTML without leaking helper names or inventing trends", () => {
    const data = buildProspectusPageThreeCoverageEfficiency(
      SAMPLE_PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_INPUT
    );
    const html = buildProspectusPageThreeCoverageEfficiencyDocument(data);
    expect(html).toContain("CASH FLOW, COVERAGE AND EFFICIENCY");
    expect(html).not.toContain("resolveApplicationFinancialReturnOnEquityRatio");
    expect(html).not.toContain("↑");
    expect(html).not.toContain("favourable");
  });
});
