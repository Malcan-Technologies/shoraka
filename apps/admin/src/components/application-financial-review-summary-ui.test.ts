import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Admin Financial Summary table UI", () => {
  const tablePath = join(__dirname, "application-financial-review-content.tsx");
  const addModalPath = join(
    __dirname,
    "../notes/prospectus-review/admin-add-financial-statement-dialog.tsx"
  );
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
    const expectedTitles = [
      "Assets",
      "Liabilities",
      "Equity",
      "Profit & Loss",
      "Costs",
      "Cash Flow / Debt",
      "Financial Ratios & Metrics",
    ];

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

  it("places EBIT under Profit & Loss (not under Financial Ratios & Metrics)", () => {
    const source = readFileSync(tablePath, "utf8");
    const profitStart = source.indexOf('id: "profitLoss"');
    expect(profitStart).toBeGreaterThan(-1);
    const profitRowIdsStart = source.indexOf("rowIds:", profitStart);
    expect(profitRowIdsStart).toBeGreaterThan(-1);
    const profitSlice = source.slice(profitRowIdsStart, profitRowIdsStart + 800);
    expect(profitSlice).toContain('"ebit"');

    const ratiosStart = source.indexOf('id: "calculatedMetrics"');
    expect(ratiosStart).toBeGreaterThan(-1);
    const ratiosRowIdsStart = source.indexOf("rowIds:", ratiosStart);
    expect(ratiosRowIdsStart).toBeGreaterThan(-1);
    const ratiosSlice = source.slice(ratiosRowIdsStart, ratiosRowIdsStart + 900);
    expect(ratiosSlice).not.toContain('"ebit"');
  });

  it("calculated metrics display Not available and show helper text for turnover growth / receivables days", () => {
    const source = readFileSync(tablePath, "utf8");
    expect(source).toContain('return "Not available"');
    expect(source).toContain('case "turnover_growth"');
    expect(source).toContain("Previous financial year Revenue unavailable");
    expect(source).toContain("getCalculatedHelperText");
    expect(source).toContain("receivablesDaysUnavailableReason");
  });

  it("standardizes receivables-days helper to use 'Previous financial year' wording", () => {
    const source = readFileSync(tablePath, "utf8");
    expect(source).toContain('replace(/^previous year /i, "Previous financial year ");');
  });

  it("CTOS fallback computes Current Ratio / Working Capital / ROE from raw components when CTOS finished metric is missing", () => {
    const source = readFileSync(tablePath, "utf8");

    // Current Ratio fallback: bscatot ÷ curlib
    expect(source).toContain("fields.bscatot");
    expect(source).toContain("fields.curlib");
    expect(source).toContain("currentAssets / currentLiabilities");

    // Working Capital fallback: bscatot − curlib
    expect(source).toContain("currentAssets - currentLiabilities");

    // ROE fallback: PAT ÷ net worth × 100
    expect(source).toContain("(pat / netWorthVal) * 100");
    expect(source).toContain(")}%");
  });

  it("DSCR uses only Net Operating Income (no ebitda fallback)", () => {
    const source = readFileSync(tablePath, "utf8");
    expect(source).toContain("computeDscr(netOperatingIncome, annualDebtService)");
    expect(source).not.toContain("typeof netOperatingIncome === \"number\" ? netOperatingIncome : ebitda");
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

  it("Add Financial Statement modal renders category sections in order", () => {
    const source = readFileSync(addModalPath, "utf8");
    const expectedTitles = [
      "Assets",
      "Liabilities",
      "Equity",
      "Profit & Loss",
      "Costs",
      "Cash Flow / Debt",
    ];

    let lastIndex = -1;
    for (const title of expectedTitles) {
      const idx = source.indexOf(`title: "${title}"`);
      expect(idx).toBeGreaterThan(lastIndex);
      lastIndex = idx;
    }
  });

  it("Edit Financial Statement modal renders category sections in order", () => {
    const source = readFileSync(modalPath, "utf8");
    const expectedTitles = [
      "Assets",
      "Liabilities",
      "Equity",
      "Profit & Loss",
      "Costs",
      "Cash Flow / Debt",
    ];

    let lastIndex = -1;
    for (const title of expectedTitles) {
      const idx = source.indexOf(`title: "${title}"`);
      expect(idx).toBeGreaterThan(lastIndex);
      lastIndex = idx;
    }
  });

  it("Edit modal CTOS fields render disabled inputs with 'From CTOS' helper", () => {
    const source = readFileSync(modalPath, "utf8");
    expect(source).toContain(`meta.source === "ctos" && meta.readOnly`);
    expect(source).toContain(`"From CTOS"`);
    expect(source).toContain("disabled={inputDisabled}");
    expect(source).toContain("if (meta.readOnly) return;");
  });

  it("Edit modal CTOS-missing fields render editable inputs with 'Not provided by CTOS' helper", () => {
    const source = readFileSync(modalPath, "utf8");
    expect(source).toContain(`meta.source === "ctos" && !meta.readOnly`);
    expect(source).toContain(`"Not provided by CTOS"`);
  });

  it("Edit modal shows admin provenance helpers per field", () => {
    const source = readFileSync(modalPath, "utf8");
    expect(source).toContain(`meta.editedByAdmin && meta.source === "admin_input"`);
    expect(source).toContain(`"Admin Input"`);
    expect(source).toContain(`meta.source === "user_input" && meta.editedByAdmin`);
    expect(source).toContain(`"Edited by Admin"`);
  });

  it("Add Financial Statement modal only allows Audited / Not audited statement type", () => {
    const source = readFileSync(addModalPath, "utf8");
    expect(source).toContain(`SelectItem value="AUDITED">Audited`);
    expect(source).toContain(`SelectItem value="NOT_AUDITED">Not audited`);
  });

  it("Labels are standardized consistently in both modals", () => {
    const addSource = readFileSync(addModalPath, "utf8");
    const editSource = readFileSync(modalPath, "utf8");

    const labels = [
      "Fixed Assets",
      "Trade Receivables",
      "Current Liabilities",
      "Paid-up Share Capital",
      "Revenue / Turnover",
      "Gross Profit",
      "Cost of Sales",
      "Operating Cash Flow",
    ];

    for (const l of labels) {
      expect(addSource).toContain(l);
      expect(editSource).toContain(l);
    }
  });

  it("Add modal categories are collapsible by category with correct default expanded/collapsed state", () => {
    const source = readFileSync(addModalPath, "utf8");
    expect(source).toContain("ChevronDownIcon");
    expect(source).toContain("ChevronRightIcon");
    expect(source).toContain("aria-expanded={isOpen}");
    expect(source).toContain("[cat.title]: !isOpen");

    // Default collapse state per requirements.
    expect(source).toContain("Assets: true");
    expect(source).toContain("Liabilities: true");
    expect(source).toContain('"Profit & Loss": true');
    expect(source).toContain("Equity: false");
    expect(source).toContain("Costs: false");
    expect(source).toContain('"Cash Flow / Debt": false');

    // Calculated fields must remain excluded from editable raw inputs.
    expect(source).not.toContain("turnover_growth");
    expect(source).not.toContain("receivablesDays");
    expect(source).not.toContain("profit_margin");
  });

  it("Edit modal categories are collapsible by category with correct default expanded/collapsed state", () => {
    const source = readFileSync(modalPath, "utf8");
    expect(source).toContain("ChevronDownIcon");
    expect(source).toContain("ChevronRightIcon");
    expect(source).toContain("aria-expanded={isOpen}");
    expect(source).toContain("[g.title]: !isOpen");

    // Default collapse state per requirements.
    expect(source).toContain("Assets: true");
    expect(source).toContain("Liabilities: true");
    expect(source).toContain('"Profit & Loss": true');
    expect(source).toContain("Equity: false");
    expect(source).toContain("Costs: false");
    expect(source).toContain('"Cash Flow / Debt": false');

    // Calculated fields must remain excluded from editable raw inputs.
    expect(source).not.toContain("turnover_growth");
    expect(source).not.toContain("receivablesDays");
    expect(source).not.toContain("profit_margin");
  });
});

