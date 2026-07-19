import { readFileSync } from "node:fs";
import { join } from "node:path";
import { calculateReturnOnEquity } from "@cashsouk/types";
import { buildProspectusFinancialComparisonSource } from "./prospectus-financial-comparison-source";
import {
  buildProspectusFinancialComparisonMetrics,
  formatProspectusFinancialPercentFromRatio,
} from "./prospectus-financial-comparison-metrics";
import { buildProspectusPageThreeCoverageEfficiency } from "./prospectus-page-three-coverage-efficiency";
import {
  SAMPLE_PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_INPUT,
  SAMPLE_PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_SOURCE,
} from "./prospectus-page-three-coverage-efficiency.sample-data";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_AUDIT,
  PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_ROW_KEYS,
  PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_SECTION_HEADING,
} from "./prospectus-page-three-coverage-efficiency.types";
import { buildProspectusPageThreeCoverageEfficiencyDocument } from "./render-prospectus-page-three-coverage-efficiency";

const DNA_KEYS = [
  "operating_cash_flow",
  "free_cash_flow",
  "interest_coverage",
  "dscr",
  "debt_equity",
  "return_on_assets",
  "receivables_days",
  "payables_days",
  "asset_turnover",
] as const;

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
  return buildProspectusFinancialComparisonSource({
    financialStatements: {
      questionnaire: { financial_year_end: financialYearEnd },
      unaudited_by_year: years,
    },
  });
}

describe("prospectus Page 3 coverage/efficiency (DATA STAGE 4)", () => {
  it("uses static section heading", () => {
    const data = buildProspectusPageThreeCoverageEfficiency(
      SAMPLE_PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_INPUT
    );
    expect(data.sectionHeading).toBe("CASH FLOW, COVERAGE AND EFFICIENCY");
    expect(data.sectionHeading).toBe(
      PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_SECTION_HEADING
    );
  });

  it("keeps exact ten-row order and labels with no Trend column", () => {
    const data = buildProspectusPageThreeCoverageEfficiency(
      SAMPLE_PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_INPUT
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
    expect(data.rows.some((r) => /trend/i.test(r.key) || /trend/i.test(r.label))).toBe(
      false
    );
    expect(PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_AUDIT.trends.implementedInThisStage).toBe(
      false
    );
  });

  it("passes years and FYE labels through unchanged", () => {
    const source = SAMPLE_PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_SOURCE;
    const data = buildProspectusPageThreeCoverageEfficiency({ financialSource: source });
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
    const one = buildProspectusPageThreeCoverageEfficiency({
      financialSource: sourceFromYears({ "2024": { plnpat: 100, bsqpuc: 200 } }),
    });
    expect(one.years).toHaveLength(1);
    expect(one.years.some((y) => y.year === 2023)).toBe(false);

    const empty = buildProspectusPageThreeCoverageEfficiency({
      financialSource: sourceFromYears({}),
    });
    expect(empty.years).toEqual([]);
    for (const r of empty.rows) {
      expect(r.values).toEqual([]);
    }
  });

  it("keeps all unsupported metrics as Data not available despite polluted inputs", () => {
    const polluted = buildProspectusPageThreeCoverageEfficiency({
      financialSource: sourceFromYears({
        "2024": {
          plnpat: 1_200_000,
          bsqpuc: 2_000_000,
          plnpbt: 1_400_000,
          bsfatot: 1_500_000,
          bscatot: 4_700_000,
          curlib: 2_900_000,
          bsslltd: 500_000,
          bsclstd: 200_000,
          turnover: 13_900_000,
          depreciation: 100,
          ocf: 999,
          fcf: 888,
          interest: 50,
          dscr: 1.2,
          inventory: 10,
        },
      }),
    });

    for (const key of DNA_KEYS) {
      expect(row(polluted, key)?.values[0]).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    }

    expect(
      PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_AUDIT.debtEquity
        .calculateGearingSubstitutionAllowed
    ).toBe(false);
    expect(
      PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_AUDIT.debtEquity.bsqpucIsTotalEquity
    ).toBe(false);

    const moduleSource = readFileSync(
      join(__dirname, "prospectus-page-three-coverage-efficiency.ts"),
      "utf8"
    );
    expect(moduleSource).not.toMatch(/calculateGearing/);
    expect(moduleSource).not.toMatch(/computeTotalAssets/);
    expect(moduleSource).not.toMatch(/plnpat\s*\/\s*.*totass/);
    expect(moduleSource).not.toMatch(/\*\s*365/);
  });

  it("reuses calculateReturnOnEquity and matches Page 2", () => {
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

    const zeroPat = buildProspectusPageThreeCoverageEfficiency({
      financialSource: sourceFromYears({ "2024": { plnpat: 0, bsqpuc: 2_000_000 } }),
    });
    expect(row(zeroPat, "return_on_equity")?.values[0]).toBe("0%");

    const missingPat = buildProspectusPageThreeCoverageEfficiency({
      financialSource: sourceFromYears({ "2024": { bsqpuc: 2_000_000 } }),
    });
    expect(row(missingPat, "return_on_equity")?.values[0]).toBe(
      PROSPECTUS_DATA_NOT_AVAILABLE
    );

    const missingEquity = buildProspectusPageThreeCoverageEfficiency({
      financialSource: sourceFromYears({ "2024": { plnpat: 100 } }),
    });
    expect(row(missingEquity, "return_on_equity")?.values[0]).toBe(
      PROSPECTUS_DATA_NOT_AVAILABLE
    );

    const zeroEquity = buildProspectusPageThreeCoverageEfficiency({
      financialSource: sourceFromYears({ "2024": { plnpat: 100, bsqpuc: 0 } }),
    });
    expect(row(zeroEquity, "return_on_equity")?.values[0]).toBe(
      PROSPECTUS_DATA_NOT_AVAILABLE
    );

    const negativePat = buildProspectusPageThreeCoverageEfficiency({
      financialSource: sourceFromYears({ "2024": { plnpat: -250_000, bsqpuc: 2_000_000 } }),
    });
    expect(row(negativePat, "return_on_equity")?.values[0]).toBe(
      formatProspectusFinancialPercentFromRatio(
        calculateReturnOnEquity(-250_000, 2_000_000)
      )
    );

    const moduleSource = readFileSync(
      join(__dirname, "prospectus-page-three-coverage-efficiency.ts"),
      "utf8"
    );
    expect(moduleSource).toMatch(/calculateReturnOnEquity/);
    expect(moduleSource).not.toMatch(/plnpat\s*\/\s*bsqpuc/);
  });

  it("reuses Page 2 source with no independent selection, Application parse, CTOS, Prisma, or snapshot writes", () => {
    const moduleSource = readFileSync(
      join(__dirname, "prospectus-page-three-coverage-efficiency.ts"),
      "utf8"
    );
    expect(moduleSource).not.toMatch(/selectProspectusFinancialComparisonYears/);
    expect(moduleSource).not.toMatch(/unaudited_by_year/);
    expect(moduleSource).not.toMatch(/buildProspectusFinancialComparisonSource/);
    expect(moduleSource).not.toMatch(/prisma/i);
    expect(moduleSource).not.toMatch(/prospectus_snapshot/);
    expect(
      PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_AUDIT.source.ctosFallbackAllowed
    ).toBe(false);
    expect(
      PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_AUDIT.snapshot
        .additionalFieldsRequiredForThisStage
    ).toBe(false);
    expect(
      PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_AUDIT.snapshot
        .liveFallbackForPublishedAllowed
    ).toBe(false);

    const withCtos = buildProspectusPageThreeCoverageEfficiency({
      financialSource: SAMPLE_PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_SOURCE,
      ctosFinancials: { financials: [{ financial_year: 2020, plnpat: 9_999_999 }] },
    });
    expect(withCtos.years.some((y) => y.year === 2020)).toBe(false);
  });

  it("hides audit, shows DNA for unresolved rows, and has no trend language", () => {
    const data = buildProspectusPageThreeCoverageEfficiency(
      SAMPLE_PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_INPUT
    );
    const html = buildProspectusPageThreeCoverageEfficiencyDocument(data);

    for (const key of DNA_KEYS) {
      expect(row(data, key)?.values.every((v) => v === "Data not available")).toBe(true);
    }

    expect(html).toContain("Return on Equity");
    expect(html).toContain("Data not available");
    expect(html).not.toContain("calculateReturnOnEquity");
    expect(html).not.toContain("plnpat");
    expect(html).not.toContain("bsqpuc");
    expect(html).not.toContain("page_3_stage_5");
    expect(html).not.toMatch(/\bTrend\b/);
    expect(html).not.toMatch(/\bUp\b/);
    expect(html).not.toMatch(/\bDown\b/);
    expect(html).not.toMatch(/Improving/i);
    expect(html).not.toMatch(/Declining/i);
    expect(html).not.toMatch(/[↑↓▲▼]/);
  });
});
