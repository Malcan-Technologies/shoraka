import { readFileSync } from "node:fs";
import { join } from "node:path";
import { financialSourceFromYearBlocks } from "./prospectus-financial-comparison-test-helpers";
import { buildProspectusPageThreeBalanceSheet } from "./prospectus-page-three-balance-sheet";
import { buildProspectusPageThreeCoverageEfficiency } from "./prospectus-page-three-coverage-efficiency";
import { buildProspectusPageThreeIncomeStatement } from "./prospectus-page-three-income-statement";
import { buildProspectusPageThreeInvestorTakeaways } from "./prospectus-page-three-investor-takeaways";
import { SAMPLE_PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAYS_INPUT } from "./prospectus-page-three-investor-takeaways.sample-data";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAY_KEYS,
  PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAYS_AUDIT,
  PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAYS_SECTION_HEADING,
} from "./prospectus-page-three-investor-takeaways.types";
import { SAMPLE_PROSPECTUS_PAGE_THREE_METADATA } from "./prospectus-page-three-metadata.sample-data";
import { buildProspectusPageThreeTrends } from "./prospectus-page-three-trends";
import { buildProspectusPageThreeInvestorTakeawaysDocument } from "./render-prospectus-page-three-investor-takeaways";

function composeFromYears(years: Record<string, Record<string, unknown>>) {
  const financialSource = financialSourceFromYearBlocks(years, {
    financialYearEnd: "2024-12-31",
  });
  const incomeStatement = buildProspectusPageThreeIncomeStatement({ financialSource });
  const balanceSheet = buildProspectusPageThreeBalanceSheet({ financialSource });
  const coverageEfficiency = buildProspectusPageThreeCoverageEfficiency({
    financialSource,
  });
  const trends = buildProspectusPageThreeTrends({
    incomeStatement,
    balanceSheet,
    coverageEfficiency,
  });
  return buildProspectusPageThreeInvestorTakeaways({
    metadata: SAMPLE_PROSPECTUS_PAGE_THREE_METADATA,
    incomeStatement,
    balanceSheet,
    coverageEfficiency,
    trends,
    adminMemoText: "strong investment case",
    canvaSampleTakeaways: ["Overall financial fundamentals are strengthening."],
  });
}

/** Phrases that must never appear unless officer-selected from the catalogue. */
const AUTO_GENERATED_PROHIBITED = [
  "strong investment case",
  "low risk",
  "recommended investment",
];

describe("prospectus Page 3 investor takeaways (DATA STAGE 6)", () => {
  it("uses static 4. INVESTOR TAKEAWAYS heading with exactly six ordered items", () => {
    const data = buildProspectusPageThreeInvestorTakeaways(
      SAMPLE_PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAYS_INPUT
    );
    expect(data.sectionHeading).toBe("4. INVESTOR TAKEAWAYS");
    expect(data.sectionHeading).toBe(
      PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAYS_SECTION_HEADING
    );
    expect(data.items).toHaveLength(6);
    expect(data.items.map((i) => i.key)).toEqual([
      ...PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAY_KEYS,
    ]);
    expect(data.items.map((i) => i.label)).toEqual([
      "Revenue & Profitability",
      "Liquidity",
      "Leverage",
      "Debt Servicing Capacity",
      "Receivables Collection",
      "Overall Financial Profile",
    ]);
    expect(new Set(data.items.map((i) => i.key)).size).toBe(6);
  });

  it("keeps every takeaway as Data not available without typed selections", () => {
    const data = buildProspectusPageThreeInvestorTakeaways(
      SAMPLE_PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAYS_INPUT
    );
    for (const item of data.items) {
      expect(item.takeaway).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
      expect(item.takeaway).toBe("Data not available");
      expect(item.takeaway.trim()).not.toBe("");
    }
    expect(
      PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAYS_AUDIT.rules
        .overallInvestmentRecommendationAllowed
    ).toBe(false);
  });

  it("renders officer-selected catalogue text and omits do_not_display", async () => {
    const { PROSPECTUS_PLACEHOLDER_PUBLICATION_CONTENT } = await import(
      "./prospectus-placeholder-publication-content"
    );
    const selections = {
      ...PROSPECTUS_PLACEHOLDER_PUBLICATION_CONTENT.investorTakeawaySelections,
      leverage: "do_not_display",
    };
    const data = buildProspectusPageThreeInvestorTakeaways({
      ...SAMPLE_PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAYS_INPUT,
      investorTakeawayOptions:
        PROSPECTUS_PLACEHOLDER_PUBLICATION_CONTENT.investorTakeawayOptions,
      investorTakeawaySelections: selections,
    });
    expect(data.items[0]?.takeaway).toContain("steady year-on-year growth");
    expect(data.omittedKeys).toContain("leverage");
    const html = buildProspectusPageThreeInvestorTakeawaysDocument(data);
    expect(html).toContain("steady year-on-year growth");
    expect(html).not.toContain(">Leverage<");
    expect(html).not.toContain("do_not_display");
    expect(html).not.toContain("conservative_improving");
  });

  it("renders all six demo catalogue descriptions in fixed order", async () => {
    const { PROSPECTUS_PLACEHOLDER_PUBLICATION_CONTENT } = await import(
      "./prospectus-placeholder-publication-content"
    );
    const data = buildProspectusPageThreeInvestorTakeaways({
      ...SAMPLE_PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAYS_INPUT,
      investorTakeawayOptions:
        PROSPECTUS_PLACEHOLDER_PUBLICATION_CONTENT.investorTakeawayOptions,
      investorTakeawaySelections:
        PROSPECTUS_PLACEHOLDER_PUBLICATION_CONTENT.investorTakeawaySelections,
    });
    expect(data.omittedKeys).toEqual([]);
    expect(data.items.map((i) => i.takeaway)).toEqual([
      "Revenue and profitability have shown steady year-on-year growth.",
      "Liquidity remains healthy, with current and quick ratios improving over time.",
      "Leverage is conservative and trending downward, supporting a stronger balance sheet.",
      "Debt servicing capacity appears adequate, with improving DSCR and strong interest coverage.",
      "Receivables collection days have improved, indicating better working capital management.",
      "Overall financial profile suggests strengthening fundamentals over the observed period.",
    ]);
  });

  it("preserves visible category order after omitting a middle row", async () => {
    const { PROSPECTUS_PLACEHOLDER_PUBLICATION_CONTENT } = await import(
      "./prospectus-placeholder-publication-content"
    );
    const data = buildProspectusPageThreeInvestorTakeaways({
      ...SAMPLE_PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAYS_INPUT,
      investorTakeawayOptions:
        PROSPECTUS_PLACEHOLDER_PUBLICATION_CONTENT.investorTakeawayOptions,
      investorTakeawaySelections: {
        revenue_profitability: "steady_growth",
        liquidity: "do_not_display",
        leverage: "conservative_improving",
        debt_servicing_capacity: "do_not_display",
        receivables_collection: "improving",
        overall_financial_profile: "strengthening",
      },
    });
    const html = buildProspectusPageThreeInvestorTakeawaysDocument(data);
    const revenueIdx = html.indexOf("Revenue &amp; Profitability");
    const leverageIdx = html.indexOf(">Leverage<");
    const receivablesIdx = html.indexOf("Receivables Collection");
    expect(revenueIdx).toBeGreaterThan(-1);
    expect(leverageIdx).toBeGreaterThan(revenueIdx);
    expect(receivablesIdx).toBeGreaterThan(leverageIdx);
    expect(html).not.toContain(">Liquidity<");
    expect(html).not.toContain("Debt Servicing Capacity");
  });

  it("does not generate claims from positive, negative, zero, or mixed financial cases", () => {
    const cases = [
      composeFromYears({
        "2022": {
          turnover: 1_000_000,
          plnpat: 100_000,
          bsqpuc: 1_000_000,
          bscatot: 2_000_000,
          curlib: 1_000_000,
        },
        "2023": {
          turnover: 2_000_000,
          plnpat: 200_000,
          bsqpuc: 1_000_000,
          bscatot: 3_000_000,
          curlib: 1_000_000,
        },
        "2024": {
          turnover: 3_000_000,
          plnpat: 300_000,
          bsqpuc: 1_000_000,
          bscatot: 4_000_000,
          curlib: 500_000,
        },
      }),
      composeFromYears({
        "2022": { turnover: 3_000_000, plnpat: 300_000, bsqpuc: 1_000_000, curlib: 100_000 },
        "2023": { turnover: 2_000_000, plnpat: -50_000, bsqpuc: 1_000_000, curlib: 200_000 },
        "2024": { turnover: 1_000_000, plnpat: -100_000, bsqpuc: 1_000_000, curlib: 400_000 },
      }),
      composeFromYears({
        "2022": { turnover: 0, plnpat: 0, bsqpuc: 0, bscatot: 0, curlib: 0 },
        "2023": { turnover: 0, plnpat: 0, bsqpuc: 0, bscatot: 0, curlib: 0 },
        "2024": { turnover: 0, plnpat: 0, bsqpuc: 0, bscatot: 0, curlib: 0 },
      }),
      composeFromYears({
        "2022": { turnover: 1 },
        "2024": { plnpat: 1 },
      }),
    ];

    for (const data of cases) {
      expect(data.items.every((i) => i.takeaway === PROSPECTUS_DATA_NOT_AVAILABLE)).toBe(
        true
      );
    }
  });

  it("does not map trends or admin/Canva sample text into takeaways", () => {
    const data = buildProspectusPageThreeInvestorTakeaways(
      SAMPLE_PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAYS_INPUT
    );
    expect(
      SAMPLE_PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAYS_INPUT.trends.trends.every(
        (t) => t.trend === PROSPECTUS_DATA_NOT_AVAILABLE
      )
    ).toBe(true);
    expect(data.items.every((i) => i.takeaway === PROSPECTUS_DATA_NOT_AVAILABLE)).toBe(
      true
    );
    expect(
      PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAYS_AUDIT.composition.inputsUsedToGenerateClaims
    ).toBe(false);
    expect(
      PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAYS_AUDIT.rules.trendBasedClaimsAllowed
    ).toBe(false);

    const joined = data.items.map((i) => i.takeaway).join(" ");
    for (const phrase of AUTO_GENERATED_PROHIBITED) {
      expect(joined.toLowerCase()).not.toContain(phrase.toLowerCase());
    }
  });

  it("composes Stage 1–5 types without reverse-parsing, Application parse, year selection, CTOS, Prisma, or snapshot writes", () => {
    const moduleSource = readFileSync(
      join(__dirname, "prospectus-page-three-investor-takeaways.ts"),
      "utf8"
    );
    expect(moduleSource).not.toMatch(/selectProspectusFinancialComparisonYears/);
    expect(moduleSource).not.toMatch(/unaudited_by_year/);
    expect(moduleSource).not.toMatch(/parseProspectusFinancialNumber/);
    expect(moduleSource).not.toMatch(/formatProspectusMoneyMyr/);
    expect(moduleSource).not.toMatch(/calculateGearing/);
    expect(moduleSource).not.toMatch(/prisma/i);
    expect(moduleSource).not.toMatch(/prospectus_snapshot/);
    expect(moduleSource).not.toMatch(/Number\(/);
    expect(
      PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAYS_AUDIT.composition.metadataInputAccepted
    ).toBe(true);
    expect(
      PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAYS_AUDIT.composition.trendsInputAccepted
    ).toBe(true);
    expect(PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAYS_AUDIT.snapshot.implemented).toBe(
      false
    );
    expect(PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAYS_AUDIT.snapshot.futureBranch).toBe(
      "page_3.investor_takeaways"
    );
    expect(PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAYS_AUDIT.snapshot.liveFallbackAllowed).toBe(
      false
    );
    expect(
      PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAYS_AUDIT.source.generatedTextAllowed
    ).toBe(false);
  });

  it("hides audit and prohibited claims from HTML", () => {
    const data = buildProspectusPageThreeInvestorTakeaways(
      SAMPLE_PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAYS_INPUT
    );
    const html = buildProspectusPageThreeInvestorTakeawaysDocument(data);
    expect(html).toContain("4. INVESTOR TAKEAWAYS");
    expect(html).toContain("Data not available");
    expect(html).not.toContain("page_3.investor_takeaways");
    expect(html).not.toContain("generatedTextAllowed");
    expect(html).not.toContain("steady year-on-year growth");
    expect(html).not.toMatch(/green|red|color:/i);
    expect(html).not.toMatch(/\{[\s\S]*"takeaway"/);
    for (const phrase of AUTO_GENERATED_PROHIBITED) {
      expect(html.toLowerCase()).not.toContain(phrase.toLowerCase());
    }
  });
});
