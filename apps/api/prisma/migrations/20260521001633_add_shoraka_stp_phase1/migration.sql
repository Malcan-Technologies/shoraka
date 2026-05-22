-- CreateEnum
CREATE TYPE "ShorakaTradeOrderStatus" AS ENUM ('PENDING_SUBMISSION', 'SUBMITTED', 'STATUS_FETCHED', 'CERTIFICATE_READY', 'FAILED');

-- CreateTable
CREATE TABLE "shoraka_trade_orders" (
    "id" TEXT NOT NULL,
    "withdrawal_instruction_id" TEXT NOT NULL,
    "note_id" TEXT NOT NULL,
    "provider_order_id" TEXT,
    "status" "ShorakaTradeOrderStatus" NOT NULL DEFAULT 'PENDING_SUBMISSION',
    "idempotency_key" TEXT NOT NULL,
    "submit_request_payload" JSONB,
    "submit_response_payload" JSONB,
    "status_response_payload" JSONB,
    "submitted_at" TIMESTAMP(3),
    "status_last_checked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shoraka_trade_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shoraka_certificates" (
    "id" TEXT NOT NULL,
    "shoraka_trade_order_id" TEXT NOT NULL,
    "certificate_s3_key" TEXT NOT NULL,
    "certificate_file_sha256" TEXT,
    "provider_certificate_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shoraka_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shoraka_trade_orders_withdrawal_instruction_id_key" ON "shoraka_trade_orders"("withdrawal_instruction_id");

-- CreateIndex
CREATE UNIQUE INDEX "shoraka_trade_orders_provider_order_id_key" ON "shoraka_trade_orders"("provider_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "shoraka_trade_orders_idempotency_key_key" ON "shoraka_trade_orders"("idempotency_key");

-- CreateIndex
CREATE INDEX "shoraka_trade_orders_note_id_idx" ON "shoraka_trade_orders"("note_id");

-- CreateIndex
CREATE UNIQUE INDEX "shoraka_certificates_shoraka_trade_order_id_key" ON "shoraka_certificates"("shoraka_trade_order_id");

-- CreateIndex
CREATE INDEX "shoraka_certificates_certificate_s3_key_idx" ON "shoraka_certificates"("certificate_s3_key");

-- AddForeignKey
ALTER TABLE "shoraka_trade_orders" ADD CONSTRAINT "shoraka_trade_orders_withdrawal_instruction_id_fkey" FOREIGN KEY ("withdrawal_instruction_id") REFERENCES "withdrawal_instructions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shoraka_certificates" ADD CONSTRAINT "shoraka_certificates_shoraka_trade_order_id_fkey" FOREIGN KEY ("shoraka_trade_order_id") REFERENCES "shoraka_trade_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
