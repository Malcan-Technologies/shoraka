# Activity Timeline Guide

How admin Activity timelines are stored, fetched, and displayed after the AuditLog cutover.

Related: `docs/guides/application/logging-guide.md` (application scenarios), `docs/audit/current-audit-logging-inventory.md` (catalogue and writers).

---

## Activity vs raw Audit History

**Activity** is a curated, audience-scoped feed. It uses visibility rules and presentation copy. It is not a dump of every audit row.

**Audit History** is the raw append-only evidence for a specific entity (application, note, legal document, product, access, payment). Raw panels keep current AuditLog DTOs; they do not restore legacy `ApplicationLog` / `NoteEvent` / `ProductLog` / success-failure Access semantics.

Do not expose internal metadata, provider webhook payloads, or other organizations’ events in user-facing Activity.

---

## Application Activity (admin application detail)

The application timeline on the admin application page is a curated view of merged application + signing history.

**Storage**

- `application_audit_logs` (`ApplicationAuditLog`) — application, review, contract, and invoice history
- `signing_audit_logs` (`SigningAuditLog`) — signing-package history

Legacy `application_logs` / `ApplicationLog` has been dropped. Writers are `writeApplicationAuditLog` and `writeSigningAuditLog`. There is no `logApplicationActivity` helper.

**API**

`GET /v1/applications/:id/logs` (`getApplicationLogs`) merges both readers newest-first. Actor display names come from the DTO `actor` snapshot (`actor.displayName`), also stored as `metadata.actorName`. This route is a reader projection, not workflow state.

Admin raw paging uses `getAdminApplicationAuditHistory`.

**Frontend**

- Hook: `apps/admin/src/hooks/use-application-logs.ts` (normalizes DTO `eventType` / `occurredAt` / `actor`)
- Timeline: `apps/admin/src/components/admin-activity-timeline.tsx`
- Shared chrome: `apps/admin/src/components/admin-vertical-timeline.tsx`

Titles use `formatApplicationActivity` / `formatSigningActivity` from `@cashsouk/types`. Invoice events include the invoice number in the title when `metadata.invoice_number` is present.

`SIGNING_PACKAGE_COMPLETED` is stored for audit but hidden from the curated timeline (`TIMELINE_HIDDEN_EVENT_TYPES`). The terminal signing milestone shown is `CONTRACT_OFFER_ACCEPTED` / `INVOICE_OFFER_ACCEPTED`.

---

## Shared admin timeline chrome

`admin-vertical-timeline.tsx` is shared by application, organisation, note, contract, and gateway-payment timelines.

- Originator avatar on the rail (admin purple, issuer red, investor brown; system uses grey)
- Event title, relative time, optional name line
- Portal is encoded in avatar colour, not repeated as `ADMIN` / `ISSUER` text
- Opaque actor ids are never shown
- Typography: `text-ui` for titles; `text-meta` for names and timestamps

Every timeline header includes **Export CSV** via `apps/admin/src/components/admin-activity-csv.ts` (`createdAt, event, eventType, actor, actorUserId, portal, remark, metadata`). CSV rows are mapped from current Activity/Audit DTOs, not from deleted `NoteEvent` / `GatewayPaymentEvent` fields.

---

## Other admin timelines

| Surface | Source | Notes |
|---------|--------|--------|
| Organisation Activity | `OnboardingAuditLog` via `GET /v1/admin/onboarding-logs` | Labels from `formatOnboardingActivity`. Hook filters current `ONBOARDING_AUDIT_EVENTS`. |
| Note Activity | `NoteAuditLog` on `NoteDetail.events` | Visibility-curated note events. CSV from `noteAuditLogToActivityCsvRow`. |
| Gateway payment Audit History | `PaymentAuditLog` | Display Ivan’s payment detail UI; timeline fields come from PaymentAuditLog (`eventType`, `occurredAt`, `actor.displayName`). Provider webhooks remain SOT, not extra business events. |
| Legal Documents | `LegalAdminAuditLog` | Raw audit; `document_management.view` |
| Product | `ProductAuditLog` | Raw audit; `audit.product.view` |
| Access | `AccessAuditLog` | Success-only Access events. Denied/failures live on Security. |

---

## Organization-level Activity adapters

Portal Activity pages (`/activity`) query unified adapters. Adapter class names are preserved (`ApplicationLogAdapter`, `NoteLogAdapter`) but they read current AuditLog tables.

- Application adapter: `application_audit_logs`, visibility via `isApplicationActivityVisible`, search includes `application_id` plus metadata paths `remark`, `application_reference`, `contract_number`, `contract_reference`, `invoice_number`, `invoice_reference`
- Note adapter: `note_audit_logs`, `occurred_at` ordering, `references.noteId` / `noteReference` for `getActivityHref`

Investor Activity only returns events allowed for that investor/org. Issuer/investor presentation copy lives in `packages/types/src/activity-presentation.ts`. Deep links use `getActivityHref`.

---

## Key files

| Purpose | File |
|---------|------|
| Application audit writer | `apps/api/src/modules/applications/audit/writer.ts` |
| Application / signing catalogues | `apps/api/src/modules/applications/audit/events.ts`, `apps/api/src/modules/signing/audit/events.ts` |
| Merged logs API | `apps/api/src/modules/applications/service.ts` (`getApplicationLogs`) |
| Application Activity adapter | `apps/api/src/modules/activity/adapters/application-log.ts` |
| Note Activity adapter | `apps/api/src/modules/activity/adapters/note-log.ts` |
| Presentation / visibility | `packages/types/src/activity-presentation.ts`, `packages/types/src/activity-visibility.ts` |
| Shared timeline chrome | `apps/admin/src/components/admin-vertical-timeline.tsx` |
| CSV export | `apps/admin/src/components/admin-activity-csv.ts` |
| Application timeline | `apps/admin/src/components/admin-activity-timeline.tsx` |

---

## Current application event names (not the legacy aliases)

Use these names in writers, adapters, and admin labels:

- Acceptance: `CONTRACT_ACCEPTANCE_SUBMITTED`, `CONTRACT_ACCEPTANCE_RESUBMITTED` (not `CONTRACT_OFFER_ACCEPTANCE_SUBMITTED`)
- Amendments: `APPLICATION_AMENDMENTS_REQUESTED` (not `AMENDMENTS_SUBMITTED`)
- Section/item review: `APPLICATION_SECTION_REVIEW_UPDATED`, `APPLICATION_ITEM_REVIEW_UPDATED` (not `SECTION_REVIEWED_*` / `ITEM_REVIEWED_*`)
- Reopen: `APPLICATION_REOPENED_FOR_REVIEW` (not `APPLICATION_RESET_TO_UNDER_REVIEW`)
- There is no live `APPLICATION_APPROVED` application audit event

Full catalogues: `APPLICATION_AUDIT_EVENTS` and `SIGNING_AUDIT_EVENTS`.
