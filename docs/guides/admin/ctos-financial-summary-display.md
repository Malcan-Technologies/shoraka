# Admin financial summary: CTOS columns

## Rule

For **CTOS** columns in the application financial review table, each cell uses:

1. a **direct CTOS `account` field**, or
2. an **exact CTOS ENQWS v5.11.0 Financial Highlights XSL formula**, or
3. **N/A** / empty when neither exists.

There are **no CashSouk-invented CTOS fallbacks** (no component totals, no PAT÷equity when `return_on_equity` is missing, no CA÷CL when `currat` is missing).

**Unaudited** columns use issuer form data only. Issuer-derived ratios (PAT÷net worth, component sums) are Application input math — not CTOS fallbacks. This rule does not blend issuer and CTOS in one cell.

## Direct CTOS fields (no formula)

Dates (`pldd`, `bsdd`) and line items (`bsfatot` through `plyear`), plus:

| Display row | CTOS field |
|-------------|------------|
| **Total assets** | `totass` only |
| **Total liabilities** | `totlib` only |
| **Net worth** | `networth` only |
| **Turnover growth** | `turnover_growth` only |
| **Return on equity** | `return_on_equity` only |
| **Current ratio** | `currat` only |
| **Working capital** | `workcap` only |

If the field is empty, the cell shows **N/A** (or the usual missing copy). Do not reconstruct from other CTOS lines.

## Official XSL calculation used in Financial Summary

| Display row | Formula | Notes |
|-------------|---------|--------|
| **Profit margin** | `plnpat / turnover * 100` (`resolveCtosPatMarginPercent`) | Official CTOS **PAT Margin**. **Never** use CTOS `profit_margin` (that field is **PBT Margin**). |

Implementations for CTOS columns live in `packages/types/src/ctos-financial-highlights.ts`, wired in `apps/admin/src/components/application-financial-review-content.tsx`.

Issuer column helpers (component sums, issuer ROE) live in `packages/types/src/ctos-report-table-math.ts` and apply **only** to unaudited columns.

## CTOS-supplied ratio field semantics

- **`return_on_equity`**, **`turnover_growth`** in CTOS XML are **already percent-style numbers** (e.g. `12.6` means 12.6%). The admin appends `%` without multiplying by 100.
- **`currat`** is a plain ratio (e.g. `1.32`), not a percent.
- **`workcap`** is a currency amount.
- **`profit_margin`** on the CTOS account JSON is **PBT Margin** and is **ignored** by the Financial Summary Profit Margin row.

## CTOS director / shareholder position (role cross-check)

Organization `company_json.directors[].position` uses ENQWS-style codes: **DO** Director Only, **SO** Shareholder Only, **DS** Director & Shareholder, **AD** Alternate Director, **AS** Alternate Director & Shareholder. The admin **Role check** (expand row on the CTOS comparison table) compares issuer role to this field using those codes and common phrases (e.g. “Director” / “Shareholder”); the grid layout is unchanged.

**Issuer side for that compare** (only the CTOS comparison table, not the main directors grid): when `director_kyc_status.directors` is non-empty, rows follow the same combined list rules as the issuer application (`useCorporateEntities` + company-details: directors first with “Director, Shareholder” when KYC shows a %, then shareholder-only names, then corporate shareholders from `corporate_entities`). Otherwise rows come from `corporate_entities` / KYC-only extract. In both cases, rows with the same normalized IC/SSM and `subjectKind` are merged into one line for compare (Director + Shareholder → `Director, Shareholder` → **DS**).
