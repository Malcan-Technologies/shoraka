# Invoice Details Step — Validation Guide

This guide lists all validations applied in the Invoice Details step (`apps/issuer/src/app/(application-flow)/applications/steps/invoice-details-step.tsx`).

---

## Validation Summary

| # | Validation | Applies to | Description |
|---|------------|------------|-------------|
| 1 | Partial rows | All | All 4 fields must be filled or row must be empty. |
| 2 | Duplicate invoice numbers | All | Invoice numbers must be unique. |
| 3 | Product config | All | Product config must exist. |
| 4 | Invalid date format | All | Maturity date must be parseable. |
| 5 | Past maturity date | All | Maturity date must be today or future. |
| 6 | Contract date window | new_contract, existing_contract | Maturity date ≥ contract start date. |
| 7 | Min/max financing amount | All | Per-invoice financing amount within product limits. |
| 8 | At least one valid invoice | invoice_only, existing_contract | At least one complete valid row required. |
| 9 | Financing ratio 60–80% | All | Financing ratio must be between 60% and 80%. |
| 10 | Facility limit | new_contract, existing_contract | Total financing must not exceed facility limit. |

---

## By Structure Type

### invoice_only

- No contract, no facility.
- Validations: 1–5, 7, 8, 9.
- Skipped: 6 (contract window), 10 (facility limit).

### new_contract

- Contract exists but may be unapproved.
- Validations: 1–10.
- Facility limit: `totalFinancingAmount` vs `approvedFacility` or `contractFinancing`.

### existing_contract

- Contract approved; utilised = sum of APPROVED invoices under contract.
- Validations: 1–10.
- Facility limit: `nonApprovedFinancingAmount` vs `availableFacility` (approved − utilised).

---

## Detailed Rules

### 1. Partial rows

All required columns must be filled or the row must be empty. Half-filled rows are not allowed.

- Invoice number
- Value
- Maturity date
- Document (file)

### 2. Duplicate invoice numbers

Each invoice number must be unique across non-empty rows.

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

At least one non-empty row must pass `validateRow` (all 4 fields filled).

### 9. Financing ratio 60–80%

**Applies to:** All.

Financing ratio must be between 60% and 80% for each non-empty row.

### 10. Facility limit

**Applies to:** new_contract, existing_contract. **Skipped for:** invoice_only.

| Structure | Amount checked | Limit |
|-----------|----------------|-------|
| new_contract | totalFinancingAmount | approvedFacility or contractFinancing |
| existing_contract | nonApprovedFinancingAmount (DRAFT + SUBMITTED) | availableFacility (approved − utilised) |

---

## Related

- [Contract offer & facility flow](./contract-offer-facility-flow.md)
- [Amendment flow](./amendment-flow.md)
