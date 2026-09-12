# Offer & acceptance tab inventory

Source of truth: current admin/issuer code (not the redesign mock). Mock-only actions are omitted. Comparison-modal branches stay on the old sections; they are listed so nothing is dropped from live or comparison surfaces.

**Stage names (admin, after redesign):** Facility review · Customer review · Invoice review · Send offer · Issuer response · Acceptance documents · Signing package · Upfront facility fee (new_contract, only when collect-upfront > 0; after signing) · Facility reference (existing_contract collapsed) · Inherited acceptance (existing_contract collapsed) · Merged notes.

**Stage names (issuer, after redesign):** Review terms · Confirm & accept · Representatives · Documents · CashSouk review · Signing · Complete (facility: Facility in force / invoice: Offer complete) · Offer tab chrome (switcher, empty/stale/signed).

Each item: **element** — *when* — *source* — *stage*.

---

## Admin Facility

Tab: `contract_details` when structure is not `invoice_only`. Live: `ContractSection`. Wired in `section-content.tsx` `case "contract_details"`. Page lock: `applications.contract.manage`, tab prerequisites, withdrawn, `existing_contract` (“Facility was approved in a prior application”), `isPaymasterSwitchingFrozen` (“Paymaster cannot be changed after a commercial offer or signed facility”). After issuer accept (`sectionStatus === "APPROVED"`): extra lock “Facility offer finalized by issuer…”.

### Card chrome and section actions

- **Card title “Facility”** — always on live/comparison — `ReviewSectionCard` — Facility review (header).
- **Action dropdown** — live, `isReviewable`, not comparison — `SectionActionDropdown`; Approve until details `APPROVED` or offer sent — Facility review / Send offer.
- **Approve** — facility details review; writes `contract_details` `APPROVED` and `SECTION_REVIEWED_APPROVED`; Send offer stays locked until this — Facility review.
- **Reject** — status not already `REJECTED`; remark required — `onReject` → page `setNoteDialog({ action: "reject", section })` → `useRejectReviewSection` — Facility review.
- **Request amendment** — status not already `AMENDMENT_REQUESTED`; remark required; “Add to List” — `onRequestAmendment` → `setNoteDialog({ action: "amend" })` → `useAddPendingAmendment` — Facility review.
- **Set to Pending** — `onResetSectionToPending` and status ≠ `PENDING` — page `useResetSectionReviewToPending` — Send offer / Issuer response (retract commercial state).
- **View Signed Offer** — signed contract letter on an envelope (`isSignedContractOfferLetterAvailable` via `useAdminSigningEnvelopes`) — `onViewSignedContractOffer` → page `getAdminSignedContractOfferLetterBlob`, new tab — Signing package (also available after finalize-only menu).
- **View Signed Offer only menu** — section `APPROVED` and letter available — `viewSignedOfferOnly` — Issuer response / Signing package.
- **Action locked tooltip** — `isActionLocked` or issuer-finalized — page lock helper / ContractSection override — same as lock source.
- **Empty body** — no `contract_details` and no `customer_details` — “No facility details submitted.” — Facility review.

### Offer to Issuer (Send offer)

- **Product-rule duration warning** — `validateContractAgainstProductRules` has a message — `ProductRuleWarningNotice` — Facility review / Send offer.
- **Requested Facility** — read-only — `resolveRequestedFacility` — Facility review.
- **Offered Facility `MoneyInput`** — disabled when not reviewable, locked, no `onSendOffer`, section `APPROVED`, or contract status `OFFER_SENT` / `WITHDRAWN` / `APPROVED` / `REJECTED` — local state — Send offer.
- **Send Offer** — `onSendOffer` present; disabled when not reviewable/locked/pending, fee-rate/upfront errors, offered ≤ 0, or `resolveFacilityOfferBlockReason` — `assertLargePrivateThenOpenOffer` — Send offer.
- **Send Offer pending label** — `isSendOfferPending` — “Sending...” — page `useSendContractOffer` — Send offer.
- **Large-private gate (toast)** — select is null — toast “Please confirm if customer is a large private company”; highlight select — blocks confirm open — Send offer.
- **Paymaster identity gate (toast)** — `paymasterIdentityOfferBlockReason` — toast that reason — Send offer.
- **Offer timeline** — `responded_at` + `APPROVED` → “Issuer accepted the offer on …”; `WITHDRAWN` → “Issuer declined…”; else `sent_at` → “Offer sent …” — `date-fns` `PPpp` — Send offer / Issuer response.
- **Acceptance-phase deadline line** — contract `OFFER_SENT` or `OFFER_EXPIRED` — `getOfferPhaseDeadlineDisplay`; past = destructive, soon = amber — Issuer response.
- **Offered facility must be > 0** — trimmed input and parsed ≤ 0 — inline error — Send offer.
- **Facility vs contract-value block** — `resolveFacilityOfferBlockReason` (`REQUESTED_FACILITY_BELOW_CONTRACT_COPY` or `OFFERED_FACILITY_BELOW_CONTRACT_COPY`) — Send offer.
- **Product-limit send error** — `readProductLimitViolationMessage` after send throw — Send offer.
- **Remaining credit / Remaining allocation** — occupancy present — `reviewOccupancy` from `resolveAdminReviewTabCapacity` — Facility reference / Send offer.
- **Facility fee rate %** — optional; 0–max, ≤2 dp; tooltip `FACILITY_FEE_RATE_FIELD_TOOLTIP`; prefill offer then product default — Send offer.
- **Collect upfront now** — `MoneyInput`; tooltip `FACILITY_FEE_UPFRONT_FIELD_TOOLTIP`; `validateFacilityFeeUpfrontCollectAmount` — Send offer.
- **Fee preview dl** — Total facility fee / Upfront via payment gateway / Left for later drawdowns — `resolveFacilityFeeOfferSplit` — Send offer.
- **Upfront facility fee stage** — `new_contract` only when `facility_fee_upfront_collect_amount` or stamped `facility_fee_upfront_amount` > 0 — locked until signing completes (`APPROVED`), then Due / Paid / Waived — `resolveFacilityFeeUpfrontRail` — after Signing package. Invoice rails omit this; issuer pays on the facility record.
- **Fee inputs disabled** — same as offered facility lock — Send offer.
- **Confirm Facility Offer dialog** — after large-private + paymaster checks — rows: contract value, requested, offered, fee rate, total fee, upfront, remaining for drawdown, `OfferAcceptanceDeadlineConfirmRows` if `previewAcceptanceDeadlineFromWorkflow` — Confirm & Send Offer / Cancel — `handleConfirmContractOffer` → page `useSendContractOffer`; success toast “Facility offer sent” or “… continue on Acceptance” + `goToAcceptanceTab` if Acceptance tab exists — Send offer.
- **Confirm disabled** — cannot send, pending, or fee errors — Send offer.

### Contract Details (read-only)

- **Title, Description, Number, Value, Financing, Start, End** — `cd` present — Facility review.
- **Minimum facility duration** — `contractProductRules.minContractMonths` set — Facility review.
- **Approved Facility / Utilized / Reserved / Remaining credit / Remaining allocation** — `resolveApprovedFacility` > 0 — Facility review / Facility reference.

### Customer + paymaster (on Facility tab)

- **Paymaster identity comparison** — `shouldShowSubmittedVerifiedPaymaster` — submitted vs official name/entity/SSM/country; **Request Amendment** (disabled if not reviewable/locked) — `SubmittedVerifiedPaymasterIdentity` → `onRequestAmendment(section)` — Facility review.
- **Customer Name / Entity Type** — shown in Customer Details only when identity comparison is **not** shown — Facility review.
- **Is Customer a Large Private Company? \*** — Yes/No select; required-before-send helper; PATCH `usePatchContractCustomerLargePrivate`; disabled when locked / approved / send-locked / patch pending; missing applicationId toast — Send offer (gate) / Facility review.
- **Customer SSM / Country** — when identity comparison is not shown — Facility review.
- **Is Customer Related to Issuer?** — Yes/No/empty — Facility review.
- **Paymaster Verification** — `cust` present — Status Verified/Unverified badge; helper copy (not SSM/CTOS, does not approve app); **View Paymaster** if id; **Verify Paymaster** if unverified, `can("paymasters.manage")`, and id — `PaymasterVerificationPanel` + `PaymasterOfficialIdentityDialog` — Facility review.
- **Paymaster panel omitted** — no paymaster object and no resolved id (`layout="review"` returns null) — Facility review.

### Evidence

- **Contract Document row** — filename + size or empty — Evidence.
- **View / Download** — `s3_key` and handlers — page `useAdminS3DocumentViewDownload`; disabled while `viewDocumentPending` — Facility review.

### Comments

- **Comments composer + thread** — unless `hideSectionComments` — `SectionComments`; `onAddComment` → `useAddSectionComment` scope `contract_details:` — Merged notes (tag Facility).
- **Post Comment / Posting… / submit error / No comments yet / Load more (5)** — `SectionComments` — Merged notes.

### Comparison (`sectionComparison`)

- **Offer to Issuer rows** — Requested Facility, Offered Facility, Facility fee rate, Collect upfront via payment gateway — `ComparisonFieldRow` / `isPathChanged("contract")` — Comparison modal only.
- **Contract Details / Customer Details / Evidence document chips** — including large-private and related-party radios — Comparison modal only.
- **Comments** — unless hidden — Comparison modal only.
- **No section Action menu** — `isReviewable={false}` — Comparison modal only.

---

## Admin Customer

Tab: same `contract_details` descriptor when `isInvoiceOnlyFinancingStructure`. Live: `CustomerSection`. Label override “Customer”. Permission still `applications.contract.manage`. **Approve is shown** (`showApprove={true}`). No Send Offer. Customer Consent evidence props exist but are unused.

### Card chrome

- **Card title “Customer”** — `ReviewSectionCard` — Customer review.
- **Approve / Reject / Request amendment / Set to Pending** — same note-dialog + review mutations as other sections — Customer review.
- **Empty** — no `customer_details` — “No customer details submitted.” — Customer review.

### Fields and paymaster

- **Paymaster identity comparison + Request Amendment** — same helper as Facility — Customer review.
- **Customer Name / Entity Type / SSM / Country** — when comparison not shown — Customer review.
- **Is Customer Related to Issuer?** — always when data — Customer review.
- **Paymaster Verification** — same panel as Facility — Customer review.
- **Comments** — scope `contract_details:` — Merged notes (tag Facility/Customer as stage 1).

### Comparison

- **Customer Details rows** (no large-private, no paymaster) — Comparison modal only.
- **No Approve/Reject** — `isReviewable={false}` — Comparison modal only.

---

## Admin Invoice

Tab: `invoice_details`. `InvoiceSection` + `InvoiceOfferPanel`. Permission `applications.invoice.manage`. **Section Action hidden** (`hideSectionActions`). Item actions only. After send (invoice-only + Acceptance tab): toast “… continue on Acceptance” + `goToAcceptanceTab`. Facility-linked invoice send does **not** auto-switch tab.

### Capacity and switcher

- **`ContractFacilitySummary`** — `contractFacility` from `resolveAdminReviewTabCapacity` (not invoice_only) — credit + allocation meters, Over limit badges, Remaining credit/Reserved/Utilized/Approved, Remaining allocation/Used/Contract value — Facility reference (existing_contract) or Invoice review header (`new_contract` legacy with invoices).
- **Empty this-app invoices** — `thisTabs.length === 0` — “No invoices submitted.” — Invoice review.
- **Invoice chip switcher** — more than one of (other-facility + this-app) — default last this-app invoice, else first other — `Tabs` — Invoice review (chip row).
- **Other-app invoice tab** — `otherFacilityInvoices` excluding `WITHDRAWN`; helper “This invoice belongs to another application and cannot be edited here.”; stacked fields only (no offer, no item actions) — Invoice review (read-only other app).
- **`readOnlyInvoiceIds`** — greys this-app row if set (deprecated; other-app path preferred) — Invoice review.

### This-app invoice details

- **Status badge** — `ReviewStepStatusBadge`: entity `WITHDRAWN` / `OFFER_EXPIRED` overlay, else review-item status (including `OFFER_SENT`) — Invoice review.
- **Item Action (full)** — reviewable and not greyed (`readOnly` / tab lock / invoice entity `APPROVED` / withdrawn); Approve until item `APPROVED` or offer sent — Reject / Request Amendment / Set to Pending / View Signed Offer if letter available — `useApproveReviewItem` / `useRejectReviewItem` / `useAddPendingAmendment` / `useResetItemReviewToPending`; signed view `getAdminSignedInvoiceOfferLetterBlob` — Invoice review / Send offer.
- **View Signed Offer only menu** — letter available, full menu hidden — `isSignedInvoiceOfferLetterAvailable` + `useAdminSigningEnvelopes` — Signing package.
- **Row greyed** — locks offer controls (`isRowGreyedOut`) — Send offer.
- **Stacked fields** — Invoice number, Maturity date, Financing tenure, Invoice value, Financing ratio, Financing amount (offered if > 0 else requested), SC company category / campaign sector / sustainability labels, Document View/Download — `InvoiceStackedFields` — Invoice review.
- **`FacilityImpact`** — `contractId` set — financing amount, invoice face, status wording, link to `/contracts/:id` — Invoice review.

### Offer to issuer (`InvoiceOfferPanel`)

- **Submitted-request product-rule warning** — not yet `OFFER_SENT` and `validateInvoiceAgainstProductRules` issuer_request fails — Send offer.
- **Risk rating select** — MARC SME grades; disabled when greyed/rejected; helper suggested MARC / “Adjusted from…” / `MARC_ASSESSMENT_REQUIRED_MESSAGE`; **Reset to MARC grade** if diverged — Send offer. After `OFFER_SENT`: read-only grade.
- **Profit rate** — 8–18% select; after send: read-only % — Send offer.
- **Financing tenure** — options + tooltip; helper “Starts on the actual disbursement date.”; tenure vs due-date error — Send offer. After send: frozen label.
- **Drawdown fee %** — 0–cap (platform setting, default 3); after send: “N% at disbursement” — Send offer.
- **Offered financing ratio** — min–max from product; input + slider on focus — Send offer. After send: read-only; destructive if exceeds issuer request.
- **Offered financing amount** — computed from face × ratio (live) or snapshot after send; product-limits helper; “Exceeds what the issuer requested…” — Send offer.
- **Facility fee to collect** — `feeEditor.mode === "v1"` and collect enabled — remaining helper, RM input, waived copy when read-only — Send offer.
- **Fee schedule / additional fees** — `InvoiceOfferFeeScheduleSection`; grandfather callout + **Use current fee schedule**; v1 additional lines + totals — Send offer.
- **Send Offer** — not `OFFER_SENT`; disabled greyed/pending/capacity/`feeSendBlockedReason`/tenure/offer violation/missing tenure/SC fields — click alerts: identity block, MARC required, missing risk, missing SC fields — then confirm + `refetchQueries(applicationsKeys.detail)` — Send offer.
- **Rejected invoice Send Offer** — disabled + “This invoice was rejected. Use Action → Set to pending…” — Send offer.
- **Maturity gate** — disabled + “Maturity date must be at least N month(s) after today…” — `minMonthsReviewToMaturityForOffer` — Send offer.
- **Offer disable / fee-block / product-limit messages** — `resolveInvoiceOfferDisable` (not rejected/maturity/missing_risk/missing_amount), `utilisationFeeSendBlockedReason`, `offerViolationMessage` — Send offer.
- **Phase deadline line** — `OFFER_SENT` or `OFFER_EXPIRED` snapshot — Issuer response.
- **Retract Offer** — `status === "OFFER_SENT"` and `onResetItemToPending`; pending “Retracting...” — same `useResetItemReviewToPending` as Set to Pending — Send offer (retract).
- **Confirm Invoice Offer dialog** — Invoice Number/Value, Financing Amount/Ratio, Profit Rate, tenure, `InvoiceOfferFeeConfirmRows`, Risk Rating, SC labels, acceptance-deadline preview; refresh pending/failed/stale-fingerprint auto-close; Confirm & Send / Cancel — `useSendInvoiceOffer` — Send offer.
- **Identity block on confirm** — `alert(offerIdentityBlockReason)` from `paymasterIdentityOfferBlockReason` in `section-content` — Send offer.
- **`OFFER_EXPIRED`** — snapshot amounts + deadline; Send Offer UI returns (not Retract) because `isOfferSent` is only `OFFER_SENT` — Send offer / Issuer response.

### Comparison

- **Per-invoice before/after** — value, maturity, tenure, ratio, financing amount, SC fields, document chips — no offer panel — Comparison modal only.
- **Empty** — “No invoices in these snapshots.” — Comparison modal only.

### Comments

- **Section comments** — scope `invoice_details:` — Merged notes (tag Invoice).

---

## Admin Acceptance

Tab: `acceptance_documents` when `shouldShowAcceptanceDocumentsReviewSection` (offer-acceptance workflow). Permission `applications.documents.manage`. `canManageSigning` = `applications.manage`. Inherited `existing_contract`: `app.inherited_acceptance`; `isReviewable` false; lock tooltip “Acceptance was completed when the linked facility was approved”; comments hidden; signing `canManage` false; envelopes loaded for **source** application id.

### Card chrome

- **Title “Acceptance”** — `AcceptanceSection` — Acceptance documents / Signing package.
- **Inherited banner** — `acceptanceReviewMode === "inherited"` — text + link to originating app if productId+id — Inherited acceptance.
- **Remaining credit / Remaining allocation tiles** — not invoice_only and either value set — `adminReviewTabCapacity.acceptance` — Facility reference / Acceptance documents.
- **Acceptance-phase deadline** — acceptance exists and status `PENDING_ISSUER` or `CHANGES_REQUESTED` — Issuer response.
- **Empty hints** — no offer: “Send an offer from Facility/Invoice to start acceptance.”; offer but no docs slot: “Acceptance documents appear here after the issuer submits them.” — Issuer response / Acceptance documents.
- **No signing hub and no docs** — “No acceptance documents to review yet.” vs “No acceptance documents are configured for this product.” — Acceptance documents.
- **Signing hub omitted from documents block** — `showSigningHub && !productHasAcceptanceDocuments` — documents block skipped; signing package still renders — Signing package.

### Authorised parties (`AuthorizedPartiesReadOnly`)

Shown when `isOfferAcceptanceDocumentsVisibleToAdmin` (not draft `PENDING_ISSUER` uploads).

- **Grouped blocks** — issuer / corporate guarantor / individual guarantor — name, capacity (issuer), email, IC — Issuer response.
- **Status badge** — not `PENDING`; amendment label “Changes Requested” — Issuer response.
- **Item Action** — reviewable + handlers; **Reject hidden**; Request change only if `PENDING` or `APPROVED`; label “Request change”; individual guarantor **Request change disabled** (“To change this person, request an amendment on Business & Guarantor Details.”); Approve / Set to Pending — item type `authorized_representatives` via `acceptanceHubItemType`; amendment uses `useRequestAmendmentReviewItem` (not pending-list) when id starts `authorized_representatives:` — Issuer response.
- **Empty** — no blocks → component returns null — Issuer response.

### Acceptance documents (`DocumentsSection` embedded)

Visible when workflow has acceptance docs **and** (inherited **or** `isOfferAcceptanceDocumentsVisibleToAdmin`).

- **Status badge on “Acceptance documents”** — if `PENDING_ADMIN_REVIEW` or `CHANGES_REQUESTED` use **section** review presentation; else `getOfferAcceptanceStatusPresentation(acceptance.status)` (`Pending Issuer`, `Pending Review`, `Changes Requested`, `Acceptance Rejected`, `Offer Declined`, `Approved for Signing`, `Signing In Progress`, `Completed`) — Acceptance documents / Issuer response.
- **Download all** — ZIP of `file` + `files[]`; disabled if empty or pending; label “Preparing ZIP...” — page `handleDownloadAllDocuments` (filename still `supporting-documents-{ref}.zip`) — Acceptance documents.
- **Flat document rows** — `buildAcceptanceCategoryGroups`; View / Download (single or multi dropdown); Action Approve / Reject / Request change (only PENDING/APPROVED) / Set to Pending; peer-reject lock hides primary actions (`noActionsTooltip` about rejected sibling) — `DocumentList` `documentKind="acceptance"` — Acceptance documents.
- **Empty list** — “No acceptance documents uploaded yet.” — Acceptance documents.
- **`hideDownloadAll` inside list** — parent owns the button — Acceptance documents.

### Signing package (`SigningEnvelopePanel` embedded)

`showOfferAcceptanceSummary={false}` on Acceptance tab (phase badge lives above). `applicationId` omitted in comparison → no hub.

- **Signing-clock line** — `acceptance.status === "SIGNING_IN_PROGRESS"` — `getOfferPhaseDeadlineDisplay` — Signing package.
- **Extend signing deadline** — `canManage` and clock urgency `past` — confirm: new window from workflow days (`DEFAULT_SIGNING_DEADLINE` fallback); `useExtendContractSigningDeadline` or `useExtendInvoiceSigningDeadline` (invoice_only needs invoice id) — Signing package.
- **Preview documents** — acceptance exists and workflow preview docs — Preview / Download drafts (`useAdminSigningDocumentPreview`); “Not sent to signers.”; invoiceId for invoice_only — Signing package.
- **Loading** — `useAdminSigningEnvelopes` `isLoading` — “Loading…” — Signing package.
- **Empty envelopes** — copy by phase: no offer / locked until docs+reps approved / completed but no package / approved for signing / generic; **Send signing links** if `APPROVED_FOR_SIGNING`, clock not past, no blocking envelope, `canManage`, invoice id if invoice_only — `useSendAdminSigningPackage` — Signing package.
- **Voided-then-resend strip** — envelopes exist and `canSendSigningLinks` — Signing package.
- **Send signing links confirm** — “Sends secure signing emails to the authorised representatives already approved…” — Signing package.
- **Active envelope card** — title + status badge; **Re-sync** if `canResyncAdminSigningEnvelope` (SENT/IN_PROGRESS/COMPLETED); **Void** unless COMPLETED/VOIDED — `useSyncAdminSigningEnvelope` / `useVoidSigningEnvelope` — Signing package.
- **DRAFT package** — “This package was not sent…” + Send signing links if approved-for-signing and clock ok — Signing package.
- **`SigningProgressMatrix`** — progress bar; per-document signer rows (Pending / Email sent / Viewed / Signed / Declined); Warning accepted; per-signer **Remind** when SENT/IN_PROGRESS and not signed/declined; signed PDF **View / Download** (`useAdminSignedSigningDocument`); completed docs collapsed — Signing package.
- **Send reminders** — unsigned recipients on live SENT/IN_PROGRESS — loop `useRemindSigningRecipient` — Signing package.
- **Package history** — non-primary envelopes; expand matrix; signed View/Download — Signing package.
- **Empty matrix** — “No documents or recipients yet.” / “No signers assigned.” — Signing package.

### Comments

- **Thread** — unless hidden/inherited/comparison — `useAddSectionComment` `acceptance_documents:` — Merged notes (tag Acceptance). Composer posts here after redesign when this section exists.

### Page/section wiring that is not visible as a tab widget

- **Note dialog copy** — acceptance/party change: required remark, “Request change”, issuer notified — `page.tsx` `handleRequestAcceptanceDocumentChange` — Issuer response / Acceptance documents.
- **Item approve** — optional remark — `useApproveReviewItem` — same.
- **Reset item** — toast “Item reset to pending” — same.
- **Inherited lock also applied at page** — `isAcceptanceExistingContract` — Inherited acceptance.

---

## Issuer Offer

### Page chrome (`applications/[id]/page.tsx` Offer `TabsContent`)

Offer tab mounts only if `hasOffer` (review CTA, facility offer, invoice `OFFER_SENT`/`canReviewOffer`, or signed letters).

- **Auto-open Offer** — no `tab` query and `cardStatus.showReviewOffer` — Offer tab chrome.
- **Offer tab URL without offer** — redirected to summary — Offer tab chrome.
- **`selectOfferInvoice`** — sets invoice or facility (`invoiceId` deleted); tab=offer — Offer tab chrome.
- **URL invoiceId** — mounts if `OFFER_SENT` or `canReviewOffer`; else fall back to facility offer, else first invoice offer, else stale — Offer tab chrome.
- **Switcher “Offers to review”** — `pendingOfferCount > 1` — **Facility offer** if `hasIssuerFacilityOffer`; invoice buttons only if `canReviewOffer` (not all `OFFER_SENT`) — Offer tab chrome.
- **`OfferReviewPanel` inline** — facility if `hasIssuerFacilityOffer`; invoice if selected/mounted invoice `status === "OFFER_SENT"`; `onClose` invalidates application queries — all issuer stages.
- **Stale empty** — `staleOfferUnavailable` or stale invoiceId with nothing else — “This offer is no longer available…” — Offer tab chrome.
- **Signed-only empty** — signed contract or invoice letters, no live panel — “There is no offer waiting… download signed offer letters from Documents” + **Go to documents** — Offer tab chrome / Complete.
- **No offer empty** — “When CashSouk sends an offer…” — Offer tab chrome.
- **Page loading / not found** — detail `LoadingState` / “Application not found” — Offer tab chrome (page, not panel).
- **Summary-tab signed letter** — `signed-letter:contract:` / `signed-letter:invoice:` via `getSignedContractOfferLetterBlob` / `getSignedInvoiceOfferLetterBlob` — Complete (also Documents).

### `OfferReviewPanel` shell

`mode="inline"` is the only live host. `mode="modal"` still implemented (Dialog shell) but unused by the detail page.

- **Heading “Review financing offer”** — Facility/Invoice outline badge + “{offeredValue} approved” — Review terms.
- **Subtitle** — signing stepper: “Complete each step…”; direct: “Accept or decline this offer.” — Review terms.
- **Deadline Alert** — urgency soon (action) or past (destructive) — Review terms / Confirm & accept.
- **Loading offer…** — contract fetch when contract needed — Review terms.
- **Vertical `SigningProgressStepper`** — signing flow: representatives → documents (if workflow) / awaiting_review / signing → complete / rejected / declined; direct: single “Respond to offer” — maps to horizontal stepper later; clickable only on signing flow (`handleSigningStepSelect`, persist uploads unless Step 1 defer) — corresponding stages.
- **Offer details sidebar (signing)** — facility dl or `InvoiceOfferTerms` + **Download offer letter** (`getContractOfferLetterBlob` / `getInvoiceOfferLetterBlob`, `offerLetterDownloadFileName`) — Review terms.
- **Contract details sidebar (direct accept)** — linked facility name/value/approved/period/fee rate/`FacilityFeeBalanceSummary` — Review terms (invoice-under-facility).
- **Expired card** — `phaseDeadline.isPast` or entity `OFFER_EXPIRED` — “Offer Expired”; download still in details panel; reject/accept closed — Issuer response analogue / Confirm & accept (blocked).
- **Footer Decline offer / Cancel decline** — not expired, not complete; hidden on rejected/declined display step unless already in reject mode — Confirm & accept / Representatives (escape hatch).
- **Close** — `requestClose`; if pending acceptance uploads, **Unsaved changes** ConfirmDialog Discard/Stay — Offer tab chrome (plan: Back to applications).
- **`OfferAcceptOtpDialog`** — direct accept only — Confirm & accept.
- **Workflow load** — `getIssuerApplicationSigningProductWorkflow`; while loading, display step forced to representatives (acceptance) or signing; `SupportingDocumentsSkeleton` — Documents.

### Direct OTP accept (`modalMode.ui === "accept_decline"`)

Typical: invoice on a facility whose contract envelope is already complete (`resolveReviewOfferModalMode`).

- **Offer terms card** — `InvoiceOfferTerms`: number, value, due date, tenure from disbursement, profit rate, risk, financing margin, indicative profit/payable (tooltips), money table via `buildInvoiceOfferMoneyRows` (requested, approved, drawdown fee, facility fee if linked, extra fees, net disbursement), Accept by footer — Review terms.
- **`UtilisationOfferTerms`** — Read terms dialog; if `canAccept`: two consents + full-authorisation dialog (Required/Confirmed); locked while OTP open — Confirm & accept.
- **Blocked copy** — `modalMode.blockedMessage` or “Finish facility signing first…”; Accept disabled; toast “Cannot accept yet” — Confirm & accept.
- **Download offer letter / Download application summary** — `ApplicationSummaryDownloadButton` → `getApplicationSummaryPdfBlob` — Review terms. Summary button is **only** on this direct-accept card, not the signing-flow sidebar.
- **Reject Offer** — enters decline form — Confirm & accept.
- **Accept Offer & Authorize Listing** — `prepareAccept`: expiry, `canAccept`, both consents; opens OTP — Confirm & accept.
- **OTP step 1** — load signatories (facility envelope vs directors fallback copy); radio (masked email + source); Cancel / Send verification code; dismiss blocked while busy — Confirm & accept.
- **OTP step 2** — 6-digit code; remaining attempts; Verify and accept → `useAcceptInvoiceOffer` with `challenge_id`, `otp_code`, `consent_ids`; Change signatory; Resend with cooldown; success “Offer accepted” + `onClose` — Confirm & accept.
- **Consent incomplete toast** — `utilisationOfferAcceptBlockedReason` — Confirm & accept.

### Signing / acceptance flow (`useSigningStepper`)

`workflowUsesOfferAcceptanceFlow`. Step 1 editable while `offerAcceptanceIsStep1Editable`.

#### Representatives

- **Card + description** (everyone named must sign) — Representatives.
- **Changes requested banner** — `CHANGES_REQUESTED` with flagged parties/docs — `AcceptanceDocumentChangesRequestedBanner` — Representatives / Documents.
- **Issuer directors card** — select director (name/email/IC read-only from profile); Add director / Remove; empty “No directors…”; loading “Loading directors…”; highlighted + remark when flagged; read-only if package sent, not Step-1-editable, or changes requested and this list not flagged — `saveContractAuthorizedPartiesDraft` on Continue (contract only) — Representatives.
- **Corporate guarantors** — name, email, IC; Add/Remove representative — Representatives.
- **Individual guarantors** — name, IC, email from application (display; no edit handler) — Representatives.
- **Continue** — has post-docs and not people-only resubmit; gates `areIssuerDirectorSelectionsReady` + `areGuarantorPartiesReady` — Documents.
- **Submit for review** — no post-docs **or** people-only resubmit (flagged parties, zero flagged docs) — `submitContractOfferAcceptance` / `submitInvoiceOfferAcceptance` — CashSouk review.
- **Incomplete helper** — Complete issuer and every guarantor before continuing — Representatives.

#### Documents (`SupportingDocumentsStep`, `documentStorage="acceptance_documents"`)

- **Upload card copy** — acceptance vs generic — Documents.
- **Locked after send** — “Documents and representative lists are locked after signing emails were sent. Voiding the package does not reopen them.” (acceptance) vs void-to-edit (legacy) — Documents / Signing.
- **Empty workflow** — “No documents required for this application.” — Documents.
- **Per slot** — required/optional, category required progress, Download template, View/Download uploaded, Replace file, Add files, View Remarks (flagged + `amendmentRemarks`), change-mode highlight — Documents.
- **Draft kept mounted** while navigating Step 1 (`keepAcceptanceDocsDraftMounted`) — Documents.
- **Upload-all-required helper** — Documents.
- **Submit for review** — when this step displayed, uploads ready, reps ready — same submit APIs; people-only skips doc save — CashSouk review.
- **Save-before-submit** — `updateApplicationStep` `acceptance_documents` unless people-only; toasts — Documents.

#### CashSouk review

- **`OfferAcceptanceSubmittedSuccessView`** — `displaySigningStepId === "awaiting_review"` replaces whole panel — “Documents submitted…” + **Done** (`onClose`) — CashSouk review.
- **Rejected / declined cards** — `getOfferAcceptanceStatusPresentation`; “This offer is closed. No further action…” — Complete (closed).

#### Signing / complete

- **Document signing card** — waiting copy until package sent; then track + reminders — Signing.
- **Refresh** — `syncIssuerSigningEnvelopeFromProvider` + invalidate envelopes/application — Signing.
- **`SigningProgressMatrix` + Remind** — `remindIssuerSigningRecipient`; blocked if expired — Signing.
- **Send reminders** — unsigned recipients — Signing.
- **Signing complete** — all required signed and envelope `COMPLETED` — matrix; “The offer acceptance process is complete.” — Complete.

### Decline form (both flows)

- **Reject offer / Decline offer** — reason select (`ISSUER_OFFER_DECLINE_REASONS` + Other); additional context max 200; required if Other; **Confirm decline** — `useRejectContractOffer` / `useRejectInvoiceOffer`; expiry toast; success “Offer declined” + `onClose` — Confirm & accept.
- **Expired** clears reject mode and OTP dialog — Confirm & accept.

### Invoice terms / fee rows (signing sidebar)

Same `InvoiceOfferTerms` as direct accept, plus facility fee display from `buildInvoiceFeeDisplay` (schedule vs grandfather, waived, remaining). Facility offer sidebar: contract name/value, requested facility, period, fee rate (+ tooltips), fee owed or `FacilityFeeBalanceSummary`, Accept by.

---

## Shared admin item/section action semantics

`ItemActionDropdown` / `SectionActionDropdown` (not mock-only):

- Approve hidden when already `APPROVED` or offer lifecycle (`OFFER_SENT` / `OFFER_EXPIRED` / `WITHDRAWN`). Facility and invoice details use Action → Approve before Send offer.
- Reject hidden when already `REJECTED` or `showReject={false}` (authorised parties).
- Request amendment/change hidden when already `AMENDMENT_REQUESTED`.
- Set to Pending when reset handler exists and status ≠ `PENDING`.
- Locked: tooltip (`actionLockTooltip` or “Complete previous sections first”).
- Empty menu: disabled Action + tooltip.
- View Signed Offer at top when handler + letter available.

`SectionComments`: composer always (if `onSubmitComment`); empty “No comments yet.”; page size 5; author name or user id or “System”.

---

## Non-negotiable preservation checklist

Implementers tick these; review and browser verification use the same list. Nothing below is dropped because the mock omits it.

- [x] Facility: duration/product-rule warning; offered/requested; fee rate + upfront + split preview; remaining credit/allocation; large-private required select + PATCH; paymaster identity comparison + Verify/View; evidence View/Download; Send Offer confirm + acceptance-deadline preview; product-limit error; send lock until details Approve then after OFFER_SENT/WITHDRAWN/APPROVED/REJECTED; timeline + phase deadline; section Approve / Reject / Request amendment / Set to Pending; View Signed Offer; comments.
- [x] Customer (invoice_only): Approve / Reject / Request amendment / Set to Pending; identity comparison; paymaster panel; related-party; comments; empty state.
- [x] Invoice: facility capacity strip + over-limit; other-app switcher + lock copy; stacked fields including SC campaign fields; document View/Download; FacilityImpact; item Approve / Reject / Request amendment / Set to Pending; View Signed Offer; MARC risk + reset; profit/tenure/drawdown fee/ratio/amount; facility-fee collect + additional fees + grandfather convert; all Send Offer gates (details Approve, MARC, SC, identity, maturity, tenure, capacity, exceeds request, product rules); Retract Offer (`resetItemToPending`); confirm refresh/fingerprint; OFFER_EXPIRED send-again; comments.
- [x] Acceptance: inherited read-only + originating link; capacity tiles; phase deadline; authorised parties Approve / Request change / Set to Pending (no Reject; individual-guarantor change disabled); documents Download all ZIP, View/Download, Approve/Reject/Request change/Set to Pending, peer-reject lock; status badges (section vs phase); empty/configured/not-submitted copy.
- [x] Signing: draft preview/download; send-links confirm; extend deadline after clock past; matrix + View/Download signed PDFs; Remind / Send reminders; Void; Re-sync; history; locked-until-approved copy; invoice_only invoice id on send/extend.
- [x] Locks/permissions: section permission map; tab prerequisites (Acceptance: send Facility or Invoice / Approve Customer); withdrawn; existing_contract facility + inherited acceptance; paymaster freeze; issuer-finalized facility; `canManageSigning`.
- [x] Comparison modal still has Facility/Customer/Invoice/Acceptance read-only before/after (including contract offer fee rows and invoice SC fields).
- [x] Issuer switcher + stale/signed/empty Offer tab states; deadline banners; offer letter download; application summary download on **direct** accept; utilisation consents + OTP dialog (not inlined); decline reasons; reps + documents + changes banner + View Remarks; awaiting-review success; signing refresh/remind; discard-unsaved-uploads; expired read-only; blocked accept until facility signing where `canAccept === false`. Direct OTP: source/model/unit tested; no live direct-OTP fixture was available.
- [x] Post-send navigation: facility send → Acceptance tab when present; invoice send → Acceptance tab only when invoice_only.
- [x] Merged notes keep every existing thread; composer posts to `acceptance_documents` when that section exists, else stage 1/2 review section.
