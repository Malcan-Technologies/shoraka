-- CreateTable
CREATE TABLE "application_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "application_id" TEXT,
    "event_type" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "device_info" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "application_logs_user_id_idx" ON "application_logs"("user_id");

-- CreateIndex
CREATE INDEX "application_logs_event_type_idx" ON "application_logs"("event_type");

-- CreateIndex
CREATE INDEX "application_logs_created_at_idx" ON "application_logs"("created_at");

-- CreateIndex
CREATE INDEX "application_logs_user_id_created_at_idx" ON "application_logs"("user_id", "created_at");
