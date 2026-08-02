/**
 * SECTION: Income Statement trend insight unit tests
 * WHY: Lock six-message catalogue + Revenue/PAT monotonic classification
 */

import {
  buildProspectusIncomeTrendInsight,
  classifyProspectusIncomeTrendState,
} from "./prospectus-income-trend-insight";
import { PROSPECTUS_INCOME_TREND_INSIGHT_MESSAGES } from "./prospectus-income-trend-insight.types";
import type { ProspectusFinancialComparisonSource } from "./prospectus-financial-comparison-source.types";
import { PROSPECTUS_FINANCIAL_COMPARISON_SOURCE_AUDIT } from "./prospectus-financial-comparison-source.types";
import { buildProspectusPageThreeHtml } from "./prospectus-page-three.html";
import { buildProspectusPageThree } from "./prospectus-page-three-mapper";
import { buildProspectusPage2Snapshot } from "./prospectus-page-two-snapshot";

function sourceFromSeries(input: {
  revenue: [number | null, number | null, number | null];
  pat: [number | null, number | null, number | null];
  placeholders?: [boolean, boolean, boolean];
}): ProspectusFinancialComparisonSource {
  const years = [2022, 2023, 2024] as const;
  return {
    sectionHeading: "DETAILED FINANCIAL COMPARISON",
    tableUnitLabel: "MYR millions",
    sourceFooter: "Source: Financial Statements",
    years: years.map((year, index) => ({
      year,
      yearLabel: `FY${year}`,
      financialYearEndLabel: `31 Dec ${year}`,
      financialYearEndIso: `${year}-12-31`,
      isPlaceholder: input.placeholders?.[index] === true,
      rawFinancials: {
        turnover: input.revenue[index],
        plnpat: input.pat[index],
      },
      recordSource: "ctos_audited" as const,
    })),
    missingSsmUnauditedYears: [],
    opsWarning: null,
    audit: PROSPECTUS_FINANCIAL_COMPARISON_SOURCE_AUDIT,
  };
}

describe("classifyProspectusIncomeTrendState", () => {
  it("classifies consistent_up with >=1% monotonic increase", () => {
    expect(classifyProspectusIncomeTrendState([10, 12, 15])).toBe("consistent_up");
  });

  it("classifies consistent_down with >=1% monotonic decrease", () => {
    expect(classifyProspectusIncomeTrendState([15, 12, 10])).toBe("consistent_down");
  });

  it("classifies mixed direction as neutral_or_mixed", () => {
    expect(classifyProspectusIncomeTrendState([10, 15, 12])).toBe("neutral_or_mixed");
    expect(classifyProspectusIncomeTrendState([10, 9, 11])).toBe("neutral_or_mixed");
  });

  it("classifies unchanged and sub-1% moves as neutral_or_mixed", () => {
    expect(classifyProspectusIncomeTrendState([10, 10, 10])).toBe("neutral_or_mixed");
    expect(classifyProspectusIncomeTrendState([100, 100.4, 100.5])).toBe("neutral_or_mixed");
  });

  it("returns unavailable when any year is missing", () => {
    expect(classifyProspectusIncomeTrendState([10, null, 15])).toBe("unavailable");
    expect(classifyProspectusIncomeTrendState([10, 12])).toBe("unavailable");
  });

  it("handles zero base without division errors", () => {
    expect(classifyProspectusIncomeTrendState([0, 0, 0])).toBe("neutral_or_mixed");
    expect(classifyProspectusIncomeTrendState([0, 1, 2])).toBe("consistent_up");
  });

  it("classifies improving negative PAT as consistent_up", () => {
    expect(classifyProspectusIncomeTrendState([-3, -2, -1])).toBe("consistent_up");
  });

  it("handles mixed negative/positive movement", () => {
    expect(classifyProspectusIncomeTrendState([-5, -2, 1])).toBe("consistent_up");
    expect(classifyProspectusIncomeTrendState([2, -1, -3])).toBe("consistent_down");
    expect(classifyProspectusIncomeTrendState([-2, 5, -1])).toBe("neutral_or_mixed");
  });
});

describe("buildProspectusIncomeTrendInsight", () => {
  it("maps both consistent_up to growth message", () => {
    const insight = buildProspectusIncomeTrendInsight(
      sourceFromSeries({ revenue: [10, 12, 15], pat: [1, 2, 3] })
    );
    expect(insight).toEqual({
      message: PROSPECTUS_INCOME_TREND_INSIGHT_MESSAGES.both_up,
      revenueState: "consistent_up",
      profitState: "consistent_up",
    });
  });

  it("maps revenue up + PAT mixed to revenue-growth message", () => {
    const insight = buildProspectusIncomeTrendInsight(
      sourceFromSeries({ revenue: [10, 12, 15], pat: [1, 3, 2] })
    );
    expect(insight.message).toBe(
      PROSPECTUS_INCOME_TREND_INSIGHT_MESSAGES.revenue_up_profit_mixed
    );
  });

  it("maps revenue mixed + PAT up to profit-improved message", () => {
    const insight = buildProspectusIncomeTrendInsight(
      sourceFromSeries({ revenue: [10, 15, 12], pat: [1, 2, 3] })
    );
    expect(insight.message).toBe(
      PROSPECTUS_INCOME_TREND_INSIGHT_MESSAGES.profit_up_revenue_mixed
    );
  });

  it("maps both consistent_down to decline message", () => {
    const insight = buildProspectusIncomeTrendInsight(
      sourceFromSeries({ revenue: [15, 12, 10], pat: [3, 2, 1] })
    );
    expect(insight.message).toBe(PROSPECTUS_INCOME_TREND_INSIGHT_MESSAGES.both_down);
  });

  it("maps conflicting up/down to general mixed message", () => {
    const insight = buildProspectusIncomeTrendInsight(
      sourceFromSeries({ revenue: [10, 12, 15], pat: [3, 2, 1] })
    );
    expect(insight.message).toBe(PROSPECTUS_INCOME_TREND_INSIGHT_MESSAGES.mixed);
  });

  it("maps both stable to general mixed message", () => {
    const insight = buildProspectusIncomeTrendInsight(
      sourceFromSeries({ revenue: [10, 10, 10], pat: [2, 2, 2] })
    );
    expect(insight.message).toBe(PROSPECTUS_INCOME_TREND_INSIGHT_MESSAGES.mixed);
  });

  it("maps below-1% change to mixed, not growth", () => {
    const insight = buildProspectusIncomeTrendInsight(
      sourceFromSeries({ revenue: [100, 100.4, 100.5], pat: [50, 50.2, 50.3] })
    );
    expect(insight.revenueState).toBe("neutral_or_mixed");
    expect(insight.profitState).toBe("neutral_or_mixed");
    expect(insight.message).toBe(PROSPECTUS_INCOME_TREND_INSIGHT_MESSAGES.mixed);
  });

  it("maps missing revenue or PAT year to insufficient-data message", () => {
    expect(
      buildProspectusIncomeTrendInsight(
        sourceFromSeries({ revenue: [10, null, 15], pat: [1, 2, 3] })
      ).message
    ).toBe(PROSPECTUS_INCOME_TREND_INSIGHT_MESSAGES.unavailable);
    expect(
      buildProspectusIncomeTrendInsight(
        sourceFromSeries({ revenue: [10, 12, 15], pat: [1, null, 3] })
      ).message
    ).toBe(PROSPECTUS_INCOME_TREND_INSIGHT_MESSAGES.unavailable);
  });

  it("maps placeholder years to insufficient-data message", () => {
    const insight = buildProspectusIncomeTrendInsight(
      sourceFromSeries({
        revenue: [10, 12, 15],
        pat: [1, 2, 3],
        placeholders: [false, true, false],
      })
    );
    expect(insight.message).toBe(PROSPECTUS_INCOME_TREND_INSIGHT_MESSAGES.unavailable);
  });
});

describe("Page 3 income trend insight HTML", () => {
  it("always renders the card below the Income Statement table with one message", () => {
    const page = buildProspectusPageThree({
      noteId: "insight-render-1",
      isPublished: false,
      financialMode: "live_unpublished_preview",
      issuerSnapshot: { name: "Issuer", industry: "Construction" },
      invoiceSnapshot: { offer_details: { risk_rating: "B" } },
      paymasterSnapshot: { name: "Paymaster" },
      liveFinancialStatements: {
        questionnaire: { financial_year_end: "2027-12-31" },
        unaudited_by_year: {},
      },
      liveCtosFinancials: [
        {
          financial_year: 2022,
          dates: { pldd: "2022-12-31", bsdd: null },
          account: { turnover: 10_000_000, plnpat: 1_000_000, bscatot: 1, curlib: 1 },
        },
        {
          financial_year: 2023,
          dates: { pldd: "2023-12-31", bsdd: null },
          account: { turnover: 12_000_000, plnpat: 2_000_000, bscatot: 1, curlib: 1 },
        },
        {
          financial_year: 2024,
          dates: { pldd: "2024-12-31", bsdd: null },
          account: { turnover: 15_000_000, plnpat: 3_000_000, bscatot: 1, curlib: 1 },
        },
      ],
      frozenFinancialComparison: null,
    });

    expect(page.incomeTrendInsight.message).toBe(
      PROSPECTUS_INCOME_TREND_INSIGHT_MESSAGES.both_up
    );

    const html = buildProspectusPageThreeHtml(page);
    const incomeIdx = html.indexOf("3-YEAR INCOME STATEMENT SUMMARY");
    const insightIdx = html.indexOf('data-income-trend-insight="true"');
    const balanceIdx = html.indexOf("3-YEAR BALANCE SHEET");
    expect(insightIdx).toBeGreaterThan(incomeIdx);
    expect(insightIdx).toBeGreaterThan(-1);
    expect(balanceIdx).toBeGreaterThan(insightIdx);
    expect(html).toContain("prospectus-income-trend-insight");
    expect(html).toContain('data-prospectus-icon="income-trend-insight"');
    expect(html).toContain(PROSPECTUS_INCOME_TREND_INSIGHT_MESSAGES.both_up);
    expect(
      (html.match(/data-income-trend-insight="true"/g) ?? []).length
    ).toBe(1);
    expect(html).not.toContain("revenueState");
    expect(html).not.toContain("consistent_up");
  });

  it("freezes the insight message in published HTML and ignores later live financial changes", () => {
    const frozen = buildProspectusPage2Snapshot({
      financialStatements: {
        questionnaire: { financial_year_end: "2027-12-31" },
        unaudited_by_year: {},
      },
      ctosFinancials: [
        {
          financial_year: 2022,
          dates: { pldd: "2022-12-31", bsdd: null },
          account: { turnover: 10_000_000, plnpat: 1_000_000, bscatot: 1, curlib: 1 },
        },
        {
          financial_year: 2023,
          dates: { pldd: "2023-12-31", bsdd: null },
          account: { turnover: 12_000_000, plnpat: 2_000_000, bscatot: 1, curlib: 1 },
        },
        {
          financial_year: 2024,
          dates: { pldd: "2024-12-31", bsdd: null },
          account: { turnover: 15_000_000, plnpat: 3_000_000, bscatot: 1, curlib: 1 },
        },
      ],
      now: new Date("2026-08-02T00:00:00.000Z"),
    }).financial_comparison;

    const published = buildProspectusPageThree({
      noteId: "insight-freeze-1",
      isPublished: true,
      financialMode: "frozen_publication_snapshot",
      issuerSnapshot: { name: "Issuer", industry: "Construction" },
      invoiceSnapshot: { offer_details: { risk_rating: "B" } },
      paymasterSnapshot: { name: "Paymaster" },
      liveFinancialStatements: {
        questionnaire: { financial_year_end: "2027-12-31" },
        unaudited_by_year: {
          "2022": { turnover: 99_000_000, plnpat: 9_000_000, bscatot: 1, curlib: 1 },
          "2023": { turnover: 98_000_000, plnpat: 8_000_000, bscatot: 1, curlib: 1 },
          "2024": { turnover: 97_000_000, plnpat: 7_000_000, bscatot: 1, curlib: 1 },
        },
      },
      liveCtosFinancials: [
        {
          financial_year: 2022,
          dates: { pldd: "2022-12-31", bsdd: null },
          account: { turnover: 1, plnpat: 9 },
        },
        {
          financial_year: 2023,
          dates: { pldd: "2023-12-31", bsdd: null },
          account: { turnover: 1, plnpat: 8 },
        },
        {
          financial_year: 2024,
          dates: { pldd: "2024-12-31", bsdd: null },
          account: { turnover: 1, plnpat: 7 },
        },
      ],
      frozenFinancialComparison: frozen,
    });

    expect(published.incomeTrendInsight.message).toBe(
      PROSPECTUS_INCOME_TREND_INSIGHT_MESSAGES.both_up
    );
    const html = buildProspectusPageThreeHtml(published);
    expect(html).toContain(PROSPECTUS_INCOME_TREND_INSIGHT_MESSAGES.both_up);
    expect(html).not.toContain(PROSPECTUS_INCOME_TREND_INSIGHT_MESSAGES.both_down);
  });
});
