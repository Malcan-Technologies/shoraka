-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT';
