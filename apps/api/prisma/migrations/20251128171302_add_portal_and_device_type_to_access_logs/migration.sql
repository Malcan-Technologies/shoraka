-- AlterTable
ALTER TABLE "access_logs" ADD COLUMN     "device_type" TEXT,
ADD COLUMN     "portal" TEXT;

-- CreateIndex
CREATE INDEX "access_logs_portal_idx" ON "access_logs"("portal");
