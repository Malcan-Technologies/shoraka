# Razorpay / Curlec — Final Implementation Plan

Date: 2026-07-08  
Sources reconciled:

- `RAZORPAY_IMPLEMENTATION_AUDIT.md`
- `RAZORPAY_IMPLEMENTATION_MATRIX.md`
- `RAZORPAY_FIX_PLAN.md`
- `RAZORPAY_AUDIT_SECOND_REVIEW.md`

**Conflict rule:** Where the first audit and second review disagree, this plan follows the **second review**.

No application code, schema, migrations, config, env, or tests are changed by this document.

---

## 1. Decision rules

### Verification precedence

| Rule | Application |
|------|-------------|
| Second review wins on conflicts | Used for cron locking, EXPIRED late-capture, wallet atomicity nuance, test-topup guard, manual recon lock gap |
| First audit + matrix used as complement | Architecture maps, file references, ops/UI gaps where second review did not contradict |
| Fix plan used for phasing hints | C1–C6, U1–U8, L1–L7, O1–O8, E1–E7 mapped into batches below |
| Repository evidence required for each batch | Every batch cites affected modules verified in second review |

### Conflict reconciliation table

| Topic | First audit / matrix | Second review (authoritative) | Final plan decision |
|-------|----------------------|----------------------------------|---------------------|
| Multi-instance cron duplicate runs | Medium risk; duplicate execution possible | Advisory locks on cron paths reduce risk; still monitor | Not a production blocker if lock verified; add monitoring in launch gate |
| EXPIRED issuer fee retry | High — reuse blocks new order | Confirmed — `status: { not: FAILED }` includes EXPIRED | **Batch 1A** — fix before UAT |
| Late capture after EXPIRED | Mentioned indirectly | Confirmed — `TERMINAL_GATEWAY_STATUSES` skips webhook/sync | **Batch 1A** — treat as captured-but-unprocessed money risk |
| Duplicate investor deposits | High — every POST creates order | Confirmed — no open-order check | **Batch 1B** — separate PR from 1A |
| Wallet credit atomicity | Complete / atomic | Partially correct — increment before idempotent insert race | Add concurrency hardening in **Batch 2** (double-credit priority) |
| Refund initiation atomicity | Partial — API before DB tx | Confirmed — split atomicity | **Batch 3** |
| `settlement.processed` | Not implemented | Confirmed absent | **Batch 6** — decision only unless ops requires real-time stamp |
| Recon rerun safety | Deletes exceptions | Confirmed — history loss on rerun | **Batch 4** — preserve exception history |
| Manual recon overlap | Not highlighted | Manual path lacks advisory lock | **Batch 4** — add lock on manual trigger |
| Dev simulator prod risk | High if misused | Guard exists (`NODE_ENV === production`); misuse still possible | **Batch 5** — harden guards |
| Test/live credential mixing | Mentioned | Confirmed — no key-prefix validation | **Batch 2** — startup validation |
| Webhook idempotency | Complete sequential dedupe | Partial — concurrent same-event race | **Batch 2** — optional claim lock |
| `INVESTOR_BALANCE_TEST_TOPUP` prod guard | U8 references env flag | Second review: guard is `NODE_ENV`-based in notes module | Launch gate verifies prod block, not env flag name |
| Payer name in live FPX | Critical pre-live, unconfirmed | Requires external Curlec confirmation | **Batch 2** — external confirmation gate, not code-only |
| One vs two Curlec accounts | Documented single account; stakeholder may expect two | Confirmed single runtime credential set | **Batch 2** — business confirmation before production |

### Batch 1 split decision (A + B vs C)

| Criterion | Batch 1A (A + B) | Batch 1B (C) |
|-----------|------------------|--------------|
| Services touched | `onboarding-fee-service.ts`, `processing-fee-service.ts`, `webhook-service.ts`, `state.ts` | `deposit-service.ts`, `gateway-order-service.ts`, investor frontend |
| Rollback strategy | Revert fee reuse + EXPIRED capture exception handling | Revert dedup policy / partial unique index |
| Idempotency rules | Status transitions + terminal-set semantics | Open-order reuse or client/server idempotency key |
| Schema migration | None expected | **Likely required** for race-safe dedup (see Batch 1B) |
| Review boundary | One PR — shared EXPIRED lifecycle theme | Separate PR — product policy + possible DB constraint |

**Conclusion:** Split into **Batch 1A** and **Batch 1B**. Do not combine A/B/C in one pull request.

---

## 2. Prioritized implementation sequence

Phases follow the required priority order. Numbers in parentheses are batch IDs.

| Phase | Priority theme | Batches | Rationale |
|-------|----------------|---------|-----------|
| **Phase 0** | Pre-sandbox external setup | External gates in §6 | Credentials, webhook URL, live payer-name sample — no code merge required first |
| **Phase 1** | Captured-but-unprocessed + fee retry | **1A** | EXPIRED blocks retry and drops late capture — money can sit at Curlec unprocessed |
| **Phase 2** | Double-credit + duplicate pay | **1B**, **2** | Duplicate deposit orders; wallet/webhook concurrency edges |
| **Phase 3** | Account/credential correctness | **2** (continued) | Single-account confirmation, test/live key validation, FPX payer-name sign-off |
| **Phase 4** | Refund safety | **3** | Curlec refund succeeds but DB update fails |
| **Phase 5** | Settlement/recon reliability | **4** | Manual lock, exception history, missed-date recovery |
| **Phase 6** | Operational visibility + UI wording | **5** | Admin settlement fields, webhook viewer, simulator hardening, label clarity |
| **Phase 7** | Optional / decision-only | **6** | `settlement.processed`, dual account, advanced enhancements |

---

## 3. Batch catalog

Each batch is independently reviewable. Fields are mandatory per plan spec.

---

### Batch 1A — Issuer fee retry after EXPIRED + late capture recovery

| Field | Detail |
|-------|--------|
| **Objective** | Unblock issuer/processing fee payments after expiry and recover Curlec captures that arrive after CashSouk marked an order EXPIRED |
| **Exact problem** | (A) `findExisting*FeePayment` reuses any status except FAILED, so EXPIRED rows block new orders. (B) `TERMINAL_GATEWAY_STATUSES` includes EXPIRED; webhook/sync paths return early and drop late captures |
| **Affected files** | `apps/api/src/modules/payment/onboarding-fee-service.ts`, `processing-fee-service.ts`, `webhook-service.ts`, `state.ts`, `gateway-stuck-order-poller.ts`; issuer UI `apps/issuer/src/app/onboarding/fee/page.tsx`, `application-processing-fee-step.tsx` (copy/UX alignment only if needed) |
| **Schema / migration impact** | None |
| **API impact** | POST fee endpoints return new CREATED order after EXPIRED; possible new admin/ops visibility for late-capture recovery events |
| **Frontend impact** | Issuer fee retry UX should match backend (new order after EXPIRED) |
| **Webhook impact** | Allow EXPIRED → PAID (or dedicated recovery path) when Curlec reports capture after internal expiry |
| **Background-job impact** | Stuck-order poller continues to expire CREATED; late capture handled in webhook/sync, not poller |
| **Tests required** | Integration: EXPIRED fee → new order; EXPIRED + simulated late `payment.captured` → processed or explicit HELD/ops queue; regression for normal expiry unchanged |
| **Rollback considerations** | Revert fee reuse filter and terminal skip exception; monitor for duplicate fee completion if rollback after live traffic |
| **Dependencies** | None |
| **Estimated complexity** | Small–Medium (2–3 days) |
| **Acceptance criteria** | After EXPIRED, issuer can create a new fee order; late capture on previously EXPIRED row is not silently dropped; no duplicate COMPLETED fee for same capture |
| **External confirmations** | **Ivan** — confirm UX for “start new payment” after expiry; **Finance** — confirm whether late capture should auto-complete or go to ops queue |

**Maps to items:** A, B

---

### Batch 1B — Prevent duplicate investor deposit orders

| Field | Detail |
|-------|--------|
| **Objective** | Stop repeated POST / double-click from creating multiple open Curlec deposit orders for the same investor |
| **Exact problem** | `createInvestorDeposit()` always calls `createGatewayOrder()` with no check for existing open deposit (`deposit-service.ts` L118–131) |
| **Affected files** | `apps/api/src/modules/payment/deposit-service.ts`, `gateway-order-service.ts`, `deposit-controller.ts`, `deposit-schemas.ts`; `apps/investor/.../investor-deposit-form.tsx`; optional `packages/config` SDK |
| **Schema / migration impact** | **Recommended:** partial unique index preventing multiple open investor deposits per org (e.g. one row per `investor_organization_id` where `purpose = INVESTOR_DEPOSIT` and `status IN (CREATED, PAID, NAME_CHECK_PENDING)`). Prisma may require raw SQL migration — service-only dedup is insufficient under concurrent POSTs |
| **API impact** | POST `/v1/investor/deposits` returns existing open order or 409 with existing payment id; optional `Idempotency-Key` header support |
| **Frontend impact** | Disable double-submit; handle 409 by resuming existing checkout |
| **Webhook impact** | None directly |
| **Background-job impact** | None |
| **Tests required** | Integration: double POST same amount → one order; concurrent POST race; E2E double-click on deposit form |
| **Rollback considerations** | Dropping partial unique index allows duplicate orders again; revert API to always-create behavior |
| **Dependencies** | Product decision on reuse vs reject; can ship after **1A** |
| **Estimated complexity** | Medium (3–4 days if migration + frontend) |
| **Acceptance criteria** | At most one open investor deposit per org at a time; concurrent creates do not produce two CREATED rows |
| **External confirmations** | **Ivan** — reuse open order vs error on duplicate; **Compliance** — if deposit limits interact with multiple pending orders |

**Maps to items:** C

---

### Batch 2 — Credential correctness, payer-name gate, concurrency hardening

| Field | Detail |
|-------|--------|
| **Objective** | Confirm account model, block test/live credential mixing, validate live FPX payer name, reduce double-credit race windows |
| **Exact problem** | Single global `CURLEC_*` set; no key-prefix vs `NODE_ENV` validation; payer name unproven in live FPX; `creditInvestorBalance` increment-before-insert race; webhook concurrent duplicate edge |
| **Affected files** | `apps/api/src/config/curlec.ts`, `apps/api/src/index.ts` (startup validation), `apps/api/src/modules/notes/investor-balance.ts`, `webhook-service.ts`; `infra/ecs-task-definition-api.json`, `env-templates/`; ops runbook |
| **Schema / migration impact** | None for validation; optional none for concurrency fix |
| **API impact** | Fail fast at boot on credential mode mismatch; no API contract change for deposits unless idempotency header added in 1B |
| **Frontend impact** | None |
| **Webhook impact** | Optional claim/lock on `gateway_webhook_events` before processing |
| **Background-job impact** | None |
| **Tests required** | Unit: startup rejects `rzp_test_` in production; integration: `payment.captured` + `order.paid` pair; concurrent credit idempotency |
| **Rollback considerations** | Remove startup validation if secrets misconfigured during incident — document override procedure |
| **Dependencies** | AWS secrets populated (Phase 0); **1B** can proceed in parallel but production gate needs this batch |
| **Estimated complexity** | Medium (3–5 days code + ops for live FPX sample) |
| **Acceptance criteria** | Production boot fails on test keys; live FPX sample documents payer name field availability; no duplicate wallet credit under concurrent webhook replay test |
| **External confirmations** | **Curlec** — live FPX payer name field; **Ivan/Finance** — one-account vs two-account decision; **Compliance** — name-check rules if payer name absent in live |

**Maps to items:** D, E, second-review claims 7–9, fix-plan C1–C3, C19

---

### Batch 3 — Refund initiation recoverability

| Field | Detail |
|-------|--------|
| **Objective** | Recover when Curlec refund API succeeds but DB transaction fails |
| **Exact problem** | `initiateInvestorDepositRefund()` calls Curlec before DB tx (`refund-service.ts` L166–238) |
| **Affected files** | `apps/api/src/modules/payment/refund-service.ts`, `webhook-service.ts`, optional new job in `apps/api/src/lib/jobs/` |
| **Schema / migration impact** | Optional: `refund_reference` already stored; may add reconciliation job cursor table — prefer none initially |
| **API impact** | Admin retry/refund endpoints idempotent when `refund_reference` already set; optional internal reconcile endpoint |
| **Frontend impact** | Admin HELD/refund UI shows Curlec refund id when recovered |
| **Webhook impact** | `refund.processed` should complete rows stuck in PAID/HELD with existing `refund_reference` |
| **Background-job impact** | New periodic job: find payments with Curlec refund id but status not REFUND_INITIATED/REFUNDED |
| **Tests required** | Integration: simulate API success + DB failure → job or webhook completes; idempotent retry |
| **Rollback considerations** | Disable job if false positives; manual ops can complete via admin retry-refund |
| **Dependencies** | None strict; safer after **1A** late-capture clarity |
| **Estimated complexity** | Medium (3–4 days) |
| **Acceptance criteria** | No payment left with Curlec refund id and status still PAID/NAME_CHECK_PENDING without HELD reason; admin can see recoverable state |
| **External confirmations** | **Finance** — ops procedure for stuck refunds |

**Maps to items:** F, fix-plan U2 (partial overlap)

---

### Batch 4 — Reconciliation reliability (lock, history, backfill)

| Field | Detail |
|-------|--------|
| **Objective** | Safe concurrent recon runs, preserve exception audit trail, recover missed settlement dates |
| **Exact problem** | Manual recon lacks advisory lock (`recon-service.ts`); rerun deletes exceptions (`gateway-settlement-recon.ts` L137); cron only processes yesterday — no auto backfill |
| **Affected files** | `apps/api/src/lib/jobs/gateway-settlement-recon.ts`, `apps/api/src/modules/payment/recon-service.ts`, `recon-controller.ts`, `with-advisory-lock.ts` |
| **Schema / migration impact** | Optional: append-only exception history or soft-close fields — prefer soft-close (`superseded_at`) over delete |
| **API impact** | Manual POST run returns 409 if lock held; optional date-range backfill admin API |
| **Frontend impact** | Reconciliation page: backfill date range; show lock-in-progress state |
| **Webhook impact** | None |
| **Background-job impact** | Cron unchanged; optional backfill job or enhanced manual range |
| **Tests required** | Integration: concurrent manual + cron; rerun preserves resolved exceptions; backfill two missed dates |
| **Rollback considerations** | Revert to delete-on-rerun if migration issues — export exceptions before deploy |
| **Dependencies** | None |
| **Estimated complexity** | Medium (4–5 days) |
| **Acceptance criteria** | Resolved exceptions survive rerun; manual and cron cannot corrupt same run concurrently; ops can backfill N missed MYT dates |
| **External confirmations** | **Finance** — backfill approval process; **Compliance** — exception retention period |

**Maps to items:** G, H, I

---

### Batch 5 — Operational visibility, simulator hardening, admin UI

| Field | Detail |
|-------|--------|
| **Objective** | Give ops settlement/refund/webhook visibility; block dev tools from prod misuse; clarify reconciliation wording |
| **Exact problem** | Settlement fields not on admin detail; no webhook UI; dev simulator + `DISABLE_AUTH` payment routes; confusing “payments stamped” labels |
| **Affected files** | `apps/api/src/modules/payment/admin-service.ts`, `apps/admin/.../gateway-payments/[id]/page.tsx`, `reconciliation/page.tsx`; new admin webhook list API/page; `apps/api/scripts/dev-simulate-gateway-settlement.ts`; `routes.ts` (DISABLE_AUTH scope) |
| **Schema / migration impact** | None |
| **API impact** | Admin GET webhook events (paginated, masked payload); gateway payment detail includes `settlement_id`, `settled_at`, `gateway_fee_amount` |
| **Frontend impact** | Admin detail + recon labels + optional webhook viewer |
| **Webhook impact** | None |
| **Background-job impact** | None |
| **Tests required** | Admin RBAC; UI shows settlement fields after recon; simulator refuses prod DB host |
| **Rollback considerations** | UI-only rollback safe; API fields additive |
| **Dependencies** | **Batch 4** helpful before ops relies on exception history UI |
| **Estimated complexity** | Medium (4–6 days total; can split K/N as small follow-up) |
| **Acceptance criteria** | Ops sees settlement metadata on payment detail; recon page uses “settlement date” / “payments linked to settlement report” wording; webhook list searchable by event type; simulator cannot run against prod DB |
| **External confirmations** | **Finance** — label sign-off; **Ivan** — admin UX priority |

**Maps to items:** K, L, M, N, fix-plan U3, U4, O1

---

### Batch 6 — `settlement.processed` decision (optional implementation)

| Field | Detail |
|-------|--------|
| **Objective** | Decide whether real-time settlement webhook is needed vs daily recon-only stamping |
| **Exact problem** | No `settlement.processed` handler in `webhook-service.ts`; settlement metadata written only in recon job |
| **Affected files** | Decision doc only; if implemented: `webhook-service.ts`, `webhook-schemas.ts`, tests |
| **Schema / migration impact** | None |
| **API impact** | None unless implementing handler |
| **Frontend impact** | Optional earlier settlement display |
| **Webhook impact** | New handler would stamp `settlement_id`, `settled_at`, `gateway_fee_amount` at event time |
| **Background-job impact** | Recon remains source of truth for exceptions; handler must be idempotent with recon |
| **Tests required** | Webhook integration for settlement event; idempotent with recon stamp |
| **Rollback considerations** | Disable handler; recon still works |
| **Dependencies** | **Batch 4** recon reliability |
| **Estimated complexity** | Small (decision) / Medium (implementation) |
| **Acceptance criteria** | Signed decision: recon-only OK for launch **or** handler implemented with idempotent stamp |
| **External confirmations** | **Finance** — is daily recon sufficient? **Curlec** — confirm event payload and delivery |

**Maps to items:** J, fix-plan E2

---

## 4. A–N explicit evaluation table

| ID | Item | Classification | Owning phase / batch | Dependency notes |
|----|------|----------------|----------------------|------------------|
| **A** | Fix issuer fee retry after EXPIRED | **Blocker before UAT** | Phase 1 / **1A** | Also fix processing fee (`processing-fee-service.ts`) |
| **B** | Handle late payment capture after internal EXPIRED | **Blocker before production** | Phase 1 / **1A** | Money captured at Curlec but dropped today — priority 3 |
| **C** | Prevent duplicate investor deposit orders | **Blocker before UAT** | Phase 2 / **1B** | Likely needs partial unique index; product policy for reuse |
| **D** | Confirm one-account vs two-account Curlec routing | **Blocker before production** | Phase 3 / **2** | Code is single-account; dual account is large optional (E1) |
| **E** | Confirm live FPX payer-name availability | **Blocker before production** | Phase 3 / **2** | External Curlec confirmation; blocks name-check automation |
| **F** | Make refund initiation recoverable (API ok, DB fail) | **Blocker before production** | Phase 4 / **3** | Independent of 1A/1B |
| **G** | Prevent concurrent reconciliation for same date | **Blocker before production** | Phase 5 / **4** | Manual path lacks lock (second review) |
| **H** | Preserve reconciliation exception history | **Blocker before production** | Phase 5 / **4** | Compliance/audit — delete on rerun confirmed |
| **I** | Recover missed reconciliation dates automatically | **Operational improvement** | Phase 5 / **4** | Manual per-date works for launch; backfill improves ops |
| **J** | Decide on `settlement.processed` webhook | **Optional** (decision **Blocker before production** for sign-off only) | Phase 7 / **6** | Implement only if Finance rejects recon-only |
| **K** | Add settlement metadata to admin Gateway Payment detail | **Operational improvement** | Phase 6 / **5** | Data exists after recon |
| **L** | Add webhook event visibility for operations | **Operational improvement** | Phase 6 / **5** | Payloads in DB only today |
| **M** | Remove or production-block dev gateway simulators | **Blocker before production** | Phase 6 / **5** | Guard exists; add DB host guard |
| **N** | Improve confusing terms (“Payments stamped”) | **Operational improvement** | Phase 6 / **5** | UX only; pair with captured≠settled docs (fix-plan U5) |

### Additional items from reconciled audits (not in A–N letters)

| Item | Classification | Batch |
|------|----------------|-------|
| Credential test/live mixing validation | **Blocker before production** | **2** |
| Wallet credit concurrency hardening | **Blocker before production** | **2** |
| Webhook concurrent idempotency claim | **Operational improvement** | **2** |
| `DISABLE_AUTH` exposes payment create routes | **Blocker before production** (env discipline) | **5** / launch gate |
| Stuck-order poller 100-row cap | **Operational improvement** | Post-launch optional |
| Dual Curlec merchant accounts | **Optional** | Fix-plan E1 — only if **D** requires two accounts |
| PAID-without-refund crash window (name FAIL path) | **Blocker before UAT** | Overlaps **3** + webhook hardening |

---

## 5. Recommended first implementation batch

### Start with **Batch 1A only**

Smallest critical set that is safe to review together:

1. **A** — Exclude EXPIRED (and optionally stale CREATED) from fee payment reuse in `onboarding-fee-service.ts` and `processing-fee-service.ts`
2. **B** — Add controlled recovery when capture arrives after EXPIRED (transition or alternate handler; do not silently skip in `webhook-service.ts` / `syncGatewayPaymentFromCurlec`)

**Why not include C in the first PR:**

- Different services and rollback story
- Requires product decision + likely **schema migration** for race-safe dedup
- Double-pay risk is high but fix is independently shippable as **Batch 1B** immediately after 1A merges

**Why not combine with Batch 2:**

- Batch 2 depends on external Curlec/Finance confirmation and startup validation — not purely code fixes

**First PR acceptance checklist:**

- [ ] EXPIRED issuer onboarding fee → POST creates new CREATED payment
- [ ] EXPIRED processing fee → POST creates new CREATED payment
- [ ] Late capture on EXPIRED row → payment reaches PAID/processing path (not dropped)
- [ ] Existing integration tests green + new EXPIRED/late-capture tests
- [ ] No schema migration in this PR

---

## 6. Execution gates

### Pre-sandbox (Phase 0 — no code merge required)

| Gate | Owner | Evidence |
|------|-------|----------|
| Curlec sandbox credentials in dev env | Engineering | `env-templates/api.env.local` |
| Webhook tunnel to local/staging API | Engineering | Test event in `gateway_webhook_events` |
| Signature verification smoke | Engineering | `curlec-signature.test.ts` + manual POST |
| Ops aware: captured ≠ settled | Finance | Runbook note |

### Pre-UAT

| Gate | Owner | Batches |
|------|-------|---------|
| **1A merged** — fee retry + late capture | Engineering | 1A |
| **1B merged** — deposit dedup | Engineering | 1B |
| EXPIRED + duplicate deposit regression tests | Engineering | 1A, 1B |
| Sandbox FPX smoke all three purposes | QA + Ivan | Phase 0 + 1A |
| Name-check REVIEW/HELD runbook | Compliance + Ops | — |

### Pre-production

| Gate | Owner | Batches |
|------|-------|---------|
| Live `CURLEC_*` in Secrets Manager + webhook registered | Engineering + AWS | Phase 0 |
| Live FPX payer name confirmed | **Curlec** + Compliance | 2 |
| One-account vs two-account signed | **Ivan/Finance/Legal** | 2 |
| Credential mode startup validation deployed | Engineering | 2 |
| Refund initiation recovery | Engineering | 3 |
| Recon lock + exception history | Engineering + Finance | 4 |
| Dev simulator + DISABLE_AUTH prod discipline | Engineering | 5 |
| `settlement.processed` decision signed | **Finance** | 6 (decision) |
| Multi-instance cron lock verified on ECS | Infra | Launch gate L4 |
| Alerting on recon FAILED + webhook 5xx | Infra | Launch gate L5 |
| Legal/compliance sign-off on name-check thresholds | **Compliance** | After E |

### Production readiness summary (reconciled)

| Environment | Ready? | Conditions |
|-------------|--------|------------|
| Local dev | Yes, with caution | Avoid prod DB; simulators dev-only |
| Sandbox | Mostly yes | After Phase 0; validate 1A/1B in sandbox |
| UAT | Conditional | **1A + 1B** required; monitored HELD/name-check queues |
| Production | **Not yet** | **1A, 1B, 2, 3, 4, 5 (M), D, E, F, G, H** + execution gates above |

---

## 7. Dependency graph (acyclic)

```text
Phase 0 (secrets, webhook, ops docs)
    ↓
Batch 1A (A, B)
    ↓
Batch 1B (C) ─────────────────┐
    ↓                           │
Batch 2 (D, E, credentials)     │ parallel after 1A
    ↓                           │
Batch 3 (F) ←───────────────────┘
    ↓
Batch 4 (G, H, I)
    ↓
Batch 5 (K, L, M, N)
    ↓
Batch 6 (J decision / optional impl)
```

---

## 8. Suggested PR sequence (review-friendly)

| PR order | Batch | Title (suggested) |
|----------|-------|-------------------|
| 1 | 1A | fix(gateway): issuer fee retry after EXPIRED + late capture recovery |
| 2 | 1B | fix(gateway): prevent duplicate investor deposit orders |
| 3 | 2a | chore(gateway): credential mode validation at startup |
| 4 | 2b | fix(gateway): webhook/wallet concurrency idempotency |
| 5 | 3 | fix(gateway): refund initiation recovery job |
| 6 | 4a | fix(recon): advisory lock on manual settlement recon |
| 7 | 4b | fix(recon): preserve exception history on rerun + backfill |
| 8 | 5a | feat(admin): settlement fields on gateway payment detail |
| 9 | 5b | feat(admin): webhook event list + recon label cleanup |
| 10 | 5c | chore(gateway): harden dev settlement simulator guards |
| 11 | 6 | docs/decision: settlement.processed webhook (+ impl if approved) |

---

## 9. Document maintenance

When implementation starts:

1. Link each PR to batch ID in this doc or project tracker.
2. Update acceptance checklists as items ship.
3. Re-run second-review claim checks after **1A**, **1B**, and **4** merge.
4. Do not treat dual-account work as in-scope unless **D** sign-off requires it (fix-plan E1).

---

*End of final implementation plan.*
