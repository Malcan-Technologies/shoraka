# Current live event metadata traceability audit

Verified 2026-08-27 against writers, then **updated after the 2026-08-27 final cleanup pass**. Source code is authoritative. Historical rows without new metadata still render safely.

Companion: before/after evidence in `docs/audit/current-event-before-after-audit.md`.

**How to read A / B / C**

| Class | Meaning | Example |
|---|---|---|
| **A** | Canonical CashSouk DB primary key | `application.id`, `note.id`, `users.user_id` |
| **B** | Display / business reference the UI shows | `APP-CS-2026-001`, `NOTE-CS-2026-018`, org `display_reference` |
| **C** | External / provider id | RegTank `requestId`, SigningCloud `provider_contract_ref`, Curlec payment id, Shoraka `provider_order_id` |

B or C is never treated as a substitute for A.

**User PK special case:** `users.user_id` is a 5-letter code that is both A and the Admin “User ID”. There is no separate cuid for users.

## Implementation disposition (2026-08-27)

| Finding | Status |
|---|---|
| 1. `ISSUER_DISBURSEMENT_WITHDRAWAL_CREATED` target + `withdrawalReference` | **FIXED** |
| 2. `CONTRACT_CUSTOMER_LARGE_PRIVATE_UPDATED` contract target + previous/next | **FIXED** |
| 3. Snapshot `applicationReference` on live application writers | **FIXED** (`logApplicationActivity` lookup; `createApplicationLog` stays query-free) |
| 4. Snapshot `contractReference` (not `contract_number`) | **FIXED** |
| 5. Snapshot `invoiceReference` (not `invoice_number`) | **FIXED** |
| 6. Event Details: Application ID vs Application Reference | **FIXED** |
| 7–9. Access / Security `PROFILE_UPDATED` previous + next (incl. phone-only admin) | **FIXED** |
| 10. Admin org `PROFILE_UPDATED` nested fields + nextValues + `organizationReference` | **FIXED** |
| 11. Self-service org `PROFILE_UPDATED` | **FIXED** |
| 12. Organisation membership add/invite/remove/role-change | **FIXED** — new IDs `MEMBER_ADDED`, `MEMBER_INVITED`, `MEMBER_REMOVED`, `MEMBER_ROLE_CHANGED` |
| 13. `WITHDRAWAL_BENEFICIARY_UPDATED` previous/next + reference | **FIXED** |
| 14. Signing provider reference on SENT/COMPLETED (CREATED/VOIDED when present) | **FIXED** — `providerEnvelopeId` / `providerContractRefs` from `signing_documents.provider_contract_ref` (envelope `provider_ref` is unused JSON) |
| 15. Webhook source/actor | **FIXED** (`webhookAuditContext()`; applicant is subject, not actor) |
| 16. `ONBOARDING_STATUS_UPDATED` previous/new when both known | **FIXED** |
| 17. `WEBHOOK_APPROVED` vs `ONBOARDING_APPROVED` duplicate | **FIXED** — skip `WEBHOOK_APPROVED` when org approval already writes `ONBOARDING_APPROVED` |
| 18. Remaining `WEBHOOK_*` | **FIXED** — production catch-all / pending / in-progress now `ONBOARDING_STATUS_UPDATED`; keep `WEBHOOK_REJECTED` on `handleWebhookUpdate` REJECTED (not the same chain as individual `ONBOARDING_REJECTED`). `WEBHOOK_APPROVED` only when there is no organisation. Dev handler still uses `WEBHOOK_*`. |
| 19. Duplicate `APPLICATION_RESUBMITTED` on PATCH `/status` | **FIXED** |
| 20. Issuer HTTP log context | **FIXED** |
| 21. Event Details `beforeState`/`afterState` | **FIXED** |
| 22. Nested `noteReference` in Details/CSV | **FIXED** |
| 23. `NOTE_CREATED_FROM_INVOICE` `target_id` | **FIXED** |
| 24. Trustee email settlement/withdrawal references | **FIXED** |
| 25. Facility enabled/disabled previous/next | **FIXED** |
| 26. `APPLICATION_RESET_TO_UNDER_REVIEW` `new_status` | **FIXED** |
| 27. Facility-fee waive two `note_events` IDs | **FIXED** — keep `WAIVE_FACILITY_FEE_COLLECTION` with `beforeState`/`afterState` **and** `reason`. Stop writing `NOTE_FACILITY_FEE_COLLECTION_WAIVED`. Historical dual rows remain. |
| 28. `WEBHOOK_RECEIVED` catch-all | **FIXED** in production (`ONBOARDING_STATUS_UPDATED`); **INTENTIONALLY_UNCHANGED** in `webhook-handler-dev.ts` |
| 29. `PRODUCT_UPDATED` before snapshot | **INTENTIONALLY_UNCHANGED** — versioning keeps the previous product row (`INACTIVE` + `replaced_product_id`); admin delete is soft (`deleted_at`). `completeCreate` in-place has no previous version row; `PRODUCT_CREATED` is the prior evidence. |
| 30. Shoraka `trade_order_id` vs `provider_order_id` | **FIXED** — `target_id` = `shoraka_trade_orders.id`; `provider_order_id` stays in metadata (C). Raw IDs unchanged. |
| 31. Optional org/settlement/payment display refs | **FIXED** where already available (org + trustee settlement/withdrawal + settlement letter/submit/complete). Payment business reference not invented. |
| `OVERRIDE_*` writers | **INTENTIONALLY_UNCHANGED** — still no live writer; do not activate |
| Occupancy snapshots using `createApplicationLog` directly | **FIXED** — still no extra lookup; display refs come from already-loaded contract/invoice/note rows |
| User-portal `MEMBER_*` Activity | **INTENTIONALLY_UNCHANGED** — issuer/investor Activity is onboarding milestones only; membership is Admin organisation Activity |

Source disagreements vs the pre-fix reports (code wins):

- Display-ref enrichment is in `logApplicationActivity`, not `createApplicationLog` (callers run inside transactions / try-catch).
- SigningCloud C is `signing_documents.provider_contract_ref`, not envelope `provider_ref`.
- `WEBHOOK_REJECTED` on `handleWebhookUpdate` is a distinct path from individual `ONBOARDING_REJECTED`.
- User-portal organisation Activity allowlist remains onboarding milestones only. `MEMBER_*` are Admin organisation Activity + CSV. **INTENTIONALLY_UNCHANGED.**

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

- Application details label **Application ID** from `application_id` and **Application reference** from `metadata.applicationReference` only. Historical rows without the snapshot omit the reference (never the UUID).
- Application details `target.id` = `target_id` ?? `entity_id` (contract/invoice/envelope/section — not always the application).
- Note details `noteReference` reads top-level then nested `beforeState` / `afterState`.
- Contract activity details do **not** set `applicationReference = applicationId`. Application ID is a technical field.
- Onboarding details `target.id` = org UUID. Org `display_reference` is shown when snapshotted as `organizationReference`. Name is the actor organisation field (snapshot).

---

## Catalogue disagreements (source wins)

| Claim in current catalogues | Source |
|---|---|
| Live count 138 / 139 including 11 gateway events | `OVERRIDE_PROPOSED` / `OVERRIDE_APPROVED` / `OVERRIDE_REJECTED` have **no writer**. `getOpenOverrideProposal` only reads. **8** live gateway types. |
| `FORM_FILLED` metadata is `section` | Live `handleWebhookUpdate` metadata is `requestId`, `status`, `substatus`, `payload`. Individual handler uses org/status/trigger keys. **`section` is not written.** |
| 13 onboarding live IDs | Same 13 remain live, plus **new** `MEMBER_ADDED` / `MEMBER_INVITED` / `MEMBER_REMOVED` / `MEMBER_ROLE_CHANGED`. Production `handleWebhookUpdate` no longer writes `WEBHOOK_PENDING_APPROVAL` / `WEBHOOK_IN_PROGRESS` / catch-all `WEBHOOK_RECEIVED` (those are `ONBOARDING_STATUS_UPDATED`). `WEBHOOK_REJECTED` remains. `WEBHOOK_APPROVED` only when there is no organisation. Dev handler still uses `WEBHOOK_*`. |
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
| `PROFILE_UPDATED` | LIVE_UI | Admin `updateUserProfile` | Subject user | yes | meta `targetUserId`; tgt (not actor col) | user_id + email | yes | `targetUserId`, `targetUserEmail` | no | col `user_id` = admin | no | `previousValues` + `nextValues` `{ firstName, lastName, phone }` | yes / yes | yes / yes | yes / yes | Email snapshotted | COMPLETE | **FIXED.** Actor vs subject already split. |

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
| `PROFILE_UPDATED` | LIVE_UI | self or admin override (phone-only included) | User | yes | col + tgt | user_id | yes | col | no | subject | no | `previousValues` + `nextValues`; admin sets `adminOverride` | yes | yes | yes | yes | COMPLETE | **FIXED.** Distinct store from access `PROFILE_UPDATED`. |
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
| `FORM_FILLED` | LIVE_WEBHOOK | RegTank LIVENESS_PASSED / FORM_FILLING / PROCESSING / ID_UPLOADED | Org + request | yes (org cols on both paths) | org cols; webhook meta **has no organizationId** (ids are columns only) | same | name yes | name | yes | INTEGRATION / WEBHOOK | `requestId`; payload blob on service path | status/substatus | A via tgt; B name | same | same | payload may be large | TECHNICAL_ONLY | Do **not** add a `section` key (catalogues invented it). |
| `SSM_APPROVED` | LIVE_UI | `approveSsmVerification` | Org | yes | org cols; meta `organizationId` | same | name yes | name | yes | `approvedBy` | `regtankRequestId` | no | A yes; B name | same | same | yes | TECHNICAL_ONLY | Leave. |
| `TNC_APPROVED` | LIVE_UI | `acceptTnc` | Org + legal docs | yes | org cols; meta `organizationId` | same | name yes; also meta `organizationName` | name | yes | subject | no (legal ids in `legalDocumentsRequired`) | no | A yes; B name | same | same | yes | TECHNICAL_ONLY | Leave. Canonical accept evidence is `legal_document_acceptances`. |
| `SOPHISTICATED_STATUS_UPDATED` | LIVE_UI | admin or auto-grant | Investor org | yes | `investor_organization_id`; meta `organizationId` | same | name yes | name | yes | `updatedBy` | no | previous/new status+reason | A yes; B name | same | same | yes | TECHNICAL_ONLY | Leave. |
| `PROFILE_UPDATED` | LIVE_UI | admin **and** self-service org profile | Org | yes | org cols | same | name yes; `organizationReference` when present | name col + meta | yes | actor_user_id = caller | no | changed-field `previousValues`/`nextValues`; nested `corporateOnboardingData.*` | A yes; B name + optional display ref | same | same | previous+next snapshotted | COMPLETE | **FIXED.** Bank JSON still not dumped. |
| `MEMBER_ADDED` / `MEMBER_INVITED` / `MEMBER_REMOVED` / `MEMBER_ROLE_CHANGED` | LIVE_UI | organisation membership | Org + member | yes | org cols | display_reference | yes when present | `organizationReference` | yes | actor_user_id = caller | no | action, memberUserId/email, previous/new role | A yes; B optional | same | same | yes | COMPLETE | **FIXED.** New IDs. Do not reuse security `ROLE_ADDED`/`ROLE_REMOVED`. |

**Extra live writers** — `WEBHOOK_REJECTED` still written on `handleWebhookUpdate` REJECTED. `WEBHOOK_APPROVED` only when `organizationId` is absent. Production pending/in-progress/unknown statuses write `ONBOARDING_STATUS_UPDATED` (`trigger: REGTANK_WEBHOOK`). Dev `webhook-handler-dev.ts` still maps `WEBHOOK_*`.

### 4. Applications — `application_logs`

Live writers that go through `logApplicationActivity` snapshot `applicationReference` = `applications.display_reference` when the row is available. `createApplicationLog` itself stays query-free. Occupancy writers that call `createApplicationLog` directly do **not** auto-attach.

Admin lists use `display_reference` as B. Timeline CSV Target Reference is still a **DB id** unless a display ref is in metadata.

Review events: A for the application is `application_id`; section/item identity is `scope_key` / `entity_id` (not a table PK for sections).

| Raw ID | Status | Trigger | Canonical | A stored | A where | B available | B stored | B where | Org ID | Actor | C | before/after | Details A/B | CSV A/B | JSON | Survive | Assessment | Recommendation |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `APPLICATION_CREATED` | LIVE_UI | create draft | Application | yes | col `application_id`; tgt | `display_reference` | **yes** via `logApplicationActivity` | meta `applicationReference` | no | issuer `user_id` | no | no | A labelled separately; B from snapshot | A as Target Reference; B in metadata | none | B snapshotted when lookup succeeds | COMPLETE | **FIXED.** Do not copy `application_id` into metadata. |
| `APPLICATION_SUBMITTED` | LIVE_UI | first submit | Application | yes | col | display_reference | yes (same) | meta | no | issuer | no | no | same | same | none | same | COMPLETE | **FIXED.** |
| `APPLICATION_RESUBMITTED` | LIVE_UI | issuer `POST /resubmit` **or** PATCH `/status` (one writer) | Application | yes | col | display_reference | yes | meta | no | issuer | no | optional `resubmit_changes` | same | same | none | same | COMPLETE | **FIXED.** Controller no longer logs a second empty row. |
| `AMENDMENTS_SUBMITTED` | LIVE_UI | Admin send amendment batch | Application | yes | col | display_reference | yes | meta | no | admin | no | no (count only) | same | same | none | same | COMPLETE | **FIXED.** |
| `APPLICATION_REJECTED` | LIVE_UI | reject | Application | yes | col | display_reference | yes | meta | no | admin | no | no | same | same | none | same | COMPLETE | **FIXED.** |
| `APPLICATION_WITHDRAWN` | LIVE_UI | cancel / contract withdraw / invoice cascade | Application | yes | col | display_reference | yes | meta | no | issuer | no | no | same | same | none | same | COMPLETE | **FIXED.** HTTP context passed when available. |
| `APPLICATION_COMPLETED` | LIVE_UI | offer accept completes app | Application | yes | col | display_reference | yes | meta | no | issuer | no | no | same | same | none | same | COMPLETE | **FIXED.** |
| `APPLICATION_RESET_TO_UNDER_REVIEW` | LIVE_UI | admin status | Application | yes | col | display_reference | yes | meta | no | admin | no | `previous_status` + `new_status: UNDER_REVIEW` | same | same | none | same | COMPLETE | **FIXED.** |
| `SECTION_REVIEWED_*` (4 IDs) | LIVE_UI / LIVE_SYSTEM | `logReviewActivity` + CTOS reset for PENDING | Application section | yes app col; section key in meta `scope_key` | col + meta; tgt = scope_key | display_reference | yes on app | meta `applicationReference` | no | reviewer / `system` | no | old_status/new_status | tgt=scope_key; app B snapshotted | tgt=scope_key | none | section key is stable | COMPLETE | **FIXED.** |
| `ITEM_REVIEWED_*` (4 IDs) | LIVE_UI | `logReviewActivity` item | Review item | yes app col; `entity_id`=`scope_key` | col + entity_id | display_reference | yes on app | meta | no | reviewer | no | old/new status | tgt=item key | tgt=entity_id | none | same | COMPLETE | **FIXED.** |

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
| `CONTRACT_FACILITY_OCCUPANCY_UPDATED` | LIVE_SYSTEM | occupancy refresh | Contract (+ optional note/invoice) | yes contract; optional `note_id`,`invoice_id` in meta | entity_id; meta; tgt CONTRACT | display refs | **yes** when already loaded | meta `applicationReference` / `contractReference` / `invoiceReference` / `noteReference` | no | system | no | `before`/`after` occupancy | A contract yes; B labelled | CSV Target Reference prefers `contractReference` | occupancy snapshot + B | COMPLETE | **FIXED.** Direct `createApplicationLog`; refs from in-scope rows, no extra query. |
| `CONTRACT_FACILITY_FEE_WAIVED` | LIVE_UI | waive fee | Contract | yes | entity_id; meta `contract_id`; `application_id` may be originating app | display_reference | no | — | no | admin | no | amounts in meta | A yes | A | yes | TECHNICAL_ONLY | Same. |
| `CONTRACT_FACILITY_DISABLED` | LIVE_UI | disable | Contract | yes | same | display_reference | yes when lookup succeeds | meta `contractReference` | no | admin | no | `previousValues`/`nextValues` `{ enabled }` + disable reason | A yes | A | yes | COMPLETE | **FIXED.** |
| `CONTRACT_FACILITY_ENABLED` | LIVE_UI | enable | Contract | yes | same | display_reference | yes | meta `contractReference` | no | admin | no | `previousValues`/`nextValues` `{ enabled }` | A yes | A | yes | COMPLETE | **FIXED.** |
| `CONTRACT_CUSTOMER_LARGE_PRIVATE_UPDATED` | LIVE_UI | `patchContractCustomerLargePrivateCompany` | Contract | **contract.id** | `entity_id`; meta `contract_id`; tgt CONTRACT; `application_id` column preserved | display_reference | yes when present | meta `contractReference` | no | admin | no | `previousValues`/`nextValues` `{ is_large_private_company }` | tgt = contract id | tgt = contract id | yes | COMPLETE | **FIXED.** Do not use application id as contract target. |

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

`mapNoteListItem` includes `noteReference`. Admin-action **mirrors** store that inside `beforeState`/`afterState`. Event Details and CSV now read nested `noteReference`.

| Raw ID | Status | Trigger | Canonical | A stored | A where | B available | B stored | B where | Org ID | Actor | C | before/after | Details A/B | CSV A/B | Survive | Assessment | Recommendation |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `NOTE_CREATED_FROM_INVOICE` | LIVE_UI | `createFromInvoiceSource` via `logEvent` | Note | yes | col `note_id`; tgt NOTE = `note_id` | `note_reference` | optional `noteReference` | meta | no | actor forensic cols | no | no (admin sibling CREATE_FROM_INVOICE has after_state) | tgt = note id; optional B | note_id / snapshot | yes | COMPLETE | **FIXED.** Do not duplicate `note_id` into metadata. |
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
| `WAIVE_FACILITY_FEE_COLLECTION` | LIVE_UI | admin waive | Note | yes | col + tgt | note_reference | nested | before/after DTO + `reason` | no | admin | no | DTO + reason | A yes; B nested | note_id / nested B | yes | COMPLETE | **FIXED.** One `note_events` row per waive. `note_admin_actions` unchanged. |
| `NOTE_FACILITY_FEE_COLLECTION_WAIVED` | HISTORICAL | previous dual-write | Note | yes | col + tgt | note_reference | **no** | meta `{ reason }` only | no | admin | no | no | A yes; B no | note_id | reason only | TECHNICAL_ONLY | No live writer. Keep CSV/label for old rows. |
| `FACILITY_OCCUPANCY_UPDATED` | LIVE_SYSTEM | occupancy refresh | Note + contract | yes both | col `note_id`; tgt **CONTRACT** / `contractId`; meta ids | note + contract display refs | **yes** when loaded | meta `contractReference` / `noteReference` / `invoiceReference` / `applicationReference` | no | system | no | occupancy before/after | A yes (contract tgt); B yes | prefers contract/note B | occupancy snapshot | COMPLETE | **FIXED.** Same payload as application occupancy row. |
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
| `SETTLEMENT_TRUSTEE_LETTER_GENERATED` | LIVE_UI | generate | Settlement + letter | yes | meta `settlementId`; s3Key; tgt settlement | display_reference | **yes** | `settlementReference` | no | admin | no | no | A yes; B yes | prefers settlementReference | s3Key | COMPLETE | **FIXED.** |
| `SETTLEMENT_TRUSTEE_LETTER_SUBMITTED` | LIVE_UI | mark submitted | Settlement | yes | `{ settlementId }` | display_reference | **yes** | `settlementReference` | no | admin | no | no | A yes; B yes | prefers B | A | COMPLETE | **FIXED.** |
| `SETTLEMENT_TRUSTEE_INSTRUCTION_COMPLETED` | LIVE_UI | mark completed | Settlement | yes | settlementId + completedAt | display_reference | **yes** | `settlementReference` | no | admin | no | no | A yes; B yes | prefers B | A | COMPLETE | **FIXED.** |
| `SETTLEMENT_TRUSTEE_EMAIL_SENT` | LIVE_UI | send/resend | Settlement | yes | settlementId; optional `settlementReference`; messageId | display_reference | **sometimes** | meta `settlementReference` | no | admin | email `messageId` | no | A yes; B if key present | prefers settlementReference | C messageId | COMPLETE when reference written; else TECHNICAL_ONLY | Always pass `settlementReference` on send and resend. |

### 11. Withdrawals / Disbursement — `note_events`

| Raw ID | Status | Trigger | Canonical | A stored | A where | B available | B stored | B where | Org ID | Actor | C | Details A/B | CSV | Survive | Assessment | Recommendation |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `ISSUER_DISBURSEMENT_WITHDRAWAL_CREATED` | LIVE_UI | closeFunding when new instruction | `WithdrawalInstruction` | yes | meta `withdrawalId`; tgt WITHDRAWAL; `note_id` column kept | `display_reference` | yes | meta `withdrawalReference` | no | admin | no | no | tgt = withdrawal id | Target Reference prefers B | yes | COMPLETE | **FIXED.** Do not copy `note_id` into metadata. |
| `WITHDRAWAL_BENEFICIARY_UPDATED` | LIVE_UI | update beneficiary | Withdrawal | yes | `{ withdrawalId }` tgt | display_reference | yes | meta `withdrawalReference` | no | admin | no | `previousValues`/`nextValues` beneficiary snapshots | A yes; B yes | withdrawalReference | yes | COMPLETE | **FIXED.** Canonical live row can still be overwritten later. |
| `WITHDRAWAL_LETTER_GENERATED` | LIVE_UI | generate letter | Withdrawal | yes | meta `withdrawalId`; tgt WITHDRAWAL | display_reference | **yes** | `withdrawalReference` + s3Key | no | admin | no | no | A yes; B yes | prefers B | A + file | COMPLETE | **FIXED.** Do not copy `note_id` into metadata. |
| `WITHDRAWAL_SUBMITTED_TO_TRUSTEE` | LIVE_UI | mark submitted | Withdrawal | yes | `withdrawalId`; tgt | display_reference | yes | `withdrawalReference` | no | admin | no | no | A+B | B preferred in CSV | yes | COMPLETE | Leave unchanged. |
| `WITHDRAWAL_COMPLETED` | LIVE_UI | complete | Withdrawal | yes | withdrawalId; tgt | display_reference | yes | withdrawalReference + type + amount | no | admin | no | no | A+B | B | yes | COMPLETE | Leave unchanged. |
| `WITHDRAWAL_TRUSTEE_EMAIL_SENT` | LIVE_UI | send/resend | Withdrawal | yes | withdrawalId; optional reference; messageId | display_reference | optional | withdrawalReference | no | admin | messageId | no | A; B if present | B if present | C | COMPLETE when reference passed | Always include `withdrawalReference` (resend path already can). |
| `SHORAKA_ORDER_SUBMITTED` | LIVE_SYSTEM | first STP create | `ShorakaTradeOrder` | **yes** `trade_order_id` | tgt SHORAKA_ORDER = trade-order id; meta `trade_order_id` | n/a | n/a | — | no | system | **yes** `provider_order_id` + amounts/dates | no | A as tgt; C labelled Provider order ID | A as Target Reference; C in metadata | A + C | COMPLETE | **FIXED.** Do not treat provider id as CashSouk PK. Certificate not on this event. |
| `SHORAKA_CERTIFICATE_FETCHED` | LIVE_SYSTEM | fetch cert | Trade order + cert file | yes trade-order id | tgt = trade-order id | n/a | n/a | — | no | system | `provider_order_id`; sha256; s3 key | no | A as tgt; C labelled separately | A; C in metadata | file evidence snapshotted | COMPLETE | **FIXED.** |

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

P0/P2 ID-target gaps from the pre-fix audit are **FIXED**. Remaining by design:

| Raw ID | Store | What’s missing | What is stored instead |
|---|---|---|---|
| `ROLE_CREATED` / `ROLE_PERMISSIONS_UPDATED` / `ROLE_REMOVED` | `security_logs` | `admin_roles.id` | `roleKey` — **INTENTIONALLY_UNCHANGED** |
| `PLATFORM_FINANCE_SETTINGS_UPDATED` | `security_logs` | settings cuid | `settingsKey=DEFAULT` — **INTENTIONALLY_UNCHANGED** |

Shoraka stores `trade_order_id` (A) as `target_id` and keeps `provider_order_id` (C) in metadata. Raw `SHORAKA_*` IDs are unchanged.

### 2. EVENTS MISSING DISPLAY REFERENCE (B)

Live `logApplicationActivity` writers snapshot `applicationReference` / `contractReference` / `invoiceReference` when the row is available. Occupancy `createApplicationLog` paths now snapshot the same keys from already-loaded contract/invoice/note rows (**FIXED**). No extra lookup inside the occupancy transaction.

Onboarding membership and org `PROFILE_UPDATED` snapshot `organizationReference` when present.

Admin-mirror note events contain nested `beforeState.noteReference`; Details/CSV now surface it (**FIXED**).

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
| `SIGNING_PACKAGE_*` | SigningCloud `provider_contract_ref` | **FIXED** on SENT/COMPLETED (`providerEnvelopeId` / `providerContractRefs`). CREATED/VOIDED only when already on the envelope. |
| `LOGIN`/`SIGNUP` | Cognito sub | no (optional; user_id is CashSouk PK) |
| `SHORAKA_CERTIFICATE_FETCHED` | `provider_certificate_id`, s3 key, sha256 | **FIXED** — s3 key + sha256 snapshotted; provider certificate id still optional |
| Gateway events with empty metadata | Curlec ids | parent row only (acceptable if join allowed) |
| `ROLE_ADDED` accept invitation | `AdminInvitation.id` | token only |

### 5. EVENTS WITH AMBIGUOUS `id` METADATA

- Prospectus `afterState.id` (review id) without saying “prospectus review”
- Generic `id` inside `mapNoteListItem` nested DTO (that is the note id, duplicating `note_id`)
- `notificationRelatedReference` keys `targetId` / `noteId` / `applicationId` untyped

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

All P0/P1/P2 items in the implementation disposition at the top of this file are **FIXED** (or **INTENTIONALLY_UNCHANGED** as marked). Do not re-open them without a new source finding.  

---

## C. Minimal recommended-fix list

See the **Implementation disposition** table at the top. Pre-fix P0–P2 items are **FIXED**. Facility-fee waive duplicate is **FIXED**. `PRODUCT_UPDATED` previous blob is **INTENTIONALLY_UNCHANGED**. User-portal `MEMBER_*` is **INTENTIONALLY_UNCHANGED**.

---

## D. Leave unchanged

- Access `LOGIN`, `SIGNUP`, `LOGOUT` (profile writer **was** updated for `nextValues` only)
- Security `PASSWORD_CHANGED`, `EMAIL_VERIFIED`, `ROLE_ADDED`, `ROLE_SWITCHED`, `INVITATION_REVOKED`
- Security role-catalogue and finance-settings rows
- Legal document audit (all 7) and acceptances `OPENED` / `ACCEPTED`
- Products `CREATED` / `DELETED`; `PRODUCT_UPDATED` previous blob **INTENTIONALLY_UNCHANGED** (immutable previous version row)
- Gateway 8 live types (`OVERRIDE_*` are not live — **do not activate**)
- Note admin-mirrors (`UPDATE_*`, listing, publish, funding close/fail, activate). Waive collection is **one** live `note_events` ID (`WAIVE_FACILITY_FEE_COLLECTION`).
- `INVESTMENT_COMMITTED`
- `WITHDRAWAL_SUBMITTED_TO_TRUSTEE`, `WITHDRAWAL_COMPLETED`
- Occupancy before/after snapshots (application and note); display refs now snapshotted when in scope
- Payment `paymentId` targeting
- User-portal organisation Activity remains onboarding milestones (**INTENTIONALLY_UNCHANGED** for `MEMBER_*`)

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
| `provider_order_id` as `target_id` | Historical Shoraka rows only; new rows use trade-order id |
| `envelope_id` vs SigningCloud provider ref | envelope UUID vs C |

---

## Validation counts

| Set | Count |
|---|---|
| Live writers | **138** (previous 139 minus historical `NOTE_FACILITY_FEE_COLLECTION_WAIVED`; `MEMBER_*` remain live Admin UI) |
| OVERRIDE_* (declared, no writer) | 3 — **not live** |
| P0 missing A | **0** after the cleanup pass |
| UNREACHABLE | **7** — access `ROLE_ADDED`/`ROLE_REMOVED`/`ONBOARDING_RESET`; onboarding `AML_APPROVED`/`ONBOARDING_RESET`; products `PRODUCT_INACTIVATED`/`PRODUCT_REACTIVATED` |

**CODE CHANGED:** YES (writers/UI/tests; no schema)  
**MIGRATIONS:** NO  
**FINAL STATUS:** CLEANUP PASS COMPLETE
