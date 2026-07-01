-- CreateEnum
CREATE TYPE "GatewayReconRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "GatewayReconExceptionType" AS ENUM ('ORPHAN_CURLEC_PAYMENT', 'AMOUNT_MISMATCH');

-- AlterEnum
ALTER TYPE "GatewayPaymentEventType" ADD VALUE 'EXPIRED';

-- CreateTable
CREATE TABLE "gateway_recon_runs" (
    "id" TEXT NOT NULL,
    "run_date" DATE NOT NULL,
    "status" "GatewayReconRunStatus" NOT NULL DEFAULT 'RUNNING',
    "triggered_by" TEXT NOT NULL,
    "settlements_scanned" INTEGER NOT NULL DEFAULT 0,
    "payments_matched" INTEGER NOT NULL DEFAULT 0,
    "payments_stamped" INTEGER NOT NULL DEFAULT 0,
    "exceptions_count" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gateway_recon_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gateway_recon_exceptions" (
    "id" TEXT NOT NULL,
    "recon_run_id" TEXT NOT NULL,
    "type" "GatewayReconExceptionType" NOT NULL,
    "gateway_payment_id" TEXT,
    "curlec_payment_id" TEXT,
    "curlec_settlement_id" TEXT,
    "expected_amount" DECIMAL(18,6),
    "actual_amount" DECIMAL(18,6),
    "detail" TEXT,
    "resolved_at" TIMESTAMP(3),
    "resolved_by_user_id" TEXT,
    "resolve_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gateway_recon_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gateway_recon_runs_run_date_key" ON "gateway_recon_runs"("run_date");

-- CreateIndex
CREATE INDEX "gateway_recon_exceptions_recon_run_id_idx" ON "gateway_recon_exceptions"("recon_run_id");

-- CreateIndex
CREATE INDEX "gateway_recon_exceptions_type_resolved_at_idx" ON "gateway_recon_exceptions"("type", "resolved_at");

-- AddForeignKey
ALTER TABLE "gateway_recon_exceptions" ADD CONSTRAINT "gateway_recon_exceptions_recon_run_id_fkey" FOREIGN KEY ("recon_run_id") REFERENCES "gateway_recon_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gateway_recon_exceptions" ADD CONSTRAINT "gateway_recon_exceptions_gateway_payment_id_fkey" FOREIGN KEY ("gateway_payment_id") REFERENCES "gateway_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
