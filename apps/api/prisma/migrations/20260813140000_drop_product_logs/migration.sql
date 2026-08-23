-- Drop legacy ProductLog table. ProductAuditLog (product_audit_logs) is unchanged
-- and remains the sole Product audit history.

DROP TABLE "product_logs";
