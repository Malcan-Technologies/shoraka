-- Fix 3: durable Curlec order-create attempt checkpoint.
CREATE TYPE "GatewayOrderAttemptStatus" AS ENUM ('PENDING', 'REMOTE_CREATED', 'RESOLVED', 'FAILED');

CREATE TABLE "gateway_order_attempts" (
    "id" TEXT NOT NULL,
    "gateway_account" "CurlecGatewayAccount" NOT NULL DEFAULT 'LEGACY_DEFAULT',
    "purpose" "GatewayPaymentPurpose" NOT NULL,
    "scope_key" TEXT NOT NULL,
    "idempotency_key" TEXT,
    "receipt" TEXT NOT NULL,
    "curlec_order_id" TEXT,
    "amount" DECIMAL(18,6) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MYR',
    "status" "GatewayOrderAttemptStatus" NOT NULL DEFAULT 'PENDING',
    "last_error_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gateway_order_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "gateway_order_attempts_gateway_account_purpose_scope_key_key"
ON "gateway_order_attempts"("gateway_account", "purpose", "scope_key");

CREATE INDEX "gateway_order_attempts_gateway_account_curlec_order_id_idx"
ON "gateway_order_attempts"("gateway_account", "curlec_order_id");

CREATE INDEX "gateway_order_attempts_status_created_at_idx"
ON "gateway_order_attempts"("status", "created_at");

-- Fix 1 + Fix 2 audit event types.
ALTER TYPE "GatewayPaymentEventType" ADD VALUE IF NOT EXISTS 'CAPTURE_MISMATCH';
ALTER TYPE "GatewayPaymentEventType" ADD VALUE IF NOT EXISTS 'REFUND_WALLET_REVERSAL_FAILED';
