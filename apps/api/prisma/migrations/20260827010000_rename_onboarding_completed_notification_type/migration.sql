-- Catalogue rename only: onboarding_approved -> onboarding_completed.
-- Retarget FKs, then drop the old type row. No schema change.

INSERT INTO "notification_types" (
  "id",
  "name",
  "description",
  "category",
  "default_priority",
  "portal_targets",
  "enabled_platform",
  "enabled_email",
  "user_configurable",
  "created_at",
  "updated_at"
)
VALUES (
  'onboarding_completed',
  'Onboarding Completed',
  'Sent when your onboarding has been completed and you have full platform access.',
  'SYSTEM',
  'INFO',
  ARRAY['INVESTOR','ISSUER']::"NotificationPortalTarget"[],
  true,
  true,
  false,
  NOW(),
  NOW()
)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "updated_at" = NOW();

UPDATE "notifications"
SET "notification_type_id" = 'onboarding_completed'
WHERE "notification_type_id" = 'onboarding_approved';

UPDATE "notification_logs"
SET "notification_type_id" = 'onboarding_completed'
WHERE "notification_type_id" = 'onboarding_approved';

UPDATE "user_notification_preferences" AS legacy
SET "notification_type_id" = 'onboarding_completed'
WHERE "notification_type_id" = 'onboarding_approved'
  AND NOT EXISTS (
    SELECT 1
    FROM "user_notification_preferences" AS existing
    WHERE existing."user_id" = legacy."user_id"
      AND existing."notification_type_id" = 'onboarding_completed'
  );

DELETE FROM "user_notification_preferences"
WHERE "notification_type_id" = 'onboarding_approved';

DELETE FROM "notification_types"
WHERE "id" = 'onboarding_approved';

UPDATE "notification_types"
SET "name" = 'Repayment Received', "updated_at" = NOW()
WHERE "id" = 'note_payment_received';

UPDATE "notification_types"
SET "name" = 'Funding Unsuccessful', "updated_at" = NOW()
WHERE "id" IN ('note_funding_failed_issuer', 'note_funding_failed_investor');
