-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "send_to_email" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "send_to_platform" BOOLEAN NOT NULL DEFAULT true;
