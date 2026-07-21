import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  calculateCurrentRatio,
  computeTotalAssets,
  computeTotalLiabilities,
} from "@cashsouk/types";
import {
  buildProspectusFinancialComparisonMetrics,
  formatProspectusFinancialMultiple,
  formatProspectusMyrMillions,
} from "./prospectus-financial-comparison-metrics";
import { financialSourceFromYearBlocks } from "./prospectus-financial-comparison-test-helpers";
import { buildProspectusPageThreeBalanceSheet } from "./prospectus-page-three-balance-sheet";
import {
  SAMPLE_PROSPECTUS_PAGE_THREE_BALANCE_SHEET_INPUT,
  SAMPLE_PROSPECTUS_PAGE_THREE_BALANCE_SHEET_SOURCE,
} from "./prospectus-page-three-balance-sheet.sample-data";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_PAGE_THREE_BALANCE_SHEET_AUDIT,
  PROSPECTUS_PAGE_THREE_BALANCE_SHEET_ROW_KEYS,
  PROSPECTUS_PAGE_THREE_BALANCE_SHEET_SECTION_HEADING,
} from "./prospectus-page-three-balance-sheet.types";
import { buildProspectusPageThreeBalanceSheetDocument } from "./render-prospectus-page-three-balance-sheet";

function row(
  data: ReturnType<typeof buildProspectusPageThreeBalanceSheet>,
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

describe("prospectus Page 3 balance sheet (DATA STAGE 3)", () => {
  it("uses static section heading with MYR mil. unit", () => {
    const data = buildProspectusPageThreeBalanceSheet(
      SAMPLE_PROSPECTUS_PAGE_THREE_BALANCE_SHEET_INPUT
    );
    expect(data.sectionHeading).toBe("3-YEAR BALANCE SHEET & LIQUIDITY (MYR mil.)");
    expect(data.sectionHeading).toBe(PROSPECTUS_PAGE_THREE_BALANCE_SHEET_SECTION_HEADING);
  });

  it("keeps exact nine-row order and labels", () => {
    const data = buildProspectusPageThreeBalanceSheet(
      SAMPLE_PROSPECTUS_PAGE_THREE_BALANCE_SHEET_INPUT
    );
    expect(data.rows.map((r) => r.key)).toEqual([
      ...PROSPECTUS_PAGE_THREE_BALANCE_SHEET_ROW_KEYS,
    ]);
    expect(data.rows.map((r) => r.label)).toEqual([
      "Cash & Bank",
      "Trade Receivables",
      "Current Assets",
      "Total Assets",
      "Current Liabilities",
      "Total Liabilities",
      "Total Equity",
      "Current Ratio",
      "Quick Ratio",
    ]);
  });

  it("passes years and FYE labels through unchanged", () => {
    const source = SAMPLE_PROSPECTUS_PAGE_THREE_BALANCE_SHEET_SOURCE;
    const data = buildProspectusPageThreeBalanceSheet({ financialSource: source });
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
    const one = buildProspectusPageThreeBalanceSheet({
      financialSource: sourceFromYears({ "2024": { bscatot: 100, curlib: 50 } }),
    });
    expect(one.years).toHaveLength(1);
    expect(one.years.some((y) => y.year === 2023)).toBe(false);

    const empty = buildProspectusPageThreeBalanceSheet({
      financialSource: sourceFromYears({}),
    });
    expect(empty.years).toEqual([]);
    for (const r of empty.rows) {
      expect(r.values).toEqual([]);
    }
  });

  it("keeps Cash & Bank DNA without officer input and never uses bsclbank", () => {
    const data = buildProspectusPageThreeBalanceSheet(
      SAMPLE_PROSPECTUS_PAGE_THREE_BALANCE_SHEET_INPUT
    );
    expect(row(data, "cash_and_bank")?.values).toEqual([
      PROSPECTUS_DATA_NOT_AVAILABLE,
      PROSPECTUS_DATA_NOT_AVAILABLE,
      PROSPECTUS_DATA_NOT_AVAILABLE,
    ]);
    expect(PROSPECTUS_PAGE_THREE_BALANCE_SHEET_AUDIT.cashAndBank.bsclbankRejected).toBe(
      true
    );

    const polluted = buildProspectusPageThreeBalanceSheet({
      financialSource: sourceFromYears({
        "2024": { bsclbank: 900_000, cash: 1, cash_and_bank: 2 },
      }),
    });
    expect(row(polluted, "cash_and_bank")?.values[0]).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("fills officer money rows from full-MYR storage as MYR millions", () => {
    const data = buildProspectusPageThreeBalanceSheet({
      financialSource: SAMPLE_PROSPECTUS_PAGE_THREE_BALANCE_SHEET_SOURCE,
      prospectusFinancialInputs: {
        years: {
          "2022": {
            cashAndBank: 900_000,
            tradeReceivables: 2_800_000,
            totalEquity: 4_500_000,
            quickRatio: 1.11,
          },
          "2023": {
            cashAndBank: 1_100_000,
            tradeReceivables: 3_100_000,
            totalEquity: 5_000_000,
            quickRatio: 1.18,
          },
          "2024": {
            cashAndBank: 1_400_000,
            tradeReceivables: 3_200_000,
            totalEquity: 5_600_000,
            quickRatio: 1.26,
          },
        },
      },
    });
    expect(row(data, "cash_and_bank")?.values).toEqual(["0.9", "1.1", "1.4"]);
    expect(row(data, "trade_receivables")?.values).toEqual(["2.8", "3.1", "3.2"]);
    expect(row(data, "total_equity")?.values).toEqual(["4.5", "5", "5.6"]);
    expect(row(data, "quick_ratio")?.values).toEqual(["1.11x", "1.18x", "1.26x"]);
    expect(formatProspectusMyrMillions(900_000)).toBe("0.9");
    expect(PROSPECTUS_PAGE_THREE_BALANCE_SHEET_AUDIT.cashAndBank.storageUnit).toBe(
      "full_myr"
    );
    expect(PROSPECTUS_PAGE_THREE_BALANCE_SHEET_AUDIT.quickRatio.storageUnit).toBe("ratio");
  });

  it("keeps Trade Receivables, Total Equity, and Quick Ratio as DNA without officer inputs", () => {
    const data = buildProspectusPageThreeBalanceSheet({
      financialSource: sourceFromYears({
        "2024": {
          bsqpuc: 2_000_000,
          trade_receivables: 999,
          inventory: 100,
          bscatot: 4_700_000,
          curlib: 2_900_000,
        },
      }),
    });
    expect(row(data, "trade_receivables")?.values[0]).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(row(data, "total_equity")?.values[0]).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(row(data, "quick_ratio")?.values[0]).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(PROSPECTUS_PAGE_THREE_BALANCE_SHEET_AUDIT.totalEquity.bsqpucIsPaidUpCapital).toBe(
      true
    );
    expect(PROSPECTUS_PAGE_THREE_BALANCE_SHEET_AUDIT.totalEquity.relabelAllowed).toBe(false);
    expect(
      PROSPECTUS_PAGE_THREE_BALANCE_SHEET_AUDIT.quickRatio.approvedFormulaAvailable
    ).toBe(false);

    const moduleSource = readFileSync(
      join(__dirname, "prospectus-page-three-balance-sheet.ts"),
      "utf8"
    );
    expect(moduleSource).not.toMatch(/inventory/i);
    expect(moduleSource).not.toMatch(/bscatot\s*-\s*.*inventory/i);
    expect(moduleSource).not.toMatch(/quickRatio\s*\(/);
  });

  it("maps Current Assets from bscatot with MYR millions", () => {
    const data = buildProspectusPageThreeBalanceSheet(
      SAMPLE_PROSPECTUS_PAGE_THREE_BALANCE_SHEET_INPUT
    );
    expect(row(data, "current_assets")?.values[0]).toBe("4.7");

    const zero = buildProspectusPageThreeBalanceSheet({
      financialSource: sourceFromYears({ "2024": { bscatot: 0 } }),
    });
    expect(row(zero, "current_assets")?.values[0]).toBe("0");

    const missing = buildProspectusPageThreeBalanceSheet({
      financialSource: sourceFromYears({ "2024": { curlib: 1 } }),
    });
    expect(row(missing, "current_assets")?.values[0]).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);

    const invalid = buildProspectusPageThreeBalanceSheet({
      financialSource: sourceFromYears({ "2024": { bscatot: "abc", curlib: 1 } }),
    });
    expect(row(invalid, "current_assets")?.values[0]).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("computes Total Assets via computeTotalAssets with confirmed keys", () => {
    const data = buildProspectusPageThreeBalanceSheet(
      SAMPLE_PROSPECTUS_PAGE_THREE_BALANCE_SHEET_INPUT
    );
    expect(row(data, "total_assets")?.values[0]).toBe("8.1");
    expect(
      computeTotalAssets({
        total_assets: null,
        fixed_assets: 1_500_000,
        other_assets: 1_000_000,
        current_assets: 4_700_000,
        non_current_assets: 900_000,
      })
    ).toBe(8_100_000);

    expect(PROSPECTUS_PAGE_THREE_BALANCE_SHEET_AUDIT.totalAssets.sharedHelper).toBe(
      "computeTotalAssets"
    );
    expect(PROSPECTUS_PAGE_THREE_BALANCE_SHEET_AUDIT.totalAssets.inputKeys).toEqual([
      "bsfatot",
      "othass",
      "bscatot",
      "bsclbank",
    ]);

    const moduleSource = readFileSync(
      join(__dirname, "prospectus-page-three-balance-sheet.ts"),
      "utf8"
    );
    expect(moduleSource).toMatch(/computeTotalAssets/);
    expect(moduleSource).not.toMatch(/bsfatot\s*\+\s*othass/);
  });

  it("follows computeTotalAssets missing-component policy (nullish → 0)", () => {
    expect(
      PROSPECTUS_PAGE_THREE_BALANCE_SHEET_AUDIT.totalAssets.missingComponentPolicy
    ).toBe("nullish_component_defaults_to_zero_in_sum");
    expect(
      PROSPECTUS_PAGE_THREE_BALANCE_SHEET_AUDIT.totalAssets
        .financeProductRiskAllMissingYieldsZero
    ).toBe(true);

    const partialOldSnapshot = buildProspectusPageThreeBalanceSheet({
      financialSource: sourceFromYears({
        "2024": { bscatot: 4_700_000, curlib: 2_900_000 },
      }),
    });
    expect(row(partialOldSnapshot, "total_assets")?.values[0]).toBe("4.7");
    expect(row(partialOldSnapshot, "current_assets")?.values[0]).toBe("4.7");
    expect(
      PROSPECTUS_PAGE_THREE_BALANCE_SHEET_AUDIT.snapshot.liveFallbackForPublishedAllowed
    ).toBe(false);

    const allMissing = buildProspectusPageThreeBalanceSheet({
      financialSource: sourceFromYears({ "2024": { turnover: 1 } }),
    });
    expect(row(allMissing, "total_assets")?.values[0]).toBe("0");

    const zeroComponents = buildProspectusPageThreeBalanceSheet({
      financialSource: sourceFromYears({
        "2024": { bsfatot: 0, othass: 0, bscatot: 0, bsclbank: 0 },
      }),
    });
    expect(row(zeroComponents, "total_assets")?.values[0]).toBe("0");
  });

  it("maps Current Liabilities from curlib with MYR millions", () => {
    const data = buildProspectusPageThreeBalanceSheet(
      SAMPLE_PROSPECTUS_PAGE_THREE_BALANCE_SHEET_INPUT
    );
    expect(row(data, "current_liabilities")?.values[0]).toBe("2.9");

    const zero = buildProspectusPageThreeBalanceSheet({
      financialSource: sourceFromYears({ "2024": { curlib: 0 } }),
    });
    expect(row(zero, "current_liabilities")?.values[0]).toBe("0");

    const missing = buildProspectusPageThreeBalanceSheet({
      financialSource: sourceFromYears({ "2024": { bscatot: 1 } }),
    });
    expect(row(missing, "current_liabilities")?.values[0]).toBe(
      PROSPECTUS_DATA_NOT_AVAILABLE
    );
  });

  it("computes Total Liabilities via computeTotalLiabilities", () => {
    const data = buildProspectusPageThreeBalanceSheet(
      SAMPLE_PROSPECTUS_PAGE_THREE_BALANCE_SHEET_INPUT
    );
    expect(row(data, "total_liabilities")?.values[0]).toBe("3.6");
    expect(
      computeTotalLiabilities({
        total_liabilities: null,
        current_liabilities: 2_900_000,
        long_term_liabilities: 500_000,
        non_current_liabilities: 200_000,
      })
    ).toBe(3_600_000);

    const oldSnapshot = buildProspectusPageThreeBalanceSheet({
      financialSource: sourceFromYears({
        "2024": { curlib: 2_900_000, bscatot: 1 },
      }),
    });
    expect(row(oldSnapshot, "total_liabilities")?.values[0]).toBe("2.9");

    const moduleSource = readFileSync(
      join(__dirname, "prospectus-page-three-balance-sheet.ts"),
      "utf8"
    );
    expect(moduleSource).toMatch(/computeTotalLiabilities/);
    expect(moduleSource).not.toMatch(/curlib\s*\+\s*bsslltd/);
  });

  it("reuses calculateCurrentRatio and matches Page 2", () => {
    const source = SAMPLE_PROSPECTUS_PAGE_THREE_BALANCE_SHEET_SOURCE;
    const page3 = buildProspectusPageThreeBalanceSheet({ financialSource: source });
    const page2 = buildProspectusFinancialComparisonMetrics({ source });
    expect(row(page3, "current_ratio")?.values).toEqual(
      page2.rows.find((r) => r.key === "currentRatio")?.values
    );
    expect(row(page3, "current_ratio")?.values[0]).toBe(
      formatProspectusFinancialMultiple(calculateCurrentRatio(4_700_000, 2_900_000))
    );

    const zeroCurlib = buildProspectusPageThreeBalanceSheet({
      financialSource: sourceFromYears({ "2024": { bscatot: 100, curlib: 0 } }),
    });
    expect(row(zeroCurlib, "current_ratio")?.values[0]).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);

    const moduleSource = readFileSync(
      join(__dirname, "prospectus-page-three-balance-sheet.ts"),
      "utf8"
    );
    expect(moduleSource).toMatch(/calculateCurrentRatio/);
    expect(moduleSource).not.toMatch(/bscatot\s*\/\s*curlib/);
  });

  it("reuses Page 2 source with no independent selection, Application parse, CTOS, or Prisma", () => {
    const moduleSource = readFileSync(
      join(__dirname, "prospectus-page-three-balance-sheet.ts"),
      "utf8"
    );
    expect(moduleSource).not.toMatch(/selectProspectusFinancialComparisonYears/);
    expect(moduleSource).not.toMatch(/unaudited_by_year/);
    expect(moduleSource).not.toMatch(/buildProspectusFinancialComparisonSource/);
    expect(moduleSource).not.toMatch(/prisma/i);
    expect(PROSPECTUS_PAGE_THREE_BALANCE_SHEET_AUDIT.source.ctosFallbackAllowed).toBe(
      false
    );

    const withCtos = buildProspectusPageThreeBalanceSheet({
      financialSource: SAMPLE_PROSPECTUS_PAGE_THREE_BALANCE_SHEET_SOURCE,
      ctosFinancials: { financials: [{ financial_year: 2020, bscatot: 9_999_999 }] },
    });
    expect(withCtos.years.some((y) => y.year === 2020)).toBe(false);
  });

  it("renders money via shared MYR millions formatter and hides audit in HTML", () => {
    const data = buildProspectusPageThreeBalanceSheet(
      SAMPLE_PROSPECTUS_PAGE_THREE_BALANCE_SHEET_INPUT
    );
    const html = buildProspectusPageThreeBalanceSheetDocument(data);
    expect(html).toContain("3-YEAR BALANCE SHEET &amp; LIQUIDITY (MYR mil.)");
    expect(html).toContain("8.1");
    expect(html).toContain("3.6");
    expect(html).not.toContain("RM 8,100,000.00");
    expect(html).toContain("Data not available");
    expect(html).not.toContain("computeTotalAssets");
    expect(html).not.toContain("bsclbank");
    expect(html).not.toContain("publicationExtensionPending");

    const builder = readFileSync(
      join(__dirname, "prospectus-page-three-balance-sheet.ts"),
      "utf8"
    );
    expect(builder).toMatch(/formatProspectusMyrMillions/);
    expect(builder).not.toMatch(/\/\s*1_?000_?000/);
    expect(builder).not.toMatch(/formatProspectusMoneyMyr/);

    const types = readFileSync(
      join(__dirname, "prospectus-page-three-balance-sheet.types.ts"),
      "utf8"
    );
    expect(types).toMatch(/Non-Current Assets/);
    expect(types).toMatch(/Paid-Up Capital/);
  });

  it("shares formatProspectusMyrMillions with Page 2 and Income Statement", () => {
    expect(formatProspectusMyrMillions(900_000)).toBe("0.9");
    expect(formatProspectusMyrMillions(2_800_000)).toBe("2.8");
    expect(formatProspectusMyrMillions(4_500_000)).toBe("4.5");
    expect(formatProspectusFinancialMultiple(1.11)).toBe("1.11x");
  });
});
