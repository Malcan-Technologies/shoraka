ALTER TABLE "note_settlements"
ADD COLUMN "profit_start_date" TIMESTAMP(3),
ADD COLUMN "profit_maturity_date" TIMESTAMP(3),
ADD COLUMN "profit_days" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "annual_profit_rate_percent" DECIMAL(9, 6) NOT NULL DEFAULT 0,
ADD COLUMN "tawidh_investor_share_percent" DECIMAL(9, 6) NOT NULL DEFAULT 0,
ADD COLUMN "tawidh_investor_amount" DECIMAL(18, 6) NOT NULL DEFAULT 0,
ADD COLUMN "tawidh_account_amount" DECIMAL(18, 6) NOT NULL DEFAULT 0;

UPDATE "note_settlements"
SET "tawidh_account_amount" = "tawidh_amount"
WHERE "tawidh_account_amount" = 0
  AND "tawidh_amount" > 0;
