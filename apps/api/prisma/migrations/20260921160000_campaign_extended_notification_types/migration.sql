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
VALUES
  (
    'note_campaign_extended_issuer',
    'Campaign extended',
    'The funding period for a published note was extended.',
    'SYSTEM',
    'INFO',
    ARRAY['ISSUER']::"NotificationPortalTarget"[],
    true,
    true,
    true,
    NOW(),
    NOW()
  ),
  (
    'note_campaign_extended_investor',
    'Listing deadline extended',
    'The listing deadline was extended on a note you have committed to.',
    'SYSTEM',
    'INFO',
    ARRAY['INVESTOR']::"NotificationPortalTarget"[],
    true,
    true,
    true,
    NOW(),
    NOW()
  )
ON CONFLICT ("id") DO NOTHING;
