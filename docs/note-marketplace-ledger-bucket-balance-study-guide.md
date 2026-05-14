# Note, Marketplace, Ledger, Bucket Balance, and Repayment Study Guide

## Table of Contents

- ## 1. Big Picture
- ## 2. Glossary
- ## 3. Important Database Models
- ## 4. Status Fields and What They Mean
- ## 5. Step-by-Step Lifecycle
- ## 6. Page-by-Page Explanation
- ## 7. Money Flow
- ## 8. Ledger and Bucket Balance
- ## 9. Issuer Dashboard and Contract Detail KPIs
- ## 10. Relationships
- ## 11. Common Confusion Explained
- ## 12. What Is Confirmed from Code
- ## 13. Needs Code/Business Confirmation
- ## 14. Final Beginner Summary

## 1. Big Picture

This guide explains the full lifecycle:

1. An **approved invoice** becomes a **Note**.
2. Admin **publishes** the Note to the **investor marketplace**.
3. Investors **invest** (commit money).
4. Admin **closes funding** (success) or **fails funding**.
5. Admin **activates** the funded Note for servicing.
6. Paymaster (or issuer on behalf) **repays**.
7. Admin **previews**, **approves**, and **posts settlement**.
8. The system creates **ledger entries** and updates **bucket balances**.
9. The Note becomes **repaid** (or goes to failed/default paths).

Simple diagram:

```
Approved Invoice
  ↓ (Admin: Turn Into Note)
Note (DRAFT)
  ↓ (Admin: Publish)
Note (PUBLISHED + funding open)
  ↓ (Investors invest)
Note funded_amount increases + NoteInvestments created
  ↓ (Admin: Close funding / Fail funding)
Note FUNDING → FUNDED (or FAILED)
  ↓ (Admin: Activate)
Note ACTIVE (servicing starts)
  ↓ (Paymaster repayment recorded)
NotePayment created + repayment ledger receipt posted
  ↓ (Admin: Settlement preview → approve → post)
NoteSettlement posted + ledger + investor balances credited
  ↓
Note REPAID + servicing SETTLED
```

## 2. Glossary

- **Issuer**: the business that owns the receivable (invoice/contract).
- **Paymaster**: the customer/obligor who repays the obligation.
- **Invoice**: the receivable document created during the application flow.
- **Note**: the investable financing instrument created from an approved Invoice.
- **NoteListing**: “marketplace visibility / listing window” row for a Note.
- **Marketplace**: investor-facing UI that lists published Notes.
- **Investment**: investor commitment to fund a Note (stored as `NoteInvestment` + investor cash movement).
- **Funding close**: admin locks the funding result and confirms investments.
- **Servicing**: after activation, admin records repayment and settlement.
- **Settlement**: admin approves and posts how the repayment is split to investors, fees, and late charges.
- **Ledger**: immutable postings to accounts (bucket model).
- **Bucket balance**: roll-up balances derived from ledger rows.

## 3. Important Database Models

The database source of truth is Prisma schema in `apps/api/prisma/schema.prisma`.

Below are the **main models used by this lifecycle** (fields are the important ones you will see in code).

| Model | Simple meaning | Who uses it | Main screen / API | Important fields |
|---|---|---|---|---|
| `Note` | Core investable instrument | Admin + investor reads | Admin note detail, investor marketplace | `id`, `source_application_id`, `source_contract_id`, `source_invoice_id` (unique), `issuer_organization_id`, `status`, `listing_status`, `funding_status`, `servicing_status`, `note_reference`, `target_amount`, `funded_amount`, `profit_rate_percent`, `platform_fee_rate_percent`, `service_fee_rate_percent`, `maturity_date`, `published_at`, `funding_closed_at`, `activated_at`, `repaid_at` |
| `NoteListing` | Marketplace visibility row for a Note | Admin + investor reads | Investor marketplace list + admin publish/unpublish | `id`, `note_id` (unique), `status`, `opens_at`, `closes_at`, `published_at`, `unpublished_at`, `visibility` |
| `NoteInvestment` | One investor’s commitment to a Note | Investor (create), Admin (confirm/release/settle) | Investor investment list, admin settlement | `id`, `note_id`, `investor_organization_id`, `investor_user_id`, `status`, `amount`, `allocation_percent`, `committed_at`, `confirmed_at`, `released_at` |
| `NotePaymentSchedule` | Expected repayment schedule | Admin | Admin note detail | `id`, `note_id`, `status`, `sequence`, `due_date`, `expected_principal`, `expected_profit`, `expected_total`, `paid_principal`, `paid_profit`, `paid_total` |
| `NotePayment` | Actual repayment receipts | Admin | Admin settlement panel | `id`, `note_id`, `schedule_id`, `source`, `status`, `receipt_amount`, `receipt_date`, `received_into_account_code`, `evidence_s3_key`, `reference`, `recorded_by_user_id`, `reconciled_by_user_id`, `reconciled_at`, `metadata` |
| `NoteSettlement` | Settlement batch + saved preview snapshot | Admin | Admin settlement panel | `id`, `note_id`, `payment_id`, `status`, `settlement_type`, `gross_receipt_amount`, `investor_principal`, `investor_profit_gross`, `service_fee_amount`, `investor_profit_net`, `tawidh_amount`, `gharamah_amount`, `issuer_residual_amount`, `preview_snapshot`, `approved_by_user_id`, `approved_at`, `posted_at`, `idempotency_key` |
| `NoteLedgerAccount` | Ledger “bucket” definition | Ledger code | Admin bucket balances | `id`, `code` (unique), `name`, `type`, `currency`, `is_system` |
| `NoteLedgerEntry` | Immutable ledger postings | Ledger code + admin reads | Admin ledger panel + bucket balances | `id`, `note_id`, `account_id`, `settlement_id`, `payment_id`, `direction`, `amount`, `description`, `idempotency_key` (unique), `posted_at`, `metadata` |
| `NoteEvent` | Timeline/audit event log | Admin UI | Admin note timeline | `id`, `note_id`, `event_type`, `actor_user_id`, `actor_role`, `portal`, `correlation_id`, `metadata` |
| `NoteAdminAction` | Admin action log (before/after) | Admin UI | Admin note timeline/audit | `id`, `note_id`, `action_type`, `actor_user_id`, `reason`, `before_state`, `after_state`, `correlation_id` |
| `WithdrawalInstruction` | Withdrawal instruction (letter + status) | Admin | Admin withdrawals | `id`, `note_id`, `investor_organization_id`, `issuer_organization_id`, `status`, `withdrawal_type`, `amount`, `letter_s3_key`, `generated_at`, `submitted_to_trustee_at` |
| `InvestorBalance` | Investor available cash | Investor UI + backend | Investor portfolio pages | `id`, `investor_organization_id` (unique), `available_amount` |
| `InvestorBalanceTransaction` | Investor cash movements (audit) | Investor UI + backend | Investor balance activity | `id`, `investor_organization_id`, `direction`, `amount`, `source`, `note_id`, `note_investment_id`, `idempotency_key` (unique), `posted_at` |

## 4. Status Fields and What They Mean

The system uses **multiple status fields** on `Note`.

### 4.1 Note status enums (from Prisma)

#### `Note.status` (`NoteStatus`)

| Status | Simple meaning | When it happens (high level) | Which page shows it |
|---|---|---|---|
| `DRAFT` | Draft note (not published) | After creation (`Turn Into Note`) | Admin notes registry/detail |
| `PUBLISHED` | Marketplace listing is published | After Admin “Publish” | Investor marketplace list |
| `FUNDING` | Funding process locked/closing | After Admin “Close funding” | Admin note detail |
| `ACTIVE` | Servicing started | After Admin “Activate” | Issuer note servicing views |
| `REPAID` | Repayment completed successfully | After Admin posts settlement | Investor investment history |
| `ARREARS` | Missed payment / arrears state | After overdue checks (servicing logic) | Admin note detail |
| `DEFAULTED` | Default marked by admin | When admin marks default | Admin note detail |
| `FAILED_FUNDING` | Funding attempt failed | After Admin “Fail funding” | Admin notes + issuer dashboard |
| `CANCELLED` | Cancelled note (enum exists) | **Needs code/business confirmation** | — |

#### `Note.listing_status` (`NoteListingStatus`)

| Status | Simple meaning | When it happens | Which page shows it |
|---|---|---|---|
| `NOT_LISTED` | No listing | Initial note state | Admin |
| `DRAFT` | Listing draft | During draft/prepare | Admin |
| `PUBLISHED` | Listed and visible | After Admin “Publish” | Investor marketplace |
| `UNPUBLISHED` | Hidden | After Admin “Unpublish” | Admin |
| `CLOSED` | Listing window closed | After Admin close/fail funding | Admin |

#### `Note.funding_status` (`NoteFundingStatus`)

| Status | Simple meaning | When it happens | Which page shows it |
|---|---|---|---|
| `NOT_OPEN` | Funding not open | Initial note | Admin |
| `OPEN` | Funding open for investments | After publish | Investor marketplace |
| `FUNDED` | Funding threshold met (locked) | After close funding | Admin |
| `FAILED` | Funding failed (investors released/refunded) | After fail funding | Admin |
| `CLOSED` | Funding closed (no more commits) | When close/fail sets listing closed | Admin |

#### `Note.servicing_status` (`NoteServicingStatus`)

| Status | Simple meaning | When it happens | Which page shows it |
|---|---|---|---|
| `NOT_STARTED` | Servicing not started | Before activation | Admin |
| `CURRENT` | Normal servicing | After activation | Admin |
| `PARTIAL` | Partial payment situation (enum exists) | **Needs code/business confirmation** | Admin |
| `ADVANCE_PAID` | Advance payment situation (enum exists) | **Needs code/business confirmation** | Admin |
| `LATE` | Payment is late (grace passed) | After overdue/late charge checks | Admin |
| `ARREARS` | Past arrears threshold | After overdue checks | Admin |
| `DEFAULTED` | Default state | After admin “mark default” | Admin |
| `SETTLED` | Settlement completed (repayment final) | After settlement posted | Admin + issuer dashboard |

### 4.2 Investment/payment/settlement enums

#### `NoteInvestment.status` (`NoteInvestmentStatus`)

| Status | Simple meaning | When it happens | Which page shows it |
|---|---|---|---|
| `COMMITTED` | Investor committed (created during investment) | Investor invests | Admin list / investor investment list |
| `CONFIRMED` | Funding close locked | Admin close funding | Admin |
| `RELEASED` | Investor funds returned because funding failed | Admin fail funding | Investor balance activity |
| `CANCELLED` | **Enum exists, not used in inspected paths** | Needs confirmation | — |
| `SETTLED` | Settlement posted payout allocation done | After settlement posted | Admin + investor |

#### `NotePaymentSchedule.status`

Uses `NotePaymentStatus` enum too.

#### `NotePayment.status` (`NotePaymentStatus`)

| Status | Simple meaning | When it happens | Which page shows it |
|---|---|---|---|
| `PENDING` | Awaiting admin reconciliation | Issuer-on-behalf payment submitted (requires admin) | Admin settlement panel |
| `PARTIAL` | Partial payment (enum exists) | **Needs code/business confirmation** | Admin |
| `RECEIVED` | Payment receipt accepted/reconciled | After recording (if no admin review) or after admin approve | Admin + investor activity |
| `RECONCILED` | Reconciled state (enum exists) | **Needs code/business confirmation** | Admin |
| `SETTLED` | Settled payment schedule (enum exists) | **Needs code/business confirmation** | Admin |
| `VOID` | Rejected/voided | Admin reject payment | Admin |

#### `NoteSettlement.status` (`NoteSettlementStatus`)

| Status | Simple meaning | When it happens | Which page shows it |
|---|---|---|---|
| `PREVIEW` | Preview created (not posted) | Admin “preview settlement” | Admin settlement panel |
| `APPROVED` | Admin approved preview | Admin approval step | Admin |
| `POSTED` | Settlement posted and ledger applied | Admin “post settlement” | Admin + ledger derived |
| `VOID` | Cancelled/void settlement (enum exists) | **Needs code/business confirmation** | Admin |

#### `NoteSettlementType` (`NoteSettlementType`)

| Status | Simple meaning | When it happens | Which page shows it |
|---|---|---|---|
| `STANDARD` | Normal settlement | No late fee/tawidh/gharamah amounts | Admin |
| `PARTIAL` | Partial settlement type | **Needs code/business confirmation** | Admin |
| `ADVANCE` | Advance settlement type | **Needs code/business confirmation** | Admin |
| `LATE` | Late settlement type | When `tawidhAmount > 0` or `gharamahAmount > 0` | Admin |
| `DEFAULT_RECOVERY` | Default recovery type | **Needs code/business confirmation** | Admin |

### 4.3 Ledger enums

#### `NoteLedgerAccount.type` (`NoteLedgerAccountType`)

| Account code | Simple meaning |
|---|---|
| `INVESTOR_POOL` | Bucket that holds investor principal and investor profit |
| `REPAYMENT_POOL` | Bucket that holds repayment receipts before settlement |
| `OPERATING_ACCOUNT` | Bucket that holds platform/service fee income |
| `TAWIDH_ACCOUNT` | Bucket for late fee ta'widh component |
| `GHARAMAH_ACCOUNT` | Bucket for late charge gharamah component |

#### `NoteLedgerEntry.direction` (`NoteLedgerDirection`)

| Direction | Meaning in this codebase |
|---|---|
| `CREDIT` | Money goes into the bucket |
| `DEBIT` | Money goes out of the bucket |

### 4.4 Differences (simple explanations)

- `Note.status` vs `Note.funding_status`
  - `Note.status` is the main lifecycle: `DRAFT`, `PUBLISHED`, `ACTIVE`, `REPAID`, etc.
  - `Note.funding_status` is specifically about “funding open/closed and success/fail”.
- `Note.status` vs `Note.servicing_status`
  - `Note.status` tells “active/repaid/defaulted”.
  - `Note.servicing_status` tells “late/arrears/current/settled” during repayment servicing.
- `Note.listing_status` vs `NoteListing.status`
  - `Note.listing_status` is copied to the Note row and used by the APIs.
  - `NoteListing.status` is the row in `note_listings` relation.
- `NotePaymentSchedule.status` vs `NotePayment.status`
  - `NotePaymentSchedule` is expected schedule rows (due date + expected amounts).
  - `NotePayment` is real received payment rows (receipt evidence, receipt date, etc.).
- `NoteSettlement.status` vs `Note.status`
  - `NoteSettlement` is the settlement workflow state (preview/approved/posted).
  - `Note.status` becomes `REPAID` (and servicing SETTLED) after settlement is posted.
- Ledger debit/credit vs business meaning
  - Ledger direction (debit/credit) is accounting math.
  - Business meaning comes from the account code (Investor Pool, Repayment Pool, etc.) and the description/idempotency key.

## 5. Step-by-Step Lifecycle

In this section, each step shows:
1. Real-life story
2. User action / system action
3. Pages affected
4. Tables created
5. Tables updated
6. Status changes
7. Confirmed from code
8. Needs code/business confirmation

Fake example used everywhere:

- Issuer: ABC Supplier Sdn Bhd
- Customer / Debtor / Paymaster: Petronas Chemical Bhd
- Invoice: INV-1001
- Invoice value: RM10,000
- Financing amount / Note target amount: RM8,000
- Note: NOTE-0001
- Investor A invests RM6,000
- Investor B invests RM2,000
- Minimum funding percent: 80%
- Repayment amount: RM8,500
- Principal: RM8,000
- Profit: RM500

> NOTE: Many “money movement” steps in this codebase are recorded in ledger tables only at activation and settlement, and in investor cash balance tables at commit/release.

## Step 1 — Invoice approved / signed / ready for Note

### 1. Real-life story
This is a **pre-condition** step: an Invoice (and its Application) must already be approved/completed so Admin can create a Note.

### 2. User action / system action
Issuer approves the invoice offer and completes the application flow (the exact UI/button is outside the Note module).

### 3. Pages affected
- Admin pages: later (note creation becomes possible)
- No marketplace/ledger changes yet

### 4. Tables created
None in the Note lifecycle itself.

### 5. Tables updated
None in the Note module. If pre-conditions are not met, Note creation throws an error.

### 6. Status changes
This guide focuses on the Note flow; invoice/application status changes happen earlier in the application/invoice modules.

### 7. Confirmed from code
- `createFromInvoice()` allows Note creation only when `invoice.status === InvoiceStatus.APPROVED`.
- `createFromApplication()` allows Note creation only when `application.status === ApplicationStatus.COMPLETED` and the selected invoice has `InvoiceStatus.APPROVED`.

### 8. Needs code/business confirmation
- “Signed” is not validated by Note creation code itself (based on inspected Note code). If the business rule requires the signed document, that rule is likely enforced in the invoice/application modules (Needs code/business confirmation).

## Step 2 — Admin clicks “Turn Into Note”

### 1. Real-life story
Admin sees an approved invoice row in the Notes Registry and clicks “Turn Into Note”.

### 2. User action / system action
UI button “Turn Into Note” calls backend endpoint `POST /from-invoice/:invoiceId`.

### 3. Pages affected
- Admin Note Registry: `apps/admin/src/app/notes/page.tsx`
- Admin Note detail: opens `/notes/[id]` after creation

### 4. Tables created
| Table/model | Example row | Simple meaning |
|---|---|---|
| `notes` | `NOTE-0001` | New draft Note created from approved invoice |
| `note_payment_schedules` | seq=1 | Expected repayment schedule created |
| `note_events` | `NOTE_CREATED_FROM_INVOICE` | Timeline/audit event created |
| `note_admin_actions` | `CREATE_FROM_INVOICE` | Admin action log created |

### 5. Tables updated
| Table/model | Fields updated | Example value | Simple meaning |
|---|---|---|---|
| *(none in inspected code path)* | | | |

### 6. Status changes
| Model | Field | Before | After |
|---|---|---|---|
| `Note` | `status` | *(does not exist yet)* | `DRAFT` (default) |
| `Note` | `listing_status` | *(does not exist yet)* | `NOT_LISTED` (default) |
| `Note` | `funding_status` | *(does not exist yet)* | `NOT_OPEN` (default) |
| `Note` | `servicing_status` | *(does not exist yet)* | `NOT_STARTED` (default) |

### 7. Confirmed from code
- Notes Registry source invoice table shows “Turn Into Note” only when the invoice doesn’t already have a note.
- Backend Note creation creates `Note` + `NotePaymentSchedule` and logs `NoteEvent` and `NoteAdminAction`.

### 8. Needs code/business confirmation
- None for this step.

## Step 3 — Note row is created

### 1. Real-life story
The system copies invoice/application/contract snapshot data into the Note so it stays stable for marketplace + accounting.

### 2. User action / system action
Triggered inside Note creation transaction.

### 3. Pages affected
- Admin Note detail will show it after creation

### 4. Tables created
| Table/model | Example row | Simple meaning |
|---|---|---|
| `notes` | `id = NOTE-0001` | New Note created from approved Invoice |
| `note_payment_schedules` | `note_id = NOTE-0001, sequence = 1` | Expected repayment schedule created |
| `note_events` | `event_type = NOTE_CREATED_FROM_INVOICE` | Timeline/audit event created |
| `note_admin_actions` | `action_type = CREATE_FROM_INVOICE` | Admin action log created |

### 5. Tables updated
| Table/model | Fields updated | Example value | Simple meaning |
|---|---|---|---|
| *(none)* | | | |

### 6. Status changes
| Model | Field | Before | After |
|---|---|---|---|
| `Note` | `status/listing_status/funding_status/servicing_status` | — | defaults to `DRAFT/NOT_LISTED/NOT_OPEN/NOT_STARTED` |

### 7. Confirmed from code
Important linkage fields written on Note:
- `Note.source_application_id`
- `Note.source_invoice_id` (unique)
- `Note.source_contract_id = invoice.contract_id ?? application.contract_id`

### 8. Needs code/business confirmation
- None.

## Step 4 — Note Detail page shows the new Note

### 1. Real-life story
Admin opens the Note detail screen to review terms and start listing.

### 2. User action / system action
UI navigates to `/notes/[id]` which fetches note detail using `GET /admin/notes/:id`.

### 3. Pages affected
- Admin Note detail

### 4. Tables created
| Table/model | Example row | Simple meaning |
|---|---|---|
| *(none)* | | |

### 5. Tables updated
| Table/model | Fields updated | Example value | Simple meaning |
|---|---|---|---|
| *(none)* | | | |

### 6. Status changes
| Model | Field | Before | After |
|---|---|---|---|
| *(none)* | | | |

### 7. Confirmed from code
- Note detail page uses hooks to load note data; ledger and settlement panels are just reads.

### 8. Needs code/business confirmation
- None.

## Step 5 — Admin publishes Note

### 1. Real-life story
Admin makes the Note visible to investors and opens the funding window.

### 2. User action / system action
Admin clicks “Publish”.
Backend: `publish(id)` updates Note and NoteListing.

### 3. Pages affected
- Admin Note detail
- Investor marketplace (after this, read endpoints show it)

### 4. Tables created
| Table/model | Example row | Simple meaning |
|---|---|---|
| `note_listings` | created if missing | Listing metadata row |

### 5. Tables updated
| Table/model | Fields updated | Example value | Simple meaning |
|---|---|---|---|
| `notes` | `status`, `listing_status`, `funding_status`, `published_at` | `PUBLISHED/OPEN` | Opens marketplace investing |
| `note_listings` | `status`, `published_at`, `unpublished_at` | `PUBLISHED` | Listing visibility |

### 6. Status changes
| Model | Field | Before | After |
|---|---|---|---|
| `Note` | `status` | `DRAFT` | `PUBLISHED` |
| `Note` | `funding_status` | `NOT_OPEN` | `OPEN` |
| `Note` | `listing_status` | `NOT_LISTED/DRAFT/UNPUBLISHED` | `PUBLISHED` |

### 7. Confirmed from code
- Fees are capped on publish: platform fee rate <= 3%, service fee rate <= 15.

### 8. Needs code/business confirmation
- None.

## Step 6 — NoteListing is created/updated

### 1. Real-life story
The “marketplace listing” row becomes `PUBLISHED` so the marketplace query can find the note.

### 2. User action / system action
Same as Step 5 publish.

### 3. Pages affected
- Admin Note detail
- Investor marketplace list

### 4. Tables created
| Table/model | Example row | Simple meaning |
|---|---|---|
| `note_listings` | (upsert create) | Listing row |

### 5. Tables updated
| Table/model | Fields updated | Example value | Simple meaning |
|---|---|---|---|
| `note_listings` | `status`, `published_at`, `unpublished_at` | `PUBLISHED`, `null` | Listing visibility |

### 6. Status changes
| Model | Field | Before | After |
|---|---|---|---|
| `NoteListing` | `status` | `DRAFT/UNPUBLISHED/NOT_LISTED` | `PUBLISHED` |

### 7. Confirmed from code
- `publish()` uses `listing: upsert`.

### 8. Needs code/business confirmation
- None.

## Step 7 — Note appears in investor Marketplace

### 1. Real-life story
Investors can see the Note in the marketplace and click Invest.

### 2. User action / system action
No button in admin; investors just load lists.
Backend query filters:
- `Note.status = PUBLISHED`
- `Note.listing_status = PUBLISHED`
- `Note.funding_status = OPEN`

### 3. Pages affected
- Investor marketplace list

### 4. Tables created
| Table/model | Example row | Simple meaning |
|---|---|---|
| *(none)* | | |

### 5. Tables updated
| Table/model | Fields updated | Example value | Simple meaning |
|---|---|---|---|
| *(none)* | | | |

### 6. Status changes
| Model | Field | Before | After |
|---|---|---|---|
| *(none)* | | | |

### 7. Confirmed from code
- `getMarketplaceNoteDetail()` requires the same publish/open filters.

### 8. Needs code/business confirmation
- None.

## Step 8 — Investor invests

### 1. Real-life story
Investor commits money to the Note during the open funding window.

### 2. User action / system action
Investor clicks “Invest” on marketplace card.
Backend: `createInvestment(noteId, investorOrganizationId, amount)`

### 3. Pages affected
- Investor marketplace
- Investor investments page/list
- Investor balance activity (cash OUT)

### 4. Tables created
| Table/model | Example row | Simple meaning |
|---|---|---|
| `note_investments` | status defaults to `COMMITTED` | Investor commitment row |
| `investor_balance_transactions` | direction `OUT` | Cash leaving investor available balance |

### 5. Tables updated
| Table/model | Fields updated | Example value | Simple meaning |
|---|---|---|---|
| `notes` | `funded_amount += amount` | funded_amount increases | Stores funding progress |
| `investor_balances` | `available_amount -= amount` | decreased by RM6,000 | Investor spendable cash reduced |
| *(optional)* `investor_balances` | created via upsert | initial 0 → then decrement | Ensures row exists |

### 6. Status changes
| Model | Field | Before | After |
|---|---|---|---|
| `NoteInvestment` | `status` | *(new)* | `COMMITTED` |
| `Note` | `funded_amount` | X | X + investAmount |

### 7. Confirmed from code
- Investment requires investor org `deposit_received = true`.
- Investment requires `Note.status=PUBLISHED` and `Note.funding_status=OPEN`.
- It also checks remaining capacity and minimum commitment size.

### 8. Needs code/business confirmation
- None for this step.

## Step 9 — NoteInvestment row is created

### 1. Real-life story
Each investor commitment becomes a row so admin can later confirm or release it.

### 2. User action / system action
Created during `createInvestment()`.

### 3. Pages affected
- Admin note detail (investments list)
- Investor investments list

### 4. Tables created
| Table/model | Example row | Simple meaning |
|---|---|---|
| `note_investments` | amount + allocation_percent | One row per investor |

### 5. Tables updated
| Table/model | Fields updated | Example value | Simple meaning |
|---|---|---|---|
| *(see Step 8)* | | | |

### 6. Status changes
| Model | Field | Before | After |
|---|---|---|---|
| `NoteInvestment` | `status` | — | `COMMITTED` |

### 7. Confirmed from code
- `allocation_percent = (investAmount / target_amount) * 100`.

### 8. Needs code/business confirmation
- None.

## Step 10 — Note.funded_amount changes

### 1. Real-life story
Funding progress increases as investors commit.

### 2. User action / system action
Happens inside `createInvestment()`:
- `notes.funded_amount` increments

### 3. Pages affected
- Investor marketplace card (funded percent display)
- Admin note detail

### 4. Tables created
| Table/model | Example row | Simple meaning |
|---|---|---|
| *(none)* | | |

### 5. Tables updated
| Table/model | Fields updated | Example value | Simple meaning |
|---|---|---|---|
| `notes` | `funded_amount += amount` | `8,000 → 8,000+` | Tracks funding progress |

### 6. Status changes
| Model | Field | Before | After |
|---|---|---|---|
| `Note` | `funded_amount` | previous | increased |

### 7. Confirmed from code
- Increment uses `updateMany` with a capacity condition to reduce race risk.

### 8. Needs code/business confirmation
- None.

## Step 11 — Funding progress is calculated

### 1. Real-life story
UI shows “funded percent”.

### 2. User action / system action
Calculated as:
`funded_percent = (funded_amount / target_amount) * 100`

### 3. Pages affected
- Admin note rows / tables
- Investor marketplace cards

### 4. Tables created
| Table/model | Example row | Simple meaning |
|---|---|---|
| *(none)* | | |

### 5. Tables updated
| Table/model | Fields updated | Example value | Simple meaning |
|---|---|---|---|
| *(none)* | | | |

### 6. Status changes
| Model | Field | Before | After |
|---|---|---|---|
| *(none)* | | | |

### 7. Confirmed from code
- Issuer dashboard uses `fundingProgressPercent()` with rounding and clamps.
- Marketplace and admin UI uses `funded_amount` and `target_amount` too.

### 8. Needs code/business confirmation
- None.

## Step 12 — Funding reaches minimum funding percent

### 1. Real-life story
Admin checks if funding is >= min success percent (example: 80%).

### 2. User action / system action
Admin clicks Close Funding (success path) only if minimum is met.

### 3. Pages affected
- Admin note detail

### 4. Tables created
| Table/model | Example row | Simple meaning |
|---|---|---|
| *(none)* | | |

### 5. Tables updated
| Table/model | Fields updated | Example value | Simple meaning |
|---|---|---|---|
| *(checked only)* | | | |

### 6. Status changes
| Model | Field | Before | After |
|---|---|---|---|
| *(none yet)* | | | |

### 7. Confirmed from code
- `closeFunding()` compares:
  - `fundingPercent >= minimum_funding_percent`

### 8. Needs code/business confirmation
- None.

## Step 13 — Funding closes successfully

### 1. Real-life story
Admin confirms funding succeeded and locks investments for activation.

### 2. User action / system action
Admin clicks “Close Funding”.

### 3. Pages affected
- Admin note detail
- Investor marketplace stops accepting new investments (funding window closes)

### 4. Tables created
| Table/model | Example row | Simple meaning |
|---|---|---|
| *(none)* | | |

### 5. Tables updated
| Table/model | Fields updated | Example value | Simple meaning |
|---|---|---|---|
| `notes` | `status`, `funding_status`, `listing_status`, `funding_closed_at` | `FUNDING/FUNDED/CLOSED` | Locks funding result |
| `note_investments` | `status`, `confirmed_at` | `COMMITTED → CONFIRMED` | Marks investors confirmed |

### 6. Status changes
| Model | Field | Before | After |
|---|---|---|---|
| `Note` | `status` | `PUBLISHED` | `FUNDING` |
| `Note` | `funding_status` | `OPEN` | `FUNDED` |
| `NoteListing` | `status` | `PUBLISHED` | `CLOSED` |
| `NoteInvestment` | `status` | `COMMITTED` | `CONFIRMED` |

### 7. Confirmed from code
- Close funding updates `Note.status` to `FUNDING`, `funding_status` to `FUNDED`, and `listing_status` to `CLOSED`.

### 8. Needs code/business confirmation
- None.

## Step 14 — Funding fails

### 1. Real-life story
Funding did not meet minimum. Investors are released/refunded, and the note is marked failed funding.

### 2. User action / system action
Admin clicks “Fail Funding”.

### 3. Pages affected
- Admin note detail
- Investor balance activity (cash IN to investors)
- Investor investments list (investments become released)

### 4. Tables created
| Table/model | Example row | Simple meaning |
|---|---|---|
| `investor_balance_transactions` | direction `IN`, source `NOTE_INVESTMENT_RELEASE` | Investor refund/release ledger for balances |

### 5. Tables updated
| Table/model | Fields updated | Example value | Simple meaning |
|---|---|---|---|
| `notes` | `status`, `funding_status`, `listing_status` | `FAILED_FUNDING/FAILED/CLOSED` | Mark funding failure |
| `note_investments` | `status`, `released_at` | `COMMITTED → RELEASED` | Mark investor allocations released |
| `investor_balances` | `available_amount += amount` | increased | Investor spendable cash restored |

### 6. Status changes
| Model | Field | Before | After |
|---|---|---|---|
| `Note` | `status` | `PUBLISHED` | `FAILED_FUNDING` |
| `Note` | `funding_status` | `OPEN` | `FAILED` |
| `NoteInvestment` | `status` | `COMMITTED` | `RELEASED` |

### 7. Confirmed from code
- `failFunding()` only allows notes below minimum threshold to fail.
- It credits investor balances using `creditInvestorBalance()` inside transaction.

### 8. Needs code/business confirmation
- Ledger/bucket balances: fail funding does not call `postPaymentReceiptLedger` or `postDisbursementLedger`. Bucket balances should not move in ledger terms. Confirm if business expects bucket movement here (Needs code/business confirmation).

## Step 15 — Note activates

### 1. Real-life story
Admin starts servicing after the funding result is successful.

### 2. User action / system action
Admin clicks “Activate”.
Backend: `activate(id)` sets `Note.status=ACTIVE` and calls `postDisbursementLedger()`.

### 3. Pages affected
- Admin note detail
- Investor / issuer servicing views (note is now active)
- Admin ledger panel (ledger entries appear)

### 4. Tables created
| Table/model | Example row | Simple meaning |
|---|---|---|
| `note_ledger_entries` | `INVESTOR_POOL` debit, `OPERATING_ACCOUNT` credit | Ledger posting for disbursement/platform fee |

### 5. Tables updated
| Table/model | Fields updated | Example value | Simple meaning |
|---|---|---|---|
| `notes` | `status`, `servicing_status`, `activated_at` | `ACTIVE/CURRENT` | Starts servicing |

### 6. Status changes
| Model | Field | Before | After |
|---|---|---|---|
| `Note` | `status` | `FUNDING` | `ACTIVE` |
| `Note` | `servicing_status` | `NOT_STARTED` | `CURRENT` |

### 7. Confirmed from code
- `postDisbursementLedger()` creates ledger entries:
  - `INVESTOR_POOL` **DEBIT**
  - `OPERATING_ACCOUNT` **CREDIT** (platform fee)

### 8. Needs code/business confirmation
- Actual “payout/disbursement to issuer”:
  - This code posts only platform-fee movement between `INVESTOR_POOL` and `OPERATING_ACCOUNT`.
  - It does not show a ledger entry that credits an issuer/residual bucket.
  - Confirm where the issuer payout is tracked (Needs code/business confirmation).

## Step 16 — Disbursement / payout

### 1. Real-life story
Issuer should receive funds (or at least the platform books it).

### 2. User action / system action
This happens during activation.

### 3. Pages affected
- Admin note detail
- Admin ledger panel (shows fee-related entries)

### 4. Tables created
| Table/model | Example row | Simple meaning |
|---|---|---|
| `note_ledger_entries` | (see Step 15) | Ledger postings for disbursement |

### 5. Tables updated
| Table/model | Fields updated | Example value | Simple meaning |
|---|---|---|---|
| `notes` | servicing fields | — | Activation already covers it |

### 6. Status changes
| Model | Field | Before | After |
|---|---|---|---|
| *(already in Step 15)* | | | |

### 7. Confirmed from code
- Ledger postings occur at activation via `postDisbursementLedger()`.

### 8. Needs code/business confirmation
- Whether issuer payout to ABC Supplier is tracked in ledger in this version (Needs confirmation).

## Step 17 — Repayment schedule is created

### 1. Real-life story
The system prepares expected repayment schedule for admin to compare against received payments.

### 2. User action / system action
Created during “Turn Into Note” (note creation), not during activation.

### 3. Pages affected
- Admin note detail (schedule section)

### 4. Tables created
| Table/model | Example row | Simple meaning |
|---|---|---|
| `note_payment_schedules` | `sequence=1`, due_date=maturity_date | Expected principal/profit/total |

### 5. Tables updated
| Table/model | Fields updated | Example value | Simple meaning |
|---|---|---|---|
| *(none in inspected paths)* | | | |

### 6. Status changes
| Model | Field | Before | After |
|---|---|---|---|
| `NotePaymentSchedule` | `status` | — | defaults to `PENDING` |

### 7. Confirmed from code
- `createFromInvoiceSource()` creates exactly one schedule row with:
  - `expected_principal = note.target_amount`
  - `expected_profit` computed from `profit_rate_percent`
  - `expected_total = expected_principal + expected_profit`

### 8. Needs code/business confirmation
- The code we inspected does not update `paid_principal/paid_profit/paid_total` fields anywhere. Confirm if schedule “paid amounts” are intentionally not implemented (Needs confirmation).

## Step 18 — Actual repayment is received

### 1. Real-life story
Paymaster (or issuer on behalf) sends money. Admin records a repayment receipt.

### 2. User action / system action
- Admin records repayment in settlement panel OR
- Issuer submits “on behalf of paymaster” payment (admin review required in code)

Backend: `recordPayment(id, input, actor)`

### 3. Pages affected
- Admin note detail settlement panel
- Investor activity list (after settlement posted)

### 4. Tables created
| Table/model | Example row | Simple meaning |
|---|---|---|
| `note_payments` | status `RECEIVED` or `PENDING` | Receipt record |
| `note_ledger_entries` | credit `REPAYMENT_POOL` | Posted repayment receipt ledger (only when status becomes RECEIVED) |

### 5. Tables updated
| Table/model | Fields updated | Example value | Simple meaning |
|---|---|---|---|
| `notes` | *(not updated in this function)* | | |

### 6. Status changes
| Model | Field | Before | After |
|---|---|---|---|
| `NotePayment` | `status` | — | `RECEIVED` or `PENDING` |

### 7. Confirmed from code
- If `requiresAdminReview` is false, `recordPayment()` sets `NotePayment.status = RECEIVED` and calls `postPaymentReceiptLedger()`.
- `postPaymentReceiptLedger()` credits the `REPAYMENT_POOL` ledger account and uses an idempotency key `payment:${payment.id}:receipt`.

### 8. Needs code/business confirmation
- Whether repayment receipt should always require admin reconciliation in the business rules (Code currently allows direct RECEIVED for paymaster repayments) (Needs confirmation).

## Step 19 — Payment is reconciled / confirmed

### 1. Real-life story
Admin checks the repayment receipt and either approves it or voids it.

### 2. User action / system action
Admin clicks approve or reject in payment list.

Backend:
- Approve: `approvePayment(id, paymentId)`
- Reject: `rejectPayment(id, paymentId, reason)`

### 3. Pages affected
- Admin note detail settlement panel

### 4. Tables created
| Table/model | Example row | Simple meaning |
|---|---|---|
| *(none new beyond timeline logs already created)* | | |

### 5. Tables updated
| Table/model | Fields updated | Example value | Simple meaning |
|---|---|---|---|
| `note_payments` | `status`, `reconciled_at`, `reconciled_by_user_id`, `metadata` | `PENDING → RECEIVED` or `VOID` | Reconciliation result |

### 6. Status changes
| Model | Field | Before | After |
|---|---|---|---|
| `NotePayment` | `status` | `PENDING` | `RECEIVED` (approve) |
| `NotePayment` | `status` | `PENDING` | `VOID` (reject) |

### 7. Confirmed from code
- Approve sets status `RECEIVED` and then posts receipt ledger again (upsert).
- Reject sets status `VOID` and writes `rejectionReason` into payment metadata.

### 8. Needs code/business confirmation
- None.

## Step 20 — Settlement preview is created

### 1. Real-life story
Admin previews how repayment will split among investors, fees, ta'widh, gharamah, and issuer residual.

### 2. User action / system action
Admin clicks “Preview settlement”.
Backend: `previewSettlement(id, input, actor)`

### 3. Pages affected
- Admin note detail settlement panel

### 4. Tables created
| Table/model | Example row | Simple meaning |
|---|---|---|
| `note_settlements` | status `PREVIEW` | Preview batch and snapshot |
| `note_events` | `SETTLEMENT_PREVIEWED` | Timeline event |

### 5. Tables updated
| Table/model | Fields updated | Example value | Simple meaning |
|---|---|---|---|
| *(none)* | | | |

### 6. Status changes
| Model | Field | Before | After |
|---|---|---|---|
| `NoteSettlement` | `status` | — | `PREVIEW` |

### 7. Confirmed from code
- Settlement type becomes `LATE` if `tawidhAmount > 0` OR `gharamahAmount > 0`.
- Preview snapshot is stored in `NoteSettlement.preview_snapshot`.

### 8. Needs code/business confirmation
- None.

## Step 21 — Settlement is approved

### 1. Real-life story
Admin approves the preview.

### 2. User action / system action
Admin clicks “Approve settlement”.
Backend: `approveSettlement(id, settlementId, actor)`

### 3. Pages affected
- Admin note detail settlement panel

### 4. Tables created
| Table/model | Example row | Simple meaning |
|---|---|---|
| *(none)* | | |

### 5. Tables updated
| Table/model | Fields updated | Example value | Simple meaning |
|---|---|---|---|
| `note_settlements` | `status`, `approved_by_user_id`, `approved_at` | `PREVIEW → APPROVED` | Locks preview for posting |

### 6. Status changes
| Model | Field | Before | After |
|---|---|---|---|
| `NoteSettlement` | `status` | `PREVIEW` | `APPROVED` |

### 7. Confirmed from code
- Approve requires:
  - settlement is PREVIEW
  - `assertRepaymentReceiptLedgerComplete()` passes (full settlement amount must be in repayment receipt ledger)

### 8. Needs code/business confirmation
- None.

## Step 22 — Settlement is posted

### 1. Real-life story
Admin posts settlement. The system writes ledger entries and credits investor balances.

### 2. User action / system action
Admin clicks “Post settlement”.
Backend: `postSettlement(id, settlementId, actor)`

### 3. Pages affected
- Admin note detail (settlement status changes)
- Admin ledger panel (new entries appear)
- Investor balance activity (cash IN)
- Investor investment list (now “settled”)

### 4. Tables created
| Table/model | Example row | Simple meaning |
|---|---|---|
| `note_ledger_entries` | multiple bucket postings | Ledger postings from settlement waterfall |
| `investor_balance_transactions` | direction `IN` | Investor payout releases |

### 5. Tables updated
| Table/model | Fields updated | Example value | Simple meaning |
|---|---|---|---|
| `note_settlements` | `status`, `posted_at`, `idempotency_key` | `POSTED` | Settlement is finalized |
| `notes` | `status`, `servicing_status`, `repaid_at` | `REPAID/SETTLED` | Note lifecycle ends |
| `note_investments` | `status` | `SETTLED` | Each investor allocation finalized |
| `investor_balances` | `available_amount += allocation` | increased | Investors can withdraw / use cash |

### 6. Status changes
| Model | Field | Before | After |
|---|---|---|---|
| `NoteSettlement` | `status` | `APPROVED` | `POSTED` |
| `Note` | `status` | `ACTIVE` (or funded state) | `REPAID` |
| `Note` | `servicing_status` | not settled | `SETTLED` |
| `NoteInvestment` | `status` | `CONFIRMED` | `SETTLED` |

### 7. Confirmed from code
- Posting creates ledger entries with:
  - repayment receipt credit to `REPAYMENT_POOL` (if not already posted)
  - repaymentPool debits for principal/profit/service/tawidh/gharamah/issuer_residual_amount
  - investorPool credits for principal/profit
  - operating credit for service fee
  - tawidh/gharamah credits for late fee components
- It credits investor balances with `source = NOTE_INVESTMENT_RELEASE`.

### 8. Needs code/business confirmation
- None.

## Step 23 — Ledger entries are created

### 1. Real-life story
Ledger becomes the “source of truth” for bucket balances and audit.

### 2. User action / system action
Created during:
- Step 15 activation disbursement ledger
- Step 18 payment receipt ledger
- Step 22 settlement posting ledger

### 3. Pages affected
- Admin ledger panel
- Admin bucket balances

### 4. Tables created
| Table/model | Example row | Simple meaning |
|---|---|---|
| `note_ledger_entries` | `idempotency_key = settlement:<id>:<key>` | Immutable postings |

### 5. Tables updated
| Table/model | Fields updated | Example value | Simple meaning |
|---|---|---|---|
| *(none)* | | | |

### 6. Status changes
| Model | Field | Before | After |
|---|---|---|---|
| *(ledger rows are created, not “status changes”)* | | | |

### 7. Confirmed from code
- Ledger entries are created using `NoteLedgerEntry.create()` in activation and settlement, and `upsert()` for payment receipt.

### 8. Needs code/business confirmation
- None.

## Step 24 — Bucket Balance changes

### 1. Real-life story
Bucket balances are recalculated from ledger.

### 2. User action / system action
Admin opens “Bucket Balances” page or bucket activity page.
API computes balances by summing ledger credits and debits.

### 3. Pages affected
- Admin `/finance/buckets` and bucket activity pages

### 4. Tables created
| Table/model | Example row | Simple meaning |
|---|---|---|
| *(none)* | | |

### 5. Tables updated
| Table/model | Fields updated | Example value | Simple meaning |
|---|---|---|---|
| *(none)* | | | |

### 6. Status changes
| Model | Field | Before | After |
|---|---|---|---|
| *(none)* | | | |

### 7. Confirmed from code
- Bucket balance = `sum(credit) - sum(debit)` per account code.
- `apps/api/src/modules/notes/service.ts::listLedgerBucketBalances()` computes it on the fly.

### 8. Needs code/business confirmation
- None.

## Step 25 — Investor investment becomes settled/released

### 1. Real-life story
After settlement posting, the investor’s commitment becomes “settled” and their cash balance becomes spendable.

### 2. User action / system action
Happens during post settlement.

### 3. Pages affected
- Investor investment list
- Investor balance activity

### 4. Tables created
| Table/model | Example row | Simple meaning |
|---|---|---|
| `investor_balance_transactions` | direction `IN`, source `NOTE_INVESTMENT_RELEASE` | Investor cash inflow |

### 5. Tables updated
| Table/model | Fields updated | Example value | Simple meaning |
|---|---|---|---|
| `note_investments` | `status` | `SETTLED` | Allocation finalized |
| `investor_balances` | `available_amount +=` | increased | Investor cash released |

### 6. Status changes
| Model | Field | Before | After |
|---|---|---|---|
| `NoteInvestment` | `status` | `CONFIRMED` | `SETTLED` |

### 7. Confirmed from code
- `tx.noteInvestment.updateMany({ status: SETTLED })` runs in `postSettlement()`.

### 8. Needs code/business confirmation
- None.

## Step 26 — Note becomes REPAID / servicing SETTLED

### 1. Real-life story
Note is fully repaid and servicing is marked complete.

### 2. User action / system action
Happens in post settlement transaction.

### 3. Pages affected
- Admin note detail
- Issuer dashboard KPIs (“Completed notes”)

### 4. Tables created
| Table/model | Example row | Simple meaning |
|---|---|---|
| *(none new beyond ledger and transactions created in Step 22)* | | |

### 5. Tables updated
| Table/model | Fields updated | Example value | Simple meaning |
|---|---|---|---|
| `notes` | `status`, `servicing_status`, `repaid_at` | `REPAID/SETTLED` | Lifecycle end |

### 6. Status changes
| Model | Field | Before | After |
|---|---|---|---|
| `Note` | `status` | not repaid | `REPAID` |
| `Note` | `servicing_status` | not settled | `SETTLED` |

### 7. Confirmed from code
- `postSettlement()` sets:
  - `Note.status = NoteStatus.REPAID`
  - `Note.servicing_status = NoteServicingStatus.SETTLED`

### 8. Needs code/business confirmation
- None.

## Step 27 — Failed / ARREARS / DEFAULTED / CANCELLED paths

### 1. Real-life story
If something goes wrong, the Note might fail funding, go late/arrears during servicing, be defaulted, or be cancelled (if implemented).

### 2. User action / system action
Possible actions in inspected code:
- Admin “Fail Funding” (funding fails)
- Admin overdue/late charge checks (LATE/ARREARS)
- Admin “mark default” (DEFAULTED)
- Payment can be rejected (payment VOID)
- `NoteStatus.CANCELLED` exists, but no “cancel note” action found in inspected note service.

### 3. Pages affected
- Admin note detail
- Admin issuer dashboard (failed notes appear in note KPIs)

### 4. Tables created
| Table/model | Example row | Simple meaning |
|---|---|---|
| `note_events` / `note_admin_actions` | late/default events | Timeline entries |
| `investor_balance_transactions` | IN on funding fail | Refund/release |

### 5. Tables updated
| Table/model | Fields updated | Example value | Simple meaning |
|---|---|---|---|
| `notes` | `status` and `servicing_status` | `FAILED_FUNDING`, `ARREARS`, `DEFAULTED` | Error path state |
| `note_investments` | `status` | `RELEASED` or `SETTLED` | Investor state |
| `note_payments` | `status` | `VOID` | Payment rejected |

### 6. Status changes
| Model | Field | Before | After |
|---|---|---|---|
| `Note` | `status` | `PUBLISHED` | `FAILED_FUNDING` (fail funding) |
| `Note` | `servicing_status` | `CURRENT` | `LATE/ARREARS` (overdue check) |
| `Note` | `status` | *(any)* | `ARREARS` when arrears threshold reached |
| `Note` | `status` | `ARREARS` | `DEFAULTED` (mark default) |
| `NotePayment` | `status` | `PENDING` | `VOID` (reject payment) |
| `Note` | `status` | — | `CANCELLED` (**Needs confirmation**) |

### 7. Confirmed from code
- `failFunding()` sets `Note.status = FAILED_FUNDING`.
- `applyOverdueLateCharge()` can set:
  - `servicing_status` to `LATE` or `ARREARS`
  - and sets `Note.status = ARREARS` when arrears threshold is reached
  - sets `arrears_started_at` when first entering arrears
- `markDefault()` sets `Note.status = DEFAULTED` and `servicing_status = DEFAULTED`.

### 8. Needs code/business confirmation
- Whether `NoteStatus.CANCELLED` is used anywhere.
- Whether “PARTIAL/ADVANCE_PAID/RECONCILED/SETTLED payment status” are implemented in settlement/payment posting paths.

## 6. Page-by-Page Explanation

This is how the UI surfaces connect to the database tables.

### 6.1 Issuer Dashboard

**Pages**
- Issuer dashboard main page
- Contract detail page (contract-specific invoices + notes)

**What you see**
- Invoice Financing: standalone invoice cards
- Contract Financing: contract cards
- Note status summary (active/completed counts, per contract)

**Tables that power it**
| Page section | Table/model | Field(s) | Simple explanation |
|---|---|---|---|
| Contract Financing cards | `contracts` + note linkage via `notes.source_contract_id` | facility fields and note counts | Contract “money picture” comes from contract snapshot + linked Notes |
| Invoice Financing cards | `invoices` (+ optional linked Notes) | `invoices.contract_id`, invoice details, `notes.status` | Standalone invoices are filtered out if linked to a contract |
| Active notes KPI | `notes` | `notes.status = ACTIVE` | “Active financing instruments” |
| Completed notes KPI | `notes` | `notes.status = REPAID` | Successfully settled Notes |

### 6.2 Admin Note Registry

**Page**
- `apps/admin/src/app/notes/page.tsx`

**What you see**
- Notes table
- “Approved invoices ready for notes” table
- Buttons: “Turn Into Note” and “View”

**Tables**
| Page section | Table/model | Field(s) | Simple explanation |
|---|---|---|---|
| Notes registry rows | `notes` | `notes.status`, `funding_status`, `listing_status`, snapshot fields | Each row is a Note |
| “Ready invoices” rows | `invoices` and optional linked `notes` | invoice `status=APPROVED` and note presence | If invoice already has note, it shows a badge |

### 6.3 Admin Note Detail

**Page**
- `apps/admin/src/app/notes/[id]/page.tsx`

**What you see**
- Publish/unpublish
- Close funding / fail funding
- Activate
- Settlement panel (record payments + settlement waterfall actions)
- Ledger panel (ledger entries)
- Timeline panels

**Tables**
| Page section | Table/model | Field(s) | Simple explanation |
|---|---|---|---|
| Publish button state | `notes` + `note_listings` | `status`, `funding_status`, `listing_status` | Enables “Publish” only for publishable notes |
| Funding buttons | `notes` + `note_investments` | `funded_amount`, `minimum_funding_percent` | Determines close/fail eligibility |
| Settlement panel | `note_payments`, `note_settlements` | payment and settlement statuses | Drives preview/approve/post |
| Ledger panel | `note_ledger_entries` | direction, account codes | Immutable postings |

### 6.4 Investor Marketplace

**Pages**
- Investor marketplace page (browse open notes)
- Investor note/investment detail page

**What you see**
- Note cards with funded percent
- “Invest” button (only if investable)

**Tables**
| Page section | Table/model | Field(s) | Simple explanation |
|---|---|---|---|
| Marketplace list | `notes` + `note_listings` | `status=PUBLISHED`, `listing_status=PUBLISHED`, `funding_status=OPEN` | Only open published notes appear |
| Card values | `notes` | `target_amount`, `funded_amount`, `profit_rate_percent`, `maturity_date` | Marketplace card uses mapped note fields |

### 6.5 Bucket Balance Page

**Page**
- `apps/admin/src/app/finance/buckets/page.tsx`

**What you see**
- Five platform buckets: Investor Pool, Repayment Pool, Operating Account, Ta'widh Account, Gharamah Account
- Debit total, credit total, net balance
- Bucket activity log

**Tables**
| Page section | Table/model | Field(s) | Formula |
|---|---|---|---|
| Bucket net balance | `note_ledger_entries` + `note_ledger_accounts` | `direction`, `amount` | `balance = sum(CREDIT) - sum(DEBIT)` |
| Activity log | `note_ledger_entries` | `posted_at`, `description`, links | Ordered by `posted_at desc` |

## 7. Money Flow

This section is “money flow in basic English”.

### Money Flow in Basic English

The code models money movement with:
1. Investor cash balance tables (`InvestorBalance` and `InvestorBalanceTransaction`)
2. A platform ledger model (`NoteLedgerAccount` + `NoteLedgerEntry`) that creates bucket balances.

#### Money events table

| Money event | Amount | Table created/updated | Simple meaning |
|---|---:|---|---|
| Investor deposits “into platform” (dev topup only) | (dev amount) | `investor_organizations.deposit_received`, `investor_balance_transactions`, `note_ledger_entries` | Makes testing possible; not part of real rails |
| Investor invests (commit) | invest amount | `note_investments`, `investor_balances`, `investor_balance_transactions` | Investor cash leaves `available_amount`, commitment row created |
| Funding fails → release investors | committed amount | `note_investments`, `investor_balances`, `investor_balance_transactions` | Investors cash returned if funding < minimum |
| Activate note | funded_amount (platform fee part for ledger) | `notes`, `note_ledger_entries` | Creates ledger entries for platform fee at activation |
| Repayment receipt recorded | gross receipt amount | `note_payments`, `note_ledger_entries` | Credits repayment pool when payment status becomes RECEIVED |
| Settlement posted | gross receipt amount allocation | `note_settlements`, `note_ledger_entries`, `investor_balance_transactions`, `investor_balances` | Debits repayment pool and credits investor pool and fee buckets |

#### Buckets table

| Bucket | Simple meaning | Example money movement |
|---|---|---|
| Investor Pool (`INVESTOR_POOL`) | Holds investor principal and investor profit | Credited during settlement for investor principal + profit |
| Repayment Pool (`REPAYMENT_POOL`) | Holds repayment receipts before split | Credited on repayment receipt, then debited during settlement split |
| Operating Account (`OPERATING_ACCOUNT`) | Platform/service fee income | Credited during settlement for service fee; credited during activation for platform fee |
| Ta'widh Account (`TAWIDH_ACCOUNT`) | Late fee ta'widh component | Credited during settlement when late charges exist |
| Gharamah Account (`GHARAMAH_ACCOUNT`) | Late fee gharamah component | Credited during settlement when late charges exist |

## 8. Ledger and Bucket Balance

### Ledger (basic English)

- Ledger is like an accounting notebook.
- Every important money movement becomes a row in `note_ledger_entries`.
- `direction` tells if money goes in (`CREDIT`) or goes out (`DEBIT`) for that ledger account.
- Ledger entries are immutable in this design (code uses create/upsert).

### Bucket Balance (basic English)

- Bucket balance is not shown as a separate “balance table”.
- Instead, the API calculates bucket balances by summing ledger entries.

### Confirmed from code

There is **no** separate `BucketBalance` model in Prisma schema.

Bucket balance is computed by:
- `apps/api/src/modules/notes/service.ts::listLedgerBucketBalances()`
  - reads `NoteLedgerAccount`
  - uses `note_ledger_entries` to sum credit and debit
  - returns `balance = creditTotal - debitTotal`

### Ledger/bucket tables

| Ledger table | Important field | Meaning |
|---|---|---|
| `NoteLedgerEntry` | `direction` | `CREDIT` adds to bucket, `DEBIT` subtracts from bucket |
| `NoteLedgerEntry` | `account_id` | Links entry to a bucket account |
| `NoteLedgerEntry` | `amount` | Money value, stored as `numeric(18,6)` |

| Bucket page field | Source table/field | Formula |
|---|---|---|
| Debit total | `note_ledger_entries.direction=DEBIT` | `sum(DEBIT.amount)` |
| Credit total | `note_ledger_entries.direction=CREDIT` | `sum(CREDIT.amount)` |
| Net balance | `note_ledger_entries` | `creditTotal - debitTotal` |

## 9. Issuer Dashboard and Contract Detail KPIs

### What “Active” and “Completed” mean (confirmed)

In `apps/api/src/modules/issuer-dashboard/service.ts`:
- **Active notes count** = number of `notes` rows where `notes.status === NoteStatus.ACTIVE`
- **Completed notes count** = number of `notes` rows where `notes.status === NoteStatus.REPAID`

### Note-related summary cards

| UI field | Suggested table | Suggested field/formula | Confirmed from code? | Needs business confirmation? |
|---|---|---|---|---|
| Active financing count | `notes` | `notes.status = ACTIVE` | Confirmed | — |
| Completed notes count | `notes` | `notes.status = REPAID` | Confirmed | — |

> Other KPIs (success rate, on-time over 6 months, etc.) currently return `null` in inspected code.

## 10. Relationships

### 10.1 Relationship diagrams

Application → Contract → Invoice → Note

```
Application
  ├── Contract?
  │     └── Invoices[]
  └── Invoices[]

Note
  ├── source_application_id
  ├── source_contract_id (optional)
  └── source_invoice_id (optional but unique)
```

Invoice → Note

```
Invoice (approved)
  └── creates exactly one Note per invoice (source_invoice_id is unique)
```

Note → NoteListing

```
Note (one-to-one optional)
  └── NoteListing row
```

Note → NoteInvestment
Note → NotePaymentSchedule
NotePaymentSchedule → NotePayment
NotePayment → NoteSettlement
NoteSettlement → NoteLedgerEntry
NoteLedgerAccount → NoteLedgerEntry

### 10.2 Relationship table

| From | To | Relationship field | Simple meaning |
|---|---|---|---|
| `Note.source_invoice_id` | `Invoice.id` | `source_invoice_id` | Note created from an invoice |
| `Note.source_contract_id` | `Contract.id` | `source_contract_id` | Note tied to a contract (optional) |
| `Note.source_application_id` | `Application.id` | `source_application_id` | Note tied to application |
| `NoteListing.note_id` | `Note.id` | `note_id` | Listing belongs to the note |
| `NoteInvestment.note_id` | `Note.id` | `note_id` | Investment belongs to the note |
| `NotePaymentSchedule.note_id` | `Note.id` | `note_id` | Payment schedule belongs to the note |
| `NotePayment.note_id` | `Note.id` | `note_id` | Payment belongs to the note |
| `NoteSettlement.note_id` | `Note.id` | `note_id` | Settlement belongs to the note |
| `NoteLedgerEntry.note_id` | `Note.id` | `note_id` | Ledger entry linked to note |
| `NoteLedgerEntry.account_id` | `NoteLedgerAccount.id` | `account_id` | Bucket account for this ledger entry |

## 11. Common Confusion Explained

- **Invoice vs Note**
  - Invoice is the receivable input (approved by issuer/admin).
  - Note is the investable product created from an approved invoice.
- **Note vs NoteListing**
  - `Note` is the lifecycle object.
  - `NoteListing` is the “marketplace visibility window” row.
- **Note exists vs Note is visible in Marketplace**
  - A Note can exist in `DRAFT`.
  - It becomes visible when `Note.status=PUBLISHED` and `Note.listing_status=PUBLISHED` and `funding_status=OPEN`.
- **funded_amount vs target_amount**
  - `target_amount` is the note target (marketplace goal).
  - `funded_amount` increases when investors invest.
- **80% minimum funded vs 100% fully funded**
  - Minimum threshold decides whether Admin can close funding successfully.
  - The system does not require 100% in the logic we inspected for close funding.
- **funding_status FUNDED vs Note.status FUNDING/ACTIVE**
  - `funding_status=FUNDED` means funding threshold met.
  - `Note.status` changes later to `FUNDING` then `ACTIVE` after activation.
- **Active vs Funded**
  - `Note.funding_status` is about funding state.
  - `Note.status=ACTIVE` means servicing started.
- **Completed vs Repaid vs Settled**
  - “Completed notes” in issuer dashboard uses `Note.status=REPAID`.
  - Servicing completion is `Note.servicing_status=SETTLED`.
- **Ta'widh vs Gharamah**
  - Both are late fee components that map to separate ledger accounts.
- **Disbursement vs Repayment**
  - Disbursement/activation posts platform-fee ledger entries in this code.
  - Repayment posts repayment receipt ledger entries to `REPAYMENT_POOL`.
- **Ledger vs Bucket Balance**
  - Ledger entries are raw postings.
  - Bucket balances are calculated by summing ledger entries per account.

## 12. What Is Confirmed from Code

High confidence confirmed points (based on inspected code):

1. Note creation requires:
   - `invoice.status === APPROVED` (for `createFromInvoice`)
   - `application.status === COMPLETED` and selected invoice `status === APPROVED` (for `createFromApplication`)
2. `createFromInvoiceSource()` creates:
   - `notes` row (with snapshots)
   - `note_payment_schedules` row (sequence=1)
   - `note_events` and `note_admin_actions` audit logs
3. Publishing sets:
   - `notes.status = PUBLISHED`
   - `notes.funding_status = OPEN`
   - `notes.listing_status = PUBLISHED`
   - `note_listings.status = PUBLISHED` (via upsert)
4. Marketplace invest:
   - creates `note_investments`
   - updates `notes.funded_amount` by increment
   - updates `investor_balances.available_amount` (OUT transaction)
5. Close funding (success) sets:
   - `notes.status = FUNDING`
   - `notes.funding_status = FUNDED`
   - `notes.listing_status = CLOSED`
   - updates investments `COMMITTED → CONFIRMED`
6. Fail funding sets:
   - `notes.status = FAILED_FUNDING`
   - investments `COMMITTED → RELEASED` and investor cash is credited back
7. Activate sets:
   - `notes.status = ACTIVE`
   - `notes.servicing_status = CURRENT`
   - posts ledger entries for platform fee bucket movement
8. Repayment receipt:
   - creates `note_payments`
   - posts a ledger credit to `REPAYMENT_POOL` when payment is `RECEIVED`
9. Settlement flow:
   - preview creates `note_settlements` status `PREVIEW`
   - approve sets `note_settlements` status `APPROVED`
   - post sets `note_settlements` status `POSTED`
   - posts ledger entries and credits investor balances
   - updates Note to `REPAID` and servicing to `SETTLED`
10. Bucket balances are derived:
   - by summing `NoteLedgerEntry` by direction per `NoteLedgerAccount.code`

## 13. Needs Code/Business Confirmation

1. “Disbursement to issuer” accounting:
   - In inspected code, activation only posts ledger entries for `INVESTOR_POOL` and `OPERATING_ACCOUNT` (platform fee).
   - Confirm how issuer payout is tracked (ledger account? another system?).
2. Repayment schedule “paid amounts”:
   - The code we inspected creates `note_payment_schedules` but we did not find any code updating `paid_principal/paid_profit/paid_total`.
   - Confirm if these fields are intentionally not used yet, or updates are done in a different module.
3. `NoteStatus.CANCELLED`:
   - The enum exists, but no cancel action was found in inspected note service methods.
4. Some enum statuses appear but were not confirmed in code paths:
   - `NoteServicingStatus.PARTIAL`, `ADVANCE_PAID`, `NotePaymentStatus.RECONCILED/SETTLED`, `NoteSettlementStatus.VOID`, `NoteInvestmentStatus.CANCELLED`.
5. Business requirement for “signed offer letter”:
   - Note creation checks invoice status `APPROVED` and application `COMPLETED`, not the signing content itself.

## 14. Final Beginner Summary

If you remember only 10 things:

1. A **Note** is created from an **approved invoice**.
2. Publishing sets `Note` to `PUBLISHED` and opens funding (`funding_status=OPEN`).
3. Investors invest and increase `notes.funded_amount` and create `note_investments`.
4. Close funding sets investments to `CONFIRMED`.
5. Fail funding releases investors and marks the Note `FAILED_FUNDING`.
6. Activate sets the Note to `ACTIVE` and posts platform-fee ledger entries.
7. Repayment receipts create `note_payments` and (when RECEIVED) credit `REPAYMENT_POOL` in the ledger.
8. Settlement preview → approve → post creates `note_settlements` and posts ledger splits.
9. After settlement posting, the Note becomes `REPAID` and servicing becomes `SETTLED`.
10. Bucket balances are calculated from ledger entries (credit minus debit).

