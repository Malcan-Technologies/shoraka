-- DropIndex
DROP INDEX "gateway_webhook_events_event_id_key";

-- CreateIndex
CREATE UNIQUE INDEX "gateway_webhook_events_gateway_account_event_id_key"
ON "gateway_webhook_events"("gateway_account", "event_id");

-- CreateIndex
CREATE INDEX "gateway_webhook_events_event_id_idx" ON "gateway_webhook_events"("event_id");
