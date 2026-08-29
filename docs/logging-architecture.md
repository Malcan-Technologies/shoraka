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
| EVENTUAL_RETRY | `raiseOpsAlert` retries once, then structured `ops_alert_persist_failed` (never raises another alert). Hourly reconstruction rebuilds missing reconstructable alerts from durable state. |

Application timeline: when the caller passes a transaction client, a failed `logApplicationActivity` insert aborts that transaction. Sequential callers (no `db`) still use the origin overlay: the mutation can commit without a timeline row. Do not treat those overlay rows as a substitute for legal or financial evidence tables.

`APPLICATION_SUBMITTED` is written inside `persistSubmittedApplication` (same transaction as `status` + `submitted_at`) so the submitting actor is not lost. `APPLICATION_CREATED` stays a sequential overlay after the draft row commits; hourly timeline repair rebuilds missing created/submitted rows from `applications.created_at` / `submitted_at` with `source=INTERNAL` and a null actor (never invents a submitter).

## Ops alert reconstruction

`ops_alerts` is an Ops queue, not primary evidence. Live writers still retry persist once. An hourly job (`runOpsAlertReconstructionJob`) recreates missing OPEN rows from durable conditions using the same dedupe keys, and resolves OPEN/ACKNOWLEDGED rows when the condition has cleared.

| Type | Source of truth | Dedupe key | Reconstruct | Auto-resolve |
| --- | --- | --- | --- | --- |
| STUCK_PAYMENT | `gateway_payments` still `CREATED` after 60 minutes | `stuck-payment:{paymentId}` | yes | status ≠ CREATED |
| GATEWAY_LEDGER_MISMATCH | `HELD` + amount-mismatch metadata, no refund | `gateway-ledger-mismatch:{paymentId}` | yes | not HELD / refund started / mismatch gone |
| RECEIPT_FAILURE | `gateway_payment_receipts` FAILED | `receipt-failure:retry-job` | yes | no FAILED receipts |
| WEBHOOK_FAILURE | `gateway_webhook_events.error = Invalid stored payload` | `webhook-failure:{eventId}` | yes (create if absent) | no |
| SIGNING_EXPIRY | envelope `EXPIRED` in last 14 days | `signing-expiry:{envelopeId}` | yes (create if absent) | no |
| RECON_MISMATCH | `gateway_recon_exceptions` / FAILED recon runs | `recon-mismatch:{runId}:{id}` / `recon-run-failed:{runId}` | yes | exception resolved / run not FAILED |
| MISSING_LEGAL_EVIDENCE | completed guarantor recipient without ACCEPTED legal row | `missing-legal:{recipientId}` | yes | ACCEPTED row exists |
| PROVIDER_FAILURE (signing PDF) | completed docs missing `signed_s3_key` | `signing-reconcile:errors` | yes | no missing PDFs |
| PROVIDER_FAILURE (Curlec poll) | non-terminal payment; next poller retry | `provider-failure:curlec-order:{id}` | no | n/a |
| REPEATED_JOB_FAILURE | CloudWatch `logger.error` on the job | `job-failure:{jobName}` | no | n/a |

Do not reconstruct Curlec `PROVIDER_FAILURE` or `REPEATED_JOB_FAILURE` from the database. Those remain log-monitored residuals.

## Accountability scenarios (UAT)

Playwright portal smoke lives under `apps/*/e2e`. The checks below are the durable-evidence map for accountability UAT, not a second Playwright suite.

| # | Scenario | Business state | Actor / source | User sees | Admin/Ops |
| --- | --- | --- | --- | --- | --- |
| 1 | Issuer onboarding success | org + onboarding status | WEBHOOK or Admin API | milestone | org Activity + forensic |
| 2 | Onboarding amendment | PENDING_AMENDMENT + `ONBOARDING_AMENDMENT_REQUIRED` | Admin/provider | amendment milestone | forensic status + Ops |
| 3 | KYC reject/approve | KYC status on org/user | provider/Admin | KYC milestone | forensic |
| 4 | AML manual/provider | AML milestone log | provider/Admin | AML milestone | forensic |
| 5 | Admin reset/restart | onboarding reset/cancel + start | Admin API | cancelled/started | Admin + forensic |
| 6 | Application create | `applications` DRAFT + `created_at` | Issuer API | Application Started (overlay/repair) | timeline |
| 7 | Application submit | `status` + `submitted_at` + `APPLICATION_SUBMITTED` in same tx | Issuer API | Application Submitted | timeline + actor |
| 8 | Amendment/reject | review items + amendment logs | Admin/Issuer | amendment milestones | review events |
| 9 | Offer send | offer status + `CONTRACT/INVOICE_OFFER_SENT` | Admin | offer received | timeline |
| 10–14 | Signing sent/viewed/completed/declined/expired | envelope + recipient status | SYSTEM_JOB / webhook | sent/completed/declined/expired | envelope + Ops expiry |
| 15 | Fee payment success | `gateway_payments` + events | webhook | fee paid milestone | gateway events |
| 16 | Duplicate payment webhook | webhook idempotency + payment row | WEBHOOK | no duplicate milestone | same payment, occurrence |
| 17 | Facility fee paid | contract fee + `FACILITY_FEE_PAID` | webhook/API | fee paid | timeline + ledger |
| 18 | Investor deposit | wallet/ledger | webhook | deposit milestone | ledger |
| 19 | Investment | commitment + note events | Investor API | invested | note timeline |
| 20 | Disbursement | note/facility occupancy | Admin/system | occupancy | dual occupancy logs |
| 21 | Repayment | note payment | webhook/Admin | repayment | note + gateway |
| 22 | Late/arrears/default | servicing status | SYSTEM_JOB | arrears/default | Ops + note |
| 23 | Settlement | settlement + letter evidence | Admin | settlement milestone | settlement + trustee |
| 24 | Residual return | residual payment | system/Admin | return milestone | ledger |
| 25 | Investor withdrawal | withdrawal instruction | Investor/Admin | withdrawal | trustee + audit |
| 26 | Refund | refund_reference + events | webhook | refund milestone | gateway events |
| 27 | Ops Alert create/fail/recovery | durable condition + `ops_alerts` | SYSTEM_JOB | never | Ops queue + reconstruction |
| 28 | Legal acceptance | `legal_document_acceptances` | user API | not Activity | legal reader |
| 29 | External guarantor acceptance | `legal_external_acceptances` | signing webhook | not Activity | legal + Ops if missing |
| 30 | Admin audit export | enumerated export columns | Admin | n/a | CSV without forensic dump |

Issuer/Investor Activity must not show provider internals, webhook event names, request IDs, system jobs, Ops alerts, Admin rationale, security internals, ledger internals, or raw legal metadata.

## Current vs historical

Live vs historical vs dev-only classification is `apps/api/src/lib/audit/visibility-matrix.ts`. Historical readers stay so old rows still render. Help and catalogues must not advertise them as current writers.

Stale audit journals live under `docs/audit/archive/`.
