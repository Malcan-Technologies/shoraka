# Financial Statements Step Guide

This guide describes the **v2** Financial Statements step: questionnaire, per-year issuer input, API validation, and how it relates to CTOS extracts.

---

## Overview

Issuers answer two questions and enter figures for one or two **calendar years** (tabs). Only raw input values are stored. Computed metrics (`totass`, ratios, etc.) are derived with `calculateFinancialMetrics()` in `packages/types/src/financial-calculator.ts` and are not persisted.

---

## Database shape (`financial_statements` JSON)

The column stores a single object (no legacy flat root, no `input` wrapper):

| Key | Meaning |
|-----|---------|
| `questionnaire` | `{ last_closing_date: "YYYY-MM-DD", is_submitted_to_ssm: boolean }` (issuer `DateInput` shows `d/M/yyyy` until save; same rules as contract dates — `application-flow-dates.ts`) |
| `unaudited_by_year` | Map of year string → per-year block of numeric fields + `pldd` |

**Year tabs** — Derived in `@cashsouk/types` via `getIssuerFinancialInputYearsFromQuestionnaire`: calendar year from `last_closing_date`; if not submitted to SSM, tabs are **current year** then **prior year**; if submitted, **current year only**.

**Per-year `pldd`** — Always the same ISO date as `questionnaire.last_closing_date` (the figures’ year is the object key only). There is **no** `bsdd` on issuer rows.

---

## Stored field keys (per year)

Same numeric keys as before (`bsfatot`, `othass`, `bscatot`, …, `plyear`) plus **`pldd`** (ISO date string). See `financialStatementsYearBlockSchema` in `apps/api/src/modules/applications/schemas.ts`.

---

## API

**Route:** `PATCH /v1/applications/:id/step` with financial step `data`.

**Files:** `schemas.ts` (`financialStatementsV2Schema`), `service.ts` (normalize each block: strip unknown keys, set `pldd` from questionnaire, reject mismatch).

---

## Frontend

**File:** `apps/issuer/src/app/(application-flow)/applications/steps/financial-statements-step.tsx`

Questionnaire UI uses the shared `DateInput` pattern (placeholders match other steps). Save sends v2 payload only.

**Review step:** `review-and-submit-step.tsx` — financial section assumes v2 shape.

---

## CTOS alignment

CTOS `financials_json` rows use **`financial_year`** (stored display year): calendar year parsed from CTOS **`pldd`**, minus one. Admin Financial Summary columns use that value as-is. Old snapshots that only have `reporting_year` are not read by current code — see [CTOS financial JSON migration](../migrations/ctos-financial-year-json.md).

---

## Key files

| Purpose | Path |
|---------|------|
| Prisma | `apps/api/prisma/schema.prisma` |
| Zod | `apps/api/src/modules/applications/schemas.ts` |
| Service | `apps/api/src/modules/applications/service.ts` |
| Questionnaire + year helper | `packages/types/src/financial-unaudited-ctos-validation.ts` |
| Labels | `packages/types/src/financial-field-labels.ts` |
| Calculator | `packages/types/src/financial-calculator.ts` |
| Issuer step | `apps/issuer/.../financial-statements-step.tsx` |
