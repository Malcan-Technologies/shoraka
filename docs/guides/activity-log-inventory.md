# Activity Log Inventory

This document lists the curated activities now shown on the investor and issuer `/activity` pages.

## Feed model

Each visible row now includes:

- a domain badge
- a short event title
- a one-sentence description, with application-domain references woven naturally into that sentence when applicable
- for `application` domain rows, an application reference plus contract or invoice references when applicable
- a timestamp

The feed no longer mirrors every audit log. Low-value internal updates such as section-level and item-level review events are intentionally hidden from users.

## Domain badges

- `Onboarding`
  - Badge tone: submitted/info
  - Badge classes: `border-transparent bg-status-submitted-bg text-status-submitted-text`
- `Application`
  - Badge tone: in progress
  - Badge classes: `border-transparent bg-status-in-progress-bg text-status-in-progress-text`
- `Note`
  - Badge tone: success
  - Badge classes: `border-transparent bg-status-success-bg text-status-success-text`
  - Reserved for the next pass; not yet rendered in `/activity`

## Investor

The investor page shows the same curated domains and event copy as the issuer page. The difference is data scope:

- onboarding logs are scoped by `investor_organization_id`
- application logs currently remain subject to the existing investor-side application scoping behavior in the adapter

### Onboarding

- Raw types: `ONBOARDING_STARTED`
  - Domain badge: `Onboarding`
  - Title: `Onboarding Started`
  - Description: `Your organization onboarding has started and you can continue it at any time.`
- Raw types: `ONBOARDING_CANCELLED`
  - Domain badge: `Onboarding`
  - Title: `Onboarding Closed`
  - Description: `Your organization onboarding was cancelled and will not continue.`
- Raw types: `ONBOARDING_REJECTED`
  - Domain badge: `Onboarding`
  - Title: `Onboarding Rejected`
  - Description: `Your organization onboarding was rejected: <reason>.`
- Raw types: `FINAL_APPROVAL_COMPLETED`, `ONBOARDING_APPROVED`
  - Domain badge: `Onboarding`
  - Title: `Onboarding Approved`
  - Description: `Your organization onboarding was approved and no further action is needed.`

### Application

Application-domain rows always show the application reference inside the description sentence. In the issuer portal this uses the same visible format as the applications list: `#` plus the last 8 characters of the application ID, uppercased. Contract and invoice milestone rows should weave the linked contract or invoice reference into the wording itself, for example `An invoice offer for invoice <invoice reference> is ready for your review and response.`

- Raw types: `APPLICATION_CREATED`
  - Domain badge: `Application`
  - Title: `Application Started`
  - Description: `You created application <application reference> and can continue it before submitting.`
- Raw types: `APPLICATION_SUBMITTED`
  - Domain badge: `Application`
  - Title: `Application Submitted`
  - Description: `Application <application reference> was submitted and is now under review.`
- Raw types: `APPLICATION_RESUBMITTED`
  - Domain badge: `Application`
  - Title: `Application Resubmitted`
  - Description: `You resubmitted application <application reference> after making the requested updates.`
- Raw types: `AMENDMENTS_SUBMITTED`
  - Domain badge: `Application`
  - Title: `Changes Requested`
  - Description: `We need updates to application <application reference> before it can continue.`
- Raw types: `APPLICATION_APPROVED`
  - Domain badge: `Application`
  - Title: `Application Approved`
  - Description: `Application <application reference> was approved and no further action is needed.`
- Raw types: `APPLICATION_REJECTED`
  - Domain badge: `Application`
  - Title: `Application Rejected`
  - Description: `Application <application reference> was rejected and will not continue.`
- Raw types: `APPLICATION_WITHDRAWN`
  - Domain badge: `Application`
  - Title: `Application Closed`
  - Description: `Application <application reference> was withdrawn and is no longer active.`
- Raw types: `APPLICATION_COMPLETED`
  - Domain badge: `Application`
  - Title: `Application Completed`
  - Description: `Application <application reference> completed successfully.`
- Raw types: `CONTRACT_OFFER_SENT`
  - Domain badge: `Application`
  - Title: `Contract Offer Sent`
  - Description: `A contract offer for contract <contract reference> is ready for your review and response.`
- Raw types: `CONTRACT_OFFER_ACCEPTED`
  - Domain badge: `Application`
  - Title: `Contract Offer Accepted`
  - Description: `The offer for contract <contract reference> was accepted and your application can move forward.`
- Raw types: `CONTRACT_OFFER_REJECTED`
  - Domain badge: `Application`
  - Title: `Contract Offer Declined`
  - Description: `The contract offer was declined and this application is now closed.`
- Raw types: `CONTRACT_OFFER_RETRACTED`
  - Domain badge: `Application`
  - Title: `Contract Offer Retracted`
  - Description: `The contract offer was withdrawn before it was accepted.`
- Raw types: `CONTRACT_WITHDRAWN`
  - Domain badge: `Application`
  - Title: `Contract Withdrawn`
  - Description: `The contract linked to this application was withdrawn.`
- Raw types: `INVOICE_OFFER_SENT`
  - Domain badge: `Application`
  - Title: `Invoice Offer Sent`
  - Description: `An invoice offer is ready for your review and response.`
- Raw types: `INVOICE_OFFER_ACCEPTED`
  - Domain badge: `Application`
  - Title: `Invoice Offer Accepted`
  - Description: `The invoice offer was accepted and funding can continue.`
- Raw types: `INVOICE_OFFER_REJECTED`
  - Domain badge: `Application`
  - Title: `Invoice Offer Declined`
  - Description: `The invoice offer was declined and this application has stopped moving forward.`
- Raw types: `INVOICE_OFFER_RETRACTED`
  - Domain badge: `Application`
  - Title: `Invoice Offer Retracted`
  - Description: `The invoice offer was withdrawn before it was accepted.`
- Raw types: `INVOICE_WITHDRAWN`
  - Domain badge: `Application`
  - Title: `Invoice Withdrawn`
  - Description: `An invoice linked to this application was withdrawn.`
- Raw types: `OFFER_EXPIRED`
  - Domain badge: `Application`
  - Title: `Offer Expired`
  - Description: `An outstanding offer expired before it was accepted.`

## Issuer

The issuer page uses the same curated event set and copy as the investor page. The difference is data scope:

- onboarding logs are scoped by `issuer_organization_id`
- application logs are scoped to applications whose `issuer_organization_id` matches the active organization

### Onboarding

Visible onboarding events match the investor portal:

- `ONBOARDING_STARTED` -> `Onboarding Started`
- `ONBOARDING_CANCELLED` -> `Onboarding Closed`
- `ONBOARDING_REJECTED` -> `Onboarding Rejected`
- `FINAL_APPROVAL_COMPLETED`, `ONBOARDING_APPROVED` -> `Onboarding Approved`

### Application

Visible application events match the investor portal:

- `APPLICATION_CREATED` -> `Application Started`
- `APPLICATION_SUBMITTED` -> `Application Submitted`
- `APPLICATION_RESUBMITTED` -> `Application Resubmitted`
- `AMENDMENTS_SUBMITTED` -> `Changes Requested`
- `APPLICATION_APPROVED` -> `Application Approved`
- `APPLICATION_REJECTED` -> `Application Rejected`
- `APPLICATION_WITHDRAWN` -> `Application Closed`
- `APPLICATION_COMPLETED` -> `Application Completed`
- contract offer milestones
- invoice offer milestones
- `OFFER_EXPIRED`

## Hidden from the feed

These logs still exist as audit records but are intentionally hidden from `/activity`:

- onboarding progress noise such as section completion and sub-approval steps
- application section-level review events
- application item-level review events
- internal reset-style status churn that does not help a user understand what changed
