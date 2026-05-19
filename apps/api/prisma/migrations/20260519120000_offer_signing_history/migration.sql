-- AlterTable
ALTER TABLE "contracts" ADD COLUMN "offer_signing_history" JSONB;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN "offer_signing_history" JSONB;
