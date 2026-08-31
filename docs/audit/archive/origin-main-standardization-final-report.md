# origin/main Audit Standardization — Final Report

> **Snapshot, not current state.** Reference revision: `origin/main` @ `28ae5c58`.
> Current event/notification counts and classifications live in
> [`audit-event-surface-matrix.md`](./audit-event-surface-matrix.md) §7
> (documented **160** / live **137** / not-live **23**; notification registry **45** / live **39** /
> dead **4** / bulk-only **2**). Do not treat the event tables below as today's inventory.

Reference revision: `origin/main` @ `28ae5c58`. Companion documents:
`origin-main-preservation-inventory.md` (Phase 1) and `origin-main-standardization-plan.md`
(Phase 2, as-built).

**Reconciliation pass:** this revision corrects a contradiction in the original "Dead events"
claim, corrects two non-existent event names (`KYB_APPROVED`, `LOGIN_SUCCESS`) and one
misleading causal order in the manual smoke-test plan, makes the `notification_logs` scope
explicit, deepens the signer-IP compliance finding from "not captured" to a verified
YES/NO/UNKNOWN with evidence, and makes the pre-existing-baseline claim explicit about its
provenance. No architecture, schema, or product behavior changed as part of this pass — see
"Reconciliation findings" at the end of this document for the itemized diff against the prior
draft.

## Verdict

**READY_FOR_SMOKE_TEST**

Product behaviour is unchanged by construction: every file that reads, formats, gates visibility of,
or exports audit data is byte-identical to `origin/main`, and this is asserted by a test rather than
inspected by eye. All changes are on the write path plus a nullable-column migration. No code defect
was found that requires a fix before smoke testing; the issues found during this reconciliation pass
were documentation/report inaccuracies (corrected above) and two test-fixture accuracy issues
(corrected in `account-logs.test.ts`, all 228 audit tests still pass).

## Tables

**TABLES BEFORE:** 72. **TABLES AFTER:** 72 — identical set and identical `@@map` names.

**TABLES REMOVED:** 0. **TABLES RENAMED:** 0. **TABLES MERGED:** 0.

The eleven audit/log tables carried forward unchanged in identity: `access_logs`, `security_logs`,
`onboarding_logs`, `application_logs`, `application_review_events`, `legal_document_audit_logs`,
`product_logs`, `note_events`, `note_admin_actions`, `gateway_payment_events`, `notification_logs`.

## Events

| Metric                               | Value          |
| ------------------------------------ | -------------- |
| Application log event types declared | 61 — unchanged |
| Note event types                     | 19 — unchanged |
| Legal document event types           | 7 — unchanged  |
| Product log event types              | 14 — unchanged |
| Account log event types              | 46 — unchanged |
| **NEW EVENTS ADDED**                 | **0**          |
| **LIVE EVENTS LOST**                 | **0**          |

No `nofix55`-only event was introduced. The parity suite asserts the absence of each one named as
off-limits (`APPLICATION_REVIEW_STARTED`, `APPLICATION_ARCHIVED`,
`CONTRACT_ACCEPTANCE_CHANGES_REQUESTED`, and the rest).

Two call sites replaced a bare string literal with the equivalent enum member
(`CONTRACT_FACILITY_OCCUPANCY_UPDATED`, `APPLICATION_RESUBMITTED`). Both values are byte-identical.

**DEAD EVENTS FOUND: 16.** This corrects an earlier draft of this report, which incorrectly stated
"no event type is declared without a production writer." That line was based on
`preservation.test.ts`'s writer-coverage check, which only verifies that an event string still
appears _somewhere_ in the source (including reader/label code) — it cannot and does not detect an
event that is declared and displayed but never written. The authoritative source is the manual,
per-table inventory in `origin-main-preservation-inventory.md`, which enumerates these 16
declared-but-unwritten events (all pre-existing on `origin/main`, none introduced or removed by this
branch):

| Table                    | Dead events                                                                                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `access_logs`            | `ROLE_SWITCHED`, `ONBOARDING`, `USER_COMPLETED`, `KYC_STATUS_UPDATED`, `ONBOARDING_STATUS_UPDATED`, `PASSWORD_CHANGED`, `EMAIL_CHANGED` (each is written to a _different_ table instead — see inventory §3.1) |
| `onboarding_logs`        | `TNC_ACCEPTED`, `KYC_APPROVED`, `KYB_APPROVED`                                                                                                                                                                |
| `application_logs`       | `APPLICATION_APPROVED`, `CONTRACT_OFFER_REJECTED` (issuer contract rejection writes `CONTRACT_WITHDRAWN` instead)                                                                                             |
| `note_events`            | `ISSUER_RESIDUAL_WITHDRAWAL_CREATED`                                                                                                                                                                          |
| `gateway_payment_events` | `OVERRIDE_PROPOSED`, `OVERRIDE_APPROVED`, `OVERRIDE_REJECTED`                                                                                                                                                 |

Verified directly against the current branch (not just the baseline) for this report: none of these
16 have a `.create` call anywhere in `apps/api/src`; each surviving reference is a reader, a label
map, or a UI/CSV constant — none of which this phase touched. `preservation.test.ts` has been
corrected to describe what it actually checks (a "string didn't disappear" regression guard) rather
than implying full writer coverage, and now documents this inventory as the source of truth in a
comment.

Separately, the genuinely dead **artefacts** (not events) are the three deprecated columns
`application_logs.level`, `.target`, `.action`, always written as `null`, and their enums
`ActivityLevel` / `ActivityTarget` / `ActivityAction`, which have no reference outside their own
declaration. **Flagged only — not removed**, because the columns may hold historical production
values written before they were deprecated.

## Existing tables improved

All columns are nullable. No column was dropped, renamed, retyped, or backfilled.

| Table                       | Columns added                                                                                              |
| --------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `access_logs`               | `actor_type`, `target_type`, `target_id`, `source`, `correlation_id`                                       |
| `security_logs`             | `actor_type`, `target_type`, `target_id`, `source`, `portal`, `correlation_id`                             |
| `onboarding_logs`           | `actor_type`, `actor_user_id`, `organization_kind`, `target_type`, `target_id`, `source`, `correlation_id` |
| `application_logs`          | `actor_type`, `target_type`, `target_id`, `source`, `correlation_id`                                       |
| `application_review_events` | `actor_type`, `source`, `portal`, `ip_address`, `user_agent`, `correlation_id`, `metadata`                 |
| `legal_document_audit_logs` | `actor_type`, `target_type`, `target_id`, `source`, `portal`                                               |
| `product_logs`              | `actor_type`, `target_type`, `target_id`, `source`, `portal`, `correlation_id`                             |
| `note_events`               | `actor_type`, `target_type`, `target_id`, `source`                                                         |
| `note_admin_actions`        | `actor_type`, `portal`, `target_type`, `target_id`, `source`, `metadata`                                   |
| `gateway_payment_events`    | `actor_type`, `target_type`, `target_id`, `source`, `portal`, `ip_address`, `user_agent`, `correlation_id` |
| `notification_logs`         | `actor_type`, `source`, `portal`, `correlation_id`, `success_count`, `failed_count`                        |

Indexes added: 21 — `(target_type, target_id, created_at)` on the nine tables holding both columns,
`(correlation_id)` on the eleven holding it, and `(actor_user_id, created_at)` on `onboarding_logs`.
Composite indexes over already-indexed legacy columns were deliberately excluded; see "Possible
future improvements".

Migration `20260824010000_audit_standard_forensic_columns` contains only `ALTER TABLE … ADD COLUMN`
and `CREATE INDEX`. Verified: no `DROP`, `RENAME`, `DELETE`, `TRUNCATE`, `ALTER COLUMN`, `UPDATE`, no
`NOT NULL` on any added column, no new foreign key, no data migration. `prisma migrate diff` against
a shadow database reports zero drift between the schema and the migration history.

## Preservation results

| Area                         | Result                         | Evidence                                                                                                                                                                            |
| ---------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **REMARK PRESERVATION**      | PASS                           | `remark` remains a first-class column on `application_logs` and `application_review_events`; the writer forwards the whole params object; asserted by test. No exceptions.          |
| **ACTIVITY PRESENTATION**    | PASS                           | Every formatter file is byte-identical to `origin/main`. Zero differences.                                                                                                          |
| **DESCRIPTION PRESERVATION** | PASS                           | Titles, descriptions, section- and item-specific wording, resubmit copy and "View details" payloads all live in files proven byte-identical. Zero differences.                      |
| **VISIBILITY**               | PASS                           | All per-portal allowlists (`ISSUER_VISIBLE_EVENTS`, `ISSUER_ONLY_EVENT_TYPES`, `INVESTOR_ONLY_EVENT_TYPES`, adapter `where` filters, RBAC guards) byte-identical. Zero differences. |
| **CSV / EXPORT**             | PASS                           | All CSV builders and export serializers byte-identical; every export projects its columns explicitly, asserted by test. Zero differences.                                           |
| **COMPLIANCE EVIDENCE**      | PASS with one pre-existing gap | See below.                                                                                                                                                                          |
| **NOTIFICATION ALIGNMENT**   | PASS — scope confirmed narrow  | See "Notification scope" below.                                                                                                                                                     |
| **UI BEHAVIOUR**             | PASS                           | No file under `apps/admin`, `apps/issuer`, `apps/investor`, `packages/ui`, `packages/types` or `packages/config` is modified.                                                       |

### Metadata

`metadata` is passed through byte-for-byte at every writer. No key is added, removed, renamed or
re-nested, and no derived value is merged in. This is asserted directly, because the admin timeline
gates its "View details" expander on metadata being non-empty and renders unknown keys generically —
so any added key would have been a visible UI and CSV change.

The two new `metadata` columns on `application_review_events` and `note_admin_actions` are additive
and unread; the dedicated `remark`, `old_status`, `new_status`, `before_state` and `after_state`
columns keep their values.

### Notification scope

`notification_logs` (the table this phase standardized) has exactly **one** production writer:
`NotificationService.sendBulkNotification`, the admin broadcast/announcement tool
(`apps/api/src/modules/notification/service.ts:575`). It records audience type/group, notification
type, title, message, recipient count, and IP/UA/device of the _admin who sent the broadcast_ — and,
after this phase, the computed `success_count`/`failed_count` delivery tally.

Ordinary per-user/system notifications — `NotificationService.sendTyped` and
`sendTypedPlatformOnly`, called throughout the app whenever a single user needs an in-app
notification (application status changes, payment events, etc.) — do **not** write to
`notification_logs` at all. They write to the separate `Notification` table (the in-app inbox
model), which is unrelated to this audit table and was not touched by this phase.

This branch does not expand `notification_logs` coverage to per-user notifications. The scope was
already this narrow on `origin/main`; this section only makes the distinction explicit so it isn't
misread as "all notifications are audited."

### Compliance evidence

| Requirement                          | Where the evidence lives                                                                                                                                                                                         | Status              |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Legal acceptance / consent           | `legal_document_acceptances`: version id, `document_hash`, `accepted_at`, `accepted_ip_address`, `accepted_user_agent`, user and organization name/email snapshots, `acknowledgement_text`                       | PASS                |
| Legal document lifecycle             | `legal_document_audit_logs`: hash, actor snapshots, `before_json`/`after_json`, IP, correlation                                                                                                                  | PASS                |
| AML / onboarding decision            | `onboarding_logs`: event, `created_at`, subject, `actor_user_id` (new), organization FKs, metadata                                                                                                               | PASS                |
| Offer issue and acceptance deadline  | `signing_envelopes`: `sent_at`, `expires_at`, `completed_at`, `voided_at`, `product_version`                                                                                                                     | PASS                |
| Offer acceptance                     | `application_logs` `CONTRACT_/INVOICE_OFFER_ACCEPTANCE_SUBMITTED`: acceptor, `submitted_at`, contract/invoice reference, offered vs requested facility; approval recorded by `*_ACCEPTANCE_APPROVED_FOR_SIGNING` | PASS                |
| Signing — document, hash, status     | `signing_documents`: `signed_file_sha256`, `provider_contract_ref`, per-document `status`                                                                                                                        | PASS                |
| Signing — signer identity and role   | `signing_recipients`: name, email, `ic_number`, `role_key`, `role_label`, `status`, `completed_at`                                                                                                               | PASS                |
| Signing — per-signature timestamp    | `signing_assignments`: `status`, `signed_at`                                                                                                                                                                     | PASS                |
| Signing — **signer IP at signature** | **not captured anywhere on `origin/main`**                                                                                                                                                                       | **GAP — see below** |
| Payment status transitions           | `gateway_payment_events`: `type`, `from_status`, `to_status`, `reason`, `actor_user_id`, `created_at`                                                                                                            | PASS                |
| Per-note / Shariah sequence          | `note_events`: `note_id`, `event_type`, second-resolution `created_at`, metadata                                                                                                                                 | PASS                |

**MISSING_COMPLIANCE_EVIDENCE — signer IP at signature time.** `origin/main` records no IP on any
signing table. An earlier draft of this work attempted to close this by threading request context
into `application_logs.ip_address` at signing package creation/void — that captures the _envelope
creator's_ (issuer/admin who initiated the package) IP, not the signer's, and it changed the admin
CSV export because the timeline merges `application_logs.ip_address` into the exported metadata
cell. That change was reverted; it did not close the real gap and it violated preservation.

**Does the provider supply the real signer's IP? UNKNOWN**, based on directly inspecting every
payload surface this integration reads from SigningCloud:

- **Webhook callback** (`modules/signingcloud/webhook-controller.ts`): the decrypted body is walked
  recursively for a `contractnum`/`contractnumber` field only. No other field is extracted or
  logged; unmatched keys are discarded, not merely unused, so the code path itself can't confirm or
  rule out an IP field being present in the raw callback payload.
- **Contract-details fetch** (`getContractDetailsData` → `parseSigningCloudContractDetails` in
  `modules/signing/provider/signingcloud-adapter.ts`): per-signer rows (`addressee` / `signerinfo`)
  are read for `email`/`Email`/`signeremail`, `realname`/`name`, and a sign-state field only. Three
  real observed row shapes are captured in `signingcloud-adapter.test.ts`, and none include an IP
  key. Unknown keys on the row are silently ignored rather than logged.
- **Signed file / certificate-of-completion fetch** (`getContractFileData`): returns the signed PDF
  (optionally as a `.zip` with a certificate of completion when `isReqCertOfCompletion: true`, which
  this integration does not request). A vendor certificate-of-completion PDF is the one place an
  e-signature provider's IP/timestamp audit trail is conventionally embedded, but this integration
  currently requests the PDF-only variant, so that data — if it exists — is never fetched or parsed.
- **eKYC module** (`modules/ekyc/*`): no IP/geo field appears anywhere in the identity-confirmation
  code either.

**Verdict: UNKNOWN, not NO.** The three JSON-payload surfaces the app actually parses show no IP
field in any request the team has made against the live provider, but the untyped, permissively-read
nature of every payload (`Record<string, unknown>`, only specific known keys extracted) means the
provider could expose it in a field the code doesn't look for, and the certificate-of-completion
variant (which this integration doesn't currently request) is the most likely place a vendor would
embed a signer IP/audit trail. This can only be resolved by checking SigningCloud's own API
reference for the `contract/details/data` and certificate-of-completion response schemas, or by
requesting `isReqCertOfCompletion: true` once and inspecting the real response — neither of which is
a preservation-safe activity to do inside this phase.

**Smallest safe implementation, if the provider does supply it** (not implemented — reported only,
per instructions):

1. Add nullable `signed_ip_address` / `signed_user_agent` to `signing_assignments` (additive
   migration, matches the existing per-assignment grain).
2. In `parseSigningCloudContractDetails` (or a certificate-of-completion parser, if that's where the
   field lives), read the new key the same permissive way existing fields are read, defaulting to
   `null` when absent — no schema change to any other table.
3. Populate it only inside `syncEnvelopeFromProvider`'s per-assignment `markAssignmentSigned` path,
   never from `application_logs` or the request context — this is what avoids re-introducing the
   creator/request-IP substitution bug from the reverted attempt.
4. It would not touch `application_logs`, so it would not appear in the CSV export or the admin
   activity timeline unless a new column is deliberately added to that presentation layer — keeping
   it preservation-safe by construction.

## Improvements delivered

**Consistent audit writer patterns.** Eighteen raw `prisma.<model>.create` sites reduced to seven
centralized writers. Enforced by a test that fails if any new raw audit write appears.

**Actor.** `actor_type` on all eleven tables, drawn from one vocabulary
(`USER` / `ADMIN` / `SYSTEM` / `INTEGRATION`). `onboarding_logs.actor_user_id` separates the decision
maker from the subject, recovering the admin id previously buried in `metadata.approvedBy`. A
metadata sentinel such as `"admin"` or `"system"` resolves to `null` rather than misattributing an
admin decision to the applicant.

**Target and reference.** `target_type` / `target_id` on nine tables, derived from the event type and
data the caller already holds, so "everything that happened to this object" becomes one indexed
query.

**Correlation.** `correlation_id` extended from three tables to eleven, making a single request or
incident traceable across audit tables.

**Source.** `source` distinguishes `API`, `WEBHOOK`, `SYSTEM_JOB` and `INTERNAL`. An actorless write
resolves to `INTERNAL` rather than claiming an inbound authenticated request, so `source` and
`actor_type` can never contradict each other.

**Before/after.** Existing pairs preserved and asserted: `old_status`/`new_status`,
`from_status`/`to_status`, `before_state`/`after_state`, `before_json`/`after_json`. `changedFieldsOf`
derives a field-level change list without inventing values, and is BigInt-safe because it runs inside
business transactions.

**Notification result.** `success_count` and `failed_count` were computed and discarded; they are now
stored.

**Compliance IP.** `ip_address` / `user_agent` are now capturable on `application_review_events` and
`gateway_payment_events`, which had no such columns.

### Design constraint: zero-query writers

No audit writer issues a database read. Many callers wrap the audit write in a best-effort
`try/catch` inside a business transaction, so a lookup inside the writer would turn a transient read
failure into a permanently lost audit row and could leave the transaction aborted. Every standard
field is derived from data the caller already holds, or left null. Asserted per-writer by test.

This constraint is why `organization_id` was not added to `application_logs`, `note_events` or
`gateway_payment_events`: populating it required a query per write.

## nofix55

**IDEAS REUSED:** shared audit-context module; single actor/source/portal/target vocabulary;
`actor_type` as an explicit column; `target_type`/`target_id` addressing; correlation id propagated
to every audit table; structured before/after; centralized writers per table; actor name/email
snapshot as a column.

**IDEAS NOT REUSED:**

| Idea                                                   | Reason                                                                                   |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Replace every log table with new `*_audit_logs` tables | Destructive; forbidden. Existing tables improved in place instead.                       |
| Separate `SigningAuditLog` architecture                | Would duplicate the authoritative signing tables and risk changing completion timing.    |
| New event types (`APPLICATION_REVIEW_STARTED` etc.)    | No new events in this phase.                                                             |
| Actor snapshots merged into `metadata`                 | Would add "View details" expanders, surface `actorEmail` in the UI and change CSV cells. |
| `idempotency_key` on `gateway_payment_events`          | No writer would populate it; a unique constraint with no producer is a liability.        |
| Raw audit-history UI panels                            | Explicitly out of scope.                                                                 |

## Automated test coverage

228 audit tests across five suites, all static or unit — no database required.

| Suite                         | Tests | Proves                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `preservation.test.ts`        | 64    | table set frozen; migration additive only; event catalogue frozen per table; every application-log event keeps at least a source reference (regression guard, not a writer-coverage proof — see "Dead events" below); every audit write goes through an approved writer; audit rows never mutated or deleted; every legacy column still written; metadata never rewritten; zero-query writers; compliance columns present and nullable |
| `presentation-parity.test.ts` | 125   | 98 presentation files byte-identical to `origin/main`; 15 reader blocks that share a file with a writer byte-identical; exports project columns explicitly                                                                                                                                                                                                                                                                             |
| `evidence-metadata.test.ts`   | 12    | each business event carries its required evidence keys at every writer; remark first-class; before/after pairs intact                                                                                                                                                                                                                                                                                                                  |
| `standard-fields.test.ts`     | 16    | resolver precedence; explicit `null` honoured; blank normalized; source/actor consistency; BigInt-safe diffing                                                                                                                                                                                                                                                                                                                         |
| `account-logs.test.ts`        | 11    | writers issue no read; legacy columns written from the caller's own values; metadata byte-identical; actor never a sentinel                                                                                                                                                                                                                                                                                                            |

Supporting scripts (run against a reference revision, not in CI):

- `scripts/audit-baseline.ts` — regenerates the table/event fixture.
- `scripts/audit-presentation-baseline.ts` — regenerates the presentation hash fixture.
- `scripts/audit-callsite-parity.ts` — compares written columns per model against a reference tree.

**What the automated suite cannot prove**, and therefore what the manual smoke tests exist to cover:
that a real write reaches the database with the expected values under a real transaction, and that
the rendered timeline for a freshly created record looks the same as before.

## Minimum manual smoke tests

Seven flows. Everything else is covered by source-level parity.

### 1. Onboarding, login, and AML/final approval decisions

**CORRECTION:** the previous draft of this flow listed `KYB_APPROVED` and `LOGIN_SUCCESS`, neither
of which exists in `origin/main`. There is no dedicated KYB-approval event — corporate onboarding
status changes (which cover KYB) go through `ONBOARDING_STATUS_UPDATED` with the detail in
`metadata`, and the login event is spelled `LOGIN`, not `LOGIN_SUCCESS`. Verified directly against
every writer call site in `apps/api/src/modules/{admin,auth,regtank,organization}` — corrected below.

**ACTIONS:** register an issuer and log in (self-service), complete onboarding; as admin, approve
AML via `POST /admin/onboarding-applications/:id/approve-aml`, then run final approval via
`POST /admin/onboarding-applications/:id/complete-final-approval`.
**EVENTS COVERED:** `access_logs.LOGIN`; `onboarding_logs.ONBOARDING_STARTED`,
`ONBOARDING_STATUS_UPDATED` (webhook path, via a `regtank` handler), `AML_APPROVED`,
`FINAL_APPROVAL_COMPLETED`; legal acceptance.
**FIELDS VERIFIED:** `onboarding_logs.actor_user_id` holds the _admin_ id (not the applicant) on the
two admin-decision rows, and the applicant's own id on `ONBOARDING_STARTED`; `organization_kind`
set; `correlation_id` present; `legal_document_acceptances` keeps hash + IP.
**UI VERIFIED:** admin organization Activity tab; issuer Activity feed.
**WHY THIS IS ENOUGH:** exercises the one writer whose actor semantics changed
(`onboarding_logs.actor_user_id`), across the self-service path, two distinct admin-decision
endpoints, and the webhook path via the provider callback.

### 2. Application review with remarks and amendments

**ACTIONS:** submit an application; as admin approve one section, request amendment on another with a
remark, reject one item with a remark; issuer resubmits.
**EVENTS COVERED:** `APPLICATION_CREATED`, `APPLICATION_SUBMITTED`, `SECTION_REVIEWED_*`,
`ITEM_REVIEWED_*`, `AMENDMENTS_SUBMITTED`, `APPLICATION_RESUBMITTED`.
**FIELDS VERIFIED:** remark text visible in "View details"; section-specific titles
("Financial Section Approved") and item-specific titles ("{Item} Approved") unchanged; amendment
batch count remark present; `application_review_events.remark`, `old_status`, `new_status` populated.
**UI VERIFIED:** admin application timeline + Recent Activity card; issuer application timeline.
**WHY THIS IS ENOUGH:** this is the exact area where a previous standardization lost information, and
it covers the highest-traffic writer plus the dynamically composed event names.

### 3. Contract offer, acceptance, signing

**CORRECTION:** the previous draft implied `CONTRACT_OFFER_ACCEPTED` fires when the issuer manually
"accepts" the offer, before signing. On a product configured for the phased offer-acceptance flow
(`workflowUsesOfferAcceptanceFlow`), that manual-accept code path
(`respondToContractOffer`/`assertPhasedOfferDirectAcceptBlocked`) is actually **blocked** until
signing evidence exists — verified by reading the guard directly. `CONTRACT_OFFER_ACCEPTED` and
`APPLICATION_COMPLETED` are real, live events, but on this product path they fire _after_ signing
completes, as a side effect of `finalizeCompletedEnvelopeOffer` →
`finalizeOfferAfterEnvelopeCompletion` calling `respondToContractOffer` internally with the signed
document as evidence. The events below are unchanged; only the causal order is corrected.

**ACTIONS:** issue an offer on a phased-flow product; issuer submits acceptance; admin (or
auto-approval) approves it for signing; complete signing for all required signers; separately, void
a second envelope on another application before it completes.
**EVENTS COVERED, in the order they actually fire:** `CONTRACT_OFFER_SENT`,
`CONTRACT_OFFER_ACCEPTANCE_SUBMITTED`, `CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING`,
`SIGNING_PACKAGE_CREATED`, `SIGNING_PACKAGE_COMPLETED` (drives `CONTRACT_OFFER_ACCEPTED` and
`APPLICATION_COMPLETED` as a same-transaction side effect), and — on the second, separately voided
application — `SIGNING_PACKAGE_VOIDED`.
**FIELDS VERIFIED:** acceptance timestamp, acceptor, contract reference; per-document and
per-signatory status and `signed_at`; `signed_file_sha256` present.
**UI VERIFIED:** admin signing panel and progress matrix; issuer signing stepper; both timelines.
**WHY THIS IS ENOUGH:** signing was reverted to `origin/main` exactly, so this confirms the revert is
complete and that completion timing is untouched — the highest-risk thing to get wrong.

### 4. Facility occupancy on funding

**ACTIONS:** fund an invoice against a contract facility so occupancy recomputes.
**EVENTS COVERED:** `CONTRACT_FACILITY_OCCUPANCY_UPDATED` (application log) and
`FACILITY_OCCUPANCY_UPDATED` (note event).
**FIELDS VERIFIED:** occupancy explanation sentence still rendered; before/after values in metadata;
`source = INTERNAL`; `remark` and `created_at` preserved.
**UI VERIFIED:** admin contract Activity panel; issuer facility transactions.
**WHY THIS IS ENOUGH:** the only writer that logs to two tables in one internal recomputation, and
the one whose event literal became an enum reference.

### 5. Note lifecycle and prospectus review

**ACTIONS:** publish a note through prospectus review, approve a payment, preview a settlement.
**EVENTS COVERED:** prospectus review actions (`note_admin_actions` + `note_events`),
`PAYMENT_APPROVED`, `SETTLEMENT_PREVIEWED`.
**FIELDS VERIFIED:** `before_state`/`after_state` intact; new `metadata.changedFields` present;
note timeline detail fields and labels unchanged.
**UI VERIFIED:** admin note timeline panel and its CSV export.
**WHY THIS IS ENOUGH:** covers the dual-table writer inside a transaction and the one note event
whose call site changed shape.

### 6. Deposit and refund via the payment gateway

**ACTIONS:** make a deposit that triggers a name check; approve it as admin; then trigger a refund.
**EVENTS COVERED:** `NAME_CHECK`, `NAME_CHECK_APPROVED`, `REFUND_INITIATED`, `REFUNDED`.
**FIELDS VERIFIED:** `from_status`/`to_status`/`reason` unchanged; `actor_type` is `ADMIN` for the
approval and `SYSTEM` for the webhook path, with `source` `API` and `INTERNAL` respectively — never
contradictory.
**UI VERIFIED:** admin gateway payment detail event timeline.
**WHY THIS IS ENOUGH:** the only table written from admin, webhook and cron paths, so it validates
the source/actor consistency rule in all three.

### 7. Bulk notification

**ACTIONS:** send one admin bulk notification with at least one recipient expected to fail.
**EVENTS COVERED:** notification delivery logging.
**FIELDS VERIFIED:** `success_count` and `failed_count` match the delivered/failed split; title,
message and recipient unchanged.
**UI VERIFIED:** admin notification delivery log.
**WHY THIS IS ENOUGH:** the only place two new non-forensic columns are populated.

## Test results

| Check                                                | Result                                                                                   |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `npx jest src/lib/audit` (audit parity suite)        | **228 passed**, 0 failed                                                                 |
| `npx jest` (full API suite) — `origin/main` baseline | **measured directly on a clean checkout of `origin/main`: 2227 passed, 1 failed**        |
| `npx jest` (full API suite) — this branch            | **2455 passed**, 1 failed — same test, same failure, as the baseline above               |
| `pnpm -w test` (workspace)                           | 8 of 9 tasks pass; the API task carries the same single pre-existing failure             |
| `npx tsc --noEmit` (API)                             | **clean**                                                                                |
| `npx eslint` on all new and changed audit files      | **clean** (0 errors, 0 warnings)                                                         |
| `npx eslint src scripts`                             | 27 pre-existing errors, none in a file this branch touches                               |
| `npx prettier --check` on new files                  | **clean**                                                                                |
| `npx prisma validate`                                | **valid**                                                                                |
| `prisma migrate diff` schema vs migrations           | **no drift** (empty migration)                                                           |
| `scripts/audit-callsite-parity.ts` vs `origin/main`  | **no columns lost** on any of the 11 models; every model writes more columns than before |
| Build                                                | not run — no bundler-visible change; typecheck covers the API                            |

**Baseline provenance.** The 2227/1 figure is measured pre-existing evidence, not inferred from the
branch diff: the full API suite was run against a separate clean checkout of `origin/main` before
any change in this phase was written, and again at report time to confirm it hadn't drifted. The
228 new audit tests plus test additions inside existing suites account for the 2455 − 2227 = 228
increase; no existing test was deleted, skipped, or renamed. Both runs fail the same single test —
`src/modules/notes/site-document-removal.test.ts`, which asserts a regex against
`apps/investor/src/app/investments/page.tsx`. That file is a re-export on `origin/main` and neither
it nor the test is touched by this branch, so the failure is pre-existing on `origin/main` and not
introduced by this work.

## Possible future improvements — not implemented

**POSSIBLE IMPROVEMENT — signer IP at signature time.** Whether SigningCloud even supplies this is
**UNKNOWN** (see "Compliance evidence" above — every payload surface this integration currently
parses omits it, but the certificate-of-completion variant, which isn't requested today, is the
likely place a vendor would embed it). If confirmed available, add nullable `signed_ip_address` /
`signed_user_agent` to `signing_assignments`, populated only inside the provider-sync path. This is
the one unmet compliance evidence field, and the finding, not the implementation, is what this
reconciliation pass adds.

**POSSIBLE IMPROVEMENT — request context on business service writers.** Eighteen audit writes sit one
call boundary below a controller and record no IP or correlation id (application withdrawal, offer
accept/reject, contract and invoice withdrawal, gateway name-check decisions, sophisticated status
update). Threading a context would require changing core business service signatures, including files
in the frozen presentation set, for forensic benefit only — none of these events has a mandated IP
requirement. Reason not done now: risk exceeds benefit in a preservation phase.

**POSSIBLE IMPROVEMENT — precise `source` on payment webhook and job paths.** These currently resolve
to `INTERNAL`. `WEBHOOK` and `SYSTEM_JOB` would be more precise, but the refund service functions are
reachable from both, so accurate tagging needs a context parameter threaded from each entry point.

**POSSIBLE IMPROVEMENT — composite indexes for existing reader queries.** Indexes such as
`(event_type, created_at)` on `access_logs` or `(application_id, created_at)` on `application_logs`
would help existing list endpoints. Excluded here because it is query tuning rather than audit
standardization, and each build takes `ACCESS EXCLUSIVE` on a table whose writes sit inside business
transactions. Ship separately, ideally with `CREATE INDEX CONCURRENTLY` outside a migration
transaction.

**POSSIBLE IMPROVEMENT — reader fallback to actor snapshots.** `GET /v1/applications/:id/logs`
resolves actor names live, so a removed user blanks the historical actor. A fallback to a stored
snapshot would fix it, but it is a reader change and therefore excluded.

## Possible future cleanup — not implemented

**Table:** none proposed for removal.

**Columns:** `application_logs.level`, `.target`, `.action`.
**Reason they appear redundant:** always written as `null`; their enums have no reference outside
their own declaration.
**Current readers/writers:** the writer sets them to `null` explicitly; no reader selects them.
**Risk of removal:** they may hold historical production values written before deprecation. Dropping
them would destroy audit evidence. **Do not drop without inspecting production data first.**

**Rollback deletion:** `ProductRepository.hardDeleteForFailedCreate` deletes `product_logs` rows
alongside the product when creation fails. This pre-dates this work and is preserved. It is the only
place any audit row is deleted; it is allowlisted explicitly in the parity test so it cannot spread
silently.

**Apparent duplication, retained:** `application_review_events` overlaps `application_logs` for
review decisions, and `note_admin_actions` overlaps `note_events` for admin note actions. Both pairs
have distinct readers (`RecentActivityCard` versus the full timeline), so neither is redundant today.
Flagged only.

## Unresolved risks

1. **Signer IP is still not captured.** The single unmet compliance evidence field, described above.
2. **Onboarding actor backfill.** `onboarding_logs.actor_user_id` is populated going forward only.
   Historical rows keep the admin id inside `metadata.approvedBy`; any forensic query must read both.
3. **Additive keys on four admin list responses.** `access_logs`, `security_logs`, `onboarding_logs`
   and `notification_logs` list endpoints return whole rows, so the new columns appear as extra JSON
   keys. No UI renders them — the only generic rendering iterates `metadata`, which is preserved —
   and every export projects columns explicitly, which is now asserted by test. Flagged because it is
   a response-shape change even though it is behaviourally inert.
4. **Index build locks.** 21 `CREATE INDEX` statements run inside the migration transaction and take
   `ACCESS EXCLUSIVE` per table. On large production audit tables this blocks audit writes, which sit
   inside business transactions, for the duration. Schedule the deploy accordingly.
5. **Parity is proven at source level.** The presentation suite proves the formatter, visibility and
   export code is unchanged; it cannot prove a rendered page looks identical. That is what the seven
   smoke tests cover.

## Reconciliation findings

Summary of a follow-up verification pass requested before accepting this work. No architecture,
schema, or product behavior was changed; only documentation, one test's description/comment, and
five fictional event-name occurrences in test fixtures were corrected.

**1. Dead-events contradiction — corrected.** The original "no event type is declared without a
production writer" claim was wrong. Corrected to **16 dead events** across five tables, sourced from
the Phase 1 inventory and re-verified against the current branch (see "Events" above). Root cause:
`preservation.test.ts`'s writer-coverage test only checks that an event string still appears
somewhere in source (including reader/label code), which cannot detect a declared-but-unwritten
event. The test's name and a new comment now say what it actually proves; it was not changed to be
stricter, because a stricter check would need to special-case the dynamically composed event names
(`SECTION_REVIEWED_${status}`, etc.) that are real writer call sites the loose check already handles
correctly.

**2. Smoke-test event names — 2 wrong, corrected.** `KYB_APPROVED` and `LOGIN_SUCCESS` do not exist
in `origin/main`; every other event named across all seven flows was individually re-verified
against a live `.create` call or enum reference at a writer call site and is correct. Real names:
`AML_APPROVED` (there is no separate KYB-approval event — corporate KYB status changes route through
`ONBOARDING_STATUS_UPDATED`), and `LOGIN`. These same two fictional names had also leaked into
`account-logs.test.ts` fixtures (`LOGIN_SUCCESS`, `KYB_APPROVED`, `KYC_APPROVED`) — fixed to use real
event names; all 228 audit tests still pass unchanged.

**3. Smoke-test plan regenerated.** Flow 1 rewritten to name the two distinct admin endpoints
(`approve-aml`, `complete-final-approval`) instead of one vague "approve AML/KYB" action, and to use
`LOGIN`/`ONBOARDING_STARTED`/`ONBOARDING_STATUS_UPDATED` instead of the fictional names. Flow 3
rewritten because it also implied an achievable-but-wrong causal order: `CONTRACT_OFFER_ACCEPTED`
does not fire from a manual issuer "accept" click on a phased-signing product — that path is
actively blocked by `assertPhasedOfferDirectAcceptBlocked` until signing evidence exists — it fires
as a side effect after `SIGNING_PACKAGE_COMPLETED`. All events named are still correct; only the
sequence description changed. Flows 2, 4, 5, 6, 7 were individually re-verified and needed no
changes. **Smoke-test count is unchanged at 7 flows** — the fix was to the event names and ordering
within existing flows, not the flow count.

**4. Notification scope — confirmed and made explicit.** `notification_logs` has exactly one writer:
the admin bulk-broadcast tool (`sendBulkNotification`). Ordinary per-user/system notifications
(`sendTyped`, `sendTypedPlatformOnly`) write to a separate, unrelated `Notification` table and are
not audited by this table on `origin/main` or after this phase. No coverage was expanded; a
"Notification scope" section was added to make this explicit.

**5. Signer-IP gap — deepened from "not captured" to a verified finding.**
**Provider supplies signer IP: UNKNOWN** (not NO). Every payload surface this integration currently
parses — the webhook callback, the contract-details fetch, and the three real row shapes captured in
`signingcloud-adapter.test.ts` — shows no IP field, but all of them are read permissively (specific
known keys extracted from an untyped `Record<string, unknown>`), and the certificate-of-completion
response variant (the conventional place an e-signature vendor embeds a signer audit trail) is never
requested by this integration (`isReqCertOfCompletion` is hardcoded `false`). Resolving this to a
firm YES/NO requires checking SigningCloud's own API reference or requesting the certificate variant
once, neither of which is preservation-safe to do inside this phase. Smallest safe implementation,
if confirmed available, is documented above — not implemented.

**6. Baseline — reconfirmed as measured, not inferred.** `origin/main` clean-checkout baseline:
**2227 passed, 1 failed.** This branch: **2455 passed, 1 failed**, same test
(`src/modules/notes/site-document-removal.test.ts`, pre-existing and unrelated). The delta of exactly
228 matches the 228 new audit tests added, with no existing test deleted or skipped. The report's
Test Results table and a new "Baseline provenance" note now state this explicitly.

**Corrected smoke-test count:** 7 (unchanged).
**Actual code defect discovered:** none. All findings above were documentation/report inaccuracies
or non-production test-fixture data; the writers, migrations, and presentation layer were already
correct and are unchanged by this pass.
**Code changes required before smoke testing:** none. The two fixes applied
(`account-logs.test.ts` fixture names, `preservation.test.ts` test description/comment) are already
made and verified — 228/228 audit tests pass.
**Final verdict: READY_FOR_SMOKE_TEST.**
