-- Rename SENT to OFFER_SENT in ContractStatus, InvoiceStatus, ReviewStepStatus
-- Add OFFER_SENT to ApplicationStatus
-- Add AMENDMENT_REQUESTED to InvoiceStatus

ALTER TYPE "ContractStatus" RENAME VALUE 'SENT' TO 'OFFER_SENT';

ALTER TYPE "InvoiceStatus" RENAME VALUE 'SENT' TO 'OFFER_SENT';
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'AMENDMENT_REQUESTED';

ALTER TYPE "ReviewStepStatus" RENAME VALUE 'SENT' TO 'OFFER_SENT';

ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'OFFER_SENT';
