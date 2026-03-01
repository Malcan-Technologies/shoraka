-- AlterTable
ALTER TABLE "application_logs" ALTER COLUMN "portal" SET DATA TYPE TEXT;

-- RenameIndex
ALTER INDEX "idx_application_logs_portal" RENAME TO "application_logs_portal_idx";
