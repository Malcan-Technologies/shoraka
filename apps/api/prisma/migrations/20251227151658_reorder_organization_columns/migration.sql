-- Reorder columns in investor_organizations table to match Prisma schema
-- PostgreSQL doesn't support direct column reordering, so we recreate the table

-- Step 0: Drop foreign key constraints from referencing tables (if they exist)
ALTER TABLE "organization_members" DROP CONSTRAINT IF EXISTS "organization_members_investor_organization_id_fkey";

-- Drop constraint from regtank_onboarding (IF EXISTS handles case where table/constraint doesn't exist)
DO $$
BEGIN
  ALTER TABLE "regtank_onboarding" DROP CONSTRAINT IF EXISTS "regtank_onboarding_investor_organization_id_fkey";
EXCEPTION
  WHEN undefined_table THEN
    -- Table doesn't exist in shadow database, ignore
    NULL;
END $$;

-- Step 1: Create new table with correct column order
CREATE TABLE "investor_organizations_new" (
  "id" TEXT NOT NULL,
  "owner_user_id" TEXT NOT NULL,
  "type" "OrganizationType" NOT NULL,
  "name" TEXT,
  "registration_number" TEXT,
  "onboarding_status" "OnboardingStatus" NOT NULL DEFAULT 'PENDING',
  "onboarded_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "first_name" TEXT,
  "last_name" TEXT,
  "middle_name" TEXT,
  "nationality" TEXT,
  "country" TEXT,
  "id_issuing_country" TEXT,
  "gender" TEXT,
  "address" TEXT,
  "date_of_birth" TIMESTAMP(3),
  "document_type" TEXT,
  "document_number" TEXT,
  "phone_number" TEXT,
  "kyc_id" TEXT,
  "bank_account_details" JSONB,
  "wealth_declaration" JSONB,
  "compliance_declaration" JSONB,
  "document_info" JSONB,
  "liveness_check_info" JSONB,
  CONSTRAINT "investor_organizations_new_pkey" PRIMARY KEY ("id")
);

-- Step 2: Copy data from old table to new table
INSERT INTO "investor_organizations_new" (
  "id",
  "owner_user_id",
  "type",
  "name",
  "registration_number",
  "onboarding_status",
  "onboarded_at",
  "created_at",
  "updated_at",
  "first_name",
  "last_name",
  "middle_name",
  "nationality",
  "country",
  "id_issuing_country",
  "gender",
  "address",
  "date_of_birth",
  "document_type",
  "document_number",
  "phone_number",
  "kyc_id",
  "bank_account_details",
  "wealth_declaration",
  "compliance_declaration",
  "document_info",
  "liveness_check_info"
)
SELECT 
  "id",
  "owner_user_id",
  "type",
  "name",
  "registration_number",
  "onboarding_status",
  "onboarded_at",
  "created_at",
  "updated_at",
  "first_name",
  "last_name",
  "middle_name",
  "nationality",
  "country",
  "id_issuing_country",
  "gender",
  "address",
  "date_of_birth",
  "document_type",
  "document_number",
  "phone_number",
  "kyc_id",
  "bank_account_details",
  "wealth_declaration",
  "compliance_declaration",
  "document_info",
  "liveness_check_info"
FROM "investor_organizations";

-- Step 3: Drop old table
DROP TABLE "investor_organizations";

-- Step 4: Rename new table
ALTER TABLE "investor_organizations_new" RENAME TO "investor_organizations";

-- Step 5: Recreate foreign key constraints
ALTER TABLE "investor_organizations" ADD CONSTRAINT "investor_organizations_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 6: Recreate indexes
CREATE INDEX "investor_organizations_owner_user_id_idx" ON "investor_organizations"("owner_user_id");
CREATE INDEX "investor_organizations_owner_user_id_type_idx" ON "investor_organizations"("owner_user_id", "type");
CREATE INDEX "investor_organizations_onboarding_status_idx" ON "investor_organizations"("onboarding_status");

-- Step 7: Recreate foreign key constraints from referencing tables
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_investor_organization_id_fkey" FOREIGN KEY ("investor_organization_id") REFERENCES "investor_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Recreate constraint on regtank_onboarding (only if table exists)
DO $$
BEGIN
  ALTER TABLE "regtank_onboarding" ADD CONSTRAINT "regtank_onboarding_investor_organization_id_fkey" FOREIGN KEY ("investor_organization_id") REFERENCES "investor_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN
    -- Table doesn't exist in shadow database, ignore
    NULL;
END $$;

-- Reorder columns in issuer_organizations table to match Prisma schema

-- Step 0: Drop foreign key constraints from referencing tables (if they exist)
ALTER TABLE "organization_members" DROP CONSTRAINT IF EXISTS "organization_members_issuer_organization_id_fkey";

-- Drop constraint from regtank_onboarding (IF EXISTS handles case where table/constraint doesn't exist)
DO $$
BEGIN
  ALTER TABLE "regtank_onboarding" DROP CONSTRAINT IF EXISTS "regtank_onboarding_issuer_organization_id_fkey";
EXCEPTION
  WHEN undefined_table THEN
    -- Table doesn't exist in shadow database, ignore
    NULL;
END $$;

-- Step 1: Create new table with correct column order
CREATE TABLE "issuer_organizations_new" (
  "id" TEXT NOT NULL,
  "owner_user_id" TEXT NOT NULL,
  "type" "OrganizationType" NOT NULL,
  "name" TEXT,
  "registration_number" TEXT,
  "onboarding_status" "OnboardingStatus" NOT NULL DEFAULT 'PENDING',
  "onboarded_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "first_name" TEXT,
  "last_name" TEXT,
  "middle_name" TEXT,
  "nationality" TEXT,
  "country" TEXT,
  "id_issuing_country" TEXT,
  "gender" TEXT,
  "address" TEXT,
  "date_of_birth" TIMESTAMP(3),
  "document_type" TEXT,
  "document_number" TEXT,
  "phone_number" TEXT,
  "kyc_id" TEXT,
  "bank_account_details" JSONB,
  "wealth_declaration" JSONB,
  "compliance_declaration" JSONB,
  "document_info" JSONB,
  "liveness_check_info" JSONB,
  CONSTRAINT "issuer_organizations_new_pkey" PRIMARY KEY ("id")
);

-- Step 2: Copy data from old table to new table
INSERT INTO "issuer_organizations_new" (
  "id",
  "owner_user_id",
  "type",
  "name",
  "registration_number",
  "onboarding_status",
  "onboarded_at",
  "created_at",
  "updated_at",
  "first_name",
  "last_name",
  "middle_name",
  "nationality",
  "country",
  "id_issuing_country",
  "gender",
  "address",
  "date_of_birth",
  "document_type",
  "document_number",
  "phone_number",
  "kyc_id",
  "bank_account_details",
  "wealth_declaration",
  "compliance_declaration",
  "document_info",
  "liveness_check_info"
)
SELECT 
  "id",
  "owner_user_id",
  "type",
  "name",
  "registration_number",
  "onboarding_status",
  "onboarded_at",
  "created_at",
  "updated_at",
  "first_name",
  "last_name",
  "middle_name",
  "nationality",
  "country",
  "id_issuing_country",
  "gender",
  "address",
  "date_of_birth",
  "document_type",
  "document_number",
  "phone_number",
  "kyc_id",
  "bank_account_details",
  "wealth_declaration",
  "compliance_declaration",
  "document_info",
  "liveness_check_info"
FROM "issuer_organizations";

-- Step 3: Drop old table
DROP TABLE "issuer_organizations";

-- Step 4: Rename new table
ALTER TABLE "issuer_organizations_new" RENAME TO "issuer_organizations";

-- Step 5: Recreate foreign key constraints
ALTER TABLE "issuer_organizations" ADD CONSTRAINT "issuer_organizations_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 6: Recreate indexes
CREATE INDEX "issuer_organizations_owner_user_id_idx" ON "issuer_organizations"("owner_user_id");
CREATE INDEX "issuer_organizations_owner_user_id_type_idx" ON "issuer_organizations"("owner_user_id", "type");
CREATE INDEX "issuer_organizations_onboarding_status_idx" ON "issuer_organizations"("onboarding_status");

-- Step 7: Recreate foreign key constraints from referencing tables
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_issuer_organization_id_fkey" FOREIGN KEY ("issuer_organization_id") REFERENCES "issuer_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Recreate constraint on regtank_onboarding (only if table exists)
DO $$
BEGIN
  ALTER TABLE "regtank_onboarding" ADD CONSTRAINT "regtank_onboarding_issuer_organization_id_fkey" FOREIGN KEY ("issuer_organization_id") REFERENCES "issuer_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN
    -- Table doesn't exist in shadow database, ignore
    NULL;
END $$;
