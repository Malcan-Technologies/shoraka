-- Explicit marker for initial CTOS/RegTank regulatory structure establishment.
-- User-added directors/shareholders alone must not count as established.

ALTER TABLE "issuer_organizations"
  ADD COLUMN "regulatory_structure_established_at" TIMESTAMP(3);

ALTER TABLE "investor_organizations"
  ADD COLUMN "regulatory_structure_established_at" TIMESTAMP(3);

UPDATE "issuer_organizations" AS io
SET "regulatory_structure_established_at" = CURRENT_TIMESTAMP
WHERE io."regulatory_structure_established_at" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "organization_party_profiles" AS p
    WHERE p."issuer_organization_id" = io."id"
      AND (
        p."origin" IN ('CTOS_PARTY', 'REGTANK_PARTY')
        OR p."membership_status" = 'EXTERNAL_OBSERVED'
        OR p."external_observation" IS NOT NULL
      )
  );

UPDATE "investor_organizations" AS vo
SET "regulatory_structure_established_at" = CURRENT_TIMESTAMP
WHERE vo."regulatory_structure_established_at" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "organization_party_profiles" AS p
    WHERE p."investor_organization_id" = vo."id"
      AND (
        p."origin" IN ('CTOS_PARTY', 'REGTANK_PARTY')
        OR p."membership_status" = 'EXTERNAL_OBSERVED'
        OR p."external_observation" IS NOT NULL
      )
  );
