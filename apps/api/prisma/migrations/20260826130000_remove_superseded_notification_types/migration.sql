-- Remove superseded notification types that have no automatic sender:
-- kyc_approved, kyc_rejected, login_new_device, application_approved.
-- Activity/onboarding event identifiers and KYC columns are unchanged.
--
-- Also reset remaining AUTHENTICATION types to both channels on
-- (password_changed after cleanup).

DELETE FROM "notification_logs"
WHERE "notification_type_id" IN (
  'kyc_approved',
  'kyc_rejected',
  'login_new_device',
  'application_approved'
);

DELETE FROM "user_notification_preferences"
WHERE "notification_type_id" IN (
  'kyc_approved',
  'kyc_rejected',
  'login_new_device',
  'application_approved'
);

DELETE FROM "notifications"
WHERE "notification_type_id" IN (
  'kyc_approved',
  'kyc_rejected',
  'login_new_device',
  'application_approved'
);

DELETE FROM "notification_types"
WHERE "id" IN (
  'kyc_approved',
  'kyc_rejected',
  'login_new_device',
  'application_approved'
);

UPDATE "notification_types"
SET "enabled_platform" = true,
    "enabled_email" = true
WHERE "category" = 'AUTHENTICATION';
