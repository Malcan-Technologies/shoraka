# CTOS `financials_json`: `reporting_year` → `financial_year`

## Context

Parsed CTOS company financial rows previously exposed **`reporting_year`**. The app now expects **`financial_year`**, defined at parse time as the **calendar year from `pldd`** (same rule in `apps/api/src/modules/ctos/parser.ts` and `apps/api/src/ctos-test/ctos.new.ts`).

There is **no** runtime dual-read of `reporting_year` in application code.

## Options for existing rows

1. **Re-fetch CTOS** for the organization (recommended): new parses write `financial_year`.
2. **One-off data fix** on stored JSON (e.g. SQL or script): for each object in `financials_json`, if `financial_year` is missing and `reporting_year` is present, set `financial_year` to the same integer **only if** that already matches your business rule for that row; otherwise recompute from `dates.pldd` using the parser rule and drop `reporting_year`.

Validate a sample row in admin **Financial Summary** (column headers should match issuer years vs CTOS without extra offsets).
