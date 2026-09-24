-- Reserve canonical Investor Schedule reference for Tawarruq/STP
-- prior to Investment Note Certificate generation.

ALTER TABLE "notes"
ADD COLUMN IF NOT EXISTS "reserved_investor_schedule_reference" TEXT,
ADD COLUMN IF NOT EXISTS "reserved_investor_schedule_reference_version" TEXT;

