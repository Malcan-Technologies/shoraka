-- CreateTable
CREATE TABLE "corporate_individual_kyc" (
    "id" TEXT NOT NULL,
    "regtank_onboarding_id" TEXT NOT NULL,
    "eod_request_id" TEXT NOT NULL,
    "cod_request_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "designation" TEXT,
    "is_director_officer" BOOLEAN NOT NULL DEFAULT false,
    "is_shareholder" BOOLEAN NOT NULL DEFAULT false,
    "share_percentage" DECIMAL(5,2),
    "status" TEXT NOT NULL,
    "kyc_approved" BOOLEAN NOT NULL DEFAULT false,
    "aml_approved" BOOLEAN NOT NULL DEFAULT false,
    "kyc_portal_url" TEXT,
    "aml_portal_url" TEXT,
    "regtank_response" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "kyc_submitted_at" TIMESTAMP(3),
    "kyc_approved_at" TIMESTAMP(3),
    "aml_approved_at" TIMESTAMP(3),

    CONSTRAINT "corporate_individual_kyc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "sid" character varying NOT NULL,
    "sess" JSON NOT NULL,
    "expire" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);

-- CreateIndex
CREATE INDEX "corporate_individual_kyc_cod_request_id_idx" ON "corporate_individual_kyc"("cod_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "corporate_individual_kyc_eod_request_id_key" ON "corporate_individual_kyc"("eod_request_id");

-- CreateIndex
CREATE INDEX "corporate_individual_kyc_regtank_onboarding_id_idx" ON "corporate_individual_kyc"("regtank_onboarding_id");

-- CreateIndex
CREATE INDEX "IDX_session_expire" ON "session"("expire");

-- AddForeignKey
ALTER TABLE "corporate_individual_kyc" ADD CONSTRAINT "corporate_individual_kyc_regtank_onboarding_id_fkey" FOREIGN KEY ("regtank_onboarding_id") REFERENCES "regtank_onboarding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
