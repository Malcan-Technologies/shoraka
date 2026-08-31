# Logging architecture

CashSouk does not keep one giant timeline. Each fact is written to the layer that owns it.

## Layers

| Layer | Store | Who sees it |
| --- | --- | --- |
| USER_ACTIVITY | layer enum only; no catalogue rows | User milestones use `userVisible` on org/application/note events, not a separate table |
| ORG_ACTIVITY | `onboarding_logs` | Issuer/Investor Activity (milestones); Admin org Activity (operational) |
| APPLICATION_TIMELINE | `application_logs` | Issuer Activity milestones; Admin application/facility timelines |
| NOTE_TIMELINE | `note_events` | Issuer/Investor note milestones; Admin note timeline |
| ADMIN_ACTIVITY | same tables, admin allowlists | Admin only |
| FORENSIC_ONLY | forensic columns + review-event mirror | Admin investigation; not user Activity |
| LEGAL_ONLY | `legal_document_acceptances`, `legal_external_acceptances`, `legal_document_audit_logs`, `generated_document_evidence` | Admin legal readers. Never Activity rows |
| FINANCIAL_ONLY | `gateway_payments`, `gateway_payment_events`, ledgers | Admin finance / gateway screens. Provider traces live here (and process logs), not Activity |
| SECURITY_ONLY | `access_logs`, `security_logs` | Admin Audit → Access/Security |
| NOTIFICATION | `notifications` / `notification_logs` | User inboxes + Admin notification logs. Not an event-catalogue table |

There is no Ops Alerts layer, queue, or reconstruction job. Activity is not the source of truth for legal evidence, financial journals, gateway diagnostics, forensic columns, or notifications.

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

Application timeline: when the caller passes a transaction client, a failed `logApplicationActivity` insert aborts that transaction. Sequential callers (no `db`) still use the origin overlay: the mutation can commit without a timeline row. Do not treat those overlay rows as a substitute for legal or financial evidence tables.

`APPLICATION_SUBMITTED` is written inside `persistSubmittedApplication` (same transaction as `status` + `submitted_at`) so the submitting actor is not lost. `APPLICATION_CREATED` stays a sequential overlay after the draft row commits; hourly timeline repair rebuilds missing created/submitted rows from `applications.created_at` / `submitted_at` with `source=INTERNAL` and a null actor (never invents a submitter).

## Accepted residuals

These are known gaps. They are not silent, and they are not an Ops Alert queue.

1. **`APPLICATION_CREATED` is a rebuildable timeline projection.** The draft `applications` row is the durable create fact. The timeline row is overlay-or-repair. Missing created/submitted timeline rows are rebuilt from `created_at` / `submitted_at` as above.
2. **Curlec provider/sync failure is secondary to durable gateway state.** `gateway_payments` plus `gateway_payment_events` and the stuck-order poller are the money-in record. A failed provider fetch logs a warning and returns the stored payment. There is no reconstruction job and no Ops Alert.
3. **Repeated job failure is `logger.error` plus the next cron run.** `initJobs()` logs the error and the following schedule retries. There is no reconstruction mechanism and no Ops Alert.

## Accountability scenarios (UAT)

Playwright portal smoke lives under `apps/*/e2e`. The checks below are the durable-evidence map for accountability UAT, not a second Playwright suite.

| # | Scenario | Business state | Actor / source | User sees | Admin/Ops |
| --- | --- | --- | --- | --- | --- |
| 1 | Issuer onboarding success | org + onboarding status | WEBHOOK or Admin API | milestone | org Activity + forensic |
| 2 | Onboarding amendment | PENDING_AMENDMENT + `ONBOARDING_AMENDMENT_REQUIRED` | Admin/provider | amendment milestone | forensic status |
| 3 | KYC reject/approve | KYC status on org/user | provider/Admin | KYC milestone | forensic |
| 4 | AML manual/provider | AML milestone log | provider/Admin | AML milestone | forensic |
| 5 | Admin reset/restart | onboarding reset/cancel + start | Admin API | cancelled/started | Admin + forensic |
| 6 | Application create | `applications` DRAFT + `created_at` | Issuer API | Application Started (overlay/repair) | timeline |
| 7 | Application submit | `status` + `submitted_at` + `APPLICATION_SUBMITTED` in same tx | Issuer API | Application Submitted | timeline + actor |
| 8 | Amendment/reject | review items + amendment logs | Admin/Issuer | amendment milestones | review events |
| 9 | Offer send | offer status + `CONTRACT/INVOICE_OFFER_SENT` | Admin | offer received | timeline |
| 10–14 | Signing sent/viewed/completed/declined/expired | envelope + recipient status | SYSTEM_JOB / webhook | sent/completed/declined/expired | envelope + `SIGNING_PACKAGE_*` |
| 15 | Fee payment success | `gateway_payments` + events | webhook | fee paid milestone | gateway events |
| 16 | Duplicate payment webhook | webhook idempotency + payment row | WEBHOOK | no duplicate milestone | same payment, occurrence |
| 17 | Facility fee paid | contract fee + `FACILITY_FEE_PAID` | webhook/API | fee paid | timeline + ledger |
| 18 | Investor deposit | wallet/ledger | webhook | deposit milestone | ledger |
| 19 | Investment | commitment + note events | Investor API | invested | note timeline |
| 20 | Disbursement | note/facility occupancy | Admin/system | occupancy | dual occupancy logs |
| 21 | Repayment | note payment | webhook/Admin | repayment | note + gateway |
| 22 | Late/arrears/default | servicing status | SYSTEM_JOB | arrears/default | note timeline |
| 23 | Settlement | settlement + letter evidence | Admin | settlement milestone | settlement + trustee |
| 24 | Residual return | residual payment | system/Admin | return milestone | ledger |
| 25 | Investor withdrawal | withdrawal instruction | Investor/Admin | withdrawal | trustee + audit |
| 26 | Refund | refund_reference + events | webhook | refund milestone | gateway events |
| 27 | Legal acceptance | `legal_document_acceptances` | user API | not Activity | legal reader |
| 28 | External guarantor acceptance | `legal_external_acceptances` | signing webhook | not Activity | legal reader |
| 29 | Admin audit export | enumerated export columns | Admin | n/a | CSV without forensic dump |

Issuer/Investor Activity must not show provider internals, webhook event names, request IDs, system jobs, Admin rationale, security internals, ledger internals, or raw legal metadata.

## Current vs historical

Live vs historical vs dev-only classification is `apps/api/src/lib/audit/visibility-matrix.ts`. Historical readers stay so old rows still render. Help and catalogues must not advertise them as current writers.

Stale audit journals live under `docs/audit/archive/`.

Admin Help for Operations is `packages/help-content/markdown/admin-operations-activity-audit-guide.md`. Event names live in `docs/logging-event-catalogue.md`.

## Record prefixes

| Prefix | Meaning |
| --- | --- |
| APP | Application |
| CON | Facility / Contract |
| INV | Invoice |
| NOTE | Investment Note |
| SET | Settlement |
| WDL | Withdrawal |
| ISS | Issuer organisation |
| IVT | Investor organisation |
| RCP | Receipt |
