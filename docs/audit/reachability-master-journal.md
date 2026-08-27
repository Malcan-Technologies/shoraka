# CashSouk reachability master journal

> **Superseded for coverage decisions (2026-08-26).** Use [`final-master-audit-notification-journal.md`](./final-master-audit-notification-journal.md), [`final-client-facing-log-notification-matrix.md`](./final-client-facing-log-notification-matrix.md), [`final-gap-decision-register.md`](./final-gap-decision-register.md), and [`final-evidence-checklist.md`](./final-evidence-checklist.md). Do not reopen this review from this file.

Verified: **2026-08-26** against current source. **Source wins.** Docs and enums are not proof of liveness.

This journal answers: *what can actually happen today, what evidence we keep, what Admin/Issuer/Investor see, and who is notified.*

**Method.** Start from UI (button/form) and jobs/webhooks. An event is not LIVE_UI unless a mounted `.tsx` caller reaches the writer. Hooks, SDK methods, and routes without a UI mount are **LIVE_API_ONLY** or **UNREACHABLE**. Dual-path events (Admin button *and* cron) are classified **LIVE_UI**; the system path is noted under Trigger.

**Status vocabulary (exactly one per event ID):**

| Status | Meaning |
|---|---|
| `LIVE_UI` | Mounted product UI reaches the writer today |
| `LIVE_SYSTEM` | Cron / internal side-effect only (no human button for this event) |
| `LIVE_WEBHOOK` | Provider/webhook path only |
| `LIVE_API_ONLY` | Route/service (and sometimes unused hook) exist; **no current UI** |
| `UNREACHABLE` | Writer exists; no SDK and/or no UI (route-only or unused hook) |
| `DEAD` | No production writer |
| `SEED_ONLY` | Only `seed.ts` rows |
| `DEV_ONLY` | Dev webhook / `DATABASE_URL_DEV` only |
| `HISTORICAL` | Labels retained for old rows; live flow writes a different ID |

**Evidence quality:** STRONG / SUFFICIENT / WEAK / MISSING — optional IP/UA is not required for internal jobs.

Companion files:

- Client presentation: [`client-facing-milestone-matrix.md`](./client-facing-milestone-matrix.md)
- Gaps only: [`coverage-gap-decision-register.md`](./coverage-gap-decision-register.md)

---

## How to read a row

- **Admin evidence surface** may be Activity, a detail page, Security/Access logs, CSV, or the operational record itself. “No Activity row” is **not** automatically a gap.
- **Issuer/Investor Activity** is the unified Activity feed allowlist (`ApplicationLogAdapter` / `NoteLogAdapter` / `OrganizationLogAdapter`). Detail pages and inboxes are recorded separately.
- **Decision** is for product/ops, not an implementation order.

---

## Auth / access / security

| Module | Business moment | Event ID | Status | Trigger | UI/API reachability | Audit table | Admin evidence surface | Issuer Activity | Investor Activity | Metadata/evidence | Notification type | Recipient | Channel | Evidence quality | Decision |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Auth | Login | `LOGIN` | LIVE_UI | Cognito OAuth callback | Landing → Cognito → `GET /v1/auth/cognito/callback` | `access_logs` | Access logs + CSV | NO | NO | user, success/fail, IP/UA | — | — | — | SUFFICIENT | ADMIN_ONLY |
| Auth | Logout | `LOGOUT` | LIVE_UI | Portal nav Sign out → Cognito logout | `apps/{admin,investor,issuer}/src/lib/auth.ts` → `nav-user.tsx` | `access_logs` | Access logs + CSV | NO | NO | user, IP/UA | — | — | — | SUFFICIENT | ADMIN_ONLY |
| Auth | Sign up | `SIGNUP` | LIVE_UI | Cognito callback `isSignup` | Landing signup OAuth | `access_logs` | Access logs + CSV | NO | NO | user | — | — | — | SUFFICIENT | ADMIN_ONLY |
| Auth | Password change | `PASSWORD_CHANGED` | LIVE_UI | Account Change password dialog (all portals) | `POST /v1/auth/change-password` | `security_logs` | Security logs | NO | NO | success/fail, session revoked | `password_changed` | acting user | platform + email | STRONG | KEEP |
| Auth | Email verify API | `EMAIL_CHANGED` | LIVE_API_ONLY | `POST /v1/auth/verify-email` | **Zero `.tsx`**. Landing verify-email uses `confirm-signup` (no this log) | `security_logs` | Security panel *if* ever written | NO | NO | email, success/fail | — | — | — | SUFFICIENT | SAFE_TO_DEFER |
| Auth | Self-add portal role | `ROLE_ADDED` (security) | LIVE_API_ONLY | `POST /v1/auth/add-role` | **Zero `.tsx`** | `security_logs` | Security logs | NO | NO | addedRole | — | — | — | SUFFICIENT | SAFE_TO_DEFER |
| Auth | Switch active role | `ROLE_SWITCHED` | LIVE_API_ONLY | `POST /v1/auth/switch-role` | **Zero `.tsx`**. Admin deactivate/reactivate uses **same event ID** via LIVE_UI (below) | `security_logs` | Security logs | NO | NO | newRole / status | — | — | — | SUFFICIENT | KEEP |
| Auth | Self-service profile | `PROFILE_UPDATED` (security) | LIVE_UI | Account / name-entry / onboarding account | `PATCH /v1/auth/profile` | `security_logs` | Security logs | NO | NO | updatedFields, previousValues | — | — | — | STRONG | KEEP |
| Access | Admin edits user profile | `PROFILE_UPDATED` (access) | LIVE_UI | User account profile panel | `PATCH /v1/admin/users/:id/profile` | `access_logs` | Access logs (User Profile Updated) + CSV | NO | NO | fields | — | — | — | STRONG | KEEP |
| Access | Admin changes portal roles | `ROLE_ADDED` / `ROLE_REMOVED` (access) | UNREACHABLE | `PATCH /v1/admin/users/:id/roles` | Hook `useUpdateUserRoles` — **zero `.tsx`**. Portal access UI uses onboarding toggle instead | `access_logs` | Filter exists; no current writer from UI | NO | NO | — | — | — | — | n/a | SAFE_TO_DEFER |
| Access | Onboarding reset (test) | `ONBOARDING_RESET` | UNREACHABLE | `POST /v1/admin/users/:id/reset-onboarding` | Route only; Swagger “temporary”; no SDK/hook/UI | `access_logs` + `onboarding_logs` | Would appear in access filter | NO | NO | — | — | — | — | n/a | KEEP (do not expose) |
| Security | Admin invite accepted | `ROLE_ADDED` (security) | LIVE_UI | OAuth accept invitation | Cognito callback → `acceptInvitation` | `security_logs` | Security logs | NO | NO | ADMIN role, invitation | — | — | — | SUFFICIENT | KEEP |
| Security | Create/delete role catalogue | `ROLE_CREATED` / `ROLE_REMOVED` | LIVE_UI | Settings → Roles configuration | `admin-permission-configuration.tsx` | `security_logs` | Security logs | NO | NO | roleKey | — | — | — | SUFFICIENT | KEEP |
| Security | Edit role permissions | `ROLE_PERMISSIONS_UPDATED` | LIVE_UI | Same roles page | PATCH permissions | `security_logs` | Security logs | NO | NO | previousPermissions, nextPermissions | — | — | — | STRONG | KEEP |
| Security | Revoke admin invitation | `INVITATION_REVOKED` | LIVE_UI | Settings → Roles | `useRevokeInvitation` | `security_logs` | Security logs | NO | NO | email, invitationId | — | — | — | SUFFICIENT | KEEP |
| Security | Deactivate/reactivate admin | `ROLE_SWITCHED` | LIVE_UI | Admin users table | deactivate/reactivate hooks | `security_logs` | Security logs | NO | NO | previousStatus, newStatus | — | — | — | SUFFICIENT | KEEP |
| Security | Platform finance settings save | `PLATFORM_FINANCE_SETTINGS_UPDATED` | LIVE_UI | Admin finance settings | `updatePlatformFinanceSettings` | `security_logs` | Security logs | NO | NO | previousValues, nextValues (auth secrets only redacted) | — | — | — | STRONG | KEEP |
| Access | Dead names on this table | `ROLE_SWITCHED`, `PASSWORD_CHANGED`, `EMAIL_CHANGED`, `ONBOARDING`, `USER_COMPLETED` | DEAD | — | Live equivalents are other tables | `access_logs` | n/a | n/a | n/a | — | — | — | — | n/a | KEEP (do not reintroduce) |
| Access | KYC status (seed) | `KYC_STATUS_UPDATED` | SEED_ONLY | seed rows | Filter retained for seed display | `access_logs` | Filter only | NO | NO | — | — | — | — | n/a | KEEP |
| Org invite | Issuer/investor member invite/revoke | — | LIVE_UI | Profile invite dialogs | Org invitation APIs; **no** `INVITATION_REVOKED` security row | invitation tables | Org members UI | NO | NO | invitation records | — | — | — | SUFFICIENT | ADMIN_ONLY |

---

## Onboarding / KYC / AML / SSM

| Module | Business moment | Event ID | Status | Trigger | UI/API reachability | Audit table | Admin evidence surface | Issuer Activity | Investor Activity | Metadata/evidence | Notification type | Recipient | Channel | Evidence quality | Decision |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Onboarding | Start personal/corporate | `ONBOARDING_STARTED` | LIVE_UI | Portal verify / account-type | `startPersonalOnboarding` / `startCorporateOnboarding` | `onboarding_logs` | Org Activity timeline | YES — Onboarding Started | YES — same | org, portal | — | — | — | SUFFICIENT | KEEP |
| Onboarding | Resume / regenerate link | `ONBOARDING_RESUMED` | LIVE_UI | Same start/resume APIs (+ auto-regen) | Portal + system auto-regen | `onboarding_logs` | Org timeline | NO (not in adapter 6) | NO | — | — | — | — | SUFFICIENT | ADMIN_ONLY |
| Onboarding | Admin restart | `ONBOARDING_CANCELLED` | LIVE_UI | Review dialog **Restart Onboarding** | `useRestartOnboarding` | `onboarding_logs` | Org timeline | YES — Onboarding Restarted | YES | restart copy | — | — | — | SUFFICIENT | KEEP |
| Onboarding | Status / KYC / AML bucket | `ONBOARDING_STATUS_UPDATED` | LIVE_UI | Admin **Refresh**; also webhooks + AML helper | Dialog refresh + RegTank | `onboarding_logs` | Org timeline (KYC via `metadata.trigger`) | NO | NO | trigger, amlApproved | — | — | — | SUFFICIENT | KEEP |
| Onboarding | Individual rejected | `ONBOARDING_REJECTED` | LIVE_WEBHOOK | RegTank individual handler | No admin reject button for this ID | `onboarding_logs` | Org timeline | YES — Onboarding Rejected | YES | reason from provider if present | `onboarding_rejected` | applicant | platform + email | SUFFICIENT | KEEP |
| Onboarding | Corporate COD rejected | `COD_REJECTED` | LIVE_WEBHOOK | COD handler | Webhook | `onboarding_logs` | Org timeline | YES | YES | — | `onboarding_rejected` | applicant | platform + email | SUFFICIENT | KEEP |
| Onboarding | Submission/provider gate | `ONBOARDING_APPROVED` | LIVE_WEBHOOK | RegTank extract/update | Admin `approveOnboardingSubmission` is **SDK/route, no `.tsx`** | `onboarding_logs` | Org timeline | YES — Onboarding Submission Approved | YES | — | — | — | — | SUFFICIENT | KEEP (notify at final) |
| Onboarding | Platform access granted | `FINAL_APPROVAL_COMPLETED` | LIVE_UI | **Complete Onboarding** in review dialog | `useCompleteFinalApproval` | `onboarding_logs` | Org timeline | YES — Onboarding Approved | YES | — | `onboarding_approved` | applicant | platform + email | STRONG | KEEP |
| Onboarding | T&C accepted | `TNC_APPROVED` | LIVE_UI | Portal T&C cards | `acceptTnc` | `onboarding_logs` | Org timeline | NO | NO | — | — | — | — | SUFFICIENT | KEEP |
| Onboarding | T&C seed name | `TNC_ACCEPTED` | SEED_ONLY | seed | Live path is `TNC_APPROVED` | `onboarding_logs` | Seed display | NO | NO | — | — | — | — | n/a | KEEP |
| Onboarding | SSM approve | `SSM_APPROVED` | LIVE_UI | SSM panel **Approve** | `useApproveSsmVerification` | `onboarding_logs` | Org timeline | NO | NO | — | — | — | — | SUFFICIENT | ADMIN_ONLY |
| Onboarding | Manual AML override | `AML_APPROVED` | UNREACHABLE | `approveAmlScreening` | Hook exists; **zero `.tsx`** (regression test). Live AML = `ONBOARDING_STATUS_UPDATED` + `amlApproved` | `onboarding_logs` | Would show if written | NO | NO | — | — | — | — | n/a | KEEP |
| Onboarding | Sophisticated toggle | `SOPHISTICATED_STATUS_UPDATED` | LIVE_UI | Org detail toggle (+ auto-grant) | `useUpdateSophisticatedStatus` | `onboarding_logs` | Org timeline | NO | NO | granted/revoked | — | — | — | SUFFICIENT | ADMIN_ONLY |
| Onboarding | Form/liveness step | `FORM_FILLED` | LIVE_WEBHOOK | Individual/COD webhooks | — | `onboarding_logs` | Org timeline | NO | NO | payload | — | — | — | SUFFICIENT | ADMIN_ONLY |
| Onboarding | Admin org profile | `PROFILE_UPDATED` (onboarding) | LIVE_UI | Org profile/people panels | `useUpdateOrganizationProfile` | `onboarding_logs` | Org timeline | NO | NO | fields | — | — | — | SUFFICIENT | ADMIN_ONLY |
| Onboarding | Diagnostic webhooks | `WEBHOOK_*` / `EOD_*` | LIVE_WEBHOOK | RegTank handlers | Raw onboarding API; **not** in org Activity allowlist | `onboarding_logs` | Raw logs / API | NO | NO | provider payload | — | — | — | SUFFICIENT | ADMIN_ONLY |
| Onboarding | KYC approved as event | `KYC_APPROVED` | SEED_ONLY | seed | Live: STATUS_UPDATED + trigger | `onboarding_logs` | Seed | NO | NO | — | `kyc_approved` **DEAD** | — | — | n/a | KEEP |
| Onboarding | KYB approved | `KYB_APPROVED` | DEAD | — | No writer including seed | — | — | — | — | — | — | — | — | n/a | KEEP |
| Onboarding | Dev complete | `USER_COMPLETED` | DEV_ONLY | `webhook-handler-dev.ts` | Dev DB only | `onboarding_logs` | Dev | NO | NO | — | — | — | — | n/a | KEEP |
| Onboarding | Reset onboarded flag | `ONBOARDING_RESET` | UNREACHABLE | See access | Route-only | both tables | Excluded from org query allowlist | NO | NO | — | — | — | — | n/a | KEEP |

Legal **acceptance evidence** (not an onboarding event): `legal_document_acceptances` stores version, hash, acknowledgement text, opened/accepted at, IP, UA. Admin: `/legal-document-acceptances`. Portals: T&C UI.

---

## Application / facility / invoice / signing

| Module | Business moment | Event ID | Status | Trigger | UI/API reachability | Audit table | Admin evidence surface | Issuer Activity | Investor Activity | Metadata/evidence | Notification type | Recipient | Channel | Evidence quality | Decision |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Application | Draft created | `APPLICATION_CREATED` | LIVE_UI | Issuer create | `POST /v1/applications` | `application_logs` | Admin application timeline + CSV | YES — Application Started | N/A | review_cycle | — | — | — | SUFFICIENT | KEEP |
| Application | Submitted | `APPLICATION_SUBMITTED` | LIVE_UI | Issuer submit | status PATCH | `application_logs` | Timeline + CSV | YES — Application Submitted | N/A | — | `application_submitted_confirmation` | issuer owner+admins | platform | SUFFICIENT | KEEP |
| Application | Resubmitted | `APPLICATION_RESUBMITTED` | LIVE_UI | Issuer resubmit (rich + status) | amendments service + controller | `application_logs` | Timeline | YES | N/A | remarks / field_changes (rich path) | `application_resubmitted_confirmation` | issuer owner+admins | platform | SUFFICIENT | KEEP |
| Application | Overall reject | `APPLICATION_REJECTED` | LIVE_UI | Hero **Reject** (no reason field) | status REJECTED | `application_logs` | Timeline | YES — Application Rejected | N/A | **no remark** (UI does not collect) | `application_rejected` | issuer owner+admins | platform + email | SUFFICIENT | CLIENT_DECISION |
| Application | Issuer withdraw | `APPLICATION_WITHDRAWN` | LIVE_UI | Card **Withdraw application** | `POST .../cancel` | `application_logs` | Timeline | YES | N/A | withdraw_reason | `application_withdrawn_confirmation` | issuer owner+admins | platform | SUFFICIENT | KEEP |
| Application | Completed (offer accepted) | `APPLICATION_COMPLETED` | LIVE_UI | Issuer **Accept offer** | respondTo*Offer | `application_logs` | Timeline | YES | N/A | — | `application_completed` | issuer owner+admins | platform | SUFFICIENT | KEEP |
| Application | Reset to review | `APPLICATION_RESET_TO_UNDER_REVIEW` | LIVE_UI | Hero **Reset to Under Review** | status UNDER_REVIEW | `application_logs` | Admin timeline; **not** issuer Activity allowlist | NO (detail label only) | N/A | previous_status | — | — | — | SUFFICIENT | ADMIN_ONLY |
| Application | Archive | — | LIVE_UI | Version-mismatch restart archives | `archiveApplication` **writes no log** | application row `archived_at` | Status on application | NO | N/A | status | — | — | — | WEAK | SAFE_TO_DEFER |
| Application | Display alias | `APPLICATION_APPROVED` | DEAD + HISTORICAL display | Synthetic invoice row in `facility-transactions.ts` | **Not a DB write** | — | Labels exist | Synthetic only | N/A | — | `application_approved` **DEAD** | — | — | n/a | KEEP |
| Review | Section/item approve/reject/amend/pending | `SECTION_REVIEWED_*` / `ITEM_REVIEWED_*` | LIVE_UI | Section/item dropdowns | admin review routes | `application_logs` | Admin timeline (remark required on reject/amend) | PARTIAL (amend/reject keys on detail) | N/A | remark, old/new status | batched via `AMENDMENTS_SUBMITTED` | — | — | STRONG | KEEP |
| Review | CTOS resets financial | `SECTION_REVIEWED_PENDING` | LIVE_SYSTEM | CTOS update helper | No UI | `application_logs` | Admin timeline | NO | N/A | remark CTOS/AML | — | — | — | SUFFICIENT | ADMIN_ONLY |
| Review | Send amendment batch | `AMENDMENTS_SUBMITTED` | LIVE_UI | **Proceed & Send Amendments** | + `application_review_events` mirror | both | Timeline | YES — CashSouk Requested an Amendment | N/A | cycle, count | `application_amendments_requested` | issuer owner+admins | platform + email | STRONG | KEEP |
| Facility | Send offer | `CONTRACT_OFFER_SENT` | LIVE_UI | Admin **Send Offer** | + review_events mirror | `application_logs` | Timeline | YES — You Received a Facility Offer | N/A | amounts, expiry | `contract_offer_sent` | issuer owner+admins | platform + email | STRONG | KEEP |
| Invoice | Send offer | `INVOICE_OFFER_SENT` | LIVE_UI | Admin **Send Offer** | same pattern | `application_logs` | Timeline | YES | N/A | invoice, amount | `invoice_offer_sent` | issuer owner+admins | platform + email | STRONG | KEEP |
| Facility | Acceptance submitted | `CONTRACT_OFFER_ACCEPTANCE_SUBMITTED` / `_RESUBMITTED` | LIVE_UI | Issuer OfferReviewPanel | acceptance APIs | `application_logs` | Timeline | YES | N/A | status, submitted_at | — | — | — | SUFFICIENT | KEEP |
| Invoice | Acceptance submitted | `INVOICE_OFFER_ACCEPTANCE_*` | LIVE_UI | same panel | — | `application_logs` | Timeline | YES | N/A | — | — | — | — | SUFFICIENT | KEEP |
| Facility | Docs approved for signing | `CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING` | LIVE_UI | Item Approve (docs) or auto | — | `application_logs` | Admin timeline; **not** issuer Activity allowlist | NO | N/A | auto_approved | — | — | — | SUFFICIENT | ADMIN_ONLY |
| Facility | Issuer accepts / signs complete | `CONTRACT_OFFER_ACCEPTED` | LIVE_UI | **Accept offer** (+ finalize after envelope) | — | `application_logs` | Timeline | YES — Facility Offer Signed | N/A | responded_at | `application_completed` (same moment) | issuer | platform | STRONG | KEEP |
| Facility | Issuer declines | `CONTRACT_WITHDRAWN` | LIVE_UI | **Decline offer** | Not `CONTRACT_OFFER_REJECTED` | `application_logs` | Timeline | YES — Facility Offer Declined | N/A | rejection_reason optional | `application_withdrawn_confirmation` | issuer | platform | SUFFICIENT | KEEP |
| Facility | Dead decline ID | `CONTRACT_OFFER_REJECTED` | HISTORICAL | — | Labels only | — | Labels | Labels | N/A | — | — | — | — | n/a | KEEP |
| Invoice | Accept / decline | `INVOICE_OFFER_ACCEPTED` / `INVOICE_OFFER_REJECTED` | LIVE_UI | Accept/Decline on panel | Decline **does** use REJECTED ID | `application_logs` | Timeline | YES | N/A | — | completed / withdrawn_confirmation | issuer | platform | SUFFICIENT | KEEP |
| Facility | Retract | `CONTRACT_OFFER_RETRACTED` | LIVE_UI | Section **Set to Pending** (after OFFER_SENT) | — | `application_logs` | Timeline | YES — CashSouk Retracted… | N/A | contract ids | `offer_retracted_or_reset` | issuer | platform | SUFFICIENT | KEEP |
| Invoice | Retract | `INVOICE_OFFER_RETRACTED` | LIVE_UI | **Retract Offer** | — | `application_logs` | Timeline | YES | N/A | — | `offer_retracted_or_reset` | issuer | platform | SUFFICIENT | KEEP |
| Facility/Invoice | Offer/signing clock lapsed | `CONTRACT_OFFER_EXPIRED` / `INVOICE_OFFER_EXPIRED` | LIVE_SYSTEM | Hourly `acceptance-signing-expiry` | **No Expire button**. actor SYSTEM / SYSTEM_JOB / SYS | `application_logs` | Timeline | YES — Offer Expired | N/A | trigger, offer_kind | `offer_expired` | issuer owner+admins | platform + email | STRONG | KEEP |
| Facility/Invoice | Expiry reminder | — (no event) | LIVE_SYSTEM | Same job | Notification only | — | Inbox | NO | N/A | — | `offer_expiry_reminder_24h` | issuer owner+admins | platform + email | SUFFICIENT | KEEP |
| Signing | Deadline extend | `CONTRACT_SIGNING_DEADLINE_EXTENDED` / `INVOICE_*` | LIVE_UI | **Extend signing deadline** (past due) | envelope panel | `application_logs` | Timeline | YES | N/A | signing_expires_at | matching `*_signing_deadline_extended` | issuer | platform + email | SUFFICIENT | KEEP |
| Facility | Enable/disable | `CONTRACT_FACILITY_ENABLED` / `_DISABLED` | LIVE_UI | Facility switch on contract detail | — | `application_logs` | Admin timeline; **not** issuer Activity allowlist | NO | N/A | — | `facility_disabled` (disable only) | issuer | platform + email | SUFFICIENT | KEEP |
| Facility | Waive fee | `CONTRACT_FACILITY_FEE_WAIVED` | LIVE_UI | Waive remaining fee | — | `application_logs` | Admin | NO | N/A | — | — | — | — | SUFFICIENT | ADMIN_ONLY |
| Facility | Occupancy recompute | `CONTRACT_FACILITY_OCCUPANCY_UPDATED` | LIVE_SYSTEM | Draw/close/repay side-effect | INTERNAL source | `application_logs` | Admin; issuer adapter includes it | YES (generic occupancy copy) | N/A | before/after snapshots | — | — | — | STRONG | ADMIN_ONLY |
| Invoice | Withdraw invoice | `INVOICE_WITHDRAWN` | LIVE_UI | Issuer withdraw invoice | — | `application_logs` | Timeline | YES | N/A | — | — | — | — | SUFFICIENT | KEEP |
| Signing | Package created | `SIGNING_PACKAGE_CREATED` | LIVE_UI | Issuer create envelope in OfferReviewPanel | — | `application_logs` | Admin timeline; **not** issuer Activity allowlist | NO | N/A | envelope id | — | — | — | SUFFICIENT | ADMIN_ONLY |
| Signing | Package sent | `SIGNING_PACKAGE_SENT` | LIVE_UI | Issuer send / executeAccept | Direct email to signers **outside** registry | `application_logs` | Admin + issuer facility labels | PARTIAL (facility LOG_LABELS; not adapter getEventTypes) | N/A | envelope | — (DocuSign/SigningCloud email) | signers | provider email | SUFFICIENT | KEEP |
| Signing | Completed | `SIGNING_PACKAGE_COMPLETED` | LIVE_WEBHOOK | Provider sync/webhook rollup | **No Complete button**. Hidden on admin timeline | `application_logs` | Hidden admin; facility label exists | PARTIAL | N/A | envelope | User-facing success is `CONTRACT_OFFER_ACCEPTED` | — | — | SUFFICIENT | KEEP |
| Signing | Voided | `SIGNING_PACKAGE_VOIDED` | LIVE_UI | Admin **Void** + webhook decline + reject-app | envelope panel | `application_logs` | Admin timeline | NO | N/A | envelope | — | — | — | SUFFICIENT | KEEP |
| Signing | Envelope job expiry | — | LIVE_SYSTEM | Hourly `signing-envelope-expiry` | Status → EXPIRED; **no application_logs event** (`SIGNING_PACKAGE_EXPIRED` DEAD) | envelope row | Envelope status on signing panel | NO | N/A | status/timestamp | — | — | — | WEAK | ADD_EVIDENCE |
| Signing | Provider fields | — | — | — | `viewed_at` column **unwritten**. Signer IP **no column** | assignments/docs | Signed PDF + sha256 + signed_at **SUPPORTED** | — | — | — | — | — | — | PROVIDER_NOT_AVAILABLE for IP/viewed | LEGAL_DECISION |

`application_review_events`: forensic mirror of offer-sent and amendments-submitted. **No Activity reader.** INTENTIONAL.

---

## Notes / funding / investment / disbursement / servicing

| Module | Business moment | Event ID | Status | Trigger | UI/API reachability | Audit table | Admin evidence surface | Issuer Activity | Investor Activity | Metadata/evidence | Notification type | Recipient | Channel | Evidence quality | Decision |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Note | Create from invoice | `NOTE_CREATED_FROM_INVOICE` | LIVE_UI | Admin create-from-invoice | `useCreateNoteFromInvoice` | `note_events` | Note Activity | YES — Note Created | NO | — | — | — | — | SUFFICIENT | KEEP |
| Note | Publish | `PUBLISH` | LIVE_UI | Campaign **Publish** | `usePublishNote` | `note_events` (+ admin action) | Note Activity | YES — Note Published | NO | before/after | `note_published` | issuer org members | platform | STRONG | KEEP |
| Note | Unpublish | `UNPUBLISH` | LIVE_UI | Campaign **Unpublish** | `useUnpublishNote` | `note_events` | Note Activity (not issuer feed) | NO | NO | — | — | — | — | SUFFICIENT | ADMIN_ONLY |
| Note | Pause / resume | `PAUSE_LISTING` / `RESUME_LISTING` | LIVE_UI | Campaign pause/resume | hooks on `notes/[id]` | `note_events` | Note Activity | YES | NO | — | — | — | — | SUFFICIENT | KEEP |
| Note | Close funding | `CLOSE_FUNDING` | LIVE_UI | Campaign **Close Funding**; also cron + auto-close on full commit (SYS / SYSTEM_JOB) | `useCloseNoteFunding` + `note-listing-expiry` | `note_events` | Note Activity | YES — Funding Closed | NO | before/after | `note_funding_succeeded` | issuer org members | platform | STRONG | KEEP |
| Note | Fail funding | `FAIL_FUNDING` | LIVE_UI | Campaign **Mark funding unsuccessful**; also cron under-minimum | `useFailNoteFunding` + job | `note_events` | Note Activity | YES — Funding Unsuccessful | YES — same | before/after | `note_funding_failed_issuer` + `_investor` | issuer members + committed investors | platform | STRONG | KEEP |
| Note | Manual activate | `ACTIVATE` | LIVE_API_ONLY | `POST /v1/admin/notes/:id/activate` | Hook `useActivateNote` **defined, zero page mounts**. Live servicing start is disbursement complete (below) | `note_events` | Would show on note Activity if called | Would show (adapter includes ACTIVATE) | Would show | — | `note_active_issuer` + `note_active_investor` **only if this API is called** | — | platform | SUFFICIENT | ADMIN_ONLY — not a current Admin workflow |
| Investment | Commit | `INVESTMENT_COMMITTED` | LIVE_UI | Investor marketplace commit | `useCommitInvestment` | `note_events` | Note Activity | NO | YES — Investment Committed | amount, org | — | — | — | STRONG | KEEP |
| Tawarruq | Submit order / fetch certificate | `SHORAKA_ORDER_SUBMITTED` / `SHORAKA_CERTIFICATE_FETCHED` | LIVE_UI | Disbursement **IssuerPayoutCard** | submit/fetch hooks | `note_events` | Note Activity + payout card | NO | NO | order/certificate keys | — | — | — | STRONG | ADMIN_ONLY |
| Disbursement | Instruction created on close | `ISSUER_DISBURSEMENT_WITHDRAWAL_CREATED` | LIVE_SYSTEM | Side-effect of closeFunding | — | `note_events` | Note Activity (hidden from portals) | NO | NO | amounts/fees | — | — | — | STRONG | ADMIN_ONLY |
| Disbursement | Letter / submit / email / beneficiary / complete | `WITHDRAWAL_*` | LIVE_UI | IssuerPayoutCard (note-linked only) | generate/submit/resend/complete | `note_events` **iff `note_id`** | Note Activity + disbursement tab | NO except completed | NO except completed | withdrawalId, display ref | `withdrawal_submitted_to_trustee`; complete: `withdrawal_completed` | issuer members | platform | STRONG | KEEP |
| Disbursement | Payout completed + note ACTIVE | `WITHDRAWAL_COMPLETED` | LIVE_UI | **Mark completed** on ISSUER_DISBURSEMENT | Does **not** write `ACTIVATE`. Sets note ACTIVE in the same tx | `note_events` | Note Activity | YES — Your Disbursement Is Complete *(ISSUER_DISBURSEMENT only)* | YES — Your Investment Is Active | amount, withdrawalId | `withdrawal_completed` (issuer) + `note_active_investor` (confirmed investors). **Not** `note_active_issuer` | issuer members + investors | platform | STRONG | KEEP |
| Investor cash WD | Submit / complete | — | LIVE_UI | Investor create + Admin finance withdrawals | `INVESTOR_WITHDRAWAL`, `note_id` null | `withdrawal_instructions` + wallet debit | Finance withdrawal pages; **no note_events** | NO | NO Activity row; **inbox + /transactions** | amount, status, timestamps, requested_by | `investor_withdrawal_submitted` / `_completed` | requesting investor | platform | SUFFICIENT | KEEP |
| Servicing | Issuer submits payment | `ISSUER_PAYMENT_SUBMITTED` | LIVE_UI | Issuer note repayment form | — | `note_events` | Note Activity | YES — You Submitted a Repayment | NO | payment id | — | — | — | SUFFICIENT | KEEP |
| Servicing | Admin record/approve/reject | `PAYMENT_RECEIVED` / `_APPROVED` / `_REJECTED` | LIVE_UI | Settlement panel | — | `note_events` | Note Activity + settlement panel | NO (reject notifies) | NO (received notifies) | paymentId | `note_payment_received` (investors); `note_payment_rejected` (issuer) | investors / issuer members | platform | STRONG | KEEP |
| Servicing | Settlement preview/approve/post | `SETTLEMENT_PREVIEWED` / `_APPROVED` / `_POSTED` | LIVE_UI | Settlement panel | — | `note_events` | Note Activity + panel | NO | YES on POSTED — Settlement Posted | settlement id | `note_settlement_posted`; `note_repaid_issuer` when note repaid | investors / issuer | platform | STRONG | KEEP |
| Servicing | Settlement trustee letter/email/submit/complete | `SETTLEMENT_TRUSTEE_*` | LIVE_UI | Settlement panel trustee workflow | — | `note_events` | Note Activity + panel | NO | NO | letter, messageId | Direct SES to trustee (not registry) | trustee | email | STRONG | ADMIN_ONLY |
| Servicing | Overdue check | `OVERDUE_LATE_CHARGE_CHECKED` | LIVE_UI | Apply suggested fees | — | `note_events` | Note Activity | NO | NO | — | `note_arrears` / `_investor` | issuer + investors | platform | SUFFICIENT | KEEP |
| Servicing | Approve late charge API | `LATE_CHARGE_APPROVED` | LIVE_API_ONLY | `late-charge/approve` | **No admin hook/UI** | `note_events` | Would show if called | NO | NO | — | — | — | — | SUFFICIENT | SAFE_TO_DEFER |
| Servicing | Letters / default | `ARREARS_LETTER_GENERATED` / `DEFAULT_LETTER_GENERATED` / `NOTE_DEFAULT_MARKED` | LIVE_UI | Settlement panel | — | `note_events` | Note Activity | Default: YES | Default: YES | — | `note_defaulted` / `_investor` | issuer + investors | platform | STRONG | KEEP |
| Prospectus | Review create/edit/approve/invalidate | `PROSPECTUS_REVIEW_*` / `PROSPECTUS_APPROVAL_INVALIDATED_*` | LIVE_UI | Admin prospectus review | — | `note_events` | Note Activity | NO | Prospectus PDF on note | content hashes | — | — | — | STRONG | ADMIN_ONLY |
| Facility | Occupancy from notes | `FACILITY_OCCUPANCY_UPDATED` | LIVE_SYSTEM | refresh-contract-facility | INTERNAL | `note_events` | Note Activity | NO | NO | before/after | — | — | — | STRONG | ADMIN_ONLY |

---

## Investor money / gateway / refunds

| Module | Business moment | Event ID | Status | Trigger | UI/API reachability | Audit table | Admin evidence surface | Issuer Activity | Investor Activity | Metadata/evidence | Notification type | Recipient | Channel | Evidence quality | Decision |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Deposit | Happy-path capture + wallet credit | — | LIVE_WEBHOOK | Curlec capture → `creditCompletedDeposit` | **No gateway event row** | `gateway_payments` COMPLETED + `investor_balance_transactions` + ledger | Gateway payment detail + recon | N/A | **Transactions page** (not Activity feed) | amount, payment id, timestamps | — | — | — | SUFFICIENT | KEEP (status page) |
| Deposit | Name check held | `NAME_CHECK` | LIVE_WEBHOOK | Capture name REVIEW | — | `gateway_payment_events` | Gateway detail timeline | N/A | NO | — | — | — | — | SUFFICIENT | ADMIN_ONLY |
| Deposit | Name check approve | `NAME_CHECK_APPROVED` | LIVE_UI | Admin finance gateway **Approve** | admin-service | `gateway_payment_events` + wallet credit | Gateway detail | N/A | Transactions | — | — | — | — | STRONG | KEEP |
| Deposit | Name check reject | `NAME_CHECK_REJECTED` | LIVE_UI | Admin **Reject** → refund | — | events + refund | Gateway detail | N/A | Inbox | — | `deposit_name_check_rejected` | investor org members | platform | STRONG | KEEP |
| Gateway | Amount/currency hold | `CAPTURE_MISMATCH` | LIVE_WEBHOOK | Capture / stuck poller | — | `gateway_payment_events` | Gateway detail | N/A | NO | — | — | — | — | SUFFICIENT | ADMIN_ONLY |
| Gateway | Abandoned checkout | `EXPIRED` | LIVE_SYSTEM | Stuck-order poller `*/15` | actorless → SYSTEM | `gateway_payment_events` | Gateway detail | N/A | Transactions status | — | — | — | — | SUFFICIENT | KEEP |
| Refund | Initiated / completed / wallet fail | `REFUND_INITIATED` / `REFUNDED` / `REFUND_WALLET_REVERSAL_FAILED` | LIVE_WEBHOOK | Webhook, admin, poller | — | `gateway_payment_events` | Gateway detail | N/A | Inbox on deposit refunds | amounts | `deposit_refund_initiated` / `deposit_refunded` (INVESTOR_DEPOSIT only) | investor org members | platform | STRONG | KEEP |
| Gateway | Override proposal | `OVERRIDE_*` | DEAD | Prisma enum only | No writers | enum | Label map only | N/A | N/A | — | — | — | — | n/a | KEEP |
| Fees | Upfront facility fee due/paid | — | LIVE_UI / LIVE_WEBHOOK | Offer accept / payment webhook | notifications | contract + payments | Contract facility panel | Inbox | N/A | amounts | `facility_fee_payment_requested` / `facility_fee_upfront_paid` | issuer | platform + email | SUFFICIENT | KEEP |
| Fees | Excess late charges | — | LIVE_UI / LIVE_WEBHOOK | postSettlement / payment webhook | — | settlement + payments | Settlement panel | Inbox | N/A | amounts | `excess_late_charges_due` / `_paid` | issuer members | platform + email | SUFFICIENT | KEEP |

---

## Products / legal admin / jobs / config

| Module | Business moment | Event ID | Status | Trigger | UI/API reachability | Audit table | Admin evidence surface | Issuer Activity | Investor Activity | Metadata/evidence | Notification type | Recipient | Channel | Evidence quality | Decision |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Product | Create/update/delete | `PRODUCT_CREATED` / `_UPDATED` / `_DELETED` | LIVE_UI | Admin products | repository → `product_logs` | `product_logs` | Audit → Products | NO | NO | snapshot | bulk `new_product_alert` only if Admin broadcasts | chosen | admin-selected | SUFFICIENT | KEEP |
| Product | Inactivate/reactivate | `PRODUCT_INACTIVATED` / `_REACTIVATED` | UNREACHABLE | `setInactive` / `restoreProduct` | **Zero callers**; filter badges exist | `product_logs` | Filter would be empty | NO | NO | — | — | — | — | n/a | SAFE_TO_DEFER |
| Legal admin | Document/version CRUD | `LEGAL_DOCUMENT_*` / `LEGAL_VERSION_*` | LIVE_UI | Admin legal docs | `legal-documents/service.ts` | `legal_document_audit_logs` | Legal audit panel | NO | NO | before_json/after_json, hash | — | — | — | STRONG | KEEP |
| Notify config | Toggle type platform/email | — | LIVE_UI | Admin notification configuration | `updateNotificationType` — **no audit row** | `notification_types.updated_at` only | Config page (latest only) | NO | NO | — | — | — | — | WEAK | ADD_EVIDENCE |
| Jobs | Listing expiry | `CLOSE_FUNDING` / `FAIL_FUNDING` | LIVE_SYSTEM (also UI) | Hourly | SYS + SYSTEM_JOB | `note_events` | Note Activity | YES | FAIL: YES | see notes | see notes | — | — | STRONG | KEEP |
| Jobs | Envelope expiry | — | LIVE_SYSTEM | Hourly | Status only | envelope | Signing panel status | NO | NO | — | — | — | — | WEAK | ADD_EVIDENCE |
| Jobs | Gateway poller / receipt / recon | gateway events / recon tables | LIVE_SYSTEM | 15m / 10m / daily 18:00 UTC | actorless SYSTEM/INTERNAL; recon `triggered_by: CRON` | gateway + recon | Gateway + `/finance/reconciliation` | NO | NO | — | — | — | — | SUFFICIENT | KEEP |
| Jobs | Signing reconcile | may complete packages | LIVE_SYSTEM | `*/30` | via signing service | `application_logs` if completed | Signing + timeline | PARTIAL | NO | — | — | — | — | SUFFICIENT | KEEP |
| Jobs | Notification cleanup / CTOS KYB retry | — | LIVE_SYSTEM | daily / `*/5` | No domain audit event | operational | — | NO | NO | — | — | — | — | SUFFICIENT | KEEP |

**System attribution (this pass):** listing expiry, offer/signing-clock expiry, and fully-funded auto-close write `actor_type=SYSTEM`, `source=SYSTEM_JOB`, actor `SYS`. No remaining `ADMIN` mislabel found in `lib/jobs`. Gateway actorless writes use SYSTEM / **INTERNAL** (not SYSTEM_JOB). Envelope expiry writes **no** forensic row.

---

## Notification registry (production send proof)

| Classification | Count | Types |
|---|---|---|
| LIVE_AUTOMATIC | 45 | All registry IDs except the 6 below |
| BULK_ONLY | 2 | `system_announcement`, `new_product_alert` |
| DEAD | 4 | `kyc_approved`, `kyc_rejected`, `login_new_device`, `application_approved` |
| Total registry | 51 | `apps/api/src/modules/notification/registry.ts` |

`note_active_issuer` is LIVE_AUTOMATIC **only if** `NotesService.activate` runs. Current disbursement UI does **not** call `activate`; issuers get `withdrawal_completed` instead. Confirmed investors still get `note_active_investor` on disbursement complete.

---

## Counting rules used in the final report

- One row per **event ID × table** (same string on two tables is two rows).
- Dual UI+system → **LIVE_UI**.
- Dual UI+webhook → **LIVE_UI**.
- Adapter allowlist ≠ Admin visibility. Admin note Activity shows all `note_events` on the note.
- Investor Application/contract Activity is structurally **N/A**.
- Investor wallet/withdrawal/deposit evidence is often **status/transactions**, not Activity.
