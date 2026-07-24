# Acceptance & signing deadline job

Hourly job (`runAcceptanceSigningExpiryJob`) that:

1. Sends configurable reminders (`days_before_expiry`) for live `OFFER_SENT` offers with `offer_acceptance`
2. Expires past `acceptance_expires_at` / `signing_expires_at` to durable **`OFFER_EXPIRED`** on the contract/invoice (keeps full `offer_details`) and sets application status to **`OFFER_EXPIRED`** so admin can filter and **Send Offer** again

Exact-time API gates (`assertAcceptanceDeadlineOpen` / `assertSigningDeadlineOpen`) block issuer actions as soon as the **active** clock passes; the job then persists the durable status. The acceptance clock is inactive during `PENDING_ADMIN_REVIEW` (paused while CashSouk reviews); it restarts with a fresh stamp when admin moves the phase to `CHANGES_REQUESTED`.

When the **signing** clock has passed, admin can **Extend signing deadline** from Acceptance → Signing package (`POST …/extend-signing-deadline`). That restamps `signing_expires_at` and, if the entity was durable `OFFER_EXPIRED`, restores `OFFER_SENT` without resetting acceptance docs. Full **Send Offer** remains available for a commercial reset.

Registered in `initJobs()` with advisory lock `ACCEPTANCE_SIGNING_EXPIRY`.

## Manual test

```bash
cd apps/api
pnpm seed-expired-acceptance-deadline-for-test [contractId|invoiceId] [acceptance|signing]
pnpm run-acceptance-signing-expiry
```

After the job: entity status is `OFFER_EXPIRED`, `offer_details` still present, timeline shows `CONTRACT_OFFER_EXPIRED` / `INVOICE_OFFER_EXPIRED`, issuer notification `offer_expired`.

See [Offer acceptance & signing phases](./application-flow/offer-acceptance-and-signing-phases.md).
