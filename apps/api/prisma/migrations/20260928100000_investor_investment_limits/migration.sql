-- Outstanding-principal investment limits by investor type.
-- Null means no cap. Existing DEFAULT row picks up the column defaults.

ALTER TABLE "platform_finance_settings"
ADD COLUMN "retail_investment_limit_amount" DECIMAL(18,6) DEFAULT 50000,
ADD COLUMN "angel_investment_limit_amount" DECIMAL(18,6) DEFAULT 500000,
ADD COLUMN "sophisticated_investment_limit_amount" DECIMAL(18,6);
