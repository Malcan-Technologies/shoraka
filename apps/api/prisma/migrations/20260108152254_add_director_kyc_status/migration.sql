-- AlterTable
ALTER TABLE "investor_organizations" ADD COLUMN     "director_kyc_status" JSONB;

-- AlterTable
ALTER TABLE "issuer_organizations" ADD COLUMN     "director_kyc_status" JSONB;
