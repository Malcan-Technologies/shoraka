-- Fix owner roles: Update all organization members who are owners to have ORGANIZATION_ADMIN role

-- Update investor organization members where user is the owner
UPDATE "organization_members" om
SET "role" = 'ORGANIZATION_ADMIN'
FROM "investor_organizations" io
WHERE om."investor_organization_id" = io."id"
  AND om."user_id" = io."owner_user_id"
  AND om."role" = 'ORGANIZATION_MEMBER';

-- Update issuer organization members where user is the owner  
UPDATE "organization_members" om
SET "role" = 'ORGANIZATION_ADMIN'
FROM "issuer_organizations" io
WHERE om."issuer_organization_id" = io."id"
  AND om."user_id" = io."owner_user_id"
  AND om."role" = 'ORGANIZATION_MEMBER';
