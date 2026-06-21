-- AlterEnum
ALTER TYPE "InvestorBalanceTransactionSource" ADD VALUE 'INVESTOR_WITHDRAWAL_REQUEST';

-- AlterTable
ALTER TABLE "platform_finance_settings" ADD COLUMN     "ledger_bucket_accounts_config" JSONB,
ADD COLUMN     "platform_accounts_config" JSONB,
ADD COLUMN     "trustee_letter_config" JSONB;
