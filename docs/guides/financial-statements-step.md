# Financial Statements Step — Developer Guide

This guide explains the Financial Statements application step: architecture, data structure, field mappings, and how backend and frontend work together.

---

## Overview

The Financial Statements step lets issuers enter company financial data. Only raw input values are stored. Computed metrics (totals, ratios) are calculated on-demand via a shared utility and never persisted. The issuer UI shows only input fields; computed metrics appear in admin or analytics contexts.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ Issuer App                                                       │
│  FinancialStatementsStep                                         │
│  - Renders input fields only (no computed)                       │
│  - Uses FINANCIAL_FIELD_LABELS for labels                        │
│  - Sends flat payload on Save                                    │
└────────────────────────────┬────────────────────────────────────┘
                              │ PATCH /applications/:id/step
                              │ { pldd, bsdd, bsfatot, ... }
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ API                                                              │
│  - Validates with financialStatementsInputSchema                │
│  - Normalizes numbers and dates                                  │
│  - Stores flat JSON directly (no input/computed nesting)         │
└────────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Database                                                         │
│  Application.financial_statements = { pldd, bsdd, bsfatot, ... } │
│  Flat JSON; only input keys; no computed fields                  │
└─────────────────────────────────────────────────────────────────┘

When admin/analytics need ratios:
  calculateFinancialMetrics(storedData) → totass, totlib, profit_margin, etc.
```

---

## Canonical Field Keys

These keys are the source of truth across frontend, backend, and database.

### Input Fields (Stored)

| Key      | Label                         | Type   |
|----------|-------------------------------|--------|
| pldd     | Financing Year End            | date   |
| bsdd     | Balance Sheet Financial Year  | date   |
| bsfatot  | Fixed Assets                  | number |
| othass   | Other Assets                  | number |
| bscatot  | Current Assets                | number |
| bsclbank | Non Current Assets            | number |
| curlib   | Current Liability             | number |
| bsslltd  | Long Term Liability           | number |
| bsclstd  | Non Current Liability         | number |
| bsqpuc   | Paid Up Capital               | number |
| turnover | Turnover                      | number |
| plnpbt   | Profit Before Tax             | number |
| plnpat   | Profit After Tax              | number |
| plminin  | Minority Interest             | number |
| plnetdiv | Net Dividend                  | number |
| plyear   | Profit and Loss of the Year   | number |

### Computed Fields (Never Stored)

Calculated on-demand via `calculateFinancialMetrics()`:

| Key            | Formula                                      |
|----------------|----------------------------------------------|
| totass         | bsfatot + othass + bscatot + bsclbank        |
| totlib         | curlib + bsslltd + bsclstd                   |
| profit_margin  | turnover ≠ 0 ? plnpat / turnover : null      |
| return_of_equity | bsqpuc ≠ 0 ? plnpat / bsqpuc : null       |
| currat         | curlib ≠ 0 ? bscatot / curlib : null         |
| workcap        | bscatot - curlib                             |
| turnover_growth | null (previous year not implemented)        |

---

## Stored JSON Shape

Flat object; no nesting.

```json
{
  "pldd": "2024-12-31",
  "bsdd": "2024-12-31",
  "bsfatot": 1000000,
  "othass": 200000,
  "bscatot": 500000,
  "bsclbank": 300000,
  "curlib": 200000,
  "bsslltd": 400000,
  "bsclstd": 150000,
  "bsqpuc": 1000000,
  "turnover": 1800000,
  "plnpbt": 350000,
  "plnpat": 280000,
  "plminin": 20000,
  "plnetdiv": 50000,
  "plyear": 260000
}
```

---

## Key Files

| Purpose              | File |
|----------------------|------|
| Shared calculator    | `packages/types/src/financial-calculator.ts` |
| Field labels         | `packages/types/src/financial-field-labels.ts` |
| Backend schema       | `apps/api/src/modules/applications/schemas.ts` |
| Backend service      | `apps/api/src/modules/applications/service.ts` |
| Frontend step        | `apps/issuer/src/app/applications/steps/financial-statements-step.tsx` |
| Loading skeleton     | `apps/issuer/src/app/applications/components/financial-statements-skeleton.tsx` |

---

## Shared Financial Calculator

**File:** `packages/types/src/financial-calculator.ts`

Used by admin dashboards or analytics when financial ratios are needed.

```ts
import { calculateFinancialMetrics } from "@cashsouk/types";

const computed = calculateFinancialMetrics({
  bsfatot: 1000000,
  othass: 200000,
  bscatot: 500000,
  bsclbank: 300000,
  curlib: 200000,
  bsslltd: 400000,
  bsclstd: 150000,
  bsqpuc: 1000000,
  turnover: 1800000,
  plnpat: 280000,
});

// computed: { totass, totlib, profit_margin, return_of_equity, currat, workcap, turnover_growth }
```

All formulas are divide-by-zero safe. Missing values default to 0.

---

## Label Mapping

**File:** `packages/types/src/financial-field-labels.ts`

```ts
import { FINANCIAL_FIELD_LABELS } from "@cashsouk/types";

const label = FINANCIAL_FIELD_LABELS["pldd"]; // "Financing Year End"
```

---

## Backend

### Schema

`financialStatementsInputSchema` validates only input fields:

- Dates: `pldd`, `bsdd` — `z.string().optional().default("")`
- Numbers: `bsfatot`, `othass`, `bscatot`, `bsclbank`, `curlib`, `bsslltd`, `bsclstd`, `bsqpuc`, `turnover`, `plnpbt`, `plnpat`, `plminin`, `plnetdiv`, `plyear` — `z.union([z.string(), z.number()]).optional().default(0)`

Exported type: `FinancialStatementsStoredData`.

### Service Logic

In `updateStep()` when `fieldName === "financial_statements"`:

1. Validate payload with `financialStatementsInputSchema`
2. Normalize numbers (toNum) and dates (string)
3. Store flat object directly: `updateData.financial_statements = validatedNormalized`
4. No computed fields are calculated or stored

---

## Frontend

### UI Sections

1. **Financial Year** — pldd, bsdd (DateInput)
2. **Assets** — bsfatot, othass, bscatot, bsclbank (MoneyInput, RM prefix)
3. **Liabilities** — curlib, bsslltd, bsclstd (MoneyInput, RM prefix)
4. **Equity** — bsqpuc (MoneyInput, RM prefix)
5. **Profit and Loss** — turnover, plnpbt, plnpat, plminin, plnetdiv, plyear (MoneyInput except plyear as number)

No Total Assets, Total Liability, or Financial Ratios section in issuer UI.

### Data Flow

- **Load:** `fromSaved(application.financial_statements)` — supports old nested `{ input }` format and new flat format; maps old keys to new for backward compatibility
- **Save:** `toApiPayload(input)` — returns flat object with canonical keys only

---

## Backward Compatibility

When loading saved data:

- If `saved` has `input` key → treat as old format; read from `input` and map old keys to new
- Else → treat as flat; read directly with new keys
- Missing keys default per `defaultInput`

Old → new key mapping:

| Old Key                      | New Key  |
|-----------------------------|----------|
| financing_year_end           | pldd     |
| balance_sheet_financial_year | bsdd     |
| fixed_assets                 | bsfatot  |
| other_assets                 | othass   |
| current_assets               | bscatot  |
| non_current_assets           | bsclbank |
| current_liability            | curlib   |
| long_term_liability          | bsslltd  |
| non_current_liability        | bsclstd  |
| paid_up                      | bsqpuc   |
| profit_before_tax            | plnpbt   |
| profit_after_tax             | plnpat   |
| minority_interest            | plminin  |
| net_dividend                 | plnetdiv |
| profit_and_loss_year         | plyear   |

---

## Verification

```bash
pnpm -w typecheck
pnpm -w lint
```

Manual test: Create application → fill financial statements → save. Inspect `Application.financial_statements` in DB: flat JSON, only input keys, no computed fields.

---

## Out of Scope (Per Design)

- CTOS integration
- Multi-year financial history
- Admin financial comparison UI

These may be added later.
