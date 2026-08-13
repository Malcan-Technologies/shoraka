-- Stage 1 legal acceptance audit: separate OPEN/ACCEPT metadata, org snapshots,
-- preserve evidence on user delete, admin audit log table.

-- New OPEN/ACCEPT-specific columns
ALTER TABLE "legal_document_acceptances" ADD COLUMN "opened_ip_address" TEXT;
ALTER TABLE "legal_document_acceptances" ADD COLUMN "opened_user_agent" TEXT;
ALTER TABLE "legal_document_acceptances" ADD COLUMN "opened_device_info" TEXT;
ALTER TABLE "legal_document_acceptances" ADD COLUMN "accepted_ip_address" TEXT;
ALTER TABLE "legal_document_acceptances" ADD COLUMN "accepted_user_agent" TEXT;
ALTER TABLE "legal_document_acceptances" ADD COLUMN "accepted_device_info" TEXT;
ALTER TABLE "legal_document_acceptances" ADD COLUMN "organization_name_snapshot" TEXT;
ALTER TABLE "legal_document_acceptances" ADD COLUMN "organization_type_snapshot" TEXT;

-- Backfill OPEN metadata from legacy shared columns where opened_at exists.
-- Limitation: historical rows cannot split OPEN vs ACCEPT IP/UA when both used the same fields.
UPDATE "legal_document_acceptances"
SET
  "opened_ip_address" = "ip_address",
  "opened_user_agent" = "user_agent",
  "opened_device_info" = "device_info"
WHERE "opened_at" IS NOT NULL
  AND "opened_ip_address" IS NULL;

-- Backfill ACCEPT metadata for accepted rows.
-- When status=ACCEPTED, legacy ip/user_agent/device likely reflect the last write (often ACCEPT).
UPDATE "legal_document_acceptances"
SET
  "accepted_ip_address" = "ip_address",
  "accepted_user_agent" = "user_agent",
  "accepted_device_info" = "device_info"
WHERE "status" = 'ACCEPTED'
  AND "accepted_at" IS NOT NULL
  AND "accepted_ip_address" IS NULL;

-- OPEN-only rows: keep legacy values on OPEN side only (already done above).
-- Do not copy OPEN values to ACCEPT side for non-accepted rows.

-- Backfill organization snapshots from live org tables where possible.
UPDATE "legal_document_acceptances" AS a
SET
  "organization_name_snapshot" = io."name",
  "organization_type_snapshot" = io."type"::TEXT
FROM "issuer_organizations" AS io
WHERE a."organization_id" = io."id"
  AND a."audience_role" = 'ISSUER'
  AND a."organization_name_snapshot" IS NULL;

UPDATE "legal_document_acceptances" AS a
SET
  "organization_name_snapshot" = io."name",
  "organization_type_snapshot" = io."type"::TEXT
FROM "investor_organizations" AS io
WHERE a."organization_id" = io."id"
  AND a."audience_role" = 'INVESTOR'
  AND a."organization_name_snapshot" IS NULL;

-- Preserve acceptance evidence when user is deleted.
ALTER TABLE "legal_document_acceptances" DROP CONSTRAINT IF EXISTS "legal_document_acceptances_user_id_fkey";
ALTER TABLE "legal_document_acceptances" ALTER COLUMN "user_id" DROP NOT NULL;
ALTER TABLE "legal_document_acceptances"
  ADD CONSTRAINT "legal_document_acceptances_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Drop legacy shared request-metadata columns (data migrated above).
ALTER TABLE "legal_document_acceptances" DROP COLUMN IF EXISTS "ip_address";
ALTER TABLE "legal_document_acceptances" DROP COLUMN IF EXISTS "user_agent";
ALTER TABLE "legal_document_acceptances" DROP COLUMN IF EXISTS "device_info";

-- Admin legal-document audit log (append-only).
CREATE TABLE "legal_document_audit_logs" (
  "id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "legal_document_id" TEXT,
  "legal_document_version_id" TEXT,
  "document_type" "LegalDocumentType",
  "version_number" INTEGER,
  "document_hash" TEXT,
  "actor_user_id" TEXT,
  "actor_name_snapshot" TEXT,
  "actor_email_snapshot" TEXT,
  "before_json" JSONB,
  "after_json" JSONB,
  "reason" TEXT,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "correlation_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "legal_document_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "legal_document_audit_logs_legal_document_id_idx" ON "legal_document_audit_logs"("legal_document_id");
CREATE INDEX "legal_document_audit_logs_legal_document_version_id_idx" ON "legal_document_audit_logs"("legal_document_version_id");
CREATE INDEX "legal_document_audit_logs_action_idx" ON "legal_document_audit_logs"("action");
CREATE INDEX "legal_document_audit_logs_actor_user_id_idx" ON "legal_document_audit_logs"("actor_user_id");
CREATE INDEX "legal_document_audit_logs_document_type_idx" ON "legal_document_audit_logs"("document_type");
CREATE INDEX "legal_document_audit_logs_created_at_idx" ON "legal_document_audit_logs"("created_at");
