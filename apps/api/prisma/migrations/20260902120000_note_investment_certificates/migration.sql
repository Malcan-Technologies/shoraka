-- Islamic Investment Note Certificate artefacts (audience-specific PDFs).
-- audience_scope_key is the uniqueness helper for nullable investor_organization_id:
-- ADMIN, ISSUER, or INVESTOR:{investorOrganizationId}.

CREATE TYPE "NoteInvestmentCertificateAudience" AS ENUM ('ADMIN', 'ISSUER', 'INVESTOR');

CREATE TYPE "NoteInvestmentCertificateStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

CREATE TABLE "note_investment_certificates" (
    "id" TEXT NOT NULL,
    "note_id" TEXT NOT NULL,
    "certificate_number" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "audience" "NoteInvestmentCertificateAudience" NOT NULL,
    "audience_scope_key" TEXT NOT NULL,
    "investor_organization_id" TEXT,
    "status" "NoteInvestmentCertificateStatus" NOT NULL DEFAULT 'PENDING',
    "snapshot" JSONB NOT NULL,
    "pdf_s3_key" TEXT,
    "pdf_sha256" TEXT,
    "generated_at" TIMESTAMP(3),
    "generation_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "note_investment_certificates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "note_investment_certificates_scope_uidx" ON "note_investment_certificates"("note_id", "version", "audience_scope_key");

CREATE INDEX "note_investment_certificates_note_id_version_audience_idx" ON "note_investment_certificates"("note_id", "version", "audience");

CREATE INDEX "note_investment_certificates_investor_organization_id_idx" ON "note_investment_certificates"("investor_organization_id");

CREATE INDEX "note_investment_certificates_status_idx" ON "note_investment_certificates"("status");

CREATE INDEX "note_investment_certificates_certificate_number_idx" ON "note_investment_certificates"("certificate_number");

ALTER TABLE "note_investment_certificates" ADD CONSTRAINT "note_investment_certificates_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
