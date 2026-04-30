# Cashsouk onboarding — full technical context

This document describes the **Cashsouk monorepo** onboarding architecture as implemented in code (read-only audit). Paths are relative to the repository root unless stated otherwise.

---

## 1. High-level onboarding overview

### 1.1 What “onboarding” means here

There are **several layers** that must not be conflated:

| Layer | Meaning | Primary persistence |
|--------|---------|---------------------|
| **Organization onboarding** | Portal account (investor or issuer org) moving through `onboarding_status` until `COMPLETED`. | `investor_organizations` / `issuer_organizations` (`onboarding_status`, flags). |
| **RegTank main onboarding** | User completes RegTank flow for the **org** (personal = individual onboarding; company = corporate COD / KYB). | `reg_tank_onboarding` + org JSON fields updated from webhooks. |
| **Individual / director KYC (corporate)** | Per-person KYC inside corporate onboarding: stored as structured JSON on the org, keyed by EOD / government id. | `director_kyc_status` (JSON on org). |
| **AML** | Screening state for main entity and (for companies) directors/shareholders. | `aml_approved` on org; `director_aml_status` JSON; CTOS party `onboarding_json.aml` for supplement-only flows. |
| **CTOS verification** | External credit bureau snapshot: company/person/legal/financials parsed into DB rows. | `ctos_reports` (`company_json`, `financials_json`, `subject_ref`, etc.). **Does not** create `ctos_party_supplements` by itself. |
| **CTOS party supplements** | Per-party (normalized IC/SSM key) **sidecar** row for **RegTank individual 2.1** onboarding for people listed from CTOS when they are “new” vs legacy. | `ctos_party_supplements` (`party_key`, `onboarding_json`). |
| **Application approval** | AR financing application lifecycle (`applications.status`, review sections). | `applications`, `application_reviews`, etc. **Depends** on issuer org existing and (for some gates) org-level KYC/CTOS party state. |

### 1.2 Issuer vs investor

- **Issuer** (`apps/issuer`, API `portalType === "issuer"`): effectively **company-only** product surface; org has `ssm_checked` (not `ssm_approved`). Same `OnboardingStatus` enum.
- **Investor** (`apps/investor`): **personal** (`OrganizationType.PERSONAL`) or **company** (`COMPANY`). Personal skips SSM admin gate; company uses `ssm_approved` and can hit `PENDING_SSM_REVIEW`.

### 1.3 RegTank’s role

- Creates **`reg_tank_onboarding`** with unique `request_id` and `reference_id`, `onboarding_type` (`INDIVIDUAL` / `CORPORATE`), `portal_type`, link to `investor_organization_id` or `issuer_organization_id`.
- **Webhooks** append payloads and drive `reg_tank_onboarding.status` plus **org** `onboarding_status` / JSON blobs (`corporate_entities`, `director_kyc_status`, etc.) depending on handler (`apps/api/src/modules/regtank/webhooks/*`).

### 1.4 CTOS’s role

- **Org-level report**: `ctos_reports` row with `subject_ref = null` holds latest **company** snapshot (`company_json`, `financials_json`, …). Created via **`apps/api/src/modules/ctos/ctos-report-service.ts`** (`prisma.ctosReport.create` in several export functions).
- **Subject reports** (directors/guarantors): same table, `subject_ref` non-null.
- **Party onboarding** for individuals appearing in CTOS list uses **`ctos_party_supplements`** keyed by **`party_key`** (normalized IC), not RegTank onboarding row for that party.

### 1.5 Admin review

- Admin acts on **`reg_tank_onboarding`** records (linked org) for: **SSM/CTOS gate**, **onboarding submission approval** (`onboarding_approved`), **AML approval** (`aml_approved`), **final completion** → `COMPLETED`. Implemented in **`apps/api/src/modules/admin/service.ts`** (methods named `approveSsmVerification`, `approveOnboardingSubmission`, `approveAmlScreening`, `approveFinalOnboarding` / similar — search `approveSsmVerification`).

### 1.6 Applications vs organization onboarding

- **`applications`** reference **`issuer_organization_id`** (Prisma `Application` model).
- **Issuer** can create/submit applications only when org rules allow (portal + API checks). **`apps/api/src/modules/applications/service.ts`** includes **`assertRequiredPartyOnboardingStarted`** (private): for **issuer** org, builds `getDirectorShareholderDisplayRows` from org + supplements and requires RegTank **supplement** onboarding progressed for parties that have a supplement row (legacy-approved parties skipped per current logic — see §13).

---

## 2. Main organization onboarding flow

### 2.1 Enum source

All values: **`apps/api/prisma/schema.prisma`** → `enum OnboardingStatus { PENDING COMPLETED IN_PROGRESS PENDING_APPROVAL PENDING_AML PENDING_SSM_REVIEW PENDING_FINAL_APPROVAL REJECTED }`.

### 2.2 Initial status on org create

**File:** `apps/api/src/modules/organization/repository.ts`  
**Functions:** `createInvestorOrganization`, `createIssuerOrganization`

| Org type | Initial `onboarding_status` |
|----------|-------------------------------|
| `PERSONAL` | `IN_PROGRESS` |
| `COMPANY` | `PENDING` |

Comment in repository states company status is updated later via RegTank webhooks (historically simplified).

### 2.3 Per-status reference

#### `PENDING`

- **Meaning:** Company org created; main RegTank corporate flow not yet advanced to admin/RegTank milestones that move status (or legacy baseline).
- **Set by:** Org create (`OrganizationRepository` above).
- **Who moves it:** Typically superseded when COD webhook writes **`PENDING_SSM_REVIEW`** or **`PENDING_APPROVAL`** (see below). Not every code path starts from `PENDING` visible for long.

#### `IN_PROGRESS`

- **Meaning:** **Personal** account starts here at creation. Indicates user is in active RegTank individual onboarding before admin pipeline.
- **Set by:** `OrganizationRepository` on create for `PERSONAL`.
- **Moves to `PENDING_APPROVAL`:** `IndividualOnboardingWebhookHandler` on **`LIVENESS_PASSED`** or **`WAIT_FOR_APPROVAL`** → `OrganizationRepository.updateInvestorOrganizationOnboarding` / `updateIssuerOrganizationOnboarding` (**`apps/api/src/modules/regtank/webhooks/individual-onboarding-handler.ts`** ~L86–278).

#### `PENDING_SSM_REVIEW`

- **Meaning:** **Company** org: corporate COD webhook has submitted corporate bundle; **SSM/CTOS admin step** is next before treating onboarding as ready for “submission approved” style gates.
- **Set by:** **`CODWebhookHandler`** when corporate onboarding reaches wait-for-approval style milestone — **`apps/api/src/modules/regtank/webhooks/cod-handler.ts`** ~L631–634: `waitForApprovalOrgStatus = COMPANY ? PENDING_SSM_REVIEW : PENDING_APPROVAL`; then `prisma.investorOrganization.update` / `issuerOrganization.update` sets `onboarding_status` plus `director_kyc_status`, `corporate_entities`, etc. (~L636–707).
- **Admin:** **`AdminService.approveSsmVerification`** requires current status **`PENDING_SSM_REVIEW`** (**`apps/api/src/modules/admin/service.ts`** ~L3380–3404). Sets **`ssm_approved`** (investor) or **`ssm_checked`** (issuer), sets `onboarding_status` → **`PENDING_APPROVAL`**, logs `SSM_APPROVED`, then calls **`advanceOnboardingStatusFromFlags`** (reason `ADMIN_APPROVE_SSM_VERIFICATION`).

#### `PENDING_APPROVAL`

- **Meaning:** Awaiting **admin** to approve the **onboarding submission** (RegTank-side review step), or personal path after liveness.
- **Set by:** Individual handler (personal), COD handler (company after SSM path or personal branch), `RegTankService` paths for investor personal approval branch, etc.
- **Admin:** **`AdminService.approveOnboardingSubmission`** (~L3461+) requires `PENDING_APPROVAL`, sets **`onboarding_approved: true`**, calls **`advanceOnboardingStatusFromFlags`**.
- **RegTank COD APPROVED:** **`cod-handler.ts`** ~L1368–1404 sets `onboarding_approved` when org already `PENDING_APPROVAL`, then **`advanceOnboardingStatusFromFlags`** (`REGTANK_COD_APPROVED`).

#### `PENDING_AML`

- **Meaning:** AML screening phase for org; admin AML action or webhook-driven **`maybeAdvanceOrgAfterAmlScreeningCleared`** interacts with this.
- **Entered via:** **`advanceOnboardingStatusFromFlags`** when previous was `PENDING_APPROVAL`, **`onboarding_approved`** true, and **company SSM gate** satisfied (`ssm_approved` investor / `ssm_checked` issuer). Implementation: **`apps/api/src/modules/onboarding/utils/advance-onboarding-status.ts`**.
- **Admin AML:** **`AdminService.approveAmlScreening`** (~L3180+): requires `PENDING_AML`, sets `aml_approved`, **`advanceOnboardingStatusFromFlags`**, may set `reg_tank_onboarding.status` to `APPROVED` for corporate.
- **Webhook:** **`apps/api/src/modules/regtank/webhooks/org-aml-milestone.ts`** → **`maybeAdvanceOrgAfterAmlScreeningCleared`**: only if org `onboarding_status === PENDING_AML`, sets `aml_approved` if needed, then **`advanceOnboardingStatusFromFlags`**.

#### `PENDING_FINAL_APPROVAL`

- **Meaning:** Final admin gate before `COMPLETED`.
- **Entered via:** **`advanceOnboardingStatusFromFlags`** when status was `PENDING_AML` and **`aml_approved`** true → writes `PENDING_FINAL_APPROVAL`.

#### `COMPLETED`

- **Meaning:** Org fully onboarded for portal purposes; `onboarded_at` / `admin_approved_at` set.
- **Set by:** **`AdminService`** final approval path (~L2897+): requires `PENDING_FINAL_APPROVAL`, validates flags (`onboarding_approved`, `aml_approved`, `tnc_accepted`, company `ssm_*`, and **legacy director_kyc_status.directors all APPROVED** for company), then `prisma.*Organization.update` → `onboarding_status: COMPLETED`, **`RegTankRepository.updateStatus`** → `reg_tank_onboarding.status` **`COMPLETED`**, optional corporate entities refresh from RegTank COD.

#### `REJECTED`

- **Meaning:** RegTank individual webhook rejected personal onboarding (and similar paths).
- **Set by:** **`IndividualOnboardingWebhookHandler`** when `statusUpper === "REJECTED"` (~L301+) updates org via **`OrganizationRepository.updateInvestorOrganizationOnboarding` / issuer equivalent** to `REJECTED`.

### 2.4 Intended company flow (canonical)

```
PENDING (create)
  → [COD webhook stores corp data] → PENDING_SSM_REVIEW (company)
  → [Admin approveSsmVerification] → PENDING_APPROVAL
  → [Admin approveOnboardingSubmission OR COD APPROVED path sets flag] → onboarding_approved + advance
      → PENDING_AML (if SSM gate satisfied)
  → [AML cleared: webhook org-aml-milestone OR admin approveAmlScreening] → aml_approved + advance
      → PENDING_FINAL_APPROVAL
  → [Admin final approval] → COMPLETED
```

### 2.5 Personal flow (divergence)

- Starts **`IN_PROGRESS`** at org create.
- **`IndividualOnboardingWebhookHandler`**: liveness / wait-for-approval → **`PENDING_APPROVAL`** on org.
- **`RegTankService.handleWebhookUpdate`** (called on `APPROVED` in individual handler ~L293–298) performs investor personal logic including **`PENDING_SSM_REVIEW`** jump for investor+company and **`advanceOnboardingStatusFromFlags`** healing branches — see **`apps/api/src/modules/regtank/service.ts`** ~L1650+.
- Personal **does not** use `PENDING_SSM_REVIEW` unless investor+company path in service.

---

## 3. Flag-based vs status-based onboarding

### 3.1 What “flag-based” means in this repo

**Flags** are boolean (or JSON-derived) **facts** stored on the org: **`onboarding_approved`**, **`aml_approved`**, **`tnc_accepted`**, **`ssm_approved`** (investor company), **`ssm_checked`** (issuer company), **`deposit_received`** (investor).

**`advanceOnboardingStatusFromFlags`** (**`apps/api/src/modules/onboarding/utils/advance-onboarding-status.ts`**) is the **central state machine** that reads flags + current `onboarding_status` and **writes the next `onboarding_status`** in at most **two** iterations:

1. If `PENDING_APPROVAL` **and** `onboarding_approved` **and** (if `COMPANY`) SSM gate → set **`PENDING_AML`**.
2. If `PENDING_AML` **and** `aml_approved` → set **`PENDING_FINAL_APPROVAL`**.

**Status is the output; flags are inputs** for these specific transitions. Comments in **`org-aml-milestone.ts`** state this explicitly.

### 3.2 Call sites of `advanceOnboardingStatusFromFlags`

| Caller | File | Typical reason string |
|--------|------|-------------------------|
| OrganizationService | `apps/api/src/modules/organization/service.ts` | `USER_ACCEPT_TNC` (after `acceptTnc`) |
| RegTankService | `apps/api/src/modules/regtank/service.ts` | `REGTANK_INDIVIDUAL_APPROVED`, healing |
| CODWebhookHandler | `apps/api/src/modules/regtank/webhooks/cod-handler.ts` | `REGTANK_COD_APPROVED` |
| AdminService | `apps/api/src/modules/admin/service.ts` | `ADMIN_APPROVE_AML_SCREENING`, `ADMIN_APPROVE_SSM_VERIFICATION`, `ADMIN_APPROVE_ONBOARDING_SUBMISSION`, etc. |
| org-aml-milestone | `apps/api/src/modules/regtank/webhooks/org-aml-milestone.ts` | dynamic `trigger` param |

### 3.3 What still sets `onboarding_status` directly (non-flag-driven)

Examples (non-exhaustive but important):

| Location | Behavior |
|----------|----------|
| `CODWebhookHandler` | Sets **`PENDING_SSM_REVIEW`** / **`PENDING_APPROVAL`** and bulk org JSON when corporate COD reaches wait state (**`cod-handler.ts`** ~631–707). |
| `IndividualOnboardingWebhookHandler` | Sets **`PENDING_APPROVAL`**, **`REJECTED`** (**`individual-onboarding-handler.ts`**). |
| `AdminService.approveSsmVerification` | Sets **`PENDING_APPROVAL`** when leaving `PENDING_SSM_REVIEW` (**`admin/service.ts`** ~3390–3404). |
| `AdminService` final approval | Sets **`COMPLETED`** directly (**`admin/service.ts`** ~2967–3028). |
| `RegTankService` | Investor personal approved path can set **`PENDING_SSM_REVIEW`** (**`regtank/service.ts`** ~1650+). |
| `OrganizationRepository` | Initial create statuses. |

### 3.4 `deposit_received`

- **Investor only** (Prisma `InvestorOrganization.deposit_received`). Used in portal UI stepper (**`apps/investor/src/components/onboarding-status-card.tsx`**: deposit step complete when true). **Not** read inside `advanceOnboardingStatusFromFlags`.

---

## 4. Database / Prisma model context

### 4.1 `investor_organizations` / `issuer_organizations`

**Schema:** `apps/api/prisma/schema.prisma` models `InvestorOrganization` / `IssuerOrganization`.

**Onboarding-relevant columns:**

| Column | Type | Role |
|--------|------|------|
| `onboarding_status` | `OnboardingStatus` | Primary lifecycle enum. |
| `onboarding_approved` | Boolean | Admin / COD approved “submission”. |
| `aml_approved` | Boolean | AML phase cleared. |
| `tnc_accepted` | Boolean | User accepted T&C (`OrganizationService.acceptTnc`). |
| `ssm_approved` | Boolean (investor) | Admin SSM/CTOS step for **investor company**. |
| `ssm_checked` | Boolean (issuer) | Admin SSM step for **issuer company**. |
| `deposit_received` | Boolean (investor) | Post-`COMPLETED` funding step for investor UX. |
| `corporate_entities` | Json | Directors/shareholders/corp shareholders extracted/merged for UI. |
| `director_kyc_status` | Json | Legacy structure: `directors[]`, `individualShareholders[]`, etc. with `kycStatus`, `eodRequestId`, `governmentIdNumber`, … |
| `director_aml_status` | Json | Parallel AML entries; matched in **`@cashsouk/types`** `director-shareholder-display.ts` by eod/kyc id. |
| `business_aml_status` | Json | Business shareholder AML bucket. |
| `kyc_response` | Json | Snapshot/response payload from provider pipeline (org-level). |
| `corporate_onboarding_data` | Json | Corporate onboarding form-style payload. |
| `corporate_required_documents` | Json | Required docs metadata. |
| `onboarded_at`, `admin_approved_at` | DateTime? | Completion timestamps. |

**Relations:**

- `regtank_onboarding RegTankOnboarding[]`
- `ctos_reports CtosReport[]`
- `ctos_party_supplements CtosPartySupplement[]`

### 4.2 `reg_tank_onboarding`

**Schema:** `model RegTankOnboarding` in `schema.prisma`.

| Field | Role |
|-------|------|
| `request_id` | Unique RegTank request id (webhook driver). |
| `reference_id` | Unique client reference. |
| `onboarding_type` | `INDIVIDUAL` / `CORPORATE` / etc. |
| `portal_type` | `"investor"` / `"issuer"` string. |
| `investor_organization_id` / `issuer_organization_id` | FK to org (nullable pair). |
| `status`, `substatus` | RegTank lifecycle mirror. |
| `verify_link`, `verify_link_expires_at` | Link for user. |
| `regtank_response`, `webhook_payloads` | Auditing / replay. |
| `submitted_at`, `completed_at` | Milestones. |

**Created:** via **`RegTankService`** / API client when user starts onboarding (see **`apps/api/src/modules/regtank/service.ts`**, **`apps/api/src/modules/regtank/api-client.ts`**). **Updated:** **`RegTankRepository.updateStatus`**, **`appendWebhookPayload`** (`apps/api/src/modules/regtank/repository.ts`), webhook handlers.

**Relationship:** Each active org onboarding session is one row; admin approval methods load this row by **`onboardingId`** (internal cuid) from admin UI.

### 4.3 `ctos_reports`

| Field | Role |
|-------|------|
| `issuer_organization_id` / `investor_organization_id` | Org scope (one nullable pair). |
| `subject_ref` | `null` = company/org report; else subject key for person/corp CTOS pull. |
| `company_json`, `financials_json`, `person_json`, `legal_json`, `ccris_json`, `summary_json` | Parsed SOAP output. |
| `raw_xml`, `report_html` | Raw + rendered HTML. |
| `fetched_at` | Ordering “latest”. |

**Created only in** **`apps/api/src/modules/ctos/ctos-report-service.ts`** (`prisma.ctosReport.create`). **Never** creates `ctos_party_supplements`.

### 4.4 `ctos_party_supplements`

| Field | Role |
|-------|------|
| `party_key` | Normalized identifier (IC/SSM per product rules). |
| `issuer_organization_id` / `investor_organization_id` | XOR ownership of row (see DB CHECK in migrations). |
| `onboarding_json` | JSON: `email`, `sent`, `requestId`, `referenceId`, `regtankStatus`, nested `kyc`, `aml`, timestamps, etc. |

**Created:** only **`prisma.ctosPartySupplement.create`** inside **`upsertCtosPartySupplementOnboardingJson`** (**`apps/api/src/modules/organization/service.ts`**). **Guard:** before create, **`isLegacyCtosPartyKycApproved`** (**`packages/types/src/director-shareholder-display.ts`**) against optional passed-through or **DB-loaded** `director_kyc_status`.

**Updated:** webhook handlers and **`sendDirectorCtosPartyOnboarding`** / email upsert paths (same file), **`ctos-party-kyb-link.ts`**, **`apps/api/src/lib/jobs/ctos-kyb-retry.ts`**.

### 4.5 `aml_identity_mapping`

Maps RegTank COD/EOD/KYC/KYB ids to org/entity for AML fetch/sync (**`apps/api/prisma/schema.prisma`**). Written from **`cod-handler`** bulk upsert path (~L605+).

### 4.6 `applications` (dependency note)

- `issuer_organization_id` FK.
- Review sections and status enums separate from org `onboarding_status`; see **`ApplicationStatus`** in `schema.prisma` and **`apps/api/src/modules/applications/service.ts`**.

---

## 5. RegTank module (implementation map)

| Concern | Location |
|---------|-----------|
| Service orchestration | `apps/api/src/modules/regtank/service.ts` |
| DB access | `apps/api/src/modules/regtank/repository.ts` |
| Outbound API | `apps/api/src/modules/regtank/api-client.ts` |
| Webhook router | `apps/api/src/modules/regtank/webhook-router.ts` (and related entry registering handlers) |
| Corporate COD | `apps/api/src/modules/regtank/webhooks/cod-handler.ts` |
| Individual liveness | `apps/api/src/modules/regtank/webhooks/individual-onboarding-handler.ts` |
| KYC payload | `apps/api/src/modules/regtank/webhooks/kyc-handler.ts` |
| Dev simulator | `apps/api/src/modules/regtank/webhook-handler-dev.ts` |

---

## 6. CTOS module (implementation map)

| Concern | Location |
|---------|-----------|
| Fetch + persist reports | `apps/api/src/modules/ctos/ctos-report-service.ts` |
| SOAP client / enquiry XML | `apps/api/src/modules/ctos/client.ts`, `enquiry-builder.ts` |
| Parse / HTML | `parser.ts`, `render-html.ts` |
| Subject ref resolution | `resolve-subject-from-org.ts` |

**Important:** CTOS **ingest** updates **`ctos_reports`** only. **People list for UI** comes from merging **`corporate_entities`**, **`director_kyc_status`**, **`organizationCtosCompanyJson`**, **`ctosPartySupplements`** in **`packages/types/src/director-shareholder-display.ts`** (`getDirectorShareholderDisplayRows`).

---

## 7. Webhook inventory (onboarding impact)

| Handler | File | Updates |
|---------|------|---------|
| Individual onboarding | `regtank/webhooks/individual-onboarding-handler.ts` | `reg_tank_onboarding`; org `onboarding_status` for personal; **or** `ctos_party_supplements.onboarding_json` when no `reg_tank_onboarding` row but supplement match (`tryUpdateCtosPartyOnboardingFromWebhook`). |
| COD (corporate) | `regtank/webhooks/cod-handler.ts` | Org status + `director_kyc_status`, `corporate_entities`, `aml_identity_mapping`, `onboarding_approved` + `advanceOnboardingStatusFromFlags` on COD APPROVED. |
| KYC | `regtank/webhooks/kyc-handler.ts` | Main org KYC paths + **`tryHandleCtosPartyKycFromWebhook`** → `ctos_party_supplements.update` only. |
| AML milestone | `regtank/webhooks/org-aml-milestone.ts` | `aml_approved` + `advanceOnboardingStatusFromFlags`. |
| EOD | `regtank/webhooks/eod-handler.ts` | Director/shareholder individual entities (referenced in comments; ties to `director_kyc_status` updates — read file for specifics when extending). |

---

## 8. `director_kyc_status` JSON (legacy corporate)

Not a Prisma relation: **JSON document** on org. Built/updated heavily in **`cod-handler.ts`** when corporate onboarding webhooks arrive. Consumer: **`getDirectorShareholderDisplayRows`** matches individuals by **normalized government id** and/or **EOD request id** (see **`packages/types/src/director-shareholder-display.ts`** — `findLegacyKycPersonByStrictId`, `findLegacyKycPersonByEod`, etc.).

---

## 9. CTOS party supplement lifecycle

1. **Precondition for party actions:** `OrganizationService` **`assertOrgOnboardingCompletedForCompanyPartyActions`** requires **`onboarding_status === COMPLETED`** for company before CTOS party email/send (**`organization/service.ts`**).
2. **Email save:** **`upsertCtosPartyEmail`** — validates row via **`getDirectorShareholderDisplayRows`** + **`isCtosIndividualKycEligibleRow`**; if legacy KYC APPROVED for `partyKey`, returns success **without** write; else **`upsertCtosPartySupplementOnboardingJson`**.
3. **Send RegTank 2.1:** **`sendDirectorCtosPartyOnboarding`** — rejects legacy APPROVED; requires existing supplement JSON with email; calls RegTank API; **`upsertCtosPartySupplementOnboardingJson`** with merged `onboarding_json` (incl. `requestId`, `verifyLink`, `regtankStatus`, `kyc.rawStatus` pending).
4. **Webhooks:** **`findCtosPartySupplementByOnboardingJsonMatch`** (`organization/ctos-party-supplement-webhook-lookup.ts`) locates row by JSON path `requestId` or `referenceId` plus org scope parsed from `buildSafeReferenceId` format.
5. **KYB attach after party KYC approved:** **`linkCtosPartyToKyb`** (`organization/ctos-party-kyb-link.ts`) **updates** supplement / RegTank KYB — does not create supplement.

**Reference id format:** **`buildSafeReferenceId(organizationId, partyKey)`** in **`organization/service.ts`** — sanitized ids, max length 99.

---

## 10. Email sending / resend

| Step | API | File |
|------|-----|------|
| Save email | `PATCH /v1/organizations/:portal/:id/ctos-party-email` | `apps/api/src/modules/organization/controller.ts` → **`OrganizationService.upsertCtosPartyEmail`** |
| Send / restart | `POST .../send-director-onboarding` (route name in controller) | **`OrganizationService.sendDirectorCtosPartyOnboarding`** |

SES: **`sendOnboardingEmail`** from **`apps/api/src/lib/email/ses.ts`** after RegTank returns `verifyLink`. Rate limits / cooldown tracked in **`onboarding_json`** (`lastSentAt`, `sendTimestamps`).

---

## 11. Admin approval (onboarding)

All in **`apps/api/src/modules/admin/service.ts`** (methods referenced above):

- **`approveSsmVerification`**: `PENDING_SSM_REVIEW` → sets SSM flag + `PENDING_APPROVAL` + `advanceOnboardingStatusFromFlags`.
- **`approveOnboardingSubmission`**: sets `onboarding_approved` + `advanceOnboardingStatusFromFlags`.
- **`approveAmlScreening`**: sets `aml_approved` + `advanceOnboardingStatusFromFlags` + optional `reg_tank_onboarding.status` for corporate.
- **Final approval** (~L2880+): validates flags + **all `director_kyc_status.directors` APPROVED** for company investor/issuer, sets **`COMPLETED`**, updates **`reg_tank_onboarding`** to `COMPLETED`, refreshes **`corporate_entities`** from COD.

Admin UI consumes organization + application payloads built in **`AdminService`** / **`AdminRepository`** (includes `ctos_party_supplements` on issuer org for applications — see **`admin/service.ts`** includes around `ctosPartySupplements` mapping ~2650+ and application snapshot ~4439+).

---

## 12. Financial approval (application review)

**File:** `apps/admin/src/components/application-review/sections/financial-section.tsx`

- Builds **`getDirectorShareholderDisplayRows`** from `app.issuer_organization` snapshot (corporate_entities, director_kyc_status, director_aml_status, latest CTOS company json, ctos_party_supplements).
- **Approve disabled** unless: for every **`isCtosIndividualKycEligibleRow`** row, if **not** **`isLegacyCtosPartyKycApproved`**, and party has a **supplement row**, then supplement `onboarding_json.regtankStatus === "APPROVED"` **or** `onboarding_json.kyc.rawStatus === "APPROVED"`. Rows without supplement rows do not block; legacy APPROVED skip.

---

## 13. Application submission / party onboarding gate

**File:** `apps/api/src/modules/applications/service.ts`  
**Function:** **`assertRequiredPartyOnboardingStarted`**

- Loads **`ctos_party_supplements`** for `issuer_organization_id`.
- For each **`isCtosIndividualKycEligibleRow`**, skips **legacy APPROVED**; if no supplement row for party key, skip; else requires **`requestId`** and RegTank status not in “not submitted” set (`EMAIL_SENT`, `FORM_FILLING`, `LIVENESS_*`).

**Admin strict KYC check:** **`AdminService.assertLatestCtosPartyKycApproved`** (~4771+) mirrors supplement-only approved logic for admin-side operations that call it.

---

## 14. Portal UI wiring (reference only)

| Concern | Location |
|---------|-----------|
| Org list + `onboardingStatus` | `packages/config/src/organization-context.tsx` (`isOnboarded`, `isPendingApproval`) |
| Investor/Issuer dashboard redirect | `apps/investor/src/app/page.tsx`, `apps/issuer/src/app/page.tsx` |
| Stepper | `apps/*/src/components/onboarding-status-card.tsx` (`getOnboardingSteps`) |
| Issuer directors CTOS UI | `apps/issuer/src/components/director-shareholders-unified-section.tsx` |
| Profile corporate entities | `apps/issuer/src/app/profile/page.tsx`, `apps/investor/src/app/profile/page.tsx` |
| Admin onboarding dialog | `apps/admin/src/components/onboarding-review-dialog.tsx` |

---

## 15. Jobs

**`apps/api/src/lib/jobs/ctos-kyb-retry.ts`**: retries KYB attach for supplements where KYC APPROVED but KYB flags incomplete — **`prisma.ctosPartySupplement.update`** only.

---

## 16. Types package (display merge)

**`packages/types/src/director-shareholder-display.ts`**

- **`getDirectorShareholderDisplayRows`**: merges **corporate_entities**, **CTOS `company_json` directors**, **legacy** `director_kyc_status` / AML, **supplements** for per-row email + RegTank CTOS-party state.
- **`isLegacyCtosPartyKycApproved`**: strict id match on legacy directors/individualShareholders with `kycStatus === APPROVED`.
- **`isCtosIndividualKycEligibleRow`**: CTOS rules for who may receive party onboarding.

---

## 17. API routes (organization CTOS party)

**`apps/api/src/modules/organization/controller.ts`**: `PATCH .../ctos-party-email`, send-director-onboarding routes for **investor** and **issuer** portal prefixes.

---

## 18. `OnboardingLog`

**Model:** `onboarding_logs` in `schema.prisma`. Written from **`AuthRepository.createOnboardingLog`**, **`prisma.onboardingLog.create`** in AML milestone, admin flows, webhooks — event types include `ONBOARDING_STATUS_UPDATED`, `SSM_APPROVED`, `AML_APPROVED`, `ONBOARDING_APPROVED`, `FINAL_APPROVAL_COMPLETED`, `TNC_APPROVED`, etc.

---

## 19. Prisma client and migrations

- **Runtime client:** `apps/api/src/lib/prisma.ts` — single shared `PrismaClient`.
- **Schema source of truth:** `apps/api/prisma/schema.prisma`; apply changes via **`prisma migrate`** (repo rules: never hand-edit applied migration history).
- **Historical CTOS supplement migrations:** `apps/api/prisma/migrations/20260424120000_ctos_party_supplements`, `20260425120000_ctos_party_supplement_onboarding_json`, `20260426180000_ctos_party_supplement_investor_org` — show evolution from issuer-only `organization_id` to XOR `issuer_organization_id` / `investor_organization_id` + unique indexes per org+`party_key`.

## 20. RegTank HTTP / webhook entry

- **Express mounting:** search **`routes.ts`** / **`apps/api/src/app`** for router attachment of **`regtank`** module (incoming webhooks typically unauthenticated with signature verification inside handler — verify in **`regtank/webhooks`** base class when hardening).
- **Types for payloads:** `apps/api/src/modules/regtank/types.ts` — `RegTankKYCWebhook`, `RegTankIndividualOnboardingWebhook`, corporate COD payload shapes.

## 21. Admin onboarding queue data

- **`RegTankRepository.listOnboardingApplications`** (`apps/api/src/modules/regtank/repository.ts`) returns rows with nested **`investor_organization` / `issuer_organization`** including **`onboarding_status`**, **`director_kyc_status`**, **`ctos_party_supplements`**, latest **`ctos_reports`** (company snapshot) — this feeds **`apps/admin`** onboarding approval pages.

## 22. CTOS HTTP API surface

- Controllers live under **`apps/api/src/modules/ctos/`** (and may be re-exported through central router). Use ripgrep **`router\.(get|post).*ctos`** or **`modules/ctos`** in **`apps/api/src`** for exact paths; they call **`ctos-report-service.ts`** helpers.

## 23. Environment / configuration (pointers only)

- **RegTank issuer personal form id:** read inside **`OrganizationService.sendDirectorCtosPartyOnboarding`** — `process.env.REGTANK_ISSUER_PERSONAL_FORM_ID` with numeric default in code.
- **CTOS SOAP:** `apps/api/src/modules/ctos/config.ts` (`getCtosConfig`) — URLs/credentials from env per deployment policy (do not document secret values here).

---

## 24. End-to-end execution trace (critical)

### Scenario A — CTOS lists 3 people; A and B legacy APPROVED; C new

**Assumptions:** Issuer company org `O`. CTOS company report row exists with `company_json.directors` (or equivalent) containing three individuals. Legacy **`director_kyc_status`** on `issuer_organizations` already lists A and B with `kycStatus: APPROVED` for matching IC keys; C absent or not APPROVED.

#### Step 1 — CTOS pull (org report)

- **Function:** e.g. `persistIssuerOrgCtosReport` / similar export from **`ctos-report-service.ts`** (depending on admin vs issuer trigger).
- **DB write:** `INSERT` into **`ctos_reports`** with `issuer_organization_id = O`, `subject_ref = null`, `company_json` populated, `fetched_at` set.
- **No write** to **`ctos_party_supplements`** in this step.

#### Step 2 — How people are identified in UI/API

- **Function:** **`getDirectorShareholderDisplayRows`** (`packages/types/src/director-shareholder-display.ts`).
- **Input:** `corporate_entities`, `director_kyc_status`, `director_aml_status`, `organizationCtosCompanyJson` (from latest report’s `company_json`), `ctosPartySupplements` from org API payload.
- **Output:** unified rows with `id`, `idNumber`, `status` (merged label), `email` from supplement if any, CTOS flags `isDirector`/`isShareholder` from position codes (`ctosDirectorShareholderFlags` in API **`ctos-party-kyb-link.ts`** / types).

#### Step 3 — Legacy check

- **Function:** **`isLegacyCtosPartyKycApproved(partyKey, directorKycStatus)`** (`director-shareholder-display.ts`).
- **Mechanism:** **`findLegacyKycPersonByStrictId`** compares normalized IC to `director_kyc_status.directors` / `individualShareholders` entries; returns true only if `kycStatus` uppercases to **`APPROVED`**.
- **DB read:** org’s current `director_kyc_status` JSON (no write).

#### Step 4 — Supplement creation (where / when)

- **Not** created on CTOS pull.
- **Created only if:** user (or flow) calls **`upsertCtosPartyEmail`** or **`sendDirectorCtosPartyOnboarding`** such that **`upsertCtosPartySupplementOnboardingJson`** runs **without** an existing row.
- **Guard:** **`upsertCtosPartySupplementOnboardingJson`** (`organization/service.ts`): loads `director_kyc_status` from DB if not passed; if **`isLegacyCtosPartyKycApproved`** → **no `create`** (log + return). **A and B:** no new row. **C:** first email save **creates** row with `onboarding_json` containing email + pending statuses.

#### Step 5 — Email input flow

- **UI:** **`DirectorShareholdersUnifiedSection`** (`apps/issuer/src/components/director-shareholders-unified-section.tsx`) PATCH **`/v1/organizations/issuer/{O}/ctos-party-email`** with `{ partyKey, email }`.
- **Server:** **`OrganizationService.upsertCtosPartyEmail`**: resolves `partyKey`; if legacy APPROVED → `{ success: true }` **no DB**; else **`upsertCtosPartySupplementOnboardingJson`** → **INSERT** for C (if new).

#### Step 6 — RegTank onboarding creation (party)

- **UI:** Confirm send → POST send-director-onboarding.
- **Server:** **`OrganizationService.sendDirectorCtosPartyOnboarding`**: if legacy APPROVED → **throws** `NOT_REQUIRED`; else **`RegTankAPIClient.createIndividualOnboarding`** / restart; then **`upsertCtosPartySupplementOnboardingJson`** → **UPDATE** existing row with `requestId`, `verifyLink`, `regtankStatus`, `kyc.rawStatus` pending, etc.
- **DB:** `ctos_party_supplements.onboarding_json` updated; **`reg_tank_onboarding`**: **no** new row for CTOS party flow.

#### Step 7 — Webhook updates (party)

- **Individual liveness webhook:** **`IndividualOnboardingWebhookHandler.tryUpdateCtosPartyOnboardingFromWebhook`** if `reg_tank_onboarding` not found by `requestId` — finds supplement via **`findCtosPartySupplementByOnboardingJsonMatch`**, **`prisma.ctosPartySupplement.update`** sets `regtankStatus` from **`mapRegtankIndividualLivenessRawToInternalStatus`**.
- **KYC webhook:** **`KycWebhookHandler.tryHandleCtosPartyKycFromWebhook`** → **`prisma.ctosPartySupplement.update`** with nested `kyc` + `aml` blocks.

#### Step 8 — KYC status in DB (party)

- **Table:** `ctos_party_supplements.onboarding_json.kyc.rawStatus` + top-level `regtankStatus`.
- **Legacy A/B:** remain only in **`director_kyc_status`**; supplement row absent or unchanged.

#### Step 9 — AML status in DB (party)

- **Same JSON:** `onboarding_json.aml.rawStatus` etc. from **`buildCtosPartySupplementAmlBlock`** in **`kyc-handler.ts`**.

#### Step 10 — UI display per person

- **`getDirectorShareholderDisplayRows`** merges legacy + supplement: A/B show **legacy** “KYC Approved”; C shows supplement-driven status until approved.

#### Step 11 — Application submission

- **`assertRequiredPartyOnboardingStarted`**: A/B skipped (legacy); C must have supplement with `requestId` and form submitted (not in pre-submit set); otherwise **throws** `AppError` `ONBOARDING_NOT_STARTED`.

#### Step 12 — Financial approval (admin)

- **`FinancialSection`**: A/B skipped; if C’s supplement exists and `regtankStatus`/`kyc.rawStatus` not APPROVED → **approve disabled**; when both APPROVED → enabled.

#### Step 13 — Org `COMPLETED` vs financial section (different gates)

- **Financial section** (§12): only **supplement** rows for **non-legacy** parties must show RegTank **`APPROVED`** in `onboarding_json`.
- **Admin final onboarding approval** (`AdminService` final method ~L2897+ in **`apps/api/src/modules/admin/service.ts`**): for **company** orgs still validates **`director_kyc_status.directors`** (legacy JSON) — every director entry must have **`kycStatus === "APPROVED"`** or final approval **throws**. That check does **not** read `ctos_party_supplements`. Therefore party **C** must eventually appear as **APPROVED** in **`director_kyc_status`** (via RegTank corporate/EOD refresh paths / COD-derived updates) for **org-level COMPLETED**, even if supplement-only KYC is already green in the financial UI.

---

### Scenario B — No CTOS pulled; only legacy

1. **No `ctos_reports`** (or no `company_json` used): **`getDirectorShareholderDisplayRows`** still builds rows from **`corporate_entities`** + **`director_kyc_status`** + AML; CTOS-specific eligibility may limit who is “CTOS party onboarding” eligible — **`isCtosIndividualKycEligibleRow`** depends on merged row (`ctosIndividualKycEligible` false disables party flow).
2. **Supplements:** none created unless email/send path runs and guard allows (**legacy APPROVED** → no create).
3. **Financial approve:** only parties with **supplement rows** are checked; if **no supplements**, loop never returns false → **financial approve allowed** by KYC gate (other app checks may still apply).
4. **Application `assertRequiredPartyOnboardingStarted`:** skips legacy APPROVED; if **no supplement keys**, no party fails → assert passes.
5. **Org onboarding status** proceeds independently via RegTank corporate/personal + admin flags as in §2.

---

## Appendix A — File index (high-signal)

| Area | Path |
|------|------|
| Advance status | `apps/api/src/modules/onboarding/utils/advance-onboarding-status.ts` |
| Org service + supplement upsert | `apps/api/src/modules/organization/service.ts` |
| Org repo create | `apps/api/src/modules/organization/repository.ts` |
| COD webhook | `apps/api/src/modules/regtank/webhooks/cod-handler.ts` |
| Individual webhook | `apps/api/src/modules/regtank/webhooks/individual-onboarding-handler.ts` |
| KYC webhook + CTOS party | `apps/api/src/modules/regtank/webhooks/kyc-handler.ts` |
| AML milestone | `apps/api/src/modules/regtank/webhooks/org-aml-milestone.ts` |
| CTOS persist | `apps/api/src/modules/ctos/ctos-report-service.ts` |
| Supplement lookup | `apps/api/src/modules/organization/ctos-party-supplement-webhook-lookup.ts` |
| KYB link job | `apps/api/src/modules/organization/ctos-party-kyb-link.ts` |
| Display merge | `packages/types/src/director-shareholder-display.ts` |
| Org context | `packages/config/src/organization-context.tsx` |
| Financial gate | `apps/admin/src/components/application-review/sections/financial-section.tsx` |
| Admin onboarding | `apps/api/src/modules/admin/service.ts` |

---

*Document generated from repository analysis. For line-accurate behavior after refactors, re-grep for symbols listed above.*
