# Financial Statements Step Guide

This guide explains the Financial Statements application step: what data is stored, how the API validates and saves it, and how the frontend displays it.

---

## Overview

The Financial Statements step lets issuers enter company financial data. Only raw input values are stored in the database. Computed metrics such as totals and ratios are calculated on demand by a shared utility and are never persisted. The issuer UI shows only input fields. Computed metrics appear in admin or analytics contexts when needed.

---

## Database Structure

The `applications` table has a `financial_statements` column of type JSON. Schema file: `apps/api/prisma/schema.prisma`.

The stored JSON is a flat object. There is no nesting. Each key maps directly to a single value. The backend never stores computed fields like `totass`, `totlib`, or `profit_margin`; those are derived at read time.

---

## Stored vs Calculated Fields

**Stored fields** — These are the only keys written to `financial_statements`:

- **pldd** — Financing year end (date string, e.g. `"2024-12-31"`).
- **bsdd** — Balance sheet financial year (date string).
- **bsfatot** — Fixed assets (number).
- **othass** — Other assets (number).
- **bscatot** — Current assets (number).
- **bsclbank** — Non-current assets (number).
- **curlib** — Current liability (number).
- **bsslltd** — Long-term liability (number).
- **bsclstd** — Non-current liability (number).
- **bsqpuc** — Paid-up capital (number).
- **turnover** — Turnover (number).
- **plnpbt** — Profit before tax (number).
- **plnpat** — Profit after tax (number).
- **plminin** — Minority interest (number).
- **plnetdiv** — Net dividend (number).
- **plyear** — Profit and loss year (number).

**Calculated fields** — These are never stored. They are produced by `calculateFinancialMetrics()` in `packages/types/src/financial-calculator.ts`:

- **totass** — Sum of bsfatot, othass, bscatot, bsclbank.
- **totlib** — Sum of curlib, bsslltd, bsclstd.
- **profit_margin** — plnpat / turnover when turnover ≠ 0, else null.
- **return_of_equity** — plnpat / bsqpuc when bsqpuc ≠ 0, else null.
- **currat** — bscatot / curlib when curlib ≠ 0, else null.
- **workcap** — bscatot - curlib.
- **turnover_growth** — Currently always null (previous-year logic not implemented).

---

## API Behavior

**Route:** `PATCH /v1/applications/:id/step` with `stepId` for the financial statements step and `data` containing the payload.

**File:** `apps/api/src/modules/applications/controller.ts` (route), `apps/api/src/modules/applications/service.ts` (`updateStep`), `apps/api/src/modules/applications/schemas.ts` (`financialStatementsInputSchema`).

When the step being updated is financial statements, the service validates the payload with `financialStatementsInputSchema`. Dates (`pldd`, `bsdd`) are stored as strings. Numbers are normalized with a `toNum` helper that accepts strings or numbers and strips commas. The result is written directly to `application.financial_statements` as a flat object. No computed fields are calculated or stored by the backend.

---

## Frontend Behavior

**File:** `apps/issuer/src/app/(application-flow)/applications/steps/financial-statements-step.tsx`.

The step loads saved data from `application.financial_statements`. A `fromSaved` helper supports both the legacy nested format (`{ input: { ... } }`) and the current flat format. Legacy keys are mapped to the canonical keys via `LEGACY_KEY_MAP`. On save, `toApiPayload` returns a flat object with only the canonical keys.

The UI is organized into sections: Financial Year (pldd, bsdd), Assets, Liabilities, Equity, Profit and Loss, and Calculated Metrics. Labels come from `FINANCIAL_FIELD_LABELS` in `packages/types/src/financial-field-labels.ts`.

**Negative value handling:** `plnpat`, `bsqpuc`, and `plyear` support negative numbers via `MoneyInput` with `allowNegative={true}`. For `plyear`, a positive value indicates profit; a negative value indicates loss.

**MoneyInput limits:** Regex `^-?\d{0,12}(\.\d{0,2})?$`. Maximum 12 digits before decimal; maximum 2 decimal places; negative numbers supported when `allowNegative={true}`.

**Financial Calculation Behaviour:** The metrics `profitMargin`, `returnOnEquity`, `currentRatio`, `workingCapital`, and `gearing` are computed only in the UI and **never** stored in the database. `toApiPayload` must exclude calculated metrics. They are displayed as read-only in the Calculated Metrics section.

**Validation rules:** `turnover >= 0`; `plnpat`, `bsqpuc`, and `plyear` may be negative.

**Financial helper functions:** See `packages/types/src/financial-calculator.ts` for `calculateProfitMargin`, `calculateReturnOnEquity`, `calculateCurrentRatio`, `calculateWorkingCapital`, `calculateGearing`, and `calculateFinancialMetrics`.

---

## Backward Compatibility

When loading, if the saved object has an `input` key, it is treated as the old nested format. Otherwise it is treated as flat. Missing keys default according to `DEFAULT_PAYLOAD`. Legacy keys such as `financing_year_end`, `balance_sheet_financial_year`, `fixed_assets`, etc. are mapped to the canonical keys (pldd, bsdd, bsfatot, etc.) so older data still displays correctly.

---

## Key File Reference

| Purpose | File |
|---------|------|
| Prisma schema | `apps/api/prisma/schema.prisma` |
| Backend validation | `apps/api/src/modules/applications/schemas.ts` |
| Backend service | `apps/api/src/modules/applications/service.ts` |
| Shared calculator | `packages/types/src/financial-calculator.ts` |
| Field labels | `packages/types/src/financial-field-labels.ts` |
| Frontend step | `apps/issuer/src/app/(application-flow)/applications/steps/financial-statements-step.tsx` |
| Loading skeleton | `apps/issuer/src/app/(application-flow)/applications/components/financial-statements-skeleton.tsx` |
