-- AlterTable
ALTER TABLE "ctos_reports" ALTER COLUMN "company_json" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ctos_reports" ADD COLUMN "person_json" JSONB;
