# Razorpay / Curlec Gateway Audit — Second Independent Review

Date: 2026-07-08  
Reviewer mode: Independent verification from repository code (not using prior audit docs as evidence)

## Verification method

- Verified route registration in API bootstrap and router composition.
- Verified controller -> service call chains for reachable payment/recon endpoints.
- Verified production boot path initializes cron jobs.
- Verified deployed ECS task definition includes Curlec env/secrets.
- Verified current Prisma schema and migrations for constraints and enums.
- Verified tests and whether they cover runtime behavior vs mocked behavior.

### Evidence classification used for each claim

- **Confirmed runtime behavior**: directly reachable through registered routes/jobs in production code.
- **Code exists but may not be reached**: implemented but not wired in reachable production path.
- **Behavior covered only by tests**: demonstrated in tests, not fully proven in live runtime.
- **Behavior inferred from code**: static logic implies behavior; no direct runtime assertion.
- **Requires external Curlec confirmation**: cannot be proven from repo alone.

---

## Claim-by-claim review

### 1) Only one Curlec/Razorpay account is currently supported
- **Claim**: Only one Curlec account/credential set is supported.
- **Verdict**: **Confirmed**
- **Evidence classification**:
  - Confirmed runtime behavior: yes
  - Code exists but may not be reached: no
  - Behavior covered only by tests: no
  - Behavior inferred from code: yes
  - Requires external Curlec confirmation: no
- **Repository evidence**:
  - `apps/api/src/config/curlec.ts`: only `CURLEC_KEY_ID`, `CURLEC_KEY_SECRET`, `CURLEC_WEBHOOK_SECRET`, `CURLEC_API_BASE_URL`.
  - `apps/api/src/modules/payment/curlec-client.ts`: default client always resolves `getCurlecConfig()`.
  - `apps/api/prisma/schema.prisma`: no `gateway_account_id` / account-routing field on `GatewayPayment`.
  - `infra/ecs-task-definition-api.json`: only one Curlec key/secret/webhook secret set (single set of env secrets).
- **Corrected conclusion**: Runtime uses one global Curlec credential set for all payment purposes.
- **Risk**: High if business/regulatory requirement is dual merchant accounts.
- **Recommended next action**: Confirm business requirement for dual accounts before production go-live.

### 2) Hidden or alternate account-routing logic exists
- **Claim**: There may be hidden account-selection/routing logic.
- **Verdict**: **Incorrect**
- **Evidence classification**:
  - Confirmed runtime behavior: yes
  - Code exists but may not be reached: yes (`createCurlecClient(config?)` parameterized constructor)
  - Behavior covered only by tests: yes (injected config in tests)
  - Behavior inferred from code: yes
  - Requires external Curlec confirmation: no
- **Repository evidence**:
  - Runtime call sites in payment module call `createCurlecClient()` with no arguments:
    - `gateway-order-service.ts`, `webhook-service.ts`, `refund-service.ts`, `gateway-settlement-recon.ts`.
  - `curlec-client.ts`: optional `config` arg exists but not used by runtime payment paths.
  - `webhook-schemas.ts`: parses `account_id` in payload but no routing uses it.
- **Corrected conclusion**: No hidden runtime account-routing by purpose/account ID exists.
- **Risk**: Medium (false confidence that flows are account-isolated).
- **Recommended next action**: If dual-account support is needed, add explicit purpose->account routing and per-account webhook secret resolution.

### 3) Payment purposes are routed correctly
- **Claim**: Payment purpose handling is correct.
- **Verdict**: **Partially correct**
- **Evidence classification**:
  - Confirmed runtime behavior: yes (capture routing + ledger posting)
  - Code exists but may not be reached: no
  - Behavior covered only by tests: partially
  - Behavior inferred from code: yes
  - Requires external Curlec confirmation: no
- **Repository evidence**:
  - Route registration:
    - `routes.ts` registers:
      - `POST /v1/investor/deposits`
      - `POST /v1/issuer/onboarding-fee`
      - `POST /v1/applications/:applicationId/processing-fee`
  - Controller -> service reachability:
    - `deposit-controller.ts` -> `createInvestorDeposit()`
    - `onboarding-fee-controller.ts` -> `createIssuerOnboardingFee()`
    - `processing-fee-controller.ts` -> `createApplicationProcessingFee()`
  - Purpose dispatch at capture:
    - `webhook-service.ts` `processGatewayPaymentCapture()` switches by `GatewayPaymentPurpose`.
  - Ledger destination:
    - Investor deposit -> `INVESTOR_POOL` (`deposit-service.ts`)
    - Issuer/application fees -> `OPERATING_ACCOUNT` (`webhook-service.ts`)
- **Corrected conclusion**: Purpose-to-business-handler and ledger routing are correct; purpose-to-different-Curlec-account routing is not implemented.
- **Risk**: Medium
- **Recommended next action**: Keep current purpose handlers; decide whether account split is required.

### 4) EXPIRED issuer fee payments block retry
- **Claim**: EXPIRED issuer fee rows block creating a new order.
- **Verdict**: **Confirmed**
- **Evidence classification**:
  - Confirmed runtime behavior: yes
  - Code exists but may not be reached: no
  - Behavior covered only by tests: no direct regression test
  - Behavior inferred from code: yes
  - Requires external Curlec confirmation: no
- **Repository evidence**:
  - `onboarding-fee-service.ts`: `findExistingOnboardingFeePayment` uses `status: { not: FAILED }`.
  - `processing-fee-service.ts`: same pattern for processing fee.
  - Therefore EXPIRED (and other non-FAILED) rows are returned instead of creating new order.
- **Corrected conclusion**: Retry is blocked after EXPIRED for issuer onboarding and processing fees.
- **Risk**: High (user can be stuck without new payment intent).
- **Recommended next action**: Exclude `EXPIRED` from reusable statuses (or only reuse `CREATED`/`PAID`).

### 5) Investor deposits can create duplicate orders
- **Claim**: Repeated create calls can create duplicate deposit orders.
- **Verdict**: **Confirmed**
- **Evidence classification**:
  - Confirmed runtime behavior: yes
  - Code exists but may not be reached: no
  - Behavior covered only by tests: no direct dedicated duplicate-order test
  - Behavior inferred from code: yes
  - Requires external Curlec confirmation: no
- **Repository evidence**:
  - `deposit-service.ts` always calls `createGatewayOrder()` for `POST /deposits`.
  - No check for existing open deposit payment.
  - `gateway-order-service.ts` always creates a new Curlec order and new `GatewayPayment` row.
- **Corrected conclusion**: Duplicate deposit intents/orders are possible via repeated submit/retry.
- **Risk**: High (double pay risk).
- **Recommended next action**: Add idempotency key or open-order reuse policy.

### 6) Webhook signature verification is correct
- **Claim**: Signature verification is correctly implemented.
- **Verdict**: **Confirmed**
- **Evidence classification**:
  - Confirmed runtime behavior: yes
  - Code exists but may not be reached: no
  - Behavior covered only by tests: yes (unit + integration)
  - Behavior inferred from code: yes
  - Requires external Curlec confirmation: no
- **Repository evidence**:
  - `curlec-signature.ts`: HMAC SHA-256 + `timingSafeEqual`.
  - `webhook-controller.ts`: reads raw body (`express.raw`) and header `X-Razorpay-Signature`.
  - `app/index.ts`: mounts Curlec webhook router before `express.json()`.
  - `webhook.integration.test.ts` and `curlec-signature.test.ts` validate good/bad signatures.
- **Corrected conclusion**: Implementation is correct for Razorpay-style raw-body HMAC verification.
- **Risk**: Low (if secrets configured correctly).
- **Recommended next action**: Ensure production webhook secret matches Curlec dashboard.

### 7) Webhook events are idempotent
- **Claim**: Webhooks are idempotent.
- **Verdict**: **Partially correct**
- **Evidence classification**:
  - Confirmed runtime behavior: yes (sequential duplicates)
  - Code exists but may not be reached: no
  - Behavior covered only by tests: yes
  - Behavior inferred from code: yes (concurrency gap)
  - Requires external Curlec confirmation: no
- **Repository evidence**:
  - `gateway_webhook_events.event_id` unique (`schema.prisma`, migration `20260621094556...`).
  - `ingestCurlecWebhook()` uses `createMany(... skipDuplicates: true)`.
  - `processStoredCurlecWebhook()` skips if `processed_at` already set.
  - Integration tests cover duplicate `event_id` sequential handling.
- **Corrected conclusion**: Sequential duplicate deliveries are handled; concurrent same-event processing still has a small race window.
- **Risk**: Medium
- **Recommended next action**: Add claim/lock step on webhook event row before processing.

### 8) `payment.captured` and `order.paid` can both cause duplicate processing
- **Claim**: Both events might double-process same payment.
- **Verdict**: **Partially correct**
- **Evidence classification**:
  - Confirmed runtime behavior: partially
  - Code exists but may not be reached: no
  - Behavior covered only by tests: partially
  - Behavior inferred from code: yes
  - Requires external Curlec confirmation: no
- **Repository evidence**:
  - `webhook-service.ts` processes both events (`DEPOSIT_CAPTURE_EVENTS`).
  - Duplicate prevention relies on status progression + idempotency keys.
  - Tests cover replay after completion and concurrent capture function calls, but no explicit `order.paid` integration case.
- **Corrected conclusion**: Sequential second event after `COMPLETED` is safe; concurrent overlap risk is reduced but not mathematically eliminated.
- **Risk**: Medium
- **Recommended next action**: Add explicit integration test for `payment.captured` + `order.paid` pair and lock by payment row transition.

### 9) Wallet credit and ledger posting are atomic
- **Claim**: Deposit wallet credit and ledger posting are atomic.
- **Verdict**: **Partially correct**
- **Evidence classification**:
  - Confirmed runtime behavior: yes (wrapped in one DB tx)
  - Code exists but may not be reached: no
  - Behavior covered only by tests: yes
  - Behavior inferred from code: yes
  - Requires external Curlec confirmation: no
- **Repository evidence**:
  - `webhook-service.ts` PASS branch uses `db.$transaction`.
  - `deposit-service.creditCompletedDeposit()` updates `deposit_received`, balance tx, ledger entry, and gateway status in one transaction.
  - `investor-balance.ts`: `creditInvestorBalance()` increments balance before insert; on unique conflict returns duplicate row.
- **Corrected conclusion**: The top-level flow is transactional, but `creditInvestorBalance` has a concurrency edge because increment precedes idempotency insert.
- **Risk**: Medium
- **Recommended next action**: Make balance increment conditional on successful idempotent insert (or use upsert-first pattern).

### 10) Refund initiation and refund completion are atomic
- **Claim**: Refund initiation and completion are atomic.
- **Verdict**: **Partially correct**
- **Evidence classification**:
  - Confirmed runtime behavior: yes (completion tx)
  - Code exists but may not be reached: no
  - Behavior covered only by tests: partial
  - Behavior inferred from code: yes
  - Requires external Curlec confirmation: no
- **Repository evidence**:
  - `refund-service.ts`:
    - Initiation: Curlec API call occurs before DB transaction (`initiateInvestorDepositRefund`).
    - Completion: `completeInvestorDepositRefund` wraps reversal + status/event updates in transaction.
- **Corrected conclusion**:
  - Refund initiation is not end-to-end atomic with external API.
  - Refund completion is atomic within DB.
- **Risk**: Medium
- **Recommended next action**: Add recovery/reconciliation job for API-success / DB-failure split cases.

### 11) `settlement.processed` is implemented
- **Claim**: Settlement webhook event handling exists.
- **Verdict**: **Incorrect**
- **Evidence classification**:
  - Confirmed runtime behavior: yes (absence in runtime handlers)
  - Code exists but may not be reached: no
  - Behavior covered only by tests: no
  - Behavior inferred from code: yes
  - Requires external Curlec confirmation: no
- **Repository evidence**:
  - `webhook-service.ts` handles `refund.processed`, `refund.failed`, `payment.failed`, capture events.
  - Other events are acknowledged/marked processed without settlement logic.
  - `rg` over `apps/api/src` shows no `settlement.processed` handling.
- **Corrected conclusion**: Settlement webhook event is not implemented.
- **Risk**: Low/Medium (depends on whether daily recon is sufficient).
- **Recommended next action**: Optional: implement settlement webhook path if real-time settlement state is needed.

### 12) Settlement linking only happens during reconciliation
- **Claim**: Settlement metadata is linked only by recon job.
- **Verdict**: **Confirmed**
- **Evidence classification**:
  - Confirmed runtime behavior: yes
  - Code exists but may not be reached: no
  - Behavior covered only by tests: yes
  - Behavior inferred from code: yes
  - Requires external Curlec confirmation: no
- **Repository evidence**:
  - `gateway-settlement-recon.ts` writes `settlement_id`, `settled_at`, `gateway_fee_amount`.
  - Capture/refund handlers do not write these fields.
  - Recon integration test asserts stamping.
- **Corrected conclusion**: Gateway settlement linking is recon-only.
- **Risk**: Medium (capture and settlement are separate timelines).
- **Recommended next action**: Keep ops aware that `COMPLETED` does not imply settled.

### 13) Reconciliation date meaning
- **Claim**: Recon date corresponds to settlement report date (MYT day) not capture date.
- **Verdict**: **Confirmed**
- **Evidence classification**:
  - Confirmed runtime behavior: yes
  - Code exists but may not be reached: no
  - Behavior covered only by tests: partial
  - Behavior inferred from code: yes
  - Requires external Curlec confirmation: yes (provider date semantics details)
- **Repository evidence**:
  - `runGatewaySettlementReconJob()` derives MYT date parts and calls `fetchSettlementRecon(year, month, day)`.
  - Filters `settled === true` payment lines.
- **Corrected conclusion**: Code reconciles per selected MYT settlement-recon date.
- **Risk**: Medium if operators assume capture date.
- **Recommended next action**: Keep UI labels explicit (“settlement date”).

### 14) Reconciliation checks one date only / missed date recovery
- **Claim**: Recon checks one date per run; missed dates require manual action.
- **Verdict**: **Confirmed**
- **Evidence classification**:
  - Confirmed runtime behavior: yes
  - Code exists but may not be reached: no
  - Behavior covered only by tests: partial
  - Behavior inferred from code: yes
  - Requires external Curlec confirmation: no
- **Repository evidence**:
  - Job takes one `runDate` (or yesterday).
  - Cron always runs yesterday MYT.
  - Manual endpoint supports custom `runDate` (single date).
  - No range/backfill scheduler in code.
- **Corrected conclusion**: Recovery for missed dates is manual (run per date).
- **Risk**: Medium
- **Recommended next action**: Add backfill tool/range run support and ops playbook.

### 15) Daily reconciliation cron is initialized in production
- **Claim**: Daily recon cron is initialized on production boot path.
- **Verdict**: **Confirmed**
- **Evidence classification**:
  - Confirmed runtime behavior: yes
  - Code exists but may not be reached: no
  - Behavior covered only by tests: no
  - Behavior inferred from code: yes
  - Requires external Curlec confirmation: no
- **Repository evidence**:
  - `apps/api/src/index.ts`: calls `initJobs()` during startup.
  - `apps/api/src/lib/jobs/index.ts`: registers settlement cron (`0 18 * * *` UTC).
  - `infra/ecs-task-definition-api.json`: `NODE_ENV=production` in deployed task environment.
- **Corrected conclusion**: Production boot path initializes gateway cron jobs.
- **Risk**: Low/Medium (multi-instance considerations still apply).
- **Recommended next action**: Monitor job execution/lock metrics in production.

### 16) Rerunning reconciliation is safe
- **Claim**: Rerunning same date is safe.
- **Verdict**: **Partially correct**
- **Evidence classification**:
  - Confirmed runtime behavior: yes
  - Code exists but may not be reached: no
  - Behavior covered only by tests: yes
  - Behavior inferred from code: yes
  - Requires external Curlec confirmation: no
- **Repository evidence**:
  - Upsert by `run_date` allows rerun.
  - Test confirms same `runId` on rerun.
  - But job deletes all exceptions for run before rebuild.
- **Corrected conclusion**: Rerun is operationally safe for recomputation, but not safe for preserving exception history/resolution metadata.
- **Risk**: Medium
- **Recommended next action**: Preserve historical exceptions or snapshot old rows before rerun.

### 17) Exception deletion on rerun destroys useful audit history
- **Claim**: Rerun deletes prior exceptions and can lose useful history.
- **Verdict**: **Confirmed**
- **Evidence classification**:
  - Confirmed runtime behavior: yes
  - Code exists but may not be reached: no
  - Behavior covered only by tests: yes
  - Behavior inferred from code: yes
  - Requires external Curlec confirmation: no
- **Repository evidence**:
  - `gateway-settlement-recon.ts`: `deleteMany({ recon_run_id: run.id })` before reprocessing.
  - Exception resolution fields live on deleted rows (`resolved_at`, `resolved_by_user_id`, `resolve_reason`).
- **Corrected conclusion**: Reruns can erase prior exception-level audit trail.
- **Risk**: High for auditability/compliance.
- **Recommended next action**: Implement append-only exception history model or soft-close old exceptions.

### 18) Dev settlement simulator can run in production
- **Claim**: Dev simulator may be runnable in production contexts.
- **Verdict**: **Partially correct**
- **Evidence classification**:
  - Confirmed runtime behavior: yes (guard exists)
  - Code exists but may not be reached: yes (manual script)
  - Behavior covered only by tests: no
  - Behavior inferred from code: yes
  - Requires external Curlec confirmation: no
- **Repository evidence**:
  - `dev-simulate-gateway-settlement.ts` hard-stops if `NODE_ENV === "production"`.
  - Script remains in repo and can run against any DB if environment is mis-set.
- **Corrected conclusion**: Production guard exists, but operational misuse risk remains.
- **Risk**: Medium/High (if accidentally run against prod DB with non-production NODE_ENV).
- **Recommended next action**: Add explicit prod DB host guard and keep script out production runbooks.

### 19) Test and live credentials can be mixed
- **Claim**: Current code allows accidental test/live credential mixing.
- **Verdict**: **Confirmed**
- **Evidence classification**:
  - Confirmed runtime behavior: yes
  - Code exists but may not be reached: no
  - Behavior covered only by tests: no
  - Behavior inferred from code: yes
  - Requires external Curlec confirmation: no
- **Repository evidence**:
  - `curlec.ts` sets `environment` purely from `NODE_ENV`; does not validate key prefix.
  - No guard for `rzp_test_` keys in production or `rzp_live_` keys in dev.
  - No cross-check between key/secret/webhook secret mode.
- **Corrected conclusion**: Credential mode consistency is not enforced.
- **Risk**: Medium
- **Recommended next action**: Add startup validation for key prefix vs `NODE_ENV` and secret consistency checks.

### 20) Current implementation is safe for sandbox/UAT/production
- **Claim**: Overall safety by environment.
- **Verdict**: **Partially correct**
- **Evidence classification**:
  - Confirmed runtime behavior: yes
  - Code exists but may not be reached: yes (admin placeholders, simulator)
  - Behavior covered only by tests: partially
  - Behavior inferred from code: yes
  - Requires external Curlec confirmation: yes (payer name behavior)
- **Repository evidence**:
  - Core route/service/job/schema wiring is complete and reachable.
  - Key risks remain: EXPIRED retry bug, duplicate deposit order creation, recon history deletion, refund initiation split-atomicity, credential-mode mixing, payer-name external dependency.
- **Corrected conclusion**:
  - Safe for local/sandbox with controlled ops.
  - UAT safe with guardrails and monitored queue handling.
  - Production not yet safe without targeted hardening and operational controls.
- **Risk**: High for immediate production rollout.
- **Recommended next action**: Resolve critical blockers listed in readiness section below before production go-live.

---

## Route and reachability verification summary

- **Routes actually registered**:
  - Payment create/read/admin/recon routes are mounted in `apps/api/src/routes.ts`.
  - Curlec webhook route mounted in `apps/api/src/app/index.ts` before JSON parser.
- **Services actually called by reachable routes**:
  - Controllers directly invoke payment/recon services (`deposit-controller.ts`, `onboarding-fee-controller.ts`, `processing-fee-controller.ts`, `recon-controller.ts`).
  - Webhook controller invokes `ingestCurlecWebhook` then `processStoredCurlecWebhook`.
- **Cron initialization in production boot path**:
  - `apps/api/src/index.ts` calls `initJobs()`.
  - ECS task definition sets `NODE_ENV=production`.
- **Environment variables in deployed task definition**:
  - `CURLEC_KEY_ID`, `CURLEC_KEY_SECRET`, `CURLEC_WEBHOOK_SECRET`, `CURLEC_API_BASE_URL` present in `infra/ecs-task-definition-api.json`.
- **DB constraints in schema and migrations**:
  - `gateway_payments` unique constraints (`curlec_order_id`, `curlec_payment_id`, `idempotency_key`) in schema + migration.
  - `gateway_webhook_events.event_id` unique in schema + migration.
  - Recon tables and indexes present in migration `20260628164104...`.

---

## Test quality verification (stale vs current)

- **Aligned with current production code**:
  - Integration tests assert current enums including `NameCheckResult.REVIEW`.
  - Constraint integration tests validate active DB unique constraints.
  - Recon integration tests cover rerun replace behavior.
- **Limitations / mock-only behavior**:
  - Many tests mock Curlec responses (expected).
  - Payer-name availability in real Curlec environments is not proven by tests.
  - No explicit integration test for `order.paid` duplicate path with `payment.captured`.
- **Conclusion**:
  - Tests are not obviously stale versus current code shape, but some critical race/provider behaviors remain inference-only.

---

## Conflicts with first audit

1. **Multi-instance cron risk severity**  
   This review: gateway crons are guarded by advisory locks (`with-advisory-lock.ts`), reducing duplicate execution risk; still needs monitoring.

2. **EXPIRED handling severity**  
   This review adds that late capture after `EXPIRED` is skipped by terminal checks (`TERMINAL_GATEWAY_STATUSES`), not just “retry blocked.”

3. **Manual recon lock gap**  
   This review identifies manual trigger path has no advisory lock wrapper (`recon-service.ts`), unlike cron path.

4. **Wallet credit atomicity nuance**  
   This review flags `creditInvestorBalance` increment-before-idempotent-insert race edge, so “atomic” is only partially correct under concurrency.

5. **Test-topup guard reality**  
   This review confirms production block is `NODE_ENV`-based in notes module; not via `INVESTOR_BALANCE_TEST_TOPUP_ENABLED`.

---

## Missing findings (not highlighted enough in first audit)

1. **Late captured payment dropped after EXPIRED** due to terminal skip logic in webhook/sync paths.
2. **Manual recon path lacks advisory lock**, allowing potential overlap with cron/manual runs.
3. **Stuck-order poller processes max 100 rows per run**, potential backlog under heavy volume.
4. **`DISABLE_AUTH` dev bypass also affects payment create routes**, not only admin routes.
5. **`order.paid` duplicate path lacks dedicated integration coverage** despite runtime support.

---

## Production readiness conclusion

### Safe for local development
- **Yes, with caution**.
- Core flows are runnable and testable.
- Dev-only simulator and test-topup endpoint are present; teams must avoid misuse.

### Safe for sandbox testing
- **Mostly yes**.
- Suitable for validating route wiring, webhook signatures, state transitions, and admin actions.
- External Curlec payer-name behavior remains unproven from repo alone.

### Safe for UAT
- **Conditionally yes**.
- Requires runbook controls for:
  - EXPIRED retry handling
  - duplicate deposit prevention/monitoring
  - recon rerun history impact
  - HELD and NAME_CHECK_PENDING operational queues

### Safe for production
- **Not yet fully safe**.
- Must address before go-live:
  1. EXPIRED issuer fee retry + late capture handling
  2. duplicate investor order creation control
  3. recon exception-history preservation
  4. credential-mode validation (test/live mixing)
  5. provider confirmation of production payer-name availability
  6. add locking or coordination for manual recon trigger path

---

## Final note

This review used repository code/tests/deployment files for evidence and did not use existing audit docs as evidence for technical claims.
