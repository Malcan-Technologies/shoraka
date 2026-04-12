-- Remove deprecated amendment acknowledgement reminder notification type and its data
DELETE FROM "notification_logs"
WHERE "notification_type_id" = 'amendment_acknowledgement_reminder';

DELETE FROM "user_notification_preferences"
WHERE "notification_type_id" = 'amendment_acknowledgement_reminder';

DELETE FROM "notifications"
WHERE "notification_type_id" = 'amendment_acknowledgement_reminder';

DELETE FROM "notification_types"
WHERE "id" = 'amendment_acknowledgement_reminder';
