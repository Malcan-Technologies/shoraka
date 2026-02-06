/*
  Warnings:

  - You are about to drop the column `application_id` on the `contracts` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "contracts" DROP CONSTRAINT "contracts_application_id_fkey";

-- DropIndex
DROP INDEX "contracts_application_id_key";

-- AlterTable
ALTER TABLE "applications" ADD COLUMN     "contract_id" TEXT;

-- AlterTable
ALTER TABLE "contracts" DROP COLUMN "application_id";

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
