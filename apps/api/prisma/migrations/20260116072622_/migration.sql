/*
  Warnings:

  - The values [OWNER,DIRECTOR,MEMBER] on the enum `OrganizationMemberRole` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
CREATE TYPE "OrganizationMemberRole_new" AS ENUM ('ORGANIZATION_ADMIN', 'ORGANIZATION_MEMBER');
ALTER TABLE "organization_members" ALTER COLUMN "role" TYPE "OrganizationMemberRole_new" USING (
  CASE "role"::text
    WHEN 'OWNER' THEN CAST('ORGANIZATION_ADMIN' AS "OrganizationMemberRole_new")
    WHEN 'DIRECTOR' THEN CAST('ORGANIZATION_ADMIN' AS "OrganizationMemberRole_new")
    WHEN 'MEMBER' THEN CAST('ORGANIZATION_MEMBER' AS "OrganizationMemberRole_new")
    ELSE CAST('ORGANIZATION_MEMBER' AS "OrganizationMemberRole_new")
  END
);
ALTER TABLE "investor_organization_invitations" ALTER COLUMN "role" TYPE "OrganizationMemberRole_new" USING (
  CASE "role"::text
    WHEN 'OWNER' THEN CAST('ORGANIZATION_ADMIN' AS "OrganizationMemberRole_new")
    WHEN 'DIRECTOR' THEN CAST('ORGANIZATION_ADMIN' AS "OrganizationMemberRole_new")
    WHEN 'MEMBER' THEN CAST('ORGANIZATION_MEMBER' AS "OrganizationMemberRole_new")
    ELSE CAST('ORGANIZATION_MEMBER' AS "OrganizationMemberRole_new")
  END
);
ALTER TABLE "issuer_organization_invitations" ALTER COLUMN "role" TYPE "OrganizationMemberRole_new" USING (
  CASE "role"::text
    WHEN 'OWNER' THEN CAST('ORGANIZATION_ADMIN' AS "OrganizationMemberRole_new")
    WHEN 'DIRECTOR' THEN CAST('ORGANIZATION_ADMIN' AS "OrganizationMemberRole_new")
    WHEN 'MEMBER' THEN CAST('ORGANIZATION_MEMBER' AS "OrganizationMemberRole_new")
    ELSE CAST('ORGANIZATION_MEMBER' AS "OrganizationMemberRole_new")
  END
);
ALTER TYPE "OrganizationMemberRole" RENAME TO "OrganizationMemberRole_old";
ALTER TYPE "OrganizationMemberRole_new" RENAME TO "OrganizationMemberRole";
DROP TYPE "OrganizationMemberRole_old";
