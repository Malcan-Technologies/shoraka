-- enableReScreening is fixed false in outbound AML requests; no DB persistence.
ALTER TABLE "application_guarantors" DROP COLUMN IF EXISTS "enable_re_screening";
