-- AlterEnum
ALTER TYPE "GatewayPaymentPurpose" ADD VALUE IF NOT EXISTS 'FACILITY_FEE';

-- AlterTable
ALTER TABLE "platform_finance_settings"
ADD COLUMN "facility_fee_gateway_txn_max_amount" DECIMAL(18,6) NOT NULL DEFAULT 30000;

-- AlterTable
ALTER TABLE "gateway_payments" ADD COLUMN "contract_id" TEXT;

-- CreateIndex
CREATE INDEX "gateway_payments_contract_id_idx" ON "gateway_payments"("contract_id");

-- AddForeignKey
ALTER TABLE "gateway_payments"
ADD CONSTRAINT "gateway_payments_contract_id_fkey"
FOREIGN KEY ("contract_id") REFERENCES "contracts"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
