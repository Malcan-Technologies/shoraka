DROP TABLE IF EXISTS "paymaster_mismatches";

DROP INDEX IF EXISTS "paymasters_mismatch_pending_idx";

ALTER TABLE "paymasters" DROP COLUMN IF EXISTS "mismatch_pending";

DROP TYPE IF EXISTS "PaymasterMismatchStatus";
