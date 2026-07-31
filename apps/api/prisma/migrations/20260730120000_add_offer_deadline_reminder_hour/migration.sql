-- Platform-wide hour (0–23 MYT) when offer phase deadline reminders are delivered.
ALTER TABLE "platform_finance_settings"
ADD COLUMN "offer_deadline_reminder_hour" INTEGER NOT NULL DEFAULT 9;
