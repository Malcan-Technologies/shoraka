-- Optional unique request identity for investor-portal withdrawals.
-- Issuer disbursement/residual rows remain null (Postgres unique allows multiple nulls).
-- payment_audit_logs and issuer withdrawal workflows are unchanged.

ALTER TABLE "withdrawal_instructions" ADD COLUMN "idempotency_key" TEXT;

CREATE UNIQUE INDEX "withdrawal_instructions_idempotency_key_key" ON "withdrawal_instructions"("idempotency_key");
