jest.mock("@cashsouk/config", () => ({
  formatCurrency: (amount: number) =>
    `RM ${amount.toLocaleString("en-MY", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
}));

import fs from "node:fs";
import path from "node:path";
import type { ProspectusFrozenFinancialYear } from "@cashsouk/types";
import {
  buildPageThreeBalanceSheetTable,
  buildPageThreeCoverageTable,
  buildPageThreeIncomeStatementTable,
} from "./page-three-coverage";

function emptyRaw(): ProspectusFrozenFinancialYear["raw"] {
  return {
    turnover: null,
    plnpbt: null,
    plnpat: null,
    bscatot: null,
    bsfatot: null,
    othass: null,
    bsclbank: null,
    curlib: null,
    bsslltd: null,
    bsclstd: null,
    bsqpuc: null,
    totass: null,
    totlib: null,
    networth: null,
    profit_margin: null,
    return_on_equity: null,
    currat: null,
  };
}

function frozenYear(
  calendarYear: number,
  raw: ProspectusFrozenFinancialYear["raw"],
  isPlaceholder = false
): ProspectusFrozenFinancialYear {
  return {
    financialYearEndIso: isPlaceholder
      ? `placeholder:${calendarYear}`
      : `${calendarYear}-12-31`,
    calendarYear,
    label: `FY${calendarYear}`,
    fyeLabel: isPlaceholder ? "—" : `31 Dec ${calendarYear}`,
    sourceType: "UNAUDITED",
    raw,
    isPlaceholder,
  };
}

describe("Prospectus financial tables share display years and missing-year warning", () => {
  const pageSource = fs.readFileSync(
    path.join(__dirname, "../../app/notes/[id]/prospectus/page.tsx"),
    "utf8"
  );
  const pageTwo = fs.readFileSync(path.join(__dirname, "working-area-page-two.tsx"), "utf8");
  const pageThree = fs.readFileSync(path.join(__dirname, "working-area-page-three.tsx"), "utf8");
  const warning = fs.readFileSync(
    path.join(__dirname, "missing-financial-year-warning.tsx"),
    "utf8"
  );

  it("Admin wires display year keys (incl. placeholders) to Page 3 tables", () => {
    expect(pageSource).toContain("displayFinancialYearKeys");
    expect(pageSource).toContain("years={displayFinancialYearKeys}");
    expect(pageSource).toContain(
      "financialComparisonOpsWarning={financialComparisonOpsWarning}"
    );
    // Completion / approval still use real years only.
    expect(pageSource).toContain("incomeStatementYears: incomeStatementYearKeys");
    expect(pageSource).toContain("!year.isPlaceholder");
  });

  it("Page 2 and Page 3 reuse the same non-blocking missing-year warning component", () => {
    expect(warning).toContain('role="status"');
    expect(warning).toContain("financial-comparison-ops-warning");
    expect(pageSource).toContain('title: "Missing expected financial year"');
    expect(pageTwo).toContain("ProspectusMissingFinancialYearWarning");
    expect(pageThree).toContain("ProspectusMissingFinancialYearWarning");
    expect(pageThree).toContain("showFinancialOpsWarning");
  });

  it("FY2025 + FY2027 gap shows FY2026 as — on Income, Balance, and Coverage", () => {
    const years = [
      frozenYear(2025, { ...emptyRaw(), turnover: 4_000_000 }),
      frozenYear(2026, emptyRaw(), true),
      frozenYear(2027, { ...emptyRaw(), turnover: 6_000_000 }),
    ];
    const income = buildPageThreeIncomeStatementTable(years, undefined);
    const balance = buildPageThreeBalanceSheetTable(years, undefined);
    const coverage = buildPageThreeCoverageTable(years, undefined);

    for (const table of [income, balance, coverage]) {
      expect(table.yearHeaders.map((h) => h.yearLabel)).toEqual([
        "FY2025",
        "FY2026",
        "FY2027",
      ]);
      expect(table.yearHeaders.map((h) => !!h.isPlaceholder)).toEqual([
        false,
        true,
        false,
      ]);
      for (const row of table.rows) {
        expect(row.values[1]).toBe("—");
      }
    }
  });
});
