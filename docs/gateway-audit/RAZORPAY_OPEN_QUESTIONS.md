# Razorpay / Curlec Open Questions

Questions that **cannot be answered from the repository alone**. Items confirmed in code are not listed here.

---

## For Ivan / internal engineering & product team

1. **Single vs dual Curlec merchant accounts**  
   Code and business docs (`payment-gateway-curlec-plan-business-as-built.md` L47) assume **one** Curlec settlement account with internal ledger buckets. Is the stakeholder requirement for separate Operating and Investor Pool **Razorpay accounts** still active? If yes, this is a product/architecture decision not reflected in code.

2. **EXPIRED issuer fee retry**  
   Backend reuses any non-`FAILED` payment including `EXPIRED` (`onboarding-fee-service.ts` L56, `processing-fee-service.ts` L58). Frontend tells users to “start a new payment” (`onboarding-fee-return-views.tsx` L136–140). Is intentional fix to create a new order on EXPIRED, or should users contact support?

3. **Investor deposit duplicate orders**  
   Is allowing multiple concurrent `CREATED` deposit orders per org acceptable, or should the API deduplicate/reuse an open order?

4. **Dev recon simulator removal**  
   `apps/api/scripts/dev-simulate-gateway-settlement.ts` is documented as pre-live removal (`payment-gateway-curlec-recon-testing.md`). Who owns removal and prod guard verification?

5. **Override proposal workflow**  
   `GatewayPaymentEventType.OVERRIDE_*` and `getOpenOverrideProposal()` exist but admin API returns hardcoded null (`admin-service.ts` L210–211). Was maker-checker override deferred or abandoned?

6. **Multi-instance cron**  
   `initJobs()` runs on every API task (`index.ts` L47). Advisory locks exist for gateway jobs (`withAdvisoryLock`). Is ECS desired task count >1 in prod, and are locks verified under load?

7. **Help content staleness**  
   Generated help still references processing fee “when payment gateway support is ready” in places. Who updates help-content sources before launch?

8. **`payment.authorized` handling**  
   Docs mention handling authorized events if auto-capture is off. Has Curlec live account confirmed **auto-capture enabled** for FPX so `payment.captured` always fires?

---

## For Curlec / Razorpay

1. **FPX payer name in production API**  
   Code reads `acquirer_data.fpx_data.fpx_buyerName` (`curlec-schemas.ts` L140–145). Does **live** FPX populate this on `GET /v1/payments/:id`? Does **test/sandbox** FPX populate it (repo tests mock the field — not proof of Curlec behaviour)?

2. **FPX payer name in webhooks**  
   Is buyer name included in `payment.captured` webhook payload, or only via payment fetch?

3. **Malaysia production API base URL**  
   Default is `https://api.razorpay.com` (`curlec.ts` L52). Confirm correct base URL for Curlec Malaysia live.

4. **Settlement recon API date semantics**  
   CashSouk passes MYT `year/month/day` to `/v1/settlements/recon/combined`. Does this date represent **settlement date**, **value date**, or **transaction date** in Curlec's reporting?

5. **Test mode settlements**  
   Docs state test mode never settles. Confirm — and whether any sandbox simulation API exists besides recon combined.

6. **Webhook event subscription**  
   Which events are registered on the live webhook URL (`POST {api}/v1/webhooks/curlec`)? Minimum needed: `payment.captured`, `order.paid`, `payment.failed`, `refund.processed`, `refund.failed`.

7. **Refund timing and FPX**  
   Confirm normal refund speed and failure modes for FPX investor deposit auto-refunds.

8. **Order expiry at Curlec**  
   CashSouk marks internal `EXPIRED` after 60 min (`gateway-stuck-order-poller.ts` L13). Does Curlec also expire orders independently?

9. **Dual-account feasibility**  
   If CashSouk needs separate merchant accounts for investor vs operating flows, does Curlec support multiple webhooks/secrets under one integration pattern?

10. **MDR / fee breakdown**  
    Recon stores `fee + tax` as `gateway_fee_amount`. Confirm fields match finance expectations and whether tax is recoverable/reportable separately.

---

## For finance / operations

1. **Captured vs settled operational policy**  
   Wallets credit at capture; recon stamps settlement days later. Is ops comfortable investing/disbursement rules based on **captured** status before recon?

2. **Daily recon ownership**  
   Cron runs 02:00 MYT for yesterday (`jobs/index.ts` L97–105). Who monitors failures and open exceptions daily?

3. **Missed recon dates**  
   No automatic backfill except manual “Run now” with date. Process if cron fails over a weekend/holiday?

4. **Exception resolve semantics**  
   Resolving a recon exception only records reason — does not stamp payment or adjust ledger. What is the required ops playbook for ORPHAN and AMOUNT_MISMATCH?

5. **HELD deposit queue**  
   Payments where Curlec refund API failed land in HELD. Target SLA for admin retry?

6. **NAME_CHECK_PENDING queue**  
   Volume expectations if production FPX names are often missing? Staffing for review?

7. **Bank statement reconciliation**  
   Recon compares Curlec API to internal records only — no bank UTR matching. When is bank-statement reconciliation required, and by whom?

8. **MDR accounting**  
   `gateway_fee_amount` is stored on payment row but not posted as separate ledger entry at recon. How should MDR be reflected in finance reports?

9. **Single settlement bank vs ledger buckets**  
   All Curlec money lands in one bank account; ledger splits INVESTOR_POOL vs OPERATING_ACCOUNT. Confirm manual/trustee transfer process until RHB API.

10. **Non-refundable issuer fees**  
    Confirm finance and support policy when onboarding/application rejected after fee paid.

---

## For client / legal / compliance

1. **Third-party payment prevention**  
    Name check auto-refunds FAIL; REVIEW/UNAVAILABLE require manual approval. Is partial-match (Jaccard ≥0.5) → manual review sufficient for AML policy?

2. **Payer name unavailable**  
    If Curlec cannot supply payer name programmatically, is manual dashboard verification + admin approve acceptable regulatory control?

3. **Data retention for webhook payloads**  
    Full webhook JSON stored in `gateway_webhook_events.payload`. Retention period and PII handling?

4. **Investor disclosure**  
    UI states deposits must come from own account (`investor-deposit-form.tsx` L174–177). Legal review of copy and enforcement mechanism?

5. **Refund timelines**  
    What customer-facing SLA for auto-refund after name mismatch? Curlec FPX refund timing?

6. **Terms for non-refundable issuer fees**  
    Are T&C and fee page copy aligned with code (no refund path in `refund-service.ts` for issuer purposes)?

7. **Dual Razorpay accounts**  
    If regulatory structure requires segregated merchant accounts for investor pool vs operating income, is current single-account + ledger approach sufficient?

8. **Audit trail for manual name-check approval**  
    `name_checked_by_user_id` and `GatewayPaymentEvent` recorded on approve. Sufficient for audit/regulator?

---

## Explicitly answered from repository (not open)

These were investigation targets — documented here to avoid duplicate questions:

| Question | Answer from repo |
|----------|------------------|
| Only one Curlec credential set? | **Yes** — `CURLEC_KEY_ID/SECRET/WEBHOOK_SECRET` only |
| `settlement.processed` implemented? | **No** — grep shows docs only |
| Settlement linking at capture? | **No** — only `gateway-settlement-recon.ts` L195–202 |
| Recon automatic + manual? | **Both** — cron + `POST /v1/admin/gateway-recon/run` |
| Cron registered? | **Yes** — `index.ts` L47 `initJobs()` |
| What stamped writes? | `settlement_id`, `settled_at`, `gateway_fee_amount` |
| Wallet + ledger atomic on PASS? | **Yes** — single transaction in `creditCompletedDeposit()` |
| Refund atomic with Curlec? | **No** — API call before DB transaction |
| Admin override fields real? | **No** — hardcoded null in `admin-service.ts` L210–211 |
