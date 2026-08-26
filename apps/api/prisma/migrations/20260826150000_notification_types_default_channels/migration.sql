-- Ensure every catalog type exists in production and both channels default on.
-- Existing rows keep their names/settings except Platform and Email, which are
-- turned on. Missing catalog rows are inserted.

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
  ('password_changed', 'Password Changed', 'Sent when your account password has been successfully changed.', 'AUTHENTICATION', 'CRITICAL', ARRAY['INVESTOR','ISSUER']::"NotificationPortalTarget"[], true, true, false, NOW(), NOW()),
  ('onboarding_approved', 'Onboarding Approved', 'Sent when your onboarding application has been approved.', 'SYSTEM', 'INFO', ARRAY['INVESTOR','ISSUER']::"NotificationPortalTarget"[], true, true, false, NOW(), NOW()),
  ('onboarding_rejected', 'Onboarding Rejected', 'Sent when your onboarding application has been rejected.', 'SYSTEM', 'WARNING', ARRAY['INVESTOR','ISSUER']::"NotificationPortalTarget"[], true, true, false, NOW(), NOW()),
  ('system_announcement', 'System Announcement', 'General announcements about platform updates and maintenance.', 'ANNOUNCEMENT', 'INFO', ARRAY['INVESTOR','ISSUER']::"NotificationPortalTarget"[], true, true, true, NOW(), NOW()),
  ('new_product_alert', 'New Product Alert', 'Be the first to know about new investment opportunities and products.', 'MARKETING', 'INFO', ARRAY['INVESTOR']::"NotificationPortalTarget"[], true, true, true, NOW(), NOW()),
  ('application_amendments_requested', 'Application Amendments Requested', 'Sent when reviewers submit amendment requests on your application.', 'SYSTEM', 'WARNING', ARRAY['ISSUER']::"NotificationPortalTarget"[], true, true, true, NOW(), NOW()),
  ('acceptance_document_changes_requested', 'Acceptance Documents Need Updates', 'Sent once when a reviewer first requests acceptance-document changes after offer submission (further requests in the same cycle do not re-notify).', 'SYSTEM', 'WARNING', ARRAY['ISSUER']::"NotificationPortalTarget"[], true, true, true, NOW(), NOW()),
  ('application_rejected', 'Application Rejected', 'Sent when your application is rejected.', 'SYSTEM', 'WARNING', ARRAY['ISSUER']::"NotificationPortalTarget"[], true, true, true, NOW(), NOW()),
  ('contract_offer_sent', 'Facility Offer Sent', 'Sent when a facility offer is sent to your application.', 'SYSTEM', 'WARNING', ARRAY['ISSUER']::"NotificationPortalTarget"[], true, true, true, NOW(), NOW()),
  ('invoice_offer_sent', 'Invoice Offer Sent', 'Sent when an invoice offer is sent to your application.', 'SYSTEM', 'WARNING', ARRAY['ISSUER']::"NotificationPortalTarget"[], true, true, true, NOW(), NOW()),
  ('offer_retracted_or_reset', 'Offer Retracted or Reset', 'Sent when a previously sent offer is retracted or reset by reviewer action.', 'SYSTEM', 'INFO', ARRAY['ISSUER']::"NotificationPortalTarget"[], true, true, true, NOW(), NOW()),
  ('offer_expired', 'Offer Expired', 'Sent when a facility or invoice offer expires.', 'SYSTEM', 'WARNING', ARRAY['ISSUER']::"NotificationPortalTarget"[], true, true, true, NOW(), NOW()),
  ('offer_expiry_reminder_24h', 'Offer Expiry Reminder', 'Reminder sent before an acceptance or signing deadline (days_before_expiry from product config).', 'SYSTEM', 'INFO', ARRAY['ISSUER']::"NotificationPortalTarget"[], true, true, true, NOW(), NOW()),
  ('application_resubmitted_confirmation', 'Application Resubmitted Confirmation', 'Confirmation sent after you resubmit your application.', 'SYSTEM', 'INFO', ARRAY['ISSUER']::"NotificationPortalTarget"[], true, true, true, NOW(), NOW()),
  ('application_withdrawn_confirmation', 'Application Withdrawn Confirmation', 'Confirmation sent after you withdraw your application.', 'SYSTEM', 'INFO', ARRAY['ISSUER']::"NotificationPortalTarget"[], true, true, true, NOW(), NOW()),
  ('application_completed', 'Application Completed', 'Sent when your application reaches completed status.', 'SYSTEM', 'INFO', ARRAY['ISSUER']::"NotificationPortalTarget"[], true, true, true, NOW(), NOW()),
  ('director_shareholder_action_required', 'Director/Shareholder Action Required', 'Sent to the issuer organization owner when a CTOS pull finds new directors or shareholders who need onboarding action.', 'SYSTEM', 'WARNING', ARRAY['ISSUER']::"NotificationPortalTarget"[], true, true, false, NOW(), NOW()),
  ('investor_director_shareholder_action_required', 'Investor Director/Shareholder Action Required', 'Sent to the investor organization owner when a CTOS pull finds new directors or shareholders who need onboarding action.', 'SYSTEM', 'WARNING', ARRAY['INVESTOR']::"NotificationPortalTarget"[], true, true, false, NOW(), NOW()),
  ('note_published', 'Note published', 'Your note was published to the marketplace for funding.', 'SYSTEM', 'INFO', ARRAY['ISSUER']::"NotificationPortalTarget"[], true, true, true, NOW(), NOW()),
  ('note_funding_succeeded', 'Note funding succeeded', 'Funding closed successfully for your note.', 'SYSTEM', 'INFO', ARRAY['ISSUER']::"NotificationPortalTarget"[], true, true, true, NOW(), NOW()),
  ('note_funding_failed_issuer', 'Note funding failed', 'A note listing did not reach the minimum funding threshold.', 'SYSTEM', 'WARNING', ARRAY['ISSUER']::"NotificationPortalTarget"[], true, true, true, NOW(), NOW()),
  ('note_funding_failed_investor', 'Note funding failed', 'Reserved commitment released because a note did not complete funding.', 'SYSTEM', 'WARNING', ARRAY['INVESTOR']::"NotificationPortalTarget"[], true, true, true, NOW(), NOW()),
  ('note_active_issuer', 'Note active', 'Your note is active after funding.', 'SYSTEM', 'INFO', ARRAY['ISSUER']::"NotificationPortalTarget"[], true, true, true, NOW(), NOW()),
  ('note_active_investor', 'Note active', 'A note you funded is active.', 'SYSTEM', 'INFO', ARRAY['INVESTOR']::"NotificationPortalTarget"[], true, true, true, NOW(), NOW()),
  ('note_repaid_issuer', 'Note repaid', 'Your note has been fully repaid and settled.', 'SYSTEM', 'INFO', ARRAY['ISSUER']::"NotificationPortalTarget"[], true, true, true, NOW(), NOW()),
  ('note_payment_received', 'Note repayment recorded', 'A repayment was recorded on a note.', 'SYSTEM', 'INFO', ARRAY['INVESTOR']::"NotificationPortalTarget"[], true, true, true, NOW(), NOW()),
  ('note_settlement_posted', 'Note settlement posted', 'Settlement posted for a note.', 'SYSTEM', 'INFO', ARRAY['INVESTOR']::"NotificationPortalTarget"[], true, true, true, NOW(), NOW()),
  ('note_arrears', 'Note in arrears', 'A note entered arrears status.', 'SYSTEM', 'WARNING', ARRAY['ISSUER']::"NotificationPortalTarget"[], true, true, true, NOW(), NOW()),
  ('note_arrears_investor', 'Note in arrears', 'A note you invested in is in arrears.', 'SYSTEM', 'WARNING', ARRAY['INVESTOR']::"NotificationPortalTarget"[], true, true, true, NOW(), NOW()),
  ('note_defaulted', 'Note defaulted (issuer)', 'A note was marked as default.', 'SYSTEM', 'CRITICAL', ARRAY['ISSUER']::"NotificationPortalTarget"[], true, true, true, NOW(), NOW()),
  ('note_defaulted_investor', 'Note defaulted', 'A note you invested in was marked as default.', 'SYSTEM', 'CRITICAL', ARRAY['INVESTOR']::"NotificationPortalTarget"[], true, true, true, NOW(), NOW()),
  ('withdrawal_submitted_to_trustee', 'Withdrawal submitted to trustee', 'A withdrawal instruction was submitted to the trustee.', 'SYSTEM', 'INFO', ARRAY['INVESTOR','ISSUER']::"NotificationPortalTarget"[], true, true, true, NOW(), NOW()),
  ('facility_fee_payment_requested', 'Upfront facility fee payment required', 'Sent after you accept a facility offer that requires an upfront facility fee gateway payment.', 'SYSTEM', 'WARNING', ARRAY['ISSUER']::"NotificationPortalTarget"[], true, true, true, NOW(), NOW()),
  ('facility_fee_upfront_paid', 'Upfront facility fee paid', 'Sent once when the upfront facility fee on a facility has been paid in full.', 'SYSTEM', 'INFO', ARRAY['ISSUER']::"NotificationPortalTarget"[], true, true, true, NOW(), NOW()),
  ('excess_late_charges_due', 'Outstanding late charges to pay', 'Sent after a settlement is posted with late charges that did not fit into the repayment.', 'SYSTEM', 'WARNING', ARRAY['ISSUER']::"NotificationPortalTarget"[], true, true, true, NOW(), NOW()),
  ('excess_late_charges_paid', 'Late payment charges received', 'Sent once when separately collected late charges on a note have been paid in full.', 'SYSTEM', 'INFO', ARRAY['ISSUER']::"NotificationPortalTarget"[], true, true, true, NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;

UPDATE "notification_types"
SET
  "enabled_platform" = true,
  "enabled_email" = true,
  "updated_at" = NOW();
