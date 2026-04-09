-- Create enum for notification portal scoping
CREATE TYPE "NotificationPortalTarget" AS ENUM ('INVESTOR', 'ISSUER');

-- Add portal targets to notification types (default to both portals)
ALTER TABLE "notification_types"
ADD COLUMN "portal_targets" "NotificationPortalTarget"[] NOT NULL DEFAULT ARRAY['INVESTOR','ISSUER']::"NotificationPortalTarget"[];

-- Scope existing types to the correct portals
UPDATE "notification_types"
SET "portal_targets" = ARRAY['INVESTOR']::"NotificationPortalTarget"[]
WHERE "id" = 'new_product_alert';

UPDATE "notification_types"
SET "portal_targets" = ARRAY['ISSUER']::"NotificationPortalTarget"[]
WHERE "id" IN (
  'application_amendments_requested',
  'application_approved',
  'application_rejected',
  'contract_offer_sent',
  'invoice_offer_sent',
  'offer_retracted_or_reset',
  'offer_expired',
  'amendment_acknowledgement_reminder',
  'offer_expiry_reminder_24h',
  'application_resubmitted_confirmation',
  'application_withdrawn_confirmation',
  'application_completed'
);
