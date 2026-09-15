-- Immutable evidence for each compiled Facility Agreement package PDF.

CREATE TABLE "facility_agreement_package_evidence" (
    "id" TEXT NOT NULL,
    "note_id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "contract_id" TEXT,
    "invoice_id" TEXT,
    "assembler_version" INTEGER NOT NULL,
    "signed_fa_sha256" TEXT NOT NULL,
    "lo_template_sha256" TEXT NOT NULL,
    "lo_output_sha256" TEXT NOT NULL,
    "certificate_ids" JSONB NOT NULL,
    "certificate_hashes" JSONB NOT NULL,
    "output_sha256" TEXT NOT NULL,
    "created_by_user_id" VARCHAR(5),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facility_agreement_package_evidence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "facility_agreement_package_evidence_note_id_idx" ON "facility_agreement_package_evidence"("note_id");

CREATE INDEX "facility_agreement_package_evidence_application_id_idx" ON "facility_agreement_package_evidence"("application_id");

CREATE INDEX "facility_agreement_package_evidence_created_at_idx" ON "facility_agreement_package_evidence"("created_at");
