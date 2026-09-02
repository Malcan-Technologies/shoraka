-- Rename OrganizationPartyOrigin.USER_MANAGEMENT → USER_ADDED.
-- Existing rows are remapped; no party profile rows are deleted.
-- PostgreSQL cannot drop an enum value in-place, so the type is replaced.

ALTER TYPE "OrganizationPartyOrigin" RENAME TO "OrganizationPartyOrigin_old";

CREATE TYPE "OrganizationPartyOrigin" AS ENUM ('CTOS_PARTY', 'REGTANK_PARTY', 'USER_ADDED');

ALTER TABLE "organization_party_profiles"
  ALTER COLUMN "origin" TYPE "OrganizationPartyOrigin"
  USING (
    CASE
      WHEN "origin"::text = 'USER_MANAGEMENT' THEN 'USER_ADDED'
      ELSE "origin"::text
    END
  )::"OrganizationPartyOrigin";

DROP TYPE "OrganizationPartyOrigin_old";
