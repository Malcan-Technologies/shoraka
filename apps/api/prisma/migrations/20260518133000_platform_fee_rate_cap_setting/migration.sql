ALTER TABLE "platform_finance_settings"
ADD COLUMN "platform_fee_rate_cap_percent" NUMERIC(5,2) NOT NULL DEFAULT 3;
