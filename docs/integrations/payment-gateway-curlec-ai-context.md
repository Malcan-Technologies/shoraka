# Curlec Gateway Payments — Canonical AI Context / Implementation Reference

> **Canonical AI context document** for CashSouk Gateway Payments (Curlec money-in).  
> Audience: developers and future AI assistants. **Not** an Admin end-user help article.  
> Verified against the codebase as of **2026-08-07**. Prefer this file over chat history.

**Related docs (do not treat as current implementation truth if they conflict):**

| Doc | Role |
|-----|------|
| `docs/integrations/payment-gateway-curlec-plan.md` | Original plan |
| `docs/integrations/payment-gateway-curlec-plan-as-built.md` | Earlier as-built snapshot (Jul 2026); points here for AI context |
| `docs/integrations/payment-gateway-curlec-plan-business-as-built.md` | Business as-built |
| `docs/integrations/payment-gateway-curlec-ops-runbook.md` | Ops runbook |
| `docs/integrations/payment-gateway-curlec-recon-testing.md` | Recon testing |
| `docs/gateway-audit/RAZORPAY_*` | **Historical** Razorpay-era audit/plans — background only |

**DO NOT CONFUSE**

| Concept A | Concept B |
|-----------|-----------|
| Admin **Refresh** | 15-minute stuck-order poller / Curlec sync |
| Status `PAID` | Status `COMPLETED` |
| `Retry refund` | `Retry wallet update` |
| Amount mismatch (auto-refund) | Currency mismatch (`HELD`, no auto-refund) |
| List URL `filter=review` | UI label “Name check pending” |
| Curlec header `x-razorpay-*` | Razorpay as product — headers are Curlec/Razorpay-compatible naming |

Current product direction: **Curlec / generic Gateway Payment**. Razorpay branding in older docs is historical.

---

## 1. Architecture

```text
Admin portal ──► Express API (/v1/admin/gateway-payments*)
Investor/Issuer ──► Express API (deposit / onboarding-fee / processing-fee)
Curlec (FPX) ◄──► Webhooks POST /v1/webhooks/curlec/{operating|investor-pool}
                 ◄──► API Curlec client (orders, payments, refunds, settlements)
PostgreSQL (Prisma) ◄── GatewayPayment, events, receipts, recon, wallet
Cron (API process) ──► stuck-order poller (15m), receipt retry (10m), settlement recon (daily)
```

| Layer | Location |
|-------|----------|
| Payment module | `apps/api/src/modules/payment/` |
| Curlec config | `apps/api/src/config/curlec.ts` |
| Jobs | `apps/api/src/lib/jobs/` (`index.ts`, `gateway-stuck-order-poller.ts`, `gateway-settlement-recon.ts`, receipt retry) |
| Admin list UI | `apps/admin/src/components/gateway-payments-table.tsx` |
| Admin detail UI | `apps/admin/src/app/finance/gateway-payments/[id]/` |
| Shared types | `packages/types/src/gateway-payments.ts` |
| API client | `packages/config/src/api-client.ts` (`listAdminGatewayPayments`, etc.) |
| Investor wallet | `InvestorBalance` / `InvestorBalanceTransaction` via `notes/investor-balance.ts` |

---

## 2. Gateway accounts

Enum: `CurlecGatewayAccount` = `OPERATING` | `INVESTOR_POOL`

### Routing (`resolveGatewayAccountForPurpose`)

File: `apps/api/src/modules/payment/gateway-account.ts`

| Purpose | Account |
|---------|---------|
| `INVESTOR_DEPOSIT` | `INVESTOR_POOL` |
| `ISSUER_ONBOARDING_FEE` | `OPERATING` |
| `APPLICATION_PROCESSING_FEE` | `OPERATING` |

Mismatch → `409` `GATEWAY_ACCOUNT_MISMATCH`.

### Credentials (env names only — never commit secrets)

| Account | Key ID | Key secret | Webhook secret |
|---------|--------|------------|----------------|
| OPERATING | `CURLEC_OPERATING_KEY_ID` | `CURLEC_OPERATING_KEY_SECRET` | `CURLEC_OPERATING_WEBHOOK_SECRET` |
| INVESTOR_POOL | `CURLEC_INVESTOR_POOL_KEY_ID` | `CURLEC_INVESTOR_POOL_KEY_SECRET` | `CURLEC_INVESTOR_POOL_WEBHOOK_SECRET` |

Also: `CURLEC_API_BASE_URL` (optional URL). Config is lazy-loaded and cached per account.

### Webhook account routing

- `POST /v1/webhooks/curlec/operating` → `OPERATING`
- `POST /v1/webhooks/curlec/investor-pool` → `INVESTOR_POOL`

---

## 3. Payment purposes

Enum: `GatewayPaymentPurpose`

| Purpose | Account | On success |
|---------|---------|------------|
| `INVESTOR_DEPOSIT` | Investor Pool | Wallet credit (`GATEWAY_DEPOSIT`), ledger `INVESTOR_POOL`, may set deposit gates / name check path |
| `ISSUER_ONBOARDING_FEE` | Operating | Sets `IssuerOrganization.onboarding_fee_paid_at`; unlocks onboarding/RegTank progression |
| `APPLICATION_PROCESSING_FEE` | Operating | Marks application fee paid; required for submission path |

UI labels (`PURPOSE_LABEL` in `apps/admin/src/lib/gateway-payment-display.ts`):

| Enum | Label |
|------|-------|
| `INVESTOR_DEPOSIT` | Investor Deposit |
| `ISSUER_ONBOARDING_FEE` | Issuer Registration Fee |
| `APPLICATION_PROCESSING_FEE` | Application Processing Fee |

Fee amounts: Admin-configurable via `PlatformFinanceSetting` (defaults historically RM150 onboarding / RM50 processing / deposit min-max — confirm live settings in Admin).

---

## 4. Gateway Payment statuses

Enum: `GatewayPaymentStatus` in Prisma.

| Status | Admin label | Meaning |
|--------|-------------|---------|
| `CREATED` | Awaiting payment | Order created; waiting for capture |
| `PAID` | Paid | Curlec captured; local completion not finished |
| `NAME_CHECK_PENDING` | Name check pending | Investor deposit needs Admin approve/reject |
| `COMPLETED` | Completed | Benefit granted (wallet/fee complete) |
| `FAILED` | Payment failed | Failed path |
| `REFUND_INITIATED` | Refund pending | Refund requested; awaiting Curlec confirmation |
| `REFUNDED` | Refunded | Refund confirmed locally |
| `HELD` | Needs attention | Exception / stuck recovery state |
| `EXPIRED` | Expired | Order expired without successful completion |

### Allowed transitions

File: `apps/api/src/modules/payment/state.ts` — `assertTransition` / `INVALID_GATEWAY_TRANSITION` (422)

```text
CREATED            → PAID | FAILED | EXPIRED
PAID               → COMPLETED | HELD | NAME_CHECK_PENDING | REFUND_INITIATED
NAME_CHECK_PENDING → COMPLETED | HELD | REFUND_INITIATED
HELD               → COMPLETED | REFUND_INITIATED | REFUNDED
COMPLETED          → REFUND_INITIATED | REFUNDED
REFUND_INITIATED   → REFUNDED | HELD | COMPLETED
REFUNDED           → (none)
FAILED             → (none)
EXPIRED            → (none)
```

`TERMINAL_GATEWAY_STATUSES`: `COMPLETED`, `HELD`, `NAME_CHECK_PENDING`, `REFUNDED`, `FAILED`, `EXPIRED`

### PAID vs COMPLETED

- **`PAID`**: money captured at Curlec; CashSouk may still be validating / name-checking / refunding / holding.
- **`COMPLETED`**: CashSouk finished the happy path (deposit credited or fee marked paid).

**DO NOT** treat `PAID` as the final successful business state.

---

## 5. Normal successful flows (summary)

### Investor deposit

1. Create Curlec order + `GatewayPayment` (`CREATED`, purpose `INVESTOR_DEPOSIT`, account `INVESTOR_POOL`) via deposit services / `gateway-order-service`.
2. Investor pays FPX (Curlec checkout).
3. Webhook `payment.captured` (or poller sync) → claim toward `PAID`.
4. Validations (amount, currency, name check as applicable).
5. On pass → `creditCompletedDeposit` → `COMPLETED`, wallet `GATEWAY_DEPOSIT`, ledger credit.
6. Schedule receipt (`scheduleGatewayPaymentReceipt`).

Name paths: clear mismatch / amount mismatch → refund path; ambiguous name → `NAME_CHECK_PENDING`.

### Issuer onboarding fee

1. Order on `OPERATING`, purpose `ISSUER_ONBOARDING_FEE`.
2. Capture → complete → set `onboarding_fee_paid_at`.
3. Receipt scheduled.
4. Guards: missing paid fee → `402` `ONBOARDING_FEE_REQUIRED` (`onboarding-fee-service.ts`).

### Application processing fee

1. Order on `OPERATING`, purpose `APPLICATION_PROCESSING_FEE`, linked `application_id`.
2. Capture → complete fee requirement for submit.
3. Receipt scheduled.

---

## 6. Amount mismatch

Function: `handleGatewayPaymentAmountMismatch` — `apps/api/src/modules/payment/amount-mismatch-service.ts`

Behaviour (verified intent):

- Same currency, wrong amount.
- **No** deposit credit / fee completion benefit.
- Writes metadata `amountMismatch` and `captureMismatch` with `mismatchType: "AMOUNT_MISMATCH"`.
- Starts full refund of **actual captured** amount → `REFUND_INITIATED` via `initiateGatewayPaymentRefund` reason `AMOUNT_MISMATCH`.
- Curlec `refund.processed` (or reconcile) → `REFUNDED`.
- Curlec create failure / stuck → may land `HELD` with `autoRefundFailed`; Admin **Retry refund**; cron `recoverHeldAmountMismatchRefunds`.

Related: `recoverHeldAmountMismatchRefunds` retries HELD amount-mismatch rows with null `refund_reference`.

---

## 7. Currency mismatch

Function: `holdGatewayPaymentCaptureMismatch` (private in `webhook-service.ts`)

- Claim CREATED/EXPIRED → PAID → **HELD**.
- Metadata `captureMismatch` with `mismatchType: "CURRENCY_MISMATCH"` (also other hold types: `ORDER_MISMATCH`, `PAYMENT_ID_CONFLICT`).
- **No** automatic Curlec refund.
- **No** wallet credit / fee completion / normal receipt path.
- Admin must review; Admin retry-refund for currency mismatch is blocked (`CURRENCY_MISMATCH_NOT_AUTO_REFUNDABLE` in admin retry path).

---

## 8. Refund lifecycle

### Curlec / webhook events (handled in payment webhook path)

Typical events include:

- `payment.captured` (and related payment events)
- `refund.created`
- `refund.processed`
- `refund.failed`

(Exact handler branching lives in `webhook-service.ts` / refund adoption helpers.)

### Local refund reasons

Including: `NAME_MISMATCH` | `NAME_UNAVAILABLE` | `AMOUNT_MISMATCH` | `ADMIN_INITIATED`

### Key functions (`refund-service.ts`)

| Function | Role |
|----------|------|
| `initiateGatewayPaymentRefund` / `initiateInvestorDepositRefund` | Start refund |
| `completeGatewayPaymentRefund` / `completeInvestorDepositRefund` | Confirm refund + side effects |
| `adoptGatewayRefundCreated` | Adopt `refund.created` (incl. holds) |
| `reconcilePendingGatewayRefunds` | Poll Curlec for pending refunds (batch, default 50) |
| `retryWalletReversalForConfirmedRefund` | Wallet-only retry after Curlec confirmed |
| `recoverFailedWalletReversals` | Cron batch wallet recovery (batch 50) |

### Admin actions — DO NOT CONFUSE

| UI | Behaviour |
|----|-----------|
| **Start refund** | `POST .../refund` — Admin-initiated refund on eligible completed deposit |
| **Retry refund** | `POST .../retry-refund` — Retry Curlec refund / held amount-mismatch path |
| **Retry wallet update** | Wallet debit recovery when Curlec refund already confirmed (`refundConfirmedWalletReversalFailed`) |

---

## 9. Automatic 15-minute checker

**Cron:** `*/15 * * * *`  
**Entry:** `runGatewayStuckOrderPollerJob` — `apps/api/src/lib/jobs/gateway-stuck-order-poller.ts`  
**Lock:** `JOB_LOCK_KEYS.GATEWAY_STUCK_ORDER_POLLER` (`9001001`)  
**Correlation:** `cron:gateway-stuck-order-poller`  
**Requires:** API process running jobs (`initJobs()` from `apps/api/src/index.ts`)

Steps inside the job (same schedule — not separate crons):

1. Scan stale `CREATED` payments (cutoff **60 minutes**) → `syncGatewayPaymentFromCurlec` / expire as appropriate (`processStaleGatewayPayment`).
2. `recoverHeldAmountMismatchRefunds`
3. `reconcilePendingGatewayRefunds(db, 50)`
4. `recoverFailedWalletReversals(db, 50)`

**Makes Curlec API calls** for sync/refund status as implemented in those helpers.

### Other jobs

| Cron | Job |
|------|-----|
| `*/10 * * * *` | `runGatewayReceiptRetryJob` → `retryFailedGatewayPaymentReceipts` (lock `GATEWAY_RECEIPT_RETRY` / `9001006`) |
| `0 18 * * *` | Daily settlement recon at **02:00 MYT** (18:00 UTC) — `runGatewaySettlementReconForConfiguredAccounts` for OPERATING + INVESTOR_POOL |

### Refresh ≠ reconciliation

Admin **Refresh** only refetches CashSouk API/DB state via React Query.  
It does **not** call Curlec and does **not** run the 15-minute poller or settlement recon.

---

## 10. Completed deposit refunded externally

When Curlec dashboard/provider issues a refund on a completed deposit:

1. Webhooks (`refund.created` / processed / failed) adopt via refund service (`adoptGatewayRefundCreated`, etc.).
2. Metadata may include `externalCurlecRefund` (`source: "CURLEC_PROVIDER"`, refund id, optional `fundsProtected`).
3. Wallet: protect funds — hold and/or permanent debit:
   - `GATEWAY_DEPOSIT_REFUND_HOLD` — `blockInvestorBalanceForGatewayRefundHold`
   - `GATEWAY_DEPOSIT_REFUND` — `debitInvestorBalanceForGatewayRefund`
4. Insufficient available → failure marker `refundConfirmedWalletReversalFailed` (fields include `fundsProtected`, `fundsBlocked`, `blockedAmount`, `failureCategory`, …).
5. Status may move `COMPLETED` → `REFUNDED` or through `REFUND_INITIATED` / `HELD` per transitions.
6. Admin **Retry wallet update** for confirmed-refund wallet failure.
7. Failure path may set `externalCurlecRefundFailed`.

Idempotency key patterns (refund-service / investor-balance):

- Credit: `gateway-deposit:balance:<paymentId>`
- Permanent debit: `gateway-deposit:refund:<paymentId>`
- Hold: `gateway-deposit:refund-hold:<paymentId>` (+ optional index)

---

## 11. Fee refunds

### Onboarding fee (`ISSUER_ONBOARDING_FEE`)

- Success sets `IssuerOrganization.onboarding_fee_paid_at`.
- On refund initiation, fee paid-at is **cleared** (`clearIssuerOnboardingFeePaidAt` path in refund service).
- Saved onboarding progress remains; issuer must **repay** to proceed.
- Guards return `402` `ONBOARDING_FEE_REQUIRED`.
- If refund fails after clear, restore paths may re-set paid-at (covered in onboarding-fee integration tests).

### Application processing fee (`APPLICATION_PROCESSING_FEE`)

- Completed fee required for submission.
- After refund, submission blocked until repaid; application data remains.

---

## 12. Wallet

Models: `InvestorBalance` (`available_amount`, …), `InvestorBalanceTransaction`

Sources (Prisma `InvestorBalanceTransactionSource`):

- `GATEWAY_DEPOSIT`
- `GATEWAY_DEPOSIT_REFUND`
- `GATEWAY_DEPOSIT_REFUND_HOLD`

Helpers: `apps/api/src/modules/notes/investor-balance.ts`  
Deposit credit: `creditCompletedDeposit` in `deposit-service.ts`

---

## 13. Receipts

Model: `GatewayPaymentReceipt`  
Service: `apps/api/src/modules/payment/receipt/`

- Created/scheduled after successful completion paths (`scheduleGatewayPaymentReceipt`).
- Statuses: `PENDING` | `GENERATED` | `FAILED` | `REFUNDED`.
- PDF in S3 (`pdf_s3_key`); Admin view/download via signed URL.
- Retry: Admin `POST .../receipts/:id/retry` (`gateway_payments.manage`); cron every 10 minutes retries failed generation.
- Amount/currency mismatch holds and many refund paths should **not** produce a normal success receipt.

Admin UI labels: View receipt / Download receipt / Retry receipt (`GATEWAY_PAYMENT_COPY`).

---

## 14. Webhooks

| Method | Path |
|--------|------|
| POST | `/v1/webhooks/curlec/operating` |
| POST | `/v1/webhooks/curlec/investor-pool` |

Files: `webhook-controller.ts`, `webhook-service.ts`, `curlec-signature.ts`

- Raw body required for HMAC.
- Headers: `x-razorpay-signature`, `x-razorpay-event-id` (Curlec/Razorpay-compatible names).
- Dedup/audit: `GatewayWebhookEvent` unique on `(gatewayAccount, event_id)`.
- Test vs live: driven by configured keys / API base URL environment (`sandbox` | `production` on config).
- Duplicate events: idempotent processing via stored webhook events / payment state guards.

---

## 15. Admin detail page

Path: `/finance/gateway-payments/[id]`  
Permission: `gateway_payments.view` (mutations need `gateway_payments.manage`)

Helpers:

- `gateway-payment-copy.ts` — copy / toasts / event titles
- `gateway-payment-detail-model.ts` — visibility of actions
- `gateway-payment-display.ts` — status/purpose labels + badge variants
- `gateway-account.ts` — account labels + muted badge class

### Actions (when visible)

| Control | API | Literal effect |
|---------|-----|----------------|
| Refresh | GET detail | Reloads CashSouk DB/API state only |
| Start refund | POST `/:id/refund` | Starts Admin refund |
| Retry refund | POST `/:id/retry-refund` | Retries refund path |
| Retry wallet update | (retry-refund / wallet path) | Retries wallet after confirmed Curlec refund |
| Approve name check | POST `/:id/name-check/approve` | Completes deposit |
| Reject name check | POST `/:id/name-check/reject` | Starts refund |
| View / Download receipt | GET receipt PDF URL | Opens or downloads PDF |
| Retry receipt | POST `/receipts/:id/retry` | Retries PDF generation |

Activity timeline: `GatewayPaymentEvent` rows mapped through event copy helpers.

---

## 16. Admin list page

Path: `/finance/gateway-payments`  
Nav: **Finance → Payments → Gateway Payments**  
Component: `gateway-payments-table.tsx`  
Hook: `useGatewayPayments` → `listAdminGatewayPayments`

### Behaviour

- Server-side search, **300ms** debounce, URL params: `q`, `filter`, `account`, `purpose` (no `page` in URL).
- Filters: Status / Gateway account / Purpose (dropdown radios).
- Clear filters resets search + filters + page 1.
- Browser back/forward restores URL filter/search state.
- Pagination: **pageSize 20**, shared `TablePagination`, page in React state.
- Filter/search → reset page 1; Refresh keeps page; stale page clamps to last valid page.
- Columns: Created, Organization, Purpose, Amount, Status, Account, References (Order / Payment / Settlement + copy), Actions (View).
- Organization: `investorOrganizationName ?? issuerOrganizationName ?? "—"`.

### Search (`gateway-payment-list-search.ts`)

Partial, case-insensitive (except amount + JSON case-variant workaround):

- Payment `id`, `curlec_order_id`, `curlec_payment_id`, `refund_reference`, `settlement_id`, `payer_name`
- Investor/issuer org: name, person names, registration number (+ investor `legal_name_on_id`)
- Corporate JSON: `corporate_onboarding_data.basicInfo.businessName` via Prisma `string_contains` + case variants (same pattern as Notes JSON search)
- Purpose aliases, gateway account aliases
- Amount: **exact** after stripping `RM`/`MYR` and commas

Search AND-combined with status/account/purpose filters in `listGatewayPayments`.

### List filter API

| UI label | URL `filter=` | Statuses |
|----------|---------------|----------|
| All statuses | (omit) | — |
| Completed | `completed` | `COMPLETED` |
| Name check pending | `review` | `NAME_CHECK_PENDING` only |
| Refund pending | `refunding` | `REFUND_INITIATED` |
| Refunded | `refunded` | `REFUNDED` |
| Needs attention | `needs_attention` | `HELD` |

---

## 17. Display helpers

### Status labels & badge variants

File: `apps/admin/src/lib/gateway-payment-display.ts`

| Status | Label | Variant |
|--------|-------|---------|
| CREATED | Awaiting payment | `info` |
| PAID | Paid | `warning` |
| NAME_CHECK_PENDING | Name check pending | `warning` |
| COMPLETED | Completed | `success` |
| REFUND_INITIATED | Refund pending | `warning` |
| FAILED | Payment failed | `destructive` |
| HELD | Needs attention | `destructive` |
| REFUNDED | Refunded | `muted` |
| EXPIRED | Expired | `muted` |

Account badges: muted secondary via `getGatewayAccountBadgeClassName` (`gateway-account.ts`) — list, detail, reconciliation.

---

## 18. Permissions

| Permission | Use |
|------------|-----|
| `gateway_payments.view` | List, detail, receipts read, exception count |
| `gateway_payments.manage` | Refund, retry, name-check, receipt retry |
| `gateway_reconciliation.view` | Recon list/detail |
| `gateway_reconciliation.manage` | Run recon / resolve exceptions |

All Admin gateway routes also require `UserRole.ADMIN`.

---

## 19. API routes (current)

### Admin gateway payments — mount `/v1/admin/gateway-payments`

| Method | Path | Permission |
|--------|------|------------|
| GET | `/` | view |
| GET | `/exceptions/pending-count` | view |
| GET | `/receipts` | view |
| GET | `/receipts/:id` | view |
| GET | `/receipts/:id/pdf` | view |
| POST | `/receipts/:id/retry` | manage |
| GET | `/:id/receipt` | view |
| GET | `/:id` | view |
| POST | `/:id/retry-refund` | manage |
| POST | `/:id/refund` | manage |
| POST | `/:id/name-check/approve` | manage |
| POST | `/:id/name-check/reject` | manage |

### Admin recon — mount `/v1/admin/gateway-recon`

| Method | Path | Permission |
|--------|------|------------|
| GET | `/runs` | recon.view |
| GET | `/runs/:id` | recon.view |
| GET | `/exceptions` | recon.view |
| GET | `/exceptions/pending-count` | recon.view |
| POST | `/run` | recon.manage |
| POST | `/exceptions/:id/resolve` | recon.manage |

### Webhooks

See §14.

Investor/issuer create-order routes live under their portal payment modules (deposit / onboarding-fee / processing-fee) — not listed here in full; see those services.

---

## 20. Database (summary)

Primary models (Prisma):

- `GatewayPayment` — purpose, org FKs, amount, status, Curlec ids, refund fields, settlement, metadata Json, `gatewayAccount`
- `GatewayPaymentEvent` — audit timeline
- `GatewayPaymentReceipt` — official PDF receipt
- `GatewayOrderAttempt` — durable order-create checkpoint
- `GatewayWebhookEvent` — raw webhook dedup
- `GatewayReconRun` / `GatewayReconException` — settlement recon

Metadata JSON (non-exhaustive, verified keys):

- `captureMismatch`, `amountMismatch`
- `autoRefundFailed`
- `refundConfirmedWalletReversalFailed` (may nest `fundsProtected`)
- `externalCurlecRefund`, `externalCurlecRefundFailed`

---

## 21. Testing (coverage map)

Protects webhooks, deposits, fees, refunds, wallet reversal, external Curlec refunds, recon, RBAC, state machine, Curlec client/signature, Admin copy/display/search helpers.

Notable suites under `apps/api/src/modules/payment/` and Admin `gateway-payment-*.test.ts`, `gateway-payment-display.test.ts`, `gateway-payment-list-search.test.ts`.

---

## 22. Historical / removed temporary Admin showcase

**Fully removed. Do not reintroduce unless explicitly requested.**

```text
gatewayPaymentShowcase
gateway-payment-showcase
FORCE_GATEWAY_ACTION_PREVIEWS
PREVIEW_TIMELINE_EVENTS
PREVIEW_ONLY_TOAST
TEMPORARY GATEWAY PAYMENT SHOWCASE
```

These were temporary Admin UI showcase/preview hooks. Production Admin uses real API data only.

Older `docs/gateway-audit/RAZORPAY_*` files describe pre-Curlec audit work — **historical**.

---

## 23. Known limitations (verified)

1. Prisma **5.7** JSON filters lack true `mode: "insensitive"`; corporate `businessName` search uses case-variant `string_contains` (same approach as Notes issuer/paymaster snapshot search). Unusual mixed casing can theoretically miss.
2. Admin list does not put `page` in the URL (matches other Admin registries).
3. List References column does not show refund reference (refund ref is searchable and shown on detail).
4. Settlement recon and stuck-order poller only run when the API job runner is active.

---

## 24. Key file index

```text
apps/api/src/modules/payment/
  admin-service.ts, admin-controller.ts, admin-schemas.ts
  gateway-payment-list-search.ts
  webhook-service.ts, webhook-controller.ts
  refund-service.ts, amount-mismatch-service.ts
  deposit-service.ts, onboarding-fee-service.ts, processing-fee-service.ts
  gateway-order-service.ts, gateway-account.ts, state.ts
  receipt/*
apps/api/src/lib/jobs/gateway-stuck-order-poller.ts
apps/api/src/lib/jobs/gateway-settlement-recon.ts
apps/api/src/config/curlec.ts
apps/admin/src/components/gateway-payments-table.tsx
apps/admin/src/app/finance/gateway-payments/
apps/admin/src/lib/gateway-payment-display.ts
apps/admin/src/lib/gateway-account.ts
packages/types/src/gateway-payments.ts
```
