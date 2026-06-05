UPDATE "admins" AS a
SET "role_id" = r."id"
FROM "admin_roles" AS r
WHERE a."role_id" IS NULL
  AND r."key" = a."role_description"::text;
