-- AlterTable
ALTER TABLE "investor_organizations" ADD COLUMN     "director_aml_status" JSONB;

-- AlterTable
ALTER TABLE "issuer_organizations" ADD COLUMN     "director_aml_status" JSONB;
