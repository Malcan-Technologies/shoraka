-- Person Email master + drop duplicate issuer company_email.
-- Fill-empty Type of Company from confirmed RegTank entityType strings only.

ALTER TABLE "organization_party_profiles" ADD COLUMN "email" TEXT;

UPDATE "organization_party_profiles" AS opp
SET "email" = lower(trim(s."onboarding_json"->>'email'))
FROM "ctos_party_supplements" AS s
WHERE opp."email" IS NULL
  AND s."party_key" = opp."party_key"
  AND trim(COALESCE(s."onboarding_json"->>'email', '')) <> ''
  AND (
    (opp."issuer_organization_id" IS NOT NULL AND s."issuer_organization_id" = opp."issuer_organization_id")
    OR (opp."investor_organization_id" IS NOT NULL AND s."investor_organization_id" = opp."investor_organization_id")
  );

UPDATE "organization_party_profiles" AS opp
SET "email" = lower(trim(src.email))
FROM (
  SELECT
    io.id AS issuer_id,
    NULL::text AS investor_id,
    lower(trim(elem->'personalInfo'->>'email')) AS email,
    lower(regexp_replace(COALESCE(elem->'personalInfo'->>'identityNumber', elem->>'identityNumber', ''), '[^a-zA-Z0-9]', '', 'g')) AS id_key
  FROM "issuer_organizations" io
  CROSS JOIN LATERAL jsonb_array_elements(
    COALESCE(io."corporate_entities"::jsonb->'directors', '[]'::jsonb) ||
    COALESCE(io."corporate_entities"::jsonb->'shareholders', '[]'::jsonb)
  ) AS elem
  UNION ALL
  SELECT
    NULL::text,
    iv.id,
    lower(trim(elem->'personalInfo'->>'email')),
    lower(regexp_replace(COALESCE(elem->'personalInfo'->>'identityNumber', elem->>'identityNumber', ''), '[^a-zA-Z0-9]', '', 'g'))
  FROM "investor_organizations" iv
  CROSS JOIN LATERAL jsonb_array_elements(
    COALESCE(iv."corporate_entities"::jsonb->'directors', '[]'::jsonb) ||
    COALESCE(iv."corporate_entities"::jsonb->'shareholders', '[]'::jsonb)
  ) AS elem
) AS src
WHERE opp."email" IS NULL
  AND trim(COALESCE(src.email, '')) <> ''
  AND src.id_key <> ''
  AND lower(regexp_replace(COALESCE(opp."identity_number", opp."party_key", ''), '[^a-zA-Z0-9]', '', 'g')) = src.id_key
  AND (
    (opp."issuer_organization_id" IS NOT NULL AND opp."issuer_organization_id" = src.issuer_id)
    OR (opp."investor_organization_id" IS NOT NULL AND opp."investor_organization_id" = src.investor_id)
  );

UPDATE "issuer_organizations"
SET "corporate_onboarding_data" = jsonb_set(
  COALESCE("corporate_onboarding_data"::jsonb, '{}'::jsonb),
  '{contactPerson}',
  COALESCE("corporate_onboarding_data"::jsonb->'contactPerson', '{}'::jsonb)
    || jsonb_strip_nulls(jsonb_build_object(
      'email', COALESCE(
        NULLIF(trim(COALESCE("corporate_onboarding_data"::jsonb->'contactPerson'->>'email', '')), ''),
        NULLIF(trim(COALESCE("company_email", '')), '')
      )
    )),
  true
)
WHERE trim(COALESCE("company_email", '')) <> ''
  AND trim(COALESCE("corporate_onboarding_data"::jsonb->'contactPerson'->>'email', '')) = '';

UPDATE "issuer_organizations"
SET "corporate_onboarding_data" = jsonb_set(
  COALESCE("corporate_onboarding_data"::jsonb, '{}'::jsonb),
  '{contactPerson}',
  jsonb_strip_nulls(jsonb_build_object(
    'name', "corporate_onboarding_data"::jsonb->'personInCharge'->>'name',
    'position', "corporate_onboarding_data"::jsonb->'personInCharge'->>'position',
    'email', COALESCE(
      NULLIF(trim(COALESCE("company_email", '')), ''),
      "corporate_onboarding_data"::jsonb->'personInCharge'->>'email'
    ),
    'contact', "corporate_onboarding_data"::jsonb->'personInCharge'->>'contactNumber'
  )),
  true
)
WHERE (
  trim(COALESCE("corporate_onboarding_data"::jsonb->'contactPerson'->>'name', '')) = ''
  AND trim(COALESCE("corporate_onboarding_data"::jsonb->'contactPerson'->>'position', '')) = ''
  AND trim(COALESCE("corporate_onboarding_data"::jsonb->'contactPerson'->>'email', '')) = ''
  AND trim(COALESCE("corporate_onboarding_data"::jsonb->'contactPerson'->>'contact', '')) = ''
)
AND (
  trim(COALESCE("corporate_onboarding_data"::jsonb->'personInCharge'->>'name', '')) <> ''
  OR trim(COALESCE("corporate_onboarding_data"::jsonb->'personInCharge'->>'position', '')) <> ''
  OR trim(COALESCE("corporate_onboarding_data"::jsonb->'personInCharge'->>'email', '')) <> ''
  OR trim(COALESCE("corporate_onboarding_data"::jsonb->'personInCharge'->>'contactNumber', '')) <> ''
  OR trim(COALESCE("company_email", '')) <> ''
);

UPDATE "investor_organizations"
SET "corporate_onboarding_data" = jsonb_set(
  COALESCE("corporate_onboarding_data"::jsonb, '{}'::jsonb),
  '{contactPerson}',
  jsonb_strip_nulls(jsonb_build_object(
    'name', "corporate_onboarding_data"::jsonb->'personInCharge'->>'name',
    'position', "corporate_onboarding_data"::jsonb->'personInCharge'->>'position',
    'email', "corporate_onboarding_data"::jsonb->'personInCharge'->>'email',
    'contact', "corporate_onboarding_data"::jsonb->'personInCharge'->>'contactNumber'
  )),
  true
)
WHERE (
  trim(COALESCE("corporate_onboarding_data"::jsonb->'contactPerson'->>'name', '')) = ''
  AND trim(COALESCE("corporate_onboarding_data"::jsonb->'contactPerson'->>'position', '')) = ''
  AND trim(COALESCE("corporate_onboarding_data"::jsonb->'contactPerson'->>'email', '')) = ''
  AND trim(COALESCE("corporate_onboarding_data"::jsonb->'contactPerson'->>'contact', '')) = ''
)
AND (
  trim(COALESCE("corporate_onboarding_data"::jsonb->'personInCharge'->>'name', '')) <> ''
  OR trim(COALESCE("corporate_onboarding_data"::jsonb->'personInCharge'->>'position', '')) <> ''
  OR trim(COALESCE("corporate_onboarding_data"::jsonb->'personInCharge'->>'email', '')) <> ''
  OR trim(COALESCE("corporate_onboarding_data"::jsonb->'personInCharge'->>'contactNumber', '')) <> ''
);

UPDATE "issuer_organizations"
SET "sc_company_type" = 'PRIVATE_LIMITED'
WHERE "sc_company_type" IS NULL
  AND lower(trim(COALESCE("corporate_onboarding_data"::jsonb->'basicInfo'->>'entityType', ''))) = 'private limited company (sdn bhd)';

UPDATE "issuer_organizations"
SET "sc_company_type" = 'LLP'
WHERE "sc_company_type" IS NULL
  AND lower(trim(COALESCE("corporate_onboarding_data"::jsonb->'basicInfo'->>'entityType', ''))) = 'limited liability partnerships';

ALTER TABLE "issuer_organizations" DROP COLUMN "company_email";
