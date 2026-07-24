# Razorpay / Curlec Remediation Plan

Prioritized actions from repository audit (2026-07-08). No code changes included in this document.

**Complexity:** Small (≤1 day) | Medium (2–5 days) | Large (>1 week)  
**Independent:** Can ship without other items?

---

## Critical — before any live FPX testing with real money

| # | Item | Reason | Affected files | DB impact | Migration | Testing required | Dependencies | Complexity | Independent? |
|---|------|--------|----------------|-----------|-----------|------------------|--------------|------------|--------------|
| C1 | Confirm FPX payer name in **live** Curlec API | Name check and auto-refund depend on payer name; repo cannot verify | `curlec-schemas.ts` L133–156; `name-check.ts` | None | None | Live/sandbox payment + `GET /v1/payments/:id` | Curlec account manager | Small (ops) | Yes |
| C2 | Wire and validate prod `CURLEC_*` in Secrets Manager | API throws without credentials (`curlec.ts` L42–45) | `curlec.ts`, `infra/ecs-task-definition-api.json`, `env-templates/api.env.prod` | None | None | Deploy to staging/prod; smoke create order | AWS secrets populated | Small | Yes |
| C3 | Register live webhook URL + secret | Without valid secret, webhooks 401 (`webhook-service.ts` L753–758) | Curlec dashboard; `webhook-controller.ts` | None | None | Send test webhook; verify `gateway_webhook_events` | C2 | Small | No (C2) |
| C4 | Fix EXPIRED issuer/processing fee retry | Backend returns EXPIRED row; user cannot get new order (`onboarding-fee-service.ts` L56; `processing-fee-service.ts` L58) | `onboarding-fee-service.ts`, `processing-fee-service.ts`; optionally issuer UI | None | None | Integration test: EXPIRED → new CREATED order | None | Small | Yes |
| C5 | Live FPX smoke — all three purposes | End-to-end proof of checkout + webhook + terminal status | All payment modules; portal checkout | Test data rows | None | Manual UAT checklist | C2, C3, C1 | Medium | No (C2,C3) |
| C6 | Block or remove dev recon simulator from prod paths | Script writes real DB stamps (`dev-simulate-gateway-settlement.ts` L13–15) | `apps/api/scripts/dev-simulate-gateway-settlement.ts`; CI/deploy docs | None | None | Verify script refuses `NODE_ENV=production` (already L13) | None | Small | Yes |

---

## Required before UAT sign-off

| # | Item | Reason | Affected files | DB impact | Migration | Testing required | Dependencies | Complexity | Independent? |
|---|------|--------|----------------|-----------|-----------|------------------|--------------|------------|--------------|
| U1 | Investor deposit order deduplication strategy | Every POST creates new order (`deposit-service.ts` L118–131) | `deposit-service.ts`, `investor-deposit-form.tsx` | Optional new index on (org, status) | Maybe | Integration + E2E double-click | Product decision | Medium | Yes |
| U2 | Reconcile PAID-without-refund crash window | FAIL path: claim then refund outside tx (`webhook-service.ts` L237–251) | `webhook-service.ts`, `refund-service.ts` | None | None | Test simulated crash; poller recovery | None | Medium | Yes |
| U3 | Admin detail: show settlement fields | Ops cannot see `settlement_id`, `settled_at`, `gateway_fee_amount` | `admin-service.ts` map; `gateway-payments/[id]/page.tsx` | None | None | UI test | None | Small | Yes |
| U4 | Reconciliation UI label clarity | “Scanned/stamped/matched” confusing (`reconciliation/page.tsx`) | `reconciliation/page.tsx` | None | None | UX review | None | Small | Yes |
| U5 | Document captured≠settled for ops | Wallet credits before recon stamp | `payment-gateway-curlec-ops-runbook.md` | None | None | Ops walkthrough | None | Small | Yes |
| U6 | Regression tests for EXPIRED retry + duplicate deposit | Gaps in test suite | `*.integration.test.ts` | None | None | CI | U1, C4 | Small | No |
| U7 | Confirm auto-capture enabled on Curlec account | `payment.authorized` not handled | Curlec dashboard; optionally `webhook-service.ts` | None | None | Webhook log review | Curlec | Small | Yes |
| U8 | Disable/guard `INVESTOR_BALANCE_TEST_TOPUP` in prod | Parallel money path bypasses gateway | `notes/service.ts`, `notes/controller.ts` | None | None | Verify 403 in production | None | Small | Yes |

---

## Required before live launch

| # | Item | Reason | Affected files | DB impact | Migration | Testing required | Dependencies | Complexity | Independent? |
|---|------|--------|----------------|-----------|-----------|------------------|--------------|------------|--------------|
| L1 | Ops runbook sign-off: HELD, name-check queue, daily recon | Production support | `payment-gateway-curlec-ops-runbook.md` | None | None | Tabletop exercise | Finance/ops | Small | Yes |
| L2 | Finance sign-off: single bank vs ledger buckets | All money in one Curlec settlement account | Business docs; ledger | None | None | Finance review | Client/legal | Small | Yes |
| L3 | Remove or gate dev recon simulator from prod deploy artifacts | Prevent accidental prod use | `dev-simulate-gateway-settlement.ts`, package scripts | None | None | Deploy checklist | C6 | Small | Yes |
| L4 | Multi-instance cron verification | `initJobs()` per ECS task (`index.ts` L47) | `lib/jobs/index.ts`, `with-advisory-lock.ts` | None | None | Load test 2+ tasks | Infra | Medium | Yes |
| L5 | Alerting on recon FAILED + webhook 5xx rate | Failures only logged today | New observability wiring; CloudWatch | None | None | Simulate failure | Infra | Medium | Yes |
| L6 | Legal/compliance sign-off on name-check rules | Partial match → REVIEW at Jaccard 0.5 (`name-check.ts` L153–157) | `name-check.ts`; legal docs | None | None | Compliance review | C1 | Small | No (C1) |
| L7 | Stale help content update | Processing fee “when gateway ready” in help | `packages/help-content/markdown/*` | Regenerate help | None | Content review | None | Small | Yes |

---

## Operational improvements (post-launch or parallel)

| # | Item | Reason | Affected files | DB impact | Migration | Testing required | Dependencies | Complexity | Independent? |
|---|------|--------|----------------|-----------|-----------|------------------|--------------|------------|--------------|
| O1 | Admin webhook event viewer | Debug failed webhooks; payloads in DB only | New admin page + API | None | None | Admin RBAC test | None | Medium | Yes |
| O2 | Recon backfill job / date range | Missed dates need manual Run Now | `gateway-settlement-recon.ts`, `recon-service.ts` | None | None | Integration | None | Medium | Yes |
| O3 | Recon exception resolve links to payment | Resolve is cosmetic (`recon-service.ts` L205–212) | Admin UI + API | None | None | UX | None | Small | Yes |
| O4 | Rename `TERMINAL_GATEWAY_STATUSES` | Misleading vs admin transitions (`state.ts` L35–42) | `state.ts`, `webhook-service.ts` | None | None | Unit tests | None | Small | Yes |
| O5 | Issuer org column on Gateway Payments list | Issuer fees show blank investor column | `admin-service.ts`, `gateway-payments-table.tsx` | None | None | UI | None | Small | Yes |
| O6 | Configurable stuck-order timeout | Hard-coded 60 min | `gateway-stuck-order-poller.ts` | Optional settings row | Maybe | Job test | None | Small | Yes |
| O7 | Outbox/retry for refund API failures | Reduce HELD volume | New job or queue module | New table possible | Maybe | Integration | None | Large | Yes |
| O8 | Post MDR to ledger at recon stamp | Finance may want fee entries | `gateway-settlement-recon.ts`, `ledger.ts` | Ledger entries | None | Finance reconciliation | Finance | Medium | Yes |

---

## Optional enhancements

| # | Item | Reason | Affected files | DB impact | Migration | Testing required | Dependencies | Complexity | Independent? |
|---|------|--------|----------------|-----------|-----------|------------------|--------------|------------|--------------|
| E1 | Dual Curlec merchant accounts | If required vs current single account | `curlec.ts`, all payment services, webhook routing | `gateway_account_id`? | Yes | Full regression | Business decision, Curlec | **Large** | No |
| E2 | `settlement.processed` webhook handler | Real-time stamp vs daily recon | `webhook-service.ts` | None | None | Webhook tests | Curlec events | Medium | Yes |
| E3 | Implement override maker-checker UI | Schema exists; API returns null | `admin-service.ts`, admin UI | None | None | RBAC workflow | Product | Large | Yes |
| E4 | Dedicated Refunds admin page | Currently list filters only | New admin route | None | None | UI | None | Small | Yes |
| E5 | Bank statement / UTR reconciliation | Beyond Curlec API | New module | New tables likely | Yes | Finance | Bank data feed | **Large** | Yes |
| E6 | Handle `payment.authorized` | If auto-capture ever disabled | `webhook-service.ts` | None | None | Webhook test | Curlec config | Medium | Yes |
| E7 | Client idempotency key on deposit create | Prevent duplicate orders without server heuristics | `deposit-controller.ts`, schema | Optional column | Maybe | API test | U1 | Medium | No |

---

## Suggested implementation order

```
Phase 0 (blockers):  C1 → C2 → C3 → C4 → C5
Phase 1 (UAT):       U1, U2, U3, U4, U5, U6, U7, U8
Phase 2 (launch):    L1–L7
Phase 3 (ops):       O1–O8 as capacity allows
Phase 4 (optional):  E* only if business requires
```

---

## Claims corrected during re-verification (see audit chat summary)

1. **“Terminal” statuses** — `COMPLETED`, `HELD`, `NAME_CHECK_PENDING` skip webhook reprocessing but remain admin-actionable; only `REFUNDED`, `FAILED`, `EXPIRED` are strictly final in `ALLOWED_TRANSITIONS`.
2. **Payer name in test mode** — Repository proves code path via **mocked** fields in tests; does **not** prove Curlec sandbox/live returns names.
3. **Recon date** — Uses Curlec settlement recon API for a MYT calendar date (settled lines), not payment capture date.
4. **Dual account** — Business docs align with code (single account); stakeholder two-account expectation is **not** implemented.
5. **`getOpenOverrideProposal`** — Implemented but **not wired** to admin API response.

---

## Testing checklist per phase

| Phase | Minimum tests |
|-------|---------------|
| C5 smoke | Onboarding fee → COMPLETED + RegTank unlock; processing fee → submit; deposit PASS/REVIEW/FAIL; webhook signature; refund webhook |
| UAT | Double POST deposit; EXPIRED fee retry; recon manual run + exception resolve; admin refund COMPLETED deposit |
| Launch | Prod secrets rotation drill; recon cron success; zero open exceptions baseline; test-topup 403 |
