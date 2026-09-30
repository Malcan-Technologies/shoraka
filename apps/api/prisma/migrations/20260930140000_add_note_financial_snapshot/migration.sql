-- Reviewed financial inputs copied onto the Note at creation (financial statements, the
-- application-owned CTOS financials and a traceability reference). Null on Notes created before
-- this column existed; those keep reading the source application.

ALTER TABLE "notes" ADD COLUMN "financial_snapshot" JSONB;
