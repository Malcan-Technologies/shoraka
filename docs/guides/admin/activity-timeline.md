# Activity Timeline Guide

This guide explains how application logs work: what is stored in the database, how the API returns logs, and how the admin timeline displays them.

Related guides: docs/guides/application/logging-guide.md (full scenarios, DB storage, kid-level), docs/guides/application/logging-scenarios.md (UI button to event mapping). You can read those files if you need more detail.

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
- **level**, **target**, **action** — Deprecated. Kept for DB column writes only. Use `event_type` for all logic and display.
- **entity_id** — Optional ID for a related entity (e.g. invoice id).
- **portal** — Where the action came from, e.g. ISSUER or ADMIN.
- **review_cycle** — Optional integer for the review round.
- **ip_address**, **user_agent**, **device_info** — Optional request context.
- **created_at** — When the log was created.

---

## What Is Stored vs Calculated

**Stored:** All fields above are persisted. Use `event_type` when creating logs. The `ApplicationLogEventType` enum in `apps/api/src/modules/applications/logs/types.ts` is the source of truth. Do not use `level`, `target`, or `action` to derive event meaning; they are deprecated and kept only for legacy DB writes.

**Calculated at read time:** The API resolves `user_id` to a display name and adds it to `metadata.actorName`. The frontend derives labels, icons, and colors from `event_type` only; these are not stored.

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

**Shared chrome:** `apps/admin/src/components/admin-vertical-timeline.tsx` — originator avatar on the rail (admin purple, issuer red, investor brown; system uses grey + computer icon), event title with relative time, and an optional name line. Actor ids are resolved to display names at read time (notes, contracts, applications, gateway payments, and organisation logs). Portal is encoded in the avatar colour, not repeated as `ADMIN` / `ISSUER` text. Opaque actor ids are never shown. Device, IP, event-type icons, and a first-item highlight ring are omitted so each row stays scannable. Typography uses brand tokens (`text-ui` for titles and supporting copy; `text-meta` for names and timestamps).

**Application display:** `apps/admin/src/hooks/use-application-logs.ts` (fetch), `apps/admin/src/components/admin-activity-timeline.tsx` (maps logs into the shared list).

The `useApplicationLogs` hook fetches from `/v1/applications/:id/logs` and normalizes the response. It expects either an array or an envelope with `items` and `pagination`. The timeline component receives `applicationId` and passes it to the hook. It maps each log into the shared item (label, optional activity text, actor name, timestamp). When a log has a `remark` or is an offer event with metadata, a "View details" button expands to show the remark or offer details. Event labels still live in `admin-activity-timeline.tsx`; adding a new event type requires updating `getEventLabel`. Avatar colour comes from the actor portal (`admin` / `issuer` / `investor`) or grey for System.

Issuer, investor, note, contract, and gateway-payment timelines use the same shared list via their domain wrappers. Every timeline header includes **Export CSV**, which downloads a standard audit file (`createdAt, event, eventType, actor, actorUserId, portal, remark, metadata`) via `apps/admin/src/components/admin-activity-csv.ts`.

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
| Shared timeline chrome | `apps/admin/src/components/admin-vertical-timeline.tsx` |
| CSV export | `apps/admin/src/components/admin-activity-csv.ts` |
| Application timeline | `apps/admin/src/components/admin-activity-timeline.tsx` |

---

## Application Log Event Types

All event types that can appear in `application_logs`. Add new mappings in `admin-activity-timeline.tsx` (`getEventLabel`) when introducing a new type.

**Timeline display:** `SIGNING_PACKAGE_COMPLETED` is written for audit/debug but filtered out of the admin Activity Timeline (`TIMELINE_HIDDEN_EVENT_TYPES`). The terminal signing milestone shown to users is `CONTRACT_OFFER_ACCEPTED` / `INVOICE_OFFER_ACCEPTED` (“Offer Signed”).

### Application lifecycle

| Event Type | Source | Portal | Description |
|------------|--------|--------|-------------|
| `APPLICATION_CREATED` | applications/controller (after create commits) | ISSUER | Issuer creates a new application |
| `APPLICATION_SUBMITTED` | applications/service `persistSubmittedApplication` | ISSUER | Issuer submits for review |
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
| `CONTRACT_FACILITY_OCCUPANCY_UPDATED` | refresh-contract-facility | ADMIN, ISSUER | Live occupancy reserved, true-up to funded, or released on repay |

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
| `AMENDMENTS_SUBMITTED` | admin/service | ADMIN | Admin sends amendment request(s) to issuer |

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
| `SIGNING_PACKAGE_CREATED` | signing/service | ADMIN | Admin creates a draft signing envelope from approved authorised representatives |
| `SIGNING_PACKAGE_SENT` | signing/service | ADMIN | Signing package sent to all signers |
| `SIGNING_PACKAGE_COMPLETED` | signing/service | ISSUER | Envelope rollup COMPLETED (audit-only; hidden from timeline — use `CONTRACT_OFFER_ACCEPTED` / `INVOICE_OFFER_ACCEPTED`) |
| `SIGNING_PACKAGE_VOIDED` | signing/service | ADMIN, ISSUER | Admin voids package or signer declines (rollup) |
