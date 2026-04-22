# Financial Statements Step Guide

This guide describes the **v2** Financial Statements step: questionnaire, per-year issuer input, API validation, and how it relates to CTOS extracts.

---

## Overview

Issuers select **one** date: the **next financial year end** (`financial_year_end`, ISO `YYYY-MM-DD`, **strictly after today**). Tab count (1 or 2) and tab labels (**FY end calendar years**) come from shared helpers in `packages/types/src/financial-unaudited-ctos-validation.ts`: **deadline** = previous FY end **+ 6 calendar months** (audited filing window); if **today &lt; deadline** → two tabs (previous + current FY end years); if **today ≥ deadline** → one tab (selected FY end year only). Only raw input values are stored. Computed metrics (`totass`, ratios, etc.) are derived with `calculateFinancialMetrics()` in `packages/types/src/financial-calculator.ts` and are not persisted.

---

## Database shape (`financial_statements` JSON)

| Key | Meaning |
|-----|---------|
| `questionnaire` | `{ financial_year_end: "YYYY-MM-DD" }` (next date the company’s books close; must be in the future when saved). |
| `unaudited_by_year` | Map of **FY end calendar year** string (e.g. `"2026"`, `"2027"`) → per-year block: numeric fields + **`pldd`** (ISO FY end for that column). No **`bsdd`** on issuer rows. |

**Year tabs (issuer)** — `getIssuerFinancialTabYears(questionnaire, ref)` in `@cashsouk/types`.

**Admin Financial Summary** — Three fixed CTOS columns (latest three CTOS `financial_year` values, ascending, padded with empty slots on the **left** so the newest CTOS year sits next to user columns). **User Input** columns use the **same** year list as the issuer: `getAdminFinancialSummaryUserColumnYears(questionnaire, ref)` (0–2 columns). User cells use `unaudited_by_year[String(year)]` or missing copy when a field is empty.

**CTOS `financial_year`** — Parsed as the calendar year from CTOS `pldd` (see `apps/api/src/modules/ctos/parser.ts`).

---

## Stored field keys (per year)

Numeric keys: `bsfatot`, `othass`, `bscatot`, …, `plyear`. See `financialStatementsInputSchema` in `apps/api/src/modules/applications/schemas.ts`.

---

## API

Save path validates `unaudited_by_year` keys against `getIssuerFinancialTabYears(questionnaire, new Date())` and normalizes **`pldd`** per FY column. See `apps/api/src/modules/applications/service.ts`.
