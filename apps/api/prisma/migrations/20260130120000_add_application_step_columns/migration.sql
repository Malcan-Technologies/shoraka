-- AlterTable
ALTER TABLE "applications"
  ADD COLUMN "financing_structure" JSONB,
  ADD COLUMN "contract_details" JSONB,
  ADD COLUMN "invoice_details" JSONB,
  ADD COLUMN "company_details" JSONB,
  ADD COLUMN "business_details" JSONB,
  DROP COLUMN "verify_company_info";
