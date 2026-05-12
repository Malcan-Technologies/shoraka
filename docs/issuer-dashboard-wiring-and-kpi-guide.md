# Issuer Dashboard Wiring and KPI Guide

## 1. Big picture

The Issuer Dashboard is a **financing monitoring dashboard**, not a raw “applications list”.

Key ideas:

- **Contract Financing** shows **unique contracts** (deduped by `Contract.id`), but with **aggregated invoice + note metrics** across every application that references that contract.
- **Invoice Financing** shows **standalone invoice-only invoices** (invoices where `Invoice.contract_id` is `NULL`).
- **Contract-linked invoices** (where `Invoice.contract_id` is set) are **hidden** from the main Invoice Financing list, but **shown inside Contract Detail**.
- **Notes** are the lifecycle objects that drive most statuses and KPI metrics shown on the dashboard cards (and later repayment performance).
- **Amendments are Application-based** and are handled on the **Applications page**.
- The Financing Dashboard shows:
  - **“Review offer”** when an offer is available and unexpired.
  - **“Action required”** when the related `Application.status = AMENDMENT_REQUESTED`.

Simple wiring diagram:

```text
Application
  ├─ may create/use Contract
  ├─ has Invoices
  └─ invoices may become Notes

Contract
  └─ has contract-linked invoices

Invoice
  └─ may have one Note

Note
  ├─ may have NoteListing
  ├─ has investments/funding
  └─ later repayment/settlement
```

## 2. Main Issuer Dashboard data flow

### Backend endpoint

Main endpoint:

- `GET /v1/issuer/dashboard?organizationId=...`

Backend implementation:

- API controller: `apps/api/src/modules/issuer-dashboard/controller.ts`
- API service: `apps/api/src/modules/issuer-dashboard/service.ts` (`IssuerDashboardService.getDashboard`)

Contracts/invoices/KPIs are assembled into an `IssuerDashboardPayload` and returned to the frontend.

### Frontend consumption

Frontend hook:

- `apps/issuer/src/hooks/use-issuer-dashboard.ts` (`useIssuerDashboard`)

Main page:

- `apps/issuer/src/app/page.tsx` (uses `AccountOverviewCard`, `RepaymentPerformanceCard`, and `FinancingSection`)

Child components:

- `AccountOverviewCard`: `apps/issuer/src/components/account-overview-card.tsx`
- `RepaymentPerformanceCard`: `apps/issuer/src/components/repayment-performance-card.tsx`
- `FinancingSection`: `apps/issuer/src/components/dashboard/financing-section.tsx`

### Responsibilities map

| Layer | File | Responsibility |
|---|---|---|
| API controller | `apps/api/src/modules/issuer-dashboard/controller.ts` | Reads `organizationId`, ensures issuer role, calls service, returns `correlationId` |
| API service | `apps/api/src/modules/issuer-dashboard/service.ts` | Builds the dashboard DTO payload (overview, repaymentPerformance, contracts[], invoices[]) |
| Issuer hook | `apps/issuer/src/hooks/use-issuer-dashboard.ts` | Calls `/v1/issuer/dashboard` and returns `IssuerDashboardData` |
| Main page | `apps/issuer/src/app/page.tsx` | Renders dashboard layout and the three main sections |
| Account overview component | `apps/issuer/src/components/account-overview-card.tsx` | Renders KPI cards using the `overview` object |
| Repayment component | `apps/issuer/src/components/repayment-performance-card.tsx` | Renders KPI cards using the `repaymentPerformance` object |
| Financing section | `apps/issuer/src/components/dashboard/financing-section.tsx` | Renders Contract Financing + Invoice Financing cards and filters |

## 3. Dashboard payload shape

Major payload sections:

- `overview`
- `repaymentPerformance`
- `contracts[]`
- `invoices[]`

### `overview` DTO fields

| DTO field | Source table/model | Source field/formula | Simple meaning |
|---|---|---|---|
| `overview.successRatePercent` | `Note` | `successRatePercent = round(successfulDisbursedNotesCount / fundingOutcomeNotesCount * 100)`, where numerator = `COUNT(Note.activated_at IS NOT NULL)` and denominator = `COUNT(Note.funding_status IN (FUNDED, FAILED))` | Successful disbursement rate |
| `overview.activeFinancingAmount` | `Note` | `SUM(Note.funded_amount)` where `Note.status = ACTIVE` (serialized as string with 2 decimals) | Total active financing amount |
| `overview.pastFinancingAmount` | `Note` | `SUM(Note.funded_amount)` where `Note.status = REPAID` (serialized as string with 2 decimals) | Total past/completed financing amount |
| `overview.activeNotesCount` | `Note` | `COUNT(Note.status = ACTIVE)` | Count of active notes |
| `overview.completedNotesCount` | `Note` | `COUNT(Note.status = REPAID)` | Count of repaid notes |

### `repaymentPerformance` DTO fields

| DTO field | Source table/model | Source field/formula | Simple meaning |
|---|---|---|---|
| `repaymentPerformance.onTimePercent` | `NotePaymentSchedule`, `NotePayment` | Derived in service from schedules due in the last 6 months and “fully paid” receipt timing (details in section 5) | On-time repayment rate |
| `repaymentPerformance.pastDueCount` | `NotePaymentSchedule`, `NotePayment` | Count of schedules due in last 6 months where `due_date < now` but the expected total was never reached | Past due schedules count |
| `repaymentPerformance.lateRepaymentsLastSixMonthsCount` | `NotePaymentSchedule`, `NotePayment` | Count of schedules where the expected total was reached but only after the due date | Late schedules count |

### `contracts[]` DTO fields (Contract Financing rows)

`IssuerDashboardContractDto` is built **once per contract id** (deduped).

| DTO field | Source table/model | Source field/formula | Simple meaning |
|---|---|---|---|
| `contracts[].id` | `Contract` | `c.id` | Contract id |
| `contracts[].applicationId` | `Application` | “primaryApp” = most recently created application referencing the contract (`appsForContract` sorted by `created_at desc`, then `[0]`) | The application id used for UI/modal |
| `contracts[].productId` | `Application.financing_type` | `financing?.product_id` | Product grouping key |
| `contracts[].contractForModal` | `Contract` | `jsonForModal(c)` | Snapshot data used by offer/review modal |
| `contracts[].title` | `Contract.contract_details` | `details.title` (if blank => `null`) | Contract title |
| `contracts[].productName` | (not filled) | Always `null` in current code | Not shown on card |
| `contracts[].customerName` | `Contract.customer_details` | `customer?.name` | Customer name |
| `contracts[].contractStartDate` | `Contract.contract_details` | `start_date` | Period start |
| `contracts[].contractEndDate` | `Contract.contract_details` | `end_date` | Period end |
| `contracts[].approvedFacilityAmount` | `Contract.contract_details` | `approved_facility` serialized to string with 2 decimals | Approved facility |
| `contracts[].utilizedFacilityAmount` | `Contract.contract_details` | `utilized_facility` serialized to string with 2 decimals | Utilized facility |
| `contracts[].availableFacilityAmount` | `Contract.contract_details` | `available_facility` serialized to string with 2 decimals | Available facility |
| `contracts[].activeNotesCount` | `Note` | `COUNT(contract notes where Note.status = ACTIVE)` | Active notes count |
| `contracts[].contractStatus` | `Contract` | `c.status` | Main status badge driver |
| `contracts[].actionRequiredApplicationIds` | `Application` | Dedupe all application ids referencing the contract where `Application.status = AMENDMENT_REQUESTED` | Drives “Action required (N)” |
| `contracts[].invoiceStats.*` | `Invoice` + `Note` | Aggregations described in section 10 | Summary numbers for contract detail |

### `invoices[]` DTO fields (Invoice Financing rows)

| DTO field | Source table/model | Source field/formula | Simple meaning |
|---|---|---|---|
| `invoices[].id` | `Invoice` | `inv.id` | Invoice id |
| `invoices[].applicationId` | `Application` | `app.id` | Owning application id |
| `invoices[].productId` | `Application.financing_type` | `financing?.product_id` | Product grouping key |
| `invoices[].contractId` | `Invoice` | `inv.contract_id` | Whether linked to a contract |
| `invoices[].invoiceForModal` | `Invoice` | `jsonForModal(inv)` | Snapshot data for review modal |
| `invoices[].invoiceStatus` | `Invoice` | `inv.status` | Main badge driver when there is no Note |
| `invoices[].invoiceNumber` | `Invoice.details` | `details.number` else `inv.id` | Invoice number |
| `invoices[].customerName` | depends on app | Uses `app.contract.customer_details.name` when `app.contract` exists; otherwise `null` | Customer display |
| `invoices[].invoiceValue` | `Invoice.details.value` | Parsed decimal -> `toFixed(2)` | Invoice value |
| `invoices[].financingAmount` | `Invoice.details.financing_amount` else ratio-derived | If `details.financing_amount` exists: `String(details.financing_amount)`; else `((invVal * ratio)/100).toFixed(2)` | Financing amount |
| `invoices[].submissionDate` | `Invoice` | `inv.created_at.toISOString()` | Submission date |
| `invoices[].note` | `Note` via `notesByInvoiceId` | `notesByInvoiceId.get(inv.id)` mapped with `mapNoteToDto()` | Note lifecycle driver |
| `invoices[].actionRequiredApplicationIds` | `Application` | If `app.status = AMENDMENT_REQUESTED` then `[app.id]` else `[]` | Drives “Action required” |

## 4. Account Overview KPIs

KPIs are rendered by `AccountOverviewCard` and computed in backend `getDashboard()`.

| KPI | Meaning | Table/model | Field/formula | Notes |
|---|---|---|---|---|
| Success rate | Disbursement success rate | `Note` | numerator = `COUNT(Note.activated_at IS NOT NULL)`; denominator = `COUNT(Note.funding_status IN (FUNDED, FAILED))`; meaning = `round(numerator/denominator * 100)` | Backend uses `activated_at` as success indicator |
| Active financing | Total funded amount of active notes | `Note` | `SUM(Note.funded_amount)` where `Note.status = ACTIVE` | Shown as a formatted money string |
| Past financing | Total funded amount of repaid notes | `Note` | `SUM(Note.funded_amount)` where `Note.status = REPAID` | Past history, not current debt |
| Active notes | Count of active notes | `Note` | `COUNT(Note.status = ACTIVE)` | Count |
| Completed notes | Count of repaid notes | `Note` | `COUNT(Note.status = REPAID)` | Count |

Simple explanations (as required):

- `activated_at` means the Note was activated/disbursed.
- `ACTIVE` means live financing.
- `REPAID` means completed/settled.
- Past financing is completed financing history, not current debt.

## 5. Repayment Performance KPIs

Rendered by `RepaymentPerformanceCard`:

- On time over past 6 months
- Past due
- Late over past 6 months

Backend logic is in `apps/api/src/modules/issuer-dashboard/service.ts`.

| KPI | Meaning | Table/model | Field/formula | Notes |
|---|---|---|---|---|
| On time over past 6 months | % of due schedules that were fully repaid on/before due date | `NotePaymentSchedule`, `NotePayment` | Window: `due_date` between `(now - 6 months)` and `now`; for each schedule: sort `NotePayment` where `status = RECEIVED` by `receipt_date`, then compute cumulative received amount and find the first `fullyPaidDate` when cumulative received `>= expected_total`; if found and `fullyPaidDate <= due_date` => on-time | Must reach full `expected_total` (partial is not enough) |
| Past due | Count of schedules due in the window not fully paid and already past due | `NotePaymentSchedule`, `NotePayment` | For each schedule: if no `fullyPaidDate` and `due_date < now` => pastDueCount++ | Uses due date vs “fully paid”, not earliest payment date |
| Late over past 6 months | Count of due schedules that were fully paid after due date | `NotePaymentSchedule`, `NotePayment` | For each schedule: if `fullyPaidDate` exists and `fullyPaidDate > due_date` => lateCount++ | Same “fully paid date” logic |

Important rules (matching code):

- It does not use earliest payment alone.
- It checks when the **full** `expected_total` is reached.
- Partial payment before due date does not count as on-time unless full expected total is reached.

Baby example:

- Due date: 30 June
- Expected total: RM8,500
- Payment 1: RM100 on 28 June
- Payment 2: RM8,400 on 5 July

Full amount reached on 5 July.
Result = **Late**.

## 6. Contract Financing listing

Contract Financing cards represent **unique contracts** (deduped by `Contract.id`) and show aggregated metrics.

Deduping rule (backend):

- In `getDashboard()`, the service groups applications by `Contract.id` and emits one dashboard contract row per contract id.
- It selects UI `applicationId/productId` from the most recently created application in that contract group.
- Invoice stats aggregate across all invoices under the contract across those applications.
- Note-based metrics still use `Note.source_contract_id` for contract-level note metrics.

Example:

- Application A → Contract 123 → INV-1001
- Application B → Contract 123 → INV-2001

Main dashboard:

- Contract 123 only once

Contract Detail:

- INV-1001
- INV-2001

Rules table:

| Rule | Current behavior |
|---|---|
| One contract card per | `Contract.id` |
| Duplicate contract cards? | No, one per `Contract.id` |
| `contracts[].applicationId/productId` source | Latest application in the contract group sorted by `created_at desc` |
| Invoice stats source | invoices where `Invoice.contract_id = Contract.id` (across all applications in the contract group) |
| Note metrics source | contract-level notes use `Note.source_contract_id = Contract.id` |

## 7. Invoice Financing listing

Main Invoice Financing only shows standalone invoice-only invoices.

Backend behavior in `getDashboard()`:

- When building `invoicesOut` for the main dashboard, it uses `includeContractLinkedInvoices = false`.
- It skips invoices where `inv.contract_id` is set:
  - `if (!includeContractLinkedInvoices && inv.contract_id) continue;`

So:

- Main dashboard invoices include `Invoice.contract_id = NULL`
- Contract Detail shows invoices where `Invoice.contract_id = contract.id`

Rule table:

| Invoice type | Main Invoice Financing | Contract Detail |
|---|---|---|
| `Invoice.contract_id = null` | shown | not shown by contract detail filter |
| `Invoice.contract_id = contract.id` | hidden | shown |

## 8. Contract card field mapping

Contract card UI is implemented in `DashboardContractCard` inside:

- `apps/issuer/src/components/dashboard/financing-section.tsx`

| UI field | Source table/model | Field/formula | Simple meaning |
|---|---|---|---|
| Contract title | DTO: `IssuerDashboardContract.title` | Rendered as `displayCell(row.title)` | Title text |
| Status badge | DTO: `IssuerDashboardContract.contractStatus` | `resolveIssuerContractDashboardBadge(row.contractStatus)` | Derived from `Contract.status` |
| Offer badge | Offer flow | `getOfferStatus(modalContract)` => `offerBadge(offerStatus)` | “Offer received/expired” badge |
| Review offer button | Offer flow | Shown when `offerStatus === "Offer received"` | Opens review modal |
| Action required | DTO: `IssuerDashboardContract.actionRequiredApplicationIds` | shown when `length > 0`, label is `Action required` or `Action required (N)`, tooltip explains amendment | Routes to Applications |
| Customer | DTO: `IssuerDashboardContract.customerName` | `displayCell(row.customerName)` | Customer name |
| Contract period | DTO: `IssuerDashboardContract.contractStartDate/contractEndDate` | UI builds `start to end` string (or single-sided date) | Period shown on card |
| Active notes | DTO: `IssuerDashboardContract.activeNotesCount` | `String(row.activeNotesCount)` | Count of active notes (contract-level) |
| Approved facility | DTO: `IssuerDashboardContract.approvedFacilityAmount` | `Number(...)` then displayed as formatted money | Approved facility amount |
| Utilized facility | DTO: `IssuerDashboardContract.utilizedFacilityAmount` | displayed as formatted money | Utilized facility amount |
| Available facility | DTO: `IssuerDashboardContract.availableFacilityAmount` | **Not shown in current card UI** | Needs code/business confirmation (DTO exists but UI doesn’t render it) |
| Facility progress | Approved/utilised | `utilisationPct = round(utilised/approved * 100)` | Progress bar width |
| View details | Router link | `/financing/contracts/${row.id}` | Opens Contract Detail page |

Recent dashboard wiring changes included in this card:

- “Make amendment” removed from this card and replaced by the application-based **Action required** button + tooltip.

## 9. Invoice card field mapping

Invoice card UI is implemented in `DashboardInvoiceCard` inside:

- `apps/issuer/src/components/dashboard/financing-section.tsx`

| UI field | Source table/model | Field/formula | Simple meaning |
|---|---|---|---|
| Invoice no | DTO: `IssuerDashboardInvoice.invoiceNumber` | `displayCell(row.invoiceNumber)` | Invoice identifier shown |
| Status badge | DTO: `IssuerDashboardInvoice.note` + `invoiceStatus` | `resolveIssuerInvoiceDashboardBadge(row.note, row.invoiceStatus)` | Derived from Note lifecycle if note exists |
| Offer badge | Offer flow | `getOfferStatus(modalInvoice)` => `offerBadge(offerStatus)` | “Offer received/expired” |
| Review offer button | Offer flow | shown when `offerStatus === "Offer received"` | Opens review modal |
| Action required | DTO: `IssuerDashboardInvoice.actionRequiredApplicationIds` | shown when `length > 0`, label is `Action required` or `Action required (N)` | Routes to Applications |
| Note no | DTO: `IssuerDashboardInvoice.note.noteReference` + note id | If `row.note?.id` exists and `noteRef !== EM_DASH`: renders a clickable link `/notes/${row.note.id}` with `LinkIcon`; else shows plain text | Note reference |
| Customer | DTO: `IssuerDashboardInvoice.customerName` | `displayCell(row.customerName)` | Customer name |
| Submission date | DTO: `IssuerDashboardInvoice.submissionDate` | `formatDate(row.submissionDate)` | Displayed submission date |
| Funding deadline | DTO: `note.fundingDeadline` | shown when `row.note?.fundingDeadline`, else `—` | Investor funding close date (see note mapping below) |
| Maturity date | mixed | `maturityRaw = invDetails?.maturity_date ?? row.note?.maturityDate ?? null` then `formatDate(maturityRaw)` | Repayment/maturity date |
| Invoice value | DTO: `IssuerDashboardInvoice.invoiceValue` | `formatMoney(row.invoiceValue)` | Money amount |
| Financing amount | DTO: `IssuerDashboardInvoice.financingAmount` | `formatMoney(row.financingAmount)` | Money amount |
| Marketplace label | **Not shown in current invoice card UI** | Present in DTO note mapping (`marketplaceStatusLabel`) but not rendered here | Needs code/business confirmation |
| Funding progress | DTO note | `progress = resolveFundingProgressPercent(row.note)` then used for progress bar width | `fundingProgressPercent` (or 0) |
| Funding status text | DTO note | `fundingLabel = resolveFundingStatusText(row.note)` then `FundingStatusLine` | “Funding status …” human string |
| Action menu behavior | Current UI | **No 3-dot menu exists in this invoice card component** | Needs code/business confirmation (if menus exist elsewhere) |

Note: “Funding deadline” is the investor funding close date coming from note listing closes_at (not invoice due date).

## 10. Contract Detail page

Contract Detail page:

- `apps/issuer/src/app/financing/contracts/[id]/page.tsx`

### Backend wiring

Backend endpoint used by the page:

- `GET /v1/issuer/dashboard/contracts/:contractId?organizationId=...`

Backend implementation:

- API route: `apps/api/src/modules/issuer-dashboard/controller.ts`
- Service method: `getContractDetail()` in `apps/api/src/modules/issuer-dashboard/service.ts`

`getContractDetail()`:

- Validates contract existence for the issuer organization
- Calls `getDashboard(..., { includeContractLinkedInvoices: true })`
- Returns:
  - `contract`: matching `full.contracts.find(c => c.id === contractId)`
  - `invoices`: `full.invoices.filter(i => i.contractId === contractId)`

### UI sections and what drives them

| Section | UI field | Source/formula |
|---|---|---|
| Header | Contract title + status badge | `row.title`, `resolveIssuerContractDashboardBadge(row.contractStatus)` |
| Header subtitle | Customer + contract period | `row.customerName` and `contractPeriod` computed from `row.contractStartDate/row.contractEndDate` |
| Facility usage | Available facility + usage progress | `row.availableFacilityAmount`; progress bar uses `utilised/approved` computed in UI (only when both are present and approved > 0) |
| KPI summary | Total approved/rejected/unfinanced | `stats.total`, `stats.approved`, `stats.rejected`, `stats.unfinanced` from `row.invoiceStats` |
| KPI breakdown | Funding in progress | `stats.fundingInProgress` |
| KPI breakdown | Active notes / Completed notes / Unsuccessful raise | `stats.activeNotes`, `stats.completedNotes`, `stats.unsuccessfulRaise` |
| Invoice list | Filter toolbar + invoice cards | `FinancingInvoiceFilterToolbar` + `filterInvoices()` + `DashboardInvoiceCard` |

### Contract detail invoice stats formulas (as implemented)

These `stats.*` fields are computed in backend `getDashboard()` inside the contract group loop for `includeContractLinkedInvoices = true`.

Definitions in service:

- `isActiveNote(note) => note.status === NoteStatus.ACTIVE`
- `isCompletedNote(note) => note.status === NoteStatus.REPAID`
- `isUnsuccessfulNote(note) => note.status === NoteStatus.FAILED_FUNDING || note.funding_status === NoteFundingStatus.FAILED`

Stats:

- `stats.total`
  - `contractInvoices.length`
- `stats.approved`
  - `count(contractInvoices where i.status === InvoiceStatus.APPROVED)`
- `stats.rejected`
  - `count(contractInvoices where i.status === InvoiceStatus.REJECTED)`
- `stats.unfinanced`
  - `count(contractInvoices where i.status === APPROVED && !notesByInvoiceId.has(i.id))`
  - (Meaning: approved invoice but no linked Note yet)
- `stats.fundingInProgress`
  - `count(contractNotes where n.status === NoteStatus.PUBLISHED && n.funding_status === NoteFundingStatus.OPEN)`
- `stats.activeNotes`
  - computed by iterating contract-linked invoices:
    - for each invoice `inv`:
      - linked note = `notesByInvoiceId.get(inv.id)`
      - if linked note is active => `activeNotesInv++`
- `stats.completedNotes`
  - same iteration, `if isCompletedNote(linked) completedNotesInv++` (completed = `Note.status === REPAID`)
- `stats.unsuccessfulRaise`
  - same iteration, `if isUnsuccessfulNote(linked) unsuccessfulRaise++`
- `stats.disputedNotes`
  - currently returned as `null` and not shown (see UI conditional rendering)

### Contract detail invoice list filtering

The page shows invoices and filters them client-side using:

- `FinancingInvoiceFilterToolbar` (with `hideCustomer` enabled for this page)
- `filterInvoices(invoices, { ...invoiceListFilters, customer: "" })`

## 11. Status badge mapping

Simplified dashboard badge kinds are defined by:

- `apps/issuer/src/lib/issuer-dashboard-labels.ts`

The 7 kinds are:

- `draft`
- `pending_approval`
- `in_progress`
- `funded`
- `active`
- `completed`
- `unsuccessful`

### A. Contract card main badge (from `Contract.status`)

Source:

- `resolveIssuerContractDashboardBadge(contractStatus)`

| Contract.status | Dashboard badge |
|---|---|
| `DRAFT` | `draft` |
| `SUBMITTED` | `pending_approval` |
| `OFFER_SENT` | `pending_approval` |
| `AMENDMENT_REQUESTED` | `pending_approval` |
| `APPROVED` | `active` |
| `REJECTED` | `unsuccessful` |
| `WITHDRAWN` | `unsuccessful` |
| `CANCELLED` | `unsuccessful` |
| `EXPIRED` | `unsuccessful` |
| fallback | `active` |

### B. Invoice card badge mapping

Source driver:

- If `note == null`: use `Invoice.status`
- If `note != null`: use `note.noteStatus`, `note.fundingStatus`, `note.servicingStatus`, `note.listingStatus`, plus `minimumFundingPercent` and `fundingProgressPercent`

`resolveIssuerInvoiceDashboardBadge(note, invoiceStatus)`:

#### B1. Invoice badge when there is no Note

| Invoice.status | Dashboard badge |
|---|---|
| `DRAFT` | `draft` |
| `SUBMITTED` | `pending_approval` |
| `OFFER_SENT` | `pending_approval` |
| `AMENDMENT_REQUESTED` | `pending_approval` |
| `APPROVED` | `in_progress` |
| `REJECTED` | `unsuccessful` |
| `WITHDRAWN` | `unsuccessful` |
| `CANCELLED` | `unsuccessful` |
| `EXPIRED` | `unsuccessful` |
| fallback | `in_progress` |

#### B2. Invoice badge when there is a Note

This is the exact priority logic:

| Note condition | Dashboard badge |
|---|---|
| `noteStatus` in `FAILED_FUNDING`, `CANCELLED`, `DEFAULTED`, `FAILED`, `WITHDRAWN` OR `fundingStatus === FAILED` | `unsuccessful` |
| `noteStatus` in `REPAID`, `SETTLED`, `COMPLETED` OR `servicingStatus === SETTLED` | `completed` |
| `noteStatus` in `ACTIVE`, `ARREARS`, `DISBURSED` OR `servicingStatus` in `CURRENT`, `ARREARS`, `LATE`, `PARTIAL`, `ADVANCE_PAID` | `active` |
| `fundingStatus === FUNDED` OR `fundingProgressPercent >= minimumFundingPercent` (plus small epsilon) | `funded` |
| `noteStatus === DRAFT` OR `listingStatus === NOT_LISTED` OR (`fundingStatus === NOT_OPEN` AND `listingStatus === NOT_LISTED`) | `draft` |
| `noteStatus` in `PUBLISHED`, `FUNDING` OR `fundingStatus` in `OPEN`, `CLOSED` OR `listingStatus === PUBLISHED` OR (`listingStatus === DRAFT` AND (`fundingStatus === OPEN` OR `noteStatus in FUNDING` OR `noteStatus === PUBLISHED`)) | `in_progress` |
| fallback | `in_progress` |

### Funding progress + funding status line helpers

These helpers are used by the invoice card UI:

- `resolveFundingProgressPercent(note)`:
  - returns `note.fundingProgressPercent` or `0` if missing
- `resolveFundingStatusText(note)`:
  - when there is no note: `"Funding status (Not yet started)"`
  - when unsuccessful: returns `Funding status {pct}% funded (RM {fundedRm})` if pct > 0, else `"Funding did not complete"`
  - when completed: returns `Funding status {pct}% funded (RM {fundedRm})` if pct > 0, else `"Fully completed"`
  - when not-open/not-started: `"Funding status (Not yet started)"`
  - when partially funded: `Funding status {rounded(pct)}% funded (RM {fundedRm})`

## 12. Offer / Review offer mapping

Offer status is computed in:

- `apps/issuer/src/lib/offer-utils.ts` (`getOfferStatus`)

It returns:

- `null` unless `item.status === "OFFER_SENT"` and `item.offer_details` exists
- `"Offer received"` unless `offer_details.expires_at` exists and is expired

Offer expiry logic:

- if `expires_at` is missing => treated as `"Offer received"`
- if `new Date(expiresAt) < new Date()` => `"Offer expired"`

UI behavior:

- The `Review offer` button is part of the `DashboardContractCard` and `DashboardInvoiceCard`.
- It is only shown when `offerStatus === "Offer received"`.
- It is not moved into the 3-dot menu.

Modal wiring note (from code inspection):

- `FinancingSection` (dashboard cards) uses `ReviewOfferModal` imported from:
  - `apps/issuer/src/app/(application-management)/applications/components/ReviewOfferModal`
- `ContractDetailsPage` currently uses `ReviewOfferModal` imported from:
  - `apps/issuer/src/components/review-offer-modal`

Needs code/business confirmation:

- Whether the two modals are intentionally different or should be aligned.

## 13. Action Required / Amendment mapping

Amendment is Application-based, so the dashboard does **not** decide based on `Contract.status` or `Invoice.status`.

Instead, it uses:

- `Application.status = AMENDMENT_REQUESTED`

### Backend: how `actionRequiredApplicationIds` is computed

In `apps/api/src/modules/issuer-dashboard/service.ts`:

- For contracts:
  - `actionRequiredApplicationIds = dedupe(appsForContract.filter(a => a.status === AMENDMENT_REQUESTED).map(a => a.id))`
- For invoices:
  - `actionRequiredApplicationIds = app.status === AMENDMENT_REQUESTED ? [app.id] : []`

### Frontend: how it is shown on financing cards

Dashboard cards live in:

- `apps/issuer/src/components/dashboard/financing-section.tsx`

Contract card:

- shown when `row.actionRequiredApplicationIds.length > 0`
- button label:
  - exactly `Action required` when `length === 1`
  - otherwise `Action required (N)`
- tooltip text:
  - singular: `A related application needs amendment. Go to Applications to review and update it.`
  - plural: `${N} related applications need amendment. Go to Applications to review and update them.`
- click behavior:
  - routes to `/applications?applicationIds=${ids.join(",")}` where `ids` is `actionRequiredApplicationIds`
- “View details” remains in a dropdown and always links to the contract detail page.

Invoice card:

- shown when `row.actionRequiredApplicationIds.length > 0`
- button label rules are the same as contract
- tooltip text is the same as contract
- click behavior:
  - routes to `/applications?applicationIds=${ids.join(",")}`

Action table (as implemented by the UI for this dashboard component):

| Card type | Condition | UI shown | Click behavior |
|---|---|---|---|
| Contract | `0` action-required app ids | no Action required button | none |
| Contract | `1` action-required app id | Action required + View details | `/applications?applicationIds={id}` |
| Contract | `2+` action-required app ids | Action required (N) + View details | `/applications?applicationIds={id1},{id2},...` |
| Invoice | `0` action-required app ids | no Action required button | none |
| Invoice | `1` action-required app id | Action required | `/applications?applicationIds={id}` |

### Why this matches the amendment edit page

Needs code/business confirmation:

- The exact `applications/edit/[id]/page.tsx` gating logic is not copied into this doc yet; the dashboard uses Application-based action ids because the edit page gates by `Application.status`.

## 14. Filters mapping

Filters are implemented entirely on the frontend in `FinancingSection`.

### A. Contract Financing filters

Filter component:

- `FinancingContractFilterToolbar` within `apps/issuer/src/components/dashboard/financing-section.tsx`

The filter state shape:

- `statusKind`: `IssuerFinancingStatusKind | "all"`
- `customer`: exact match on trimmed `customerName` (empty string means “all”)
- `periodPreset`: one of `all | active | starting_soon | expired`

Period options/labels:

- `all` => “All periods”
- `active` => “Active contracts”
- `starting_soon` => “Starting soon”
- `expired` => “Expired contracts”

Period matching logic (exact code behavior):

- Local “today” is a `YYYY-MM-DD` string (`todayLocalDayKey()`)
- Contract period dates are parsed into local day keys (`localCalendarDayKeyFromString`)

| Period preset | Definition (code) |
|---|---|
| `all` | always matches |
| `active` | `startKey <= today` AND `endKey >= today` |
| `starting_soon` | `startKey > today` |
| `expired` | `endKey < today` |

Status/customer filter logic:

- If `statusKind !== "all"`: compares `resolveIssuerContractDashboardBadge(row.contractStatus) === statusKind`
- If `customer !== ""`: compares exact trimmed name `row.customerName.trim() === customer`

### B. Invoice Financing filters

Filter component:

- `FinancingInvoiceFilterToolbar` within `apps/issuer/src/components/dashboard/financing-section.tsx`

Filter state shape:

- `statusKind`: `IssuerFinancingStatusKind | "all"`
- `customer`: exact match on trimmed `customerName` (empty string means “all”)
- `submissionPreset`: `all | 7d | 30d | 6m`

Submission date options/labels:

- `all` => “All dates”
- `7d` => “Last 7 days”
- `30d` => “Last 30 days”
- `6m` => “Last 6 months”

Submission date matching logic (exact code):

- `submissionDateMs` parses `row.submissionDate` using `Date.parse(row.submissionDate)`
- if preset is `7d`: `ms >= now - 7 * 86400000`
- if preset is `30d`: `ms >= now - 30 * 86400000`
- if preset is `6m`: `ms >= cutoff` where `cutoff.setMonth(cutoff.getMonth() - 6)`

Status/customer filter logic:

- If `statusKind !== "all"`: compares `resolveIssuerInvoiceDashboardBadge(row.note, row.invoiceStatus) === statusKind`
- If `customer !== ""`: compares exact trimmed name `row.customerName.trim() === customer`

## 15. Applications page `applicationIds` query filter

Applications page:

- `apps/issuer/src/app/(application-management)/applications/page.tsx`

Behavior implemented in the page:

- It reads `applicationIds` from `window.location.search` on mount.
- It splits by comma, trims, and drops empty values.
- It stores them in `applicationIdsFilter: string[]`.
- It filters the applications list with:
  - `if (applicationIdsFilter.length > 0) { list = list.filter(a => new Set(applicationIdsFilter).has(a.id)) }`

It also shows a banner:

- if `applicationIdsFilter.length === 1`: `Showing 1 application that requires action`
- else: `Showing N applications that require action`

Clear filter behavior:

- “Clear filter” removes only `applicationIds` from the URL:
  - `params.delete("applicationIds")`
- It also clears `setApplicationIdsFilter([])`
- It does not touch signing return params.

Important: it keeps signing params working.

Use table:

| URL | Result |
|---|---|
| `/applications` | normal list |
| `/applications?applicationIds=app_123` | only app_123 |
| `/applications?applicationIds=app_123,app_456` | only those apps |

## 16. Note linkage

This section documents how Notes are linked to invoices (and contracts) to drive dashboard cards and KPIs.

Relationship mapping (as implemented/consumed):

| From | To | Field |
|---|---|---|
| `Note` | `Invoice` | `Note.source_invoice_id = Invoice.id` |
| `Note` | `Contract` | `Note.source_contract_id = Contract.id` |
| `NoteListing` | `Note` | `Note.listing` (included as `listing` in query) |

DTO mapping used by dashboard:

- In `mapNoteToDto()` (backend), the DTO fields used by the dashboard cards are built from:
  - `note.note_reference` => `noteReference`
  - `note.status` => `noteStatus`
  - `note.listing_status` and `note.listing?.status` => `listingStatus`/`noteListingStatus`
  - `note.funding_status` => `fundingStatus`
  - `note.servicing_status` => `servicingStatus`
  - `note.listing?.closes_at` => `fundingDeadline` (ISO string)
  - `note.maturity_date` => `maturityDate` (ISO string)
  - `fundingProgressPercent(note.funded_amount, note.target_amount)` => `fundingProgressPercent`

Dashboard behavior when an invoice has no Note:

- `invoices[].note` is `null` because `notesByInvoiceId.get(inv.id) ?? null`
- Invoice card then shows:
  - Note no: `—` (from `displayCell(undefined)` => `EM_DASH`)
  - Funding deadline: `—`
  - Funding status line: `resolveFundingStatusText(null)` => `"Funding status (Not yet started)"`

When invoice has a Note:

- Invoice card uses the Note fields for:
  - status badge
  - progress bar and funding status text
  - note link (`/notes/${row.note.id}`) if note id exists

## 17. Known caveats / needs confirmation

- Contract “available facility”:
  - Backend computes `contracts[].availableFacilityAmount`.
  - Current `DashboardContractCard` UI does not render it (it renders utilised + approved + utilisation progress).
  - Needs code/business confirmation if the UI is intentionally missing available facility.
- Funding deadline field:
  - Dashboard invoice card uses `note.fundingDeadline` which comes from `NoteListing.closes_at`.
  - Real publish flow may sometimes not populate `closes_at` yet.
  - Needs code/business confirmation whether `closes_at` is guaranteed for all Notes in issuer flows.
- Offer review modal implementations differ:
  - Dashboard cards use `apps/issuer/src/app/(application-management)/applications/components/ReviewOfferModal`
  - Contract detail uses `apps/issuer/src/components/review-offer-modal`
  - Needs code/business confirmation whether this is intentional.
- Repayment performance “fully paid date” logic:
  - The logic ignores payments without `schedule_id` (`if (!sid) continue`).
  - Needs code/business confirmation whether that is correct for all real data.
- “Marketplace label”:
  - DTO mapping exists (`marketplaceStatusLabel`), but invoice card UI does not display it.
  - Needs code/business confirmation whether it should appear on the financing cards.
- Invoice card action menu:
  - Current `DashboardInvoiceCard` component shows no 3-dot dropdown menu.
  - Needs code/business confirmation if invoice rows should have a dropdown in some statuses.

## 18. Final simple summary

- Application = request/submission handled on the Applications page.
- Contract = approved facility created/linked by applications.
- Invoice = receivable created under an application and optionally linked to a contract.
- Note = financing deal created from an approved invoice.
- NoteListing = marketplace display window for notes.
- Dashboard contract cards are unique by `Contract.id` and aggregate across applications sharing that contract.
- Dashboard invoice cards are standalone invoice-only invoices (`Invoice.contract_id = null`).
- Contract Detail shows the contract-linked invoices (`Invoice.contract_id = contract.id`).
- “Action required” is based on `Application.status = AMENDMENT_REQUESTED` and routes via `applicationIds` query param.
- “Review offer” stays on financing cards when offer is received (unexpired).
- KPIs are mostly computed from `Note`, `NotePaymentSchedule`, and `NotePayment`.

