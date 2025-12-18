-- Migration: Add email_verified field to users table
-- This field tracks whether the user's email has been verified in Cognito

-- Add email_verified column with default false
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified" BOOLEAN NOT NULL DEFAULT false;

-- Create index for faster queries on email verification status (optional but useful)
CREATE INDEX IF NOT EXISTS "users_email_verified_idx" ON "users"("email_verified");

