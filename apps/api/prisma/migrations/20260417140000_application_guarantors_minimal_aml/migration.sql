-- Minimal AML-oriented shape: drop relationship + risk; add name / business_name / enable_re_screening.
-- Keep existing ic_number and ssm_number (added in 20260417120000) as the identity fields — same semantics as RegTank payloads, local naming.
BEGIN;

ALTER TABLE "application_guarantors" DROP COLUMN IF EXISTS "relationship";

ALTER TABLE "application_guarantors" DROP COLUMN IF EXISTS "first_name";
ALTER TABLE "application_guarantors" DROP COLUMN IF EXISTS "last_name";
ALTER TABLE "application_guarantors" DROP COLUMN IF EXISTS "company_name";

ALTER TABLE "application_guarantors" DROP COLUMN IF EXISTS "aml_risk_score";
ALTER TABLE "application_guarantors" DROP COLUMN IF EXISTS "aml_risk_level";

ALTER TABLE "application_guarantors" ADD COLUMN "name" TEXT;
ALTER TABLE "application_guarantors" ADD COLUMN "business_name" TEXT;
ALTER TABLE "application_guarantors" ADD COLUMN "enable_re_screening" BOOLEAN NOT NULL DEFAULT false;

COMMIT;
