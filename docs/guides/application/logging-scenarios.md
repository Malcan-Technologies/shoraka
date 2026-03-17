================================================================================
APPLICATION LOG — UI TO EVENT
================================================================================

Which button or action logs which event. Who did it. Where it shows.
Plain text. Top to bottom.

Related: logging-guide.md (full scenarios, DB storage, kid-level). You can read
that file if you need more detail.

The activity timeline shows logs for a single application. It appears on the
application detail page in the admin portal. Logs are stored in the
application_logs table.

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
  Reset to under review             APPLICATION_RESET_TO_UNDER_REVIEW    Timeline
  Approve application               APPLICATION_APPROVED                  Timeline
  Reject application               APPLICATION_REJECTED                   Timeline
  Send amendment request to issuer  AMENDMENTS_SUBMITTED                   Timeline
  Approve section                   SECTION_REVIEWED_APPROVED            Timeline
  Reject section                    SECTION_REVIEWED_REJECTED            Timeline
  Request amendment (section)       SECTION_REVIEWED_AMENDMENT_REQUESTED    Timeline
  Reset section                     SECTION_REVIEWED_PENDING             Timeline
  Approve item                      ITEM_REVIEWED_APPROVED               Timeline
  Reject item                       ITEM_REVIEWED_REJECTED               Timeline
  Request amendment (item)          ITEM_REVIEWED_AMENDMENT_REQUESTED     Timeline
  Reset item                        ITEM_REVIEWED_PENDING                Timeline
  Send contract offer               CONTRACT_OFFER_SENT                  Timeline
  Send invoice offer                INVOICE_OFFER_SENT                   Timeline
  Retract contract offer            CONTRACT_OFFER_RETRACTED             Timeline
  Retract invoice offer             INVOICE_OFFER_RETRACTED              Timeline

================================================================================
SYSTEM (Cron / automatic)
================================================================================

  Action                        Event Type              Where it shows
  ----------------------------- ----------------------- ------------------
  Offer expired (cron job)      OFFER_EXPIRED           Activity timeline
  Last offer accepted          APPLICATION_COMPLETED    Activity timeline

When contract offer expires: CONTRACT_WITHDRAWN
When invoice offer expires:  INVOICE_WITHDRAWN
When all withdrawn by cron:  APPLICATION_WITHDRAWN

================================================================================
EVENT TYPE ENUM (ApplicationLogEventType)
================================================================================

All event types are defined in apps/api/src/modules/applications/logs/types.ts.
Use the enum. No level_target_action. No APPLICATION_APPLICATION_* names.

================================================================================
END
================================================================================
