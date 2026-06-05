-- Change seeded enum-backed role keys to plain text so custom admin roles
-- can be stored without dropping existing data.
ALTER TABLE "admin_invitations"
ALTER COLUMN "role_description" TYPE TEXT
USING "role_description"::text;

ALTER TABLE "admins"
ALTER COLUMN "role_description" TYPE TEXT
USING "role_description"::text;

DROP TYPE IF EXISTS "AdminRole";
