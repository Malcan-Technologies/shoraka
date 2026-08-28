-- Legal external acceptance linkage (no FK cascade — evidence must survive envelope deletion).
ALTER TABLE "legal_external_acceptances"
  ADD COLUMN IF NOT EXISTS "envelope_id" TEXT,
  ADD COLUMN IF NOT EXISTS "application_id" TEXT,
  ADD COLUMN IF NOT EXISTS "organization_id" TEXT,
  ADD COLUMN IF NOT EXISTS "party_role" TEXT;

CREATE INDEX IF NOT EXISTS "legal_external_acceptances_envelope_id_idx"
  ON "legal_external_acceptances"("envelope_id");
CREATE INDEX IF NOT EXISTS "legal_external_acceptances_application_id_idx"
  ON "legal_external_acceptances"("application_id");
CREATE INDEX IF NOT EXISTS "legal_external_acceptances_organization_id_idx"
  ON "legal_external_acceptances"("organization_id");

-- Generated LO / document hash evidence. Not an activity table.
CREATE TABLE IF NOT EXISTS "generated_document_evidence" (
  "id" TEXT NOT NULL,
  "application_id" TEXT NOT NULL,
  "contract_id" TEXT,
  "invoice_id" TEXT,
  "document_type" TEXT NOT NULL,
  "template_version" TEXT,
  "template_sha256" TEXT NOT NULL,
  "output_sha256" TEXT NOT NULL,
  "format" TEXT NOT NULL,
  "created_by_user_id" VARCHAR(5),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "generated_document_evidence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "generated_document_evidence_application_id_idx"
  ON "generated_document_evidence"("application_id");
CREATE INDEX IF NOT EXISTS "generated_document_evidence_document_type_idx"
  ON "generated_document_evidence"("document_type");
CREATE INDEX IF NOT EXISTS "generated_document_evidence_created_at_idx"
  ON "generated_document_evidence"("created_at");

-- First-class ops alerts (not user notification types).
CREATE TYPE "OpsAlertType" AS ENUM (
  'STUCK_PAYMENT',
  'RECON_MISMATCH',
  'RECEIPT_FAILURE',
  'WEBHOOK_FAILURE',
  'SIGNING_EXPIRY',
  'PROVIDER_FAILURE',
  'REPEATED_JOB_FAILURE',
  'MISSING_LEGAL_EVIDENCE',
  'GATEWAY_LEDGER_MISMATCH'
);

CREATE TYPE "OpsAlertSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

CREATE TYPE "OpsAlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'CLOSED');

CREATE TABLE IF NOT EXISTS "ops_alerts" (
  "id" TEXT NOT NULL,
  "type" "OpsAlertType" NOT NULL,
  "severity" "OpsAlertSeverity" NOT NULL,
  "status" "OpsAlertStatus" NOT NULL DEFAULT 'OPEN',
  "dedupe_key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "entity_type" TEXT,
  "entity_id" TEXT,
  "details" JSONB,
  "owner_user_id" VARCHAR(5),
  "occurrence_count" INTEGER NOT NULL DEFAULT 1,
  "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acknowledged_at" TIMESTAMP(3),
  "acknowledged_by_user_id" VARCHAR(5),
  "resolved_at" TIMESTAMP(3),
  "resolved_by_user_id" VARCHAR(5),
  "closed_at" TIMESTAMP(3),
  "closed_by_user_id" VARCHAR(5),
  CONSTRAINT "ops_alerts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ops_alerts_dedupe_key_key" ON "ops_alerts"("dedupe_key");
CREATE INDEX IF NOT EXISTS "ops_alerts_status_severity_idx" ON "ops_alerts"("status", "severity");
CREATE INDEX IF NOT EXISTS "ops_alerts_type_status_idx" ON "ops_alerts"("type", "status");
CREATE INDEX IF NOT EXISTS "ops_alerts_entity_type_entity_id_idx" ON "ops_alerts"("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "ops_alerts_created_at_idx" ON "ops_alerts"("created_at");
