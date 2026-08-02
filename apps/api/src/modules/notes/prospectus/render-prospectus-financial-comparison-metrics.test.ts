import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildProspectusFinancialComparisonSource } from "./prospectus-financial-comparison-source";
import {
  buildProspectusFinancialComparisonMetrics,
  formatProspectusFinancialMultiple,
  formatProspectusFinancialPercentFromRatio,
  formatProspectusMyrMillions,
  parseProspectusFinancialNumber,
  resolveYearOverride,
  toAdminFinancialComparisonTable,
  toAdminFrozenFinancialYears,
} from "./prospectus-financial-comparison-metrics";
import { SAMPLE_PROSPECTUS_FINANCIAL_COMPARISON_METRICS_SOURCE } from "./prospectus-financial-comparison-metrics.sample-data";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_FINANCIAL_COMPARISON_METRIC_KEYS,
  PROSPECTUS_FINANCIAL_COMPARISON_METRIC_LABELS,
} from "./prospectus-financial-comparison-metrics.types";
import { buildProspectusFinancialComparisonMetricsDocument } from "./render-prospectus-financial-comparison-metrics";

function row(
  metrics: ReturnType<typeof buildProspectusFinancialComparisonMetrics>,
  key: string
) {
  return metrics.rows.find((r) => r.key === key);
}

describe("prospectus Page 2 Financial Comparison Metrics (DATA STAGE 4B)", () => {
  const sample = buildProspectusFinancialComparisonMetrics({
    source: SAMPLE_PROSPECTUS_FINANCIAL_COMPARISON_METRICS_SOURCE,
  });

  it("composes from Stage 4A years without reselecting or reordering", () => {
    expect(sample.years.map((y) => y.year)).toEqual(
      SAMPLE_PROSPECTUS_FINANCIAL_COMPARISON_METRICS_SOURCE.years.map((y) => y.year)
    );
    expect(sample.years.map((y) => y.yearLabel)).toEqual(["FY2022", "FY2023", "FY2024"]);
    expect(sample.sectionHeading).toContain("(MYR mil.)");
    expect(sample.sourceFooter).toBe("Source: Audited Financial Statements");
  });

  it("uses exact nine metric rows in approved order", () => {
    expect(sample.rows.map((r) => r.key)).toEqual([...PROSPECTUS_FINANCIAL_COMPARISON_METRIC_KEYS]);
    expect(sample.rows.map((r) => r.label)).toEqual(
      PROSPECTUS_FINANCIAL_COMPARISON_METRIC_KEYS.map(
        (key) => PROSPECTUS_FINANCIAL_COMPARISON_METRIC_LABELS[key]
      )
    );
  });

  it("formats Revenue and PAT as MYR millions for display only", () => {
    expect(formatProspectusMyrMillions(13_900_000)).toBe("13.9");
    expect(formatProspectusMyrMillions(16_200_000)).toBe("16.2");
    expect(formatProspectusMyrMillions(1_200_000)).toBe("1.2");
    expect(row(sample, "revenue")?.values[0]).toBe("13.9");
    expect(row(sample, "profitAfterTax")?.values[0]).toBe("1.2");
    expect(row(sample, "revenue")?.values[0]).not.toContain("RM");
    expect(sample.audit.revenue.formulasUseFullMyr).toBe(true);
    expect(sample.audit.units.millionConversionAllowed).toBe("display_only_revenue_pat");
  });

  it("keeps formulas on full MYR source values", () => {
    // 1_200_000 / 13_900_000 ≈ 8.63%
    expect(row(sample, "netProfitMargin")?.values[0]).toBe("8.63%");
    expect(row(sample, "roe")?.values[0]).toBe("7.4%");
    expect(row(sample, "currentRatio")?.values[0]).toBe("1.62x");
  });

  it("does not use revenue aliases and DNA when turnover missing", () => {
    const source = buildProspectusFinancialComparisonSource({
      financialStatements: {
        questionnaire: { financial_year_end: "2025-12-31" },
        unaudited_by_year: {
          "2025": { revenue: 13_900_000, invoice_value: 13_900_000, plnpat: 1 },
        },
      },
      ctosFinancials: [],
      ref: new Date("2025-07-01T00:00:00.000Z"),
    });
    const metrics = buildProspectusFinancialComparisonMetrics({ source });
    expect(row(metrics, "revenue")?.values[0]).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("formats PAT from plnpat and does not fall back to PBT", () => {
    expect(row(sample, "profitAfterTax")?.values[0]).toBe("1.2");

    const source = buildProspectusFinancialComparisonSource({
      financialStatements: {
        questionnaire: { financial_year_end: "2025-12-31" },
        unaudited_by_year: {
          "2025": { plnpbt: 1_500_000, turnover: 1_000_000 },
        },
      },
      ctosFinancials: [],
      ref: new Date("2025-07-01T00:00:00.000Z"),
    });
    const metrics = buildProspectusFinancialComparisonMetrics({ source });
    expect(row(metrics, "profitAfterTax")?.values[0]).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("reuses shared margin/ROE/current-ratio helpers and never substitutes gearing", () => {
    const moduleSource = readFileSync(
      join(__dirname, "prospectus-financial-comparison-metrics.ts"),
      "utf8"
    );
    expect(moduleSource).toContain("resolveApplicationFinancialProfitMarginRatio");
    expect(moduleSource).toContain("resolveApplicationFinancialReturnOnEquityRatio");
    expect(moduleSource).toContain("resolveApplicationFinancialCurrentRatio");
    expect(moduleSource).not.toContain("calculateGearing");
    expect(moduleSource).toContain("formatProspectusMyrMillions");

    expect(formatProspectusFinancialPercentFromRatio(0.086330935)).toBe("8.63%");
    expect(formatProspectusFinancialMultiple(1.620689655)).toBe("1.62x");
    expect(row(sample, "netDebtEquity")?.values).toEqual([
      PROSPECTUS_DATA_NOT_AVAILABLE,
      PROSPECTUS_DATA_NOT_AVAILABLE,
      PROSPECTUS_DATA_NOT_AVAILABLE,
    ]);
    expect(sample.audit.netDebtEquity.gearingSubstitutionAllowed).toBe(false);
  });

  it("keeps optional overrides empty as DNA and formats entered values", () => {
    const withOverrides = buildProspectusFinancialComparisonMetrics({
      source: SAMPLE_PROSPECTUS_FINANCIAL_COMPARISON_METRICS_SOURCE,
      officerOverrides: {
        "2024-12-31": {
          netDebtEquity: 0.45,
          interestCoverage: 3.2,
          dscr: 1.5,
          receivablesDays: 42,
        },
        "2023-12-31": {
          interestCoverage: 2.1,
        },
      },
    });
    expect(row(withOverrides, "revenue")?.values[2]).toBe("18.6");
    expect(row(withOverrides, "netDebtEquity")?.values[2]).toBe("0.45x");
    expect(row(withOverrides, "interestCoverage")?.values[2]).toBe("3.2x");
    expect(row(withOverrides, "dscr")?.values[2]).toBe("1.5x");
    expect(row(withOverrides, "receivablesDays")?.values[2]).toBe("42");
    expect(row(withOverrides, "interestCoverage")?.values[1]).toBe("2.1x");
    expect(row(withOverrides, "netDebtEquity")?.values[1]).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("keeps override attached to FYE when column order changes and hides unused years", () => {
    const yearsAsc = SAMPLE_PROSPECTUS_FINANCIAL_COMPARISON_METRICS_SOURCE.years;
    const yearsDesc = [...yearsAsc].reverse();
    const overrides = {
      "2022-12-31": { netDebtEquity: 0.1 },
      "2024-12-31": { netDebtEquity: 0.9 },
      "2020-12-31": { netDebtEquity: 7.7 },
    };
    const asc = buildProspectusFinancialComparisonMetrics({
      source: { ...SAMPLE_PROSPECTUS_FINANCIAL_COMPARISON_METRICS_SOURCE, years: yearsAsc },
      officerOverrides: overrides,
    });
    const desc = buildProspectusFinancialComparisonMetrics({
      source: { ...SAMPLE_PROSPECTUS_FINANCIAL_COMPARISON_METRICS_SOURCE, years: yearsDesc },
      officerOverrides: overrides,
    });
    expect(row(asc, "netDebtEquity")?.values[0]).toBe("0.1x");
    expect(row(asc, "netDebtEquity")?.values[2]).toBe("0.9x");
    expect(row(desc, "netDebtEquity")?.values[0]).toBe("0.9x");
    expect(row(desc, "netDebtEquity")?.values[2]).toBe("0.1x");

    const without2022 = buildProspectusFinancialComparisonMetrics({
      source: {
        ...SAMPLE_PROSPECTUS_FINANCIAL_COMPARISON_METRICS_SOURCE,
        years: yearsAsc.filter((y) => y.year !== 2022),
      },
      officerOverrides: overrides,
    });
    expect(row(without2022, "netDebtEquity")?.values).toEqual([
      PROSPECTUS_DATA_NOT_AVAILABLE,
      "0.9x",
    ]);
    // Hidden-year override is not assigned to another year
    expect(
      resolveYearOverride(yearsAsc[0]!, overrides)?.netDebtEquity
    ).toBe(0.1);
  });

  it("Admin table uses FYE ISO keys and matches Preview formatting", () => {
    const metrics = buildProspectusFinancialComparisonMetrics({
      source: SAMPLE_PROSPECTUS_FINANCIAL_COMPARISON_METRICS_SOURCE,
      officerOverrides: {
        "2024-12-31": { dscr: 1.25 },
      },
    });
    const table = toAdminFinancialComparisonTable(metrics);
    expect(table.yearHeaders.map((h) => h.key)).toEqual([
      "2022-12-31",
      "2023-12-31",
      "2024-12-31",
    ]);
    expect(table.rows.find((r) => r.metric === "Revenue")?.values[0]).toBe("13.9");
    expect(table.rows.find((r) => r.metric === "DSCR (x)")?.values[2]).toBe("1.25x");
    expect(table.sourceFooter).toBe(metrics.sourceFooter);
  });

  it("Admin frozen years expose the same Stage 4A raw records for Page 3", () => {
    const frozen = toAdminFrozenFinancialYears(
      SAMPLE_PROSPECTUS_FINANCIAL_COMPARISON_METRICS_SOURCE.years
    );
    expect(frozen.map((y) => y.calendarYear)).toEqual([2022, 2023, 2024]);
    expect(frozen.map((y) => y.financialYearEndIso)).toEqual([
      "2022-12-31",
      "2023-12-31",
      "2024-12-31",
    ]);
    expect(frozen.every((y) => y.sourceType === "CTOS" || y.sourceType === "UNAUDITED")).toBe(
      true
    );
    expect(frozen[0]?.raw.turnover).not.toBeNull();
    expect(frozen[0]?.raw).toMatchObject({
      plnpat: expect.anything(),
      plnpbt: expect.anything(),
      bscatot: expect.anything(),
      curlib: expect.anything(),
    });
  });

  it("parses financial numbers and rejects silent zero for tiny non-zero MYR", () => {
    expect(parseProspectusFinancialNumber("1,200")).toBe(1200);
    expect(formatProspectusMyrMillions(50)).toBe("0.00005");
  });

  it("renders metrics HTML with heading, millions, and source footer", () => {
    const html = buildProspectusFinancialComparisonMetricsDocument(sample);
    expect(html).toContain("(MYR mil.)");
    expect(html).toContain("13.9");
    expect(html).toContain("Source: Audited Financial Statements");
    expect(html).not.toContain("RM 13,900,000");
  });
});
