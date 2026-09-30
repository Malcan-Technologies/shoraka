jest.mock("@cashsouk/config", () => jest.requireActual("../../../../packages/config/src/currency"));

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FINANCIAL_REVIEW_CALCULATED_KEYS,
  resolveFinancialReviewResult,
  type FinancialReviewCalculatedValues,
  type FinancialReviewYearKind,
} from "@cashsouk/types";
import {
  CANNOT_CALCULATE_LABEL,
  findFinancialReviewResultYear,
  formatFinancialReviewCalculatedCell,
  isFinancialReviewCalculatedRow,
  resolveFinancialReviewReferenceDate,
} from "./application-financial-review-calculated-cell";

function values(overrides: Partial<FinancialReviewCalculatedValues> = {}): FinancialReviewCalculatedValues {
  const out = {} as FinancialReviewCalculatedValues;
  for (const key of FINANCIAL_REVIEW_CALCULATED_KEYS) out[key] = null;
  return { ...out, ...overrides };
}

const STORED = values({
  totass: 1_234_567.4,
  totlib: 250_000,
  networth: 984_567,
  ebit: -12_345,
  workcap: 50_000,
  turnover_growth: 12.5,
  profit_margin: 8.123,
  roa: 0.5,
  return_on_equity: 8.6,
  currat: 1.325,
  quickRatio: 0.8,
  receivablesDays: 45.678,
  payablesDays: 30,
  assetTurnover: 2,
  gear: 1.5,
  netDebtEquity: -0.25,
  interestCoverage: 7.5,
  dscr: 1.42,
});

describe("formatFinancialReviewCalculatedCell", () => {
  it.each([
    ["totass", "RM 1,234,567"],
    ["totlib", "RM 250,000"],
    ["networth", "RM 984,567"],
    ["ebit", "RM -12,345"],
    ["workcap", "RM 50,000"],
    ["turnover_growth", "12.50%"],
    ["profit_margin", "8.12%"],
    ["roa", "0.50%"],
    ["return_of_equity", "8.60%"],
    ["currat", "1.33"],
    ["quickRatio", "0.80"],
    ["assetTurnover", "2.00x"],
    ["gear", "1.50x"],
    ["debtEquityPercent", "1.50x"],
    ["netDebtEquity", "-0.25x"],
    ["interestCoverage", "7.50x"],
    ["dscr", "1.42x"],
    ["receivablesDays", "45.68"],
    ["payablesDays", "30.00"],
  ])("%s → %s", (rowId, expected) => {
    expect(isFinancialReviewCalculatedRow(rowId)).toBe(true);
    expect(formatFinancialReviewCalculatedCell(rowId, STORED)).toBe(expected);
  });

  it("percent metrics are already percent points: never multiplied by 100", () => {
    const cell = formatFinancialReviewCalculatedCell("profit_margin", values({ profit_margin: 12.5 }));
    expect(cell).toBe("12.50%");
    expect(cell).not.toContain("1,250");
  });

  it("Return on Equity reads return_on_equity; Gearing reads gear", () => {
    expect(formatFinancialReviewCalculatedCell("return_of_equity", values({ return_on_equity: 3 }))).toBe(
      "3.00%"
    );
    expect(formatFinancialReviewCalculatedCell("debtEquityPercent", values({ gear: 0.75 }))).toBe("0.75x");
  });

  it("a zero value is shown, not treated as missing", () => {
    expect(formatFinancialReviewCalculatedCell("totass", values({ totass: 0 }))).toBe("RM 0");
    expect(formatFinancialReviewCalculatedCell("return_of_equity", values({ return_on_equity: 0 }))).toBe(
      "0.00%"
    );
  });

  it("null → Cannot calculate for every calculated row", () => {
    for (const rowId of ["totass", "turnover_growth", "return_of_equity", "debtEquityPercent", "dscr"]) {
      expect(formatFinancialReviewCalculatedCell(rowId, values())).toBe(CANNOT_CALCULATE_LABEL);
    }
  });

  it("a column with no matching result year → Cannot calculate", () => {
    expect(formatFinancialReviewCalculatedCell("totass", undefined)).toBe(CANNOT_CALCULATE_LABEL);
    expect(formatFinancialReviewCalculatedCell("totass", null)).toBe(CANNOT_CALCULATE_LABEL);
  });

  it("raw rows are not calculated rows", () => {
    for (const rowId of ["turnover", "plnpat", "bsfatot", "cashAndBank", "pldd", "return_on_equity"]) {
      expect(isFinancialReviewCalculatedRow(rowId)).toBe(false);
    }
  });
});

describe("resolveFinancialReviewReferenceDate", () => {
  const now = new Date("2026-10-01T00:00:00.000Z");

  it("uses the application submission date when valid", () => {
    expect(resolveFinancialReviewReferenceDate("2026-03-01T08:00:00.000Z", now).toISOString()).toBe(
      "2026-03-01T08:00:00.000Z"
    );
  });

  it.each([null, undefined, "", "not-a-date"])("falls back to today for %p", (submittedAt) => {
    expect(resolveFinancialReviewReferenceDate(submittedAt, now)).toBe(now);
  });
});

describe("Admin Financial Review cells from a real Financial Review result", () => {
  const gapFill = (value: number) => ({
    value,
    baseSource: "ctos",
    action: "add_missing_ctos_field",
    updated_by_user_id: "admin-1",
    updated_at: "2026-09-01T00:00:00.000Z",
  });

  // FY2024 CTOS: no finished totals/gear and no PAT/revenue; Admin gap-filled PAT and revenue.
  // FY2026 User Input: complete except Other Assets.
  const result = resolveFinancialReviewResult({
    financialStatements: {
      questionnaire: { financial_year_end: "2026-12-31" },
      unaudited_by_year: {
        "2026": {
          pldd: "2026-12-31",
          bsfatot: 100,
          bscatot: 400,
          bsclbank: 250,
          curlib: 200,
          bsslltd: 150,
          bsclstd: 50,
          cashAndBank: 120,
          curlib_borrowing: 60,
          ncl_loan: 140,
          turnover: 1000,
          plnpbt: 130,
          plnpat: 100,
        },
      },
      admin_input_by_year: {},
      admin_field_overrides: { "2024": { plnpat: gapFill(50), turnover: gapFill(1000) } },
    },
    ctosFinancials: [
      { financial_year: 2023, dates: { pldd: "2023-12-31", bsdd: null }, account: { turnover: 800 } },
      {
        financial_year: 2024,
        dates: { pldd: "2024-12-31", bsdd: null },
        account: {
          bsfatot: 100,
          othass: 0,
          bscatot: 300,
          bsclbank: 100,
          curlib: 150,
          bsslltd: 50,
          bsclstd: 0,
          curlib_borrowing: 40,
          ncl_loan: 60,
          cashAndBank: 20,
        },
      },
    ],
    referenceDate: new Date("2026-09-25T00:00:00.000Z"),
    ctosFetchState: "has_data",
  });

  const cell = (year: number, kind: FinancialReviewYearKind, rowId: string) => {
    const entry = findFinancialReviewResultYear(result, year, kind);
    if (!entry) throw new Error(`No ${kind} result year for FY${year}`);
    return formatFinancialReviewCalculatedCell(rowId, entry.calculated_values);
  };

  it("CTOS year: margin, ROA, asset turnover and growth calculate from the gap-filled PAT / revenue", () => {
    expect(cell(2024, "ctos", "profit_margin")).toBe("5.00%");
    expect(cell(2024, "ctos", "roa")).toBe("10.00%");
    expect(cell(2024, "ctos", "assetTurnover")).toBe("2.00x");
    expect(cell(2024, "ctos", "turnover_growth")).toBe("25.00%");
  });

  it("CTOS year: ROA, asset turnover, net debt/equity and gearing use the fallback totals", () => {
    expect(cell(2024, "ctos", "totass")).toBe("RM 500");
    expect(cell(2024, "ctos", "totlib")).toBe("RM 200");
    expect(cell(2024, "ctos", "networth")).toBe("RM 300");
    expect(cell(2024, "ctos", "netDebtEquity")).toBe("0.27x");
    expect(cell(2024, "ctos", "gear")).toBe("0.67x");
    expect(cell(2024, "ctos", "debtEquityPercent")).toBe("0.67x");
    expect(cell(2024, "ctos", "return_of_equity")).toBe("16.67%");
  });

  it("User Input year with a missing asset line: dependent metrics cannot calculate (never built on 0)", () => {
    for (const rowId of [
      "totass",
      "networth",
      "roa",
      "assetTurnover",
      "gear",
      "debtEquityPercent",
      "netDebtEquity",
      "return_of_equity",
    ]) {
      expect(cell(2026, "unaudited", rowId)).toBe(CANNOT_CALCULATE_LABEL);
    }
    // Metrics that do not need Total Assets still calculate.
    expect(cell(2026, "unaudited", "totlib")).toBe("RM 400");
    expect(cell(2026, "unaudited", "profit_margin")).toBe("10.00%");
    expect(cell(2026, "unaudited", "currat")).toBe("2.00");
  });
});

describe("shared-result sourcing (source text)", () => {
  // Formula helpers = every function exported by the two shared formula modules.
  const FORMULA_MODULES = ["ctos-report-table-math.ts", "ctos-financial-highlights.ts"];
  const FORMULA_HELPERS = new Set(
    FORMULA_MODULES.flatMap((file) =>
      [
        ...readFileSync(join(__dirname, "../../../../packages/types/src", file), "utf8").matchAll(
          /export function (\w+)/g
        ),
      ].map((match) => match[1]!)
    )
  );
  const TYPES_IMPORT = /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+"@cashsouk\/types"/g;

  function formulaHelpersImported(source: string): string[] {
    const found: string[] = [];
    for (const match of source.matchAll(TYPES_IMPORT)) {
      for (const specifier of match[1]!.split(",")) {
        const name = specifier.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0]!.trim();
        if (FORMULA_HELPERS.has(name)) found.push(name);
      }
    }
    for (const match of source.matchAll(/import\("@cashsouk\/types"\)\.(\w+)/g)) {
      if (FORMULA_HELPERS.has(match[1]!)) found.push(match[1]!);
    }
    return found;
  }

  it("knows the resolveCtos* and compute* formula helpers", () => {
    for (const name of ["resolveCtosGearingRatio", "resolveCtosPatMarginPercent", "computeEbit", "computeDscr"]) {
      expect(FORMULA_HELPERS.has(name)).toBe(true);
    }
  });

  it("no Prospectus Review file imports a formula helper from @cashsouk/types", () => {
    const dir = join(__dirname, "../notes/prospectus-review");
    const files = readdirSync(dir).filter(
      (file) => /\.(ts|tsx)$/.test(file) && !/\.test\.(ts|tsx)$/.test(file)
    );
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect({ file, helpers: formulaHelpersImported(readFileSync(join(dir, file), "utf8")) }).toEqual({
        file,
        helpers: [],
      });
    }
  });

  it("the Financial Review screen imports the shared result, not formula helpers", () => {
    const source = readFileSync(join(__dirname, "application-financial-review-content.tsx"), "utf8");
    expect(formulaHelpersImported(source)).toEqual([]);
    expect(source).toMatch(/import\s+\{[^}]*\bresolveFinancialReviewResult\b[^}]*\}\s+from\s+"@cashsouk\/types"/);
  });

  it("the helper itself detects a formula import", () => {
    expect(
      formulaHelpersImported('import {\n  resolveCtosGearingRatio,\n  type NoteDetail,\n} from "@cashsouk/types";')
    ).toEqual(["resolveCtosGearingRatio"]);
    expect(formulaHelpersImported('import { computeEbit as ebit } from "@cashsouk/types";')).toEqual([
      "computeEbit",
    ]);
  });
});
