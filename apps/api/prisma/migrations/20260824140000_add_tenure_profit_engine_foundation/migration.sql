-- AlterEnum
ALTER TYPE "GatewayPaymentPurpose" ADD VALUE IF NOT EXISTS 'EXCESS_LATE_CHARGES';

-- AlterTable
ALTER TABLE "notes"
ADD COLUMN "tenure_days" INTEGER,
ADD COLUMN "disbursement_value_date" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "note_settlements"
ADD COLUMN "excess_late_charge_amount" DECIMAL(18,6) NOT NULL DEFAULT 0,
ADD COLUMN "excess_late_charge_paid_amount" DECIMAL(18,6) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "gateway_payments" ADD COLUMN "note_id" TEXT;

-- CreateIndex
CREATE INDEX "gateway_payments_note_id_idx" ON "gateway_payments"("note_id");

-- AddForeignKey
ALTER TABLE "gateway_payments"
ADD CONSTRAINT "gateway_payments_note_id_fkey"
FOREIGN KEY ("note_id") REFERENCES "notes"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
