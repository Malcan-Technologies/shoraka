# Application audit — origin/main vs current working tree

**READ-ONLY source comparison.** No product code, schema, migrations, audit events, UI, or tests were modified. This file is analysis documentation only.

`docs/audit/audit-manual-verification-catalogue.md` was **not** updated.

| Side | Git ref | Notes |
|---|---|---|
| BEFORE | `origin/main` = `28ae5c588a0fadb80379e48ac981feaa6de91c7d` | `ApplicationLog` / `application_logs` + `ApplicationReviewEvent` / `application_review_events` |
| AFTER | working tree `HEAD` = `b265f92940a8d9df17c099c84ebd0363c80271e6` (`no_fix_55`) | `ApplicationAuditLog` / `application_audit_logs`; signing in `SigningAuditLog` |

Authority is `git show origin/main:<path>` versus the current working tree. Earlier audit reports were used only **after** source comparison, to flag documentation drift.

---

## Verdict (section 15, up front)

**APPLICATION ORIGIN/MAIN → CURRENT VERDICT: `SAFE_WITH_DIFFERENCES`**

Live application business evidence from this `origin/main` is still recorded. The ledger moved from `ApplicationLog` (+ duplicate `ApplicationReviewEvent`) to `ApplicationAuditLog`, with signing rows moved to `SigningAuditLog` and merged back on application history. Several events were renamed. A few facility-admin breadcrumbs have no current application audit equivalent. Several **new** application events exist (review started, documents, archive, draft delete, acceptance change-requests).

**`CONTRACT_FACILITY_OCCUPANCY_UPDATED` is not new versus this `origin/main`.** It already had a production writer in `apps/api/src/lib/refresh-contract-facility.ts` and an `ApplicationLogEventType` enum member. Current still writes it to Application audit only; origin/main also dual-wrote `NoteEvent` `FACILITY_OCCUPANCY_UPDATED` when a `noteId` was present.

Current source event count: **41** (`APPLICATION_AUDIT_EVENTS` in `apps/api/src/modules/applications/audit/events.ts`, matched by `packages/types/src/admin.ts`). Catalogue IDs APP-001–APP-040 / A063–A102 plus APP-041 / A178 are **documentation labels**, not identifiers in the TypeScript catalogue.

---

## 1. Source of truth (verified)

### origin/main

- Model `ApplicationLog` → `application_logs` (`apps/api/prisma/schema.prisma`).
- Model `ApplicationReviewEvent` → `application_review_events` (duplicate review ledger).
- Enum `ApplicationLogEventType`: **45** members in `apps/api/src/modules/applications/logs/types.ts`.
- Writer: `logApplicationActivity` → `createApplicationLog`.
- Org Activity adapter: `apps/api/src/modules/activity/adapters/application-log.ts` reading `application_logs`.
- Application timeline API: `GET /v1/applications/:id/logs`.

### current

- Model `ApplicationAuditLog` → `application_audit_logs` (no FKs, required `metadata` JSON, no `updated_at`).
- No `ApplicationLog` / `ApplicationReviewEvent` models.
- Catalogue: **41** events in `APPLICATION_AUDIT_EVENTS`.
- Writer: `writeApplicationAuditLog` (`apps/api/src/modules/applications/audit/writer.ts`).
- Org Activity adapter reads `application_audit_logs` and filters with `isApplicationActivityVisible`.
- `GET /v1/applications/:id/logs` merges Application + Signing audit (unfiltered).
- `GET /v1/admin/applications/:id/audit-history` same merge, paginated, permission `applications.view`.

Cutover test `apps/api/src/modules/applications/audit/cutover.test.ts` asserts Application audit is **not** used as workflow state (`applicationAuditLog.find` absent from amendments/application/admin services). Resubmit comparison reads `applicationReviewRemark`, not audit rows.

---

## 2. origin/main Application logging inventory

### 2.1 Enum (45)

`APPLICATION_CREATED`, `APPLICATION_SUBMITTED`, `APPLICATION_RESUBMITTED`, `APPLICATION_APPROVED`, `APPLICATION_REJECTED`, `APPLICATION_WITHDRAWN`, `APPLICATION_COMPLETED`, `APPLICATION_RESET_TO_UNDER_REVIEW`, `SECTION_REVIEWED_APPROVED`, `SECTION_REVIEWED_REJECTED`, `SECTION_REVIEWED_AMENDMENT_REQUESTED`, `SECTION_REVIEWED_PENDING`, `ITEM_REVIEWED_APPROVED`, `ITEM_REVIEWED_REJECTED`, `ITEM_REVIEWED_AMENDMENT_REQUESTED`, `ITEM_REVIEWED_PENDING`, `CONTRACT_OFFER_SENT`, `CONTRACT_OFFER_ACCEPTANCE_SUBMITTED`, `CONTRACT_OFFER_ACCEPTANCE_RESUBMITTED`, `CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING`, `CONTRACT_OFFER_ACCEPTED`, `CONTRACT_OFFER_REJECTED`, `CONTRACT_OFFER_RETRACTED`, `CONTRACT_FACILITY_OCCUPANCY_UPDATED`, `CONTRACT_OFFER_EXPIRED`, `CONTRACT_SIGNING_DEADLINE_EXTENDED`, `CONTRACT_WITHDRAWN`, `CONTRACT_FACILITY_FEE_WAIVED`, `CONTRACT_FACILITY_DISABLED`, `CONTRACT_FACILITY_ENABLED`, `INVOICE_OFFER_SENT`, `INVOICE_OFFER_ACCEPTANCE_SUBMITTED`, `INVOICE_OFFER_ACCEPTANCE_RESUBMITTED`, `INVOICE_ACCEPTANCE_APPROVED_FOR_SIGNING`, `INVOICE_OFFER_ACCEPTED`, `INVOICE_OFFER_REJECTED`, `INVOICE_OFFER_RETRACTED`, `INVOICE_OFFER_EXPIRED`, `INVOICE_SIGNING_DEADLINE_EXTENDED`, `INVOICE_WITHDRAWN`, `AMENDMENTS_SUBMITTED`, `SIGNING_PACKAGE_CREATED`, `SIGNING_PACKAGE_SENT`, `SIGNING_PACKAGE_COMPLETED`, `SIGNING_PACKAGE_VOIDED`.

**Not in the enum but written:** `CONTRACT_CUSTOMER_LARGE_PRIVATE_UPDATED` (admin service string).

### 2.2 Production `logApplicationActivity` writers (non-test)

| origin/main event | Writer |
|---|---|
| `APPLICATION_CREATED` | `applications/controller.ts` |
| `APPLICATION_SUBMITTED` / `APPLICATION_RESUBMITTED` | `applications/controller.ts` (status ternary) |
| `APPLICATION_WITHDRAWN` | `applications/service.ts`, also contract/invoice withdraw paths |
| `APPLICATION_COMPLETED` | `applications/service.ts` (×2, contract/invoice accept completion) |
| `APPLICATION_REJECTED` | `admin/service.ts` |
| `APPLICATION_RESET_TO_UNDER_REVIEW` | `admin/service.ts` |
| `AMENDMENTS_SUBMITTED` | `admin/service.ts` |
| `SECTION_REVIEWED_PENDING` | `ctos/ctos-report-service.ts` |
| `CONTRACT_OFFER_SENT` / retract / signing deadline | `admin/service.ts` |
| `CONTRACT_OFFER_EXPIRED` / `INVOICE_OFFER_EXPIRED` | `lib/jobs/acceptance-signing-expiry.ts` |
| `CONTRACT_OFFER_ACCEPTANCE_SUBMITTED` / `_RESUBMITTED` | `applications/service.ts` |
| `CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING` | `applications/service.ts` + `admin/service.ts` |
| Invoice acceptance submit/resubmit/approved-for-signing | same pattern as contract |
| `INVOICE_OFFER_SENT` / retract / signing deadline / withdrawn | admin + invoices |
| `CONTRACT_CUSTOMER_LARGE_PRIVATE_UPDATED` | `admin/service.ts` |
| `CONTRACT_FACILITY_FEE_WAIVED` | `admin/service.ts` |
| `CONTRACT_FACILITY_ENABLED` / `DISABLED` | `admin/service.ts` |
| `SIGNING_PACKAGE_CREATED` / `SENT` / `COMPLETED` / `VOIDED` | `signing/service.ts` via `params.eventType` |
| `CONTRACT_FACILITY_OCCUPANCY_UPDATED` | `lib/refresh-contract-facility.ts` |

`ApplicationReviewEvent.create` sites in origin/main `admin/service.ts` (three production creates) duplicated section/item/amendment review onto a second table.

### 2.3 Dead enum (no production writer found)

`APPLICATION_APPROVED` — adapter copy only. Classify as **REMOVED_DEAD_EVENT**, not loss.

`SECTION_REVIEWED_APPROVED` / `REJECTED` / `AMENDMENT_REQUESTED` and `ITEM_REVIEWED_*` appear as enum + adapter cases. Live review writes on origin/main went through `ApplicationReviewEvent` plus (for CTOS) `SECTION_REVIEWED_PENDING`. Treat the eight dynamic names as **MERGED_INTO_CURRENT_EVENT** / duplicate-ledger removal, not eight independent lost writers.

---

## 3. Current Application inventory (41)

| # | Current event | Current production writer | On origin/main? | Classification | Notes |
|---|---|---|---|---|---|
| 1 | `APPLICATION_CREATED` | `applications/service.ts` | Yes | EXACTLY_PRESERVED | Name unchanged |
| 2 | `APPLICATION_SUBMITTED` | `applications/service.ts` (×2) | Yes | EXACTLY_PRESERVED | Does not start review |
| 3 | `APPLICATION_REVIEW_STARTED` | `admin/service.ts` | No live event | CURRENT_ONLY | New evidence |
| 4 | `APPLICATION_RESUBMITTED` | `applications/amendments/service.ts` (once) | Yes | EXACTLY_PRESERVED | Writer moved off PATCH status |
| 5 | `APPLICATION_AMENDMENT_ACKNOWLEDGED` | `applications/amendments/service.ts` | No | CURRENT_ONLY | New |
| 6 | `APPLICATION_AMENDMENTS_REQUESTED` | `admin/service.ts` | Yes as `AMENDMENTS_SUBMITTED` | RENAMED | Origin name implied issuer submit |
| 7 | `APPLICATION_REOPENED_FOR_REVIEW` | `admin/service.ts` | Yes as `APPLICATION_RESET_TO_UNDER_REVIEW` | RENAMED | |
| 8 | `APPLICATION_WITHDRAWN` | `applications/service.ts` + invoice path | Yes | EXACTLY_PRESERVED | |
| 9 | `APPLICATION_REJECTED` | `applications/lifecycle-close.ts` | Yes | EXACTLY_PRESERVED | Writer file moved |
| 10 | `APPLICATION_ARCHIVED` | `applications/service.ts` (×2) | No | CURRENT_ONLY | |
| 11 | `APPLICATION_DRAFT_DELETED` | `applications/service.ts` (same tx before delete) | No | CURRENT_ONLY | |
| 12 | `APPLICATION_COMPLETED` | `applications/service.ts` (×2) | Yes | EXACTLY_PRESERVED | |
| 13 | `APPLICATION_SECTION_REVIEW_UPDATED` | `admin/service.ts` `logReviewActivity` | Yes (dynamic section + `SECTION_REVIEWED_PENDING` + review events) | MERGED_INTO_CURRENT_EVENT | One event, status in metadata |
| 14 | `APPLICATION_ITEM_REVIEW_UPDATED` | `admin/service.ts` `logReviewActivity` | Yes (item review events + review table) | MERGED_INTO_CURRENT_EVENT | |
| 15 | `APPLICATION_DOCUMENT_UPLOADED` | `audit/documents.ts` | No dedicated log | CURRENT_ONLY | Documents were SOT-only |
| 16 | `APPLICATION_DOCUMENT_REMOVED` | `audit/documents.ts` | No | CURRENT_ONLY | |
| 17 | `APPLICATION_DOCUMENT_REPLACED` | `audit/documents.ts` | No | CURRENT_ONLY | |
| 18 | `CONTRACT_OFFER_SENT` | `admin/service.ts` | Yes | EXACTLY_PRESERVED | |
| 19 | `CONTRACT_OFFER_RETRACTED` | `admin/service.ts` | Yes | EXACTLY_PRESERVED | |
| 20 | `CONTRACT_SIGNING_DEADLINE_EXTENDED` | `admin/service.ts` | Yes | EXACTLY_PRESERVED | |
| 21 | `CONTRACT_OFFER_EXPIRED` | `lib/jobs/acceptance-signing-expiry.ts` | Yes | EXACTLY_PRESERVED | System job |
| 22 | `CONTRACT_ACCEPTANCE_SUBMITTED` | `applications/service.ts` ternary | Yes as `CONTRACT_OFFER_ACCEPTANCE_SUBMITTED` | RENAMED | |
| 23 | `CONTRACT_ACCEPTANCE_RESUBMITTED` | same ternary | Yes as `…_RESUBMITTED` | RENAMED | |
| 24 | `CONTRACT_ACCEPTANCE_CHANGES_REQUESTED` | `admin/service.ts` | No dedicated name | CURRENT_ONLY | Origin used review events |
| 25 | `CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING` | `applications/service.ts` | Yes (same name) | EXACTLY_PRESERVED | |
| 26 | `CONTRACT_OFFER_ACCEPTED` | `applications/service.ts` | Yes | EXACTLY_PRESERVED | `completionMethod` DIRECT vs SIGNING |
| 27 | `CONTRACT_OFFER_REJECTED` | `applications/service.ts` | Yes | EXACTLY_PRESERVED | Must not use `CONTRACT_WITHDRAWN` |
| 28 | `CONTRACT_WITHDRAWN` | `contracts/service.ts` | Yes | EXACTLY_PRESERVED | |
| 29 | `CONTRACT_CUSTOMER_LARGE_PRIVATE_UPDATED` | `admin/service.ts` | Yes (string, not enum) | EXACTLY_PRESERVED | Now in catalogue |
| 30 | `INVOICE_OFFER_SENT` | `admin/service.ts` | Yes | EXACTLY_PRESERVED | |
| 31 | `INVOICE_OFFER_RETRACTED` | `admin/service.ts` | Yes | EXACTLY_PRESERVED | |
| 32 | `INVOICE_SIGNING_DEADLINE_EXTENDED` | `admin/service.ts` | Yes | EXACTLY_PRESERVED | |
| 33 | `INVOICE_OFFER_EXPIRED` | expiry job | Yes | EXACTLY_PRESERVED | System job |
| 34 | `INVOICE_ACCEPTANCE_SUBMITTED` | `applications/service.ts` | Yes as `INVOICE_OFFER_ACCEPTANCE_SUBMITTED` | RENAMED | |
| 35 | `INVOICE_ACCEPTANCE_RESUBMITTED` | same | Yes | RENAMED | |
| 36 | `INVOICE_ACCEPTANCE_CHANGES_REQUESTED` | `admin/service.ts` | No dedicated name | CURRENT_ONLY | |
| 37 | `INVOICE_ACCEPTANCE_APPROVED_FOR_SIGNING` | `applications/service.ts` | Yes | EXACTLY_PRESERVED | |
| 38 | `INVOICE_OFFER_ACCEPTED` | `applications/service.ts` | Yes | EXACTLY_PRESERVED | `completionMethod` |
| 39 | `INVOICE_OFFER_REJECTED` | `applications/service.ts` | Yes | EXACTLY_PRESERVED | |
| 40 | `INVOICE_WITHDRAWN` | `invoices/service.ts` | Yes | EXACTLY_PRESERVED | |
| 41 | `CONTRACT_FACILITY_OCCUPANCY_UPDATED` | `lib/refresh-contract-facility.ts` | **Yes** | EXACTLY_PRESERVED | Not current-only vs this origin/main |

Signing package events are **not** in the 41. They live in `SigningAuditLog` (`MOVED_TO_SIGNING`) and are merged onto application history.

---

## 4. Old → current event matrix

| origin/main event / evidence | Old writer | Current equivalent | Current writer | Classification | Business evidence preserved? | Important difference |
|---|---|---|---|---|---|---|
| `APPLICATION_CREATED` | controller | `APPLICATION_CREATED` | application service | EXACTLY_PRESERVED | Yes | |
| `APPLICATION_SUBMITTED` | controller | `APPLICATION_SUBMITTED` | application service | EXACTLY_PRESERVED | Yes | Copy must not imply review started |
| `APPLICATION_RESUBMITTED` | controller status | `APPLICATION_RESUBMITTED` | amendments service once | EXACTLY_PRESERVED | Yes | Single writer |
| `APPLICATION_APPROVED` | none | — | — | REMOVED_DEAD_EVENT | N/A | Enum/adapter only |
| `APPLICATION_REJECTED` | admin service | `APPLICATION_REJECTED` | lifecycle-close | EXACTLY_PRESERVED | Yes | |
| `APPLICATION_WITHDRAWN` | application/contract/invoice | `APPLICATION_WITHDRAWN` | same domains | EXACTLY_PRESERVED | Yes | |
| `APPLICATION_COMPLETED` | application service | `APPLICATION_COMPLETED` | application service | EXACTLY_PRESERVED | Yes | Does not claim disbursement |
| `APPLICATION_RESET_TO_UNDER_REVIEW` | admin | `APPLICATION_REOPENED_FOR_REVIEW` | admin | RENAMED | Yes | Clearer name |
| `AMENDMENTS_SUBMITTED` | admin | `APPLICATION_AMENDMENTS_REQUESTED` | admin | RENAMED | Yes | Origin name was misleading |
| `ApplicationReviewEvent` rows | admin (×3) | `APPLICATION_SECTION_REVIEW_UPDATED` / `APPLICATION_ITEM_REVIEW_UPDATED` | `logReviewActivity` | MERGED_INTO_CURRENT_EVENT | Yes | Duplicate table removed |
| `SECTION_REVIEWED_*` | CTOS pending + enum | `APPLICATION_SECTION_REVIEW_UPDATED` | admin + CTOS still writes application audit | MERGED_INTO_CURRENT_EVENT | Yes | Status in metadata |
| `ITEM_REVIEWED_*` | review table / enum | `APPLICATION_ITEM_REVIEW_UPDATED` | admin | MERGED_INTO_CURRENT_EVENT | Yes | |
| `CONTRACT_OFFER_SENT` | admin | same | admin | EXACTLY_PRESERVED | Yes | |
| `CONTRACT_OFFER_ACCEPTANCE_SUBMITTED` | application service | `CONTRACT_ACCEPTANCE_SUBMITTED` | application service | RENAMED | Yes | Dropped `OFFER_` |
| `CONTRACT_OFFER_ACCEPTANCE_RESUBMITTED` | application service | `CONTRACT_ACCEPTANCE_RESUBMITTED` | application service | RENAMED | Yes | |
| `CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING` | application + admin | same | application service | EXACTLY_PRESERVED | Yes | |
| `CONTRACT_OFFER_ACCEPTED` | application service | same | application service | EXACTLY_PRESERVED | Yes | `completionMethod` |
| `CONTRACT_OFFER_REJECTED` vs withdrawn | application service | `CONTRACT_OFFER_REJECTED` only on reject | application service | EXACTLY_PRESERVED | Yes | Cutover forbids withdrawn-on-reject |
| `CONTRACT_OFFER_RETRACTED` | admin | same | admin | EXACTLY_PRESERVED | Yes | |
| `CONTRACT_OFFER_EXPIRED` | job | same | job | EXACTLY_PRESERVED | Yes | |
| `CONTRACT_SIGNING_DEADLINE_EXTENDED` | admin | same | admin | EXACTLY_PRESERVED | Yes | |
| `CONTRACT_WITHDRAWN` | contracts | same | contracts | EXACTLY_PRESERVED | Yes | |
| `CONTRACT_FACILITY_OCCUPANCY_UPDATED` | refresh-contract-facility | same | refresh-contract-facility | EXACTLY_PRESERVED | Yes | Current: Application audit only |
| `NoteEvent` `FACILITY_OCCUPANCY_UPDATED` | same refresh when `noteId` | none in application/note occupancy path | — | INTENTIONALLY_REMOVED / MOVED_TO_SOT | Occupancy still on Contract snapshot | Dual ledger dropped (cutover: never NoteEvent) |
| `CONTRACT_FACILITY_FEE_WAIVED` | admin | none | — | INTENTIONALLY_REMOVED | **Possible loss if waive still exists** | No current admin waive/enable/disable symbols |
| `CONTRACT_FACILITY_ENABLED` / `DISABLED` | admin | none | — | INTENTIONALLY_REMOVED | **Possible loss if toggles still exist** | No matching current operations found |
| `CONTRACT_CUSTOMER_LARGE_PRIVATE_UPDATED` | admin (non-enum) | same, now catalogued | admin | EXACTLY_PRESERVED | Yes | |
| Invoice offer/acceptance/expiry/withdraw family | admin/invoices/job | renamed acceptance pair + rest same | same | EXACTLY_PRESERVED / RENAMED | Yes | Same as contract |
| `SIGNING_PACKAGE_*` | signing → ApplicationLog | Signing audit events | `writeSigningAuditLog` | MOVED_TO_SIGNING | Yes | Merged on `/logs` and audit-history |
| Documents | none | `APPLICATION_DOCUMENT_*` | documents helper | CURRENT_ONLY | Improved | New evidence |
| Review started | none | `APPLICATION_REVIEW_STARTED` | admin | CURRENT_ONLY | Improved | |
| Archive / draft delete | none | `APPLICATION_ARCHIVED` / `APPLICATION_DRAFT_DELETED` | application service | CURRENT_ONLY | Improved | |
| Acceptance changes requested | review events | `CONTRACT_` / `INVOICE_ACCEPTANCE_CHANGES_REQUESTED` | admin | CURRENT_ONLY | Improved | Dedicated names |

---

## 5. Data / metadata cross-check

| Information | origin/main storage | Current storage | Preserved? | Improved / reduced / moved |
|---|---|---|---|---|
| Actor user id | `application_logs.user_id` | `actor_user_id` | Yes | Typed actor |
| Actor name/email | metadata / join at read | metadata `actorName` / `actorEmail` snapshot | Yes | Snapshot at write |
| Organization | not first-class on ApplicationLog | `organization_id` + `organization_kind` | Improved | Forensic column |
| Target / entity | `entity_id`, deprecated `target` | `target_type` + `target_id` | Yes | Replaced deprecated columns |
| Previous / new status | metadata; review events `old_status` / `new_status` | metadata `previousStatus` / `newStatus` | Yes | Review table folded in |
| Review cycle | column `review_cycle` | metadata `reviewCycle` where schema requires it | Yes | Moved off column |
| Section / item | review event `scope` / `scope_key`; log metadata | metadata `section` / `itemId` | Yes | |
| Remark | column `remark` | metadata `remarks` | Yes | Column removed |
| Device | `device_info` + `user_agent` | `user_agent` only (no `device_info` column) | Partial | Parsed at Activity read from UA |
| IP | `ip_address` | `ip_address` | Yes | |
| Portal | `portal` | `portal` | Yes | |
| Contract/invoice numbers | metadata | metadata `contractNumber` / `invoiceNumber` | Yes | |
| Offer amounts / facility | metadata | metadata `offeredFacility` / `offeredAmount` | Yes | |
| Deadlines | metadata | metadata `previousDeadline` / `newDeadline` | Yes | |
| Reject/withdraw reasons | metadata / remark | metadata `reason` / `withdrawReason` | Yes | Reject uses `OFFER_REJECTED` |
| Document metadata | none as application log | category, slot, fileName, size, mime, hash | Improved | New |
| Completion method | not typed | `completionMethod` `DIRECT_ACCEPTANCE` \| `SIGNING_COMPLETION` | Improved | Distinguishes accept vs signed |
| Signing envelope id | ApplicationLog signing rows + entity | Signing audit `signing_envelope_id`; copied onto merged DTO | Moved | Separate table |
| Occupancy before/after | metadata `before` / `after` amounts | same six amount fields | Yes | Note dual-write removed |
| Deprecated `level` / `action` | still written, marked deprecated | removed | Intentional | Use event type |

**Actual data loss (not harmless redesign):**

1. **Facility fee waived / facility enabled / disabled** application log rows — no current event. Current admin service has no `waive` / `enableFacility` / `disableFacility` symbols; if those UI actions were removed with the events, this is intentional. If they still exist under other names, that is a real gap.
2. **`NoteEvent` occupancy dual-write** — occupancy evidence remains on Application audit + Contract snapshot SOT; note timeline no longer gets `FACILITY_OCCUPANCY_UPDATED` from this refresh path (cutover forbids it).
3. **Standalone `device_info` string** — reduced to `user_agent` (+ derived device at read). Harmless if UA is kept.

Harmless: dropping deprecated `level`/`target`/`action`; moving `review_cycle` and `remark` into typed metadata; deleting `ApplicationReviewEvent` because section/item events now land on `ApplicationAuditLog`.

---

## 6. UI surfaces

| Audience | Surface | origin/main behavior | Current behavior | Change | Better / Same / Possible regression |
|---|---|---|---|---|---|
| Admin | Org Activity (`OrganizationActivityTimeline` on org detail) | `ApplicationLogAdapter` curated list (lifecycle + offers + occupancy + some signing) | Same adapter, `isApplicationActivityVisible("admin")` allowlist | Curated; occupancy still admin-visible | Same / slightly tighter |
| Admin | Application Detail Activity (`RecentActivityCard` → `AdminActivityTimeline`) | `GET /v1/applications/:id/logs`; hide `SIGNING_PACKAGE_COMPLETED` only | Same endpoint (now merged Application+Signing); hide `SIGNING_PACKAGE_COMPLETED` only | Broader than org Activity (documents, item review, archive, etc.) | Same pattern as origin hide; **wider than org Activity** |
| Admin | Application Detail Audit History | **Did not exist** | `ApplicationAuditHistoryCard` → `GET /v1/admin/applications/:id/audit-history` | **Newly added** | Better (raw forensic) |
| Admin | Raw detail modal/sheet | Timeline expanders / CSV | Timeline details + paginated raw panel | Raw added | Better |
| Admin | Permissions | `/logs` any authenticated **admin role** | `/logs` admin requires `applications.view`; audit-history `applications.view` | More restrictive | Better |
| Issuer | Org `/activity` | Adapter issuer allowlist (no occupancy; no signing created) | `isApplicationActivityVisible("issuer")` — no review-started, no occupancy, section review only if amendment | Curated | Same intent |
| Issuer | Application Detail timeline | `GET .../logs` + issuer timeline builder | Same API; `EVENT_LABELS` / `ISSUER_VISIBLE_EVENTS` **wider** than org Activity | Detail shows review-started, documents, item/section review, amendment ack, archive, signing | **Possible regression** (internal noise on detail) |
| Issuer | Shared `/v1/applications/:id/logs` | ApplicationLog rows, ownership check | Merged Application+Signing, ownership check | Signing visible on detail via merge | Same access model + merge |
| Investor | `/activity` | Application adapter scoped to `__none__` for investor | Application domain **not** in investor filterable domains; `isApplicationActivityVisible("investor")` always false | Still none | Same |
| Investor | Application-related widgets | No application timeline | No application activity | Same | Same |

**Do not treat all Activity surfaces as one list.** Admin raw ≠ admin org Activity ≠ admin application detail timeline ≠ issuer org Activity ≠ issuer detail.

---

## 7. Event-by-event current visibility

Legend: **SHOW** / **HIDE** / **CONDITIONAL**.

Sources: `packages/types/src/activity-visibility.ts` (`isApplicationActivityVisible`, `isSigningActivityVisible`); admin timeline `TIMELINE_HIDDEN_EVENT_TYPES`; issuer `ISSUER_VISIBLE_EVENTS`; investor domain config; audit-history unfiltered merge.

| Event | Admin Raw | Admin Org Activity | Admin Application Detail Activity | Issuer Org Activity | Issuer Application Detail | Investor Activity |
|---|---|---|---|---|---|---|
| `APPLICATION_CREATED` | SHOW | SHOW | SHOW | SHOW | SHOW | HIDE |
| `APPLICATION_SUBMITTED` | SHOW | SHOW | SHOW | SHOW | SHOW | HIDE |
| `APPLICATION_REVIEW_STARTED` | SHOW | SHOW | SHOW | HIDE | SHOW | HIDE |
| `APPLICATION_RESUBMITTED` | SHOW | SHOW | SHOW | SHOW | SHOW | HIDE |
| `APPLICATION_AMENDMENT_ACKNOWLEDGED` | SHOW | HIDE | SHOW | HIDE | SHOW | HIDE |
| `APPLICATION_AMENDMENTS_REQUESTED` | SHOW | SHOW | SHOW | SHOW | SHOW | HIDE |
| `APPLICATION_REOPENED_FOR_REVIEW` | SHOW | SHOW | SHOW | SHOW | SHOW | HIDE |
| `APPLICATION_WITHDRAWN` | SHOW | SHOW | SHOW | SHOW | SHOW | HIDE |
| `APPLICATION_REJECTED` | SHOW | SHOW | SHOW | SHOW | SHOW | HIDE |
| `APPLICATION_ARCHIVED` | SHOW | HIDE | SHOW | HIDE | SHOW | HIDE |
| `APPLICATION_DRAFT_DELETED` | SHOW | HIDE | SHOW | HIDE | HIDE (not in issuer labels) | HIDE |
| `APPLICATION_COMPLETED` | SHOW | SHOW | SHOW | SHOW | SHOW | HIDE |
| `APPLICATION_SECTION_REVIEW_UPDATED` | SHOW | CONDITIONAL: `newStatus` in `AMENDMENT_REQUESTED` / `REQUEST_AMENDMENT` | SHOW | CONDITIONAL: same amendment statuses | SHOW (all statuses) | HIDE |
| `APPLICATION_ITEM_REVIEW_UPDATED` | SHOW | HIDE | SHOW | HIDE | SHOW | HIDE |
| `APPLICATION_DOCUMENT_UPLOADED` | SHOW | HIDE | SHOW | HIDE | SHOW | HIDE |
| `APPLICATION_DOCUMENT_REMOVED` | SHOW | HIDE | SHOW | HIDE | SHOW | HIDE |
| `APPLICATION_DOCUMENT_REPLACED` | SHOW | HIDE | SHOW | HIDE | SHOW | HIDE |
| `CONTRACT_OFFER_SENT` | SHOW | SHOW | SHOW | SHOW | SHOW | HIDE |
| `CONTRACT_OFFER_RETRACTED` | SHOW | SHOW | SHOW | SHOW | SHOW | HIDE |
| `CONTRACT_SIGNING_DEADLINE_EXTENDED` | SHOW | SHOW | SHOW | SHOW | SHOW | HIDE |
| `CONTRACT_OFFER_EXPIRED` | SHOW | SHOW | SHOW | SHOW | SHOW | HIDE |
| `CONTRACT_ACCEPTANCE_SUBMITTED` | SHOW | SHOW | SHOW | SHOW | SHOW | HIDE |
| `CONTRACT_ACCEPTANCE_RESUBMITTED` | SHOW | SHOW | SHOW | SHOW | SHOW | HIDE |
| `CONTRACT_ACCEPTANCE_CHANGES_REQUESTED` | SHOW | SHOW | SHOW | SHOW | SHOW | HIDE |
| `CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING` | SHOW | SHOW | SHOW | SHOW | SHOW | HIDE |
| `CONTRACT_OFFER_ACCEPTED` | SHOW | SHOW | SHOW | SHOW | SHOW | HIDE |
| `CONTRACT_OFFER_REJECTED` | SHOW | SHOW | SHOW | SHOW | SHOW | HIDE |
| `CONTRACT_WITHDRAWN` | SHOW | SHOW | SHOW | SHOW | SHOW | HIDE |
| `CONTRACT_CUSTOMER_LARGE_PRIVATE_UPDATED` | SHOW | HIDE | SHOW | HIDE | HIDE | HIDE |
| Invoice offer/acceptance family (same as contract offer lifecycle) | SHOW | SHOW | SHOW | SHOW | SHOW | HIDE |
| `CONTRACT_FACILITY_OCCUPANCY_UPDATED` | SHOW | SHOW | SHOW | HIDE | HIDE | HIDE |
| Signing events (merged) | SHOW | admin signing allowlist (created/sent/completed/voided/declined/expired/recipient/ekyc failed) | HIDE if `SIGNING_PACKAGE_COMPLETED`; other signing SHOW | issuer signing allowlist (no created, no recipient completed, no ekyc started/verified) | SHOW including created/completed/ekyc (label map) | HIDE |

Admin Application Detail Activity uses `/logs` + hide completed signing only — **not** the org Activity allowlist.

---

## 8–9. Title / description copy review

Presentation source: `packages/types/src/activity-presentation.ts` `formatApplicationActivity`. Issuer detail labels: `apps/issuer/src/app/(application-management)/applications/components/application-timeline.ts` `EVENT_LABELS`.

| Rule | Result |
|---|---|
| `APPLICATION_SUBMITTED` must not imply review started | **Pass.** Title “Application Submitted”; description “submitted for review.” |
| `APPLICATION_REVIEW_STARTED` means review started | **Pass.** Title “Review Started.” Issuer org hides it; issuer detail shows it. |
| `CONTRACT_OFFER_ACCEPTED` / `INVOICE_OFFER_ACCEPTED` must not say signing completed | **Pass.** “The facility/invoice offer was accepted.” `completionMethod` is in metadata, not copy. **MISSING_CONTEXT** for admin if DIRECT vs SIGNING should appear in the title. |
| `APPLICATION_AMENDMENTS_REQUESTED` | **Pass.** “Updates Requested” / “Updates were requested on your application.” |
| `APPLICATION_SECTION_REVIEW_UPDATED` if issuer-visible only for amendments | Org Activity: CONDITIONAL — copy matches. **Issuer detail shows all section updates** with “A section review was updated” — **MISLEADING** when status is APPROVED. |
| `APPLICATION_COMPLETED` | **Pass** on presentation. Issuer status fallback can still say “Financing completed” when no logs — **INCONSISTENT**. |
| Occupancy internal unless strong reason | Org: admin SHOW, issuer HIDE. Detail: issuer HIDE. **Pass.** |

| Event | Audience | Current title | Current description | Source | Assessment |
|---|---|---|---|---|---|
| `APPLICATION_CREATED` | Admin | Application Created | `{actor} created the application.` | `formatApplicationActivity` | GOOD |
| `APPLICATION_CREATED` | Issuer | Application Created / detail “Application started” | You created a financing application | presentation + EVENT_LABELS | INCONSISTENT titles, both OK |
| `APPLICATION_SUBMITTED` | Admin / Issuer | Application Submitted | submitted for review | presentation | GOOD |
| `APPLICATION_REVIEW_STARTED` | Admin | Review Started | Review has started | presentation | GOOD |
| `APPLICATION_REVIEW_STARTED` | Issuer detail | CashSouk started reviewing | (label only) | EVENT_LABELS | GOOD; hidden on org Activity |
| `APPLICATION_RESUBMITTED` | both | Application Resubmitted | after requested updates | presentation | GOOD |
| `APPLICATION_AMENDMENTS_REQUESTED` | both | Updates Requested | Updates were requested | presentation | GOOD |
| `APPLICATION_SECTION_REVIEW_UPDATED` | Admin org | Section Changes Requested | section label if provided | presentation | GOOD when amendment-only |
| `APPLICATION_SECTION_REVIEW_UPDATED` | Issuer detail | A section review was updated | log activity/remark | EVENT_LABELS | TOO_INTERNAL / MISLEADING if not amendment |
| `APPLICATION_ITEM_REVIEW_UPDATED` | Issuer detail | An item review was updated | | EVENT_LABELS | TOO_INTERNAL; SHOULD_BE_HIDDEN on issuer detail |
| `APPLICATION_REOPENED_FOR_REVIEW` | Admin | Reopened for Review | reopened for review | presentation | GOOD |
| `APPLICATION_REOPENED_FOR_REVIEW` | Issuer | Application Reopened / “Back under review” | reopened | presentation + labels | GOOD |
| `APPLICATION_WITHDRAWN` / `REJECTED` / `COMPLETED` | both | matching titles | matching | presentation | GOOD |
| `APPLICATION_AMENDMENT_ACKNOWLEDGED` | Issuer detail | You acknowledged requested changes | | EVENT_LABELS | GOOD; hidden org Activity |
| `APPLICATION_ARCHIVED` | Issuer detail | Application archived | | EVENT_LABELS | GOOD for context |
| `APPLICATION_DOCUMENT_*` | Issuer detail | uploaded/removed/replaced | | EVENT_LABELS | GOOD as application-context; hidden org Activity |
| Contract/invoice offer family | both | Facility/Invoice Offer … | offer/acceptance language | presentation | GOOD |
| `CONTRACT_OFFER_ACCEPTED` | both | Facility Offer Accepted | The facility offer was accepted | presentation | GOOD (no signing overclaim); admin MAY want method |
| `CONTRACT_FACILITY_OCCUPANCY_UPDATED` | Admin | Facility Utilization Updated | usage updated after invoice accepted / funding closed / failed / note repaid | presentation | GOOD; keep admin-only |

Investor: no application events. No investor copy to review.

---

## 10. UI regression / change review

### A. Preserved from origin/main

- Admin application detail timeline from `/logs`, hide `SIGNING_PACKAGE_COMPLETED`.
- Issuer application detail timeline from `/logs`.
- Org Activity via application adapter (curated).
- Investor has no application activity domain.

### B. Moved

- Signing rows: ApplicationLog → SigningAuditLog, merged on history APIs.
- Review evidence: `ApplicationReviewEvent` → Application audit section/item events.

### C. Newly added

- Admin **Audit History** panel (`ContextualAuditHistoryPanel` on application detail).
- Document upload/remove/replace audit events.
- Review started, amendment acknowledged, archive, draft delete, acceptance change-requested events.

### D. Intentionally removed

- Duplicate review-event table as a UI/query source.
- Admin facility fee-waive / enable / disable **application log** events (and no matching current admin symbols).
- Note occupancy event dual-write from facility refresh.

### E. Possible UI regressions

**1. Issuer detail timeline wider than issuer org Activity**

WHAT CHANGED: Detail `ISSUER_VISIBLE_EVENTS` includes review started, amendment ack, archive, documents, section/item review, extra signing labels. Org Activity uses a narrower allowlist.

WHY IT MATTERS: Issuers can see operational review/item/document rows on the application page that never appear in `/activity`.

CURRENT SOURCE: `application-timeline.ts` `EVENT_LABELS`; `activity-visibility.ts` `APPLICATION_ISSUER_SHOW`.

ORIGIN/MAIN SOURCE: issuer timeline + adapter issuer allowlist (section/item review were not in the adapter’s issuer org list).

RECOMMENDATION: **VISIBILITY_FIX** for item review (and non-amendment section review) on issuer detail; **KEEP_CURRENT** for documents, review started, amendment ack, archive.

**2. Admin detail timeline vs admin org Activity**

WHAT CHANGED: Same as origin: detail is `/logs` minus completed signing; org is allowlist. Detail now also shows new document/item/archive events.

WHY IT MATTERS: Operators may think org Activity is complete; it is not.

CURRENT / ORIGIN: `admin-activity-timeline.tsx` vs `isApplicationActivityVisible("admin")`.

RECOMMENDATION: **KEEP_CURRENT** (detail = working log; org = curated). Raw Audit History covers completeness.

**3. Admin `/logs` now requires `applications.view`**

WHAT CHANGED: Origin any admin role; current permission gate.

WHY IT MATTERS: Admins without `applications.view` lose timeline. That is **more** restrictive.

RECOMMENDATION: **KEEP_CURRENT**.

**4. Occupancy on admin org Activity**

Already on origin/main adapter + current admin allowlist. Not a new leak to issuers.

RECOMMENDATION: **KEEP_CURRENT**.

---

## 11. Issuer org Activity HIDE vs issuer detail SHOW

| Event | Useful application-context vs noise | Recommendation |
|---|---|---|
| `APPLICATION_REVIEW_STARTED` | Useful (“CashSouk is reviewing”) | KEEP_VISIBLE |
| `APPLICATION_AMENDMENT_ACKNOWLEDGED` | Useful | KEEP_VISIBLE |
| `APPLICATION_ARCHIVED` | Useful closure | KEEP_VISIBLE |
| `APPLICATION_SECTION_REVIEW_UPDATED` (non-amendment) | Internal approve/pending noise | HIDE_FROM_ISSUER_DETAIL |
| `APPLICATION_SECTION_REVIEW_UPDATED` (amendment) | Useful; org already shows | KEEP_BUT_REWORD if detail uses generic “section review was updated” |
| `APPLICATION_ITEM_REVIEW_UPDATED` | Internal operational noise | HIDE_FROM_ISSUER_DETAIL |
| `APPLICATION_DOCUMENT_UPLOADED` / `REMOVED` / `REPLACED` | Useful | KEEP_VISIBLE |
| Signing created / recipient completed / eKYC started+verified | Mixed; signing-dependent | KEEP_VISIBLE for sent/completed/declined; eKYC started is operational — product call |
| `SIGNING_PACKAGE_COMPLETED` | On issuer detail label map; org Activity may show via signing adapter | KEEP_VISIBLE as signing milestone (admin detail hides it to avoid duplicating offer accepted) |

---

## 12. Admin org Activity vs admin application detail Activity

Visible on **detail** (`/logs`, hide completed signing) but **hidden from curated org Activity**:

- `APPLICATION_AMENDMENT_ACKNOWLEDGED`
- `APPLICATION_ARCHIVED`
- `APPLICATION_DRAFT_DELETED`
- `APPLICATION_SECTION_REVIEW_UPDATED` when not amendment
- `APPLICATION_ITEM_REVIEW_UPDATED`
- `APPLICATION_DOCUMENT_*`
- `CONTRACT_CUSTOMER_LARGE_PRIVATE_UPDATED`
- Signing events outside admin signing org allowlist that still appear in `/logs` (e.g. reminder, eKYC started/verified)

This matches origin’s pattern (detail = nearly full log; org = curated) plus **new** document/item/archive events. **Intentional useful detail**, not an inconsistent filter bug — except item-by-item review on a curated org feed would be noise (correctly hidden).

---

## 13. RBAC

| Route | origin/main | Current | Access |
|---|---|---|---|
| `GET /v1/applications/:id/logs` | `requireAuth`; admin if role ADMIN (no `applications.view`); issuer `verifyApplicationAccess` | `requireAuth`; **admin must have `applications.view`**; issuer ownership | **MORE_RESTRICTIVE** for admin |
| `GET /v1/admin/applications/:id/audit-history` | did not exist | `requirePermission("applications.view")` | New; same permission as applications view |
| Signing envelope logs | origin mixed into application logs | `applications.view` for admin envelope logs | Aligned with applications.view |
| Org Activity | org-scoped adapters | same + visibility functions | Same scoping; investor application domain omitted |

**Not LESS_RESTRICTIVE.** No flag for loosened access.

---

## 14. Source of truth (operational)

| Family | SOT |
|---|---|
| Application lifecycle | `Application` status + timestamps |
| Resubmit / amendments | `ApplicationRevision` + `ApplicationReviewRemark` (cycle-scoped unique) |
| Section/item review | `ApplicationReview` / items + remarks; audit is evidence only |
| Contract / invoice / offers | `Contract`, `Invoice`, `offer_details` |
| Documents | document slots on application JSON / S3 keys |
| Signing | `SigningEnvelope` / package |
| Occupancy | Contract facility snapshot columns; audit when materially changed |

Cutover test: amendments, application service, and admin service must not `applicationAuditLog.find`. **No current workflow depends on ApplicationAuditLog as operational state.**

---

## 15. Final summary counts

**Preserved live evidence:** ~30 origin production application/offer/acceptance/expiry/withdraw/occupancy writers still have a current Application (or merged Signing) event.

**Renamed/restructured:** 8 — reset→reopened; amendments submitted→requested; contract/invoice acceptance submit/resubmit names; section/item review collapsed; signing moved table.

**Intentional removals:** `ApplicationReviewEvent` duplicate ledger; Note dual occupancy write; facility fee waive / enable / disable application logs (ops also absent in current admin grep).

**Dead old events removed:** `APPLICATION_APPROVED` (no writer).

**Current-only additions:** review started, amendment acknowledged, archived, draft deleted, three document events, two acceptance change-requested events. Occupancy is **not** current-only vs this origin/main.

**Possible audit-data losses:**

- Facility fee waived / facility enabled / disabled **if those actions still exist** (no current symbols found — likely removed with the events).
- Note-timeline occupancy breadcrumb (`FACILITY_OCCUPANCY_UPDATED`) from the refresh path.
- First-class `device_info` (UA remains).

**Possible UI losses:** None of the origin admin/issuer/investor application surfaces were deleted. Raw Audit History was **added**.

**Possible visibility regressions:** Issuer application detail shows item review and all section-review updates; origin org Activity did not show those to issuers.

**Description/title fixes recommended:** 5 (section-review title on non-amendment; item-review issuer detail; issuer vs presentation title mismatch; completed fallback “Financing completed”; optional admin accept method).

**RBAC:** MORE_RESTRICTIVE (admin `/logs` now needs `applications.view`).

**Investor leakage:** NO.

---

## 16. Application QA checklist (manual)

Do not seed fake audit rows. Drive the UI. Use one **new_contract** application then a **separate** invoice drawdown on the facility unless noted.

Expected columns: Audit = `ApplicationAuditLog` event; Admin Raw = audit-history (all merged); Admin Activity = org Activity allowlist; Issuer Activity = org `/activity`; Issuer Detail = application timeline; Investor = none.

### A. Create / draft / documents

| | Action | Expected audit | Admin Raw | Admin Activity | Issuer Activity | Issuer Detail | Investor | Origin/main | Copy/title check |
|---|---|---|---|---|---|---|---|---|---|
| [ ] | Create application | `APPLICATION_CREATED` | SHOW | SHOW | SHOW | SHOW | none | preserved | “Created” ≠ submitted |
| [ ] | Save draft sections | no-op expected unless docs change | — | — | — | — | none | same | |
| [ ] | Upload supporting doc | `APPLICATION_DOCUMENT_UPLOADED` | SHOW | HIDE | HIDE | SHOW | none | **new** | plain “uploaded” |
| [ ] | Replace doc | `APPLICATION_DOCUMENT_REPLACED` | SHOW | HIDE | HIDE | SHOW | none | **new** | |
| [ ] | Remove doc | `APPLICATION_DOCUMENT_REMOVED` | SHOW | HIDE | HIDE | SHOW | none | **new** | |
| [ ] | Delete draft | `APPLICATION_DRAFT_DELETED` then row gone | SHOW if history kept | HIDE | HIDE | n/a | none | **new** | |

### B. Submit / review

| | Action | Expected audit | Admin Raw | Admin Org | Issuer Org | Issuer Detail | Investor | Origin | Copy |
|---|---|---|---|---|---|---|---|---|---|
| [ ] | Submit | `APPLICATION_SUBMITTED` | SHOW | SHOW | SHOW | SHOW | none | preserved | must **not** say review started |
| [ ] | Admin start review | `APPLICATION_REVIEW_STARTED` | SHOW | SHOW | HIDE | SHOW | none | **new** | “Review started” |
| [ ] | Approve a section (no amendment) | `APPLICATION_SECTION_REVIEW_UPDATED` | SHOW | HIDE | HIDE | SHOW (noise) | none | merged | detail copy may say “changes requested” — bug |
| [ ] | Approve/reject an item | `APPLICATION_ITEM_REVIEW_UPDATED` | SHOW | HIDE | HIDE | SHOW | none | merged | hide from issuer detail recommended |

### C. Amendments / resubmit

| | Action | Expected audit | Admin Raw | Admin Org | Issuer Org | Issuer Detail | Investor | Origin | Copy |
|---|---|---|---|---|---|---|---|---|---|
| [ ] | Request amendments | `APPLICATION_AMENDMENTS_REQUESTED` (+ section events) | SHOW | SHOW | SHOW | SHOW | none | renamed from `AMENDMENTS_SUBMITTED` | “Updates requested” |
| [ ] | Issuer acknowledge | `APPLICATION_AMENDMENT_ACKNOWLEDGED` | SHOW | HIDE | HIDE | SHOW | none | **new** | |
| [ ] | Resubmit | `APPLICATION_RESUBMITTED` | SHOW | SHOW | SHOW | SHOW | none | preserved | |
| [ ] | Reopen for review | `APPLICATION_REOPENED_FOR_REVIEW` | SHOW | SHOW | SHOW | SHOW | none | renamed from RESET | |

### D. Contract offer lifecycle

| | Action | Expected audit | Admin Raw | Admin Org | Issuer Org | Issuer Detail | Investor | Origin | Copy |
|---|---|---|---|---|---|---|---|---|---|
| [ ] | Send facility offer | `CONTRACT_OFFER_SENT` | SHOW | SHOW | SHOW | SHOW | none | preserved | |
| [ ] | Retract | `CONTRACT_OFFER_RETRACTED` | SHOW | SHOW | SHOW | SHOW | none | preserved | |
| [ ] | Issuer submit acceptance | `CONTRACT_ACCEPTANCE_SUBMITTED` | SHOW | SHOW | SHOW | SHOW | none | renamed | |
| [ ] | Request acceptance changes | `CONTRACT_ACCEPTANCE_CHANGES_REQUESTED` | SHOW | SHOW | SHOW | SHOW | none | **new** | |
| [ ] | Resubmit acceptance | `CONTRACT_ACCEPTANCE_RESUBMITTED` | SHOW | SHOW | SHOW | SHOW | none | renamed | |
| [ ] | Approve for signing | `CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING` | SHOW | SHOW | SHOW | SHOW | none | preserved | **signing-dependent** next |
| [ ] | Direct accept | `CONTRACT_OFFER_ACCEPTED` `DIRECT_ACCEPTANCE` | SHOW | SHOW | SHOW | SHOW | none | preserved | must **not** say signed |
| [ ] | Signing complete | Signing events + `CONTRACT_OFFER_ACCEPTED` `SIGNING_COMPLETION` | SHOW (detail hides `SIGNING_PACKAGE_COMPLETED`) | signing allowlist | signing allowlist | SHOW | none | moved to Signing | |
| [ ] | Reject offer | `CONTRACT_OFFER_REJECTED` not withdrawn | SHOW | SHOW | SHOW | SHOW | none | preserved | |
| [ ] | Extend signing deadline | `CONTRACT_SIGNING_DEADLINE_EXTENDED` | SHOW | SHOW | SHOW | SHOW | none | preserved | |
| [ ] | Wait out offer | `CONTRACT_OFFER_EXPIRED` | SHOW | SHOW | SHOW | SHOW | none | preserved | **system-job**; hard to hit manually |
| [ ] | Withdraw facility | `CONTRACT_WITHDRAWN` | SHOW | SHOW | SHOW | SHOW | none | preserved | |
| [ ] | Toggle large private | `CONTRACT_CUSTOMER_LARGE_PRIVATE_UPDATED` | SHOW | HIDE | HIDE | HIDE | none | preserved | admin-only |

### E. Invoice offer lifecycle (**separate application** / drawdown)

Same pattern as D with `INVOICE_*` names. Occupancy should move after invoice **accept** (section G).

### F. Terminal paths

| | Action | Expected audit | Surfaces | Notes |
|---|---|---|---|---|
| [ ] | Withdraw application | `APPLICATION_WITHDRAWN` | all curated except investor | |
| [ ] | Reject application | `APPLICATION_REJECTED` | same | |
| [ ] | Complete after offers | `APPLICATION_COMPLETED` | same | copy = complete, not funded |
| [ ] | Archive | `APPLICATION_ARCHIVED` | raw + admin/issuer detail; not org Activity | **new** |

### G. Occupancy

| | Action | Expected audit | Admin Raw | Admin Org | Issuer Org | Issuer Detail | Investor | Origin | Copy |
|---|---|---|---|---|---|---|---|---|---|
| [ ] | Accept invoice so facility usage changes | `CONTRACT_FACILITY_OCCUPANCY_UPDATED` | SHOW | SHOW | HIDE | HIDE | none | **already on origin/main** | admin “utilization”; reason in description |
| [ ] | No material change | no-op expected | — | — | — | — | — | same | |
| [ ] | Funding closed/failed / note repaid | occupancy if amounts change | SHOW | SHOW | HIDE | HIDE | none | same | **system / note module** |

Confirm **no** `NoteEvent` occupancy from this refresh (current cutover). Origin dual-wrote `FACILITY_OCCUPANCY_UPDATED` on the note when `noteId` set.

### H. Admin UI

| [ ] | Org Activity shows occupancy and review started, hides documents/item review |
| [ ] | Application detail Activity shows documents/item review; hides `SIGNING_PACKAGE_COMPLETED` |
| [ ] | Audit History shows raw merged Application+Signing including completed signing |
| [ ] | CSV export on detail timeline still works |

### I. Issuer UI

| [ ] | `/activity` hides review started, occupancy, documents, item review |
| [ ] | Application timeline tab shows review started and documents |
| [ ] | Confirm whether item/section approve rows are acceptable noise |

### J. Investor negative tests

| [ ] | Investor `/activity` has no Application domain filter |
| [ ] | No application events in investor feed after issuer submits |

### K. RBAC

| [ ] | Admin without `applications.view` cannot load `/logs` or audit-history (403) |
| [ ] | Issuer cannot read another org’s `/logs` |
| [ ] | Origin allowed any admin role on `/logs` — current is stricter |

### L. Copy / description checks

| [ ] | Submitted ≠ review started |
| [ ] | Offer accepted ≠ signing completed (try DIRECT_ACCEPTANCE) |
| [ ] | Amendments = “updates requested” |
| [ ] | Completed ≠ disbursed |
| [ ] | Occupancy not on issuer Activity |

---

## 17. Documentation drift (after source comparison)

- Older `docs/audit/audit-origin-main-vs-current-cross-check.md` compared an **older** `origin/main` (`cc58bb43…`). **This** `origin/main` already includes occupancy + the old `ApplicationLog` design.
- Living catalogue still maps 41 Application events as A063–A102 + A178. Those IDs are **not** in `events.ts`; event **names** in source match `packages/types/src/admin.ts`.
- Do not treat occupancy as “added only in current” versus **this** `origin/main`.

---

## How to re-run this comparison

```bash
git rev-parse origin/main HEAD
git grep -n "logApplicationActivity\|ApplicationLogEventType" origin/main -- "*.ts"
rg 'export const APPLICATION_AUDIT_EVENTS' apps/api/src/modules/applications/audit/events.ts
rg 'isApplicationActivityVisible' packages/types/src/activity-visibility.ts
```
