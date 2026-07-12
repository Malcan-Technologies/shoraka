-- CreateEnum
CREATE TYPE "CurlecGatewayAccount" AS ENUM ('LEGACY_DEFAULT', 'OPERATING', 'INVESTOR_POOL');

-- AlterTable
ALTER TABLE "gateway_payments"
ADD COLUMN "gateway_account" "CurlecGatewayAccount" NOT NULL DEFAULT 'LEGACY_DEFAULT';

-- AlterTable
ALTER TABLE "gateway_webhook_events"
ADD COLUMN "gateway_account" "CurlecGatewayAccount" NOT NULL DEFAULT 'LEGACY_DEFAULT';

-- AlterTable
ALTER TABLE "gateway_recon_runs"
ADD COLUMN "gateway_account" "CurlecGatewayAccount" NOT NULL DEFAULT 'LEGACY_DEFAULT';

-- DropIndex
DROP INDEX "gateway_recon_runs_run_date_key";

-- CreateIndex
CREATE INDEX "gateway_payments_gateway_account_idx" ON "gateway_payments"("gateway_account");

-- CreateIndex
CREATE INDEX "gateway_webhook_events_gateway_account_idx" ON "gateway_webhook_events"("gateway_account");

-- CreateIndex
CREATE INDEX "gateway_recon_runs_gateway_account_idx" ON "gateway_recon_runs"("gateway_account");

-- CreateIndex
CREATE UNIQUE INDEX "gateway_recon_runs_run_date_gateway_account_key"
ON "gateway_recon_runs"("run_date", "gateway_account");
