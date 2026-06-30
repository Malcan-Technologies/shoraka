# Onboarding Approval Flow

## 1. High-level summary

This flow describes how an **organization account** (either `OrganizationType.PERSONAL` or `OrganizationType.COMPANY`) moves from “started onboarding” to **fully active** using:

- **RegTank onboarding webhooks** (status updates for liveness, COD, EOD, KYC/KYB, and AML milestones)
- **Admin approval gates** in the Admin portal (SSM/CTOS verification, onboarding submission approval, AML gate, and final completion)
- **Issuer UI actions** (company onboarding submission, director/shareholder onboarding link sending, and status display)

Key idea: the system stores a coarse lifecycle in `onboarding_status` on:

- `InvestorOrganization` (investor portal)
- `IssuerOrganization` (issuer portal)

and uses **boolean flags** (like `onboarding_approved`, `aml_approved`, `ssm_approved`/`ssm_checked`, `tnc_accepted`) to control which states are allowed to advance.

Final activation to `onboarding_status = COMPLETED` is a **manual admin action** (`completeFinalApproval`) and not done by webhooks.

## 2. Flow types

### Corporate issuer onboarding (`OrganizationType.COMPANY`)

This is the “company” onboarding path for both the `investor` and `issuer` portals.

Main extra step vs personal:

- Admin must do **SSM/CTOS verification** first (`PENDING_SSM_REVIEW` → admin `approve-ssm` → `PENDING_APPROVAL`).

### Personal issuer onboarding (`OrganizationType.PERSONAL`)

This onboarding path is for **individual/personal** accounts on the **investor** portal.

What it skips:

- No admin SSM/CTOS gate (`approveSsmVerification` rejects non-`COMPANY` orgs).

What differs in triggers:

- Liveness completion sets `PENDING_APPROVAL` via RegTank liveness webhooks.
- When RegTank reports onboarding approval, the system sets `onboarding_approved` and advances to AML.
- AML progression for personal uses the KYC webhook milestone path (see `maybeAdvanceOrgAfterAmlScreeningCleared`).

Notes:

- `startPersonalOnboarding` explicitly **blocks the Issuer portal** for individual onboarding (`portalType === "issuer"` throws).

## 3. Main database models and fields

This section lists the onboarding-relevant Prisma models and the specific fields used by the approval gates and UI.

### `apps/api/prisma/schema.prisma`

#### `enum OnboardingStatus`

`PENDING | IN_PROGRESS | PENDING_APPROVAL | PENDING_AMENDMENT | PENDING_AML | PENDING_SSM_REVIEW | PENDING_FINAL_APPROVAL | COMPLETED | REJECTED`

#### `model InvestorOrganization`

Onboarding lifecycle fields:

- `onboarding_status: OnboardingStatus` — primary lifecycle status.
- `onboarding_approved: boolean` — admin/CD O approval for “submission” stage (feeds flag-driven advancement).
- `aml_approved: boolean` — AML milestone cleared (feeds flag-driven advancement).
- `tnc_accepted: boolean` — Terms & Conditions accepted (required for final approval for personal).
- `deposit_received: boolean` — investor UX step (not used by `advanceOnboardingStatusFromFlags`).
- `ssm_approved: boolean` — investor “company” SSM/CTOS admin approval flag.
- `admin_approved_at: DateTime?` — final activation timestamp.

Corporate-only JSON blobs:

- `director_kyc_status: Json?` — legacy per-director KYC status used by final approval guard.
- `director_aml_status: Json?` — per-director AML screening status used by UI.
- `corporate_entities: Json?` — corporate entity snapshot used to show derived director/shareholder lists and statuses.

#### `model IssuerOrganization`

Same idea as `InvestorOrganization`, but the SSM gate uses `ssm_checked` instead of `ssm_approved`:

- `onboarding_status: OnboardingStatus`
- `onboarding_approved: boolean`
- `aml_approved: boolean`
- `tnc_accepted: boolean`
- `ssm_checked: boolean` — issuer company SSM/CTOS admin approval flag
- `admin_approved_at: DateTime?`

Corporate-only JSON blobs:

- `director_kyc_status: Json?`
- `director_aml_status: Json?`
- `corporate_entities: Json?`

#### `model RegTankOnboarding`

This is the RegTank “session” record used for webhook updates and audit:

- `request_id: string @unique` — RegTank request id (webhook driver for liveness/COD/EOD/KYC/KYB).
- `reference_id: string @unique` — CashSouk internal reference (organization id based on flow).
- `onboarding_type: string` — typically `"INDIVIDUAL"` or `"CORPORATE"`.
- `portal_type: string` — `"investor"` or `"issuer"` (used to select which org table to update).
- `status: string` and `substatus?: string` — raw RegTank onboarding status/substatus mirrored for admin queue.
- `verify_link?: string` and `verify_link_expires_at?: DateTime` — used for “Open in RegTank portal”.
- `webhook_payloads: Json[]` — stored webhook history (used for debugging and matching).

Important:

- This model’s `status` values can include values like `EXPIRED`/`CANCELLED` used by the admin UI.
- The **organization lifecycle** is driven by `onboarding_status` and flags, not `RegTankOnboarding.status`.

#### `model CtosReport`

Stored CTOS responses:

- `company_json` / `person_json` / `legal_json` / `financials_json` etc.
- `subject_ref` — `null` means “company/org snapshot”; non-null is subject-level pull.
- `fetched_at` used to order latest report.

CTOS ingestion stores CTOS data in this table; it does **not** automatically mark SSM/CTOS as approved for onboarding.

#### `model CtosPartySupplement`

Sidecar JSON used for CTOS “party onboarding” flows (director/shareholder-level RegTank onboarding), containing:

- `party_key: string` — normalized identifier (IC/SSM per product rules)
- `onboarding_json: Json?` — includes fields like email/requestId/regtank status/KYC & AML raw status

The doc request focused on SSM admin approval for the org, so this supplement is mentioned where it affects director/shareholder onboarding links and webhook mapping.

## 4. Full step-by-step flow

Below is the end-to-end flow from issuer/investor onboarding start to final approval.

For each step:

- “Which page/component” is the user-facing UI.
- “Which backend endpoint/service” is the main route or function involved.
- “Which DB fields/statuses” are the key persistence points.
- “Next valid status” is the next `onboarding_status` value expected in normal flow.

### Step 1. Issuer starts onboarding

What triggers it:

- Issuer selects account type (personal vs company) and starts RegTank onboarding from the issuer UI.

Which page/component:

- Company onboarding start uses the issuer’s “account type selector” + RegTank verify link flow.
- (Needs verification for exact component + endpoint wiring: we saw `account-type-selector.tsx` and verifyLink usage, but not the full handler chain.)

Which backend endpoint/service:

- `POST /v1/regtank/start-corporate-onboarding` (company onboarding)
- `POST /v1/regtank/start-individual-onboarding` is blocked for `portalType === "issuer"` (individual onboarding not supported in issuer portal).

Which DB fields/statuses:

- RegTank onboarding session is stored in `RegTankOnboarding` with:
  - `request_id`, `reference_id`, `status`, `verify_link`, etc.

Next valid status:

- For `OrganizationType.COMPANY`, the org starts with `onboarding_status = PENDING` (set during org create).

What must NOT be skipped:

- RegTank onboarding must actually be completed on RegTank side before admin gates progress.

### Step 2. Corporate or personal flow is selected

What triggers it:

- UI selection sets:
  - `OrganizationType` (company vs personal)
  - RegTank flow type (CORPORATE vs INDIVIDUAL)

DB/status impact:

- `OrganizationType.COMPANY` uses company SSM admin gate later (`PENDING_SSM_REVIEW`).
- `OrganizationType.PERSONAL` skips SSM gate and moves to `PENDING_APPROVAL` directly on liveness completion.

### Step 3. SSM / CTOS verification step (corporate only)

What triggers it:

- For company orgs, RegTank COD webhook advances the org to `PENDING_SSM_REVIEW`.

Which page/component:

- Admin UI: `apps/admin/src/components/ssm-verification-panel.tsx` (shown in `OnboardingReviewDialog` when `adminPhase === "PENDING_SSM_REVIEW"`).

Which backend endpoint/service:

- Admin fetches CTOS reports:
  - `GET /v1/admin/organizations/:portal/:id/ctos-reports`
- Admin pulls a new CTOS snapshot:
  - `POST /v1/admin/organizations/:portal/:id/ctos-reports`
  - This stores a `CtosReport` row and compares against app submission data in UI.
- Admin approves SSM verification:
  - `POST /v1/admin/onboarding-applications/:id/approve-ssm`
  - Calls `AdminService.approveSsmVerification`.

Which DB fields/statuses are updated:

- `IssuerOrganization.ssm_checked` (issuer portal) or `InvestorOrganization.ssm_approved` (investor portal) set to `true`
- `onboarding_status` set to `PENDING_APPROVAL`

Next valid status:

- `PENDING_APPROVAL`

What must NOT be skipped:

- The SSM step requires explicit admin approval.
- CTOS/SSM fetch/comparison alone is not enough.

Personal flow:

- `OrganizationType.PERSONAL` never reaches `PENDING_SSM_REVIEW` via admin SSM approval:
  - `approveSsmVerification` rejects non-`COMPANY` orgs.
  - `advanceOnboardingStatusFromFlags` only applies SSM gating when `org.type === OrganizationType.COMPANY`.

### Step 4. Admin reviews SSM / CTOS data

What triggers it:

- Admin loads the onboarding review dialog, and `PENDING_SSM_REVIEW` shows SSM comparison UI.

Which page/component:

- `apps/admin/src/components/onboarding-review-dialog.tsx` and `ssm-verification-panel.tsx`

Backend/service involved:

- CTOS report list + fetch endpoints (see Step 3).
- In UI, comparison is computed via:
  - `apps/admin/src/lib/onboarding-ctos-compare.ts` (`buildOnboardingCtosComparison`).

DB changes:

- CTOS fetch creates `ctos_reports` rows.
- Org onboarding flags are unchanged until admin clicks Approve (Step 5).

Next valid status:

- Still `PENDING_SSM_REVIEW` until admin approves.

### Step 5. Admin manually approves SSM verification

What triggers it:

- Admin checks the confirmation switch and clicks **Approve** in `SSMVerificationPanel`.

Which page/component:

- `SSMVerificationPanel` → `onApprove` prop wired to `handleSSMApprove` in `OnboardingReviewDialog`.

Backend endpoint/service:

- `POST /v1/admin/onboarding-applications/:id/approve-ssm`
- `AdminService.approveSsmVerification`

DB fields/statuses:

- For `portalType === "investor"` (company):
  - `InvestorOrganization.ssm_approved = true`
  - `InvestorOrganization.onboarding_status = PENDING_APPROVAL`
- For `portalType === "issuer"` (company):
  - `IssuerOrganization.ssm_checked = true`
  - `IssuerOrganization.onboarding_status = PENDING_APPROVAL`

Next valid status:

- `PENDING_APPROVAL` (or it may immediately advance later when onboarding flags are set by webhooks; see Step 6).

What must NOT be skipped:

- This is the only point where SSM/CTOS is marked “approved”.

### Step 6. RegTank corporate onboarding / COD flow

What triggers it:

- Issuer completes COD onboarding in RegTank.
- RegTank webhooks drive org status:
  - liveness completion (for individual/different flows)
  - COD liveness wait state for corporate
  - COD APPROVED after corporate admin review in RegTank

Which webhook endpoint receives updates:

- `POST /v1/webhooks/regtank/codliveness` (COD)

Backend handler:

- `apps/api/src/modules/regtank/webhooks/cod-handler.ts`

DB fields/statuses updated (company path):

1. COD “wait for approval” style state:
   - sets `director_kyc_status` and corporate snapshots
   - sets `onboarding_approved = false`
   - moves org `onboarding_status` to:
     - `PENDING_SSM_REVIEW` when `onboarding.organization_type === OrganizationType.COMPANY`
     - (personal non-company path is `PENDING_APPROVAL`)
1.1. COD `URL_GENERATED` (amendment start signal)
   - First `URL_GENERATED` in a normal flow does NOT start amendment.
   - Amendment starts only when `URL_GENERATED` happens after a previous `WAIT_FOR_APPROVAL`.
   - When amendment starts and the org is currently in one of:
     - `PENDING_SSM_REVIEW`
     - `PENDING_APPROVAL`
   - then the org is set to `PENDING_AMENDMENT`
   - and the SSM gate is reset for re-review:
     - issuer: `ssm_checked = false`
     - investor company: `ssm_approved = false`
2. COD `APPROVED` (RegTank admin cleared corporate onboarding):
   - when `onboarding.onboarding_type === "CORPORATE"` and the org is currently `PENDING_APPROVAL`:
     - sets `onboarding_approved = true`
     - calls `advanceOnboardingStatusFromFlags` with reason `REGTANK_COD_APPROVED`

Next valid status:

- Normally ends in `PENDING_AML` after Step 5 set SSM gate flags.
- If the org is in `PENDING_AMENDMENT`, the later COD `WAIT_FOR_APPROVAL` moves it back to `PENDING_SSM_REVIEW` (without auto-advancing to `PENDING_APPROVAL`).
- If COD is approved before Step 5 is done, advancement is blocked by SSM gating (see Anti-skip rules).

What must NOT be skipped:

- COD APPROVED does not finalize AML or completion by itself.

### Step 7. Director / shareholder onboarding links

What triggers it:

- Company onboarding requires director/shareholder onboarding to be completed on RegTank.

Which page/component:

- Issuer UI (issuer portal): `apps/issuer/src/components/director-shareholders-unified-section.tsx`
  - users enter email, then “Confirm & Send”

Backend endpoints:

- Save email:
  - `PATCH /v1/organizations/:portal(investor|issuer)/:id/ctos-party-email`
- Send director onboarding link:
  - `POST /v1/organizations/:portal(investor|issuer)/:id/send-director-onboarding`

DB fields/statuses:

- (Needs verification in backend service code.)
- Expected: updates `ctos_party_supplements.onboarding_json` for the target `party_key` and triggers RegTank onboarding for that person.

Next valid status (org-level):

- Org-level `onboarding_status` typically does not change directly from “send onboarding link”.
- It changes based on RegTank director onboarding webhooks (EOD/KYC/KYB) updating JSON status on the org.

What must NOT be skipped:

- The onboarding links must be sent for directors/shareholders that are not already approved (issuer UI blocks sending once org is completed and gates by `canManageDirectorShareholder`).

### Step 8. Director / shareholder KYC and AML

What triggers it:

- RegTank sends:
  - EOD liveness/state updates for each person (`/eodliveness`)
  - KYC and KYB updates for corporate onboarding context (`/kyc`, `/kyb`, etc.)
  - AML identity mapping and AML screening status updates

Which webhook endpoints:

- `POST /v1/webhooks/regtank/eodliveness` → `EODWebhookHandler`

Backend handler:

- `apps/api/src/modules/regtank/webhooks/eod-handler.ts`

DB fields/statuses:

- Updates `director_kyc_status` JSON on the org:
  - matches the incoming EOD request id to a stored director row using:
    - `eodRequestId` primary match
    - `shareholderEodRequestId` secondary match
    - fallback match by normalized government id number from webhook payload
  - updates:
    - `kycStatus`
    - `kycId` (if available)
    - `lastUpdated`
- If EOD KYC status becomes `APPROVED`:
  - waits ~3 seconds
  - fetches AML status for the entity
  - updates `director_aml_status` JSON (per director entry) with:
    - AML sanitized status
    - message status
    - risk score and risk level

Next valid status:

- Org-level `onboarding_status` still depends on the org AML gate (`PENDING_AML` → `PENDING_FINAL_APPROVAL`).
- Directors/shareholders’ JSON updates affect final completion guard (Step 12).

What must NOT be skipped:

- Directors must reach `kycStatus === "APPROVED"` for final completion (see Step 12 guard).

### Step 9. RegTank webhook updates (org-level + audit)

What triggers it:

- RegTank posts multiple webhook types asynchronously.

Which handler updates what:

- Liveness (personal):
  - `POST /v1/webhooks/regtank/liveness` → `IndividualOnboardingWebhookHandler`
  - `LIVENESS_PASSED` or `WAIT_FOR_APPROVAL` sets org `onboarding_status = PENDING_APPROVAL`
- COD (company):
  - `POST /v1/webhooks/regtank/codliveness` → `CODWebhookHandler`
  - wait state sets `PENDING_SSM_REVIEW` (company) and resets flags
  - `APPROVED` sets `onboarding_approved = true` and advances (only when on correct prior status)
- AML milestone:
  - org-level AML advancement is handled by `maybeAdvanceOrgAfterAmlScreeningCleared` (see below).

Normalization/storage:

- `BaseWebhookHandler` verifies HMAC signature (when provided) and stores raw webhook payloads.
- `normalizeRawStatus` is used to store a canonical status value.

### Step 10. Pending AML / KYC review

Org-level meaning:

- `onboarding_status = PENDING_AML`

How it is reached:

- `PENDING_APPROVAL` + flags + (company SSM gate) triggers:
  - `advanceOnboardingStatusFromFlags`
  - sets `onboarding_status = PENDING_AML`

How AML/KYC completes:

- For corporate, org AML milestone is advanced by:
  - `maybeAdvanceOrgAfterAmlScreeningCleared` (called from AML milestone webhook handler `org-aml-milestone.ts`)
  - which only advances when `org.onboarding_status === PENDING_AML` and sets `aml_approved = true`.
- For personal, AML progression can be advanced from KYC webhook in `KYCWebhookHandler`:
  - `maybeAdvanceOrgAfterAmlScreeningCleared` gets called with trigger `REGTANK_KYC_PERSONAL_AML_CLEARED` when `onboarding_type === "PERSONAL"` and KYC approval arrives.

Next valid status:

- `PENDING_FINAL_APPROVAL`

What must NOT be skipped:

- AML does not finalize onboarding. It only reaches `PENDING_FINAL_APPROVAL`.

### Step 11. Pending final approval

Org-level meaning:

- `onboarding_status = PENDING_FINAL_APPROVAL`

Admin UI:

- `OnboardingReviewDialog` renders the “Final Approval Required” checklist (Step 12).

### Step 12. Admin final approval

What triggers it:

- Admin clicks **Complete Onboarding**.

Which backend endpoint/service:

- `POST /v1/admin/onboarding-applications/:id/complete-final-approval`
- `AdminService.completeFinalApproval`

Hard guards in code:

- Must be in `onboarding_status === PENDING_FINAL_APPROVAL` or it throws `INVALID_STEP`.
- Required flags:
  - Personal (investor personal):
    - `onboarding_approved === true`
    - `aml_approved === true`
    - `tnc_accepted === true`
  - Company (investor company or issuer company):
    - `onboarding_approved === true`
    - `aml_approved === true`
    - `tnc_accepted === true`
    - SSM gate:
      - `ssm_approved` (investor portal) OR
      - `ssm_checked` (issuer portal)
- Director KYC completion guard (company):
  - If `director_kyc_status` exists:
    - casts it to `{ directors: Array<{ kycStatus: string; name: string; ... }> }`
    - throws if any `director.kycStatus !== "APPROVED"`

DB fields/statuses updated:

- Organization moved:
  - `onboarding_status = "COMPLETED"`
  - `onboarded_at = now`
  - `admin_approved_at = now`
- RegTank onboarding session updated:
  - `regtank_onboarding.status` set to `"COMPLETED"` via `regTankRepository.updateStatus`
- For company organizations, corporate entities are refreshed from RegTank after completion (non-blocking errors are caught).

Next valid status:

- `COMPLETED`

What must NOT be skipped:

- Final completion cannot be done by webhook handlers. It is done only by `completeFinalApproval`.

### Step 13. Onboarding completed

Org-level:

- `onboarding_status = COMPLETED`

UI impact:

- Issuer portal hides the onboarding cards and shows the normal “welcome” dashboard actions.
- Company director/shareholder banners and send-email actions should become disabled because the org is completed.

## 5. SSM / CTOS verification logic

This section explains how SSM verification is implemented as a manual admin gate, and why CTOS data fetching alone is not “approval”.

### 5.1 Company data fetch and storage (CTOS pull)

The SSM panel uses the Admin CTOS endpoints:

- List:
  - `GET /v1/admin/organizations/:portal/:id/ctos-reports`
  - returns `AdminCtosReportListItem[]` which includes (when present) `company_json` used for comparison.
- Fetch (save a new report snapshot):
  - `POST /v1/admin/organizations/:portal/:id/ctos-reports`
  - endpoint inserts a `CtosReport` row using `fetchAndInsertCtosReportForAdminOrg`.

`fetchAndInsertCtosReportForAdminOrg`:

- Loads organization data for the specified admin portal (`issuer` vs `investor`)
- Builds a CTOS SOAP enquiry XML
- Calls CTOS SOAP
- Parses and stores:
  - `raw_xml`
  - `summary_json`
  - `company_json` (if available)
  - `person_json`, `legal_json`, `ccris_json`, `financials_json` etc.

If it is an admin onboarding review CTOS pull, the frontend passes:

- `skipDirectorShareholderNotifications: true`

so it suppresses director/shareholder notification/email hooks.

### 5.2 How directors/shareholders are compared (dedupe/merge logic)

The admin SSM panel computes a comparison model using:

- `apps/admin/src/lib/onboarding-ctos-compare.ts` (`buildOnboardingCtosComparison`)

Important parts of matching/dedupe:

- IDs are normalized for compare (`normalizeId`):
  - uppercase
  - strips non-alphanumerics
- Matching is done in `partitionPeople`:
  - For each app row (application director/shareholder):
    - it tries to find the first unused CTOS row whose normalized primary id matches
    - once a CTOS row is used, it will not be reused for another app row
  - output buckets:
    - `matched` (paired app + CTOS rows)
    - `onlyApplication`
    - `onlyCtos`

Shareholder display rules:

- Shareholders are included in comparison only when:
  - the role is “shareholder-like”, and
  - derived share percentage is >= 5% (when percentage is available).

### 5.3 What makes the SSM step “completed”

SSM step completion requires **admin recorded approval**:

- UI requires the admin to:
  - review the comparison table (application side vs CTOS side)
  - toggle the confirmation switch (“I have verified…”)
  - then click **Approve**
- Backend requires:
  - org must be in `onboarding_status === PENDING_SSM_REVIEW`
  - org must be `organization_type === "COMPANY"` (or it throws)

When admin clicks Approve, backend updates:

- `ssm_approved` / `ssm_checked` to `true`
- `onboarding_status` to `PENDING_APPROVAL`

### 5.4 Why the SSM step requires manual admin approval

Because:

- CTOS pulls only insert `ctos_reports` and show comparisons.
- The onboarding lifecycle state machine (`advanceOnboardingStatusFromFlags`) only advances to AML for company orgs if the SSM flags are already true.

## 6. RegTank webhook flow

### 6.1 Webhook endpoints that receive RegTank updates

From `apps/api/src/modules/regtank/webhook-controller.ts`, the canonical webhook endpoints are:

- `POST /v1/webhooks/regtank/liveness` → `IndividualOnboardingWebhookHandler`
- `POST /v1/webhooks/regtank/codliveness` → `CODWebhookHandler`
- `POST /v1/webhooks/regtank/eodliveness` → `EODWebhookHandler`
- `POST /v1/webhooks/regtank/kyc` → `KYCWebhookHandler (ACURIS)`
- `POST /v1/webhooks/regtank/djkyc` → `KYCWebhookHandler (DOWJONES)`
- `POST /v1/webhooks/regtank/kyb` → `KYBWebhookHandler (ACURIS)`
- `POST /v1/webhooks/regtank/djkyb` → `KYBWebhookHandler (DOWJONES)`
- `POST /v1/webhooks/regtank/kyt` → `KYTWebhookHandler`

Legacy:

- `POST /v1/webhooks/regtank` (deprecated) routes to individual onboarding handler.

Dev parity:

- In non-production (or when enabled), the webhook base becomes `/v1/webhooks/regtank/dev*`.

### 6.2 Signature verification

Webhooks use `BaseWebhookHandler`:

- If `x-regtank-signature` header is provided:
  - HMAC-SHA256 verifies signature using `REGTANK_WEBHOOK_SECRET`
  - constant-time comparison is used
- If signature is missing:
  - it logs a warning and (effectively) accepts in dev mode

### 6.3 How webhook statuses are normalized or stored

Common steps in handlers:

- Store full webhook payload history:
  - `RegTankOnboarding.webhook_payloads` appended
- Normalize and persist:
  - handler updates `RegTankOnboarding.status` using `normalizeRawStatus(status)`
- Organization state changes are handler-specific:
  - liveness/COD update `InvestorOrganization` / `IssuerOrganization` `onboarding_status`
  - EOD/KYC update director/shareholder JSON fields

### 6.4 Which webhook statuses move the org onboarding flow forward

#### Individual onboarding liveness

- Endpoint:
  - `/v1/webhooks/regtank/liveness`
- Handler:
  - `IndividualOnboardingWebhookHandler`
- Org transitions:
  - On `LIVENESS_PASSED` or `WAIT_FOR_APPROVAL`:
    - set `onboarding_status = PENDING_APPROVAL`

#### Corporate COD liveness

- Endpoint:
  - `/v1/webhooks/regtank/codliveness`
- Handler:
  - `CODWebhookHandler`
- Org transitions:
  - On COD “wait for approval”:
    - company orgs → `PENDING_SSM_REVIEW`
    - non-company → `PENDING_APPROVAL`
    - resets onboarding flags (`onboarding_approved = false`)
  - On COD `APPROVED`:
    - only if corporate onboarding record (`onboarding.onboarding_type === "CORPORATE"`)
    - and the org is on the correct prior state (`invOrg.onboarding_status === PENDING_APPROVAL`)
    - sets `onboarding_approved = true`
    - calls `advanceOnboardingStatusFromFlags` (advances to `PENDING_AML` only if SSM gate flags are already true)

#### AML milestone

- The actual “org AML milestone” advancement logic is implemented in:
  - `apps/api/src/modules/regtank/webhooks/org-aml-milestone.ts`
- It advances to `PENDING_FINAL_APPROVAL` only when:
  - `org.onboarding_status === PENDING_AML`

#### EOD (directors/shareholders KYC payloads)

- Endpoint:
  - `/v1/webhooks/regtank/eodliveness`
- Handler:
  - `EODWebhookHandler`
- Org updates:
  - updates `director_kyc_status` JSON rows based on EOD id match rules
  - if EOD KYC becomes `APPROVED`, it fetches AML data and updates `director_aml_status` JSON

### 6.5 Which webhook statuses should only be stored but not auto-approve

The webhook handlers store and mirror raw RegTank statuses in `RegTankOnboarding.status` (and store payload history).

They do not finalize onboarding because:

- final completion (`onboarding_status = COMPLETED`) is only done in `AdminService.completeFinalApproval`.
- state-machine advancement to `PENDING_FINAL_APPROVAL` is not final activation; it is a manual admin “checklist complete” phase.

## 7. Approval guards / anti-skip rules

This section documents the explicit rules enforced in code (based on the files inspected).

### 7.1 Corporate onboarding must not skip SSM verification

Enforced by:

- `advanceOnboardingStatusFromFlags`:
  - company orgs only advance `PENDING_APPROVAL → PENDING_AML` if:
    - investor company: `ssm_approved === true`
    - issuer company: `ssm_checked === true`
  - otherwise it breaks and leaves the org at `PENDING_APPROVAL`.
- `approveSsmVerification`:
  - only allowed when `onboarding_status === PENDING_SSM_REVIEW` and `organization_type === "COMPANY"`.

### 7.2 CTOS/SSM step must not auto-complete only because data was fetched

Enforced by:

- CTOS fetch endpoints only insert `ctos_reports`.
- `advanceOnboardingStatusFromFlags` depends on boolean SSM flags (`ssm_approved`/`ssm_checked`) that are set only by admin `approveSsmVerification`.

### 7.3 Admin must manually approve SSM verification

Enforced by:

- Only `AdminService.approveSsmVerification` sets `ssm_approved`/`ssm_checked` and changes `onboarding_status`.
- The UI’s “Approve” button calls `POST /v1/admin/onboarding-applications/:id/approve-ssm`.

### 7.4 RegTank COD approval should only move from the correct previous status to the next status

Enforced by `CODWebhookHandler`:

- COD `APPROVED` only sets `onboarding_approved = true` when:
  - `invOrg.onboarding_status === OnboardingStatus.PENDING_APPROVAL`
- It then calls `advanceOnboardingStatusFromFlags`, which will only move to `PENDING_AML` if SSM gate flags are satisfied.

### 7.5 AML/KYC webhook approval should only move from `PENDING_AML` to `PENDING_FINAL_APPROVAL`

Enforced by `maybeAdvanceOrgAfterAmlScreeningCleared`:

- It checks:
  - if org is on `OnboardingStatus.PENDING_AML` before advancing.
- It sets `aml_approved = true` (if not set) and only then calls `advanceOnboardingStatusFromFlags`.

### 7.6 Webhooks must not jump directly to final approval or completion

Observed:

- Webhooks can set `PENDING_APPROVAL`, `PENDING_SSM_REVIEW`, and move to `PENDING_AML`/`PENDING_FINAL_APPROVAL` via `advanceOnboardingStatusFromFlags`.
- They do not set `onboarding_status = COMPLETED`.
- `COMPLETED` is only set in `AdminService.completeFinalApproval`.

### 7.7 Final approval must remain a manual admin action

Enforced by:

- `AdminService.completeFinalApproval`:
  - requires `org.onboarding_status === PENDING_FINAL_APPROVAL`
  - sets `onboarding_status = "COMPLETED"`
  - updates RegTank onboarding status to `"COMPLETED"`.

### 7.8 RegTank amendment flow: `PENDING_AMENDMENT`

When RegTank sends the organization back for amendment, we now represent this as a real lifecycle status:

- `PENDING_SSM_REVIEW -> PENDING_AMENDMENT -> PENDING_SSM_REVIEW`
- `PENDING_APPROVAL -> PENDING_AMENDMENT -> PENDING_SSM_REVIEW`

Business rule:
- A new `URL_GENERATED` is the *signal* that RegTank has re-created a submission URL.
- The first `URL_GENERATED` in a fresh flow is not amendment.
- Amendment starts only when a later `URL_GENERATED` happens **after** a previous `WAIT_FOR_APPROVAL`.

#### How amendment start is detected

We read webhook history from `RegTankOnboarding.webhook_payloads` and detect “amendment started” using a helper like:

- `isRegtankAmendmentStarted(webhookPayloads)` (implemented via the RegTank webhook helper)

Detection rule:
- meaningful statuses: `WAIT_FOR_APPROVAL`, `URL_GENERATED`
- first `URL_GENERATED` → not amendment start
- `URL_GENERATED -> WAIT_FOR_APPROVAL -> URL_GENERATED` → amendment start (set `PENDING_AMENDMENT`)
- `URL_GENERATED -> WAIT_FOR_APPROVAL -> URL_GENERATED -> WAIT_FOR_APPROVAL` means amendment submission is completed (WAIT moves it out of `PENDING_AMENDMENT`)

#### Which webhook statuses move the org into and out of `PENDING_AMENDMENT`

1. Enter `PENDING_AMENDMENT`
   - Trigger: RegTank COD webhook receives `URL_GENERATED`
   - Condition: the org is currently `PENDING_SSM_REVIEW` or `PENDING_APPROVAL`
   - Action: set `onboarding_status = PENDING_AMENDMENT`
   - Reset (because amended RegTank data must be re-reviewed):
     - for `issuer` org: `ssm_checked = false`
     - for `investor` company org: `ssm_approved = false`

2. Exit `PENDING_AMENDMENT`
   - Trigger: RegTank COD webhook receives `WAIT_FOR_APPROVAL`
   - Condition: current org status is `PENDING_AMENDMENT`
   - Action: set `onboarding_status = PENDING_SSM_REVIEW`
   - Do not auto-advance to `PENDING_APPROVAL` or `PENDING_AML`
   - SSM flags stay false, so admin must approve SSM again.

#### Admin approval guards while amendment is in progress

Admin actions are blocked when the org is `PENDING_AMENDMENT`:

- `AdminService.approveSsmVerification` rejects `PENDING_AMENDMENT`
- `AdminService.approveOnboardingSubmission` rejects `PENDING_AMENDMENT`
- `AdminService.completeFinalApproval` rejects `PENDING_AMENDMENT`

Suggested user experience (Admin UI):
- `PENDING_AMENDMENT` shows a dedicated “Amendment in Progress” card/state.
- “Approve SSM” and “Complete onboarding” controls are not shown in this state.
- “Open RegTank Portal” remains available if `regtankPortalUrl` exists.

Issuer experience (Issuer UI):
- `PENDING_AMENDMENT` shows “Amendment in Progress” and blocks access to account features the same way as other admin-pending statuses.

#### Submitted timestamp (`submittedAt`) behavior

The Admin onboarding queue table shows a `Submitted` value based on the RegTank webhook history stored in `RegTankOnboarding.webhook_payloads`.

- For all orgs where `onboarding_status !== PENDING_AMENDMENT`:
  - `submittedAt` is taken from the **latest** webhook payload with `status = WAIT_FOR_APPROVAL`.
  - If no valid `WAIT_FOR_APPROVAL` timestamp exists, it falls back to `RegTankOnboarding.completed_at`.
- For orgs where `onboarding_status === PENDING_AMENDMENT`:
  - `submittedAt` is `null`, so the UI displays `—` (and never shows `Invalid Date`).

#### Source of truth (frontend)

`PENDING_AMENDMENT` is a real organization lifecycle status (`IssuerOrganization/InvestorOrganization.onboarding_status`).
The frontend follows this status as the single source of truth; the UI does not compute or consume the old derived `regtankAmendmentInProgress` flag directly.

### 7.9 Personal onboarding should skip corporate-only SSM steps safely

Enforced by:

- `approveSsmVerification` rejects non-`COMPANY` orgs.
- `advanceOnboardingStatusFromFlags` only applies SSM gating for company orgs (`org.type === OrganizationType.COMPANY`).
- `startPersonalOnboarding` blocks the issuer portal for individual onboarding.

## 7.10 Gaps / risks found

1. **Amendment/reject in-progress protection**:
   - Fixed by introducing a real onboarding lifecycle status: `PENDING_AMENDMENT`.
   - Webhook transitions:
     - `PENDING_SSM_REVIEW` / `PENDING_APPROVAL` → `PENDING_AMENDMENT` on the amendment start (`URL_GENERATED` after `WAIT_FOR_APPROVAL`)
     - `PENDING_AMENDMENT` → `PENDING_SSM_REVIEW` on resubmission (`WAIT_FOR_APPROVAL`)
   - Admin guards block approving actions while `PENDING_AMENDMENT` is active.

2. **Admin AML approval endpoint may be unused in the UI**:
   - `AdminService.approveAmlScreening` exists and there is an API endpoint `POST /approve-aml`.
   - In `OnboardingReviewDialog`, the `PENDING_AML` UI does not show a dedicated “Approve AML” button; it expects RegTank review and webhooks to move the org.
   - Needs verification: confirm whether `approve-aml` is reachable from UI anywhere.

3. **`completeFinalApproval` director KYC check uses `director_kyc_status.directors` only**:
   - The guard throws if any `director.kycStatus !== "APPROVED"`.
   - Needs verification: confirm whether directors/shareholders are all represented in the `directors` array for the stored JSON schema.

4. **T&C acceptance (`tnc_accepted`) step wiring is not fully documented here**:
   - We verified it is required in `completeFinalApproval`.
   - Needs verification: find the exact issuer endpoint and UI component that flips `tnc_accepted = true`.

## 8. Admin UI flow

### 8.1 Onboarding approval queue

Main page:

- `apps/admin/src/app/onboarding-approval/page.tsx`

UI elements:

- filters: portal, type, onboarding status (PENDING_APPROVAL / PENDING_AML / PENDING_SSM_REVIEW / PENDING_FINAL_APPROVAL / etc.)
- table: `OnboardingQueueTable`

Which component triggers the review dialog:

- `apps/admin/src/components/onboarding-queue-row.tsx`
  - “Review” button opens `OnboardingReviewDialog`.

Backend:

- queue list uses the hook:
  - `useOnboardingApplications` (calls `apiClient.getOnboardingApplications`).
- details use:
  - `useOnboardingApplication(onboardingId)` (calls `apiClient.getOnboardingApplication`).

### 8.2 Onboarding review dialog phases and buttons

Dialog:

- `apps/admin/src/components/onboarding-review-dialog.tsx`

Phase → UI:

- `PENDING_ONBOARDING`:
  - “View in RegTank Portal”
  - “Restart Onboarding” button exists (sends user redo through admin restart).
- `PENDING_APPROVAL`:
  - “Open Onboarding Review”
  - for company: shows “Director/Shareholder KYC Status” read-only cards
  - “Restart Onboarding”
- `PENDING_AML`:
  - “Open KYB/AML Review”
  - for company: shows “AML screening status” read-only cards
  - “Restart Onboarding”
- `PENDING_SSM_REVIEW`:
  - `SSMVerificationPanel` with:
    - “Fetch report” (saves CTOS report snapshot)
    - “Amend / Reject” (opens RegTank portal link)
    - “Approve” (calls `handleSSMApprove`)
- `PENDING_FINAL_APPROVAL`:
  - checklist:
    - `SSM Verified` (company only)
    - `Onboarding Approved`
    - `AML Approved`
    - `Terms & Conditions Accepted`
  - “Complete Onboarding” button (disabled until all requirements met)
- `COMPLETED`, `REJECTED`, `EXPIRED`:
  - shows final status card and restart option.

Buttons and backend calls:

- Restart:
  - calls `useRestartOnboarding` → `POST /v1/admin/onboarding-applications/:id/restart`
- Approve SSM:
  - calls `useApproveSsmVerification` → `POST /v1/admin/onboarding-applications/:id/approve-ssm`
- Complete final:
  - calls `useCompleteFinalApproval` → `POST /v1/admin/onboarding-applications/:id/complete-final-approval`

### 8.3 SSM verification panel details

File:

- `apps/admin/src/components/ssm-verification-panel.tsx`

Key actions:

- “Fetch report” button triggers:
  - `apiClient.createAdminOrganizationCtosReport`
  - which inserts a new CTOS report snapshot
- “Amend / Reject”:
  - just opens `application.regtankPortalUrl`
- “Approve”:
  - UI requires the confirmation switch and then calls `onApprove` callback

## 9. Portal UI flows (investor & issuer)

### 9.1 Route-based onboarding

Onboarding is split across dedicated routes (see **`packages/config/src/onboarding-flow.ts`**). `/onboarding-start` redirects to `/onboarding/account`.

| Step | Route |
|------|-------|
| Account type | `/onboarding/account` |
| Terms | `/onboarding/terms` |
| Issuer fee (company) | `/onboarding/fee` |
| RegTank verify | `/onboarding/verify` |

Shared layout and step components live in **`packages/ui/src/onboarding/`**. Stepper verify label: **Onboarding**.

### 9.2 Investor dashboard

**File:** `apps/investor/src/app/page.tsx`

- Redirects incomplete steps (`terms`, `verify`) to `/onboarding/*`.
- During admin-wait (`PENDING_APPROVAL`, `PENDING_AML`, etc.): shows `OnboardingStatusCard` + “Awaiting Approval”; **Account Overview** rendered as a disabled sneak peek; portfolio and investments remain hidden until `onboarding_status === COMPLETED`.
- After `COMPLETED`: full dashboard; `DepositCard` when `deposit_received` is false (post-approval activation — not required for admin onboarding completion).

### 9.3 Issuer dashboard

**File:** `apps/issuer/src/app/page.tsx`

- Same route redirects for incomplete steps.
- Shows `OnboardingStatusCard` when steps incomplete; “Awaiting Approval” / “Onboarding Rejected” blocks; `DirectorShareholderAlertCard` for company orgs when applicable.

Onboarding steps (via `getOnboardingStepperSteps` in **`apps/issuer/src/components/onboarding-status-card.tsx`**):

- `User Agreement` → `tncAccepted`
- `Onboarding Fee` (company) → `onboardingFeePaidAt`
- `Onboarding` (RegTank verify)
- `Approval` → `onboardingStatus === COMPLETED`

Corporate director/shareholder unified KYC/AML table when org `type === COMPANY` and status is `PENDING_APPROVAL` or `PENDING_AML`.

### 9.4 Organization switcher

**Files:** `apps/investor/src/components/organization-switcher.tsx`, `apps/issuer/src/components/organization-switcher.tsx`

- **Your Organizations:** `COMPLETED` + admin-wait statuses (`PENDING_APPROVAL`, `PENDING_AML`, `PENDING_FINAL_APPROVAL`, `PENDING_SSM_REVIEW`); **COMPLETED listed first**.
- **Needs Attention:** user must act (incomplete onboarding, RegTank in progress, `PENDING_AMENDMENT`, `REJECTED`, expired, etc.).

Removed legacy components: `corporate-onboarding-modal.tsx`, portal-local `terms-acceptance-card.tsx` (replaced by shared `packages/ui` + route pages).

Director/shareholder onboarding links:

- `apps/issuer/src/components/director-shareholders-unified-section.tsx`
  - blocks sending when `organizationOnboardingStatus !== "COMPLETED"`
  - gates sending based on `canManageDirectorShareholder`
  - backend calls:
    - `PATCH /v1/organizations/issuer|investor/:id/ctos-party-email`
    - `POST /v1/organizations/issuer|investor/:id/send-director-onboarding`

Director/shareholder alert banner:

- `apps/issuer/src/components/director-shareholder-alert-card.tsx`
  - shows “Action required” when any visible directors/shareholders are in:
    - `WAIT_FOR_APPROVAL` or `APPROVED` (per `normalizeRawStatus`)
  - “Go to Profile” routes user to `/profile?focus=directors` with a `matchKey`.

Needs verification:

- Which exact issuer UI page triggers director/shareholder “resend email” vs “send onboarding link again” and which backend logic prevents duplicates.

## 10. Status transition table

The table below focuses on the **organization lifecycle** (`InvestorOrganization.onboarding_status` / `IssuerOrganization.onboarding_status`).

| Current status | Trigger | Who/what triggers it | New status | Notes |
|---|---|---|---|---|
| `PENDING` (company) | COD “wait for approval” webhook | `CODWebhookHandler` on `/codliveness` | `PENDING_SSM_REVIEW` | Company COD sets `onboarding_approved = false` and resets SSM gates in wait state. |
| `IN_PROGRESS` (personal) | Liveness passed / wait-for-approval | `IndividualOnboardingWebhookHandler` on `/liveness` | `PENDING_APPROVAL` | Sets org to `PENDING_APPROVAL` and logs `trigger: LIVENESS_PASSED` / `WAIT_FOR_APPROVAL`. |
| `PENDING_SSM_REVIEW` | Admin approves SSM/CTOS | `POST /v1/admin/onboarding-applications/:id/approve-ssm` | `PENDING_APPROVAL` | Sets `ssm_approved` (investor) or `ssm_checked` (issuer). |
| `PENDING_APPROVAL` | Admin approves onboarding submission OR COD approval sets flag | `AdminService.approveOnboardingSubmission` or `CODWebhookHandler` sets `onboarding_approved = true` + calls `advanceOnboardingStatusFromFlags` | `PENDING_AML` (company only if SSM gate satisfied; personal can advance without SSM gate) | The transition is controlled by `advanceOnboardingStatusFromFlags`. |
| `PENDING_AML` | AML milestone cleared | `maybeAdvanceOrgAfterAmlScreeningCleared` (webhook-driven) OR `AdminService.approveAmlScreening` | `PENDING_FINAL_APPROVAL` | Webhooks require `org.onboarding_status === PENDING_AML` before advancing. |
| `PENDING_FINAL_APPROVAL` | Admin completes final approval | `POST /v1/admin/onboarding-applications/:id/complete-final-approval` | `COMPLETED` | Final guard checks flags + director KYC rows (`director_kyc_status.directors[].kycStatus === "APPROVED"`). |
| (any) | RegTank rejects onboarding | `IndividualOnboardingWebhookHandler` or `CODWebhookHandler` | `REJECTED` | Writes `onboarding_status = REJECTED`. |

### RegTank “queue status” values (not `OnboardingStatus`)

Admin UI also uses `RegTankOnboarding.status` for queue-phase labeling:

- `EXPIRED`, `CANCELLED`, etc.

Those are mirrored from RegTank and are not part of the `OnboardingStatus` enum.

## 11. File map

High-signal files (the ones used to build the steps and guards):

- `apps/api/prisma/schema.prisma`
  - `enum OnboardingStatus`
  - `InvestorOrganization`, `IssuerOrganization`, `RegTankOnboarding`, `CtosReport`, `CtosPartySupplement`
- `apps/api/src/modules/onboarding/utils/advance-onboarding-status.ts`
  - `advanceOnboardingStatusFromFlags` (the main state machine for `PENDING_APPROVAL → PENDING_AML → PENDING_FINAL_APPROVAL`)
- `apps/api/src/modules/admin/service.ts`
  - `approveSsmVerification`
  - `approveOnboardingSubmission`
  - `approveAmlScreening` (exists; UI usage needs verification)
  - `completeFinalApproval`
- `apps/api/src/modules/admin/controller.ts`
  - admin endpoints:
    - `/approve-ssm`
    - `/approve-onboarding`
    - `/approve-aml`
    - `/complete-final-approval`
    - `/restart`
- `apps/api/src/modules/regtank/webhook-controller.ts`
  - webhook endpoint routing (`/liveness`, `/codliveness`, `/eodliveness`, `/kyc`, `/kyb`, `/kyt`)
- `apps/api/src/modules/regtank/webhooks/individual-onboarding-handler.ts`
  - liveness → `PENDING_APPROVAL` and rejection handling
- `apps/api/src/modules/regtank/webhooks/cod-handler.ts`
  - COD wait state → `PENDING_SSM_REVIEW` and resets flags
  - COD `APPROVED` → sets `onboarding_approved` and runs `advanceOnboardingStatusFromFlags`
- `apps/api/src/modules/regtank/webhooks/eod-handler.ts`
  - director KYC updates + AML status updates for directors/shareholders
- `apps/api/src/modules/regtank/webhooks/kyc-handler.ts`
  - KYC approval side effects for personal (calls `maybeAdvanceOrgAfterAmlScreeningCleared`)
- `apps/api/src/modules/regtank/webhooks/org-aml-milestone.ts`
  - org AML milestone gate (`PENDING_AML → PENDING_FINAL_APPROVAL`)
- `apps/api/src/modules/regtank/service.ts`
  - `handleWebhookUpdate` and “after RegTank approved” milestone logic
- `apps/admin/src/components/onboarding-review-dialog.tsx`
  - admin phase switch UI + buttons
- `apps/admin/src/components/ssm-verification-panel.tsx`
  - CTOS pull UI + approve/match UI
- `apps/admin/src/lib/onboarding-ctos-compare.ts`
  - director/shareholder matching/dedupe logic for SSM approval
- `apps/admin/src/components/onboarding-queue-row.tsx`
  - queue “Review” action wiring
- `apps/issuer/src/components/onboarding-status-card.tsx`
  - issuer-facing onboarding stepper
- `apps/issuer/src/components/director-shareholders-unified-section.tsx`
  - send onboarding links (ctos-party-email + send-director-onboarding)
- `apps/issuer/src/components/director-shareholder-alert-card.tsx`
  - “action required” banner for director/shareholder onboarding statuses

## 12. Known issues / things to verify

1. Amendment/reject correctness guard in admin UI:
   - `SSMVerificationPanel` shows “Amend / Reject” but backend guard that blocks “Approve SSM” during amend is not verified here.
2. AML approval endpoint usage:
   - The UI appears to rely on RegTank AML webhooks rather than calling `POST /approve-aml`.
3. Final completion director KYC JSON schema:
   - The final guard only checks `director_kyc_status.directors` and does not explicitly check shareholder rows separately.
4. T&C acceptance endpoint:
   - `completeFinalApproval` requires `tnc_accepted`, but we didn’t inspect the exact endpoint that sets it to `true`.

## Summary of repo findings (for this documentation)

### Existing docs found

Closest existing docs:

- `docs/guides/cashsouk-onboarding-full-context.md`
  - covers onboarding architecture and some step logic, but does not contain the requested admin/issuer UI wiring + detailed status transition table for this approval flow.

### This new consolidated file was created

- `docs/onboarding-approval-flow.md`

