-- Remove stale director_shareholder_rejected notification type (old admin reject/resubmit flow).
-- Active CTOS types director_shareholder_action_required and
-- investor_director_shareholder_action_required are unchanged.
--
-- Verification (run manually before deploy):
--   SELECT COUNT(*) FROM "notification_types" WHERE "id" = 'director_shareholder_rejected';
--   SELECT COUNT(*) FROM "notifications" WHERE "notification_type_id" = 'director_shareholder_rejected';
--   SELECT COUNT(*) FROM "notification_logs" WHERE "notification_type_id" = 'director_shareholder_rejected';
--   SELECT COUNT(*) FROM "user_notification_preferences" WHERE "notification_type_id" = 'director_shareholder_rejected';
--
-- Verification (run manually after deploy):
--   SELECT COUNT(*) FROM "notification_types" WHERE "id" = 'director_shareholder_rejected'; -- expect 0
--   SELECT COUNT(*) FROM "notifications" WHERE "notification_type_id" = 'director_shareholder_rejected'; -- expect 0
--   SELECT COUNT(*) FROM "notification_logs" WHERE "notification_type_id" = 'director_shareholder_rejected'; -- expect 0
--   SELECT COUNT(*) FROM "user_notification_preferences" WHERE "notification_type_id" = 'director_shareholder_rejected'; -- expect 0

DELETE FROM "notification_logs"
WHERE "notification_type_id" = 'director_shareholder_rejected';

DELETE FROM "user_notification_preferences"
WHERE "notification_type_id" = 'director_shareholder_rejected';

DELETE FROM "notifications"
WHERE "notification_type_id" = 'director_shareholder_rejected';

DELETE FROM "notification_types"
WHERE "id" = 'director_shareholder_rejected';
