-- AlterTable
ALTER TABLE "application_pending_amendments" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "application_review_remarks" ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- RenameIndex
ALTER INDEX "application_pending_amendments_application_id_scope_scope_key_k" RENAME TO "application_pending_amendments_application_id_scope_scope_k_key";
