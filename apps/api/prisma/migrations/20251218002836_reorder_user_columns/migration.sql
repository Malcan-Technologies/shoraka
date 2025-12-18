-- Migration: Reorder User table columns to have user_id first, then email
-- PostgreSQL doesn't support direct column reordering, so we recreate the table

-- Step 1: Create new table with desired column order
CREATE TABLE "users_new" (
  "user_id" VARCHAR(5) NOT NULL,
  "email" VARCHAR(255) NOT NULL,
  "first_name" VARCHAR(255) NOT NULL,
  "last_name" VARCHAR(255) NOT NULL,
  "phone" VARCHAR(255),
  "roles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "cognito_sub" VARCHAR(255) NOT NULL,
  "cognito_username" VARCHAR(255) NOT NULL,
  "investor_onboarding_completed" BOOLEAN NOT NULL DEFAULT false,
  "issuer_onboarding_completed" BOOLEAN NOT NULL DEFAULT false,
  "password_changed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  
  CONSTRAINT "users_new_pkey" PRIMARY KEY ("user_id")
);

-- Step 2: Copy all data from old table to new table
INSERT INTO "users_new" (
  "user_id",
  "email",
  "first_name",
  "last_name",
  "phone",
  "roles",
  "cognito_sub",
  "cognito_username",
  "investor_onboarding_completed",
  "issuer_onboarding_completed",
  "password_changed_at",
  "created_at",
  "updated_at"
)
SELECT 
  "user_id",
  "email",
  "first_name",
  "last_name",
  "phone",
  "roles",
  "cognito_sub",
  "cognito_username",
  "investor_onboarding_completed",
  "issuer_onboarding_completed",
  "password_changed_at",
  "created_at",
  "updated_at"
FROM "users";

-- Step 3: Create indexes and constraints on new table
CREATE UNIQUE INDEX "users_new_email_key" ON "users_new"("email");
CREATE UNIQUE INDEX "users_new_cognito_sub_key" ON "users_new"("cognito_sub");
CREATE INDEX "users_new_cognito_sub_idx" ON "users_new"("cognito_sub");

-- Step 4: Drop old table and rename new table
DROP TABLE "users" CASCADE;
ALTER TABLE "users_new" RENAME TO "users";
ALTER TABLE "users" RENAME CONSTRAINT "users_new_pkey" TO "users_pkey";
ALTER INDEX "users_new_email_key" RENAME TO "users_email_key";
ALTER INDEX "users_new_cognito_sub_key" RENAME TO "users_cognito_sub_key";
ALTER INDEX "users_new_cognito_sub_idx" RENAME TO "users_cognito_sub_idx";

-- Step 5: Recreate all foreign key constraints
ALTER TABLE "loans" ADD CONSTRAINT "loans_borrower_id_fkey" FOREIGN KEY ("borrower_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "investments" ADD CONSTRAINT "investments_investor_id_fkey" FOREIGN KEY ("investor_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "admins" ADD CONSTRAINT "admins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "admin_invitations" ADD CONSTRAINT "admin_invitations_invited_by_user_id_fkey" FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "security_logs" ADD CONSTRAINT "security_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "onboarding_logs" ADD CONSTRAINT "onboarding_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "investor_organizations" ADD CONSTRAINT "investor_organizations_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "issuer_organizations" ADD CONSTRAINT "issuer_organizations_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

