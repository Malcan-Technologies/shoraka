# origin/main Audit Standardization Plan

> **As-built snapshot of the standardization work**, not the current event/notification inventory.
> Current state: [`audit-event-surface-matrix.md`](./audit-event-surface-matrix.md).

Companion to `origin-main-preservation-inventory.md`. Records the as-built plan; every change is
additive and the expected UI effect is `NONE` throughout.

Guiding rule: **preservation beats standardization.** Where the two conflict, origin/main behaviour
wins and the improvement is flagged for a later phase. Three items were dropped mid-implementation
for exactly that reason and are listed under "Rejected during implementation".

## Change 0 — Shared audit context library

**WHY:** Eleven tables derive actor / IP / user-agent / correlation context in eleven different ways.
Forensic quality and consistency both suffer, and `correlation_id` — already produced by
`correlationIdMiddleware` — reaches only three tables.

**WHAT:** new `apps/api/src/lib/audit/`:

- `context.ts` — the shared vocabularies `AUDIT_ACTOR_TYPE`, `AUDIT_SOURCE`, `AUDIT_PORTAL`,
  `AUDIT_ORGANIZATION_KIND`, `AUDIT_TARGET_TYPE`; the `AuditRequestContext` type; and the derivations
  `auditContextFromRequest`, `webhookAuditContext`, `systemAuditContext`, `internalAuditContext`.
- `standard-fields.ts` — `resolveStandardAuditFields()`, which resolves the standard columns from a
  context. An explicitly supplied per-call value always wins, and only `undefined` counts as "not
  supplied", so a caller passing `null` to mean "record no value" is never overridden.
- `snapshot.ts` — `loadAuditActorSnapshot()` for the one table that needs identity evidence, and
  `changedFieldsOf()` for before/after field lists.
- `account-logs.ts`, `note-events.ts` — the centralized writers for the tables whose writers were
  spread across modules.
- `presentation-surface.ts` — the declared list of files that read, format, gate or export audit
  data, consumed by the presentation parity test.

**TABLE AFFECTED:** none. **WRITER AFFECTED:** none directly (opt-in).
**DATA PRESERVED:** all. **UI EFFECT:** NONE.
**COMPLIANCE EFFECT:** enables correlation capture on tables that lacked it.
**RISK:** none — new code.

## Change 1 — Additive schema columns

**WHY:** consistent actor / target / source / correlation fields make the existing tables queryable
as forensic evidence instead of loose JSON.

**WHAT:** nullable columns only. No drops, no renames, no type changes, no table changes, no
backfill.

| Table                       | Columns added                                                                                              | Deliberately NOT added                                                                    |
| --------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `access_logs`               | `actor_type`, `target_type`, `target_id`, `source`, `correlation_id`                                       | `actor_user_id` (`user_id` already is the actor); `organization_*` (unavailable at login) |
| `security_logs`             | `actor_type`, `target_type`, `target_id`, `source`, `portal`, `correlation_id`                             | `actor_user_id`, `device_type`, `organization_*` — no writer would populate them          |
| `onboarding_logs`           | `actor_type`, `actor_user_id`, `organization_kind`, `target_type`, `target_id`, `source`, `correlation_id` | `organization_id` — two typed FK columns already exist                                    |
| `application_logs`          | `actor_type`, `target_type`, `target_id`, `source`, `correlation_id`                                       | `actor_user_id` (`user_id` is the actor); `organization_*` (needs a query); `occurred_at` |
| `application_review_events` | `actor_type`, `source`, `portal`, `ip_address`, `user_agent`, `correlation_id`, `metadata`                 | `actor_user_id` — `reviewer_user_id` is the actor                                         |
| `legal_document_audit_logs` | `actor_type`, `target_type`, `target_id`, `source`, `portal`                                               | `organization_*`, `metadata` — `before_json`/`after_json` already carry the detail        |
| `product_logs`              | `actor_type`, `target_type`, `target_id`, `source`, `portal`, `correlation_id`                             | `actor_user_id`; `organization_*` (platform configuration, no organization)               |
| `note_events`               | `actor_type`, `target_type`, `target_id`, `source`                                                         | `organization_*` — needs a query                                                          |
| `note_admin_actions`        | `actor_type`, `portal`, `target_type`, `target_id`, `source`, `metadata`                                   | `organization_*` — needs a query                                                          |
| `gateway_payment_events`    | `actor_type`, `target_type`, `target_id`, `source`, `portal`, `ip_address`, `user_agent`, `correlation_id` | `idempotency_key`, `organization_*` — see "Rejected during implementation"                |
| `notification_logs`         | `actor_type`, `source`, `portal`, `correlation_id`, `success_count`, `failed_count`                        | `target_type`/`target_id` — `target_type` already means audience type on this table       |

`created_at` stays the occurred-at field on every table; no `occurred_at` column is introduced.
Deprecated-but-kept columns `application_logs.level`, `.target`, `.action` remain in the schema and
remain unwritten.

**Indexes:** limited to the two access paths the new columns create —
`(target_type, target_id, created_at)` on the nine tables that have both, and `(correlation_id)` on
the eleven that have it, plus `(actor_user_id, created_at)` on `onboarding_logs` where
`actor_user_id` is itself new. Composite indexes over already-indexed legacy columns were dropped
from the plan: they tune existing reader queries rather than serve the new columns, and each build
takes `ACCESS EXCLUSIVE` on a table whose writes sit inside business transactions.

**UI EFFECT:** NONE. The columns are nullable and no formatter, visibility rule or export projects
them.
**COMPLIANCE EFFECT:** IP / user-agent / correlation now capturable on `application_review_events`
and `gateway_payment_events`; actor separated from subject on `onboarding_logs`.
**RISK:** low. Additive migration; no backfill needed because every column is nullable.

## Change 2 — Standardized writers

**WHY:** writers populate whatever the local call site happens to hold, so the same event lands with
or without IP depending on the code path. Eighteen raw `prisma.<model>.create` sites across the
codebase each had their own field conventions.

**WHAT:** route every audit write through a module writer that resolves the standard columns
centrally. Every existing parameter and value expression is preserved.

**Non-negotiable design constraint — zero-query writers.** A writer must issue no database read.
Many callers wrap the audit write in a best-effort `try/catch` inside a business transaction, so a
lookup inside the writer would turn a transient read failure into a permanently lost audit row, and
could leave the Postgres transaction aborted. Every standard field is therefore derived from data
the caller already holds, or left null.

| Module                         | Writer                                                 | Behaviour change                                                                                                       |
| ------------------------------ | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Application                    | `applications/logs/repository.ts createApplicationLog` | accepts optional `context` and `db`; derives `actor_type`, `target_type`/`target_id`, `source`, `correlation_id`       |
| Application review             | `applications/logs/review-events.ts`                   | new centralized writer for the three `applicationReviewEvent.create` sites                                             |
| Access / Security / Onboarding | `lib/audit/account-logs.ts`                            | one writer per table, replacing duplicated writers in `auth/` and `admin/`                                             |
| Legal                          | `legal-documents/audit-log-service.ts`                 | uses the shared context; keeps `before_json`/`after_json`/`reason` as-is                                               |
| Product                        | `products/audit.ts`                                    | new centralized writer for the seven `productLog.create` sites                                                         |
| Note                           | `lib/audit/note-events.ts`                             | writers for `note_events` and `note_admin_actions`, used by notes, prospectus review, Shoraka STP and facility refresh |
| Payment                        | `payment/gateway-events.ts recordGatewayPaymentEvent`  | adds the standard columns; webhook and job paths resolve `source: INTERNAL`                                            |
| Notification                   | `notification/service.ts`                              | adds the standard columns and stores the already-computed delivery tally                                               |

**DATA PRESERVED:** every existing column and metadata key. `metadata` is passed through
byte-for-byte and is never merged, re-nested or extended.
**UI EFFECT:** NONE. **RISK:** medium-low — mitigated by the parity suite in Change 3.

## Change 3 — Automated parity suite

**WHY:** the delivery constraint is minimal manual QA, so everything provable from source must be
proved by a test.

| File                                    | Proves                                                                                                                                                                                                                                                           |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/audit/preservation.test.ts`        | no table removed or renamed; migration additive only; no event type added or removed; every event keeps a writer; every audit write goes through an approved writer; audit rows are never mutated; every legacy column still written; compliance columns present |
| `lib/audit/presentation-parity.test.ts` | every file that reads, formats, gates or exports audit data is byte-identical to origin/main, including reader blocks that share a file with a writer; no export spreads a raw row                                                                               |
| `lib/audit/evidence-metadata.test.ts`   | each business event still carries its required evidence keys; remark stays first-class; before/after pairs intact                                                                                                                                                |
| `lib/audit/standard-fields.test.ts`     | resolver precedence, explicit-null handling, source/actor consistency, BigInt-safe field diffing                                                                                                                                                                 |
| `lib/audit/account-logs.test.ts`        | writers issue no read; legacy columns written from the caller's values; metadata unchanged; actor never a sentinel                                                                                                                                               |

Supporting scripts, run against a reference revision rather than in CI:
`scripts/audit-baseline.ts`, `scripts/audit-presentation-baseline.ts` (fixture generators) and
`scripts/audit-callsite-parity.ts` (per-model written-column comparison).

**RISK:** none. Tests only.

## Rejected during implementation

Each of these was planned, built, and then removed because it violated the preservation contract.

- **Actor name/email snapshots merged into `metadata`.** The admin timeline gates its "View details"
  expander on metadata being non-empty and renders unknown keys generically, so merging derived keys
  would have added expanders, shown `actorEmail` in the UI, and changed CSV cells. Snapshots are kept
  only in the dedicated columns that already existed on `legal_document_audit_logs`.
- **Organization lookups inside writers.** Populating `organization_id` on `application_logs`,
  `note_events` and `gateway_payment_events` required a query per write, breaking the zero-query
  constraint.
- **`gateway_payment_events.idempotency_key`.** No writer would populate it; a unique constraint with
  no producer is a liability.
- **Threading request context into signing activity.** This wrote the envelope creator's IP into
  `application_logs.ip_address`, which the admin timeline merges into the exported metadata cell — a
  CSV change. It also did not satisfy the compliance requirement, which is the _signer's_ IP at
  signature time. Reverted; the real gap is reported instead.

## Explicitly out of scope

- No new event types in any domain.
- No table drop, rename, merge or destructive migration.
- No `activity-presentation.ts` change; no wording changes.
- No visibility widening or narrowing.
- No new raw audit-history UI panels.
- No signing audit table; no change to signing completion timing.
- No notification wording changes; no new notification types.
- No historical dev/UAT backfill (all new columns nullable).
