-- Drop leftover NoteEvent table after NoteAuditLog cutover.
-- note_audit_logs and note_admin_actions are unchanged.

DROP TABLE "note_events";
