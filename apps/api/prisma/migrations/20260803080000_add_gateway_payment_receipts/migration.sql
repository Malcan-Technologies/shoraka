-- CreateEnum
CREATE TYPE "GatewayPaymentReceiptStatus" AS ENUM ('PENDING', 'GENERATED', 'FAILED', 'REFUNDED');

-- CreateTable
CREATE TABLE "gateway_payment_receipts" (
    "id" TEXT NOT NULL,
    "receipt_number" TEXT NOT NULL,
    "gateway_payment_id" TEXT NOT NULL,
    "payment_purpose" "GatewayPaymentPurpose" NOT NULL,
    "purpose_label" TEXT NOT NULL,
    "payer_name" TEXT,
    "payer_company_name" TEXT,
    "payer_email" TEXT,
    "payer_phone" TEXT,
    "amount" DECIMAL(18,6) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MYR',
    "payment_method" TEXT,
    "payment_date" TIMESTAMP(3) NOT NULL,
    "curlec_payment_id" TEXT,
    "curlec_order_id" TEXT NOT NULL,
    "related_entity_type" TEXT NOT NULL,
    "related_entity_id" TEXT NOT NULL,
    "related_reference" TEXT NOT NULL,
    "wallet_credited" BOOLEAN NOT NULL DEFAULT false,
    "pdf_s3_key" TEXT,
    "status" "GatewayPaymentReceiptStatus" NOT NULL DEFAULT 'PENDING',
    "generation_error" TEXT,
    "generated_at" TIMESTAMP(3),
    "refund_reference" TEXT,
    "refund_amount" DECIMAL(18,6),
    "refunded_at" TIMESTAMP(3),
    "merchant_snapshot" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gateway_payment_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipt_daily_counters" (
    "date_key" TEXT NOT NULL,
    "last_value" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receipt_daily_counters_pkey" PRIMARY KEY ("date_key")
);

-- CreateIndex
CREATE UNIQUE INDEX "gateway_payment_receipts_receipt_number_key" ON "gateway_payment_receipts"("receipt_number");

-- CreateIndex
CREATE UNIQUE INDEX "gateway_payment_receipts_gateway_payment_id_key" ON "gateway_payment_receipts"("gateway_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "gateway_payment_receipts_curlec_payment_id_key" ON "gateway_payment_receipts"("curlec_payment_id");

-- CreateIndex
CREATE INDEX "gateway_payment_receipts_payment_purpose_idx" ON "gateway_payment_receipts"("payment_purpose");

-- CreateIndex
CREATE INDEX "gateway_payment_receipts_status_idx" ON "gateway_payment_receipts"("status");

-- CreateIndex
CREATE INDEX "gateway_payment_receipts_payment_date_idx" ON "gateway_payment_receipts"("payment_date");

-- CreateIndex
CREATE INDEX "gateway_payment_receipts_payer_name_idx" ON "gateway_payment_receipts"("payer_name");

-- CreateIndex
CREATE INDEX "gateway_payment_receipts_payer_company_name_idx" ON "gateway_payment_receipts"("payer_company_name");

-- CreateIndex
CREATE INDEX "gateway_payment_receipts_related_entity_type_related_entity_idx" ON "gateway_payment_receipts"("related_entity_type", "related_entity_id");

-- AddForeignKey
ALTER TABLE "gateway_payment_receipts" ADD CONSTRAINT "gateway_payment_receipts_gateway_payment_id_fkey" FOREIGN KEY ("gateway_payment_id") REFERENCES "gateway_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
