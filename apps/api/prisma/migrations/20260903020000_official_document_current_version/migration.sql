-- Distinguish generated/READY from the user-facing current version.
-- First V01 becomes current when READY. Regenerated V02+ stay unpublished until Admin publishes.

ALTER TABLE "note_investment_certificates" ADD COLUMN "is_current" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "settlement_hibah_receipts" ADD COLUMN "is_current" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "investment_settlement_confirmations" ADD COLUMN "is_current" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "note_investment_certificates_note_id_is_current_idx"
  ON "note_investment_certificates"("note_id", "is_current");
CREATE INDEX "settlement_hibah_receipts_settlement_id_is_current_idx"
  ON "settlement_hibah_receipts"("settlement_id", "is_current");
CREATE INDEX "investment_settlement_confirmations_scope_current_idx"
  ON "investment_settlement_confirmations"("settlement_id", "investor_organization_id", "is_current");

-- Existing READY artefacts were user-facing as the latest version.
UPDATE "note_investment_certificates" AS c
SET "is_current" = true
WHERE c.status = 'READY'
  AND c.version = (
    SELECT MAX(r.version)
    FROM "note_investment_certificates" AS r
    WHERE r.note_id = c.note_id
      AND r.status = 'READY'
  );

UPDATE "settlement_hibah_receipts" AS c
SET "is_current" = true
WHERE c.status = 'READY'
  AND c.version = (
    SELECT MAX(r.version)
    FROM "settlement_hibah_receipts" AS r
    WHERE r.settlement_id = c.settlement_id
      AND r.status = 'READY'
  );

UPDATE "investment_settlement_confirmations" AS c
SET "is_current" = true
WHERE c.status = 'READY'
  AND c.version = (
    SELECT MAX(r.version)
    FROM "investment_settlement_confirmations" AS r
    WHERE r.settlement_id = c.settlement_id
      AND r.investor_organization_id = c.investor_organization_id
      AND r.status = 'READY'
  );
