-- Drop unused product-level offer expiry (replaced by phase clocks on workflow config).
ALTER TABLE "products" DROP COLUMN IF EXISTS "offer_expiry_days";
