-- Separate legal-document domain (does not alter SiteDocument semantics).
--
-- If an earlier hybrid migration already altered site_documents / legal_document_acceptances,
-- this script cleans that overlay first, then creates the dedicated legal tables.
-- Feature-branch note: local DBs that applied the hybrid migration should prefer
-- `prisma migrate reset` in development, or run this migration carefully.

-- ---------------------------------------------------------------------------
-- Cleanup hybrid SiteDocument legal overlay (safe if objects do not exist)
-- ---------------------------------------------------------------------------

ALTER TABLE IF EXISTS "legal_document_acceptances" DROP CONSTRAINT IF EXISTS "legal_document_acceptances_document_id_fkey";
ALTER TABLE IF EXISTS "legal_document_acceptances" DROP CONSTRAINT IF EXISTS "legal_document_acceptances_user_id_fkey";
DROP TABLE IF EXISTS "legal_document_acceptances";

DROP INDEX IF EXISTS "site_documents_type_audience_status_idx";
DROP INDEX IF EXISTS "site_documents_status_acceptance_required_idx";

ALTER TABLE "site_documents"
  DROP COLUMN IF EXISTS "file_hash",
  DROP COLUMN IF EXISTS "audience",
  DROP COLUMN IF EXISTS "status",
  DROP COLUMN IF EXISTS "effective_date",
  DROP COLUMN IF EXISTS "acceptance_required",
  DROP COLUMN IF EXISTS "open_before_accept_required",
  DROP COLUMN IF EXISTS "reacceptance_required",
  DROP COLUMN IF EXISTS "published_by",
  DROP COLUMN IF EXISTS "published_at",
  DROP COLUMN IF EXISTS "archived_by",
  DROP COLUMN IF EXISTS "archived_at";

-- Legacy LegalDocumentStatus enum is unused after cleanup
DROP TYPE IF EXISTS "LegalDocumentStatus";

-- ---------------------------------------------------------------------------
-- Dedicated legal enums and tables
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE "LegalDocumentType" AS ENUM (
    'PDPA_NOTICE_AND_CONSENT',
    'TERMS_OF_USE',
    'RISK_STATEMENT',
    'ISSUER_WARNING_STATEMENT',
    'INVESTOR_WARNING_STATEMENT',
    'ISSUER_AGREEMENT',
    'INVESTOR_AGREEMENT'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LegalDocumentAudience" AS ENUM ('PUBLIC', 'ISSUER', 'INVESTOR', 'BOTH');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LegalDocumentVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LegalAcceptanceAudience" AS ENUM ('ISSUER', 'INVESTOR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LegalAcceptanceStatus" AS ENUM ('NOT_OPENED', 'OPENED', 'ACCEPTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "legal_documents" (
  "id" TEXT NOT NULL,
  "type" "LegalDocumentType" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "audience" "LegalDocumentAudience" NOT NULL DEFAULT 'BOTH',
  "required_for_onboarding" BOOLEAN NOT NULL DEFAULT true,
  "public_visibility" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "legal_documents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "legal_documents_type_key" ON "legal_documents"("type");
CREATE INDEX IF NOT EXISTS "legal_documents_audience_idx" ON "legal_documents"("audience");
CREATE INDEX IF NOT EXISTS "legal_documents_required_for_onboarding_idx"
  ON "legal_documents"("required_for_onboarding");

CREATE TABLE IF NOT EXISTS "legal_document_versions" (
  "id" TEXT NOT NULL,
  "legal_document_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "LegalDocumentVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "s3_key" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "content_type" TEXT NOT NULL DEFAULT 'application/pdf',
  "file_size" INTEGER NOT NULL,
  "file_hash" TEXT,
  "reacceptance_required" BOOLEAN NOT NULL DEFAULT false,
  "uploaded_by" TEXT NOT NULL,
  "published_by" TEXT,
  "published_at" TIMESTAMP(3),
  "archived_by" TEXT,
  "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "legal_document_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "legal_document_versions_s3_key_key"
  ON "legal_document_versions"("s3_key");
CREATE UNIQUE INDEX IF NOT EXISTS "legal_document_versions_legal_document_id_version_key"
  ON "legal_document_versions"("legal_document_id", "version");
CREATE INDEX IF NOT EXISTS "legal_document_versions_legal_document_id_status_idx"
  ON "legal_document_versions"("legal_document_id", "status");
CREATE INDEX IF NOT EXISTS "legal_document_versions_status_reacceptance_required_idx"
  ON "legal_document_versions"("status", "reacceptance_required");

CREATE TABLE IF NOT EXISTS "legal_document_acceptances" (
  "id" TEXT NOT NULL,
  "legal_document_version_id" TEXT NOT NULL,
  "user_id" VARCHAR(5) NOT NULL,
  "organization_id" TEXT,
  "audience_role" "LegalAcceptanceAudience" NOT NULL,
  "status" "LegalAcceptanceStatus" NOT NULL DEFAULT 'NOT_OPENED',
  "opened_at" TIMESTAMP(3),
  "accepted_at" TIMESTAMP(3),
  "document_hash" TEXT,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "legal_document_acceptances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "legal_document_acceptances_user_org_version_key"
  ON "legal_document_acceptances"("user_id", "organization_id", "legal_document_version_id");
CREATE INDEX IF NOT EXISTS "legal_document_acceptances_user_id_idx"
  ON "legal_document_acceptances"("user_id");
CREATE INDEX IF NOT EXISTS "legal_document_acceptances_organization_id_idx"
  ON "legal_document_acceptances"("organization_id");
CREATE INDEX IF NOT EXISTS "legal_document_acceptances_version_id_idx"
  ON "legal_document_acceptances"("legal_document_version_id");
CREATE INDEX IF NOT EXISTS "legal_document_acceptances_organization_id_status_idx"
  ON "legal_document_acceptances"("organization_id", "status");

ALTER TABLE "legal_document_versions"
  DROP CONSTRAINT IF EXISTS "legal_document_versions_legal_document_id_fkey";
ALTER TABLE "legal_document_versions"
  ADD CONSTRAINT "legal_document_versions_legal_document_id_fkey"
  FOREIGN KEY ("legal_document_id") REFERENCES "legal_documents"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "legal_document_acceptances"
  DROP CONSTRAINT IF EXISTS "legal_document_acceptances_user_id_fkey";
ALTER TABLE "legal_document_acceptances"
  ADD CONSTRAINT "legal_document_acceptances_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("user_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "legal_document_acceptances"
  DROP CONSTRAINT IF EXISTS "legal_document_acceptances_legal_document_version_id_fkey";
ALTER TABLE "legal_document_acceptances"
  ADD CONSTRAINT "legal_document_acceptances_legal_document_version_id_fkey"
  FOREIGN KEY ("legal_document_version_id") REFERENCES "legal_document_versions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
