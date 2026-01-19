-- CreateTable
CREATE TABLE "aml_identity_mapping" (
    "id" TEXT NOT NULL,
    "organization_id" VARCHAR(255) NOT NULL,
    "organization_type" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "business_name" TEXT,
    "cod_request_id" TEXT,
    "eod_request_id" TEXT,
    "kyc_id" TEXT,
    "kyb_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_synced_at" TIMESTAMP(3),

    CONSTRAINT "aml_identity_mapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "aml_identity_mapping_organization_id_idx" ON "aml_identity_mapping"("organization_id");

-- CreateIndex
CREATE INDEX "aml_identity_mapping_kyc_id_idx" ON "aml_identity_mapping"("kyc_id");

-- CreateIndex
CREATE INDEX "aml_identity_mapping_kyb_id_idx" ON "aml_identity_mapping"("kyb_id");

-- CreateIndex
CREATE INDEX "aml_identity_mapping_cod_request_id_idx" ON "aml_identity_mapping"("cod_request_id");

-- CreateIndex
CREATE INDEX "aml_identity_mapping_eod_request_id_idx" ON "aml_identity_mapping"("eod_request_id");

-- CreateIndex
CREATE INDEX "aml_identity_mapping_organization_id_email_idx" ON "aml_identity_mapping"("organization_id", "email");
