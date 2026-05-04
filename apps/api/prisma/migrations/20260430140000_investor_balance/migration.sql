-- CreateEnum
CREATE TYPE "InvestorBalanceTransactionDirection" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "InvestorBalanceTransactionSource" AS ENUM ('MANUAL_TOPUP', 'NOTE_INVESTMENT_COMMIT', 'NOTE_INVESTMENT_RELEASE');

-- CreateTable
CREATE TABLE "investor_balances" (
    "id" TEXT NOT NULL,
    "investor_organization_id" TEXT NOT NULL,
    "available_amount" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investor_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investor_balance_transactions" (
    "id" TEXT NOT NULL,
    "investor_organization_id" TEXT NOT NULL,
    "direction" "InvestorBalanceTransactionDirection" NOT NULL,
    "amount" DECIMAL(18,6) NOT NULL,
    "source" "InvestorBalanceTransactionSource" NOT NULL,
    "note_id" TEXT,
    "note_investment_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "investor_balance_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "investor_balances_investor_organization_id_key" ON "investor_balances"("investor_organization_id");

-- CreateIndex
CREATE INDEX "investor_balance_transactions_investor_organization_id_created_at_idx" ON "investor_balance_transactions"("investor_organization_id", "created_at");

-- AddForeignKey
ALTER TABLE "investor_balances" ADD CONSTRAINT "investor_balances_investor_organization_id_fkey" FOREIGN KEY ("investor_organization_id") REFERENCES "investor_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investor_balance_transactions" ADD CONSTRAINT "investor_balance_transactions_investor_organization_id_fkey" FOREIGN KEY ("investor_organization_id") REFERENCES "investor_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
