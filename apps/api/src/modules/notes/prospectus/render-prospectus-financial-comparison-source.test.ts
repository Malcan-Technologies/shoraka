import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildProspectusFinancialComparisonSource,
  formatProspectusFinancialYearEndLabel,
  formatProspectusFinancialYearLabel,
  selectProspectusFinancialComparisonYears,
} from "./prospectus-financial-comparison-source";
import { SAMPLE_PROSPECTUS_FINANCIAL_COMPARISON_SOURCE_INPUT } from "./prospectus-financial-comparison-source.sample-data";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_FINANCIAL_COMPARISON_SOURCE_FIELD_SOURCES,
  PROSPECTUS_FINANCIAL_COMPARISON_SECTION_HEADING,
} from "./prospectus-financial-comparison-source.types";
import { buildProspectusFinancialComparisonSourceDocument } from "./render-prospectus-financial-comparison-source";

function unauditedYears(
  years: Record<string, Record<string, unknown>>,
  financialYearEnd = "2027-12-31"
) {
  return {
    financialStatements: {
      questionnaire: { financial_year_end: financialYearEnd },
      unaudited_by_year: years,
    },
  };
}

describe("prospectus Page 2 Financial Comparison Source (DATA STAGE 4A)", () => {
  it("uses static section heading", () => {
    const data = buildProspectusFinancialComparisonSource(
      SAMPLE_PROSPECTUS_FINANCIAL_COMPARISON_SOURCE_INPUT
    );
    expect(data.sectionHeading).toBe("3-YEAR FINANCIAL COMPARISON");
    expect(data.sectionHeading).toBe(PROSPECTUS_FINANCIAL_COMPARISON_SECTION_HEADING);
  });

  it("uses Application unaudited_by_year and ignores CTOS", () => {
    const data = buildProspectusFinancialComparisonSource(
      SAMPLE_PROSPECTUS_FINANCIAL_COMPARISON_SOURCE_INPUT
    );
    expect(data.audit.source.selectedSource).toBe("application_financial_statements");
    expect(data.audit.source.path).toBe(
      "applications.financial_statements.unaudited_by_year"
    );
    expect(data.audit.source.ctosUsed).toBe(false);
    expect(data.audit.source.sourceMixingAllowed).toBe(false);
    expect(data.years.map((y) => y.year)).toEqual([2022, 2023, 2024]);
    expect(data.years.some((y) => y.rawFinancials.turnover === 9_999_999)).toBe(false);
  });

  it("does not fill Application gaps from CTOS", () => {
    const data = buildProspectusFinancialComparisonSource({
      financialStatements: {
        questionnaire: { financial_year_end: "2027-12-31" },
        unaudited_by_year: {
          "2024": { turnover: 100 },
        },
      },
      ctosFinancials: {
        financials: [
          { financial_year: 2022, turnover: 1 },
          { financial_year: 2023, turnover: 2 },
          { financial_year: 2024, turnover: 3 },
        ],
      },
    });
    expect(data.years).toHaveLength(1);
    expect(data.years[0]?.year).toBe(2024);
    expect(data.years[0]?.rawFinancials.turnover).toBe(100);
  });

  it("selects latest three valid years in ascending display order", () => {
    expect(
      selectProspectusFinancialComparisonYears(["2021", "2024", "2022", "2023"])
    ).toEqual([2022, 2023, 2024]);

    const data = buildProspectusFinancialComparisonSource(
      SAMPLE_PROSPECTUS_FINANCIAL_COMPARISON_SOURCE_INPUT
    );
    expect(data.years.map((y) => y.yearLabel)).toEqual(["FY2022", "FY2023", "FY2024"]);
  });

  it("ignores object insertion order and invalid year keys", () => {
    const data = buildProspectusFinancialComparisonSource(
      unauditedYears({
        "2020": { turnover: 1 },
        FY2024: { turnover: 2 },
        "2024/25": { turnover: 3 },
        draft: { turnover: 4 },
        "2025": { turnover: 5 },
        "2023": { turnover: 6 },
        "2021": { turnover: 7 },
        "2022": { turnover: 8 },
        "2024": { turnover: 9 },
      })
    );
    expect(data.years.map((y) => y.year)).toEqual([2023, 2024, 2025]);
    expect(data.years).toHaveLength(3);
  });

  it("supports two years, one year, and empty years", () => {
    const two = buildProspectusFinancialComparisonSource(
      unauditedYears({
        "2023": { turnover: 1 },
        "2024": { turnover: 2 },
      })
    );
    expect(two.years.map((y) => y.year)).toEqual([2023, 2024]);

    const one = buildProspectusFinancialComparisonSource(
      unauditedYears({
        "2024": { turnover: 1 },
      })
    );
    expect(one.years.map((y) => y.year)).toEqual([2024]);

    const none = buildProspectusFinancialComparisonSource(
      unauditedYears({
        draft: { turnover: 1 },
        FY2024: { turnover: 2 },
      })
    );
    expect(none.years).toEqual([]);
  });

  it("formats year labels and financial year-end from questionnaire ISO", () => {
    expect(formatProspectusFinancialYearLabel(2024)).toBe("FY2024");
    expect(formatProspectusFinancialYearEndLabel("2027-12-31", 2024)).toBe("31 Dec 2024");

    const data = buildProspectusFinancialComparisonSource(
      SAMPLE_PROSPECTUS_FINANCIAL_COMPARISON_SOURCE_INPUT
    );
    expect(data.years.map((y) => y.financialYearEndLabel)).toEqual([
      "31 Dec 2022",
      "31 Dec 2023",
      "31 Dec 2024",
    ]);
  });

  it("returns DNA for missing/invalid financial year end and does not hardcode December", () => {
    const noFye = buildProspectusFinancialComparisonSource({
      financialStatements: {
        questionnaire: {},
        unaudited_by_year: {
          "2024": { turnover: 1 },
        },
      },
    });
    expect(noFye.years[0]?.financialYearEndLabel).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(JSON.stringify(noFye.years)).not.toContain("31 Dec");

    const invalid = buildProspectusFinancialComparisonSource({
      financialStatements: {
        questionnaire: { financial_year_end: "31 December" },
        unaudited_by_year: { "2024": { turnover: 1 } },
      },
    });
    expect(invalid.years[0]?.financialYearEndLabel).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(formatProspectusFinancialYearEndLabel(null, 2024)).toBe(
      PROSPECTUS_DATA_NOT_AVAILABLE
    );
  });

  it("keeps table unit unresolved without audited/mil claims and has no source note field", () => {
    const data = buildProspectusFinancialComparisonSource(
      SAMPLE_PROSPECTUS_FINANCIAL_COMPARISON_SOURCE_INPUT
    );
    expect(data.tableUnitLabel).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(PROSPECTUS_FINANCIAL_COMPARISON_SOURCE_FIELD_SOURCES.tableUnitLabel.availability).toBe(
      "unresolved"
    );
    expect(data).not.toHaveProperty("sourceNote");
    expect(
      "sourceNote" in PROSPECTUS_FINANCIAL_COMPARISON_SOURCE_FIELD_SOURCES
    ).toBe(false);
  });

  it("preserves raw year financial objects for Stage 4B", () => {
    const data = buildProspectusFinancialComparisonSource(
      SAMPLE_PROSPECTUS_FINANCIAL_COMPARISON_SOURCE_INPUT
    );
    expect(data.years[0]?.rawFinancials.turnover).toBe(2022 * 100_000);
    expect(data.years[2]?.rawFinancials.plnpat).toBe(2024 * 10_000);
    expect(data.years[1]?.rawFinancials).toMatchObject({
      turnover: 2023 * 100_000,
      plnpat: 2023 * 10_000,
    });
  });

  it("does not introduce million conversion helpers", () => {
    const moduleSource = readFileSync(
      join(__dirname, "prospectus-financial-comparison-source.ts"),
      "utf8"
    );
    expect(moduleSource).not.toContain("1000000");
    expect(moduleSource).not.toContain("1_000_000");
    expect(moduleSource).not.toMatch(/\/\s*1_?000_?000/);
  });

  it("HTML proves year order and hides audit/claims/compact units", () => {
    const data = buildProspectusFinancialComparisonSource(
      SAMPLE_PROSPECTUS_FINANCIAL_COMPARISON_SOURCE_INPUT
    );
    const html = buildProspectusFinancialComparisonSourceDocument(data);

    expect(html).toContain("3-YEAR FINANCIAL COMPARISON");
    expect(html).toContain("FY2022");
    expect(html).toContain("FY2023");
    expect(html).toContain("FY2024");
    expect(html.indexOf("FY2022")).toBeLessThan(html.indexOf("FY2023"));
    expect(html.indexOf("FY2023")).toBeLessThan(html.indexOf("FY2024"));
    expect(html).toContain("31 Dec 2022");
    expect(html).toContain("Table Unit Label: Data not available");
    expect(html).not.toContain("Source Note:");
    expect(html).not.toContain("Source:");

    expect(html).not.toContain("Audited Financial Statements");
    expect(html).not.toContain("Management Account");
    expect(html).not.toContain("MYR mil");
    expect(html).not.toContain("RM mil");
    expect(html).not.toContain("million");
    expect(html).not.toContain("selectedSource");
    expect(html).not.toContain("ctosUsed");
    expect(html).not.toContain("sourceMixingAllowed");
    expect(html).not.toContain("selectionRule");
    expect(html).not.toContain("snapshotDecision");
    expect(html).not.toContain('"audit"');
  });

  it("audit records live Application freeze-at-publication status", () => {
    const data = buildProspectusFinancialComparisonSource(
      SAMPLE_PROSPECTUS_FINANCIAL_COMPARISON_SOURCE_INPUT
    );
    expect(data.audit.snapshot.sourceType).toBe("live_application_financial_statements");
    expect(data.audit.snapshot.isFrozen).toBe(false);
    expect(data.audit.snapshot.snapshotDecision).toBe("freeze_at_publication");
    expect(data.audit.financialYearEnd.hardcodedDecemberAllowed).toBe(false);
    expect(data.audit.tableUnits.millionConversionAllowed).toBe(false);
    expect(data.audit).not.toHaveProperty("sourceNote");
  });
});
