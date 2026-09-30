/**
 * SECTION: Prospectus financials are display-only (stored Financial Review values)
 * WHY: Financial Review resolves and calculates; the Prospectus preview, the approval freeze and
 * the frozen render only display the stored values. A changed stored value must show as is, and
 * no formula helper may run while rendering Page 2 / Page 3.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ApprovedFinancialResult, FinancialReviewCalculatedValues } from "@cashsouk/types";
import { approvedFinancialResultFromInputs } from "./prospectus-financial-comparison-test-helpers";
import { parseProspectusPageTwoFinancialComparison } from "./prospectus-json-guards";
import { buildProspectusPageThree, type ProspectusPageThreeBuilderInput } from "./prospectus-page-three-mapper";
import { buildProspectusPageThreeHtml } from "./prospectus-page-three.html";
import { buildProspectusPageTwo } from "./prospectus-page-two-mapper";
import { buildProspectusPage2Snapshot } from "./prospectus-page-two-snapshot";
import { buildProspectusPageTwoHtml } from "./prospectus-page-two.html";
import type { ProspectusPage2FinancialComparisonSnapshot } from "./prospectus-snapshot.types";

const REF = new Date("2026-09-25T00:00:00.000Z");

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
    grossProfit: 3_000_000 * scale,
    ebitda: 1_800_000 * scale,
    cashAndBank: 900_000 * scale,
    tradeReceivables: 1_200_000 * scale,
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

const INPUTS = {
  financialStatements: {
    questionnaire: { financial_year_end: "2026-12-31" },
    unaudited_by_year: { "2026": { ...fullYear(1.25), pldd: "2026-12-31" } },
  },
  ctosFinancials: [
    {
      financial_year: 2024,
      dates: { pldd: "2024-12-31", bsdd: null },
      account: { ...fullYear(0.75), totass: 6_750_000, totlib: 3_000_000, networth: 3_750_000 },
    },
    {
      financial_year: 2025,
      dates: { pldd: "2025-12-31", bsdd: null },
      account: { ...fullYear(1), totass: 9_000_000, totlib: 4_000_000, networth: 5_000_000 },
    },
  ],
  ref: REF,
};

/** Deliberately not what any formula would produce from the raw values. */
const ALTERED: Partial<FinancialReviewCalculatedValues> = {
  profit_margin: 99.99,
  return_on_equity: 55.55,
  currat: 7.77,
  netDebtEquity: 3.33,
  interestCoverage: 44.4,
  dscr: 5.55,
  receivablesDays: 123.9,
  payablesDays: 45.5,
  ebit: 7_700_000,
  networth: 8_800_000,
  quickRatio: 6.66,
  totass: 11_100_000,
  totlib: 2_200_000,
  gear: 0.42,
  roa: 12.34,
  assetTurnover: 2.5,
};

const NOTE = {
  noteId: "note-display-only",
  isPublished: false,
  issuerSnapshot: { name: "Display Co Sdn Bhd", industry: "Construction" },
  invoiceSnapshot: { offer_details: { risk_rating: "SME-3" } },
  paymasterSnapshot: { name: "Paymaster Sdn Bhd", entity_type: "Corporate" },
};

function withAlteredLatestYear(result: ApprovedFinancialResult): ApprovedFinancialResult {
  const copy = JSON.parse(JSON.stringify(result)) as ApprovedFinancialResult;
  const latest = copy.years.filter((year) => year.selected).at(-1)!;
  latest.calculated_values = { ...latest.calculated_values, ...ALTERED };
  return copy;
}

type PageBuilders = {
  buildProspectusPageTwo: typeof buildProspectusPageTwo;
  buildProspectusPageThree: typeof buildProspectusPageThree;
  buildProspectusPageTwoHtml: typeof buildProspectusPageTwoHtml;
  buildProspectusPageThreeHtml: typeof buildProspectusPageThreeHtml;
};

const REAL_BUILDERS: PageBuilders = {
  buildProspectusPageTwo,
  buildProspectusPageThree,
  buildProspectusPageTwoHtml,
  buildProspectusPageThreeHtml,
};

function render(
  input: Pick<
    ProspectusPageThreeBuilderInput,
    "financialMode" | "approvedFinancialResult" | "frozenFinancialComparison"
  >,
  builders: PageBuilders = REAL_BUILDERS
) {
  const page3Input: ProspectusPageThreeBuilderInput = { ...NOTE, ...input };
  const page2 = builders.buildProspectusPageTwo({
    ...page3Input,
    noteReference: "NR-DISPLAY",
    maturityDate: null,
  });
  const page3 = builders.buildProspectusPageThree(page3Input);
  return {
    page2,
    page3,
    html: {
      page2: builders.buildProspectusPageTwoHtml(page2),
      page3: builders.buildProspectusPageThreeHtml(page3),
    },
  };
}

function preview(result: ApprovedFinancialResult, builders?: PageBuilders) {
  return render(
    {
      financialMode: "live_unpublished_preview",
      approvedFinancialResult: result,
      frozenFinancialComparison: null,
    },
    builders
  );
}

function frozen(freeze: ProspectusPage2FinancialComparisonSnapshot, builders?: PageBuilders) {
  return render(
    {
      financialMode: "frozen_publication_snapshot",
      approvedFinancialResult: null,
      frozenFinancialComparison: freeze,
    },
    builders
  );
}

function storedFreeze(result: ApprovedFinancialResult): ProspectusPage2FinancialComparisonSnapshot {
  const page2 = buildProspectusPage2Snapshot({ approvedFinancialResult: result, now: REF });
  const parsed = parseProspectusPageTwoFinancialComparison(
    (JSON.parse(JSON.stringify(page2)) as { financial_comparison: unknown }).financial_comparison
  );
  if (!parsed) throw new Error("freeze did not parse");
  return parsed;
}

function latest(rows: Array<{ key: string; values: string[] }>, key: string): string | undefined {
  return rows.find((row) => row.key === key)?.values.at(-1);
}

describe("stored calculated values are displayed as stored", () => {
  const altered = withAlteredLatestYear(approvedFinancialResultFromInputs(INPUTS));

  it.each([
    ["unpublished preview (Note financial snapshot)", () => preview(altered)],
    ["frozen render (approval freeze round trip)", () => frozen(storedFreeze(altered))],
  ])("%s shows the altered values in every metric cell", (_label, build) => {
    const { page2, page3 } = build();
    const p2 = page2.financialComparisonMetrics.rows;
    expect(latest(p2, "netProfitMargin")).toBe("99.99%");
    expect(latest(p2, "roe")).toBe("55.55%");
    expect(latest(p2, "currentRatio")).toBe("7.77x");
    expect(latest(p2, "netDebtEquity")).toBe("3.33x");
    expect(latest(p2, "interestCoverage")).toBe("44.4x");
    expect(latest(p2, "dscr")).toBe("5.55x");
    expect(latest(p2, "receivablesDays")).toBe("123");

    const { incomeStatement, balanceSheet, coverageEfficiency } = page3;
    expect(latest(incomeStatement.rows, "net_profit_margin")).toBe("99.99%");
    expect(latest(incomeStatement.rows, "ebit")).toBe("7.7");
    expect(latest(balanceSheet.rows, "total_equity")).toBe("8.8");
    expect(latest(balanceSheet.rows, "quick_ratio")).toBe("6.66x");
    expect(latest(balanceSheet.rows, "total_assets")).toBe("11.1");
    expect(latest(balanceSheet.rows, "total_liabilities")).toBe("2.2");
    expect(latest(balanceSheet.rows, "current_ratio")).toBe("7.77x");
    expect(latest(coverageEfficiency.rows, "debt_equity")).toBe("0.42x");
    expect(latest(coverageEfficiency.rows, "return_on_assets")).toBe("12.34%");
    expect(latest(coverageEfficiency.rows, "asset_turnover")).toBe("2.5x");
    expect(latest(coverageEfficiency.rows, "return_on_equity")).toBe("55.55%");
    expect(latest(coverageEfficiency.rows, "interest_coverage")).toBe("44.4x");
    expect(latest(coverageEfficiency.rows, "dscr")).toBe("5.55x");
    expect(latest(coverageEfficiency.rows, "receivables_days")).toBe("123.9");
    expect(latest(coverageEfficiency.rows, "payables_days")).toBe("45.5");

    // Raw rows still come from the reviewed raw values (FY2026 = fullYear(1.25)).
    expect(latest(p2, "revenue")).toBe("12.5");
    expect(latest(incomeStatement.rows, "gross_profit")).toBe("3.8");
    expect(latest(balanceSheet.rows, "cash_and_bank")).toBe("1.1");
  });

  it("the approval freeze reproduces the preview exactly", () => {
    const result = approvedFinancialResultFromInputs(INPUTS);
    expect(frozen(storedFreeze(result)).html).toEqual(preview(result).html);
    expect(frozen(storedFreeze(altered)).html).toEqual(preview(altered).html);
  });
});

describe("no formula helper runs while rendering", () => {
  const FORMULA = /^(resolveCtos|compute)|^financialFormToBsPl$|^resolveFinancialReviewResult$/;

  it("Page 2 / Page 3 render the same output with every formula helper throwing", () => {
    // Built before the helpers are replaced: the snapshot and the freeze already hold the values.
    const result = approvedFinancialResultFromInputs(INPUTS);
    const freeze = storedFreeze(result);
    const expectedPreview = preview(result).html;
    const expectedFrozen = frozen(freeze).html;

    jest.isolateModules(() => {
      jest.doMock("@cashsouk/types", () => {
        const actual = jest.requireActual<Record<string, unknown>>("@cashsouk/types");
        const mocked: Record<string, unknown> = { ...actual };
        for (const [name, value] of Object.entries(actual)) {
          if (typeof value === "function" && FORMULA.test(name)) {
            mocked[name] = () => {
              throw new Error(`formula helper ${name} ran during render`);
            };
          }
        }
        return mocked;
      });
      /* eslint-disable @typescript-eslint/no-require-imports -- fresh module graph with the mock */
      const types = require("@cashsouk/types") as Record<string, () => unknown>;
      expect(() => types.resolveCtosPatMarginPercent!()).toThrow("ran during render");
      expect(() => types.computeEbit!()).toThrow("ran during render");
      const builders: PageBuilders = {
        buildProspectusPageTwo: require("./prospectus-page-two-mapper").buildProspectusPageTwo,
        buildProspectusPageThree: require("./prospectus-page-three-mapper").buildProspectusPageThree,
        buildProspectusPageTwoHtml: require("./prospectus-page-two.html").buildProspectusPageTwoHtml,
        buildProspectusPageThreeHtml: require("./prospectus-page-three.html").buildProspectusPageThreeHtml,
      };
      /* eslint-enable @typescript-eslint/no-require-imports */

      expect(preview(result, builders).html).toEqual(expectedPreview);
      expect(frozen(freeze, builders).html).toEqual(expectedFrozen);
    });
  });
});

describe("import guard: only the legacy-freeze file may use formula helpers", () => {
  const LEGACY_FILE = "prospectus-legacy-frozen-financials.ts";
  const TYPES_SRC = join(__dirname, "../../../../../../packages/types/src");

  /** Every exported function of the shared formula modules. */
  const formulaExports = ["ctos-report-table-math.ts", "ctos-financial-highlights.ts"].flatMap(
    (file) =>
      [...readFileSync(join(TYPES_SRC, file), "utf8").matchAll(/export function (\w+)/g)].map(
        (match) => match[1]!
      )
  );
  const FORBIDDEN = [
    ...formulaExports,
    "financialFormToBsPl",
    "buildNormalizedFinancialStatementYearSet",
    "applyResolvedRawFields",
    "resolveFinancialReviewResult",
    "loadApplicationOwnedCtosFinancialReport",
    "financial_statements",
    "ctosReport",
  ];

  /** Code only: comments and string literals removed (audit metadata strings are not calls). */
  function codeOf(source: string): string {
    return source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1")
      .replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g, '""');
  }

  function forbiddenIn(source: string): string[] {
    const code = codeOf(source);
    const hits = FORBIDDEN.filter((name) => new RegExp(`\\b${name}\\b`).test(code));
    const resolveCtos = code.match(/\bresolveCtos\w*/g) ?? [];
    return [...new Set([...hits, ...resolveCtos])];
  }

  const productionFiles = readdirSync(__dirname).filter(
    (name) =>
      name.endsWith(".ts") &&
      !name.endsWith(".test.ts") &&
      !name.endsWith("-test-helpers.ts") &&
      !name.endsWith(".sample-data.ts")
  );

  it("finds the formula modules and the production files", () => {
    expect(formulaExports).toEqual(expect.arrayContaining(["computeEbit", "resolveCtosPatMarginPercent"]));
    expect(productionFiles).toEqual(expect.arrayContaining([LEGACY_FILE, "prospectus-page-two-mapper.ts"]));
    // The scanner does detect a helper: the legacy file is the one allowed user.
    expect(forbiddenIn(readFileSync(join(__dirname, LEGACY_FILE), "utf8"))).toEqual(
      expect.arrayContaining(["resolveCtosPatMarginPercent"])
    );
  });

  it.each(productionFiles.filter((name) => name !== LEGACY_FILE))(
    "%s uses no formula helper, resolver, application or CTOS read",
    (name) => {
      expect(forbiddenIn(readFileSync(join(__dirname, name), "utf8"))).toEqual([]);
    }
  );

  it.each(productionFiles)("%s does not import the test helpers", (name) => {
    const source = readFileSync(join(__dirname, name), "utf8");
    expect(source).not.toMatch(/from\s+["']\.\/prospectus-financial-comparison-test-helpers["']/);
  });
});
