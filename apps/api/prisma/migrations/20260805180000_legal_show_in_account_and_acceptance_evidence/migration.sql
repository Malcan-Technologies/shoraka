-- LegalDocument: Profile → Documents visibility (independent of onboarding/public).
ALTER TABLE "legal_documents" ADD COLUMN "show_in_account" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "legal_documents_show_in_account_idx" ON "legal_documents"("show_in_account");

-- LegalDocumentAcceptance: immutable evidence snapshots.
ALTER TABLE "legal_document_acceptances" ADD COLUMN "legal_document_id" TEXT;
ALTER TABLE "legal_document_acceptances" ADD COLUMN "document_type" "LegalDocumentType";
ALTER TABLE "legal_document_acceptances" ADD COLUMN "version_number" INTEGER;
ALTER TABLE "legal_document_acceptances" ADD COLUMN "acknowledgement_text" TEXT;
ALTER TABLE "legal_document_acceptances" ADD COLUMN "device_info" TEXT;
ALTER TABLE "legal_document_acceptances" ADD COLUMN "user_email_snapshot" TEXT;
ALTER TABLE "legal_document_acceptances" ADD COLUMN "user_name_snapshot" TEXT;

-- Backfill snapshots from the exact accepted/opened version (no invented hashes).
UPDATE "legal_document_acceptances" AS a
SET
  "legal_document_id" = v."legal_document_id",
  "document_type" = d."type",
  "version_number" = v."version",
  "document_hash" = COALESCE(a."document_hash", v."file_hash")
FROM "legal_document_versions" AS v
INNER JOIN "legal_documents" AS d ON d."id" = v."legal_document_id"
WHERE a."legal_document_version_id" = v."id";

-- Backfill acknowledgement wording from fixed type labels (known constants only).
UPDATE "legal_document_acceptances"
SET "acknowledgement_text" = CASE "document_type"
  WHEN 'PDPA_NOTICE_AND_CONSENT' THEN 'I have read the privacy notice and consent to the handling of my personal data as described.'
  WHEN 'TERMS_OF_USE' THEN 'I have read and agree to these terms.'
  WHEN 'RISK_STATEMENT' THEN 'I have read and understood the risks described in this document.'
  WHEN 'ISSUER_WARNING_STATEMENT' THEN 'I have read and understood this warning statement.'
  WHEN 'INVESTOR_WARNING_STATEMENT' THEN 'I have read and understood this warning statement.'
  WHEN 'ISSUER_AGREEMENT' THEN 'I have read and agree to this agreement.'
  WHEN 'INVESTOR_AGREEMENT' THEN 'I have read and agree to this agreement.'
  ELSE NULL
END
WHERE "acknowledgement_text" IS NULL
  AND "document_type" IS NOT NULL
  AND "status" = 'ACCEPTED';

-- Backfill user email/name snapshots where join is possible.
UPDATE "legal_document_acceptances" AS a
SET
  "user_email_snapshot" = u."email",
  "user_name_snapshot" = NULLIF(TRIM(CONCAT(COALESCE(u."first_name", ''), ' ', COALESCE(u."last_name", ''))), '')
FROM "users" AS u
WHERE a."user_id" = u."user_id"
  AND (a."user_email_snapshot" IS NULL OR a."user_name_snapshot" IS NULL);

CREATE INDEX "legal_document_acceptances_document_type_idx" ON "legal_document_acceptances"("document_type");
CREATE INDEX "legal_document_acceptances_accepted_at_idx" ON "legal_document_acceptances"("accepted_at");
CREATE INDEX "legal_document_acceptances_audience_role_idx" ON "legal_document_acceptances"("audience_role");

-- At most one ACCEPTED row per organization + version (org-level owner acceptance).
-- Created only when no historical ACCEPTED duplicates exist. Never delete history to force this.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "legal_document_acceptances"
    WHERE "status" = 'ACCEPTED'
      AND "organization_id" IS NOT NULL
    GROUP BY "organization_id", "legal_document_version_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE NOTICE 'Skipped legal_document_acceptances_org_version_accepted_uidx: historical ACCEPTED duplicates exist';
    CREATE INDEX IF NOT EXISTS "legal_document_acceptances_org_version_accepted_idx"
      ON "legal_document_acceptances"("organization_id", "legal_document_version_id")
      WHERE "status" = 'ACCEPTED' AND "organization_id" IS NOT NULL;
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS "legal_document_acceptances_org_version_accepted_uidx"
      ON "legal_document_acceptances"("organization_id", "legal_document_version_id")
      WHERE "status" = 'ACCEPTED' AND "organization_id" IS NOT NULL;
  END IF;
END $$;
