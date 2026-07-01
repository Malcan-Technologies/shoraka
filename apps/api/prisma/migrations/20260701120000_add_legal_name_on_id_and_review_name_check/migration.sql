-- AlterEnum
ALTER TYPE "NameCheckResult" ADD VALUE 'REVIEW' BEFORE 'FAIL';

-- AlterTable
ALTER TABLE "investor_organizations" ADD COLUMN "legal_name_on_id" TEXT;
