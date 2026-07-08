# Razorpay / Curlec Payment Gateway — Implementation Audit

**Repository:** CashSouk (Shoraka monorepo)  
**Audit date:** 2026-07-08  
**Scope:** Curlec/Razorpay money-in only (investor deposits, issuer onboarding fee, application processing fee)  
**Method:** Full repository trace — API, frontends, Prisma schema, migrations, jobs, tests, deployment config, docs  
**Code changes:** None (documentation only)

---

## 1. Executive summary

### What is working (complete path traced)

| Capability | Evidence |
|------------|----------|
| Curlec order creation for all three payment purposes | `gateway-order-service.ts` → `curlec-client.createOrder()` |
| FPX Checkout (investor + issuer portals) | `packages/config/src/curlec-checkout.ts` |
| Webhook ingress with raw body + HMAC | `webhook-controller.ts`, `curlec-signature.ts` |
| Capture processing (`payment.captured`, `order.paid`) | `webhook-service.ts` → `processGatewayPaymentCapture()` |
| Investor name check + wallet credit + ledger | `deposit-service.creditCompletedDeposit()`, `name-check.ts` |
| Auto-refund on name/amount mismatch | `refund-service.initiateInvestorDepositRefund()` |
| Issuer fee completion + `onboarding_fee_paid_at` | `webhook-service.completeOnboardingFeePayment()` |
| Application fee gate on submit | `processing-fee-service.assertApplicationProcessingFeePaid()` |
| Admin list/detail, name-check actions, refunds | `admin-controller.ts`, `admin-service.ts` |
| Daily settlement recon + manual trigger | `gateway-settlement-recon.ts`, `recon-controller.ts` |
| Stuck-order poller (sync or expire) | `gateway-stuck-order-poller.ts` |
| Background cron registration | `index.ts` L47 → `initJobs()` in `lib/jobs/index.ts` |

### What is incomplete, placeholder, or missing

- **Two Razorpay merchant accounts (Operating vs Investor Pool)** — **not implemented**. One `CURLEC_*` credential set routes all purposes; bucket split is **internal ledger only** (`docs/integrations/payment-gateway-curlec-plan-business-as-built.md` L47).
- **`settlement.processed` webhook** — **not implemented** anywhere in application code (grep confirms docs-only references).
- **Dedicated Settlements admin page / webhook log UI** — missing; data exists in DB only.
- **Override proposal workflow** — schema + `getOpenOverrideProposal()` exist; admin API returns hardcoded `null` (`admin-service.ts` L210–211).
- **Production FPX payer name availability** — **not confirmed in repo**; code reads `acquirer_data.fpx_data.fpx_buyerName` when present (`curlec-schemas.ts` L133–156).
- **Issuer fee retry after `EXPIRED`** — backend reuses non-`FAILED` rows including `EXPIRED`; frontend copy says “start a new payment” but API does not create a new order (`onboarding-fee-service.ts` L48–59, L92–94).
- **Investor deposit deduplication** — each `POST /v1/investor/deposits` creates a **new** Curlec order (`deposit-service.ts` L118–131).

### Highest-risk findings

1. Single Curlec account for all money-in (vs stakeholder expectation of two Razorpay accounts).
2. Unverified production FPX payer-name field → wrong auto-refund or manual-review volume.
3. `EXPIRED` issuer/processing fee rows block new order creation (reuse logic excludes only `FAILED`).
4. Unlimited duplicate investor deposit orders on repeated API calls.
5. Wallet credited at capture; bank settlement confirmed only by daily recon API (no bank statement check).
6. Refund initiation splits Curlec API call from DB transaction (crash window).
7. Recon rerun deletes all exceptions for that run date before reprocessing (`gateway-settlement-recon.ts` L137).
8. `TERMINAL_GATEWAY_STATUSES` naming is misleading — several “terminal” statuses remain admin-actionable.
9. Dev recon simulator still in repo (`apps/api/scripts/dev-simulate-gateway-settlement.ts`).
10. Multi-ECS-task deployments may run duplicate crons (`docs/manual-test-plans/full-note-money-flow-manual-uat.txt` L1601).

### Safe to test now

- Mocked/integration tests under `apps/api/src/modules/payment/*.integration.test.ts`
- Sandbox Curlec keys + webhook tunnel for end-to-end deposit/fee flows
- Admin name-check approve/reject/refund in staging
- Recon UI using dev simulator **on dev DB only**

### Not safe for live use until

- Live credentials in Secrets Manager validated (`infra/ecs-task-definition-api.json` L236–249)
- Curlec confirms FPX payer name in production API responses
- Live FPX smoke for all three purposes + webhook delivery
- EXPIRED fee retry behaviour fixed or runbook documented
- Dev recon simulator disabled/removed from prod workflows
- Ops owns daily recon + HELD deposit escalation

---

## 2. Complete payment architecture map

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ FRONTENDS                                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ Investor: investor-deposit-form.tsx → POST /v1/investor/deposits           │
│ Issuer onboarding: onboarding/fee/page.tsx → POST /v1/issuer/onboarding-fee  │
│ Issuer application: application-processing-fee-step.tsx                      │
│   → POST /v1/applications/:id/processing-fee                                 │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ API — apps/api/src/modules/payment/                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ deposit-service | onboarding-fee-service | processing-fee-service          │
│   → gateway-order-service.createGatewayOrder()                               │
│   → curlec-client.createOrder()  [single getCurlecConfig()]                  │
│   → prisma.gatewayPayment.create (status CREATED, curlec_order_id)           │
│   → returns curlecKeyId + curlecOrderId + amount to frontend                 │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ CHECKOUT — packages/config/src/curlec-checkout.ts                            │
│   checkout.razorpay.com/v1/checkout.js, FPX-only display blocks              │
│   callback_url → portal route (UX redirect only)                             │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
              ┌─────────────────┴─────────────────┐
              ▼                                   ▼
┌──────────────────────────┐      ┌──────────────────────────────────────────┐
│ POST /v1/webhooks/curlec │      │ syncGatewayPaymentFromCurlec()             │
│ (before express.json)    │      │ on GET deposit/fee + stuck-order poller  │
│ ingestCurlecWebhook      │      │ polls Curlec order payments              │
│ processStoredCurlecWebhook      └──────────────────────────────────────────┘
└──────────────┬───────────┘
               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ processGatewayPaymentCapture() by purpose                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ INVESTOR_DEPOSIT → name check → COMPLETED (credit) | NAME_CHECK_PENDING |   │
│                    REFUND_INITIATED (fail/mismatch) | HELD (refund API fail) │
│ ISSUER_ONBOARDING_FEE → COMPLETED + onboarding_fee_paid_at + OPERATING ledger│
│ APPLICATION_PROCESSING_FEE → COMPLETED + OPERATING ledger                    │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ SETTLEMENT RECON (daily cron + manual) — NOT at capture                      │
│ runGatewaySettlementReconJob → fetchSettlementRecon(year,month,day MYT)      │
│ stamps settlement_id, settled_at, gateway_fee_amount on gateway_payments     │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ ADMIN — /finance/gateway-payments, /finance/reconciliation                   │
│ GET /v1/admin/gateway-payments*, POST actions; GET/POST gateway-recon/*    │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Webhook URL:** `POST /v1/webhooks/curlec` (`apps/api/src/app/index.ts` L84–88, `webhook-controller.ts` L33–35).

**Account selection:** None — `createCurlecClient()` defaults to `getCurlecConfig()` (`curlec-client.ts` L29–30, L174–176). Optional `config` parameter exists but is **never passed by production payment code**.

---

## 3. Payment scenarios

### A. Issuer onboarding fee

| Step | Detail |
|------|--------|
| Entry | `apps/issuer/src/app/onboarding/fee/page.tsx` — `handlePayFee` L151–225 |
| API | `POST /v1/issuer/onboarding-fee` → `onboarding-fee-controller.ts` L36–42 → `createIssuerOnboardingFee()` |
| Order | `gateway-order-service.createGatewayOrder()` purpose `ISSUER_ONBOARDING_FEE` |
| Webhook | `payment.captured` / `order.paid` → `processOnboardingFeeCapture()` |
| DB | `GatewayPayment.status = COMPLETED`; `issuer_organizations.onboarding_fee_paid_at`; `NoteLedgerEntry` CREDIT `OPERATING_ACCOUNT` |
| Admin | Gateway Payments list; RegTank gate checks `onboarding_fee_paid_at` (`regtank/service.ts` ~L569) |
| Risks | Non-refundable; amount mismatch → `FAILED` not refund; `EXPIRED` row reused blocks new order |

### B. Application processing fee

| Step | Detail |
|------|--------|
| Entry | `application-processing-fee-step.tsx` — uses `useApplicationProcessingFeeOrder` (POST on load) |
| API | `POST /v1/applications/:applicationId/processing-fee` (`routes.ts` L100–104) |
| Completion | `processProcessingFeeCapture()` → `completeProcessingFeePayment()` |
| Gate | `assertApplicationProcessingFeePaid()` on `DRAFT → SUBMITTED` |
| Risks | Same `EXPIRED` reuse as onboarding fee (`processing-fee-service.ts` L53–61) |

### C. Investor wallet deposit

| Step | Detail |
|------|--------|
| Entry | `investor-deposit-form.tsx` L72–127 |
| API | `POST /v1/investor/deposits` — amount validated vs `PlatformFinanceSetting` min/max |
| Order | **New order every POST** — no server dedup |
| Credit | Name PASS → `creditCompletedDeposit()` in transaction |

### D–G. Name check outcomes

| Outcome | `NameCheckResult` | Status | Wallet |
|---------|-------------------|--------|--------|
| Exact match | `PASS` | `COMPLETED` | Credited |
| Partial / subset | `REVIEW` | `NAME_CHECK_PENDING` | Not credited |
| Missing payer / expected name | `NAME_UNAVAILABLE` | `NAME_CHECK_PENDING` | Not credited |
| Clear mismatch | `FAIL` | `REFUND_INITIATED` (via auto-refund) | Never credited |

Logic: `name-check.ts` `runNameCheck()` L206–228; webhook branch `webhook-service.ts` L218–268.

Payer name source: `extractPayerNameFromPayment()` — primary `acquirer_data.fpx_data.fpx_buyerName` (`curlec-schemas.ts` L140–145).

### H–J. Refunds

| Step | Who | Route | Result |
|------|-----|-------|--------|
| Request | Auto or admin | `refund-service.initiateInvestorDepositRefund()` | Curlec Refund API then `REFUND_INITIATED` |
| Complete | Webhook | `refund.processed` → `completeInvestorDepositRefund()` | `REFUNDED`; wallet debit if prior credit |
| Fail | Webhook / API | `refund.failed` or API error → `HELD` | Admin retry `POST .../retry-refund` |

**Investor deposits only** — issuer fees have no refund path (`refund-service.ts` L108–114).

### K–L. Payment failure / expiry

| Event | Handler | Status |
|-------|---------|--------|
| `payment.failed` | `markGatewayPaymentFailedByOrderId()` | `FAILED` from `CREATED` only |
| Abandoned 60+ min | `processStaleGatewayPayment()` | `EXPIRED` if still `CREATED` after Curlec sync |

Poller: `gateway-stuck-order-poller.ts` L13 (`STALE_CREATED_MINUTES = 60`), cron `*/15 * * * *` (`jobs/index.ts` L87–95).

### M–N. Settlement and reconciliation

- **No `settlement.processed` handler.**
- Settlement metadata written **only** in `runGatewaySettlementReconJob()` (`gateway-settlement-recon.ts` L195–202).
- Recon queries Curlec `GET /v1/settlements/recon/combined?year&month&day` (`curlec-client.ts` L133–148).
- `run_date` = MYT calendar date passed to that API (`gateway-settlement-recon.ts` L69–77, L112–114).
- Filters lines where `entity_type === "payment"` and `settled === true` (`isSettledPaymentLine` L53–58).

### O–R. Idempotency / recovery

| Scenario | Protection |
|----------|------------|
| Duplicate webhook | `gateway_webhook_events.event_id` unique; `processed_at` skip |
| `payment.captured` + `order.paid` | Second pass: `claimCreatedToPaid` no-ops if not `CREATED` |
| Browser closes | Callback redirect + GET sync + poller + webhook |
| Duplicate deposit POST | **No protection** — new `GatewayPayment` + Curlec order each time |

### S–T. Test vs live

| | Test / dev | Production |
|---|------------|------------|
| `getCurlecConfig().environment` | `sandbox` when `NODE_ENV !== "production"` | `production` (`curlec.ts` L35–37) |
| Settlement recon | Empty in Curlec test mode; use `dev-simulate-gateway-settlement.ts` | Real API |
| Credentials | `env-templates/api.env.local` | Secrets Manager via ECS task def |

---

## 4. Razorpay accounts and credential routing

### Confirmed: one Curlec merchant account

| Variable | File | Used for |
|----------|------|----------|
| `CURLEC_KEY_ID` | `apps/api/src/config/curlec.ts` L4, L39 | All orders + checkout key returned to browser |
| `CURLEC_KEY_SECRET` | L5, L40 | Server Basic auth only |
| `CURLEC_WEBHOOK_SECRET` | L6, L51 | Single webhook endpoint |
| `CURLEC_API_BASE_URL` | L7, L52 | Default `https://api.razorpay.com` |

No `CURLEC_OPERATING_*`, `CURLEC_INVESTOR_*`, or purpose-based account switch exists in code or env templates.

| Payment purpose | Curlec account | Internal ledger (`postLedgerEntry`) |
|-----------------|----------------|-------------------------------------|
| `INVESTOR_DEPOSIT` | Shared `CURLEC_*` | `INVESTOR_POOL` CREDIT |
| `ISSUER_ONBOARDING_FEE` | Shared | `OPERATING_ACCOUNT` CREDIT |
| `APPLICATION_PROCESSING_FEE` | Shared | `OPERATING_ACCOUNT` CREDIT |

**Documented design:** single physical Curlec settlement bank account; ledger buckets are logical (`payment-gateway-curlec-plan-business-as-built.md` L45–48).

---

## 5. Database audit

### Core models (`apps/api/prisma/schema.prisma`)

#### `GatewayPayment` (L990–1030)

| Field | Role |
|-------|------|
| `curlec_order_id` | Razorpay order ID — `@unique` |
| `curlec_payment_id` | Razorpay payment ID — `@unique` nullable |
| `idempotency_key` | Internal — `@unique`, set `curlec:order:{orderId}` |
| `settlement_id`, `settled_at`, `gateway_fee_amount` | Written by recon job only |
| `amount` | `Decimal(18,6)` MYR; API uses sen at boundary |

#### `GatewayWebhookEvent` (L1051–1061)

Dedup: `event_id @unique`. Stores full JSON payload.

#### `GatewayReconRun` / `GatewayReconException` (L1065–1104)

- `GatewayReconRun.run_date @unique` — one run record per MYT date
- Exception types: `ORPHAN_CURLEC_PAYMENT`, `AMOUNT_MISMATCH`

#### `InvestorBalance` / `InvestorBalanceTransaction` (L749–776)

- Credit idempotency: `idempotency_key @unique` e.g. `gateway-deposit:balance:{paymentId}`
- Source `GATEWAY_DEPOSIT` enum (migration `20260621094556`)

#### `GatewayPaymentEvent` (L1034–1047)

Audit trail for name check, refund, expiry actions.

### Idempotency (code + constraints)

| Identifier | Mechanism |
|------------|-----------|
| Razorpay Order ID | `curlec_order_id` unique |
| Razorpay Payment ID | `curlec_payment_id` unique |
| Webhook event | `event_id` unique + `processed_at` |
| Refund API | Header `X-Refund-Idempotency: {gatewayPayment.id}` |
| Wallet credit | `investor_balance_transactions.idempotency_key` |
| Ledger | `note_ledger_entries.idempotency_key` |

---

## 6. Gateway payment lifecycle

### Status enum (`schema.prisma` L1666–1676)

`CREATED`, `PAID`, `NAME_CHECK_PENDING`, `COMPLETED`, `HELD`, `REFUND_INITIATED`, `REFUNDED`, `FAILED`, `EXPIRED`

### Transition table (`state.ts` L4–33)

| From | Allowed to |
|------|------------|
| `CREATED` | `PAID`, `FAILED`, `EXPIRED` |
| `PAID` | `COMPLETED`, `HELD`, `NAME_CHECK_PENDING`, `REFUND_INITIATED` |
| `NAME_CHECK_PENDING` | `COMPLETED`, `HELD`, `REFUND_INITIATED` |
| `HELD` | `COMPLETED`, `REFUND_INITIATED` |
| `COMPLETED` | `REFUND_INITIATED` |
| `REFUND_INITIATED` | `REFUNDED`, `HELD` |
| `REFUNDED`, `FAILED`, `EXPIRED` | *(none)* |

### Terminology notes

- **`PAID`** = CashSouk internal “captured at Curlec, business processing not finished” — not a Razorpay status label in UI.
- **`COMPLETED`** = business complete (wallet credited or fee recorded) — **not** bank settled.
- **`settled_at`** on payment row = recon stamp from Curlec settlement report — separate from `COMPLETED`.

### `TERMINAL_GATEWAY_STATUSES` vs state machine (`state.ts` L35–42)

Webhook handler skips reprocessing when status is in:

`COMPLETED`, `HELD`, `NAME_CHECK_PENDING`, `REFUNDED`, `FAILED`, `EXPIRED`

**Correction:** This set is **webhook-idempotency terminal**, not strictly state-machine terminal. `COMPLETED`, `HELD`, and `NAME_CHECK_PENDING` still allow admin/API transitions per `ALLOWED_TRANSITIONS`. Only `REFUNDED`, `FAILED`, `EXPIRED` have empty outgoing transitions.

**Can status move incorrectly after “terminal”?**

- `REFUNDED` / `FAILED` / `EXPIRED`: protected by empty `ALLOWED_TRANSITIONS` + `assertTransition`.
- `COMPLETED`: webhook won't re-enter capture; admin refund uses valid transition to `REFUND_INITIATED`.
- Recon job updates `settlement_id` / `settled_at` / `gateway_fee_amount` **without changing `status`** (`gateway-settlement-recon.ts` L195–202).

---

## 7. Checkout implementation

| Item | Location |
|------|----------|
| Script load | `packages/config/src/curlec-checkout.ts` L46, L70–109 |
| Order from API | Server validates amount, org access, purpose |
| Key ID | Returned as `curlecKeyId` from `mapGatewayPaymentResponse()` L39 |
| Amount | Server order amount; checkout uses `Math.round(amountMyr * 100)` sen L135 |
| Success | FPX redirect to callback; **not** final confirmation (`deposits/callback/route.ts` L28–29) |
| Failure / dismiss | `modal.ondismiss` / failure views |
| Client manipulation | Purpose/org/amount set server-side on order create; checkout uses server-returned order id |

**Duplicate order risk:** Investor — every `POST /deposits`. Issuer fees — reuse any non-`FAILED` existing payment including `EXPIRED`.

---

## 8. Webhook audit

| Property | Value |
|----------|-------|
| Route | `POST /v1/webhooks/curlec` |
| Raw body | `express.raw({ type: "application/json" })` |
| Signature header | `X-Razorpay-Signature` |
| Event ID header | `X-Razorpay-Event-Id` (required) |
| Algorithm | HMAC-SHA256 hex, `timingSafeEqual` (`curlec-signature.ts`) |
| Invalid signature | 401 `INVALID_SIGNATURE` |
| Missing webhook secret | 401 (`webhook-service.ts` L753–758) |
| Processing | Synchronous in HTTP handler (ingest + process same request) |

### Handled events

| Event | Action |
|-------|--------|
| `payment.captured` | Capture processing |
| `order.paid` | Capture (resolve payment id if missing) |
| `payment.failed` | Mark `FAILED` if `CREATED` |
| `refund.processed` / `refund.failed` | Investor deposit refunds only |
| All others | 200 OK, mark processed, no business logic |

### Not implemented

`payment.authorized`, `settlement.processed`, `refund.created`, transfer/dispute events.

---

## 9. Idempotency and concurrency

### Atomic wallet + ledger (investor PASS path)

`processInvestorDepositCapture()` wraps `claimCreatedToPaid` + `creditCompletedDeposit` in **one** `db.$transaction` (`webhook-service.ts` L219–235).

`creditCompletedDeposit()` (`deposit-service.ts` L227–268) in single transaction:

1. `investorOrganization.update` (`deposit_received`)
2. `creditInvestorBalance()` with idempotency key
3. `postLedgerEntry()` with idempotency key
4. `gatewayPayment.update` → `COMPLETED`

**Not atomic with preceding step:** Curlec field updates (`payer_name`, `curlec_payment_id`) occur **before** the transaction (`webhook-service.ts` L155–163).

### Refund atomicity

| Phase | Atomic? |
|-------|---------|
| `initiateInvestorDepositRefund` — Curlec API call | External — **not** in DB transaction |
| DB update to `REFUND_INITIATED` | Transaction after API success (`refund-service.ts` L202–238) |
| `completeInvestorDepositRefund` | Single transaction: optional wallet debit + ledger debit + `REFUNDED` (L256–318) |

FAIL auto-refund: `claimCreatedToPaid` in transaction, then `initiateInvestorDepositRefund` **outside** (`webhook-service.ts` L237–251) — crash can leave `PAID` without refund initiated.

### Race examples

1. Double `POST /investor/deposits` → two payable orders.
2. Concurrent webhooks for same payment: `updateMany` where `status=CREATED` limits double claim; wallet/ledger idempotency keys prevent double money.
3. Recon rerun same date: deletes exceptions then reprocesses (`gateway-settlement-recon.ts` L137).

---

## 10. Investor wallet and ledger

| Question | Answer |
|----------|--------|
| When balance changes? | On name-check `PASS` (auto or admin approve), not on capture alone |
| Waits for name check? | Yes — `NAME_CHECK_PENDING` / `REVIEW` / `NAME_UNAVAILABLE` hold credit |
| Transaction source | `GATEWAY_DEPOSIT` |
| Ledger account | `INVESTOR_POOL` CREDIT |
| Provider reference | Stored in balance tx `metadata` + `curlec_payment_id` on payment |
| Double credit? | Prevented by idempotency key `gateway-deposit:balance:{id}` |
| Refund reversal | `completeInvestorDepositRefund` debits if prior `GATEWAY_DEPOSIT` tx exists |

---

## 11. Payer-name check

| Item | Detail |
|------|--------|
| Expected name | `resolveInvestorExpectedNameVariants()` — personal: legal name, full name, org name; company: business name from corporate onboarding |
| Actual name | `extractPayerNameFromPayment()` — FPX: `fpx_buyerName`; fallbacks: `account_holder_name`, `payer_name`, etc. |
| Normalization | Uppercase, strip punctuation, token filters (`name-check.ts`) |
| Test evidence | Integration tests **mock** `acquirer_data.account_holder_name` or `fpx_buyerName` — not live Curlec responses |
| Live/test mode in repo | **Cannot confirm** payer name availability from Curlec sandbox/live without external validation |

---

## 12. Refund audit

| Item | Status |
|------|--------|
| Scope | Investor deposits only |
| Full refund only | `myrDecimalToSen(payment.amount)` |
| Admin UI | Real — detail page actions call API (`gateway-payments/[id]/page.tsx`) |
| Separate Refunds page | No — filters on Gateway Payments list |
| Issuer fee reversal | Not implemented |

---

## 13. Settlement audit

| Item | Status |
|------|--------|
| `settlement.processed` webhook | **Not implemented** |
| Settlement linking at capture | **No** — `settlement_id` only set in recon job |
| `GatewaySettlement` model | **Does not exist** for gateway |
| UTR / bank reference | **Not stored** on `GatewayPayment` |
| Admin settlements view | **None** — recon page only |

---

## 14. Reconciliation audit

### Automatic + manual

| Trigger | Code |
|---------|------|
| Daily cron | `cron.schedule("0 18 * * *", ...)` = 02:00 MYT (`jobs/index.ts` L97–105) |
| Manual | `POST /v1/admin/gateway-recon/run` (`recon-controller.ts` L93–103) |
| Registration | `initJobs()` called from `apps/api/src/index.ts` L47 on API startup |

### What `run_date` represents

MYT calendar date passed as `year`, `month`, `day` to Curlec **`/v1/settlements/recon/combined`** — settled payment lines for that date (`gateway-settlement-recon.ts` L69–77, L90–96). This is **settlement/recon report date**, not payment capture date.

Default manual/cron target: **yesterday MYT** (`getYesterdayMytDateOnly()` L45–50).

### What “stamped” writes (`gateway-settlement-recon.ts` L195–202)

On matched `GatewayPayment` where internal amount (sen) equals Curlec recon line amount:

```typescript
settlement_id: line.settlement_id ?? gatewayPayment.settlement_id
settled_at: line.created_at * 1000 as Date, or now()
gateway_fee_amount: senToMyrDecimal((line.fee ?? 0) + (line.tax ?? 0))
```

**Does not change** `GatewayPayment.status`.

### Exception resolve

`resolveReconException()` sets `resolved_at`, `resolved_by_user_id`, `resolve_reason` only — **does not fix payment rows** (`recon-service.ts` L205–212).

### Admin summary labels

See `RAZORPAY_IMPLEMENTATION_MATRIX.md` recon section for clearer label recommendations.

---

## 15. Admin UI audit

| Page | Path | Backed by API? | Gaps |
|------|------|----------------|------|
| Gateway Payments | `/finance/gateway-payments` | Yes | Issuer org not shown; no settlement columns |
| Payment detail | `/finance/gateway-payments/[id]` | Yes | Missing `settlement_id`, `settled_at`, `gateway_fee_amount`; `openOverride*` always null |
| Reconciliation | `/finance/reconciliation` | Yes | No run detail drill-down |
| Refunds | List filters `refunding`/`refunded` | Yes | No dedicated page |
| Webhook logs | — | DB only | No UI |
| Platform Finance fees | `/settings/platform-finance` | Yes | Fee amounts + deposit limits |

RBAC: `gateway_payments.view`, `gateway_payments.manage` (`admin-controller.ts`, `packages/types/src/rbac.ts`).

---

## 16. Configuration audit

See matrix file sections A–D.

---

## 17. Security audit

**Strengths:** Server-only secrets; raw webhook body; HMAC timing-safe compare; server-side order amounts; callback routes don't confirm payment.

**Risks:** Single webhook secret; webhook payloads stored with potential PII; `CURLEC_KEY_ID` exposed to browser (required for Checkout); dev `DISABLE_AUTH` bypass for admin gateway routes in non-prod.

---

## 18. Error handling and observability

- Structured logs with correlation IDs on webhook paths
- `GatewayWebhookEvent.error` stores processing failures
- Failed webhook processing returns 500 → Razorpay retry
- No DLQ; no PagerDuty/alert wiring in payment module
- Curlec API errors → 502 `CURLEC_API_ERROR` without retry policy (`curlec-client.ts` L64–78)

---

## 19. Tests

**14 test files** under `apps/api/src/modules/payment/` including integration tests for deposit webhook, admin, recon, onboarding/processing fees, constraints, signature.

**Investor e2e:** `apps/investor/e2e/deposit.spec.ts` (mocked APIs).

**Missing:** live payer-name contract test; duplicate deposit order test; EXPIRED fee retry; concurrent webhook worker test; two-account routing (N/A).

---

## 20. Weird / inconsistent findings

1. `getOpenOverrideProposal()` implemented but admin detail hardcodes override fields null.
2. Frontend “start a new payment” for `EXPIRED` vs backend reuse of `EXPIRED` row.
3. `TERMINAL_GATEWAY_STATUSES` name conflicts with admin-actionable statuses.
4. Help content still mentions processing fee “when gateway ready” in generated articles (stale).
5. `sync:` pseudo event IDs skip webhook row updates (`webhook-service.ts` L96–98).
6. Issuer amount mismatch → `FAILED` with no admin recovery path.
7. Recon exception resolve is audit-only.
8. Multi-instance ECS may duplicate cron executions.

---

## Evidence classification legend

- **Confirmed from code** — traced in TypeScript/Prisma
- **Documented** — in `docs/integrations/payment-gateway-*` but verify operationally
- **Requires external confirmation** — Curlec production behaviour (payer name, settlement timing)
- **UI-only / placeholder** — visible but not backed or hardcoded null
