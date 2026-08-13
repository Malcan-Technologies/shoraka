-- Drop leftover ApplicationReviewEvent after ApplicationAuditLog cutover.
-- application_audit_logs, application_reviews, application_review_items,
-- application_review_remarks, application_revisions, applications,
-- contracts, and invoices are unchanged.

DROP TABLE "application_review_events";
