-- Migrate any applications with OFFER_SENT to UNDER_REVIEW
UPDATE applications SET status = 'UNDER_REVIEW' WHERE status = 'OFFER_SENT';

-- Recreate ApplicationStatus enum without OFFER_SENT (PostgreSQL cannot remove enum values directly)
CREATE TYPE "ApplicationStatus_new" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'ARCHIVED',
  'UNDER_REVIEW',
  'AMENDMENT_REQUESTED',
  'RESUBMITTED'
);

ALTER TABLE applications ALTER COLUMN status DROP DEFAULT;
ALTER TABLE applications ALTER COLUMN status TYPE "ApplicationStatus_new" USING status::text::"ApplicationStatus_new";
ALTER TABLE applications ALTER COLUMN status SET DEFAULT 'DRAFT'::"ApplicationStatus_new";

DROP TYPE "ApplicationStatus";
ALTER TYPE "ApplicationStatus_new" RENAME TO "ApplicationStatus";
