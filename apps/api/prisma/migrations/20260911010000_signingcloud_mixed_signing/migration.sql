-- Mixed SigningCloud signing: versioned issuer seals, document-execution bindings,
-- SigningCloud email / confirmed signature metadata, and automatic assignment diagnostics.

CREATE TYPE "OperatorDocumentExecutionRole" AS ENUM ('FA_INVESTOR', 'FA_AGENT', 'JSG_OPERATOR', 'DOA_SSP');
CREATE TYPE "SigningExecutionMode" AS ENUM ('MANUAL', 'AUTOMATIC');
CREATE TYPE "SigningDeliveryMode" AS ENUM ('EMAIL', 'INTERNAL');
CREATE TYPE "SigningCloudImageTransparency" AS ENUM ('OPAQUE', 'ALPHA');

ALTER TABLE "operator_signing_people"
ADD COLUMN "signing_email" TEXT,
ADD COLUMN "signature_sha256" TEXT,
ADD COLUMN "signature_width_px" INTEGER,
ADD COLUMN "signature_height_px" INTEGER,
ADD COLUMN "signature_byte_size" INTEGER,
ADD COLUMN "signature_confirmed_at" TIMESTAMP(3);

CREATE INDEX "operator_signing_people_signing_email_idx" ON "operator_signing_people"("signing_email");

CREATE UNIQUE INDEX "operator_signing_people_signing_email_key"
ON "operator_signing_people" ("signing_email")
WHERE "signing_email" IS NOT NULL;

CREATE TABLE "issuer_organization_company_seals" (
    "id" TEXT NOT NULL,
    "issuer_organization_id" TEXT NOT NULL,
    "s3_key" TEXT NOT NULL,
    "original_file_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "width_px" INTEGER NOT NULL,
    "height_px" INTEGER NOT NULL,
    "transparency_mode" "SigningCloudImageTransparency" NOT NULL,
    "uploaded_by_user_id" VARCHAR(5) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "superseded_at" TIMESTAMP(3),

    CONSTRAINT "issuer_organization_company_seals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "issuer_organization_company_seals_s3_key_key" ON "issuer_organization_company_seals"("s3_key");
CREATE INDEX "issuer_org_seals_org_superseded_idx" ON "issuer_organization_company_seals"("issuer_organization_id", "superseded_at");
CREATE UNIQUE INDEX "issuer_org_seals_one_active_idx"
ON "issuer_organization_company_seals" ("issuer_organization_id")
WHERE "superseded_at" IS NULL;

ALTER TABLE "issuer_organization_company_seals"
ADD CONSTRAINT "issuer_organization_company_seals_issuer_organization_id_fkey"
FOREIGN KEY ("issuer_organization_id") REFERENCES "issuer_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "operator_document_execution_bindings" (
    "id" TEXT NOT NULL,
    "operator_profile_id" TEXT NOT NULL,
    "role_key" "OperatorDocumentExecutionRole" NOT NULL,
    "signing_person_id" TEXT NOT NULL,
    "legal_entity_label" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operator_document_execution_bindings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "operator_doc_exec_bindings_profile_role_key"
ON "operator_document_execution_bindings"("operator_profile_id", "role_key");
CREATE INDEX "operator_doc_exec_bindings_person_idx"
ON "operator_document_execution_bindings"("signing_person_id");

ALTER TABLE "operator_document_execution_bindings"
ADD CONSTRAINT "operator_document_execution_bindings_operator_profile_id_fkey"
FOREIGN KEY ("operator_profile_id") REFERENCES "operator_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "operator_document_execution_bindings"
ADD CONSTRAINT "operator_document_execution_bindings_signing_person_id_fkey"
FOREIGN KEY ("signing_person_id") REFERENCES "operator_signing_people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "signing_recipients"
ADD COLUMN "execution_mode" "SigningExecutionMode" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN "delivery_mode" "SigningDeliveryMode" NOT NULL DEFAULT 'EMAIL';

ALTER TABLE "signing_assignments"
ADD COLUMN "frozen_asset_snapshot" JSONB,
ADD COLUMN "frozen_company_seal_id" TEXT,
ADD COLUMN "auto_sign_attempt_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "last_auto_sign_error" TEXT,
ADD COLUMN "last_auto_sign_at" TIMESTAMP(3);

CREATE INDEX "signing_assignments_frozen_company_seal_id_idx" ON "signing_assignments"("frozen_company_seal_id");

ALTER TABLE "signing_assignments"
ADD CONSTRAINT "signing_assignments_frozen_company_seal_id_fkey"
FOREIGN KEY ("frozen_company_seal_id") REFERENCES "issuer_organization_company_seals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
