-- Remove placeholder SiteDocument / DocumentLog systems and invest-ack refs.
-- LegalDocument / LegalDocumentVersion / LegalDocumentAcceptance are preserved.

-- Child audit table first (FK to users only).
DROP TABLE IF EXISTS "document_logs";

-- Standalone catalog table (no FKs from other tables).
DROP TABLE IF EXISTS "site_documents";

-- Enum used only by site_documents.
DROP TYPE IF EXISTS "SiteDocumentType";

-- Note investment placeholder document refs.
ALTER TABLE "note_investments" DROP COLUMN IF EXISTS "product_terms_ref";
ALTER TABLE "note_investments" DROP COLUMN IF EXISTS "risk_disclosure_ref";
