# origin/main Audit Standardization — Final Report

Reference revision: `origin/main` @ `28ae5c58`. Companion documents:
`origin-main-preservation-inventory.md` (Phase 1) and `origin-main-standardization-plan.md`
(Phase 2, as-built).

## Verdict

**SAFE_TO_MINIMAL_MANUAL_SMOKE_TEST**

Product behaviour is unchanged by construction: every file that reads, formats, gates visibility of,
or exports audit data is byte-identical to `origin/main`, and this is asserted by a test rather than
inspected by eye. All changes are on the write path plus a nullable-column migration.

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

**DEAD EVENTS FOUND:** no event type is declared without a production writer. The genuinely dead
artefacts are the three deprecated columns `application_logs.level`, `.target`, `.action`, always
written as `null`, and their enums `ActivityLevel` / `ActivityTarget` / `ActivityAction`, which have
no reference outside their own declaration. **Flagged only — not removed**, because the columns may
hold historical production values written before they were deprecated.

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
| **NOTIFICATION ALIGNMENT**   | PASS                           | Trigger, recipient, type, title, message, and the admin log reader are unchanged; the writer now also stores the delivery tally it already computed.                                |
| **UI BEHAVIOUR**             | PASS                           | No file under `apps/admin`, `apps/issuer`, `apps/investor`, `packages/ui`, `packages/types` or `packages/config` is modified.                                                       |

### Metadata

`metadata` is passed through byte-for-byte at every writer. No key is added, removed, renamed or
re-nested, and no derived value is merged in. This is asserted directly, because the admin timeline
gates its "View details" expander on metadata being non-empty and renders unknown keys generically —
so any added key would have been a visible UI and CSV change.

The two new `metadata` columns on `application_review_events` and `note_admin_actions` are additive
and unread; the dedicated `remark`, `old_status`, `new_status`, `before_state` and `after_state`
columns keep their values.

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
signing table. This was attempted and reverted: threading the request context into signing activity
captured the _envelope creator's_ IP, not the signer's, and it changed the admin CSV export because
the timeline merges `application_logs.ip_address` into the exported metadata cell. Closing it
properly needs a nullable `signed_ip_address` / `signed_user_agent` on `signing_assignments` (or
`signing_recipients`) populated at the external signing callback, which is a writer at a new
boundary and therefore out of scope for a preservation-only phase. Reported, not implemented.

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

| Suite                         | Tests | Proves                                                                                                                                                                                                                                                                                                                    |
| ----------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `preservation.test.ts`        | 64    | table set frozen; migration additive only; event catalogue frozen per table; every event keeps a writer; every audit write goes through an approved writer; audit rows never mutated or deleted; every legacy column still written; metadata never rewritten; zero-query writers; compliance columns present and nullable |
| `presentation-parity.test.ts` | 125   | 98 presentation files byte-identical to `origin/main`; 15 reader blocks that share a file with a writer byte-identical; exports project columns explicitly                                                                                                                                                                |
| `evidence-metadata.test.ts`   | 12    | each business event carries its required evidence keys at every writer; remark first-class; before/after pairs intact                                                                                                                                                                                                     |
| `standard-fields.test.ts`     | 16    | resolver precedence; explicit `null` honoured; blank normalized; source/actor consistency; BigInt-safe diffing                                                                                                                                                                                                            |
| `account-logs.test.ts`        | 11    | writers issue no read; legacy columns written from the caller's own values; metadata byte-identical; actor never a sentinel                                                                                                                                                                                               |

Supporting scripts (run against a reference revision, not in CI):

- `scripts/audit-baseline.ts` — regenerates the table/event fixture.
- `scripts/audit-presentation-baseline.ts` — regenerates the presentation hash fixture.
- `scripts/audit-callsite-parity.ts` — compares written columns per model against a reference tree.

**What the automated suite cannot prove**, and therefore what the manual smoke tests exist to cover:
that a real write reaches the database with the expected values under a real transaction, and that
the rendered timeline for a freshly created record looks the same as before.

## Minimum manual smoke tests

Seven flows. Everything else is covered by source-level parity.

### 1. Onboarding + AML decision

**ACTIONS:** register an issuer, complete onboarding, approve AML/KYB as admin.
**EVENTS COVERED:** `ONBOARDING_*`, `KYB_APPROVED`, `AML_APPROVED`, `FINAL_APPROVAL_COMPLETED`,
`LOGIN_SUCCESS`, legal acceptance.
**FIELDS VERIFIED:** `onboarding_logs.actor_user_id` holds the _admin_ id and not the applicant;
`organization_kind` set; `correlation_id` present; `legal_document_acceptances` keeps hash + IP.
**UI VERIFIED:** admin organization Activity tab; issuer Activity feed.
**WHY THIS IS ENOUGH:** exercises the one writer whose actor semantics changed, across both the
self-service path and the admin-decision path, plus the webhook path via the provider callback.

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

**ACTIONS:** issue an offer, issuer accepts, complete signing, then void one envelope as admin.
**EVENTS COVERED:** `CONTRACT_OFFER_ACCEPTANCE_SUBMITTED`,
`CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING`, `CONTRACT_OFFER_ACCEPTED`, `SIGNING_PACKAGE_CREATED`,
`SIGNING_PACKAGE_COMPLETED`, `SIGNING_PACKAGE_VOIDED`, `APPLICATION_COMPLETED`.
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

| Check                                               | Result                                                                                   |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `npx jest src/lib/audit` (audit parity suite)       | **228 passed**, 0 failed                                                                 |
| `npx jest` (full API suite)                         | **2455 passed**, 1 failed — pre-existing and unrelated                                   |
| `pnpm -w test` (workspace)                          | 8 of 9 tasks pass; the API task carries the same single pre-existing failure             |
| `npx tsc --noEmit` (API)                            | **clean**                                                                                |
| `npx eslint` on all new and changed audit files     | **clean** (0 errors, 0 warnings)                                                         |
| `npx eslint src scripts`                            | 27 pre-existing errors, none in a file this branch touches                               |
| `npx prettier --check` on new files                 | **clean**                                                                                |
| `npx prisma validate`                               | **valid**                                                                                |
| `prisma migrate diff` schema vs migrations          | **no drift** (empty migration)                                                           |
| `scripts/audit-callsite-parity.ts` vs `origin/main` | **no columns lost** on any of the 11 models; every model writes more columns than before |
| Build                                               | not run — no bundler-visible change; typecheck covers the API                            |

The single failing test is `src/modules/notes/site-document-removal.test.ts`, which asserts a regex
against `apps/investor/src/app/investments/page.tsx`. That file is a re-export on `origin/main` and
neither it nor the test is touched by this branch, so the failure reproduces on `origin/main`.

## Possible future improvements — not implemented

**POSSIBLE IMPROVEMENT — signer IP at signature time.** Add nullable `signed_ip_address` /
`signed_user_agent` to `signing_assignments`, populated at the external signing callback. This is the
one unmet compliance evidence field.

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
