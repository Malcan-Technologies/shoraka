# Issuer Dashboard Application, Contract, and Invoice Flow Guide

This guide explains how `Application`, `Contract`, and `Invoice` are created and linked today, and how that affects the issuer dashboard listing.

## 1. Big picture

Issuer creates an `Application` (financing request) and then completes wizard steps driven by a Product workflow.

- `Application` stores wizard payloads in JSON columns: `financing_type`, `financing_structure`, and other step payloads.
- `Contract` stores contract/payout terms and counterparty details in JSON columns: `contract_details`, `customer_details`, plus offer metadata in `offer_details`.
- `Invoice` stores invoice item data in `details` JSON, plus offer metadata in `offer_details`.

After the app is submitted and reviewed, admin/issuer actions move statuses forward (DRAFT → SUBMITTED → OFFER_SENT → APPROVED, etc.).

## 2. What Application means

Confirmed from code:
- `Application` has:
  - `financing_type` (JSON) which stores at least `product_id`.
  - `financing_structure` (JSON) which stores `structure_type` = `new_contract | existing_contract | invoice_only` (and for `existing_contract` also `existing_contract_id`).
  - `contract_id` (nullable FK) which links the application to a `Contract` row (when present).
  - `invoices[]` (at most **one** invoice per application; a facility still has many invoices over time via separate applications).

Confirmed from code (schema):
- Application has 0–1 invoice in normal use (`MAX_INVOICES_REACHED` on create). Legacy applications may still have more than one row.

## 3. What Contract means

Confirmed from code:
- `Contract` is created/linked for:
  - `new_contract` flow (it is created during `contract_details` step).
  - `invoice_only` flow (it is used to store customer/paymaster details even though contract offer flow is skipped).
  - `existing_contract` flow (a previously approved contract is linked to the application).

Contract JSON fields:
- `contract_details` (nullable JSON): contract terms and facility fields.
- `customer_details` (nullable JSON): counterparty/customer details (used as “Paymaster” context).
- `offer_details` (nullable JSON): set when offers are sent/accepted/rejected.

Important distinction:
- `invoice_only` still links a holder Contract on the application for `customer_details` / `paymaster_id`. The holder may be `SUBMITTED`.
- The holder is not a facility: excluded from issuer, admin, paymaster, and org facility lists and metrics; no facility offer/capacity actions or facility-detail links.

## 4. What Invoice means

Confirmed from code:
- `Invoice` rows are created inside the `invoice_details` wizard step.
- Each invoice row has:
  - `application_id` (required FK)
  - `contract_id` (nullable FK)
  - `details` JSON (invoice number, value, maturity date, financing ratio percent, document metadata)
  - `offer_details` JSON (set when invoice offer is sent/reviewed)

Confirmed from code:
- Each application has **at most one** invoice (create is blocked after the first).
- Additional invoices against the same facility use a **new** `existing_contract` application.

## 5. Financing structure: Invoice only

Confirmed from code (issuer UI):
- `contract_details` step is still rendered, but it hides contract terms UI and saves only `customer_details`.
- `invoice_details` step creates invoices without passing a `contract_id`.

Confirmed from code (backend):
- Application still links a holder Contract for `customer_details` / `paymaster_id` (holder may be `SUBMITTED`).
- `Invoice.contract_id` must be null. Create/update with a non-null value returns 400 `STANDALONE_INVOICE_NO_FACILITY`.
- Invoice offer capacity does not fall back to `Application.contract_id`.
- Switching to `invoice_only` unlinks a previous facility; structure change is blocked once invoices are past DRAFT.

Confirmed expected data shape:
- `Application.financing_structure.structure_type = "invoice_only"`
- `Application.contract_id` = holder Contract (customer/paymaster only)
- `Invoice.contract_id = null`

## 6. Financing structure: New contract

Confirmed from code (issuer UI):
- `contract_details` step creates a new `Contract` row when there isn’t one.
- `invoice_details` step creates **one** invoice for this application and passes `contract_id` = `application.contract_id` when applicable.

Confirmed expected data shape:
- `Application.financing_structure.structure_type = "new_contract"`
- `Application.contract_id = contract.id`
- `Invoice.contract_id = contract.id` (for created/updated invoices)
- Invoices appear under the contract detail page (because issuer-dashboard filters by invoice.contract_id).

## 7. Financing structure: Existing contract

Confirmed from code (issuer UI):
- When user selects `existing_contract`, the wizard filters out the `contract_details` step.
- The application gets linked to an existing approved contract via backend when `financing_structure` is saved.
- `invoice_details` step loads **this application's** invoice only; facility occupancy is shown as a summary.
- New invoices against the facility use a new application (`existing_contract`).

Confirmed expected data shape:
- `Application.financing_structure.structure_type = "existing_contract"`
- `Application.contract_id = existingApprovedContract.id`
- `Invoice.contract_id = existingApprovedContract.id` (for created/updated invoices)

## 8. How Application / Contract / Invoice are linked

Confirmed from code:

### Invoice-only

```mermaid
flowchart TD
  A[Application (structure_type = invoice_only)] --> C[Contract row (holder)]
  A --> I[Invoices[]]
  I -->|contract_id = null| X((No contract link))
```

### New contract

```mermaid
flowchart TD
  A[Application (structure_type = new_contract)] --> C[Contract row (facility)]
  A --> I[Invoices[]]
  I -->|contract_id = Contract.id| C
  C --> I
```

### Existing contract

```mermaid
flowchart TD
  A[Application (structure_type = existing_contract)] --> C[Existing approved Contract]
  A --> I[Invoices[]]
  I -->|contract_id = Contract.id| C
  C --> I
```

## 9. Whether invoice.contract_id is reliable for dashboard grouping

Confirmed from code:
- `invoice_details` step explicitly controls whether `contractId` is passed:
  - `invoice_only`: does NOT pass `contractId` on create, and forces `contractId = null` on update.
  - `new_contract` / `existing_contract`: passes `contractId` = `application.contract_id` when creating/updating invoices.

Therefore:
- `Invoice.contract_id === null` is the enforced standalone-invoice shape (`invoice_only` rejects a non-null value with 400 `STANDALONE_INVOICE_NO_FACILITY`).
- `Invoice.contract_id !== null` means a contract-linked invoice.
- Occupancy/capacity for `invoice_only` uses only `Invoice.contract_id` (null); it does not fall back to `Application.contract_id`.

## 10. How issuer dashboard groups Contract Financing vs Invoice Financing

Confirmed from code:

### Main Contract Financing section
- Show real facilities only.
- Exclude `invoice_only` holder contracts (`isStandaloneHolderContract`: every linked application is `invoice_only`).

### Main Invoice Financing section
- Show standalone invoice cards only:
  - include invoices where `Invoice.contract_id === null`
  - exclude invoices where `Invoice.contract_id !== null`

### Contract Detail page
- Show invoices linked to that contract:
  - include invoices where `Invoice.contract_id === Contract.id`

## 11. How contract detail page should show invoices

Confirmed from code:
- Holder contracts 404 (`CONTRACT_NOT_FOUND`).
- Real-facility detail builds:
  - `contract` from `full.contracts`
  - `invoices` from `full.invoices.filter(i.contractId === contractId)`

So:
- contract detail shows contract-linked invoices (and keeps Note info attached by invoice id).

## 12. How invoices later become Notes

Confirmed from code (note creation logic):
- When creating a Note from an approved invoice, the note stores:
  - `note.source_invoice_id = invoice.id`
  - `note.source_contract_id` = occupancy contract id (`Invoice.contract_id`, else `Application.contract_id` unless the application is `invoice_only`)
- For a valid standalone invoice, `source_contract_id` is null. Paymaster, customer, and contract snapshots are still written from the holder as required.
- Existing notes are not backfilled.

Notes stay attached by invoice id in the issuer-dashboard service, so main-list filtering must not drop contract-detail invoice fetches.

## 13. Current API behavior (issuer dashboard)

Confirmed from code (issuer-dashboard service):

### `GET /v1/issuer/dashboard`
- `contracts[]`: one card per real facility; omits standalone holder contracts.
- `invoices[]`: standalone invoices (`invoice.contract_id === null`). Contract-linked invoices are omitted from the main list.

### `GET /v1/issuer/dashboard/contracts/:contractId`
- 404 `CONTRACT_NOT_FOUND` for a standalone holder.
- otherwise returns `{ contract: row, invoices }` where invoices have `i.contractId === contractId`.

## 14. Dashboard listing rule

1. Contract Financing: real facilities only (holders excluded).
2. Contract detail: invoices where `invoice.contract_id` matches the contract. Holder detail is 404.
3. Main Invoice Financing: invoices where `invoice.contract_id` is null.

Customer / paymaster display for standalone invoices still reads the holder’s `customer_details` / `paymaster_id`.

