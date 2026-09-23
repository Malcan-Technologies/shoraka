-- Facility Documents compiles the same package without a note_id.

ALTER TABLE "facility_agreement_package_evidence" ALTER COLUMN "note_id" DROP NOT NULL;

CREATE INDEX "facility_agreement_package_evidence_contract_id_idx" ON "facility_agreement_package_evidence"("contract_id");
