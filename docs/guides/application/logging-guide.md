================================================================================
APPLICATION LOGGING — FULL GUIDE
================================================================================

How logs work. When they happen. Which button does what. How it is stored.
Kid-level English. Top to bottom. No shortcuts.

Related: logging-scenarios.md (UI to event mapping). You can read that file if
you need a quick lookup of which button logs which event.

================================================================================
1. WHAT IS AN APPLICATION LOG?
================================================================================

An application log is a record of something that happened to an application.
Think of it like a diary entry. Each entry says:
  - Who did it
  - What they did
  - When they did it
  - Which application it was for

These entries show up on the Activity Timeline. The timeline is on the
application detail page in the admin portal. You scroll down and see a list
of events. Each event has an icon, a label, who did it, and when.

================================================================================
2. WHERE ARE LOGS STORED?
================================================================================

Logs are stored in a database table called application_logs.

The table has these columns:

  Column name         What it stores
  ------------------- ---------------------------------------------------------
  id                  A unique ID for this log row. Like a serial number.
  user_id             The ID of the person who did the action. Required.
  application_id      The ID of the application. Can be empty for some events.
  event_type          A short code that says what happened. Examples:
                      APPLICATION_CREATED, APPLICATION_SUBMITTED, etc.
  remark              A human-readable note. Shown when you click "View details".
  metadata            Extra data in JSON. Things like scope_key, actor name,
                      offered facility, invoice number. The API adds actor names
                      from the users table when you read logs.
  level               Old field. APPLICATION, TAB, or ITEM. Deprecated.
  target              Old field. APPLICATION, FINANCIAL, CONTRACT, etc. Deprecated.
  action              Old field. CREATED, SUBMITTED, APPROVED, etc. Deprecated.
  entity_id           Optional. ID of a related thing, e.g. an invoice.
  portal              Where the action came from. ISSUER or ADMIN.
  review_cycle        Optional. Which review round. A number.
  ip_address          Optional. IP address of the user.
  user_agent          Optional. Browser info.
  device_info         Optional. Device info.
  created_at          When the log was created. Set automatically.

The event_type is the main thing. The UI uses it to pick the icon, label, and
color. level, target, and action are old. We use event_type only now.

================================================================================
3. HOW DOES A LOG GET CREATED?
================================================================================

When something happens in the app, the code calls a function to create a log.
The function is createApplicationLog. It lives in the logs repository.

The code passes:
  - user_id (who did it)
  - application_id (which application)
  - event_type (what happened)
  - remark (optional note)
  - portal (ISSUER or ADMIN)
  - metadata (optional extra data)

The function inserts a new row into application_logs. That is it.

Logging never blocks the main flow. If logging fails, the app still works.
The error is swallowed so the user does not see it.

================================================================================
4. HOW DOES THE TIMELINE GET THE LOGS?
================================================================================

The admin frontend calls an API: GET /v1/applications/:id/logs

The API:
  1. Checks that the user can see this application
  2. Queries application_logs where application_id matches
  3. Orders by created_at descending (newest first)
  4. Fetches user names from the users table
  5. Adds actorName to each log's metadata
  6. Returns the list

The frontend hook useApplicationLogs fetches this. The timeline component
renders each log with an icon, label, actor, and time. If there is a remark
or offer details, a "View details" button shows them.

================================================================================
5. FULL SCENARIO — ISSUER CREATES AND SUBMITS
================================================================================

Step 1: Issuer clicks "Create application" in the issuer portal.

  What happens: A new application is created in the database.
  Log created: APPLICATION_CREATED
  Who: The issuer (user_id)
  Portal: ISSUER
  Where it shows: Activity timeline

Step 2: Issuer fills in the form and clicks "Submit".

  What happens: Application status changes to submitted. It goes to admin.
  Log created: APPLICATION_SUBMITTED
  Who: The issuer
  Portal: ISSUER
  Where it shows: Activity timeline

================================================================================
6. FULL SCENARIO — ADMIN REVIEWS
================================================================================

Step 1: Admin opens the application and clicks "Reset to under review".

  What happens: Status is set back to under review so admin can work on it.
  Log created: APPLICATION_RESET_TO_UNDER_REVIEW
  Who: The admin
  Portal: ADMIN
  Where it shows: Activity timeline

Step 2: Admin reviews a section (a tab). Clicks "Approve" on that section.

  What happens: That section is marked approved.
  Log created: SECTION_REVIEWED_APPROVED
  Who: The admin
  Portal: ADMIN
  Where it shows: Activity timeline

Step 3: Admin reviews an item (e.g. an invoice). Clicks "Reject" on that item.

  What happens: That item is marked rejected.
  Log created: ITEM_REVIEWED_REJECTED
  Who: The admin
  Portal: ADMIN
  Where it shows: Activity timeline

Step 4: Admin wants changes. Clicks "Request amendment" on a section.

  What happens: Amendment request is sent to the issuer.
  Log created: SECTION_REVIEWED_AMENDMENT_REQUESTED
  Who: The admin
  Portal: ADMIN
  Where it shows: Activity timeline

Step 5: Admin sends the amendment request to the issuer.

  What happens: Issuer gets a notification. They must resubmit.
  Log created: AMENDMENTS_SUBMITTED
  Who: The admin
  Portal: ADMIN
  Where it shows: Activity timeline

Step 6: Admin approves the whole application. Clicks "Approve application".

  What happens: Application status becomes approved.
  Log created: APPLICATION_APPROVED
  Who: The admin
  Portal: ADMIN
  Where it shows: Activity timeline

Step 7: Or admin rejects. Clicks "Reject application".

  What happens: Application status becomes rejected.
  Log created: APPLICATION_REJECTED
  Who: The admin
  Portal: ADMIN
  Where it shows: Activity timeline

================================================================================
7. FULL SCENARIO — CONTRACT OFFERS
================================================================================

Step 1: Admin sends a contract offer. Clicks "Send contract offer".

  What happens: Contract status becomes OFFER_SENT. Issuer sees the offer.
  Log created: CONTRACT_OFFER_SENT
  Who: The admin
  Portal: ADMIN
  Where it shows: Activity timeline
  Metadata may include: offered facility, terms

Step 2a: Issuer accepts. Clicks "Accept" on the contract offer.

  What happens: Contract status becomes APPROVED.
  Log created: CONTRACT_OFFER_ACCEPTED
  Who: The issuer
  Portal: ISSUER
  Where it shows: Activity timeline

Step 2b: Issuer rejects. Clicks "Reject" on the contract offer.

  What happens: Contract is withdrawn.
  Log created: CONTRACT_OFFER_REJECTED
  Who: The issuer
  Portal: ISSUER
  Where it shows: Activity timeline

Step 2c: Admin retracts. Clicks "Retract contract offer".

  What happens: Contract offer is cancelled.
  Log created: CONTRACT_OFFER_RETRACTED
  Who: The admin
  Portal: ADMIN
  Where it shows: Activity timeline

Step 2d: Offer expires. A cron job runs and withdraws expired offers.

  What happens: Contract is withdrawn automatically.
  Log created: CONTRACT_WITHDRAWN (or OFFER_EXPIRED)
  Who: System (cron)
  Portal: ADMIN
  Where it shows: Activity timeline

================================================================================
8. FULL SCENARIO — INVOICE OFFERS
================================================================================

Step 1: Admin sends an invoice offer. Clicks "Send invoice offer".

  What happens: Invoice status becomes OFFER_SENT. Issuer sees the offer.
  Log created: INVOICE_OFFER_SENT
  Who: The admin
  Portal: ADMIN
  Where it shows: Activity timeline
  Metadata may include: invoice number

Step 2a: Issuer accepts. Clicks "Accept" on the invoice offer.

  What happens: Invoice status becomes APPROVED.
  Log created: INVOICE_OFFER_ACCEPTED
  Who: The issuer
  Portal: ISSUER
  Where it shows: Activity timeline

Step 2b: Issuer rejects. Clicks "Reject" on the invoice offer.

  What happens: Invoice is withdrawn.
  Log created: INVOICE_OFFER_REJECTED
  Who: The issuer
  Portal: ISSUER
  Where it shows: Activity timeline

Step 2c: Admin retracts. Clicks "Retract invoice offer".

  What happens: Invoice offer is cancelled.
  Log created: INVOICE_OFFER_RETRACTED
  Who: The admin
  Portal: ADMIN
  Where it shows: Activity timeline

Step 2d: Issuer withdraws the invoice. Clicks "Withdraw invoice".

  What happens: Invoice is withdrawn.
  Log created: INVOICE_WITHDRAWN
  Who: The issuer
  Portal: ISSUER
  Where it shows: Activity timeline

Step 2e: Offer expires. Cron withdraws.

  What happens: Invoice is withdrawn automatically.
  Log created: INVOICE_WITHDRAWN or OFFER_EXPIRED
  Who: System (cron)
  Portal: ADMIN
  Where it shows: Activity timeline

================================================================================
9. FULL SCENARIO — ISSUER RESUBMITS AFTER AMENDMENTS
================================================================================

Step 1: Issuer gets amendment request. Makes changes. Clicks "Resubmit".

  What happens: Application goes back to admin for review.
  Log created: APPLICATION_RESUBMITTED
  Who: The issuer
  Portal: ISSUER
  Where it shows: Activity timeline

================================================================================
10. FULL SCENARIO — CANCEL / WITHDRAW
================================================================================

Step 1: Issuer cancels the application. Clicks "Cancel application".

  What happens: All active invoices and contract are withdrawn. Application
  status becomes WITHDRAWN.
  Log created: APPLICATION_WITHDRAWN
  Who: The issuer
  Portal: ISSUER
  Where it shows: Activity timeline

Step 2: Admin withdraws a contract or invoice. Clicks "Withdraw" on that item.

  What happens: That item is withdrawn. If it was the last one, application
  may become WITHDRAWN.
  Log created: CONTRACT_WITHDRAWN or INVOICE_WITHDRAWN
  Who: The admin
  Portal: ADMIN
  Where it shows: Activity timeline

================================================================================
11. FULL SCENARIO — APPLICATION COMPLETED
================================================================================

When the last offer (contract or invoice) is accepted, the application is done.

  What happens: Application status becomes COMPLETED.
  Log created: APPLICATION_COMPLETED
  Who: The issuer (they accepted)
  Portal: ISSUER
  Where it shows: Activity timeline

================================================================================
12. ALL EVENT TYPES (ENUM)
================================================================================

These are in apps/api/src/modules/applications/logs/types.ts.
Use the enum. Do not invent new strings.

  APPLICATION_CREATED
  APPLICATION_SUBMITTED
  APPLICATION_RESUBMITTED
  APPLICATION_APPROVED
  APPLICATION_REJECTED
  APPLICATION_WITHDRAWN
  APPLICATION_COMPLETED
  APPLICATION_RESET_TO_UNDER_REVIEW
  SECTION_REVIEWED_APPROVED
  SECTION_REVIEWED_REJECTED
  SECTION_REVIEWED_AMENDMENT_REQUESTED
  SECTION_REVIEWED_PENDING
  ITEM_REVIEWED_APPROVED
  ITEM_REVIEWED_REJECTED
  ITEM_REVIEWED_AMENDMENT_REQUESTED
  ITEM_REVIEWED_PENDING
  CONTRACT_OFFER_SENT
  CONTRACT_OFFER_ACCEPTED
  CONTRACT_OFFER_REJECTED
  CONTRACT_OFFER_RETRACTED
  CONTRACT_WITHDRAWN
  INVOICE_OFFER_SENT
  INVOICE_OFFER_ACCEPTED
  INVOICE_OFFER_REJECTED
  INVOICE_OFFER_RETRACTED
  INVOICE_WITHDRAWN
  OFFER_EXPIRED
  AMENDMENTS_SUBMITTED

================================================================================
13. KEY FILES
================================================================================

  Purpose                      File
  ---------------------------- --------------------------------------------------
  Database table definition    apps/api/prisma/schema.prisma (ApplicationLog)
  Log creation                 apps/api/src/modules/applications/logs/repository.ts
  Log types and enum           apps/api/src/modules/applications/logs/types.ts
  Log service wrapper          apps/api/src/modules/applications/logs/service.ts
  API route                    apps/api/src/modules/applications/controller.ts
  Frontend hook                apps/admin/src/hooks/use-application-logs.ts
  Timeline component           apps/admin/src/components/admin-activity-timeline.tsx

================================================================================
END
================================================================================
