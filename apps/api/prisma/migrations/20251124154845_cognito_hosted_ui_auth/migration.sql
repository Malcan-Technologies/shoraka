-- AlterEnum - Change BORROWER to ISSUER
ALTER TYPE "UserRole" RENAME VALUE 'BORROWER' TO 'ISSUER';

-- AlterTable - Update users table for Cognito
ALTER TABLE "users" DROP COLUMN "password_hash",
DROP COLUMN "role",
ADD COLUMN "cognito_sub" VARCHAR(255) NOT NULL DEFAULT '',
ADD COLUMN "cognito_username" VARCHAR(255) NOT NULL DEFAULT '',
ADD COLUMN "roles" "UserRole"[] DEFAULT ARRAY[]::"UserRole"[],
ADD COLUMN "email_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "investor_onboarding_completed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "issuer_onboarding_completed" BOOLEAN NOT NULL DEFAULT false;

-- Remove defaults after adding columns (to force explicit values going forward)
ALTER TABLE "users" ALTER COLUMN "cognito_sub" DROP DEFAULT,
ALTER COLUMN "cognito_username" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "users_cognito_sub_key" ON "users"("cognito_sub");

-- CreateIndex
CREATE INDEX "users_cognito_sub_idx" ON "users"("cognito_sub");

-- CreateTable AccessLog
CREATE TABLE "access_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "device_info" TEXT,
    "cognito_event" JSONB,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable UserSession
CREATE TABLE "user_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "cognito_session" VARCHAR(512) NOT NULL,
    "ip_address" TEXT,
    "device_info" TEXT,
    "active_role" "UserRole",
    "last_activity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "access_logs_user_id_idx" ON "access_logs"("user_id");

-- CreateIndex
CREATE INDEX "access_logs_event_type_idx" ON "access_logs"("event_type");

-- CreateIndex
CREATE INDEX "access_logs_created_at_idx" ON "access_logs"("created_at");

-- CreateIndex
CREATE INDEX "access_logs_user_id_created_at_idx" ON "access_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "user_sessions_user_id_idx" ON "user_sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_cognito_session_key" ON "user_sessions"("cognito_session");

-- CreateIndex
CREATE INDEX "user_sessions_cognito_session_idx" ON "user_sessions"("cognito_session");

-- CreateIndex
CREATE INDEX "user_sessions_expires_at_idx" ON "user_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "user_sessions_user_id_active_role_idx" ON "user_sessions"("user_id", "active_role");

-- AddForeignKey
ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

