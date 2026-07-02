DELETE FROM "notification_logs"
WHERE "notification_type_id" = 'director_shareholder_mismatch';

DELETE FROM "user_notification_preferences"
WHERE "notification_type_id" = 'director_shareholder_mismatch';

DELETE FROM "notifications"
WHERE "notification_type_id" = 'director_shareholder_mismatch';

DELETE FROM "notification_types"
WHERE "id" = 'director_shareholder_mismatch';
