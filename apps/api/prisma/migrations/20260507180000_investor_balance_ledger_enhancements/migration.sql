ALTER TABLE "investor_balance_transactions"
ADD COLUMN "idempotency_key" TEXT,
ADD COLUMN "posted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "investor_balance_transactions"
SET "idempotency_key" = CONCAT('legacy-investor-balance-tx:', "id")
WHERE "idempotency_key" IS NULL;

ALTER TABLE "investor_balance_transactions"
ALTER COLUMN "idempotency_key" SET NOT NULL;

CREATE UNIQUE INDEX "investor_balance_transactions_idempotency_key_key"
ON "investor_balance_transactions"("idempotency_key");

DROP INDEX IF EXISTS "investor_balance_transactions_investor_organization_id_created_at_idx";

CREATE INDEX "investor_balance_transactions_investor_organization_id_posted_at_idx"
ON "investor_balance_transactions"("investor_organization_id", "posted_at");
