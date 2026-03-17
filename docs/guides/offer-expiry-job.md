# Offer Expiry Job

The offer expiry cron job automatically withdraws contract and invoice offers that have exceeded their `offer_details.expires_at` date. Withdrawals use `WithdrawReason.OFFER_EXPIRED`.

## Schedule

Runs every hour (`0 * * * *`).

## Behaviour

1. **Expired contracts** (status `OFFER_SENT`, `offer_details.expires_at` < now): Withdrawn, linked applications set to `WITHDRAWN`.
2. **Expired invoices** (status `OFFER_SENT`, `offer_details.expires_at` < now): Withdrawn. Application status recomputed (e.g. all invoices withdrawn → application `WITHDRAWN`).

Activity is logged as **System** (user `SYS`) with `triggered_by: "offer_expiry_cron"` in metadata. The System user is created by the seed and ensured by the job on first run.

## Testing

### Manual run

```bash
cd apps/api
pnpm run-offer-expiry
```

### Create test data (expired offer)

1. Create an application and send contract or invoice offers via the admin UI.
2. Backdate the offer so it is expired:

   ```bash
   pnpm seed-expired-offer-for-test [contractId | invoiceId]
   ```
   Or without args to backdate the first `OFFER_SENT` contract or invoice found.

3. Run the expiry job:

   ```bash
   pnpm run-offer-expiry
   ```

4. Verify: Contract/invoice status is `WITHDRAWN` with `withdraw_reason: OFFER_EXPIRED`.

## Files

| Purpose | File |
|---------|------|
| Job logic | `apps/api/src/lib/jobs/offer-expiry.ts` |
| Cron registration | `apps/api/src/lib/jobs/index.ts` |
| Manual run script | `apps/api/scripts/run-offer-expiry.ts` |
| Test data helper | `apps/api/scripts/seed-expired-offer-for-test.ts` |
