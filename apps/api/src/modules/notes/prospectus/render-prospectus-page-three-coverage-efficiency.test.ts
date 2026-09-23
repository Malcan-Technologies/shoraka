/**
 * Page 3 Coverage & Efficiency — source classification, formatters, Page 2 reuse.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildProspectusFinancialComparisonMetrics,
  formatProspectusFinancialMultiple,
  formatProspectusFinancialPercentFromPoints,
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
  financialYearEnd = "2024-12-31",
  options?: { issuerOverlay?: boolean }
) {
  return financialSourceFromYearBlocks(years, { financialYearEnd, issuerOverlay: options?.issuerOverlay });
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

  it("formats officer OCF/FCF/Payables and official CTOS Debt/Equity, ROA, Asset Turnover", () => {
    const source = sourceFromYears({
      "2024": {
        plnpat: 100_000,
        turnover: 1_000_000,
        totass: 1_000_000,
        totlib: 250_000,
        networth: 500_000,
        bsqpuc: 2_000_000,
        tradePayables: 48_000,
        costOfSales: 365_000,
        operatingCashFlow: 1_400_000,
        freeCashFlow: 1_100_000,
      },
    });
    const data = buildProspectusPageThreeCoverageEfficiency({
      financialSource: source,
      prospectusFinancialInputs: {
        years: {
          "2024": {
            // Officer values must not override Stage 4A raw issuer values.
            operatingCashFlow: 1,
            freeCashFlow: 1,
            debtEquity: 99,
            returnOnAssets: 99,
            payablesDays: 48,
            assetTurnover: 99,
          },
        },
      },
    });
    expect(row(data, "operating_cash_flow")?.values[0]).toBe(
      formatProspectusMyrMillions(1_400_000)
    );
    expect(row(data, "free_cash_flow")?.values[0]).toBe(formatProspectusMyrMillions(1_100_000));
    expect(row(data, "debt_equity")?.values[0]).toBe(formatProspectusFinancialMultiple(0.5));
    expect(row(data, "return_on_assets")?.values[0]).toBe(
      formatProspectusFinancialPercentFromPoints(10)
    );
    expect(row(data, "payables_days")?.values[0]).toBe("48");
    expect(row(data, "asset_turnover")?.values[0]).toBe(
      formatProspectusFinancialMultiple(1)
    );
  });

  it("prefers raw gear for Debt / Equity and never uses profit_margin for ROA", () => {
    const data = buildProspectusPageThreeCoverageEfficiency({
      financialSource: sourceFromYears({
        "2024": {
          gear: 4.4,
          totlib: 1,
          networth: 1,
          // netDebtEquity is computed from borrowings/cash; ensure it differs.
          curlib_borrowing: 10,
          ncl_loan: 0,
          cashAndBank: 0,
          plnpat: 8,
          totass: 100,
          profit_margin: 99,
          turnover: 200,
        },
      }),
    });
    expect(row(data, "debt_equity")?.values[0]).toBe("4.4x");
    expect(row(data, "return_on_assets")?.values[0]).toBe("8%");
  });

  it("shows DNA for invalid CTOS ratio inputs", () => {
    const missing = buildProspectusPageThreeCoverageEfficiency({
      financialSource: sourceFromYears({
        "2024": { plnpat: 8, turnover: 200 },
      }),
    });
    expect(row(missing, "return_on_assets")?.values[0]).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(row(missing, "asset_turnover")?.values[0]).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(row(missing, "debt_equity")?.values[0]).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);

    const zeroDenom = buildProspectusPageThreeCoverageEfficiency({
      financialSource: sourceFromYears({
        "2024": { plnpat: 8, totass: 0, turnover: 10, totlib: 5, networth: 0 },
      }),
    });
    expect(row(zeroDenom, "return_on_assets")?.values[0]).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(row(zeroDenom, "asset_turnover")?.values[0]).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(row(zeroDenom, "debt_equity")?.values[0]).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("reuses Page 2 Interest Coverage, DSCR, and Receivables Days", () => {
    const data = buildProspectusPageThreeCoverageEfficiency({
      financialSource: sourceFromYears(
        {
          "2023": {
            plnpbt: 1_200_000,
            plnpat: 1_200_000,
            interest_cost: 108_108.10810810811, // => interest coverage ~ 12.1x
            ebitda: 1_420_000, // => DSCR 1.42x (fallback when CTOS lacks NOI)
            netOperatingIncome: 1_420_000,
            annualDebtService: 1_000_000,
            turnover: 10_000_000,
            tradeReceivables: 2_027_397.26, // Beginning AR for FY2024
          },
          "2024": {
            plnpbt: 1_200_000,
            plnpat: 1_200_000,
            interest_cost: 108_108.10810810811, // => interest coverage ~ 12.1x
            ebitda: 1_420_000, // => DSCR 1.42x (fallback when CTOS lacks NOI)
            netOperatingIncome: 1_420_000,
            annualDebtService: 1_000_000,
            turnover: 10_000_000,
            tradeReceivables: 2_027_397.26, // Ending AR for FY2024
          },
        },
        "2024-12-31",
        { issuerOverlay: true }
      ),
    });

    // FY2023 lacks prior consecutive year in this fixture.
    expect(row(data, "receivables_days")?.values[0]).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(row(data, "interest_coverage")?.values[1]).toBe("12.1x");
    expect(row(data, "dscr")?.values[1]).toBe("1.42x");
    expect(row(data, "receivables_days")?.values[1]).toBe("74");
  });

  it("uses resolveCtosReturnOnEquityPercent (direct return_on_equity only) and matches Page 2", () => {
    const withFlat = buildProspectusPageThreeCoverageEfficiency({
      financialSource: sourceFromYears({
        "2024": {
          return_on_equity: 15.2,
          plnpat: 1,
          networth: 100,
          bsqpuc: 50,
        },
      }),
    });
    expect(row(withFlat, "return_on_equity")?.values[0]).toBe("15.2%");

    const page2 = buildProspectusFinancialComparisonMetrics({
      source: sourceFromYears({
        "2024": { return_on_equity: 15.2, plnpat: 1, networth: 100 },
      }),
    });
    expect(row(withFlat, "return_on_equity")?.values).toEqual(
      page2.rows.find((r) => r.key === "roe")?.values
    );

    const missingFlat = buildProspectusPageThreeCoverageEfficiency({
      financialSource: sourceFromYears({
        "2024": { plnpat: 100, networth: 500, totass: 1000, totlib: 200 },
      }),
    });
    expect(row(missingFlat, "return_on_equity")?.values[0]).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);

    const paidUpIgnored = buildProspectusPageThreeCoverageEfficiency({
      financialSource: sourceFromYears({
        "2024": { plnpat: 100, bsqpuc: 200, networth: 500 },
      }),
    });
    expect(row(paidUpIgnored, "return_on_equity")?.values[0]).toBe(
      PROSPECTUS_DATA_NOT_AVAILABLE
    );

    const moduleSource = readFileSync(
      join(__dirname, "prospectus-page-three-coverage-efficiency.ts"),
      "utf8"
    );
    expect(moduleSource).toMatch(/resolveCtosReturnOnEquityPercent/);
    expect(moduleSource).toMatch(/resolveCtosGearingRatio/);
    expect(moduleSource).toMatch(/resolveCtosReturnOnAssetsPercent/);
    expect(moduleSource).toMatch(/resolveCtosTotalAssetTurnover/);
    expect(moduleSource).not.toMatch(/resolveApplicationFinancialReturnOnEquityRatio/);
    expect(moduleSource).not.toMatch(/plnpat\s*\/\s*bsqpuc/);
  });

  it("shows DNA for missing officer and Page 2 values; accepts zero; CTOS zeros from official inputs", () => {
    const source = sourceFromYears({
      "2024": { plnpat: 0, networth: 2_000_000, totass: 1_000_000, turnover: 0, totlib: 0 },
    });
    const empty = buildProspectusPageThreeCoverageEfficiency({ financialSource: source });
    expect(row(empty, "operating_cash_flow")?.values[0]).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(row(empty, "interest_coverage")?.values[0]).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);

    const zero = buildProspectusPageThreeCoverageEfficiency({
      financialSource: sourceFromYears({
        "2024": {
          plnpat: 0,
          networth: 2_000_000,
          totass: 1_000_000,
          turnover: 0,
          totlib: 0,
          operatingCashFlow: 0,
          freeCashFlow: 0,
        },
      }),
    });
    expect(row(zero, "operating_cash_flow")?.values[0]).toBe("0");
    expect(row(zero, "debt_equity")?.values[0]).toBe("0x");
    expect(row(zero, "return_on_assets")?.values[0]).toBe("0%");
    expect(row(zero, "asset_turnover")?.values[0]).toBe("0x");
    expect(row(zero, "interest_coverage")?.values[0]).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(row(zero, "receivables_days")?.values[0]).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
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
    expect(html).not.toContain("resolveCtosReturnOnEquityPercent");
    expect(html).not.toContain("↑");
    expect(html).not.toContain("favourable");
  });
});
