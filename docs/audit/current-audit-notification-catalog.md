# Current Audit + Notification Catalogue

**This is the single current-behavior reference.** Source code is authoritative. Do not use this file for planned wording, recommended copy, or historical counts.

Human-readable expansion of every live event and notification (one entry each): [`current-events-notifications-readable.md`](./current-events-notifications-readable.md). This file remains the technical source of truth.

Verified: **2026-08-27** against the working tree (writers, adapters, Admin panels, CSV/JSON export, PDF composer, notification registry, `seed-data.ts`).

| Question | This file |
|---|---|
| What is stored, labelled, exported, and notified **today**? | **Here** |
| What should a *new* surface call it? | [`activity-notification-copy-standard.md`](./activity-notification-copy-standard.md) (rules, not current copy) |
| What is still a product/compliance gap? | § Product/workflow decisions below, and [`audit-product-gap-review.md`](./audit-product-gap-review.md) |

Older files that previously claimed “current” lookup (`audit-event-surface-matrix.md`, `audit-event-catalog.md`, `current-event-journal.md`) are **superseded for current-behavior lookup**. They remain historical evidence.

### Counts (this catalogue)

| Store | Unique raw IDs listed | LIVE_* | UNREACHABLE | DEAD / HISTORICAL / SEED_ONLY / DEV_ONLY |
|---|---:|---:|---:|---:|
| `access_logs` | 13 | 4 | 3 | 6 |
| `security_logs` | 10 | 10 | 0 | 0 |
| `onboarding_logs` | 18 | 13 | 2 | 3 |
| `application_logs` | 45 | 43 | 0 | 2 |
| `note_events` (CSV map, aliases collapsed) | 44 | 44 | 0 | 0 |
| `legal_document_audit_logs` | 7 | 7 | 0 | 0 |
| `legal_document_acceptances` (status IDs) | 3 | 3 | 0 | 0 |
| `product_logs` | 5 | 3 | 2 | 0 |
| `gateway_payment_events` | 11 | 11 | 0 | 0 |
| `notification_logs` | batch store, not business event IDs | — | — | — |
| **Total event IDs** | **156** | **138** | **7** | **11** |
| Notification types (`seed-data.ts` = `NotificationTypeIds`) | 49 | 49 | 0 | 0 |

`notification_logs` rows are delivery batches (`ADMIN` / `SYSTEM`), not a second copy of the business event.

The application enum table below omits live Admin writer `CONTRACT_CUSTOMER_LARGE_PRIVATE_UPDATED` (`contract-section.tsx`). The readable expansion therefore lists **139** live event IDs. This table’s **138** is the enum-based count.

---

## Status vocabulary

| Status | Meaning |
|---|---|
| `LIVE_UI` | Mounted product UI reaches the writer |
| `LIVE_SYSTEM` | Cron / internal side-effect |
| `LIVE_WEBHOOK` | Provider/webhook |
| `LIVE_API_ONLY` | Route/service exists; no current mounted UI |
| `UNREACHABLE` | Writer exists; no current UI (and often no SDK) |
| `DEAD` | Declared; no production writer into this store |
| `HISTORICAL` | Old rows may exist; live flow writes a different ID |
| `SEED_ONLY` | Only fixtures/seed |
| `DEV_ONLY` | Dev webhook / non-prod handler |

---

## Confirmed current semantics

**Access**

- `SIGNUP` = first CashSouk user establishment (`classifyAccessAuthEvent`: new user and no successful SIGNUP yet).
- `LOGIN` = later real Cognito authentication (OAuth callback). Failed admin-portal access also writes `LOGIN` with `success: false`.
- `POST /v1/auth/sync-user` does **not** write `LOGIN` (upsert only).
- `LOGOUT` = Cognito logout route and `auth/service.ts` logout.
- `portal` = initiating frontend (`investor` / `issuer` / `admin`) or **null** if unknown. Never inferred from `user.roles[0]`. Not equal to role.
- LOGIN/SIGNUP metadata: `requestedRole`, `roles`, `portal`, `stateId`. **No fake `activeRole`.**
- `requestedRole` = OAuth routing persona requested. Not “active session role”.
- `stateId` = OAuth state trace id.

**Security**

- `EMAIL_VERIFIED`, `PASSWORD_CHANGED` live here (not `access_logs`).
- `ROLE_SWITCHED` display is metadata-driven: `Admin Deactivated` / `Admin Reactivated` / `Admin Role Changed` / fallback `Role Switched`. Raw ID stays `ROLE_SWITCHED`.
- There is **no** UI string `Admin Role Deleted`. Catalogue deletion is `ROLE_REMOVED` → display **Role Removed**.
- Finance settings: `PLATFORM_FINANCE_SETTINGS_UPDATED` → **Platform Finance Settings Updated**.

**Onboarding**

- `ONBOARDING_APPROVED` ≠ `FINAL_APPROVAL_COMPLETED`.
- Admin/CSV `FINAL_APPROVAL_COMPLETED` = `Final Approval Completed`. Portal Activity title = `Onboarding Approved`. Notification type `onboarding_completed` title = `Onboarding Completed`.
- `COD_REJECTED` Admin/CSV = `Onboarding Rejected`; portal title = `Onboarding Rejected`.
- `ONBOARDING_STATUS_UPDATED` stays generic (trigger in metadata). Do **not** invent `AML_APPROVED`/`KYC_APPROVED` from it. KYC success writes `ONBOARDING_STATUS_UPDATED` with `metadata.trigger: "KYC_APPROVED"`.
- `AML_APPROVED` is a declared event ID with a writer + hook, but **UNREACHABLE** from Admin UI (no `.tsx` caller). Live AML progression is `ONBOARDING_STATUS_UPDATED`. Do **not** invent `AML_APPROVED` from that status row. `SSM_APPROVED` is **LIVE_UI** (`onboarding-review-dialog.tsx`).
- `ONBOARDING_CANCELLED` stored ID is historical; Admin/CSV/portal display = **Onboarding Restarted**.

**Application**

- `AMENDMENTS_SUBMITTED` = Admin/CashSouk sent the amendment **request** batch. Display = **Amendment Request Sent**. Issuer resubmit of content = `APPLICATION_RESUBMITTED`.
- `CONTRACT_OFFER_ACCEPTED` = **Facility Offer Accepted**, not Signed.
- `SIGNING_PACKAGE_COMPLETED` = envelope completed (actual signing rollup). Admin-only on Activity feed (not in issuer `getEventTypes()`).
- `CONTRACT_OFFER_DECLINED` = **Facility Offer Declined**.
- `CONTRACT_OFFER_REJECTED` Admin/CSV = **Facility Offer Withdrawn**; issuer adapter title is **Facility Offer Declined** (same string as live decline). Live decline writer is `CONTRACT_OFFER_DECLINED`.

**Notes**

- `PAYMENT_RECEIVED` ≠ `PAYMENT_APPROVED`.
- `CLOSE_FUNDING` / `NOTE_FUNDING_CLOSED` Admin CSV = **Funding Closed**.
- `FAIL_FUNDING` Admin CSV = `Funding unsuccessful`. Portal Activity = `Funding Unsuccessful`.
- `WITHDRAWAL_COMPLETED` Admin CSV = `Withdrawal Completed`. Issuer Activity + notification `withdrawal_completed` = `Your Disbursement Is Complete`. Investor Activity for the same raw ID = `Your Investment Is Active` (same title as `ACTIVATE` for investors).
- `SHORAKA_*` raw IDs stay `SHORAKA_*`; Admin CSV rewrites “Shoraka” → **Tawarruq**.

**Legal**

- Document Created ≠ Version Uploaded. v1 upload is its own row. Auto-archive reason stays `reason` metadata. Raw `LEGAL_*` IDs remain in Event Type.

**Products**

- Live: `PRODUCT_CREATED` / `PRODUCT_UPDATED` / `PRODUCT_DELETED`.
- Product Name = `metadata.workflow[0].config.name`, fallback `config.type.name`. Table, detail, CSV, JSON, and search use that path. No live-product join for export.
- `PRODUCT_INACTIVATED` / `PRODUCT_REACTIVATED` writers exist with **zero callers** → **UNREACHABLE**.

---

## UI surfaces (current)

### Audit tabs (`apps/admin/src/app/audit/page.tsx`)

| Tab | Permission | Search placeholder (exact) | Filters | Export |
|---|---|---|---|---|
| Access | `audit.access.view` | `Search by user name, email, or User ID...` | Event (allowlist `ACCESS_EVENT_TYPES`; filter chips use the shared toolbar union labels, e.g. `Role added`, `Profile updated`), status, date range | CSV + JSON |
| Security | `audit.security.view` | `Search by user name, email, or User ID...` | Event (`SECURITY_EVENT_TYPES`; chips include `Password changed`, `Role switched`, `Platform finance settings updated`), date range | CSV + JSON |
| Products | `audit.product.view` | `Search by product name, actor, email, or product ID...` | Event, date range | CSV + JSON |
| Legal Documents | `document_management.view` | `Search by actor, document type, or document ID...` | Action, document type, dates | CSV + JSON |
| Legal Acceptances | `document_management.view` | `Search by user, email, organisation, or document...` | Type, audience, status, dates | CSV + JSON |
| Notifications | `notifications.view` | `Search by title, message, type, or admin...` | Type, audience, source | CSV only (client-side) |

Detail drawer titles: Access/Security/Products/Legal/Notes/Applications = **`Event details`**. Notifications = **`Notification details`**. Legal acceptances use a dedicated sheet (event label from status).

Technical Details (typical audit drawer): Event type, Actor ID, Source, Portal, Correlation ID, IP, device/UA, plus store-specific IDs. Secrets in metadata are redacted (`[REDACTED]`).

### Embedded activity / history

| Surface | Store | CSV | JSON |
|---|---|---|---|
| Organisation Activity | `onboarding_logs` | Yes (org-scoped) + global `/onboarding-logs/export` | Global JSON |
| Application timeline | `application_logs` | Yes (`getEventLabel`) | No |
| Application summary PDF | `application_logs` | n/a | PDF wording below |
| Facility / contract activity | `application_logs` (contract-scoped) | Yes (`contract-activity-csv.ts`) | No |
| Note Activity | `note_events` | Yes (uncapped export) | No |
| Gateway payment detail | `gateway_payment_events` | Yes | No |
| Wallet | `investor_balance_transactions` | **None** | No |
| Signing envelope panel | `signing_envelopes` / documents / assignments | No dedicated export; signing *events* on application CSV | No |
| Investor/Issuer withdrawals | canonical `withdrawal_instructions` | No dedicated audit CSV | No |

List search placeholders (not Audit tabs): Applications `Search by reference, ID, or organisation...`; Notes `Search by title, reference, application, issuer, or paymaster...`; Gateway list `Search by reference, organisation, purpose, or amount…`.

---

## Common forensic fields

Most audit writers also persist (when the call site supplies context): `actor_type`, `source`, `target_type`, `target_id`, `portal`, `correlation_id`, `ip_address`, `user_agent`. CSV core columns: Timestamp, Event, Event Type, Actor, Actor Type, Actor Email, Organisation, Source, Target Type, Target Reference, Status, Amount, Reason, Correlation ID, Metadata (redacted). Extra columns are store-specific.

Metadata keys below are **observed in writers**, not theoretical.

---

## 1. `access_logs`

**UI:** Audit → Access. Table Event from `EVENT_TYPE_CONFIG` + Access override `PROFILE_UPDATED` = `User Profile Updated`. CSV Event uses `ACCESS_LOG_CSV_EVENT_LABELS` + humanize. JSON: raw `event_type`, `user_id`, `portal`, redacted metadata. Extra CSV: User ID, Portal, IP Address, Device (`device_info`), User Agent.

| Raw Event ID | Display Label (Admin table / CSV Event) | Exact Meaning | Trigger/Actor | Important Metadata | Canonical Evidence | UI Surface | Export | Notification | Status |
|---|---|---|---|---|---|---|---|---|---|
| `LOGIN` | Login / Login | Later Cognito auth, or failed admin access | OAuth callback / failed admin gate; User | `requestedRole`, `roles`, `portal`, `stateId`; fail path also `userRoles`, `hasAdminRole`, `adminStatus`, `wasPreviouslyAdmin`, `reason` | this row | Access table/detail | CSV Event+Type; JSON `event_type` | none | LIVE_UI |
| `SIGNUP` | Sign Up / Sign Up | First CashSouk user establishment | Same OAuth callback when new user and no successful SIGNUP | same success metadata as LOGIN | this row | Access | CSV+JSON | none | LIVE_UI |
| `LOGOUT` | Logout / Logout | Logout | Cognito logout + `auth/service` logout; User | Cognito path: `roles`, `portal`. Service logout may include session `activeRole` (observed `req.activeRole`, not invented on LOGIN) | this row | Access | CSV+JSON | none | LIVE_UI |
| `PROFILE_UPDATED` | User Profile Updated / User Profile Updated | Admin edits another user’s name/phone | Admin `updateUserProfile` | `targetUserId`, `updatedFields`, `previousValues`, `nameLockedOverride` | this row | Access | CSV+JSON | none | LIVE_UI |
| `ROLE_ADDED` | Role Added | Fallback of `updateUserRoles` when ADMIN is not being stripped — **not** “a role was added” | Route `PATCH /users/:id/roles`; hook exists; **no `.tsx` caller** | `targetUserId`, `targetUserEmail`, `newRoles`, `previousRoles`, `adminRoleRemoved` | this row if invoked | Access filter can show stored rows | CSV+JSON | none | UNREACHABLE |
| `ROLE_REMOVED` | Role Removed | `updateUserRoles` only when ADMIN was present and is now absent | Same as ROLE_ADDED | same | this row if invoked | Access | CSV+JSON | none | UNREACHABLE |
| `ONBOARDING_RESET` | Onboarding Reset (humanize) | Temporary reset of onboarded flag | `POST /users/:id/reset-onboarding`; no SDK/UI | `targetUserId`, `portal` | this row if invoked | Access allowlist | CSV+JSON | none | UNREACHABLE |
| `ROLE_SWITCHED` | — | Not written here | — | — | `security_logs` | — | — | — | DEAD (this store) |
| `PASSWORD_CHANGED` / `EMAIL_VERIFIED` | — | Not written here | — | — | `security_logs` | — | — | — | DEAD (this store) |
| `KYC_STATUS_UPDATED` | Table map `KYC Updated`; toolbar union `KYC status updated` | No production writer into `access_logs` | — | — | — | Shared toolbar union includes it; Access `ACCESS_EVENT_TYPES` **excludes** it so it is not selectable/queried | — | — | SEED_ONLY / DEAD |
| `ONBOARDING` / `ONBOARDING_STATUS_UPDATED` | — | Not written to access_logs | — | — | `onboarding_logs` | — | — | — | DEAD (this store) |

---

## 2. `security_logs`

**UI:** Audit → Security (same table component). `PROFILE_UPDATED` table = **Profile Updated** (not the Access override). CSV: friendly Event (ROLE_SWITCHED via `formatRoleSwitchedLabel`) + raw Event Type. Extra: User ID, **Portal**, IP, Device, Previous/New Values. JSON includes `portal`, `user_id`, redacted metadata.

| Raw Event ID | Display Label | Exact Meaning | Trigger/Actor | Important Metadata | Canonical Evidence | UI / Export | Notification | Status |
|---|---|---|---|---|---|---|---|---|
| `PASSWORD_CHANGED` | Password Changed | Password change success or fail | User `changePassword` | `reason`, `sessionRevoked`, `success?`, `error?` | this row | Security CSV/JSON | `password_changed` on **success** | LIVE_UI |
| `EMAIL_VERIFIED` | Email Verified | Email verify success/fail | User `verifyEmail` | `email`, `reason`, `success?` | this row | Security | none | LIVE_UI |
| `ROLE_ADDED` | Role Added | User adds own portal role; or admin invitation accepted | User `addRole`; invitee `acceptAdminInvitation` | `addedRole`, `allRoles`; invitation: `invitationToken`, `invitationType` | this row | Security | none | LIVE_UI |
| `ROLE_SWITCHED` | Admin Deactivated / Admin Reactivated / Admin Role Changed / Role Switched | Mid-session switch **or** admin deactivate/reactivate/role description change | User `switchRole`; Admin `updateUserRoles` / `updateAdminRole` / `deactivateAdmin` / `reactivateAdmin` | `newRole`; or `action` (`DEACTIVATED`, `DEACTIVATED_VIA_ROLE_REMOVAL`, `REACTIVATED`, `ACTIVATED_VIA_ROLE_ADDITION`); or `previousRole`+`newRole` | this row | Security | none | LIVE_UI |
| `ROLE_CREATED` | Role Created | Admin role catalogue create | Admin settings | `roleKey`, `roleName`, `badgeColor` | this row | Security | none | LIVE_UI |
| `ROLE_PERMISSIONS_UPDATED` | Role Permissions Updated | Admin role permission edit | Admin settings | `roleKey`, `previousPermissions`, `nextPermissions` | this row | Security | none | LIVE_UI |
| `ROLE_REMOVED` | Role Removed | **Admin role catalogue delete**, not a user’s portal role | Admin settings | `deletedRoleKey`, `deletedRoleName` | this row | Security | none | LIVE_UI |
| `INVITATION_REVOKED` | Invitation Revoked | Admin revokes invitation | Settings → Roles (`useRevokeInvitation`) | `invitationId`, `email`, `roleDescription` | this row | Security | none | LIVE_UI |
| `PROFILE_UPDATED` | Profile Updated | Self-service or admin-override profile edit | User/admin profile | `updatedFields`, `previousValues`, `adminOverride?` | this row | Security | none | LIVE_UI |
| `PLATFORM_FINANCE_SETTINGS_UPDATED` | Platform Finance Settings Updated | Admin finance settings save | Admin notes finance settings | before/after in metadata | this row | Security | none | LIVE_UI |

---

## 3. `onboarding_logs`

**Admin org timeline labels** (`organization-activity-timeline.tsx` `getEventLabel`) match **CSV** `ONBOARDING_LOG_CSV_EVENT_LABELS`. Global CSV Organisation = `organizationName`. JSON: `organization_name`, redacted metadata.

Portal Activity allowlist (`organization-log.ts` `getEventTypes`): `ONBOARDING_STARTED`, `ONBOARDING_CANCELLED`, `ONBOARDING_REJECTED`, `COD_REJECTED`, `FINAL_APPROVAL_COMPLETED`, `ONBOARDING_APPROVED` only.

| Raw Event ID | Admin / CSV Event | Portal title / description (if listed) | Meaning | Trigger | Metadata (observed) | Notification | Status |
|---|---|---|---|---|---|---|---|
| `ONBOARDING_STARTED` | Onboarding Started | Onboarding Started / continue at any time | Start personal/corporate | Applicant + RegTank start | `organizationId`, `requestId`, `onboardingType`, `previousOrgStatus` | none | LIVE_UI |
| `ONBOARDING_RESUMED` | Onboarding Resumed | (not in portal allowlist; humanize if shown) | Resume / new request id | Applicant + auto-regen | `organizationId`, `previousRequestId`, `newRequestId`, `trigger` | none | LIVE_UI / LIVE_SYSTEM |
| `ONBOARDING_CANCELLED` | Onboarding Restarted | Onboarding Restarted / previous request cancelled, new started | Admin restart | Admin | `cancelledOnboardingId`, `previousStatus`, `cancelledBy`, `reason` | none | LIVE_UI |
| `ONBOARDING_REJECTED` | Onboarding Rejected | Onboarding Rejected + optional reason | Individual rejection | LIVE_WEBHOOK | `previousStatus`, `newStatus`, `trigger` | `onboarding_rejected` when that path notifies | LIVE_WEBHOOK |
| `COD_REJECTED` | Onboarding Rejected | Onboarding Rejected / organization onboarding was rejected | Corporate data rejection | LIVE_WEBHOOK `cod-handler` | COD/request fields | `onboarding_rejected` if that path notifies | LIVE_WEBHOOK |
| `ONBOARDING_APPROVED` | Onboarding Approved | **Onboarding Submission Approved** / we'll notify when fully complete | Intermediate submission approval | Admin/webhook | status/trigger | **not** `onboarding_completed` | LIVE_UI / LIVE_WEBHOOK |
| `FINAL_APPROVAL_COMPLETED` | Final Approval Completed | **Onboarding Approved** / no further action needed | Full platform access | Admin final approve | org/status | **`onboarding_completed`** title `Onboarding Completed` | LIVE_UI |
| `ONBOARDING_STATUS_UPDATED` | Onboarding Status Updated | not in portal allowlist | Generic status/trigger | Webhooks + Admin portal-access toggle | `trigger` (e.g. `KYC_APPROVED`), `previousStatus`, `newStatus` | none (do not treat as AML/KYC event ID) | LIVE_UI / LIVE_WEBHOOK |
| `FORM_FILLED` | Form Submitted | not in portal allowlist | Form section submitted | LIVE_WEBHOOK / RegTank service | `section` (do not expand FORM_FILLED metadata here) | none | LIVE_WEBHOOK |
| `AML_APPROVED` | AML Approved | not in portal allowlist | Dedicated event ID for manual Admin AML override | Writer `admin/service.ts`; hook `useApproveAmlScreening`; **no `.tsx` caller** (`use-onboarding-applications.aml-unreachable.test.ts`). Live AML progression is `ONBOARDING_STATUS_UPDATED` (do not invent an `AML_APPROVED` row from that) | screening/org ids if invoked | none | UNREACHABLE |
| `SSM_APPROVED` | SSM Approved | not in portal allowlist | Admin SSM verify approve | Admin `approveSsmVerification` | org/SSM ids | none | LIVE_UI |
| `TNC_APPROVED` | T&C Approved | not in portal allowlist | User accepted legal T&C in onboarding | `organization/service` accept T&C | document/version ids | none (acceptance evidence is `legal_document_acceptances`) | LIVE_UI |
| `SOPHISTICATED_STATUS_UPDATED` | Sophisticated Status Updated | not in portal allowlist | Sophisticated investor flag | Admin | `action` granted/revoked, `newReason` | none | LIVE_UI |
| `PROFILE_UPDATED` | Organization Profile Updated | not in portal allowlist | Admin org profile edit | Admin | `updatedBy`, top-level `updatedFields`, `bankFieldsChanged`, identity `previousValues` (no `nextValues`; bank/corporate JSON not snapshotted) | none | LIVE_UI |
| `ONBOARDING_RESET` | Onboarding Reset | — | Same unreachable reset as access; **not** in org-timeline query allowlist | Route-only | `resetBy`, `previousStatus`, `newStatus` | none | UNREACHABLE |
| `TNC_ACCEPTED` / `KYC_APPROVED` | CSV/Admin labels exist; **not** in org query | not queried | No production writer as `event_type` (`TNC_APPROVED` and `ONBOARDING_STATUS_UPDATED` + `trigger:"KYC_APPROVED"` are live instead) | — | — | — | DEAD |
| `USER_COMPLETED` | User Completed (CSV/Admin label) | not in org query | Replaced by `FINAL_APPROVAL_COMPLETED`. Remaining writer: `regtank/webhook-handler-dev.ts` | Dev webhook | — | none | DEV_ONLY |

---

## 4. `application_logs`

**Admin timeline + application CSV** share `getEventLabel` in `admin-activity-timeline.tsx`. **Facility CSV** uses `contract-activity-csv.ts` (same meanings; some signing strings are sentence-case). **Issuer Activity** = `application-log.ts` titles below (allowlist `getEventTypes()`). **Issuer application page timeline** = `application-timeline.ts`. **PDF** = `compose-application-summary.ts` `EVENT_LABELS` (issuer voice).

Section/item review events are **Admin-only** (not in issuer `getEventTypes()`).

| Raw Event ID | Admin / app CSV | Issuer Activity title | PDF (if present) | Meaning | Notification | Status |
|---|---|---|---|---|---|---|
| `APPLICATION_CREATED` | Application Created | Application Started | Application started | Draft created | none | LIVE_UI |
| `APPLICATION_SUBMITTED` | Application Submitted | Application Submitted | You submitted this application | First submit | `application_submitted_confirmation` title `Application Submitted` | LIVE_UI |
| `APPLICATION_RESUBMITTED` | Application Resubmitted | Application Resubmitted | You resubmitted after changes | Issuer submitted updated content | `application_resubmitted_confirmation` | LIVE_UI |
| `AMENDMENTS_SUBMITTED` | Amendment Request Sent | Amendment Request Sent | Amendment Request Sent | **CashSouk sent amendment request batch** | `application_amendments_requested` catalogue `Application Amendments Requested`, title `Amendment Requested` | LIVE_UI |
| `APPLICATION_APPROVED` | Application Approved | Application Approved | Application approved | Declared; labels/allowlist exist; **no production writer** | none | DEAD |
| `APPLICATION_REJECTED` | Application Rejected | Application Rejected | Application was not approved | Rejected | `application_rejected` | LIVE_UI |
| `APPLICATION_WITHDRAWN` | Application Withdrawn | Application Withdrawn | You withdrew this application | Withdrawn | `application_withdrawn_confirmation` (title varies if decline reason) | LIVE_UI |
| `APPLICATION_COMPLETED` | Application Completed | Application Completed | Application completed | Completed | `application_completed` | LIVE_UI |
| `APPLICATION_RESET_TO_UNDER_REVIEW` | Application Returned to Review | (not in issuer allowlist) | Back under review | Returned to review | none | LIVE_UI |
| `CONTRACT_OFFER_SENT` | Facility Offer Sent | You Received a Facility Offer | Facility financing offer sent | Offer sent | `contract_offer_sent` catalogue **Facility Offer Sent**, title **Facility Offer Received** | LIVE_UI |
| `CONTRACT_OFFER_ACCEPTANCE_SUBMITTED` | Facility Offer Acceptance Submitted | You Submitted Your Facility Offer Acceptance | — | Step 1 docs submitted | none | LIVE_UI |
| `CONTRACT_OFFER_ACCEPTANCE_RESUBMITTED` | Facility Offer Acceptance Resubmitted | You Resubmitted Your Facility Offer Acceptance | — | Docs resubmitted | none | LIVE_UI |
| `CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING` | Facility Acceptance Approved for Signing | **Admin-only** (not issuer allowlist) | — | Unlock signing | none | LIVE_UI |
| `CONTRACT_OFFER_ACCEPTED` | Facility Offer Accepted | Facility Offer Accepted | You accepted the facility offer | Offer accepted (**not signed**) | none | LIVE_UI |
| `CONTRACT_OFFER_DECLINED` | Facility Offer Declined | Facility Offer Declined | Facility offer declined | Issuer declined | `application_withdrawn_confirmation` title `Facility Offer Declined` when reason is decline | LIVE_UI |
| `CONTRACT_OFFER_REJECTED` | Facility Offer Withdrawn | Facility Offer Declined | You declined the facility offer | Historical ID; Admin meaning = withdrawn | none | HISTORICAL |
| `CONTRACT_OFFER_RETRACTED` | Facility Offer Retracted | CashSouk Retracted the Facility Offer | Facility offer was withdrawn by CashSouk | Retract | `offer_retracted_or_reset` title `Offer Updated` | LIVE_UI |
| `CONTRACT_OFFER_EXPIRED` | Facility Offer Expired | Facility Offer Expired | An offer expired (`OFFER_EXPIRED` PDF key) | Expiry job | `offer_expired` | LIVE_SYSTEM |
| `CONTRACT_SIGNING_DEADLINE_EXTENDED` | Signing Deadline Extended | Signing Deadline Extended | — | Admin restamp | `contract_signing_deadline_extended` title `Signing Deadline Extended` | LIVE_UI |
| `CONTRACT_FACILITY_OCCUPANCY_UPDATED` | Facility Occupancy Updated | Facility occupancy updated | — | Occupancy change | none | LIVE_SYSTEM |
| `CONTRACT_FACILITY_FEE_WAIVED` | Facility Fee Waived | (not issuer allowlist) | — | Fee waived | none | LIVE_UI |
| `CONTRACT_FACILITY_DISABLED` | Facility Disabled | (not issuer allowlist) | — | Disabled | `facility_disabled` | LIVE_UI |
| `CONTRACT_FACILITY_ENABLED` | Facility Enabled | (not issuer allowlist) | — | Enabled | none | LIVE_UI |
| `INVOICE_OFFER_SENT` | Invoice Offer Sent (or `Invoice {n} Offer Sent`) | You Received an Invoice Offer | Invoice financing offer sent | Invoice offer | `invoice_offer_sent` title `Invoice Offer Received` | LIVE_UI |
| `INVOICE_OFFER_ACCEPTANCE_SUBMITTED` | Invoice Offer Acceptance Submitted (or `Invoice {n} Acceptance Submitted`) | You Submitted Your Invoice Offer Acceptance | — | Step 1 docs submitted | none | LIVE_UI |
| `INVOICE_OFFER_ACCEPTANCE_RESUBMITTED` | Invoice Offer Acceptance Resubmitted | You Resubmitted Your Invoice Offer Acceptance | — | Docs resubmitted | none | LIVE_UI |
| `INVOICE_ACCEPTANCE_APPROVED_FOR_SIGNING` | Invoice Acceptance Approved for Signing | **Admin-only** (not issuer allowlist) | — | Unlock signing | none | LIVE_UI |
| `INVOICE_OFFER_ACCEPTED` | Invoice Offer Accepted | Invoice Offer Accepted | You accepted an invoice offer | Accepted | none | LIVE_UI |
| `INVOICE_OFFER_REJECTED` | Invoice Offer Declined | Invoice Offer Declined | You declined an invoice offer | Live decline writer (there is **no** `INVOICE_OFFER_DECLINED` ID) | `application_withdrawn_confirmation` title `Invoice Offer Declined` when reason is decline | LIVE_UI |
| `INVOICE_OFFER_RETRACTED` | Invoice Offer Retracted | CashSouk Retracted the Invoice Offer | Invoice offer was withdrawn by CashSouk | Retract | `offer_retracted_or_reset` | LIVE_UI |
| `INVOICE_OFFER_EXPIRED` | Invoice Offer Expired | Invoice Offer Expired | — | Expiry | `offer_expired` | LIVE_SYSTEM |
| `INVOICE_SIGNING_DEADLINE_EXTENDED` | Signing Deadline Extended | Signing Deadline Extended | — | Admin restamp | `invoice_signing_deadline_extended` | LIVE_UI |
| `INVOICE_WITHDRAWN` | Invoice Withdrawn | Invoice Withdrawn | Invoice withdrawn | Invoice withdrawn | none | LIVE_UI |
| `SIGNING_PACKAGE_CREATED` | Signing Package Created | not in issuer allowlist | — | Package created | none | LIVE_UI |
| `SIGNING_PACKAGE_SENT` | Signing package sent | Signing package sent | — | Sent to signers | none | LIVE_UI |
| `SIGNING_PACKAGE_COMPLETED` | Signing Package Completed | **not in issuer `getEventTypes()`** | — | Envelope COMPLETED | none | LIVE_UI (Admin) |
| `SIGNING_PACKAGE_VOIDED` | Signing package voided | not in issuer allowlist | — | Voided | none | LIVE_UI |
| `SECTION_REVIEWED_APPROVED` | Section Approved | not in issuer allowlist | (not on PDF) | Section approved | none | LIVE_UI |
| `SECTION_REVIEWED_REJECTED` | Section Rejected | not in issuer allowlist | A section was not approved | Section rejected | none | LIVE_UI |
| `SECTION_REVIEWED_AMENDMENT_REQUESTED` | Section Amendment Requested | not in issuer allowlist | Changes requested on a section | Section amendment | `acceptance_document_changes_requested` (once per cycle, post-offer docs) | LIVE_UI |
| `SECTION_REVIEWED_PENDING` | Section Reset to Pending | not in issuer allowlist | — | Reset including CTOS (`ctos-report-service.ts`) | none | LIVE_UI / LIVE_SYSTEM |
| `ITEM_REVIEWED_APPROVED` | Approved | not in issuer allowlist | (not on PDF) | Item approved | none | LIVE_UI |
| `ITEM_REVIEWED_REJECTED` | Rejected | not in issuer allowlist | An item was not approved | Item rejected | none | LIVE_UI |
| `ITEM_REVIEWED_AMENDMENT_REQUESTED` | Amendment Requested | not in issuer allowlist | Changes requested on an item | Item amendment | `acceptance_document_changes_requested` (once per cycle) | LIVE_UI |
| `ITEM_REVIEWED_PENDING` | Reset to Pending | not in issuer allowlist | — | Item reset via `ITEM_REVIEWED_${newStatus}` | none | LIVE_UI |

Acceptance submitted metadata (writer contract): `contract_id`/`invoice_id`, `submitted_at`, `offer_acceptance_status`. Canonical offer PDFs/hashes: `signing_documents`.

---

## 5. `note_events`

**Admin CSV** = `formatNoteActivityEventLabel` (Received vs Approved kept distinct). **Issuer/Investor Activity** only the allowlisted IDs in `note-log.ts`. Many Admin forensic events have **no** portal Activity row — that is intentional; canonical proof is the business table.

Portal allowlist:

| Raw Event ID | Admin CSV Event | Portal title | Meaning | Notification | Status |
|---|---|---|---|---|---|
| `NOTE_CREATED_FROM_INVOICE` | Note created | Note Created | Note spawned from invoice | none | LIVE_UI (issuer) |
| `PUBLISH` / `NOTE_PUBLISHED` | Note Published | Note Published | Listed | `note_published` title `Note published` | LIVE_UI |
| `PAUSE_LISTING` | Campaign paused | Campaign Paused | Pause | none | LIVE_UI |
| `RESUME_LISTING` | Campaign resumed | Campaign Resumed | Resume | none | LIVE_UI |
| `CLOSE_FUNDING` / `NOTE_FUNDING_CLOSED` | Funding Closed | Funding Closed | Min met, funding closed | `note_funding_succeeded` title `Funding closed successfully` | LIVE_UI / LIVE_SYSTEM |
| `FAIL_FUNDING` | Funding unsuccessful | Funding Unsuccessful | Min not met | `note_funding_failed_issuer` / `_investor` catalogue **Funding Unsuccessful**; titles `Note funding did not complete` / `Commitment released` | LIVE_SYSTEM |
| `ACTIVATE` / `NOTE_ACTIVATED` | Note Activated | Your Note Is Active / Your Investment Is Active | Note active | `note_active_issuer` / `note_active_investor` | LIVE_UI / LIVE_SYSTEM |
| `WITHDRAWAL_COMPLETED` | Withdrawal Completed | Issuer: `Your Disbursement Is Complete`. Investor: `Your Investment Is Active` | Trustee payout completed | `withdrawal_completed` title `Your Disbursement Is Complete` (issuer only) | LIVE_UI |
| `ISSUER_PAYMENT_SUBMITTED` | Repayment Submitted | You Submitted a Repayment | Issuer submitted repayment | none | LIVE_UI |
| `INVESTMENT_COMMITTED` | Investment committed | Investment Committed | Investor commit | `investment_committed` | LIVE_UI |
| `SETTLEMENT_POSTED` | Settlement posted | Settlement Posted | Settlement posted | `note_settlement_posted` | LIVE_UI |
| `NOTE_DEFAULT_MARKED` | Note Defaulted | Your Note/Investment Is in Default | Default marked | `note_defaulted` / `note_defaulted_investor` | LIVE_UI |

**Admin forensic (not portal Activity)** — CSV labels exact from `note-activity-csv.ts`: Draft updated; Featured settings updated; Unpublished from marketplace; Prospectus approved / review created / draft updated / approval cleared after edit|source change|unpublish; Repayment received (`PAYMENT_RECEIVED` / `PAYMENT_RECORDED`); Repayment approved (`PAYMENT_APPROVED`); Repayment Rejected; Settlement previewed / approved; Late charge approved; Overdue Late Charge Checked; Arrears/Default/Settlement Trustee letters and emails; Withdrawal Trustee Email Sent / Redelivered; Facility Fee Collection Waived; Disbursement instruction created; Withdrawal letter generated; Withdrawal Submitted to Trustee; Withdrawal beneficiary updated; Facility occupancy updated; **Tawarruq Order Submitted** (`SHORAKA_ORDER_SUBMITTED`); **Tawarruq Certificate Retrieved** (`SHORAKA_CERTIFICATE_FETCHED`).

`PAYMENT_RECEIVED` amount/date/reviewer: **canonical `note_payments`**. Event may only carry `paymentId`. No duplicate audit row required.

`WITHDRAWAL_SUBMITTED_TO_TRUSTEE` notification title `Withdrawal Submitted to Trustee` (issuer and/or investor by `portalType`).

---

## 6. `legal_document_audit_logs`

| Raw Event ID | Admin table / CSV Event | Meaning | Trigger | Evidence | Status |
|---|---|---|---|---|---|
| `LEGAL_DOCUMENT_CREATED` | Document Created | Definition created | Admin | document type, before/after JSON | LIVE_UI |
| `LEGAL_DOCUMENT_UPDATED` | Document Updated | Definition updated | Admin | before/after | LIVE_UI |
| `LEGAL_VERSION_UPLOADED` | Version Uploaded | Version file uploaded (incl. v1) | Admin | version id, number, hash, file_name | LIVE_UI |
| `LEGAL_VERSION_FILE_REPLACED` | Version File Replaced | File replaced | Admin | hash | LIVE_UI |
| `LEGAL_VERSION_PUBLISHED` | Version Published | Published | Admin | may archive previous (`reason` e.g. auto archive) | LIVE_UI |
| `LEGAL_VERSION_ARCHIVED` | Version Archived | Archived | Admin / auto on publish | `reason` metadata only | LIVE_UI |
| `LEGAL_VERSION_RESTORED` | Version Restored | Restored | Admin | version id | LIVE_UI |

CSV extra: Document (friendly type label), Audit ID, Version ID, Version Number, Document Hash, Actor User ID, Previous/New Values, IP, UA. Event Type = raw `LEGAL_*`. Canonical file/hash: `legal_document_versions`.

---

## 7. `legal_document_acceptances` (status snapshot, not an event log)

| Status ID | Table Event label | Status badge | Meaning | Export |
|---|---|---|---|---|
| `NOT_OPENED` | Legal document not opened | Not opened | Never opened | CSV Status `Not opened` |
| `OPENED` | Legal document opened | Opened | Opened, not accepted | `Opened` |
| `ACCEPTED` | Legal document accepted | Accepted | Accepted | `Accepted` |

CSV Document Type = friendly label (`Terms of Use`, …); Document Type ID = enum. Hash, IPs, acknowledgement text, org/user snapshots, portal, version. JSON keeps raw `documentType`. **No duplicate onboarding event required.**

---

## 8. `product_logs`

| Raw Event ID | Admin / CSV | Product Name | Status |
|---|---|---|---|
| `PRODUCT_CREATED` | Product Created | workflow snapshot | LIVE_UI |
| `PRODUCT_UPDATED` | Product Updated | workflow snapshot | LIVE_UI |
| `PRODUCT_DELETED` | Product Deleted | workflow snapshot | LIVE_UI |
| `PRODUCT_INACTIVATED` | Product Inactivated | blank (no workflow) | UNREACHABLE |
| `PRODUCT_REACTIVATED` | Product Reactivated | blank | UNREACHABLE |

CSV extra: Product Name, Product ID, IP, Device, UA. JSON `product_name` + redacted metadata.

---

## 9. `gateway_payment_events`

Canonical payment row: `gateway_payments` (reference, org, purpose, amount, status, provider ref, timestamps, errors). Events are the activity trail. Admin titles from `EVENT_COPY` / `formatGatewayEventTitle`. CSV Event = same title. **No separate business event required** for capture itself.

| Raw Event ID | Admin / CSV Event | Meaning | Typical notify | Status |
|---|---|---|---|---|
| `NAME_CHECK` | Name check needed | Payer name unmatched | none yet | LIVE_SYSTEM |
| `NAME_CHECK_APPROVED` | Name check approved | Names matched; deposit completed | `deposit_successful` on completed deposit | LIVE_UI |
| `NAME_CHECK_REJECTED` | Name Check Rejected | Names did not match; refund started | `deposit_name_check_rejected` title `Deposit Verification Failed` | LIVE_UI |
| `CAPTURE_MISMATCH` | Payment mismatch found / Amount mismatch found / Currency mismatch found | Amount or currency mismatch | none | LIVE_SYSTEM |
| `EXPIRED` | Payment expired | Link timed out | none | LIVE_SYSTEM |
| `OVERRIDE_PROPOSED` | Status change proposed | Dual-control override | none | LIVE_UI |
| `OVERRIDE_APPROVED` | Status change approved | Override applied | none | LIVE_UI |
| `OVERRIDE_REJECTED` | Status change rejected | Override refused | none | LIVE_UI |
| `REFUND_INITIATED` | Refund Started | Refund requested | `deposit_refund_initiated` title `Refund Started` | LIVE_UI / LIVE_SYSTEM |
| `REFUNDED` | Refund completed | Refund confirmed | `deposit_refunded` title `Refund Completed` | LIVE_SYSTEM |
| `REFUND_WALLET_REVERSAL_FAILED` | Wallet balance could not be updated | Refund done; wallet not fully reversed | none | LIVE_SYSTEM |

Purposes on the payment row: `INVESTOR_DEPOSIT`, `ISSUER_ONBOARDING_FEE`, `APPLICATION_PROCESSING_FEE`, `FACILITY_FEE`, `EXCESS_LATE_CHARGES`.

---

## 10. `notification_logs`

Not a duplicate business event. One row per **send batch** (Admin broadcast or SYSTEM). Table Event = catalogue `notification_type.name` or `notification_type_id`. CSV Event same; Event Type = raw id. Extra: Notification Type, Audience (All Users / Investors / …), Platform/Email Delivered, Idempotency Key, Title, Related Reference (`metadata.targetId` / `noteId` / `applicationId`). Source `ADMIN` or `SYSTEM`. `target_type` is audience, not audit target vocabulary.

SYSTEM idempotency: `system-log:{typeId}:{eventKey}` (`delivery-log.ts`).

---

## Canonical evidence (no duplicate audit row required)

| Proof | Store |
|---|---|
| Submitted application content | `application_revisions` |
| Repayment amount, date, reviewer, status | `note_payments` |
| Gateway capture/fee/refund | `gateway_payments` (+ events for trail) |
| Signed PDF / hash | `signing_documents.signed_s3_key`, `signed_file_sha256` |
| Who signed which document / `signed_at` | `signing_assignments` |
| Envelope package | `signing_envelopes` |
| Legal file hash | `legal_document_versions` |
| Tawarruq certificate hash | `shoraka_trade_orders.certificate_file_sha256` |
| Trustee instruction completion | `withdrawal_instructions` (+ settlement trustee fields on `note_settlements`) |
| Wallet movements | `investor_balance_transactions` / note ledger |

---

## Notification master catalogue

Source: `NotificationTypeIds` + `NOTIFICATION_TEMPLATES` + `initialNotificationTypes` (`seed-data.ts`). Live type count = **49**. Platform/Email defaults and `user_configurable` from seed. Catalogue **Name** ≠ always the in-app **Title**.

Portal column = template `portal` (or request `PortalContext` when template has none).

| Notification Type ID | Catalogue Name | Exact Title | Trigger (call site family) | Recipient | Portal | Platform | Email | User configurable | Related audit | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| `password_changed` | Password Changed | Password Changed | `changePassword` success | Actor user | request portal if known; else unset (email uses landing) | true | true | false | `security_logs.PASSWORD_CHANGED` | LIVE_UI |
| `onboarding_completed` | Onboarding Completed | Onboarding Completed | Final approval | Org owner | investor\|issuer from payload | true | true | false | `FINAL_APPROVAL_COMPLETED` | LIVE_UI |
| `onboarding_rejected` | Onboarding Rejected | Onboarding Application Rejected | Rejection paths | Org owner | payload portal | true | true | false | `ONBOARDING_REJECTED` / `COD_REJECTED` | LIVE_WEBHOOK |
| `system_announcement` | System Announcement | payload title | Admin broadcast | audience | unset when mixed | true | true | true | `notification_logs` ADMIN | LIVE_UI |
| `new_product_alert` | New Product Alert | New Investment Opportunity | Product publish/alert | Investors | **investor** (explicit) | true | true | true | none required | LIVE_UI |
| `application_amendments_requested` | Application Amendments Requested | Amendment Requested | Admin submit amendments | Issuer | issuer | true | true | true | `AMENDMENTS_SUBMITTED` | LIVE_UI |
| `acceptance_document_changes_requested` | Acceptance Documents Need Updates | Acceptance Documents Need Updates | First post-offer doc change request | Issuer | issuer | true | true | true | item/section review | LIVE_UI |
| `application_rejected` | Application Rejected | Application Rejected | Reject application | Issuer | issuer | true | true | true | `APPLICATION_REJECTED` | LIVE_UI |
| `contract_offer_sent` | Facility Offer Sent | Facility Offer Received | Send facility offer | Issuer | issuer | true | true | true | `CONTRACT_OFFER_SENT` | LIVE_UI |
| `invoice_offer_sent` | Invoice Offer Sent | Invoice Offer Received | Send invoice offer | Issuer | issuer | true | true | true | `INVOICE_OFFER_SENT` | LIVE_UI |
| `offer_retracted_or_reset` | Offer Retracted or Reset | Offer Updated | Retract/reset | Issuer | issuer | true | true | true | `*_RETRACTED` | LIVE_UI |
| `offer_expired` | Offer Expired | Offer Expired | Expiry job | Issuer | issuer | true | true | true | `*_OFFER_EXPIRED` | LIVE_SYSTEM |
| `offer_expiry_reminder_24h` | Offer Expiry Reminder | Offer Expiring Soon | Reminder job (`days_before_expiry`) | Issuer | issuer | true | true | true | none (clock) | LIVE_SYSTEM |
| `application_resubmitted_confirmation` | Application Resubmitted Confirmation | Application Resubmitted | Issuer resubmit | Issuer | issuer | true | true | true | `APPLICATION_RESUBMITTED` | LIVE_UI |
| `application_withdrawn_confirmation` | Application Withdrawn Confirmation | Application Withdrawn **or** Facility/Invoice Offer Declined | Withdraw/decline | Issuer | issuer | true | true | true | `APPLICATION_WITHDRAWN` / decline | LIVE_UI |
| `application_completed` | Application Completed | Application Completed | Complete | Issuer | issuer | true | true | true | `APPLICATION_COMPLETED` | LIVE_UI |
| `application_submitted_confirmation` | Application Submitted Confirmation | Application Submitted | First submit | Issuer | issuer | true | **false** | true | `APPLICATION_SUBMITTED` | LIVE_UI |
| `contract_signing_deadline_extended` | Facility Signing Deadline Extended | Signing Deadline Extended | Admin extend | Issuer | issuer | true | true | true | `CONTRACT_SIGNING_DEADLINE_EXTENDED` | LIVE_UI |
| `invoice_signing_deadline_extended` | Invoice Signing Deadline Extended | Signing Deadline Extended | Admin extend | Issuer | issuer | true | true | true | `INVOICE_SIGNING_DEADLINE_EXTENDED` | LIVE_UI |
| `facility_disabled` | Facility Disabled | Facility Disabled | Admin disable | Issuer | issuer | true | true | true | `CONTRACT_FACILITY_DISABLED` | LIVE_UI |
| `director_shareholder_action_required` | Director/Shareholder Action Required | Action Required: Complete Director/Shareholder Onboarding | CTOS/admin | Issuer owner | issuer | true | true | false | none required | LIVE_WEBHOOK / LIVE_UI |
| `investor_director_shareholder_action_required` | Investor Director/Shareholder Action Required | same title | CTOS | Investor owner | investor | true | true | false | none required | LIVE_WEBHOOK |
| `note_published` | Note published | Note published | Publish | Issuer | issuer | true | true | true | `PUBLISH` | LIVE_UI |
| `note_funding_succeeded` | Note funding succeeded | Funding closed successfully | Close funding | Issuer | issuer | true | true | true | `CLOSE_FUNDING` | LIVE_SYSTEM |
| `note_funding_failed_issuer` | Funding Unsuccessful | Note funding did not complete | Fail funding | Issuer | issuer | true | true | true | `FAIL_FUNDING` | LIVE_SYSTEM |
| `note_funding_failed_investor` | Funding Unsuccessful | Commitment released | Fail funding | Investors on note | investor | true | true | true | `FAIL_FUNDING` | LIVE_SYSTEM |
| `note_active_issuer` | Note active | Note is active | Activate | Issuer | issuer | true | true | true | `ACTIVATE` | LIVE_SYSTEM |
| `note_active_investor` | Note active | Investment is active | Activate | Investors | investor | true | true | true | `ACTIVATE` | LIVE_SYSTEM |
| `note_repaid_issuer` | Note repaid | Note repaid | Fully repaid | Issuer | issuer | true | true | true | note status / settlement | LIVE_SYSTEM |
| `note_payment_received` | Repayment Received | Repayment Received | Payment recorded | Investors | investor | true | true | true | `PAYMENT_RECEIVED` + `note_payments` | LIVE_UI |
| `note_settlement_posted` | Note settlement posted | Settlement Posted | Post settlement | Investors | investor | true | true | true | `SETTLEMENT_POSTED` | LIVE_UI |
| `note_arrears` | Note in arrears | Note in arrears | Arrears mark | Issuer | issuer | true | true | true | note status | LIVE_UI / LIVE_SYSTEM |
| `note_arrears_investor` | Note in arrears | Note in Arrears | Arrears | Investors | investor | true | true | true | note status | LIVE_SYSTEM |
| `note_defaulted` | Note defaulted (issuer) | Your Note Is in Default | Default mark | Issuer | issuer | true | true | true | `NOTE_DEFAULT_MARKED` | LIVE_UI |
| `note_defaulted_investor` | Note defaulted | Your Investment Is in Default | Default | Investors | investor | true | true | true | `NOTE_DEFAULT_MARKED` | LIVE_SYSTEM |
| `withdrawal_submitted_to_trustee` | Withdrawal submitted to trustee | Withdrawal Submitted to Trustee | Submit instruction | issuer and/or investor by `portalType` | payload | true | true | true | `WITHDRAWAL_SUBMITTED_TO_TRUSTEE` | LIVE_UI |
| `note_payment_rejected` | Repayment rejected | Repayment Rejected | Reject repayment | Issuer | issuer | true | **false** | true | `PAYMENT_REJECTED` | LIVE_UI |
| `withdrawal_completed` | Disbursement completed | Your Disbursement Is Complete | Complete issuer disbursement | Issuer | issuer | true | **false** | true | `WITHDRAWAL_COMPLETED` | LIVE_UI |
| `facility_fee_payment_requested` | Upfront facility fee payment required | Upfront facility fee payment required | After accept when fee due | Issuer | issuer | true | true | true | `gateway_payments` FACILITY_FEE | LIVE_UI |
| `facility_fee_upfront_paid` | Upfront facility fee paid | Upfront facility fee paid | Fee paid in full | Issuer | issuer | true | true | true | `gateway_payments` | LIVE_SYSTEM |
| `excess_late_charges_due` | Outstanding late charges to pay | Outstanding late charges to pay | Settlement leftover | Issuer | issuer | true | true | true | `note_settlements` / gateway | LIVE_SYSTEM |
| `excess_late_charges_paid` | Late payment charges received | Late payment charges received | Charges paid | Issuer | issuer | true | true | true | gateway EXCESS_LATE_CHARGES | LIVE_SYSTEM |
| `deposit_name_check_rejected` | Deposit verification failed | Deposit Verification Failed | Name check reject | Investor | investor | true | **false** | true | `NAME_CHECK_REJECTED` | LIVE_UI |
| `deposit_refund_initiated` | Deposit refund started | Refund Started | Refund start | Investor | investor | true | **false** | true | `REFUND_INITIATED` | LIVE_SYSTEM |
| `deposit_refunded` | Deposit refund completed | Refund Completed | Refund done | Investor | investor | true | **false** | true | `REFUNDED` | LIVE_SYSTEM |
| `deposit_successful` | Deposit successful | Deposit Successful | Deposit credited | Investor | investor | true | **false** | true | payment COMPLETED + name check | LIVE_SYSTEM |
| `investment_committed` | Investment committed | Investment Committed | Commit | Investor | investor | true | **false** | true | `INVESTMENT_COMMITTED` | LIVE_UI |
| `investor_withdrawal_submitted` | Withdrawal submitted | Withdrawal Submitted | Cash withdrawal request | Investor | investor | true | **false** | true | `withdrawal_instructions` | LIVE_UI |
| `investor_withdrawal_completed` | Withdrawal completed | Withdrawal Completed | Cash withdrawal done | Investor | investor | true | **false** | true | `withdrawal_instructions` | LIVE_UI |

---

## Notification portal / email URLs (current)

From `getNotificationContent` + `email-templates.ts` + tests:

- Explicit Investor templates → `portal: "investor"` → Investor URL.
- Explicit Issuer → Issuer URL.
- Explicit Admin metadata → Admin URL.
- Mixed/unknown (`SYSTEM_ANNOUNCEMENT`, missing/invalid portal, `ALL_USERS` / `SPECIFIC_USERS` / `GROUP` without portal) → **landing `FRONTEND_URL`**, not Investor.
- `NEW_PRODUCT_ALERT` template hardcodes Investor.
- `PASSWORD_CHANGED` template does **not** hardcode a portal; uses `PortalContext.get()` when sending. If unknown, email is landing.

---

## Provider limitations

**SigningCloud**

Available in-app: envelope status, recipients, documents, assignments, `signed_at` / `completed_at`, stored signed PDF + SHA-256 when downloaded/stored.

Not available / must not be shown as known: signer IP, provider-side certificate chain, “five Shariah artefacts” as SigningCloud fields.

**Shoraka / Tawarruq**

Available: order submit/fetch events (`SHORAKA_ORDER_SUBMITTED`, `SHORAKA_CERTIFICATE_FETCHED`), `certificate_file_sha256` on `shoraka_trade_orders` when fetched.

Not available: inventing extra certificate artefacts that the provider does not return.

---

## NOT AUDIT BUGS — PRODUCT / WORKFLOW DECISIONS

These are missing **product gates / artefacts**, not missing audit IDs:

- Per-invoice Receivable Declaration
- Notice of Assignment + paymaster written acknowledgement before disbursement
- Risk Statement questionnaire form (legal PDF ≠ questionnaire)
- Warning statement per application
- Guarantee Acknowledgement timing (guarantors contacted at signing, not at LO issue)
- Onboarding fee-after-AML sequence vs current fee timing
- Five Shariah artefacts as a complete set
- T&C SC-clearance gate
- Reminder cadence (LO day 3+6, signing day 7+12) vs current `days_before_expiry` / 24h-named type

See [`audit-product-gap-review.md`](./audit-product-gap-review.md).

---

## Metadata conventions

| Key | Meaning | Not |
|---|---|---|
| `portal` | Initiating CashSouk frontend or notification/email portal | Role |
| `requestedRole` | OAuth requested persona | Active session role |
| `stateId` | OAuth state id | Session |
| `roles` | Stored user role array | Portal |
| `reason` | Collected reason / auto-archive code | A second event |
| `trigger` on `ONBOARDING_STATUS_UPDATED` | What caused the status write (`KYC_APPROVED`, etc.) | A dedicated `KYC_APPROVED` row |
| `workflow[0].config.name` | Product name snapshot | Live products table |

Exported in CSV Metadata JSON (redacted). UI Technical Details show selected first-class fields; full metadata is in the drawer when present.

---

## Source files (non-exhaustive)

Writers: `lib/audit/account-logs.ts`, `lib/audit/note-events.ts`, `auth/cognito.routes.ts`, `auth/service.ts`, `admin/service.ts`, `applications/*`, `notes/service.ts`, `legal-documents/service.ts`, `products/repository.ts`, payment/gateway modules, `regtank/*`.

Presentation: Admin timeline/CSV/panels listed above; `activity/adapters/{application,organization,note}-log.ts`; `notification/registry.ts`, `notification/seed-data.ts`, `notification/email-templates.ts`.
