/*
  Warnings:

  - You are about to drop the `shoraka_certificates` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "shoraka_certificates" DROP CONSTRAINT "shoraka_certificates_shoraka_trade_order_id_fkey";

-- AlterTable
ALTER TABLE "shoraka_trade_orders" ADD COLUMN     "certificate_file_sha256" TEXT,
ADD COLUMN     "certificate_s3_key" TEXT,
ADD COLUMN     "certificate_uploaded_at" TIMESTAMP(3),
ADD COLUMN     "provider_certificate_id" TEXT;

-- DropTable
DROP TABLE "shoraka_certificates";
