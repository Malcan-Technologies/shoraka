# Invoice Details Step — Validation Guide

This guide lists all validations applied in the Invoice Details step (`apps/issuer/src/app/(application-flow)/applications/steps/invoice-details-step.tsx`).

The step is a stacked form (same shell as Facility Details), not a spreadsheet. Save and Continue is enabled when required fields are present. Date, tenure, amount, and ratio constraints still run on save, and they also show inline once those fields are filled.

---

## Validation Summary

| #   | Validation                   | Applies to                                                         | Description                                                                                                                                                        | Server-enforced |
| --- | ---------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- |
| 1   | Partial invoice              | All                                                                | All 4 required fields must be filled or the invoice must be empty.                                                                                                 | Client          |
| 2   | Duplicate invoice numbers    | All                                                                | Invoice numbers must be unique on this application and on the same facility (non-withdrawn).                                                                       | Create/update   |
| 3   | Product config               | All                                                                | Product config must exist.                                                                                                                                         | Create/update   |
| 4   | Invalid date format          | All                                                                | Maturity date must be parseable.                                                                                                                                   | Create/update, submit, amendment resubmit |
| 5   | Past maturity date           | All                                                                | Maturity date must be today or future.                                                                                                                             | Create/update, submit, amendment resubmit |
| 6   | Contract date window         | new_contract, existing_contract                                    | Maturity date ≥ contract start date.                                                                                                                               | As today (facility invoices) |
| 7a  | Min/max invoice value        | All                                                                | Invoice face value within `min_invoice_face_value` / `max_invoice_face_value`.                                                                                     | Create/update, submit, amendment resubmit |
| 7b  | Min/max financing amount     | All                                                                | Financing amount (`value × ratio`) within `min_invoice_value` / `max_invoice_value`.                                                                               | Create/update, submit, amendment resubmit |
| 7c  | Facility sub-limit           | Facility invoices only                                             | Financing amount ≤ `sub_limit_per_invoice_rm`. Skipped for `invoice_only`.                                                                                         | Create/update, submit, amendment resubmit |
| 8   | At least one valid invoice   | invoice_only, existing_contract                                    | Exactly one complete valid invoice required (max one per application).                                                                                             | Submit          |
| 9   | Financing ratio              | All                                                                | Financing ratio must be within the product band (default 60–80%).                                                                                                  | Create/update, submit, amendment resubmit |
| 10  | Dual facility limits         | existing_contract (split); legacy new_contract + existing_contract | Draft overage is a saveable warning. Submit and reserved amendment edits are hard-blocked on remaining credit (financing) and remaining allocation (invoice face). | As today        |
| 11  | Max one invoice              | All                                                                | Each application allows at most one invoice (legacy files may still show more as extra tabs).                                                                      | Create/update   |

Contract duration (`min_contract_months`) is enforced on facility save and submit. All server checks use the frozen `product_version` workflow. Limit failures return `PRODUCT_LIMIT_VIOLATION`.

---

## By Structure Type

### invoice_only

- No contract, no facility, no other-invoice tabs.
- Validations: 1–5, 7a–7b, 8–9, 11.
- **Exactly one invoice** on this application.
- Skipped: 6 (contract window), 7c (facility sub-limit), 10 (facility limit).

### new_contract

- **Split (new) applications** omit this step. The application is facility-only; finance an invoice later from the approved facility.
- **Legacy combined** applications still allow **0 or 1 invoice** on the same file.
- Validations for legacy combined: 1–11. Continue without an invoice remains valid.

### existing_contract

- Contract approved; utilised = sum of APPROVED invoices **on the facility** (across applications).
- Validations: 1–11.
- **Exactly one invoice** on this application.
- Other invoices on the same facility appear as read-only tabs (display only; not saved from this step).
- Dual limits: requested financing vs remaining credit; invoice face vs remaining allocation. Reserved invoices add back this row before the comparison.

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

The due date must also be within **180 days** of today. Financing tenure cannot cover a longer gap. The field shows a helper and an error if a farther date is entered.

### 6. Contract date window

**Applies to:** new_contract, existing_contract. **Skipped for:** invoice_only.

Invoice maturity date must be on or after the contract start date.

### 7a. Min/max invoice value (face)

**Applies to:** All.

Invoice face value is `details.value`.

- If `min_invoice_face_value` is configured: face ≥ min.
- If `max_invoice_face_value` is configured: face ≤ max.

### 7b. Min/max financing amount (product config)

**Applies to:** All.

Per-invoice financing amount = `value × (financing_ratio_percent / 100)`.

- If `min_invoice_value` is configured: financing amount ≥ min.
- If `max_invoice_value` is configured: financing amount ≤ max.

### 7c. Facility sub-limit per invoice

**Applies to:** Facility invoices (`new_contract`, `existing_contract`). **Skipped for:** `invoice_only`.

If `sub_limit_per_invoice_rm` is configured, financing amount cannot exceed that cap.

Config comes from the frozen product workflow invoice step.

### Admin offers

Offered amount and ratio are bound by product min/max financing, the facility sub-limit (facility invoices only), and the ratio band. A submitted invoice that is already outside those limits shows a warning; admin can still size the offer down within limits. Send-offer is blocked when the offer itself violates the rules. The API returns `PRODUCT_LIMIT_VIOLATION` from send-invoice-offer and send-contract-offer.

### 8. At least one valid invoice

**Applies to:** invoice_only, existing_contract.

At least one non-empty invoice must pass `validateRow` (all 4 fields filled).

### 9. Financing ratio 60–80%

**Applies to:** All.

Financing ratio must be between 60% and 80% for each non-empty invoice.

### 10. Dual facility limits

**Applies to:** existing_contract, and legacy combined `new_contract`. **Skipped for:** invoice_only and split facility-only `new_contract`.

Two independent caps:

| Cap                | Amount checked      | Remaining shown                                                  |
| ------------------ | ------------------- | ---------------------------------------------------------------- |
| Revolving facility | requested financing | Left to draw / remaining credit (approved − utilised − reserved) |
| Contract lifetime  | invoice face value  | Left on contract / remaining allocation                          |

Draft overage is an amber preview: the issuer can save, but cannot submit. Reserved amendment overage and server capacity errors (`FACILITY_CAPACITY_EXCEEDED`, `CONTRACT_LIFETIME_EXCEEDED`) are hard blocks. Admins cannot send an over-limit offer.

---

## Related

- [Contract offer & facility flow](./contract-offer-facility-flow.md)
- [Amendment flow](./amendment-flow.md)
