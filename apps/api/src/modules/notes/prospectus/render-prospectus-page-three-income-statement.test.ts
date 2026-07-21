import { readFileSync } from "node:fs";
import { join } from "node:path";
import { calculateProfitMargin } from "@cashsouk/types";
import {
  buildProspectusFinancialComparisonMetrics,
  formatProspectusFinancialPercentFromRatio,
} from "./prospectus-financial-comparison-metrics";
import { financialSourceFromYearBlocks } from "./prospectus-financial-comparison-test-helpers";
import { formatProspectusMoneyMyr } from "./prospectus-main-financial-terms";
import { buildProspectusPageThreeIncomeStatement } from "./prospectus-page-three-income-statement";
import {
  SAMPLE_PROSPECTUS_PAGE_THREE_INCOME_STATEMENT_INPUT,
  SAMPLE_PROSPECTUS_PAGE_THREE_INCOME_STATEMENT_SOURCE,
} from "./prospectus-page-three-income-statement.sample-data";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_PAGE_THREE_INCOME_STATEMENT_AUDIT,
  PROSPECTUS_PAGE_THREE_INCOME_STATEMENT_ROW_KEYS,
  PROSPECTUS_PAGE_THREE_INCOME_STATEMENT_ROW_LABELS,
  PROSPECTUS_PAGE_THREE_INCOME_STATEMENT_SECTION_HEADING,
} from "./prospectus-page-three-income-statement.types";
import { buildProspectusPageThreeIncomeStatementDocument } from "./render-prospectus-page-three-income-statement";

function row(
  data: ReturnType<typeof buildProspectusPageThreeIncomeStatement>,
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

describe("prospectus Page 3 income statement (DATA STAGE 2)", () => {
  it("uses static section heading", () => {
    const data = buildProspectusPageThreeIncomeStatement(
      SAMPLE_PROSPECTUS_PAGE_THREE_INCOME_STATEMENT_INPUT
    );
    expect(data.sectionHeading).toBe("3-YEAR INCOME STATEMENT SUMMARY");
    expect(data.sectionHeading).toBe(
      PROSPECTUS_PAGE_THREE_INCOME_STATEMENT_SECTION_HEADING
    );
  });

  it("keeps exact seven-row order and labels", () => {
    const data = buildProspectusPageThreeIncomeStatement(
      SAMPLE_PROSPECTUS_PAGE_THREE_INCOME_STATEMENT_INPUT
    );
    expect(data.rows.map((r) => r.key)).toEqual([
      ...PROSPECTUS_PAGE_THREE_INCOME_STATEMENT_ROW_KEYS,
    ]);
    expect(data.rows.map((r) => r.label)).toEqual([
      "Revenue",
      "Gross Profit",
      "EBITDA",
      "EBIT",
      "Profit Before Tax",
      "Profit After Tax",
      "Net Profit Margin",
    ]);
    expect(PROSPECTUS_PAGE_THREE_INCOME_STATEMENT_ROW_LABELS.revenue).toBe("Revenue");
  });

  it("passes years and FYE labels through unchanged", () => {
    const source = SAMPLE_PROSPECTUS_PAGE_THREE_INCOME_STATEMENT_SOURCE;
    const data = buildProspectusPageThreeIncomeStatement({ financialSource: source });
    expect(data.years.map((y) => y.year)).toEqual(source.years.map((y) => y.year));
    expect(data.years.map((y) => y.yearLabel)).toEqual(
      source.years.map((y) => y.yearLabel)
    );
    expect(data.years.map((y) => y.financialYearEndLabel)).toEqual(
      source.years.map((y) => y.financialYearEndLabel)
    );
    expect(data.years.map((y) => y.year)).toEqual([2022, 2023, 2024]);
  });

  it("supports fewer than three years and empty years without fabricating years", () => {
    const oneYear = sourceFromYears({ "2024": { turnover: 100, plnpat: 10 } });
    const one = buildProspectusPageThreeIncomeStatement({ financialSource: oneYear });
    expect(one.years).toHaveLength(1);
    expect(one.years[0]?.year).toBe(2024);
    expect(one.years.some((y) => y.year === 2023)).toBe(false);

    const empty = buildProspectusPageThreeIncomeStatement({
      financialSource: sourceFromYears({}),
    });
    expect(empty.years).toEqual([]);
    for (const r of empty.rows) {
      expect(r.values).toEqual([]);
    }
  });

  it("maps revenue from turnover with full MYR including zero and negatives", () => {
    const data = buildProspectusPageThreeIncomeStatement(
      SAMPLE_PROSPECTUS_PAGE_THREE_INCOME_STATEMENT_INPUT
    );
    expect(row(data, "revenue")?.values).toEqual([
      "RM 13,900,000.00",
      "RM 16,200,000.00",
      "RM 18,600,000.00",
    ]);

    const zeros = buildProspectusPageThreeIncomeStatement({
      financialSource: sourceFromYears({ "2024": { turnover: 0, plnpat: 0 } }),
    });
    expect(row(zeros, "revenue")?.values[0]).toBe("RM 0.00");
    expect(formatProspectusMoneyMyr(0)).toBe("RM 0.00");

    const negative = buildProspectusPageThreeIncomeStatement({
      financialSource: sourceFromYears({ "2024": { turnover: -250_000 } }),
    });
    expect(row(negative, "revenue")?.values[0]).toBe("RM -250,000.00");
  });

  it("maps missing or invalid revenue to Data not available", () => {
    const data = buildProspectusPageThreeIncomeStatement({
      financialSource: sourceFromYears({
        "2024": { turnover: "", plnpat: 1 },
        "2023": { plnpat: 1 },
        "2022": { turnover: "abc", plnpat: 1 },
      }),
    });
    expect(row(data, "revenue")?.values.every((v) => v === PROSPECTUS_DATA_NOT_AVAILABLE)).toBe(
      true
    );
  });

  it("keeps Gross Profit, EBITDA, and EBIT as Data not available without officer inputs", () => {
    const data = buildProspectusPageThreeIncomeStatement(
      SAMPLE_PROSPECTUS_PAGE_THREE_INCOME_STATEMENT_INPUT
    );
    for (const key of ["gross_profit", "ebitda", "ebit"] as const) {
      expect(row(data, key)?.values).toEqual([
        PROSPECTUS_DATA_NOT_AVAILABLE,
        PROSPECTUS_DATA_NOT_AVAILABLE,
        PROSPECTUS_DATA_NOT_AVAILABLE,
      ]);
    }

    const polluted = buildProspectusPageThreeIncomeStatement({
      financialSource: sourceFromYears({
        "2024": {
          turnover: 1,
          plnpbt: 2,
          plnpat: 3,
          gross_profit: 999,
          ebitda: 888,
          ebit: 777,
          depreciation: 100,
        },
      }),
    });
    expect(row(polluted, "gross_profit")?.values[0]).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(row(polluted, "ebitda")?.values[0]).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(row(polluted, "ebit")?.values[0]).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(PROSPECTUS_PAGE_THREE_INCOME_STATEMENT_AUDIT.grossProfit.generatedCalculationAllowed).toBe(
      false
    );
  });

  it("fills Gross Profit, EBITDA, and EBIT from page3.manualFinancialInputs (full MYR)", () => {
    const data = buildProspectusPageThreeIncomeStatement({
      financialSource: SAMPLE_PROSPECTUS_PAGE_THREE_INCOME_STATEMENT_SOURCE,
      prospectusFinancialInputs: {
        years: {
          "2022": { grossProfit: 2_100_000, ebitda: 1_600_000, ebit: 1_450_000 },
          "2023": { grossProfit: 2_400_000, ebitda: 1_850_000, ebit: 0 },
          "2024": { grossProfit: -50_000, ebitda: 2_100_000, ebit: 1_950_000 },
        },
      },
    });
    expect(row(data, "gross_profit")?.values).toEqual([
      "RM 2,100,000.00",
      "RM 2,400,000.00",
      "RM -50,000.00",
    ]);
    expect(row(data, "ebitda")?.values[0]).toBe("RM 1,600,000.00");
    expect(row(data, "ebit")?.values[1]).toBe("RM 0.00");
    expect(PROSPECTUS_PAGE_THREE_INCOME_STATEMENT_AUDIT.grossProfit.status).toBe(
      "officer_entered"
    );
  });

  it("maps PBT from plnpbt with full MYR and DNA when missing or invalid", () => {
    const data = buildProspectusPageThreeIncomeStatement(
      SAMPLE_PROSPECTUS_PAGE_THREE_INCOME_STATEMENT_INPUT
    );
    expect(row(data, "profit_before_tax")?.values).toEqual([
      "RM 1,400,000.00",
      "RM 1,700,000.00",
      "RM 2,000,000.00",
    ]);

    const zero = buildProspectusPageThreeIncomeStatement({
      financialSource: sourceFromYears({ "2024": { plnpbt: 0 } }),
    });
    expect(row(zero, "profit_before_tax")?.values[0]).toBe("RM 0.00");

    const oldSnapshotShape = buildProspectusPageThreeIncomeStatement({
      financialSource: sourceFromYears({
        "2024": { turnover: 100, plnpat: 10 },
      }),
    });
    expect(row(oldSnapshotShape, "profit_before_tax")?.values[0]).toBe(
      PROSPECTUS_DATA_NOT_AVAILABLE
    );
    expect(row(oldSnapshotShape, "revenue")?.values[0]).toBe("RM 100.00");
    expect(row(oldSnapshotShape, "profit_after_tax")?.values[0]).toBe("RM 10.00");

    const invalid = buildProspectusPageThreeIncomeStatement({
      financialSource: sourceFromYears({ "2024": { turnover: 100, plnpbt: "n/a" } }),
    });
    expect(row(invalid, "profit_before_tax")?.values[0]).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(
      PROSPECTUS_PAGE_THREE_INCOME_STATEMENT_AUDIT.snapshot.liveFallbackForPublishedAllowed
    ).toBe(false);
  });

  it("maps PAT from plnpat with full MYR and DNA when missing or invalid", () => {
    const data = buildProspectusPageThreeIncomeStatement(
      SAMPLE_PROSPECTUS_PAGE_THREE_INCOME_STATEMENT_INPUT
    );
    expect(row(data, "profit_after_tax")?.values).toEqual([
      "RM 1,200,000.00",
      "RM 1,500,000.00",
      "RM 1,800,000.00",
    ]);

    const zero = buildProspectusPageThreeIncomeStatement({
      financialSource: sourceFromYears({ "2024": { plnpat: 0, turnover: 1 } }),
    });
    expect(row(zero, "profit_after_tax")?.values[0]).toBe("RM 0.00");

    const missing = buildProspectusPageThreeIncomeStatement({
      financialSource: sourceFromYears({ "2024": { turnover: 1 } }),
    });
    expect(row(missing, "profit_after_tax")?.values[0]).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);

    const invalid = buildProspectusPageThreeIncomeStatement({
      financialSource: sourceFromYears({ "2024": { turnover: 100, plnpat: Infinity } }),
    });
    expect(row(invalid, "profit_after_tax")?.values[0]).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("reuses calculateProfitMargin and matches Page 2 for identical inputs", () => {
    const source = SAMPLE_PROSPECTUS_PAGE_THREE_INCOME_STATEMENT_SOURCE;
    const page3 = buildProspectusPageThreeIncomeStatement({ financialSource: source });
    const page2 = buildProspectusFinancialComparisonMetrics({ source });

    const page3Npm = row(page3, "net_profit_margin")?.values;
    const page2Npm = page2.rows.find((r) => r.key === "netProfitMargin")?.values;
    expect(page3Npm).toEqual(page2Npm);
    expect(page3Npm).toEqual([
      formatProspectusFinancialPercentFromRatio(calculateProfitMargin(1_200_000, 13_900_000)),
      formatProspectusFinancialPercentFromRatio(calculateProfitMargin(1_500_000, 16_200_000)),
      formatProspectusFinancialPercentFromRatio(calculateProfitMargin(1_800_000, 18_600_000)),
    ]);

    const zeroPat = buildProspectusPageThreeIncomeStatement({
      financialSource: sourceFromYears({ "2024": { turnover: 100, plnpat: 0 } }),
    });
    expect(row(zeroPat, "net_profit_margin")?.values[0]).toBe("0%");

    const missingRevenue = buildProspectusPageThreeIncomeStatement({
      financialSource: sourceFromYears({ "2024": { plnpat: 10 } }),
    });
    expect(row(missingRevenue, "net_profit_margin")?.values[0]).toBe(
      PROSPECTUS_DATA_NOT_AVAILABLE
    );

    const zeroRevenue = buildProspectusPageThreeIncomeStatement({
      financialSource: sourceFromYears({ "2024": { turnover: 0, plnpat: 10 } }),
    });
    expect(row(zeroRevenue, "net_profit_margin")?.values[0]).toBe(
      PROSPECTUS_DATA_NOT_AVAILABLE
    );

    const negativePat = buildProspectusPageThreeIncomeStatement({
      financialSource: sourceFromYears({ "2024": { turnover: 100, plnpat: -25 } }),
    });
    expect(row(negativePat, "net_profit_margin")?.values[0]).toBe(
      formatProspectusFinancialPercentFromRatio(calculateProfitMargin(-25, 100))
    );

    const moduleSource = readFileSync(
      join(__dirname, "prospectus-page-three-income-statement.ts"),
      "utf8"
    );
    expect(moduleSource).toMatch(/calculateProfitMargin/);
    expect(moduleSource).not.toMatch(/plnpat\s*\/\s*turnover/);
  });

  it("reuses Page 2 source type with no independent selection, Application parse, CTOS, or Prisma", () => {
    const moduleSource = readFileSync(
      join(__dirname, "prospectus-page-three-income-statement.ts"),
      "utf8"
    );
    expect(moduleSource).not.toMatch(/selectProspectusFinancialComparisonYears/);
    expect(moduleSource).not.toMatch(/unaudited_by_year/);
    expect(moduleSource).not.toMatch(/buildProspectusFinancialComparisonSource/);
    expect(moduleSource).not.toMatch(/prisma/i);
    expect(PROSPECTUS_PAGE_THREE_INCOME_STATEMENT_AUDIT.source.ctosFallbackAllowed).toBe(
      false
    );
    expect(
      PROSPECTUS_PAGE_THREE_INCOME_STATEMENT_AUDIT.source.independentYearSelectionAllowed
    ).toBe(false);

    const withCtos = buildProspectusPageThreeIncomeStatement({
      financialSource: SAMPLE_PROSPECTUS_PAGE_THREE_INCOME_STATEMENT_SOURCE,
      ctosFinancials: { financials: [{ financial_year: 2020, turnover: 9_999_999 }] },
    });
    expect(withCtos.years.some((y) => y.year === 2020)).toBe(false);
  });

  it("rejects compact / million money formatting and hides audit in HTML", () => {
    const data = buildProspectusPageThreeIncomeStatement(
      SAMPLE_PROSPECTUS_PAGE_THREE_INCOME_STATEMENT_INPUT
    );
    const html = buildProspectusPageThreeIncomeStatementDocument(data);
    expect(html).not.toMatch(/RM\s*mil/i);
    expect(html).not.toMatch(/\b13\.9\b/);
    expect(html).not.toContain("1,000,000");
    expect(html).toContain("RM 13,900,000.00");
    expect(html).toContain("Data not available");
    expect(html).not.toContain("turnover");
    expect(html).not.toContain("plnpbt");
    expect(html).not.toContain("calculateProfitMargin");
    expect(html).not.toContain("publicationExtensionPending");
    expect(html).not.toContain("page_2_financial_comparison_source");

    for (const key of ["gross_profit", "ebitda", "ebit"] as const) {
      expect(row(data, key)?.values.every((v) => v === "Data not available")).toBe(true);
    }

    const builder = readFileSync(
      join(__dirname, "prospectus-page-three-income-statement.ts"),
      "utf8"
    );
    expect(builder).not.toMatch(/\/\s*1_?000_?000/);
    expect(builder).not.toMatch(/\/\s*1000000/);
  });
});
