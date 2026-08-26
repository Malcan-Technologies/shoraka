# Current live event metadata traceability audit

**Read-only.** Verified 2026-08-27 against writers, Prisma log models, Admin Event Details (`audit-adapters.ts`), and CSV/JSON export. Source code wins over catalogues.

This is the verification report only. No writers, schema, UI, or metadata were changed.

**Before/after evidence** (previous vs new values on mutation events) is a separate report: `docs/audit/current-event-before-after-audit.md`.

**Scope:** every production writer for the current live event set (plus extra live writers found in source that catalogues omit). Notifications are not event writers.

**How to read A / B / C**

| Class | Meaning | Example |
|---|---|---|
| **A** | Canonical CashSouk DB primary key | `application.id`, `note.id`, `users.user_id` |
| **B** | Display / business reference the UI shows | `APP-CS-2026-001`, `NOTE-CS-2026-018`, org `display_reference` |
| **C** | External / provider id | RegTank `requestId`, SigningCloud `provider_ref`, Curlec payment id, Shoraka `provider_order_id` |

B or C is never treated as a substitute for A.

**User PK special case:** `users.user_id` is a 5-letter code that is both A and the Admin “User ID”. There is no separate cuid for users.

**Assessments** (only these values): COMPLETE · TECHNICAL_ONLY · DISPLAY_ONLY · INDIRECT_ONLY · MISSING · NOT_APPLICABLE

---

## Method

For each live writer: call site → canonical table → log insert (top-level columns + metadata) → Admin Event Details → CSV/JSON.

Live join vs snapshot: if a display value is only available by reading the current application/note/org row at view/export time, that is **not** stored on the event.

---

## Store-level anchors (do not duplicate these into metadata)

| Store | A already on the row | Org on the row | Actor on the row | JSON export | CSV Target Reference |
|---|---|---|---|---|---|
| `access_logs` | `user_id`, `target_id` | no | `user_id` | yes (incl. live-joined `user`) | `target_id`; extra `User ID` = `user_id` |
| `security_logs` | `user_id`, `target_id` | no | `user_id` | yes | `target_id`; extra `User ID` |
| `onboarding_logs` | `investor_organization_id` / `issuer_organization_id`, `target_id`, `user_id` | ids + `organization_name` snapshot | `user_id` = applicant; `actor_user_id` = actor when resolved | **omits org UUID columns**; has `target_id` + `organization_name` | `target_id`; Organisation = name snapshot |
| `application_logs` | `application_id`; `entity_id`; `target_id` | no (join via application) | `user_id` | **no JSON export** | `target_id` ?? `entity_id` (DB ids). Display ref is **not** a column |
| `note_events` | `note_id`; `target_id` | no (join via note) | `actor_user_id` | **no JSON** | prefers metadata `withdrawalReference` / `settlementReference` / `noteReference` else `targetId` ?? `noteId` |
| `legal_document_audit_logs` | `legal_document_id`, `legal_document_version_id` | n/a | `actor_user_id` | yes | document id; extra version id/number/hash |
| `legal_document_acceptances` | version id, document id, `user_id`, `organization_id` | id + name snapshot | user | yes | dedicated acceptance CSV |
| `product_logs` | `product_id`, `target_id` | n/a | `user_id` | yes | Product ID extra + name from metadata snapshot |
| `gateway_payment_events` | `gateway_payment_id`, `target_id` | no (join via payment) | `actor_user_id` | **no JSON** | `targetId` = payment UUID |

**Event Details gaps that apply to many rows**

- Application details do **not** label `application_id`. `applicationReference` is filled from metadata keys `applicationReference` or `application_id` (would mislabel a DB id as a display ref). Almost no writer sets those keys, so the display ref is blank even on the application page.
- Application details `target.id` = `target_id` ?? `entity_id` (contract/invoice/envelope/section — not always the application).
- Note details `noteReference` only reads **top-level** metadata `noteReference` / `note_reference`. Nested `beforeState.noteReference` is ignored.
- Contract activity details set `applicationReference: event.applicationId` — that is A, mislabeled as B.
- Onboarding details `target.id` = org UUID. Org `display_reference` is not shown. Name is the actor organisation field (snapshot).

---

## Catalogue disagreements (source wins)

| Claim in current catalogues | Source |
|---|---|
| Live count 138 / 139 including 11 gateway events | `OVERRIDE_PROPOSED` / `OVERRIDE_APPROVED` / `OVERRIDE_REJECTED` have **no writer**. `getOpenOverrideProposal` only reads. **8** live gateway types. |
| `FORM_FILLED` metadata is `section` | Live `handleWebhookUpdate` metadata is `requestId`, `status`, `substatus`, `payload`. Individual handler uses org/status/trigger keys. **`section` is not written.** |
| 13 onboarding live IDs | Same 13 remain live. Additional **live** writers exist: `WEBHOOK_APPROVED`, `WEBHOOK_REJECTED`, `WEBHOOK_PENDING_APPROVAL`, `WEBHOOK_IN_PROGRESS` in `regtank/service.ts` `handleWebhookUpdate`. Not in the 139 catalogue. Audited below as extra. |
| `origin-main-preservation-inventory.md` | Historical (`28ae5c58`). Forensic columns now exist (`target_id`, etc.). Do not use it as current metadata. |

---

## Event-by-event

Abbreviations in tables: **col** = top-level column; **tgt** = `target_id`; **meta** = metadata; **nested** = inside `beforeState`/`afterState`; **join** = live join at read/export; **page** = implied by the Admin page already open.

### 1. Access / Authentication — `access_logs`

| Raw ID | Status | Trigger | Canonical | A stored | A where | B available | B stored | B where | Org ID | Actor | C | before/after | Details A/B | CSV A/B | JSON A/B | Survive rename/delete | Assessment | Recommendation |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `LOGIN` | LIVE_UI | Cognito callback / failed admin gate | User | yes | col `user_id`; tgt | user_id (=PK); email | user_id yes; email **join** | col; export joins `user` | no | `user_id` | `stateId` (OAuth), not Cognito sub | no | yes / user_id | yes / User ID col; email join | yes / user_id + joined user | Delete cascades log. Email at export is live. | COMPLETE | Leave unchanged. Do not copy `user_id` into metadata. |
| `SIGNUP` | LIVE_UI | Same callback, first establishment | User | yes | same | same | same | same | no | `user_id` | `stateId` | no | yes | yes | yes | same | COMPLETE | Leave unchanged. |
| `LOGOUT` | LIVE_UI | Cognito logout + `AuthService.logout` | User | yes | same | same | same | same | no | `user_id` | no | no | yes | yes | yes | same | COMPLETE | Leave unchanged. Two writers; metadata keys differ (`roles` vs optional `activeRole`). |
| `PROFILE_UPDATED` | LIVE_UI | Admin `updateUserProfile` | Subject user | yes | meta `targetUserId`; tgt (not actor col) | user_id + email | yes | `targetUserId`, `targetUserEmail` | no | col `user_id` = admin | no | `previousValues` only | yes / yes | yes / yes | yes / yes | Email snapshotted | COMPLETE | Leave. Actor vs subject already split. |

### 2. Security / Roles — `security_logs`

| Raw ID | Status | Trigger | Canonical | A stored | A where | B available | B stored | B where | Org ID | Actor | C | before/after | Details A/B | CSV A/B | JSON A/B | Survive | Assessment | Recommendation |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `PASSWORD_CHANGED` | LIVE_UI | `changePassword` | User | yes | col + tgt | user_id | yes | col | no | subject | no | no | yes | yes | yes | yes | COMPLETE | Leave unchanged. |
| `EMAIL_VERIFIED` | LIVE_UI | `verifyEmail` | User | yes | col + tgt | user_id + email | yes | col; meta `email` | no | subject | no | no | yes | yes | yes | email snapshot | COMPLETE | Leave unchanged. |
| `ROLE_ADDED` | LIVE_UI | `addRole` / `acceptInvitation` | User | yes | col + tgt USER | user_id; `addedRole` | yes | col; meta | no | subject | invitation **token** on accept path, not invitation id | no | yes | yes | yes | yes | COMPLETE | Leave. Accept path does not store `AdminInvitation.id` (token only). |
| `ROLE_SWITCHED` | LIVE_UI | switch / deactivate / reactivate / role change | User | yes | col + tgt | user_id | yes | col | no | subject | no | previous/new status or role | yes | yes | yes | yes | COMPLETE | Leave. One raw ID; labels from metadata. |
| `ROLE_CREATED` | LIVE_UI | `createAdminRole` | `AdminRoleConfig` | **no cuid** | tgt = `roleKey` | key + name | yes | meta `roleKey`,`roleName` | no | creator | no | no | shows key as id | Target Reference = key | metadata | key snapshot; cuid never stored | INDIRECT_ONLY | Leave unless key-rename evidence is required. Do not duplicate `roleKey` into another column. |
| `ROLE_PERMISSIONS_UPDATED` | LIVE_UI | `updateAdminRolePermissions` | `AdminRoleConfig` | no cuid | tgt = `roleKey` | key | yes | meta | no | actor | no | previous/next permissions + badge | key not cuid | key | metadata | yes | INDIRECT_ONLY | Leave (same as ROLE_CREATED). |
| `ROLE_REMOVED` | LIVE_UI | `deleteAdminRole` | deleted role | no cuid | tgt = `deletedRoleKey` | key + name | yes | meta | no | deleter | no | no | key | key | metadata | name+key survive delete | INDIRECT_ONLY | Leave. Cuid of a deleted row is low value. |
| `INVITATION_REVOKED` | LIVE_UI | `revokeInvitation` | `AdminInvitation` | yes | meta `invitationId`; tgt | email (no display_reference) | yes | meta `email` | no | revoker | no | no | yes | yes | yes | email snapshot | COMPLETE | Leave unchanged. |
| `PROFILE_UPDATED` | LIVE_UI | self or admin override | User | yes | col + tgt | user_id | yes | col | no | subject | no | `previousValues` | yes | yes | yes | yes | COMPLETE | Leave. Distinct store from access `PROFILE_UPDATED`. |
| `PLATFORM_FINANCE_SETTINGS_UPDATED` | LIVE_UI | finance settings save | `PlatformFinanceSetting` | no cuid | tgt = `settingsKey` (`DEFAULT`) | key | yes | meta | no | actor | no | previousValues/nextValues | key | key | metadata | full value snapshot | INDIRECT_ONLY | Leave. Singleton key is the operational identity. |

### 3. Onboarding — `onboarding_logs`

UI org reference is `formatOrganizationReference({ displayReference, id })`. Writers snapshot **`organization_name`**, not `display_reference`. Org **cuid** is on `investor_organization_id` / `issuer_organization_id` and `target_id`.

JSON export does **not** include the org UUID columns (only `target_id` + name).

| Raw ID | Status | Trigger | Canonical | A stored | A where | B available | B stored | B where | Org ID | Actor | C | before/after | Details A/B | CSV A/B | JSON A/B | Survive | Assessment | Recommendation |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `ONBOARDING_STARTED` | LIVE_UI | start personal/corporate | Org + RegTank request | yes | org id cols + tgt; meta `organizationId` | `display_reference` + name | name yes; **display_reference no** | col `organization_name` | yes | applicant (`actor_user_id` ← subject) | meta `requestId` | `previousOrgStatus` (personal) | A yes; B name only | tgt=A; Organisation=name | tgt=A; name; **org cols omitted** | name snapshot; display_reference needs live join | TECHNICAL_ONLY | Snapshot `display_reference` if Ops must prove the UI reference historically. Do not duplicate org UUID into metadata (`organizationId` already copies the column). |
| `ONBOARDING_RESUMED` | LIVE_UI / LIVE_SYSTEM | resume / regen link | Org | yes | org cols + meta `organizationId` | same | name yes; display_reference no | name col | yes | subject | `previousRequestId`,`newRequestId` or `requestId` | previous* | A yes; B name | same | same | C snapshotted | TECHNICAL_ONLY | Same display_reference note. Keep request ids in metadata (C). |
| `ONBOARDING_CANCELLED` | LIVE_UI | Admin restart | Org + prior RegTank row | yes | org cols; meta `organizationId` | same | name yes | name col | yes | `cancelledBy` → `actor_user_id` if id-shaped | `cancelledRequestId`,`newRequestId`; meta `cancelledOnboardingId` | previousStatus | A yes; B name | same | same | yes | TECHNICAL_ONLY | Leave ids. Optional: snapshot org display_reference. |
| `ONBOARDING_REJECTED` | LIVE_WEBHOOK | individual handler | Org | yes | org cols | same | name yes | name | yes | webhook actor resolution | `requestId` | previous/new status | A yes; B name | same | same | yes | TECHNICAL_ONLY | Leave. |
| `COD_REJECTED` | LIVE_WEBHOOK | COD handler | Org | yes | org cols | same | name yes | name | yes | webhook | `requestId` | previous/new | A yes; B name | same | same | yes | TECHNICAL_ONLY | Leave. |
| `ONBOARDING_APPROVED` | LIVE_UI / LIVE_WEBHOOK | admin submission approve + webhook | Org | yes | org cols | same | name yes | name | yes | `approvedBy` when id-shaped | `regtankRequestId` or `requestId` | previous/new on webhook | A yes; B name | same | same | yes | TECHNICAL_ONLY | Leave. Not final approval. |
| `FINAL_APPROVAL_COMPLETED` | LIVE_UI | `completeFinalApproval` | Org | yes | org cols | same | name yes | name | yes | admin `actor_user_id` | `regtankRequestId` | no | A yes; B name | same | same | yes | TECHNICAL_ONLY | Leave. |
| `ONBOARDING_STATUS_UPDATED` | LIVE_UI / LIVE_WEBHOOK | many (portal access, COD, KYC, AML milestone) | Org | yes | org cols | same | name yes | name | yes | varies | KYC: `kycRequestId`,`onboardingRequestId`; KYB: `kybRequestId`; live KYC: **`kycId`**; COD: `codRequestId` / `requestId` | previous/new often | A yes; B name | same | same | C usually yes | TECHNICAL_ONLY | Leave trigger/status. Optional display_reference. Do not invent AML_APPROVED. Flag: KYC uses both `kycRequestId` and `kycId`. |
| `FORM_FILLED` | LIVE_WEBHOOK | RegTank status / individual liveness | Org + request | yes (org cols on both paths) | org cols; webhook meta **has no organizationId** (ids are columns only) | same | name yes | name | yes | subject | `requestId`; payload blob on service path | status/substatus | A via tgt; B name | same | same | payload may be large | TECHNICAL_ONLY | Do **not** add a `section` key (catalogues invented it). Optional: copy `organizationId` into metadata for payload-only readers. Org UUID is already a column. |
| `SSM_APPROVED` | LIVE_UI | `approveSsmVerification` | Org | yes | org cols; meta `organizationId` | same | name yes | name | yes | `approvedBy` | `regtankRequestId` | no | A yes; B name | same | same | yes | TECHNICAL_ONLY | Leave. |
| `TNC_APPROVED` | LIVE_UI | `acceptTnc` | Org + legal docs | yes | org cols; meta `organizationId` | same | name yes; also meta `organizationName` | name | yes | subject | no (legal ids in `legalDocumentsRequired`) | no | A yes; B name | same | same | yes | TECHNICAL_ONLY | Leave. Canonical accept evidence is `legal_document_acceptances`. |
| `SOPHISTICATED_STATUS_UPDATED` | LIVE_UI | admin or auto-grant | Investor org | yes | `investor_organization_id`; meta `organizationId` | same | name yes | name | yes | `updatedBy` | no | previous/new status+reason | A yes; B name | same | same | yes | TECHNICAL_ONLY | Leave. |
| `PROFILE_UPDATED` | LIVE_UI | admin org profile | Org | yes | org cols | same | name yes (may be the **new** name) | name col | yes | admin `actor_user_id` | no | `previousValues` name/phone/address | A yes; B name | same | same | previous name snapshotted | TECHNICAL_ONLY | Leave. display_reference still not stored. |

**Extra live writers (not in 139 catalogue)** — same store, same A/B pattern as `FORM_FILLED` service path (`requestId`,`status`,`substatus`,`payload`): `WEBHOOK_APPROVED`, `WEBHOOK_REJECTED`, `WEBHOOK_PENDING_APPROVAL`, `WEBHOOK_IN_PROGRESS`. Assessment: TECHNICAL_ONLY.

### 4. Applications — `application_logs`

**No writer snapshots `applications.display_reference`.** Admin lists use that as B. Timeline CSV Target Reference is a **DB id**. Event Details do not show `application_id` as a labelled field.

Review events: A for the application is `application_id`; section/item identity is `scope_key` / `entity_id` (not a table PK for sections).

| Raw ID | Status | Trigger | Canonical | A stored | A where | B available | B stored | B where | Org ID | Actor | C | before/after | Details A/B | CSV A/B | JSON | Survive | Assessment | Recommendation |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `APPLICATION_CREATED` | LIVE_UI | create draft | Application | yes | col `application_id`; tgt | `display_reference` | **no** | — | no | issuer `user_id` | no | no | A only as tgt if APPLICATION; **B no** | A as Target Reference; **B no** | none | B needs live join; rename breaks Ops reading the log alone | TECHNICAL_ONLY | Snapshot `display_reference` into metadata once (not a new column). Do not copy `application_id` into metadata. |
| `APPLICATION_SUBMITTED` | LIVE_UI | first submit | Application | yes | col | display_reference | no | — | no | issuer | no | no | same | same | none | same | TECHNICAL_ONLY | Same snapshot. |
| `APPLICATION_RESUBMITTED` | LIVE_UI | issuer resubmit (controller + amendments service) | Application | yes | col | display_reference | no | — | no | issuer | no | optional `resubmit_changes` | same | same | none | same | TECHNICAL_ONLY | Same. Amendments path metadata has remarks, not refs. |
| `AMENDMENTS_SUBMITTED` | LIVE_UI | Admin send amendment batch | Application | yes | col | display_reference | no | — | no | admin | no | no (count only) | same | same | none | same | TECHNICAL_ONLY | Same. |
| `APPLICATION_REJECTED` | LIVE_UI | reject | Application | yes | col | display_reference | no | — | no | admin | no | no | same | same | none | same | TECHNICAL_ONLY | Same. |
| `APPLICATION_WITHDRAWN` | LIVE_UI | cancel / contract withdraw / invoice cascade | Application | yes | col | display_reference | no | — | no | issuer | no | no | same | same | none | same | TECHNICAL_ONLY | Same. |
| `APPLICATION_COMPLETED` | LIVE_UI | offer accept completes app | Application | yes | col | display_reference | no | — | no | issuer | no | no | same | same | none | same | TECHNICAL_ONLY | Same. |
| `APPLICATION_RESET_TO_UNDER_REVIEW` | LIVE_UI | admin status | Application | yes | col | display_reference | no | — | no | admin | no | `previous_status` | same | same | none | same | TECHNICAL_ONLY | Same. |
| `SECTION_REVIEWED_*` (4 IDs) | LIVE_UI / LIVE_SYSTEM | `logReviewActivity` + CTOS reset for PENDING | Application section | yes app col; section key in meta `scope_key` | col + meta; tgt = scope_key | display_reference | no | — | no | reviewer / `system` | no | old_status/new_status | tgt=scope_key; B no; **application_id hidden in details** | tgt=scope_key | none | section key is stable; app B live | TECHNICAL_ONLY | Snapshot app display_reference. Details should label `application_id` (already a column). |
| `ITEM_REVIEWED_*` (4 IDs) | LIVE_UI | `logReviewActivity` item | Review item | yes app col; `entity_id`=`scope_key` | col + entity_id | display_reference | no | — | no | reviewer | no | old/new status | tgt=item key; B no | tgt=entity_id | none | same | TECHNICAL_ONLY | Same. |

### 5. Facility / Contract — `application_logs`

Contract B in UI is `contracts.display_reference`. Writers sometimes store `contract_number` from JSON `contract_details.number` (mutable; **not** the same field as `display_reference`).

| Raw ID | Status | Trigger | Canonical | A stored | A where | B available | B stored | B where | Org ID | Actor | C | before/after | Details A/B | CSV A/B | Survive | Assessment | Recommendation |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `CONTRACT_OFFER_SENT` | LIVE_UI | send offer | Contract | yes | `entity_id`; meta `contract_id`; tgt | display_reference; number | number sometimes | meta `contract_number` | no | admin | no | no | A yes; B number not display_reference | A | B incomplete if number changes | TECHNICAL_ONLY | Snapshot `display_reference`. Keep `contract_id` in meta **or** rely on `entity_id`/`target_id` — do not add a third copy. |
| `CONTRACT_OFFER_ACCEPTANCE_SUBMITTED` | LIVE_UI | issuer step 1 | Contract | yes | entity_id + meta `contract_id` | same | number sometimes | `contract_number` | no | issuer | no | no | A yes | A | same | TECHNICAL_ONLY | Same. |
| `CONTRACT_OFFER_ACCEPTANCE_RESUBMITTED` | LIVE_UI | resubmit after changes | Contract | yes | same | same | number sometimes | same | no | issuer | no | no | A yes | A | same | TECHNICAL_ONLY | Same. |
| `CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING` | LIVE_UI | auto or admin sync | Contract | yes | entity_id; meta `contract_id` (sync path **only** `contract_id`) | same | number only on auto path | optional `contract_number` | no | issuer/admin | no | no | A yes | A | sync path has no number | TECHNICAL_ONLY | Same. |
| `CONTRACT_OFFER_ACCEPTED` | LIVE_UI | issuer accept | Contract | yes | entity_id + meta | same | number sometimes | `contract_number` | no | issuer | no | no | A yes | A | same | TECHNICAL_ONLY | Same. **Not signing.** |
| `CONTRACT_OFFER_DECLINED` | LIVE_UI | issuer decline | Contract | yes | same | same | number sometimes | same | no | issuer | no | no | A yes | A | same | TECHNICAL_ONLY | Same. |
| `CONTRACT_OFFER_RETRACTED` | LIVE_UI | retract offer | Contract | yes | entity_id + meta | same | number sometimes | same | no | admin | no | no | A yes | A | same | TECHNICAL_ONLY | Same. |
| `CONTRACT_OFFER_EXPIRED` | LIVE_SYSTEM | expiry job | Contract | yes | entity_id; meta `contract_id` | display_reference | **no number on this writer** | — | no | system | no | no | A yes; B no | A | worse than send-offer | TECHNICAL_ONLY | Snapshot display_reference. |
| `CONTRACT_SIGNING_DEADLINE_EXTENDED` | LIVE_UI | admin restamp | Contract | yes | entity_id; meta `contract_id` | display_reference | no | — | no | admin | no | no | A yes | A | same | TECHNICAL_ONLY | Same. |
| `CONTRACT_FACILITY_OCCUPANCY_UPDATED` | LIVE_SYSTEM | occupancy refresh | Contract (+ optional note/invoice) | yes contract; optional `note_id`,`invoice_id` in meta | entity_id; meta; tgt CONTRACT | display refs | no | — | no | system | no | `before`/`after` occupancy | A contract yes | A | occupancy snapshot survives | TECHNICAL_ONLY | Leave occupancy snapshot. Optional display_reference. `application_id` may be null — that is current. |
| `CONTRACT_FACILITY_FEE_WAIVED` | LIVE_UI | waive fee | Contract | yes | entity_id; meta `contract_id`; `application_id` may be originating app | display_reference | no | — | no | admin | no | amounts in meta | A yes | A | yes | TECHNICAL_ONLY | Same. |
| `CONTRACT_FACILITY_DISABLED` | LIVE_UI | disable | Contract | yes | same | display_reference | no | — | no | admin | no | `enabled`,`reason` | A yes | A | yes | TECHNICAL_ONLY | Same. |
| `CONTRACT_FACILITY_ENABLED` | LIVE_UI | enable | Contract | yes | same | display_reference | no | — | no | admin | no | `enabled` | A yes | A | yes | TECHNICAL_ONLY | Same. |
| `CONTRACT_CUSTOMER_LARGE_PRIVATE_UPDATED` | LIVE_UI | `patchContractCustomerLargePrivateCompany` | Contract (flag on customer) | **application only** | col `application_id`; **no `entity_id`; no `contract_id`**; tgt falls back to **application id** | display_reference | no | — | no | admin | no | `is_large_private_company` only | tgt is app id, labeled CONTRACT | tgt=app id | **wrong entity on tgt** | MISSING (contract A) | **Fix first:** set `entity_id`/`metadata.contract_id` to the contract PK. Do not use application id as contract target. |

### 6. Invoice offer — `application_logs`

Invoice UI B is `invoices.display_reference`. Metadata `invoice_number` is `details.number` with fallback to `display_reference` **at write time** on some paths (value stored under the key `invoice_number`, not `display_reference`).

| Raw ID | Status | Trigger | Canonical | A stored | A where | B available | B stored | B where | Org ID | Actor | C | Details A/B | CSV | Survive | Assessment | Recommendation |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `INVOICE_OFFER_SENT` | LIVE_UI | send invoice offer | Invoice | yes | entity_id; meta `invoice_id`; tgt | display_reference / details.number | yes as `invoice_number` | meta | no | admin | no | A yes; B as invoice_number | A + meta | number may later change in details JSON | TECHNICAL_ONLY | Prefer snapshotting `display_reference` under its own key. Keep `invoice_id`. |
| `INVOICE_OFFER_ACCEPTANCE_SUBMITTED` | LIVE_UI | step 1 | Invoice | yes | same | same | optional `invoice_number` | meta | no | issuer | no | A yes | A | same | TECHNICAL_ONLY | Same. |
| `INVOICE_OFFER_ACCEPTANCE_RESUBMITTED` | LIVE_UI | resubmit | Invoice | yes | same | same | optional | meta | no | issuer | no | A yes | A | same | TECHNICAL_ONLY | Same. |
| `INVOICE_ACCEPTANCE_APPROVED_FOR_SIGNING` | LIVE_UI | auto or admin | Invoice | yes | entity_id; meta `invoice_id` (sync: id only) | same | optional on auto | meta | no | issuer/admin | no | A yes | A | sync path no B | TECHNICAL_ONLY | Same. |
| `INVOICE_OFFER_ACCEPTED` | LIVE_UI | accept | Invoice | yes | same | same | optional `invoice_number` | meta | no | issuer | no | A yes | A | same | TECHNICAL_ONLY | Same. |
| `INVOICE_OFFER_REJECTED` | LIVE_UI | decline | Invoice | yes | same | same | optional | meta | no | issuer | no | A yes | A | same | TECHNICAL_ONLY | Same. Live ID is REJECTED, display Declined. |
| `INVOICE_OFFER_RETRACTED` | LIVE_UI | retract | Invoice | yes | entity_id + optional meta | same | optional | meta | no | admin | no | A yes | A | same | TECHNICAL_ONLY | Same. |
| `INVOICE_OFFER_EXPIRED` | LIVE_SYSTEM | expiry job | Invoice | yes | entity_id; meta `invoice_id` | display_reference | **no** | — | no | system | no | A yes; B no | A | worse | TECHNICAL_ONLY | Snapshot display_reference. |
| `INVOICE_SIGNING_DEADLINE_EXTENDED` | LIVE_UI | restamp | Invoice | yes | entity_id; meta `invoice_id` | display_reference | no | — | no | admin | no | A yes | A | same | TECHNICAL_ONLY | Same. |
| `INVOICE_WITHDRAWN` | LIVE_UI | withdraw invoice | Invoice | yes | entity_id; meta `invoice_id` | same | optional `invoice_number` | meta | no | issuer | no | A yes | A | same | TECHNICAL_ONLY | Same. |

### 7. Signing — `application_logs`

| Raw ID | Status | Trigger | Canonical | A stored | A where | B available | B stored | B where | Org ID | Actor | C | Details A/B | CSV | Survive | Assessment | Recommendation |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `SIGNING_PACKAGE_CREATED` | LIVE_UI | `createIssuerEnvelope` | `SigningEnvelope` | yes | `entity_id`; meta `envelope_id`; tgt | no display_reference column | n/a (title optional) | meta `envelope_title?` | no | admin | **`provider_ref` not written** | envelope id; envelopeId picked as envelopeReference | A | A survives; C only on envelope row (live join) | TECHNICAL_ONLY | Snapshot `provider_ref` (C) on send/complete at least. Do not duplicate envelope id (already entity_id). |
| `SIGNING_PACKAGE_SENT` | LIVE_UI | `sendEnvelope` | Envelope | yes | same | title | optional title | meta | no | creator only if `created_by_user_id` | provider_ref **not** in event | A | A | C join | TECHNICAL_ONLY | Same. |
| `SIGNING_PACKAGE_COMPLETED` | LIVE_UI | envelope COMPLETED | Envelope | yes | same | n/a | title optional | meta | no | if creator | provider_ref not in event | A | A | C join | TECHNICAL_ONLY | Same. This is the signing completion event. |
| `SIGNING_PACKAGE_VOIDED` | LIVE_UI | decline rollup / void | Envelope | yes | same | n/a | title optional; `void_reason` | meta | no | actor | provider_ref not in event | A | A | C join | TECHNICAL_ONLY | Same. |

### 8. Notes — `note_events`

Top-level `note_id` is always A for the note (except nested create still has `note_id` on the row). **Do not copy `note_id` into metadata** when the column exists.

`mapNoteListItem` includes `noteReference`. Admin-action **mirrors** store that inside `beforeState`/`afterState`. Event Details and CSV **do not read nested** `noteReference`.

| Raw ID | Status | Trigger | Canonical | A stored | A where | B available | B stored | B where | Org ID | Actor | C | before/after | Details A/B | CSV A/B | Survive | Assessment | Recommendation |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `NOTE_CREATED_FROM_INVOICE` | LIVE_UI | `createFromInvoiceSource` nested create | Note | yes | col `note_id` only; **forensic tgt/actor/source null** | `note_reference` | **no** | — | no | not on forensic cols | no | no (admin sibling CREATE_FROM_INVOICE has after_state status/invoiceId) | tgt empty; B no; meta has `applicationId`,`invoiceId` (A of others) | falls back to `noteId` | note_id survives; B live join | TECHNICAL_ONLY | Use `createNoteEventRow` so tgt=`note_id`. Optional snapshot `noteReference`. Keep invoice/application ids in meta (those are not the note column). |
| `UPDATE_DRAFT` | LIVE_UI | `logAdminAction` mirror | Note | yes | col + tgt NOTE | note_reference | nested | `beforeState.noteReference` | no | admin | no | full list-item DTO | A yes; **B hidden** (nested) | Target Reference = note_id (nested B ignored) | nested B survives | COMPLETE | Leave storage. Optional Details/CSV read nested `noteReference` — UI-only, no writer change required for evidence. |
| `UPDATE_FEATURED_SETTINGS` | LIVE_UI | same | Note | yes | col + tgt | note_reference | nested | same | no | admin | no | DTO | A yes; B hidden | note_id | yes | COMPLETE | Same. |
| `UNPUBLISH` | LIVE_UI | same | Note | yes | col + tgt | note_reference | nested | same | no | admin | no | DTO | A yes; B hidden | note_id | yes | COMPLETE | Same. |
| `PAUSE_LISTING` | LIVE_UI | same | Note | yes | col + tgt | note_reference | nested | same | no | admin | no | DTO | A yes; B hidden | note_id | yes | COMPLETE | Same. |
| `RESUME_LISTING` | LIVE_UI | same | Note | yes | col + tgt | note_reference | nested | same | no | admin | no | DTO | A yes; B hidden | note_id | yes | COMPLETE | Same. |
| `PROSPECTUS_REVIEW_CREATE` | LIVE_UI | prospectus helper | Prospectus review | note A yes; review id in afterState.id | col note; tgt **NOTE_PROSPECTUS / noteId** (not review id) | note_reference | no | — | no | admin | no | afterState mapReview | A note; review id nested | note_id | review id nested | TECHNICAL_ONLY | Optional: tgt=`review.id`. Do not duplicate note_id. |
| `PROSPECTUS_REVIEW_DRAFT_UPDATE` | LIVE_UI | saveDraft | Review | same | same | note_reference | no | — | no | admin | no | before/after mapReview | same | note_id | yes | TECHNICAL_ONLY | Same. |
| `PROSPECTUS_REVIEW_APPROVE` | LIVE_UI | approve | Review + publication | note A; publication ids in afterState | col; tgt noteId | note_reference | no | — | no | admin | no | + publication ids | same | note_id | publication ids nested | TECHNICAL_ONLY | Same. |
| `PROSPECTUS_APPROVAL_INVALIDATED_EDIT` | LIVE_UI | edit after approve | Review | same | same | note_reference | no | — | no | admin | no | mapReview | same | note_id | yes | TECHNICAL_ONLY | Same. |
| `PROSPECTUS_APPROVAL_INVALIDATED_SOURCE` | LIVE_UI | fingerprint drift | Review | same | same | note_reference | no | — | no | system/admin | no | mapReview | same | note_id | yes | TECHNICAL_ONLY | Same. |
| `PROSPECTUS_APPROVAL_INVALIDATED_UNPUBLISH` | LIVE_UI | unpublish reopen | Review | same | same | note_reference | no | — | no | admin | no | mapReview + previous publication | same | note_id | yes | TECHNICAL_ONLY | Same. |
| `WAIVE_FACILITY_FEE_COLLECTION` | LIVE_UI | admin mirror | Note | yes | col + tgt | note_reference | nested | before/after DTO | no | admin | no | DTO | A yes; B nested | note_id | yes | COMPLETE | Leave (pair with the logEvent row). |
| `NOTE_FACILITY_FEE_COLLECTION_WAIVED` | LIVE_UI | `logEvent` same flow | Note | yes | col + tgt | note_reference | **no** | meta `{ reason }` only | no | admin | no | no | A yes; B no | note_id | reason only | TECHNICAL_ONLY | Optional `noteReference` on this row. Do not add note_id to meta. |
| `FACILITY_OCCUPANCY_UPDATED` | LIVE_SYSTEM | occupancy refresh | Note + contract | yes both | col `note_id`; tgt **CONTRACT** / `contractId`; meta ids | note + contract display refs | no | — | no | system | no | occupancy before/after | A yes (contract tgt); B no | tgt=contract id | occupancy snapshot | TECHNICAL_ONLY | Leave occupancy. Optional display refs. Distinct from application_logs occupancy. |
| `NOTE_DEFAULT_MARKED` | LIVE_UI | mark default | Note | yes | col + tgt | note_reference | **no** | `{ reason }` | no | admin | no | no | A yes; B no | note_id | reason | TECHNICAL_ONLY | Optional snapshot `noteReference`. |
| `ARREARS_LETTER_GENERATED` | LIVE_UI | generate letter | Letter object + note | yes note | col; tgt NOTE | note_reference | **no** | `{ s3Key }` | no | admin | no | no | A yes; B no | note_id | s3Key is file evidence | TECHNICAL_ONLY | Optional `noteReference`. s3Key is enough for the file. |
| `DEFAULT_LETTER_GENERATED` | LIVE_UI | generate letter | same | yes | col | note_reference | no | `{ s3Key }` | no | admin | no | no | A yes; B no | note_id | same | TECHNICAL_ONLY | Same. |

### 9. Funding / Investment — `note_events`

| Raw ID | Status | Trigger | Canonical | A stored | A where | B available | B stored | B where | Org ID | Actor | C | before/after | Details A/B | CSV | Survive | Assessment | Recommendation |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `PUBLISH` | LIVE_UI | `logAdminAction` | Note | yes | col + tgt | note_reference | nested | DTO | no | admin | no | DTO | A; B nested | note_id | yes | COMPLETE | Leave. |
| `CLOSE_FUNDING` | LIVE_UI / LIVE_SYSTEM | admin mirror | Note | yes | col + tgt | note_reference | nested | DTO | no | admin | no | DTO | A; B nested | note_id | yes | COMPLETE | Leave. |
| `FAIL_FUNDING` | LIVE_SYSTEM | admin mirror | Note | yes | col + tgt | note_reference | nested | DTO | no | admin | no | DTO | A; B nested | note_id | yes | COMPLETE | Leave. |
| `INVESTMENT_COMMITTED` | LIVE_UI | `createInvestment` | `NoteInvestment` | yes | meta `investmentId`; tgt NOTE_INVESTMENT | **no display_reference column** | n/a | — | meta `investorOrganizationId` | investor | no | no | A investment; B n/a | tgt=investmentId | A yes | COMPLETE | Leave. Do not invent an investment reference. Org id is in metadata (not a note_events org column). |
| `ACTIVATE` | LIVE_UI / LIVE_SYSTEM | admin mirror | Note | yes | col + tgt | note_reference | nested | DTO | no | admin | no | DTO | A; B nested | note_id | yes | COMPLETE | Leave. |

### 10. Repayment / Settlement — `note_events`

`NotePayment.reference` is optional bank/advice text. `NoteSettlement.display_reference` exists.

| Raw ID | Status | Trigger | Canonical | A stored | A where | B available | B stored | B where | Org ID | Actor | C | before/after | Details A/B | CSV | Survive | Assessment | Recommendation |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `ISSUER_PAYMENT_SUBMITTED` | LIVE_UI | recordPayment issuer | `NotePayment` | yes | meta `paymentId`; tgt NOTE_PAYMENT | optional `reference` | only if in input | meta `reference` | no | issuer | no | input snapshot | A yes; B if present | tgt=paymentId | paymentId | COMPLETE if no payment display ref required; else TECHNICAL_ONLY when reference omitted | Leave. Canonical amount is `note_payments`. |
| `PAYMENT_RECEIVED` | LIVE_UI | recordPayment | `NotePayment` | yes | `paymentId`; tgt | optional reference | if in input | meta | no | admin/system | no | input | A yes | paymentId | yes | COMPLETE / TECHNICAL_ONLY | Leave. Distinct from APPROVED. |
| `PAYMENT_APPROVED` | LIVE_UI | approvePayment | `NotePayment` | yes | `{ paymentId }` tgt | reference | **no** | — | no | admin | no | no | A yes; B no | paymentId | A only | TECHNICAL_ONLY | Optional copy reference from `note_payments` at write. Do not duplicate paymentId (already tgt). |
| `PAYMENT_REJECTED` | LIVE_UI | rejectPayment | `NotePayment` | yes | paymentId + reason | reference | no | — | no | admin | no | no | A yes | paymentId | yes | TECHNICAL_ONLY | Same. |
| `SETTLEMENT_PREVIEWED` | LIVE_UI | preview | `NoteSettlement` | yes | `settlementId`; tgt | display_reference | **no** | waterfall snapshot | no | admin | no | large snapshot | A yes; B no | settlementId | snapshot | TECHNICAL_ONLY | Optional `display_reference`. Snapshot already preserves amounts. |
| `SETTLEMENT_APPROVED` | LIVE_UI | approve | Settlement | yes | `{ settlementId }` | display_reference | no | — | no | admin | no | no | A yes | settlementId | A only | TECHNICAL_ONLY | Optional display_reference. |
| `SETTLEMENT_POSTED` | LIVE_UI | post | Settlement | yes | settlementId + counts | display_reference | no | — | no | admin | no | no | A yes | settlementId | A | TECHNICAL_ONLY | Same. |
| `OVERDUE_LATE_CHARGE_CHECKED` | LIVE_UI | apply overdue | Note (check result) | note A only | col; tgt NOTE (no late-charge table id) | note_reference | no | check payload | no | admin/system | no | result fields | A note; B no | note_id | payload | TECHNICAL_ONLY | Leave payload. Optional noteReference. |
| `LATE_CHARGE_APPROVED` | LIVE_UI | approve late charge | Note | note A | col; tgt NOTE | note_reference | no | amounts | no | admin | no | no | A note | note_id | amounts | TECHNICAL_ONLY | Same. |
| `SETTLEMENT_TRUSTEE_LETTER_GENERATED` | LIVE_UI | generate | Settlement + letter | yes | meta `settlementId`; s3Key; tgt settlement | display_reference | no | — | no | admin | no | no | A yes; B no | settlementId | s3Key | TECHNICAL_ONLY | Optional display_reference. |
| `SETTLEMENT_TRUSTEE_LETTER_SUBMITTED` | LIVE_UI | mark submitted | Settlement | yes | `{ settlementId }` | display_reference | no | — | no | admin | no | no | A yes | settlementId | A | TECHNICAL_ONLY | Same. |
| `SETTLEMENT_TRUSTEE_INSTRUCTION_COMPLETED` | LIVE_UI | mark completed | Settlement | yes | settlementId + completedAt | display_reference | no | — | no | admin | no | no | A yes | settlementId | A | TECHNICAL_ONLY | Same. |
| `SETTLEMENT_TRUSTEE_EMAIL_SENT` | LIVE_UI | send/resend | Settlement | yes | settlementId; optional `settlementReference`; messageId | display_reference | **sometimes** | meta `settlementReference` | no | admin | email `messageId` | no | A yes; B if key present | prefers settlementReference | C messageId | COMPLETE when reference written; else TECHNICAL_ONLY | Always pass `settlementReference` on send and resend. |

### 11. Withdrawals / Disbursement — `note_events`

| Raw ID | Status | Trigger | Canonical | A stored | A where | B available | B stored | B where | Org ID | Actor | C | Details A/B | CSV | Survive | Assessment | Recommendation |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `ISSUER_DISBURSEMENT_WITHDRAWAL_CREATED` | LIVE_UI | closeFunding when new instruction | `WithdrawalInstruction` | **no withdrawal id** | tgt intended WITHDRAWAL but **falls back to noteId**; meta is fee amounts only | `display_reference` | **no** | — | no | admin | no | no | tgt is **note id** | Target Reference = note_id | **cannot identify the withdrawal from the event** | MISSING | **Fix first:** `withdrawalId` + `withdrawalReference` (same keys as later withdrawal events). |
| `WITHDRAWAL_LETTER_GENERATED` | LIVE_UI | generate letter | Withdrawal | yes | meta `withdrawalId`; tgt WITHDRAWAL | display_reference | **no** | s3Key | no | admin | no | no | A yes; B no | withdrawalId | A + file | TECHNICAL_ONLY | Add `withdrawalReference` (already used elsewhere). |
| `WITHDRAWAL_SUBMITTED_TO_TRUSTEE` | LIVE_UI | mark submitted | Withdrawal | yes | `withdrawalId`; tgt | display_reference | yes | `withdrawalReference` | no | admin | no | no | A+B | B preferred in CSV | yes | COMPLETE | Leave unchanged. |
| `WITHDRAWAL_BENEFICIARY_UPDATED` | LIVE_UI | update beneficiary | Withdrawal | yes | `{ withdrawalId }` tgt | display_reference | no | — | no | admin | no | **not in event** (canonical JSON on instruction row) | A yes; B no | withdrawalId | A only | TECHNICAL_ONLY | Optional reference. Canonical beneficiary is `withdrawal_instructions.beneficiary_snapshot`. |
| `WITHDRAWAL_COMPLETED` | LIVE_UI | complete | Withdrawal | yes | withdrawalId; tgt | display_reference | yes | withdrawalReference + type + amount | no | admin | no | no | A+B | B | yes | COMPLETE | Leave unchanged. |
| `WITHDRAWAL_TRUSTEE_EMAIL_SENT` | LIVE_UI | send/resend | Withdrawal | yes | withdrawalId; optional reference; messageId | display_reference | optional | withdrawalReference | no | admin | messageId | no | A; B if present | B if present | C | COMPLETE when reference passed | Always include `withdrawalReference` (resend path already can). |
| `SHORAKA_ORDER_SUBMITTED` | LIVE_SYSTEM | first STP create | `ShorakaTradeOrder` | **no cuid** | tgt = `provider_order_id` (C) | n/a | n/a | — | no | system | **yes** `provider_order_id` + amounts/dates | no | C shown as tgt id | C | C unique → join to row | INDIRECT_ONLY | Optional store `shoraka_trade_orders.id`. Do **not** treat provider id as CashSouk PK. Certificate not on this event. |
| `SHORAKA_CERTIFICATE_FETCHED` | LIVE_SYSTEM | fetch cert | Trade order + cert file | no cuid | tgt = provider_order_id | n/a | n/a | flags only | no | system | `provider_order_id`; **not** s3 key / `provider_certificate_id` / hash | no | C | C | file evidence is on trade order row (join) | INDIRECT_ONLY | Optional snapshot `certificate_file_sha256` / s3 key. Provider order id is enough to join. |

### 12. Legal documents — `legal_document_audit_logs`

| Raw ID | Status | Trigger | Canonical | A stored | A where | B available | B stored | B where | Org ID | Actor | C | before/after | Details A/B | CSV A/B | JSON | Survive | Assessment | Recommendation |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `LEGAL_DOCUMENT_CREATED` | LIVE_UI | create definition | Legal document | yes | col `legal_document_id`; tgt | type (enum) + title in after_json | yes | `document_type`; after_json title | n/a | actor_user_id + name/email snapshot | hash n/a yet | after_json | A+type+version cols | Document type label; Document ID; Audit ID | yes | COMPLETE | Leave. Title in after_json. |
| `LEGAL_DOCUMENT_UPDATED` | LIVE_UI | update definition | Document | yes | cols | type + changed fields | yes | type; before/after json | n/a | snapshots | no | changed keys only | yes | yes | yes | COMPLETE | Leave. |
| `LEGAL_VERSION_UPLOADED` | LIVE_UI | upload version | Version | yes | `legal_document_version_id` + document id | type + version_number | yes | cols + after_json version/file | n/a | snapshots | file_hash | after_json | A+B+hash | version id/number/hash | yes | COMPLETE | Leave. Distinct from Document Created. |
| `LEGAL_VERSION_FILE_REPLACED` | LIVE_UI | replace draft PDF | Version | yes | version id | type + number | yes | cols | n/a | snapshots | hashes | file_name/hash | yes | yes | yes | COMPLETE | Leave. |
| `LEGAL_VERSION_PUBLISHED` | LIVE_UI | publish | Version | yes | ids | type + number | yes | cols | n/a | snapshots | hash | status/reacceptance | yes | yes | yes | COMPLETE | Leave. |
| `LEGAL_VERSION_ARCHIVED` | LIVE_UI | archive / auto | Version | yes | ids | type + number | yes | cols | n/a | snapshots | no | status | yes | yes | yes | COMPLETE | Leave. `reason` is a column. |
| `LEGAL_VERSION_RESTORED` | LIVE_UI | restore | Version | yes | ids | type + number | yes | cols | n/a | snapshots | no | status/restored_as | yes | yes | yes | COMPLETE | Leave. |

### 13. Legal acceptances — `legal_document_acceptances` (status snapshots)

| Status ID | Status | Trigger | Canonical | A stored | A where | B available | B stored | B where | Org ID | Actor | C | Details | CSV/JSON | Survive | Assessment | Recommendation |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `NOT_OPENED` | default | no writer | Acceptance row may not exist | n/a | — | n/a | n/a | — | n/a | n/a | n/a | computed absence | n/a | n/a | NOT_APPLICABLE | Leave. Not an event. |
| `OPENED` | LIVE_UI | `recordOpened` | Acceptance | yes | version id, document id, user_id, organization_id | type, version_number, org name, user email/name | yes | snapshot columns | yes + name snapshot | user_id | document_hash | dedicated sheet (User ID = 5-letter) | yes | snapshots | COMPLETE | Leave unchanged. |
| `ACCEPTED` | LIVE_UI | `recordAccepted` | Acceptance | yes | same | same + acknowledgement_text | yes | columns | yes | user_id | hash | yes | yes | snapshots | COMPLETE | Leave unchanged. |

### 14. Products — `product_logs`

| Raw ID | Status | Trigger | Canonical | A stored | A where | B available | B stored | B where | Org ID | Actor | C | before/after | Details A/B | CSV A/B | JSON | Survive | Assessment | Recommendation |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `PRODUCT_CREATED` | LIVE_UI | create | Product | yes | col `product_id`; tgt | name in workflow JSON (no name column) | yes | metadata.workflow snapshot | n/a | admin | `product_code` in meta | full snapshot not diff | Product ID + name from snapshot | Product ID + Product Name | yes (redacted meta) | COMPLETE | Leave. Do not live-join product name. |
| `PRODUCT_UPDATED` | LIVE_UI | update | Product | yes | same | name in snapshot | yes | workflow | n/a | admin | code; `replaced_product_id` | snapshot | yes | yes | yes | COMPLETE | Leave. |
| `PRODUCT_DELETED` | LIVE_UI | delete | Product | yes | same | name in snapshot | yes | workflow (no fee/code keys) | n/a | admin | no | snapshot | yes | yes | yes | COMPLETE | Leave. Name still in workflow. |

### 15. Gateway / Payments — `gateway_payment_events`

`GatewayPayment` has **no** display_reference. A = `gateway_payments.id`. C = `curlec_order_id` / `curlec_payment_id` on the **parent** row. Event Details look for metadata `gatewayReference` / `curlecPaymentId` / `paymentReference` — often empty; then only `targetId`.

`OVERRIDE_*`: **no live writer** (enum + reader only). Not in the live table.

| Raw ID | Status | Trigger | Canonical | A stored | A where | B available | B stored | B where | Org ID | Actor | C | Details A/B | CSV | Survive | Assessment | Recommendation |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `NAME_CHECK` | LIVE_SYSTEM | pend name check | Gateway payment | yes | col + tgt | none | n/a | optional score meta | join parent | system | on **parent** row, not always event meta | A yes; C join | tgt=payment UUID | parent holds C | COMPLETE | Leave. Anchor `gateway_payment_id` is enough. Do not copy it into metadata. |
| `NAME_CHECK_APPROVED` | LIVE_UI | approve | Gateway payment | yes | col + tgt | n/a | n/a | none | join | admin | parent | A | tgt | parent | COMPLETE | Leave. |
| `NAME_CHECK_REJECTED` | LIVE_UI | reject | Gateway payment | yes | col + tgt | n/a | n/a | reason column | join | admin | parent | A | tgt | parent | COMPLETE | Leave. |
| `CAPTURE_MISMATCH` | LIVE_SYSTEM | webhook / amount mismatch | Gateway payment | yes | col + tgt | n/a | n/a | mismatch fields | join | system | **yes in meta** (`curlecOrderId`,`curlecPaymentId` on some paths) | A+C | tgt + meta | C in event or parent | COMPLETE | Leave. Two writers; keys differ slightly (`source: automatic` on one). |
| `EXPIRED` | LIVE_SYSTEM | stuck-order poller | Gateway payment | yes | col + tgt | n/a | n/a | none | join | system | parent | A | tgt | parent | COMPLETE | Leave. |
| `REFUND_INITIATED` | LIVE_UI / LIVE_SYSTEM | several refund paths | Gateway payment + Curlec refund | yes | col + tgt | n/a | n/a | variant meta incl. `refundId` | join | admin or system | `refundId` often | A+C | tgt + meta | C | COMPLETE | Leave. Do not unify keys without a product reason (`event` discriminator is current). |
| `REFUNDED` | LIVE_SYSTEM | complete refund | Gateway payment | yes | col + tgt | n/a | n/a | refundId, purpose | join | system | refundId | A+C | tgt | C | COMPLETE | Leave. |
| `REFUND_WALLET_REVERSAL_FAILED` | LIVE_SYSTEM | wallet reversal failure | Gateway payment | yes | col + tgt | n/a | n/a | variant meta | join | system | refundId | A+C | tgt | C | COMPLETE | Leave. |

### 16. Notifications / broadcasts

`notification_logs` are delivery batches, not business events. Related refs in metadata (`noteId`,`applicationId`,`targetId`) are **untyped** (`notificationRelatedReference` tries those keys). Out of event-writer scope.

---

## B. Gap summaries

### 1. EVENTS MISSING REAL DB ID (A)

| Raw ID | Store | What’s missing | What is stored instead |
|---|---|---|---|
| `CONTRACT_CUSTOMER_LARGE_PRIVATE_UPDATED` | `application_logs` | `contracts.id` | `application_id` used as `target_id` |
| `ISSUER_DISBURSEMENT_WITHDRAWAL_CREATED` | `note_events` | `withdrawal_instructions.id` | note_id fallback |
| `ROLE_CREATED` / `ROLE_PERMISSIONS_UPDATED` / `ROLE_REMOVED` | `security_logs` | `admin_roles.id` | `roleKey` |
| `PLATFORM_FINANCE_SETTINGS_UPDATED` | `security_logs` | settings cuid | `settingsKey=DEFAULT` |
| `SHORAKA_ORDER_SUBMITTED` / `SHORAKA_CERTIFICATE_FETCHED` | `note_events` | `shoraka_trade_orders.id` | `provider_order_id` as tgt |
| `NOTE_CREATED_FROM_INVOICE` | `note_events` | forensic `target_id` (note_id column **is** set) | tgt null |

### 2. EVENTS MISSING DISPLAY REFERENCE (B)

Where the canonical table **has** a UI display ref that is **not** snapshotted:

- All `APPLICATION_*`, review, most `CONTRACT_*`, most `INVOICE_*` (`applications` / `contracts` / `invoices`.`display_reference`)
- All onboarding live IDs (`organizations.display_reference`; **name is snapshotted**)
- Note events that are not admin-mirrors and not withdrawal submit/complete: letters, default, fee-waive `logEvent`, occupancy, create-from-invoice, most settlements, payment approve/reject
- `WITHDRAWAL_LETTER_GENERATED`, `WITHDRAWAL_BENEFICIARY_UPDATED`
- Signing: no envelope display_reference column (title optional only)

Admin-mirror note events **do** contain nested `beforeState.noteReference` but Details/CSV do not surface it.

### 3. EVENTS USING LIVE JOIN INSTEAD OF SNAPSHOT

- Application / facility / invoice **B** on the application or facility page (current row)
- Note **B** for non-nested events: current `notes.note_reference`
- Onboarding **B** `display_reference`: current org row
- Access/Security **email** on CSV/JSON: current `users` row
- Signing **C** `provider_ref`: current envelope
- Gateway **C** when not in event metadata: current `gateway_payments`
- Shoraka certificate file hash: current `shoraka_trade_orders`
- Org id for application/note events: join through application/note (no org column; documented as intentional)

### 4. EVENTS MISSING PROVIDER REFERENCE (C) where C exists

| Raw ID | Expected C | Stored? |
|---|---|---|
| `SIGNING_PACKAGE_*` | SigningCloud `provider_ref` / `provider_contract_ref` | no |
| `LOGIN`/`SIGNUP` | Cognito sub | no (optional; user_id is CashSouk PK) |
| `SHORAKA_CERTIFICATE_FETCHED` | `provider_certificate_id`, s3 key, sha256 | flags only |
| Gateway events with empty metadata | Curlec ids | parent row only (acceptable if join allowed) |
| `ROLE_ADDED` accept invitation | `AdminInvitation.id` | token only |

### 5. EVENTS WITH AMBIGUOUS `id` METADATA

- Prospectus `afterState.id` (review id) without saying “prospectus review”
- Generic `id` inside `mapNoteListItem` nested DTO (that is the note id, duplicating `note_id`)
- `notificationRelatedReference` keys `targetId` / `noteId` / `applicationId` untyped
- Contract activity details: `applicationReference: applicationId` (A labeled as B)
- Application details: `application_id` metadata key would be shown as “application reference”

No live writer was found that stores a bare metadata key exactly named `id` as the only identifier except nested DTOs.

### 6. EVENTS ALREADY COMPLETE — DO NOT CHANGE

See section D.

### 7. EVENTS WHERE TOP-LEVEL ANCHOR IS ENOUGH

Do **not** copy these into metadata:

- `access_logs.user_id` / `security_logs.user_id`
- `onboarding_logs` org UUID columns (already also copied as `organizationId` in many metas — stop adding more copies)
- `application_logs.application_id` (add **B**, not a second A)
- `note_events.note_id`
- `product_logs.product_id`
- `gateway_payment_events.gateway_payment_id`
- `legal_document_id` / `legal_document_version_id` columns
- Withdrawal/payment/settlement **A** already in `target_id` when `resolveNoteEventTarget` works

### 8. EVENTS THAT SHOULD BE FIXED FIRST

1. `ISSUER_DISBURSEMENT_WITHDRAWAL_CREATED` — missing withdrawal A and B  
2. `CONTRACT_CUSTOMER_LARGE_PRIVATE_UPDATED` — contract A missing; tgt wrongly application  
3. Snapshot `display_reference` on **application** (and contract/invoice) writes — Ops evidence gap on every application timeline CSV  
4. `SIGNING_PACKAGE_SENT` / `COMPLETED` — snapshot provider envelope id  
5. Always set `settlementReference` / `withdrawalReference` on trustee email events  
6. `NOTE_CREATED_FROM_INVOICE` — use standard writer so `target_id` is set  

---

## C. Minimal recommended-fix list

| Priority | Change | Why | What not to do |
|---|---|---|---|
| P0 | Withdrawal create: add `withdrawalId` + `withdrawalReference` | Event cannot identify the instruction | Don’t add note_id to metadata |
| P0 | Large-private update: set `entity_id` + `metadata.contract_id` | tgt is the wrong entity | Don’t add application_id to metadata |
| P1 | Snapshot `display_reference` (app/contract/invoice) on existing writers | CSV/Details have only UUIDs | Don’t add a new DB column |
| P1 | Signing: snapshot `provider_ref` on SENT/COMPLETED | C is join-only | Don’t duplicate `envelope_id` |
| P2 | Org onboarding: snapshot `display_reference` next to name | UI reference code not in log | Don’t add a third org UUID copy |
| P2 | Note Details/CSV: read nested `beforeState.noteReference` | B already stored, not shown | No writer change |
| P2 | Application Details: label `application_id` separately from display ref | Details hide A and invent B from the wrong key | Don’t set `applicationReference` = application UUID |
| P3 | Shoraka: optional `tradeOrderId` (cuid) + cert hash on fetch | C used as tgt | Don’t rename SHORAKA_* ids |
| P3 | Settlement/payment approve rows: optional display/reference copy | A-only today | Don’t duplicate paymentId |

---

## D. Leave unchanged

- Access `LOGIN`, `SIGNUP`, `LOGOUT`, `PROFILE_UPDATED`
- Security `PASSWORD_CHANGED`, `EMAIL_VERIFIED`, `ROLE_ADDED`, `ROLE_SWITCHED`, `INVITATION_REVOKED`, `PROFILE_UPDATED`
- Security role-catalogue and finance-settings rows **unless** product requires cuid-after-rename (roleKey / DEFAULT is enough today)
- Legal document audit (all 7) and acceptances `OPENED` / `ACCEPTED`
- Products `CREATED` / `UPDATED` / `DELETED`
- Gateway 8 live types (`OVERRIDE_*` are not live)
- Note admin-mirrors (`UPDATE_*`, listing, publish, funding close/fail, activate, waive collection admin id)
- `INVESTMENT_COMMITTED` (no investment display ref on the table)
- `WITHDRAWAL_SUBMITTED_TO_TRUSTEE`, `WITHDRAWAL_COMPLETED`
- Occupancy before/after snapshots (application and note)
- Payment `paymentId` targeting

`NOT_OPENED` is not an event.

---

## Naming inconsistencies (observe only)

| Pattern | Where |
|---|---|
| `applicationId` vs `application_id` | note create meta vs application_logs column |
| `organizationId` vs org UUID columns | onboarding meta duplicates columns |
| `contract_id` vs `entity_id` vs `target_id` | often the same contract UUID three ways |
| `invoice_number` vs `display_reference` | number key holds number **or** display fallback |
| `kycRequestId` vs `kycId` | AML/KYC onboarding status |
| `regtankRequestId` vs `requestId` | admin vs webhook |
| `provider_order_id` as `target_id` | Shoraka (C stored in A’s slot) |
| `envelope_id` vs SigningCloud provider ref | envelope UUID vs C |

---

## Validation counts

| Set | Count |
|---|---|
| Live writers in this audit (catalogue 139 minus 3 OVERRIDE plus 2 acceptance writers, minus NOT_OPENED) | 4+10+13+45+44+7+2+3+8 = **136** |
| Extra live onboarding webhook IDs not in 139 catalogue | 4 |
| OVERRIDE_* (declared, no writer) | 3 — **not live** |
| COMPLETE (including nested-B note mirrors and user_id-as-A+B) | see tables |
| P0 missing A | 2 |

**CODE CHANGED:** NO  
**MIGRATIONS:** NO  
**FINAL STATUS:** VERIFICATION COMPLETE
