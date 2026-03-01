-- Migration: add portal column to application_logs
ALTER TABLE application_logs
ADD COLUMN IF NOT EXISTS portal VARCHAR;

-- Add index on portal for query performance
CREATE INDEX IF NOT EXISTS idx_application_logs_portal ON application_logs(portal);

