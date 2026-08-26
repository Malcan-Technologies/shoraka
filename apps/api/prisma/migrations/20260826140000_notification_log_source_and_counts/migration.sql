-- Expand notification_logs into admin + automated delivery history.
-- Existing rows stay source=ADMIN. Historical platform/email counts cannot be
-- reconstructed from old metadata, so they remain 0; only new sends store
-- accurate selected-channel counts.

CREATE TYPE "NotificationLogSource" AS ENUM ('ADMIN', 'SYSTEM');

ALTER TABLE "notification_logs"
  ALTER COLUMN "admin_user_id" DROP NOT NULL,
  ADD COLUMN "source" "NotificationLogSource" NOT NULL DEFAULT 'ADMIN',
  ADD COLUMN "delivered_platform_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "delivered_email_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "idempotency_key" TEXT;

CREATE INDEX "notification_logs_source_idx" ON "notification_logs"("source");
CREATE UNIQUE INDEX "notification_logs_idempotency_key_key" ON "notification_logs"("idempotency_key");
