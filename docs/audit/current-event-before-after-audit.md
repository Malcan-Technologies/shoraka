# Current live event BEFORE / AFTER evidence audit

**Read-only.** Verified 2026-08-27 against writers (not catalogues). No application code, schema, UI, or database was changed.

Companion: identifier/traceability audit in `docs/audit/current-event-metadata-traceability-audit.md`.

`updatedFields` alone is **not** treated as sufficient evidence.

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

**UI extractor:** `extractPreviousNext` in `apps/admin/src/components/audit/audit-presentation.ts` only reads `previousValues` / `previous_values` / `beforeJson` / `before` and `nextValues` / `next_values` / `afterJson` / `after`. It does **not** read `beforeState` / `afterState`. Dedicated “Previous values” / “New values” panels therefore miss note admin-mirrors even when the row stores a full pair. Raw metadata is still shown in Event Details.

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

**Not stored:** `nextValues` / new name or phone. `previousValues` is a **full identity snapshot** of those three fields, not a diff of only the changed keys.

**Classification:** `PARTIAL_BEFORE_AFTER`.

- Which fields changed: yes (`updatedFields`).
- Previous values: yes (all three identity fields, including ones that did not change).
- New values: **no**.
- Full before/after object: no.
- Snapshotted at write: yes for previous identity + email.
- UI: Event Details can show Previous values; New values panel is empty. Reconstructing the new name/phone requires the live `users` row (or a later event’s `previousValues`).
- Sensitive: passwords are not in this event. Phone is stored in previous snapshot (expected).

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
| `adminOverride` | **not set** |

No `nextValues`. Same PARTIAL shape as access.

#### 2b. Admin override — same `updateUserProfile`, **conditional**

Written **only if** the subject has completed onboarding **and** a name field is in the patch.

**Metadata:**

| Key | Stored |
|---|---|
| `updatedBy` | admin user id |
| `updatedFields` | yes (same key list as the access row, may include `phone`) |
| `previousValues` | `{ firstName, lastName }` only — **phone omitted** |
| `adminOverride` | `true` |

`user_id` on this row is the **subject**, not the admin.

A phone-only admin edit of an onboarded user produces the access row, **not** this security row.

**Classification (both security writers):** `PARTIAL_BEFORE_AFTER`.

---

### 3. `onboarding_logs.PROFILE_UPDATED`

**Writer:** `updateAdminOrganizationProfile` (`apps/api/src/modules/admin/organization-admin-profile.ts`).

The current catalogue line that lists only `updatedFields` is **wrong**.

**Actual metadata:**

| Key | Stored |
|---|---|
| `updatedBy` | admin user id |
| `updatedFields` | **top-level input keys only** (`Object.keys(input)` that are defined). Nested corporate field names are **not** expanded. A corporate patch appears as the single name `corporateOnboardingData`. |
| `bankFieldsChanged` | boolean — true if `bankAccountDetails` was in the input |
| `previousValues` | `{ name, phoneNumber, address, firstName, lastName, middleName }` from the organisation **before** the update |

**Patchable fields that are not in `previousValues`:** `bankAccountDetails`, `corporateOnboardingData` (website, industry, entity type, employees, revenue, TIN, business name, addresses, person-in-charge).

**Not stored anywhere on the row:** `nextValues`, after object, previous or new bank JSON, previous or new corporate JSON.

**Row column:** `organization_name` is `input.name ?? org.name` — already the **new** name when name was patched.

**Answers (onboarding specifically):**

| Question | Answer |
|---|---|
| Does it preserve `previousValues` anywhere? | **Yes**, but only the six identity fields above. Not bank. Not corporate. |
| Does it preserve `newValues` anywhere? | **No.** |
| Does it preserve a before/after object? | **No.** |
| Can Ops reconstruct exactly what the organisation profile looked like before the edit? | **No.** Identity six fields yes; bank and corporate JSON no. |
| Can Ops reconstruct exactly what changed without querying the current organisation row? | **No.** Field names (top-level) yes; old identity values yes; new values no; bank/corporate neither side. |
| Evidence gap class | **PARTIAL_BEFORE_AFTER** for identity fields. **LIVE_STATE_ONLY** for bank and corporate. Overall: **PARTIAL_BEFORE_AFTER** with a LIVE subset. |

Bank details are correctly **absent** from the audit JSON today (not leaked). That is also why historical bank edits cannot be reconstructed from the log.

---

## Cross-cutting: same problem as onboarding `PROFILE_UPDATED`

These mutation events also fail “previous **and** new on the row”:

| Event | Store | Gap pattern |
|---|---|---|
| `PROFILE_UPDATED` | `access_logs` | previous identity, no next |
| `PROFILE_UPDATED` | `security_logs` | previous identity, no next (admin override also drops phone from previous) |
| `PROFILE_UPDATED` | `onboarding_logs` | previous identity only; bank/corporate neither side; no next |
| `WITHDRAWAL_BENEFICIARY_UPDATED` | `note_events` | id only; current `beneficiary_snapshot` overwritten |
| `CONTRACT_CUSTOMER_LARGE_PRIVATE_UPDATED` | `application_logs` | new flag only; no previous |
| `CONTRACT_FACILITY_ENABLED` / `DISABLED` | `application_logs` | new `enabled` (+ disable reason); previous not stored |
| `APPLICATION_RESET_TO_UNDER_REVIEW` | `application_logs` | `previous_status` only |
| `PRODUCT_UPDATED` | `product_logs` | full **after** workflow snapshot; no previous blob on this row |
| `APPLICATION_RESUBMITTED` (bare PATCH) | `application_logs` | no `resubmit_changes` |
| `ONBOARDING_STATUS_UPDATED` (some writers) | `onboarding_logs` | `previousStatus` without `newStatus` (e.g. admin COD refresh) |

No live writer is **FIELD_NAMES_ONLY** as its whole-event class. Onboarding `updatedFields` is field-names-only for nested corporate/bank, but identity `previousValues` still exist on the same row.

---

## Mutation / edit events (classified)

Creates, logins, offers sent, letters generated, payments captured, and similar lifecycle breadcrumbs are **NOT_APPLICABLE** unless listed here.

### Access — `access_logs`

| Event | Class | Stored | Missing | Snapshot? | UI |
|---|---|---|---|---|---|
| `PROFILE_UPDATED` | PARTIAL_BEFORE_AFTER | `updatedFields`, `previousValues` (name/phone), override flag | new values | yes (previous) | Previous panel only; new from live user |
| `LOGIN` / `SIGNUP` / `LOGOUT` | NOT_APPLICABLE | — | — | — | — |

### Security — `security_logs`

| Event | Class | Stored | Missing | Snapshot? | Sensitive |
|---|---|---|---|---|---|
| `PROFILE_UPDATED` (self) | PARTIAL_BEFORE_AFTER | `updatedFields`, `previousValues` incl. phone | new values; no `adminOverride` | yes | phone in previous |
| `PROFILE_UPDATED` (admin override) | PARTIAL_BEFORE_AFTER | `updatedFields`, `previousValues` first/last, `adminOverride` | new values; previous phone | yes | — |
| `PLATFORM_FINANCE_SETTINGS_UPDATED` | FULL_BEFORE_AFTER | redacted full `previousValues` + `nextValues` snapshots | secrets (intentional) | yes | `redactSensitiveFinanceSettings` redacts password/secret/token/apiKey keys; **account numbers and trustee emails are kept** |
| `ROLE_PERMISSIONS_UPDATED` | FULL_BEFORE_AFTER | `previousPermissions` / `nextPermissions`, badge colors | — | yes | — |
| `ROLE_SWITCHED` | FULL_BEFORE_AFTER | `previousRole`/`newRole` or `previousStatus`/`newStatus` (+ roles when deactivating via role removal) | — | yes | — |
| `PASSWORD_CHANGED` | NOT_APPLICABLE | `reason`, `sessionRevoked`, fail `error` | password hashes/plaintext (correct) | n/a | correctly excluded |
| `EMAIL_VERIFIED` | NOT_APPLICABLE | current `email` | not an email-address edit | email at verify time | — |
| `ROLE_ADDED` / `ROLE_CREATED` / `ROLE_REMOVED` / `INVITATION_REVOKED` | NOT_APPLICABLE | grant/revoke/create, not a field diff | — | — | — |

### Onboarding — `onboarding_logs`

| Event | Class | Stored | Missing |
|---|---|---|---|
| `PROFILE_UPDATED` | PARTIAL + LIVE subset | identity `previousValues`, top-level `updatedFields`, `bankFieldsChanged` | next values; bank/corporate before **and** after |
| `SOPHISTICATED_STATUS_UPDATED` | FULL_BEFORE_AFTER | `previousStatus`/`newStatus`, `previousReason`/`newReason` | full org object (not required) |
| `ONBOARDING_STATUS_UPDATED` | FULL_BEFORE_AFTER **or** PARTIAL | typically `previousStatus` + `newStatus` + `trigger` | some writers omit `newStatus` |
| `FORM_FILLED` | NOT_APPLICABLE (as org-profile edit) | provider `requestId`/`status`/`payload` snapshot | not a CashSouk field diff |
| Start / resume / cancel / reject / approve / SSM / T&C | NOT_APPLICABLE | status breadcrumbs | — |

### Applications — `application_logs`

| Event | Class | Stored | Missing |
|---|---|---|---|
| `APPLICATION_RESUBMITTED` (amendments path) | FULL_BEFORE_AFTER (field grain) | `resubmit_changes.field_changes[]` with `previous_value` + `next_value` (truncated ~5k chars; guarantor leaves rolled up) | full application JSON on the **log** (canonical snapshot is `application_revisions.snapshot`) |
| `APPLICATION_RESUBMITTED` (bare status PATCH) | LIVE_STATE_ONLY | event type only / no `resubmit_changes` | what changed |
| `AMENDMENTS_SUBMITTED` | NOT_APPLICABLE (as content edit) | `{ count }` | remark bodies live on amendment rows, not this event |
| `APPLICATION_RESET_TO_UNDER_REVIEW` | PARTIAL_BEFORE_AFTER | `previous_status` | new status (implied UNDER_REVIEW) |
| `SECTION_REVIEWED_*` / `ITEM_REVIEWED_*` | FULL_BEFORE_AFTER | `old_status` / `new_status` + scope | section payload |
| `CONTRACT_FACILITY_OCCUPANCY_UPDATED` | FULL_BEFORE_AFTER | structured `before` / `after` occupancy amounts | full contract JSON |
| `CONTRACT_CUSTOMER_LARGE_PRIVATE_UPDATED` | PARTIAL_BEFORE_AFTER | new `is_large_private_company` | previous flag; `contract_id` (see traceability P0) |
| `CONTRACT_FACILITY_ENABLED` / `DISABLED` | PARTIAL_BEFORE_AFTER | `enabled` (+ `reason` on disable) | explicit previous; invertible because writer no-ops if unchanged |
| Other application/contract/invoice lifecycle | NOT_APPLICABLE | — | — |

### Notes — `note_events` (+ `note_admin_actions` for admin-mirrors)

| Event | Class | Stored | UI |
|---|---|---|---|
| `UPDATE_DRAFT` | FULL_BEFORE_AFTER | `beforeState`/`afterState` = `mapNoteListItem` DTOs; `changedFields` on admin_actions | extractor **misses** `beforeState`/`afterState`; raw metadata has them; admin_actions has first-class columns |
| `UPDATE_FEATURED_SETTINGS` | FULL_BEFORE_AFTER | same DTO pair | same UI miss |
| `PUBLISH` / `UNPUBLISH` / `PAUSE_LISTING` / `RESUME_LISTING` / `CLOSE_FUNDING` / `FAIL_FUNDING` / `ACTIVATE` / `WAIVE_FACILITY_FEE_COLLECTION` | FULL_BEFORE_AFTER | same DTO pair | same UI miss |
| `PROSPECTUS_REVIEW_DRAFT_UPDATE` / `PROSPECTUS_REVIEW_APPROVE` / `PROSPECTUS_APPROVAL_INVALIDATED_*` | FULL_BEFORE_AFTER | prospectus `mapReview` before/after | same UI miss |
| `PROSPECTUS_REVIEW_CREATE` | NOT_APPLICABLE | after only (create) | — |
| `FACILITY_OCCUPANCY_UPDATED` | FULL_BEFORE_AFTER | same `before`/`after` occupancy object as the application twin | extractor **does** pick `before`/`after` |
| `WITHDRAWAL_BENEFICIARY_UPDATED` | LIVE_STATE_ONLY | `{ withdrawalId }` | live `withdrawal_instructions.beneficiary_snapshot`; previous overwritten |
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
| `PRODUCT_UPDATED` | PARTIAL_BEFORE_AFTER | full **after** snapshot: workflow, rates, listing days, code, version, timestamps. Versioning path also sets `replaced_product_id` | previous snapshot **on this row**. Previous version row / earlier log can recover it if those still exist |
| `PRODUCT_CREATED` / `PRODUCT_DELETED` | NOT_APPLICABLE | after/last snapshot | — |

Event Details Previous/New panels are empty because the snapshot is not under `previousValues`/`nextValues`/`before`/`after`.

### Gateway — `gateway_payment_events`

Capture, name-check, refund, expiry: **NOT_APPLICABLE** as field edits of a settings/profile object. `OVERRIDE_*` have **no live writer**.

---

## BEFORE/AFTER GAPS

| Event | Store | What is currently stored | What is missing | Risk | Minimal recommended fix |
|---|---|---|---|---|---|
| `PROFILE_UPDATED` | `onboarding_logs` | `updatedBy`, top-level `updatedFields`, `bankFieldsChanged`, identity `previousValues` only | `nextValues`; previous **and** new `bankAccountDetails`; previous **and** new `corporateOnboardingData`; expanded nested field names | Ops cannot reconstruct a historical org profile or a bank/corporate edit. Later live row overwrites the only remaining copy. Catalogue currently understates this. | Snapshot redacted `previousValues` + `nextValues` for identity **and** bank/corporate (mask account numbers). Expand `updatedFields` to nested paths. Keep secrets out. |
| `PROFILE_UPDATED` | `access_logs` | `updatedFields` + full previous name/phone (+ email, override flag) | `nextValues` / new name and phone | After a later edit, the new values from **this** edit are gone unless inferred from the next row’s previous snapshot | Add `nextValues: { firstName, lastName, phone }` from the post-update row (same three keys). |
| `PROFILE_UPDATED` | `security_logs` (self) | `updatedFields` + previous name/phone | `nextValues` | Same as access | Same `nextValues` triple. |
| `PROFILE_UPDATED` | `security_logs` (admin override) | `updatedFields` + previous first/last, `adminOverride` | `nextValues`; previous **phone** even when phone is in `updatedFields`; row skipped on phone-only edits | Name-override trail is incomplete; phone-only admin edits have no security row | Always write the security row for any admin profile patch; store previous+next for first/last/phone. |
| `WITHDRAWAL_BENEFICIARY_UPDATED` | `note_events` | `withdrawalId` | previous and new `beneficiary_snapshot` | Draft beneficiary history is unrecoverable; current instruction row is live-only | Snapshot redacted before/after beneficiary (mask account number, keep bank name + last4). |
| `CONTRACT_CUSTOMER_LARGE_PRIVATE_UPDATED` | `application_logs` | new `is_large_private_company` | previous flag; contract id on the row (separate P0) | Cannot prove the prior classification without assuming invertibility | Store `previous` + `next` booleans; set `entity_id` / `contract_id`. |
| `CONTRACT_FACILITY_ENABLED` / `DISABLED` | `application_logs` | new `enabled` (+ disable reason) | explicit previous enabled + prior reason timestamps | Weaker than occupancy; invertibility is an assumption | Add `previous.enabled` (and previous reason/at on re-enable). |
| `APPLICATION_RESET_TO_UNDER_REVIEW` | `application_logs` | `previous_status` | `new_status` | Low — new status is implied | Add `new_status: "UNDER_REVIEW"`. |
| `PRODUCT_UPDATED` | `product_logs` | full after workflow snapshot; optional `replaced_product_id` | previous workflow/rates on **this** row | If the replaced product row is later deleted, previous config is gone | Copy the pre-update snapshot as `before` (or `previousValues`) next to the existing after blob. |
| `APPLICATION_RESUBMITTED` (bare) | `application_logs` | no field diff | `resubmit_changes` | Cannot tell what the issuer changed | Do not use the bare path for content edits; or attach the same revision diff as the amendments path. |
| `ONBOARDING_STATUS_UPDATED` (COD refresh writer) | `onboarding_logs` | `previousStatus`, `codStatus`, `trigger` | `newStatus` | Status after refresh is live-joined | Always persist `newStatus` from the post-update org row. |
| Note admin-mirrors (`UPDATE_DRAFT`, featured, listing, funding, prospectus draft/approve/invalidate) | `note_events` | **FULL** `beforeState`/`afterState` on the row | Dedicated Previous/New **panels** (extractor gap, not storage) | Ops may think evidence is missing; it is in raw metadata / `note_admin_actions` | Teach `extractPreviousNext` to read `beforeState`/`afterState`. No writer change required. |
| `AMENDMENTS_SUBMITTED` | `application_logs` | `{ count }` | remark text / which sections | Content of the request is on amendment tables, not the event | Optional: copy section keys + remark text into metadata. Not a profile-edit gap. |

**Not a gap (do not “fix” by logging secrets):**

- `PASSWORD_CHANGED` — no password values (correct).
- Finance settings — auth secrets redacted; operational account numbers intentionally retained.
- Onboarding bank JSON — currently excluded (good for leak risk; bad for reconstruction). The fix is a **redacted** snapshot, not raw account numbers.

---

## Code changed

**NO** (documentation only).
