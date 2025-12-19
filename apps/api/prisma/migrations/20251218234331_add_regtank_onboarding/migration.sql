/*
  Warnings:

  - The `roles` column on the `users` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[user_id]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "investments" DROP CONSTRAINT "investments_investor_id_fkey";

-- DropForeignKey
ALTER TABLE "loans" DROP CONSTRAINT "loans_borrower_id_fkey";

-- DropIndex
DROP INDEX "users_email_verified_idx";

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "first_name" SET DATA TYPE TEXT,
ALTER COLUMN "last_name" SET DATA TYPE TEXT,
ALTER COLUMN "phone" SET DATA TYPE TEXT,
ALTER COLUMN "email" SET DATA TYPE TEXT,
DROP COLUMN "roles",
ADD COLUMN     "roles" "UserRole"[];

-- CreateTable
CREATE TABLE "regtank_onboarding" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "investor_organization_id" TEXT,
    "issuer_organization_id" TEXT,
    "organization_type" "OrganizationType" NOT NULL,
    "portal_type" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "reference_id" TEXT NOT NULL,
    "onboarding_type" TEXT NOT NULL,
    "verify_link" TEXT,
    "verify_link_expires_at" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "substatus" TEXT,
    "regtank_response" JSONB,
    "webhook_payloads" JSONB[] DEFAULT ARRAY[]::JSONB[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "submitted_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "regtank_onboarding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "regtank_onboarding_request_id_key" ON "regtank_onboarding"("request_id");

-- CreateIndex
CREATE UNIQUE INDEX "regtank_onboarding_reference_id_key" ON "regtank_onboarding"("reference_id");

-- CreateIndex
CREATE INDEX "regtank_onboarding_user_id_idx" ON "regtank_onboarding"("user_id");

-- CreateIndex
CREATE INDEX "regtank_onboarding_investor_organization_id_idx" ON "regtank_onboarding"("investor_organization_id");

-- CreateIndex
CREATE INDEX "regtank_onboarding_issuer_organization_id_idx" ON "regtank_onboarding"("issuer_organization_id");

-- CreateIndex
CREATE INDEX "regtank_onboarding_request_id_idx" ON "regtank_onboarding"("request_id");

-- CreateIndex
CREATE INDEX "regtank_onboarding_reference_id_idx" ON "regtank_onboarding"("reference_id");

-- CreateIndex
CREATE INDEX "regtank_onboarding_status_idx" ON "regtank_onboarding"("status");

-- CreateIndex
CREATE INDEX "regtank_onboarding_portal_type_idx" ON "regtank_onboarding"("portal_type");

-- CreateIndex
CREATE UNIQUE INDEX "users_user_id_key" ON "users"("user_id");

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_borrower_id_fkey" FOREIGN KEY ("borrower_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investments" ADD CONSTRAINT "investments_investor_id_fkey" FOREIGN KEY ("investor_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regtank_onboarding" ADD CONSTRAINT "regtank_onboarding_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regtank_onboarding" ADD CONSTRAINT "regtank_onboarding_investor_organization_id_fkey" FOREIGN KEY ("investor_organization_id") REFERENCES "investor_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regtank_onboarding" ADD CONSTRAINT "regtank_onboarding_issuer_organization_id_fkey" FOREIGN KEY ("issuer_organization_id") REFERENCES "issuer_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
