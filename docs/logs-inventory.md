# Logs Inventory

**As of:** 31 August 2026  
**Scope:** Named durable events and related activity/evidence records that the **current live platform can still produce**.  
**Method:** Traced from Admin / Issuer / Investor UI → API → service → Prisma / jobs / webhooks. Catalogue file `apps/api/src/lib/audit/visibility-matrix.ts` is a named-event index, not a complete writer list. Extra live writers (notes, gateway Prisma types) are included here when they have production callers.

Do not treat this file as the Operations Help guide. Help stays short; this inventory is the full current map.

---

## How to read

| Column | Meaning |
| --- | --- |
| Event | Stored `event_type` / `action` / gateway `type` |
| Cause | Business action that writes it |
| Actor | Who or what triggers it, and the role |
| Refs | Typical ids in the row or metadata |
| Recorded | What is stored |
| Code | Production writer (not tests) |
| Store | Prisma table |
| Admin | Shown in Admin/Operations UI today? |
| Where | Screen |
| Ops wording | Whether the Admin/customer label is understandable |
| Gaps | Missing context that makes the row hard to interpret |
| Overlap | Same fact written elsewhere |

**Source labels in Admin:** Portal / Webhook / System job / Internal process (`formatForensicAuditSourceLabel`).

**Customer Activity** (`/activity` on Issuer and Investor) only shows `userVisible` milestones. Admin timelines show a wider set.

---

## Where Operations sees logs

| Screen | What it reads |
| --- | --- |
| Admin Applications → Activity Timeline | `application_logs` |
| Admin Applications → Acceptance → Signing package | Envelope + recipient status, including **Viewed** (`SigningRecipient.viewed_at`, not an Activity event) |
| Admin Facilities → Activity / Facility & Offer | `application_logs` (facility-scoped) |
| Admin Issuers / Investors → Activity | `onboarding_logs` (admin allowlist, not forensic `WEBHOOK_*` / `EOD_WEBHOOK`) |
| Admin Issuers / Investors → Acceptances / People | Legal acceptances; membership is in Activity via `MEMBER_*` |
| Admin Notes → Activity | `note_events` |
| Admin Notes → Campaign, Disbursement, Servicing, Late Payment, Ledger | Note state + ledger; letter events appear on Activity when written |
| Admin Audit → Access / Security / Products / Legal Documents / Legal Acceptances / External Acceptances / Notifications | Matching audit tables |
| Finance → Gateway Payments (list + detail Activity Timeline) | `gateway_payments` + `gateway_payment_events` |
| Finance → Reconciliation | `gateway_recon_runs` / `gateway_recon_exceptions` |
| Finance money movement (Repayments, Settlements, Issuer Payouts, Investor Withdrawals) | Operational screens; matching `note_events` / gateway rows |
| Issuer / Investor Activity | Filtered application + org + note milestones |

`note_admin_actions` and `application_review_events` are **written** on live paths but have **no dedicated Admin reader** today. Admin Notes/Applications Activity uses `note_events` / `application_logs`.

Generated document hashes have **no Audit tab**. A letter on the note may still show as a Note Activity event.

---

## 1. Authentication and access

| Event | Cause | Actor | Refs | Recorded | Code | Store | Admin | Where | Ops wording | Gaps | Overlap |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `LOGIN` | Successful OAuth callback for an existing user | User (any portal role) | `user_id` | Portal, IP, user agent, source `API` | `auth/cognito.routes.ts`, `lib/auth/access-auth-audit.ts` | `access_logs` | Yes | Audit → Access | Yes (“Login”) | Portal comes from OAuth state | First-ever user is `SIGNUP` instead |
| `SIGNUP` | First CashSouk user row with no prior SIGNUP | User | `user_id` | Same as LOGIN | `auth/repository.ts` + OAuth callback | `access_logs` | Yes | Audit → Access | Yes (“Sign Up”) | Not a marketing “registration complete” | Mutually exclusive with LOGIN on that callback |
| `LOGOUT` | Sign-out | User | `user_id` | Best-effort; may skip if token already invalid | `auth/cognito.routes.ts` | `access_logs` | Yes | Audit → Access | Yes | Can be missing if Cognito token already dead | — |
| `PASSWORD_CHANGED` | In-app change password (Cognito `ChangePassword`) | User | `user_id` | Security row + metadata | `auth/service.ts` `changePassword` | `security_logs` | Yes | Audit → Security | Yes | Forgot-password (Cognito hosted) does **not** write this | Same action also sends typed notification |
| `EMAIL_VERIFIED` | Email verification attempt (success **or** failure) | User | `user_id` | Security row; `metadata.reason` is `EMAIL_VERIFIED` or `VERIFICATION_FAILED` | `auth/service.ts` | `security_logs` | Yes | Audit → Security | **Partial** — failed attempts use the same event name | Must open metadata for `success: false` | — |
| `UserSession` | Session issued / tracked for auth | User | `user_id`, session id | Session row (not an Activity event) | Auth session writers | `user_sessions` | No dedicated Audit tab | Session internals | n/a | Not an Operations timeline | Separate from Access |

Forgot-password and Admin 2FA reset run in Cognito, not this API. They are **not** access/security events here.

---

## 2. Roles, invitations, and admin security

| Event | Cause | Actor | Refs | Recorded | Code | Store | Admin | Where | Ops wording | Gaps | Overlap |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `ROLE_CREATED` | Admin creates a custom admin role | Admin | role id | Role key / permissions snapshot | `admin/service.ts` | `security_logs` | Yes | Audit → Security | Yes | — | — |
| `ROLE_PERMISSIONS_UPDATED` | Admin changes role permissions | Admin | role id | Before/after permissions | `admin/service.ts` | `security_logs` | Yes | Audit → Security | Yes | — | — |
| `ROLE_ADDED` | Role granted to a user | Admin or self-service add-role during onboarding | `user_id`, role | Target user in metadata | `admin/service.ts`, `auth/service.ts` | `security_logs` | Yes | Audit → Security | Yes | — | — |
| `ROLE_REMOVED` | Role removed | Admin | `user_id`, role | Target user | `admin/service.ts` | `security_logs` | Yes | Audit → Security | Yes | — | — |
| `ROLE_SWITCHED` | Active role changed | User | `user_id` | From/to role | `admin/service.ts` / auth role switch | `security_logs` | Yes | Audit → Security | Yes (`formatRoleSwitchedLabel`) | — | — |
| `INVITATION_REVOKED` | Admin invite revoked | Admin | invite / target user | Invite metadata | `admin/service.ts` | `security_logs` | Yes | Audit → Security | Yes | Admin invite **send** is email-only (see Notifications Inventory) | — |
| `PLATFORM_FINANCE_SETTINGS_UPDATED` | Admin updates platform finance settings | Admin | settings keys | Changed fields | `notes/service.ts` | `security_logs` | Yes | Audit → Security | Partial (tokenised name) | Which fields changed may need the drawer | — |

---

## 3. Issuer / Investor onboarding, KYC, KYB, AML

Store: `onboarding_logs`. Applicant is `user_id`; acting Admin is `actor_user_id`. Raw RegTank payloads are stripped.

| Event | Cause | Actor | Refs | Recorded | Code | Store | Admin | Where | Ops wording | Gaps | Overlap |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `ONBOARDING_STARTED` | User starts issuer or investor onboarding | Issuer or Investor | user, org, role | Role, portal, org ids | `auth/service.ts`, org start paths | `onboarding_logs` | Yes | Org Activity; customer Activity | Yes | No typed notification | — |
| `ONBOARDING_FEE_PAID` | Issuer registration fee captured | Payment webhook | org, payment | Fee / payment refs in metadata | `payment/webhook-service.ts` | `onboarding_logs` | Yes | Org Activity; customer Activity | Yes | No typed notification | Also `gateway_payments` |
| `ONBOARDING_RESUMED` | Onboarding resumed after interrupt | User / provider | request id | Status metadata | `regtank/service.ts` | `onboarding_logs` | Yes | Admin org Activity | Partial | Not customer-visible | — |
| `ONBOARDING_STATUS_UPDATED` | KYC/KYB/COD status change that is not a dedicated milestone | Webhook or Admin refresh | request id, `trigger` | Status, substatus, trigger (`KYC_APPROVED`, `REGTANK_WEBHOOK`, `ADMIN_MANUAL_ONBOARDING_REFRESH`, …) | `admin/service.ts`, `regtank/service.ts`, COD/individual handlers | `onboarding_logs` | Yes | Admin org Activity | Partial — one event covers many provider statuses | Must open metadata for `trigger` / status | Same webhook may also write `FORM_FILLED` or skip transport log |
| `FORM_FILLED` | Liveness / form-filling / ID uploaded webhook | RegTank webhook or Admin refresh | request id, status | Forensic status | `regtank/service.ts` `handleWebhookUpdate` | `onboarding_logs` | Yes | Admin org Activity | Partial (“Form Filled” for several statuses) | Not a single business milestone | Skipped when liveness already logged against an org |
| `ONBOARDING_AMENDMENT_REQUIRED` | COD wait / amendment path | Webhook | org, request | Customer-safe amendment milestone | `regtank/webhooks/cod-handler.ts` | `onboarding_logs` | Yes | Org + customer Activity | Yes | No typed inbox notification (director/shareholder type is separate) | Forensic `ONBOARDING_STATUS_UPDATED` may also exist |
| `ONBOARDING_CANCELLED` | Admin **restarts** onboarding (cancels prior provider request) | Admin | user, org | Restart metadata | `admin/service.ts` | `onboarding_logs` | Yes | Org Activity | **Confusing stored name.** Customer title is **Onboarding Restarted** | Stored type still says CANCELLED | New `ONBOARDING_STARTED` follows |
| `ONBOARDING_RESET` | Admin reset of local onboarding state | Admin | user, org | Reset reason | `admin/service.ts` | `onboarding_logs` | Yes | Admin org Activity | Yes | User-initiated cancel writes **no** log | — |
| `ONBOARDING_REJECTED` | Individual / org onboarding rejected | Webhook | user, reason | Reason when present | `regtank/webhooks/individual-onboarding-handler.ts`, COD handler | `onboarding_logs` | Yes | Org + customer Activity | Yes | — | Notification `onboarding_rejected` |
| `COD_REJECTED` | Corporate onboarding rejected at COD | Webhook | org, request | Rejection | `regtank/webhooks/cod-handler.ts` | `onboarding_logs` | Yes | Org + customer Activity | Customer label same as rejected | Two reject event names | `onboarding_rejected` notification |
| `ONBOARDING_APPROVED` | Provider/org approval (submission approved, not always final access) | Webhook / Admin | org | Approval | `admin/service.ts`, RegTank paths | `onboarding_logs` | Yes | Org Activity | Customer: **Onboarding Submission Approved**; Admin: **Onboarding Approved** | Easy to mix with final approval | `WEBHOOK_APPROVED` skipped when org already exists |
| `FINAL_APPROVAL_COMPLETED` | Admin completes final approval | Admin | user, org | Final approval | `admin/service.ts` `completeFinalApproval` | `onboarding_logs` | Yes | Org + customer Activity | Customer: **Onboarding Approved**; Admin: **Final Approval Completed** | Two “approved” milestones | Notification `onboarding_completed` |
| `AML_APPROVED` | AML milestone approved | Admin or AML webhook | org | AML metadata | `admin/service.ts`, `regtank/webhooks/org-aml-milestone.ts` | `onboarding_logs` | Yes | Admin org Activity | Yes | Not customer Activity | — |
| `SSM_APPROVED` | SSM / KYB company check approved | Admin | org | SSM metadata | `admin/service.ts` | `onboarding_logs` | Yes | Admin org Activity | Yes | — | — |
| `TNC_APPROVED` | Organisation T&C accepted | User (org) | org | T&C version refs | `organization/service.ts` | `onboarding_logs` | Yes | Admin org Activity | Yes | Historical rows may still say `TNC_ACCEPTED` | Legal acceptance table is separate |
| `SOPHISTICATED_STATUS_UPDATED` | Admin updates sophisticated-investor flag | Admin | org / user | New status | `admin/service.ts` | `onboarding_logs` | Yes | Admin org Activity | Yes | — | — |
| `PROFILE_UPDATED` | Org profile patched | Admin or org admin | org | Changed fields | `admin/organization-admin-profile.ts`, org profile writers | `onboarding_logs` | Yes | Admin org Activity | Yes | Field-level detail in metadata | — |
| `MEMBER_INVITED` | Org member invite created | Org admin | invitee email, role, org | Invite metadata | `organization/membership-audit.ts` via `organization/service.ts` | `onboarding_logs` | Yes | Admin org Activity | Yes | Invite email is SES, not inbox type | — |
| `MEMBER_ADDED` | Member joined org | User accepting invite / add | user, org, role | Membership | `organization/service.ts` | `onboarding_logs` | Yes | Admin org Activity | Yes | — | — |
| `MEMBER_REMOVED` | Member removed | Org admin | user, org | Removal | `organization/service.ts` | `onboarding_logs` | Yes | Admin org Activity | Yes | — | — |
| `MEMBER_ROLE_CHANGED` | Member role changed | Org admin | user, org, from/to role | Role change | `organization/service.ts` | `onboarding_logs` | Yes | Admin org Activity | Yes | — | — |
| `MARC_ASSESSMENT_SAVED` | Admin saves MARC assessment | Admin | org | Assessment snapshot | `paymaster/service.ts` | `onboarding_logs` | Yes | Admin org Activity | Yes | No notification | — |
| `EOD_APPROVED` | EOD (enhanced due diligence) approved | Webhook / Admin | org | EOD result | `regtank/webhooks/eod-handler.ts` | `onboarding_logs` | Yes | Admin org Activity | Yes | — | `EOD_WEBHOOK` is forensic-only |
| `EOD_REJECTED` | EOD rejected | Webhook / Admin | org | EOD result | `eod-handler.ts` | `onboarding_logs` | Yes | Admin org Activity | Yes | — | — |
| `EOD_WEBHOOK` | Raw EOD webhook append | Webhook | request / payload refs (stripped) | Forensic EOD | `eod-handler.ts` | `onboarding_logs` | **No** org Activity (FORENSIC_ONLY) | Investigation via DB / export if used | Technical | Not on Admin org timeline | Business result is `EOD_APPROVED` / `EOD_REJECTED` |
| `WEBHOOK_REJECTED` | RegTank `handleWebhookUpdate` status REJECTED | Webhook (production) | request id, status | Forensic transport log | `regtank/service.ts` | `onboarding_logs` | **No** org Activity | Forensic only | Technical | Catalogue marks DEV_ONLY; **production writer still runs** on REJECTED | Alongside `ONBOARDING_REJECTED` business rows when those fire |
| `WEBHOOK_APPROVED` | `handleWebhookUpdate` APPROVED when **no organisation id** yet | Webhook | request id | Forensic | `regtank/service.ts` | `onboarding_logs` | **No** | Forensic only | Technical | **Skipped** when `organizationId` exists (normal org path writes `ONBOARDING_APPROVED` instead) | Catalogue DEV_ONLY is incomplete for the no-org case |

CTOS KYB retry (`lib/jobs/ctos-kyb-retry.ts`, every 5 minutes) does **not** write an onboarding event. Financial section reset after CTOS **does** write `SECTION_REVIEWED_PENDING` (applications).

---

## 4. Applications, review, contract financing, invoice financing

Store: `application_logs` via `logApplicationActivity` (`applications/logs/service.ts`). Typical refs: application id + display `APP…`, contract `CON…`, invoice `INV…`, note `NOTE…` in metadata.

**Admin:** Applications / Facilities Activity. **Customer:** milestone subset (`userVisible`).

| Event | Cause | Actor | Refs | Recorded | Code | Admin | Where | Ops wording | Gaps | Overlap |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `APPLICATION_CREATED` | Issuer creates draft | Issuer | application | Overlay after draft commit | `applications/controller.ts`; repair `lib/jobs/application-timeline-repair.ts` | Yes | Application timeline; customer “Application Started” | Yes | Overlay can be missing until hourly repair; repaired rows have `source=INTERNAL` and **null actor** | Draft `applications` row is the durable create |
| `APPLICATION_PROCESSING_FEE_PAID` | Application processing fee captured | Webhook / payment | application, payment | Fee metadata | Applications / payment fee path | Yes | Timeline + customer | Yes | No typed notification | Gateway payment events |
| `FACILITY_FEE_PAID` | Upfront facility fee captured | Webhook / payment | application, contract, payment | Amount / payment | Applications / payment | Yes | Timeline + customer | Yes | — | Gateway events + `facility_fee_upfront_paid` notif |
| `APPLICATION_SUBMITTED` | Issuer submits application | Issuer | application | Same tx as `submitted_at` | `applications/service.ts` `persistSubmittedApplication` | Yes | Timeline + customer | Yes | — | Inbox `application_submitted_confirmation` (inbox only) |
| `APPLICATION_RESUBMITTED` | Issuer resubmits after amendment | Issuer | application, review cycle | Cycle | `admin/service.ts` / applications resubmit | Yes | Timeline + customer | Yes | — | `application_resubmitted_confirmation` |
| `APPLICATION_REJECTED` | Admin rejects application | Admin | application | Remark | `admin/service.ts` | Yes | Timeline + customer | Yes | — | `application_rejected` notif |
| `APPLICATION_WITHDRAWN` | Issuer withdraws application (or decline closes it) | Issuer | application | Reason in metadata | `applications/service.ts` | Yes | Timeline + customer | Yes | Decline also uses withdrawn confirmation notification with different copy | `CONTRACT_OFFER_DECLINED` / invoice decline |
| `APPLICATION_COMPLETED` | Application reaches completed | System / accept path | application | Completion | `applications/service.ts` | Yes | Timeline + customer | Yes | — | `application_completed` notif |
| `APPLICATION_RESET_TO_UNDER_REVIEW` | Admin returns application to review | Admin | application | Remark | `admin/service.ts` | Yes | Admin timeline | Yes (“Returned to Review”) | Not customer Activity | Notification `offer_retracted_or_reset` when offer reset |
| `SECTION_REVIEWED_APPROVED` | Admin approves a review section | Admin | application, section | old/new status, remark | `admin/service.ts` | Yes | Admin timeline | Yes | Section key in metadata | — |
| `SECTION_REVIEWED_REJECTED` | Admin rejects a section | Admin | application, section | status, remark | `admin/service.ts` | Yes | Admin timeline | Yes | — | — |
| `SECTION_REVIEWED_AMENDMENT_REQUESTED` | Admin requests section amendment | Admin | application, section | status, remark | `admin/service.ts` | Yes | Admin timeline | Yes | — | May pair with `AMENDMENTS_SUBMITTED` + issuer notif |
| `SECTION_REVIEWED_PENDING` | Section reset to pending (incl. CTOS financial reset) | Admin or INTERNAL job | application, section | reason | `admin/service.ts`; `ctos/ctos-report-service.ts` | Yes | Admin timeline | Yes | CTOS path actor is system | — |
| `ITEM_REVIEWED_APPROVED` / `REJECTED` / `AMENDMENT_REQUESTED` / `PENDING` | Admin reviews a checklist item | Admin | application, item key | scope_key, statuses, remark | `admin/service.ts` | Yes | Admin timeline | Yes | Item name in metadata | — |
| `AMENDMENTS_SUBMITTED` | Admin **sends** the amendment request pack to the issuer | Admin | application, cycle | Remark; review-event mirror | `admin/service.ts` | Yes | Timeline; customer “Amendment Request Sent” | **Name sounds like issuer submitted.** Admin/customer label is “Amendment Request Sent” | — | `application_review_events` mirror; notif `application_amendments_requested` |
| `CONTRACT_OFFER_SENT` | Admin sends facility offer | Admin | application, contract, expiry | Offer amounts, expiry | `admin/service.ts` | Yes | Timeline + customer | Yes | — | Review-event mirror; notif `contract_offer_sent` |
| `CONTRACT_OFFER_ACCEPTANCE_SUBMITTED` | Issuer submits acceptance docs | Issuer | application, contract | Acceptance | `applications/service.ts` | Yes | Timeline + customer | Yes | — | — |
| `CONTRACT_OFFER_ACCEPTANCE_RESUBMITTED` | Issuer resubmits acceptance after changes requested | Issuer | application, contract | Acceptance | `applications/service.ts` | Yes | Timeline + customer | Yes | — | First changes-requested notif is separate |
| `CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING` | Admin approves acceptance for signing | Admin | application, contract | Approval | `admin/service.ts` | Yes | Admin timeline | Yes | Not customer Activity | — |
| `CONTRACT_OFFER_ACCEPTED` | Facility offer accepted (post-signing / fee path) | Issuer / system | application, contract | Acceptance | `applications/service.ts` | Yes | Timeline + customer | Yes | — | May also complete application |
| `CONTRACT_OFFER_DECLINED` | Issuer declines facility offer | Issuer | application, contract | Decline | `applications/service.ts` | Yes | Timeline + customer | Yes | Live decline is **not** `CONTRACT_OFFER_REJECTED` | `application_withdrawn_confirmation` with decline copy |
| `CONTRACT_OFFER_RETRACTED` | Admin retracts facility offer | Admin | application, contract | Retract | `admin/service.ts` | Yes | Timeline + customer | Yes | — | `offer_retracted_or_reset` |
| `CONTRACT_OFFER_EXPIRED` | Acceptance/signing deadline job expires facility offer | SYSTEM_JOB | application, contract | Expiry | `lib/jobs/acceptance-signing-expiry.ts` | Yes | Timeline + customer | Yes | — | Notif `offer_expired`; may also expire signing package |
| `CONTRACT_SIGNING_DEADLINE_EXTENDED` | Admin extends signing deadline | Admin | application, contract, new deadline | New deadline | `admin/service.ts` | Yes | Timeline + customer | Yes | — | `contract_signing_deadline_extended` |
| `CONTRACT_FACILITY_OCCUPANCY_UPDATED` | Draw / fund / repay changes occupancy | System (drawdown, funding, repayment) | application, contract, note | Occupancy figures | `lib/refresh-contract-facility.ts`, `contracts/service.ts` | Yes | Timeline + customer | Yes | Two layers of the same fact | `FACILITY_OCCUPANCY_UPDATED` on the note |
| `CONTRACT_FACILITY_FEE_WAIVED` | Admin waives facility fee on the **application/contract** | Admin | application, contract | Waiver | `admin/service.ts` | Yes | Admin timeline | Yes | Distinct from note `WAIVE_FACILITY_FEE_COLLECTION` | — |
| `CONTRACT_FACILITY_DISABLED` | Admin disables facility (blocks drawdowns) | Admin | application, contract | Disable | `admin/service.ts` | Yes | Admin timeline | Yes | — | `facility_disabled` notif |
| `CONTRACT_FACILITY_ENABLED` | Admin re-enables facility | Admin | application, contract | Enable | `admin/service.ts` | Yes | Admin timeline | Yes | **No** enable notification | — |
| `CONTRACT_CUSTOMER_LARGE_PRIVATE_UPDATED` | Admin updates large-private customer flag | Admin | application, contract | Flag | `admin/service.ts` | Yes | Admin timeline | Partial (humanised token) | — | — |
| `INVOICE_OFFER_SENT` | Admin sends invoice offer | Admin | application, invoice, amount, expiry | Offer | `admin/service.ts` | Yes | Timeline + customer | Yes | — | Review-event mirror; `invoice_offer_sent` |
| `INVOICE_OFFER_ACCEPTANCE_SUBMITTED` / `RESUBMITTED` | Issuer acceptance docs | Issuer | application, invoice | Acceptance | `applications/service.ts` | Yes | Timeline + customer | Yes | OTP for accept is a separate SES + `offer_accept_otp_challenges` row | — |
| `INVOICE_ACCEPTANCE_APPROVED_FOR_SIGNING` | Admin approves invoice acceptance | Admin | application, invoice | Approval | `admin/service.ts` | Yes | Admin timeline | Yes | — | — |
| `INVOICE_OFFER_ACCEPTED` | Invoice offer accepted | Issuer | application, invoice | Acceptance | `applications/service.ts` | Yes | Timeline + customer | Yes | — | May complete application |
| `INVOICE_OFFER_REJECTED` | Issuer declines invoice offer (**live** writer) | Issuer | application, invoice | Decline | `applications/service.ts` | Yes | Timeline + customer “Invoice Offer Declined” | Admin CSV also says “Declined” | Do not confuse with historical facility `CONTRACT_OFFER_REJECTED` | Decline notification copy |
| `INVOICE_OFFER_RETRACTED` | Admin retracts invoice offer | Admin | application, invoice | Retract | `admin/service.ts` | Yes | Timeline + customer | Yes | — | `offer_retracted_or_reset` |
| `INVOICE_OFFER_EXPIRED` | Deadline job expires invoice offer | SYSTEM_JOB | application, invoice | Expiry | `acceptance-signing-expiry.ts` | Yes | Timeline + customer | Yes | — | `offer_expired` |
| `INVOICE_SIGNING_DEADLINE_EXTENDED` | Admin extends invoice signing deadline | Admin | application, invoice | Deadline | `admin/service.ts` | Yes | Timeline + customer | Yes | — | `invoice_signing_deadline_extended` |
| `INVOICE_WITHDRAWN` | Issuer withdraws an invoice from the application | Issuer | application, invoice | Withdrawal | `invoices/service.ts` | Yes | Timeline + customer | Yes | **No** dedicated notification type | — |
| `SIGNING_PACKAGE_CREATED` | Signing envelope created | Admin / system | application, envelope | Envelope id | `signing/service.ts` | Yes | Admin timeline | Yes | Not customer Activity | Envelope table is source of truth |
| `SIGNING_PACKAGE_SENT` | Signing links emailed | Admin / system | application, envelope | Recipients | `signing/service.ts` | Yes | Timeline + customer | Yes | Reminder send does **not** write a second Activity event | SES signing email (not typed notif) |
| `SIGNING_PACKAGE_COMPLETED` | Envelope completed | Webhook / signing service | application, envelope | Envelope | `signing/service.ts` | Yes | Timeline + customer | Yes | No typed notification | Legal / signed PDFs elsewhere |
| `SIGNING_PACKAGE_DECLINED` | Signer declined | Signer / webhook | application, envelope | Envelope | `signing/service.ts` | Yes | Timeline + customer | Yes | No typed notification | Distinct from VOIDED |
| `SIGNING_PACKAGE_EXPIRED` | Envelope `expires_at` elapsed | SYSTEM_JOB `signing-envelope-expiry` | application, envelope | Envelope | signing expiry job + signing service | Yes | Timeline + customer | Yes | Offer-phase expiry is a different event | `offer_expired` may also fire |
| `SIGNING_PACKAGE_VOIDED` | Admin voids package | Admin | application, envelope | Envelope | `signing/service.ts` | Yes | Admin timeline only | Yes | Not customer Activity; no notification | — |

**Acceptance document changes requested** is a **notification**, not a distinct application_log type (review item statuses carry the work).

---

## 5. Signing evidence that is not an Activity event

| Record | Cause | Actor | Refs | Recorded | Code | Store | Admin | Where | Ops wording | Gaps | Overlap |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Signer **Viewed** | Recipient opened signing link | Signer | envelope, recipient | `viewed_at` | `signing/service.ts` | `SigningRecipient` | Yes (status **Viewed**, not a timestamped Activity row) | Application Acceptance → Signing package | Partial — status only | Not in Activity timeline | Completing still writes `SIGNING_PACKAGE_*` |
| Signing reconcile job | Backfill missing signed PDFs / stale trust-return | SYSTEM_JOB `*/30` | envelope, documents | PDF store / session cleanup | `lib/jobs/signing-reconcile.ts` | Envelope / documents | Indirect | Documents on envelope | n/a | **No** new Activity event | Repair only |

---

## 6. Investment notes — marketplace, funding, servicing

Store: `note_events` (`lib/audit/note-events.ts`, `notes/service.ts` `logEvent` / `logAdminAction`). Admin Notes → Activity uses `formatNoteActivityEventLabel`. Customer Activity is a **small subset** (see note-log adapter).

`logAdminAction` also writes `note_admin_actions` (no Admin UI reader).

| Event | Cause | Actor | Refs | Recorded | Code | Admin | Where | Ops wording | Gaps | Overlap |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `NOTE_CREATED_FROM_INVOICE` | Note created from funded invoice | Admin / system | note, invoice, application | Note ref | `notes/service.ts` | Yes | Note Activity; issuer Activity “Note created” | Yes | — | — |
| `UPDATE_DRAFT` | Admin updates draft note | Admin | note | Draft fields | `notes/service.ts` | Yes | Note Activity “Draft updated” | Yes | **Not** in event catalogue | — |
| `UPDATE_FEATURED_SETTINGS` | Admin featured-note flags | Admin | note | Featured flags | `notes/service.ts` | Yes | “Featured settings updated” | Yes | Not in catalogue | — |
| `PUBLISH` | Publish to marketplace | Admin | note | Publish | `notes/service.ts` | Yes | Note + issuer Activity | Yes | — | `note_published` notif; dual `note_admin_actions` |
| `UNPUBLISH` | Unpublish from marketplace | Admin | note | Unpublish | `notes/service.ts` | Yes | “Unpublished from marketplace” | Yes | Not in catalogue | Prospectus invalidation events |
| `PAUSE_LISTING` / `RESUME_LISTING` | Pause or resume campaign | Admin | note | Listing state | `notes/service.ts` | Yes | Campaign paused/resumed; issuer Activity | Yes | No dedicated notifications | — |
| `CLOSE_FUNDING` | Funding closed (min met) | Admin or listing-expiry job | note | Funding | `notes/service.ts`; `lib/jobs/note-listing-expiry.ts` | Yes | “Funding Closed”; issuer Activity | Yes | — | `note_funding_succeeded` |
| `FAIL_FUNDING` | Listing fails min funding | Admin or expiry job | note | Failure | `notes/service.ts`; expiry job | Yes | “Funding unsuccessful”; issuer+investor Activity | Yes | — | Issuer + investor notifs |
| `INVESTMENT_COMMITTED` | Investor commits funds | Investor | note, investment, user | Amount | `notes/service.ts` | Yes | Note Activity; investor Activity | Yes | — | `investment_committed` (inbox only); wallet hold |
| `ACTIVATE` | Note activated after funding | Admin / system | note | Activation | `notes/service.ts` | Yes | Note + both portals | Yes | — | `note_active_issuer` + `note_active_investor` |
| `FACILITY_OCCUPANCY_UPDATED` | Note-layer occupancy | System | note, contract | Occupancy | `lib/refresh-contract-facility.ts` | Yes | Note Activity | Yes | Not customer note Activity | Application-layer twin |
| `ISSUER_PAYMENT_SUBMITTED` | Issuer submits repayment that **needs Admin review** | Issuer | note, payment | Payment | `notes/service.ts` `recordPayment` | Yes | Note Activity; issuer Activity | Yes (“Repayment Submitted”) | — | Mutually exclusive with `PAYMENT_RECEIVED` |
| `PAYMENT_RECEIVED` | Repayment recorded **without** Admin review | Issuer / system | note, payment | Payment | `notes/service.ts` `recordPayment` | Yes | “Repayment received” | Yes | **Not** in catalogue; **not** on customer note Activity adapter | Investor notif `note_payment_received` |
| `PAYMENT_APPROVED` | Admin approves repayment | Admin | note, payment | Approval | `notes/service.ts` | Yes | “Repayment approved” | Yes | No issuer “approved” notification | — |
| `PAYMENT_REJECTED` | Admin rejects repayment | Admin | note, payment | Reason | `notes/service.ts` | Yes | “Repayment Rejected” | Yes | — | `note_payment_rejected` (inbox only) |
| `SETTLEMENT_APPROVED` | Admin approves settlement | Admin | note, settlement | Approval | `notes/service.ts` | Yes | “Settlement approved” | Yes | Preview has **no** event | — |
| `SETTLEMENT_POSTED` | Settlement posted to ledgers | Admin / system | note, settlement | Posting | `notes/service.ts` | Yes | Note Activity; investor Activity | Yes | — | `note_settlement_posted`; excess late-charge notifs; trustee events |
| `LATE_CHARGE_APPROVED` | Admin approves late charge | Admin | note | Charge | `notes/service.ts` | Yes | Yes | Yes | — | — |
| `OVERDUE_LATE_CHARGE_CHECKED` | Servicing status actually changes (arrears path) | SYSTEM / servicing | note | New servicing status | `notes/service.ts` | Yes | “Overdue Late Charge Checked” | **Technical** | Written only when status changes | `note_arrears` / `note_arrears_investor` |
| `NOTE_DEFAULT_MARKED` | Note marked default | Admin | note | Default | `notes/service.ts` | Yes | “Note Defaulted”; both portals | Yes | — | default notifs |
| `ARREARS_LETTER_GENERATED` / `DEFAULT_LETTER_GENERATED` | Generated arrears/default letter | Admin | note, document | Letter / hash | `notes/service.ts` `generateNoteLetter` | Yes | Letter generated | Yes | Not in catalogue; hash also in `generated_document_evidence` | Generated-document evidence |
| `WAIVE_FACILITY_FEE_COLLECTION` | Admin waives collecting facility fee on the **note** | Admin | note | Waiver | `notes/service.ts` | Yes | “Facility Fee Collection Waived” | Yes | Distinct from `CONTRACT_FACILITY_FEE_WAIVED` | Not in catalogue |
| `ISSUER_DISBURSEMENT_WITHDRAWAL_CREATED` | Disbursement instruction created | Admin | note, withdrawal | Withdrawal | `notes/service.ts` | Yes | “Disbursement instruction created” | Yes | — | Follow-on trustee events |
| `WITHDRAWAL_LETTER_GENERATED` | Trustee letter generated | Admin | note, withdrawal | Letter; residual-return relabel | `notes/service.ts` | Yes | Withdrawal or residual-return label | Yes if metadata `withdrawalType` present | Residual vs disbursement depends on metadata | `generated_document_evidence` |
| `WITHDRAWAL_SUBMITTED_TO_TRUSTEE` | Instruction submitted to trustee | Admin | note, withdrawal | Submission | `notes/service.ts` | Yes | Yes | Yes | — | `withdrawal_submitted_to_trustee` (issuer and/or investor) |
| `WITHDRAWAL_BENEFICIARY_UPDATED` | Beneficiary changed | Admin | note, withdrawal | Beneficiary | `notes/service.ts` | Yes | Yes | Yes | — | — |
| `WITHDRAWAL_TRUSTEE_EMAIL_SENT` | Trustee email sent (or resend) | Admin / system | note, withdrawal | `resend` flag | `notes/service.ts` | Yes | Resend label if `resend=true` | Yes | SES to trustee, not user inbox | — |
| `WITHDRAWAL_COMPLETED` | Withdrawal / disbursement / residual completed | Admin | note, withdrawal | Completion | `notes/service.ts` | Yes | Residual-return relabel when type matches | Yes | Issuer disbursement notif `withdrawal_completed` is inbox-only | Ledger / wallet |
| `SETTLEMENT_TRUSTEE_LETTER_GENERATED` / `_SUBMITTED` / `INSTRUCTION_COMPLETED` / `SETTLEMENT_TRUSTEE_EMAIL_SENT` | Settlement trustee pack | Admin | note, settlement | Letter / email / `resend` | `notes/service.ts` | Yes | Technical but labelled | Partial | Trustee is email+PDF | Tests assert `SERVICE_FEE_TRUSTEE_*` is **not** written |
| `PAYMASTER_NOTICE_GENERATED` / `SENT` / `UPLOADED` / `ACKNOWLEDGEMENT_UPLOADED` / `CONFIRMED` | Paymaster assignment notice lifecycle | Admin | note, notice | Notice status | `paymaster/assignment-notice.service.ts` | Yes | Humanised | Partial | No typed user notification | — |
| `PROSPECTUS_REVIEW_CREATE` / `DRAFT_UPDATE` / `APPROVE` | Prospectus review workflow | Admin | note, prospectus | Review | `notes/prospectus-review/prospectus-review.service.ts` | Yes | Clear labels | Yes | No user notification | Dual `note_admin_actions` |
| `PROSPECTUS_APPROVAL_INVALIDATED_EDIT` / `_SOURCE` / `_UNPUBLISH` | Approval cleared | Admin / system | note | Reason | prospectus-review.service.ts | Yes | Clear labels | Yes | — | Follows edit/unpublish |
| `SHORAKA_ORDER_SUBMITTED` | Tawarruq order submitted | System / Admin | note, order | Order | `shoraka-stp/shoraka-stp-service.ts` | Yes | “Tawarruq Order Submitted” | Yes for Ops who know tawarruq | No user notification | `ShorakaTradeOrder` row |
| `SHORAKA_CERTIFICATE_FETCHED` | Certificate retrieved | System | note, order | Certificate | `shoraka-stp-service.ts` | Yes | “Tawarruq Certificate Retrieved” | Yes | — | — |

**Not written:** `SETTLEMENT_PREVIEWED` (preview computes only).

---

## 7. Products

| Event | Cause | Actor | Refs | Recorded | Code | Store | Admin | Where | Ops wording | Gaps | Overlap |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `PRODUCT_CREATED` | Admin creates product | Admin | product id, workflow snapshot | Config snapshot | `products/repository.ts` | `product_logs` | Yes | Audit → Products | Yes | Creating a product does **not** auto-send `new_product_alert` | — |
| `PRODUCT_UPDATED` | Admin updates / versions product | Admin | product | Snapshot | `products/repository.ts` | `product_logs` | Yes | Audit → Products | Yes | Further create-complete steps log UPDATED not CREATED | — |
| `PRODUCT_DELETED` | Admin deletes product | Admin | product | Snapshot | `products/repository.ts` | `product_logs` | Yes | Audit → Products | Yes | — | `setInactive` / `restoreProduct` are **unmounted** |

---

## 8. Payment gateway, deposits, refunds, receipts, recon

Parent row: `gateway_payments`. Timeline: `gateway_payment_events` via `recordGatewayPaymentEvent` (`payment/gateway-events.ts`). Admin: Finance → Gateway Payments → Activity Timeline.

Live Prisma types (catalogue names `CREATED` / `COMPLETED` / `FAILED` are **not** written):

| Event | Cause | Actor | Refs | Recorded | Code | Admin | Where | Ops wording | Gaps | Overlap |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `NAME_CHECK` | Deposit enters name-check | Webhook / deposit service | payment, org | from/to status | `payment/deposit-service.ts` | Yes | Gateway payment timeline | Yes | Not in named catalogue | — |
| `NAME_CHECK_APPROVED` | Admin approves name check | Admin | payment | Status transition | `payment/admin-service.ts` | Yes | Gateway timeline | Yes | — | May then complete deposit |
| `NAME_CHECK_REJECTED` | Admin rejects name check | Admin | payment | Status | `payment/admin-service.ts` | Yes | Gateway timeline | Yes | — | `deposit_name_check_rejected` |
| `GATEWAY_PAYMENT_COMPLETED` | Capture completed | Webhook | payment | Status | `payment/webhook-service.ts` | Yes | Gateway timeline | Yes | Application/onboarding fee also has Activity milestones | Application/org fee events |
| `CAPTURE_MISMATCH` | Capture amount mismatch | Webhook / amount-mismatch service | payment | Amounts | `payment/amount-mismatch-service.ts` | Yes | Gateway timeline | Yes | Ops must open amounts | Recon exceptions may also flag mismatches |
| `EXPIRED` | Stuck-order poller expires abandoned checkout | SYSTEM_JOB `*/15` | payment | Expiry | `lib/jobs/gateway-stuck-order-poller.ts` | Yes | Gateway timeline | Yes | — | — |
| `REFUND_INITIATED` | Refund started | Webhook / refund service | payment, refund | Refund | `payment/refund-service.ts` | Yes | Gateway timeline | Yes | — | `deposit_refund_initiated` |
| `REFUNDED` | Refund completed | Webhook / refund service | payment | Refund | `refund-service.ts` | Yes | Gateway timeline | Yes | — | `deposit_refunded` |
| `REFUND_WALLET_REVERSAL_FAILED` | Wallet reversal failed after refund | System | payment | Error metadata | `refund-service.ts` | Yes | Gateway timeline | Technical | Need metadata for why | Process `logger.error` may also fire |

| Record family | Cause | Actor | Store | Admin | Where | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `GatewayWebhookEvent` | Curlec webhook received | Curlec | `gateway_webhook_events` | No dedicated tab | Dedup/audit | Raw payload; **not** the business event |
| `GatewayOrderAttempt` | Checkout order attempts | User / gateway | `gateway_order_attempts` | Via payment detail | Attempt status | Complements payment row |
| `GatewayPaymentReceipt` | Receipt PDF generate/retry | Webhook / `gateway-receipt-retry` `*/10` | `gateway_payment_receipts` | Payment detail | Receipt file | Retry job does not write a new named Activity type |
| `GatewayReconRun` | Daily recon 18:00 UTC or Admin trigger | SYSTEM_JOB / Admin | `gateway_recon_runs` | Yes | Finance → Reconciliation | Run totals |
| `GatewayReconException` | Orphan / mismatch in recon | Job | `gateway_recon_exceptions` | Yes | Reconciliation | Admin can resolve with reason |

`OVERRIDE_PROPOSED` / `APPROVED` / `REJECTED` exist on the Prisma enum and are **not** written by `recordGatewayPaymentEvent`.

---

## 9. Wallet, ledger, investments (journal records)

These are money journals, not Activity event types. They are live and used.

| Record | Cause | Actor | Refs | Store | Admin | Where | Ops wording | Gaps |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `InvestorBalanceTransaction` | Deposit, invest, refund, investor cash withdrawal | Investor / webhook / Admin | org, amount, type | `investor_balance_transactions` | Yes | Investor org / Finance withdrawals / wallet views | Transaction types | Pair with gateway + note events |
| `NoteLedgerEntry` | Funding, repayment, settlement, fees, tawarruq, residual | System / Admin | note, account, amount | `note_ledger_entries` | Yes | Notes → Ledger | Account codes need Ops training | Not a labelled “log” |
| `ShorakaTradeOrder` | Tawarruq order state | System | note, order | `shoraka` trade order table | Yes | Note tawarruq UI | — | Events `SHORAKA_*` overlay |

---

## 10. Legal documents, acceptances, generated files

| Event / record | Cause | Actor | Refs | Store | Code | Admin | Where | Ops wording | Gaps | Overlap |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `LEGAL_DOCUMENT_CREATED` | Admin creates legal document | Admin | document | `legal_document_audit_logs` | `legal-documents/service.ts` | Yes | Audit → Legal Documents | Yes | Never Activity | — |
| `LEGAL_DOCUMENT_UPDATED` | Admin updates document metadata | Admin | document | same | same | Yes | same | Yes | — | — |
| `LEGAL_VERSION_UPLOADED` / `FILE_REPLACED` / `PUBLISHED` / `ARCHIVED` / `RESTORED` | Version lifecycle | Admin | document, version, hash | same | same | Yes | same | Yes | — | — |
| `LEGAL_DOCUMENT_ACCEPTANCE` | User accepts a published legal document | Issuer / Investor user | user, org, version, hash | `legal_document_acceptances` | legal acceptance-service | Yes | Audit → Legal Acceptances; org Acceptances | Status labels | Not Activity | T&C onboarding log is separate |
| `LEGAL_EXTERNAL_ACCEPTANCE` | External signer / guarantor acceptance | Signing webhook | envelope, application, org | `legal_external_acceptances` | external-acceptance-service | Yes | Audit → External Acceptances | Status labels | No FK cascade | Signing package events |
| `GENERATED_DOCUMENT_EVIDENCE` | Generated LO / letter persisted | Admin / system | template + output SHA-256, note/app | `generated_document_evidence` | `generated-documents/service.ts` | **No Audit tab** | Note Activity may show letter events | Hash is forensic | Ops cannot browse hashes in Audit | Letter `*_LETTER_GENERATED` events |

---

## 11. Notifications as logs

Delivery evidence for inbox/email is `notification_logs` (Admin Audit → Notifications). Inbox rows are `notifications`. See **Notifications Inventory** for types. Included here only as a store:

| Record | Cause | Actor | Store | Admin | Where |
| --- | --- | --- | --- | --- | --- |
| `NotificationLog` `source=SYSTEM` | Automatic typed send | System | `notification_logs` | Yes | Audit → Notifications |
| `NotificationLog` `source=ADMIN` | Settings → Notifications → Custom & Groups | Admin | `notification_logs` | Yes | same |

---

## 12. Review / admin mirrors (written, not shown as their own UI)

| Record | Cause | Store | Admin reader | Overlap |
| --- | --- | --- | --- | --- |
| `ApplicationReviewEvent` | Offer sent; amendments submitted (three Admin paths) | `application_review_events` | **None** (timeline uses `application_logs`) | Same event names as application logs |
| `ApplicationReviewRemark` | Reviewer remarks on items/sections | `application_review_remarks` | Application review UI (remarks), not Audit | Remark text also copied onto application_log `remark` |
| `NoteAdminAction` | Every `logAdminAction` | `note_admin_actions` | **None** (Notes Activity uses `note_events`) | Duplicate of admin note events |

---

## 13. Scheduled jobs that produce logs

All registered in `apps/api/src/lib/jobs/index.ts`.

| Job | Schedule | Logs / records it can produce |
| --- | --- | --- |
| Notification cleanup | 00:00 | Deletes expired inbox rows; process log only |
| CTOS KYB retry | `*/5` | Diagnostic; may cause later `SECTION_REVIEWED_PENDING` |
| Note listing expiry | hourly | `CLOSE_FUNDING` / `FAIL_FUNDING` + notifications |
| Signing envelope expiry | hourly | `SIGNING_PACKAGE_EXPIRED` |
| Acceptance/signing expiry | hourly | `CONTRACT_OFFER_EXPIRED` / `INVOICE_OFFER_EXPIRED`; notifs `offer_expired`, `offer_expiry_reminder_24h` |
| Gateway stuck-order poller | `*/15` | `EXPIRED` (and related payment events) |
| Gateway receipt retry | `*/10` | Receipt rows |
| Gateway settlement recon | 18:00 UTC | Recon run + exceptions |
| Application timeline repair | hourly `:20` | Missing `APPLICATION_CREATED` / `APPLICATION_SUBMITTED` with `source=INTERNAL` |
| Signing reconcile | `*/30` | PDF/session repair, no Activity event |

---

## 14. Process logs (not durable business events)

Useful for investigation; **not** Activity:

- `logger.error` in `initJobs` when a cron run throws
- Failed Curlec webhook persist / provider fetch warnings (`payment` webhook path)
- Failed `notification_logs` insert after send
- Failed SES (signing, trustee, invite, OTP)
- Failed S3 cleanup / receipt generation

These stay in CloudWatch / pino. There is no Ops Alerts queue.

---

## Active actions with no proper activity/audit log

Live UI/API actions that do **not** write a named Activity/audit event (or only a non-timeline row):

| Action | What exists instead | Why it is a gap |
| --- | --- | --- |
| User-initiated onboarding cancel | Explicitly **no** `onboarding_logs` (`auth/service.ts` `cancelOnboarding`) | Cannot see self-cancel on Activity |
| Signing **reminder** | SES only | No `SIGNING_PACKAGE_*` reminder event |
| Settlement **preview** | Computation only | Intentional; still no forensic row |
| Notification preference change | `user_notification_preferences` | No audit of who changed channels |
| CTOS KYB retry tick | Process log | No onboarding event per retry |
| Signing PDF reconcile | Envelope files | No Activity that PDFs were backfilled |
| Admin 2FA reset / forgot password | Cognito | Outside this app’s logs |
| Custom announcement send | `notification_logs` | Not an Activity event (acceptable for notifications) |

OTP for invoice-offer accept **does** persist `offer_accept_otp_challenges` and send SES; it is not an application Activity event.

---

## Excluded / dead / unreachable

Not in the main inventory as live writers:

| Item | Why excluded |
| --- | --- |
| `APPLICATION_APPROVED` | HISTORICAL_READER; no writer. Customer adapter still **labels** old rows. |
| `CONTRACT_OFFER_REJECTED` | HISTORICAL. Live facility decline is `CONTRACT_OFFER_DECLINED`. |
| `PRODUCT_INACTIVATED` / `PRODUCT_REACTIVATED` | `setInactive` / `restoreProduct` have **no non-test callers**. Controller deletes. |
| `ACCOUNT_LOCKED` | Catalogue LIVE; **tests only** — no production writer |
| `CREATED` / `COMPLETED` / `FAILED` on gateway catalogue | Stale names; Prisma uses `GATEWAY_PAYMENT_COMPLETED`, `EXPIRED`, etc. |
| `OVERRIDE_*` | Enum only; no `recordGatewayPaymentEvent` |
| `SETTLEMENT_PREVIEWED` | No live `logEvent` |
| `SERVICE_FEE_TRUSTEE_*` | Tests assert **not** written; live uses `SETTLEMENT_TRUSTEE_*` |
| `KYC_APPROVED` as `event_type` | Historical; live uses `ONBOARDING_STATUS_UPDATED` + metadata `trigger` |
| `TNC_ACCEPTED` | Live writer is `TNC_APPROVED` |
| `USER_COMPLETED` as writer | Auth **reads** historical rows; final access is `FINAL_APPROVAL_COMPLETED`. Dev webhook handler can still write it when that route is mounted. |
| `WEBHOOK_RECEIVED`, `WEBHOOK_PENDING_APPROVAL`, `WEBHOOK_LIVENESS_PASSED`, `WEBHOOK_FORM_FILLING`, `WEBHOOK_IN_PROGRESS` | Only `regtank/webhook-handler-dev.ts` (mounted when `NODE_ENV !== "production"` **or** `ENABLE_REGTANK_DEV_WEBHOOK`) |
| Ops Alerts | Removed (no table, API, job, or Admin UI) |
| Old UI aliases (`NOTE_CREATED`, `NOTE_PUBLISHED` as writers) | Labels for historical rows; live types are `NOTE_CREATED_FROM_INVOICE` / `PUBLISH` |

---

## Catalogue vs this inventory

`docs/logging-event-catalogue.md` lists catalogue classification. This inventory **adds** live writers missing from the catalogue (`PAYMENT_RECEIVED`, `UNPUBLISH`, `UPDATE_DRAFT`, `UPDATE_FEATURED_SETTINGS`, `WAIVE_FACILITY_FEE_COLLECTION`, letter events, gateway `NAME_CHECK*`, `REFUND_INITIATED`, `CAPTURE_MISMATCH`, `REFUND_WALLET_REVERSAL_FAILED`) and **drops** catalogue LIVE rows with no production writer (`ACCOUNT_LOCKED`, unused gateway names).

## Count snapshot (this inventory)

| Bucket | Count |
| --- | --- |
| Named live event types (application / onboarding / note / product / gateway / access / security / legal) | **156** |
| Related live record families (sessions, signer viewed, review mirrors, gateway raw/recon/receipts, ledgers, OTP, notification logs) | **14** |
| Overlapping write patterns (same fact in two stores) | **9** |
| Dead / unreachable / historical names excluded | **24** |
| Active actions with no proper Activity/audit event | **7** |

Process-only `logger.error` / CloudWatch lines are described in §14 and are **not** counted in the 156.

Notifications are counted in `docs/notifications-inventory.md`, not here.
