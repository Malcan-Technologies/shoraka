-- Snapshot payer unique ID (IVT-/ISS-) and company registration on gateway receipts.
ALTER TABLE "gateway_payment_receipts"
ADD COLUMN "payer_unique_id" TEXT,
ADD COLUMN "payer_registration_number" TEXT;
