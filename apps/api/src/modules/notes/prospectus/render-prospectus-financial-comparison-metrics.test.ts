import { readFileSync } from "node:fs";
import { join } from "node:path";
import { calculateGearing } from "@cashsouk/types";
import { buildProspectusFinancialComparisonSource } from "./prospectus-financial-comparison-source";
import {
  buildProspectusFinancialComparisonMetrics,
  formatProspectusFinancialMultiple,
  formatProspectusFinancialPercentFromRatio,
  parseProspectusFinancialNumber,
} from "./prospectus-financial-comparison-metrics";
import { SAMPLE_PROSPECTUS_FINANCIAL_COMPARISON_METRICS_SOURCE } from "./prospectus-financial-comparison-metrics.sample-data";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_FINANCIAL_COMPARISON_METRIC_KEYS,
  PROSPECTUS_FINANCIAL_COMPARISON_METRIC_LABELS,
} from "./prospectus-financial-comparison-metrics.types";
import { formatProspectusMoneyMyr } from "./prospectus-main-financial-terms";
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
    expect(sample.sectionHeading).toBe(
      SAMPLE_PROSPECTUS_FINANCIAL_COMPARISON_METRICS_SOURCE.sectionHeading
    );
  });

  it("uses exact nine metric rows in approved order", () => {
    expect(sample.rows.map((r) => r.key)).toEqual([...PROSPECTUS_FINANCIAL_COMPARISON_METRIC_KEYS]);
    expect(sample.rows.map((r) => r.label)).toEqual(
      PROSPECTUS_FINANCIAL_COMPARISON_METRIC_KEYS.map(
        (key) => PROSPECTUS_FINANCIAL_COMPARISON_METRIC_LABELS[key]
      )
    );
  });

  it("formats Revenue from turnover with full MYR", () => {
    expect(row(sample, "revenue")?.values[0]).toBe("RM 13,900,000.00");
    expect(formatProspectusMoneyMyr(13_900_000)).toBe("RM 13,900,000.00");
  });

  it("does not use revenue aliases and DNA when turnover missing", () => {
    const source = buildProspectusFinancialComparisonSource({
      financialStatements: {
        questionnaire: { financial_year_end: "2027-12-31" },
        unaudited_by_year: {
          "2024": { revenue: 13_900_000, invoice_value: 13_900_000, plnpat: 1 },
        },
      },
    });
    const metrics = buildProspectusFinancialComparisonMetrics({ source });
    expect(row(metrics, "revenue")?.values[0]).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("formats PAT from plnpat and does not fall back to PBT", () => {
    expect(row(sample, "profitAfterTax")?.values[0]).toBe("RM 1,200,000.00");

    const source = buildProspectusFinancialComparisonSource({
      financialStatements: {
        questionnaire: { financial_year_end: "2027-12-31" },
        unaudited_by_year: {
          "2024": { plnpbt: 1_500_000, turnover: 1_000_000 },
        },
      },
    });
    const metrics = buildProspectusFinancialComparisonMetrics({ source });
    expect(row(metrics, "profitAfterTax")?.values[0]).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("reuses shared margin/ROE/current-ratio helpers with correct formatting", () => {
    const moduleSource = readFileSync(
      join(__dirname, "prospectus-financial-comparison-metrics.ts"),
      "utf8"
    );
    expect(moduleSource).toContain("calculateProfitMargin");
    expect(moduleSource).toContain("calculateReturnOnEquity");
    expect(moduleSource).toContain("calculateCurrentRatio");
    expect(moduleSource).not.toContain("calculateGearing");

    expect(row(sample, "netProfitMargin")?.values[0]).toBe("8.63%");
    expect(row(sample, "roe")?.values[0]).toBe("7.4%");
    expect(row(sample, "currentRatio")?.values[0]).toBe("1.62x");
    expect(formatProspectusFinancialPercentFromRatio(0.086330935)).toBe("8.63%");
    expect(formatProspectusFinancialMultiple(1.620689655)).toBe("1.62x");
  });

  it("returns DNA for zero turnover, zero equity, and zero current liabilities", () => {
    const source = buildProspectusFinancialComparisonSource({
      financialStatements: {
        questionnaire: { financial_year_end: "2027-12-31" },
        unaudited_by_year: {
          "2024": {
            turnover: 0,
            plnpat: 100,
            bsqpuc: 0,
            bscatot: 100,
            curlib: 0,
          },
        },
      },
    });
    const metrics = buildProspectusFinancialComparisonMetrics({ source });
    expect(row(metrics, "netProfitMargin")?.values[0]).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(row(metrics, "roe")?.values[0]).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(row(metrics, "currentRatio")?.values[0]).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("keeps unsupported metrics DNA without officer overrides and does not substitute gearing", () => {
    expect(calculateGearing(2_900_000, 1_000_000, 500_000, 16_216_216)).not.toBeNull();
    expect(row(sample, "netDebtEquity")?.values).toEqual([
      PROSPECTUS_DATA_NOT_AVAILABLE,
      PROSPECTUS_DATA_NOT_AVAILABLE,
      PROSPECTUS_DATA_NOT_AVAILABLE,
    ]);
    expect(row(sample, "interestCoverage")?.values[0]).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(row(sample, "dscr")?.values[0]).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(row(sample, "receivablesDays")?.values[0]).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(sample.audit.netDebtEquity.gearingSubstitutionAllowed).toBe(false);
  });

  it("applies officer overrides for unsupported metrics per year without changing system metrics", () => {
    const metrics = buildProspectusFinancialComparisonMetrics({
      source: SAMPLE_PROSPECTUS_FINANCIAL_COMPARISON_METRICS_SOURCE,
      officerOverrides: {
        "2024": {
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
    expect(row(metrics, "revenue")?.values[2]).toBe("RM 18,600,000.00");
    expect(row(metrics, "netDebtEquity")?.values[2]).toBe("0.45x");
    expect(row(metrics, "interestCoverage")?.values[2]).toBe("3.2x");
    expect(row(metrics, "dscr")?.values[2]).toBe("1.5x");
    expect(row(metrics, "receivablesDays")?.values[2]).toBe("42");
    expect(row(metrics, "interestCoverage")?.values[1]).toBe("2.1x");
    expect(row(metrics, "netDebtEquity")?.values[1]).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("ignores CTOS and inherits Stage 4A unit label without a source note field", () => {
    const metrics = buildProspectusFinancialComparisonMetrics({
      source: SAMPLE_PROSPECTUS_FINANCIAL_COMPARISON_METRICS_SOURCE,
      ctosFinancials: { financials: [{ financial_year: 2024, turnover: 99_999_999 }] },
    });
    expect(row(metrics, "revenue")?.values[2]).toBe("RM 18,600,000.00");
    expect(metrics.tableUnitLabel).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(metrics).not.toHaveProperty("sourceNote");
    expect(metrics.audit.source.ctosUsed).toBe(false);
    expect(metrics.audit.source.inheritedFromStage4A).toBe(true);
  });

  it("supports one/two/three/empty Stage 4A year counts", () => {
    const one = buildProspectusFinancialComparisonMetrics({
      source: buildProspectusFinancialComparisonSource({
        financialStatements: {
          questionnaire: { financial_year_end: "2027-12-31" },
          unaudited_by_year: { "2024": { turnover: 100, plnpat: 10 } },
        },
      }),
    });
    expect(one.years).toHaveLength(1);
    expect(row(one, "revenue")?.values).toHaveLength(1);

    const two = buildProspectusFinancialComparisonMetrics({
      source: buildProspectusFinancialComparisonSource({
        financialStatements: {
          questionnaire: { financial_year_end: "2027-12-31" },
          unaudited_by_year: {
            "2023": { turnover: 100 },
            "2024": { turnover: 200 },
          },
        },
      }),
    });
    expect(two.years.map((y) => y.year)).toEqual([2023, 2024]);
    expect(row(two, "revenue")?.values).toHaveLength(2);

    const empty = buildProspectusFinancialComparisonMetrics({
      source: buildProspectusFinancialComparisonSource({
        financialStatements: {
          questionnaire: { financial_year_end: "2027-12-31" },
          unaudited_by_year: { draft: { turnover: 1 } },
        },
      }),
    });
    expect(empty.years).toHaveLength(0);
    expect(row(empty, "revenue")?.values).toEqual([]);
  });

  it("parses explicit zero as a real value and missing as null", () => {
    expect(parseProspectusFinancialNumber(0)).toBe(0);
    expect(parseProspectusFinancialNumber("0")).toBe(0);
    expect(parseProspectusFinancialNumber(undefined)).toBeNull();
    expect(parseProspectusFinancialNumber("")).toBeNull();
    expect(formatProspectusMoneyMyr(0)).toBe("RM 0.00");
  });

  it("HTML shows full MYR money cells without compact/million conversion or audit", () => {
    const html = buildProspectusFinancialComparisonMetricsDocument(sample);
    expect(html).toContain("RM 13,900,000.00");
    expect(html).toContain("RM 1,200,000.00");
    expect(html).toContain("RM 18,600,000.00");
    expect(html).toContain("8.63%");
    expect(html).toContain("1.62x");
    expect(html).not.toContain("p.a.");
    expect(html).toContain("Net Debt / Equity");
    expect(html).toContain("Interest Coverage");
    expect(html).toContain("DSCR");
    expect(html).toContain("Receivables Days");

    expect(html).not.toMatch(/RM 13\.9|RM 1\.2m|\bmil\b|million/);
    const moduleSource = readFileSync(
      join(__dirname, "prospectus-financial-comparison-metrics.ts"),
      "utf8"
    );
    expect(moduleSource).not.toContain("1_000_000");
    expect(moduleSource).not.toMatch(/\/\s*1_?000_?000/);

    expect(html).not.toContain("Source Note:");
    expect(html).not.toMatch(/Source: Data not available/);
    expect(html).not.toContain("formulaOwnedBySharedHelper");
    expect(html).not.toContain("gearingSubstitutionAllowed");
    expect(html).not.toContain("ctosUsed");
    expect(html).not.toContain("snapshotDecision");
    expect(html).not.toContain('"audit"');
  });
});
