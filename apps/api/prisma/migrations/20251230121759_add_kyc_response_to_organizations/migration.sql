-- AlterTable
ALTER TABLE "investor_organizations" ADD COLUMN     "kyc_response" JSONB;

-- AlterTable
ALTER TABLE "issuer_organizations" ADD COLUMN     "kyc_response" JSONB;

