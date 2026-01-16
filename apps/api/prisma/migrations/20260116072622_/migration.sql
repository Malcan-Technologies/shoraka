/*
  Warnings:

  - The values [OWNER,DIRECTOR,MEMBER] on the enum `OrganizationMemberRole` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
-- Execute entire migration in a single DO block to handle partial failures
DO $$
DECLARE
    migration_complete BOOLEAN := FALSE;
    old_type_exists BOOLEAN := FALSE;
    new_type_exists BOOLEAN := FALSE;
BEGIN
    -- Check if migration is already complete (new enum values exist)
    SELECT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'OrganizationMemberRole'
        AND e.enumlabel = 'ORGANIZATION_ADMIN'
    ) INTO migration_complete;
    
    -- If migration already complete, skip everything
    IF migration_complete THEN
        RAISE NOTICE 'Migration already complete, skipping';
        RETURN;
    END IF;
    
    -- Check current state of types
    SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrganizationMemberRole') INTO old_type_exists;
    SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrganizationMemberRole_new') INTO new_type_exists;
    
    -- Clean up any partial migration state
    IF new_type_exists THEN
        DROP TYPE IF EXISTS "OrganizationMemberRole_new" CASCADE;
    END IF;
    
    DROP TYPE IF EXISTS "OrganizationMemberRole_old";
    
    -- Create the new enum type
    CREATE TYPE "OrganizationMemberRole_new" AS ENUM ('ORGANIZATION_ADMIN', 'ORGANIZATION_MEMBER');
    
    -- Update organization_members table
    IF old_type_exists THEN
        ALTER TABLE "organization_members" ALTER COLUMN "role" TYPE "OrganizationMemberRole_new" USING (
          CASE "role"::text
            WHEN 'OWNER' THEN CAST('ORGANIZATION_ADMIN' AS "OrganizationMemberRole_new")
            WHEN 'DIRECTOR' THEN CAST('ORGANIZATION_ADMIN' AS "OrganizationMemberRole_new")
            WHEN 'MEMBER' THEN CAST('ORGANIZATION_MEMBER' AS "OrganizationMemberRole_new")
            ELSE CAST('ORGANIZATION_MEMBER' AS "OrganizationMemberRole_new")
          END
        );
    END IF;
    
    -- Update investor_organization_invitations table if it exists
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'public' 
               AND table_name = 'investor_organization_invitations')
       AND old_type_exists THEN
        ALTER TABLE "investor_organization_invitations" ALTER COLUMN "role" TYPE "OrganizationMemberRole_new" USING (
          CASE "role"::text
            WHEN 'OWNER' THEN CAST('ORGANIZATION_ADMIN' AS "OrganizationMemberRole_new")
            WHEN 'DIRECTOR' THEN CAST('ORGANIZATION_ADMIN' AS "OrganizationMemberRole_new")
            WHEN 'MEMBER' THEN CAST('ORGANIZATION_MEMBER' AS "OrganizationMemberRole_new")
            ELSE CAST('ORGANIZATION_MEMBER' AS "OrganizationMemberRole_new")
          END
        );
    END IF;
    
    -- Update issuer_organization_invitations table if it exists
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'public' 
               AND table_name = 'issuer_organization_invitations')
       AND old_type_exists THEN
        ALTER TABLE "issuer_organization_invitations" ALTER COLUMN "role" TYPE "OrganizationMemberRole_new" USING (
          CASE "role"::text
            WHEN 'OWNER' THEN CAST('ORGANIZATION_ADMIN' AS "OrganizationMemberRole_new")
            WHEN 'DIRECTOR' THEN CAST('ORGANIZATION_ADMIN' AS "OrganizationMemberRole_new")
            WHEN 'MEMBER' THEN CAST('ORGANIZATION_MEMBER' AS "OrganizationMemberRole_new")
            ELSE CAST('ORGANIZATION_MEMBER' AS "OrganizationMemberRole_new")
          END
        );
    END IF;
    
    -- Rename types
    IF old_type_exists THEN
        ALTER TYPE "OrganizationMemberRole" RENAME TO "OrganizationMemberRole_old";
    END IF;
    
    ALTER TYPE "OrganizationMemberRole_new" RENAME TO "OrganizationMemberRole";
    
    -- Clean up old type
    DROP TYPE IF EXISTS "OrganizationMemberRole_old";
END $$;
