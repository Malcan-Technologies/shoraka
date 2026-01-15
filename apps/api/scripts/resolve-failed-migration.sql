-- Script to resolve failed migration 20260115174209_add_organization_invitations
-- Run this manually in your database before re-running migrations

-- Option 1: Mark the migration as rolled back (if it partially applied)
-- This allows Prisma to re-run the migration
UPDATE "_prisma_migrations"
SET finished_at = NULL,
    applied_steps_count = 0
WHERE migration_name = '20260115174209_add_organization_invitations'
  AND finished_at IS NULL;

-- Option 2: If the migration partially succeeded, you may need to clean up first
-- Check if tables exist and enum values were added, then either:
-- A) Drop the tables if they exist (if migration partially applied)
-- DROP TABLE IF EXISTS "issuer_organization_invitations";
-- DROP TABLE IF EXISTS "investor_organization_invitations";

-- B) Or mark as applied if everything is already there
-- UPDATE "_prisma_migrations"
-- SET finished_at = NOW(),
--     applied_steps_count = (SELECT COUNT(*) FROM unnest(string_to_array(migration, E'\n')) AS line WHERE line ~ '^[^--]' AND line !~ '^\s*$')
-- WHERE migration_name = '20260115174209_add_organization_invitations';
