-- Legal document publishing, versioning, and acceptance audit

CREATE TYPE "LegalDocumentAudience" AS ENUM ('PUBLIC', 'ISSUER', 'INVESTOR', 'BOTH');
CREATE TYPE "LegalDocumentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "LegalAcceptanceAudience" AS ENUM ('ISSUER', 'INVESTOR');
CREATE TYPE "LegalAcceptanceStatus" AS ENUM ('NOT_OPENED', 'OPENED', 'ACCEPTED');

ALTER TYPE "SiteDocumentType" ADD VALUE 'PDPA_NOTICE';
ALTER TYPE "SiteDocumentType" ADD VALUE 'RISK_STATEMENT';
ALTER TYPE "SiteDocumentType" ADD VALUE 'ISSUER_WARNING_STATEMENT';
ALTER TYPE "SiteDocumentType" ADD VALUE 'ISSUER_AGREEMENT';
ALTER TYPE "SiteDocumentType" ADD VALUE 'INVESTOR_WARNING_STATEMENT';
ALTER TYPE "SiteDocumentType" ADD VALUE 'INVESTOR_AGREEMENT';

ALTER TABLE "site_documents"
  ADD COLUMN IF NOT EXISTS "file_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "audience" "LegalDocumentAudience" NOT NULL DEFAULT 'PUBLIC',
  ADD COLUMN IF NOT EXISTS "status" "LegalDocumentStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS "effective_date" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "acceptance_required" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "open_before_accept_required" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "reacceptance_required" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "published_by" TEXT,
  ADD COLUMN IF NOT EXISTS "published_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archived_by" TEXT,
  ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP(3);

-- Preserve existing documents: active → published, inactive → archived.
-- Disable acceptance gates on legacy rows so markdown T&C flow keeps working
-- until admin publishes new onboarding legal PDFs with acceptance_required=true.
UPDATE "site_documents"
SET
  "status" = CASE WHEN "is_active" THEN 'PUBLISHED'::"LegalDocumentStatus" ELSE 'ARCHIVED'::"LegalDocumentStatus" END,
  "published_at" = CASE WHEN "is_active" THEN "created_at" ELSE NULL END,
  "published_by" = CASE WHEN "is_active" THEN "uploaded_by" ELSE NULL END,
  "archived_at" = CASE WHEN NOT "is_active" THEN "updated_at" ELSE NULL END,
  "archived_by" = CASE WHEN NOT "is_active" THEN "uploaded_by" ELSE NULL END,
  "acceptance_required" = false,
  "open_before_accept_required" = false,
  "reacceptance_required" = false;

CREATE INDEX IF NOT EXISTS "site_documents_type_audience_status_idx"
  ON "site_documents"("type", "audience", "status");

CREATE INDEX IF NOT EXISTS "site_documents_status_acceptance_required_idx"
  ON "site_documents"("status", "acceptance_required");

CREATE TABLE IF NOT EXISTS "legal_document_acceptances" (
  "id" TEXT NOT NULL,
  "user_id" VARCHAR(5) NOT NULL,
  "organization_id" TEXT,
  "audience_role" "LegalAcceptanceAudience" NOT NULL,
  "document_id" TEXT NOT NULL,
  "document_type" "SiteDocumentType" NOT NULL,
  "version" INTEGER NOT NULL,
  "file_hash" TEXT,
  "status" "LegalAcceptanceStatus" NOT NULL DEFAULT 'NOT_OPENED',
  "opened_at" TIMESTAMP(3),
  "accepted_at" TIMESTAMP(3),
  "ip_address" TEXT,
  "user_agent" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "legal_document_acceptances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "legal_document_acceptances_user_id_organization_id_document_id_key"
  ON "legal_document_acceptances"("user_id", "organization_id", "document_id");

CREATE INDEX IF NOT EXISTS "legal_document_acceptances_user_id_idx"
  ON "legal_document_acceptances"("user_id");

CREATE INDEX IF NOT EXISTS "legal_document_acceptances_organization_id_idx"
  ON "legal_document_acceptances"("organization_id");

CREATE INDEX IF NOT EXISTS "legal_document_acceptances_document_id_idx"
  ON "legal_document_acceptances"("document_id");

CREATE INDEX IF NOT EXISTS "legal_document_acceptances_document_type_status_idx"
  ON "legal_document_acceptances"("document_type", "status");

CREATE INDEX IF NOT EXISTS "legal_document_acceptances_user_id_organization_id_status_idx"
  ON "legal_document_acceptances"("user_id", "organization_id", "status");

ALTER TABLE "legal_document_acceptances"
  ADD CONSTRAINT "legal_document_acceptances_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "legal_document_acceptances"
  ADD CONSTRAINT "legal_document_acceptances_document_id_fkey"
  FOREIGN KEY ("document_id") REFERENCES "site_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
