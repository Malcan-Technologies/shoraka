import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildNormalizedFinancialStatementYearSet,
  FINANCIAL_STATEMENT_SOURCE_FOOTER,
  selectLatestNormalizedFinancialStatementYears,
} from "@cashsouk/types";
import {
  buildProspectusFinancialComparisonSource,
  formatProspectusFinancialYearEndLabel,
  formatProspectusFinancialYearLabel,
  selectProspectusFinancialComparisonYears,
} from "./prospectus-financial-comparison-source";
import { SAMPLE_PROSPECTUS_FINANCIAL_COMPARISON_SOURCE_INPUT } from "./prospectus-financial-comparison-source.sample-data";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_FINANCIAL_COMPARISON_SECTION_HEADING,
  PROSPECTUS_FINANCIAL_COMPARISON_SOURCE_FIELD_SOURCES,
} from "./prospectus-financial-comparison-source.types";
import { buildProspectusFinancialComparisonSourceDocument } from "./render-prospectus-financial-comparison-source";

function ctosRow(year: number, turnover: number) {
  return {
    financial_year: year,
    dates: { pldd: `${year}-12-31`, bsdd: null },
    account: { turnover, plnpat: 1, bsqpuc: 1, bscatot: 1, curlib: 1 },
  };
}

describe("prospectus Page 2 Financial Comparison Source (DATA STAGE 4A)", () => {
  it("uses static section heading with MYR mil.", () => {
    const data = buildProspectusFinancialComparisonSource(
      SAMPLE_PROSPECTUS_FINANCIAL_COMPARISON_SOURCE_INPUT
    );
    expect(data.sectionHeading).toBe("3-YEAR FINANCIAL COMPARISON (MYR mil.)");
    expect(data.sectionHeading).toBe(PROSPECTUS_FINANCIAL_COMPARISON_SECTION_HEADING);
    expect(data.tableUnitLabel).toBe("(MYR mil.)");
  });

  it("uses the same normalized Admin Financial Statements year set", () => {
    const data = buildProspectusFinancialComparisonSource(
      SAMPLE_PROSPECTUS_FINANCIAL_COMPARISON_SOURCE_INPUT
    );
    expect(data.audit.source.selectedSource).toBe("admin_financial_statements_normalized");
    expect(data.audit.source.ctosUsed).toBe(true);
    expect(data.audit.source.precedence).toBe("ctos_audited_over_unaudited_same_year");
    // CTOS 2020–2024 → latest three ascending
    expect(data.years.map((y) => y.year)).toEqual([2022, 2023, 2024]);
    expect(data.years.map((y) => y.recordSource)).toEqual([
      "ctos_audited",
      "ctos_audited",
      "ctos_audited",
    ]);
    expect(data.years.every((y) => /^\d{4}-\d{2}-\d{2}$/.test(y.financialYearEndIso))).toBe(
      true
    );
  });

  it("gives CTOS precedence when the same FY appears in unaudited", () => {
    const data = buildProspectusFinancialComparisonSource({
      financialStatements: {
        questionnaire: { financial_year_end: "2025-12-31" },
        unaudited_by_year: {
          "2024": { turnover: 100, pldd: "2024-12-31" },
          "2025": { turnover: 200, pldd: "2025-12-31" },
        },
      },
      ctosFinancials: [ctosRow(2023, 1), ctosRow(2024, 9_999), ctosRow(2025, 8_888)],
      ref: new Date("2025-03-01T00:00:00.000Z"),
    });
    expect(data.years.map((y) => y.year)).toEqual([2023, 2024, 2025]);
    expect(data.years.every((y) => y.recordSource === "ctos_audited")).toBe(true);
    expect(data.years.find((y) => y.year === 2024)?.rawFinancials.turnover).toBe(9_999);
  });

  it("preserves six-month SSM deadline behaviour for unaudited tab years", () => {
    const beforeDeadline = buildNormalizedFinancialStatementYearSet({
      financialStatements: {
        questionnaire: { financial_year_end: "2025-12-31" },
        unaudited_by_year: {
          "2024": { turnover: 1 },
          "2025": { turnover: 2 },
        },
      },
      ctosFinancials: [],
      ref: new Date("2025-03-01T00:00:00.000Z"),
    });
    expect(beforeDeadline.map((y) => y.year)).toEqual([2024, 2025]);

    const afterDeadline = buildNormalizedFinancialStatementYearSet({
      financialStatements: {
        questionnaire: { financial_year_end: "2025-12-31" },
        unaudited_by_year: {
          "2024": { turnover: 1 },
          "2025": { turnover: 2 },
        },
      },
      ctosFinancials: [],
      ref: new Date("2025-07-01T00:00:00.000Z"),
    });
    expect(afterDeadline.map((y) => y.year)).toEqual([2025]);
  });

  it("selects latest three and displays oldest to newest", () => {
    expect(
      selectProspectusFinancialComparisonYears(["2021", "2024", "2022", "2023"])
    ).toEqual([2022, 2023, 2024]);

    const available = buildNormalizedFinancialStatementYearSet({
      financialStatements: {
        questionnaire: { financial_year_end: "2027-12-31" },
        unaudited_by_year: {},
      },
      ctosFinancials: [
        ctosRow(2020, 1),
        ctosRow(2021, 2),
        ctosRow(2022, 3),
        ctosRow(2023, 4),
        ctosRow(2024, 5),
      ],
    });
    expect(selectLatestNormalizedFinancialStatementYears(available, 3).map((y) => y.year)).toEqual(
      [2022, 2023, 2024]
    );
  });

  it("supports one-year and two-year cases", () => {
    const one = buildProspectusFinancialComparisonSource({
      financialStatements: {
        questionnaire: { financial_year_end: "2025-12-31" },
        unaudited_by_year: { "2025": { turnover: 1, pldd: "2025-12-31" } },
      },
      ctosFinancials: [],
      ref: new Date("2025-07-01T00:00:00.000Z"),
    });
    expect(one.years.map((y) => y.year)).toEqual([2025]);

    const two = buildProspectusFinancialComparisonSource({
      financialStatements: {
        questionnaire: { financial_year_end: "2025-12-31" },
        unaudited_by_year: {
          "2024": { turnover: 1, pldd: "2024-12-31" },
          "2025": { turnover: 2, pldd: "2025-12-31" },
        },
      },
      ctosFinancials: [],
      ref: new Date("2025-03-01T00:00:00.000Z"),
    });
    expect(two.years.map((y) => y.year)).toEqual([2024, 2025]);
  });

  it("skips missing SSM year, keeps latest three with data, and sets Ops warning", () => {
    const data = buildProspectusFinancialComparisonSource({
      financialStatements: {
        questionnaire: { financial_year_end: "2026-12-31" },
        unaudited_by_year: {
          "2025": { turnover: 500, plnpat: 50, pldd: "2025-12-31" },
        },
      },
      ctosFinancials: [ctosRow(2023, 1), ctosRow(2024, 2)],
      ref: new Date("2026-03-01T00:00:00.000Z"),
    });
    expect(data.years.map((y) => y.year)).toEqual([2023, 2024, 2025]);
    expect(data.years.map((y) => y.year)).not.toContain(2026);
    expect(data.missingSsmUnauditedYears).toEqual([2026]);
    expect(data.opsWarning).toContain("FY2026");
    expect(data.opsWarning).toContain("does not block approval");
  });

  it("formats FY labels and FYE display labels", () => {
    expect(formatProspectusFinancialYearLabel(2024)).toBe("FY2024");
    expect(formatProspectusFinancialYearEndLabel("2024-12-31")).toBe("31 Dec 2024");
    expect(formatProspectusFinancialYearEndLabel(null)).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("builds accurate source footers", () => {
    const audited = buildProspectusFinancialComparisonSource({
      financialStatements: {
        questionnaire: { financial_year_end: "2027-12-31" },
        unaudited_by_year: {},
      },
      ctosFinancials: [ctosRow(2022, 1), ctosRow(2023, 2), ctosRow(2024, 3)],
    });
    expect(audited.sourceFooter).toBe(FINANCIAL_STATEMENT_SOURCE_FOOTER.audited);

    const management = buildProspectusFinancialComparisonSource({
      financialStatements: {
        questionnaire: { financial_year_end: "2025-12-31" },
        unaudited_by_year: {
          "2024": { turnover: 1 },
          "2025": { turnover: 2 },
        },
      },
      ctosFinancials: [],
      ref: new Date("2025-03-01T00:00:00.000Z"),
    });
    expect(management.sourceFooter).toBe(FINANCIAL_STATEMENT_SOURCE_FOOTER.management);

    const mixed = buildProspectusFinancialComparisonSource({
      financialStatements: {
        questionnaire: { financial_year_end: "2025-12-31" },
        unaudited_by_year: {
          "2025": { turnover: 200, pldd: "2025-12-31" },
        },
      },
      ctosFinancials: [ctosRow(2023, 1), ctosRow(2024, 2)],
      ref: new Date("2025-03-01T00:00:00.000Z"),
    });
    expect(mixed.sourceFooter).toBe(FINANCIAL_STATEMENT_SOURCE_FOOTER.mixed);

    const empty = buildProspectusFinancialComparisonSource({
      financialStatements: {
        questionnaire: { financial_year_end: "2027-12-31" },
        unaudited_by_year: {},
      },
      ctosFinancials: [],
    });
    expect(empty.sourceFooter).toBe(FINANCIAL_STATEMENT_SOURCE_FOOTER.neutral);
  });

  it("documents field sources for the shared resolver", () => {
    expect(PROSPECTUS_FINANCIAL_COMPARISON_SOURCE_FIELD_SOURCES.years.canonicalSource).toBe(
      "admin_financial_statements_normalized"
    );
    const moduleSource = readFileSync(
      join(__dirname, "prospectus-financial-comparison-source.ts"),
      "utf8"
    );
    expect(moduleSource).toContain("buildNormalizedFinancialStatementYearSet");
    expect(moduleSource).toContain("selectLatestNormalizedFinancialStatementYears");
  });

  it("renders a source preview document", () => {
    const html = buildProspectusFinancialComparisonSourceDocument(
      buildProspectusFinancialComparisonSource(SAMPLE_PROSPECTUS_FINANCIAL_COMPARISON_SOURCE_INPUT)
    );
    expect(html).toContain("FY2022");
    expect(html).toContain("FY2024");
  });
});
