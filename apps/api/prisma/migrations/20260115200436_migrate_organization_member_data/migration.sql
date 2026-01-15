-- Step 2: Migrate existing organization member data
-- This migration runs after enum values have been committed

-- Migrate OWNER -> ORGANIZATION_ADMIN
UPDATE "organization_members" 
SET role = 'ORGANIZATION_ADMIN'::"OrganizationMemberRole"
WHERE role::text = 'OWNER';

-- Migrate DIRECTOR -> ORGANIZATION_MEMBER
UPDATE "organization_members" 
SET role = 'ORGANIZATION_MEMBER'::"OrganizationMemberRole"
WHERE role::text = 'DIRECTOR';

-- Migrate MEMBER -> ORGANIZATION_MEMBER
UPDATE "organization_members" 
SET role = 'ORGANIZATION_MEMBER'::"OrganizationMemberRole"
WHERE role::text = 'MEMBER';
