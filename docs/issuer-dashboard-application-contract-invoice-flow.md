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
  - `invoices[]` (1 application can have many invoice rows).

Confirmed from code (schema):
- Application can have multiple invoices: `Application.invoices` (Prisma relation).

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
- “Invoice-only” does not necessarily mean “no Contract row”.
- It means “no contract offer/facility logic” for the financing lifecycle.

## 4. What Invoice means

Confirmed from code:
- `Invoice` rows are created inside the `invoice_details` wizard step.
- Each invoice row has:
  - `application_id` (required FK)
  - `contract_id` (nullable FK)
  - `details` JSON (invoice number, value, maturity date, financing ratio percent, document metadata)
  - `offer_details` JSON (set when invoice offer is sent/reviewed)

Confirmed from code:
- An application can have many invoices.

## 5. Financing structure: Invoice only

Confirmed from code (issuer UI):
- `contract_details` step is still rendered, but it hides contract terms UI and saves only `customer_details`.
- `invoice_details` step creates invoices without passing a `contract_id`.

Confirmed from code (backend):
- When `financing_structure.structure_type === "invoice_only"` is saved:
  - application disconnects any existing `contract_id`
  - and it clears `contract_id` on DRAFT invoices (only DRAFT invoices).

Confirmed expected data shape:
- `Application.financing_structure.structure_type = "invoice_only"`
- `Invoice.contract_id = null`
- Contract row may still exist, but it is used as a “holder” for `customer_details` (and `contract_details` is cleared/null).

## 6. Financing structure: New contract

Confirmed from code (issuer UI):
- `contract_details` step creates a new `Contract` row when there isn’t one.
- `invoice_details` step creates invoices and passes `contract_id` = `application.contract_id`.

Confirmed expected data shape:
- `Application.financing_structure.structure_type = "new_contract"`
- `Application.contract_id = contract.id`
- `Invoice.contract_id = contract.id` (for created/updated invoices)
- Invoices appear under the contract detail page (because issuer-dashboard filters by invoice.contract_id).

## 7. Financing structure: Existing contract

Confirmed from code (issuer UI):
- When user selects `existing_contract`, the wizard filters out the `contract_details` step.
- The application gets linked to an existing approved contract via backend when `financing_structure` is saved.
- `invoice_details` step:
  - fetches contract-linked invoices by contract
  - and passes `contract_id` = `application.contract_id` for newly created invoices.

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
- For normal UI flows, `Invoice.contract_id === null` reliably means “standalone invoice financing”.
- `Invoice.contract_id !== null` reliably means “contract-linked invoice”.

Assumption / edge-case risk (needs business confirmation):
- If someone switches `financing_structure` after invoices exist, the backend only clears `contract_id` for DRAFT invoices (not for already SUBMITTED/APPROVED invoices).
- In rare “structure changed after offers” data, some invoices might keep `contract_id` even if the UI later treats them as invoice-only.

## 10. How issuer dashboard should group Contract Financing vs Invoice Financing

Recommended dashboard rule (aligned to the product expectation in this issue):

### Main Contract Financing section
- Show contracts that are part of real contract-based financing flows.
- Strong suggestion: group by `Application.financing_structure` (exclude `invoice_only` holder contract cards).

Status:
- Not confirmed in issuer-dashboard code yet (the current code includes any `application.contract` that exists).
- This guide focuses on invoice duplication; changing contract-card grouping is a separate decision.

### Main Invoice Financing section
- Show standalone invoice cards only:
  - include invoices where `Invoice.contract_id === null`
  - exclude invoices where `Invoice.contract_id !== null`

### Contract Detail page
- Show invoices linked to that contract:
  - include invoices where `Invoice.contract_id === Contract.id`

## 11. How contract detail page should show invoices

Confirmed from code:
- Contract detail endpoint (`GET /v1/issuer/dashboard/contracts/:contractId`) builds:
  - `contract` from `full.contracts`
  - `invoices` from `full.invoices.filter(i.contractId === contractId)`

So:
- contract detail naturally shows contract-linked invoices (and keeps Note info that is attached by invoice id).

## 12. How invoices later become Notes

Confirmed from code (note creation logic):
- When creating a Note from an approved invoice, the note stores:
  - `note.source_invoice_id = invoice.id`
  - `note.source_contract_id = invoice.contract_id ?? application.contract_id`

Implication for this ticket:
- Notes are attached by invoice id in the issuer-dashboard service.
- So filtering main-dashboard invoices must not break contract detail fetching, otherwise Note info could go missing from contract detail UI.

## 13. Current API behavior (issuer dashboard)

Confirmed from code (issuer-dashboard service):

### `GET /v1/issuer/dashboard`
- `contracts[]`:
  - loops applications
  - pushes a contract card when `application.contract` exists
- `invoices[]`:
  - loops applications
  - pushes ALL invoices for that application
  - does not filter by `invoice.contract_id`

### `GET /v1/issuer/dashboard/contracts/:contractId`
- calls `getDashboard()`
- filters `full.invoices` to only those with `i.contractId === contractId`
- returns `{ contract: row, invoices }`

## 14. Recommended dashboard listing rule

Goal:
- Avoid duplicate invoice cards:
  - Contract detail should still show contract-linked invoices
  - Main invoice list should NOT show contract-linked invoices

Recommended rule (simple English):
1. Contract detail page: show invoices where `invoice.contract_id` matches the contract.
2. Main Invoice Financing section: show only invoices where `invoice.contract_id` is null.

Why this matches code reality:
- Invoice-only UI creates invoices without `contract_id`.
- Contract-based UI creates invoices with `contract_id`.

## 15. Open questions / Needs business confirmation

1. Should “Contract Financing” cards show for `invoice_only` applications?
   - Confirmed from code: `invoice_only` still runs `contract_details` step and can create a Contract row as a holder for `customer_details`.
   - Current issuer-dashboard code may show contract cards anytime `application.contract` exists.
   - Needs business decision: are holder contracts supposed to appear in “Contract Financing” cards?

2. Edge-case data cleanup:
   - If an issuer changes structure after invoices are SUBMITTED/APPROVED, the backend only clears contract_id on DRAFT invoices when switching to `invoice_only`.
   - Should we treat those still-linked invoices as “standalone” or “contract-linked” for dashboard display?

3. Contract detail “customer / paymaster name” source:
   - Today, invoice customer name uses `application.contract.customer_details`.
   - Needs confirmation if invoice-only should show customer name even when contract_details are cleared.

