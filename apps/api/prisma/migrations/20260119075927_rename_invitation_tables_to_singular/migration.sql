-- Rename tables from plural to singular (safe migration with conditional logic)
-- This migration handles both fresh migrations and already-renamed tables

-- Check if plural tables exist, if so rename them
DO $$
BEGIN
  -- Rename investor table if it has the old plural name
  IF EXISTS (SELECT FROM information_schema.tables 
             WHERE table_schema = 'public' 
             AND table_name = 'investor_organization_invitations') THEN
    ALTER TABLE "investor_organization_invitations" RENAME TO "investor_organization_invitation";
    RAISE NOTICE 'Renamed investor_organization_invitations → investor_organization_invitation';
  END IF;

  -- Rename issuer table if it has the old plural name
  IF EXISTS (SELECT FROM information_schema.tables 
             WHERE table_schema = 'public' 
             AND table_name = 'issuer_organization_invitations') THEN
    ALTER TABLE "issuer_organization_invitations" RENAME TO "issuer_organization_invitation";
    RAISE NOTICE 'Renamed issuer_organization_invitations → issuer_organization_invitation';
  END IF;

  -- Rename investor constraints if they have old plural names
  IF EXISTS (SELECT FROM pg_constraint WHERE conname = 'investor_organization_invitations_pkey') THEN
    ALTER TABLE "investor_organization_invitation" 
      RENAME CONSTRAINT "investor_organization_invitations_pkey" 
      TO "investor_organization_invitation_pkey";
  END IF;

  IF EXISTS (SELECT FROM pg_constraint WHERE conname = 'investor_organization_invitations_investor_organization_id_fkey') THEN
    ALTER TABLE "investor_organization_invitation" 
      RENAME CONSTRAINT "investor_organization_invitations_investor_organization_id_fkey" 
      TO "investor_organization_invitation_investor_organization_id_fkey";
  END IF;

  IF EXISTS (SELECT FROM pg_constraint WHERE conname = 'investor_organization_invitations_invited_by_user_id_fkey') THEN
    ALTER TABLE "investor_organization_invitation" 
      RENAME CONSTRAINT "investor_organization_invitations_invited_by_user_id_fkey" 
      TO "investor_organization_invitation_invited_by_user_id_fkey";
  END IF;

  IF EXISTS (SELECT FROM pg_constraint WHERE conname = 'investor_organization_invitations_token_key') THEN
    ALTER TABLE "investor_organization_invitation" 
      RENAME CONSTRAINT "investor_organization_invitations_token_key" 
      TO "investor_organization_invitation_token_key";
  END IF;

  -- Rename investor indexes if they have old plural names
  IF EXISTS (SELECT FROM pg_indexes WHERE indexname = 'investor_organization_invitations_email_idx') THEN
    ALTER INDEX "investor_organization_invitations_email_idx" 
      RENAME TO "investor_organization_invitation_email_idx";
  END IF;

  IF EXISTS (SELECT FROM pg_indexes WHERE indexname = 'investor_organization_invitations_token_idx') THEN
    ALTER INDEX "investor_organization_invitations_token_idx" 
      RENAME TO "investor_organization_invitation_token_idx";
  END IF;

  IF EXISTS (SELECT FROM pg_indexes WHERE indexname = 'investor_organization_invitations_expires_at_idx') THEN
    ALTER INDEX "investor_organization_invitations_expires_at_idx" 
      RENAME TO "investor_organization_invitation_expires_at_idx";
  END IF;

  IF EXISTS (SELECT FROM pg_indexes WHERE indexname = 'investor_organization_invitations_investor_organization_id_idx') THEN
    ALTER INDEX "investor_organization_invitations_investor_organization_id_idx" 
      RENAME TO "investor_organization_invitation_investor_organization_id_idx";
  END IF;

  -- Rename issuer constraints if they have old plural names
  IF EXISTS (SELECT FROM pg_constraint WHERE conname = 'issuer_organization_invitations_pkey') THEN
    ALTER TABLE "issuer_organization_invitation" 
      RENAME CONSTRAINT "issuer_organization_invitations_pkey" 
      TO "issuer_organization_invitation_pkey";
  END IF;

  IF EXISTS (SELECT FROM pg_constraint WHERE conname = 'issuer_organization_invitations_issuer_organization_id_fkey') THEN
    ALTER TABLE "issuer_organization_invitation" 
      RENAME CONSTRAINT "issuer_organization_invitations_issuer_organization_id_fkey" 
      TO "issuer_organization_invitation_issuer_organization_id_fkey";
  END IF;

  IF EXISTS (SELECT FROM pg_constraint WHERE conname = 'issuer_organization_invitations_invited_by_user_id_fkey') THEN
    ALTER TABLE "issuer_organization_invitation" 
      RENAME CONSTRAINT "issuer_organization_invitations_invited_by_user_id_fkey" 
      TO "issuer_organization_invitation_invited_by_user_id_fkey";
  END IF;

  IF EXISTS (SELECT FROM pg_constraint WHERE conname = 'issuer_organization_invitations_token_key') THEN
    ALTER TABLE "issuer_organization_invitation" 
      RENAME CONSTRAINT "issuer_organization_invitations_token_key" 
      TO "issuer_organization_invitation_token_key";
  END IF;

  -- Rename issuer indexes if they have old plural names
  IF EXISTS (SELECT FROM pg_indexes WHERE indexname = 'issuer_organization_invitations_email_idx') THEN
    ALTER INDEX "issuer_organization_invitations_email_idx" 
      RENAME TO "issuer_organization_invitation_email_idx";
  END IF;

  IF EXISTS (SELECT FROM pg_indexes WHERE indexname = 'issuer_organization_invitations_token_idx') THEN
    ALTER INDEX "issuer_organization_invitations_token_idx" 
      RENAME TO "issuer_organization_invitation_token_idx";
  END IF;

  IF EXISTS (SELECT FROM pg_indexes WHERE indexname = 'issuer_organization_invitations_expires_at_idx') THEN
    ALTER INDEX "issuer_organization_invitations_expires_at_idx" 
      RENAME TO "issuer_organization_invitation_expires_at_idx";
  END IF;

  IF EXISTS (SELECT FROM pg_indexes WHERE indexname = 'issuer_organization_invitations_issuer_organization_id_idx') THEN
    ALTER INDEX "issuer_organization_invitations_issuer_organization_id_idx" 
      RENAME TO "issuer_organization_invitation_issuer_organization_id_idx";
  END IF;

  RAISE NOTICE 'Migration completed: All tables, constraints, and indexes renamed to singular form';
END $$;

