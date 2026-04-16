# Financial Statements Step Guide

This guide describes the **v2** Financial Statements step: questionnaire, per-year issuer input, API validation, and how it relates to CTOS extracts.

---

## Overview

Issuers answer two questions and enter figures for one or two **start years** (tabs). Tab years come from the **system calendar year** (`new Date().getFullYear()`): **year1 = currentYear − 1**, **year2 = currentYear**. `last_closing_date` is **reference only** (not used to derive tab years). Only raw input values are stored. Computed metrics (`totass`, ratios, etc.) are derived with `calculateFinancialMetrics()` in `packages/types/src/financial-calculator.ts` and are not persisted.

---

## Database shape (`financial_statements` JSON)

| Key | Meaning |
|-----|---------|
| `questionnaire` | `{ last_closing_date: "YYYY-MM-DD", is_submitted_to_ssm: boolean }` |
| `unaudited_by_year` | Map of **start year** string → per-year block: numeric fields + **`pldd`** (FY end: when not submitted to SSM, **year1** = `last_closing_date`; **year2** = `""`; submitted-only tab = `""`). No **`bsdd`** on issuer rows. |

**Year tabs (issuer)** — `getIssuerFinancialTabYears` in `@cashsouk/types`: if **not** submitted to SSM → tabs **year1**, **year2** (ascending); if **submitted** → **year2** only.

**Admin Financial Summary** — Three fixed CTOS columns (latest three CTOS `financial_year` values, ascending, padded with empty slots on the right) and **two** fixed user columns (`getAdminUserInputColumnYears()`). User cells use `unaudited_by_year[String(year)]` or "—" when missing.

**CTOS `financial_year`** — Parsed as calendar year from CTOS `pldd` minus one (see `apps/api/src/modules/ctos/parser.ts`).

---

## Stored field keys (per year)

Numeric keys: `bsfatot`, `othass`, `bscatot`, …, `plyear`. See `financialStatementsInputSchema` in `apps/api/src/modules/applications/schemas.ts`.

---

## API

Save path validates `unaudited_by_year` keys against `getIssuerFinancialTabYears(questionnaire.is_submitted_to_ssm)` (server date). See `apps/api/src/modules/applications/service.ts`.
