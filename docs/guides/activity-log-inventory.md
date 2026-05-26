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
  - Used for curated note lifecycle milestones only

## Investor

The investor page shows investor-scoped onboarding activity and curated note milestones. Application-domain rows remain issuer-only.

- onboarding logs are scoped by `investor_organization_id`
- note logs are scoped to notes the active investor organization has invested in
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

### Note

- Raw types: `INVESTMENT_COMMITTED`
  - Domain badge: `Note`
  - Title: `Investment Committed`
  - Description: `Your investment in note <reference> was committed successfully.`
- Raw types: `SETTLEMENT_POSTED`
  - Domain badge: `Note`
  - Title: `Settlement Posted`
  - Description: `Your returns for note <reference> were posted.`
- Raw types: `FAIL_FUNDING`
  - Domain badge: `Note`
  - Title: `Funding Unsuccessful`
  - Description: `Note <reference> did not meet the minimum funding threshold and committed funds were released.`
- Raw types: `ACTIVATE`, issuer-disbursement `WITHDRAWAL_COMPLETED`
  - Domain badge: `Note`
  - Title: `Note Active`
  - Description: `Note <reference> is now active and servicing has started.`
- Raw types: `NOTE_DEFAULT_MARKED`
  - Domain badge: `Note`
  - Title: `Note Defaulted`
  - Description: `Note <reference> was marked in default and requires attention.`

Investor `/activity` does not duplicate raw ledger rows from `/transactions` or note-detail balance activity. Commits, releases, and payouts remain on those dedicated money surfaces unless they also represent a curated note milestone above.
For investor payouts, `SETTLEMENT_POSTED` is the visible milestone. `PAYMENT_RECEIVED` remains an internal servicing event and is intentionally hidden from the investor feed to avoid duplicating the same repayment cycle at two nearby steps.

## Issuer

The issuer page uses the same onboarding event set as the investor page, plus issuer-scoped application and note milestones. The difference is data scope:

- onboarding logs are scoped by `issuer_organization_id`
- application logs are scoped to applications whose `issuer_organization_id` matches the active organization
- note logs are scoped to notes whose `issuer_organization_id` matches the active organization

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

### Note

- `NOTE_CREATED_FROM_INVOICE` -> `Note Created`
- `PUBLISH` -> `Note Published`
- `CLOSE_FUNDING` -> `Funding Closed`
- `ISSUER_PAYMENT_SUBMITTED` -> `Payment Submitted`
- `FAIL_FUNDING` -> `Funding Unsuccessful`
- `ACTIVATE`, issuer-disbursement `WITHDRAWAL_COMPLETED` -> `Note Active`
- `NOTE_DEFAULT_MARKED` -> `Note Defaulted`

## Hidden from the feed

These logs still exist as audit records but are intentionally hidden from `/activity`:

- onboarding progress noise such as section completion and sub-approval steps
- application section-level review events
- application item-level review events
- internal reset-style status churn that does not help a user understand what changed
- note operational steps such as Shoraka or trustee processing details
- note settlement approval workflow internals
- note repayment receipt events that are superseded by the investor-facing `Settlement Posted` milestone
- investor ledger rows that are already covered by `/transactions` and note-detail balance activity
