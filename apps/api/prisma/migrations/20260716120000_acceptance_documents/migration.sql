-- Offer-acceptance documents storage + review section (separate from supporting_documents).

ALTER TABLE "applications" ADD COLUMN "acceptance_documents" JSONB;

ALTER TYPE "ReviewSection" ADD VALUE 'acceptance_documents';
