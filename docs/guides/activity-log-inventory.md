# Activity Log Inventory

This document lists the curated activities shown on the investor and issuer `/activity` pages.

Related: `docs/guides/admin/activity-timeline.md` (admin surfaces and presentation architecture), `docs/audit/current-audit-logging-inventory.md` (stores and writers).

## Feed model

Each visible row includes:

- a workflow status badge (`StatusBadge` with viewer-centric tokens — yellow = you must act, blue = waiting, violet = live, green = complete, grey = closed, red = failed)
- a short event title
- a one-sentence description
- a link to the related application, contract, invoice, note, or organisation profile when a stable id exists (`getActivityHref`)
- a timestamp

The feed is **not** a dump of every AuditLog row. Visibility is `packages/types/src/activity-visibility.ts`. Copy is `packages/types/src/activity-presentation.ts`. After onboarding is complete, default filters hide the onboarding domain (still available via Area).

`ActivityFeed` (`packages/ui`) is presentation. Rows come from Activity adapters over current AuditLog tables.

## Status badges

Do not colour rows by domain (Onboarding / Application / Note / Signing / Payment). Domain is a filter, not a workflow status. Map `event_type` with `getActivityStatusToken` in `packages/types/src/activity-presentation.ts`. Do not use indigo (`in-progress`) or sky (`completed`) on these chips.

Examples:

- Offer sent / updates requested / signing package sent → `action` (yellow, “Action needed”)
- Application submitted / note published / repayment submitted → `submitted` (blue, “Waiting”)
- Note active → `active` (violet, “Live”)
- Approved / signed / investment committed → `success` (green, “Complete”)
- Withdrawn / cancelled / paused → `neutral` (grey, “Closed”)
- Rejected / expired / funding failed / defaulted → `rejected` (red, “Failed”)

## Default domains

`getDefaultActivityDomains` / `getFilterableActivityDomains`:

| Portal | Filterable domains | Default after onboarding complete |
|--------|--------------------|-----------------------------------|
| Issuer | onboarding, application, note, signing | application, note, signing |
| Investor | onboarding, note, payment | note, payment |

Until onboarding is complete, the default domain list is empty and the API is unfiltered, so all filterable domains including onboarding are shown.

## Investor

Investor `/activity` shows investor-scoped onboarding, curated note milestones, and curated payment events. Application and signing domains are issuer-only.

- onboarding logs are scoped by `organization_id` (or `subject_user_id` when no org is selected)
- note logs follow investor visibility (`INVESTMENT_COMMITTED` for that investor org; campaign/funding/default events when committed; `SETTLEMENT_POSTED` when the snapshot allocates to that investor)
- payment logs follow `PAYMENT_INVESTOR_SHOW` / refund conditional rules
- application logs are excluded from the investor feed and filters

Investor money movements that are not curated Activity stay on **Portfolio**. Withdraw requests send `withdrawalIntentId`. Do not treat `/investments?tab=transactions` as the current transactions surface.

### Onboarding

- `ONBOARDING_STARTED` — Title `Onboarding Started`. Description: `Your organization onboarding has started.`
- `ONBOARDING_RESTARTED` — Title `Onboarding Restarted`. Description: `Your organization onboarding was restarted.`
- `ONBOARDING_STATUS_CHANGED` (conditional — review and amendment only)
  - `IN_PROGRESS`/`PENDING` → `PENDING_SSM_REVIEW`: Title `Verification Submitted`
  - `IN_PROGRESS`/`PENDING` → `PENDING_APPROVAL`: Title `Verification Submitted`
  - `PENDING_SSM_REVIEW`/`PENDING_APPROVAL` → `PENDING_AMENDMENT`: Title `Amendment Requested`
  - `PENDING_AMENDMENT` → `PENDING_SSM_REVIEW`: Title `Verification Resubmitted`
  - Unexpected transitions use title `Onboarding Stage Updated` on admin only and are not investor-visible.
- `ONBOARDING_REJECTED` — Title `Onboarding Rejected`
- `ONBOARDING_APPROVED` — Title `Onboarding Submission Approved`
- `ONBOARDING_COMPLETED` — Title `Onboarding Completed`
- `INVESTOR_SOPHISTICATED_STATUS_UPDATED` (conditional — `previousValue` and `newValue` are booleans and differ) — Title `Sophisticated Status Updated`

### Note

- `INVESTMENT_COMMITTED` — Title `Investment Committed`. Description uses amount when present (`Your investment of {amount} was committed.`).
- `SETTLEMENT_POSTED` (conditional — investor allocation on the snapshot) — Title `Returns Credited`. Description: `Your returns were credited to your CashSouk balance.`
- `NOTE_CAMPAIGN_PAUSED` / `NOTE_CAMPAIGN_RESUMED` / `NOTE_FUNDING_CLOSED` / `NOTE_FUNDING_FAILED` / `NOTE_ACTIVATED` / `NOTE_MARKED_DEFAULT` — visible when the investor is committed
- `NOTE_SERVICING_STATUS_CHANGED` — visible when committed and `newServicingStatus` is `LATE`, `ARREARS`, or `DEFAULTED`

`NOTE_FUNDING_FAILED` title is `Funding Unsuccessful`. `NOTE_ACTIVATED` investor title is `Investment Activated`. `NOTE_MARKED_DEFAULT` title is `Note Marked in Default`.

`FAIL_FUNDING`, `ACTIVATE`, `NOTE_DEFAULT_MARKED`, `CLOSE_FUNDING`, `PUBLISH`, and `NOTE_CREATED_FROM_INVOICE` are **not** live investor Activity event types. Some remain CSV/display aliases on admin note export.

For investor payouts, `SETTLEMENT_POSTED` is the visible milestone. `REPAYMENT_RECEIVED` is hidden from the investor feed.

### Payment

Visible when `isPaymentActivityVisible` allows:

- `PAYMENT_FAILED` — `Payment Failed`
- `PAYMENT_EXPIRED` — `Payment Expired`
- `PAYMENT_NAME_CHECK_REJECTED` — `Payment Verification Failed`
- `INVESTOR_DEPOSIT_RECEIVED` — `Deposit Received`
- `INVESTOR_WITHDRAWAL_REQUESTED` — `Withdrawal Requested`
- `INVESTOR_WITHDRAWAL_SUBMITTED_TO_TRUSTEE` — `Withdrawal Processing`
- `INVESTOR_WITHDRAWAL_COMPLETED` — `Withdrawal Completed`
- `PAYMENT_REFUND_INITIATED` / `PAYMENT_REFUNDED` — conditional (investor-facing refund path)

## Issuer

The issuer page uses the shared user-facing onboarding set, plus issuer-scoped application, signing, and note milestones.

- onboarding logs are scoped by `organization_id` (or `subject_user_id` when no org is selected)
- application logs are scoped to applications whose `issuer_organization_id` matches the active organization
- note logs are scoped to notes whose `issuer_organization_id` matches the active organization
- signing logs are issuer-visible envelope milestones

### Onboarding

Visible onboarding events match the investor portal for the shared user-facing set, plus issuer-only director events:

- `ONBOARDING_STARTED` → `Onboarding Started`
- `ONBOARDING_RESTARTED` → `Onboarding Restarted`
- `ONBOARDING_STATUS_CHANGED` (review/amendment only) → `Verification Submitted` / `Amendment Requested` / `Verification Resubmitted`
- `ONBOARDING_REJECTED` → `Onboarding Rejected`
- `ONBOARDING_APPROVED` → `Onboarding Submission Approved`
- `ONBOARDING_COMPLETED` → `Onboarding Completed`
- `DIRECTOR_ONBOARDING_INVITATION_SENT` (issuer COMPANY only; investor activity hidden) → `Director Invitation Sent`. Writer: Company org COMPLETED → Profile → Directors and Shareholders → Confirm & Send → Confirm.
- `DIRECTOR_KYC_STATUS_UPDATED` (`APPROVED` / `REJECTED` outcomes only) → `Director Verification Approved` / `Director Verification Rejected`

### Application

Issuer-visible application events (`APPLICATION_ISSUER_SHOW` plus conditional section-review):

- `APPLICATION_CREATED` → `Application Created`
- `APPLICATION_SUBMITTED` → `Application Submitted`
- `APPLICATION_RESUBMITTED` → `Application Resubmitted`
- `APPLICATION_AMENDMENTS_REQUESTED` → `Updates Requested`
- `APPLICATION_REOPENED_FOR_REVIEW` → `Application Reopened`
- `APPLICATION_REJECTED` → `Application Rejected`
- `APPLICATION_WITHDRAWN` → `Application Withdrawn`
- `APPLICATION_COMPLETED` → `Application Completed`
- `APPLICATION_SECTION_REVIEW_UPDATED` when `newStatus` is an amendment-required status → `Section Changes Requested`
- contract / invoice offer lifecycle including `CONTRACT_ACCEPTANCE_*` and `INVOICE_ACCEPTANCE_*` (not `CONTRACT_OFFER_ACCEPTANCE_*`)
- `CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING` / `INVOICE_ACCEPTANCE_APPROVED_FOR_SIGNING` are issuer-visible (they are in the offer lifecycle set)

There is no live `APPLICATION_APPROVED` application audit event.

### Signing

Issuer-visible (`SIGNING_ISSUER_SHOW`): `SIGNING_PACKAGE_SENT`, `SIGNING_PACKAGE_COMPLETED`, `SIGNING_PACKAGE_VOIDED` (issuer title `Signing Package Cancelled`), `SIGNING_PACKAGE_DECLINED`, `SIGNING_PACKAGE_EXPIRED`, `SIGNING_RECIPIENT_DECLINED`. `SIGNING_EKYC_FAILED` is also issuer-visible.

Admin application detail curated Activity additionally hides `SIGNING_PACKAGE_COMPLETED`; issuer `/activity` does not.

### Note

Issuer-visible (`NOTE_ISSUER_SHOW`), plus `NOTE_TERMS_UPDATED` when the note is visible to the issuer (`publishedAt` or listing `PUBLISHED` / `UNPUBLISHED`):

- `NOTE_CREATED` → `Note Created`
- `NOTE_PUBLISHED` → `Note Published`
- `NOTE_UNPUBLISHED` → `Note Unpublished`
- `NOTE_CAMPAIGN_PAUSED` / `NOTE_CAMPAIGN_RESUMED`
- `NOTE_FUNDING_CLOSED` → `Funding Closed`
- `NOTE_FUNDING_FAILED` → `Funding Unsuccessful`
- `NOTE_ACTIVATED` → `Note Activated`
- `NOTE_SERVICING_STATUS_CHANGED`
- `NOTE_MARKED_DEFAULT` → `Note Marked in Default`
- `DISBURSEMENT_COMPLETED` / `RESIDUAL_RETURN_COMPLETED`
- `REPAYMENT_SUBMITTED` / `REPAYMENT_RECEIVED` / `REPAYMENT_REJECTED`

`NOTE_CREATED_FROM_INVOICE`, `PUBLISH`, `CLOSE_FUNDING`, `FAIL_FUNDING`, `ACTIVATE`, `ISSUER_PAYMENT_SUBMITTED`, and `NOTE_DEFAULT_MARKED` are **not** live issuer Activity event types.

## Hidden from the feed

These logs still exist as AuditLog rows (or retired historical rows) but are not shown on `/activity` for that audience:

- onboarding progress noise such as SSM/AML/CTOS admin-detail steps, and `ONBOARDING_FINAL_APPROVAL_COMPLETED` (users see `ONBOARDING_COMPLETED` instead)
- `ONBOARDING_RESUMED` (retired; not user-facing even if a historical row exists)
- `CTOS_REPORT_RECEIVED` (retired; no current writer. A successful CTOS Fetch still performs the SOAP enquiry and inserts a new `ctos_reports` row)
- `CORPORATE_ENTITIES_UPDATED` (retired; `corporate_entities` still persists)
- `DIRECTOR_ONBOARDING_INVITATION_SENT` on investor activity (the event is still written for Investor COMPANY Confirm & Send; investor `/activity` hides it)
- intermediate director KYC statuses. Audit rows exist only for final `APPROVED` / `REJECTED` on an existing director
- most application section-level and item-level review events (`APPLICATION_ITEM_REVIEW_UPDATED` is never user-facing; `APPLICATION_SECTION_REVIEW_UPDATED` only when amendment is required)
- signing package created / eKYC start-verify internals that are not in the issuer allowlist
- note operational steps such as Shoraka, trustee letters, settlement preview/approve
- Access, Security, Legal admin, Product, and Notification broadcasts (raw admin audit only)
- investor ledger rows that belong on Portfolio / note-detail money views
