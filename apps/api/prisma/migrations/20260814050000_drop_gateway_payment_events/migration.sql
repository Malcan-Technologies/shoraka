-- Drop leftover GatewayPaymentEvent after PaymentAuditLog cutover.
-- payment_audit_logs, gateway_webhook_events, gateway_order_attempts,
-- gateway_payments, receipts, recon, and balance tables are unchanged.

DROP TABLE "gateway_payment_events";

DROP TYPE "GatewayPaymentEventType";
