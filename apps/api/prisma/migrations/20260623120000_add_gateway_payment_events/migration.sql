-- CreateEnum
CREATE TYPE "GatewayPaymentEventType" AS ENUM (
  'NAME_CHECK',
  'NAME_CHECK_APPROVED',
  'NAME_CHECK_REJECTED',
  'OVERRIDE_PROPOSED',
  'OVERRIDE_APPROVED',
  'OVERRIDE_REJECTED',
  'REFUND_INITIATED',
  'REFUNDED'
);

-- CreateTable
CREATE TABLE "gateway_payment_events" (
    "id" TEXT NOT NULL,
    "gateway_payment_id" TEXT NOT NULL,
    "type" "GatewayPaymentEventType" NOT NULL,
    "actor_user_id" TEXT,
    "from_status" "GatewayPaymentStatus",
    "to_status" "GatewayPaymentStatus",
    "reason" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gateway_payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gateway_payment_events_gateway_payment_id_created_at_idx" ON "gateway_payment_events"("gateway_payment_id", "created_at");

-- AddForeignKey
ALTER TABLE "gateway_payment_events" ADD CONSTRAINT "gateway_payment_events_gateway_payment_id_fkey" FOREIGN KEY ("gateway_payment_id") REFERENCES "gateway_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
