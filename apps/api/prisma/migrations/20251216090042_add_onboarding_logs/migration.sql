-- CreateTable
CREATE TABLE "onboarding_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "event_type" TEXT NOT NULL,
    "portal" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "device_info" TEXT,
    "device_type" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onboarding_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "onboarding_logs_user_id_idx" ON "onboarding_logs"("user_id");

-- CreateIndex
CREATE INDEX "onboarding_logs_role_idx" ON "onboarding_logs"("role");

-- CreateIndex
CREATE INDEX "onboarding_logs_event_type_idx" ON "onboarding_logs"("event_type");

-- CreateIndex
CREATE INDEX "onboarding_logs_portal_idx" ON "onboarding_logs"("portal");

-- CreateIndex
CREATE INDEX "onboarding_logs_created_at_idx" ON "onboarding_logs"("created_at");

-- CreateIndex
CREATE INDEX "onboarding_logs_user_id_created_at_idx" ON "onboarding_logs"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "onboarding_logs" ADD CONSTRAINT "onboarding_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
