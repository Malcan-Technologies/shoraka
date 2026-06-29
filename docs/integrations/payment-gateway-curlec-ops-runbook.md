# Curlec Payment Gateway Ops Runbook

This runbook covers go-live checks and day-to-day handling for Curlec money-in payments. Curlec is used for FPX collections only: investor deposits, issuer onboarding fees, and application processing fees.

## Go-Live Checklist

- Curlec live merchant account is approved, FPX is enabled, and auto-capture is enabled.
- Curlec webhook points to `https://api.<domain>/v1/webhooks/curlec` and uses the same webhook secret configured for the API.
- Production API credentials are configured outside the repository: `CURLEC_KEY_ID`, `CURLEC_KEY_SECRET`, `CURLEC_WEBHOOK_SECRET`, and `CURLEC_API_BASE_URL`.
- Curlec confirms the production API base URL for the Malaysia account.
- Curlec confirms FPX per-transaction limits; admin finance settings reflect the accepted investor deposit maximum.
- Finance confirms the current MDR treatment: gateway fee amounts are tracked on gateway payments during reconciliation and are not posted to the note ledger yet.
- Ops confirms the held-deposit refund owner, checker, and expected turnaround time.
- Run one test-mode FPX pass for each path before live cutover: investor deposit success, investor deposit held/name-check path, issuer onboarding fee, and application processing fee.

## Held Investor Deposits

Investor deposits can enter a held state when the FPX payer name does not match the investor account name, the payer name is unavailable, or the captured amount does not match the internal order amount. Held deposits must not be credited until ops resolves them.

1. Open Admin -> Finance -> Held Deposits.
2. Review the payment detail: expected payer, FPX payer name, amount, bank, Curlec order, Curlec payment, and event trail.
3. For `NAME_CHECK_PENDING`, verify the payer name in Curlec or supporting evidence.
4. If the payer is verified as the investor, approve the name check. The system credits the wallet and posts the investor-pool ledger entry exactly once.
5. If the payer cannot be verified, initiate the refund in the Curlec dashboard.
6. Record the refund reference in Admin -> Finance -> Gateway Payments -> payment detail.
7. After Curlec confirms the refund is complete, mark the refund complete in the same detail page.

## Maker-Checker Override

Use override credit only when ops has strong evidence that a held deposit belongs to the investor despite the automated mismatch.

1. Maker opens the held payment detail and proposes an override with the evidence summary.
2. A different admin reviews the evidence and approves or rejects the override.
3. The system rejects self-approval. Approval credits the investor wallet and posts the investor-pool ledger entry exactly once.

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
