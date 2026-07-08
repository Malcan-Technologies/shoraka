# Razorpay / Curlec Implementation Matrix

Audit date: 2026-07-08. Status meanings: **Complete** | **Partial** | **Missing** | **Incorrect** | **Unclear**

---

## Foundation

| Area | Feature | Expected behaviour | Current implementation | Status | Evidence | Risk | Recommended next action |
|------|---------|-------------------|------------------------|--------|----------|------|-------------------------|
| Config | Single Curlec merchant account | Business docs: one settlement bank; ledger buckets internal | One `CURLEC_*` set; `getCurlecConfig()` only | **Complete** (for documented design) | `curlec.ts` L4–54; `gateway-order-service.ts` L39, L56 | Stakeholders expecting two Razorpay accounts will be wrong | Confirm business sign-off: one vs two merchant accounts |
| Config | Two Razorpay accounts (Operating + Investor Pool) | Separate key/webhook per account | Not implemented | **Missing** | No second env vars; no routing by `GatewayPaymentPurpose` | High if legally/operationally required | Design + implement purpose-based credential routing if required |
| Config | Prod secrets in Secrets Manager | ECS injects `CURLEC_*` | `infra/ecs-task-definition-api.json` L236–249 | **Complete** | ECS task definition | Low if secrets populated | Verify values in AWS before live |
| API client | Create order | POST `/v1/orders`, amount in sen | `curlec-client.ts` L84–94 | **Complete** | Unit + integration tests | Low | — |
| API client | Fetch payment / order payments | For webhook verify + sync | `curlec-client.ts` L97–112 | **Complete** | Used in `webhook-service.ts` | Low | — |
| API client | Refund | POST with idempotency header | `curlec-client.ts` L151–171 | **Complete** | `refund-service.ts` L167–171 | Medium if refund fails → HELD | Monitor HELD queue |
| API client | Settlement recon fetch | Paginated `/v1/settlements/recon/combined` | `curlec-client.ts` L133–148 | **Complete** | `gateway-settlement-recon.ts` L80–104 | Low | — |

---

## Investor deposit

| Area | Feature | Expected behaviour | Current implementation | Status | Evidence | Risk | Recommended next action |
|------|---------|-------------------|------------------------|--------|----------|------|-------------------------|
| API | Create deposit order | Validate min/max, org access, create order | `deposit-service.createInvestorDeposit()` L95–131 | **Complete** | `deposit.integration.test.ts` | Low | — |
| API | Duplicate order prevention | Idempotent create or reuse open order | **New order every POST** | **Missing** | No dedup in `createInvestorDeposit` | Medium — double pay | Add dedup or client idempotency key |
| API | Get deposit + sync | Poll Curlec if non-terminal | `getInvestorDeposit()` + `syncGatewayPaymentFromCurlec` | **Complete** | `deposit-service.ts` L134–155 | Low | — |
| Frontend | Checkout | FPX-only Curlec modal | `investor-deposit-form.tsx`, `curlec-checkout.ts` | **Complete** | E2E mocked | Low | Live smoke |
| Webhook | Capture → credit | Name PASS → wallet + ledger | `processInvestorDepositCapture` | **Complete** | `deposit-webhook.integration.test.ts` | Low | — |
| Webhook | Name FAIL → refund | Auto-refund, no credit | `webhook-service.ts` L236–251 | **Partial** | Refund outside transaction after claim | Medium crash window | Wrap or reconcile PAID-without-refund |
| Webhook | Name REVIEW / unavailable | Admin queue | `pendNameCheckReview()` | **Complete** | `deposit-service.ts` L271–307 | Low | — |
| Wallet | Atomic credit + ledger | Single transaction | `creditCompletedDeposit()` L209–268 | **Complete** | Integration test credits once | Low | — |
| Limits | Min/max deposit | Admin-configurable | `PlatformFinanceSetting` L976–977 | **Complete** | `GET /deposits/limits` | Low | — |

---

## Issuer onboarding fee

| Area | Feature | Expected behaviour | Current implementation | Status | Evidence | Risk | Recommended next action |
|------|---------|-------------------|------------------------|--------|----------|------|-------------------------|
| API | Create fee order | One active order per org | Reuses any status **≠ FAILED** | **Partial** | `onboarding-fee-service.ts` L48–59, L92–94 | **High** — EXPIRED blocks new order | Exclude EXPIRED/CREATED stale or allow new order |
| API | Fee amount | Admin-configurable | `issuer_onboarding_fee_amount` default 150 | **Complete** | `schema.prisma` L974 | Low | — |
| Webhook | Capture → COMPLETED | Set `onboarding_fee_paid_at`, ledger | `completeOnboardingFeePayment()` | **Complete** | `onboarding-fee.integration.test.ts` | Low | — |
| Gate | Block eKYB until paid | RegTank rejects unpaid | `regtank/service.ts` ~L569 | **Complete** | Integration test | Low | — |
| Frontend | Pay + return UX | Poll until terminal | `onboarding/fee/page.tsx`, return dialog | **Complete** | — | Medium if EXPIRED stuck | Align UI retry with backend new-order |
| Refund | Non-refundable | No refund path | No issuer refund code | **Complete** (by policy) | `refund-service.ts` L108–114 | Low | Document for support |

---

## Application processing fee

| Area | Feature | Expected behaviour | Current implementation | Status | Evidence | Risk | Recommended next action |
|------|---------|-------------------|------------------------|--------|----------|------|-------------------------|
| API | Create fee order | One per application | Reuses status **≠ FAILED** (includes EXPIRED) | **Partial** | `processing-fee-service.ts` L53–61, L114–116 | **High** | Same fix as onboarding fee |
| API | Submit gate | COMPLETED fee required | `assertApplicationProcessingFeePaid()` | **Complete** | `processing-fee.integration.test.ts` | Low | — |
| Webhook | Capture → COMPLETED | OPERATING ledger | `completeProcessingFeePayment()` | **Complete** | Integration test | Low | — |
| Frontend | Pay step | Checkout + return listener | `application-processing-fee-step.tsx` | **Complete** | — | Medium EXPIRED | Fix retry |

---

## Webhooks

| Area | Feature | Expected behaviour | Current implementation | Status | Evidence | Risk | Recommended next action |
|------|---------|-------------------|------------------------|--------|----------|------|-------------------------|
| Webhook | Endpoint | Single POST route | `/v1/webhooks/curlec` | **Complete** | `webhook-controller.ts` L33–35 | Low | Register in Curlec dashboard |
| Webhook | Raw body + signature | HMAC before JSON parse | `app/index.ts` L84–88; `curlec-signature.ts` | **Complete** | `curlec-signature.test.ts` | Low | — |
| Webhook | Dedupe | By `x-razorpay-event-id` | `gatewayWebhookEvent.event_id` unique | **Complete** | `webhook-service.ts` L795–805 | Low | — |
| Webhook | `payment.captured` | Process capture | `webhook-service.ts` L357–382 | **Complete** | Integration tests | Low | — |
| Webhook | `order.paid` | Process capture | Same | **Complete** | `webhook-schemas.ts` L39–45 | Low | — |
| Webhook | `payment.failed` | Mark FAILED | `markGatewayPaymentFailedByOrderId` | **Complete** | `webhook-service.ts` L339–353 | Low | Only from CREATED |
| Webhook | `payment.authorized` | Handle if auto-capture off | Not handled | **Missing** (may be OK if auto-capture on) | Docs mention; no code | **Unclear** | Confirm Curlec auto-capture |
| Webhook | `settlement.processed` | Optional real-time stamp | **Not implemented** | **Missing** | Grep: docs only | Low if daily recon sufficient | Optional enhancement |
| Webhook | `refund.processed` / `failed` | Investor deposits | `webhook-service.ts` L310–335 | **Complete** | Tests | Low | — |
| Webhook | Separate secrets per account | Two accounts | One secret | **Missing** (if two accounts needed) | `curlec.ts` L51 | High if two accounts | N/A until dual account |

---

## Refunds

| Area | Feature | Expected behaviour | Current implementation | Status | Evidence | Risk | Recommended next action |
|------|---------|-------------------|------------------------|--------|----------|------|-------------------------|
| Refund | Auto name/amount mismatch | Curlec API + REFUND_INITIATED | `initiateInvestorDepositRefund` | **Complete** | Webhook tests | Medium API fail → HELD | Ops runbook for HELD |
| Refund | Admin manual COMPLETED | POST `.../refund` | `admin-service.initiateCompletedDepositRefund` | **Complete** | `admin.integration.test.ts` | Medium | — |
| Refund | Admin retry HELD | POST `.../retry-refund` | `retryHeldDepositRefund` | **Complete** | Admin UI L219–227 | Low | — |
| Refund | Wallet reversal on REFUNDED | Debit if credited | `completeInvestorDepositRefund` L267–298 | **Complete** | Single DB transaction | Low | — |
| Refund | Atomic with Curlec API | All-or-nothing | API call **before** DB tx | **Partial** | `refund-service.ts` L166–238 | Medium | Outbox or reconciliation job |
| Refund | Issuer fee refund | None | Not implemented | **Complete** (policy) | — | Low | — |

---

## Settlement & reconciliation

| Area | Feature | Expected behaviour | Current implementation | Status | Evidence | Risk | Recommended next action |
|------|---------|-------------------|------------------------|--------|----------|------|-------------------------|
| Settlement | Link at capture | Optional early link | **Only during recon** | **Complete** (as designed) | Only `gateway-settlement-recon.ts` writes `settlement_id` | Low | Document captured≠settled |
| Recon | Daily automatic job | Cron yesterday MYT | `0 18 * * *` UTC + `getYesterdayMytDateOnly()` | **Complete** | `jobs/index.ts` L97–105; `index.ts` L47 | Medium multi-instance duplicate | Advisory lock used (`withAdvisoryLock`) |
| Recon | Manual run | Admin POST run | `recon-controller.ts` L93–103 | **Complete** | Reconciliation page | Low | — |
| Recon | Date semantics | Settlement recon date MYT | `fetchSettlementRecon({ year, month, day })` | **Complete** | `gateway-settlement-recon.ts` L69–77 | Medium if ops expects capture date | Label clearly in UI |
| Recon | Stamp fields | settlement metadata | `settlement_id`, `settled_at`, `gateway_fee_amount` | **Complete** | L195–202 | Low | Show in admin detail |
| Recon | Bank statement check | Match bank UTR | Not implemented | **Missing** | Recon compares Curlec vs internal only | Medium | Future finance integration |
| Recon | Exception resolve | Fix or document | Marks resolved only | **Partial** | `recon-service.ts` L205–212 | Low | Clarify resolve = ops sign-off |
| Recon | Missed dates | Backfill | Manual date on Run Now only | **Partial** | No auto backfill | Medium | Ops procedure for missed days |
| Recon | Test mode settlements | Empty report | Documented; dev simulator | **Complete** | `dev-simulate-gateway-settlement.ts` | High if run in prod | Remove before live |

---

## Name check

| Area | Feature | Expected behaviour | Current implementation | Status | Evidence | Risk | Recommended next action |
|------|---------|-------------------|------------------------|--------|----------|------|-------------------------|
| Name check | Extract payer name | From Curlec payment | `extractPayerNameFromPayment()` | **Complete** (code path) | `curlec-schemas.ts` L133–156 | **High** if field empty in prod | Confirm with Curlec live FPX |
| Name check | Production availability | FPX buyer name returned | **Not confirmed in repo** | **Unclear** | Tests mock `account_holder_name` | **Critical pre-live** | Live payment sample + API fetch |
| Name check | PASS / REVIEW / FAIL / UNAVAILABLE | Four outcomes | `name-check.ts` | **Complete** | `name-check.test.ts` | Low | — |
| Name check | Admin approve/reject | Credit or refund | `admin-service.ts` L291–369 | **Complete** | Admin UI + tests | Low | — |

---

## Admin UI

| Area | Feature | Expected behaviour | Current implementation | Status | Evidence | Risk | Recommended next action |
|------|---------|-------------------|------------------------|--------|----------|------|-------------------------|
| Admin | Gateway Payments list | Real API data | `use-gateway-payments.ts` → admin API | **Complete** | `gateway-payments-table.tsx` | Low | Add issuer org column |
| Admin | Payment detail | Full fields + actions | Detail page + mutations | **Partial** | Missing settlement fields; override null | Medium ops visibility | Add settlement + fee columns |
| Admin | Refunds tab | Dedicated view | Filters on list only | **Partial** | `FILTER_OPTIONS` refunding/refunded | Low | Optional dedicated tab |
| Admin | Reconciliation page | Runs + exceptions | `reconciliation/page.tsx` | **Complete** | Real API | Low | Improve labels (see audit §14) |
| Admin | Webhook log viewer | Inspect events | No UI | **Missing** | `GatewayWebhookEvent` DB only | Medium debugging | Optional admin page |
| Admin | Settlements page | List settlements | No UI | **Missing** | No model | Low | Optional; recon may suffice |
| Admin | Override workflow | Maker-checker override | Types + `getOpenOverrideProposal` unused | **Missing** | `admin-service.ts` L210–211 hardcoded null | Low | Implement or remove schema types |
| Admin | RBAC | view / manage | `gateway_payments.view/manage` | **Complete** | `admin-controller.ts`, `rbac.ts` | Low | — |

---

## Background jobs

| Area | Feature | Expected behaviour | Current implementation | Status | Evidence | Risk | Recommended next action |
|------|---------|-------------------|------------------------|--------|----------|------|-------------------------|
| Jobs | Stuck-order poller | 15 min, expire 60 min CREATED | `runGatewayStuckOrderPollerJob` | **Complete** | `jobs/index.ts` L87–95 | Low | — |
| Jobs | Settlement recon cron | Daily 02:00 MYT | `0 18 * * *` UTC | **Complete** | `jobs/index.ts` L97–105 | Medium duplicate instances | Document single-leader or verify lock |
| Jobs | initJobs registered | On API boot | `index.ts` L47 | **Complete** | Traced | Low | — |

---

## Security & config

| Area | Feature | Expected behaviour | Current implementation | Status | Evidence | Risk | Recommended next action |
|------|---------|-------------------|------------------------|--------|----------|------|-------------------------|
| Security | Key secret not in frontend | Server only | Yes | **Complete** | `curlec.ts` comment L27 | Low | — |
| Security | Webhook secret not in frontend | Server only | Yes | **Complete** | — | Low | — |
| Security | Trust frontend success | Webhook/sync only | Callback UX-only | **Complete** | `deposits/callback/route.ts` L28–29 | Low | — |
| Config | Fee amounts in admin | Platform Finance settings | `platform-finance/page.tsx` | **Complete** | `schema.prisma` L974–977 | Low | — |
| Config | Stuck order timeout | Configurable | Hard-coded 60 min | **Partial** | `gateway-stuck-order-poller.ts` L13 | Low | Env or admin setting |

---

## Reconciliation UI label recommendations

| Current label | Clearer label |
|---------------|---------------|
| Latest run | Last reconciliation date (MYT) |
| Payments stamped | Payments linked to Curlec settlement (latest run) |
| Exceptions (latest run) | Issues found on that date |
| Open exceptions | Unresolved issues (all dates) |
| Scanned | Curlec settled lines scanned |
| Matched | Internal gateway payment found |
| Stamped | Settlement ID and fees written to payment row |

---

## Status lifecycle

| Area | Feature | Expected behaviour | Current implementation | Status | Evidence | Risk | Recommended next action |
|------|---------|-------------------|------------------------|--------|----------|------|-------------------------|
| Lifecycle | State machine | Valid transitions enforced | `state.ts` `assertTransition` | **Complete** | `state.test.ts` | Low | — |
| Lifecycle | Webhook terminal set | Skip reprocessing | `TERMINAL_GATEWAY_STATUSES` | **Partial** | Includes admin-actionable statuses | Low naming confusion | Rename to `WEBHOOK_SKIP_STATUSES` |
| Lifecycle | EXPIRED/FAILED/REFUNDED final | No further transitions | Empty outgoing in `ALLOWED_TRANSITIONS` | **Complete** | `state.ts` L30–32 | Low | — |
| Lifecycle | COMPLETED → refund | Admin refund allowed | Allowed transition | **Complete** | L25 | Low | — |

---

## Tests

| Area | Feature | Expected behaviour | Current implementation | Status | Evidence | Risk | Recommended next action |
|------|---------|-------------------|------------------------|--------|----------|------|-------------------------|
| Tests | Integration suite | Deposit, webhook, admin, recon | 8+ integration files | **Complete** | `apps/api/src/modules/payment/` | Low | — |
| Tests | Webhook signature | Unit tests | `curlec-signature.test.ts` | **Complete** | — | Low | — |
| Tests | Duplicate webhook | No double credit | `deposit-webhook.integration.test.ts` L276–308 | **Complete** | — | Low | — |
| Tests | Duplicate deposit orders | Prevent or test | Not covered | **Missing** | — | Medium | Add test + fix |
| Tests | EXPIRED fee retry | New order | Not covered | **Missing** | — | High | Add regression test |
| Tests | Two-account routing | Per purpose | N/A single account | **Missing** | — | N/A | Only if dual account built |
| Tests | Live payer name | Contract test | Not in repo | **Missing** | — | Critical pre-live | Manual + automated against sandbox/live |
