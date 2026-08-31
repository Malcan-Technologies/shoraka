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
