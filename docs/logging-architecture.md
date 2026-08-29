# Logging architecture

CashSouk does not keep one giant timeline. Each fact is written to the layer that owns it.

## Layers

| Layer | Store | Who sees it |
| --- | --- | --- |
| USER_ACTIVITY | access/security as needed | Account owner (milestones only via Activity adapters) |
| ORG_ACTIVITY | `onboarding_logs` | Issuer/Investor Activity (milestones); Admin org Activity (operational) |
| APPLICATION_TIMELINE | `application_logs` | Issuer Activity milestones; Admin application/facility timelines |
| NOTE_TIMELINE | `note_events` | Issuer/Investor note milestones; Admin note timeline |
| ADMIN_ACTIVITY | same tables, admin allowlists | Admin only |
| FORENSIC_ONLY | forensic columns + review-event mirror | Admin investigation; not user Activity |
| LEGAL_ONLY | `legal_document_acceptances`, `legal_external_acceptances`, `legal_document_audit_logs`, `generated_document_evidence` | Admin legal readers. Never Activity rows |
| FINANCIAL_ONLY | `gateway_payment_events`, ledgers | Admin finance / gateway screens |
| SECURITY_ONLY | `access_logs`, `security_logs` | Admin Audit → Access/Security |
| OPS_ONLY | `ops_alerts` | Admin Audit → Ops Alerts. Not user notifications |
| NOTIFICATION | `notifications` / `notification_logs` | User inboxes + Admin notification logs |

## Attribution

- Human API actions: `source=API`, real actor, portal of the request.
- Provider callbacks: `webhookAuditContext()` → `source=WEBHOOK`, `actor_type=INTEGRATION`, `actor_user_id` null.
- Jobs: `systemAuditContext()` → `source=SYSTEM_JOB`, `actor_type=SYSTEM`.
- Derived side-effects: `internalAuditContext()` → `source=INTERNAL`.
- Subject vs actor: onboarding `user_id` is the applicant; forensic `actor_user_id` is who acted.
- Admin-triggered recovery (manual onboarding refresh) uses `adminAuditContextFromRequest`: actor Admin, portal ADMIN, source API. True webhooks stay WEBHOOK.

## Evidence rules

- Activity metadata keeps ids, status, reason codes, entity refs. Raw RegTank payloads, full IC, JWTs and request bodies are stripped at the onboarding writer.
- Legal acceptances keep party/capacity snapshots and document hashes. External acceptances store envelope/application/org linkage without FK cascade.
- Generated LO files persist template and output SHA-256 in `generated_document_evidence`.
- Occupancy is two layers of the same business fact: `CONTRACT_FACILITY_OCCUPANCY_UPDATED` (application) and `FACILITY_OCCUPANCY_UPDATED` (note).

## Onboarding atomicity

Material onboarding/status mutations write organisation (or user) state and the matching `onboarding_logs` row in the **same Prisma transaction**. If the evidence insert fails, the state write rolls back.

That includes COD wait/approved/rejected (and PENDING_AMENDMENT forensic + customer `ONBOARDING_AMENDMENT_REQUIRED`), KYC/KYB business status, individual reject/status, AML milestones, EOD payload append + business event, membership, organisation profile, T&C accepted, Admin refresh business logs, Admin reset/cancel local persistence, and product create/update/delete snapshots.

Provider HTTP calls stay outside the DB transaction. After RegTank has already issued a new request id, local persist + evidence are still one transaction. Losing the provider call itself is a provider-side fact, not a silent local divergence.

## Skippable writers (not material evidence)

These may warn and continue. Losing them does not remove the business audit trail:

| Class | Examples |
| --- | --- |
| NOTIFICATION_DELIVERY | `notification_logs` insert after the inbox/email attempt; unique-conflict is a no-op |
| DIAGNOSTIC | Admin refresh persist of a provider snapshot into `regtank_response`; RegTank settings/webhook preference calls; AML mapping/fetch retries; CTOS KYB retry hooks; corporate_entities URL refresh |
| DEV_ONLY | `webhook-handler-dev.ts` onboarding log |
| BEST_EFFORT | Logout access log when the token is already invalid; Cognito sign-out |
| EVENTUAL_RETRY | `raiseOpsAlert` retries once, then structured `ops_alert_persist_failed` (never raises another alert) |

Application timeline: when the caller passes a transaction client, a failed `logApplicationActivity` insert aborts that transaction. Sequential callers (no `db`) still use the origin overlay: the mutation can commit without a timeline row. Do not treat those overlay rows as a substitute for legal or financial evidence tables.

## Current vs historical

Live vs historical vs dev-only classification is `apps/api/src/lib/audit/visibility-matrix.ts`. Historical readers stay so old rows still render. Help and catalogues must not advertise them as current writers.

Stale audit journals live under `docs/audit/archive/`.
