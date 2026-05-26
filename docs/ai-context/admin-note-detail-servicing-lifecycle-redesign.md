# Admin Note Detail Servicing Lifecycle Redesign Context

## Purpose
This file records all current Admin Note Detail servicing/disbursement/settlement UI before redesign so we can restructure the layout later without accidentally removing any admin-visible field/action/status/message that currently exists (including anything that only appears under specific conditions).

## Hard rules
- UI-only restructure first.
- Do not change backend/database/API/calculation logic.
- Do not remove any existing admin-visible field/action/status/message.
- All existing UI must be retained, moved, renamed carefully, or represented in the new structure.
- Disbursement should be separated from servicing lifecycle (but the current UI is intentionally mixed; see “Current issues”).
- Servicing lifecycle should present clear step-by-step business order.
- Completed steps should be visually distinct, using the same green completion style already used in the page (see `SECTION_COMPLETE_CLASS` / `SECTION_COMPLETE_HEADER_CLASS`).

## Scope / “what this covers”
Admin Note Detail page sections currently rendered around:
- Note Lifecycle / Servicing Lifecycle (next-step buttons + stage stepper + sub-steppers)
- Issuer Disbursement (via `IssuerPayoutCard` when awaiting payout)
- Shoraka STP block (inside `IssuerPayoutCard` for issuer disbursement)
- Beneficiary (inside `IssuerPayoutCard`)
- Disbursement timeline (inside `IssuerPayoutCard`)
- Repayment receipts
- Settlement & waterfall (preview → approve → post)
- Late fees (Ta'widh / Gharamah caps, suggested/custom, queued locally for preview)
- Settlement waterfall complete state
- Trustee instruction / service fee workflow (generate PDF → mark submitted → mark complete)
- Issuer residual refund (either `IssuerPayoutCard` or informational message)
- Arrears and default documents (generate letters → view/download → mark default)
- Ledger (ledger table + export)
- Activity Timeline on the right side (note events, including generated documents)

## Current UI inventory

### 0) Page layout / where sections live
**File:** `apps/admin/src/app/notes/[id]/page.tsx`

When `note` is loaded:
- Header + “Featured” toggle + `NoteStatusBadge`
- `NoteLifecycleCard` (Note Lifecycle / servicing progression + next-step actions)
- Two-column grid:
  - **Left column:** `NoteTermsPanel`, `SettlementPanel`, `LedgerPanel`
  - **Right column:** `SourceApplicationPanel`, `NoteTimelinePanel`
- `NoteInvestorsPanel` rendered below the grid

> Note: `NoteTermsPanel` is adjacent in the left column and is not part of the servicing redesign scope, but it is visible on the same page and must remain represented.

### 1) Note Lifecycle / Servicing Lifecycle (stage stepper + next-step actions)
**File:** `apps/admin/src/notes/components/note-lifecycle-card.tsx`

#### Section header / status text
- “Note Lifecycle” label (muted uppercase)
- Main header text depends on state:
  - “Note fully repaid” when `note.status === "REPAID"` or `note.servicingStatus === "SETTLED"`
  - Terminal failure banners for:
    - “Funding failed” when `note.status === "FAILED_FUNDING"` or `note.fundingStatus === "FAILED"`
    - “Cancelled” when `note.status === "CANCELLED"`
    - “Defaulted” when `note.status === "DEFAULTED"` (description: servicing default reached; settle outstanding via servicing panel)
  - “Repayment in progress” or “Awaiting issuer disbursement” based on settlement/writ instructions:
    - awaiting residual when posted settlement exists and `ISSUER_RESIDUAL_RETURN` withdrawal is pending
    - awaiting disbursement when active index is funding-close stage and `ISSUER_DISBURSEMENT` withdrawal is pending

#### Stage stepper (always rendered)
Stages shown in order:
1. Draft (`DRAFT`)
2. Published (`PUBLISHED`)
3. Funded (`FUNDED`)
4. Active (`ACTIVE`)
5. Repaid (`REPAID`)

Active/past/complete visuals are controlled by:
- completion (`note.status === "REPAID" || note.servicingStatus === "SETTLED"`)
- terminal failure stage index (`FAILED_FUNDING`, `CANCELLED`, `DEFAULTED`)
- otherwise computed “active stage index”:
  - repaid/settled/posted settlement → last stage index (4)
  - active/arreas/defaulted/current servicing → stage 3
  - funded/funding threshold → stage 2
  - published → stage 1
  - else draft

#### Service fee internal workflow sub-stepper (conditional)
Rendered only when `postedSettlementWithServiceFee` exists (`note.settlements` contains `status === "POSTED"` and `serviceFeeAmount > 0.005`) and not in terminal failure.

Sub-step labels:
- “Settlement posted”
- “Trustee letter generated”
- “Submitted to trustee”
- “Instruction completed”

Helper text shown below the sub-stepper depends on `serviceFeeTrusteeStatus`:
- `COMPLETED`: “Service fee trustee instruction workflow is complete…”
- `SUBMITTED_TO_TRUSTEE`: “Mark the instruction complete…”
- `LETTER_GENERATED`: “Submit the PDF to the trustee…”
- default: “Generate the PDF from Trustee instruction — service fee (internal pools)…”

#### Issuer payout sub-stepper (conditional)
Rendered when awaiting residual or awaiting disbursement:
- “Issuer residual refund · awaiting disbursement”
- “Issuer disbursement · awaiting payout to start servicing”

Sub-steps:
- “Initiated”
- “Letter generated”
- “Submitted to trustee”
- “Disbursed”

Progress summary line:
- `{done} of {total} steps complete`

#### Auto-close info card (conditional)
Rendered when `autoClose` exists (funding status open + listing closes at exists):
- Border/card styling changes by “fullyFunded” vs “overdue” vs neutral
- Text includes:
  - “Fully funded — auto-closing…”
  - or “Listing past auto-close…” / “Auto-closes in…”
- Extra descriptive text includes formatted target and close schedule.

#### Next Step action card (conditional)
Shown when NOT terminal failure, NOT complete, and there is a primary/secondary action.

Primary/secondary actions are based on `buildActionPlan(note)`:
- Primary:
  - “Publish to Marketplace” (when draft + not open funding + listing status allows)
  - “Close Funding” (when funding open and minimum reached)
  - “Fail Funding” (when funding open but below minimum)
- Secondary (optional):
  - “Unpublish” when allowed

Buttons disabled when:
- `anyPending` (from parent pending action flags)
- for primary button, also disabled when `pending[primary.key]` is true.

### 2) Servicing Lifecycle (main card inside `SettlementPanel`)
**File:** `apps/admin/src/notes/components/settlement-panel.tsx`

Top-level:
- Card title: “Servicing Lifecycle”
- Helper text: “Manage maturity-driven servicing: receipts, late fees, settlement, arrears letters, and default actions.”
- Pending banner (conditional):
  - If `pendingPayments.length > 0`, show `{count} pending review`

#### 2.1) Awaiting issuer disbursement card (conditional, pre-servicing)
Conditional wrapper:
- Renders only if `disbursementWithdrawal` exists
- and its `status !== "COMPLETED"` and `status !== "CANCELLED"`

Section banner:
- Heading: “Awaiting issuer disbursement”
- Description: funding has closed; net amount must be paid via trustee before servicing begins; after disbursement completion note moves to ACTIVE and repayment receipts can be recorded.

Inside it:
- `IssuerPayoutCard` with:
  - `kind="DISBURSEMENT"`
  - `servicingBlockedReason={null}`

#### 2.2) Summary metrics grid (always rendered in this card)
Shows (4 tiles):
1. “Invoice settlement amount”
   - Big number: `formatCurrency(settlementAmount)`
   - Helper text about receipts totaling and Ta'widh/Gharamah taken from pool in waterfall.
2. “Payment due / maturity”
   - `paymentDueDateLabel`
   - `maturityTimingLabel`
   - If payment due date differs from note maturity date: “Contractual maturity {maturityDateLabel}”
3. “Grace and Arrears”
   - `{note.gracePeriodDays} + {note.arrearsThresholdDays} days`
4. “Late Fee Caps”
   - “Ta'widh {note.tawidhRateCapPercent}%”
   - “Gharamah {note.gharamahRateCapPercent}% cap”

#### 2.3) Repayment receipts section
Main wrapper styling:
- If `repaymentReceiptsSectionComplete`: green “Repayment receipts complete” header
- Else if `repaymentReceiptsNeedAttention`: amber action-card styling
- Else: muted background.

Header row:
- “1. Repayment receipts”
- Helper: “Record paymaster or issuer receipts, approve issuer submissions, then preview settlement when open receipts reach the invoice amount.”

Primary actions:
- Button “Record receipt”:
  - Calls `handleOpenRecordPaymentDialog`
  - Disabled when `recordPayment.isPending` or `!canRecordMoreReceipts`

Additional conditional warning:
- If NOT complete, cannot record more receipts, there are `paymentActionsOpen`, and `settlementAmount > 0.005`:
  - Shows: “Open receipts already reach the invoice settlement amount. Record receipt is disabled until receipts are reduced or the settlement amount changes.”

Metrics row (3 values):
- “Open receipts” = `openReceiptTotal`
- “Invoice settlement” = `settlementAmount`
- “Remaining to record” = `receiptRemainingAmount`

Pending approval banner (conditional):
- If `pendingPayments.length > 0`:
  - “{count} issuer payment(s) awaiting approval before you can preview settlement.”

Servicing blocked banner (conditional):
- If `servicingBlockedReason`:
  - Amber bordered message with that reason.

Empty state (conditional):
- If `note.payments.length === 0`:
  - Dashed empty state “No repayment receipts yet.”
  - Button “Record first receipt”:
    - opens record dialog
    - disabled={!canRecordMoreReceipts}

Receipts list (conditional):
- Else renders list of `sortedPayments`.
- Each payment card:
  - Shows receipt amount as formatted currency
  - Status badge variant depends on status (`PENDING`, `VOID`, else outline)
  - Badge “Counts toward settlement” when that payment is included (`includedPaymentIds`)
  - Badge for payment source:
    - “Paymaster”
    - “Issuer on behalf (requires approval in list)”
    - “Admin adjustment”
  - Timestamp: `dd MMM yyyy, h:mm a` plus optional `payment.reference`
  - Text: “Received into {payment.receivedIntoAccountCode}”
  - If payment status is `PENDING`:
    - Buttons:
      - “Approve” (disabled when approvePayment is pending or !paymentActionsOpen)
      - “Reject” (variant destructive; disabled when rejectPayment is pending)
    - Optional input:
      - Input for “Optional rejection reason” shown under the card.

#### 2.4) Settlement & waterfall section (preview → approve → post)
Main wrapper styling:
- If `settlementWaterfallSectionComplete`: green completion style with “Settlement posted”
- Else if `settlementSectionNeedAttention`: amber action style
- Else muted/neutral.

Header block:
- “2. Settlement & waterfall”
- Helper text depends on late-fee context:
  - If showOverdueFeesSection: “Late fees are only booked to the ledger when settlement is posted…”
  - else: “Preview settlement to calculate the waterfall, then approve and post.”

Step list (ordered list):
1. “Record and approve repayment receipts.”
2. If overdue fees section: “Apply suggested or custom late fees.”
3. “Preview settlement” (text changes when overdue fees are present)
4. Approve then post (text changes when overdue fees are present)

Receipts included in settlement (conditional)
Shown only when `settlementEligiblePayments.length > 0`:
- Title: “Receipts included in settlement”
- Large number: eligibleReceiptTotal
- Subtitle:
  - `{count} receipt(s) aggregated · settlement requires {activeSettlementRequiredAmount} invoice settlement`
- Badge:
  - If `eligibleReceiptTotal + 0.005 >= activeSettlementRequiredAmount`: “Fully covered” with check icon
  - Else outline badge with remaining amount.
- If >1 eligible payment: list of each receipt:
  - formatted date
  - source label
  - optional reference
  - amount

If no eligible receipts:
- Dashed empty state: “No eligible receipts yet. Record one or more payments above to build the settlement total.”

Settlement action messages:
- If `settlementActionBlockedReason`: amber bordered message
- Else if `settlementReadyMessage`: green bordered message

Late fees section
Only appears when `showOverdueFeesSection` is true (overdue or late-fee ledger activity exists).

When visible as “Late fees”:
- Title: “Late fees”
- Paragraph explains:
  - caps from payment due + grace
  - fees come from settlement receipt pool not on top
  - optionally includes profit accrual maturity date mismatch messaging
  - available late-fee headroom statement (confirmed now or “during preview”)

Right-side badges:
- `overdueSnapshot.label` shown as secondary badge
- If `pendingLateFeeTotal > 0.005`:
  - badges for queued Ta'widh and Gharamah amounts
  - badges indicate whether queued for preview or in preview
  - destructive badge if exceeds headroom

Late fee input area:
- Input label: “Ta'widh investor share”
- Explanation: optional percentage returned to investors; total Ta'widh still reduces issuer residual
- Input field includes percent suffix “%”
- Disabled when not servicingOpen or when (Number(tawidhAmount) || 0) <= 0
- Shows computed “{formatCurrency(pendingTawidhInvestorAmount)} to investors”

Apply/custom actions row:
- Text message changes based on:
  - headroom fully used
  - queued locally state (`feesNeedPreview`)
  - preview state saved
  - whether pendingLateFeeTotal > 0.005
- Buttons:
  - “Apply suggested fees”
    - disabled while checking OR !noteIsOverdue OR !servicingOpen OR blocked by zero headroom
    - shows “Checking…” when pending
  - “Custom amounts”
    - disabled while checking OR !noteIsOverdue OR !servicingOpen

When late fees section is NOT overdue:
- It renders an alternative info block:
  - “Late fees”
  - “No Ta'widh or Gharamah for this settlement… Checked against payment due … plus grace — {overdueSnapshot.label.toLowerCase()}.”
  - Shows badges “RM 0.00” and overdue label.

Settlement preview/approve/post button row
- Contains 3 buttons and one helper text line:
  - Primary: “Preview settlement” (label changes):
    - If settlementInputsDirty: “Preview settlement (update inputs)” or includes `(+{pendingLateFeeTotal} fees)` depending on fees queue
    - helper text changes:
      - preview saves queued late fees into settlement row and opens waterfall
      - preview saved message
      - “Generate a preview after receipts reach the invoice settlement amount.”
  - Secondary: “Approve”
    - disabled when !canApproveSettlement OR approveSettlement.isPending OR !servicingOpen
  - Secondary: “Post”
    - disabled when !canPostSettlement OR postSettlement.isPending OR !servicingOpen

Waterfall calculation table (conditional)
Rendered only when `displayedSettlement` is truthy.
Includes:
- Wrapper card with:
  - Optional “Settlement waterfall complete” header when `settlementWaterfallSectionComplete` (persistedPostedSettlement != null)
- Section title: “Waterfall Calculation”
- Explanations:
  - starts with gross receipt; allocates each bucket until remaining balance is known
  - profit locked interval and behavior for early/late settlement
  - optional investor profit gross/split explanation if gross profit >0.005
- Badge: “Settlement due {formatCurrency(settlementAmount)}”

Table header:
- Grid columns labeled “Calculation”, “Destination”, “Amount”, “Balance”

Rows: `waterfallRows` rendered in order with:
 - each row’s sign (+ or -)
 - label and optional detail text
 - destination string
 - amount `formatCurrency(row.amount)`
 - runningBalance `formatCurrency(row.runningBalance)`

Footer row:
- “Remaining in Repayment Pool” / “Unapplied” and the displayed unapplied amount.

Bucket summary cards (pool summary)
5 cards:
 - Repayment Pool
 - Investor Pool
 - Operating Account
 - Ta'widh Account
 - Gharamah Account
Each card includes a label, numeric value, and description.

Issuer residual refund (conditional, within waterfall area)
If `residualWithdrawal` exists:
- renders `IssuerPayoutCard` with:
  - `kind="RESIDUAL"`
  - `servicingBlockedReason={null}`
Else if `waterfallIssuerResidual > 0.005`:
- renders dashed informational box:
  - “Issuer residual refund: {formatCurrency(waterfallIssuerResidual)} will be returned… after Post.”
  - says trustee withdrawal letter will be auto-prepared once settlement is posted.

Trustee instruction / service fee workflow (conditional, within waterfall area)
Rendered only when:
- `persistedPostedSettlement` exists and `persistedPostedSettlement.serviceFeeAmount > 0.005`

Card styling depends on:
- `serviceFeeTrusteeNeedsPdf` (destructive border, “Action required — trustee instruction PDF not generated”)
- workflow completion status:
  - `serviceFeeTrusteeWorkflowComplete` indicates “Service fee trustee instruction complete”
  - otherwise “Trustee workflow in progress”

Header text:
- “Trustee instruction — service fee (internal pools)”

Helper paragraph:
- explains documents allocation of service fee from Repayment pool to Operating account for posted settlement
- clarifies it is not a bank payout and ledger entries were created when settlement was posted.

Status line:
- “Status: {serviceFeeTrusteeStatusLabel(serviceFeeTrusteeStatus)}”
- optionally shows “Submitted …” and/or “Completed …” timestamps when those fields exist

Buttons (right side):
- “Generate PDF”
  - disabled when `serviceFeeTrusteeLetterLocked || serviceFeeTrusteePendingAny`
- If status is `LETTER_GENERATED`:
  - “Mark submitted to trustee” (enabled only when appropriate and not pending)
- If status is `SUBMITTED_TO_TRUSTEE`:
  - “Mark complete”

Warnings:
- If `serviceFeeTrusteeNeedsPdf`:
  - shows “No PDF generated… Generate before marking complete.”

Generated letters list (conditional):
- If `serviceFeeTrusteeLetters.length > 0`:
  - list items show:
    - document title “Service fee pool transfer”
    - created timestamp
    - s3Key display
    - View button (DocumentTextIcon) and Download button (ArrowDownTrayIcon)
- If there is a service fee trustee posted settlement but PDFs not generated yet:
  - “Letter events will appear here after you generate the PDF.”

If no displayedSettlement (i.e., no preview):
- shows dashed: “No settlement preview generated yet.”

#### 2.5) Arrears and Default Documents section
Card wrapper styling:
- `documentActionAvailable && ACTION_CARD_CLASS` when actions available

Header:
- “4. Arrears and Default Documents”
- helper: “Generate lifecycle letters tied to the maturity, grace, arrears, and default workflow.”

Buttons:
- “Generate Arrears Letter” (outline)
  - disabled when arrearsLetter.isPending
- “Generate Default Letter” (outline)
  - disabled when defaultLetter.isPending

Generated Letters sub-section:
- Title: “Generated Letters”
- Subtitle: “Arrears and default PDFs generated for this note.”
- If `generatedLetters.length > 0`: shows badge with count

Empty state:
- “No letters generated yet.”

Letters list:
- Each letter card shows:
  - icon: DocumentTextIcon
  - label: “Arrears letter” or “Default letter”
  - createdAt formatted
  - s3Key monospace if available
  - If s3Key exists:
    - View button (ViewDocument)
    - Download button (DownloadDocument with filename `${letter.type.toLowerCase()}-letter-${note.noteReference}.pdf`)

Default reason + action row:
- Input placeholder: “Default reason”
- Button “Mark Default” (destructive)
  - disabled when markDefault.isPending OR !canMarkDefault

#### 2.6) Dialogs / modals present (admin actions)
1. **Record repayment receipt dialog**
   - Title: “Record repayment receipt”
   - Shows:
     - “Already recorded (open)” openReceiptTotal
     - “Remaining capacity” receiptRemainingAmount
     - Receipt amount input + “Fill remaining” button
     - Payment source select:
       - “Paymaster”
       - “Issuer on behalf (requires approval in list)”
     - Payment reference input
     - Conditional note if issuer on behalf selected
   - Footer:
     - Cancel button (outline, disabled when recordPayment pending)
     - “Record receipt” confirm button (“Recording…” when pending)

2. **Custom late fee amounts dialog**
   - Title: “Custom late fee amounts”
   - Shows:
     - Overdue days (lateChargeResult?.daysLate or overdueSnapshot.daysOverdue)
     - Remaining Ta'widh cap + Remaining Gharamah cap
     - Input mode select: “Amount” vs “Percentage”
     - Inputs:
       - Ta'widh (percent or amount depending on mode)
       - Gharamah (percent or amount depending on mode)
     - Summary:
       - “Total to apply: …”
       - “Ta'widh … · Gharamah …”
     - Info note: queued into settlement preview; not posted immediately
   - Footer:
     - Cancel (outline) closes
     - “Queue fees” confirm

3. **Service fee trustee confirmation AlertDialog**
   - Shown when user sets `serviceFeeTrusteeConfirm`:
     - Title differs:
       - “Submit to trustee?”
       - “Mark instruction complete?”
     - Confirm labels:
       - “Mark submitted”
       - “Mark complete”
   - Cancel disabled when any related mutations pending

4. **Settlement confirm AlertDialog**
   - Title:
     - “Approve settlement?” or “Post settlement to ledger?”
   - Description differs:
     - Post: mentions ledger entries and no undo; also describes residual closure behavior
     - Approve: locks preview waterfall for posting; still can re-preview if inputs change
   - Buttons:
     - Cancel disabled while approve/post pending
     - Confirm button label:
       - “Confirm Approve” or “Confirm Post”
       - shows “Approving…” / “Posting…” when pending

### 3) Issuer Disbursement + Beneficiary + Shoraka STP (via `IssuerPayoutCard`)
**File:** `apps/admin/src/notes/components/issuer-payout-card.tsx`

This component is used for both:
- `kind="DISBURSEMENT"` (issuer disbursement pre-servicing)
- `kind="RESIDUAL"` (issuer residual refund post-settlement)

Inventory below focuses on issuer disbursement (`kind="DISBURSEMENT"`), but the beneficiary + timeline + letter generation logic is shared.

#### 3.1) Card status block (always shown)
- Card container styling:
  - Completed: `SECTION_COMPLETE_CLASS`
  - Action-available: `ACTION_CARD_CLASS`
  - otherwise: neutral `bg-card`

Completion header (conditional):
- “Issuer disbursement complete” when `status === "COMPLETED"` and kind disbursement
- “Issuer residual refund complete” when kind residual

Status badge and title:
Status mapping:
 - `DRAFT` → “Draft — letter not yet generated”
 - `LETTER_GENERATED` → “Letter generated — awaiting trustee submission”
 - `SUBMITTED_TO_TRUSTEE` → “Submitted to trustee — awaiting confirmation”
 - `COMPLETED` → “Disbursed”
 - `CANCELLED` → “Cancelled”

The card title is `kindCopy.title`:
- DISBURSEMENT: “Issuer Disbursement”
- RESIDUAL: “Issuer Residual Refund”

Description text (conditional on kind):
- Disbursement:
  - “Net funded proceeds owed to the issuer at funding close… Disbursed from the Investor Pool via the Issuer Payable ledger account.”
  - completion confirm text includes “flip the note from FUNDING to ACTIVE so servicing can begin…cannot be undone.”
- Residual:
  - “Residual amount owed… after investor allocation, service fee, late-fee accounts… Issued from the Repayment Pool…”
  - completion confirm text includes “flip the note to REPAID…cannot be undone.”

Amount line:
- “{formatCurrency(withdrawal.amount)} — {description}”
- Right-aligned “Amount” and numeric value

#### 3.2) Disbursement breakdown (conditional)
Only when:
- withdrawalType == `ISSUER_DISBURSEMENT`
- grossFundedAmount/platformFeeAmount/netIssuerDisbursement are non-null

Shows:
- “Disbursement breakdown” section:
  - Gross funded
  - Platform fee
  - Facility fee (conditional render):
    - rendered only when `withdrawal.facilityFeeCharged != null` (in current code after our earlier display updates)
  - Net to issuer

#### 3.3) Shoraka STP block (issuer disbursement only; conditional)
Rendered only when:
- withdrawal.withdrawalType === `ISSUER_DISBURSEMENT`

Sub-logic inside:
1. When `shorakaStateQuery.isPending`:
   - “Checking Shoraka certificate status…”

2. When `shorakaStateQuery.data == null`:
   - “Status: Not submitted”
   - “Next action: Submit Shoraka order”
   - Primary button: “Submit Shoraka Order”
     - disabled when:
       - submitShorakaOrder.isPending
       - `isMalaysiaUnsafeShorakaSubmitWindow` is true
   - If Malaysia unsafe window:
     - amber bordered warning with `shorakaUnsafeSubmitWindowMessage`:
       - “Shoraka orders cannot be submitted between 11:30 PM and 12:30 AM MYT…”

3. When `shorakaStateQuery.data` is present:
   - Displays Shoraka internal provider state:
     - “Status: {step.status}”
     - “Next action: {step.nextAction}”
   - Optional fields shown if available:
     - Order ID (tradeOrder.provider_order_id)
     - Order date (parsed.orderDate)
     - Value date (parsed.valueDate)
     - Order date/value date explanatory line if either date exists
     - Order amount (parsed.orderAmount)
     - Murabaha amount (parsed.murabahaAmount)
     - Status source when available
     - Callback received timestamp when available
     - Last checked timestamp when available
   - Certificate controls shown based on operationalStatus + certificate presence:
     - Button “Fetch Certificate” (disabled when fetchShorakaCertificate.isPending) when completed but certificate not ready (operational provider status Completed and !hasCertificate)
     - Button “View Certificate” when `tradeOrder.certificate_s3_key` exists (disabled when viewDocumentPending)

Disbursed gating / disable logic:
- “Mark Disbursed” button is gated by Shoraka certificate fetch & state:
  - `markDisbursedDisabledBecauseShoraka` disables “Mark Disbursed” when:
    - shorakaStateQuery pending/error
    - tradeOrder missing
    - no Shoraka certificate
  - Helper text displayed in right-aligned helper area:
    - when pending: “Checking Shoraka certificate status…”
    - on error: “Unable to verify…”
    - else: “Shoraka certificate must be fetched before marking…”

#### 3.4) Beneficiary section (always shown in IssuerPayoutCard)
Title: “Beneficiary”
Header includes edit control:
- If `status === "DRAFT"`:
  - shows “Edit” with pencil icon
  - opens beneficiary dialog

Fields displayed:
- Bank: bank_name or “missing” (amber)
- Account: account_number or “missing” (amber)
- Holder: account_holder (only if present)

Beneficiary dialog (conditional):
- Dialog title: “Edit issuer beneficiary details”
- Prefilled-from text depends on whether snapshot contains bank_name.
- Inputs for each beneficiary field:
  - Bank Name
  - Account Number
  - Account Holder
  - SWIFT / BIC Code
  - Branch
  - Reference / Note
- Cancel + “Save Beneficiary” buttons (disabled when pendingAny)

Beneficiary completion guard:
- Generate Letter action disabled unless:
  - current beneficiary has bank_name.trim() != "" AND account_number.trim() != ""

#### 3.5) Disbursement timeline sub-section
Title: “Timeline”
Shows timestamps (each conditional):
- Created: always (`withdrawal.createdAt`)
- Letter generated: if `withdrawal.generatedAt`
- Submitted to trustee: if `withdrawal.submittedToTrusteeAt`
- Completed: if `withdrawal.completedAt`

#### 3.6) Letter / disbursement action buttons
At bottom (right-aligned action row):

Document actions:
- If `withdrawal.letterS3Key` exists:
  - Button “View Letter”
    - variant outline
    - disabled while viewDocumentPending
- Additionally:
  - in current code, the “View Letter” label becomes:
    - “Opening…” when viewDocumentPending is true

Workflow actions based on `status`:
- `DRAFT`:
  - Button “Generate Letter”
    - disabled when:
      - pendingAny
      - !beneficiaryComplete
    - on click triggers AlertDialog confirmation flow (confirmAction="generate")
- `LETTER_GENERATED`:
  - Button “Mark Submitted to Trustee”
    - disabled when pendingAny
    - confirmAction="submit"
- `SUBMITTED_TO_TRUSTEE`:
  - Button “Mark Disbursed”
    - disabled when pendingAny OR markDisbursedDisabledBecauseShoraka
    - confirmAction="complete"
  - If helper text exists:
    - show helper string under the buttons (right-aligned)

Pending indicator:
- If pendingAny:
  - shows “Working…” with spinning icon.

AlertDialog confirmation copy (conditional):
- Generate:
  - Title “Generate trustee letter?”
  - Description includes the withdrawal amount and notes beneficiary can only be re-edited in Draft.
  - Confirm label “Generate Letter”
- Submit:
  - Title “Mark letter as submitted to trustee?”
  - Confirm label “Mark Submitted”
- Complete:
  - Title depends on kind:
    - “Mark issuer disbursement complete?”
    - “Mark issuer residual disbursement complete?”
  - Description uses `kindCopy.completeConfirm(...)` including “cannot be undone”
  - Confirm label “Confirm Complete”

## 4) Ledger
**File:** `apps/admin/src/notes/components/ledger-panel.tsx`

Section title: “Ledger”
Header helper:
- Explains platform buckets as columns
- Rows are postings
- Column nets are running balance for this note

Actions:
- “Export CSV” button
  - disabled when entries.length === 0
  - builds CSV with:
    - header: postedAt, description, then each bucket code
    - each ledger entry row with signed bucket amounts
    - footer row labeled “NET” with bucket totals

Conditional render:
- isLoading → skeleton
- entries.length === 0 → “No ledger entries posted yet.”
- else → ledger table:
  - column headers:
    - Posted
    - Description
    - bucket short labels
  - rows:
    - each entry shows posted timestamp and description
    - bucket amounts computed depending on matching accountCode
  - bottom “Net (this note)” row shows signed bucket totals.

## 5) Timeline: Activity Timeline (right panel, note events)
**File:** `apps/admin/src/notes/components/note-timeline-panel.tsx`

Always rendered in right column beneath SourceApplicationPanel.

Header:
- Title: “Activity Timeline”
- Subtitle: “Note events, admin actions, generated letters, and settlement activity”
- Total badge: shows `totalCount` when >0

Empty state:
- If `note.events.length === 0`: “No activity logs found”

Events list:
- Scroll area with vertical timeline line
- Iterates `note.events.map(...)` in array order (backend is ordered by created_at desc)
- For each event:
  - Dot color determined by event type (getEventDotColor)
  - First event (index 0) has ring highlight
  - Icon determined by event type (`getEventIcon`)
  - Label from `formatEventLabel(event.eventType)`
  - Actor:
    - `event.actorUserId ?? "System"`
  - Optional portal label:
    - `event.portal`
  - Relative timestamp:
    - `formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })`
  - Metadata:
    - compact metadata badges from `event.metadata` excluding s3Key
    - prose metadata blocks for longer text fields
  - Generated document area (conditional):
    - when metadata contains `s3Key`
    - shows:
      - “Generated document”
      - s3Key display (monospace)
      - buttons:
        - View PDF (handleViewDocument)
        - Download (handleDownloadDocument with buildFileName)
    - disabled during viewDocumentPending

## Current issues (to capture for redesign)
1. **Issuer Disbursement currently appears inside “Servicing Lifecycle”.**
   - In code: SettlementPanel renders an “Awaiting issuer disbursement” banner plus `IssuerPayoutCard` inside the Servicing Lifecycle card.
2. **UI mixes “pre-servicing” steps with maturity-driven servicing actions.**
   - Disbursement is a prerequisite to active servicing, but it is shown as part of the same servicing panel.
3. **Completed vs pending sections are not visually distinct enough across all sub-sections.**
   - Some parts use `SECTION_COMPLETE_CLASS`, but other sub-sections rely on mixed conditional wrappers.
4. **Shoraka certificate needs a persistent place to view later.**
   - Current certificate view button exists inside `IssuerPayoutCard` only when the Shoraka state data is loaded; after disbursement is marked complete, certificate visibility may require re-open depending on lifecycle transitions.
5. Must later support issuer-side certificate visibility; redesign context must keep existing admin “View Certificate” capability.

## Proposed high-level structure for next phase (no implementation yet)
This is a recommended structure that preserves every existing UI item in the new layout.

1. Funding & Issuer Disbursement
   - Funding closed state / checklist
   - “Issuer Disbursement” card (gross funded, platform fee, facility fee, net to issuer)
   - Shoraka STP workflow
   - Trustee letter generation + submission/complete
   - Beneficiary details + edit + timeline
   - Disbursement timeline / mark disbursed gate + helper texts

2. Servicing Lifecycle
   - Activated/servicing status messaging
   - Repayment receipts
   - Settlement & waterfall (preview → approve → post)
   - Trustee instruction / service fee workflow (generate PDF → mark submitted → mark complete)
   - Late fees (caps + suggested/custom input and queuing behavior)
   - Issuer residual refund (payout card OR info box)
   - Arrears & Default documents (generate letters, view/download, default reason, mark default)

3. Ledger / Audit
   - Ledger panel + export CSV
   - Activity timeline panel (note events with generated document links)

## Current files involved
- `apps/admin/src/app/notes/[id]/page.tsx` (layout + column placement)
- `apps/admin/src/notes/components/note-lifecycle-card.tsx` (Note Lifecycle / next steps / sub-steppers)
- `apps/admin/src/notes/components/settlement-panel.tsx` (servicing lifecycle container + repayment/settlement/late fee/letters)
- `apps/admin/src/notes/components/issuer-payout-card.tsx` (issuer disbursement + residual refund + Shoraka STP + beneficiary dialog + timeline + letter workflow)
- `apps/admin/src/notes/components/ledger-panel.tsx` (ledger table + export CSV)
- `apps/admin/src/notes/components/note-timeline-panel.tsx` (activity timeline list + generated document links)
- (Also visible on the page but not expanded here unless required)
  - `apps/admin/src/notes/components/note-terms-panel.tsx` (Commercial Terms, left column)
  - `apps/admin/src/notes/components/source-application-panel.tsx` (right column)
  - `apps/admin/src/notes/components/note-investors-panel.tsx` (below grid)

## Redesign checklist (must exist after redesign)
Every item below must still exist in some form after the redesign:

### Must-keep UI items (by section)
1. Note Lifecycle / Servicing
   - Stage stepper dots + labels
   - Terminal failure badges + descriptive text
   - Auto-close card text
   - Service fee internal pool workflow sub-stepper + helper copy
   - Issuer payout sub-stepper + helper that points to settlement panel card
   - Next step action card + Publish/Close Funding/Fail Funding/Unpublish buttons + pending disabling behavior

2. Funding & Disbursement (current pre-servicing card)
   - “Awaiting issuer disbursement” banner
   - IssuerPayoutCard for DISBURSEMENT:
     - status badge + title
     - amount line + description
     - disbursement breakdown (gross funded, platform fee, facility fee if charged or null gating as implemented, net to issuer)
     - Shoraka STP workflow:
       - checking state
       - not submitted state + Submit Shoraka Order button + unsafe-window message
       - status/next action + optional order/value/murabaha fields + callback received/last checked
       - Fetch Certificate + View Certificate buttons
       - mark disbursed gating helper text
     - Beneficiary panel:
       - edit button only in Draft
       - beneficiary dialog inputs + save/cancel
     - Timeline block: created, letter generated, submitted to trustee, completed
     - Letter/disbursement action buttons:
       - View Letter
       - Generate Letter (with beneficiary guard)
       - Mark Submitted to Trustee
       - Mark Disbursed
     - confirmation AlertDialog copies

3. Repayment receipts (inside Servicing Lifecycle card)
   - Section header + Record receipt/Record first receipt buttons
   - Open receipts metrics + remaining capacity metrics
   - Pending issuer payment approval warning banner
   - servicingBlockedReason amber banner
   - receipts list:
     - amount + status + source + date + reference + received into code
     - Counts toward settlement indicator
     - Approve/Reject buttons for pending items + optional rejection reason input

4. Settlement & waterfall
   - “Settlement & waterfall” wrapper and intro paragraph text variants
   - Receipts included in settlement block:
     - eligible receipts total, fully covered/remaining badge, and receipt list when multiple
   - SettlementActionBlockedReason amber banner and settlementReadyMessage green banner variants
   - Late fees:
     - overdue vs no-late-fees variant blocks
     - ta'widh investor share input + computed “to investors” text
     - Apply suggested fees + Custom amounts buttons with disabled logic
     - custom late fee dialog inputs and Queue fees
   - Preview settlement / Approve / Post button row:
     - label variants for preview
     - disabled rules around servicingOpen and canApprove/canPost
   - Waterfall Calculation table:
     - calculation destination/amount/balance grid
     - remaining in repayment pool footer
     - pool summary cards
   - “Settlement waterfall complete” state header
   - Issuer residual refund:
     - residual IssuerPayoutCard or dashed “issuer residual refund will be returned after Post…” info box

5. Trustee instruction / service fee workflow
   - Card appears only when posted settlement exists and serviceFeeAmount > 0.005
   - “Action required — trustee instruction PDF not generated” vs “Trustee workflow in progress” vs “Service fee trustee instruction complete”
   - Generate PDF + Mark submitted to trustee + Mark complete buttons (with lock and pending disabling)
   - Status line with submitted/completed timestamps
   - PDF-required warning
   - Generated letters list items with View/Download buttons
   - “Letter events will appear here after…” empty state

6. Arrears and Default Documents
   - Generate Arrears Letter / Generate Default Letter buttons
   - Generated Letters list + empty state
   - View/Download for each letter
   - Default reason input + Mark Default button + disabled guard logic

7. Ledger and Audit
   - Ledger panel:
     - Export CSV button and empty state
     - table columns and “Net (this note)” row
   - Activity Timeline panel:
     - empty state
     - event list content:
       - icon + formatted label
       - actor + portal
       - relative time
       - compact metadata badges + prose blocks
       - generated document section with View PDF + Download

## Risky conditional rendering areas (needs special care during redesign)
1. `disbursementWithdrawal` conditional wrapper inside SettlementPanel:
   - must remain present when disbursement is pending and show appropriate card states.
2. Repayment receipts:
   - show empty state vs list; show Approve/Reject only for pending payments.
3. Settlement preview/waterfall:
   - displayedSettlement gating can hide the entire waterfall section; redesign must preserve “No settlement preview generated yet.”
4. Late fees:
   - overdue vs non-overdue variants are distinct UI blocks with different copy and badges.
5. Service fee trustee workflow:
   - the card exists only for serviceFeeAmount > 0.005 and only in posted settlement contexts.
6. Arrears/default documents:
   - generated letters list uses note.events to discover letters; view/download actions are conditional on s3Key.
7. IssuerPayoutCard:
   - “Mark Disbursed” is disabled based on Shoraka certificate fetch state; helper text changes accordingly.
8. Activity timeline:
   - generated document controls are conditional on metadata s3Key and are disabled while viewDocumentPending.

## Implemented structure (Phase 2)
- Funding & Issuer Disbursement card is now rendered as a dedicated section near the top of the Admin Note Detail page (`apps/admin/src/app/notes/[id]/page.tsx`).
- The “Awaiting issuer disbursement” UI wrapper + `IssuerPayoutCard` for `kind="DISBURSEMENT"` was removed from `SettlementPanel` and is no longer visually buried under “Servicing Lifecycle”.
- `SettlementPanel` now focuses on maturity-driven servicing only:
  - repayment receipts
  - settlement preview/approve/post + waterfall
  - trustee instruction / service fee workflow
  - issuer residual refund (payout card or info box)
  - arrears and default documents
- Shoraka STP and all “View/Generate/Mark” controls inside `IssuerPayoutCard` were preserved when moved (including certificate fetch + view certificate actions).

Note: a persistent Shoraka certificate viewer is not implemented in this phase.

## Confirmation: no runtime code changes in this task
This phase is a UI-only restructure: no backend/database/API/calculation logic was changed.

