-- Drop legacy OnboardingLog table. OnboardingAuditLog (onboarding_audit_logs)
-- is unchanged and remains the sole onboarding/compliance history table.

DROP TABLE "onboarding_logs";
