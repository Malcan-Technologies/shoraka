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

- onboarding logs are scoped by `organization_id` (or `subject_user_id` when no org is selected)
- note logs are scoped to notes the active investor organization has invested in
- application logs are excluded from the investor `/activity` feed and filters

### Onboarding

- Raw types: `ONBOARDING_STARTED`
  - Domain badge: `Onboarding`
  - Title: `Onboarding Started`
  - Description: `Your organization onboarding has started.`
- Raw types: `ONBOARDING_RESTARTED`
  - Domain badge: `Onboarding`
  - Title: `Onboarding Restarted`
  - Description: `Your organization onboarding was restarted.`
- Raw types: `ONBOARDING_STATUS_CHANGED` (conditional — review and amendment only)
  - Domain badge: `Onboarding`
  - `IN_PROGRESS`/`PENDING` → `PENDING_SSM_REVIEW`: Title `Verification Submitted`. Description: `The organisation was submitted for company verification review.`
  - `IN_PROGRESS`/`PENDING` → `PENDING_APPROVAL`: Title `Verification Submitted`. Description: `The organisation was submitted for onboarding review.`
  - `PENDING_SSM_REVIEW`/`PENDING_APPROVAL` → `PENDING_AMENDMENT`: Title `Amendment Requested`. Description: `The organisation was sent back to update verification details.`
  - `PENDING_AMENDMENT` → `PENDING_SSM_REVIEW`: Title `Verification Resubmitted`. Description: `Updated verification was submitted and review resumed.`
  - Unexpected transitions use title `Onboarding Stage Updated` on admin only and are not investor-visible.
- Raw types: `ONBOARDING_REJECTED`
  - Domain badge: `Onboarding`
  - Title: `Onboarding Rejected`
  - Description: `Your organization onboarding was rejected.`
- Raw types: `ONBOARDING_APPROVED`
  - Domain badge: `Onboarding`
  - Title: `Onboarding Submission Approved`
  - Description: `Your onboarding submission was approved. Additional checks may still be required before onboarding is completed.`
- Raw types: `ONBOARDING_COMPLETED`
  - Domain badge: `Onboarding`
  - Title: `Onboarding Completed`
  - Description: `Your organization onboarding is complete.`
- Raw types: `INVESTOR_SOPHISTICATED_STATUS_UPDATED` (conditional — `previousValue` and `newValue` are booleans and differ)
  - Domain badge: `Onboarding`
  - Title: `Sophisticated Status Updated`
  - Description: granted `You have been recognised as a sophisticated investor.` / removed `Your sophisticated investor status was removed.`

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

- onboarding logs are scoped by `organization_id` (or `subject_user_id` when no org is selected)
- application logs are scoped to applications whose `issuer_organization_id` matches the active organization
- note logs are scoped to notes whose `issuer_organization_id` matches the active organization

### Onboarding

Visible onboarding events match the investor portal for the shared user-facing set, plus issuer-only director events:

- `ONBOARDING_STARTED` -> `Onboarding Started`
- `ONBOARDING_RESTARTED` -> `Onboarding Restarted`
- `ONBOARDING_STATUS_CHANGED` (review/amendment only) -> `Verification Submitted` / `Amendment Requested` / `Verification Resubmitted`
- `ONBOARDING_REJECTED` -> `Onboarding Rejected`
- `ONBOARDING_APPROVED` -> `Onboarding Submission Approved`
- `ONBOARDING_COMPLETED` -> `Onboarding Completed`
- `DIRECTOR_ONBOARDING_INVITATION_SENT` (issuer company) -> `Director Invitation Sent`
- `DIRECTOR_KYC_STATUS_UPDATED` (`APPROVED` / `REJECTED` outcomes only) -> `Director Verification Approved` / `Director Verification Rejected`

### Application

Visible application events match the investor portal:

- `APPLICATION_CREATED` -> `Application Started`
- `APPLICATION_SUBMITTED` -> `Application Submitted`
- `APPLICATION_RESUBMITTED` -> `Application Resubmitted`
- `APPLICATION_AMENDMENTS_REQUESTED` -> `Changes Requested`
- `APPLICATION_APPROVED` -> `Application Approved`
- `APPLICATION_REJECTED` -> `Application Rejected`
- `APPLICATION_WITHDRAWN` -> `Application Closed`
- `APPLICATION_COMPLETED` -> `Application Completed`
- contract offer milestones (including `CONTRACT_OFFER_EXPIRED`, `CONTRACT_OFFER_ACCEPTANCE_SUBMITTED`, `CONTRACT_OFFER_ACCEPTANCE_RESUBMITTED`)
- invoice offer milestones (including `INVOICE_OFFER_EXPIRED`, `INVOICE_OFFER_ACCEPTANCE_SUBMITTED`, `INVOICE_OFFER_ACCEPTANCE_RESUBMITTED`)
- signing package sent (`SIGNING_PACKAGE_SENT`); terminal success via offer signed events (`CONTRACT_OFFER_ACCEPTED`, `INVOICE_OFFER_ACCEPTED`)

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

- onboarding progress noise such as section completion, SSM/AML/CTOS admin-detail steps, and `ONBOARDING_FINAL_APPROVAL_COMPLETED` (users see `ONBOARDING_COMPLETED` instead)
- `ONBOARDING_RESUMED` (retired; not user-facing even if a historical row exists)
- `CORPORATE_ENTITIES_UPDATED` (retired; `corporate_entities` still persists)
- intermediate director KYC statuses (`ID_UPLOADED`, `LIVENESS_STARTED`, `WAIT_FOR_APPROVAL`, and other non-final states)
- application section-level review events
- application item-level review events
- admin-only acceptance approval events (`CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING`, `INVOICE_ACCEPTANCE_APPROVED_FOR_SIGNING`)
- signing package created/completed/voided audit rows (`SIGNING_PACKAGE_CREATED`, `SIGNING_PACKAGE_COMPLETED`, `SIGNING_PACKAGE_VOIDED`)
- internal reset-style status churn that does not help a user understand what changed
- note operational steps such as Shoraka or trustee processing details
- note settlement approval workflow internals
- note repayment receipt events that are superseded by the investor-facing `Settlement Posted` milestone
- investor ledger rows that are already covered by `/transactions` and note-detail balance activity
