/*
 Warnings:

 - Made the column `created_at` on table `application_revisions` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "application_revisions" DROP CONSTRAINT "application_revisions_application_id_fkey";

-- DropIndex
DROP INDEX "application_review_notes_application_id_idx";

-- DropIndex
DROP INDEX "application_review_remarks_application_id_scope_scope_key_key";

-- AlterTable
ALTER TABLE "application_review_remarks" ALTER COLUMN "review_cycle" DROP DEFAULT;

-- AlterTable
ALTER TABLE "application_revisions" ALTER COLUMN "submitted_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "application_revisions" ADD CONSTRAINT "application_revisions_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "application_revisions_application_id_review_cycle_idx" RENAME TO "application_revisions_application_id_review_cycle_key";

