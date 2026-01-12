-- AlterTable
ALTER TABLE "issuer_organizations" ADD COLUMN     "corporate_entities" JSONB,
ADD COLUMN     "corporate_onboarding_data" JSONB;
