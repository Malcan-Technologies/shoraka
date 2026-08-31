-- Forensic journal row for a gateway payment that reached COMPLETED (capture credited).
ALTER TYPE "GatewayPaymentEventType" ADD VALUE IF NOT EXISTS 'GATEWAY_PAYMENT_COMPLETED';
