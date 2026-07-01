# Curlec Payment Gateway Ops Runbook

This runbook covers go-live checks and day-to-day handling for Curlec money-in payments. Curlec is used for FPX collections only: investor deposits, issuer onboarding fees, and application processing fees.

## Go-Live Checklist

- Curlec live merchant account is approved, FPX is enabled, and auto-capture is enabled.
- Curlec webhook points to `https://api.<domain>/v1/webhooks/curlec` and uses the same webhook secret configured for the API.
- Production API credentials are configured outside the repository: `CURLEC_KEY_ID`, `CURLEC_KEY_SECRET`, `CURLEC_WEBHOOK_SECRET`, and `CURLEC_API_BASE_URL`.
- Curlec confirms the production API base URL for the Malaysia account.
- Curlec confirms FPX per-transaction limits; admin finance settings reflect the accepted investor deposit minimum and maximum under Settings -> Platform Finance -> Gateway Fees.
- Finance confirms the current MDR treatment: gateway fee amounts are tracked on gateway payments during reconciliation and are not posted to the note ledger yet.
- Ops confirms the held-deposit refund owner, checker, and expected turnaround time.
- Run one test-mode FPX pass for each path before live cutover: investor deposit success, investor deposit auto-refund path, issuer onboarding fee, and application processing fee.
- Enable `refund.processed` and `refund.failed` webhook events in the Curlec dashboard.

## Held Investor Deposits

Investor deposits are **auto-refunded** when the FPX payer name does not match, is unavailable, or the captured amount differs from the order. The wallet is never credited in those cases.

Normal outcomes:
- Name match → `COMPLETED` (wallet credited)
- Name mismatch / unavailable / amount mismatch → `REFUND_INITIATED` → `REFUNDED` via Curlec Refund API + webhooks

Exception path only:
- If the Curlec Refund API or `refund.failed` webhook fails, the payment moves to `HELD`.
- Open Admin → Finance → Gateway Payments → filter **Needs attention**.
- Use **Retry auto-refund** on the payment detail page.

Manual post-credit correction (rare):
- For a mistakenly credited `COMPLETED` investor deposit, use **Initiate refund** on the gateway payment detail page.

## Reconciliation

The gateway stuck-order poller runs every 15 minutes and the settlement reconciliation job runs daily. Both use Postgres advisory locks so only one API instance executes each job.

1. Open Admin -> Finance -> Reconciliation daily.
2. Review the latest run status, scanned payments, stamped settlements, and open exceptions.
3. For `ORPHAN_CURLEC_PAYMENT`, compare the Curlec payment with Gateway Payments by order/payment ID and escalate if no internal order exists.
4. For `AMOUNT_MISMATCH`, do not manually credit or mark fees paid. Investigate the Curlec order, internal gateway payment, and customer journey before resolving.
5. Resolve exceptions only with a clear reason after finance/ops confirms the outcome.

## Manual Escalation

Escalate to engineering when:

- A webhook repeatedly fails signature verification after the webhook secret has been checked.
- A payment remains `CREATED` after Curlec shows it captured and the stuck-order poller has already run.
- A gateway payment is stuck in `PAID`.
- Reconciliation reports repeated amount mismatches or orphan Curlec payments.
- Admin actions return an unexpected transition error for a valid held/refund workflow.
