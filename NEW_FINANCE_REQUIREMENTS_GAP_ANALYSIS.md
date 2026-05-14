## 1. Executive Summary

This document analyzes gaps between your 14 new financing/notes/marketplace/signing/fee/ledger requirements and what is currently implemented in the repo. The analysis is evidence-based (Prisma schema, backend services, API route wiring, and frontend components).

High-impact gaps already visible from code:

- Marketplace “days left” is currently calculated from `Note.maturity_date` (tenor), not `NoteListing.closes_at` (funding window). This is a direct UI bug.
- SigningCloud flow stores signed-offer metadata in `contracts.offer_signing.signed_offer_letter_s3_key` and `invoices.offer_signing.signed_offer_letter_s3_key`, but there is no “re-sign requested / revert from signed to re-sign” status flow; offers become `APPROVED` and response is guarded by `ALREADY_RESPONDED`.
- Platform fee is editable only during note draft via `adminNotesRouter.patch("/:id/draft")` → `noteService.updateDraft()`, and capped at `3%` platform / `15%` service at `noteService.publish()`. The admin “platform fee input” requirement is mostly a UI/UX wiring confirmation rather than a missing backend field.
- Trustee payout letters have a clear state machine (`WithdrawalStatus`: `DRAFT` → `LETTER_GENERATED` → `SUBMITTED_TO_TRUSTEE` → `COMPLETED`), but there is no “signed letter upload” concept; the UI/DB currently stores only `WithdrawalInstruction.letter_s3_key`.
- Several requirements (CTOS consent director coverage, onboarding/application-fee receipt evidence, repayment waterfall/service-fee letter generation) cannot be fully confirmed because the repo evidence is missing or only partially present. Those are explicitly marked `UNCLEAR / NEEDS CONFIRMATION`.

## 2. Requirement-by-requirement gap analysis

### 1. Auto name check for company name

| Item | Details |
|---|---|
| Business meaning | Automatically warn (or block) when the issuer-entered company name does not match the official company name from registry/CTOS/SSM/onboarding profile. |
| Current code behavior | Issuer enters a company name during account creation (`apps/issuer/src/components/account-type-selector.tsx`, `companyName` input) and RegTank corporate onboarding is started with that name (`startCorporateOnboarding(org.id, companyNameValue)`). Admin “CTOS compare” logic exists for director/shareholder ID matching, but is explicitly described as “admin matches by eye” and focuses on registry IDs rather than automated company-name comparison (`apps/admin/src/lib/onboarding-ctos-compare.ts`). No automated company-name mismatch blocker is found in the evidence gathered so far. |
| Files checked | `apps/issuer/src/components/account-type-selector.tsx`; `apps/admin/src/lib/onboarding-ctos-compare.ts`; `apps/issuer/src/app/(application-flow)/applications/steps/business-details-step.tsx` (shows business_name/company_name fields in app snapshots); `apps/admin/src/components/application-review/sections/company-section.tsx` (renders Company Name in admin review UI). |
| DB models/fields involved | Company/onboarding storage appears in Prisma via `IssuerOrganization.corporate_onboarding_data` (JSON), `IssuerOrganization.registration_number`, and CTOS snapshots via `CtosReport.company_json`/`person_json` (in `apps/api/prisma/schema.prisma`). If admin compares, it likely uses `corporate_onboarding_data.basicInfo.business_name` and CTOS `company_json.name` / registry fields (`apps/admin/src/lib/onboarding-ctos-compare.ts` uses `parseCtosNameReg(companyJson)` and returns `ctosName`/`ctosReg`). |
| Backend changes needed | Add a backend comparison utility that compares issuer-provided company name from onboarding/application snapshot to the official CTOS/SSM name. Then expose a result to admin UI as warning/block flag. Candidate sources for “official company name”: `ctos_reports[].company_json.name` (CTOS) and/or `IssuerOrganization.registration_number` + registry-derived name if present in `ctos_reports`. Exact “CTOS/SSM data” shapes are in `ctos_reports.company_json` (JSON), but the repo evidence shows only directory ID compare logic for people; company-name auto-compare is missing. |
| Frontend changes needed | Admin UI: show a warning/badge next to `Company Name` in the relevant review panel. Issuer UI: likely show a warning only (not block) when starting/continuing after onboarding fetch. Existing company-name display is in `apps/admin/src/components/application-review/sections/company-section.tsx` (renders `Company Name`). |
| Ledger/accounting impact | None. |
| Status impact | None (pure validation). |
| Open questions | 1) Should this be blocking or warning-only? 2) What exact “official company name” source is legal/compliance-approved: CTOS `ctosName`, SSM name from RegTank onboarding response, or something else? 3) Matching rules: allow minor punctuation/spacing changes? handle “Sdn Bhd” vs “SDN BHD”? handle capitalization and Malay/English variants? |
| Recommended implementation priority | P1 (validation quality; low accounting risk). |

#### Concrete evidence anchors
- Issuer company name entry: `apps/issuer/src/components/account-type-selector.tsx` (`Company Name` field + `createOrganization({ type: "COMPANY", name: companyNameValue })`).
- Admin comparison helper exists, but is described as manual/match-by-eye: `apps/admin/src/lib/onboarding-ctos-compare.ts` header comment says CTOS vs onboarding “admin matches by eye”.
- Company name shown in admin review UI: `apps/admin/src/components/application-review/sections/company-section.tsx` uses `basicInfo.businessName` / `basicInfo.business_name` / `rawOrg.name`.

---

### 2. Retain previous year management account financial numbers for future invoice financing

| Item | Details |
|---|---|
| Business meaning | When an issuer applies for future invoice financing, re-use or reference management account numbers already submitted for the previous financial year(s), to reduce re-entry and speed approvals. |
| Current code behavior | Financial statements data is captured in the issuer app and persisted to `Application.financial_statements` (flat keys and a v2 structure). The issuer financial step loads *only from the current application* (`apps/issuer/src/app/(application-flow)/applications/steps/financial-statements-step.tsx`, reads `application.financial_statements` via `useApplication(applicationId)` and populates form state from that). There is no evidence in the gathered code that future applications prefill financial statements from earlier applications. |
| Files checked | `apps/issuer/src/app/(application-flow)/applications/steps/financial-statements-step.tsx` (load/save behavior); `apps/api/prisma/schema.prisma` (field `Application.financial_statements`); `apps/issuer/src/app/(application-flow)/applications/steps/financial-statements-step.tsx` (v2 payload mapping keys). |
| DB models/fields involved | Prisma: `model Application { financial_statements Json? }` in `apps/api/prisma/schema.prisma`. In the issuer UI, `financial_statements` payload includes a v2 questionnaire `financial_year_end` and per-year money fields like `bsfatot`, `bscatot`, `plyear`, `plnpat`, etc. (`FinancialStatementsPayload` inside `financial-statements-step.tsx`). |
| Backend changes needed | Add cross-application reuse logic. Options: (a) Pre-fill from the most recent application by issuer organization and matching fiscal year end, (b) Store a separate normalized “financial summary per issuer per FY end” table to avoid copying JSON blobs, (c) Allow admin review to reference prior-year numbers without copying into the current application. Current code stores these numbers only in `Application.financial_statements`. |
| Frontend changes needed | Issuer financial step: add an “Use previous year data” or “Prefill from last application” button. Admin comparison UI: show current vs referenced prior-year financial numbers. |
| Ledger/accounting impact | None. |
| Status impact | None. |
| Open questions | 1) Which “source of truth” should be reused: latest application values, most recent per FY end, or the most recent approved/accepted values only? 2) Should prefill be editable? 3) Should stale data be flagged (risk-of-stale requirement)? |
| Recommended implementation priority | P2 (efficiency; ensure legal/compliance approval semantics). |

#### Concrete evidence anchors
- Data captured and loaded only from current app: `apps/issuer/src/app/(application-flow)/applications/steps/financial-statements-step.tsx` reads `const saved = application.financial_statements` and initializes forms from it.
- Payload keys: `FinancialStatementsPayload` includes `pldd`, `bsfatot`, `bscatot`, `turnover`, `plnpat`, `plyear`, etc.

---

### 3. CTOS consent form coverage for directors

| Item | Details |
|---|---|
| Business meaning | Confirm whether CTOS consent covers all directors/shareholders (company-level) or only the company/applicant (single consent), and implement correct tracking/coverage if per-director consent is required. |
| Current code behavior | The evidence gathered does not show a specific “CTOS consent form per director” generation/upload flow in the backend. There is a CTOS XSL snippet indicating consent is required from the subject before retrieval of the report (`apps/api/src/modules/ctos/xslt/subreport/footer_subreport.xsl`). Admin has CTOS vs onboarding compare logic for director/shareholder IDs (`apps/admin/src/lib/onboarding-ctos-compare.ts`), but it does not show consent coverage logic. Prisma has CTOS report snapshots (`CtosReport`) that can include `company_json` and `person_json`, and CTOS party supplements (`CtosPartySupplement`), but there is no direct “consent per director” model in the evidence gathered. |
| Files checked | `apps/api/prisma/schema.prisma` (`CtosReport`, `CtosPartySupplement`, `IssuerOrganization.director_kyc_status`, `IssuerOrganization.director_aml_status`); `apps/admin/src/lib/onboarding-ctos-compare.ts`; `apps/api/src/modules/ctos/xslt/*` consent text. |
| DB models/fields involved | Prisma: `CtosReport` contains `company_json`, `person_json`, and `subject_ref`. `CtosPartySupplement` stores onboarding JSON per party (`party_key`). Director/shareholder onboarding statuses are stored on `IssuerOrganization.director_kyc_status` / `director_aml_status` as JSON fields. *(No explicit consent tracking model found in the evidence collected.)* |
| Backend changes needed | `UNCLEAR / NEEDS CONFIRMATION`: implement consent-per-person tracking if required. Likely add a table for “CTOS consent per director/shareholder” and link it to `IssuerOrganization` and/or application/contract signing. Also update consent-gating logic wherever CTOS report subject retrieval occurs. |
| Frontend changes needed | Admin financial tab: add per-director consent status indicators and actions (view consent proof, trigger consent flow if missing). If issuer portal asks for consent, add per-director checkboxes or director selection. |
| Ledger/accounting impact | None. |
| Status impact | Onboarding/admin review statuses may be gated, but this is not currently confirmed. |
| Open questions | 1) What does CTOS consent legally cover in your jurisdiction? 2) Do you need individual consent proof per director/shareholder, or is company consent enough? 3) Which CTOS product “retrieval” is gated by consent: company report, director EOD/COD subject reports, or both? |
| Recommended implementation priority | P3 (compliance-critical, but implementation depends on legal decision). |

---

### 4. SigningCloud re-sign flow if wrong director signs

| Item | Details |
|---|---|
| Business meaning | If the issuer uses the wrong director/person to sign the offer, admin must be able to request a re-sign (without breaking the workflow/history). |
| Current code behavior | SigningCloud offers have a persisted `offer_signing` JSON payload and a unique `signing_sc_contractnum` stored on `Contract` or `Invoice`. When signing is started, the backend stores: `offer_signing.provider = "signingcloud"`, `status = "pending"`, `initiated_by_user_id`, and `signer_email` (derived from the current issuer user’s email), plus `signing_url` and `return_url`. When the webhook/callback finalizes signing, it fetches the signed PDF, computes SHA256, stores the signed PDF to S3 under a new key, and calls `respondToContractOffer(..., "accept", ..., signingCompletion: { signedOfferLetterS3Key, signedFileSha256 })`, which updates `offer_signing` by merging signed metadata (`mergeOfferSigningSigned`). The response is guarded by `responded_at`/`ALREADY_RESPONDED`, and the contract/invoice status becomes `APPROVED` (contract) or `APPROVED` (invoice). There is no evidence of a “re-sign requested” state that allows going from `APPROVED` back to `OFFER_SENT` for another signature. |
| Files checked | Backend: `apps/api/src/modules/applications/service.ts` (`startContractOfferSigning`, `startInvoiceOfferSigning`, `processSigningCloudCallback`, `finalizeContractOfferAfterSigningCloud`, `finalizeInvoiceOfferAfterSigningCloud`, `respondToContractOffer`, `respondToInvoiceOffer`). Data: `apps/api/prisma/schema.prisma` models `Contract.offer_signing`, `Contract.signing_sc_contractnum`, `Invoice.offer_signing`, `Invoice.signing_sc_contractnum`. |
| DB models/fields involved | Prisma: `model Contract` (`offer_signing Json?`, `signing_sc_contractnum String? @unique`); `model Invoice` (`offer_signing Json?`, `signing_sc_contractnum String? @unique`). Signing metadata includes `status` (`pending` → `signed`), `signer_email`, `initiated_by_user_id`, `signed_offer_letter_s3_key`, `signed_file_sha256` (shape in JSON). |
| Backend changes needed | Add a re-sign lifecycle and allow returning the offer to a signing-pending state. Currently `respondToContractOffer/respondToInvoiceOffer` blocks repeat responses when `offer.responded_at` is set and the contract/invoice status is no longer `"OFFER_SENT"` (`INVALID_STATE` / `ALREADY_RESPONDED`). Proposed change: add a new contract/invoice signing sub-status in `offer_signing` JSON (e.g. `status: "re_sign_requested"`), and implement a backend method to (a) mark the old signed offer as superseded, (b) create a new SigningCloud session, and (c) preserve old signed S3 objects. Exact status transitions depend on desired audit semantics. |
| Frontend changes needed | Admin UI: add an action on contract/invoice offer signing section to “Request re-sign”. Issuer UI: show current signature validity and allow signer restart. |
| Ledger/accounting impact | None (signing is documentation workflow). |
| Status impact | `ContractStatus` / `InvoiceStatus` may need expanded behavior: currently response drives `ContractStatus` to `APPROVED` and `InvoiceStatus` to `APPROVED`. A re-sign feature likely needs a new intermediate state or allow reversion from `APPROVED` to pending signing without breaking the rest of the application lifecycle. |
| Open questions | 1) Do you want to allow re-sign only while contract/invoice are still in a pre-funding “APPROVED but not fully completed” state? 2) Do we need to invalidate downstream note/investment flows if signature changes? 3) What is the audit requirement: keep old signed PDFs and mark them “superseded” vs delete? |
| Recommended implementation priority | P3 (workflow/audit complexity). |

#### Concrete evidence anchors
- Signing initiation stores signer metadata and pending status: `apps/api/src/modules/applications/service.ts` (`startContractOfferSigning`, `startInvoiceOfferSigning`, assigns `offerSigning: { provider: "signingcloud", status: "pending", initiated_by_user_id, signer_email, signing_url, return_url }`).
- Re-sign is blocked by “already responded” in `respondToContractOffer` and `respondToInvoiceOffer` (guards `offer.responded_at != null` and `contract.status !== "OFFER_SENT"` / `invoice.status !== "OFFER_SENT"`).
- Signed PDF is stored under new S3 keys with timestamp: e.g. `applications/${application.id}/offer-letters/contract-${Date.now()}.pdf` in `finalizeContractOfferAfterSigningCloud`.

---

### 5. Make sure the right person signs without redoing full KYC

| Item | Details |
|---|---|
| Business meaning | Ensure the correct director/person signs the offer, without requiring the issuer to redo KYC/KYB. |
| Current code behavior | SigningCloud uses the current issuer user’s email (`user.email.trim()`) as `signerEmail` when starting manual signing (`uploadPdfToSigningCloud({ signerEmail: user.email.trim() })` and `startManualSigning({ signerEmail: user.email.trim() })`). The persisted signing metadata includes `signer_email` and `initiated_by_user_id` in `offer_signing`. However, there is no evidence yet of restricting SigningCloud recipients to an “approved director email list” or verifying that the signer email matches the director/shareholder records used for CTOS/KYC. Admin enforces director/shareholder KYC completion in onboarding approval (see `apps/api/src/modules/admin/service.ts` checks for “All directors/shareholders must complete KYC verification before final approval”), but that is separate from SigningCloud signer verification. |
| Files checked | Backend signing: `apps/api/src/modules/applications/service.ts` (signer email usage). Onboarding status enforcement: `apps/api/src/modules/admin/service.ts` (director KYC completion gating). Director/shareholder KYC storage: `apps/api/prisma/schema.prisma` (`IssuerOrganization.director_kyc_status`, `IssuerOrganization.director_aml_status` JSON). Admin compare helper: `apps/admin/src/lib/onboarding-ctos-compare.ts` (parses names/IDs from CTOS JSON; does not directly connect to signer email). |
| DB models/fields involved | `IssuerOrganization.director_kyc_status` / `director_aml_status` are JSON. Signing metadata includes `offer_signing.signer_email` and `initiated_by_user_id`. Individual director/shareholder rows in KYC may include names/government IDs (JSON), but “approved director emails” are not confirmed by the evidence gathered. |
| Backend changes needed | Implement signer identity verification by mapping the director/shareholder “approved list” to allowed emails. Then block starting signing if current issuer user email is not in that allowed list (or require a declaration/admin override). This requires confirming whether director/shareholder emails exist in stored director KYC JSON from RegTank/CTOS. If not, you may need to add signer email capture to onboarding records. |
| Frontend changes needed | Issuer UI: show which director emails are authorized to sign (or which signer is currently selected). Provide a “Signer is authorized” confirmation if permitted. Admin UI: allow admin to select an authorized signer and re-initiate signing without full KYC redo. |
| Ledger/accounting impact | None. |
| Status impact | No finance status changes; this gates signing actions. |
| Open questions | 1) Are director/shareholder emails stored in `IssuerOrganization.director_kyc_status` JSON (and reliably)? 2) If emails are missing, what is the acceptable alternative matching method: government ID match (IC/BRN), name match, or manual admin verification? 3) Should admin override be allowed and audited? |
| Recommended implementation priority | P2 (reduces operational errors; depends on available signer identity data). |

---

### 6. Admin platform fee field

| Item | Details |
|---|---|
| Business meaning | Admin must be able to input/edit the platform fee on the invoice/offer/note flow. |
| Current code behavior | Backend fee fields are present on `Note`: `platform_fee_rate_percent` and `service_fee_rate_percent`. Admin can update them while the note is still in draft via `adminNotesRouter.patch("/:id/draft")` → `noteService.updateDraft()` using `updateNoteDraftSchema` (`platformFeeRatePercent` is validated with zod `min(0).max(3)`, `serviceFeeRatePercent` with `max(15)`). When publishing (`noteService.publish()`), there is also a cap check that throws `NOTE_FEE_CAP_EXCEEDED` if `platform_fee_rate_percent > 3` or `service_fee_rate_percent > 15`. The investor-facing UI shows platform/service fee labels only at the note terms display (`apps/admin/src/notes/components/note-terms-panel.tsx` shows “Platform fee … at disbursement” and “Service fee … of investor profit”). There is no evidence (in the gathered code) of fee editing earlier in the invoice/offer flow itself; instead it is attached to the Note draft. |
| Files checked | Backend routes and schemas: `apps/api/src/routes.ts`, `apps/api/src/modules/notes/controller.ts`, `apps/api/src/modules/notes/schemas.ts`, `apps/api/src/modules/notes/service.ts`. Frontend: `apps/admin/src/notes/components/note-terms-panel.tsx`. |
| DB models/fields involved | Prisma `model Note`: `platform_fee_rate_percent`, `service_fee_rate_percent`. Validation: `updateNoteDraftSchema` in `apps/api/src/modules/notes/schemas.ts`. |
| Backend changes needed | If your requirement is strictly “admin can input/edit”, backend is already present for notes draft updates. The gap is to confirm whether the admin UI surfaces these fields during “invoice/offer/note flow” (before note draft is created). If the UI is missing, backend changes may be none; only API wiring/UX may be needed. |
| Frontend changes needed | Confirm/implement the UI that calls `PATCH /v1/admin/notes/:id/draft` with `platformFeeRatePercent` / `serviceFeeRatePercent`. If the current admin UI never presents those fields, add them in the note draft editor. Also ensure platform fee transparency is shown in the admin note details and investor info sheet. |
| Ledger/accounting impact | Platform fee is posted at disbursement: `noteService.postDisbursementLedger()` debits `INVESTOR_POOL` and credits `OPERATING_ACCOUNT` with `platformFee` and credits `ISSUER_PAYABLE` with `netDisbursement` (funded amount minus platform fee). |
| Status impact | None. |
| Open questions | 1) Should platform fee be edited at invoice/offer time as well, or is note-draft time sufficient? 2) Fee model: is it always percentage rate only, or do you later need a fixed amount + cap? Current implementation is percentage rate only. |
| Recommended implementation priority | P1 (backend mostly exists; UI wiring needed). |

#### Concrete evidence anchors
- API schema: `apps/api/src/modules/notes/schemas.ts` (`updateNoteDraftSchema` includes `platformFeeRatePercent`, `serviceFeeRatePercent` with caps).
- Publishing cap enforcement: `apps/api/src/modules/notes/service.ts` checks `> 3` and `> 15`.
- Fee posting: `apps/api/src/modules/notes/service.ts` `postDisbursementLedger()` sets `platformFee` and credits `OPERATING_ACCOUNT`.

---

### 7. Product-level marketplace appearance duration

| Item | Details |
|---|---|
| Business meaning | Admin/product config should allow marketplace listing duration to vary by product (e.g. 14 days, 18 days). |
| Current code behavior | Listing duration is currently hard-coded in backend note publishing: `DEFAULT_LISTING_DURATION_DAYS = 14` and `closes_at = now + DEFAULT_LISTING_DURATION_DAYS * ...` inside `noteService.publish()` (`apps/api/src/modules/notes/service.ts`). The marketplace expiry job auto-closes based on `note.listing.closes_at`. There is no evidence of a product-level listing duration field in the Prisma `Product` model. The `Product` model has `workflow Json` and `offer_expiry_days` but no explicit listing-duration field. |
| Files checked | `apps/api/src/modules/notes/service.ts` (default listing duration constant and closesAt computation); `apps/api/src/lib/jobs/note-listing-expiry.ts` (expiry job conditions); `apps/api/prisma/schema.prisma` (`model Product`). |
| DB models/fields involved | `NoteListing.closes_at` (`apps/api/prisma/schema.prisma`). `Product` model lacks a `listing_duration_days` field (only `workflow Json` and `offer_expiry_days`). |
| Backend changes needed | Add a product-level listing duration configuration. Options: (a) Add a real DB field `Product.listing_duration_days`, (b) Store it inside `Product.workflow Json` and read it when publishing notes. Then modify `noteService.publish()` to compute `closes_at` based on product config. |
| Frontend changes needed | Admin product settings UI: add the field (or surface in workflow builder) and validate. Also ensure investor marketplace uses the updated `closes_at`. |
| Ledger/accounting impact | None. |
| Status impact | Changes the `NoteListing.closes_at` timestamp, which affects the note auto-close logic and likely `NoteFundingStatus` transitions when the cron runs. |
| Open questions | 1) Where should the config live: DB field vs workflow JSON? 2) Should listing duration apply to `publishing` only, or also when notes are re-published/unpublished? |
| Recommended implementation priority | P2 (timing correctness). |

#### Concrete evidence anchors
- Hard-coded default: `apps/api/src/modules/notes/service.ts` `DEFAULT_LISTING_DURATION_DAYS = 14`.
- Cron uses `note.listing.closes_at`: `apps/api/src/lib/jobs/note-listing-expiry.ts`.

---

### 8. Marketplace card days left is wrong

| Item | Details |
|---|---|
| Business meaning | Investor marketplace cards should show “days left” based on marketplace listing closing date (funding window), not based on note maturity/tenor. |
| Current code behavior | The investor marketplace calculates `tenorDays` and also uses that for `daysLeft`. Specifically in `apps/investor/src/app/investments/page.tsx`: `const tenorDays = daysUntil(note.maturityDate);` and then returns `daysLeft: tenorDays`. The note card UI displays `note.daysLeft` as “X day(s) left”. (`apps/investor/src/components/marketplace/note-card.tsx` uses `{note.daysLeft} day(s) left`.) |
| Files checked | `apps/investor/src/app/investments/page.tsx`, `apps/investor/src/components/marketplace/note-card.tsx`, backend `apps/api/src/modules/notes/mapper.ts` to confirm marketplace note detail includes listing `closesAt` but investor marketplace mapping currently does not use it. |
| DB models/fields involved | `NoteListing.closes_at` exists on `NoteListing`. Investor marketplace DTO currently uses `maturityDate` for tenor/days left. Backend mapping `mapMarketplaceNoteDetail()` includes `listing.closesAt` but the investor mapping does not appear to consume it (in `toMarketplaceNote`). |
| Backend changes needed | Potentially none if `closes_at` is already returned via `mapMarketplaceNoteDetail`. But the investor marketplace frontend likely needs to request/use `listing.closesAt` and compute days-left from that. |
| Frontend changes needed | Fix `apps/investor/src/app/investments/page.tsx` to compute `daysLeft` from `note.listing.closesAt` (expected formula: `NoteListing.closes_at - today`), not from `note.maturityDate`. Also ensure tenor/maturity days remain displayed separately via `tenorDays`. |
| Ledger/accounting impact | None. |
| Status impact | None. |
| Open questions | 1) Should the card show “0 days left” or hide once it closes? 2) How to handle missing `closesAt` (`null`) in listing (allowed in schema as `DateTime?`)? |
| Recommended implementation priority | P1 (visible bug; low risk). |

#### Concrete evidence anchors
- Investor bug: `apps/investor/src/app/investments/page.tsx` lines around `toMarketplaceNote()` compute `tenorDays` from `note.maturityDate` and assign `daysLeft: tenorDays`.
- Marketplace card display: `apps/investor/src/components/marketplace/note-card.tsx` shows `note.daysLeft` as “day(s) left”.
- Backend listing mapping exists: `apps/api/src/modules/notes/mapper.ts` `mapMarketplaceNoteDetail()` maps `listing.closesAt: iso(note.listing.closes_at)`.

---

### 9. Trustee instruction signing requirement

| Item | Details |
|---|---|
| Business meaning | Trustee instruction letters (issuer payout / residual refund) may need a signature before they are submitted to the trustee. |
| Current code behavior | Withdrawal workflow in Prisma is `WithdrawalInstruction.status` with `WithdrawalStatus` states. DB model includes `letter_s3_key`, `generated_at`, `submitted_to_trustee_at`, and `completed_at` (`apps/api/prisma/schema.prisma`). Admin UI in `apps/admin/src/notes/components/issuer-payout-card.tsx` supports: generate letter (`useGenerateWithdrawalLetter`), mark submitted (`useMarkWithdrawalSubmitted`), and mark completed (`useMarkWithdrawalCompleted`). The UI allows re-editing beneficiary details only while `status === "DRAFT"`. There is no UI or DB field for uploading a “signed trustee letter” before submission. |
| Files checked | Prisma: `apps/api/prisma/schema.prisma` `model WithdrawalInstruction` (fields `letter_s3_key`, timestamps, status). Frontend: `apps/admin/src/notes/components/issuer-payout-card.tsx`. |
| DB models/fields involved | `WithdrawalInstruction`: `status`, `letter_s3_key`, `submitted_to_trustee_at`, `completed_at`. |
| Backend changes needed | Add a new status and storage for a signed letter upload, e.g. `signed_letter_s3_key` (or reuse versioned key scheme) and a new state such as `SIGNED_LETTER_UPLOADED` between `LETTER_GENERATED` and `SUBMITTED_TO_TRUSTEE`. Add validation in the backend so `markWithdrawalSubmitted` requires the signed letter when the product/legal requires it. |
| Frontend changes needed | Add an upload step in `issuer-payout-card.tsx` when status is `LETTER_GENERATED` and trustee-signature is required. Allow view/download of unsigned and signed letters. Add upload gating in UI before “Mark Submitted”. |
| Ledger/accounting impact | None (documents only). |
| Status impact | Requires expanding `WithdrawalStatus` and the UI logic in `issuer-payout-card.tsx`. Potentially affects note `servicing_status` gating (but payout marking itself remains ledger posting). |
| Open questions | 1) Is trustee signature required always or only for certain withdrawal types/products? 2) Who signs (issuer or trustee), and should we capture signatory identity? |
| Recommended implementation priority | P3 (document workflow + validation changes). |

---

### 10. Payment receipt from Shoraka for onboarding fee / application fee

| Item | Details |
|---|---|
| Business meaning | Store receipt evidence for onboarding fee (issuer onboarding) and application fee (issuer financing applications), and expose payment status and receipt evidence in admin/issuer views. |
| Current code behavior | The evidence gathered shows note payment receipts for repayments (`NotePayment.evidence_s3_key`, `NotePayment.receipt_amount`, etc.), and various fee wording in help content, but no explicit DB model or API flow for storing “onboarding fee receipts” or “application fee receipts” evidence was found in the code scans performed. The help content references RM 150 onboarding fee and RM 50 application fee, but that alone does not prove receipt storage exists in the backend. |
| Files checked | `apps/api/prisma/schema.prisma` (searched for receipt/evidence patterns and did not find onboarding- or application-fee-specific receipt fields in gathered evidence); `apps/api/src/modules/notes/service.ts` (found repayment receipt support only); `packages/help-content/markdown/admin-onboarding-flow.md` and related generated help content references for fee amounts. |
| DB models/fields involved | `model NotePayment` has repayment receipt fields including `evidence_s3_key`, but onboarding/application fees are not confirmed to use similar storage. *(UNCLEAR / NEEDS CONFIRMATION: where application fee receipts are stored, if at all.)* |
| Backend changes needed | Add DB tables/fields for “fee payments” and receipt evidence (e.g. `OnboardingFeePayment` and `ApplicationFeePayment` or a generic `FeePayment` table), plus APIs for uploading/viewing receipts. Also connect it to onboarding/application timeline logs. |
| Frontend changes needed | Issuer admin/issuer portal UI to upload receipts (if required by workflow), admin UI to verify and show evidence. |
| Ledger/accounting impact | If fees are accounted via ledger buckets, ledger buckets may need new buckets/accounts; otherwise it can remain separate from note ledger. Current note ledger is for note repayments/settlement/disbursement. |
| Status impact | Likely add or gate onboarding/app submission based on `feePaymentStatus`. Not confirmed in evidence. |
| Open questions | 1) Is receipt evidence already recorded somewhere external (not in repo), or should it be added now? 2) Which fee payments are in scope: issuer onboarding fee only, application fee only, or both plus deposits? |
| Recommended implementation priority | P3 (audit/compliance requirement; depends on existing payment rail). |

---

### 11. Investor side should show fees deducted from profit

| Item | Details |
|---|---|
| Business meaning | Investors should see service/platform fees deducted from profit (not only an overall repayment amount). |
| Current code behavior | Backend settlement waterfall data exists: `apps/api/src/modules/notes/mapper.ts` maps settlement fields including `serviceFeeAmount`, `investorProfitGross`, `investorProfitNet`. Investor list UI uses `note.investorRepaymentSummary` and `note.settlementSummary?.grossReceiptAmount`, but the `NoteInvestorRepaymentSummary` type in `packages/types/src/notes.ts` contains only: `investedPrincipal`, `expectedPayoutAmount`, `receivedPayoutAmount`, `expectedReturnRatePercent`, `actualReturnRatePercent`, `progressPercent`. There is no fee breakdown in the investor repayment summary type. The investor components displayed in the evidence (`apps/investor/src/investments/components/investment-position-card.tsx`) display repayment received and principal/expected profit totals, but not a service-fee line item. |
| Files checked | Investor UI: `apps/investor/src/investments/components/investment-position-card.tsx`; investor types: `packages/types/src/notes.ts`; backend settlement mapping: `apps/api/src/modules/notes/mapper.ts`. |
| DB models/fields involved | Settlement: `NoteSettlement.service_fee_amount`, `NoteSettlement.investor_profit_gross`, `NoteSettlement.investor_profit_net`. Investor summary currently omits service fee fields (confirmed by type). |
| Backend changes needed | Extend `NoteInvestorRepaymentSummary` to include `serviceFeeAmount` (or “service fee deducted from profit”), compute it from settlement allocations/waterfall for both expected and actual cases, and expose it to investor APIs. Alternatively, expose a dedicated “investor fee breakdown” object separate from `NoteInvestorRepaymentSummary`. |
| Frontend changes needed | Update investor note detail and portfolio UI components to display: principal, gross profit, service fee deducted, net profit, total received. Identify the exact screens to update (the evidence only confirms marketplace/investment cards). |
| Ledger/accounting impact | None (ledger already posts service fee into `OPERATING_ACCOUNT` at disbursement and/or uses settlement allocations at posting). This is a presentation/API exposure requirement. |
| Status impact | None. |
| Open questions | 1) Should platform fee also be shown as “deducted from profit” or only service fee? Current waterfall fields include service fee; platform fee is deducted at disbursement and impacts issuer payable. 2) Should investors see only service fee, or both platform and service fees? |
| Recommended implementation priority | P2 (product transparency; moderate API/UI changes). |

---

### 12. Missing letter generation for repayment waterfall / service fee

| Item | Details |
|---|---|
| Business meaning | Generate a document for the repayment waterfall and service fee allocation (for trustee/internal/audit and possibly investor evidence). |
| Current code behavior | Admin settlement servicing UI generates arrears and default letters (`apps/admin/src/notes/components/settlement-panel.tsx` has `handleLetter(kind: "arrears" | "default")`). There is no evidence in the gathered UI code for generating a repayment waterfall/service-fee letter. Backend letter generation logic for repayment waterfall/service fee is not found in the evidence collected; the existing letter templates appear in `PlatformFinanceSetting` as `withdrawal_letter_template`, `arrears_letter_template`, `default_letter_template`. |
| Files checked | Frontend: `apps/admin/src/notes/components/settlement-panel.tsx` (letter generation only for arrears/default). Prisma: `apps/api/prisma/schema.prisma` `model PlatformFinanceSetting` (template fields). |
| DB models/fields involved | Letter generation is tied to `PlatformFinanceSetting` templates and `WithdrawalInstruction.letter_s3_key` for trustee letters. No explicit template/storage for repayment waterfall letters found in evidence. |
| Backend changes needed | Add a new document type “repayment waterfall/service fee letter”, decide whether it is created at settlement preview, after approval, or after posting settlement, and store it in S3 with a DB link (possibly as a new table or a new field on settlement/withdrawal entities). |
| Frontend changes needed | Add a “Generate repayment waterfall letter” button on settlement panels and show/download the generated document. |
| Ledger/accounting impact | None. |
| Status impact | None (document generation), but likely requires gating based on `NoteSettlementStatus` (`APPROVED` vs `POSTED`). |
| Open questions | 1) Which party needs the document: issuer, trustee, investor? 2) Is the document required before settlement is posted or after posting? |
| Recommended implementation priority | P3 (document workflow). |

---

### 13. Ledger amount matching mechanism

| Item | Details |
|---|---|
| Business meaning | Add a good-to-have validation mechanism that ensures ledger postings match expected money movements (prevent mismatches, double credits/debits, settlement receipt allocation inconsistencies). |
| Current code behavior | There are several existing validations in `apps/api/src/modules/notes/service.ts` that partially address “ledger matching”: receipt amount limits (`assertReceiptAmountWithinSettlementLimit`), late fee caps, settlement completeness (`assertSettlementAmountComplete`), and repayment receipt ledger completion (`assertRepaymentReceiptLedgerComplete`). Settlement posting also checks existing repayment pool receipt ledger totals and creates an extra “repayment receipt shortfall” ledger entry if needed (`postSettlementLedger()`). Disbursement and settlement ledger posting use deterministic buckets and idempotency keys (`note:${note.id}:disbursement:${index}`, `payment:${payment.id}:receipt`, `settlement:${settlement.id}:${key}`). |
| Files checked | `apps/api/src/modules/notes/service.ts` (`postDisbursementLedger`, `postPaymentReceiptLedger`, `postSettlementLedger`; assertion functions); investor ledger buckets overview UI exists (`apps/admin/src/app/finance/buckets/page.tsx`) but not directly used for validations. |
| DB models/fields involved | Ledger: `NoteLedgerAccount` and `NoteLedgerEntry` models (not fully shown in evidence but referenced through `tx.noteLedgerAccount` and `prisma.noteLedgerEntry`). Idempotency key uniqueness and reconciliation are present through `NoteLedgerEntry.idempotency_key`. |
| Backend changes needed | Enhance validation coverage to enforce explicit balancing rules, e.g.: (a) disbursement ledger must balance funded amount, platform fee, issuer payable, (b) repayment pool credit totals must match settlement gross receipt allocation, (c) settlement waterfall amounts must sum to gross receipt amount (including late fees), (d) issuer payable recognition must equal completed withdrawal amounts, and (e) detect idempotency-key collisions/missing ledger postings. |
| Frontend changes needed | Add admin warning/error UX when validations detect mismatches (for example in settlement approval/post flows). Optionally display “ledger expected vs posted totals” diffs. |
| Ledger/accounting impact | Validation-only (unless you add new ledger postings/corrections). |
| Status impact | None (unless validations block actions). |
| Open questions | 1) Should validation be “warning only” or “hard block settlement/disbursement posting”? 2) How to handle the existing “shortfall” behavior in `postSettlementLedger()` (it currently tolerates some gap by adding a ledger entry rather than failing). |
| Recommended implementation priority | P3 (good-to-have; depends on operational pain). |

#### Concrete evidence anchors
- Assertions: `assertSettlementAmountComplete`, `assertRepaymentReceiptLedgerComplete`, `assertOpenReceiptsWithinSettlementLimit`, `assertNoPostedSettlement`.
- Idempotency keys: disbursement uses `note:${note.id}:disbursement:${index}`, receipt uses `payment:${payment.id}:receipt`, settlement uses `settlement:${settlement.id}:${key}`.
- Settlement ledger shortfall tolerance: `postSettlementLedger()` computes `receiptShortfall` and adds a ledger entry for it if `> 0.005`.

---

### 14. Facility fee for contract financing

| Item | Details |
|---|---|
| Business meaning | Introduce a contract-financing-only facility fee (~1% of approved facility), prorated per invoice, charged at disbursement, and stops once total facility fee is fully paid across invoices. |
| Current code behavior | Contract facility snapshot exists on contract details JSON: `approved_facility`, `utilized_facility`, and `available_facility` are computed and persisted by backend logic (`apps/api/src/modules/applications/service.ts` and `apps/api/src/modules/admin/service.ts` have computations referencing these fields). Prisma contracts/invoices store offer details JSON and contract_details JSON. However, there is no facility fee field in `apps/api/prisma/schema.prisma` in the evidence gathered, and no ledger posting logic for “facility fee” was found. Platform fee exists and is charged at disbursement; service fee exists and is charged as part of settlement waterfall/allocation. Facility fee is not currently present. |
| Files checked | Facility snapshot usage: `apps/api/src/modules/applications/service.ts` (utilized/available facility computations for contract details updates); `apps/api/src/modules/admin/service.ts` (recompute facility values); Prisma schemas for contract/invoice offer details: `apps/api/src/modules/contracts/schemas.ts` has `approved_facility`, `utilized_facility`, `available_facility` types. |
| DB models/fields involved | `Contract.contract_details` JSON (contains `approved_facility`, `utilized_facility`, `available_facility`). `Invoice.details` JSON contains invoice-specific financing values. Note model currently does not have any “facility fee” fields (only `platform_fee_rate_percent`, `service_fee_rate_percent`, and late fee caps). |
| Backend changes needed | Add facility fee configuration and state: at minimum, add contract-level fee totals and track “remaining facility fee” as invoices are disbursed. Proposed approach: add fields either to contract_details JSON or new DB columns/table: `facility_fee_rate_percent`, `facility_fee_total_amount`, `facility_fee_charged_amount`, `facility_fee_remaining_amount`. Then compute per-invoice facility fee on note close/disbursement (only for contract financing notes, not invoice-only) using: `perInvoice = min(invoiceFinancingAmount * rate, remainingFacilityFee)` and update the remaining after each disbursement. Add ledger posting from operating account / platform fee equivalent buckets. |
| Frontend changes needed | Admin offer UI: input fee rate if admin-configurable (or from product workflow). Admin note disbursement UI: show facility fee line and net issuer disbursement. Issuer and investor UI: show fee transparency. |
| Ledger/accounting impact | Must define ledger bucket behavior for facility fee. Current disbursement ledger credits `OPERATING_ACCOUNT` with `platformFee` only and credits `ISSUER_PAYABLE` with `netDisbursement = fundedAmount - platformFee`. Facility fee likely needs to be deducted similarly, meaning `netDisbursement` should be fundedAmount − platformFee − facilityFee, and `OPERATING_ACCOUNT` should be credited with platformFee + facilityFee (or a separate bucket if required). |
| Status impact | None (fee is accounting/doc-only), but disbursement ledger posting happens when note moves to `ACTIVE` through withdrawal completion (`noteService.activate` + `postDisbursementLedger`). |
| Open questions | 1) Verify whether facility fee is charged at disbursement time only and whether it should be part of existing cap logic (platform fee cap at 3% currently). 2) How to prorate if invoice financing amount < facility utilization increments? 3) Whether investors see facility fee deduction as part of profit waterfall or as an “expense” deducted from disbursement. |
| Recommended implementation priority | P4 (new fee model + ledger impact; higher complexity). |

---

## 3. Status impact map

This map indicates which state machines are likely affected by each requirement. If a requirement is validation-only or presentation-only, it may not change statuses.

- ApplicationStatus
  - Req1 (company name auto-check): none (validation only) unless blocking is chosen.
  - Req2 (reuse financial numbers): none (data prefill only), unless you add gating on submission completeness.
  - Req4/5 (SigningCloud re-sign / signer verification): possibly (if re-sign affects `respondToContractOffer/respondToInvoiceOffer` and recomputes application status).
  - Req6 (platform fee edit): none.
  - Req7 (listing duration): none.
  - Req9 (trustee signed letters): none.
  - Req10 (onboarding/application fee receipts): may gate onboarding/application submission statuses (not confirmed).
  - Req12/13/14: none (docs/validation/fee model).

- ContractStatus
  - Req4: high impact; current flow sets contract `status` to `APPROVED` and blocks repeat responses when `offer.responded_at` is set.

- InvoiceStatus
  - Req4: high impact; current flow sets invoice `status` to `APPROVED` and blocks repeat responses.

- NoteStatus
  - Req7/8: listing window changes affect note funding closure early/late; note `status` transitions are driven by `noteService.closeFunding/failFunding` and `noteService.activate`/settlement.
  - Req9/12/13: none.
  - Req6/14: disbursement ledger impacts note activation path but not note status state machine itself.

- NoteListingStatus
  - Req7: likely affects `NoteListing.closes_at` → note auto-close job determines whether to close/fail funding. Listing status changes are triggered by publish/unpublish and closeFunding/failFunding flows (not fully mapped here, but cron calls `noteService.closeFunding/failFunding`).
  - Req8: UI only.

- NoteFundingStatus
  - Req7: yes via listing expiry and publish-time `closes_at`.
  - Req8: UI only.

- NoteServicingStatus
  - Req6/14: disbursement completion unlocks servicing (`noteService.activate` sets `servicing_status` to `CURRENT`).
  - Req9: trustee signature step may delay marking completed; therefore servicing unlock timing could be affected (depending on how “submitted/disbursed” maps).

- WithdrawalStatus
  - Req9: yes; new state may be needed (signed letter uploaded).
  - Req4/5: none.

- NotePaymentStatus
  - Req13: ledger validations may block payment review/receipt posting if you choose hard-block.
  - Others: none.

- NoteSettlementStatus
  - Req12/13: document generation and validations may gate settlement approve/post, depending on implementation.

- NoteInvestmentStatus
  - Req13: none (unless ledger mismatch blocks settlement posting, which then affects settlement payout and statuses).

## 4. Fee model map

Current confirmed fee models from code evidence:

- Platform fee
  - Charged to: platform bucket via ledger at note disbursement.
  - When: `noteService.postDisbursementLedger()` credits `OPERATING_ACCOUNT` at disbursement.
  - Stored: `Note.platform_fee_rate_percent`.
  - Shown to: admin note terms panel (`apps/admin/src/notes/components/note-terms-panel.tsx`), investor info sheet/UI (not fully confirmed).
  - Ledger bucket: `OPERATING_ACCOUNT`.
  - Receipt/letter needed: not confirmed (docs/receipts for platform fee are not evidenced).

- Service fee
  - Charged to: service fee amount is included in settlement waterfall and allocated from repayment pool and investor profit net (based on existing settlement ledger entries).
  - When: at settlement approval/post (ledger postings in `postSettlementLedger()` include “service-fee” entry crediting `OPERATING_ACCOUNT` with `settlement.service_fee_amount`).
  - Stored: `Note.service_fee_rate_percent`, and settlement stores `NoteSettlement.service_fee_amount`.
  - Shown to: admin note terms panel (service fee label). Investor breakdown is missing in the current investor API/type.
  - Ledger bucket: `OPERATING_ACCOUNT` and `REPAYMENT_POOL` / investor profit net directions.
  - Receipt/letter needed: Req12 asks for missing waterfall/service fee letter; currently not evidenced.

- Facility fee
  - Current behavior: not implemented in code evidence.
  - Ledger bucket impact: likely similar to platform fee deduction at disbursement, but requires new fields and ledger posting logic.
  - Receipt/letter: Req12/10 may be required.

- Onboarding fee / Application fee
  - Current behavior: amounts exist in help content (`packages/help-content/*`), but receipt evidence storage is not confirmed in backend code evidence.

- Late charges Ta'widh/Gharamah
  - Charged to: deducted/allocated as part of settlement waterfall; supported by calculators and ledger posting.
  - When: when receipts are recorded post-grace and then settlement calculates/approves.
  - Stored: `Note.tawidh_rate_cap_percent`, `Note.gharamah_rate_cap_percent`, and settlement/tawidh/gharamah amounts.
  - Receipt/letter: admin can calculate late charges and letters for arrears/default are generated; but “repayment waterfall letter” for service fee is missing (Req12).

## 5. Marketplace timing map

- Listing duration
  - Current: hard-coded `DEFAULT_LISTING_DURATION_DAYS = 14` in `apps/api/src/modules/notes/service.ts` publish logic.
  - Next: Req7 requests product-level override.

- Tenor/maturity days
  - Current: investor UI uses `Note.maturity_date` to compute tenor days and (incorrectly) days-left (Req8).
  - Listing days left should use `NoteListing.closes_at` which is already stored and used by cron.

- Days left to invest
  - Current: `apps/investor/src/app/investments/page.tsx` sets `daysLeft` from `note.maturityDate` (tenor).
  - Expected: use `note.listing.closesAt` (or corresponding field returned by marketplace note detail).

- Product-level config
  - Current product model: `apps/api/prisma/schema.prisma` `model Product` has `workflow Json` and `offer_expiry_days`, but no explicit listing duration field. Product-level listing duration likely belongs in `workflow`.

- Cron expiry logic
  - Auto close/auto fail: `apps/api/src/lib/jobs/note-listing-expiry.ts` runs hourly and checks `note.listing.closes_at <= now`.

## 6. Signing and signer verification map

Current SigningCloud flow (contract and invoice are similar):

- Start signing (contract): `apps/api/src/modules/applications/service.ts::startContractOfferSigning`
  - Fetches `Contract` by `application.contract_id`.
  - Requires contract status `"OFFER_SENT"`.
  - Requires issuer user email (used as `signerEmail`).
  - Stores pending signing JSON to `contract.offer_signing` with `signer_email` and `initiated_by_user_id`.
  - Uploads unsigned offer PDF bytes to SigningCloud and starts manual signing.

- Start signing (invoice): `startInvoiceOfferSigning` (same pattern; stores in `invoice.offer_signing`).

- Finalize signing callback:
  - `apps/api/src/modules/signingcloud/webhook-controller.ts` receives webhook and calls `applicationService.processSigningCloudCallback(contractnum)`.
  - `processSigningCloudCallback()` calls `finalizeContractOfferAfterSigningCloud` or `finalizeInvoiceOfferAfterSigningCloud`.
  - It fetches the signed PDF from SigningCloud, computes SHA256, uploads it to S3 under a timestamped key, then calls:
    - `respondToContractOffer(application.id, "accept", initiatedBy, ..., signingCompletion)`
    - `respondToInvoiceOffer(applicationId, invoiceId, "accept", initiatedBy, ..., signingCompletion)`

Re-sign requirement (Req4):
- Current limitation: `respondToContractOffer/respondToInvoiceOffer` blocks multiple responses using:
  - `offer.responded_at != null` → `ALREADY_RESPONDED`
  - `contract.status !== "OFFER_SENT"` / `invoice.status !== "OFFER_SENT"` → `INVALID_STATE`
- Therefore, adding re-sign needs new states and new “revert” behavior in the contract/invoice offer response pipeline.

Signer verification without redoing KYC (Req5):
- Current signer identity: SigningCloud uses the issuer user’s email.
- Missing evidence: director/shareholder email list and mapping logic between “approved directors” and allowed signing recipient.
- Implementing this requires confirming what data is present in `IssuerOrganization.director_kyc_status` JSON (does it include director emails?) and/or whether admin can select a signer and restrict `signerEmail` sent to SigningCloud.

## 7. Ledger validation proposal

Existing safeguards already present:

1) Settlement completeness and receipt limits
- `assertSettlementAmountComplete()` ensures gross receipt has reached required settlement amount (and checks late fees limits).
- `assertReceiptAmountWithinSettlementLimit()` and `assertOpenReceiptsWithinSettlementLimit()` enforce “open receipts” must not exceed allowed settlement+late fee.

2) Repayment receipt ledger completion
- `assertRepaymentReceiptLedgerComplete(noteId, requiredAmount)` checks the sum of ledger entries in `REPAYMENT_POOL` credits for the note.

3) Idempotency keys
- Disbursement ledger: `idempotency_key: note:${note.id}:disbursement:${index}`
- Payment receipt ledger: `idempotency_key: payment:${payment.id}:receipt`
- Settlement ledger: `idempotency_key: settlement:${settlement.id}:${key}`

4) Reconciliation tolerance behavior
- `postSettlementLedger()` compares existing receipt entries vs `gross_receipt_amount` and if there is a shortfall `> 0.005`, it posts an extra “repayment receipt shortfall” ledger entry instead of failing.

Proposed new validation rules for Req13 (examples you requested):
- Disbursement must balance:
  - Expected: funded_amount = investor_pool_debit + (platform_fee + net_disbursement) where net_disbursement is issuer_payable_credit + platform fee credit sums.
  - Implementation: after `postDisbursementLedger()`, compute totals from the created ledger entries and assert the identity holds within tolerance.

- Repayment pool credits must match received payments:
  - Expected: sum of receipt ledger credits in `REPAYMENT_POOL` for the note equals the gross receipt value used for settlement waterfall (`settlement.gross_receipt_amount`).
  - Implementation: strengthen `assertRepaymentReceiptLedgerComplete` to compare exact target gross receipt, not only “required amount” threshold, and decide whether to hard-block or warn.

- Settlement allocation must equal gross receipt amount:
  - Expected: investor_principal + investor_profit_net + service_fee_amount + tawidh_amount + gharamah_amount + issuer_residual_amount + unapplied_amount (depends on waterfall output semantics) sums to gross receipt.
  - Implementation: after `calculateSettlementWaterfall()` produces allocations, assert the sum equals `settlement.gross_receipt_amount` (tolerance).

- Issuer payable debit must match withdrawal completion amount:
  - Current code: withdrawal completion flips note status/servicing; the disbursement/issuer payable ledger postings should be checked. *(This part is not fully verified in the evidence we collected; to be confirmed in `markWithdrawalCompleted` and the ledger posting helper for withdrawals.)* `UNCLEAR / NEEDS CONFIRMATION`.

Where to call validation:
- Add validation calls in the backend service before updating statuses to “posted/complete”, ideally inside the same Prisma transaction to avoid partial state.

Admin warning/error UX:
- If validation fails hard: return an error code that is displayed on settlement/disbursement action button.
- If warning-only: include “expected vs posted” totals in error details for the admin UI.

## 8. Implementation phases

Suggested safe phases that reduce risk:

1. UI wording/display bug fixes
   - Req8 “days left wrong”: switch to listing `closesAt` for days-left.
2. Product-level listing duration
   - Req7: add product config + modify `noteService.publish()` + ensure cron expiry remains correct.
3. Platform fee admin input
   - Req6: confirm admin note draft UI surfaces `platformFeeRatePercent` and `serviceFeeRatePercent` and persists via `PATCH /v1/admin/notes/:id/draft`.
4. Facility fee data model + disbursement logic
   - Req14: add facility fee fields, compute per invoice, deduct at disbursement, and post ledger entries.
5. Signing re-sign flow
   - Req4: add new signing lifecycle state and re-sign action; preserve old signed PDFs (S3 versioned keys) and update audit logs.
6. Ledger matching mechanism
   - Req13: add strengthened validations and admin UX.
7. Letters/receipts
   - Req9 trustee signed letters (add signed-letter upload).
   - Req10 fee receipt evidence.
   - Req12 repayment waterfall/service fee letters.

## 9. Questions for business/Shoraka

These questions must be confirmed before coding (no guessing):

1) Req1: Auto name check
   - Should mismatch be blocking or warning-only?
   - Which official “truth” source is authoritative: CTOS company `name`, CTOS registry `brn_ssm`/`ic_lcno`, SSM name from RegTank onboarding response, or another field?
   - Exact matching rules for legal entity suffixes and punctuation variants.

2) Req2: Reuse previous year financial numbers
   - Which applications qualify as “source” (latest submitted vs latest approved vs latest completed)?
   - Do you want prefill or reference-only display?
   - Are there legal/compliance constraints on reusing stale numbers?

3) Req3: CTOS consent coverage for directors
   - Does CTOS consent cover all directors/shareholders or only the company/applicant?
   - Are per-director consent proofs required, and should it be tracked per director identity?

4) Req4/5: Signing re-sign and signer verification
   - Who is allowed to sign: approved director emails only, or any issuer user email with manual admin override?
   - Is re-sign allowed after contract/invoice is already `APPROVED` but before downstream steps (note creation/publishing) happen?
   - Audit requirements: keep superseded signed PDFs, and how to label them.

5) Req6: Platform fee field
   - Should platform fee be editable only at Note draft time (currently supported) or also earlier at invoice/offer time?
   - Fee type: percentage-only or future fixed fee support?

6) Req7/8: Marketplace timing
   - Listing duration: should duration apply only to `PUBLISH` time, or also when re-publishing notes?
   - If `NoteListing.closes_at` is null, what should UI show for “days left”?

7) Req9: Trustee instruction signature requirement
   - Is trustee-signature required always or only for certain withdrawal types/products?
   - Who signs and should we store signatory identity (name/email/IC) on the signed-letter record?

8) Req10: Fee receipt evidence
   - Which fee receipts are required: issuer onboarding fee (RM 150), issuer application fee (RM 50), both?
   - Upload flow: who uploads (issuer/admin), and where in admin/issuer UI should it appear?
   - What payment statuses already exist for these fees (if any)? *(Not confirmed in current evidence.)*

9) Req11/12: Investor transparency + letters
   - For Req11: should investors see platform fee and/or only service fee?
   - For Req12: which documents are required (template/content), and who receives them?
   - When must the repayment waterfall/service fee letter be generated: before approval, after approval, or after posting settlement?

10) Req13/14: Ledger validation and facility fee
   - Should ledger mismatch validations hard-block settlement/disbursement actions or only warn?
   - For Req14 facility fee: confirm the formula and stopping condition:
     - “Total facility fee = approved_facility × rate”
     - “Per invoice facility fee = min(invoice_financing_amount × rate, remaining facility fee)”
   - Confirm which ledger bucket accounts should receive facility fees and whether investors should see it as profit deduction or disbursement deduction.

