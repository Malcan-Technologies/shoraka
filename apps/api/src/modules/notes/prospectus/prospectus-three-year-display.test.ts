import { buildProspectusFinancialComparisonSource } from "./prospectus-financial-comparison-source";
import type { ProspectusFinancialComparisonYear } from "./prospectus-financial-comparison-source.types";
import { buildProspectusPageThree } from "./prospectus-page-three-mapper";
import { buildProspectusPageTwo } from "./prospectus-page-two-mapper";
import { buildProspectusPage2FinancialComparisonSnapshot } from "./prospectus-page-two-snapshot";
import {
  buildProspectusThreeYearDisplaySet,
  derivePlaceholderFinancialYearEndIso,
  selectRealProspectusFinancialYears,
  withProspectusThreeYearDisplay,
} from "./prospectus-three-year-display";

function realYear(
  year: number,
  fyeIso = `${year}-12-31`
): ProspectusFinancialComparisonYear {
  return {
    year,
    yearLabel: `FY${year}`,
    financialYearEndIso: fyeIso,
    financialYearEndLabel: `31 Dec ${year}`,
    recordSource: "unaudited_management",
    rawFinancials: { turnover: 1_000_000, plnpat: 100_000 },
    isPlaceholder: false,
  };
}

describe("buildProspectusThreeYearDisplaySet", () => {
  it("pads one real year to Y-2 | Y-1 | Y with placeholders", () => {
    const display = buildProspectusThreeYearDisplaySet([realYear(2026)]);
    expect(display.map((y) => y.year)).toEqual([2024, 2025, 2026]);
    expect(display.map((y) => y.isPlaceholder)).toEqual([true, true, false]);
    expect(display[0]?.rawFinancials).toEqual({});
    expect(display[2]?.rawFinancials.turnover).toBe(1_000_000);
    expect(display[0]?.financialYearEndLabel).toBe("31 Dec 2024");
    expect(display[1]?.financialYearEndLabel).toBe("31 Dec 2025");
  });

  it("pads two consecutive real years with one left placeholder", () => {
    const display = buildProspectusThreeYearDisplaySet([
      realYear(2025),
      realYear(2026),
    ]);
    expect(display.map((y) => y.year)).toEqual([2024, 2025, 2026]);
    expect(display.map((y) => y.isPlaceholder)).toEqual([true, false, false]);
  });

  it("keeps three real years without placeholders", () => {
    const display = buildProspectusThreeYearDisplaySet([
      realYear(2024),
      realYear(2025),
      realYear(2026),
    ]);
    expect(display.map((y) => y.year)).toEqual([2024, 2025, 2026]);
    expect(display.every((y) => !y.isPlaceholder)).toBe(true);
  });

  it("fills a gap inside the Y-2..Y window without shifting older real years", () => {
    const display = buildProspectusThreeYearDisplaySet([
      realYear(2024),
      realYear(2026),
    ]);
    expect(display.map((y) => y.year)).toEqual([2024, 2025, 2026]);
    expect(display.map((y) => !!y.isPlaceholder)).toEqual([false, true, false]);
    expect(display[0]?.rawFinancials.turnover).toBe(1_000_000);
    expect(display[1]?.rawFinancials).toEqual({});
  });

  it("uses latest three real years as the display window when more than three exist", () => {
    const display = buildProspectusThreeYearDisplaySet([
      realYear(2022),
      realYear(2023),
      realYear(2024),
      realYear(2025),
      realYear(2026),
    ]);
    // Helper pads around latest; callers pass already-selected latest≤3.
    // When given five, still anchors on latest → 2024|2025|2026.
    expect(display.map((y) => y.year)).toEqual([2024, 2025, 2026]);
    expect(display.every((y) => !y.isPlaceholder)).toBe(true);
  });

  it("returns empty when there are zero real years (no invented calendar year)", () => {
    expect(buildProspectusThreeYearDisplaySet([])).toEqual([]);
  });

  it("uses DNA for FYE label when month/day cannot be derived safely", () => {
    const display = buildProspectusThreeYearDisplaySet([
      {
        ...realYear(2026),
        financialYearEndIso: "not-a-date",
        financialYearEndLabel: "—",
      },
    ]);
    expect(display[0]?.financialYearEndLabel).toBe("—");
    expect(display[0]?.financialYearEndIso).toBe("");
  });
});

describe("derivePlaceholderFinancialYearEndIso", () => {
  it("rejects 29 Feb on non-leap years", () => {
    expect(derivePlaceholderFinancialYearEndIso(2025, "2024-02-29")).toBeNull();
    expect(derivePlaceholderFinancialYearEndIso(2024, "2028-02-29")).toBe("2024-02-29");
  });
});

describe("selectRealProspectusFinancialYears", () => {
  it("drops placeholders", () => {
    const display = buildProspectusThreeYearDisplaySet([realYear(2026)]);
    expect(selectRealProspectusFinancialYears(display).map((y) => y.year)).toEqual([2026]);
  });
});

describe("Prospectus page builders + freeze", () => {
  const liveFs = {
    questionnaire: { financial_year_end: "2026-12-31" },
    unaudited_by_year: {
      "2026": {
        turnover: 5_000_000,
        plnpat: 500_000,
        pldd: "2026-12-31",
      },
    },
  };

  it("Page 2 and Page 3 share the same three display years for one real year", () => {
    const page2 = buildProspectusPageTwo({
      noteId: "n1",
      noteReference: "N-1",
      isPublished: false,
      financialMode: "live_unpublished_preview",
      issuerSnapshot: { name: "Co" },
      invoiceSnapshot: {},
      paymasterSnapshot: {},
      maturityDate: null,
      liveFinancialStatements: liveFs,
      liveCtosFinancials: null,
      frozenFinancialComparison: null,
    });
    const page3 = buildProspectusPageThree({
      noteId: "n1",
      isPublished: false,
      financialMode: "live_unpublished_preview",
      issuerSnapshot: { name: "Co" },
      invoiceSnapshot: {},
      paymasterSnapshot: {},
      liveFinancialStatements: liveFs,
      liveCtosFinancials: null,
      frozenFinancialComparison: null,
    });

    expect(page2.financialComparisonSource.years.map((y) => y.year)).toEqual([
      2024, 2025, 2026,
    ]);
    expect(page3.incomeStatement.years.map((y) => y.year)).toEqual([2024, 2025, 2026]);
    expect(page3.balanceSheet.years.map((y) => y.year)).toEqual([2024, 2025, 2026]);
    expect(page3.coverageEfficiency.years.map((y) => y.year)).toEqual([
      2024, 2025, 2026,
    ]);
    expect(page2.financialComparisonMetrics.rows[0]?.values).toEqual(["—", "—", "5"]);
    expect(page3.trends.trends.every((t) => t.trend === "—" || !t.approved)).toBe(true);
  });

  it("freeze snapshot stores only real years, not display placeholders", () => {
    const snap = buildProspectusPage2FinancialComparisonSnapshot({
      financialStatements: liveFs,
      ctosFinancials: null,
      now: new Date("2026-07-01T00:00:00.000Z"),
    });
    expect(snap.selected_years.map((y) => y.year)).toEqual([2026]);

    const source = buildProspectusFinancialComparisonSource({
      financialStatements: liveFs,
      ref: new Date("2026-07-01T00:00:00.000Z"),
    });
    expect(source.years.map((y) => y.year)).toEqual([2026]);
    expect(withProspectusThreeYearDisplay(source).years.map((y) => y.year)).toEqual([
      2024, 2025, 2026,
    ]);
  });
});
