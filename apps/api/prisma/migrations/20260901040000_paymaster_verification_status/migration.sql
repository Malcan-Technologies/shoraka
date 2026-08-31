-- CreateEnum
CREATE TYPE "PaymasterVerificationStatus" AS ENUM ('UNVERIFIED', 'VERIFIED');

-- AlterTable
ALTER TABLE "paymasters"
ADD COLUMN "verification_status" "PaymasterVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
ADD COLUMN "verified_at" TIMESTAMP(3),
ADD COLUMN "verified_by_user_id" VARCHAR(5);

-- CreateIndex
CREATE INDEX "paymasters_verification_status_idx" ON "paymasters"("verification_status");
