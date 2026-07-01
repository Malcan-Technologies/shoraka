# Curlec Payment Gateway Ops Runbook

Day-to-day handling for Curlec money-in payments (FPX only): investor deposits, issuer onboarding fees, and application processing fees.

Related docs:

- Business overview (as built): `payment-gateway-curlec-plan-business-as-built.md`
- Initial business plan: `payment-gateway-curlec-plan-business.md`
- Technical reference (as built): `payment-gateway-curlec-plan-as-built.md`
- Initial technical plan: `payment-gateway-curlec-plan.md`
- Reconciliation testing (dev only): `payment-gateway-curlec-recon-testing.md`

## Go-Live Checklist

- Curlec live merchant account is approved, FPX is enabled, and auto-capture is enabled.
- Curlec webhook points to `https://api.<domain>/v1/webhooks/curlec` and uses the same webhook secret configured for the API.
- Production API credentials are configured outside the repository: `CURLEC_KEY_ID`, `CURLEC_KEY_SECRET`, `CURLEC_WEBHOOK_SECRET`, and `CURLEC_API_BASE_URL`.
- Curlec confirms the production API base URL for the Malaysia account.
- Curlec confirms FPX per-transaction limits; admin finance settings reflect the accepted investor deposit minimum and maximum under **Settings → Platform Finance → Gateway Fees**.
- Finance confirms the current MDR treatment: gateway fee amounts are tracked on gateway payments during reconciliation and are **not** posted to the note ledger yet.
- Ops confirms the held-deposit and name-check review owner, checker, and expected turnaround time.
- Confirm with Curlec that production FPX payments return the payer bank account name (used for AML name check).
- Run one test-mode FPX pass for each path before live cutover: investor deposit success, investor deposit name-mismatch refund, investor deposit name-review path, issuer onboarding fee, and application processing fee.
- Enable `refund.processed` and `refund.failed` webhook events in the Curlec dashboard.
- Remove dev-only recon simulator files before production (see `payment-gateway-curlec-recon-testing.md` §Remove before production).

## Investor Deposit Outcomes

The wallet is **never** credited unless the name check passes or an admin explicitly approves a `NAME_CHECK_PENDING` deposit.

| Outcome | Status flow | Wallet | Ops action |
|---|---|---|---|
| Name match | `COMPLETED` | Credited | None |
| Clear name mismatch | `REFUND_INITIATED` → `REFUNDED` | Never credited | None (auto-refund via Curlec API) |
| Captured amount ≠ order | `REFUND_INITIATED` → `REFUNDED` | Never credited | None (auto-refund) |
| Name unavailable or ambiguous (`REVIEW`) | `NAME_CHECK_PENDING` | Never credited | Admin approves (credit) or rejects (auto-refund) |
| Refund API / webhook failure | `HELD` | Never credited (or debited if post-credit refund) | **Retry auto-refund** on payment detail |

Normal auto-refund path: `REFUND_INITIATED` → `REFUNDED` via Curlec Refund API + webhooks.

### Name-check review queue (`NAME_CHECK_PENDING`)

When Curlec does not return a payer name, or the name is too ambiguous for automatic pass/fail, the deposit waits for manual review. The wallet is not credited until approved.

1. Open **Admin → Finance → Gateway Payments** → filter **Needs attention** (or filter by `NAME_CHECK_PENDING`).
2. Compare payer name in Curlec dashboard against the investor account name.
3. **Approve** → wallet credited, status `COMPLETED`.
4. **Reject** → auto-refund initiated, status `REFUND_INITIATED` → `REFUNDED`.

### Held deposits (`HELD`)

If the Curlec Refund API or `refund.failed` webhook fails after a failed name check or amount mismatch:

1. Open **Admin → Finance → Gateway Payments** → filter **Needs attention**.
2. Use **Retry auto-refund** on the payment detail page.

### Manual post-credit correction (rare)

For a mistakenly credited `COMPLETED` investor deposit, use **Initiate refund** on the gateway payment detail page. This debits the wallet and refunds via Curlec.

## Issuer Fees

Issuer onboarding and application processing fees have **no name check** and are **non-refundable** (including if onboarding or the application is later rejected). On successful capture they go straight to `COMPLETED` with an `OPERATING_ACCOUNT` ledger credit.

## Reconciliation

The gateway stuck-order poller runs every 15 minutes and the settlement reconciliation job runs daily at 02:00 MYT. Both use Postgres advisory locks so only one API instance executes each job.

**Important:** Reconciliation matches **settled** bank payouts (T+1–2 after capture), not captured orders. Curlec test mode (`rzp_test_*`) never settles, so recon will show 0 scanned until live keys and real settlements occur.

### Metrics (Admin → Finance → Reconciliation)

| Metric | Meaning |
|---|---|
| **Scanned** | Settled payment lines Curlec reported for the run date |
| **Matched** | Scanned lines with a matching internal `GatewayPayment` (by `curlec_payment_id`) |
| **Stamped** | Matched lines where amounts agree — `settled_at`, `settlement_id`, and `gateway_fee_amount` written |
| **Exceptions (latest run)** | Problems found in that run (orphans + amount mismatches) |
| **Open exceptions** | Unresolved items across all runs — the ops work queue |

Relationship: `Scanned ≥ Matched ≥ Stamped`. A payment can be **matched** but still be an **exception** if amounts differ. **Resolve** on the platform closes the ops ticket only — it does not fix payments or move money.

### Daily ops workflow

1. Open **Admin → Finance → Reconciliation** daily.
2. Review the latest run: scanned, matched, stamped, exceptions.
3. Triage any **open exceptions**:
   - **`ORPHAN_CURLEC_PAYMENT`** — Curlec settled a payment with no internal record. Compare Curlec dashboard vs Gateway Payments; escalate to engineering if no internal order exists.
   - **`AMOUNT_MISMATCH`** — Same payment ID, different amount. Do **not** manually credit wallets or mark fees paid. Investigate Curlec order, internal payment, and customer journey.
4. **Resolve** each exception with a clear reason after finance/ops confirms the outcome (e.g. *"Verified Curlec test payment, no internal order"*).

### Dev testing

Use `pnpm --filter @cashsouk/api dev-simulate-gateway-settlement` to exercise recon locally without live settlements. See `payment-gateway-curlec-recon-testing.md`.

## Admin Screens

| Screen | Path | Purpose |
|---|---|---|
| Gateway Payments | Admin → Finance → Gateway Payments | All payments, status, events, name-check actions, refunds |
| Reconciliation | Admin → Finance → Reconciliation | Daily runs, exceptions, manual trigger |
| Gateway Fees | Admin → Settings → Platform Finance | Min/max deposit, onboarding fee, processing fee |

## Manual Escalation

Escalate to engineering when:

- A webhook repeatedly fails signature verification after the webhook secret has been checked.
- A payment remains `CREATED` after Curlec shows it captured and the stuck-order poller has already run.
- A gateway payment is stuck in `PAID`.
- Reconciliation reports repeated amount mismatches or orphan Curlec payments.
- Admin actions return an unexpected transition error for a valid held/refund workflow.
