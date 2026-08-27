# Current live event BEFORE / AFTER evidence audit

Verified 2026-08-27 against writers, then **updated after the 2026-08-27 audit-traceability fix pass**. Source code is authoritative.

Companion: identifier/traceability audit in `docs/audit/current-event-metadata-traceability-audit.md`.

`updatedFields` alone is **not** treated as sufficient evidence.

Disposition of before/after findings: `FIXED` / `DEFERRED` / `INTENTIONALLY_UNCHANGED` — see the table in the traceability audit. This file records the **current** metadata shape after that pass.

---

## Classification keys

| Class | Meaning |
|---|---|
| **FULL_BEFORE_AFTER** | Previous **and** new values are preserved on the audit row (field-level or object-level). |
| **PARTIAL_BEFORE_AFTER** | Changed fields and **either** previous **or** new values are stored, but not both. |
| **FIELD_NAMES_ONLY** | Only the names of changed fields are stored. |
| **LIVE_STATE_ONLY** | The audit row does not preserve historical values; reconstructing the edit requires the current database row (or the previous value has been overwritten). |
| **NOT_APPLICABLE** | The event is not an edit/update of stored business fields. |

**Snapshot vs live:** a value is snapshotted only if it is written onto the log row (column or metadata) at insert time. Admin Event Details / CSV that join the current user, organisation, note, or application row are **live**.

**UI extractor:** `extractPreviousNext` in `apps/admin/src/components/audit/audit-presentation.ts` reads previous as `previousValues` / `previous_values` / `beforeJson` / `before` / `beforeState` and next as `nextValues` / `next_values` / `afterJson` / `after` / `afterState`. Historical rows without those keys leave the panels blank.

**CSV secrets:** `redactAuditSecrets` redacts keys matching password / secret / token / api key / credential. It does **not** redact bank account numbers, names, phones, or addresses.

---

## The three `PROFILE_UPDATED` writers

Catalogue claims that do **not** match source are called out. Source wins.

### 1. `access_logs.PROFILE_UPDATED`

**Writer:** `AdminService.updateUserProfile` (`apps/api/src/modules/admin/service.ts`).

**Metadata at write time (matches the expected current shape):**

| Key | Stored |
|---|---|
| `targetUserId` | yes |
| `targetUserEmail` | yes (extra vs the short expected list) |
| `updatedFields` | yes — keys from the admin input that are defined |
| `previousValues` | yes — `{ firstName, lastName, phone }` from the **pre-update** user row |
| `nameLockedOverride` | yes — true when the subject has completed onboarding **and** a name field is in the patch |

**Not stored:** entire User object. `previousValues` is a **full identity snapshot** of those three fields, not a diff of only the changed keys. `nextValues` is the same three fields from the **post-update** user row.

**Classification:** `FULL_BEFORE_AFTER` for the three identity fields.

- Which fields changed: yes (`updatedFields`).
- Previous values: yes (all three identity fields, including ones that did not change).
- New values: **yes** (`nextValues`).
- Snapshotted at write: yes.

Actor column `user_id` is the **admin**. Subject is `targetUserId`.

---

### 2. `security_logs.PROFILE_UPDATED`

Two writers.

#### 2a. Self-service — `AuthService.updateProfile`

**Metadata:**

| Key | Stored |
|---|---|
| `updatedFields` | yes |
| `previousValues` | yes — `{ firstName, lastName, phone }` from the pre-update user |
| `nextValues` | yes — same three keys from the post-update user |
| `adminOverride` | **not set** |

**FIXED.** Classification: `FULL_BEFORE_AFTER` for those three fields.

#### 2b. Admin override — same `updateUserProfile`

Written for **any** admin profile patch of an onboarded user when `updatedFields.length > 0`, including phone-only edits. One security row per patch.

**Metadata:**

| Key | Stored |
|---|---|
| `updatedBy` | admin user id |
| `updatedFields` | yes |
| `previousValues` | `{ firstName, lastName, phone }` |
| `nextValues` | `{ firstName, lastName, phone }` from the post-update user |
| `adminOverride` | `true` |

`user_id` on this row is the **subject**, not the admin.

**FIXED.** Classification: `FULL_BEFORE_AFTER` for those three fields.

---

### 3. `onboarding_logs.PROFILE_UPDATED`

**Writers:** `updateAdminOrganizationProfile` and self-service `OrganizationService.updateOrganizationProfile`.

**Actual metadata (FIXED):**

| Key | Stored |
|---|---|
| `updatedBy` | admin user id (admin path only) |
| `updatedFields` | **changed fields only**, including nested `corporateOnboardingData.website` etc. |
| `bankFieldsChanged` | boolean — true if bank details were in the input; bank JSON is **not** dumped |
| `previousValues` / `nextValues` | only fields that actually changed |
| `organizationReference` | org `display_reference` when present |

Self-service actor is the caller (`actor_user_id` = userId). Same event ID; no duplicate type.

Bank JSON remains absent from the audit row (not leaked). Historical bank edits still cannot be reconstructed from the log — **INTENTIONALLY_UNCHANGED** (do not dump bank JSON).

---

## Cross-cutting: previous + next after the fix pass

| Event | Store | Status |
|---|---|---|
| `PROFILE_UPDATED` | `access_logs` | **FIXED** — previous + next identity |
| `PROFILE_UPDATED` | `security_logs` | **FIXED** — previous + next; admin includes phone; phone-only writes the security row |
| `PROFILE_UPDATED` | `onboarding_logs` | **FIXED** — changed-field previous + next; nested corporate names; self-service writer added |
| `WITHDRAWAL_BENEFICIARY_UPDATED` | `note_events` | **FIXED** — previous + next beneficiary snapshots |
| `CONTRACT_CUSTOMER_LARGE_PRIVATE_UPDATED` | `application_logs` | **FIXED** |
| `CONTRACT_FACILITY_ENABLED` / `DISABLED` | `application_logs` | **FIXED** |
| `APPLICATION_RESET_TO_UNDER_REVIEW` | `application_logs` | **FIXED** — `previous_status` + `new_status` |
| `PRODUCT_UPDATED` | `product_logs` | **DEFERRED** — previous immutable product version already exists |
| `APPLICATION_RESUBMITTED` (PATCH duplicate) | `application_logs` | **FIXED** — one row; amendments path still has `resubmit_changes` when applicable |
| `ONBOARDING_STATUS_UPDATED` | `onboarding_logs` | **FIXED** where both values are known |

---

## Mutation / edit events (classified)

Creates, logins, offers sent, letters generated, payments captured, and similar lifecycle breadcrumbs are **NOT_APPLICABLE** unless listed here.

### Access — `access_logs`

| Event | Class | Stored | Missing | Snapshot? | UI |
|---|---|---|---|---|---|
| `PROFILE_UPDATED` | FULL_BEFORE_AFTER | `updatedFields`, `previousValues` + `nextValues` (name/phone), override flag | entire User object | yes | Previous and New panels |
| `LOGIN` / `SIGNUP` / `LOGOUT` | NOT_APPLICABLE | — | — | — | — |

### Security — `security_logs`

| Event | Class | Stored | Missing | Snapshot? | Sensitive |
|---|---|---|---|---|---|
| `PROFILE_UPDATED` (self) | FULL_BEFORE_AFTER | `updatedFields`, previous + next name/phone | entire User object | yes | phone snapshotted |
| `PROFILE_UPDATED` (admin override) | FULL_BEFORE_AFTER | `updatedFields`, previous + next first/last/phone, `adminOverride` | entire User object | yes | phone-only edits write this row |
| `PLATFORM_FINANCE_SETTINGS_UPDATED` | FULL_BEFORE_AFTER | redacted full `previousValues` + `nextValues` snapshots | secrets (intentional) | yes | `redactSensitiveFinanceSettings` redacts password/secret/token/apiKey keys; **account numbers and trustee emails are kept** |
| `ROLE_PERMISSIONS_UPDATED` | FULL_BEFORE_AFTER | `previousPermissions` / `nextPermissions`, badge colors | — | yes | — |
| `ROLE_SWITCHED` | FULL_BEFORE_AFTER | `previousRole`/`newRole` or `previousStatus`/`newStatus` (+ roles when deactivating via role removal) | — | yes | — |
| `PASSWORD_CHANGED` | NOT_APPLICABLE | `reason`, `sessionRevoked`, fail `error` | password hashes/plaintext (correct) | n/a | correctly excluded |
| `EMAIL_VERIFIED` | NOT_APPLICABLE | current `email` | not an email-address edit | email at verify time | — |
| `ROLE_ADDED` / `ROLE_CREATED` / `ROLE_REMOVED` / `INVITATION_REVOKED` | NOT_APPLICABLE | grant/revoke/create, not a field diff | — | — | — |

### Onboarding — `onboarding_logs`

| Event | Class | Stored | Missing |
|---|---|---|---|
| `PROFILE_UPDATED` | FULL_BEFORE_AFTER (changed fields) | nested `updatedFields`, `previousValues`/`nextValues`, `bankFieldsChanged`, `organizationReference` | entire org / bank JSON dump (intentional) |
| `SOPHISTICATED_STATUS_UPDATED` | FULL_BEFORE_AFTER | `previousStatus`/`newStatus`, `previousReason`/`newReason` | full org object (not required) |
| `ONBOARDING_STATUS_UPDATED` | FULL_BEFORE_AFTER when both known | `previousStatus` + `newStatus` + `trigger` | not invented when a writer does not have both |
| `FORM_FILLED` | NOT_APPLICABLE (as org-profile edit) | provider `requestId`/`status`/`payload` snapshot | not a CashSouk field diff |
| Start / resume / cancel / reject / approve / SSM / T&C | NOT_APPLICABLE | status breadcrumbs | — |

### Applications — `application_logs`

| Event | Class | Stored | Missing |
|---|---|---|---|
| `APPLICATION_RESUBMITTED` (amendments path) | FULL_BEFORE_AFTER (field grain) | `resubmit_changes.field_changes[]` with `previous_value` + `next_value` (truncated ~5k chars; guarantor leaves rolled up) | full application JSON on the **log** (canonical snapshot is `application_revisions.snapshot`) |
| `APPLICATION_RESUBMITTED` (PATCH `/status`) | same as `POST /resubmit` | service writer only (no empty controller duplicate) | — |
| `APPLICATION_RESET_TO_UNDER_REVIEW` | FULL_BEFORE_AFTER | `previous_status` + `new_status: UNDER_REVIEW` | — |
| `CONTRACT_CUSTOMER_LARGE_PRIVATE_UPDATED` | FULL_BEFORE_AFTER | `previousValues`/`nextValues` `{ is_large_private_company }`; contract target | — |
| `CONTRACT_FACILITY_ENABLED` / `DISABLED` | FULL_BEFORE_AFTER | `previousValues`/`nextValues` `{ enabled }` (+ disable reason) | — |
| `AMENDMENTS_SUBMITTED` | NOT_APPLICABLE (as content edit) | `{ count }` | remark bodies live on amendment rows, not this event |
| `SECTION_REVIEWED_*` / `ITEM_REVIEWED_*` | FULL_BEFORE_AFTER | `old_status` / `new_status` + scope | section payload |
| `CONTRACT_FACILITY_OCCUPANCY_UPDATED` | FULL_BEFORE_AFTER | structured `before` / `after` occupancy amounts | full contract JSON |
| Other application/contract/invoice lifecycle | NOT_APPLICABLE | — | — |

### Notes — `note_events` (+ `note_admin_actions` for admin-mirrors)

| Event | Class | Stored | UI |
|---|---|---|---|
| `UPDATE_DRAFT` | FULL_BEFORE_AFTER | `beforeState`/`afterState` = `mapNoteListItem` DTOs; `changedFields` on admin_actions | extractor reads `beforeState`/`afterState` |
| `UPDATE_FEATURED_SETTINGS` | FULL_BEFORE_AFTER | same DTO pair | same |
| `PUBLISH` / `UNPUBLISH` / `PAUSE_LISTING` / `RESUME_LISTING` / `CLOSE_FUNDING` / `FAIL_FUNDING` / `ACTIVATE` / `WAIVE_FACILITY_FEE_COLLECTION` | FULL_BEFORE_AFTER | same DTO pair | same |
| `PROSPECTUS_REVIEW_DRAFT_UPDATE` / `PROSPECTUS_REVIEW_APPROVE` / `PROSPECTUS_APPROVAL_INVALIDATED_*` | FULL_BEFORE_AFTER | prospectus `mapReview` before/after | same |
| `PROSPECTUS_REVIEW_CREATE` | NOT_APPLICABLE | after only (create) | — |
| `FACILITY_OCCUPANCY_UPDATED` | FULL_BEFORE_AFTER | same `before`/`after` occupancy object as the application twin | extractor **does** pick `before`/`after` |
| `WITHDRAWAL_BENEFICIARY_UPDATED` | FULL_BEFORE_AFTER | `previousValues`/`nextValues` beneficiary snapshots + `withdrawalReference` | live row can still change later |
| Payment / settlement / letter / withdrawal submit-complete | NOT_APPLICABLE | ids / reasons; canonical amounts on payment/instruction rows | — |

### Legal — `legal_document_audit_logs`

| Event | Class | Stored |
|---|---|---|
| `LEGAL_DOCUMENT_UPDATED` | FULL_BEFORE_AFTER | `beforeJson`/`afterJson` **for changed keys only** (title, visibility, etc.) — not the entire definition blob if unchanged keys exist |
| `LEGAL_VERSION_FILE_REPLACED` | FULL_BEFORE_AFTER | `file_name` + `file_hash` before and after |
| `LEGAL_VERSION_PUBLISHED` / `ARCHIVED` / `RESTORED` | FULL_BEFORE_AFTER | status (and restore target) before/after |
| `LEGAL_DOCUMENT_CREATED` / `LEGAL_VERSION_UPLOADED` | NOT_APPLICABLE | create / upload |

First-class `before_json` / `after_json` columns; Event Details maps them correctly.

### Products — `product_logs`

| Event | Class | Stored | Missing |
|---|---|---|---|
| `PRODUCT_UPDATED` | PARTIAL_BEFORE_AFTER | full **after** snapshot; versioning path sets `replaced_product_id` | previous snapshot on this row — **DEFERRED** (previous immutable version exists) |
| `PRODUCT_CREATED` / `PRODUCT_DELETED` | NOT_APPLICABLE | after/last snapshot | — |

Event Details Previous/New panels are empty because the snapshot is not under `previousValues`/`nextValues`/`before`/`after`.

### Gateway — `gateway_payment_events`

Capture, name-check, refund, expiry: **NOT_APPLICABLE** as field edits of a settings/profile object. `OVERRIDE_*` have **no live writer**.

---

## BEFORE/AFTER GAPS

The identity / large-private / facility / reset / beneficiary / note-extractor / PATCH-resubmit / onboarding-status gaps listed in the pre-fix audit are **FIXED**. Remaining:

| Event | Store | Status |
|---|---|---|
| `PRODUCT_UPDATED` | `product_logs` | **DEFERRED** — previous immutable product version already exists |
| Onboarding bank JSON | `onboarding_logs` | **INTENTIONALLY_UNCHANGED** — do not dump bank JSON |
| `AMENDMENTS_SUBMITTED` | `application_logs` | **INTENTIONALLY_UNCHANGED** — remark bodies live on amendment rows |
| `OVERRIDE_*` | `gateway_payment_events` | **INTENTIONALLY_UNCHANGED** — no live writer |

**Not a gap (do not “fix” by logging secrets):**

- `PASSWORD_CHANGED` — no password values (correct).
- Finance settings — auth secrets redacted; operational account numbers intentionally retained.

---

## Code changed

**YES** (writers/UI/tests in the 2026-08-27 fix pass). **NO** schema/migrations.
