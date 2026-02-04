/*
  Warnings:

  - You are about to drop the column `contract_details` on the `applications` table. All the data in the column will be lost.
  - You are about to drop the column `invoice_details` on the `applications` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "applications" DROP COLUMN "contract_details",
DROP COLUMN "invoice_details";
