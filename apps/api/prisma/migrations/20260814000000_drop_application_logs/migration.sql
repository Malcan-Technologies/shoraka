-- Drop legacy ApplicationLog table after ApplicationAuditLog + SigningAuditLog cutover.
-- application_audit_logs and signing_audit_logs are unchanged.

DROP TABLE "application_logs";
