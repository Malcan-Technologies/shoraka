-- Shoraka Profile signing people (execution roles + signature assets).
-- Company stamp remains on platform_finance_settings.document_authorisation_config.
CREATE TYPE "OperatorSigningRole" AS ENUM ('AUTHORISED_SIGNATORY', 'WITNESS');

CREATE TABLE "operator_signing_people" (
    "id" TEXT NOT NULL,
    "operator_profile_id" TEXT NOT NULL,
    "officer_id" TEXT NOT NULL,
    "roles" "OperatorSigningRole"[],
    "signature_s3_key" TEXT,
    "signature_file_name" TEXT,
    "signature_content_type" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operator_signing_people_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "operator_signing_people_officer_id_key" ON "operator_signing_people"("officer_id");

CREATE INDEX "operator_signing_people_operator_profile_id_idx" ON "operator_signing_people"("operator_profile_id");

ALTER TABLE "operator_signing_people"
ADD CONSTRAINT "operator_signing_people_operator_profile_id_fkey"
FOREIGN KEY ("operator_profile_id") REFERENCES "operator_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "operator_signing_people"
ADD CONSTRAINT "operator_signing_people_officer_id_fkey"
FOREIGN KEY ("officer_id") REFERENCES "operator_officers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
