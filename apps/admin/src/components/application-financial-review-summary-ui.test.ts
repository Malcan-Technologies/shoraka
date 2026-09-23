import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Admin Financial Summary table UI", () => {
  const tablePath = join(__dirname, "application-financial-review-content.tsx");
  const modalPath = join(__dirname, "../notes/prospectus-review/admin-edit-financial-statement-dialog.tsx");

  it("uses a single financial summary Table in the review section", () => {
    const source = readFileSync(tablePath, "utf8");
    const reviewBlockIdx = source.indexOf('title="Financial Summary"');
    expect(reviewBlockIdx).toBeGreaterThan(-1);

    const tableCountAfterReview = source
      .slice(reviewBlockIdx)
      .match(/<Table[\s>]/g)?.length;
    expect(tableCountAfterReview).toBe(1);
  });

  it("renders category sections in the requested order", () => {
    const source = readFileSync(tablePath, "utf8");
    const expectedTitles = ["Assets", "Liabilities", "Equity", "Profit & Loss", "Costs", "Cash Flow / Debt", "Calculated Metrics"];

    let lastIndex = -1;
    for (const title of expectedTitles) {
      const idx = source.indexOf(`title: "${title}"`);
      expect(idx).toBeGreaterThan(lastIndex);
      lastIndex = idx;
    }
  });

  it("defaults collapsed categories for Equity, Costs, and Cash Flow / Debt", () => {
    const source = readFileSync(tablePath, "utf8");
    expect(source).toContain("equity: false");
    expect(source).toContain("costs: false");
    expect(source).toContain("cashFlowDebt: false");
    // Others should start expanded.
    expect(source).toContain("assets: true");
    expect(source).toContain("liabilities: true");
    expect(source).toContain("profitLoss: true");
    expect(source).toContain("calculatedMetrics: true");
  });

  it("hides all cells in missing FY placeholder columns (em dash only)", () => {
    const source = readFileSync(tablePath, "utf8");
    expect(source).toContain('if (specCol.kind === "admin_fallback_placeholder") return "—";');
  });

  it("category rows toggle collapse/expand via local openCategories state", () => {
    const source = readFileSync(tablePath, "utf8");
    expect(source).toContain("aria-expanded={openCategories[item.categoryId]}");
    expect(source).toContain("setOpenCategories((prev) =>");
    expect(source).toContain("ChevronDownIcon");
    expect(source).toContain("ChevronRightIcon");
    expect(source).toContain("flattenedRows.map");
  });

  it("calculated metrics display Not available and show helper text for turnover growth / receivables days", () => {
    const source = readFileSync(tablePath, "utf8");
    expect(source).toContain('return "Not available"');
    expect(source).toContain('case "turnover_growth"');
    expect(source).toContain("Previous FY revenue unavailable");
    expect(source).toContain("getCalculatedHelperText");
    expect(source).toContain("receivablesDaysUnavailableReason");
  });

  it("suppresses source badges and cell-level edit for calculated rows", () => {
    const source = readFileSync(tablePath, "utf8");
    expect(source).toContain('const uiCalculated = isCalculatedFinancialMetricKey(item.rowId) || item.rowId === "debtEquityPercent"');
    expect(source).toContain("sourceBadge =");
    expect(source).toContain("!uiCalculated");
  });

  it("whole-year edit modal uses the same two-column grid layout as + Add modal", () => {
    const source = readFileSync(modalPath, "utf8");
    expect(source).toContain("max-h-[55vh] overflow-y-auto rounded-xl border p-3");
    expect(source).toContain("grid gap-3 sm:grid-cols-2");
    // Calculated metrics remain excluded because the modal only renders editable raw keys.
    expect(source).not.toContain("turnover_growth");
    expect(source).not.toContain("receivablesDays");
    expect(source).not.toContain("profit_margin");
  });
});

