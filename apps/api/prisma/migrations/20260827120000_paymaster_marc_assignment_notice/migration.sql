-- CreateEnum
CREATE TYPE "PaymasterMismatchStatus" AS ENUM ('PENDING', 'RESOLVED');

-- CreateEnum
CREATE TYPE "PaymasterAssignmentNoticeStatus" AS ENUM ('GENERATED', 'SENT', 'ACKNOWLEDGEMENT_UPLOADED', 'ACKNOWLEDGED', 'FAILED');

-- CreateTable
CREATE TABLE "paymasters" (
    "id" TEXT NOT NULL,
    "legal_name" TEXT NOT NULL,
    "registration_number" TEXT NOT NULL,
    "registration_country" TEXT NOT NULL DEFAULT 'MY',
    "entity_type" TEXT NOT NULL,
    "mismatch_pending" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'ISSUER_APPLICATION',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paymasters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issuer_paymaster_links" (
    "id" TEXT NOT NULL,
    "issuer_organization_id" TEXT NOT NULL,
    "paymaster_id" TEXT NOT NULL,
    "is_related_party" BOOLEAN,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "issuer_paymaster_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paymaster_mismatches" (
    "id" TEXT NOT NULL,
    "paymaster_id" TEXT NOT NULL,
    "application_id" TEXT,
    "contract_id" TEXT,
    "submitted_legal_name" TEXT NOT NULL,
    "submitted_entity_type" TEXT NOT NULL,
    "submitted_country" TEXT NOT NULL,
    "existing_legal_name" TEXT NOT NULL,
    "existing_entity_type" TEXT NOT NULL,
    "existing_country" TEXT NOT NULL,
    "status" "PaymasterMismatchStatus" NOT NULL DEFAULT 'PENDING',
    "resolved_at" TIMESTAMP(3),
    "resolved_by_user_id" VARCHAR(5),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paymaster_mismatches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issuer_organization_marc_assessments" (
    "id" TEXT NOT NULL,
    "issuer_organization_id" TEXT NOT NULL,
    "credit_grade" TEXT NOT NULL,
    "credit_score" DECIMAL(7,2),
    "probability_of_default" DECIMAL(7,4),
    "report_s3_key" TEXT,
    "report_file_name" TEXT,
    "report_date" TIMESTAMP(3),
    "created_by_user_id" VARCHAR(5) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issuer_organization_marc_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paymaster_assignment_notices" (
    "id" TEXT NOT NULL,
    "paymaster_id" TEXT NOT NULL,
    "issuer_organization_id" TEXT NOT NULL,
    "contract_id" TEXT,
    "invoice_id" TEXT,
    "note_id" TEXT,
    "status" "PaymasterAssignmentNoticeStatus" NOT NULL DEFAULT 'GENERATED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "notice_s3_key" TEXT,
    "notice_file_name" TEXT,
    "notice_sha256" TEXT,
    "generated_at" TIMESTAMP(3),
    "generated_by_user_id" VARCHAR(5),
    "sent_at" TIMESTAMP(3),
    "sent_by_user_id" VARCHAR(5),
    "acknowledgement_s3_key" TEXT,
    "acknowledgement_file_name" TEXT,
    "acknowledgement_uploaded_at" TIMESTAMP(3),
    "acknowledgement_uploaded_by_user_id" VARCHAR(5),
    "acknowledged_at" TIMESTAMP(3),
    "acknowledged_by_user_id" VARCHAR(5),
    "generation_error" TEXT,
    "template_pending" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paymaster_assignment_notices_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "contracts" ADD COLUMN "paymaster_id" TEXT;

-- AlterTable
ALTER TABLE "notes" ADD COLUMN "paymaster_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "paymasters_registration_number_key" ON "paymasters"("registration_number");

-- CreateIndex
CREATE INDEX "paymasters_legal_name_idx" ON "paymasters"("legal_name");

-- CreateIndex
CREATE INDEX "paymasters_mismatch_pending_idx" ON "paymasters"("mismatch_pending");

-- CreateIndex
CREATE UNIQUE INDEX "issuer_paymaster_links_issuer_organization_id_paymaster_id_key" ON "issuer_paymaster_links"("issuer_organization_id", "paymaster_id");

-- CreateIndex
CREATE INDEX "issuer_paymaster_links_paymaster_id_idx" ON "issuer_paymaster_links"("paymaster_id");

-- CreateIndex
CREATE INDEX "issuer_paymaster_links_issuer_organization_id_last_used_at_idx" ON "issuer_paymaster_links"("issuer_organization_id", "last_used_at");

-- CreateIndex
CREATE INDEX "paymaster_mismatches_paymaster_id_status_idx" ON "paymaster_mismatches"("paymaster_id", "status");

-- CreateIndex
CREATE INDEX "paymaster_mismatches_application_id_idx" ON "paymaster_mismatches"("application_id");

-- CreateIndex
CREATE INDEX "marc_assessments_org_created_idx" ON "issuer_organization_marc_assessments"("issuer_organization_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "paymaster_assignment_notices_paymaster_id_idx" ON "paymaster_assignment_notices"("paymaster_id");

-- CreateIndex
CREATE INDEX "paymaster_assignment_notices_issuer_organization_id_idx" ON "paymaster_assignment_notices"("issuer_organization_id");

-- CreateIndex
CREATE INDEX "paymaster_assignment_notices_contract_id_idx" ON "paymaster_assignment_notices"("contract_id");

-- CreateIndex
CREATE INDEX "paymaster_assignment_notices_invoice_id_idx" ON "paymaster_assignment_notices"("invoice_id");

-- CreateIndex
CREATE INDEX "paymaster_assignment_notices_note_id_idx" ON "paymaster_assignment_notices"("note_id");

-- CreateIndex
CREATE INDEX "paymaster_assignment_notices_status_idx" ON "paymaster_assignment_notices"("status");

-- CreateIndex
CREATE INDEX "contracts_paymaster_id_idx" ON "contracts"("paymaster_id");

-- CreateIndex
CREATE INDEX "notes_paymaster_id_idx" ON "notes"("paymaster_id");

-- AddForeignKey
ALTER TABLE "issuer_paymaster_links" ADD CONSTRAINT "issuer_paymaster_links_issuer_organization_id_fkey" FOREIGN KEY ("issuer_organization_id") REFERENCES "issuer_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issuer_paymaster_links" ADD CONSTRAINT "issuer_paymaster_links_paymaster_id_fkey" FOREIGN KEY ("paymaster_id") REFERENCES "paymasters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paymaster_mismatches" ADD CONSTRAINT "paymaster_mismatches_paymaster_id_fkey" FOREIGN KEY ("paymaster_id") REFERENCES "paymasters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issuer_organization_marc_assessments" ADD CONSTRAINT "issuer_organization_marc_assessments_issuer_organization_id_fkey" FOREIGN KEY ("issuer_organization_id") REFERENCES "issuer_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paymaster_assignment_notices" ADD CONSTRAINT "paymaster_assignment_notices_paymaster_id_fkey" FOREIGN KEY ("paymaster_id") REFERENCES "paymasters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paymaster_assignment_notices" ADD CONSTRAINT "paymaster_assignment_notices_issuer_organization_id_fkey" FOREIGN KEY ("issuer_organization_id") REFERENCES "issuer_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paymaster_assignment_notices" ADD CONSTRAINT "paymaster_assignment_notices_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paymaster_assignment_notices" ADD CONSTRAINT "paymaster_assignment_notices_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paymaster_assignment_notices" ADD CONSTRAINT "paymaster_assignment_notices_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_paymaster_id_fkey" FOREIGN KEY ("paymaster_id") REFERENCES "paymasters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_paymaster_id_fkey" FOREIGN KEY ("paymaster_id") REFERENCES "paymasters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
