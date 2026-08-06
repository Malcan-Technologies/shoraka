-- DropForeignKey
ALTER TABLE "legal_document_acceptances" DROP CONSTRAINT "legal_document_acceptances_user_id_fkey";

-- AlterTable
ALTER TABLE "legal_document_acceptances" ALTER COLUMN "user_id" SET DATA TYPE TEXT;

-- AddForeignKey
ALTER TABLE "legal_document_acceptances" ADD CONSTRAINT "legal_document_acceptances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "legal_document_acceptances_user_org_version_key" RENAME TO "legal_document_acceptances_user_id_organization_id_legal_do_key";

-- RenameIndex
ALTER INDEX "legal_document_acceptances_version_id_idx" RENAME TO "legal_document_acceptances_legal_document_version_id_idx";
