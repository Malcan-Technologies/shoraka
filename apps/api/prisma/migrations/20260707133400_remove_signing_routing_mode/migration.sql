-- Drop signer routing mode; signers may sign in any order. Document order is controlled separately.
ALTER TABLE "signing_envelopes" DROP COLUMN "routing_mode";

DROP TYPE "SigningRoutingMode";
