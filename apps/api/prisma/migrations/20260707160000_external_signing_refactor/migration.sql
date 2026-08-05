-- External signing refactor: all signers are emailed external parties; eKYC moves to recipients.

-- Drop legacy offer signing columns on contracts/invoices.
ALTER TABLE "contracts" DROP COLUMN IF EXISTS "offer_signing";
ALTER TABLE "contracts" DROP COLUMN IF EXISTS "offer_signing_history";
ALTER TABLE "contracts" DROP COLUMN IF EXISTS "signing_sc_contractnum";

ALTER TABLE "invoices" DROP COLUMN IF EXISTS "offer_signing";
ALTER TABLE "invoices" DROP COLUMN IF EXISTS "offer_signing_history";
ALTER TABLE "invoices" DROP COLUMN IF EXISTS "signing_sc_contractnum";

-- Drop user/org-scoped eKYC table (replaced by per-recipient kyc_* on signing_recipients).
-- NOTE: restored in 20260707170000_restore_shared_signingcloud_ekyc with nullable user_id.
-- DROP TABLE IF EXISTS "signingcloud_ekyc";
-- DROP TYPE IF EXISTS "SigningCloudEkycStatus";

-- Recipients: drop internal/external distinction and plaintext access tokens.
ALTER TABLE "signing_recipients" DROP COLUMN IF EXISTS "party_type";
ALTER TABLE "signing_recipients" DROP COLUMN IF EXISTS "user_id";
DROP TYPE IF EXISTS "SigningPartyType";

ALTER TABLE "signing_recipients" DROP CONSTRAINT IF EXISTS "signing_recipients_access_token_key";
ALTER TABLE "signing_recipients" DROP COLUMN IF EXISTS "access_token";
ALTER TABLE "signing_recipients" ADD COLUMN IF NOT EXISTS "access_token_hash" TEXT;
ALTER TABLE "signing_recipients" ADD COLUMN IF NOT EXISTS "access_code_verified_at" TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS "signing_recipients_access_token_hash_key" ON "signing_recipients"("access_token_hash");
