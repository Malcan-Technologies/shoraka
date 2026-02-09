/*
  Warnings:

  - A unique constraint covering the columns `[application_id]` on the table `contracts` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `application_id` to the `contracts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `issuer_organization_id` to the `contracts` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "contracts" ADD COLUMN     "application_id" TEXT NOT NULL,
ADD COLUMN     "contract_details" JSONB,
ADD COLUMN     "customer_details" JSONB,
ADD COLUMN     "issuer_organization_id" TEXT NOT NULL,
ADD COLUMN     "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT';

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT,
    "application_id" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invoices_contract_id_idx" ON "invoices"("contract_id");

-- CreateIndex
CREATE INDEX "invoices_application_id_idx" ON "invoices"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_application_id_key" ON "contracts"("application_id");

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_issuer_organization_id_fkey" FOREIGN KEY ("issuer_organization_id") REFERENCES "issuer_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
