-- Add amendment_acknowledged_workflow_ids array column to applications
BEGIN;

ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "amendment_acknowledged_workflow_ids" text[] DEFAULT ARRAY[]::text[];

COMMIT;

