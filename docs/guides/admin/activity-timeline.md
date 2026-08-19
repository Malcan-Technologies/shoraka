# Activity Timeline Guide

How Activity timelines and raw Audit History are stored, fetched, and displayed.

Related:

- `docs/audit/current-audit-logging-inventory.md` — architecture, tables, writers, RBAC
- `docs/audit/audit-manual-verification-catalogue.md` — per-event catalogue
- `docs/guides/activity-log-inventory.md` — issuer/investor `/activity` feed
- `docs/guides/application/logging-guide.md` — application button-to-event scenarios

---

## Audit is history, not source of truth

Audit rows are append-only evidence that something happened. They are not workflow state, money state, or review state.

Sources of truth stay on their business tables (`Application` / review / remarks / revisions, `Note` / ledger / investments, `GatewayPayment` / wallet / withdrawals, organization `onboarding_status`, signing envelope graph, and so on). Reconstruct current state from those tables, then use AuditLog for who/when/what metadata.

## Raw Audit History vs curated Activity

**Raw Audit History** is every matching `*AuditLog` row for an entity or global tab. Admins with the matching permission can open typed metadata, actor snapshots, IP/UA, and CSV export where the page exposes it.

**Activity** is a curated, audience-scoped feed. Visibility lives in `packages/types/src/activity-visibility.ts`. Titles and descriptions live in `packages/types/src/activity-presentation.ts`. Status chips use `getActivityStatusToken` (viewer-centric tokens: yellow = you must act, blue = waiting, violet = live, green = complete, grey = closed, red = failed).

Do not treat an Activity title as workflow state. Do not dump raw metadata, provider webhook payloads, or other organizations’ events into user-facing Activity.

## Presentation vs data

`AdminVerticalTimeline`, `ActivityFeed`, `ListToolbar`, and status-token helpers are presentation. They do not own audit data.

Approximate data flow:

```
Business action
  → SOT mutation
  → Audit writer
  → AuditLog row
  → raw Audit History
```

Where a curated feed exists:

```
AuditLog
  → visibility / adapter
  → presentation helper
  → Activity timeline or ActivityFeed
```

Adapter class names such as `ApplicationLogAdapter` and `NoteLogAdapter` are preserved public names. They read current AuditLog tables, not deleted `ApplicationLog` / `NoteEvent` models.

---

## Admin application detail

The application page shows two separate surfaces:

1. **Activity** (`RecentActivityCard` → `admin-activity-timeline.tsx` → `AdminVerticalTimeline`) — curated merged application + signing history.
2. **Audit History** (`ApplicationAuditHistoryCard` → `ContextualAuditHistoryPanel`) — raw `ApplicationAuditLog` paging via `GET` application audit history (`useApplicationAuditHistory`).

Signing remains a separate store (`SigningAuditLog`). The curated timeline reader `GET /v1/applications/:id/logs` (`getApplicationLogs`) merges Application + Signing newest-first. That route is a reader projection, not a store.

Admin curated timeline additionally hides `SIGNING_PACKAGE_COMPLETED` (`TIMELINE_HIDDEN_EVENT_TYPES`). Terminal offer success on that timeline is `CONTRACT_OFFER_ACCEPTED` / `INVOICE_OFFER_ACCEPTED`. Issuer `/activity` still shows `SIGNING_PACKAGE_COMPLETED` when visibility allows it.

Live application event names include `CONTRACT_ACCEPTANCE_*`, `APPLICATION_AMENDMENTS_REQUESTED`, `APPLICATION_SECTION_REVIEW_UPDATED`, `APPLICATION_ITEM_REVIEW_UPDATED`, and `APPLICATION_REOPENED_FOR_REVIEW`. There is no live `APPLICATION_APPROVED` application audit event. CSV/display maps may still label historical aliases; those aliases are not emitted by current writers.

Titles use `formatApplicationActivity` / `formatSigningActivity`. Invoice numbers appear in copy when metadata includes `invoiceNumber` / `invoice_number`.

---

## Admin organization Activity

Issuer and investor admin detail pages (`apps/admin/src/organizations/components/organization-detail-page.tsx`) render `OrganizationActivityTimeline` from `OnboardingAuditLog` via `GET /v1/admin/onboarding-logs`.

Labels come from `formatOnboardingActivity`. Step-aware issuer/investor onboarding tooltips are product UI; onboarding unlock gates and organization `onboarding_status` remain SOT. CTOS / director-shareholder organization detail work is unchanged by the audit store.

Admin organization Activity hides `USER_ONBOARDING_STATUS_UPDATED`. Retired onboarding IDs (`ONBOARDING_RESUMED`, `CTOS_REPORT_RECEIVED`, `CORPORATE_ENTITIES_UPDATED`) have no current writer; historical rows remain readable on raw Onboarding audit.

---

## Admin note timeline

Note Activity on note detail is a curated `NoteAuditLog` list (`NoteDetail.events`), sorted newest-first with lifecycle tie-breakers in `apps/api/src/modules/notes/admin-note-events-sorting.ts`.

Raw **Audit History** on the same page is `ContextualAuditHistoryPanel` + `useNoteAuditHistory`.

CSV export maps `NoteAuditLogDto` through `noteAuditLogToActivityCsvRow`. Some CSV labels still include legacy aliases (`FAIL_FUNDING`, `CLOSE_FUNDING`, `NOTE_DEFAULT_MARKED`, `SHORAKA_CERTIFICATE_FETCHED`, `UNPUBLISH`). Those strings are display fallbacks, not live `event_type` values.

Live writers emit names such as `NOTE_CREATED`, `NOTE_PUBLISHED`, `NOTE_FUNDING_CLOSED`, `NOTE_FUNDING_FAILED`, `NOTE_ACTIVATED`, `NOTE_MARKED_DEFAULT`, `SHORAKA_CERTIFICATE_RECEIVED`, `DISBURSEMENT_INITIATED`.

`UNPUBLISH` is a prospectus invalidation **reason** (`NOTE_PROSPECTUS_INVALIDATION_REASON.UNPUBLISH`), not an event type. Live unpublish is `NOTE_UNPUBLISHED`.

`CLOSE_FUNDING` appears as withdrawal-instruction **metadata.source** when close-funding auto-creates an issuer disbursement. The matching audit event is `DISBURSEMENT_INITIATED` (and `NOTE_FUNDING_CLOSED` for the funding close itself).

Marketplace product behavior (not audit): authenticated investor marketplace can request `includeClosed: true`; the public marketplace list API forces `includeClosed: false`. Listings expose `investorCount`.

---

## Admin gateway payment timeline

Gateway payment detail (`/finance/gateway-payments/:id`, permission `gateway_payments.view`) renders `AdminVerticalTimeline` from `PaymentAuditLogDto` via `gatewayAuditTimelineFields` (`eventType`, `occurredAt`, `actor.displayName`, status/reason from metadata).

`GatewayPayment` remains payment-state SOT. `GatewayWebhookEvent` remains provider transport/replay evidence and is **not** business audit history.

Investor wallet withdrawals use `PaymentAuditLog`. Investor portal withdraw sends `withdrawalIntentId`, stored on `WithdrawalInstruction.idempotency_key`. Issuer disbursement / residual stay on `NoteAuditLog`.

---

## Shared admin timeline chrome

`admin-vertical-timeline.tsx` is shared by application, organisation, note, contract, and gateway-payment timelines.

- Originator avatar on the rail (admin purple, issuer red, investor brown; system uses grey)
- Event title, relative time, optional name line
- Portal is encoded in avatar colour, not repeated as `ADMIN` / `ISSUER` text
- Opaque actor ids are never shown
- Typography: `text-ui` for titles; `text-meta` for names and timestamps

Timeline headers include **Export CSV** via `apps/admin/src/components/admin-activity-csv.ts`. CSV rows are mapped from current Activity/Audit DTOs.

Global `/audit` tabs use `ListToolbar` chrome and current AuditLog event filters. Access is success-only (`USER_SIGNED_UP`, `USER_LOGGED_IN`, `USER_LOGGED_OUT`) with no status filter. Access denials and security failures live on Security.

---

## Issuer / investor ActivityFeed

Portal pages (`/activity`) use `ActivityFeed` (`packages/ui`). Data comes from `GET /v1/activities` and the adapters in `apps/api/src/modules/activity/adapters/`.

Filterable domains (`packages/types/src/activity-config.ts`):

| Portal | Filterable domains |
|--------|--------------------|
| Issuer | onboarding, application, note, signing |
| Investor | onboarding, note, payment |

Default domain filters (`getDefaultActivityDomains`):

- Onboarding **not** complete: empty default (`[]`) means the API is unfiltered, so all filterable domains including onboarding are shown.
- Onboarding complete: issuer defaults to `application`, `note`, `signing`; investor defaults to `note`, `payment`. Onboarding remains available via the Area filter.

Investor Activity never includes the application domain. Issuer Activity never includes the payment domain.

Deep links (`getActivityHref`):

- Issuer: invoice → `/financing/invoices/:id`; contract → `/financing/contracts/:id`; application → `/applications/:id`; note → `/financing/notes/:id`; onboarding → `/profile`
- Investor: note → `/investments/:id`; onboarding → `/profile`

Investor money movements that are not curated Activity stay on **Portfolio** (withdraw uses `withdrawalIntentId`). Do not document `/investments?tab=transactions` as the current transactions surface.

Visibility remains the current audit rules (organization scoping, issuer note-terms visibility after publish/unpublish, investor `INVESTMENT_COMMITTED` only for that investor org, committed-note campaign/funding/default events, `SETTLEMENT_POSTED` only when the snapshot allocates to that investor).

---

## Current application event names (not legacy aliases)

Use these names in writers, adapters, and admin labels:

- Acceptance: `CONTRACT_ACCEPTANCE_SUBMITTED`, `CONTRACT_ACCEPTANCE_RESUBMITTED` (not `CONTRACT_OFFER_ACCEPTANCE_*`)
- Amendments: `APPLICATION_AMENDMENTS_REQUESTED` (not `AMENDMENTS_SUBMITTED`)
- Section/item review: `APPLICATION_SECTION_REVIEW_UPDATED`, `APPLICATION_ITEM_REVIEW_UPDATED` (not `SECTION_REVIEWED_*` / `ITEM_REVIEWED_*`)
- Reopen: `APPLICATION_REOPENED_FOR_REVIEW` (not `APPLICATION_RESET_TO_UNDER_REVIEW`)
- There is no live `APPLICATION_APPROVED` application audit event

Full catalogues: `APPLICATION_AUDIT_EVENTS` and `SIGNING_AUDIT_EVENTS`.

---

## Key files

| Purpose | File |
|---------|------|
| Application audit writer | `apps/api/src/modules/applications/audit/writer.ts` |
| Application / signing catalogues | `apps/api/src/modules/applications/audit/events.ts`, `apps/api/src/modules/signing/audit/events.ts` |
| Merged logs API | `apps/api/src/modules/applications/service.ts` (`getApplicationLogs`) |
| Application Activity adapter | `apps/api/src/modules/activity/adapters/application-log.ts` |
| Signing / payment adapters | `apps/api/src/modules/activity/adapters/signing-log.ts`, `payment-log.ts` |
| Note Activity adapter | `apps/api/src/modules/activity/adapters/note-log.ts` |
| Presentation / visibility | `packages/types/src/activity-presentation.ts`, `activity-visibility.ts` |
| Shared timeline chrome | `apps/admin/src/components/admin-vertical-timeline.tsx` |
| ActivityFeed | `packages/ui/src/components/activity-feed.tsx` |
| CSV export | `apps/admin/src/components/admin-activity-csv.ts` |
| Application timeline | `apps/admin/src/components/admin-activity-timeline.tsx` |
| Global audit tabs | `apps/admin/src/lib/audit-tabs.ts` |
