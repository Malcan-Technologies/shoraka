-- OPTIONAL Person ↔ User link.
-- OrganizationPartyProfile remains company/regulatory identity (party_key).
-- OrganizationMember remains platform access. Do not infer this from email.

ALTER TABLE "organization_party_profiles" ADD COLUMN "user_id" VARCHAR(5);

ALTER TABLE "organization_party_profiles"
  ADD CONSTRAINT "organization_party_profiles_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "organization_party_profiles_user_id_idx"
  ON "organization_party_profiles"("user_id");

-- One User may be linked to at most one person in the same organization.
-- The same User may still be linked across different organizations.
CREATE UNIQUE INDEX "organization_party_profiles_issuer_org_user_id_key"
  ON "organization_party_profiles" ("issuer_organization_id", "user_id")
  WHERE "issuer_organization_id" IS NOT NULL AND "user_id" IS NOT NULL;
CREATE UNIQUE INDEX "organization_party_profiles_investor_org_user_id_key"
  ON "organization_party_profiles" ("investor_organization_id", "user_id")
  WHERE "investor_organization_id" IS NOT NULL AND "user_id" IS NOT NULL;

ALTER TABLE "investor_organization_invitation" ADD COLUMN "organization_party_profile_id" TEXT;
ALTER TABLE "issuer_organization_invitation" ADD COLUMN "organization_party_profile_id" TEXT;

ALTER TABLE "investor_organization_invitation"
  ADD CONSTRAINT "investor_organization_invitation_organization_party_profile_id_fkey"
  FOREIGN KEY ("organization_party_profile_id") REFERENCES "organization_party_profiles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "issuer_organization_invitation"
  ADD CONSTRAINT "issuer_organization_invitation_organization_party_profile_id_fkey"
  FOREIGN KEY ("organization_party_profile_id") REFERENCES "organization_party_profiles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "investor_organization_invitation_organization_party_profile_id_idx"
  ON "investor_organization_invitation"("organization_party_profile_id");
CREATE INDEX "issuer_organization_invitation_organization_party_profile_id_idx"
  ON "issuer_organization_invitation"("organization_party_profile_id");
