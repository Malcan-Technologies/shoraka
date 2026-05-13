DELETE FROM "notification_logs"
WHERE "notification_type_id" = 'note_repaid_investor';

DELETE FROM "user_notification_preferences"
WHERE "notification_type_id" = 'note_repaid_investor';

DELETE FROM "notifications"
WHERE "notification_type_id" = 'note_repaid_investor';

DELETE FROM "notification_types"
WHERE "id" = 'note_repaid_investor';
