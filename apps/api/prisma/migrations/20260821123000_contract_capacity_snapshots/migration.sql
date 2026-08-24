-- Typed dual-ledger snapshots on contracts. Invoices/notes remain source of truth;
-- contract_details JSON occupancy fields stay synchronized by application code.
-- Existing over-limit (negative available / remaining) values are preserved.

ALTER TABLE "contracts"
ADD COLUMN "approved_facility" DECIMAL(18,6) NOT NULL DEFAULT 0,
ADD COLUMN "utilized_facility" DECIMAL(18,6) NOT NULL DEFAULT 0,
ADD COLUMN "pending_facility" DECIMAL(18,6) NOT NULL DEFAULT 0,
ADD COLUMN "repaid_facility" DECIMAL(18,6) NOT NULL DEFAULT 0,
ADD COLUMN "available_facility" DECIMAL(18,6) NOT NULL DEFAULT 0,
ADD COLUMN "lifetime_cap" DECIMAL(18,6) NOT NULL DEFAULT 0,
ADD COLUMN "lifetime_used" DECIMAL(18,6) NOT NULL DEFAULT 0,
ADD COLUMN "lifetime_remaining" DECIMAL(18,6) NOT NULL DEFAULT 0;
