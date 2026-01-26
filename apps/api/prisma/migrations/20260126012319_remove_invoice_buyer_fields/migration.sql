/*
  Warnings:

  - You are about to drop the column `buyer_details` on the `applications` table. All the data in the column will be lost.
  - You are about to drop the column `invoice_details` on the `applications` table. All the data in the column will be lost.
  - You are about to drop the column `review_submit` on the `applications` table. All the data in the column will be lost.
  - You are about to drop the column `submitted_at` on the `applications` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "applications" DROP COLUMN "buyer_details",
DROP COLUMN "invoice_details",
DROP COLUMN "review_submit",
DROP COLUMN "submitted_at",
ADD COLUMN     "review_and_submit" JSONB;
