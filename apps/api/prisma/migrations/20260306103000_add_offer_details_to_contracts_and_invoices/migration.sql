ALTER TABLE "contracts"
ADD COLUMN "offer_details" JSONB;

ALTER TABLE "invoices"
ADD COLUMN "offer_details" JSONB;
