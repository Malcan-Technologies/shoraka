/**
 * SECTION: Complete Page 2 financial freeze (version 2)
 * WHY: An approved Prospectus must render from its freeze exactly as the preview rendered from the
 * Note financial snapshot. The selected years' raw values, stored calculated values, statement
 * type and missing-year state are frozen; trends are derived from the frozen values by the same
 * deterministic builders. Legacy freezes (no freeze_version) must keep rendering as they always have.
 */

import { FINANCIAL_REVIEW_CALCULATED_KEYS, type ApprovedFinancialResult } from "@cashsouk/types";
import { canonicalizeJsonNumbers } from "../../../lib/canonical-json-numbers";
import { parseProspectusFinancialNumber } from "./prospectus-financial-comparison-metrics";
import * as sourceModule from "./prospectus-financial-comparison-source";
import { buildProspectusFinancialComparisonSourceFromResult } from "./prospectus-financial-comparison-source";
import { approvedFinancialResultFromInputs } from "./prospectus-financial-comparison-test-helpers";
import { parseProspectusPageTwoFinancialComparison } from "./prospectus-json-guards";
import { buildProspectusPageThree, type ProspectusPageThreeBuilderInput } from "./prospectus-page-three-mapper";
import { buildProspectusPageThreeHtml } from "./prospectus-page-three.html";
import {
  buildFinancialComparisonSourceFromFrozen,
  buildProspectusPageTwo,
  type ProspectusPageTwoBuilderInput,
} from "./prospectus-page-two-mapper";
import {
  buildProspectusPage2Snapshot,
  PROSPECTUS_PAGE_TWO_RAW_FINANCIAL_KEYS,
} from "./prospectus-page-two-snapshot";
import { buildProspectusPageTwoHtml } from "./prospectus-page-two.html";
import type { ProspectusPage2FinancialComparisonSnapshot } from "./prospectus-snapshot.types";

const DNA = "—";
const REF = new Date("2026-09-25T00:00:00.000Z");

type FinancialInputs = { financialStatements: unknown; ctosFinancials: unknown[] };

/**
 * Every raw and overlay key the Page 2 / Page 3 builders read, scaled per year.
 * Scales are exact in binary (0.5, 0.75, 1.25, 1.5) so inputs carry no float noise: canonical
 * 15-digit numbers can move a value that sits exactly on a display rounding boundary.
 */
function fullYear(scale: number): Record<string, number> {
  return {
    turnover: 10_000_000 * scale,
    plnpat: 900_000 * scale,
    plnpbt: 1_200_000 * scale,
    bscatot: 4_000_000 * scale,
    curlib: 2_000_000 * scale,
    bsfatot: 3_000_000 * scale,
    othass: 500_000 * scale,
    bsclbank: 700_000 * scale,
    bsslltd: 800_000 * scale,
    bsclstd: 300_000 * scale,
    bsqpuc: 1_000_000 * scale,
    grossProfit: 3_000_000 * scale,
    ebitda: 1_800_000 * scale,
    cashAndBank: 900_000 * scale,
    tradeReceivables: 1_234_567 * scale,
    tradePayables: 700_000 * scale,
    costOfSales: 7_000_000 * scale,
    annualDebtService: 600_000 * scale,
    netOperatingIncome: 1_500_000 * scale,
    interest_cost: 150_000 * scale,
    curlib_borrowing: 400_000 * scale,
    ncl_loan: 600_000 * scale,
    operatingCashFlow: 1_100_000 * scale,
    freeCashFlow: 700_000 * scale,
  };
}

function ctosRow(year: number, account: Record<string, unknown>) {
  return { financial_year: year, dates: { pldd: `${year}-12-31`, bsdd: null }, account };
}

function ctosAccount(scale: number): Record<string, unknown> {
  return {
    ...fullYear(scale),
    totass: 9_000_000 * scale,
    totlib: 4_000_000 * scale,
    networth: 5_000_000 * scale,
    currat: 1.37,
    return_on_equity: 18.3,
    gear: 0.8,
    profit_margin: 12.1,
  };
}

const FIXTURES: Record<string, FinancialInputs> = {
  "User Input year after CTOS years": {
    financialStatements: {
      questionnaire: { financial_year_end: "2026-12-31" },
      unaudited_by_year: { "2026": { ...fullYear(1.25), pldd: "2026-12-31" } },
    },
    ctosFinancials: [ctosRow(2024, ctosAccount(0.75)), ctosRow(2025, ctosAccount(1))],
  },
  "CTOS years with an explicit gap-fill": {
    financialStatements: {
      questionnaire: { financial_year_end: "2026-12-31" },
      unaudited_by_year: { "2026": { ...fullYear(1.5), pldd: "2026-12-31" } },
      admin_field_overrides: {
        "2025": {
          cashAndBank: {
            value: 654_321,
            baseSource: "ctos",
            action: "add_missing_ctos_field",
            updated_by_user_id: "admin",
            updated_at: "2026-01-01T00:00:00.000Z",
          },
        },
      },
    },
    ctosFinancials: [
      ctosRow(2024, ctosAccount(0.5)),
      ctosRow(2025, { ...ctosAccount(1), cashAndBank: null }),
    ],
  },
  "Admin Input years marked audited": {
    financialStatements: {
      questionnaire: { financial_year_end: "2026-12-31" },
      unaudited_by_year: { "2026": { ...fullYear(1.5), pldd: "2026-12-31" } },
      admin_input_by_year: {
        "2024": { ...fullYear(0.5), statementType: "AUDITED", pldd: "2024-12-31" },
        "2025": { ...fullYear(0.75), statementType: "NOT_AUDITED", pldd: "2025-12-31" },
      },
    },
    ctosFinancials: [],
  },
  "missing SSM-expected year": {
    financialStatements: {
      questionnaire: { financial_year_end: "2026-12-31" },
      unaudited_by_year: {},
    },
    ctosFinancials: [ctosRow(2023, ctosAccount(1)), ctosRow(2024, ctosAccount(1.25))],
  },
};

const NOTE = {
  noteId: "note-complete-freeze",
  isPublished: false,
  issuerSnapshot: { name: "Freeze Co Sdn Bhd", industry: "Construction" },
  invoiceSnapshot: { offer_details: { risk_rating: "SME-3" } },
  paymasterSnapshot: { name: "Paymaster Sdn Bhd", entity_type: "Corporate" },
};

function approvedResult(inputs: FinancialInputs): ApprovedFinancialResult {
  return approvedFinancialResultFromInputs({ ...inputs, ref: REF });
}

/** Unpublished preview: the Note financial snapshot's approved result. */
function livePages(inputs: FinancialInputs) {
  const input: ProspectusPageThreeBuilderInput = {
    ...NOTE,
    financialMode: "live_unpublished_preview",
    approvedFinancialResult: approvedResult(inputs),
    frozenFinancialComparison: null,
  };
  return pagesFor(input);
}

function frozenPages(frozen: ProspectusPage2FinancialComparisonSnapshot) {
  return pagesFor({
    ...NOTE,
    financialMode: "frozen_publication_snapshot",
    approvedFinancialResult: null,
    frozenFinancialComparison: frozen,
  });
}

function pagesFor(input: ProspectusPageThreeBuilderInput) {
  const page2Input: ProspectusPageTwoBuilderInput = {
    ...input,
    noteReference: "NR-FREEZE",
    maturityDate: null,
  };
  const page2 = buildProspectusPageTwo(page2Input);
  const page3 = buildProspectusPageThree(input);
  return {
    page2,
    page3,
    html: { page2: buildProspectusPageTwoHtml(page2), page3: buildProspectusPageThreeHtml(page3) },
  };
}

/** Freeze as approve stores it: canonical numbers, then a JSON round trip, then the strict parser. */
function storedFreeze(inputs: FinancialInputs): ProspectusPage2FinancialComparisonSnapshot {
  const page2 = canonicalizeJsonNumbers(
    buildProspectusPage2Snapshot({ approvedFinancialResult: approvedResult(inputs), now: REF })
  );
  const stored = JSON.parse(JSON.stringify(page2)) as { financial_comparison: unknown };
  const parsed = parseProspectusPageTwoFinancialComparison(stored.financial_comparison);
  if (!parsed) throw new Error("stored freeze did not parse");
  return parsed;
}

const OMIT_KEYS = new Set([
  // Raw and calculated values are compared separately (canonical numbers, serialized values).
  "rawFinancials",
  "calculatedValues",
  // Live-only Admin editing affordance; not part of the approved result.
  "adminFallbackEligible",
  "adminFallbackEligibleYears",
  // Render metadata (financialMode differs by construction).
  "meta",
]);

function comparable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(comparable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !OMIT_KEYS.has(key))
        .map(([key, item]) => [key, comparable(item)])
    );
  }
  return value;
}

/** What a preview raw value becomes in the stored freeze (serialize, then canonical numbers). */
function expectedFrozenScalar(value: unknown): string | number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return Number.isSafeInteger(value) ? value : Number(value.toPrecision(15));
  }
  if (typeof value === "string") return value.trim() || null;
  return value == null ? null : parseProspectusFinancialNumber(value);
}

describe("complete Page 2 financial freeze (version 2)", () => {
  describe.each(Object.entries(FIXTURES))("%s", (_name, inputs) => {
    it("renders Page 2 and Page 3 from the stored freeze exactly as the snapshot preview", () => {
      const live = livePages(inputs);
      const frozen = frozenPages(storedFreeze(inputs));

      expect(frozen.html.page2).toBe(live.html.page2);
      expect(frozen.html.page3).toBe(live.html.page3);
      expect(comparable(frozen.page2)).toEqual(comparable(live.page2));
      expect(comparable(frozen.page3)).toEqual(comparable(live.page3));
    });

    it("carries every raw key and every calculated value of each selected year, the statement type and missing-year state", () => {
      const source = buildProspectusFinancialComparisonSourceFromResult(approvedResult(inputs));
      const freeze = storedFreeze(inputs);

      expect(source.years.length).toBeGreaterThan(0);
      expect(freeze.freeze_version).toBe(2);
      expect(freeze.reference_date).toBe(REF.toISOString());
      expect(freeze.missing_ssm_unaudited_years).toEqual(source.missingSsmUnauditedYears);
      expect(freeze.ops_warning).toBe(source.opsWarning);
      expect(freeze.selected_years.map((year) => year.year)).toEqual(
        source.years.map((year) => year.year)
      );
      source.years.forEach((liveYear, index) => {
        const frozenYear = freeze.selected_years[index]!;
        expect(frozenYear.statement_type).toBe(liveYear.statementType);
        expect(frozenYear.record_source).toBe(liveYear.recordSource);
        for (const key of PROSPECTUS_PAGE_TWO_RAW_FINANCIAL_KEYS) {
          expect(frozenYear.raw_financials).toHaveProperty(key);
        }
        for (const [key, value] of Object.entries(liveYear.rawFinancials)) {
          expect([key, frozenYear.raw_financials[key]]).toEqual([key, expectedFrozenScalar(value)]);
        }
        expect(Object.keys(frozenYear.calculated_values ?? {})).toEqual([
          ...FINANCIAL_REVIEW_CALCULATED_KEYS,
        ]);
        expect(frozenYear.calculated_values).toEqual(canonicalizeJsonNumbers(liveYear.calculatedValues));
      });

      const rebuilt = buildFinancialComparisonSourceFromFrozen(freeze);
      expect(rebuilt.missingSsmUnauditedYears).toEqual(source.missingSsmUnauditedYears);
      expect(rebuilt.opsWarning).toBe(source.opsWarning);
      expect(rebuilt.sourceFooter).toBe(source.sourceFooter);
    });
  });

  it("the equivalence check fails for an 18-key freeze (proves it detects dropped keys)", () => {
    const inputs = FIXTURES["User Input year after CTOS years"]!;
    const legacy = legacyFreezeOf(storedFreeze(inputs));
    expect(frozenPages(legacy).html.page3).not.toBe(livePages(inputs).html.page3);
    expect(frozenPages(legacy).html.page2).not.toBe(livePages(inputs).html.page2);
  });

  it("keeps the real statement type of an Admin Input year marked audited", () => {
    const freeze = storedFreeze(FIXTURES["Admin Input years marked audited"]!);
    const rebuilt = buildFinancialComparisonSourceFromFrozen(freeze);
    const fy2024 = rebuilt.years.find((year) => year.year === 2024);
    expect(fy2024?.recordSource).toBe("admin_input");
    expect(fy2024?.statementType).toBe("AUDITED");
    // Legacy reconstruction (record_source only) would have called it management accounts.
    const legacyYear = buildFinancialComparisonSourceFromFrozen(legacyFreezeOf(freeze)).years.find(
      (year) => year.year === 2024
    );
    expect(legacyYear?.statementType).toBe("MANAGEMENT_ACCOUNTS");
  });

  it("D16: extended Page 2 / Page 3 rows keep their values after the freeze", () => {
    const inputs = FIXTURES["User Input year after CTOS years"]!;
    const live = livePages(inputs);
    const frozen = frozenPages(storedFreeze(inputs));
    const latest = (rows: Array<{ key: string; values: string[] }>, key: string) =>
      rows.find((row) => row.key === key)?.values.at(-1);

    const checks: Array<[string, Array<{ key: string; values: string[] }>, Array<{ key: string; values: string[] }>, string[]]> = [
      [
        "page2 metrics",
        live.page2.financialComparisonMetrics.rows,
        frozen.page2.financialComparisonMetrics.rows,
        ["netDebtEquity", "interestCoverage", "dscr", "receivablesDays"],
      ],
      [
        "page3 income statement",
        live.page3.incomeStatement.rows,
        frozen.page3.incomeStatement.rows,
        ["gross_profit", "ebitda", "ebit"],
      ],
      [
        "page3 balance sheet",
        live.page3.balanceSheet.rows,
        frozen.page3.balanceSheet.rows,
        ["cash_and_bank", "trade_receivables", "quick_ratio"],
      ],
      [
        "page3 coverage",
        live.page3.coverageEfficiency.rows,
        frozen.page3.coverageEfficiency.rows,
        [
          "operating_cash_flow",
          "free_cash_flow",
          "interest_coverage",
          "dscr",
          "receivables_days",
          "payables_days",
        ],
      ],
    ];
    for (const [label, liveRows, frozenRows, keys] of checks) {
      for (const key of keys) {
        const liveValue = latest(liveRows, key);
        expect([label, key, liveValue === DNA || liveValue == null]).toEqual([label, key, false]);
        expect([label, key, latest(frozenRows, key)]).toEqual([label, key, liveValue]);
      }
    }
  });

  it("derives trends from the frozen values (trends are not stored separately)", () => {
    const inputs = FIXTURES["User Input year after CTOS years"]!;
    const freeze = storedFreeze(inputs);
    expect(JSON.stringify(freeze)).not.toMatch(/trend/i);
    const live = livePages(inputs);
    const frozen = frozenPages(freeze);
    expect(live.page3.trends).toEqual(frozen.page3.trends);
    expect(live.page3.incomeTrendInsight).toEqual(frozen.page3.incomeTrendInsight);
    expect(JSON.stringify(frozen.page3.trends)).not.toBe(
      JSON.stringify(frozenPages({ ...freeze, selected_years: [] }).page3.trends)
    );
  });

  it("D17: a frozen render selects the same years after the filing window has moved", () => {
    const inputs = FIXTURES["User Input year after CTOS years"]!;
    const freeze = storedFreeze(inputs);
    const atApproval = frozenPages(freeze);

    const resolverSpy = jest.spyOn(sourceModule, "buildProspectusFinancialComparisonSourceFromResult");
    jest.useFakeTimers({ now: new Date("2031-06-30T00:00:00.000Z") });
    try {
      const later = frozenPages(freeze);
      expect(later.page2.financialComparisonSource.years.map((year) => year.year)).toEqual(
        atApproval.page2.financialComparisonSource.years.map((year) => year.year)
      );
      expect(later.html.page2).toBe(atApproval.html.page2);
      expect(later.html.page3).toBe(atApproval.html.page3);
      // No source or year selection runs for a frozen render.
      expect(resolverSpy).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
      resolverSpy.mockRestore();
    }
  });
});

/** The pre-version-2 shape of a freeze: 18 raw keys, no statement type, calculated values or missing-year state. */
function legacyFreezeOf(
  freeze: ProspectusPage2FinancialComparisonSnapshot
): ProspectusPage2FinancialComparisonSnapshot {
  const raw = JSON.parse(JSON.stringify(freeze)) as Record<string, unknown> & {
    selected_years: Array<Record<string, unknown> & { raw_financials: Record<string, unknown> }>;
  };
  delete raw.freeze_version;
  delete raw.reference_date;
  delete raw.missing_ssm_unaudited_years;
  delete raw.ops_warning;
  raw.selected_years = raw.selected_years.map((year) => {
    const { statement_type: _statementType, calculated_values: _calculated, ...rest } = year;
    return {
      ...rest,
      raw_financials: Object.fromEntries(
        PROSPECTUS_PAGE_TWO_RAW_FINANCIAL_KEYS.map((key) => [key, year.raw_financials[key] ?? null])
      ),
    };
  });
  const parsed = parseProspectusPageTwoFinancialComparison(raw);
  if (!parsed) throw new Error("legacy freeze did not parse");
  return parsed;
}

describe("legacy freeze (no freeze_version)", () => {
  const legacyComparison = {
    source: "admin_financial_statements_normalized",
    selected_years: [
      {
        year: 2024,
        year_label: "FY2024",
        financial_year_end_label: "31 Dec 2024",
        financial_year_end_iso: "2024-12-31",
        record_source: "admin_input",
        raw_financials: {
          turnover: 10_000_000,
          plnpat: " 900000 ",
          bsqpuc: null,
          bscatot: 4_000_000,
          curlib: 2_000_000,
          totass: 9_000_000,
          totlib: 4_000_000,
          networth: 5_000_000,
          return_on_equity: 18,
          currat: 2,
          // Pre-version-2 freezes never carried these; they must stay ignored.
          ebit: 1_000_000,
          cashAndBank: 500_000,
        },
      },
    ],
    source_footer: " Source: Management Accounts ",
    calculated_at: "2026-07-19T00:00:00.000Z",
  };

  it("parses exactly as before: 18 keys (null-filled), no version-2 fields", () => {
    expect(parseProspectusPageTwoFinancialComparison(legacyComparison)).toEqual({
      source: "admin_financial_statements_normalized",
      selected_years: [
        {
          year: 2024,
          year_label: "FY2024",
          financial_year_end_label: "31 Dec 2024",
          financial_year_end_iso: "2024-12-31",
          record_source: "admin_input",
          raw_financials: {
            turnover: 10_000_000,
            plnpat: "900000",
            bsqpuc: null,
            bscatot: 4_000_000,
            curlib: 2_000_000,
            plnpbt: null,
            bsfatot: null,
            othass: null,
            bsclbank: null,
            bsslltd: null,
            bsclstd: null,
            totass: 9_000_000,
            totlib: 4_000_000,
            networth: 5_000_000,
            profit_margin: null,
            return_on_equity: 18,
            currat: 2,
            gear: null,
          },
        },
      ],
      source_footer: "Source: Management Accounts",
      calculated_at: "2026-07-19T00:00:00.000Z",
    });
  });

  it("renders as before: 18 keys, derived statement type, no ops state, extended rows unavailable", () => {
    const parsed = parseProspectusPageTwoFinancialComparison(legacyComparison)!;
    const source = buildFinancialComparisonSourceFromFrozen(parsed);
    expect(Object.keys(source.years[0]!.rawFinancials)).toEqual([
      ...PROSPECTUS_PAGE_TWO_RAW_FINANCIAL_KEYS,
    ]);
    expect(source.years[0]!.statementType).toBe("MANAGEMENT_ACCOUNTS");
    expect(source.missingSsmUnauditedYears).toEqual([]);
    expect(source.opsWarning).toBeNull();
    expect(source.sourceFooter).toBe("Source: Management Accounts");

    const pages = frozenPages(parsed);
    const latest = (rows: Array<{ key: string; values: string[] }>, key: string) =>
      rows.find((row) => row.key === key)?.values.at(-1);
    const page2 = pages.page2.financialComparisonMetrics.rows;
    const { incomeStatement, balanceSheet, coverageEfficiency } = pages.page3;
    // What legacy freezes always displayed from their 18 raw keys.
    expect(latest(page2, "revenue")).toBe("10");
    expect(latest(page2, "netProfitMargin")).toBe("9%");
    expect(latest(page2, "roe")).toBe("18%");
    expect(latest(page2, "currentRatio")).toBe("2x");
    expect(latest(incomeStatement.rows, "net_profit_margin")).toBe("9%");
    expect(latest(balanceSheet.rows, "total_assets")).toBe("9");
    expect(latest(balanceSheet.rows, "total_liabilities")).toBe("4");
    expect(latest(balanceSheet.rows, "total_equity")).toBe("5");
    expect(latest(balanceSheet.rows, "current_ratio")).toBe("2x");
    expect(latest(coverageEfficiency.rows, "debt_equity")).toBe("0.8x");
    expect(latest(coverageEfficiency.rows, "return_on_assets")).toBe("10%");
    expect(latest(coverageEfficiency.rows, "asset_turnover")).toBe("1.11x");
    expect(latest(coverageEfficiency.rows, "return_on_equity")).toBe("18%");
    // Keys legacy freezes never carried stay unavailable.
    for (const key of ["netDebtEquity", "interestCoverage", "dscr", "receivablesDays"]) {
      expect([key, latest(page2, key)]).toEqual([key, DNA]);
    }
    expect(latest(incomeStatement.rows, "ebit")).toBe(DNA);
    expect(latest(balanceSheet.rows, "quick_ratio")).toBe(DNA);
    expect(latest(coverageEfficiency.rows, "payables_days")).toBe(DNA);
  });

  it("treats an unknown freeze_version as a legacy freeze (accepted as before)", () => {
    const parsed = parseProspectusPageTwoFinancialComparison({
      ...legacyComparison,
      freeze_version: 3,
    });
    expect(parsed).not.toBeNull();
    expect(parsed?.freeze_version).toBeUndefined();
    expect(Object.keys(parsed!.selected_years[0]!.raw_financials)).toHaveLength(18);
  });
});

function allNull(): Record<string, number | null> {
  return Object.fromEntries(FINANCIAL_REVIEW_CALCULATED_KEYS.map((key) => [key, null]));
}

function omitKey(key: string): Record<string, number | null> {
  const values = allNull();
  delete values[key];
  return values;
}

describe("Page 2 financial_comparison parser", () => {
  const withCalculated = (calculated: unknown) => ({
    ...v2,
    selected_years: [{ ...v2.selected_years[0], calculated_values: calculated }],
  });
  const v2 = {
    source: "admin_financial_statements_normalized",
    freeze_version: 2,
    reference_date: "2026-08-01T00:00:00.000Z",
    selected_years: [
      {
        year: 2025,
        year_label: "FY2025",
        financial_year_end_label: null,
        financial_year_end_iso: "2025-12-31",
        record_source: "admin_input",
        statement_type: "AUDITED",
        raw_financials: { turnover: 1, ebit: 2, cashAndBank: "3", pldd: "2025-12-31", odd: true },
        calculated_values: {
          ...Object.fromEntries(FINANCIAL_REVIEW_CALCULATED_KEYS.map((key) => [key, null])),
          profit_margin: 12.5,
          totass: 0,
        },
      },
    ],
    source_footer: "Source: Audited Financial Statements",
    calculated_at: "2026-09-30T00:00:00.000Z",
    missing_ssm_unaudited_years: [2026],
    ops_warning: "warning",
  };

  it("accepts a version-2 freeze and keeps every raw key and calculated value", () => {
    const parsed = parseProspectusPageTwoFinancialComparison(v2);
    expect(parsed?.freeze_version).toBe(2);
    expect(parsed?.reference_date).toBe("2026-08-01T00:00:00.000Z");
    expect(parsed?.missing_ssm_unaudited_years).toEqual([2026]);
    expect(parsed?.ops_warning).toBe("warning");
    const year = parsed!.selected_years[0]!;
    expect(year.statement_type).toBe("AUDITED");
    expect(year.raw_financials).toMatchObject({
      turnover: 1,
      ebit: 2,
      cashAndBank: "3",
      pldd: "2025-12-31",
      odd: null,
      gear: null,
    });
    expect(year.calculated_values).toEqual({
      ...Object.fromEntries(FINANCIAL_REVIEW_CALCULATED_KEYS.map((key) => [key, null])),
      profit_margin: 12.5,
      totass: 0,
    });
  });

  it("does not let a raw key reach the object prototype", () => {
    const withProto = JSON.parse(
      JSON.stringify(v2).replace('"odd":true', '"__proto__":{"polluted":1}')
    ) as unknown;
    const parsed = parseProspectusPageTwoFinancialComparison(withProto);
    const raw = parsed!.selected_years[0]!.raw_financials as Record<string, unknown>;
    expect(Object.getPrototypeOf(raw)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it.each([
    ["not an object", null],
    ["unknown source", { ...v2, source: "live" }],
    ["missing calculated_at", { ...v2, calculated_at: " " }],
    ["selected_years not an array", { ...v2, selected_years: {} }],
    ["year out of range", { ...v2, selected_years: [{ ...v2.selected_years[0], year: 99 }] }],
    ["missing year_label", { ...v2, selected_years: [{ ...v2.selected_years[0], year_label: "" }] }],
    ["raw_financials not an object", { ...v2, selected_years: [{ ...v2.selected_years[0], raw_financials: [] }] }],
    ["version 2 without missing-year state", { ...v2, missing_ssm_unaudited_years: undefined }],
    ["version 2 with non-integer missing years", { ...v2, missing_ssm_unaudited_years: ["2026"] }],
    ["version 2 year without calculated values", withCalculated(undefined)],
    ["version 2 year with calculated values not an object", withCalculated([])],
    ["version 2 year missing a calculated key", withCalculated(omitKey("dscr"))],
    ["version 2 year with a string calculated value", withCalculated({ ...allNull(), roa: "1.5" })],
    ["version 2 year with a non-finite calculated value", withCalculated({ ...allNull(), gear: Number.NaN })],
  ])("rejects %s", (_label, value) => {
    expect(parseProspectusPageTwoFinancialComparison(value)).toBeNull();
  });
});
