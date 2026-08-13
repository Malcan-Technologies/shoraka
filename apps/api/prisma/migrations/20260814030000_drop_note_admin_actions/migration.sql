-- Drop leftover NoteAdminAction table after NoteAuditLog cutover.
-- note_audit_logs is unchanged.

DROP TABLE "note_admin_actions";
