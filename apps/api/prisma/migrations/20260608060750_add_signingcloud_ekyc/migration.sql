-- CreateEnum
CREATE TYPE "SigningCloudEkycStatus" AS ENUM ('pending', 'submitted', 'error');

-- CreateTable
CREATE TABLE "signingcloud_ekyc" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "session_token" TEXT,
    "email" TEXT NOT NULL,
    "doc_type" TEXT NOT NULL,
    "country" TEXT,
    "status" "SigningCloudEkycStatus" NOT NULL DEFAULT 'pending',
    "name" TEXT,
    "id_number" TEXT,
    "wiseai_encryption" JSONB,
    "submit_response" JSONB,
    "last_error" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "signingcloud_ekyc_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "signingcloud_ekyc_user_id_key" ON "signingcloud_ekyc"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "signingcloud_ekyc_session_token_key" ON "signingcloud_ekyc"("session_token");

-- CreateIndex
CREATE INDEX "signingcloud_ekyc_email_idx" ON "signingcloud_ekyc"("email");

-- CreateIndex
CREATE INDEX "signingcloud_ekyc_status_idx" ON "signingcloud_ekyc"("status");

-- CreateIndex
CREATE INDEX "signingcloud_ekyc_completed_at_idx" ON "signingcloud_ekyc"("completed_at");

-- AddForeignKey
ALTER TABLE "signingcloud_ekyc" ADD CONSTRAINT "signingcloud_ekyc_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
