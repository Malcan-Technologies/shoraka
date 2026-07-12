-- Stage 4: scope provider identifiers by gateway account.
-- This keeps provider IDs reusable across accounts while preserving
-- same-account uniqueness guarantees.

-- Drop global unique constraints.
DROP INDEX IF EXISTS "gateway_payments_curlec_order_id_key";
DROP INDEX IF EXISTS "gateway_payments_curlec_payment_id_key";

-- Add account-scoped unique constraints.
CREATE UNIQUE INDEX "gateway_payments_gateway_account_curlec_order_id_key"
ON "gateway_payments"("gateway_account", "curlec_order_id");

CREATE UNIQUE INDEX "gateway_payments_gateway_account_curlec_payment_id_key"
ON "gateway_payments"("gateway_account", "curlec_payment_id");

-- Keep raw provider-id lookup indexes for admin/search/mismatch checks.
CREATE INDEX IF NOT EXISTS "gateway_payments_curlec_order_id_idx"
ON "gateway_payments"("curlec_order_id");

CREATE INDEX IF NOT EXISTS "gateway_payments_curlec_payment_id_idx"
ON "gateway_payments"("curlec_payment_id");

-- Settlement references are account-scoped in matching paths.
CREATE INDEX IF NOT EXISTS "gateway_payments_gateway_account_settlement_id_idx"
ON "gateway_payments"("gateway_account", "settlement_id");
