# Activity Timeline Guide

This guide explains how application logs work: what is stored in the database, how the API returns logs, and how the admin timeline displays them.

---

## Overview

The Activity Timeline shows events for a single application. It appears on the application detail page in the admin portal. Logs are stored in the `application_logs` table and fetched via an API that returns them with actor names resolved from the users table.

---

## Database Structure

The `application_logs` table (Prisma model: `ApplicationLog`) is defined in `apps/api/prisma/schema.prisma`.

Important fields:

- **id** — Unique identifier for the log row.
- **user_id** — Who performed the action. Required.
- **application_id** — Which application the log belongs to. Can be null for some system events.
- **event_type** — Short code describing the event, e.g. `APPLICATION_CREATED`, `APPLICATION_SUBMITTED`, `SECTION_REVIEWED_APPROVED`, `ITEM_REVIEWED_AMENDMENT_REQUESTED`, `APPLICATION_RESUBMITTED`.
- **remark** — Human-readable note. Stored at the top level. The UI uses this for the "View details" content. Do not put the main remark text in metadata.
- **metadata** — JSON for extra data (e.g. scope_key, actorName, offered_facility, invoice_number). The API enriches metadata with actor names from the users table.
- **level** — Optional enum: APPLICATION, TAB, ITEM.
- **target** — Optional enum: APPLICATION, FINANCIAL, CONTRACT, INVOICE, SUPPORTING_DOCUMENT.
- **action** — Optional enum: CREATED, SUBMITTED, RESUBMITTED, APPROVED, REJECTED, REQUESTED_AMENDMENT, RESET.
- **entity_id** — Optional ID for a related entity (e.g. invoice id).
- **portal** — Where the action came from, e.g. ISSUER or ADMIN.
- **review_cycle** — Optional integer for the review round.
- **ip_address**, **user_agent**, **device_info** — Optional request context.
- **created_at** — When the log was created.

---

## What Is Stored vs Calculated

**Stored:** All fields above are persisted. The `event_type` can be built from `level_target_action` or set explicitly when creating the log.

**Calculated at read time:** The API resolves `user_id` to a display name and adds it to `metadata.actorName`. The frontend derives labels, icons, and colors from `event_type`; these are not stored.

---

## Creating Logs

Logs are created in two ways.

**Preferred:** Use `createApplicationLog` in `apps/api/src/modules/applications/logs/repository.ts`. It accepts `CreateApplicationLogParams` from `apps/api/src/modules/applications/logs/types.ts`. You can pass `eventType` directly or let it be built from `level`, `target`, and `action`. Always set `remark` at the top level when you want a visible note. The `logApplicationActivity` wrapper in `apps/api/src/modules/applications/logs/service.ts` calls this and swallows errors so logging never blocks the main flow.

**Direct:** Some code (e.g. the amendments service) calls `prisma.applicationLog.create` directly. When doing so, set `remark` at the top level and use `metadata` only for extra structured data.

---

## API Behavior

**Route:** `GET /v1/applications/:id/logs`

**File:** `apps/api/src/modules/applications/controller.ts` (`getApplicationLogsHandler`), `apps/api/src/modules/applications/service.ts` (`getApplicationLogs`).

The handler verifies the user has access to the application, then calls `getApplicationLogs`. The service queries `prisma.applicationLog.findMany` with `where: { application_id: id }`, ordered by `created_at` descending. It collects all `user_id` values, fetches user names from the users table, and enriches each log's metadata with `actorName`. The response is `{ success: true, data: logs }`. There is no pagination; all logs for the application are returned.

---

## Frontend Behavior

**File:** `apps/admin/src/hooks/use-application-logs.ts` (data fetching), `apps/admin/src/components/admin-activity-timeline.tsx` (display).

The `useApplicationLogs` hook fetches from `/v1/applications/:id/logs` and normalizes the response. It expects either an array or an envelope with `items` and `pagination`. The timeline component receives `applicationId` and passes it to the hook. It renders each log with an icon, label, optional activity text, actor name, and timestamp. When a log has a `remark` or is an offer event with metadata, a "View details" button expands to show the remark or offer details. The component uses `getEventIcon`, `getEventLabel`, and `getEventDotColor` to map `event_type` to icons, labels, and colors. These mappings are defined in the component; adding a new event type requires updating these functions.

---

## Activity Adapter (Organization-Level Queries)

The `ApplicationLogAdapter` in `apps/api/src/modules/activity/adapters/application-log.ts` is used for organization-level activity queries, not for the application-specific timeline. It queries `application_logs` with filters (event types, date range, organization) and transforms records into a unified activity shape. The adapter uses the top-level `record.remark` when building activity text. The application logs API does not use this adapter; it reads directly from the database.

---

## Key File Reference

| Purpose | File |
|---------|------|
| Prisma schema | `apps/api/prisma/schema.prisma` |
| Log creation | `apps/api/src/modules/applications/logs/repository.ts` |
| Log types and enums | `apps/api/src/modules/applications/logs/types.ts` |
| Log service wrapper | `apps/api/src/modules/applications/logs/service.ts` |
| Application logs API | `apps/api/src/modules/applications/service.ts` (`getApplicationLogs`) |
| API route | `apps/api/src/modules/applications/controller.ts` |
| Activity adapter (org-level) | `apps/api/src/modules/activity/adapters/application-log.ts` |
| Frontend hook | `apps/admin/src/hooks/use-application-logs.ts` |
| Timeline component | `apps/admin/src/components/admin-activity-timeline.tsx` |

---

## Application Log Event Types

All event types that can appear in `application_logs`. Add new mappings in `admin-activity-timeline.tsx` (`getEventIcon`, `getEventLabel`, `getEventDotColor`) when introducing a new type.

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
| `CONTRACT_OFFER_ACCEPTED` | applications/service | ISSUER | Issuer accepts contract offer |
| `CONTRACT_WITHDRAWN` | applications/service, lib/jobs/offer-expiry | ISSUER, ADMIN | Issuer rejects offer or cron withdraws expired contract |
| `CONTRACT_OFFER_RETRACTED` | admin/service | ADMIN | Admin retracts contract offer |

### Invoice offers

| Event Type | Source | Portal | Description |
|------------|--------|--------|-------------|
| `INVOICE_OFFER_SENT` | admin/service | ADMIN | Admin sends invoice offer |
| `INVOICE_OFFER_ACCEPTED` | applications/service | ISSUER | Issuer accepts invoice offer |
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
| `AMENDMENTS_SUBMITTED` | admin/service | ADMIN | Admin sends amendment request(s) to issuer |

### Offer expiry (cron)

| Event Type | Source | Portal | Description |
|------------|--------|--------|-------------|
| `CONTRACT_WITHDRAWN` | lib/jobs/offer-expiry | ADMIN | Contract offer expired; cron withdrew |
| `APPLICATION_WITHDRAWN` | lib/jobs/offer-expiry | ADMIN | Contract/invoice offer expired; cron withdrew with `triggered_by: offer_expiry_cron` |
| `INVOICE_WITHDRAWN` | lib/jobs/offer-expiry | ADMIN | Invoice offer expired; cron withdrew |
