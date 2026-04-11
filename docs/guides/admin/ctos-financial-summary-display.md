# Admin financial summary: CTOS columns

## Rule

For **CTOS** columns in the application financial review table, each cell **prefers the value from the CTOS `account` JSON** (and dates from `dates`) when that field is present. **If the field is empty**, some rows use a **fallback** derived from other CTOS numbers for the same year.

**Unaudited** columns use issuer form data only; this rule does not blend issuer and CTOS in one cell.

## Rows with no fallback

Dates (`pldd`, `bsdd`) and line items (`bsfatot` through `plyear`) have **no formula**: if CTOS did not supply a value, the cell shows empty / the usual missing copy.

## Fallback formulas (CTOS column only)

Implementations live in `packages/types/src/ctos-report-table-math.ts` and are wired through `columnMetrics` in `apps/admin/src/components/application-financial-review-content.tsx`.

| Display row | When CTOS field is missing |
|-------------|----------------------------|
| **Total assets** (`totass`) | Use `totass` if reported; else sum fixed + other + current + non-current assets: `bsfatot + othass + bscatot + bsclbank` (`computeTotalAssets`). |
| **Total liabilities** (`totlib`) | Use `totlib` if reported; else sum `curlib + bsslltd + bsclstd` (`computeTotalLiabilities`). |
| **Net worth** (`networth`) | `totass - totlib` after applying the two rules above (`computeNetWorth`). |
| **Turnover growth** | `(turnover_this_column - turnover_previous_column) / turnover_previous_column` only if the previous column’s year is exactly one calendar year before this column’s year (`computeTurnoverGrowth`). |
| **Profit margin** | `plnpat / turnover` when turnover ≠ 0 (`computeProfitMargin`). UI shows ratio × 100 as a percent. |
| **Return on equity** | `plnpat / bsqpuc` when equity ≠ 0 (`computeReturnOnEquity`). UI shows ratio × 100 as a percent. |
| **Current ratio** | `bscatot / curlib` when current liabilities ≠ 0 (`computeCurrentRatio`). |
| **Working capital** | `bscatot - curlib` (`computeWorkingCapital`). |

## CTOS-supplied ratio fields

When CTOS provides `profit_margin`, `return_on_equity`, `turnover_growth`, `currat`, or `workcap` on `account`, the UI shows those **before** recomputing.

- **`profit_margin`**, **`return_on_equity`**, **`turnover_growth`** in CTOS XML are **already percent-style numbers** (e.g. `12.6` means 12.6%). The admin appends `%` without multiplying by 100.
- **Computed** fallbacks (from `computeProfitMargin`, etc.) use **decimal ratios** internally; those rows still use **× 100** before showing `%`.
- **`currat`** is a plain ratio (e.g. `1.32`), not a percent.
- **`workcap`** is a currency amount.
