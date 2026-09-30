/**
 * SECTION: Financial Review result
 * WHY: Admin Review, Financial approval, Note and Prospectus read the same reviewed values and
 * calculated metrics. These cases pin the approved calculation hierarchy and the year selection.
 */

import {
  resolveCtosGearingRatio,
  resolveCtosPatMarginPercent,
  resolveCtosReturnOnAssetsPercent,
  resolveCtosTotalAssetTurnover,
} from "./ctos-financial-highlights";
import {
  computeDscr,
  computeEbit,
  computeInterestCoverage,
  computePayablesDays,
  computeQuickRatio,
  computeReceivablesDays,
} from "./ctos-report-table-math";
import { ADMIN_EDITABLE_RAW_FINANCIAL_KEYS } from "./financial-field-resolution";
import {
  FINANCIAL_REVIEW_CALCULATED_KEYS,
  parseApprovedFinancialResult,
  resolveFinancialReviewResult,
  type FinancialReviewResolvedYear,
  type FinancialReviewResult,
  type FinancialReviewYearKind,
} from "./financial-review-result";
import { FINANCIAL_STATEMENT_SOURCE_FOOTER } from "./financial-statement-year-resolution";

/** Questionnaire FYE 2026-12-31: SSM deadline for FY2025 is 2026-06-30. */
const FYE = "2026-12-31";
/** After the deadline: issuer tab years [2026]. Admin historical window FY2023–FY2025. */
const AFTER_DEADLINE = new Date("2026-09-25T00:00:00.000Z");
/** Before the deadline: issuer tab years [2025, 2026]. */
const BEFORE_DEADLINE = new Date("2026-03-01T00:00:00.000Z");

/**
 * Real CTOS account: company 200501525124, FYE 30-06-2024 (ctos-test/output).
 * CTOS direct ROE 8.6 and gear 1.5 differ from PAT ÷ networth (7.84) and totlib ÷ networth (1.37).
 */
const REAL_ACCOUNT_200501525124 = {
  bsfatot: 0,
  othass: 0,
  bscatot: 2109152381,
  bsclbank: 2056177549,
  totass: 4165329930,
  curlib: 1592807689,
  bsslltd: 817697089,
  bsclstd: 0,
  totlib: 2410504778,
  networth: 1754825152,
  turnover: 1723857391,
  plnpbt: 216927247,
  plnpat: 137514515,
  turnover_growth: 0,
  profit_margin: 12.6,
  return_on_equity: 8.6,
  currat: 1.32,
  workcap: 516344692,
  gear: 1.5,
};

/** Real CTOS account: company 198401018032, FYE 31-12-2018 (ctos-test/output). */
const REAL_ACCOUNT_198401018032 = {
  bsfatot: 0,
  othass: 0,
  bscatot: 253218,
  bsclbank: 248135,
  totass: 501353,
  curlib: 117631,
  bsslltd: 0,
  bsclstd: 0,
  totlib: 117631,
  networth: 383722,
  turnover: 0,
  plnpbt: 0,
  plnpat: 0,
  turnover_growth: 0,
  profit_margin: 0,
  return_on_equity: 0,
  currat: 2.15,
  workcap: 135587,
  gear: 0,
};

type Account = Record<string, number | null>;

function ctosRow(year: number, account: Account, pldd: string = `${year}-12-31`) {
  return { financial_year: year, dates: { pldd, bsdd: null }, account };
}

function without(account: Account, ...keys: string[]): Account {
  const out = { ...account };
  for (const key of keys) delete out[key];
  return out;
}

function gapFill(value: number) {
  return {
    value,
    baseSource: "ctos",
    action: "add_missing_ctos_field",
    updated_by_user_id: "admin-1",
    updated_at: "2026-09-01T00:00:00.000Z",
  };
}

function userInputEdit(value: number) {
  return {
    value,
    baseSource: "user_input",
    action: "edit_user_input",
    updated_by_user_id: "admin-1",
    updated_at: "2026-09-01T00:00:00.000Z",
  };
}

function resolve(params: {
  unaudited?: Record<string, Record<string, unknown>>;
  admin?: Record<string, Record<string, unknown>>;
  overrides?: Record<string, Record<string, unknown>>;
  ctos?: ReturnType<typeof ctosRow>[];
  ref?: Date;
  ctosFetchState?: "not_pulled" | "no_records" | "has_data";
}): FinancialReviewResult {
  return resolveFinancialReviewResult({
    financialStatements: {
      questionnaire: { financial_year_end: FYE },
      unaudited_by_year: params.unaudited ?? {},
      admin_input_by_year: params.admin ?? {},
      admin_field_overrides: params.overrides ?? {},
    },
    ctosFinancials: params.ctos ?? [],
    referenceDate: params.ref ?? AFTER_DEADLINE,
    ctosFetchState: params.ctosFetchState,
  });
}

function entry(
  result: FinancialReviewResult,
  year: number,
  kind: FinancialReviewYearKind
): FinancialReviewResolvedYear {
  const found = result.years.find((item) => item.year === year && item.kind === kind);
  if (!found) throw new Error(`No ${kind} entry for FY${year}`);
  return found;
}

/** Complete User Input year: every asset/liability line and every metric input present. */
const FULL_USER_BLOCK = {
  pldd: "2026-12-31",
  bsfatot: 100,
  othass: 50,
  bscatot: 400,
  bsclbank: 250,
  curlib: 200,
  bsslltd: 150,
  bsclstd: 50,
  cashAndBank: 120,
  tradeReceivables: 180,
  tradePayables: 90,
  costOfSales: 600,
  turnover: 1000,
  plnpbt: 130,
  plnpat: 100,
  interest_cost: 20,
  curlib_borrowing: 60,
  ncl_loan: 140,
  netOperatingIncome: 300,
  annualDebtService: 150,
};

describe("resolveFinancialReviewResult — CTOS direct figures", () => {
  const result = resolve({ ctos: [ctosRow(2024, REAL_ACCOUNT_200501525124, "30-06-2024")] });
  const fy2024 = entry(result, 2024, "ctos");
  const account = REAL_ACCOUNT_200501525124;

  it.each([
    ["totass", 4165329930],
    ["totlib", 2410504778],
    ["networth", 1754825152],
    ["turnover_growth", 0],
    ["return_on_equity", 8.6],
    ["currat", 1.32],
    ["workcap", 516344692],
    ["gear", 1.5],
  ] as const)("%s uses the CTOS figure", (key, expected) => {
    expect(fy2024.calculated_values[key]).toBe(expected);
  });

  it("profit margin is PAT margin from reviewed values, never CTOS profit_margin (PBT margin)", () => {
    expect(fy2024.calculated_values.profit_margin).toBeCloseTo((137514515 / 1723857391) * 100, 10);
    expect(fy2024.calculated_values.profit_margin).not.toBe(12.6);
  });

  it("ROA and asset turnover use the stylesheet formulas on the CTOS totals", () => {
    expect(fy2024.calculated_values.roa).toBe(
      resolveCtosReturnOnAssetsPercent({ plnpat: account.plnpat, totass: account.totass })
    );
    expect(fy2024.calculated_values.assetTurnover).toBe(
      resolveCtosTotalAssetTurnover({ turnover: account.turnover, totass: account.totass })
    );
  });

  it("a zero CTOS figure counts as present", () => {
    const zero = resolve({ ctos: [ctosRow(2018, REAL_ACCOUNT_198401018032)] });
    const values = entry(zero, 2018, "ctos").calculated_values;
    expect(values.return_on_equity).toBe(0);
    expect(values.gear).toBe(0);
    expect(values.turnover_growth).toBe(0);
    expect(values.currat).toBe(2.15);
    // PAT margin with zero revenue cannot be calculated.
    expect(values.profit_margin).toBeNull();
  });

  it("returns every calculated key", () => {
    expect(Object.keys(fy2024.calculated_values).sort()).toEqual(
      [...FINANCIAL_REVIEW_CALCULATED_KEYS].sort()
    );
  });
});

describe("resolveFinancialReviewResult — CTOS fallbacks when the figure is absent", () => {
  const priorTurnover = 1_500_000_000;
  const valuesWithout = (...keys: string[]) =>
    entry(
      resolve({
        ctos: [
          ctosRow(2023, { turnover: priorTurnover }),
          ctosRow(2024, without(REAL_ACCOUNT_200501525124, ...keys)),
        ],
      }),
      2024,
      "ctos"
    ).calculated_values;

  it.each([
    ["totass", 0 + 0 + 2109152381 + 2056177549],
    ["totlib", 1592807689 + 817697089 + 0],
    ["networth", 4165329930 - 2410504778],
    ["turnover_growth", ((1723857391 - priorTurnover) / priorTurnover) * 100],
    ["return_on_equity", (137514515 / 1754825152) * 100],
    ["currat", 2109152381 / 1592807689],
    ["workcap", 2109152381 - 1592807689],
    ["gear", 2410504778 / 1754825152],
  ] as const)("%s falls back to the formula", (key, expected) => {
    expect(valuesWithout(key)[key]).toBeCloseTo(expected, 8);
  });

  it("net worth fallback uses the resolved (fallback) totals", () => {
    const values = valuesWithout("totass", "totlib", "networth");
    expect(values.totass).toBe(4165329930);
    expect(values.totlib).toBe(2410504778);
    expect(values.networth).toBe(1754825152);
  });

  it("ROA, asset turnover, net debt/equity and gearing use the resolved fallback totals", () => {
    const account: Account = {
      bsfatot: 100,
      othass: 0,
      bscatot: 300,
      bsclbank: 100,
      curlib: 150,
      bsslltd: 50,
      bsclstd: 0,
      turnover: 1000,
      plnpat: 50,
      curlib_borrowing: 40,
      ncl_loan: 60,
      cashAndBank: 20,
    };
    const values = entry(resolve({ ctos: [ctosRow(2024, account)] }), 2024, "ctos")
      .calculated_values;
    expect(values.totass).toBe(500);
    expect(values.totlib).toBe(200);
    expect(values.networth).toBe(300);
    expect(values.roa).toBeCloseTo(10, 10);
    expect(values.assetTurnover).toBe(2);
    expect(values.netDebtEquity).toBeCloseTo((40 + 60 - 20) / 300, 10);
    expect(values.gear).toBeCloseTo(200 / 300, 10);
    expect(values.return_on_equity).toBeCloseTo((50 / 300) * 100, 10);
  });

  it("a CTOS figure on one total still feeds the fallback net worth", () => {
    const values = entry(
      resolve({
        ctos: [ctosRow(2024, { totass: 900, curlib: 100, bsslltd: 100, bsclstd: 100 })],
      }),
      2024,
      "ctos"
    ).calculated_values;
    expect(values.totass).toBe(900);
    expect(values.totlib).toBe(300);
    expect(values.networth).toBe(600);
  });
});

describe("resolveFinancialReviewResult — Admin gap-fills are reviewed inputs", () => {
  const result = resolve({
    ctos: [
      ctosRow(2023, { turnover: 800 }),
      ctosRow(2024, { totass: 2000, totlib: 500, networth: 1500, bscatot: 10 }),
    ],
    overrides: { "2024": { plnpat: gapFill(100), turnover: gapFill(1000) } },
  });
  const fy2024 = entry(result, 2024, "ctos");

  it("feeds margin, ROA, asset turnover and growth", () => {
    const values = fy2024.calculated_values;
    expect(values.profit_margin).toBe(resolveCtosPatMarginPercent({ plnpat: 100, turnover: 1000 }));
    expect(values.roa).toBe(resolveCtosReturnOnAssetsPercent({ plnpat: 100, totass: 2000 }));
    expect(values.assetTurnover).toBe(resolveCtosTotalAssetTurnover({ turnover: 1000, totass: 2000 }));
    expect(values.turnover_growth).toBeCloseTo(25, 10);
    expect(values.return_on_equity).toBeCloseTo((100 / 1500) * 100, 10);
  });

  it("appears in the effective raw values; missing CTOS lines become null, not empty strings", () => {
    const raw = fy2024.effective_raw_values;
    expect(raw.plnpat).toBe(100);
    expect(raw.turnover).toBe(1000);
    expect(raw.totass).toBe(2000);
    expect(raw.bscatot).toBe(10);
    expect(raw.grossProfit).toBeNull();
    expect(raw.pldd).toBe("2024-12-31");
    expect(Object.values(raw)).not.toContain("");
  });

  it("does not replace a present CTOS value", () => {
    const withValue = resolve({
      ctos: [ctosRow(2024, { turnover: 700 })],
      overrides: { "2024": { turnover: gapFill(1000) } },
    });
    const fy = entry(withValue, 2024, "ctos");
    expect(fy.effective_raw_values.turnover).toBe(700);
    expect(fy.source_trace.fields.turnover).toEqual({ source: "ctos", edited_by_admin: false });
  });
});

describe("resolveFinancialReviewResult — missing is not zero", () => {
  const { othass: _omitted, ...missingOneAssetLine } = FULL_USER_BLOCK;
  const dependents = [
    "totass",
    "networth",
    "return_on_equity",
    "roa",
    "assetTurnover",
    "gear",
    "netDebtEquity",
  ] as const;

  it.each([
    ["User Input", "unaudited" as const, 2026, { unaudited: { "2026": missingOneAssetLine } }],
    [
      "Admin Input",
      "admin_input" as const,
      2025,
      {
        unaudited: { "2026": FULL_USER_BLOCK },
        admin: { "2025": { ...missingOneAssetLine, pldd: "2025-12-31" } },
      },
    ],
  ])("%s block missing one asset line → totals-dependent metrics null", (_label, kind, year, data) => {
    const values = entry(resolve(data), year, kind).calculated_values;
    for (const key of dependents) expect(values[key]).toBeNull();
    // Unaffected metrics still calculate.
    expect(values.totlib).toBe(400);
    expect(values.profit_margin).toBeCloseTo(10, 10);
    expect(values.currat).toBe(2);
  });

  it("missing PAT → margin, ROE and ROA null", () => {
    const { plnpat: _pat, ...noPat } = FULL_USER_BLOCK;
    const values = entry(resolve({ unaudited: { "2026": noPat } }), 2026, "unaudited")
      .calculated_values;
    expect(values.profit_margin).toBeNull();
    expect(values.return_on_equity).toBeNull();
    expect(values.roa).toBeNull();
    expect(values.totass).toBe(800);
  });

  it("an empty-string input is missing, not zero", () => {
    const values = entry(
      resolve({ unaudited: { "2026": { ...FULL_USER_BLOCK, othass: "" } } }),
      2026,
      "unaudited"
    ).calculated_values;
    expect(values.totass).toBeNull();
  });

  it("a stored Total Assets / Total Liabilities on the block is used as the reported total", () => {
    const values = entry(
      resolve({ unaudited: { "2026": { ...missingOneAssetLine, totass: 900, totlib: 300 } } }),
      2026,
      "unaudited"
    ).calculated_values;
    expect(values.totass).toBe(900);
    expect(values.totlib).toBe(300);
    expect(values.networth).toBe(600);
  });
});

describe("resolveFinancialReviewResult — User Input / Admin Input formulas", () => {
  it("ROE on a User Input year uses totass − totlib even when the block carries networth", () => {
    const fy = entry(
      resolve({ unaudited: { "2026": { ...FULL_USER_BLOCK, networth: 50 } } }),
      2026,
      "unaudited"
    );
    // totass 800, totlib 400 → net worth 400
    expect(fy.calculated_values.networth).toBe(400);
    expect(fy.calculated_values.return_on_equity).toBeCloseTo((100 / 400) * 100, 10);
    expect(fy.calculated_values.gear).toBe(resolveCtosGearingRatio({ gear: null, totlib: 400, networth: 400 }));
  });

  it("a CTOS-style gear / return_on_equity on a User Input block is not treated as a figure", () => {
    const values = entry(
      resolve({ unaudited: { "2026": { ...FULL_USER_BLOCK, gear: 9, return_on_equity: 99 } } }),
      2026,
      "unaudited"
    ).calculated_values;
    expect(values.gear).toBe(1);
    expect(values.return_on_equity).toBeCloseTo(25, 10);
  });

  it("EBIT, quick ratio, interest coverage, payables days and DSCR equal the existing helpers", () => {
    const b = FULL_USER_BLOCK;
    const values = entry(resolve({ unaudited: { "2026": b } }), 2026, "unaudited").calculated_values;
    const ebit = computeEbit(b.plnpbt, b.interest_cost);
    expect(values.ebit).toBe(ebit);
    expect(values.quickRatio).toBe(computeQuickRatio(b.cashAndBank, b.tradeReceivables, b.curlib));
    expect(values.interestCoverage).toBe(computeInterestCoverage(ebit, b.interest_cost));
    expect(values.payablesDays).toBe(computePayablesDays(b.tradePayables, b.costOfSales));
    expect(values.dscr).toBe(computeDscr(b.netOperatingIncome, b.annualDebtService));
    expect(values.ebit).toBe(150);
  });

  it("Admin edits of User Input feed the calculations", () => {
    const values = entry(
      resolve({
        unaudited: { "2026": FULL_USER_BLOCK },
        overrides: { "2026": { plnpat: userInputEdit(200) } },
      }),
      2026,
      "unaudited"
    ).calculated_values;
    expect(values.profit_margin).toBeCloseTo(20, 10);
  });
});

describe("resolveFinancialReviewResult — prior-year rule (turnover growth, receivables days)", () => {
  const current = { turnover: 1200, tradeReceivables: 300, pldd: "2026-12-31" };

  it.each([
    [
      "User Input year: prior User Input first",
      {
        unaudited: { "2025": { turnover: 1000, tradeReceivables: 100 }, "2026": current },
        ctos: [ctosRow(2025, { turnover: 800, tradeReceivables: 200 })],
      },
      2026,
      "unaudited" as const,
      { turnover: 1000, tradeReceivables: 100 },
    ],
    [
      "User Input year: then prior CTOS",
      {
        unaudited: { "2026": current },
        ctos: [ctosRow(2025, { turnover: 800, tradeReceivables: 200 })],
      },
      2026,
      "unaudited" as const,
      { turnover: 800, tradeReceivables: 200 },
    ],
    [
      "User Input year: then prior Admin Input",
      {
        unaudited: { "2026": current },
        admin: { "2025": { turnover: 600, tradeReceivables: 50 } },
      },
      2026,
      "unaudited" as const,
      { turnover: 600, tradeReceivables: 50 },
    ],
    [
      "CTOS year: prior CTOS, never prior User Input",
      {
        unaudited: { "2024": { turnover: 1000, tradeReceivables: 100 }, "2026": current },
        ctos: [
          ctosRow(2024, { turnover: 800, tradeReceivables: 200 }),
          ctosRow(2025, { turnover: 1200, tradeReceivables: 300 }),
        ],
      },
      2025,
      "ctos" as const,
      { turnover: 800, tradeReceivables: 200 },
    ],
    [
      "Admin Input year: prior Admin Input, never prior User Input",
      {
        unaudited: { "2024": { turnover: 1000, tradeReceivables: 100 }, "2026": current },
        admin: {
          "2024": { turnover: 600, tradeReceivables: 50 },
          "2025": { turnover: 1200, tradeReceivables: 300 },
        },
      },
      2025,
      "admin_input" as const,
      { turnover: 600, tradeReceivables: 50 },
    ],
  ])("%s", (_label, data, year, kind, prior) => {
    const values = entry(resolve(data), year, kind).calculated_values;
    expect(values.turnover_growth).toBeCloseTo(((1200 - prior.turnover) / prior.turnover) * 100, 10);
    expect(values.receivablesDays).toBe(computeReceivablesDays(prior.tradeReceivables, 300, 1200));
  });

  it.each([
    [
      "CTOS year with only a prior User Input year",
      {
        unaudited: { "2024": { turnover: 1000, tradeReceivables: 100 }, "2026": current },
        ctos: [ctosRow(2025, { turnover: 1200, tradeReceivables: 300 })],
      },
      2025,
      "ctos" as const,
    ],
    [
      "Admin Input year with only a prior User Input year",
      {
        unaudited: { "2024": { turnover: 1000, tradeReceivables: 100 }, "2026": current },
        admin: { "2025": { turnover: 1200, tradeReceivables: 300 } },
      },
      2025,
      "admin_input" as const,
    ],
    ["User Input year with no prior year", { unaudited: { "2026": current } }, 2026, "unaudited" as const],
  ])("%s → null", (_label, data, year, kind) => {
    const values = entry(resolve(data), year, kind).calculated_values;
    expect(values.turnover_growth).toBeNull();
    expect(values.receivablesDays).toBeNull();
  });
});

describe("resolveFinancialReviewResult — year selection", () => {
  it("User Input beats CTOS for the same FY; the CTOS column stays as a reviewed column", () => {
    const result = resolve({
      unaudited: { "2025": { turnover: 10, pldd: "2025-12-31" }, "2026": { turnover: 20 } },
      ctos: [ctosRow(2025, { turnover: 99 })],
    });
    const ctos = entry(result, 2025, "ctos");
    const user = entry(result, 2025, "unaudited");
    expect([ctos.reviewed_column, ctos.selected]).toEqual([true, false]);
    expect([user.reviewed_column, user.selected]).toEqual([true, true]);
    expect(user.effective_raw_values.turnover).toBe(10);
    expect(result.source_footer).toBe(FINANCIAL_STATEMENT_SOURCE_FOOTER.management);
  });

  it("CTOS beats Admin Input for the same FY", () => {
    const result = resolve({
      unaudited: { "2026": { turnover: 20 } },
      admin: { "2025": { turnover: 77, pldd: "2025-12-31" } },
      ctos: [ctosRow(2025, { turnover: 40 })],
    });
    expect(result.years.filter((year) => year.year === 2025).map((year) => year.kind)).toEqual(["ctos"]);
    expect(entry(result, 2025, "ctos").selected).toBe(true);
    expect(entry(result, 2025, "ctos").effective_raw_values.turnover).toBe(40);
    expect(result.source_footer).toBe(FINANCIAL_STATEMENT_SOURCE_FOOTER.mixed);
  });

  it("selects the latest three years only", () => {
    const result = resolve({
      unaudited: { "2026": { turnover: 20 } },
      ctos: [2021, 2022, 2023, 2024].map((year) => ctosRow(year, { turnover: year })),
      ctosFetchState: "has_data",
    });
    expect(result.years.map((year) => [year.year, year.kind, year.reviewed_column, year.selected])).toEqual([
      [2023, "ctos", true, true],
      [2024, "ctos", true, true],
      [2026, "unaudited", true, true],
    ]);
  });

  it("a selected year that is not a review column still gets an entry", () => {
    const result = resolve({
      ctos: [2020, 2021, 2022].map((year) => ctosRow(year, { turnover: year * 10, plnpat: 5 })),
      ctosFetchState: "has_data",
    });
    expect(result.years.map((year) => [year.year, year.kind, year.reviewed_column, year.selected])).toEqual([
      [2020, "ctos", false, true],
      [2021, "ctos", false, true],
      [2022, "ctos", false, true],
    ]);
    const fy2022 = entry(result, 2022, "ctos");
    expect(fy2022.source_trace.fields.turnover).toEqual({ source: "ctos", edited_by_admin: false });
    expect(fy2022.source_trace.fields.grossProfit).toEqual({
      source: "ctos",
      edited_by_admin: false,
      unavailable_reason: "not_provided_by_ctos",
    });
    expect(fy2022.calculated_values.turnover_growth).toBeNull();
    expect(fy2022.calculated_values.profit_margin).toBeCloseTo((5 / 20220) * 100, 10);
  });

  it("orders by year, then CTOS, Admin Input, User Input; one selected source per year", () => {
    const result = resolve({
      unaudited: {
        "2024": { turnover: 1 },
        "2025": { turnover: 2 },
        "2026": { turnover: 3 },
      },
      admin: { "2025": { turnover: 4, statementType: "AUDITED" } },
      ctos: [ctosRow(2024, { turnover: 5 })],
    });
    expect(result.years.map((year) => [year.year, year.kind, year.selected])).toEqual([
      [2024, "ctos", false],
      [2024, "unaudited", true],
      [2025, "admin_input", false],
      [2025, "unaudited", true],
      [2026, "unaudited", true],
    ]);
  });

  it("Admin-Input-only years outside the SSM window are selected with their statement type", () => {
    const result = resolve({
      unaudited: { "2026": { turnover: 9_000_000 } },
      admin: {
        "2024": { turnover: 4_000_000, pldd: "2024-12-31", statementType: "NOT_AUDITED" },
        "2025": { turnover: 5_000_000, pldd: "2025-12-31", statementType: "MANAGEMENT_ACCOUNTS" },
        "2023": { turnover: 3_000_000, pldd: "2023-12-31" },
      },
    });
    const selected = result.years.filter((year) => year.selected);
    expect(selected.map((year) => [year.year, year.record_source, year.statement_type])).toEqual([
      [2024, "admin_input", "NOT_AUDITED"],
      [2025, "admin_input", "MANAGEMENT_ACCOUNTS"],
      [2026, "unaudited_management", "MANAGEMENT_ACCOUNTS"],
    ]);
    expect(entry(result, 2023, "admin_input").statement_type).toBe("NOT_AUDITED");
    expect(entry(result, 2023, "admin_input").selected).toBe(false);
    expect(result.source_footer).toBe(FINANCIAL_STATEMENT_SOURCE_FOOTER.management);
  });

  it("FYE: selected years keep the selection-logic FYE; CTOS non-ISO pldd falls back to the questionnaire", () => {
    const result = resolve({
      unaudited: { "2025": { turnover: 10, pldd: "2025-12-31" }, "2026": { turnover: 20 } },
      ctos: [ctosRow(2025, { turnover: 99 }, "2025-06-30"), ctosRow(2024, { turnover: 1 }, "30-06-2024")],
    });
    // FY2025 enters the set as CTOS, resolves to User Input: FYE is the CTOS pldd, as the Prospectus does.
    expect(entry(result, 2025, "unaudited").financial_year_end_iso).toBe("2025-06-30");
    expect(entry(result, 2024, "ctos").financial_year_end_iso).toBe("2024-12-31");
    expect(entry(result, 2026, "unaudited").financial_year_end_iso).toBe("2026-12-31");
  });
});

describe("resolveFinancialReviewResult — reviewed raw values and source trace", () => {
  it("User Input year with an Admin edit: effective raw values", () => {
    const result = resolve({
      unaudited: {
        "2026": {
          pldd: "2026-12-31",
          turnover: 10,
          tradeReceivables: 10,
          plnpat: "1,000",
          grossProfit: "",
          nested: { ignored: true },
        },
      },
      overrides: { "2026": { tradeReceivables: userInputEdit(12) } },
    });
    const fy = entry(result, 2026, "unaudited");
    expect(fy.effective_raw_values).toEqual({
      pldd: "2026-12-31",
      turnover: 10,
      tradeReceivables: 12,
      plnpat: 1000,
      grossProfit: null,
    });
    expect(fy.source_trace.inputs).toEqual({
      user_input: {
        pldd: "2026-12-31",
        turnover: 10,
        tradeReceivables: 10,
        plnpat: "1,000",
        grossProfit: "",
        nested: { ignored: true },
      },
      admin_input: null,
      ctos: null,
      admin_overrides: { tradeReceivables: userInputEdit(12) },
    });
  });

  it("CTOS year with a gap-fill: inputs trace the CTOS row and the stored overrides", () => {
    const result = resolve({
      ctos: [ctosRow(2024, { turnover: 500 })],
      overrides: { "2024": { plnpat: gapFill(40) } },
    });
    const fy = entry(result, 2024, "ctos");
    expect(fy.source_trace.inputs.ctos).toMatchObject({ turnover: 500, plnpat: "", pldd: "2024-12-31" });
    expect(fy.source_trace.inputs.admin_overrides).toEqual({ plnpat: gapFill(40) });
    expect(fy.source_trace.inputs.user_input).toBeNull();
    expect(fy.source_trace.inputs.admin_input).toBeNull();
    expect(fy.effective_raw_values.plnpat).toBe(40);
    expect(fy.effective_raw_values.turnover).toBe(500);
  });

  it("labels every field source", () => {
    const result = resolve({
      unaudited: { "2026": { turnover: 10, plnpat: 1 } },
      admin: { "2025": { turnover: 30, statementType: "AUDITED" } },
      ctos: [ctosRow(2024, { turnover: 20 })],
      overrides: {
        "2024": { plnpat: gapFill(2) },
        "2026": { plnpat: userInputEdit(3) },
      },
    });
    const cases: Array<[number, FinancialReviewYearKind, string, object]> = [
      [2024, "ctos", "turnover", { source: "ctos", edited_by_admin: false }],
      [2024, "ctos", "plnpat", { source: "admin_input", edited_by_admin: true }],
      [
        2024,
        "ctos",
        "grossProfit",
        { source: "ctos", edited_by_admin: false, unavailable_reason: "not_provided_by_ctos" },
      ],
      [2026, "unaudited", "turnover", { source: "user_input", edited_by_admin: false }],
      [2026, "unaudited", "plnpat", { source: "user_input", edited_by_admin: true }],
      [
        2026,
        "unaudited",
        "grossProfit",
        { source: "user_input", edited_by_admin: false, unavailable_reason: "not_provided" },
      ],
      [2025, "admin_input", "turnover", { source: "admin_input", edited_by_admin: false }],
      [
        2025,
        "admin_input",
        "plnpat",
        { source: "admin_input", edited_by_admin: false, unavailable_reason: "not_provided" },
      ],
    ];
    for (const [year, kind, key, expected] of cases) {
      expect(entry(result, year, kind).source_trace.fields[key]).toEqual(expected);
    }
    for (const year of result.years) {
      expect(Object.keys(year.source_trace.fields)).toEqual([...ADMIN_EDITABLE_RAW_FINANCIAL_KEYS]);
    }
    expect(entry(result, 2025, "admin_input").statement_type).toBe("AUDITED");
    expect(entry(result, 2025, "admin_input").source_trace.inputs.admin_input).toEqual({
      turnover: 30,
      statementType: "AUDITED",
    });
  });
});

describe("resolveFinancialReviewResult — reference date and purity", () => {
  const onlyCurrentYear = { unaudited: { "2026": { turnover: 20, pldd: "2026-12-31" } } };
  const bothYears = {
    unaudited: {
      "2025": { turnover: 10, pldd: "2025-12-31" },
      "2026": { turnover: 20, pldd: "2026-12-31" },
    },
  };

  it("before the SSM deadline FY2025 is an expected year; after it, only FY2026", () => {
    const before = resolve({ ...onlyCurrentYear, ref: BEFORE_DEADLINE });
    expect(before.missing_ssm_unaudited_years).toEqual([2025]);
    expect(before.ops_warning).toContain("FY2025");
    const after = resolve({ ...onlyCurrentYear, ref: AFTER_DEADLINE });
    expect(after.missing_ssm_unaudited_years).toEqual([]);
    expect(after.ops_warning).toBeNull();
    expect(after.reference_date).toBe(AFTER_DEADLINE.toISOString());
  });

  it("selection follows the reference date tab years", () => {
    const before = resolve({ ...bothYears, ref: BEFORE_DEADLINE });
    expect(before.years.map((year) => [year.year, year.selected])).toEqual([
      [2025, true],
      [2026, true],
    ]);
    const after = resolve({ ...bothYears, ref: AFTER_DEADLINE });
    expect(after.years.map((year) => [year.year, year.selected])).toEqual([
      [2025, false],
      [2026, true],
    ]);
  });

  it("never reads the clock", () => {
    const scenarios = [
      bothYears,
      { ctos: [ctosRow(2024, REAL_ACCOUNT_200501525124)], ctosFetchState: "has_data" as const },
    ];
    try {
      jest.useFakeTimers();
      for (const scenario of scenarios) {
        jest.setSystemTime(new Date("2020-01-01T00:00:00.000Z"));
        const early = resolve({ ...scenario, ref: BEFORE_DEADLINE });
        jest.setSystemTime(new Date("2031-07-15T00:00:00.000Z"));
        const late = resolve({ ...scenario, ref: BEFORE_DEADLINE });
        expect(late).toEqual(early);
      }
    } finally {
      jest.useRealTimers();
    }
  });

  function deepFreeze<T>(value: T): T {
    if (value && typeof value === "object") {
      for (const item of Object.values(value as Record<string, unknown>)) deepFreeze(item);
      Object.freeze(value);
    }
    return value;
  }

  const fullInput = () => ({
    financialStatements: {
      questionnaire: { financial_year_end: FYE },
      unaudited_by_year: {
        "2025": { ...FULL_USER_BLOCK, pldd: "2025-12-31" },
        "2026": { ...FULL_USER_BLOCK, grossProfit: "" },
      },
      admin_input_by_year: { "2023": { turnover: 500, statementType: "AUDITED" } },
      admin_field_overrides: {
        "2024": { plnpat: gapFill(10) },
        "2026": { turnover: userInputEdit(1100) },
      },
    },
    ctosFinancials: [
      ctosRow(2024, without(REAL_ACCOUNT_200501525124, "plnpat")),
      ctosRow(2025, { turnover: 900 }),
    ],
    referenceDate: AFTER_DEADLINE,
    ctosFetchState: "has_data" as const,
  });

  it("does not mutate its inputs", () => {
    const input = fullInput();
    const snapshot = JSON.parse(JSON.stringify(input.financialStatements));
    const ctosSnapshot = JSON.parse(JSON.stringify(input.ctosFinancials));
    deepFreeze(input.financialStatements);
    deepFreeze(input.ctosFinancials);
    const result = resolveFinancialReviewResult(input);
    expect(input.financialStatements).toEqual(snapshot);
    expect(input.ctosFinancials).toEqual(ctosSnapshot);
    // The trace is a copy: editing it does not reach the inputs.
    const trace = entry(result, 2026, "unaudited").source_trace.inputs.user_input!;
    trace.turnover = -1;
    expect(input.financialStatements.unaudited_by_year["2026"].turnover).toBe(1000);
  });

  it("is JSON-safe and accepted by the approved-result parser", () => {
    const result = resolveFinancialReviewResult(fullInput());
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
    for (const year of result.years) {
      for (const key of FINANCIAL_REVIEW_CALCULATED_KEYS) {
        const value = year.calculated_values[key];
        expect(value === null || Number.isFinite(value)).toBe(true);
      }
    }
    const approved = parseApprovedFinancialResult({
      ...result,
      version: 1,
      application_id: "app-1",
      review_cycle: 1,
      approved_at: "2026-09-26T00:00:00.000Z",
      reviewer_user_id: "admin-1",
      ctos_report: null,
    });
    expect(approved?.years).toEqual(result.years);
  });

  it("is deterministic for the same input", () => {
    expect(resolveFinancialReviewResult(fullInput())).toEqual(resolveFinancialReviewResult(fullInput()));
  });

  it("tolerates empty and malformed inputs", () => {
    const result = resolveFinancialReviewResult({
      financialStatements: null,
      ctosFinancials: "not-an-array",
      referenceDate: AFTER_DEADLINE,
    });
    expect(result.years).toEqual([]);
    expect(result.source_footer).toBe(FINANCIAL_STATEMENT_SOURCE_FOOTER.neutral);
    expect(result.missing_ssm_unaudited_years).toEqual([]);
  });
});

describe("resolveFinancialReviewResult — CTOS gap-fill and User Input edit on one FY field", () => {
  const unaudited = {
    "2027": { turnover: 70, pldd: "2027-12-31" },
    "2026": { turnover: 60, tradeReceivables: 50, pldd: "2026-12-31" },
  };
  const ctos = [ctosRow(2026, { turnover: 900, tradeReceivables: null })];

  it("CTOS kind has 100, User Input kind has 120, User Input stays selected", () => {
    const overrides = {
      "2026": {
        tradeReceivables: { add_missing_ctos_field: gapFill(100), edit_user_input: userInputEdit(120) },
      },
    };
    const result = resolve({ unaudited, ctos, overrides });
    const ctosYear = entry(result, 2026, "ctos");
    const userYear = entry(result, 2026, "unaudited");
    expect(ctosYear.effective_raw_values.tradeReceivables).toBe(100);
    expect(ctosYear.source_trace.fields.tradeReceivables).toEqual({ source: "admin_input", edited_by_admin: true });
    expect(userYear.effective_raw_values.tradeReceivables).toBe(120);
    expect(userYear.source_trace.fields.tradeReceivables).toEqual({ source: "user_input", edited_by_admin: true });
    expect(userYear.selected).toBe(true);
    expect(ctosYear.selected).toBe(false);
    expect(ctosYear.source_trace.inputs.admin_overrides).toEqual(overrides["2026"]);
  });

  it("legacy single entries keep resolving per lane", () => {
    const gapOnly = resolve({ unaudited, ctos, overrides: { "2026": { tradeReceivables: gapFill(100) } } });
    expect(entry(gapOnly, 2026, "ctos").effective_raw_values.tradeReceivables).toBe(100);
    expect(entry(gapOnly, 2026, "unaudited").effective_raw_values.tradeReceivables).toBe(50);
    const userOnly = resolve({ unaudited, ctos, overrides: { "2026": { tradeReceivables: userInputEdit(120) } } });
    expect(entry(userOnly, 2026, "ctos").effective_raw_values.tradeReceivables).toBeNull();
    expect(entry(userOnly, 2026, "unaudited").effective_raw_values.tradeReceivables).toBe(120);
  });
});
