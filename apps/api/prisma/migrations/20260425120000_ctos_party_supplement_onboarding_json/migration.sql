-- Move party email into onboarding_json; drop legacy email column.

ALTER TABLE "ctos_party_supplements" ADD COLUMN "onboarding_json" JSONB;

UPDATE "ctos_party_supplements"
SET "onboarding_json" = jsonb_build_object('email', "email")
WHERE "email" IS NOT NULL AND trim("email") <> '';

ALTER TABLE "ctos_party_supplements" DROP COLUMN "email";
