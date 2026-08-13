# Activity Timeline Guide

This guide explains how application logs work: what is stored in the database, how the API returns logs, and how the admin timeline displays them.

Related guides: docs/guides/application/logging-guide.md (full scenarios, DB storage, kid-level), docs/guides/application/logging-scenarios.md (UI button to event mapping). You can read those files if you need more detail.

---

## Overview

The Activity Timeline shows events for a single application. It appears on the application detail page in the admin portal. `GET /v1/applications/:id/logs` is a merged reader of `ApplicationAuditLog` + `SigningAuditLog` (not a store). Actor names are resolved at read time.

---

## Database Structure

Application-domain history is `application_audit_logs` (Prisma: `ApplicationAuditLog`). Signing history is `signing_audit_logs` (Prisma: `SigningAuditLog`). Both are append-only with scalar ids (no Application/User/envelope FKs). Legacy `ApplicationLog` / `application_logs` has been dropped.

Event catalogues: `APPLICATION_AUDIT_EVENTS` and `SIGNING_AUDIT_EVENTS`. Do not treat audit rows as workflow state. Amendment remarks live on `ApplicationReviewRemark`; resubmit comparison reads `ApplicationRevision` + remarks.

---

## What Is Stored vs Calculated

**Stored:** Application and signing audit rows with `event_type`, `occurred_at`, actor/org/target fields, and required `metadata` Json.

**Calculated at read time:** `GET /v1/applications/:id/logs` merges both tables newest-first. The frontend derives labels, icons, and colors from `event_type`.

---

## Creating Logs

Application-domain writes use `writeApplicationAuditLog`. Signing writes use `writeSigningAuditLog`. There is no `logApplicationActivity` / `createApplicationLog` helper.

---

## API Behavior

**Route:** `GET /v1/applications/:id/logs`

**File:** `apps/api/src/modules/applications/controller.ts` (`getApplicationLogsHandler`), `apps/api/src/modules/applications/service.ts` (`getApplicationLogs`).

The handler verifies the user has access to the application, then calls `getApplicationLogs`. The service reads `ApplicationAuditLog` and `SigningAuditLog` for that application id and returns a merged timeline. Public route/hook names (`useApplicationLogs`) are preserved; they are not the deleted Prisma model.

---

## Frontend Behavior

**File:** `apps/admin/src/hooks/use-application-logs.ts` (data fetching), `apps/admin/src/components/admin-activity-timeline.tsx` (display).

The `useApplicationLogs` hook fetches from `/v1/applications/:id/logs` and normalizes the response. The timeline component maps `event_type` to icons, labels, and colors.

---

## Activity Adapter (Organization-Level Queries)

The `ApplicationLogAdapter` in `apps/api/src/modules/activity/adapters/application-log.ts` is used for organization-level activity queries, not for the application-specific timeline. It reads `application_audit_logs`. Signing activity uses `SigningLogAdapter` over `signing_audit_logs`. The adapter name is preserved public naming, not the dropped Prisma model.

---

## Key File Reference

| Purpose | File |
|---------|------|
| Prisma schema | `apps/api/prisma/schema.prisma` (`ApplicationAuditLog`, `SigningAuditLog`) |
| Application audit writer | `apps/api/src/modules/applications/audit/writer.ts` |
| Signing audit writer | `apps/api/src/modules/signing/audit/writer.ts` |
| Application logs API | `apps/api/src/modules/applications/service.ts` (`getApplicationLogs`) |
| API route | `apps/api/src/modules/applications/controller.ts` |
| Activity adapter (org-level) | `apps/api/src/modules/activity/adapters/application-log.ts` |
| Signing activity adapter | `apps/api/src/modules/activity/adapters/signing-log.ts` |
| Frontend hook | `apps/admin/src/hooks/use-application-logs.ts` |
| Timeline component | `apps/admin/src/components/admin-activity-timeline.tsx` |

---

## Application Log Event Types

All event types that can appear on the merged application timeline (`ApplicationAuditLog` + `SigningAuditLog`). Add new mappings in `admin-activity-timeline.tsx` (`getEventIcon`, `getEventLabel`, `getEventDotColor`) when introducing a new type.

**Timeline display:** `SIGNING_PACKAGE_COMPLETED` is written for audit/debug but filtered out of the admin Activity Timeline (`TIMELINE_HIDDEN_EVENT_TYPES`). The terminal signing milestone shown to users is `CONTRACT_OFFER_ACCEPTED` / `INVOICE_OFFER_ACCEPTED` (“Offer Signed”).

### Application lifecycle

| Event Type | Source | Portal | Description |
|------------|--------|--------|-------------|
| `APPLICATION_CREATED` | applications/controller | ISSUER | Issuer creates a new application |
| `APPLICATION_SUBMITTED` | applications/controller | ISSUER | Issuer submits for review |
| `APPLICATION_RESUBMITTED` | applications/controller, amendments/service | ISSUER | Issuer resubmits after amendments |
| `APPLICATION_APPROVED` | applications/controller, admin/service | ADMIN | Admin approves the application |
| `APPLICATION_REJECTED` | applications/controller, admin/service | ADMIN | Admin rejects the application |
| `APPLICATION_RESET_TO_UNDER_REVIEW` | admin/service | ADMIN | Admin resets status to under review |
| `APPLICATION_WITHDRAWN` | applications/service, contracts/service, invoices/service | ISSUER | Application withdrawn (user or cascading) |
| `APPLICATION_COMPLETED` | applications/service | ISSUER | All contracts and invoices accepted |

### Contract offers

| Event Type | Source | Portal | Description |
|------------|--------|--------|-------------|
| `CONTRACT_OFFER_SENT` | admin/service | ADMIN | Admin sends contract offer |
| `CONTRACT_OFFER_ACCEPTANCE_SUBMITTED` | applications/service | ISSUER | Issuer submits Step 1 acceptance documents |
| `CONTRACT_OFFER_ACCEPTANCE_RESUBMITTED` | applications/service | ISSUER | Issuer resubmits acceptance docs after `CHANGES_REQUESTED` |
| `CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING` | admin/service, applications/service | ADMIN, ISSUER | Acceptance docs approved; signing unlocked (issuer auto-approve when no docs configured) |
| `CONTRACT_OFFER_ACCEPTED` | applications/service | ISSUER | Terminal signing success: all signers completed and offer commercially accepted (shown as “Contract Offer Signed”) |
| `CONTRACT_WITHDRAWN` | applications/service | ISSUER, ADMIN | Issuer rejects offer (terminal withdraw) |
| `CONTRACT_OFFER_RETRACTED` | admin/service | ADMIN | Admin retracts contract offer |

### Invoice offers

| Event Type | Source | Portal | Description |
|------------|--------|--------|-------------|
| `INVOICE_OFFER_SENT` | admin/service | ADMIN | Admin sends invoice offer |
| `INVOICE_OFFER_ACCEPTANCE_SUBMITTED` | applications/service | ISSUER | Issuer submits Step 1 acceptance documents |
| `INVOICE_OFFER_ACCEPTANCE_RESUBMITTED` | applications/service | ISSUER | Issuer resubmits acceptance docs after `CHANGES_REQUESTED` |
| `INVOICE_ACCEPTANCE_APPROVED_FOR_SIGNING` | admin/service, applications/service | ADMIN, ISSUER | Acceptance docs approved; signing unlocked |
| `INVOICE_OFFER_ACCEPTED` | applications/service | ISSUER | Terminal signing success for invoice-only offers (shown as “Invoice Offer Signed”) |
| `INVOICE_OFFER_REJECTED` | applications/service | ISSUER | Issuer rejects invoice offer |
| `INVOICE_OFFER_RETRACTED` | admin/service | ADMIN | Admin retracts invoice offer |
| `INVOICE_WITHDRAWN` | invoices/service | ISSUER | Issuer withdraws an invoice |

### Section and item review

| Event Type | Source | Portal | Description |
|------------|--------|--------|-------------|
| `SECTION_REVIEWED_APPROVED` | admin/service | ADMIN | Admin approves a section (tab) |
| `SECTION_REVIEWED_REJECTED` | admin/service | ADMIN | Admin rejects a section |
| `SECTION_REVIEWED_AMENDMENT_REQUESTED` | admin/service | ADMIN | Admin requests amendment for section |
| `SECTION_REVIEWED_PENDING` | admin/service | ADMIN | Admin resets section to pending |
| `ITEM_REVIEWED_APPROVED` | admin/service | ADMIN | Admin approves an item (invoice/document) |
| `ITEM_REVIEWED_REJECTED` | admin/service | ADMIN | Admin rejects an item |
| `ITEM_REVIEWED_AMENDMENT_REQUESTED` | admin/service | ADMIN | Admin requests amendment for item |
| `ITEM_REVIEWED_PENDING` | admin/service | ADMIN | Admin resets item to pending |

### Amendments

| Event Type | Source | Portal | Description |
|------------|--------|--------|-------------|
| `APPLICATION_AMENDMENTS_REQUESTED` | admin/service | ADMIN | Admin sends amendment request(s) to issuer |

### Offer phase deadline lapse (cron)

| Event Type | Source | Portal | Description |
|------------|--------|--------|-------------|
| `CONTRACT_OFFER_EXPIRED` | lib/jobs/acceptance-signing-expiry | ADMIN | Acceptance or signing clock expired; entity → OFFER_EXPIRED (details kept) |
| `INVOICE_OFFER_EXPIRED` | lib/jobs/acceptance-signing-expiry | ADMIN | Same for invoice-only offers |
| `CONTRACT_SIGNING_DEADLINE_EXTENDED` | admin/service | ADMIN | Admin restamped signing_expires_at from Acceptance → Signing package |
| `INVOICE_SIGNING_DEADLINE_EXTENDED` | admin/service | ADMIN | Same for invoice-only offers |

### Signing package

| Event Type | Source | Portal | Description |
|------------|--------|--------|-------------|
| `SIGNING_PACKAGE_CREATED` | signing/service | ISSUER | Issuer creates a draft signing envelope |
| `SIGNING_PACKAGE_SENT` | signing/service | ISSUER | Signing package sent to all signers |
| `SIGNING_PACKAGE_COMPLETED` | signing/service | ISSUER | Envelope rollup COMPLETED (audit-only; hidden from timeline — use `CONTRACT_OFFER_ACCEPTED` / `INVOICE_OFFER_ACCEPTED`) |
| `SIGNING_PACKAGE_VOIDED` | signing/service | ADMIN, ISSUER | Admin voids package or signer declines (rollup) |
