-- AlterTable
ALTER TABLE "investor_organizations" RENAME CONSTRAINT "investor_organizations_new_pkey" TO "investor_organizations_pkey";

-- AlterTable
ALTER TABLE "issuer_organizations" RENAME CONSTRAINT "issuer_organizations_new_pkey" TO "issuer_organizations_pkey";
