# Final master audit / Activity / notification journal

Verified **2026-08-26** against current source. **Source wins.** This is the last coverage review. Do not reopen for completeness counts.

Companions for Notion / client: [client matrix](./final-client-facing-log-notification-matrix.md) · [gap register](./final-gap-decision-register.md) · [plain-English checklist](./final-evidence-checklist.md)

Older working files (`reachability-master-journal.md`, `coverage-gap-decision-register.md`, `client-facing-milestone-matrix.md`) are superseded **for coverage decisions**. Event-ID lookup may still use `audit-event-surface-matrix.md`.

---

## Method (reachability)

Trace: UI page/action → component → hook → API client → route → service → DB → audit writer → Activity presentation → notification.

An item is **LIVE_UI** only if a mounted `.tsx` caller exists. Hooks/SDK/routes without a mount are **LIVE_API_ONLY** or **UNREACHABLE**. Do not describe those as current Admin workflows.

| Status | Meaning |
|---|---|
| `LIVE_UI` | Mounted product UI reaches the writer |
| `LIVE_SYSTEM` | Cron / internal side-effect only |
| `LIVE_WEBHOOK` | Provider/webhook only |
| `LIVE_API_ONLY` | Route/service (sometimes unused hook); **no current UI** |
| `UNREACHABLE` | Writer exists; no SDK and/or no UI |
| `DEAD` | No production writer |
| `HISTORICAL` | Labels for old rows; live flow writes a different ID |
| `SEED_ONLY` | Only `seed.ts` |
| `DEV_ONLY` | Dev webhook / `DATABASE_URL_DEV` |

Dual UI+job or UI+webhook → **LIVE_UI**; the system path is noted under Trigger.

**User POV:** `GOOD` | `SUFFICIENT_VIA_STATUS_PAGE` | `NEEDS_ACTIVITY` | `NEEDS_NOTIFICATION` | `NEEDS_BOTH` | `INTENTIONALLY_SILENT`

**Admin traceability:** `TRACEABLE` | `PARTIALLY_TRACEABLE` | `NOT_TRACEABLE` — operational pages count.

**Decision:** `KEEP` | `FIX` | `ADD_EVIDENCE` | `ADD_ACTIVITY` | `ADD_NOTIFICATION` | `CHANGE_COPY` | `CLIENT_DECISION` | `PROVIDER_LIMITATION` | `ADMIN_ONLY` | `SAFE_TO_DEFER`

**Evidence stored (compact):** actor, actor_type, ts, target, org, source, portal, corr, ip/ua if present, before/after, reason if collected, payment/wd/ledger/doc ids.

IP/UA is not required on jobs. No Activity row is not a gap if another surface reconstructs the action.

---

## Stop rule

Coverage for live customer and Admin tracing is **complete**. Remaining rows in the gap register are product, legal, provider, or safe-to-defer. Do not add events or notifications to improve counts.

---

## Auth / access / security

| Module | Business Moment | Event ID | Status | Trigger | UI/API Reachability | Audit Table | Admin Evidence Surface | Issuer Activity | Investor Activity | Evidence Stored | Notification | Recipient | Channel | User POV | Admin Traceability | Evidence Quality | Decision |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Auth | Login | `LOGIN` | LIVE_UI | USER | Cognito callback | `access_logs` | Access logs + CSV | NO | NO | actor, ts, IP/UA, success/fail | — | — | — | INTENTIONALLY_SILENT | TRACEABLE | SUFFICIENT | ADMIN_ONLY |
| Auth | Logout | `LOGOUT` | LIVE_UI | USER | Portal Sign out | `access_logs` | Access logs + CSV | NO | NO | actor, ts, IP/UA | — | — | — | INTENTIONALLY_SILENT | TRACEABLE | SUFFICIENT | ADMIN_ONLY |
| Auth | Sign up | `SIGNUP` | LIVE_UI | USER | Cognito `isSignup` | `access_logs` | Access logs + CSV | NO | NO | actor, ts | — | — | — | INTENTIONALLY_SILENT | TRACEABLE | SUFFICIENT | ADMIN_ONLY |
| Auth | Password change | `PASSWORD_CHANGED` | LIVE_UI | USER | Account dialog → `POST /v1/auth/change-password` | `security_logs` | Security logs | NO | NO | actor, ts, success/fail, session revoked | `password_changed` — Password Changed | acting user | platform + email | GOOD | TRACEABLE | STRONG | KEEP |
| Auth | Email verify API | `EMAIL_CHANGED` | LIVE_API_ONLY | USER | `POST /v1/auth/verify-email` — **zero `.tsx`**. Landing uses confirm-signup | `security_logs` | Security panel if written | NO | NO | email, success/fail | — | — | — | INTENTIONALLY_SILENT | PARTIALLY_TRACEABLE | SUFFICIENT | SAFE_TO_DEFER |
| Auth | Self-add portal role | `ROLE_ADDED` (security) | LIVE_API_ONLY | USER | `POST /v1/auth/add-role` — **zero `.tsx`** | `security_logs` | Security logs | NO | NO | addedRole | — | — | — | INTENTIONALLY_SILENT | TRACEABLE | SUFFICIENT | SAFE_TO_DEFER |
| Auth | Switch role API | `ROLE_SWITCHED` | LIVE_API_ONLY | USER | `POST /v1/auth/switch-role` — **zero `.tsx`**. Admin deactivate uses same ID via LIVE_UI | `security_logs` | Security logs | NO | NO | newRole / status | — | — | — | INTENTIONALLY_SILENT | TRACEABLE | SUFFICIENT | KEEP |
| Auth | Self profile | `PROFILE_UPDATED` (security) | LIVE_UI | USER | Account / onboarding account | `security_logs` | Security logs | NO | NO | updatedFields, previousValues | — | — | — | INTENTIONALLY_SILENT | TRACEABLE | STRONG | KEEP |
| Access | Admin edits user profile | `PROFILE_UPDATED` (access) | LIVE_UI | ADMIN | User account profile panel | `access_logs` | Access logs + CSV | NO | NO | fields | — | — | — | INTENTIONALLY_SILENT | TRACEABLE | STRONG | KEEP |
| Access | Admin portal roles | `ROLE_ADDED` / `ROLE_REMOVED` (access) | UNREACHABLE | ADMIN | Hook `useUpdateUserRoles` — **zero `.tsx`**. Portal access uses onboarding toggle | `access_logs` | Filter exists; no current UI writer | NO | NO | — | — | — | — | INTENTIONALLY_SILENT | NOT_TRACEABLE | n/a | SAFE_TO_DEFER |
| Access | Onboarding reset (test) | `ONBOARDING_RESET` | UNREACHABLE | ADMIN | Route only; Swagger “temporary”; no SDK/hook/UI | both | Would appear in access filter | NO | NO | — | — | — | — | INTENTIONALLY_SILENT | NOT_TRACEABLE | n/a | KEEP |
| Security | Admin invite accepted | `ROLE_ADDED` (security) | LIVE_UI | USER | OAuth accept invitation | `security_logs` | Security logs | NO | NO | ADMIN role, invitation | — | — | — | INTENTIONALLY_SILENT | TRACEABLE | SUFFICIENT | KEEP |
| Security | Create/delete role | `ROLE_CREATED` / `ROLE_REMOVED` | LIVE_UI | ADMIN | Settings → Roles | `security_logs` | Security logs | NO | NO | roleKey | — | — | — | INTENTIONALLY_SILENT | TRACEABLE | SUFFICIENT | KEEP |
| Security | Edit role permissions | `ROLE_PERMISSIONS_UPDATED` | LIVE_UI | ADMIN | Same page | `security_logs` | Security logs | NO | NO | previousPermissions, nextPermissions | — | — | — | INTENTIONALLY_SILENT | TRACEABLE | STRONG | KEEP |
| Security | Revoke admin invitation | `INVITATION_REVOKED` | LIVE_UI | ADMIN | Settings → Roles | `security_logs` | Security logs | NO | NO | email, invitationId | — | — | — | INTENTIONALLY_SILENT | TRACEABLE | SUFFICIENT | KEEP |
| Security | Deactivate/reactivate admin | `ROLE_SWITCHED` | LIVE_UI | ADMIN | Admin users table | `security_logs` | Security logs | NO | NO | previousStatus, newStatus | — | — | — | INTENTIONALLY_SILENT | TRACEABLE | SUFFICIENT | KEEP |
| Security | Platform finance settings save | `PLATFORM_FINANCE_SETTINGS_UPDATED` | LIVE_UI | ADMIN | Admin finance settings | `security_logs` | Security logs | NO | NO | settingsKey, full previousValues/nextValues (auth secrets only redacted) | — | — | — | INTENTIONALLY_SILENT | TRACEABLE | STRONG | KEEP |
| Org invite | Member invite/revoke | — | LIVE_UI | USER | Profile invite dialogs | invitation tables | Org members UI. **No** security row on member revoke | NO | NO | invitation records | Direct SES invite email | invitee | email | SUFFICIENT_VIA_STATUS_PAGE | TRACEABLE | SUFFICIENT | ADMIN_ONLY |

---

## Onboarding / KYC / KYB / AML / SSM / legal consent

| Module | Business Moment | Event ID | Status | Trigger | UI/API Reachability | Audit Table | Admin Evidence Surface | Issuer Activity | Investor Activity | Evidence Stored | Notification | Recipient | Channel | User POV | Admin Traceability | Evidence Quality | Decision |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Onboarding | Start | `ONBOARDING_STARTED` | LIVE_UI | USER | Portal verify / account-type | `onboarding_logs` | Org Activity | YES — Onboarding Started | YES | org, portal | — | — | — | GOOD | TRACEABLE | SUFFICIENT | KEEP |
| Onboarding | Resume / regen | `ONBOARDING_RESUMED` | LIVE_UI | USER / SYSTEM | Start/resume APIs | `onboarding_logs` | Org timeline | NO | NO | — | — | — | — | INTENTIONALLY_SILENT | TRACEABLE | SUFFICIENT | ADMIN_ONLY |
| Onboarding | Admin restart | `ONBOARDING_CANCELLED` | LIVE_UI | ADMIN | Review **Restart Onboarding** | `onboarding_logs` | Org timeline | YES — Onboarding Restarted | YES | restart copy | — | — | — | GOOD | TRACEABLE | SUFFICIENT | KEEP |
| Onboarding | Status / KYC / AML bucket | `ONBOARDING_STATUS_UPDATED` | LIVE_UI | ADMIN / WEBHOOK / SYSTEM | **Refresh** + RegTank + AML helper | `onboarding_logs` | Org timeline (`metadata.trigger`, `amlApproved`) | NO | NO | trigger, amlApproved | — | — | — | INTENTIONALLY_SILENT | TRACEABLE | SUFFICIENT | KEEP |
| Onboarding | Individual rejected | `ONBOARDING_REJECTED` | LIVE_WEBHOOK | WEBHOOK | RegTank individual handler. No Admin reject button for this ID | `onboarding_logs` | Org timeline | YES — Onboarding Rejected | YES | provider reason if present | `onboarding_rejected` — Onboarding Rejected | applicant | platform + email | GOOD | TRACEABLE | SUFFICIENT | KEEP |
| Onboarding | Corporate COD rejected | `COD_REJECTED` | LIVE_WEBHOOK | WEBHOOK | COD handler | `onboarding_logs` | Org timeline | YES | YES | reason only if payload has one | `onboarding_rejected` | applicant | platform + email | GOOD | TRACEABLE | SUFFICIENT | PROVIDER_LIMITATION |
| Onboarding | Submission/provider gate | `ONBOARDING_APPROVED` | LIVE_WEBHOOK | WEBHOOK | Admin `approveOnboardingSubmission` is **SDK/route, no `.tsx`** | `onboarding_logs` | Org timeline | YES — Onboarding Submission Approved | YES | — | — | — | — | INTENTIONALLY_SILENT | TRACEABLE | SUFFICIENT | KEEP |
| Onboarding | Platform access granted | `FINAL_APPROVAL_COMPLETED` | LIVE_UI | ADMIN | **Complete Onboarding** | `onboarding_logs` | Org timeline | YES — Onboarding Approved | YES | — | `onboarding_approved` — Onboarding Approved | applicant | platform + email | GOOD | TRACEABLE | STRONG | KEEP |
| Onboarding | T&C accepted (onboarding log) | `TNC_APPROVED` | LIVE_UI | USER | Portal T&C cards | `onboarding_logs` | Org timeline | NO | NO | — | — | — | — | SUFFICIENT_VIA_STATUS_PAGE | TRACEABLE | SUFFICIENT | KEEP |
| Legal | Document acceptance | — | LIVE_UI | USER | T&C / consent UI | `legal_document_acceptances` | `/legal-document-acceptances` | T&C UI | T&C UI | version, hash, user, org, ts, IP, UA, acknowledgement text, PDF version | — | — | — | GOOD | TRACEABLE | STRONG | KEEP |
| Onboarding | SSM approve | `SSM_APPROVED` | LIVE_UI | ADMIN | SSM panel **Approve** | `onboarding_logs` | Org timeline | NO | NO | — | — | — | — | INTENTIONALLY_SILENT | TRACEABLE | SUFFICIENT | ADMIN_ONLY |
| Onboarding | Manual AML override | `AML_APPROVED` | UNREACHABLE | ADMIN | Hook exists; **zero `.tsx`**. Live AML = STATUS_UPDATED + `amlApproved` | `onboarding_logs` | Would show if written | NO | NO | — | — | — | — | INTENTIONALLY_SILENT | NOT_TRACEABLE | n/a | KEEP |
| Onboarding | Sophisticated toggle | `SOPHISTICATED_STATUS_UPDATED` | LIVE_UI | ADMIN | Org detail toggle | `onboarding_logs` | Org timeline | NO | NO | granted/revoked | — | — | — | INTENTIONALLY_SILENT | TRACEABLE | SUFFICIENT | ADMIN_ONLY |
| Onboarding | Form/liveness | `FORM_FILLED` | LIVE_WEBHOOK | WEBHOOK | Individual/COD | `onboarding_logs` | Org timeline | NO | NO | payload | — | — | — | INTENTIONALLY_SILENT | TRACEABLE | SUFFICIENT | ADMIN_ONLY |
| Onboarding | Admin org profile | `PROFILE_UPDATED` (onboarding) | LIVE_UI | ADMIN | Org profile/people | `onboarding_logs` | Org timeline | NO | NO | fields | — | — | — | INTENTIONALLY_SILENT | TRACEABLE | SUFFICIENT | ADMIN_ONLY |
| Onboarding | Diagnostic webhooks | `WEBHOOK_*` / `EOD_*` | LIVE_WEBHOOK | WEBHOOK | Raw onboarding API; **not** org Activity allowlist | `onboarding_logs` | Raw logs / API | NO | NO | provider payload | director/shareholder action-required when CTOS needs a party | org owner | platform + email | INTENTIONALLY_SILENT | TRACEABLE | SUFFICIENT | ADMIN_ONLY |
| Onboarding | KYC_APPROVED event | `KYC_APPROVED` | SEED_ONLY | — | Live: STATUS_UPDATED | `onboarding_logs` | Seed | NO | NO | — | `kyc_approved` **DEAD** | — | — | INTENTIONALLY_SILENT | n/a | n/a | KEEP |

---

## Applications / amendments / offers / acceptance / signing

| Module | Business Moment | Event ID | Status | Trigger | UI/API Reachability | Audit Table | Admin Evidence Surface | Issuer Activity | Investor Activity | Evidence Stored | Notification | Recipient | Channel | User POV | Admin Traceability | Evidence Quality | Decision |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Application | Draft created | `APPLICATION_CREATED` | LIVE_UI | USER | Issuer create | `application_logs` | Timeline + CSV | YES — Application Started | N/A | review_cycle | — | — | — | GOOD | TRACEABLE | SUFFICIENT | KEEP |
| Application | Submitted | `APPLICATION_SUBMITTED` | LIVE_UI | USER | Issuer submit | `application_logs` | Timeline + CSV | YES | N/A | — | `application_submitted_confirmation` — Application Submitted | issuer owner+admins | platform | GOOD | TRACEABLE | SUFFICIENT | KEEP |
| Application | Resubmitted | `APPLICATION_RESUBMITTED` | LIVE_UI | USER | Amendments service + status PATCH | `application_logs` | Timeline | YES | N/A | remarks / field_changes (rich path) | `application_resubmitted_confirmation` | issuer owner+admins | platform | GOOD | TRACEABLE | SUFFICIENT | KEEP |
| Application | Overall reject | `APPLICATION_REJECTED` | LIVE_UI | ADMIN | Hero **Reject** — **no reason field** | `application_logs` | Timeline | YES — Application Rejected | N/A | **no remark** (UI does not collect) | `application_rejected` — Application Rejected | issuer owner+admins | platform + email | GOOD | TRACEABLE | SUFFICIENT | CLIENT_DECISION |
| Application | Issuer withdraw | `APPLICATION_WITHDRAWN` | LIVE_UI | USER | **Withdraw application** | `application_logs` | Timeline | YES | N/A | withdraw_reason | `application_withdrawn_confirmation` | issuer owner+admins | platform | GOOD | TRACEABLE | SUFFICIENT | KEEP |
| Application | Completed | `APPLICATION_COMPLETED` | LIVE_UI | USER | **Accept offer** | `application_logs` | Timeline | YES | N/A | — | `application_completed` | issuer owner+admins | platform | GOOD | TRACEABLE | SUFFICIENT | KEEP |
| Application | Reset to review | `APPLICATION_RESET_TO_UNDER_REVIEW` | LIVE_UI | ADMIN | **Reset to Under Review** | `application_logs` | Admin timeline; not issuer Activity allowlist | NO (detail label) | N/A | previous_status | — | — | — | INTENTIONALLY_SILENT | TRACEABLE | SUFFICIENT | ADMIN_ONLY |
| Application | Archive | — | LIVE_UI | SYSTEM | Version-mismatch restart | application `archived_at` | Status on application | NO | N/A | status, timestamp | — | — | — | INTENTIONALLY_SILENT | PARTIALLY_TRACEABLE | WEAK | SAFE_TO_DEFER |
| Review | Section/item approve/reject/amend | `SECTION_REVIEWED_*` / `ITEM_REVIEWED_*` | LIVE_UI | ADMIN | Review dropdowns | `application_logs` | Timeline (remark required on reject/amend) | PARTIAL | N/A | remark, old/new status | batched via amendments | — | — | INTENTIONALLY_SILENT | TRACEABLE | STRONG | KEEP |
| Review | Send amendment batch | `AMENDMENTS_SUBMITTED` | LIVE_UI | ADMIN | **Proceed & Send Amendments** + `application_review_events` mirror (no Activity reader) | both | Timeline | YES — CashSouk Requested an Amendment | N/A | cycle, count | `application_amendments_requested` — Amendment Requested | issuer owner+admins | platform + email | GOOD | TRACEABLE | STRONG | KEEP |
| Review | Acceptance doc changes | — | LIVE_UI | ADMIN | Item reject on acceptance docs | `application_logs` | Timeline | detail | N/A | remark | `acceptance_document_changes_requested` | issuer owner+admins | platform | GOOD | TRACEABLE | SUFFICIENT | KEEP |
| Facility | Send offer | `CONTRACT_OFFER_SENT` | LIVE_UI | ADMIN | **Send Offer** | `application_logs` | Timeline | YES — You Received a Facility Offer | N/A | amounts, expiry | `contract_offer_sent` — Facility Offer Received | issuer owner+admins | platform + email | GOOD | TRACEABLE | STRONG | KEEP |
| Invoice | Send offer | `INVOICE_OFFER_SENT` | LIVE_UI | ADMIN | **Send Offer** | `application_logs` | Timeline | YES | N/A | invoice, amount | `invoice_offer_sent` | issuer owner+admins | platform + email | GOOD | TRACEABLE | STRONG | KEEP |
| Facility | Acceptance submitted | `CONTRACT_OFFER_ACCEPTANCE_SUBMITTED` / `_RESUBMITTED` | LIVE_UI | USER | OfferReviewPanel | `application_logs` | Timeline | YES | N/A | status, submitted_at | — | — | — | GOOD | TRACEABLE | SUFFICIENT | KEEP |
| Invoice | Acceptance submitted | `INVOICE_OFFER_ACCEPTANCE_*` | LIVE_UI | USER | same | `application_logs` | Timeline | YES | N/A | — | — | — | — | GOOD | TRACEABLE | SUFFICIENT | KEEP |
| Facility | Docs approved for signing | `CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING` | LIVE_UI | ADMIN / SYSTEM | Item Approve or auto | `application_logs` | Admin timeline; not issuer Activity allowlist | NO | N/A | auto_approved | — | — | — | INTENTIONALLY_SILENT | TRACEABLE | SUFFICIENT | ADMIN_ONLY |
| Facility | Signed / accepted | `CONTRACT_OFFER_ACCEPTED` | LIVE_UI | USER | **Accept offer** + finalize after envelope | `application_logs` | Timeline | YES — Facility Offer Signed | N/A | responded_at | `application_completed` (same moment) | issuer | platform | GOOD | TRACEABLE | STRONG | KEEP |
| Facility | Issuer declines | `CONTRACT_WITHDRAWN` | LIVE_UI | USER | **Decline offer**. Not `CONTRACT_OFFER_REJECTED` | `application_logs` | Timeline | YES — Facility Offer Declined | N/A | rejection_reason optional | `application_withdrawn_confirmation` | issuer | platform | GOOD | TRACEABLE | SUFFICIENT | KEEP |
| Facility | Dead decline ID | `CONTRACT_OFFER_REJECTED` | HISTORICAL | — | Labels only | — | Labels | Labels | N/A | — | — | — | — | n/a | n/a | n/a | KEEP |
| Invoice | Accept / decline | `INVOICE_OFFER_ACCEPTED` / `INVOICE_OFFER_REJECTED` | LIVE_UI | USER | Accept/Decline | `application_logs` | Timeline | YES | N/A | — | completed / withdrawn_confirmation | issuer | platform | GOOD | TRACEABLE | SUFFICIENT | KEEP |
| Facility | Retract | `CONTRACT_OFFER_RETRACTED` | LIVE_UI | ADMIN | Section **Set to Pending** after OFFER_SENT | `application_logs` | Timeline | YES — CashSouk Retracted… | N/A | contract ids | `offer_retracted_or_reset` | issuer | platform | GOOD | TRACEABLE | SUFFICIENT | KEEP |
| Invoice | Retract | `INVOICE_OFFER_RETRACTED` | LIVE_UI | ADMIN | **Retract Offer** | `application_logs` | Timeline | YES | N/A | — | `offer_retracted_or_reset` | issuer | platform | GOOD | TRACEABLE | SUFFICIENT | KEEP |
| Facility/Invoice | Offer/signing clock lapsed | `CONTRACT_OFFER_EXPIRED` / `INVOICE_OFFER_EXPIRED` | LIVE_SYSTEM | SYSTEM | Hourly `acceptance-signing-expiry`. **No Expire button**. actor SYSTEM / SYSTEM_JOB / SYS | `application_logs` | Timeline | YES — Offer Expired | N/A | trigger, offer_kind | `offer_expired` — Offer Expired | issuer owner+admins | platform + email | GOOD | TRACEABLE | STRONG | KEEP |
| Facility/Invoice | Expiry reminder | — | LIVE_SYSTEM | SYSTEM | Same job | — | Inbox | NO | N/A | daysBeforeExpiry | `offer_expiry_reminder_24h` — Offer Expiring Soon | issuer owner+admins | platform + email | GOOD | TRACEABLE | SUFFICIENT | KEEP |
| Signing | Deadline extend | `CONTRACT_SIGNING_DEADLINE_EXTENDED` / `INVOICE_*` | LIVE_UI | ADMIN | **Extend signing deadline** | `application_logs` | Timeline | YES | N/A | signing_expires_at | matching `*_signing_deadline_extended` | issuer | platform + email | GOOD | TRACEABLE | SUFFICIENT | KEEP |
| Facility | Disable | `CONTRACT_FACILITY_DISABLED` | LIVE_UI | ADMIN | Facility switch | `application_logs` | Admin timeline; not issuer Activity allowlist | NO | N/A | — | `facility_disabled` — Facility Disabled | issuer | platform + email | GOOD | TRACEABLE | SUFFICIENT | KEEP |
| Facility | Enable | `CONTRACT_FACILITY_ENABLED` | LIVE_UI | ADMIN | Facility switch | `application_logs` | Admin | NO | N/A | — | — | — | — | INTENTIONALLY_SILENT | TRACEABLE | SUFFICIENT | ADMIN_ONLY |
| Facility | Waive fee | `CONTRACT_FACILITY_FEE_WAIVED` | LIVE_UI | ADMIN | Waive remaining fee | `application_logs` | Admin | NO | N/A | — | — | — | — | INTENTIONALLY_SILENT | TRACEABLE | SUFFICIENT | ADMIN_ONLY |
| Facility | Occupancy recompute | `CONTRACT_FACILITY_OCCUPANCY_UPDATED` | LIVE_SYSTEM | SYSTEM | Draw/close/repay. source INTERNAL | `application_logs` | Admin; issuer adapter includes it | YES (generic) | N/A | before/after | — | — | — | INTENTIONALLY_SILENT | TRACEABLE | STRONG | ADMIN_ONLY |
| Invoice | Withdraw invoice | `INVOICE_WITHDRAWN` | LIVE_UI | USER | Issuer withdraw invoice | `application_logs` | Timeline | YES | N/A | — | — | — | — | GOOD | TRACEABLE | SUFFICIENT | KEEP |
| Signing | Package created | `SIGNING_PACKAGE_CREATED` | LIVE_UI | USER | Issuer create envelope | `application_logs` | Admin timeline; not issuer Activity allowlist | NO | N/A | envelope id | — | — | — | INTENTIONALLY_SILENT | TRACEABLE | SUFFICIENT | ADMIN_ONLY |
| Signing | Package sent | `SIGNING_PACKAGE_SENT` | LIVE_UI | USER | Send / executeAccept. Audit row only if email succeeds | `application_logs` | Admin + facility labels | PARTIAL | N/A | envelope | Direct SES — Signature requested: {title} | signers | provider email | GOOD | TRACEABLE | SUFFICIENT | KEEP |
| Signing | Completed | `SIGNING_PACKAGE_COMPLETED` | LIVE_WEBHOOK | WEBHOOK | Provider sync. **No Complete button**. Hidden on admin timeline | `application_logs` | Envelope + signed files. User-facing success is `CONTRACT_OFFER_ACCEPTED` | PARTIAL | N/A | envelope | — | — | — | GOOD | TRACEABLE | SUFFICIENT | KEEP |
| Signing | Voided | `SIGNING_PACKAGE_VOIDED` | LIVE_UI | ADMIN / WEBHOOK | Admin **Void** + webhook decline + reject-app | `application_logs` | Admin timeline | NO | N/A | envelope, void_reason | — (provider email on decline) | — | — | SUFFICIENT_VIA_STATUS_PAGE | TRACEABLE | SUFFICIENT | KEEP |
| Signing | Envelope job expiry | — | LIVE_SYSTEM | SYSTEM | Hourly `signing-envelope-expiry` → status EXPIRED. **No application_logs**. `SIGNING_PACKAGE_EXPIRED` DEAD | envelope row | Signing panel status + `updated_at` | NO | N/A | status, ts | — | — | — | SUFFICIENT_VIA_STATUS_PAGE | PARTIALLY_TRACEABLE | WEAK | SAFE_TO_DEFER |

`application_review_events`: forensic mirror of offer-sent and amendments-submitted. **No Activity reader.** Intentional.

---

## Notes / funding / investment / Tawarruq / disbursement / servicing

| Module | Business Moment | Event ID | Status | Trigger | UI/API Reachability | Audit Table | Admin Evidence Surface | Issuer Activity | Investor Activity | Evidence Stored | Notification | Recipient | Channel | User POV | Admin Traceability | Evidence Quality | Decision |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Note | Create from invoice | `NOTE_CREATED_FROM_INVOICE` | LIVE_UI | ADMIN | `useCreateNoteFromInvoice` | `note_events` | Note Activity | YES — Note Created | NO | — | — | — | — | INTENTIONALLY_SILENT | TRACEABLE | SUFFICIENT | KEEP |
| Note | Publish | `PUBLISH` | LIVE_UI | ADMIN | Campaign **Publish** | `note_events` | Note Activity | YES — Note Published | NO | before/after | `note_published` — Note Published | issuer org members | platform | GOOD | TRACEABLE | STRONG | KEEP |
| Note | Unpublish | `UNPUBLISH` | LIVE_UI | ADMIN | Campaign **Unpublish** | `note_events` | Note Activity (not issuer feed) | NO | NO | — | — | — | — | INTENTIONALLY_SILENT | TRACEABLE | SUFFICIENT | ADMIN_ONLY |
| Note | Pause / resume | `PAUSE_LISTING` / `RESUME_LISTING` | LIVE_UI | ADMIN | Campaign pause/resume | `note_events` | Note Activity | YES | NO | — | — | — | — | GOOD | TRACEABLE | SUFFICIENT | KEEP |
| Note | Close funding | `CLOSE_FUNDING` | LIVE_UI | ADMIN / SYSTEM | **Close Funding**; also hourly listing expiry + auto-close on full commit (SYS / SYSTEM_JOB) | `note_events` | Note Activity | YES — Funding Closed | NO | before/after | `note_funding_succeeded` — Funding Closed | issuer org members | platform | GOOD | TRACEABLE | STRONG | KEEP |
| Note | Fail funding | `FAIL_FUNDING` | LIVE_UI | ADMIN / SYSTEM | **Mark funding unsuccessful**; also cron under-minimum | `note_events` | Note Activity | YES — Funding Unsuccessful | YES | before/after | `note_funding_failed_issuer` + `_investor` | issuer members + committed investors | platform | GOOD | TRACEABLE | STRONG | KEEP |
| Note | Manual activate | `ACTIVATE` | LIVE_API_ONLY | ADMIN | `POST .../activate`. Hook `useActivateNote` **zero page mounts**. Live servicing start is disbursement complete | `note_events` | Would show if called | Would show | Would show | — | `note_active_issuer` + `note_active_investor` **only if this API is called** | — | platform | INTENTIONALLY_SILENT | NOT_TRACEABLE | SUFFICIENT | ADMIN_ONLY |
| Investment | Commit | `INVESTMENT_COMMITTED` | LIVE_UI | USER | Marketplace commit | `note_events` | Note Activity | NO | YES — Investment Committed | amount, org | — | — | — | GOOD | TRACEABLE | STRONG | KEEP |
| Tawarruq | Submit / certificate | `SHORAKA_ORDER_SUBMITTED` / `SHORAKA_CERTIFICATE_FETCHED` | LIVE_UI | ADMIN | IssuerPayoutCard | `note_events` | Note Activity + payout card | NO | NO | order/certificate keys | — | — | — | INTENTIONALLY_SILENT | TRACEABLE | STRONG | ADMIN_ONLY |
| Disbursement | Instruction created | `ISSUER_DISBURSEMENT_WITHDRAWAL_CREATED` | LIVE_SYSTEM | SYSTEM | Side-effect of closeFunding | `note_events` | Note Activity (hidden from portals) | NO | NO | amounts/fees | — | — | — | INTENTIONALLY_SILENT | TRACEABLE | STRONG | ADMIN_ONLY |
| Disbursement | Letter / submit / email / complete | `WITHDRAWAL_*` | LIVE_UI | ADMIN | IssuerPayoutCard (`note_id` set) | `note_events` | Note Activity + disbursement tab | NO except completed | NO except completed | withdrawalId, display ref | `withdrawal_submitted_to_trustee`; complete: `withdrawal_completed` | issuer members | platform | GOOD | TRACEABLE | STRONG | KEEP |
| Disbursement | Payout completed + note ACTIVE | `WITHDRAWAL_COMPLETED` | LIVE_UI | ADMIN | **Mark completed** on ISSUER_DISBURSEMENT. Does **not** write `ACTIVATE`. Sets note ACTIVE in same tx | `note_events` | Note Activity | YES — Your Disbursement Is Complete | YES — Your Investment Is Active | amount, withdrawalId | `withdrawal_completed` (issuer) + `note_active_investor` (investors). **Not** `note_active_issuer` | issuer members + confirmed investors | platform | GOOD | TRACEABLE | STRONG | KEEP |
| Investor cash WD | Submit / complete | — | LIVE_UI | USER / ADMIN | Investor create + Admin finance withdrawals. `INVESTOR_WITHDRAWAL`, `note_id` null | `withdrawal_instructions` + wallet | Finance withdrawal pages. **No note_events** | NO | NO Activity; **inbox + /transactions** | amount, status, ts, requested_by | `investor_withdrawal_submitted` / `_completed` | requesting investor | platform | GOOD | TRACEABLE | SUFFICIENT | KEEP |
| Servicing | Issuer submits payment | `ISSUER_PAYMENT_SUBMITTED` | LIVE_UI | USER | Issuer repayment form | `note_events` | Note Activity | YES — You Submitted a Repayment | NO | payment id | — | — | — | GOOD | TRACEABLE | SUFFICIENT | KEEP |
| Servicing | Record / approve / reject | `PAYMENT_RECEIVED` / `_APPROVED` / `_REJECTED` | LIVE_UI | ADMIN | Settlement panel. Reject reason **optional** | `note_events` | Note Activity + panel | NO (reject notifies) | NO (received notifies) | paymentId, reason if entered | `note_payment_received` (investors); `note_payment_rejected` (issuer) | investors / issuer members | platform | GOOD | TRACEABLE | STRONG | KEEP |
| Servicing | Settlement preview/approve/post | `SETTLEMENT_PREVIEWED` / `_APPROVED` / `_POSTED` | LIVE_UI | ADMIN | Settlement panel | `note_events` | Note Activity + panel | NO | YES on POSTED | settlement id | `note_settlement_posted`; `note_repaid_issuer` when note repaid | investors / issuer | platform | GOOD | TRACEABLE | STRONG | KEEP |
| Servicing | Settlement trustee workflow | `SETTLEMENT_TRUSTEE_*` | LIVE_UI | ADMIN | Settlement panel | `note_events` | Note Activity + panel | NO | NO | letter, messageId | Direct SES to trustee | trustee | email | INTENTIONALLY_SILENT | TRACEABLE | STRONG | ADMIN_ONLY |
| Servicing | Overdue / arrears | `OVERDUE_LATE_CHARGE_CHECKED` | LIVE_UI | ADMIN | Apply suggested fees | `note_events` | Note Activity | NO | NO | — | `note_arrears` / `_investor` | issuer + investors | platform | GOOD | TRACEABLE | SUFFICIENT | KEEP |
| Servicing | Approve late charge API | `LATE_CHARGE_APPROVED` | LIVE_API_ONLY | ADMIN | `late-charge/approve` — **no Admin hook/UI** | `note_events` | Would show if called | NO | NO | — | — | — | — | INTENTIONALLY_SILENT | NOT_TRACEABLE | SUFFICIENT | SAFE_TO_DEFER |
| Servicing | Letters / default | `ARREARS_LETTER_GENERATED` / `DEFAULT_LETTER_GENERATED` / `NOTE_DEFAULT_MARKED` | LIVE_UI | ADMIN | Settlement panel | `note_events` | Note Activity | Default: YES | Default: YES | — | `note_defaulted` / `_investor` | issuer + investors | platform | GOOD | TRACEABLE | STRONG | KEEP |
| Prospectus | Review / approve / invalidate | `PROSPECTUS_REVIEW_*` / `PROSPECTUS_APPROVAL_INVALIDATED_*` | LIVE_UI | ADMIN | Admin prospectus review | `note_events` | Note Activity | NO | Prospectus PDF on note | content hashes | — | — | — | INTENTIONALLY_SILENT | TRACEABLE | STRONG | ADMIN_ONLY |
| Facility | Occupancy from notes | `FACILITY_OCCUPANCY_UPDATED` | LIVE_SYSTEM | SYSTEM | `refresh-contract-facility` INTERNAL | `note_events` | Note Activity | NO | NO | before/after | — | — | — | INTENTIONALLY_SILENT | TRACEABLE | STRONG | ADMIN_ONLY |

---

## Investor money / gateway / refunds / fees

| Module | Business Moment | Event ID | Status | Trigger | UI/API Reachability | Audit Table | Admin Evidence Surface | Issuer Activity | Investor Activity | Evidence Stored | Notification | Recipient | Channel | User POV | Admin Traceability | Evidence Quality | Decision |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Deposit | Happy-path capture + credit | — | LIVE_WEBHOOK | WEBHOOK | Curlec capture → `creditCompletedDeposit`. **No gateway event row** | `gateway_payments` COMPLETED + wallet + ledger | Gateway payment detail + recon | N/A | **Transactions page** (not Activity) | amount, payment id, ts | — | — | — | SUFFICIENT_VIA_STATUS_PAGE | TRACEABLE | SUFFICIENT | KEEP |
| Deposit | Name check held | `NAME_CHECK` | LIVE_WEBHOOK | WEBHOOK | Capture REVIEW | `gateway_payment_events` | Gateway detail | N/A | NO | from/to status | — | — | — | INTENTIONALLY_SILENT | TRACEABLE | SUFFICIENT | ADMIN_ONLY |
| Deposit | Name check approve | `NAME_CHECK_APPROVED` | LIVE_UI | ADMIN | Finance gateway **Approve** | events + wallet | Gateway detail | N/A | Transactions | actor Admin | — | — | — | SUFFICIENT_VIA_STATUS_PAGE | TRACEABLE | STRONG | KEEP |
| Deposit | Name check reject | `NAME_CHECK_REJECTED` | LIVE_UI | ADMIN | **Reject** → refund | events + refund | Gateway detail | N/A | Inbox | actor Admin | `deposit_name_check_rejected` — Deposit Verification Failed | investor org members | platform | GOOD | TRACEABLE | STRONG | KEEP |
| Gateway | Amount/currency hold | `CAPTURE_MISMATCH` | LIVE_WEBHOOK | WEBHOOK | Capture / stuck poller | `gateway_payment_events` | Gateway detail | N/A | NO | reason | — | — | — | INTENTIONALLY_SILENT | TRACEABLE | SUFFICIENT | ADMIN_ONLY |
| Gateway | Abandoned checkout | `EXPIRED` | LIVE_SYSTEM | SYSTEM | Stuck-order poller `*/15`. actorless → SYSTEM / INTERNAL. Cron corr in logs | `gateway_payment_events` | Gateway detail | N/A | Transactions status | reason text | — | — | — | SUFFICIENT_VIA_STATUS_PAGE | TRACEABLE | SUFFICIENT | KEEP |
| Refund | Initiated / completed / wallet fail | `REFUND_INITIATED` / `REFUNDED` / `REFUND_WALLET_REVERSAL_FAILED` | LIVE_WEBHOOK | WEBHOOK / ADMIN / SYSTEM | Webhook, admin, poller | `gateway_payment_events` | Gateway detail | N/A | Inbox on **INVESTOR_DEPOSIT** refunds | amounts, from/to | `deposit_refund_initiated` / `deposit_refunded` (deposit only) | investor org members | platform | GOOD | TRACEABLE | STRONG | KEEP |
| Gateway | Override proposal | `OVERRIDE_*` | DEAD | — | Prisma enum; no writers | enum | Label map only | N/A | N/A | — | — | — | — | n/a | n/a | n/a | KEEP |
| Fees | Upfront facility fee | — | LIVE_UI / LIVE_WEBHOOK | USER / WEBHOOK | Offer accept / payment webhook | contract + payments | Contract facility panel | Inbox | N/A | amounts | `facility_fee_payment_requested` / `facility_fee_upfront_paid` | issuer | platform + email | GOOD | TRACEABLE | SUFFICIENT | KEEP |
| Fees | Excess late charges | — | LIVE_UI / LIVE_WEBHOOK | ADMIN / WEBHOOK | postSettlement / payment webhook | settlement + payments | Settlement panel | Inbox | N/A | amounts | `excess_late_charges_due` / `_paid` | issuer members | platform + email | GOOD | TRACEABLE | SUFFICIENT | KEEP |

---

## Products / legal admin / notification config / jobs

| Module | Business Moment | Event ID | Status | Trigger | UI/API Reachability | Audit Table | Admin Evidence Surface | Issuer Activity | Investor Activity | Evidence Stored | Notification | Recipient | Channel | User POV | Admin Traceability | Evidence Quality | Decision |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Product | Create/update/delete | `PRODUCT_CREATED` / `_UPDATED` / `_DELETED` | LIVE_UI | ADMIN | Admin products | `product_logs` | Audit → Products | NO | NO | snapshot | bulk only if Admin broadcasts | chosen | admin-selected | INTENTIONALLY_SILENT | TRACEABLE | SUFFICIENT | KEEP |
| Product | Inactivate/reactivate | `PRODUCT_INACTIVATED` / `_REACTIVATED` | UNREACHABLE | ADMIN | `setInactive` / `restoreProduct` **zero callers** | `product_logs` | Empty filters | NO | NO | — | — | — | — | INTENTIONALLY_SILENT | NOT_TRACEABLE | n/a | SAFE_TO_DEFER |
| Legal admin | Document/version CRUD | `LEGAL_DOCUMENT_*` / `LEGAL_VERSION_*` | LIVE_UI | ADMIN | Admin legal docs | `legal_document_audit_logs` | Legal audit panel | NO | NO | before_json/after_json, hash | — | — | — | INTENTIONALLY_SILENT | TRACEABLE | STRONG | KEEP |
| Notify config | Toggle type platform/email | — | LIVE_UI | ADMIN | Settings → Notifications → Configuration. `updateNotificationType` — **no audit row** | `notification_types.updated_at` only | Config page (latest only) | NO | NO | last write time | — | — | — | INTENTIONALLY_SILENT | PARTIALLY_TRACEABLE | WEAK | CLIENT_DECISION |
| Notify bulk | Admin broadcast | `notification_logs` | LIVE_UI | ADMIN | Same page **Send** → `POST /v1/notifications/admin/send` | `notification_logs` + per-user `notifications` | Notification logs | If targeted | If targeted | admin, title, message, counts, IP/UA | Admin-typed copy (not registry templates) | chosen audience | platform and/or email | GOOD | TRACEABLE | STRONG | KEEP |
| Jobs | Listing expiry | `CLOSE_FUNDING` / `FAIL_FUNDING` | LIVE_SYSTEM (also UI) | SYSTEM | Hourly. SYS + SYSTEM_JOB | `note_events` | Note Activity | YES | FAIL: YES | see notes | see notes | — | — | GOOD | TRACEABLE | STRONG | KEEP |
| Jobs | Envelope expiry | — | LIVE_SYSTEM | SYSTEM | Hourly. Status only | envelope | Signing panel | NO | NO | status/ts | — | — | — | SUFFICIENT_VIA_STATUS_PAGE | PARTIALLY_TRACEABLE | WEAK | SAFE_TO_DEFER |
| Jobs | Gateway poller / receipt / recon | gateway events / recon | LIVE_SYSTEM | SYSTEM | 15m / 10m / daily 18:00 UTC | gateway + recon | Gateway + `/finance/reconciliation` | NO | NO | recon `triggered_by: CRON` | — | — | — | INTENTIONALLY_SILENT | TRACEABLE | SUFFICIENT | KEEP |
| Jobs | Signing reconcile | may complete packages | LIVE_SYSTEM | SYSTEM | `*/30` | `application_logs` if completed | Signing + timeline | PARTIAL | NO | — | — | — | — | INTENTIONALLY_SILENT | TRACEABLE | SUFFICIENT | KEEP |
| Jobs | Notification cleanup / CTOS KYB retry | — | LIVE_SYSTEM | SYSTEM | daily / `*/5` | operational | — | NO | NO | — | director action-required if KYB retry needs it | org owner | platform + email | INTENTIONALLY_SILENT | TRACEABLE | SUFFICIENT | KEEP |

**Job attribution (verified):** listing expiry, offer/signing-clock expiry, fully-funded auto-close → `actor_type=SYSTEM`, `source=SYSTEM_JOB`, actor `SYS`. No remaining Admin mislabel in `lib/jobs`. Gateway actorless writes → SYSTEM / **INTERNAL**. Envelope expiry writes **no** forensic row.

---

## Notification registry (send proof)

Source: `apps/api/src/modules/notification/registry.ts` + `sendTyped` / `sendTypedPlatformOnly` call sites.

| Classification | Count | Types |
|---|---|---|
| LIVE_AUTOMATIC | 45 | All registry IDs except the 6 below |
| BULK_ONLY | 2 | `system_announcement`, `new_product_alert` — templates unused; Admin types copy |
| DEAD | 4 | `kyc_approved`, `kyc_rejected`, `login_new_device`, `application_approved` — hidden from config toggles |
| Total | 51 | |

`note_active_issuer` is LIVE_AUTOMATIC **only if** `NotesService.activate` runs. Current disbursement UI does **not** call `activate`. Issuers get `withdrawal_completed` instead. Confirmed investors still get `note_active_investor` on disbursement complete.

Idempotency: note-lifecycle and money helpers use `{resource}:{id}:notif:{type}:user:{userId}` keys. Retry of the same business action does not duplicate those sends.

### Exact live titles (user-facing)

| Type | Title | Typical message shape | Channel |
|---|---|---|---|
| `password_changed` | Password Changed | Password changed on {date} | platform + email |
| `onboarding_approved` | Onboarding Approved | …completed successfully. You now have full access… | platform + email |
| `onboarding_rejected` | Onboarding Rejected | …was rejected. Reason: {optional} | platform + email |
| `application_submitted_confirmation` | Application Submitted | …submitted… under review | platform |
| `application_amendments_requested` | Amendment Requested | Amendment required for application {ref} | platform + email |
| `acceptance_document_changes_requested` | Acceptance Documents Need Updates | Reviewer requested updates… | platform |
| `application_rejected` | Application Rejected | …has been rejected | platform + email |
| `application_resubmitted_confirmation` | Application Resubmitted | …resubmitted… (review cycle N) | platform |
| `application_withdrawn_confirmation` | Application Withdrawn / Facility Offer Declined / Invoice Offer Declined | depends on `withdrawalReason` | platform |
| `application_completed` | Application Completed | …completed successfully | platform |
| `contract_offer_sent` | Facility Offer Received | facility amount + expiry | platform + email |
| `invoice_offer_sent` | Invoice Offer Received | invoice + RM amount + expiry | platform + email |
| `offer_retracted_or_reset` | Facility/Invoice Offer Retracted | offer no longer active | platform |
| `offer_expired` | Offer Expired | Facility/Invoice offer expired | platform + email |
| `offer_expiry_reminder_24h` | Offer Expiring Soon | expires in N days on {date} | platform + email |
| `contract_signing_deadline_extended` | Signing Deadline Extended | deadline extended to {date} | platform + email |
| `invoice_signing_deadline_extended` | Signing Deadline Extended | invoice deadline extended | platform + email |
| `facility_disabled` | Facility Disabled | New drawdowns unavailable | platform + email |
| `director_shareholder_action_required` | Action Required: Complete Director/Shareholder Onboarding | Please complete onboarding {name} | platform + email |
| `investor_director_shareholder_action_required` | same title | same | platform + email |
| `note_published` | Note Published | published to marketplace | platform |
| `note_funding_succeeded` | Funding Closed | minimum reached, commitments locked | platform |
| `note_funding_failed_issuer` | Note funding did not complete | minimum not reached | platform |
| `note_funding_failed_investor` | Commitment released | reserved commitment released | platform |
| `note_active_investor` | Your Investment Is Active | note active, servicing started | platform |
| `note_repaid_issuer` | Note repaid | fully repaid and settled | platform |
| `note_payment_received` | Repayment Received | a repayment was recorded | platform |
| `note_settlement_posted` | Settlement Posted | settlement posted | platform |
| `note_arrears` / `_investor` | Note in Arrears | moved into arrears | platform |
| `note_defaulted` | Your Note Is in Default | marked as default | platform |
| `note_defaulted_investor` | Your Investment Is in Default | marked as default | platform |
| `withdrawal_submitted_to_trustee` | Withdrawal Submitted to Trustee | instruction {ref} submitted | platform |
| `withdrawal_completed` | Your Disbursement Is Complete | disbursement completed | platform |
| `note_payment_rejected` | Repayment Rejected | repayment rejected | platform |
| `facility_fee_payment_requested` | Upfront facility fee payment required | RM due | platform + email |
| `facility_fee_upfront_paid` | Upfront facility fee paid | RM received | platform + email |
| `excess_late_charges_due` | Outstanding late charges to pay | RM due | platform + email |
| `excess_late_charges_paid` | Late payment charges received | RM received | platform + email |
| `deposit_name_check_rejected` | Deposit Verification Failed | will be returned | platform |
| `deposit_refund_initiated` | Refund Started | refund of RM initiated | platform |
| `deposit_refunded` | Refund Completed | refund of RM completed | platform |
| `investor_withdrawal_submitted` | Withdrawal Submitted | request of RM submitted | platform |
| `investor_withdrawal_completed` | Withdrawal Completed | withdrawal of RM completed | platform |
| `note_active_issuer` | Your Note Is Active | **not sent on live disbursement UI** | platform if `activate` API used |

---

## Config change audit

| Setting | Who | When | Before/after | Append-only | Admin can see | Rating |
|---|---|---|---|---|---|---|
| Platform finance / trustee / grace / fees | Acting admin | `created_at` on security log | Full snapshots | `PLATFORM_FINANCE_SETTINGS_UPDATED` | Security logs | STRONG |
| Role permissions | Acting admin | yes | previous/next permissions | `ROLE_PERMISSIONS_UPDATED` | Security logs | STRONG |
| Role catalogue create/delete | Acting admin | yes | roleKey | `ROLE_CREATED` / `ROLE_REMOVED` | Security logs | SUFFICIENT |
| Legal document publish | Acting admin | yes | before_json/after_json, hash | `legal_document_audit_logs` | Legal audit panel | STRONG |
| Notification type toggles | Latest `updated_at` only | last write | **no** | **no** | Config page | WEAK_CONFIG_AUDIT |
| Product create/update/delete | Acting admin | yes | snapshot | `product_logs` | Products audit | SUFFICIENT |

---

## Legal evidence (source)

| Evidence | Status | Comment |
|---|---|---|
| Document / version | SUPPORTED | `legal_document_version_id`, `version_number` |
| Hash | SUPPORTED | `document_hash` from version `file_hash` |
| User | SUPPORTED | `user_id` + email/name snapshot |
| Organisation | SUPPORTED | `organization_id` + name snapshot |
| Timestamp | SUPPORTED | `accepted_at` / `opened_at` |
| IP | SUPPORTED | `accepted_ip_address` (acceptance, **not** signing) |
| Acknowledgement text | SUPPORTED | server-validated wording |
| Exact accepted PDF/version | SUPPORTED | version file + hash |
| Envelope / package ID | SUPPORTED | `signing_envelopes.id` |
| Document ID | SUPPORTED | `signing_documents.id` |
| Signer name/email | SUPPORTED | `signing_recipients` |
| Signed timestamp | SUPPORTED | `signing_assignments.signed_at` |
| Signed PDF | SUPPORTED | `signed_s3_key` |
| Signed PDF hash | SUPPORTED | `signed_file_sha256` |
| Provider status | SUPPORTED | envelope/document/recipient status + `provider_ref` |
| Signer IP | PROVIDER_NOT_AVAILABLE | no column; do not use sender request IP |
| Viewed timestamp | PROVIDER_NOT_AVAILABLE | `viewed_at` column **never written** |
| Provider certificate / audit trail | PROVIDER_NOT_AVAILABLE | not implemented |

---

## Financial evidence (source)

| Flow | Traceable? | Business event | Operational record | Wallet/ledger | Amount/status/ts | Actor/source | External ref |
|---|---|---|---|---|---|---|---|
| Deposit | MOSTLY | none (happy path) | `gateway_payments` | wallet + ledger | YES | WEBHOOK / SYSTEM | Curlec order id |
| Investment | YES | `INVESTMENT_COMMITTED` | investment row | wallet hold | YES | USER / API | — |
| Funding close | YES | `CLOSE_FUNDING` | note funding_status | ledger lock | YES | ADMIN or SYSTEM_JOB | — |
| Funding fail | YES | `FAIL_FUNDING` | note + released commitments | wallet release | YES | ADMIN or SYSTEM_JOB | — |
| Disbursement | YES | `WITHDRAWAL_*` | `withdrawal_instructions` | ISSUER_PAYABLE | YES | ADMIN | trustee instruction |
| Repayment | YES | `PAYMENT_*` | note payments | REPAYMENT_POOL | YES | USER submit / ADMIN record | — |
| Settlement | YES | `SETTLEMENT_*` | settlement rows | ledger post | YES | ADMIN | trustee letter |
| Investor withdrawal | YES | none on `note_events` | `withdrawal_instructions` | wallet debit | YES | USER / ADMIN | trustee if used |
| Refund | YES | `REFUND_*` | gateway events | wallet reverse | YES | WEBHOOK / ADMIN | Curlec refund |

---

## Dead / unreachable — ignore for coverage

Do not treat as blockers. Only hide from live UI if they confuse filters (already done for dead notification toggles and several onboarding filters).

- `access_logs`: names that live on other tables; `KYC_STATUS_UPDATED` SEED_ONLY; `ROLE_ADDED`/`ROLE_REMOVED`/`ONBOARDING_RESET` UNREACHABLE
- `onboarding_logs`: `TNC_ACCEPTED`/`KYC_APPROVED` SEED_ONLY; `AML_APPROVED`/`ONBOARDING_RESET` UNREACHABLE; `USER_COMPLETED` DEV_ONLY
- `application_logs`: `APPLICATION_APPROVED` DEAD (issuer invoice display alias is not a DB write); `CONTRACT_OFFER_REJECTED` HISTORICAL
- `gateway_payment_events`: `OVERRIDE_*` DEAD (Prisma enum)
- `product_logs`: inactivate/reactivate UNREACHABLE
- `SIGNING_PACKAGE_EXPIRED` DEAD (envelope status still updates)
- `note_active_issuer` unused on live disbursement UI
- `useActivateNote` / `useApproveAmlScreening` / `useUpdateUserRoles` unused in `.tsx`

---

## Rejection / failure evidence

| Case | Audit event? | Status? | Reason stored? | UI collects reason? | Admin can see? | User notified? |
|---|---|---|---|---|---|---|
| Application rejected | YES `APPLICATION_REJECTED` | YES | NO | NO — PRODUCT_DECISION | YES (no reason) | YES |
| Offer declined | YES `CONTRACT_WITHDRAWN` / `INVOICE_OFFER_REJECTED` | YES | optional | optional | YES | YES |
| Offer expired | YES `*_OFFER_EXPIRED` | YES | trigger SYSTEM | n/a | YES | YES |
| Signing voided | YES `SIGNING_PACKAGE_VOIDED` | YES | void_reason if set | Admin void | YES | provider email |
| Signing envelope expired | NO log row | YES EXPIRED | n/a | n/a | YES on panel | NO (clock expiry notifies separately) |
| Onboarding rejected | YES | YES | if provider sent | n/a | YES | YES |
| AML failure | live via STATUS_UPDATED | YES | provider | n/a | YES | NO until final/COD reject |
| COD rejected | YES | YES | if payload | n/a | YES | YES |
| Payment rejected | YES | YES | optional | optional field | YES | YES |
| Deposit name check rejected | YES | YES | Admin action | Approve/Reject | YES | YES |
| Refund wallet reversal fail | YES `REFUND_WALLET_REVERSAL_FAILED` | YES | reason on event | n/a | YES gateway | NO (ops) |
| Funding failure | YES `FAIL_FUNDING` | YES | before/after | Admin or job | YES | YES both sides |
| Investor WD failure | no dedicated fail event found | instruction status | n/a | n/a | YES finance pages | NO unless status page |

---

## Counting (context only — not a goal)

Live documented events ~140; not-live ~23; notification registry 51 (45 automatic, 2 bulk, 4 dead). Do not add writers to move these numbers.
