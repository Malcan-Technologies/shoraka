-- Migration: Refactor User schema to use user_id as primary key
-- This migration handles both fresh databases and existing databases with data
-- For fresh databases: Schema changes are handled by Prisma, this migration is mostly a no-op
-- For existing databases: Migrates data from id to user_id

-- Step 1: Drop ALL foreign key constraints that reference users table (must be done first)
-- This must happen before we can drop the primary key constraint
DO $$
BEGIN
    -- Drop foreign key constraints if tables exist
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'loans') THEN
        ALTER TABLE "loans" DROP CONSTRAINT IF EXISTS "loans_borrower_id_fkey";
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'investments') THEN
        ALTER TABLE "investments" DROP CONSTRAINT IF EXISTS "investments_investor_id_fkey";
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'access_logs') THEN
        ALTER TABLE "access_logs" DROP CONSTRAINT IF EXISTS "access_logs_user_id_fkey";
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_sessions') THEN
        ALTER TABLE "user_sessions" DROP CONSTRAINT IF EXISTS "user_sessions_user_id_fkey";
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admins') THEN
        ALTER TABLE "admins" DROP CONSTRAINT IF EXISTS "admins_user_id_fkey";
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_invitations') THEN
        ALTER TABLE "admin_invitations" DROP CONSTRAINT IF EXISTS "admin_invitations_invited_by_user_id_fkey";
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'security_logs') THEN
        ALTER TABLE "security_logs" DROP CONSTRAINT IF EXISTS "security_logs_user_id_fkey";
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'onboarding_logs') THEN
        ALTER TABLE "onboarding_logs" DROP CONSTRAINT IF EXISTS "onboarding_logs_user_id_fkey";
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'investor_organizations') THEN
        ALTER TABLE "investor_organizations" DROP CONSTRAINT IF EXISTS "investor_organizations_owner_user_id_fkey";
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'issuer_organizations') THEN
        ALTER TABLE "issuer_organizations" DROP CONSTRAINT IF EXISTS "issuer_organizations_owner_user_id_fkey";
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organization_members') THEN
        ALTER TABLE "organization_members" DROP CONSTRAINT IF EXISTS "organization_members_user_id_fkey";
    END IF;
END $$;

-- Step 2: Data migration (only if users table exists and has data)
DO $$
DECLARE
    table_exists BOOLEAN;
    has_data BOOLEAN;
    duplicate_count INTEGER;
BEGIN
    -- Check if table exists
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
    ) INTO table_exists;

    -- Only proceed with data migration if table exists
    IF table_exists THEN
        -- Check if table has any rows
        SELECT EXISTS (SELECT 1 FROM "users" LIMIT 1) INTO has_data;

        IF has_data THEN
            -- Ensure all users have user_id generated
            UPDATE "users" 
            SET "user_id" = UPPER(SUBSTRING(MD5(RANDOM()::TEXT || id::TEXT), 1, 5))
            WHERE "user_id" IS NULL;

            -- Handle any duplicate user_ids (shouldn't happen, but safety check)
            SELECT COUNT(*) INTO duplicate_count
            FROM (
                SELECT user_id, COUNT(*) as cnt
                FROM users
                WHERE user_id IS NOT NULL
                GROUP BY user_id
                HAVING COUNT(*) > 1
            ) duplicates;
            
            IF duplicate_count > 0 THEN
                -- Regenerate user_ids for duplicates
                UPDATE users u1
                SET user_id = UPPER(SUBSTRING(MD5(RANDOM()::TEXT || u1.id::TEXT || EXTRACT(EPOCH FROM NOW())::TEXT), 1, 5))
                WHERE EXISTS (
                    SELECT 1 FROM users u2
                    WHERE u2.user_id = u1.user_id
                    AND u2.id != u1.id
                );
            END IF;

            -- Update foreign key columns to use user_id instead of id
            IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'loans') THEN
                UPDATE "loans" l
                SET "borrower_id" = u.user_id
                FROM "users" u
                WHERE l.borrower_id = u.id::TEXT AND u.user_id IS NOT NULL;
            END IF;

            IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'investments') THEN
                UPDATE "investments" i
                SET "investor_id" = u.user_id
                FROM "users" u
                WHERE i.investor_id = u.id::TEXT AND u.user_id IS NOT NULL;
            END IF;

            IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'access_logs') THEN
                UPDATE "access_logs" al
                SET "user_id" = u.user_id
                FROM "users" u
                WHERE al.user_id = u.id::TEXT AND u.user_id IS NOT NULL;
            END IF;

            IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_sessions') THEN
                UPDATE "user_sessions" us
                SET "user_id" = u.user_id
                FROM "users" u
                WHERE us.user_id = u.id::TEXT AND u.user_id IS NOT NULL;
            END IF;

            IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admins') THEN
                UPDATE "admins" a
                SET "user_id" = u.user_id
                FROM "users" u
                WHERE a.user_id = u.id::TEXT AND u.user_id IS NOT NULL;
            END IF;

            IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_invitations') THEN
                UPDATE "admin_invitations" ai
                SET "invited_by_user_id" = u.user_id
                FROM "users" u
                WHERE ai.invited_by_user_id = u.id::TEXT AND u.user_id IS NOT NULL;
            END IF;

            IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'security_logs') THEN
                UPDATE "security_logs" sl
                SET "user_id" = u.user_id
                FROM "users" u
                WHERE sl.user_id = u.id::TEXT AND u.user_id IS NOT NULL;
            END IF;

            IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'onboarding_logs') THEN
                UPDATE "onboarding_logs" ol
                SET "user_id" = u.user_id
                FROM "users" u
                WHERE ol.user_id = u.id::TEXT AND u.user_id IS NOT NULL;
            END IF;

            IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'investor_organizations') THEN
                UPDATE "investor_organizations" io
                SET "owner_user_id" = u.user_id
                FROM "users" u
                WHERE io.owner_user_id = u.id::TEXT AND u.user_id IS NOT NULL;
            END IF;

            IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'issuer_organizations') THEN
                UPDATE "issuer_organizations" isso
                SET "owner_user_id" = u.user_id
                FROM "users" u
                WHERE isso.owner_user_id = u.id::TEXT AND u.user_id IS NOT NULL;
            END IF;

            IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organization_members') THEN
                UPDATE "organization_members" om
                SET "user_id" = u.user_id
                FROM "users" u
                WHERE om.user_id = u.id::TEXT AND u.user_id IS NOT NULL;
            END IF;
        END IF;
    END IF;
END $$;

-- Step 3: Remove email_verified and kyc_verified columns (safe to run even if columns don't exist)
ALTER TABLE IF EXISTS "users" DROP COLUMN IF EXISTS "email_verified";
ALTER TABLE IF EXISTS "users" DROP COLUMN IF EXISTS "kyc_verified";

-- Step 4: Drop the old primary key constraint and id column (safe to run even if they don't exist)
-- This is now safe because we've already dropped all foreign key constraints
ALTER TABLE IF EXISTS "users" DROP CONSTRAINT IF EXISTS "users_pkey";
ALTER TABLE IF EXISTS "users" DROP COLUMN IF EXISTS "id";

-- Step 5: Make user_id non-nullable and set as primary key (only if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        ALTER TABLE "users" ALTER COLUMN "user_id" SET NOT NULL;
        ALTER TABLE "users" ADD CONSTRAINT "users_pkey" PRIMARY KEY ("user_id");
    END IF;
END $$;

-- Step 6: Recreate foreign key constraints with user_id (only if tables exist)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'loans') THEN
        ALTER TABLE "loans" ADD CONSTRAINT "loans_borrower_id_fkey" FOREIGN KEY ("borrower_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'investments') THEN
        ALTER TABLE "investments" ADD CONSTRAINT "investments_investor_id_fkey" FOREIGN KEY ("investor_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'access_logs') THEN
        ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_sessions') THEN
        ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admins') THEN
        ALTER TABLE "admins" ADD CONSTRAINT "admins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_invitations') THEN
        ALTER TABLE "admin_invitations" ADD CONSTRAINT "admin_invitations_invited_by_user_id_fkey" FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'security_logs') THEN
        ALTER TABLE "security_logs" ADD CONSTRAINT "security_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'onboarding_logs') THEN
        ALTER TABLE "onboarding_logs" ADD CONSTRAINT "onboarding_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'investor_organizations') THEN
        ALTER TABLE "investor_organizations" ADD CONSTRAINT "investor_organizations_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'issuer_organizations') THEN
        ALTER TABLE "issuer_organizations" ADD CONSTRAINT "issuer_organizations_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organization_members') THEN
        ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
