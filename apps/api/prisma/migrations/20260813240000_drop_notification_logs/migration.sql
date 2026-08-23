-- Drop legacy NotificationLog table. NotificationBroadcastAuditLog
-- (notification_broadcast_audit_logs) is unchanged and remains the sole
-- admin broadcast audit history.

DROP TABLE "notification_logs";
