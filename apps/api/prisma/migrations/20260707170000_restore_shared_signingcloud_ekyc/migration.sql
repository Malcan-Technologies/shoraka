-- Shared signingcloud_ekyc: one row per email (nullable user_id for external signers).
-- Remove per-recipient kyc_* columns; gate reads from signingcloud_ekyc instead.

DO $$ BEGIN
  CREATE TYPE "SigningCloudEkycStatus" AS ENUM ('pending', 'verified', 'failed', 'error');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "signingcloud_ekyc" (
  "id" TEXT NOT NULL,
  "user_id" VARCHAR(5),
  "email" TEXT NOT NULL,
  "issuer_organization_id" TEXT,
  "session_token" TEXT,
  "sdk_endpoint" TEXT,
  "confirmed_name" TEXT,
  "confirmed_ic_number" TEXT,
  "doc_type" TEXT NOT NULL DEFAULT 'mykad',
  "status" "SigningCloudEkycStatus" NOT NULL DEFAULT 'pending',
  "last_error" TEXT,
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "signingcloud_ekyc_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "signingcloud_ekyc" ALTER COLUMN "user_id" DROP NOT NULL;

DROP INDEX IF EXISTS "signingcloud_ekyc_user_id_email_key";
DROP INDEX IF EXISTS "signingcloud_ekyc_user_id_key";

CREATE UNIQUE INDEX IF NOT EXISTS "signingcloud_ekyc_email_key" ON "signingcloud_ekyc"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "signingcloud_ekyc_session_token_key" ON "signingcloud_ekyc"("session_token");
CREATE INDEX IF NOT EXISTS "signingcloud_ekyc_user_id_idx" ON "signingcloud_ekyc"("user_id");
CREATE INDEX IF NOT EXISTS "signingcloud_ekyc_status_idx" ON "signingcloud_ekyc"("status");
CREATE INDEX IF NOT EXISTS "signingcloud_ekyc_completed_at_idx" ON "signingcloud_ekyc"("completed_at");
CREATE INDEX IF NOT EXISTS "signingcloud_ekyc_issuer_organization_id_idx" ON "signingcloud_ekyc"("issuer_organization_id");

DO $$ BEGIN
  ALTER TABLE "signingcloud_ekyc"
    ADD CONSTRAINT "signingcloud_ekyc_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "signingcloud_ekyc"
    ADD CONSTRAINT "signingcloud_ekyc_issuer_organization_id_fkey"
    FOREIGN KEY ("issuer_organization_id") REFERENCES "issuer_organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "signing_recipients" ADD COLUMN IF NOT EXISTS "kyc_required" BOOLEAN NOT NULL DEFAULT true;

UPDATE "signing_recipients"
SET "kyc_required" = false
WHERE "kyc_status"::text = 'NOT_REQUIRED';

ALTER TABLE "signing_recipients" DROP COLUMN IF EXISTS "kyc_status";
ALTER TABLE "signing_recipients" DROP COLUMN IF EXISTS "kyc_session_token";
ALTER TABLE "signing_recipients" DROP COLUMN IF EXISTS "kyc_sdk_endpoint";
ALTER TABLE "signing_recipients" DROP COLUMN IF EXISTS "kyc_confirmed_name";
ALTER TABLE "signing_recipients" DROP COLUMN IF EXISTS "kyc_confirmed_ic_number";
ALTER TABLE "signing_recipients" DROP COLUMN IF EXISTS "kyc_completed_at";
ALTER TABLE "signing_recipients" DROP COLUMN IF EXISTS "kyc_last_error";

DROP TYPE IF EXISTS "SigningKycStatus";
