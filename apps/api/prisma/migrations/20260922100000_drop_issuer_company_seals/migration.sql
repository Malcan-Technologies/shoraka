-- Company-seal images live on SigningCloud's portal. Drop CashSouk storage
-- and the frozen assignment pointer used for stampimg reupload.

ALTER TABLE "signing_assignments" DROP CONSTRAINT "signing_assignments_frozen_company_seal_id_fkey";

DROP INDEX "signing_assignments_frozen_company_seal_id_idx";

ALTER TABLE "signing_assignments" DROP COLUMN "frozen_company_seal_id";

DROP TABLE "issuer_organization_company_seals";
