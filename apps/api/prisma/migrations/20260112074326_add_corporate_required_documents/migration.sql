-- AlterTable
ALTER TABLE "investor_organizations" ADD COLUMN     "corporate_required_documents" JSONB;

-- AlterTable
ALTER TABLE "issuer_organizations" ADD COLUMN     "corporate_required_documents" JSONB;
