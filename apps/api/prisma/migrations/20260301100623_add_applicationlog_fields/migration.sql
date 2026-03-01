-- CreateEnum
CREATE TYPE "ActivityLevel" AS ENUM ('APPLICATION', 'TAB', 'ITEM');

-- CreateEnum
CREATE TYPE "ActivityTarget" AS ENUM ('APPLICATION', 'FINANCIAL', 'CONTRACT', 'INVOICE', 'SUPPORTING_DOCUMENT');

-- CreateEnum
CREATE TYPE "ActivityAction" AS ENUM ('CREATED', 'SUBMITTED', 'RESUBMITTED', 'APPROVED', 'REJECTED', 'REQUESTED_AMENDMENT');

-- AlterTable
ALTER TABLE "application_logs" ADD COLUMN     "action" "ActivityAction",
ADD COLUMN     "entity_id" TEXT,
ADD COLUMN     "level" "ActivityLevel",
ADD COLUMN     "remark" TEXT,
ADD COLUMN     "review_cycle" INTEGER,
ADD COLUMN     "target" "ActivityTarget";

-- CreateIndex
CREATE INDEX "application_logs_application_id_idx" ON "application_logs"("application_id");

-- CreateIndex
CREATE INDEX "application_logs_application_id_review_cycle_idx" ON "application_logs"("application_id", "review_cycle");

-- CreateIndex
CREATE INDEX "application_logs_level_idx" ON "application_logs"("level");

-- CreateIndex
CREATE INDEX "application_logs_action_idx" ON "application_logs"("action");
