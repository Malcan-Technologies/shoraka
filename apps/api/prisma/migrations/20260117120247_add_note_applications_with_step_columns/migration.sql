-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "note_applications" (
    "id" TEXT NOT NULL,
    "issuer_organization_id" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "last_completed_step" INTEGER NOT NULL DEFAULT 0,
    "financing_type" JSONB,
    "financing_terms" JSONB,
    "invoice_details" JSONB,
    "company_info" JSONB,
    "supporting_documents" JSONB,
    "declaration" JSONB,
    "submitted_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "note_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "note_applications_issuer_organization_id_idx" ON "note_applications"("issuer_organization_id");

-- CreateIndex
CREATE INDEX "note_applications_status_idx" ON "note_applications"("status");

-- AddForeignKey
ALTER TABLE "note_applications" ADD CONSTRAINT "note_applications_issuer_organization_id_fkey" FOREIGN KEY ("issuer_organization_id") REFERENCES "issuer_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
