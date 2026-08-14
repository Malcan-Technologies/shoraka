-- Unauthenticated legal-document acceptances + guarantor warning type.

ALTER TYPE "LegalDocumentType" ADD VALUE 'GUARANTOR_WARNING_STATEMENT';
ALTER TYPE "LegalDocumentAudience" ADD VALUE 'GUARANTOR';

CREATE TYPE "LegalExternalAcceptanceSource" AS ENUM ('SIGNING_RECIPIENT');
CREATE TYPE "LegalExternalAcceptanceStatus" AS ENUM ('OPENED', 'ACCEPTED');

CREATE TABLE "legal_external_acceptances" (
  "id" TEXT NOT NULL,
  "legal_document_version_id" TEXT NOT NULL,
  "legal_document_id" TEXT,
  "document_type" "LegalDocumentType",
  "version_number" INTEGER,
  "document_hash" TEXT,
  "party_name" TEXT NOT NULL,
  "party_email" TEXT NOT NULL,
  "party_ic_number" TEXT,
  "source_type" "LegalExternalAcceptanceSource" NOT NULL,
  "source_id" TEXT NOT NULL,
  "status" "LegalExternalAcceptanceStatus" NOT NULL DEFAULT 'OPENED',
  "opened_at" TIMESTAMP(3),
  "opened_ip_address" TEXT,
  "opened_user_agent" TEXT,
  "opened_device_info" TEXT,
  "accepted_at" TIMESTAMP(3),
  "accepted_ip_address" TEXT,
  "accepted_user_agent" TEXT,
  "accepted_device_info" TEXT,
  "acknowledgement_text" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "legal_external_acceptances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "legal_ext_accept_source_version_uidx"
  ON "legal_external_acceptances"("source_type", "source_id", "legal_document_version_id");

CREATE INDEX "legal_ext_accept_source_idx"
  ON "legal_external_acceptances"("source_type", "source_id");

CREATE INDEX "legal_external_acceptances_legal_document_version_id_idx"
  ON "legal_external_acceptances"("legal_document_version_id");

CREATE INDEX "legal_external_acceptances_document_type_idx"
  ON "legal_external_acceptances"("document_type");

CREATE INDEX "legal_external_acceptances_accepted_at_idx"
  ON "legal_external_acceptances"("accepted_at");

ALTER TABLE "legal_external_acceptances"
  ADD CONSTRAINT "legal_external_acceptances_legal_document_version_id_fkey"
  FOREIGN KEY ("legal_document_version_id") REFERENCES "legal_document_versions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
