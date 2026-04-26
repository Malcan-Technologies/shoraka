-- CTOS party supplements: support investor organizations (XOR FKs; partial unique per portal).
ALTER TABLE "ctos_party_supplements" ADD COLUMN "issuer_organization_id" TEXT;
ALTER TABLE "ctos_party_supplements" ADD COLUMN "investor_organization_id" TEXT;

UPDATE "ctos_party_supplements" SET "issuer_organization_id" = "organization_id";

ALTER TABLE "ctos_party_supplements" DROP CONSTRAINT IF EXISTS "ctos_party_supplements_organization_id_fkey";
DROP INDEX IF EXISTS "ctos_party_supplements_organization_id_party_key_key";
DROP INDEX IF EXISTS "ctos_party_supplements_organization_id_idx";

ALTER TABLE "ctos_party_supplements" DROP COLUMN "organization_id";

ALTER TABLE "ctos_party_supplements" ADD CONSTRAINT "ctos_party_supplements_issuer_organization_id_fkey"
  FOREIGN KEY ("issuer_organization_id") REFERENCES "issuer_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ctos_party_supplements" ADD CONSTRAINT "ctos_party_supplements_investor_organization_id_fkey"
  FOREIGN KEY ("investor_organization_id") REFERENCES "investor_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ctos_party_supplements" ADD CONSTRAINT "ctos_party_supplements_org_xor_ck" CHECK (
  (CASE WHEN "issuer_organization_id" IS NOT NULL THEN 1 ELSE 0 END)
  + (CASE WHEN "investor_organization_id" IS NOT NULL THEN 1 ELSE 0 END) = 1
);

CREATE UNIQUE INDEX "ctos_party_supplements_issuer_org_party_key_key"
  ON "ctos_party_supplements" ("issuer_organization_id", "party_key")
  WHERE "issuer_organization_id" IS NOT NULL;
CREATE UNIQUE INDEX "ctos_party_supplements_investor_org_party_key_key"
  ON "ctos_party_supplements" ("investor_organization_id", "party_key")
  WHERE "investor_organization_id" IS NOT NULL;

-- Btree indexes for org-scoped lookups (were in 20260426172816_ctos but that timestamp ran before columns existed).
CREATE INDEX IF NOT EXISTS "ctos_party_supplements_issuer_organization_id_idx" ON "ctos_party_supplements"("issuer_organization_id");
CREATE INDEX IF NOT EXISTS "ctos_party_supplements_investor_organization_id_idx" ON "ctos_party_supplements"("investor_organization_id");
