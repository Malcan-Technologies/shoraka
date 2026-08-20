# Invoice Details Step — Validation Guide

This guide lists all validations applied in the Invoice Details step (`apps/issuer/src/app/(application-flow)/applications/steps/invoice-details-step.tsx`).

The step is a stacked form (same shell as Facility Details), not a spreadsheet. Field errors show only after Save and Continue.

---

## Validation Summary

| # | Validation | Applies to | Description |
|---|------------|------------|-------------|
| 1 | Partial invoice | All | All 4 required fields must be filled or the invoice must be empty. |
| 2 | Duplicate invoice numbers | All | Invoice numbers must be unique on this application and on the same facility (non-withdrawn). |
| 3 | Product config | All | Product config must exist. |
| 4 | Invalid date format | All | Maturity date must be parseable. |
| 5 | Past maturity date | All | Maturity date must be today or future. |
| 6 | Contract date window | new_contract, existing_contract | Maturity date ≥ contract start date. |
| 7 | Min/max financing amount | All | Per-invoice financing amount within product limits. |
| 8 | At least one valid invoice | invoice_only, existing_contract | Exactly one complete valid invoice required (max one per application). |
| 9 | Financing ratio 60–80% | All | Financing ratio must be between 60% and 80%. |
| 10 | Facility limit | new_contract, existing_contract | This application's invoice financing must not exceed facility limit (warning only). |
| 11 | Max one invoice | All | Each application allows at most one invoice (legacy files may still show more as extra tabs). |

---

## By Structure Type

### invoice_only

- No contract, no facility, no other-invoice tabs.
- Validations: 1–5, 7–9, 11.
- **Exactly one invoice** on this application.
- Skipped: 6 (contract window), 10 (facility limit).

### new_contract

- Contract exists but may be unapproved.
- Validations: 1–11.
- **0 or 1 invoice** on this application (originate the facility first; finance more invoices later via separate `existing_contract` applications). Continue without an invoice remains valid.
- Facility limit: this application's financing amount vs `approvedFacility` or `contractFinancing`.

### existing_contract

- Contract approved; utilised = sum of APPROVED invoices **on the facility** (across applications).
- Validations: 1–11.
- **Exactly one invoice** on this application.
- Other invoices on the same facility appear as read-only tabs (display only; not saved from this step).
- Facility limit: this application's `nonApprovedFinancingAmount` vs `availableFacility` (approved − utilised).

---

## Detailed Rules

### 1. Partial invoice

All required fields must be filled or the invoice must be empty. Half-filled invoices are not allowed.

- Invoice number
- Value
- Maturity date
- Document (file)

### 2. Duplicate invoice numbers

Each invoice number must be unique among this application's invoices and among other **non-withdrawn** invoices on the same `contract_id`. The API rejects duplicates with `DUPLICATE_INVOICE_NUMBER`. Skipped for `invoice_only` (`contract_id` null).

### 3. Product config

Product configuration must be resolvable from the application. If missing, validation fails with a product configuration error.

### 4. Invalid date format

Maturity date must be parseable (e.g. ISO or `d/M/yyyy`). Invalid formats (e.g. Feb 31) produce an error.

### 5. Past maturity date

Maturity date must be today or a future date. Overdue invoices cannot be financed.

### 6. Contract date window

**Applies to:** new_contract, existing_contract. **Skipped for:** invoice_only.

Invoice maturity date must be on or after the contract start date.

### 7. Min/max financing amount (product config)

**Applies to:** All.

Per-invoice financing amount = `value × (financing_ratio_percent / 100)`.

- If `min_invoice_value` is configured: financing amount ≥ min.
- If `max_invoice_value` is configured: financing amount ≤ max.

Config comes from the product workflow invoice step.

### 8. At least one valid invoice

**Applies to:** invoice_only, existing_contract.

At least one non-empty invoice must pass `validateRow` (all 4 fields filled).

### 9. Financing ratio 60–80%

**Applies to:** All.

Financing ratio must be between 60% and 80% for each non-empty invoice.

### 10. Facility limit

**Applies to:** new_contract, existing_contract. **Skipped for:** invoice_only.

This is a **warning**, not a hard block.

| Structure | Amount checked | Limit |
|-----------|----------------|-------|
| new_contract | totalFinancingAmount | approvedFacility or contractFinancing |
| existing_contract | nonApprovedFinancingAmount (DRAFT + SUBMITTED) | availableFacility (approved − utilised) |

---

## Related

- [Contract offer & facility flow](./contract-offer-facility-flow.md)
- [Amendment flow](./amendment-flow.md)
