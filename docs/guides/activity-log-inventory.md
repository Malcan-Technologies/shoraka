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

The investor page only shows investor-scoped onboarding activity. Application-domain rows are issuer-only until the product has an explicit investor-facing application model and access path.

- onboarding logs are scoped by `investor_organization_id`
- application logs are excluded from the investor `/activity` feed and filters

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
