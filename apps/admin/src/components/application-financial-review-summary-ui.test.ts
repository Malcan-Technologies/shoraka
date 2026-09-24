import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Admin Financial Summary table UI", () => {
  const tablePath = join(__dirname, "application-financial-review-content.tsx");
  const comparisonPath = join(__dirname, "application-financial-review-comparison.tsx");
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

  it("renders dependency-aware EBIT helper text", () => {
    const source = readFileSync(tablePath, "utf8");
    expect(source).toContain('case "ebit"');
    expect(source).toContain('Missing required financial inputs');
    expect(source).toContain('Missing: Profit / Loss Before Tax');
    expect(source).toContain('Missing: Interest Costs');
  });

  it("calculated metrics display Cannot calculate and show helper text for turnover growth / receivables days", () => {
    const source = readFileSync(tablePath, "utf8");
    expect(source).toContain("Cannot calculate");
    expect(source).toContain('case "turnover_growth"');
    expect(source).toContain("Missing: previous financial year Revenue / Turnover");
    expect(source).toContain("getCalculatedHelperText");
    expect(source).toContain("Missing: previous financial year Trade Receivables");
  });

  it("standardizes receivables-days helper to use 'Missing: ...' wording", () => {
    const source = readFileSync(tablePath, "utf8");
    expect(source).toContain("Missing: previous financial year Trade Receivables");
    expect(source).toContain("Missing: Trade Receivables");
  });

  it("CTOS fallback computes Current Ratio / Working Capital / ROE from raw components when CTOS finished metric is missing", () => {
    const source = readFileSync(tablePath, "utf8");

    // Current Ratio fallback: bscatot ÷ curlib
    expect(source).toContain("fields.bscatot");
    expect(source).toContain("fields.curlib");
    expect(source).toContain("computeCurrentRatio(currentAssets, currentLiabilities)");

    // Working Capital fallback: bscatot − curlib
    expect(source).toContain("computeWorkingCapital(currentAssets, currentLiabilities)");

    // ROE fallback: PAT ÷ net worth × 100
    expect(source).toContain("resolveFinancialSummaryIssuerReturnOnEquityRatio({");
    expect(source).toContain("roeRatio * 100");
  });

  it("DSCR uses only Net Operating Income (no ebitda fallback)", () => {
    const source = readFileSync(tablePath, "utf8");
    expect(source).toContain("computeDscr(netOperatingIncome, annualDebtService)");
    expect(source).not.toContain("typeof netOperatingIncome === \"number\" ? netOperatingIncome : ebitda");
  });

  it("CTOS priority for Current Ratio: use finished currat when present, otherwise fallback to bscatot ÷ curlib", () => {
    const source = readFileSync(tablePath, "utf8");

    // Priority: CTOS finished metric resolves first.
    const idxResolve = source.indexOf('resolveCtosCurrentRatio({');
    const idxIfFinished = source.indexOf("if (n != null) return formatNumber(n, 2);", idxResolve);
    expect(idxResolve).toBeGreaterThan(-1);
    expect(idxIfFinished).toBeGreaterThan(idxResolve);

    // Fallback formula when finished metric is absent.
    expect(source).toContain("fields.bscatot");
    expect(source).toContain("fields.curlib");
    expect(source).toContain("computeCurrentRatio(currentAssets, currentLiabilities)");
    expect(source).toContain('return ratio == null ? CANNOT_CALCULATE_LABEL : formatNumber(ratio, 2);');

    // Unavailable rules for fallback.
    expect(source).toContain("ratio == null ? CANNOT_CALCULATE_LABEL");
  });

  it("CTOS priority for Working Capital: use finished workcap when present, otherwise fallback to bscatot − curlib", () => {
    const source = readFileSync(tablePath, "utf8");

    const idxCheck = source.indexOf('ctosFlatNumericPresent(fs, "workcap")');
    expect(idxCheck).toBeGreaterThan(-1);
    expect(source).toContain('return formatCurrency(toNum(fs.workcap), { decimals: 0 });');

    // Fallback formula when finished metric is absent.
    expect(source).toContain("computeWorkingCapital(currentAssets, currentLiabilities)");
    expect(source).toContain(
      'wc == null ? CANNOT_CALCULATE_LABEL : formatCurrency(wc, { decimals: 0 });'
    );
    expect(source).toContain("fields.bscatot");
    expect(source).toContain("fields.curlib");

    // Unavailable rules for fallback.
    expect(source).toContain("wc == null ? CANNOT_CALCULATE_LABEL");
  });

  it("CTOS priority for ROE: use finished return_on_equity when present, otherwise fallback to plnpat ÷ networth × 100", () => {
    const source = readFileSync(tablePath, "utf8");

    const idxResolve = source.indexOf("resolveCtosReturnOnEquityPercent({");
    const idxIfFinished = source.indexOf("if (percent != null) return", idxResolve);
    expect(idxResolve).toBeGreaterThan(-1);
    expect(idxIfFinished).toBeGreaterThan(idxResolve);

    // Fallback formula when finished metric is absent.
    expect(source).toContain("resolveFinancialSummaryIssuerReturnOnEquityRatio({");
    expect(source).toContain('roeRatio == null ? CANNOT_CALCULATE_LABEL :');
    expect(source).toContain("roeRatio * 100");

    // Unavailable rules for fallback.
    expect(source).toContain("roeRatio == null ? CANNOT_CALCULATE_LABEL");
  });

  it("CTOS priority for Total Assets / Total Liabilities / Total Equity: fallback to component sums when CTOS finished fields are missing", () => {
    const source = readFileSync(tablePath, "utf8");

    // Total Assets fallback path uses agreed sum of asset components.
    expect(source).toContain("computeTotalAssets({");
    expect(source).toContain("fixed_assets: yearFields?.bsfatot?.value");
    expect(source).toContain("other_assets: yearFields?.othass?.value");
    expect(source).toContain("current_assets: yearFields?.bscatot?.value");
    expect(source).toContain("non_current_assets: yearFields?.bsclbank?.value");

    // Total Liabilities fallback path uses agreed sum of liability components.
    expect(source).toContain("computeTotalLiabilities({");
    expect(source).toContain("current_liabilities: yearFields?.curlib?.value");
    expect(source).toContain("long_term_liabilities: yearFields?.bsslltd?.value");
    expect(source).toContain("non_current_liabilities: yearFields?.bsclstd?.value");

    // Total Equity fallback is Total Assets − Total Liabilities.
    expect(source).toContain("computeNetWorth(totass, totlib)");
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

  it("shows '(if applicable)' marker only for the 3 optional equity fields (modals)", () => {
    const addSource = readFileSync(addModalPath, "utf8");
    const editSource = readFileSync(modalPath, "utf8");

    for (const src of [addSource, editSource]) {
      const count = src.match(/\(if applicable\)/g)?.length ?? 0;
      expect(count).toBe(3);

      expect(src).toContain("Share Application Account (if applicable)");
      expect(src).toContain("Share Premium & Other Reserves (if applicable)");
      expect(src).toContain("Equity Minority Interest (if applicable)");
      expect(src).not.toContain("Cash & Bank (if applicable)");
      expect(src).not.toContain("Trade Receivables (if applicable)");
    }
  });

  it("shows '(if applicable)' marker only for the 3 optional equity fields (review table)", () => {
    const contentSource = readFileSync(tablePath, "utf8");
    const count = contentSource.match(/\(if applicable\)/g)?.length ?? 0;
    expect(count).toBe(3);
    expect(contentSource).toContain("Share Application Account (if applicable)");
    expect(contentSource).toContain("Share Premium & Other Reserves (if applicable)");
    expect(contentSource).toContain("Equity Minority Interest (if applicable)");
  });

  it("shows '(if applicable)' marker only for the 3 optional equity fields (resubmit comparison)", () => {
    const comparisonSourceFull = readFileSync(comparisonPath, "utf8");
    const start = comparisonSourceFull.indexOf("// Modern comparison UI: compare historical revision snapshots");
    const end = comparisonSourceFull.indexOf("const mockFinancialPayload");

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);

    const comparisonSource = comparisonSourceFull.slice(start, end);

    // Ensure optional logic is applied only to the 3 equity fields.
    expect(comparisonSource).toContain('"equity_share_application"');
    expect(comparisonSource).toContain('"equity_share_premium"');
    expect(comparisonSource).toContain('"equity_minority"');
    expect(comparisonSource).toContain("(if applicable)");

    // Ensure we didn't leave the old "Optional" badge wording behind.
    expect(comparisonSource).not.toContain("Optional");
  });

  it("resubmit comparison renders the latest raw financial field coverage", () => {
    const comparisonSourceFull = readFileSync(comparisonPath, "utf8");
    const start = comparisonSourceFull.indexOf("// Modern comparison UI: compare historical revision snapshots");
    const end = comparisonSourceFull.indexOf("const mockFinancialPayload");

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);

    const comparisonSource = comparisonSourceFull.slice(start, end);

    const expected = [
      "cashAndBank",
      "tradeReceivables",
      "tradePayables",
      "grossProfit",
      "ebitda",
      "netOperatingIncome",
      "costOfSales",
      "operatingCashFlow",
      "freeCashFlow",
      "annualDebtService",
    ];

    for (const k of expected) {
      expect(comparisonSource).toContain(k);
    }

    // Category headers must match the current Financial Review sections.
    expect(comparisonSource).toContain("Assets");
    expect(comparisonSource).toContain("Liabilities");
    expect(comparisonSource).toContain("Equity");
    expect(comparisonSource).toContain("Profit & Loss");
    expect(comparisonSource).toContain("Costs");
    expect(comparisonSource).toContain("Cash Flow / Debt");
  });

  it("renders Source as — for missing CTOS values and for admin add-year placeholders", () => {
    const contentSource = readFileSync(tablePath, "utf8");

    // CTOS badge is conditional on CTOS being pulled and the specific year existing in CTOS data.
    expect(contentSource).toContain('ctosFetchState === "not_pulled"');
    expect(contentSource).toContain("ctosFetchState === \"no_records\"");
    expect(contentSource).toContain("ctosColumnMissing(i)");

    // Add-year placeholder FYs should not be labeled as Admin Input source.
    expect(contentSource).toContain(
      'spec.kind === "admin_fallback_placeholder" && spec.year != null ? ('
    );
    expect(contentSource).toContain('<span className="text-muted-foreground">—</span>');
  });
});

