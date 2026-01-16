-- Step 2: Migrate existing organization member data
-- This migration runs after enum values have been committed
-- Note: Enum values should already exist from migration 20260115174209_add_organization_invitations

-- Migrate OWNER -> ORGANIZATION_ADMIN (only if ORGANIZATION_ADMIN enum value exists)
DO $$
BEGIN
    -- Check if ORGANIZATION_ADMIN exists in the enum
    IF EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'OrganizationMemberRole'
        AND e.enumlabel = 'ORGANIZATION_ADMIN'
    ) THEN
        UPDATE "organization_members" 
        SET role = 'ORGANIZATION_ADMIN'::"OrganizationMemberRole"
        WHERE role::text = 'OWNER';
    END IF;
END $$;

-- Migrate DIRECTOR -> ORGANIZATION_MEMBER
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'OrganizationMemberRole'
        AND e.enumlabel = 'ORGANIZATION_MEMBER'
    ) THEN
        UPDATE "organization_members" 
        SET role = 'ORGANIZATION_MEMBER'::"OrganizationMemberRole"
        WHERE role::text = 'DIRECTOR';
    END IF;
END $$;

-- Migrate MEMBER -> ORGANIZATION_MEMBER
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'OrganizationMemberRole'
        AND e.enumlabel = 'ORGANIZATION_MEMBER'
    ) THEN
        UPDATE "organization_members" 
        SET role = 'ORGANIZATION_MEMBER'::"OrganizationMemberRole"
        WHERE role::text = 'MEMBER';
    END IF;
END $$;
