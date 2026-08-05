-- Backfill redundant application statuses before enum recreation.
UPDATE applications SET status = 'COMPLETED' WHERE status IN ('INVOICE_SIGNED', 'APPROVED');
UPDATE applications SET status = 'UNDER_REVIEW' WHERE status = 'CONTRACT_SIGNED';

CREATE TYPE "ApplicationStatus_new" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'CONTRACT_PENDING',
  'CONTRACT_SENT',
  'CONTRACT_ACCEPTED',
  'INVOICE_ACCEPTED',
  'SIGNING_PENDING',
  'INVOICE_PENDING',
  'INVOICES_SENT',
  'OFFER_EXPIRED',
  'AMENDMENT_REQUESTED',
  'RESUBMITTED',
  'COMPLETED',
  'WITHDRAWN',
  'REJECTED',
  'ARCHIVED'
);

ALTER TABLE applications ALTER COLUMN status DROP DEFAULT;
ALTER TABLE applications ALTER COLUMN status TYPE "ApplicationStatus_new" USING status::text::"ApplicationStatus_new";
ALTER TABLE applications ALTER COLUMN status SET DEFAULT 'DRAFT'::"ApplicationStatus_new";

DROP TYPE "ApplicationStatus";
ALTER TYPE "ApplicationStatus_new" RENAME TO "ApplicationStatus";
