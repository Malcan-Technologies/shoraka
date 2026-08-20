-- Drop legacy AccessLog and SecurityLog tables after Phase 4 cutover.
-- AccessAuditLog (access_audit_logs) and SecurityAuditLog (security_audit_logs)
-- are unchanged and remain the sole authentication-history and security audit tables.

DROP TABLE "access_logs";
DROP TABLE "security_logs";
