-- CreateEnum
CREATE TYPE "GatewayPaymentPurpose" AS ENUM ('INVESTOR_DEPOSIT', 'ISSUER_ONBOARDING_FEE', 'APPLICATION_PROCESSING_FEE');

-- CreateEnum
CREATE TYPE "GatewayOrganizationType" AS ENUM ('INVESTOR', 'ISSUER');

-- CreateEnum
CREATE TYPE "GatewayPaymentStatus" AS ENUM ('CREATED', 'PAID', 'NAME_CHECK_PENDING', 'COMPLETED', 'HELD', 'REFUND_INITIATED', 'REFUNDED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "NameCheckResult" AS ENUM ('PASS', 'FAIL', 'NAME_UNAVAILABLE');

-- AlterEnum
ALTER TYPE "InvestorBalanceTransactionSource" ADD VALUE 'GATEWAY_DEPOSIT';

-- AlterTable
ALTER TABLE "issuer_organizations" ADD COLUMN     "onboarding_fee_paid_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "note_ledger_entries" ADD COLUMN     "gateway_payment_id" TEXT;

-- AlterTable
ALTER TABLE "platform_finance_settings" ADD COLUMN     "application_processing_fee_amount" DECIMAL(18,6) NOT NULL DEFAULT 50,
ADD COLUMN     "investor_max_deposit_amount" DECIMAL(18,6) NOT NULL DEFAULT 30000,
ADD COLUMN     "investor_min_deposit_amount" DECIMAL(18,6) NOT NULL DEFAULT 100,
ADD COLUMN     "issuer_onboarding_fee_amount" DECIMAL(18,6) NOT NULL DEFAULT 150;

-- CreateTable
CREATE TABLE "gateway_payments" (
    "id" TEXT NOT NULL,
    "purpose" "GatewayPaymentPurpose" NOT NULL,
    "organization_type" "GatewayOrganizationType" NOT NULL,
    "investor_organization_id" TEXT,
    "issuer_organization_id" TEXT,
    "application_id" TEXT,
    "amount" DECIMAL(18,6) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MYR',
    "status" "GatewayPaymentStatus" NOT NULL DEFAULT 'CREATED',
    "curlec_order_id" TEXT NOT NULL,
    "curlec_payment_id" TEXT,
    "method" TEXT,
    "bank_code" TEXT,
    "payer_name" TEXT,
    "name_check_result" "NameCheckResult",
    "name_check_at" TIMESTAMP(3),
    "name_checked_by_user_id" TEXT,
    "refund_reference" TEXT,
    "refund_initiated_by" TEXT,
    "refunded_at" TIMESTAMP(3),
    "refund_notes" TEXT,
    "settlement_id" TEXT,
    "settled_at" TIMESTAMP(3),
    "gateway_fee_amount" DECIMAL(18,6),
    "idempotency_key" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gateway_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gateway_webhook_events" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "signature_valid" BOOLEAN NOT NULL,
    "processed_at" TIMESTAMP(3),
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gateway_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gateway_payments_curlec_order_id_key" ON "gateway_payments"("curlec_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "gateway_payments_curlec_payment_id_key" ON "gateway_payments"("curlec_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "gateway_payments_idempotency_key_key" ON "gateway_payments"("idempotency_key");

-- CreateIndex
CREATE INDEX "gateway_payments_status_created_at_idx" ON "gateway_payments"("status", "created_at");

-- CreateIndex
CREATE INDEX "gateway_payments_purpose_idx" ON "gateway_payments"("purpose");

-- CreateIndex
CREATE INDEX "gateway_payments_investor_organization_id_idx" ON "gateway_payments"("investor_organization_id");

-- CreateIndex
CREATE INDEX "gateway_payments_issuer_organization_id_idx" ON "gateway_payments"("issuer_organization_id");

-- CreateIndex
CREATE INDEX "gateway_payments_application_id_idx" ON "gateway_payments"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "gateway_webhook_events_event_id_key" ON "gateway_webhook_events"("event_id");

-- CreateIndex
CREATE INDEX "note_ledger_entries_gateway_payment_id_idx" ON "note_ledger_entries"("gateway_payment_id");

-- AddForeignKey
ALTER TABLE "gateway_payments" ADD CONSTRAINT "gateway_payments_investor_organization_id_fkey" FOREIGN KEY ("investor_organization_id") REFERENCES "investor_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gateway_payments" ADD CONSTRAINT "gateway_payments_issuer_organization_id_fkey" FOREIGN KEY ("issuer_organization_id") REFERENCES "issuer_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gateway_payments" ADD CONSTRAINT "gateway_payments_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
