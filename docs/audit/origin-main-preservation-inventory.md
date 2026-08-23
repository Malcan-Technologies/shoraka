# origin/main Audit & Logging Preservation Inventory

Read-only inventory of every audit/logging table, live event, writer, reader, UI surface and export
path as they exist on `origin/main` (commit `28ae5c58`).

This document is the **preservation contract**. Anything recorded here must still be true after the
standardization work. `no_fix_55` is referenced only as a source of field conventions — its table
replacement is explicitly rejected.

## 1. Table census

Eleven append-style log tables plus the history/state tables they depend on. All must survive.

| #   | Prisma model              | Table                        | Domain                   | Anchor column               |
| --- | ------------------------- | ---------------------------- | ------------------------ | --------------------------- |
| 1   | `AccessLog`               | `access_logs`                | Access                   | `user_id`                   |
| 2   | `SecurityLog`             | `security_logs`              | Security                 | `user_id` (subject)         |
| 3   | `OnboardingLog`           | `onboarding_logs`            | Onboarding               | `user_id` + org ids         |
| 4   | `ApplicationLog`          | `application_logs`           | Application / Signing    | `application_id`            |
| 5   | `ApplicationReviewEvent`  | `application_review_events`  | Application review       | `application_id`            |
| 6   | `LegalDocumentAuditLog`   | `legal_document_audit_logs`  | Legal (admin)            | `legal_document_id`         |
| 7   | `LegalDocumentAcceptance` | `legal_document_acceptances` | Legal (consent evidence) | `legal_document_version_id` |
| 8   | `ProductLog`              | `product_logs`               | Product                  | `product_id`                |
| 9   | `NoteEvent`               | `note_events`                | Note                     | `note_id`                   |
| 10  | `NoteAdminAction`         | `note_admin_actions`         | Note (admin)             | `note_id`                   |
| 11  | `GatewayPaymentEvent`     | `gateway_payment_events`     | Payment                  | `gateway_payment_id`        |
| 12  | `NotificationLog`         | `notification_logs`          | Notification (broadcast) | `admin_user_id`             |

Supporting history / ledger / provider-evidence tables that are also in scope for preservation but
are **not** general activity logs:

`note_ledger_entries`, `note_settlements`, `note_payments`, `investor_balance_transactions`,
`application_revisions`, `application_reviews`, `application_review_items`,
`application_review_remarks`, `gateway_webhook_events`, `gateway_recon_runs`,
`gateway_recon_exceptions`, `gateway_order_attempts`, `gateway_payment_receipts`,
`withdrawal_instructions`, `shoraka_trade_orders`, `signing_envelopes`, `signing_documents`,
`signing_recipients`, `signing_assignments`, `signingcloud_ekyc`, `regtank_onboarding`,
`aml_identity_mapping`, `notifications`, `user_sessions`.

**Signing has no dedicated log table on origin/main.** Signing history is derived from the signing
state graph plus four coarse `SIGNING_PACKAGE_*` rows in `application_logs`. This is intentional and
is preserved as-is.

## 2. Field convention gap analysis

`no_fix_55` converged on this vocabulary:

```
event_type, occurred_at, actor_type, actor_user_id, organization_id, organization_kind,
target_type, target_id, source, portal, ip_address, user_agent, correlation_id,
idempotency_key, metadata
```

Three of these were not adopted: `occurred_at` (see below), `organization_id` on tables that would
need a query to populate it, and `idempotency_key` (no writer would produce one). See
`origin-main-standardization-plan.md` for the per-table decisions actually implemented.

Present (`Y`) / missing (`-`) on origin/main tables. `n/a` means the field is not meaningful for
that table and will **not** be added.

| Field             | access           | security | onboarding | application     | app_review_event       | legal_admin      | product          | note_event | note_admin        | gw_payment_event | notification        |
| ----------------- | ---------------- | -------- | ---------- | --------------- | ---------------------- | ---------------- | ---------------- | ---------- | ----------------- | ---------------- | ------------------- |
| event_type        | Y                | Y        | Y          | Y               | Y                      | Y (`action`)     | Y                | Y          | Y (`action_type`) | Y (`type`)       | n/a                 |
| occurred at       | Y (`created_at`) | Y        | Y          | Y               | Y                      | Y                | Y                | Y          | Y                 | Y                | Y                   |
| actor_type        | -                | -        | -          | -               | -                      | -                | -                | -          | -                 | -                | -                   |
| actor_user_id     | -                | -        | -          | Y (`user_id`)   | Y (`reviewer_user_id`) | Y                | -                | Y          | Y                 | Y                | Y (`admin_user_id`) |
| organization_id   | -                | -        | Y (2 cols) | -               | -                      | -                | n/a              | -          | -                 | -                | n/a                 |
| organization_kind | -                | -        | -          | -               | -                      | -                | n/a              | -          | -                 | -                | n/a                 |
| target_type       | -                | -        | -          | -               | -                      | -                | -                | -          | -                 | -                | n/a (col reused)    |
| target_id         | -                | -        | -          | Y (`entity_id`) | Y (`scope_key`)        | Y                | Y (`product_id`) | -          | -                 | -                | n/a                 |
| source            | -                | -        | -          | -               | -                      | -                | -                | -          | -                 | -                | -                   |
| portal            | Y                | -        | Y          | Y               | -                      | -                | -                | Y          | -                 | -                | -                   |
| ip_address        | Y                | Y        | Y          | Y               | -                      | Y                | Y                | Y          | Y                 | -                | Y                   |
| user_agent        | Y                | Y        | Y          | Y               | -                      | Y                | Y                | Y          | Y                 | -                | Y                   |
| correlation_id    | -                | -        | -          | -               | -                      | Y                | -                | Y          | Y                 | -                | -                   |
| idempotency_key   | -                | -        | -          | -               | -                      | -                | -                | -          | -                 | -                | -                   |
| metadata          | Y                | Y        | Y          | Y               | -                      | Y (before/after) | Y                | Y          | Y (before/after)  | Y                | Y                   |

Deliberate convention decisions:

- **`created_at` IS `occurred_at`.** Every origin/main log table already stamps the business moment
  in `created_at`. Adding a second `occurred_at` column would create two competing sort keys and
  invite reader bugs. We keep `created_at` and document it as the occurred-at field.
- **`notification_logs.target_type` already means "audience type"** (`ALL_USERS`, `INVESTORS`,
  `ISSUERS`, `SPECIFIC_USERS`, `GROUP`). It is **not** repurposed as an audit target type.
- **`application_logs` `level` / `target` / `action` columns** exist and are always written as
  `null`. They are deprecated per `applications/logs/types.ts`. They are **kept** (no drop) and
  remain unwritten; a new `target_type` column carries the standard vocabulary instead.
- `organization_*` is not added to `access_logs` / `security_logs` / `product_logs`: org context is
  not reliably available at login/RBAC/product-config time and nullable-always columns are noise.

## 3. Live event catalogue (origin/main)

Only events with a **production writer** are listed as live. Test/seed/script-only writers do not
count.

### 3.1 `access_logs` — 7 live events

`LOGIN`, `LOGOUT`, `SIGNUP`, `ROLE_ADDED`, `ROLE_REMOVED`, `PROFILE_UPDATED`, `ONBOARDING_RESET`

Writers: `auth/cognito.routes.ts` (3 direct creates), `auth/service.ts` (`syncUser`, `logout`),
`admin/service.ts` (`updateUserRoles`, `updateUserProfile`, `resetOnboarding`) via
`AuthRepository.createAccessLog` / `AdminRepository.createAccessLog`.

`DEAD_EVENT` (declared in `packages/types/src/admin.ts` `EventType`, never written):
`ROLE_SWITCHED` (goes to `security_logs` instead), `ONBOARDING`, `USER_COMPLETED`,
`KYC_STATUS_UPDATED` (seed only), `ONBOARDING_STATUS_UPDATED`, `PASSWORD_CHANGED`, `EMAIL_CHANGED`.

### 3.2 `security_logs` — 9 live events

`ROLE_ADDED`, `ROLE_SWITCHED`, `PROFILE_UPDATED`, `PASSWORD_CHANGED`, `EMAIL_CHANGED`,
`ROLE_PERMISSIONS_UPDATED`, `ROLE_CREATED`, `ROLE_REMOVED`, `INVITATION_REVOKED`

Writers: `auth/service.ts` (7 sites), `admin/service.ts` (11 sites).

Note: the last four are written but **not declared** in the `SecurityEventType` union and are **not
shown** in the admin Security audit panel. That asymmetry is origin/main behavior and is preserved.

### 3.3 `onboarding_logs` — 23 live events

`ONBOARDING_STARTED`, `ONBOARDING_RESUMED`, `ONBOARDING_CANCELLED`, `ONBOARDING_RESET`,
`ONBOARDING_REJECTED`, `ONBOARDING_STATUS_UPDATED`, `ONBOARDING_APPROVED`, `FORM_FILLED`,
`FINAL_APPROVAL_COMPLETED`, `AML_APPROVED`, `SSM_APPROVED`, `TNC_APPROVED`,
`SOPHISTICATED_STATUS_UPDATED`, `PROFILE_UPDATED`, `COD_REJECTED`, `EOD_APPROVED`, `EOD_REJECTED`,
`EOD_WEBHOOK`, `WEBHOOK_RECEIVED`, `WEBHOOK_APPROVED`, `WEBHOOK_REJECTED`,
`WEBHOOK_PENDING_APPROVAL`, `WEBHOOK_IN_PROGRESS`

Writers: `regtank/service.ts`, `regtank/webhooks/{individual-onboarding,kyc,cod,eod}-handler.ts`,
`regtank/webhooks/org-aml-milestone.ts`, `organization/service.ts`, `admin/service.ts` (9 sites),
`admin/organization-admin-profile.ts`.

`DEAD_EVENT` (declared in `OnboardingEventType`, never written in production): `TNC_ACCEPTED`,
`KYC_APPROVED`, `KYB_APPROVED`.

### 3.4 `application_logs` — 45 live events

Application lifecycle: `APPLICATION_CREATED`, `APPLICATION_SUBMITTED`, `APPLICATION_RESUBMITTED`,
`APPLICATION_REJECTED`, `APPLICATION_RESET_TO_UNDER_REVIEW`, `APPLICATION_WITHDRAWN`,
`APPLICATION_COMPLETED`.

Review: `SECTION_REVIEWED_{APPROVED,REJECTED,AMENDMENT_REQUESTED,PENDING}`,
`ITEM_REVIEWED_{APPROVED,REJECTED,AMENDMENT_REQUESTED,PENDING}`, `AMENDMENTS_SUBMITTED`.

Contract: `CONTRACT_OFFER_SENT`, `CONTRACT_OFFER_ACCEPTANCE_SUBMITTED`,
`CONTRACT_OFFER_ACCEPTANCE_RESUBMITTED`, `CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING`,
`CONTRACT_OFFER_ACCEPTED`, `CONTRACT_WITHDRAWN`, `CONTRACT_OFFER_RETRACTED`,
`CONTRACT_OFFER_EXPIRED`, `CONTRACT_SIGNING_DEADLINE_EXTENDED`,
`CONTRACT_FACILITY_OCCUPANCY_UPDATED`, `CONTRACT_FACILITY_FEE_WAIVED`, `CONTRACT_FACILITY_ENABLED`,
`CONTRACT_FACILITY_DISABLED`, `CONTRACT_CUSTOMER_LARGE_PRIVATE_UPDATED`.

Invoice: `INVOICE_OFFER_SENT`, `INVOICE_OFFER_ACCEPTANCE_SUBMITTED`,
`INVOICE_OFFER_ACCEPTANCE_RESUBMITTED`, `INVOICE_ACCEPTANCE_APPROVED_FOR_SIGNING`,
`INVOICE_OFFER_ACCEPTED`, `INVOICE_OFFER_REJECTED`, `INVOICE_OFFER_RETRACTED`,
`INVOICE_OFFER_EXPIRED`, `INVOICE_SIGNING_DEADLINE_EXTENDED`, `INVOICE_WITHDRAWN`.

Signing: `SIGNING_PACKAGE_CREATED`, `SIGNING_PACKAGE_SENT`, `SIGNING_PACKAGE_COMPLETED`,
`SIGNING_PACKAGE_VOIDED`.

`DEAD_EVENT` (declared in `ApplicationLogEventType`, no production writer):
`APPLICATION_APPROVED`, `CONTRACT_OFFER_REJECTED` (issuer contract rejection writes
`CONTRACT_WITHDRAWN` instead).

### 3.5 `application_review_events` — 3 live events

`CONTRACT_OFFER_SENT`, `INVOICE_OFFER_SENT`, `AMENDMENTS_SUBMITTED`. All three written inside the
business `prisma.$transaction` in `admin/service.ts`. **No production reader.**

### 3.6 `legal_document_audit_logs` — 7 live actions

`LEGAL_DOCUMENT_CREATED`, `LEGAL_DOCUMENT_UPDATED`, `LEGAL_VERSION_UPLOADED`,
`LEGAL_VERSION_FILE_REPLACED`, `LEGAL_VERSION_PUBLISHED`, `LEGAL_VERSION_ARCHIVED`,
`LEGAL_VERSION_RESTORED`. All declared actions are live — no dead events.

Not audited today: `updateDraftVersion`, upload-URL requests, admin document download.

### 3.7 `product_logs` — 5 live events

`PRODUCT_CREATED`, `PRODUCT_UPDATED`, `PRODUCT_DELETED`, `PRODUCT_INACTIVATED`,
`PRODUCT_REACTIVATED`. All declared events are live.

UI filter only offers Created / Updated / Deleted — inactivated/reactivated rows are stored and
exported but absent from the filter dropdown. Preserved as-is.

### 3.8 `note_events` — 41 live events

Lifecycle: `NOTE_CREATED_FROM_INVOICE`, `UPDATE_DRAFT`, `UPDATE_FEATURED_SETTINGS`, `PUBLISH`,
`UNPUBLISH`, `PAUSE_LISTING`, `RESUME_LISTING`, `INVESTMENT_COMMITTED`, `CLOSE_FUNDING`,
`FAIL_FUNDING`, `ACTIVATE`, `NOTE_DEFAULT_MARKED`.

Money: `NOTE_FACILITY_FEE_COLLECTION_WAIVED`, `ISSUER_DISBURSEMENT_WITHDRAWAL_CREATED`,
`ISSUER_PAYMENT_SUBMITTED`, `PAYMENT_RECEIVED`, `PAYMENT_APPROVED`, `PAYMENT_REJECTED`,
`SETTLEMENT_PREVIEWED`, `SETTLEMENT_APPROVED`, `SETTLEMENT_POSTED`, `OVERDUE_LATE_CHARGE_CHECKED`,
`LATE_CHARGE_APPROVED`.

Documents / trustee: `ARREARS_LETTER_GENERATED`, `DEFAULT_LETTER_GENERATED`,
`SERVICE_FEE_TRUSTEE_LETTER_GENERATED`, `SERVICE_FEE_TRUSTEE_LETTER_SUBMITTED`,
`SERVICE_FEE_TRUSTEE_INSTRUCTION_COMPLETED`, `WITHDRAWAL_LETTER_GENERATED`,
`WITHDRAWAL_SUBMITTED_TO_TRUSTEE`, `WITHDRAWAL_BENEFICIARY_UPDATED`, `WITHDRAWAL_COMPLETED`.

Prospectus: `PROSPECTUS_REVIEW_CREATE`, `PROSPECTUS_REVIEW_DRAFT_UPDATE`,
`PROSPECTUS_REVIEW_APPROVE`, `PROSPECTUS_APPROVAL_INVALIDATED_UNPUBLISH`,
`PROSPECTUS_APPROVAL_INVALIDATED_SOURCE`, `PROSPECTUS_APPROVAL_INVALIDATED_EDIT`.

Shariah / facility: `SHORAKA_ORDER_SUBMITTED`, `SHORAKA_CERTIFICATE_FETCHED`,
`FACILITY_OCCUPANCY_UPDATED`.

`DEAD_EVENT`: `ISSUER_RESIDUAL_WITHDRAWAL_CREATED` (referenced only in
`admin-note-events-sorting.ts` and docs; never written).

### 3.9 `note_admin_actions` — action types mirror the `logAdminAction` subset

`CREATE_FROM_INVOICE`, `UPDATE_DRAFT`, `UPDATE_FEATURED_SETTINGS`, `PUBLISH`, `UNPUBLISH`,
`PAUSE_LISTING`, `RESUME_LISTING`, `CLOSE_FUNDING`, `FAIL_FUNDING`, `ACTIVATE`,
`WAIVE_FACILITY_FEE_COLLECTION`, plus the six `PROSPECTUS_*` actions. **No production reader.**

### 3.10 `gateway_payment_events` — 8 live types

`NAME_CHECK`, `NAME_CHECK_APPROVED`, `NAME_CHECK_REJECTED`, `CAPTURE_MISMATCH`, `EXPIRED`,
`REFUND_INITIATED`, `REFUNDED`, `REFUND_WALLET_REVERSAL_FAILED`.

`DEAD_EVENT` (in the `GatewayPaymentEventType` enum, no writer): `OVERRIDE_PROPOSED`,
`OVERRIDE_APPROVED`, `OVERRIDE_REJECTED`. The admin detail hard-codes
`openOverrideProposedBy: null`.

### 3.11 `notification_logs` — single writer, no event_type column

One production writer: `NotificationService.sendBulkNotification` (admin broadcast). Records
audience type, group, notification type, title, message, recipient count, IP/UA/device.

Per-recipient success/failure is computed in memory and returned to the caller but **not
persisted** — `recipient_count` is audience size, not delivered count.

**Live totals: 138 events across 10 event-typed tables + 1 single-writer broadcast table.**
Dead/declared-only: 16.

## 4. Presentation contract (must not change)

### 4.1 Admin application detail timeline (`apps/admin/src/components/admin-activity-timeline.tsx`)

Section titles are composed as `{SectionLabel} {ActionLabel}`:

| event_type                             | ACTION_LABELS entry           |
| -------------------------------------- | ----------------------------- |
| `SECTION_REVIEWED_APPROVED`            | `Section Approved`            |
| `SECTION_REVIEWED_REJECTED`            | `Section Rejected`            |
| `SECTION_REVIEWED_AMENDMENT_REQUESTED` | `Section Amendment Requested` |
| `SECTION_REVIEWED_PENDING`             | `Section Reset to Pending`    |
| `ITEM_REVIEWED_APPROVED`               | `Approved`                    |
| `ITEM_REVIEWED_REJECTED`               | `Rejected`                    |
| `ITEM_REVIEWED_AMENDMENT_REQUESTED`    | `Amendment Requested`         |
| `ITEM_REVIEWED_PENDING`                | `Reset to Pending`            |

Composition rules:

- Section rows: `sectionLabelOverrides[scope_key] ?? getReviewTabLabel(scope_key)` + action label.
  Produces the exact strings the product relies on, e.g. **"Financial Section Approved"**,
  **"Facility Section Amendment Requested"**.
- Item rows: `formatItemLabelFromScopeKey(entity_id ?? metadata.scope_key)` + action label, e.g.
  **"Invoice INV-1 Approved"**, **"P2p Declaration Rejected"**.
- Resubmit description: `"Changes submitted: ${labels.join(", ")}"` or the API-supplied
  `metadata.resubmit_changes.activity_summary`.
- `View Details` panel renders offer amounts, accept-by deadline, rejection reason and reviewer
  remark bullets.
- `TIMELINE_HIDDEN_EVENT_TYPES = new Set(["SIGNING_PACKAGE_COMPLETED"])` — hidden in the UI but
  **still exported to CSV**.

### 4.2 Remark strings that must survive verbatim

| Source                                                           | String                                                                        |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `admin/service.ts` `submitPendingAmendments`                     | `` `${pending.length} amendment(s) sent to issuer` ``                         |
| `lib/refresh-contract-facility.ts` `occupancyRemark` NOTE_REPAID | `` `Repayment released facility occupancy. Available restored to RM ${…}.` `` |
| same, FUNDING_CLOSED                                             | `` `Facility occupancy true-up to funded principal RM ${…}.` ``               |
| same, FUNDING_FAILED                                             | `Failed funding released the reserved facility occupancy.`                    |
| same, default (invoice draw)                                     | `` `Invoice draw reserved RM ${…} against the facility.` ``                   |
| `ctos/ctos-report-service.ts`                                    | `Reset due to CTOS update / AML pending`                                      |
| `admin/service.ts` `sendContractOffer` review event              | `` `Facility offer sent: ${offeredFacility}` ``                               |

Reviewer remarks reach `application_logs.remark` as a **top-level column**, not metadata. The
`ApplicationReviewRemark` table is the business SOT; the log column is the historical copy. Both
must be retained.

### 4.3 Issuer application detail timeline

`apps/issuer/.../application-timeline.ts` `EVENT_LABELS` is both the label map **and** the
visibility allowlist (`ISSUER_VISIBLE_EVENTS = Object.keys(EVENT_LABELS)`). Description resolution
order: `log.activity` → `log.remark`.

### 4.4 Portal activity feeds

- `ApplicationLogAdapter.buildPresentation` — issuer general Activity titles/descriptions
  (e.g. `AMENDMENTS_SUBMITTED` → title "Changes Requested", description "We need updates to your
  application before it can continue.").
- `OrganizationLogAdapter.buildPresentation` — onboarding titles/descriptions.
- `NoteLogAdapter.buildPresentation` — note titles/descriptions.
- `packages/types/src/activity-presentation.ts` — status chips
  (`Action needed`, `Waiting`, `Complete`, `Live`, `Failed`, `Closed`).

### 4.5 Admin gateway payment detail

`apps/admin/.../gateway-payment-copy.ts` `EVENT_COPY` maps each `GatewayPaymentEventType` to a
title/description pair (e.g. `NAME_CHECK` → "Name check needed" / "Payment received, but the bank
name could not be matched to the investor profile. Waiting for review.").

## 5. Visibility contract (per surface, must not change)

| Surface                              | Filter source                                                  | Notes                                                                                                                                                                                              |
| ------------------------------------ | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin Audit → Access                 | `access-logs-panel.tsx` `ACCESS_EVENT_TYPES`                   | `LOGIN, LOGOUT, SIGNUP, KYC_STATUS_UPDATED` only                                                                                                                                                   |
| Admin Audit → Security               | `security-logs-panel.tsx` `SECURITY_EVENT_TYPES`               | 5 types; admin-role events hidden                                                                                                                                                                  |
| Admin Audit → Products               | `product-logs-panel.tsx`                                       | Filter dropdown Created/Updated/Deleted; API returns all                                                                                                                                           |
| Admin Audit → Legal documents        | `legal-document-audit-panel.tsx` `ACTION_OPTIONS`              | all 7 actions                                                                                                                                                                                      |
| Admin org timeline                   | `use-organization-logs.ts` `ONBOARDING_EVENT_TYPES`            | 16 types (incl. 3 dead)                                                                                                                                                                            |
| Admin application detail             | `admin-activity-timeline.tsx`                                  | all rows except `SIGNING_PACKAGE_COMPLETED`                                                                                                                                                        |
| Admin contract detail                | `admin/repository.ts` `getContractDetail` activityWhere        | `entity_id = contract` OR originating app OR linked apps with `CONTRACT_` prefix                                                                                                                   |
| Admin note detail                    | `notes/repository.ts`                                          | latest **50** events, ordered by `admin-note-events-sorting.ts`                                                                                                                                    |
| Issuer general Activity              | `ApplicationLogAdapter.getEventTypes()`                        | narrow allowlist; excludes all `SECTION_*`/`ITEM_*`, `SIGNING_PACKAGE_{CREATED,COMPLETED,VOIDED}`, `*_ACCEPTANCE_APPROVED_FOR_SIGNING`, `CONTRACT_FACILITY_*`, `APPLICATION_RESET_TO_UNDER_REVIEW` |
| Issuer general Activity (onboarding) | `OrganizationLogAdapter.getEventTypes()`                       | only `ONBOARDING_STARTED, ONBOARDING_CANCELLED, ONBOARDING_REJECTED, FINAL_APPROVAL_COMPLETED, ONBOARDING_APPROVED`                                                                                |
| Issuer general Activity (note)       | `note-log.ts` `SHARED_EVENT_TYPES` + `ISSUER_ONLY_EVENT_TYPES` | plus `WITHDRAWAL_COMPLETED` restricted to `ISSUER_DISBURSEMENT`                                                                                                                                    |
| Issuer application detail            | `application-timeline.ts` `ISSUER_VISIBLE_EVENTS`              | narrower than issuer general feed                                                                                                                                                                  |
| Investor Activity                    | `note-log.ts` `INVESTOR_ONLY_EVENT_TYPES` + shared             | plus `INVESTMENT_COMMITTED` restricted to own org; `ApplicationLogAdapter` returns `["__none__"]` for investors                                                                                    |
| `GET /v1/applications/:id/logs`      | none                                                           | returns **all** rows for the application                                                                                                                                                           |

`getFilterableActivityDomains("investor")` → `onboarding`, `note`. Investors never see application
logs.

## 6. CSV / export contract

| Export                                                 | Headers                                                                                       |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Admin application activity (`admin-activity-csv.ts`)   | `createdAt, event, eventType, actor, actorUserId, portal, remark, metadata`                   |
| Admin contract activity (`contract-activity-csv.ts`)   | same shape, own label map                                                                     |
| Admin note activity (`note-activity-csv.ts`)           | `createdAt, event, eventType, actor, actorUserId, portal, remark, metadata`                   |
| Admin org timeline (`organizationLogToActivityCsvRow`) | same shape                                                                                    |
| `GET /v1/admin/access-logs/export`                     | `Timestamp, User, Email, Event Type, IP Address, Device, Status, Metadata`                    |
| `GET /v1/admin/security-logs/export`                   | `Timestamp, User, Email, Event Type, IP Address, Device, Metadata`                            |
| `GET /v1/admin/onboarding-logs/export`                 | `Timestamp, User, Email, Role, Event Type, Portal, IP Address, Device, Metadata`              |
| `GET /v1/admin/product-logs/export`                    | `Timestamp, Admin, Email, Event Type, Product Name, Product ID, IP Address, Device, Metadata` |
| Legal audit export                                     | `legal-document-audit-logs-{date}.csv`                                                        |
| Legal acceptance export                                | 25 columns incl. hashes, IPs, acknowledgement text                                            |
| Admin/issuer note ledger CSV                           | `postedAt, description`, signed per-bucket amounts, NET footer                                |
| Investor balance statement CSV                         | `postedAt, type, description, moneyIn, moneyOut, balance, reference`                          |

Rows hidden in UI but present in export: `SIGNING_PACKAGE_COMPLETED` (admin application activity).
No CSV export exists for notifications, gateway recon, or signing envelopes.

Remark column formula (admin application CSV): `log.remark ?? formatActivityText(log.activity) ?? ""`.
Metadata column: JSON of merged metadata plus `entityId`, `review_cycle`, `ip_address`.

## 7. Compliance evidence census

| Requirement                                                                    | Stored today                 | Location                                                                                                                                                                     | Gap                                                                                                                                    |
| ------------------------------------------------------------------------------ | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Legal consent: document id, version, hash, accepted_at, IP, user identity, org | Yes                          | `legal_document_acceptances` (`document_hash`, `version_number`, `accepted_at`, `accepted_ip_address`, `user_*_snapshot`, `organization_*_snapshot`, `acknowledgement_text`) | no `correlation_id` on acceptance rows                                                                                                 |
| Legal admin change trail with before/after + hash                              | Yes                          | `legal_document_audit_logs`                                                                                                                                                  | no `target_type`/`source`/`portal`                                                                                                     |
| AML decision, timestamp, decision-maker                                        | Yes                          | `onboarding_logs` `AML_APPROVED` metadata (`approvedBy`, `approvedAt`, `previousStatus`, `newStatus`)                                                                        | automated `org-aml-milestone` path logs `ONBOARDING_STATUS_UPDATED` with `amlApproved: true` instead of `AML_APPROVED` — **flag only** |
| Activation timestamp                                                           | Yes                          | `issuer/investor_organization.onboarded_at`, `admin_approved_at`; `regtank_onboarding.completed_at`                                                                          | not snapshotted into the log row                                                                                                       |
| Offer issue timestamp, approved terms, acceptance deadline                     | Yes                          | `application_logs` `CONTRACT_/INVOICE_OFFER_SENT` metadata (`offered_facility`, `version`, `acceptance_expires_at`)                                                          | —                                                                                                                                      |
| Offer acceptance timestamp, approver, facility reference                       | Yes                          | `CONTRACT_OFFER_ACCEPTED`, `*_ACCEPTANCE_APPROVED_FOR_SIGNING` metadata                                                                                                      | approver identity is the log actor, not snapshotted                                                                                    |
| Signing: signed document hash                                                  | Yes                          | `signing_documents.signed_file_sha256`                                                                                                                                       | —                                                                                                                                      |
| Signing: signer identity + role                                                | Yes                          | `signing_recipients.name/email/ic_number/role_key/role_label`                                                                                                                | —                                                                                                                                      |
| Signing: signature timestamp                                                   | Yes                          | `signing_assignments.signed_at`, `signing_recipients.completed_at`                                                                                                           | —                                                                                                                                      |
| Signing: per-document / per-signatory status                                   | Yes                          | `signing_documents.status`, `signing_assignments.status`                                                                                                                     | —                                                                                                                                      |
| Signing: unsigned document hash                                                | **No**                       | —                                                                                                                                                                            | MISSING_COMPLIANCE_EVIDENCE (flag)                                                                                                     |
| Signing: signer IP                                                             | **No**                       | —                                                                                                                                                                            | MISSING_COMPLIANCE_EVIDENCE (flag)                                                                                                     |
| Signing: `viewed_at`                                                           | Column exists, never written | `signing_recipients.viewed_at`                                                                                                                                               | MISSING_WRITER (flag)                                                                                                                  |
| Shariah sequence per note, second precision                                    | Yes                          | `note_events.created_at` per step + `shoraka_trade_orders.submitted_at`                                                                                                      | admin timeline caps at 50 rows                                                                                                         |
| Commodity / trade reference                                                    | Yes                          | `shoraka_trade_orders.submit_request_payload` (`commodity_type`), `provider_order_id`                                                                                        | `provider_certificate_id` always null                                                                                                  |
| Ledger amounts, currency, idempotency                                          | Yes                          | `note_ledger_entries` (`amount` Decimal(18,6), `currency`, `idempotency_key` unique)                                                                                         | —                                                                                                                                      |
| Notification broadcast evidence                                                | Partial                      | `notification_logs`                                                                                                                                                          | per-recipient delivery result not persisted                                                                                            |

## 8. Transaction posture (origin/main)

| Writer                                                          | Posture                                                                                                                                                               |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `logApplicationActivity`                                        | best-effort, try/catch swallow (all callers)                                                                                                                          |
| `amendments/service.ts` `APPLICATION_RESUBMITTED` direct create | can throw; runs after the resubmit transaction                                                                                                                        |
| `refresh-contract-facility.ts` occupancy log                    | inside `applyContractCapacityChange` transaction                                                                                                                      |
| `tx.applicationReviewEvent.create` (3 sites)                    | inside business transaction                                                                                                                                           |
| `acceptance-signing-expiry.ts`                                  | `logApplicationActivity` not awaited (fire-and-forget)                                                                                                                |
| Access / security / onboarding writers                          | direct `await`, no transaction; RegTank webhook logs wrapped in try/catch                                                                                             |
| `ProductRepository.create/update/delete` logs                   | inside product transaction                                                                                                                                            |
| `ProductRepository.setInactive/restoreProduct` logs             | separate write after the update                                                                                                                                       |
| `notes/service.ts` `logEvent` / `logAdminAction`                | mostly inside the business transaction (`tx`); `SETTLEMENT_PREVIEWED`, `SETTLEMENT_APPROVED`, late-charge, letters, `WITHDRAWAL_*`, `NOTE_DEFAULT_MARKED` are outside |
| `postLedgerEntry`                                               | always inside the business transaction; idempotency-key guarded                                                                                                       |
| `recordGatewayPaymentEvent`                                     | mostly inside the webhook/admin transaction                                                                                                                           |
| Notification `create` + email                                   | DB insert, then SES in a separate try/catch — never inside a transaction                                                                                              |

External network calls are already outside DB transactions in the gateway and signing paths, with
two known ordering risks flagged (not fixed here): `shoraka-stp-service` creates the remote order
before the DB row; `signing/service.ts sendEnvelope` may leave partially-sent envelopes.

## 9. `no_fix_55` comparison summary

| `no_fix_55` idea                                                                                                                                         | Verdict                                                                                             |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Replace log tables with `*_audit_logs`                                                                                                                   | **REJECTED** — violates the table preservation rule                                                 |
| `apps/api/src/lib/audit/context.ts` shared `AuditRequestContext` + vocabularies                                                                          | **ADOPT**                                                                                           |
| `apps/api/src/lib/audit/snapshot.ts` actor name/email snapshot                                                                                           | **ADOPT**                                                                                           |
| `actor_type` / `organization_kind` / `target_type` / `source` field convention                                                                           | **ADOPT additively**                                                                                |
| `occurred_at` separate from `created_at`                                                                                                                 | **REJECT** — `created_at` already is the occurred-at                                                |
| Best-effort wrapper for access/security writes                                                                                                           | **ADOPT** (matches origin/main posture)                                                             |
| `PAYMENT_AUDIT_IDEMPOTENCY` key factory + unique index                                                                                                   | **ADOPT** for `gateway_payment_events`                                                              |
| Zod metadata parsers that throw before insert                                                                                                            | **ADOPT in tests only** — throwing in production would change best-effort behavior                  |
| Renamed events (`APPLICATION_SECTION_REVIEW_UPDATED`, etc.)                                                                                              | **REJECTED** — would break UI titles                                                                |
| New events (`APPLICATION_REVIEW_STARTED`, `APPLICATION_DOCUMENT_*`, `CONTRACT_ACCEPTANCE_CHANGES_REQUESTED`, `SIGNING_RECIPIENT_*`, `SIGNING_EKYC_*`, …) | **REJECTED** — no new events this phase                                                             |
| `activity-visibility.ts` shared allowlist module                                                                                                         | **REJECTED as a replacement** — origin/main visibility differs per surface; frozen in tests instead |
| `activity-presentation.ts` rewrite (+1300 lines)                                                                                                         | **REJECTED** — would reword origin/main copy                                                        |
| Cutover tests with `FORBIDDEN_EVENTS`                                                                                                                    | **ADOPT the pattern** with origin/main catalogues                                                   |
| Append-only enforcement test (`no update/delete` on log tables)                                                                                          | **ADOPT**                                                                                           |
| Index strategy `(anchor, created_at)`, `(event_type, created_at)`, `(correlation_id)`                                                                    | **ADOPT**                                                                                           |
| `AUDIT_EXPORT_LIMIT` + truncation header                                                                                                                 | **DEFER** — would change export behavior                                                            |

## 10. Flagged findings (report only, no change this phase)

**DUPLICATE_INFORMATION / possible future cleanup**

1. `application_review_events` — 3 writers, zero production readers; the same three events are also
   written to `application_logs`. Risk of removal: loses the only in-transaction copy of offer-sent
   and amendment-batch evidence. **Keep.**
2. `note_admin_actions` — every row is mirrored into `note_events` by `logAdminAction`, and nothing
   reads `note_admin_actions`. It does hold `before_state`/`after_state` as first-class columns.
   **Keep.**
3. `access_logs` vs `security_logs` overlap on `ROLE_ADDED`, `ROLE_REMOVED`, `PROFILE_UPDATED` —
   written to both with different metadata. **Keep both.**
4. `activity-events.json` in `packages/types` is not imported anywhere. Orphan config. **Keep.**

**DEAD_EVENT** (declared, no production writer — do not delete)

`AccessLog`: `ROLE_SWITCHED`, `ONBOARDING`, `USER_COMPLETED`, `KYC_STATUS_UPDATED`,
`ONBOARDING_STATUS_UPDATED`, `PASSWORD_CHANGED`, `EMAIL_CHANGED`.
`OnboardingLog`: `TNC_ACCEPTED`, `KYC_APPROVED`, `KYB_APPROVED`.
`ApplicationLog`: `APPLICATION_APPROVED`, `CONTRACT_OFFER_REJECTED`.
`NoteEvent`: `ISSUER_RESIDUAL_WITHDRAWAL_CREATED`.
`GatewayPaymentEventType`: `OVERRIDE_PROPOSED`, `OVERRIDE_APPROVED`, `OVERRIDE_REJECTED`.
Notification types with no automatic trigger: `login_new_device`, `kyc_approved`, `kyc_rejected`,
`new_product_alert`, `application_approved`, `withdrawal_submitted_to_trustee`.

**MISSING_WRITER**

- `signing_recipients.viewed_at` and `SigningAssignmentStatus.VIEWED` — column and enum value exist,
  UI renders "Viewed", nothing ever writes it.
- `notifications.resolved_at` — read by unread logic, never written.
- `products/log/service.ts createProductLogEntry` — defined, no production caller.

**MISSING_COMPLIANCE_EVIDENCE**

- Signer IP address at signature time.
- Unsigned document hash.
- `shoraka_trade_orders.provider_certificate_id` is always null.

**POSSIBLE_PRODUCT_IMPROVEMENT** (wording / behavior — not changed)

- `CONTRACT_WITHDRAWN` is written when an issuer _rejects_ a contract offer. Current wording:
  "Contract withdrawn". Reason: the enum has an unused `CONTRACT_OFFER_REJECTED`. Suggested wording:
  "Facility offer rejected". Left unchanged.
- Duplicate `APPLICATION_RESUBMITTED` can be written when `PATCH /status` to `RESUBMITTED` follows
  the amendment resubmit path, which already logs.
- `getAllAccessLogsForExport` honours only the singular `eventType` filter, while the panel sends an
  `eventTypes` array — export can be broader than the on-screen list.
- Admin note detail timeline caps at 50 events, which can truncate a long Shariah sequence.
- `notification_logs.recipient_count` is audience size, not delivered count.

**NO_RAW_AUDIT_HISTORY_UI** — no new forensic panels are added. Extra columns are backend-only.
