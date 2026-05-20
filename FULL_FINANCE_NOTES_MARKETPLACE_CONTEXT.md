## FULL_FINANCE_NOTES_MARKETPLACE_CONTEXT.md

This document explains the end-to-end **business + technical flow** of the platform focused on:
1) Note creation from an issuer `Application` → `Contract`/`Invoice`
2) Admin-controlled publishing and marketplace listing
3) Investor investing (commitment)
4) Funding completion → trustee disbursement (issuer payout)
5) Repayment receipts → settlement waterfall → investor returns
6) Residual returns (issuer) → note closing

Where code behavior is not found in the repo, this doc explicitly marks **UNCLEAR / NEEDS CONFIRMATION** and points to what we looked at.

---

## 0) Big picture: what the system is doing

### Domains in the codebase
1. **Issuer domain (apps/issuer)**  
   Issuer creates an `Application`, fills contract/invoice details, and the issuer accepts offers through `SigningCloud`.

2. **Admin domain (apps/admin)**  
   Admin reviews `Application` sections, sends contract/invoice offers, then later controls the marketplace lifecycle of a `Note` (publish, fund, approve settlements, generate trustee letters, and mark completion).

3. **Investor domain (apps/investor)**  
   Investors browse/pick marketplace `Note` listings, commit funds, and later see repayment/returns progress.

### Backend modules (apps/api)
The end-to-end finance logic is concentrated in:
- `apps/api/src/modules/notes/service.ts` (Note lifecycle, marketplace, payments, settlements, withdrawals, ledger posting)
- `apps/api/prisma/schema.prisma` (data model + enums)
- `apps/api/src/modules/issuer-dashboard/service.ts` (issuer dashboard metrics / labels)
- `apps/api/src/modules/applications/service.ts` (offer signing with SigningCloud)
- `apps/api/src/modules/contracts/service.ts` + `apps/api/src/modules/invoices/service.ts` (contract/invoice state)
- `apps/api/src/routes.ts` (wires controllers + middleware)

---

## 1) Source of truth: Prisma model + enums

### Note lifecycle enums (money + status)
From `apps/api/prisma/schema.prisma`:
- `enum NoteStatus`:
  - `DRAFT`, `PUBLISHED`, `FUNDING`, `ACTIVE`, `REPAID`, `ARREARS`, `DEFAULTED`, `FAILED_FUNDING`, `CANCELLED`
- `enum NoteListingStatus`:
  - `NOT_LISTED`, `DRAFT`, `PUBLISHED`, `UNPUBLISHED`, `CLOSED`
- `enum NoteFundingStatus`:
  - `NOT_OPEN`, `OPEN`, `FUNDED`, `FAILED`, `CLOSED`
- `enum NoteServicingStatus`:
  - `NOT_STARTED`, `CURRENT`, `PARTIAL`, `ADVANCE_PAID`, `LATE`, `ARREARS`, `DEFAULTED`, `SETTLED`
- `enum NoteInvestmentStatus`:
  - `COMMITTED`, `CONFIRMED`, `RELEASED`, `CANCELLED`, `SETTLED`
- `enum NotePaymentStatus`:
  - `PENDING`, `PARTIAL`, `RECEIVED`, `RECONCILED`, `SETTLED`, `VOID`
- `enum NoteSettlementStatus`:
  - `PREVIEW`, `APPROVED`, `POSTED`, `VOID`
- `enum WithdrawalType`:
  - `INVESTOR_WITHDRAWAL`, `ISSUER_DISBURSEMENT`, `ISSUER_RESIDUAL_RETURN`, `ADMIN_ADJUSTMENT`
- `enum WithdrawalStatus`:
  - `DRAFT`, `LETTER_GENERATED`, `SUBMITTED_TO_TRUSTEE`, `COMPLETED`, `CANCELLED`

These enums drive the state machine in `apps/api/src/modules/notes/service.ts`.

### Money movement primitives
Key money tables in `schema.prisma`:
1. **Marketplace listing**
   - `model NoteListing` (1:1 with `Note` via `note_id`)
   - includes `opens_at`, `closes_at`, `status`, `visibility`

2. **Investor commitments**
   - `model NoteInvestment`
   - `status`: `COMMITTED` → `CONFIRMED` → `SETTLED` (or `RELEASED` for failed funding)

3. **Investor wallet / balance**
   - `model InvestorBalance` (per investor org: `available_amount`)
   - `model InvestorBalanceTransaction` (append-only audit, `idempotency_key`)

4. **Repayment receipts**
   - `model NotePaymentSchedule` (expected schedule)
   - `model NotePayment` (actual received payments and reconciliation/void/settled)

5. **Settlement**
   - `model NoteSettlement`
   - includes a `preview_snapshot` used to later post ledger entries and release investor balances

6. **Ledger buckets**
   - `model NoteLedgerAccount` with `NoteLedgerAccountType`:
     - `INVESTOR_POOL`, `REPAYMENT_POOL`, `OPERATING_ACCOUNT`, `TAWIDH_ACCOUNT`, `GHARAMAH_ACCOUNT`, `ISSUER_PAYABLE`
   - `model NoteLedgerEntry` is append-only and includes `idempotency_key`

---

## 2) Lifecycle overview (the 19 steps)

Below is the intended narrative. For each step, I describe:
- what records change
- what backend functions typically run
- what UI actions exist (issuer/admin/investor)

### Step 1. Issuer creates application
**Where:** `apps/issuer/...`  
**What:** Issuer selects a financing product and fills application steps (UI progress bar exists; details depend on product workflow).

**Backend idea:** A new `Application` is created in DB with initial `ApplicationStatus.DRAFT`.

**Code evidence to cite here:** The document focuses on finance later; the exact "create application" and field-by-field flow lives under:
- API `applications` module (wired in `apps/api/src/routes.ts`)
- issuer portal pages under `apps/issuer/src/app/(application-flow)/...`

### Step 2. Issuer submits application
**Where:** `apps/issuer/src/app/(application-flow)/...`  
**What:** Application moves from `DRAFT` → `SUBMITTED` (then `UNDER_REVIEW`).

**UNCLEAR / NEEDS CONFIRMATION:** exact status transitions per action in the issuer UI are not fully enumerated in the code we inspected in this run. The finance lifecycle is confirmed, but application-step UI → API mapping is broader than this doc’s current evidence.

### Step 3. Admin reviews application
**Where:** `apps/admin/...`  
**What:** Admin updates section/line-item review state; application review workflow uses enums like `ReviewStepStatus`.

**Backend:** admin review operations are in the `applications` + admin review logic (application review operations guide exists).

### Step 4. Admin sends offer
**Where:** Admin actions in admin portal  
**What:** Admin sends contract offer and/or invoice offer by setting:
- `ContractStatus.OFFER_SENT` (contract-based flow)
- `InvoiceStatus.OFFER_SENT` (invoice-based flow)

**Backend evidence (confirmed in code):**
1. `apps/api/src/modules/admin/service.ts#sendContractOffer`
   - locks application + contract rows (`FOR UPDATE`)
   - updates `contract.status = "OFFER_SENT"` and writes `contract.offer_details`
   - upserts `applicationReview` for `section: "contract_details"` to `ReviewStepStatus.OFFER_SENT`
   - updates the application status to `ApplicationStatus.CONTRACT_SENT`
   - sends issuer notifications (best-effort)
2. `apps/api/src/modules/admin/service.ts#sendInvoiceOffer`
   - updates `invoice.status = "OFFER_SENT"` and writes `invoice.offer_details`
   - upserts `applicationReviewItem` for `item_type: "invoice"` to `ReviewStepStatus.OFFER_SENT`
   - updates application status to either:
     - `ApplicationStatus.INVOICES_SENT` (if all invoices are offerable/resolved)
     - or `ApplicationStatus.INVOICE_PENDING` (otherwise)
   - also updates `contract_details.approved_facility / utilized_facility / available_facility` snapshot when a contract exists

### Step 5. Issuer accepts/signs
**Where:** Issuer accepts offers using `SigningCloud` (manual signing), then backend finalizes.
- `apps/issuer/src/app/(application-management)/applications/sign/...`
- `apps/issuer/src/app/(application-management)/applications/components/ReviewOfferModal.tsx` (plus another similarly named component)

**Backend evidence (confirmed):**
The signing lifecycle is handled in `apps/api/src/modules/applications/service.ts`:
1. Starting manual signing:
   - `startContractOfferSigning`:
     - requires `contract.status === "OFFER_SENT"`
     - generates the offer letter PDF
     - uploads it to SigningCloud and starts manual signing
     - stores a pending `contract.offer_signing` record with:
       - `status: "pending"`
       - `signing_url`
       - `signing_sc_contractnum`
   - `startInvoiceOfferSigning` does the same for `invoice.offer_signing`
2. Finalizing after SigningCloud completes:
   - `processSigningCloudCallback(contractnum)` looks up whether the callback refers to a `contract` or `invoice`
   - `finalizeContractOfferAfterSigningCloud`:
     - requires `contract.status === "OFFER_SENT"`
     - fetches the signed PDF from SigningCloud using the contract number
     - requires the signed PDF bytes to be at least `MIN_SIGNED_PDF_BYTES`
     - computes `sha256` of the signed bytes and uploads the PDF to S3
     - calls `respondToContractOffer(..., action="accept", signingCompletion={s3Key, sha256})`
   - `finalizeInvoiceOfferAfterSigningCloud` does the same for invoices
3. Accepting the offer and updating statuses:
   - `respondToContractOffer(..., "accept", options.signingCompletion)`:
     - requires `contract.status === "OFFER_SENT"` and the offer hasn’t been responded to
     - sets `contract.status = "APPROVED"`
     - merges `offer_signing` to `status: "signed"` including S3 key + sha256 (`mergeOfferSigningSigned`)
     - recomputes application status using `computeApplicationStatus(...)`
   - `respondToInvoiceOffer(..., "accept", options.signingCompletion)`:
     - sets `invoice.status = "APPROVED"`
     - merges the signed offer metadata into `invoice.offer_signing`
     - recomputes application status using `computeApplicationStatus(...)`

**What Note creation validates (confirmed):**
`notes/service.ts#createFromInvoiceSource` / `createFromApplication` only require:
- invoice status `InvoiceStatus.APPROVED`
- application status `ApplicationStatus.COMPLETED`

**Important nuance (DEV escape hatch):**
In `apps/api/src/modules/applications/controller.ts`, the accept endpoints for contract/invoice can throw `USE_SIGNING_FLOW` when SigningCloud is configured, but there is a dev-only bypass:
- if a dev bypass flag is requested, the controller calls `respondTo*Offer(..., "accept")` **without** signingCompletion.

**So the “signed offer letter validation” situation is:**
- In normal SigningCloud flows, a signed PDF is fetched and stored, and `offer_signing` is merged as `status: "signed"` before `InvoiceStatus.APPROVED` / `ContractStatus.APPROVED`.
- `Note` creation itself does not validate that a signed letter S3 key exists; it relies on the statuses being `APPROVED/COMPLETED`.

Status: **resolved with a nuance** (SigningCloud finalization enforces signed PDF availability; Note creation does not independently re-check signed content).

### Step 6. Contract is created
**Where:** Backend in contracts module  
**What:** Contract is created and enters offer/approved/rejected states.

### Step 7. Invoice is created/submitted
**Where:** Backend in invoices module + issuer UI invoice steps  
**What:** Invoice created and then becomes `InvoiceStatus.APPROVED` after admin review + offer signing.

### Step 8. Admin reviews invoice
**Where:** Admin portal invoice review UI  
**What:** Admin moves invoice review to approved/rejected.

### Step 9. Invoice becomes note
This is the first major finance transition.

**Where:** `apps/api/src/modules/notes/service.ts`
**Entry points (confirmed):**
- `createFromInvoice(invoiceId, ...)`
  - requires `invoice.status === InvoiceStatus.APPROVED`
- `createFromApplication(applicationId, ...)`
  - requires `application.status === ApplicationStatus.COMPLETED`
  - selects an approved invoice (or uses `sourceInvoiceId` if provided)

**What happens in `createFromInvoiceSource` (confirmed):**
- creates a `Note` with snapshots:
  - `issuer_snapshot`
  - `paymaster_snapshot` (from contract customer details)
  - `product_snapshot`
  - `contract_snapshot`
  - `invoice_snapshot`
- creates initial `NotePaymentSchedule` rows (sequence `1`), with:
  - `due_date` from note `maturity_date` (or fallback)
  - `expected_principal`, `expected_profit`, `expected_total`

**Important evidence: idempotency**
- It checks if a note already exists for that `(application, invoice)` via:
  - `noteRepository.findBySource(application.id, invoice.id)`
- It also has a unique constraint handling for race conditions (catches unique constraint errors).

### Step 10. Note is listed on marketplace
**Where:** Admin portal (publish/unpublish)
**Backend:** `notes/service.ts`

Key method: `publish(noteId, actor)`
- allowed only when:
  - `note.status === NoteStatus.DRAFT`
  - `note.funding_status === NoteFundingStatus.NOT_OPEN`
  - `note.listing_status` in `NOT_LISTED | DRAFT | UNPUBLISHED`
- sets:
  - `note.status = NoteStatus.PUBLISHED`
  - `note.listing_status = NoteListingStatus.PUBLISHED`
  - `note.funding_status = NoteFundingStatus.OPEN`
  - `note.published_at = now`
  - upserts `note.listing` with:
    - `opens_at = now`
    - `closes_at = now + DEFAULT_LISTING_DURATION_DAYS`

**Confirmed constant:**  
`DEFAULT_LISTING_DURATION_DAYS = 14` (in `notes/service.ts`)

**UI:** Investor sees marketplace listings only for notes where:
- `note.status === PUBLISHED`
- `note.listing_status === PUBLISHED`
- `note.funding_status === OPEN`

### Step 11. Investor sees marketplace listing
**Where:** `apps/investor/src/app/marketplace/page.tsx` (and hooks)
**What:** Investors browse marketplace notes.

**Backend:** `notes/service.ts`
- `listMarketplace(params)` returns notes via `listAdminNotes` with:
  - `status: NoteStatus.PUBLISHED`
  - `listingStatus: NoteListingStatus.PUBLISHED`
  - `fundingStatus: NoteFundingStatus.OPEN`

### Step 12. Investor invests (commit funds)
**Where:** Investor invests in `apps/investor`
**Backend:** `notes/service.ts#createInvestment(noteId, ...)`

**What `createInvestment` enforces (confirmed):**
- Investor org must exist and be accessible
- investor org must have `deposit_received === true`
- note must be:
  - `note.status === NoteStatus.PUBLISHED`
  - `note.funding_status === NoteFundingStatus.OPEN`
- Investment amount rules:
  - cannot exceed remaining capacity: `target_amount - funded_amount`
  - must meet marketplace minimum commitment:
    - `MARKETPLACE_MIN_COMMIT_MYR = 100`
    - it uses the smaller of remaining capacity and min commit

**What `createInvestment` changes (confirmed):**
1. increments `note.funded_amount`
2. creates `noteInvestment`:
   - `status = NoteInvestmentStatus.COMMITTED` (default)
3. posts ledger movement via investor balance:
   - calls `debitInvestorBalanceForCommit(...)`
4. auto-close funding:
   - if funded becomes ~>= target, it calls `closeFunding(noteId, actor=SYS/ADMIN)`

### Step 13. Bucket balance / wallet / ledger is affected
This step is split into:
1) Investor wallet/balance
2) Note ledger buckets

#### 13A) Investor wallet/balance (confirmed)
`InvestorBalance` uses `creditInvestorBalance` / `debitInvestorBalanceForCommit` in:
- `apps/api/src/modules/notes/investor-balance.ts`

Confirmed DB structure:
- `InvestorBalanceTransaction` is append-only with `idempotency_key`
- balance is updated using `available_amount`

#### 13B) Ledger buckets (confirmed later on funding close + activation)
In the code we inspected, ledger bucket postings happen mainly when:
- funding is closed (creates disbursement withdrawal + posts disbursement ledger)
- note is activated (posts disbursement ledger)
- payments are recorded (posts repayment receipt ledger)
- settlement is posted (posts settlement ledger)
- withdrawal completion (posts issuer payable ledger debit and note status change)

### Step 14. Funding completes or fails
#### Funding completes: `closeFunding(noteId)`
**Backend:** `apps/api/src/modules/notes/service.ts#closeFunding`
**Preconditions (confirmed):**
- note:
  - `status === NoteStatus.PUBLISHED`
  - `funding_status === NoteFundingStatus.OPEN`
- funding percent meets `minimum_funding_percent`

**Confirmed updates (in transaction):**
- `note.status = NoteStatus.FUNDING`
- `note.funding_status = NoteFundingStatus.FUNDED`
- `note.listing_status = NoteListingStatus.CLOSED`
- `note.funding_closed_at = now`
- all investments with `COMMITTED` become `CONFIRMED`

**Disbursement withdrawal created (confirmed):**
- calculates:
  - `platformFee = fundedAmount * platform_fee_rate_percent / 100`
  - `netDisbursement = fundedAmount - platformFee`
- if `netDisbursement > 0`, creates `WithdrawalInstruction`:
  - `withdrawal_type = WithdrawalType.ISSUER_DISBURSEMENT`
  - `amount = netDisbursement`
  - `beneficiary_snapshot` from issuer bank account snapshot

**Ledger buckets posted on close (confirmed):**
- `await postDisbursementLedger(tx, result, actor)`

#### Funding fails: `failFunding(noteId)`
**Backend:** `notes/service.ts#failFunding`
**What it does (confirmed):**
- changes note to:
  - `status = NoteStatus.FAILED_FUNDING`
  - `funding_status = NoteFundingStatus.FAILED`
  - `listing_status = NoteListingStatus.CLOSED`
- released investments:
  - `COMMITTED` → `RELEASED`
  - returns funds to investor balance via `creditInvestorBalance` with idempotency keys

### Step 15. Issuer payout/disbursement happens
This is implemented as a **trustee withdrawal workflow**.

There are two relevant backend steps:
1) `activate(noteId)` (note becomes usable after disbursement withdrawal is completed)
2) `markWithdrawalCompleted(withdrawalId)` (trustee payout completion)

#### Activation gating (confirmed)
`activate(id, actor)` checks:
- there must NOT exist a disbursement withdrawal of type `ISSUER_DISBURSEMENT` that is still pending:
  - it searches for withdrawals where:
    - `withdrawal_type = ISSUER_DISBURSEMENT`
    - `status notIn [COMPLETED, CANCELLED]`
- if present → throws `ISSUER_DISBURSEMENT_PENDING`

It also checks:
- note `funding_status === FUNDED`
- note not already activated and `servicing_status === NOT_STARTED`

Then it updates:
- `note.status = ACTIVE`
- `note.servicing_status = CURRENT`
- `activated_at = now`

And posts disbursement ledger again:
- `await postDisbursementLedger(tx, result, actor)`

#### Withdrawal completion posting (confirmed)
`markWithdrawalCompleted(withdrawalId)`:
- allowed only when withdrawal is:
  - `SUBMITTED_TO_TRUSTEE`
  - then sets to `COMPLETED`
- if withdrawal is issuer payout type:
  - `WithdrawalType.ISSUER_DISBURSEMENT` or `ISSUER_RESIDUAL_RETURN`
  - and it has a `note_id` and `amount > 0`
  - it posts a ledger entry:
    - ledger account `ISSUER_PAYABLE`
    - direction `DEBIT`
    - description:
      - “Issuer disbursement paid out via trustee withdrawal”
      - or “Issuer residual disbursed via trustee withdrawal”

**Important:** activation ledger postings are separate from withdrawal completion.  
Activation ensures the platform ledger has “obligations”, and withdrawal completion reduces/records payout.

**UNCLEAR / NEEDS CONFIRMATION (issuer payout tracking beyond ledger):**
The ledger has `ISSUER_PAYABLE` and withdrawal completion posts `DEBIT` there.
But the doc should confirm whether there is any additional table capturing actual trustee payout confirmation (e.g. reconciliation data) besides:
- `WithdrawalInstruction.completed_at`
- the ledger debit/credit entries

What we confirmed:
- ledger movements exist via `postDisbursementLedger`, `postSettlementLedger`, and `markWithdrawalCompleted` posting to `ISSUER_PAYABLE`

What we did not confirm fully:
- whether the trustee system is integrated with reconciliation evidence for issuer payout (beyond letter generation and manual completion marking)

### Step 16. Repayment schedule is created
Schedule is created when the Note is created from invoice/application.

**Confirmed in `createFromInvoiceSource`:**
- creates `NotePaymentSchedule` rows:
  - `sequence: 1`
  - `due_date`
  - `expected_principal`, `expected_profit`, `expected_total`

**UNCLEAR / NEEDS CONFIRMATION (multi-installment schedules):**
In the inspected paths, schedule creation is only the initial row (`sequence: 1`).
If the platform supports multiple repayment installments, we need confirmation where additional schedules are created.

### Step 17. Repayments happen
Repayments happen through **recording payments** and later **settlement**.

#### 17A) Admin records repayment receipts
**Backend:** `recordPayment(noteId, input, actor)`
**Preconditions (confirmed):**
- `assertNoteReadyForServicing(note)`
- `assertNoApprovedOrPostedSettlement(note)`
- open receipt amount is computed from existing payments in open statuses:
  - `NotePaymentStatus.PENDING | PARTIAL | RECEIVED | RECONCILED` (and others included in constants)
- checks receipt amount is within settlement limit including pending late fees

**Payment approval/rejection logic (confirmed partially):**
- `recordPayment`:
  - determines whether issuer can submit directly:
    - `requiresAdminReview = input.source === "ISSUER_ON_BEHALF" && actor.portal === "ISSUER"`
  - if requires admin review:
    - sets payment status `NotePaymentStatus.PENDING`
  - else:
    - sets status `NotePaymentStatus.RECEIVED`

**Ledger posting (confirmed):**
- if status is `RECEIVED`, it calls:
  - `postPaymentReceiptLedger(tx, payment, actor)`

`postPaymentReceiptLedger` (confirmed):
- creates or upserts `NoteLedgerEntry`:
  - ledger account `REPAYMENT_POOL`
  - direction `CREDIT`
  - `idempotency_key: payment:${payment.id}:receipt`

#### 17B) Admin reconciles/approves payments
**Backend:** `approvePayment(paymentId)`
- only for `status === NotePaymentStatus.PENDING`
- sets payment status `RECEIVED`
- sets reconciliation fields:
  - `reconciled_by_user_id`
  - `reconciled_at`
- posts receipt ledger via `postPaymentReceiptLedger`

**Backend:** `rejectPayment(paymentId)`
- only for `status === PENDING`
- sets `NotePaymentStatus.VOID`

**Confirmed enum usage (partial):**
- `NotePaymentStatus.VOID` is used in `rejectPayment`.
- `NotePaymentStatus.RECONCILED` is used as eligibility in settlement preview and posting logic, but this run didn’t find a direct setter to `RECONCILED` in the inspected methods.  
  - This is **UNCLEAR / NEEDS CONFIRMATION**: where and when `RECONCILED` is set.

**UNCLEAR / NEEDS CONFIRMATION (admin reconciliation required?):**
The logic allows:
- issuer on behalf submissions to be `PENDING`
- admin approval changes it to `RECEIVED` (and posts ledger)
But there is no evidence here that every repayment receipt must be reconciled into `RECONCILED`.  
We need confirmation whether `RECONCILED` is always required in business rules or only in some flows.

### Step 18. Investor receives returns
Returns are created via settlement posting and investor balance credits.

#### 18A) Admin previews settlement
**Backend:** `previewSettlement(noteId, settlementPreviewInput, actor)`

**Preconditions (confirmed):**
- `assertNoteReadyForServicing(note)`
- `assertNoPendingPaymentsForSettlement(note)` (no open receipts that would block settlement)
- disallows preview if there is already an approved or posted settlement

**Eligible payments for settlement (confirmed):**
- payments whose status is one of:
  - `RECEIVED`, `RECONCILED`, `PARTIAL`

It computes settlement via `calculateSettlementWaterfall(...)` using:
- gross receipt amount (input or sum of eligible receipts)
- funded principal
- profit rate
- service fee rate
- tawidh/gharamah amounts (late charges)

It creates `NoteSettlement` with:
- `preview_snapshot` (includes allocations by investor)
- `settlement_type` is `LATE` when tawidh or gharamah present, else `STANDARD`

#### 18B) Admin approves settlement preview
**Backend:** `approveSettlement(noteId, settlementId, actor)`

**Checks (confirmed):**
- settlement must be in `PREVIEW`
- receipt ledgers must be complete:
  - `assertRepaymentReceiptLedgerComplete(note_id, gross_receipt_amount)`
- settlement amount must be complete:
  - `assertSettlementAmountComplete(settlement)`

Then sets:
- `NoteSettlementStatus.APPROVED`

#### 18C) Admin posts settlement
**Backend:** `postSettlement(noteId, settlementId, actor)`

**Checks (confirmed):**
- settlement must be `APPROVED`
- settlement receipt ledgers complete

**Then posts (confirmed in transaction):**
1) posts ledger entries via `postSettlementLedger`
2) marks settlement `POSTED`
3) credits investor balances:
   - for each allocation in preview snapshot:
     - credits `InvestorBalance` via `creditInvestorBalance`
     - source: `NOTE_INVESTMENT_RELEASE`
4) updates `NoteInvestment` and `NotePayment` statuses:
   - `COMMITTED/CONFIRMED` → `SETTLED`
   - `RECEIVED/RECONCILED/PARTIAL` → `SETTLED`
5) residual handling:
   - if `issuer_residual_amount > 0.005`, it creates a withdrawal instruction:
     - `WithdrawalType.ISSUER_RESIDUAL_RETURN`
     - and sets servicing status to `CURRENT`
   - else it sets:
     - `NoteStatus.REPAID`
     - `NoteServicingStatus.SETTLED`
     - `repaid_at = now`

### Step 19. Statuses change until completed/defaulted/cancelled/etc.

This is mostly controlled in `notes/service.ts` based on the above steps:
- publishing:
  - `DRAFT` → `PUBLISHED`
  - listing status: `DRAFT/UNPUBLISHED/NOT_LISTED` → `PUBLISHED`
  - funding status: `NOT_OPEN` → `OPEN`
- funding close:
  - `PUBLISHED/OPEN` → `FUNDING/FUNDED` + investments confirmed + listing closed + issuer disbursement withdrawal created
- activation after trustee payout completion:
  - `FUNDING` → `ACTIVE`, servicing status `CURRENT`
- repayments and settlement:
  - settlements change from `PREVIEW` → `APPROVED` → `POSTED`
  - note servicing may become `SETTLED` and note status `REPAID` when no residual
- late/default:
  - `checkOverdueLateCharge` can set servicing status to `LATE` or `ARREARS`
  - `markDefault` can set:
    - `NoteStatus.DEFAULTED`
    - `NoteServicingStatus.DEFAULTED`

**UNCLEAR / NEEDS CONFIRMATION (NoteStatus.CANCELLED “cancel note” action):**
`schema.prisma` contains `NoteStatus.CANCELLED`.
In this run, we found `NoteStatus.CANCELLED` referenced in:
- `apps/api/src/modules/admin/repository.ts` in a list of closed statuses (`CLOSED_OTHER`)
But we did not find a dedicated “cancel note” action in `notes/service.ts` (we searched for `NoteStatus.CANCELLED` usage inside the notes module and did not find it).

So the UI/backend might allow cancellation indirectly, or the status might be unused.

---

## 3) Detailed money flow: the bucket model

This is the core mental model for admin finance pages.

### Ledger buckets (confirmed)
From `postDisbursementLedger`, `postPaymentReceiptLedger`, and `postSettlementLedger`, we can trace how funds flow:

1) `INVESTOR_POOL`
- At funding disbursement:
  - `postDisbursementLedger` creates a ledger entry:
    - direction `DEBIT`
    - amount: `fundedAmount`
  - description: “Funded note disbursement from investor pool”

2) `OPERATING_ACCOUNT`
- At disbursement:
  - ledger entry:
    - direction `CREDIT`
    - amount: `platformFee`
  - description: “Platform fee deducted at disbursement”

3) `ISSUER_PAYABLE`
- At disbursement:
  - ledger entry:
    - direction `CREDIT`
    - amount: `netDisbursement`
  - description: “Net disbursement obligation to issuer (pending trustee payout)”

- At trustee payout completion:
  - `markWithdrawalCompleted` posts:
    - direction `DEBIT`
    - account `ISSUER_PAYABLE`
  - description:
    - disbursement paid out via trustee withdrawal
    - residual disbursed via trustee withdrawal

4) `REPAYMENT_POOL`
- When receipts are recorded as `RECEIVED`:
  - `postPaymentReceiptLedger`:
    - direction `CREDIT`
    - amount: payment receipt amount

- During settlement posting:
  - `postSettlementLedger` debits the repayment pool for investor principal/profit, service fee, and late charges/issuer residual

5) `TAWIDH_ACCOUNT` and `GHARAMAH_ACCOUNT`
- During settlement posting:
  - `postSettlementLedger` credits:
    - `TAWIDH_ACCOUNT` with `tawidh_amount` (late charge)
    - `GHARAMAH_ACCOUNT` with `gharamah_amount`

6) `INVESTOR_POOL` credits
 - During settlement posting:
   - `postSettlementLedger` credits:
     - `INVESTOR_POOL` with:
       - `investor_principal` + `investor_profit_net`

### Admin bucket balance pages
The admin portal includes:
- `apps/admin/src/app/finance/buckets/page.tsx`
- components for bucket balance overview and activity

Backend endpoints for buckets:
- `listLedgerBucketBalances()`
  - returns balances by calculating:
    - `balance = creditTotal - debitTotal`
    - ordering by fixed bucket code order
- `listLedgerBucketActivity(accountCode, query)`
  - lists ledger entries with note references/titles

---

## 4) How UI connects to backend endpoints

This section focuses on *what to look for* in the UI and the corresponding backend service functions.

### Issuer dashboard mapping (confirmed)
`apps/api/src/modules/issuer-dashboard/service.ts` builds DTO fields for the issuer dashboard.

Confirmed mapping logic for the “marketplace label” issue:
- It computes `marketplaceStatusLabel` based on note listing status:
  - listing status `PUBLISHED` → “Listed”
  - listing status `DRAFT` → “Listing draft”
  - listing status `CLOSED` → “Listing closed”
  - listing status `UNPUBLISHED` → “Unpublished”
  - else uses underlying listing status
- If `note.listing` missing but `note.listing_status` exists:
  - label becomes `note.listing_status` (except `NOT_LISTED`)

Evidence in code:
`mapNoteToDto` includes `marketplaceStatusLabel` computation.

### Issuer invoice card action menu (confirmed UI pattern)
In `apps/issuer/src/app/(application-management)/applications/components/scrollable-invoice-table.tsx`, there is an ellipsis menu using `EllipsisVerticalIcon` for invoice actions.

**What’s inside the invoice dropdown (confirmed by reading the UI snippet):**
- “View Signed Offer” when signed offer exists
- “View reason” under some condition
- “Withdraw Invoice” with disabled rules, including disabling when signed offer exists

**UNCLEAR / NEEDS CONFIRMATION (marketplace label rendering):**
There is DTO logic that provides `marketplaceStatusLabel` in `issuer-dashboard/service.ts`,
but an earlier document notes it may not be rendered in the invoice card UI.
In this run, we confirmed:
- the ellipsis menu exists
But we did not fully locate the invoice-card rendering component that would show the label.
So: **UNCLEAR / NEEDS CONFIRMATION** whether `marketplaceStatusLabel` is intentionally hidden in the invoice UI.

### Issuer application card action menu (confirmed partial)
In `apps/issuer/src/app/(application-management)/applications/page.tsx` we saw:
- ellipsis dropdown for application actions
- “Withdraw Application” disabled when signed offer exists
- “View Signed Offer” is conditional

---

## 5) Repayment schedule “paid amounts” fields

The Prisma model defines:
- `paid_principal`, `paid_profit`, `paid_total` in `NotePaymentSchedule`.
These fields exist and are mapped in `apps/api/src/modules/notes/mapper.ts`.

**UNCLEAR / NEEDS CONFIRMATION (paid amount updates):**
In the note code paths we inspected, we did not find updates that set:
- `NotePaymentSchedule.paid_principal`
- `NotePaymentSchedule.paid_profit`
- `NotePaymentSchedule.paid_total`

Therefore the code may be intentionally not updating them yet (paid amounts may be computed elsewhere), or updates live in a different module or code path not inspected in this run.

---

## 6) Late charges: how `tawidh` + `gharamah` are applied

The late charge flow is in `notes/service.ts`:
- `calculateLateCharge(...)` returns capped amounts based on:
  - platform finance settings (grace period, caps, defaults)
- `checkOverdueLateCharge(...)`
  - calculates days late
  - may set `servicing_status`:
    - `LATE` or `ARREARS`
- `applyOverdueLateCharge(...)` and subsequent admin actions:
  - (not fully expanded in this run)
- `approveLateCharge(...)` ensures:
  - no posted settlements exist

Settlement posting includes late charges in the waterfall:
- `calculateSettlementWaterfall` uses input tawidh/gharamah amounts
- settlement ledger credits:
  - `TAWIDH_ACCOUNT` and `GHARAMAH_ACCOUNT`

---

## 7) “UNCLEAR / NEEDS CONFIRMATION” checklist (from this run)

This section lists the specific open questions the code inspection did not fully resolve.

### A) `NoteStatus.CANCELLED`
- Found in `schema.prisma`
- Found referenced in `apps/api/src/modules/admin/repository.ts` in “closed statuses”
- Not found in `apps/api/src/modules/notes/service.ts` as a “cancel note” action

Status: **UNCLEAR / NEEDS CONFIRMATION**

### B) Payment/settlement “advanced” statuses
We confirmed:
- `NotePaymentStatus.RECONCILED` is included as eligible for settlement preview and is included in updates to `SETTLED`.
- `NotePaymentStatus.VOID` is used in `rejectPayment`.
We did NOT find in the inspected code a setter that moves a payment into `RECONCILED` directly.

We confirmed:
- `NoteSettlementStatus.VOID` exists in schema
- We did not find a method setting settlement status to `VOID` in `notes/service.ts` in this run.

We confirmed:
- `NoteServicingStatus.PARTIAL` and `NoteServicingStatus.ADVANCE_PAID` exist in schema
- We saw only these statuses mentioned in issuer dashboard KPI text in earlier analysis; not confirmed as set by note servicing paths in this run.

We confirmed:
- `NoteInvestmentStatus.CANCELLED` exists in schema
- We saw `createInvestment` and settlement updates; did not find a cancel path in this run.

Status: **UNCLEAR / NEEDS CONFIRMATION**

### C) Signed offer letter business validation
- Note creation checks only:
  - invoice status `APPROVED`
  - application status `COMPLETED`
- No explicit signed-content validation is shown in the inspected Note creation logic.

Status: **UNCLEAR / NEEDS CONFIRMATION**

### D) Repayment admin reconciliation rules (RECEIVED vs RECONCILED)
- Code allows:
  - pending issuer-submitted payments via `requiresAdminReview`
  - admin approve moves to `RECEIVED`
- But we didn’t confirm whether receipts must become `RECONCILED` in all flows.

Status: **UNCLEAR / NEEDS CONFIRMATION**

### E) Issuer payout tracking beyond ledger
- Ledger tracks obligations and payout completion using `ISSUER_PAYABLE` and withdrawal completion.
- We did not confirm whether trustee payout evidence/reconciliation exists beyond withdrawal letter + completed timestamps.

Status: **UNCLEAR / NEEDS CONFIRMATION**

### F) Paid schedule “paid amounts” fields
- `paid_principal`, `paid_profit`, `paid_total` exist
- mapper reads them
- inspected code did not update them

Status: **UNCLEAR / NEEDS CONFIRMATION**

### G) Issuer dashboard “available facility” rendering
- earlier analysis found the field appears in some UI
- we did not re-run this confirmation in this run.

Status: **UNCLEAR / NEEDS CONFIRMATION**

### H) Funding deadline field (`NoteListing.closes_at`)
- publish sets `closes_at` using `DEFAULT_LISTING_DURATION_DAYS`

Potential concern:
- whether `closes_at` is always present for all issuer/notes shown

Status: **UNCLEAR / NEEDS CONFIRMATION** (not fully audited across all flows)

### I) Repayment performance “fully paid date” logic ignoring payments without `schedule_id`
- This was confirmed earlier to ignore payments without `schedule_id` in issuer dashboard service.

Status: **UNCLEAR / NEEDS CONFIRMATION** whether that is always correct for real data scenarios.

### J) UI “marketplace label” and invoice card actions
- ellipsis menu exists for invoice card actions
- DTO label exists in issuer dashboard
- label rendering in invoice cards not fully confirmed

Status: **UNCLEAR / NEEDS CONFIRMATION**

---

## 8) Keywords found (high-signal pointers)

I ran repo searches (ripgrep) for keyword groups that match your list. Below are the key “where this appears” hits (files shown are where ripgrep found at least one keyword from the group):

1. `NoteListing / NoteInvestment / NotePaymentSchedule / NotePayment / NoteSettlement`
   - `apps/api/prisma/schema.prisma`
   - `apps/api/src/modules/notes/service.ts`, `apps/api/src/modules/notes/controller.ts`
   - `apps/api/src/modules/notes/mapper.ts`, `apps/api/src/modules/notes/repository.ts`
   - `apps/admin/src/notes/components/settlement-panel.tsx`
   - `apps/investor/src/investments/hooks/use-marketplace-notes.ts`
   - `docs/note-marketplace-ledger-bucket-balance-study-guide.md`

2. `bucket / bucket_balance / ledger / wallet`
   - `apps/admin/src/app/finance/buckets/page.tsx`
   - `apps/admin/src/components/bucket-balances-overview.tsx`
   - `apps/issuer/src/notes/components/ledger-panel.tsx`
   - `apps/admin/src/notes/components/ledger-panel.tsx`
   - `apps/api/src/modules/issuer-dashboard/service.ts`
   - `apps/api/src/modules/notes/service.ts`

3. `investment / marketplace / listing / payout / disbursement / repayment / repayments / trustee`
   - `apps/investor/src/app/investments/page.tsx`, `apps/investor/src/app/investments/[id]/page.tsx`
   - `apps/investor/src/investments/hooks/use-marketplace-notes.ts`
   - `apps/admin/src/app/finance/repayments/page.tsx`
   - `apps/admin/src/app/finance/issuer-payouts/page.tsx`
   - `apps/api/src/modules/notes/service.ts`
   - `apps/api/src/lib/jobs/note-listing-expiry.ts`

4. `facility / utilized_facility / approved_facility`
   - `apps/issuer/src/components/dashboard/financing-section.tsx`
   - `apps/issuer/src/app/financing/contracts/[id]/page.tsx`
   - `apps/api/src/modules/issuer-dashboard/service.ts`
   - `apps/api/src/modules/admin/service.ts` (facility snapshot updates during offers)

5. Status fields: `funding_status / servicing_status / listing_status / invoice_status / contract_status / application_status`
   - `apps/api/prisma/schema.prisma`
   - `apps/api/src/modules/notes/service.ts`
   - `apps/api/src/modules/admin/service.ts`
   - `apps/issuer/src/app/(application-management)/applications/components/scrollable-invoice-table.tsx`
   - `apps/issuer/src/app/(application-management)/applications/page.tsx`
   - `docs/issuer-dashboard-wiring-and-kpi-guide.md`

6. `offer / signing / SigningCloud`
   - `apps/api/src/modules/applications/service.ts`
   - `apps/api/src/modules/admin/service.ts`
   - `apps/api/src/modules/signingcloud/*`
   - `apps/issuer/src/components/review-offer-modal.tsx`
   - `apps/issuer/src/app/(application-management)/applications/sign/components/OfferSignView.tsx`

7. UI phrase: `progress bar`
   - `packages/help-content/markdown/issuer-start-financing-application.md`


---

## 9) What to use to generate visual diagrams later

If another AI wants to draw diagrams, the most useful “nodes” are:
- `Application` (Issuer flow)
- `Contract` / `Invoice` (approval + offer acceptance)
- `Note` and `NoteListing` (marketplace)
- `NoteInvestment` and `InvestorBalance` (wallet/commitment)
- `WithdrawalInstruction` (trustee letter + submission + completion)
- `NotePayment` + `NotePaymentSchedule` (repayment receipts + expected schedule)
- `NoteSettlement` (waterfall preview/approval/posting)
- `NoteLedgerAccount` + `NoteLedgerEntry` (bucket balance)

And the most useful “edges” are:
- `InvoiceStatus.APPROVED` → `createFromInvoice` → `NoteStatus.DRAFT` → publish
- `NoteInvestmentStatus.COMMITTED` increments `funded_amount`
- `closeFunding` → creates `ISSUER_DISBURSEMENT` withdrawal + posts disbursement ledger
- `markWithdrawalCompleted(ISSUER_DISBURSEMENT)` via activation gating → note becomes `ACTIVE`
- `recordPayment(RECEIVED)` → posts `REPAYMENT_POOL` credit
- `postSettlement` → posts ledger entries + credits investor balances + creates residual return withdrawal (if any)
- `markWithdrawalCompleted(ISSUER_RESIDUAL_RETURN)` → debits `ISSUER_PAYABLE` and may set note `REPAID` when all residuals completed

