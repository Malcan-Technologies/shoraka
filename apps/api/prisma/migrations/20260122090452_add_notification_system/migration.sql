-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('AUTHENTICATION', 'SYSTEM', 'MARKETING');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateTable
CREATE TABLE "notification_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "NotificationCategory" NOT NULL,
    "default_priority" "NotificationPriority" NOT NULL DEFAULT 'INFO',
    "enabled_platform" BOOLEAN NOT NULL DEFAULT true,
    "enabled_email" BOOLEAN NOT NULL DEFAULT true,
    "user_configurable" BOOLEAN NOT NULL DEFAULT true,
    "retention_days" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "notification_type_id" TEXT NOT NULL,
    "idempotency_key" TEXT,
    "priority" "NotificationPriority" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read_at" TIMESTAMP(3),
    "email_sent_at" TIMESTAMP(3),
    "link_path" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_notification_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "notification_type_id" TEXT NOT NULL,
    "enabled_platform" BOOLEAN NOT NULL,
    "enabled_email" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notifications_idempotency_key_key" ON "notifications"("idempotency_key");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE INDEX "notifications_notification_type_id_idx" ON "notifications"("notification_type_id");

-- CreateIndex
CREATE INDEX "notifications_expires_at_idx" ON "notifications"("expires_at");

-- CreateIndex
CREATE INDEX "notifications_idempotency_key_idx" ON "notifications"("idempotency_key");

-- CreateIndex
CREATE INDEX "user_notification_preferences_user_id_idx" ON "user_notification_preferences"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_notification_preferences_user_id_notification_type_id_key" ON "user_notification_preferences"("user_id", "notification_type_id");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_notification_type_id_fkey" FOREIGN KEY ("notification_type_id") REFERENCES "notification_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_notification_preferences" ADD CONSTRAINT "user_notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_notification_preferences" ADD CONSTRAINT "user_notification_preferences_notification_type_id_fkey" FOREIGN KEY ("notification_type_id") REFERENCES "notification_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
