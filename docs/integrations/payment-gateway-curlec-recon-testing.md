
# Testing Gateway Settlement Reconciliation

How to verify the Curlec settlement reconciliation feature end to end, and how to remove the dev-only test tooling before production.

## Why the recon page shows 0 scanned

Reconciliation only looks at money Curlec has **settled** to your merchant bank account (via `GET /v1/settlements/recon/combined`), not captured orders. In Curlec/Razorpay **test mode** (`rzp_test_*` keys), payments are captured but **never settle**, so the recon report is always empty and every run reports `0 scanned`. This is expected, not a bug.

Even in live mode, settlement lands ~T+1–2 after payment, and a run only sees payments settled **on that run's date**.

## Option 2 — Local simulation (recommended for dev)

`apps/api/scripts/dev-simulate-gateway-settlement.ts` feeds canned "settled" recon lines — built from your real `COMPLETED` gateway payments — into the real reconciliation job. It exercises the full path (matching, stamping `settled_at` / `gateway_fee_amount`, and creating orphan / amount-mismatch exceptions) without live keys.

Prerequisites: at least one `COMPLETED` gateway payment with a `curlec_payment_id` (complete an FPX test deposit or fee first).

```bash
pnpm --filter @cashsouk/api dev-simulate-gateway-settlement
```

Then open **Admin → Finance → Reconciliation** to see the run with non-zero scanned/matched/stamped counts and two demo exceptions.

Optional env vars:

| Var | Default | Purpose |
|---|---|---|
| `SIM_RUN_DATE` | yesterday (MYT) | Recon run date label (`YYYY-MM-DD`) |
| `SIM_LIMIT` | `25` | Max real payments to mark settled |
| `SIM_FEE_SEN` | `100` | Fake gateway fee per payment (sen) |
| `SIM_INJECT_ORPHAN` | `true` | Add a settled payment with no internal row |
| `SIM_INJECT_MISMATCH` | `true` | Add a wrong-amount line for one real payment |

Notes:
- Refuses to run when `NODE_ENV=production`.
- Writes to whatever `DATABASE_URL` points at — only run against a dev database. It stamps real payment rows and upserts a `gateway_recon_runs` row for the run date.
- To clear a simulated run, delete the matching `gateway_recon_runs` row (its exceptions cascade).

## Option 3 — Real settlement (true end-to-end, pre go-live)

1. Switch `apps/api/.env` to the live keys (`CURLEC_KEY_ID=rzp_live_*`, matching secret).
2. Make one small real FPX payment.
3. Wait for Curlec to settle it (~T+1–2; confirm in the Curlec dashboard).
4. Run recon for the **settlement date**: on the admin page enter that date and click *Run now*, or let the daily 02:00 MYT cron run.
5. Confirm the payment is stamped and no exceptions are raised.

## Remove before production

The simulator is throwaway. Before go-live:

1. Delete `apps/api/scripts/dev-simulate-gateway-settlement.ts`.
2. Remove the `dev-simulate-gateway-settlement` script line from `apps/api/package.json`.
3. Delete this guide (`docs/integrations/payment-gateway-curlec-recon-testing.md`).
4. Delete any simulated `gateway_recon_runs` rows (e.g. `triggered_by = 'DEV_SIMULATOR'`) from non-prod databases so they aren't mistaken for real runs.

The `fetchReconItems` dependency-injection parameter on `runGatewaySettlementReconJob` (`apps/api/src/lib/jobs/gateway-settlement-recon.ts`) is **safe to keep** — it defaults to the real Curlec fetch and is used by the integration test. Leave it in place.
