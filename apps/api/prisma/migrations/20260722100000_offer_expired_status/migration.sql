-- Durable offer expiry status (replaces retract-like SUBMITTED reset).
ALTER TYPE "ReviewStepStatus" ADD VALUE IF NOT EXISTS 'OFFER_EXPIRED';
ALTER TYPE "ContractStatus" ADD VALUE IF NOT EXISTS 'OFFER_EXPIRED';
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'OFFER_EXPIRED';

-- Remove unused WithdrawReason.OFFER_EXPIRED (expiry is entity status, not withdrawal).
CREATE TYPE "WithdrawReason_new" AS ENUM ('USER_CANCELLED', 'OFFER_REJECTED');

ALTER TABLE "contracts"
  ALTER COLUMN "withdraw_reason" DROP DEFAULT,
  ALTER COLUMN "withdraw_reason" TYPE "WithdrawReason_new"
  USING (
    CASE
      WHEN "withdraw_reason"::text = 'OFFER_EXPIRED' THEN NULL
      ELSE "withdraw_reason"::text::"WithdrawReason_new"
    END
  );

ALTER TABLE "invoices"
  ALTER COLUMN "withdraw_reason" DROP DEFAULT,
  ALTER COLUMN "withdraw_reason" TYPE "WithdrawReason_new"
  USING (
    CASE
      WHEN "withdraw_reason"::text = 'OFFER_EXPIRED' THEN NULL
      ELSE "withdraw_reason"::text::"WithdrawReason_new"
    END
  );

DROP TYPE "WithdrawReason";
ALTER TYPE "WithdrawReason_new" RENAME TO "WithdrawReason";
