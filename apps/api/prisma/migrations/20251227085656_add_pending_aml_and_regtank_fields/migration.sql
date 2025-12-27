-- AlterEnum
ALTER TYPE "OnboardingStatus" ADD VALUE 'PENDING_AML';

-- AlterTable
ALTER TABLE "investor_organizations" ADD COLUMN     "address" TEXT,
ADD COLUMN     "bank_account_details" JSONB,
ADD COLUMN     "compliance_declaration" JSONB,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "date_of_birth" TIMESTAMP(3),
ADD COLUMN     "document_info" JSONB,
ADD COLUMN     "document_number" TEXT,
ADD COLUMN     "document_type" TEXT,
ADD COLUMN     "first_name" TEXT,
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "id_issuing_country" TEXT,
ADD COLUMN     "kyc_id" TEXT,
ADD COLUMN     "last_name" TEXT,
ADD COLUMN     "liveness_check_info" JSONB,
ADD COLUMN     "middle_name" TEXT,
ADD COLUMN     "nationality" TEXT,
ADD COLUMN     "phone_number" TEXT,
ADD COLUMN     "wealth_declaration" JSONB;

-- AlterTable
ALTER TABLE "issuer_organizations" ADD COLUMN     "address" TEXT,
ADD COLUMN     "bank_account_details" JSONB,
ADD COLUMN     "compliance_declaration" JSONB,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "date_of_birth" TIMESTAMP(3),
ADD COLUMN     "document_info" JSONB,
ADD COLUMN     "document_number" TEXT,
ADD COLUMN     "document_type" TEXT,
ADD COLUMN     "first_name" TEXT,
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "id_issuing_country" TEXT,
ADD COLUMN     "kyc_id" TEXT,
ADD COLUMN     "last_name" TEXT,
ADD COLUMN     "liveness_check_info" JSONB,
ADD COLUMN     "middle_name" TEXT,
ADD COLUMN     "nationality" TEXT,
ADD COLUMN     "phone_number" TEXT,
ADD COLUMN     "wealth_declaration" JSONB;
