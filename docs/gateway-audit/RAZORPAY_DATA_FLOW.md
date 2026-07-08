# Razorpay / Curlec Data Flows

Audit date: 2026-07-08. All paths verified against `apps/api/src/modules/payment/` unless noted.

---

## Shared primitives

### Order creation (all payment purposes)

```
User clicks Pay
  → Portal calls create-order API
  → gateway-order-service.createGatewayOrder()
       → createCurlecClient() [single CURLEC_KEY_ID / SECRET]
       → POST /v1/orders (amount in sen, receipt, notes.purpose)
       → prisma.gatewayPayment.create {
            status: CREATED,
            curlec_order_id: order.id,
            idempotency_key: "curlec:order:{order.id}"
          }
       → returns { id, curlecOrderId, curlecKeyId, amount, status }
  → openCurlecFpxCheckout({ keyId, orderId, amountMyr, callbackUrl })
  → User completes FPX at bank
  → Redirect to portal callback route (UX only)
```

**Files:** `gateway-order-service.ts` L50–87; `packages/config/src/curlec-checkout.ts` L128–169.

### Payment confirmation (webhook or sync)

Two paths converge on `processGatewayPaymentCapture()`:

1. **Webhook:** `POST /v1/webhooks/curlec` → `ingestCurlecWebhook` → `processStoredCurlecWebhook`
2. **Sync:** `syncGatewayPaymentFromCurlec()` — called from GET deposit/fee endpoints and stuck-order poller

**Capture events:** `payment.captured`, `order.paid` (`webhook-service.ts` L57, L338–382).

---

## 1. Issuer onboarding fee

### Plain English

After accepting terms, the issuer pays a one-time onboarding fee via FPX. CashSouk creates a Curlec order, opens checkout, and waits for a webhook (or sync). When payment is captured, the fee is marked complete, the issuer org is flagged as paid, and the platform operating ledger is credited. No name check. No refund.

### Technical flow

```
Issuer portal: apps/issuer/src/app/onboarding/fee/page.tsx
  POST /v1/issuer/onboarding-fee { issuerOrganizationId }
    → onboarding-fee-service.createIssuerOnboardingFee()
         IF existing payment status NOT IN (FAILED) → return existing row  ⚠ includes EXPIRED
         ELSE createGatewayOrder(purpose: ISSUER_ONBOARDING_FEE)
    → Checkout with curlecOrderId

Webhook: payment.captured | order.paid
  → processOnboardingFeeCapture()
       → fetchPayment(paymentId) — verify amount sen
       → IF amount mismatch → status FAILED (no refund)
       → ELSE transaction:
            claimCreatedToPaid (CREATED → PAID)
            completeOnboardingFeePayment():
              issuerOrganization.onboarding_fee_paid_at = now()
              postLedgerEntry(OPERATING_ACCOUNT, CREDIT)
              gatewayPayment.status = COMPLETED

Gate: regtank/service.ts — startCorporateOnboarding requires onboarding_fee_paid_at
```

**DB writes on success:** `gateway_payments` (COMPLETED), `issuer_organizations.onboarding_fee_paid_at`, `note_ledger_entries` (idempotency `gateway-onboarding-fee:ledger:{id}`).

---

## 2. Issuer application processing fee

### Plain English

When submitting an application, the issuer pays a processing fee once per application. Same checkout pattern as onboarding. Successful capture marks the payment complete and credits the operating ledger. Submit API refuses transition unless a COMPLETED fee exists for that application.

### Technical flow

```
Issuer: application-processing-fee-step.tsx
  POST /v1/applications/:applicationId/processing-fee
    → processing-fee-service.createApplicationProcessingFee()
         IF COMPLETED exists → return it
         IF existing status NOT FAILED → return existing  ⚠ includes EXPIRED
         ELSE createGatewayOrder(purpose: APPLICATION_PROCESSING_FEE, applicationId)

Webhook → processProcessingFeeCapture() → completeProcessingFeePayment()
  → postLedgerEntry(OPERATING_ACCOUNT, CREDIT)
  → status COMPLETED

Submit gate: assertApplicationProcessingFeePaid() → 402 PROCESSING_FEE_REQUIRED
```

---

## 3. Investor deposit

### Plain English

An approved investor enters an amount within configured limits and pays via FPX. Each deposit request creates a **new** Curlec order. After capture, CashSouk compares the bank payer name to the investor's registered name(s). If it matches, the wallet and investor-pool ledger are credited in one database transaction. If it clearly mismatches or the amount differs, an automatic refund is started. If the name is missing or ambiguous, ops reviews before crediting.

### Technical flow

```
Investor: investor-deposit-form.tsx
  POST /v1/investor/deposits { investorOrganizationId, amount }
    → deposit-service.createInvestorDeposit()
         validate min/max (PlatformFinanceSetting)
         assertInvestorOrgAccess()
         createGatewayOrder(purpose: INVESTOR_DEPOSIT)  ← always new order

Webhook → processInvestorDepositCapture()
  1. fetchPayment → payer_name, bank_code, amount verify
  2. runNameCheck(expectedVariants, payerName)
  3. Branch:
     PASS:
       db.$transaction {
         claimCreatedToPaid
         creditCompletedDeposit():
           deposit_received = true
           creditInvestorBalance(GATEWAY_DEPOSIT, idempotency gateway-deposit:balance:{id})
           postLedgerEntry(INVESTOR_POOL, idempotency gateway-deposit:ledger:{id})
           status COMPLETED, name_check_result PASS
       }
     FAIL:
       claimCreatedToPaid → initiateInvestorDepositRefund (Curlec API, then REFUND_INITIATED)
     REVIEW | NAME_UNAVAILABLE:
       claimCreatedToPaid → pendNameCheckReview → NAME_CHECK_PENDING

Admin approve: POST .../name-check/approve → creditCompletedDeposit (same as PASS)
Admin reject: POST .../name-check/reject → initiateInvestorDepositRefund
```

**Important:** Wallet credit happens at **capture + name approval**, not at settlement recon.

---

## 4. Name checking

```
Curlec GET /v1/payments/:id
  → extractPayerNameFromPayment()
       1. acquirer_data.fpx_data.fpx_buyerName  (FPX primary)
       2. account_holder_name, payer_name, name, buyer_name

Expected names: resolveInvestorExpectedNameVariants(org)
  PERSONAL: legal_name_on_id, first+middle+last, org.name
  COMPANY: corporate_onboarding_data.basicInfo.businessName

runNameCheck():
  normalize + tokenize
  PERSONAL: exact multiset → PASS; subset/Jaccard≥0.5 → REVIEW; else FAIL
  COMPANY: exact normalized → PASS; Jaccard≥0.5 → REVIEW; else FAIL
  empty payer or expected → NAME_UNAVAILABLE
```

**Files:** `curlec-schemas.ts` L133–156; `deposit-service.ts` L157–207; `name-check.ts`.

**Repository cannot confirm** production/test Curlec responses include payer name — tests mock the field.

---

## 5. Refund

### Plain English

Only investor deposits are refunded. CashSouk calls Curlec's refund API, marks the payment as refund in progress, and waits for a refund webhook. If the wallet had been credited (e.g. admin refund after COMPLETED), the wallet and ledger are debited when the refund completes. If the Curlec API fails, the payment moves to HELD for admin retry.

### Technical flow

```
Trigger: auto (FAIL, amount mismatch) | admin (reject name, manual refund, retry HELD)

initiateInvestorDepositRefund():
  1. Curlec POST /v1/payments/:id/refund  [NOT in DB transaction]
  2. ON API error → markRefundHeldFallback → HELD
  3. ON success → transaction:
       status REFUND_INITIATED
       refund_reference = refund.id
       GatewayPaymentEvent REFUND_INITIATED

Webhook refund.processed:
  completeInvestorDepositRefund() in transaction:
    IF prior GATEWAY_DEPOSIT balance tx exists → debit wallet + INVESTOR_POOL ledger debit
    status REFUNDED, refunded_at

Webhook refund.failed:
  failInvestorDepositRefund() → HELD + metadata.refundFailed
```

**Files:** `refund-service.ts` L96–358.

---

## 6. Settlement

### Plain English

Curlec settles captured payments to the company's bank on a T+ schedule. CashSouk does **not** listen for a settlement webhook. Instead, a daily job asks Curlec's settlement recon API for yesterday's (MYT) settled payment lines and stamps matching internal payments with settlement ID, settlement timestamp, and gateway fees.

### Technical flow

```
NO webhook handler for settlement.processed

Daily cron (02:00 MYT): jobs/index.ts → runGatewaySettlementReconJob()
  run_date = yesterday MYT (or manual date)
  fetchSettlementRecon({ year, month, day })  ← Curlec API
  filter: entity_type=payment AND settled=true AND payment_id present

  FOR each line:
    find gatewayPayment by curlec_payment_id
    IF not found → GatewayReconException ORPHAN_CURLEC_PAYMENT
    IF amount sen mismatch → AMOUNT_MISMATCH exception
    ELSE UPDATE gateway_payments SET
           settlement_id = line.settlement_id
           settled_at = line.created_at (or now)
           gateway_fee_amount = (fee + tax) in MYR
         (status unchanged)
```

**Only writer of `settlement_id` on `gateway_payments`:** `gateway-settlement-recon.ts` L195–202 (confirmed by repo grep).

---

## 7. Reconciliation

### Plain English

Reconciliation is the daily (or manual) job above plus an admin UI to review runs and resolve exceptions. It does not compare bank statements — only Curlec's settlement report against internal gateway payment records. "Resolve exception" records ops sign-off but does not auto-fix data.

### Technical flow

```
Automatic: cron 0 18 * * * UTC (02:00 MYT) with advisory lock
Manual: POST /v1/admin/gateway-recon/run { runDate?: "YYYY-MM-DD" }
  → recon-service.triggerReconRun()
  → runGatewaySettlementReconJob({ runDate, triggeredBy: userId })

Persist:
  gateway_recon_runs (upsert by run_date)
  gateway_recon_exceptions (deleted and recreated on rerun for that run)

Admin UI: /finance/reconciliation
  Lists runs: settlementsScanned, paymentsMatched, paymentsStamped, exceptionsCount
  Open exceptions queue → POST .../exceptions/:id/resolve { reason }
```

**Stamped** = matched payment row updated with settlement metadata (see §6).

---

## 8. Duplicate webhook handling

### Plain English

Every webhook gets a unique event ID stored in the database. Duplicates are ignored for processing but still return HTTP 200. Processing checks if the event was already processed. Payment capture uses database conditions so the same payment is not double-credited.

### Technical flow

```
POST /v1/webhooks/curlec
  ingestCurlecWebhook:
    verify signature (CURLEC_WEBHOOK_SECRET)
    gatewayWebhookEvent.createMany({ event_id }, skipDuplicates: true)
    IF duplicate → return { duplicate: true }  (still 200)

  processStoredCurlecWebhook(eventId):
    IF processed_at IS NOT NULL → return
    parse payload → route by event type
    capture path:
      IF payment.status IN TERMINAL_GATEWAY_STATUSES → return (skip)
      claimCreatedToPaid: UPDATE ... WHERE status = CREATED  (optimistic)
      credit/refund uses idempotency keys:
        gateway-deposit:balance:{paymentId}
        gateway-deposit:ledger:{paymentId}
    markWebhookEvent.processed_at = now()

Duplicate payment.captured + order.paid (different event_ids):
  Second event: claimCreatedToPaid fails (not CREATED) → no second credit
  Wallet/ledger idempotency keys prevent double money if race occurs
```

**Files:** `webhook-service.ts` L742–839, L286–383, L110–128; `deposit-webhook.integration.test.ts` L276–308.

---

## Sync path (browser return / poller)

```
GET /v1/investor/deposits/:id (or issuer fee GET)
  → syncGatewayPaymentFromCurlec()
       fetchOrderPayments(curlec_order_id)
       IF latest.status = captured → processGatewayPaymentCapture(eventId: "sync:{paymentId}:{curlecPaymentId}")
       IF latest.status = failed → markGatewayPaymentFailedByOrderId

Stuck-order poller (CREATED > 60 min):
  sync first; if still CREATED → EXPIRED + GatewayPaymentEvent EXPIRED
```

**Files:** `webhook-service.ts` L598–655; `gateway-stuck-order-poller.ts` L25–76.

---

## Status vs settlement timeline (investor deposit)

```
Time ──────────────────────────────────────────────────────────────►

FPX capture          Name check PASS           Curlec settles to bank
     │                      │                          │
     ▼                      ▼                          ▼
 status: PAID→COMPLETED   wallet credited      recon stamps settled_at
 (seconds)                (seconds)              (T+1/2, daily job)
```

Captured ≠ settled. Recon confirms Curlec settlement report alignment, not bank statement.
