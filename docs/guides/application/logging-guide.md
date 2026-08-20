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

Curated Activity is RecentActivityCard on the admin application detail page.
Raw Audit History is a separate ApplicationAuditHistoryCard on the same page.
Issuer /activity uses the same ApplicationAuditLog / SigningAuditLog rows
through visibility adapters. Audit is history, not workflow state.

================================================================================
2. WHERE ARE LOGS STORED?
================================================================================

Application/review/contract/invoice history is stored in application_audit_logs
(ApplicationAuditLog). Signing history is stored in signing_audit_logs
(SigningAuditLog). Legacy application_logs has been dropped.

GET /v1/applications/:id/logs merges both tables for the timeline. It is a
reader projection, not a store, and not workflow state.

Event catalogues:
  APPLICATION_AUDIT_EVENTS  apps/api/src/modules/applications/audit/events.ts
  SIGNING_AUDIT_EVENTS      apps/api/src/modules/signing/audit/events.ts

================================================================================
3. HOW DOES A LOG GET CREATED?
================================================================================

Application-domain code calls writeApplicationAuditLog.
Signing-domain code calls writeSigningAuditLog.

There is no logApplicationActivity or createApplicationLog helper.

================================================================================
4. HOW DOES THE TIMELINE GET THE LOGS?
================================================================================

The admin frontend calls an API: GET /v1/applications/:id/logs

The API:
  1. Checks that the user can see this application
  2. Reads ApplicationAuditLog and SigningAuditLog for that application
  3. Merges them newest-first
  4. Returns the list

The frontend hook useApplicationLogs fetches this. The name is preserved
public/API naming; it is not the deleted Prisma ApplicationLog model.

The timeline component renders each log with an icon, label, actor, and time.

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

Step 1: Admin reopens the application for review.

  What happens: Status is set back so admin can work on it.
  Log created: APPLICATION_REOPENED_FOR_REVIEW
  Who: The admin
  Portal: ADMIN
  Where it shows: Activity timeline and raw Audit History
  Legacy/display alias APPLICATION_RESET_TO_UNDER_REVIEW is not emitted.

Step 2: Admin reviews a section (a tab). Clicks "Approve" on that section.

  What happens: That section is marked approved.
  Log created: APPLICATION_SECTION_REVIEW_UPDATED
  Metadata: section, previousStatus, newStatus, optional remarks
  Who: The admin
  Portal: ADMIN
  Where it shows: raw Audit History. Curated Activity only when newStatus is
  an amendment-required status.
  Legacy/display alias SECTION_REVIEWED_* is not emitted.

Step 3: Admin reviews an item (e.g. an invoice). Clicks "Reject" on that item.

  What happens: That item is marked rejected.
  Log created: APPLICATION_ITEM_REVIEW_UPDATED
  Metadata: itemId, previousStatus, newStatus, optional section/remarks
  Who: The admin
  Portal: ADMIN
  Where it shows: raw Audit History (hidden from issuer/investor Activity)
  Legacy/display alias ITEM_REVIEWED_* is not emitted.

Step 4: Admin wants changes. Clicks "Request amendment" on a section.

  What happens: Section status becomes amendment-required.
  Log created: APPLICATION_SECTION_REVIEW_UPDATED
  Who: The admin
  Portal: ADMIN
  Where it shows: Activity timeline when newStatus is amendment-required

Step 5: Admin sends the amendment request to the issuer.

  What happens: Issuer gets a notification. They must resubmit.
  Log created: APPLICATION_AMENDMENTS_REQUESTED
  Who: The admin
  Portal: ADMIN
  Where it shows: Activity timeline
  Legacy/display alias AMENDMENTS_SUBMITTED is not emitted.

Step 6: Admin starts under-review (SUBMITTED or RESUBMITTED → UNDER_REVIEW).
There is no live APPLICATION_APPROVED application audit event.

  What happens: Application status becomes UNDER_REVIEW.
  Log created: APPLICATION_REVIEW_STARTED
  Who: The admin
  Portal: ADMIN
  Where it shows: admin curated Activity (issuer Activity hides this type)

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
  Log created: CONTRACT_OFFER_EXPIRED (durable OFFER_EXPIRED; not terminal WITHDRAWN)
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
  Log created: INVOICE_OFFER_EXPIRED
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
12. ALL EVENT TYPES
================================================================================

Use APPLICATION_AUDIT_EVENTS and SIGNING_AUDIT_EVENTS. Do not invent new strings.
SIGNING_PACKAGE_* belong to SigningAuditLog.

================================================================================
13. KEY FILES
================================================================================

  Purpose                      File
  ---------------------------- --------------------------------------------------
  Application audit table      apps/api/prisma/schema.prisma (ApplicationAuditLog)
  Signing audit table          apps/api/prisma/schema.prisma (SigningAuditLog)
  Application writer           apps/api/src/modules/applications/audit/writer.ts
  Signing writer               apps/api/src/modules/signing/audit/writer.ts
  Merged timeline API          apps/api/src/modules/applications/service.ts
  API route                    apps/api/src/modules/applications/controller.ts
  Frontend hook                apps/admin/src/hooks/use-application-logs.ts
  Timeline component           apps/admin/src/components/admin-activity-timeline.tsx
  Raw Audit History            apps/admin/src/app/applications/[productKey]/[id]/page.tsx
                               (ApplicationAuditHistoryCard)

================================================================================
END
================================================================================
