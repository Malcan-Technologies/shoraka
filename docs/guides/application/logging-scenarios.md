================================================================================
APPLICATION LOG — UI TO EVENT
================================================================================

Which button or action logs which event. Who did it. Where it shows.
Plain text. Top to bottom.

Related: logging-guide.md (full scenarios, DB storage, kid-level). You can read
that file if you need more detail.

The activity timeline shows curated logs for a single application. It appears
on the application detail page in the admin portal (RecentActivityCard).
Raw Audit History is a separate panel on the same page.
GET /v1/applications/:id/logs merges application_audit_logs and
signing_audit_logs. Legacy application_logs has been dropped.

================================================================================
ISSUER PORTAL (User actions)
================================================================================

  Action                        Event Type                    Where it shows
  ----------------------------- ----------------------------- ------------------
  Create application            APPLICATION_CREATED           Activity timeline
  Submit application            APPLICATION_SUBMITTED          Activity timeline
  Resubmit after amendments     APPLICATION_RESUBMITTED       Activity timeline
  Cancel application            APPLICATION_WITHDRAWN           Activity timeline
  Withdraw invoice              INVOICE_WITHDRAWN              Activity timeline
  Accept contract offer        CONTRACT_OFFER_ACCEPTED         Activity timeline
  Reject contract offer         CONTRACT_OFFER_REJECTED        Activity timeline
  Accept invoice offer          INVOICE_OFFER_ACCEPTED        Activity timeline
  Reject invoice offer          INVOICE_OFFER_REJECTED        Activity timeline

Notes:
  APPLICATION_WITHDRAWN also when admin withdraws contract or all invoices
    withdrawn.
  INVOICE_WITHDRAWN also when admin withdraws invoice.
  APPLICATION_COMPLETED logged when last offer accepted.

================================================================================
ADMIN PORTAL (Admin actions)
================================================================================

  Action                            Event Type                          Where
  --------------------------------- ----------------------------------- ------
  Reopen for review                 APPLICATION_REOPENED_FOR_REVIEW      Timeline
  Start under-review                APPLICATION_REVIEW_STARTED           Admin timeline
  Reject application               APPLICATION_REJECTED                   Timeline
  Send amendment request to issuer  APPLICATION_AMENDMENTS_REQUESTED       Timeline
  Approve / reject / amend / reset
  a section                         APPLICATION_SECTION_REVIEW_UPDATED   Raw history;
                                    (previousStatus / newStatus)         Activity only
                                                                         if amendment-
                                                                         required
  Approve / reject / amend / reset
  an item                           APPLICATION_ITEM_REVIEW_UPDATED      Raw history
  Send contract offer               CONTRACT_OFFER_SENT                  Timeline
  Send invoice offer                INVOICE_OFFER_SENT                   Timeline
  Retract contract offer            CONTRACT_OFFER_RETRACTED             Timeline
  Retract invoice offer             INVOICE_OFFER_RETRACTED              Timeline
  Issuer submits acceptance docs    CONTRACT_ACCEPTANCE_SUBMITTED        Timeline
                                    / INVOICE_ACCEPTANCE_SUBMITTED
  Issuer resubmits after changes    CONTRACT_ACCEPTANCE_RESUBMITTED      Timeline
                                    / INVOICE_ACCEPTANCE_RESUBMITTED
  Admin approves for signing        CONTRACT_ACCEPTANCE_APPROVED_FOR_    Timeline
                                    SIGNING / INVOICE_ACCEPTANCE_
                                    APPROVED_FOR_SIGNING
  Signing package created           SIGNING_PACKAGE_CREATED              Timeline
  Signing package sent              SIGNING_PACKAGE_SENT                 Timeline
  Signing package voided            SIGNING_PACKAGE_VOIDED               Timeline
  Extend signing deadline           CONTRACT_SIGNING_DEADLINE_EXTENDED   Timeline
                                    / INVOICE_SIGNING_DEADLINE_EXTENDED

Notes:
  SIGNING_PACKAGE_COMPLETED is stored for audit. Admin application curated
  Activity hides it; issuer /activity can show it. Completion of the offer is
  also shown via CONTRACT_OFFER_ACCEPTED / INVOICE_OFFER_ACCEPTED.
  CSV/display aliases such as SECTION_REVIEWED_*, ITEM_REVIEWED_*,
  CONTRACT_OFFER_ACCEPTANCE_*, AMENDMENTS_SUBMITTED, and
  APPLICATION_RESET_TO_UNDER_REVIEW are not emitted by current writers.
  There is no live APPLICATION_APPROVED application audit event.

================================================================================
SYSTEM (Cron / automatic)
================================================================================

  Action                        Event Type              Where it shows
  ----------------------------- ----------------------- ------------------
  Acceptance/signing clock expired (hourly job)
                                CONTRACT_OFFER_EXPIRED /
                                INVOICE_OFFER_EXPIRED    Activity timeline
                                offer_expired            Issuer notification

Expiry is durable (not terminal WITHDRAWN): entity → OFFER_EXPIRED, offer_details
kept; admin Send Offer overwrites terms and returns to OFFER_SENT.
  Last offer accepted          APPLICATION_COMPLETED    Activity timeline

See docs/guides/acceptance-signing-expiry-job.md.

================================================================================
EVENT TYPE CATALOGUES
================================================================================

Application events: APPLICATION_AUDIT_EVENTS
  apps/api/src/modules/applications/audit/events.ts
Signing events (including SIGNING_PACKAGE_*): SIGNING_AUDIT_EVENTS
  apps/api/src/modules/signing/audit/events.ts

================================================================================
END
================================================================================
