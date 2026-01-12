/*
  Warnings:

  - You are about to drop the column `director_aml_status` on the `investor_organizations` table. All the data in the column will be lost.
  - You are about to drop the column `director_kyc_status` on the `investor_organizations` table. All the data in the column will be lost.
  - You are about to drop the column `director_aml_status` on the `issuer_organizations` table. All the data in the column will be lost.
  - You are about to drop the column `director_kyc_status` on the `issuer_organizations` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "investor_organizations" DROP COLUMN "director_aml_status",
DROP COLUMN "director_kyc_status";

-- AlterTable
ALTER TABLE "issuer_organizations" DROP COLUMN "director_aml_status",
DROP COLUMN "director_kyc_status";

-- CreateTable
CREATE TABLE "product_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "product_id" TEXT,
    "event_type" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "device_info" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_logs_user_id_idx" ON "product_logs"("user_id");

-- CreateIndex
CREATE INDEX "product_logs_product_id_idx" ON "product_logs"("product_id");

-- CreateIndex
CREATE INDEX "product_logs_event_type_idx" ON "product_logs"("event_type");

-- CreateIndex
CREATE INDEX "product_logs_created_at_idx" ON "product_logs"("created_at");

-- CreateIndex
CREATE INDEX "product_logs_user_id_created_at_idx" ON "product_logs"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "product_logs" ADD CONSTRAINT "product_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
