-- Reviewed result stored with the section approval. Only the Financial section writes it:
-- the effective raw values, per-field sources and calculated metrics that were approved.
-- Null while the section is not APPROVED.

ALTER TABLE "application_reviews" ADD COLUMN "approved_snapshot" JSONB;
