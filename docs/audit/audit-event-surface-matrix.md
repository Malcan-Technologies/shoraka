# Master Event / Activity / Notification Matrix

**This is the PRIMARY quick-reference for the CashSouk audit, activity, and notification system.**
If you need to answer *"what happens for `EVENT_X`?"* — what it means, whether it is live, who writes
it, what evidence it stores, where it appears in Admin / Issuer / Investor / CSV, what wording each
surface uses, and whether a notification fires — start here.

**Verified against:** working tree on branch `redo_log`, 2026-08-26. User-facing copy for the 58-event wording pass matches live source after `docs/audit/final-copy-standardization-plan.md`. Where documentation and source disagreed, **source won**.

---

## 0. How to read this document

### 0.1 Document responsibilities

Five documents cover this system. They are deliberately **not** interchangeable:

| Document | Responsibility | Use it when |
|---|---|---|
| **`audit-event-surface-matrix.md`** (this file) | **PRIMARY** quick reference: what every event does and where it appears | "What happens for `EVENT_X`?" |
| [`audit-event-catalog.md`](./audit-event-catalog.md) | Technical **writer / storage / evidence** reference, organised by module, with an evidence-sufficiency assessment per event | "Is the evidence we store for this event good enough?" |
| [`activity-notification-copy-standard.md`](./activity-notification-copy-standard.md) | Canonical **terminology rules** — which word means which business action, and the casing rules | "What should I *call* this on a new surface?" |
| [`activity-notification-copy-review.md`](./activity-notification-copy-review.md) | Historical **copy-consistency review** and implementation record (BEFORE/AFTER per event) | "Why does this surface word it that way, and was it reviewed?" |
| [`audit-product-gap-review.md`](./audit-product-gap-review.md) | **Unresolved product/compliance gaps** and the historical resolution record | "What is still broken or awaiting product sign-off?" |

Machine-readable companion: [`audit-event-registry.json`](./audit-event-registry.json) — one object per
event with status, domain, store, actor, writer, surface reachability, and notification mapping.
It deliberately **omits user-facing copy strings**: copy lives in exactly one place in code and is
transcribed in exactly one place here, so duplicating it into JSON would guarantee drift. Use its
`docRef` field to jump back to the prose entry. Query it with e.g.
`jq '.events[] | select(.status != "LIVE") | .eventType' docs/audit/audit-event-registry.json`.

Background/historical: [`origin-main-preservation-inventory.md`](./origin-main-preservation-inventory.md)
(table/column/reader inventory) and
[`origin-main-standardization-final-report.md`](./origin-main-standardization-final-report.md)
(schema/writer standardization and its test results).

### 0.2 Status vocabulary

| Status | Meaning |
|---|---|
| `LIVE` | At least one production writer creates rows with this value today |
| `DEAD` | Declared in an enum/union/label map but **no production writer** — rows never appear in prod |
| `DEV_ONLY` | Written only by a development-mode code path (separate dev database) |
| `SEED_ONLY` | Written only by `apps/api/prisma/seed.ts` dev fixtures |
| `UNREACHABLE` | A writer function exists but has **zero callers**, so it can never fire |
| `NOT_AN_ACTUAL_EVENT` | A string that appears in a label/UI map but is not a real stored `event_type` |
| `DISPLAY_ALIAS` | A legacy string kept only in a display label map so historical rows still render |

### 0.3 Surface vocabulary

Each event is described against eight surfaces. The wording is precise:

- **Shown** — the surface queries this event type *and* renders it.
- **Hidden (intentional)** — stored on purpose but deliberately withheld from this surface.
- **Hidden (not queried)** — excluded by a **query allowlist**, so rows are never fetched.
- **Hidden (filtered)** — fetched, then dropped by a post-query visibility filter.
- **Shown (fallback)** — rendered, but through a generic title-case fallback rather than a curated label.
- **N/A** — no such surface exists for this domain.

The eight surfaces map to concrete code:

| Surface | Backed by |
|---|---|
| ADMIN ACTIVITY | Admin audit pages (`apps/admin/src/app/audit/*`, `apps/admin/src/components/audit/*`) |
| ADMIN DETAIL | Per-entity admin timelines (`admin-activity-timeline.tsx`, `note-timeline-panel.tsx`, `organization-activity-timeline.tsx`, gateway payment detail) |
| ISSUER GENERAL ACTIVITY | Unified activity feed, issuer portal (`/activity` → `ApplicationLogAdapter`, `NoteLogAdapter`, `OrganizationLogAdapter`) |
| ISSUER APPLICATION DETAIL | `apps/issuer/.../applications/components/application-timeline.ts` |
| ISSUER FACILITY / TRANSACTION DETAIL | `apps/issuer/src/components/financing/facility-transactions.ts` |
| INVESTOR GENERAL ACTIVITY | Unified activity feed, investor portal (same adapters, `portalType: "investor"`) |
| INVESTOR DETAIL | `apps/investor/src/app/investments/[id]/page.tsx`. **Its "Recent note activity" panel is not an audit surface** — it renders `investor_balance_transactions` via `useInvestorBalanceActivity`, not `note_events`. No audit event reaches it, so INVESTOR DETAIL is `N/A` for every event in this document. |
| CSV / EXPORT | `contract-activity-csv.ts`, `note-activity-csv.ts`, admin `/export` endpoints |

### 0.4 Surface profiles (to avoid repeating "N/A" 800 times)

Several whole domains share one surface shape. Those are declared once as a **profile** and
referenced per event. A profile expands to the full eight-line pattern.

**PROFILE `ADMIN-FORENSIC`** — used by `access_logs`, `security_logs`, `product_logs`,
`legal_document_audit_logs`, `gateway_payment_events`:

```
ADMIN ACTIVITY:              Shown (see per-event copy)
ADMIN DETAIL:                N/A (no per-entity timeline) unless stated
ISSUER GENERAL ACTIVITY:     N/A — no adapter reads this table
ISSUER APPLICATION DETAIL:   N/A
ISSUER FACILITY DETAIL:      N/A
INVESTOR GENERAL ACTIVITY:   N/A — no adapter reads this table
INVESTOR DETAIL:             N/A
CSV / EXPORT:                Included (per-event copy noted)
```

Only three activity adapters exist on disk — `application-log.ts`, `note-log.ts`,
`organization-log.ts` — so **no** portal surface can ever show `access_logs`, `security_logs`,
`product_logs`, `legal_document_audit_logs`, or `gateway_payment_events`. That is a structural fact,
not an oversight.

### 0.5 Critical repository note

`apps/api/src/modules/*/audit/events.ts` (and the `*/audit/` directories generally) **do not exist**
on this branch. Editor search indexes may still surface them with a *different, future* event
vocabulary (`USER_LOGGED_IN`, `CONTRACT_ACCEPTANCE_SUBMITTED`, `SIGNING_PACKAGE_DECLINED`, …).
**Those names are not real.** Verify with `ls`/`cat` before trusting any index hit. See
§8 Legacy / Renamed Terminology.

The real writer surface is:

| Concern | Real file |
|---|---|
| Account-domain writers | `apps/api/src/lib/audit/account-logs.ts` |
| Note-domain writers | `apps/api/src/lib/audit/note-events.ts` |
| Application-domain writers | `apps/api/src/modules/applications/logs/repository.ts` |
| Standard forensic fields | `apps/api/src/lib/audit/standard-fields.ts`, `context.ts` |
| Presentation lock | `apps/api/src/lib/audit/presentation-surface.ts` + `presentation-baseline.json` |

### 0.6 Standard evidence (recorded on nearly every row — not repeated per event)

`created_at`, `actor_type`, `target_type`, `target_id`, `source`, `correlation_id`, and where the
table has them, `ip_address`, `user_agent`, `device_info`, `portal`. Per-event **STORED EVIDENCE**
sections below list only the *business-specific* columns and metadata keys on top of these.

---

## 1. Event summary index

Compact index of every declared or referenced audit/log event. Legend: **Y** = shown/included ·
**—** = not shown/not included · **n/a** = no such surface for this domain. Detailed entries follow
in §2; notifications in §3–§6; counts, legacy names, and the reconciliation log in §7–§9.

### 1.1 Access (`access_logs`)

| Event Type | Status | Business Action | Actor | Store | Admin | Issuer | Investor | Notification | CSV | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `LOGIN` | LIVE | User signed in | User | access_logs | Y | n/a | n/a | — | Y | Also written on *failed* admin-portal login (`success:false`) |
| `LOGOUT` | LIVE | User signed out | User | access_logs | Y | n/a | n/a | — | Y | |
| `SIGNUP` | LIVE | First OAuth signup | User | access_logs | Y | n/a | n/a | — | Y | Emitted alongside `LOGIN` |
| `ROLE_ADDED` | **UNREACHABLE** | Fallback branch of `updateUserRoles` for any outcome that doesn't strip ADMIN — not literally "a role was added" | Admin | access_logs | Y *(filter + label; no `.tsx` caller reaches the writer)* | n/a | n/a | — | Y | Re-traced 2026-08-25 — see §2.1 detail card and §9 |
| `ROLE_REMOVED` | **UNREACHABLE** | ADMIN role specifically stripped by `updateUserRoles` — not "any role removed" | Admin | access_logs | Y *(filter only; no curated label, no `.tsx` caller)* | n/a | n/a | — | Y | Same writer/route as `ROLE_ADDED`; re-traced 2026-08-25 |
| `PROFILE_UPDATED` | LIVE | Admin edited a user's name/phone from the user detail page | Admin | access_logs | Y | n/a | n/a | — | Y | `useUpdateUserProfile` → `user-account-profile-panel.tsx` / org member-edit dialog |
| `ONBOARDING_RESET` | **UNREACHABLE** | Route-only "temporary feature for testing" (per its own Swagger comment); clears the onboarded flag | Admin | access_logs | Y *(filter only; no curated label, no SDK method, no hook, no UI caller)* | n/a | n/a | — | Y | Mirrored into `onboarding_logs`; re-traced 2026-08-25 |
| `ROLE_SWITCHED` | DEAD | — | — | — | — | n/a | n/a | — | — | Live equivalent lives in `security_logs` |
| `ONBOARDING` | DEAD | — | — | — | — | n/a | n/a | — | — | No writer anywhere |
| `USER_COMPLETED` | ~~DEAD~~ **CODE_REMOVED** *(here)* | — | — | — | — | n/a | n/a | — | — | `DEV_ONLY` writer targets `onboarding_logs`, not this table. **2026-08-25 follow-up pass:** removed from the `EventType` union, the `AccessLog` OpenAPI enum, and the access-log label/color/dropdown maps — zero writers ever emit it into `access_logs`, so no display code was serving a historical-compatibility purpose here (contrast the `onboarding_logs` row below, which stays `DEV_ONLY`). See §9 #14. |
| `KYC_STATUS_UPDATED` | SEED_ONLY | — | — | — | Y *(filter only)* | n/a | n/a | — | — | Offered as an admin filter that always returns zero rows |
| `ONBOARDING_STATUS_UPDATED` | DEAD *(here)* | — | — | — | — | n/a | n/a | — | — | Live equivalent lives in `onboarding_logs` |
| `PASSWORD_CHANGED` | DEAD *(here)* | — | — | — | — | n/a | n/a | — | — | Live equivalent lives in `security_logs` |
| `EMAIL_CHANGED` | DEAD *(here)* | — | — | — | — | n/a | n/a | — | — | Live equivalent lives in `security_logs` |

### 1.2 Security (`security_logs`)

| Event Type | Status | Business Action | Actor | Store | Admin | Issuer | Investor | Notification | CSV | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `ROLE_ADDED` | LIVE | User self-adds a portal role, **or** admin invitation accepted | User / Invitee | security_logs | Y | n/a | n/a | — | Y | Two distinct writers, same event name |
| `ROLE_SWITCHED` | LIVE | Active role switch **and** admin activate/deactivate | User / Subject admin | security_logs | Y | n/a | n/a | — | Y | Overloaded: also carries account status changes |
| `PROFILE_UPDATED` | LIVE | Self-service or admin-override profile edit | User | security_logs | Y | n/a | n/a | — | Y | `adminOverride:true` distinguishes the admin path |
| `PASSWORD_CHANGED` | LIVE | Password change (success *and* failure) | User | security_logs | Y | n/a | n/a | `password_changed` | Y | Only security event with a notification |
| `EMAIL_CHANGED` | LIVE | Email **verification** result | User | security_logs | Y | n/a | n/a | — | Y | Name is broader than the action |
| `ROLE_CREATED` | LIVE | Admin role catalogue create | Admin | security_logs | — | n/a | n/a | — | — | Excluded from the panel query allowlist |
| `ROLE_REMOVED` | LIVE | Admin role catalogue delete | Admin | security_logs | — | n/a | n/a | — | — | Catalogue delete, **not** user-role removal |
| `ROLE_PERMISSIONS_UPDATED` | LIVE | Admin role permission edit | Admin | security_logs | Y | n/a | n/a | — | Y | Added to Security panel filter 2026-08-24 |
| `INVITATION_REVOKED` | LIVE | Admin revokes an invitation | Admin | security_logs | Y | n/a | n/a | — | Y | Added to Security panel filter 2026-08-24 |
| `PLATFORM_FINANCE_SETTINGS_UPDATED` | LIVE | Admin updated platform finance settings | Admin | security_logs | Y | n/a | n/a | — | Y | Append-only `previousValues` / `nextValues`; sensitive keys redacted |

### 1.3 Onboarding (`onboarding_logs`)

| Event Type | Status | Business Action | Actor | Store | Admin | Issuer | Investor | Notification | CSV | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `ONBOARDING_STARTED` | LIVE | Onboarding begun (personal or corporate) | Applicant | onboarding_logs | Y | Y | Y | — | Y | Only 6 onboarding events reach the portals |
| `ONBOARDING_RESUMED` | LIVE | Resume / regenerate expired link | Applicant | onboarding_logs | Y | — | — | — | Y | Admin-only |
| `ONBOARDING_CANCELLED` | LIVE | Admin restarted onboarding | Admin | onboarding_logs | Y | Y | Y | — | Y | |
| `ONBOARDING_RESET` | **UNREACHABLE** | Admin cleared the onboarded flag | Admin | onboarding_logs | — | — | — | — | — | Same `resetOnboarding` writer as the `access_logs` variant (route-only, no SDK/hook/UI caller) — also has a label but is not in the admin org-detail query allowlist |
| `ONBOARDING_STATUS_UPDATED` | LIVE | Generic status transition bucket | Applicant / Admin / System | onboarding_logs | Y | — | — | — | Y | Carries KYC outcomes via `metadata.trigger` |
| `ONBOARDING_REJECTED` | LIVE | RegTank **individual** rejection | System | onboarding_logs | Y | Y | Y | `onboarding_rejected` | Y | |
| `COD_REJECTED` | LIVE | RegTank **corporate (COD)** rejection | System | onboarding_logs | Y | Y | Y | `onboarding_rejected` | Y | Admin org-detail Activity/CSV allowlist gap resolved 2026-08-24 |
| `ONBOARDING_APPROVED` | LIVE | Submission/provider-gate approval | System / Admin | onboarding_logs | Y | Y | Y | — | Y | **Not** the final approval — see `FINAL_APPROVAL_COMPLETED` |
| `FINAL_APPROVAL_COMPLETED` | LIVE | Platform access granted (terminal) | Admin | onboarding_logs | Y | Y | Y | `onboarding_approved` | Y | The real "you're approved" moment |
| `TNC_APPROVED` | LIVE | User accepted Terms & Conditions | Applicant | onboarding_logs | Y | — | — | — | Y | Org-level gate; per-PDF evidence is separate |
| `AML_APPROVED` | **UNREACHABLE** | Would be a manual admin AML approval/override | Admin | onboarding_logs | Y *(filter + label)* | — | — | — | Y | `approveAmlScreening` has zero UI callers — see §9 #11. Live AML progression is automatic: `ONBOARDING_STATUS_UPDATED` + `metadata.amlApproved:true` |
| `SSM_APPROVED` | LIVE | Admin approved SSM/CTOS verification | Admin | onboarding_logs | Y | — | — | — | Y | |
| `SOPHISTICATED_STATUS_UPDATED` | LIVE | Sophisticated-investor status granted/revoked | Admin / System | onboarding_logs | Y | — | — | — | Y | |
| `FORM_FILLED` | LIVE | Form-progress / liveness webhook step | Applicant / System | onboarding_logs | Y | — | — | — | Y | Stores the raw webhook payload |
| `PROFILE_UPDATED` | LIVE | Admin patched the organization profile | Admin | onboarding_logs | Y | — | — | — | Y | |
| `WEBHOOK_RECEIVED` | LIVE | Generic RegTank webhook landed | System | onboarding_logs | — | — | — | — | — | Diagnostic only |
| `WEBHOOK_APPROVED` | LIVE | Webhook status `APPROVED` | System | onboarding_logs | — | — | — | — | — | Diagnostic only |
| `WEBHOOK_REJECTED` | LIVE | Webhook status `REJECTED` | System | onboarding_logs | — | — | — | — | — | Diagnostic only |
| `WEBHOOK_PENDING_APPROVAL` | LIVE | Webhook `WAIT_FOR_APPROVAL` | System | onboarding_logs | — | — | — | — | — | Diagnostic only |
| `WEBHOOK_IN_PROGRESS` | LIVE | Webhook `IN_PROGRESS` | System | onboarding_logs | — | — | — | — | — | Diagnostic only |
| `EOD_APPROVED` | LIVE | Director/shareholder EOD webhook approved | System | onboarding_logs | — | — | — | — | — | Not in any allowlist |
| `EOD_REJECTED` | LIVE | Director/shareholder EOD webhook rejected | System | onboarding_logs | — | — | — | — | — | Not in any allowlist |
| `EOD_WEBHOOK` | LIVE | Director/shareholder EOD webhook (other) | System | onboarding_logs | — | — | — | — | — | Not in any allowlist |
| `TNC_ACCEPTED` | SEED_ONLY | — | — | — | — | — | — | — | — | Live path writes `TNC_APPROVED` |
| `KYC_APPROVED` | SEED_ONLY | — | — | — | — | — | — | — | — | Live path writes `ONBOARDING_STATUS_UPDATED` + `trigger` |
| `KYB_APPROVED` | ~~SEED_ONLY~~ **DEAD, code removed** | — | — | — | — | — | — | — | — | No writer at all, including `seed.ts` — reclassified 2026-08-25 (see §9 #13); label-map/switch-case/union entries removed the same day since no seed row ever existed to preserve (see §9 #14) |
| `USER_COMPLETED` | DEV_ONLY | Dev webhook completion | System | onboarding_logs *(dev DB)* | — | — | — | — | — | `webhook-handler-dev.ts`, `DATABASE_URL_DEV` only |

### 1.4 Application (`application_logs`)

| Event Type | Status | Business Action | Actor | Store | Admin | Issuer | Investor | Notification | CSV | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `APPLICATION_CREATED` | LIVE | Issuer created a draft application | Issuer | application_logs | Y | Y | n/a | — | Y | |
| `APPLICATION_SUBMITTED` | LIVE | Issuer submitted for review | Issuer | application_logs | Y | Y | n/a | `application_submitted_confirmation` | Y | Persistent org-admin confirmation (2026-08-25). Session toast on the submitter's browser is a separate, existing channel — same pattern as resubmit. |
| `APPLICATION_RESUBMITTED` | LIVE | Issuer resubmitted after amendments | Issuer | application_logs | Y | Y | n/a | `application_resubmitted_confirmation` | Y | **Two writer paths** — rich and bare |
| `APPLICATION_REJECTED` | LIVE | Admin rejected the application | Admin | application_logs | Y | Y | n/a | `application_rejected` | Y | Current overall rejection flow does not collect a reason; therefore no reason is expected on this audit row. This is a future product decision, not an audit-evidence defect — see §2.4 |
| `APPLICATION_WITHDRAWN` | LIVE | Issuer withdrew / cascade from contract or last invoice | Issuer | application_logs | Y | Y | n/a | `application_withdrawn_confirmation` | Y | Three writer paths |
| `APPLICATION_COMPLETED` | LIVE | Offer accepted → application terminal-complete | Issuer | application_logs | Y | Y | n/a | `application_completed` | Y | The real terminal success event |
| `APPLICATION_RESET_TO_UNDER_REVIEW` | LIVE | Admin reset status to under review | Admin | application_logs | Y | Y *(detail only)* | n/a | — | Y | Not in the portal activity allowlist |
| `APPLICATION_APPROVED` | DEAD (DB event) / **ACTIVE** (synthetic UI display alias) | — | — | — | Y *(label only)* | Y *(label only)* | n/a | `application_approved` *(dead)* | Y *(label only)* | Label on **all four** surfaces + in the issuer query allowlist; no DB writer, so a real `application_logs` row can never carry this value. But `apps/issuer/src/components/financing/facility-transactions.ts` synthesizes a **display-only** row with `eventType: "APPLICATION_APPROVED"` for approved invoices client-side (not a DB write) — that synthetic alias is live/active and unaffected by the DB event's DEAD status; confirmed 2026-08-25, see §9 #14 |
| `SECTION_REVIEWED_APPROVED` | LIVE | Admin approved a review section | Admin | application_logs | Y | — | n/a | — | Y | Admin-only by design |
| `SECTION_REVIEWED_REJECTED` | LIVE | Admin rejected a review section | Admin | application_logs | Y | Y *(detail only)* | n/a | — | Y | |
| `SECTION_REVIEWED_AMENDMENT_REQUESTED` | LIVE | Admin requested changes on a section | Admin | application_logs | Y | Y *(detail only)* | n/a | — | Y | Notified in batch via `AMENDMENTS_SUBMITTED` |
| `SECTION_REVIEWED_PENDING` | LIVE | Section reset to pending (admin or CTOS re-check) | Admin / System | application_logs | Y | — | n/a | — | Y | System path actor is `"system"` |
| `ITEM_REVIEWED_APPROVED` | LIVE | Admin approved a review item | Admin | application_logs | Y | — | n/a | — | Y | Admin-only by design |
| `ITEM_REVIEWED_REJECTED` | LIVE | Admin rejected a review item | Admin | application_logs | Y | Y *(detail only)* | n/a | — | Y | |
| `ITEM_REVIEWED_AMENDMENT_REQUESTED` | LIVE | Admin requested changes on an item | Admin | application_logs | Y | Y *(detail only)* | n/a | — | Y | |
| `ITEM_REVIEWED_PENDING` | LIVE | Item reset to pending | Admin | application_logs | Y | — | n/a | — | Y | |
| `AMENDMENTS_SUBMITTED` | LIVE | **Admin sent** an amendment batch to the issuer | Admin | application_logs | Y | Y | n/a | `application_amendments_requested` | Y | Name reads backwards — see §8 |

### 1.5 Contract / Facility (`application_logs`)

| Event Type | Status | Business Action | Actor | Store | Admin | Issuer | Investor | Notification | CSV | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `CONTRACT_OFFER_SENT` | LIVE | Admin sent the facility offer | Admin | application_logs | Y | Y | n/a | `contract_offer_sent` | Y | Also writes an `application_review_events` mirror |
| `CONTRACT_OFFER_ACCEPTANCE_SUBMITTED` | LIVE | Issuer submitted acceptance documents | Issuer | application_logs | Y | Y | n/a | — | Y | |
| `CONTRACT_OFFER_ACCEPTANCE_RESUBMITTED` | LIVE | Issuer resubmitted after changes requested | Issuer | application_logs | Y | Y | n/a | — | Y | |
| `CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING` | LIVE | Acceptance docs cleared; signing unlocked | Issuer *(auto)* / Admin | application_logs | Y | — | n/a | — | Y | Two writer paths |
| `CONTRACT_OFFER_ACCEPTED` | LIVE | Facility offer signed / accepted | Issuer | application_logs | Y | Y | n/a | — | Y | Also fired by signing-envelope completion |
| `CONTRACT_OFFER_REJECTED` | **DEAD — HISTORICAL_COMPATIBILITY_ONLY** | — | — | — | Y *(label only)* | Y *(label only)* | n/a | — | Y *(label only)* | **Issuer decline writes `CONTRACT_WITHDRAWN` instead.** Label on all four surfaces + in the issuer query allowlist. Confirmed 2026-08-25: `event_type` is a plain `String`/TEXT column and this value had a real production writer before the live path was renamed to `CONTRACT_WITHDRAWN`, so historical rows may reasonably exist — display maps and the API `getEventTypes()` allowlist are kept precisely so any such row still renders instead of silently vanishing; see §9 #14 |
| `CONTRACT_OFFER_RETRACTED` | LIVE | **CashSouk** pulled the offer back | Admin | application_logs | Y | Y | n/a | `offer_retracted_or_reset` | Y | |
| `CONTRACT_WITHDRAWN` | LIVE | **Issuer declined** the facility offer | Issuer | application_logs | Y | Y | n/a | `application_withdrawn_confirmation` | Y | Name is misleading — see §8 |
| `CONTRACT_OFFER_EXPIRED` | LIVE | Acceptance/signing deadline lapsed | System | application_logs | Y | Y | n/a | `offer_expired` | Y | Entity status becomes `OFFER_EXPIRED` |
| `CONTRACT_SIGNING_DEADLINE_EXTENDED` | LIVE | Admin restamped the signing deadline | Admin | application_logs | Y | Y | n/a | `contract_signing_deadline_extended` | Y | |
| `CONTRACT_FACILITY_OCCUPANCY_UPDATED` | LIVE | Revolving capacity recomputed | Issuer / Admin / System | application_logs | Y | Y *(general activity only)* | n/a | — | Y | In the issuer allowlist with curated copy, but absent from both issuer detail label maps. Stores before/after snapshots |
| `CONTRACT_FACILITY_FEE_WAIVED` | LIVE | Admin waived the remaining facility fee | Admin | application_logs | Y *(fallback)* | — | n/a | — | Y *(fallback)* | No curated label anywhere |
| `CONTRACT_FACILITY_DISABLED` | LIVE | Admin disabled the facility | Admin | application_logs | Y *(fallback)* | — | n/a | `facility_disabled` | Y *(fallback)* | No curated activity label anywhere; notification added 2026-08-25 |
| `CONTRACT_FACILITY_ENABLED` | LIVE | Admin re-enabled the facility | Admin | application_logs | Y *(fallback)* | — | n/a | — | Y *(fallback)* | No curated label anywhere |

### 1.6 Invoice (`application_logs`)

| Event Type | Status | Business Action | Actor | Store | Admin | Issuer | Investor | Notification | CSV | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `INVOICE_OFFER_SENT` | LIVE | Admin sent the invoice offer | Admin | application_logs | Y | Y | n/a | `invoice_offer_sent` | — | Also writes an `application_review_events` mirror |
| `INVOICE_OFFER_ACCEPTANCE_SUBMITTED` | LIVE | Issuer submitted acceptance documents | Issuer | application_logs | Y | Y | n/a | — | — | |
| `INVOICE_OFFER_ACCEPTANCE_RESUBMITTED` | LIVE | Issuer resubmitted after changes requested | Issuer | application_logs | Y | Y | n/a | — | — | |
| `INVOICE_ACCEPTANCE_APPROVED_FOR_SIGNING` | LIVE | Acceptance docs cleared; signing unlocked | Issuer *(auto)* / Admin | application_logs | Y | — | n/a | — | — | |
| `INVOICE_OFFER_ACCEPTED` | LIVE | Invoice offer signed / accepted | Issuer | application_logs | Y | Y | n/a | — | — | |
| `INVOICE_OFFER_REJECTED` | **LIVE** | **Issuer declined** the invoice offer | Issuer | application_logs | Y | Y | n/a | `application_withdrawn_confirmation` | — | Asymmetric with contract — see §8 |
| `INVOICE_OFFER_RETRACTED` | LIVE | **CashSouk** pulled the invoice offer back | Admin | application_logs | Y | Y | n/a | `offer_retracted_or_reset` | — | |
| `INVOICE_OFFER_EXPIRED` | LIVE | Acceptance/signing deadline lapsed | System | application_logs | Y | Y | n/a | `offer_expired` | — | |
| `INVOICE_SIGNING_DEADLINE_EXTENDED` | LIVE | Admin restamped the signing deadline | Admin | application_logs | Y | Y | n/a | `invoice_signing_deadline_extended` | — | |
| `INVOICE_WITHDRAWN` | LIVE | Issuer withdrew an invoice | Issuer | application_logs | Y | Y | n/a | — | — | Last invoice withdrawn cascades to `APPLICATION_WITHDRAWN` |

> **CSV note for the invoice domain:** `contract-activity-csv.ts` has **no invoice entries** in its
> label map. Invoice rows still export (the formatter falls back to title-case), so they appear as
> e.g. `Invoice Offer Sent` rather than a curated label.

### 1.7 Signing (`application_logs`)

| Event Type | Status | Business Action | Actor | Store | Admin | Issuer | Investor | Notification | CSV | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `SIGNING_PACKAGE_CREATED` | LIVE | Issuer created the signing package | Issuer | application_logs | Y | — | n/a | — | Y | |
| `SIGNING_PACKAGE_SENT` | LIVE | Package dispatched to signers | Issuer *(creator)* | application_logs | Y | Y | n/a | Direct email *(not registry)* | Y | Only signing event in the portal allowlist |
| `SIGNING_PACKAGE_COMPLETED` | LIVE | All signers completed the envelope | Issuer *(creator)* | application_logs | **Hidden (intentional)** | Y *(facility detail)* | n/a | — | Y | Explicitly in `TIMELINE_HIDDEN_EVENT_TYPES` |
| `SIGNING_PACKAGE_VOIDED` | LIVE | Signer declined, or manual void | Actor / creator | application_logs | Y | — | n/a | — | Y | Covers both decline and void |

### 1.8 Legal Documents (`legal_document_audit_logs`, `legal_document_acceptances`)

Surface profile: **`ADMIN-FORENSIC`** (all seven events).

| Event Type | Status | Business Action | Actor | Store | Admin | Issuer | Investor | Notification | CSV | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `LEGAL_DOCUMENT_CREATED` | LIVE | Admin created a document definition | Admin | legal_document_audit_logs | Y | n/a | n/a | — | Y | |
| `LEGAL_DOCUMENT_UPDATED` | LIVE | Admin edited a definition | Admin | legal_document_audit_logs | Y | n/a | n/a | — | Y | |
| `LEGAL_VERSION_UPLOADED` | LIVE | Admin uploaded a new draft version | Admin | legal_document_audit_logs | Y | n/a | n/a | — | Y | Stores `document_hash` |
| `LEGAL_VERSION_FILE_REPLACED` | LIVE | Admin replaced a draft PDF in place | Admin | legal_document_audit_logs | Y | n/a | n/a | — | Y | |
| `LEGAL_VERSION_PUBLISHED` | LIVE | Admin published a version | Admin | legal_document_audit_logs | Y | n/a | n/a | — | Y | May auto-archive the prior version |
| `LEGAL_VERSION_ARCHIVED` | LIVE | Version archived (manual or automatic) | Admin | legal_document_audit_logs | Y | n/a | n/a | — | Y | `reason` distinguishes auto paths |
| `LEGAL_VERSION_RESTORED` | LIVE | Admin restored an archived version | Admin | legal_document_audit_logs | Y | n/a | n/a | — | Y | |
| *(acceptance evidence — not an event type)* | LIVE | User opened / accepted a legal document | Issuer / Investor | legal_document_acceptances | Y | n/a | n/a | — | Y | Status column, not `event_type`; see §2.8 |

### 1.9 Notes / Funding (`note_events`)

| Event Type | Status | Business Action | Actor | Store | Admin | Issuer | Investor | Notification | CSV | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `NOTE_CREATED_FROM_INVOICE` | LIVE | Note created from an approved invoice | Admin | note_events | Y | Y | — | — | Y | Admin-action row uses a *different* string |
| `UPDATE_DRAFT` | LIVE | Draft note edited | Admin | note_events | Y | — | — | — | Y | Mirrored to `note_admin_actions` |
| `UPDATE_FEATURED_SETTINGS` | LIVE | Featured flag / rank changed | Admin | note_events | Y | — | — | — | Y | Mirrored |
| `PUBLISH` | LIVE | Note published to the marketplace | Admin | note_events | Y | Y | — | `note_published` | Y | Mirrored |
| `UNPUBLISH` | LIVE | Note withdrawn from the marketplace | Admin | note_events | Y | — | — | — | Y | Mirrored |
| `PAUSE_LISTING` | LIVE | Campaign paused | Admin | note_events | Y | Y | — | — | Y | Mirrored |
| `RESUME_LISTING` | LIVE | Campaign resumed | Admin | note_events | Y | Y | — | — | Y | Mirrored |
| `INVESTMENT_COMMITTED` | LIVE | Investor committed funds | Investor | note_events | Y | — | Y *(own org only)* | — | Y | Post-query org ownership filter |
| `CLOSE_FUNDING` | LIVE | Funding closed successfully | Admin / System | note_events | Y | Y | — | `note_funding_succeeded` | Y | Mirrored |
| `FAIL_FUNDING` | LIVE | Funding failed to reach threshold | Admin / System | note_events | Y | Y | Y | `note_funding_failed_issuer` + `_investor` | Y | Mirrored |
| `ACTIVATE` | LIVE | Note activated; servicing starts | Admin | note_events | Y | Y | Y | `note_active_issuer` + `_investor` | Y | Manual activation only — see §8 |
| `NOTE_FACILITY_FEE_COLLECTION_WAIVED` | LIVE | Admin waived facility-fee collection | Admin | note_events | Y | — | — | — | Y | Writes **two** rows with `WAIVE_FACILITY_FEE_COLLECTION` |
| `WAIVE_FACILITY_FEE_COLLECTION` | LIVE | Same action, admin-action mirror | Admin | note_events + note_admin_actions | Y *(fallback)* | — | — | — | Y *(fallback)* | Companion row to the above |
| `FACILITY_OCCUPANCY_UPDATED` | LIVE | Contract occupancy recomputed for this note | System | note_events | Y | — | — | — | Y | Note-scoped twin of `CONTRACT_FACILITY_OCCUPANCY_UPDATED` |
| `NOTE_DEFAULT_MARKED` | LIVE | Note marked in default | Admin | note_events | Y | Y | Y | `note_defaulted` + `_investor` | Y | |
| ~~`ISSUER_RESIDUAL_WITHDRAWAL_CREATED`~~ | ~~**DEAD**~~ | — | — | — | — | — | — | — | — | **REMOVED (2026-08-25)** — deleted from the sort-priority list that was its only reference; zero occurrences remain anywhere in `apps/api/src`. See §9 #13 |

### 1.10 Prospectus (`note_events`)

Surface profile: **admin-only** — none of these are in `ALL_NOTE_EVENT_TYPES`, so no portal
surface can show them. All are mirrored to `note_admin_actions`.

| Event Type | Status | Business Action | Actor | Store | Admin | Issuer | Investor | Notification | CSV | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `PROSPECTUS_REVIEW_CREATE` | LIVE | Prospectus review record created | Admin | note_events | Y | — | — | — | Y | |
| `PROSPECTUS_REVIEW_DRAFT_UPDATE` | LIVE | Prospectus draft content saved | Admin | note_events | Y | — | — | — | Y | |
| `PROSPECTUS_REVIEW_APPROVE` | LIVE | Prospectus approved | Admin | note_events | Y | — | — | — | Y | |
| `PROSPECTUS_APPROVAL_INVALIDATED_EDIT` | LIVE | Approval cleared by an edit | Admin | note_events | Y | — | — | — | Y | |
| `PROSPECTUS_APPROVAL_INVALIDATED_SOURCE` | LIVE | Approval cleared by a source change | Admin | note_events | Y | — | — | — | Y | |
| `PROSPECTUS_APPROVAL_INVALIDATED_UNPUBLISH` | LIVE | Approval cleared by unpublish | Admin | note_events | Y | — | — | — | Y | |

### 1.11 Repayment / Settlement (`note_events`)

| Event Type | Status | Business Action | Actor | Store | Admin | Issuer | Investor | Notification | CSV | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `ISSUER_PAYMENT_SUBMITTED` | LIVE | Issuer submitted a repayment for review | Issuer | note_events | Y | Y | — | — | Y | Same writer as `PAYMENT_RECEIVED`, portal decides |
| `PAYMENT_RECEIVED` | LIVE | Admin recorded a repayment directly | Admin | note_events | Y | — | Y *(via notification only)* | `note_payment_received` | Y | Not in the investor activity allowlist |
| `PAYMENT_APPROVED` | LIVE | Pending repayment approved | Admin | note_events | Y | — | — | `note_payment_received` | Y | |
| `PAYMENT_REJECTED` | LIVE | Pending repayment rejected | Admin | note_events | Y | — | — | `note_payment_rejected` | Y | Issuer org, all members, platform only |
| `SETTLEMENT_PREVIEWED` | LIVE | Settlement preview saved | Admin | note_events | Y | — | — | — | Y | |
| `SETTLEMENT_APPROVED` | LIVE | Settlement preview approved | Admin | note_events | Y | — | — | — | Y | |
| `SETTLEMENT_POSTED` | LIVE | Settlement posted to the ledger | Admin | note_events | Y | — | Y | `note_settlement_posted` (+ `note_repaid_issuer`) | Y | |
| `OVERDUE_LATE_CHARGE_CHECKED` | LIVE | Overdue / late-fee check executed | Admin | note_events | Y | — | — | `note_arrears` + `_investor` *(when arrears entered)* | Y | The de-facto "arrears" event — see §8 |
| `LATE_CHARGE_APPROVED` | LIVE | Late charge calculated and approved | Admin | note_events | Y | — | — | — | Y | |
| `ARREARS_LETTER_GENERATED` | LIVE | Arrears letter PDF generated | Admin | note_events | Y | — | — | — | Y | |
| `DEFAULT_LETTER_GENERATED` | LIVE | Default letter PDF generated | Admin | note_events | Y | — | — | — | Y | |
| `SETTLEMENT_TRUSTEE_LETTER_GENERATED` | LIVE | Settlement trustee letter generated | Admin | note_events | Y | — | — | — | Y | Canonical ID |
| `SETTLEMENT_TRUSTEE_EMAIL_SENT` | LIVE | Settlement trustee instruction email delivered/redelivered | Admin | note_events | Y | — | — | — (direct SES to trustee) | Y | Distinct from letter submit and from issuer `note_repaid_issuer`. |
| `SETTLEMENT_TRUSTEE_LETTER_SUBMITTED` | LIVE | Settlement trustee letter submitted | Admin | note_events | Y | — | — | — | Y | Canonical ID |
| `SETTLEMENT_TRUSTEE_INSTRUCTION_COMPLETED` | LIVE | Trustee instruction completed | Admin | note_events | Y | — | — | `note_repaid_issuer` | Y | Canonical ID |

### 1.12 Withdrawal / Trustee (`note_events`, `withdrawal_instructions`)

| Event Type | Status | Business Action | Actor | Store | Admin | Issuer | Investor | Notification | CSV | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `ISSUER_DISBURSEMENT_WITHDRAWAL_CREATED` | LIVE | Disbursement instruction auto-created on funding close | Admin / System | note_events | Y | — | — | — | Y | |
| `WITHDRAWAL_LETTER_GENERATED` | LIVE | Trustee withdrawal letter PDF generated | Admin | note_events | Y | — | — | — | Y | |
| `WITHDRAWAL_TRUSTEE_EMAIL_SENT` | LIVE | Withdrawal trustee instruction email delivered/redelivered | Admin | note_events | Y | — | — | — (direct SES to trustee) | Y | Distinct from `WITHDRAWAL_SUBMITTED_TO_TRUSTEE` and issuer platform notify |
| `WITHDRAWAL_SUBMITTED_TO_TRUSTEE` | LIVE | Instruction submitted to the trustee | Admin | note_events | Y | — | — | `withdrawal_submitted_to_trustee` | Y | Wired 2026-08-24 |
| `WITHDRAWAL_BENEFICIARY_UPDATED` | LIVE | Beneficiary details edited on a draft | Admin | note_events | Y | — | — | — | Y | |
| `WITHDRAWAL_COMPLETED` | LIVE | Trustee payout completed | Admin | note_events | Y | Y *(disbursements only)* | Y *(disbursements only)* | `withdrawal_completed` (issuer) + `note_active_investor` (confirmed investors) *(ISSUER_DISBURSEMENT only)* | Y | Issuer disbursement copy unchanged. Investor cash withdrawals (`INVESTOR_WITHDRAWAL`) use `investor_withdrawal_*` types and do not write this event. Residual/admin-adjustment stay silent |
| `SHORAKA_ORDER_SUBMITTED` | LIVE | Tawarruq commodity order submitted to the provider | System | note_events | Y | — | — | — | Y | Stored name is `SHORAKA_*`; UI says "Tawarruq" |
| `SHORAKA_CERTIFICATE_FETCHED` | LIVE | Tawarruq trade certificate retrieved | System | note_events | Y | — | — | — | Y | `actorUserId: null` — no human actor |

### 1.13 Gateway / Payments (`gateway_payment_events`)

Surface profile: **`ADMIN-FORENSIC`**, with ADMIN DETAIL = the gateway payment detail timeline.
No CSV export exists for this table.

| Event Type | Status | Business Action | Actor | Store | Admin | Issuer | Investor | Notification | CSV | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `NAME_CHECK` | LIVE | Auto name-check flagged for review | System | gateway_payment_events | Y | n/a | n/a | — | n/a | |
| `NAME_CHECK_APPROVED` | LIVE | Admin approved the name match | Admin | gateway_payment_events | Y | n/a | n/a | — | n/a | |
| `NAME_CHECK_REJECTED` | LIVE | Admin rejected the name match → refund | Admin | gateway_payment_events | Y | n/a | n/a | `deposit_name_check_rejected` *(INVESTOR_DEPOSIT only)* | n/a | Investor org members of the deposit's `investor_organization_id`; platform only |
| `CAPTURE_MISMATCH` | LIVE | Currency/amount mismatch on capture | System / Admin | gateway_payment_events | Y | n/a | n/a | — | n/a | |
| `EXPIRED` | LIVE | Abandoned checkout expired by cron | System | gateway_payment_events | Y | n/a | n/a | — | n/a | |
| `REFUND_INITIATED` | LIVE | Refund started (manual or automatic) | Admin / System | gateway_payment_events | Y | n/a | n/a | `deposit_refund_initiated` *(INVESTOR_DEPOSIT only)* | n/a | `metadata.auto` distinguishes. Idempotency key is per gateway payment + type + user |
| `REFUNDED` | LIVE | Refund confirmed and wallet reversed | Admin / System | gateway_payment_events | Y | n/a | n/a | `deposit_refunded` *(INVESTOR_DEPOSIT only)* | n/a | Notifies only after the wallet reversal transaction commits |
| `REFUND_WALLET_REVERSAL_FAILED` | LIVE | Wallet debit failed after refund | System / Admin | gateway_payment_events | Y | n/a | n/a | — | n/a | |
| `OVERRIDE_PROPOSED` | **DEAD** | — | — | — | Y *(copy only)* | n/a | n/a | — | n/a | Read path exists; nothing writes it |
| `OVERRIDE_APPROVED` | **DEAD** | — | — | — | Y *(copy only)* | n/a | n/a | — | n/a | |
| `OVERRIDE_REJECTED` | **DEAD** | — | — | — | Y *(copy only)* | n/a | n/a | — | n/a | |

> **Evidence asymmetry (by design or gap — product to confirm):** a *successful* deposit capture
> writes **no** `gateway_payment_events` row. Every exception path does. Success evidence lives in
> `gateway_payments.status` + `investor_balance_transactions` + `note_ledger_entries`.

### 1.14 Products (`product_logs`)

Surface profile: **`ADMIN-FORENSIC`**.

| Event Type | Status | Business Action | Actor | Store | Admin | Issuer | Investor | Notification | CSV | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `PRODUCT_CREATED` | LIVE | Admin created a product | Admin | product_logs | Y | n/a | n/a | — | Y | |
| `PRODUCT_UPDATED` | LIVE | Admin edited a product (in-place or versioned) | Admin | product_logs | Y | n/a | n/a | — | Y | `replaced_product_id` set on the versioned path |
| `PRODUCT_DELETED` | LIVE | Admin soft-deleted a product | Admin | product_logs | Y | n/a | n/a | — | Y | |
| `PRODUCT_INACTIVATED` | **UNREACHABLE** | Would mark a product inactive | Admin | product_logs | Y *(filter + label)* | n/a | n/a | — | Y | `setInactive()` has zero callers |
| `PRODUCT_REACTIVATED` | **UNREACHABLE** | Would restore a product | Admin | product_logs | Y *(filter + label)* | n/a | n/a | — | Y | `restoreProduct()` has zero callers |

---

## 2. Detailed event entries

### 2.1 Access (`access_logs`)

**Domain facts.** Table columns: `user_id`, `event_type`, `ip_address`, `user_agent`, `device_info`,
`cognito_event`, `success`, `metadata`, `device_type`, `portal`, plus the standard forensic set.
Declared union: `EventType` in `packages/types/src/admin.ts`. Central writer:
`createAccessLogRow()` in `apps/api/src/lib/audit/account-logs.ts`.

**Surface profile: `ADMIN-FORENSIC`**, with these domain specifics:
- ADMIN ACTIVITY = Audit → Access Logs (`apps/admin/src/components/audit/access-logs-panel.tsx`).
- The panel's `ACCESS_EVENT_TYPES = ["LOGIN", "LOGOUT", "SIGNUP", "KYC_STATUS_UPDATED"]` is a
  **query filter**, not a label map — anything outside it is never fetched.
- `access-log-table-row.tsx` `EVENT_TYPE_CONFIG` is a **display-only** label map that still carries
  labels for many types the panel can never fetch.
- CSV export (`GET /v1/admin/access-logs/export`) writes the **raw `event_type` string**, not a
  label, and inherits the same event-type filter.

---

**EVENT TYPE:** `LOGIN`
**STATUS:** LIVE
**CANONICAL BUSINESS NAME:** User signed in
**LEGACY / OLD / ALIAS NAMES:** `USER_LOGGED_IN` — *not real*, belongs to an unmerged cutover schema (see §8)
**DO NOT CONFUSE WITH:** `SIGNUP` (first-ever login also writes both); `ROLE_SWITCHED` (changing active role mid-session)
**BUSINESS TRIGGER:** Successful OAuth callback, or the `POST sync-user` endpoint after OAuth. A **failed** admin-portal login also writes `LOGIN` with `success:false`.
**ACTOR:** User (self)
**WRITER:** `auth/cognito.routes.ts` (OAuth callback ~708; failed-admin branch ~650); `auth/service.ts:syncUser` (~105)
**TABLE / STORE:** `access_logs`
**TARGET:** user
**STORED EVIDENCE:** `success`, `cognito_event`, `portal`, `device_type`; metadata `requestedRole`, `activeRole`, `roles`. Failure branch adds `userRoles`, `hasAdminRole`, `adminStatus`, `wasPreviouslyAdmin`, `reason`. Sync-user branch adds `source:"sync-user-endpoint"`.
**SURFACES:** profile `ADMIN-FORENSIC`. ADMIN ACTIVITY: Shown — Copy: `"Login"` (filter) / `"Login"` (table row). CSV / EXPORT: Included — Copy: `"LOGIN"` (raw).
**NOTIFICATION:** NO. *(`login_new_device` exists in the registry but no device-fingerprinting code calls it — see §4.)*

---

**EVENT TYPE:** `LOGOUT`
**STATUS:** LIVE · **CANONICAL BUSINESS NAME:** User signed out
**ALIASES:** `USER_LOGGED_OUT` — *not real* (cutover schema) · **DO NOT CONFUSE WITH:** session expiry (not logged)
**BUSINESS TRIGGER:** Logout route or logout service call. **ACTOR:** User (self)
**WRITER:** `auth/cognito.routes.ts` (~994); `auth/service.ts:logout` (~489) · **TABLE:** `access_logs` · **TARGET:** user
**STORED EVIDENCE:** metadata `roles`, optional `activeRole`
**SURFACES:** profile `ADMIN-FORENSIC`. ADMIN ACTIVITY: Shown — Copy: `"Logout"`. CSV: Included — Copy: `"LOGOUT"` (raw).
**NOTIFICATION:** NO

---

**EVENT TYPE:** `SIGNUP`
**STATUS:** LIVE · **CANONICAL BUSINESS NAME:** First OAuth signup
**ALIASES:** `USER_SIGNED_UP` — *not real* (cutover schema) · **DO NOT CONFUSE WITH:** `ONBOARDING_STARTED` (KYC/KYB onboarding, a completely different table and moment)
**BUSINESS TRIGGER:** OAuth callback with `isSignup`. A `LOGIN` row is written for the same moment. **ACTOR:** User (self)
**WRITER:** `auth/cognito.routes.ts` (~710) · **TABLE:** `access_logs` · **TARGET:** user
**STORED EVIDENCE:** metadata `requestedRole`, `activeRole`, `roles`
**SURFACES:** profile `ADMIN-FORENSIC`. ADMIN ACTIVITY: Shown — Copy: `"Sign Up"`. CSV: Included — Copy: `"SIGNUP"` (raw).
**NOTIFICATION:** NO

---

**EVENT TYPE:** `ROLE_ADDED` *(access_logs variant)*
**STATUS:** **UNREACHABLE** *(re-traced 2026-08-25)* · **CANONICAL BUSINESS NAME:** Fallback branch of an admin role-set edit
**DO NOT CONFUSE WITH:** the `security_logs` `ROLE_ADDED` (user self-adds a portal role — different table, different actor semantics)
**BUSINESS TRIGGER:** `AdminService.updateUserRoles` emits `adminRoleRemoved ? "ROLE_REMOVED" : "ROLE_ADDED"`. `ROLE_ADDED` is **not** literally "a role was added" — it is the fallback for every outcome that doesn't specifically strip the `ADMIN` role, including a call that only removed `INVESTOR`/`ISSUER`. **ACTOR:** Admin (the **admin's** id lands in `user_id`; the subject is in metadata)
**WRITER:** `admin/service.ts:updateUserRoles` (~1222) · **ROUTE:** `PATCH /v1/admin/users/:id/roles` (`requirePermission("users.manage")`) · **TABLE:** `access_logs` · **TARGET:** user
**STORED EVIDENCE:** metadata `targetUserId`, `targetUserEmail`, `newRoles`, `previousRoles`, `adminRoleRemoved`
**REACHABILITY:** SDK method `apiClient.updateUserRoles` and hook `useUpdateUserRoles()` (`apps/admin/src/hooks/use-users.ts`) both exist, but **zero `.tsx` components call the hook** (`rg -n "useUpdateUserRoles" apps/admin/src -g '*.tsx'` → no matches). The only Admin UI path that changes portal roles is the "Portal access" panel, which calls `useUpdateUserOnboarding` (a different service method, `AdminService.updateUserOnboarding`) and writes `onboarding_logs.ONBOARDING_STATUS_UPDATED` instead — it never reaches this writer. **BACKEND/API REACHABLE, CURRENT ADMIN UI UNREACHABLE.**
**SURFACES:** profile `ADMIN-FORENSIC`. ADMIN ACTIVITY: in `ACCESS_EVENT_TYPES` (added 2026-08-24) so a row would be **Shown** with label `"Role Added"` if one ever existed — but no UI action can create one. CSV: **Included** for the same reason.
**NOTIFICATION:** NO

---

**EVENT TYPE:** `ROLE_REMOVED` *(access_logs variant)*
**STATUS:** **UNREACHABLE** *(re-traced 2026-08-25)* · **CANONICAL BUSINESS NAME:** ADMIN role specifically stripped from a user
**DO NOT CONFUSE WITH:** `security_logs` `ROLE_REMOVED`, which is an **admin role-catalogue delete**, not a user losing a role
**BUSINESS TRIGGER:** Same `updateUserRoles` call as `ROLE_ADDED`, but only the branch where `ADMIN` was present before and absent after (`adminRoleRemoved`). It does **not** mean "any role removed" — removing only `INVESTOR`/`ISSUER` emits `ROLE_ADDED` instead (see above). **ACTOR:** Admin
**WRITER:** `admin/service.ts:updateUserRoles` (~1222) · **ROUTE:** `PATCH /v1/admin/users/:id/roles` (`requirePermission("users.manage")`) · **TABLE:** `access_logs` · **TARGET:** user
**STORED EVIDENCE:** identical metadata object to `ROLE_ADDED`
**REACHABILITY:** Same hook/route as `ROLE_ADDED` — `useUpdateUserRoles()` exists, zero `.tsx` callers. **BACKEND/API REACHABLE, CURRENT ADMIN UI UNREACHABLE.**
**SURFACES:** profile `ADMIN-FORENSIC`. ADMIN ACTIVITY: in `ACCESS_EVENT_TYPES` (added 2026-08-24), no curated label in `EVENT_TYPE_CONFIG` (falls back to title-case if a row ever existed). CSV: **Included** for the same reason. Also absent from the declared `EventType` union prior to 2026-08-24.
**NOTIFICATION:** NO

---

**EVENT TYPE:** `PROFILE_UPDATED` *(access_logs variant)*
**STATUS:** LIVE_UI_REACHABLE · **CANONICAL BUSINESS NAME:** Admin edited a user's name/phone
**DO NOT CONFUSE WITH:** `security_logs` `PROFILE_UPDATED` (self-service edit, subject-actored) and `onboarding_logs` `PROFILE_UPDATED` (organization profile, not user profile). **Three different tables use this same string for three different things.**
**BUSINESS TRIGGER:** Admin patches a user's name/phone from the user detail page. **ACTOR:** Admin
**WRITER:** `admin/service.ts:updateUserProfile` (~1379) · **ROUTE:** `PATCH /v1/admin/users/:id/profile` · **TABLE:** `access_logs` · **TARGET:** user
**STORED EVIDENCE:** metadata `targetUserId`, `targetUserEmail`, `updatedFields`, `previousValues`, `nameLockedOverride`
**REACHABILITY:** hook `useUpdateUserProfile()` (`apps/admin/src/hooks/use-users.ts`) is called from `user-account-profile-panel.tsx` (the user detail "Profile" edit form) and from `organization-member-edit-dialog.tsx`. **LIVE_UI_REACHABLE.**
**SURFACES:** profile `ADMIN-FORENSIC`. ADMIN ACTIVITY: in `ACCESS_EVENT_TYPES` (added 2026-08-24) — **Shown** with label `"Profile Updated"`. CSV: **Included**.
**NOTIFICATION:** NO

---

**EVENT TYPE:** `ONBOARDING_RESET` *(access_logs variant)*
**STATUS:** **UNREACHABLE — route-only** *(re-traced 2026-08-25)* · **CANONICAL BUSINESS NAME:** Admin cleared the user's onboarded flag
**DO NOT CONFUSE WITH:** `ONBOARDING_CANCELLED` (admin restarts the RegTank onboarding request) — reset only flips the completion flag
**BUSINESS TRIGGER:** Would be an admin "reset onboarding" action. Writes to **both** `access_logs` and `onboarding_logs`. **ACTOR:** Admin
**WRITER:** `admin/service.ts:resetOnboarding` (~2358) · **ROUTE:** `POST /v1/admin/users/:id/reset-onboarding` (`requirePermission("onboarding.manage")`) · **TABLE:** `access_logs` · **TARGET:** user
**STORED EVIDENCE:** metadata `targetUserId`, `targetUserEmail`, `portal`
**REACHABILITY:** The route's own Swagger doc comment calls it *"admin only, temporary feature for testing"*. There is **no SDK method** wrapping it in `packages/config/src/api-client.ts`, **no hook**, and **no `.tsx` caller** — it is one tier more unreachable than `ROLE_ADDED`/`ROLE_REMOVED`, which at least have SDK+hook plumbing. **ROUTE-ONLY, NOT EVEN SDK-WRAPPED.**
**SURFACES:** profile `ADMIN-FORENSIC`. ADMIN ACTIVITY: in `ACCESS_EVENT_TYPES` (added 2026-08-24), no curated label. CSV: **Included** for the same reason.
**NOTIFICATION:** NO

---

**Dead / non-production values in `access_logs`** — declared in the `EventType` union but never
written to this table. None have any surface presence beyond a stale label or filter entry.

| Value | Status | Why | Live equivalent |
|---|---|---|---|
| `ROLE_SWITCHED` | DEAD here | Only ever written to `security_logs` | `security_logs.ROLE_SWITCHED` |
| `ONBOARDING` | DEAD | No writer anywhere in the repo | `onboarding_logs.ONBOARDING_STARTED` |
| `USER_COMPLETED` | ~~DEAD here~~ **CODE_REMOVED here** | The only writer is `regtank/webhook-handler-dev.ts` (~492) and it targets **`onboarding_logs` on the dev database** (`DATABASE_URL_DEV`) — access_logs-side label/union/OpenAPI-enum entries removed 2026-08-25, see §9 #14 | `FINAL_APPROVAL_COMPLETED` |
| `KYC_STATUS_UPDATED` | SEED_ONLY | Written only by `apps/api/prisma/seed.ts` (~136). **Still offered in the admin access-log filter**, so it is a dropdown option that always returns zero rows | `onboarding_logs.ONBOARDING_STATUS_UPDATED` with `metadata.trigger:"KYC_APPROVED"` |
| `ONBOARDING_STATUS_UPDATED` | DEAD here | Lives in `onboarding_logs` | `onboarding_logs.ONBOARDING_STATUS_UPDATED` |
| `PASSWORD_CHANGED` | DEAD here | Lives in `security_logs` | `security_logs.PASSWORD_CHANGED` |
| `EMAIL_CHANGED` | DEAD here | Lives in `security_logs` | `security_logs.EMAIL_CHANGED` |

---

### 2.2 Security (`security_logs`)

**Domain facts.** Columns: `user_id`, `event_type`, `ip_address`, `user_agent`, `device_info`,
`metadata`, plus the standard forensic set. Declared union: `SecurityEventType` in
`packages/types/src/admin.ts` — it declares **5** values while **9** are written, so four live
events have no declared type and no admin filter entry. Central writer: `createSecurityLogRow()`.

**Surface profile: `ADMIN-FORENSIC`**, with these specifics:
- ADMIN ACTIVITY = Audit → Security Logs (`security-logs-panel.tsx`), whose
  `SECURITY_EVENT_TYPES = ["PASSWORD_CHANGED", "EMAIL_CHANGED", "ROLE_ADDED", "ROLE_SWITCHED", "PROFILE_UPDATED"]`
  is a **query filter**.
- CSV export (`GET /v1/admin/security-logs/export`) writes the **raw `event_type`**.

| Event | Trigger / writer | Actor | Business-specific evidence | Admin | CSV | Notification |
|---|---|---|---|---|---|---|
| `ROLE_ADDED` | `auth/service.ts:addRole` (~155) — user adds own portal role | User | `addedRole`, `allRoles` | Shown — `"Role added"` | Included (raw) | NO |
| `ROLE_ADDED` | `admin/service.ts:acceptAdminInvitation` (~2086) — invitation accepted | Invitee | `addedRole:"ADMIN"`, `roleDescription`, `invitationToken`, `invitationType` | Shown — `"Role added"` | Included (raw) | NO |
| `ROLE_SWITCHED` | `auth/service.ts:switchRole` (~604) — active-role switch | User | `newRole` | Shown — `"Role switched"` | Included (raw) | NO |
| `ROLE_SWITCHED` | `admin/service.ts:updateUserRoles` (~1139/~1177), `updateAdminRole` (~1709), `deactivateAdmin` (~1785), `reactivateAdmin` (~1847) | Subject admin | `action`, `previousStatus`, `newStatus`, `deactivatedBy`/`activatedBy`/`updatedBy`, `roleDescription` | Shown — `"Role switched"` | Included (raw) | NO |
| `PROFILE_UPDATED` | `auth/service.ts:updateProfile` (~863) — self-service | User | `updatedFields`, `previousValues` | Shown — `"Profile updated"` | Included (raw) | NO |
| `PROFILE_UPDATED` | `admin/service.ts:updateUserProfile` (~1405) — admin override of an onboarded name | Subject user | `updatedBy`, `updatedFields`, `previousValues`, `adminOverride:true` | Shown — `"Profile updated"` | Included (raw) | NO |
| `PASSWORD_CHANGED` | `auth/service.ts:changePassword` (~966 success, ~992 failure) | User | success: `reason:"USER_INITIATED"`, `sessionRevoked`; failure: `success:false`, `error` | Shown — `"Password changed"` | Included (raw) | **YES — `password_changed`** |
| `EMAIL_CHANGED` | `auth/service.ts:verifyEmail` (~1133 success, ~1153 failure) | User | success: `email`, `reason:"EMAIL_VERIFIED"`; failure: `reason:"VERIFICATION_FAILED"`, `success:false`, `error` | Shown — `"Email Verified"` | Included (`Email Verified`) | NO |
| `ROLE_PERMISSIONS_UPDATED` | `admin/service.ts:updateAdminRolePermissions` (~472) | Admin | `roleKey`, `previousPermissions`, `nextPermissions`, `previousBadgeColor`, `nextBadgeColor` | **Hidden (not queried)** | **Excluded** | NO |
| `ROLE_CREATED` | `admin/service.ts:createAdminRole` (~515) | Admin | `roleKey`, `roleName`, `badgeColor` | **Hidden (not queried)** | **Excluded** | NO |
| `ROLE_REMOVED` | `admin/service.ts:deleteAdminRole` (~578) — **role catalogue delete** | Admin | `deletedRoleKey`, `deletedRoleName` | **Hidden (not queried)** | **Excluded** | NO |
| `INVITATION_REVOKED` | `admin/service.ts:revokeInvitation` (~2297) | Admin | `invitationId`, `email`, `roleDescription` | **Hidden (not queried)** | **Excluded** | NO |
| `PLATFORM_FINANCE_SETTINGS_UPDATED` | `notes/service.ts:updatePlatformFinanceSettings` | Admin | `settingsKey`, `previousValues`, `nextValues` (redacted) | Shown — `"Platform Finance Settings Updated"` | Included (raw) | NO |

**Key distinctions in this domain:**
- `PASSWORD_CHANGED` is the **only** security event with a user notification, and it is written on
  both success and failure — the notification only fires on the success path.
- `EMAIL_CHANGED` records **email verification**, not an email address change. The name is broader
  than the action.
- `ROLE_REMOVED` here deletes an entry from the admin **role catalogue**. The event of a *user*
  losing a role is `access_logs.ROLE_REMOVED`. Same string, opposite meaning.

---

### 2.3 Onboarding (`onboarding_logs`)

**Domain facts.** Columns include `user_id`, `role`, `event_type`, `portal`, `organization_name`,
`investor_organization_id`, `issuer_organization_id`, `organization_kind`, `actor_user_id`,
`metadata`, plus the standard forensic set. Declared union: `OnboardingEventType` in
`packages/types/src/admin.ts` (16 values) — **10 more are written than are declared**. Central
writer: `createOnboardingLogRow()`.

This is the **only** account-domain table with portal-facing surfaces.

**Surface definitions for this domain:**

```
ADMIN ACTIVITY:            Audit → Onboarding Logs (raw event_type export)
ADMIN DETAIL:              organization-activity-timeline.tsx, gated by the
                           ORGANIZATION_ACTIVITY_EVENT_TYPES query filter in use-organization-logs.ts
ISSUER GENERAL ACTIVITY:   OrganizationLogAdapter, gated by getEventTypes() (6 values)
ISSUER APPLICATION DETAIL: N/A — this domain is organization-scoped, not application-scoped
ISSUER FACILITY DETAIL:    N/A
INVESTOR GENERAL ACTIVITY: Same adapter, same 6 values, filtered on investor_organization_id
INVESTOR DETAIL:           N/A
CSV / EXPORT:              Admin org timeline CSV uses getEventLabel(); the
                           /v1/admin/onboarding-logs/export endpoint uses the raw event_type
```

The portal allowlist is exactly six values:
`ONBOARDING_STARTED`, `ONBOARDING_CANCELLED`, `ONBOARDING_REJECTED`, `COD_REJECTED`,
`FINAL_APPROVAL_COMPLETED`, `ONBOARDING_APPROVED`. **Everything else in this table is invisible to
users**, and that is intentional — the remainder are internal compliance sub-steps.

Issuer and investor see **identical copy**; the only difference is which organization column is
matched (`issuer_organization_id` vs `investor_organization_id`).

---

**EVENT TYPE:** `ONBOARDING_STARTED`
**STATUS:** LIVE · **CANONICAL BUSINESS NAME:** Organization onboarding started
**DO NOT CONFUSE WITH:** `SIGNUP` (account creation, `access_logs`)
**BUSINESS TRIGGER:** A personal or corporate RegTank onboarding request is created. **ACTOR:** Applicant (self)
**WRITER:** `regtank/service.ts:startPersonalOnboarding` (~1335); `startCorporateOnboarding` (~1762) · **TABLE:** `onboarding_logs` · **TARGET:** organization
**STORED EVIDENCE:** metadata `organizationId`, `requestId`, `onboardingType` (`"INDIVIDUAL"` \| `"CORPORATE"`), `previousOrgStatus`
**ADMIN ACTIVITY:** Shown — Copy: raw `"ONBOARDING_STARTED"` in the export; the panel shows the raw string.
**ADMIN DETAIL:** Shown — Copy: `"Onboarding Started"`
**ISSUER GENERAL ACTIVITY:** Shown — Copy: title `"Onboarding Started"`, description `"Your organization onboarding has started and you can continue it at any time."`
**ISSUER APPLICATION DETAIL:** N/A · **ISSUER FACILITY DETAIL:** N/A
**INVESTOR GENERAL ACTIVITY:** Shown — identical copy to issuer
**INVESTOR DETAIL:** N/A
**CSV / EXPORT:** Included — Copy: `"Onboarding Started"` (org-timeline CSV) / `"ONBOARDING_STARTED"` (raw admin export)
**NOTIFICATION:** NO

---

**EVENT TYPE:** `ONBOARDING_CANCELLED`
**STATUS:** LIVE · **CANONICAL BUSINESS NAME:** Admin restarted the onboarding (cancelling the prior request)
**DO NOT CONFUSE WITH:** `ONBOARDING_RESET` (clears the onboarded flag only); `ONBOARDING_REJECTED` (a provider decision, not an admin restart)
**BUSINESS TRIGGER:** Admin uses "restart onboarding"; the previous request is cancelled and a new one issued. **ACTOR:** Admin (subject `user_id` is the applicant; `cancelledBy` names the admin)
**WRITER:** `admin/service.ts:restartOnboarding` (~3839) · **TARGET:** organization
**STORED EVIDENCE:** metadata `cancelledOnboardingId`, `cancelledRequestId`, `newRequestId`, `previousStatus`, `cancelledBy`, `reason:"Restart requested by admin"`, `organizationType`, `organizationId`
**ADMIN ACTIVITY:** Shown · **ADMIN DETAIL:** Shown — Copy: `"Onboarding Restarted"`
**ISSUER GENERAL ACTIVITY:** Shown — title `"Onboarding Restarted"`, description `"Your previous onboarding request was cancelled and a new onboarding request has been started."` *(corrected 2026-08-24 — see `audit-event-catalog.md` §1.4 and `activity-notification-copy-review.md` for the BEFORE/AFTER)*
**ISSUER APPLICATION DETAIL / FACILITY DETAIL:** N/A
**INVESTOR GENERAL ACTIVITY:** Shown — identical copy · **INVESTOR DETAIL:** N/A
**CSV / EXPORT:** Included — `"Onboarding Restarted"`
**NOTIFICATION:** NO

---

**EVENT TYPE:** `ONBOARDING_REJECTED`
**STATUS:** LIVE · **CANONICAL BUSINESS NAME:** Individual onboarding rejected by the provider
**DO NOT CONFUSE WITH:** `COD_REJECTED` — the **corporate** equivalent, a separate event with separate copy and no rejection reason
**BUSINESS TRIGGER:** RegTank returns a rejection on the individual onboarding path. **ACTOR:** System (RegTank webhook)
**WRITER:** `regtank/webhooks/individual-onboarding-handler.ts` (~201 investor, ~254 issuer) · **TARGET:** organization
**STORED EVIDENCE:** metadata `organizationId`, `requestId`, `previousStatus`, `newStatus`, `trigger:"REGTANK_REJECTION"`
**ADMIN ACTIVITY:** Shown (raw) · **ADMIN DETAIL:** Shown — Copy: `"Onboarding Rejected"`, description = `metadata.reason` or the trigger
**ISSUER GENERAL ACTIVITY:** Shown — title `"Onboarding Rejected"`, description `"Your organization onboarding was rejected"` + `": {reason}"` when `metadata.reason` is present, else `"."`
**INVESTOR GENERAL ACTIVITY:** Shown — identical copy
**Other surfaces:** N/A
**CSV / EXPORT:** Included — `"Onboarding Rejected"`
**NOTIFICATION:** YES
- **TYPE ID:** `onboarding_rejected`
- **TITLE:** `"Onboarding Rejected"`
- **MESSAGE:** `"Unfortunately, your {onboardingType} onboarding for {orgName} was rejected."` + `" Reason: {reason}"` when supplied
- **RECIPIENT:** `onboarding.user_id` — the applicant only
- **CHANNEL:** platform + email (seed defaults `enabled_platform:true`, `enabled_email:true`, not user-configurable)
- **TRIGGER RELATION:** SAME MOMENT
- **SOURCE:** `individual-onboarding-handler.ts:235` (investor), `:288` (issuer)

---

**EVENT TYPE:** `COD_REJECTED`
**STATUS:** LIVE · **CANONICAL BUSINESS NAME:** Corporate onboarding (COD) rejected by the provider
**LEGACY / ALIAS NAMES:** NONE. "COD" = Corporate Onboarding Due-diligence in RegTank's vocabulary.
**DO NOT CONFUSE WITH:** `ONBOARDING_REJECTED` (individual path). They fire the **same notification** but are **different events with different copy**.
**BUSINESS TRIGGER:** RegTank COD webhook returns a rejection. **ACTOR:** System
**WRITER:** `regtank/webhooks/cod-handler.ts` (~1547 investor, ~1599 issuer) · **TARGET:** organization
**STORED EVIDENCE:** metadata `organizationId`, `requestId`, `previousStatus`, `newStatus`. **No `reason` field** — an open evidence gap (`audit-product-gap-review.md` §6.1).
**ADMIN ACTIVITY:** Shown (raw export)
**ADMIN DETAIL:** Shown — Copy: `"Onboarding Rejected"` — added to `ONBOARDING_EVENT_TYPES` in `use-organization-logs.ts` 2026-08-24, so the admin org timeline now fetches it.
**ISSUER GENERAL ACTIVITY:** Shown — title `"Onboarding Rejected"`, description `"Your organization onboarding was rejected."` *(added 2026-08-24)*
**INVESTOR GENERAL ACTIVITY:** Shown — identical copy
**Other surfaces:** N/A
**CSV / EXPORT:** Included — the admin org-timeline CSV shares the same query and now includes it, alongside the raw `/onboarding-logs/export` endpoint.
**NOTIFICATION:** YES — `onboarding_rejected`, identical to the individual path. Recipient `onboarding.user_id`, platform + email, SAME MOMENT. **SOURCE:** `cod-handler.ts:1580` (investor), `:1632` (issuer).

---

**EVENT TYPE:** `ONBOARDING_APPROVED`
**STATUS:** LIVE · **CANONICAL BUSINESS NAME:** Onboarding **submission** approved (an intermediate gate)
**DO NOT CONFUSE WITH:** `FINAL_APPROVAL_COMPLETED` — **this is the single most important distinction in the onboarding domain.** `ONBOARDING_APPROVED` means a submission or provider gate cleared; the user does **not** yet have platform access. `FINAL_APPROVAL_COMPLETED` is the terminal "you're in" moment and is the one that notifies.
**BUSINESS TRIGGER:** Two independent paths — (a) RegTank company/personal gate approval, (b) an admin approving the onboarding submission. **ACTOR:** System (a) / Admin (b)
**WRITER:** `regtank/service.ts:extractAndUpdateOrganizationData` (~2684/~2738/~2787); `admin/service.ts:approveOnboardingSubmission` (~4584) · **TARGET:** organization
**STORED EVIDENCE:** metadata `organizationId`, `requestId`, `previousStatus`, `newStatus`, `trigger:"REGTANK_APPROVED"` (provider path); `portalType`, `approvedBy`, `approvedAt`, `regtankRequestId` (admin path)
**ADMIN ACTIVITY:** Shown (raw) · **ADMIN DETAIL:** Shown — Copy: `"Onboarding Approved"`
**ISSUER GENERAL ACTIVITY:** Shown — title `"Onboarding Submission Approved"`, description `"Your onboarding submission was approved. We'll notify you when your onboarding is fully complete."`
**INVESTOR GENERAL ACTIVITY:** Shown — identical copy · **Other surfaces:** N/A
**CSV / EXPORT:** Included — `"Onboarding Approved"`
**NOTIFICATION:** NO — deliberately silent; the user is told at `FINAL_APPROVAL_COMPLETED` instead. The portal description explicitly promises this ("We'll notify you when…").

---

**EVENT TYPE:** `FINAL_APPROVAL_COMPLETED`
**STATUS:** LIVE · **CANONICAL BUSINESS NAME:** Onboarding fully approved; platform access granted
**LEGACY / OLD NAMES:** `USER_COMPLETED` — the superseded predecessor, now `DEV_ONLY` (RELATION: `DEAD_REPLACEMENT`, see §8)
**DO NOT CONFUSE WITH:** `ONBOARDING_APPROVED` (intermediate gate, no notification)
**BUSINESS TRIGGER:** Admin completes final approval, activating the organization on the platform. **ACTOR:** Admin
**WRITER:** `admin/service.ts:completeFinalApproval` (~4149) · **TARGET:** organization
**STORED EVIDENCE:** metadata `organizationId`, `organizationType`, `portalType`, `approvedBy`, `regtankRequestId`, `isCorporateOnboarding`
**ADMIN ACTIVITY:** Shown (raw) · **ADMIN DETAIL:** Shown — Copy: `"Final Approval Completed"`
**ISSUER GENERAL ACTIVITY:** Shown — title `"Onboarding Approved"`, description `"Your organization onboarding was approved and no further action is needed."`
**INVESTOR GENERAL ACTIVITY:** Shown — identical copy · **Other surfaces:** N/A
**CSV / EXPORT:** Included — `"Final Approval Completed"`
**NOTIFICATION:** YES
- **TYPE ID:** `onboarding_approved`
- **TITLE:** `"Onboarding Approved"`
- **MESSAGE:** `"Congratulations! Your {onboardingType} onboarding for {orgName} has been completed successfully. You now have full access to the platform."`
- **RECIPIENT:** `onboarding.user_id` — the applicant only
- **CHANNEL:** platform + email (not user-configurable)
- **TRIGGER RELATION:** SAME MOMENT
- **SOURCE:** `admin/service.ts:4188`

> **Naming trap:** the notification type is called `onboarding_approved` but it is fired by
> `FINAL_APPROVAL_COMPLETED`, **not** by the `ONBOARDING_APPROVED` event. Do not wire new code to
> the event name assuming it matches the notification name.

---

**Remaining onboarding events — admin-only, no portal surface, no notification.** All are
`Hidden (not queried)` on both portals because they are outside the six-value
`OrganizationLogAdapter` allowlist.

| Event | Trigger / writer | Actor | Business-specific evidence | Admin detail copy | In admin query filter |
|---|---|---|---|---|---|
| `ONBOARDING_RESUMED` | `regtank/service.ts` (~720/~812/~1030) — resume or regenerate an expired link | Applicant | `organizationId`, `previousRequestId`, `newRequestId`, `onboardingType`, `trigger` | `"Onboarding Resumed"` | Yes |
| `ONBOARDING_RESET` **(UNREACHABLE)** | `admin/service.ts:resetOnboarding` (~2358), route `POST /v1/admin/users/:id/reset-onboarding` (documented in its own Swagger comment as "temporary feature for testing") — **no SDK method, no hook, no `.tsx` caller**, so this writer can never fire from the current Admin UI | Admin *(designed actor; never actually reached)* | `resetBy`, `previousStatus:true`, `newStatus:false`, `adminAction:true` | `"Onboarding Reset"` | **No** — outside `ONBOARDING_EVENT_TYPES` (org-detail query allowlist), and unreachable from the UI regardless |
| `ONBOARDING_STATUS_UPDATED` | 6+ writers: `admin/service.ts:updateUserOnboarding` (~1307/~1331) and manual refresh (~4738); `individual-onboarding-handler.ts` (~356); `kyc-handler.ts` (~445/~513); `cod-handler.ts` (~720/~802/~1477); `org-aml-milestone.ts` (~160); `regtank/service.ts` (~2857) | Applicant / Admin / System | Always a `trigger` key — e.g. `"KYC_APPROVED"`, `"REGTANK_APPROVED"`, `"ADMIN_MANUAL_ONBOARDING_REFRESH"` — plus `previousStatus`, `newStatus`, and path-specific extras such as `amlApproved:true` | `"Status Updated"`, description `"Triggered by {trigger}"` | Yes |
| `TNC_APPROVED` | `organization/service.ts:acceptTnc` (~835) | Applicant | `organizationId`, `organizationType`, `organizationName`, `role`, `legalDocumentsRequired` | `"T&C Approved"` | Yes |
| `AML_APPROVED` **(UNREACHABLE)** | `admin/service.ts:approveAmlScreening` (~4321), route `POST /v1/admin/onboarding-applications/:id/approve-aml`, SDK method, `useApproveAmlScreening` hook — **no `.tsx` component imports or calls that hook**, so this writer can never fire from the current Admin UI | Admin *(designed actor; never actually reached)* | `organizationId`, `organizationType`, `portalType`, `onboardingRequestId`, `isCorporateOnboarding`, `previousStatus`, `newStatus`, `approvedBy`, `approvedAt` | `"AML Approved"` | Yes *(would be, if ever written)* |
| `SSM_APPROVED` | `admin/service.ts:approveSsmVerification` (~4452) | Admin | `organizationId`, `organizationType`, `portalType`, `approvedBy`, `regtankRequestId`, `adminApprovedAt` | `"SSM Approved"` | Yes |
| `SOPHISTICATED_STATUS_UPDATED` | `admin/service.ts:updateSophisticatedStatus` (~3077); `regtank/service.ts` auto-grant (~2299) | Admin / System | `previousStatus`, `previousReason`, `newStatus`, `newReason`, `updatedBy`, `action` (`"granted"`/`"revoked"`/`"auto_granted"`), `source` | `"Sophisticated Status Updated"`, description `"Granted"`/`"Revoked"` + reason | Yes |
| `FORM_FILLED` | `individual-onboarding-handler.ts` (~154); `regtank/service.ts:handleWebhookUpdate` (~2967/~2973) | Applicant / System | `requestId`, `status`, `substatus`, `payload` (**the full raw webhook body**) or `{section}` | `"Form Submitted"`, description `"Section: {section}"` | Yes |
| `PROFILE_UPDATED` | `admin/organization-admin-profile.ts` (~152) — **organization** profile, not user profile | Admin | `updatedBy`, `updatedFields`, `bankFieldsChanged`, `previousValues` | `"Profile Updated"`, description `"Updated {fields}"` | Yes |
| `WEBHOOK_RECEIVED` / `WEBHOOK_APPROVED` / `WEBHOOK_REJECTED` / `WEBHOOK_PENDING_APPROVAL` / `WEBHOOK_IN_PROGRESS` | `regtank/service.ts:handleWebhookUpdate` (~2957–2975), branching on webhook status | System | `requestId`, `status`, `substatus`, `payload` | *(fallback title-case)* | **No** |
| `EOD_APPROVED` / `EOD_REJECTED` / `EOD_WEBHOOK` | `regtank/webhooks/eod-handler.ts:handle` (~279) — director/shareholder EOD outcome | System | `eodRequestId`, `codRequestId`, `status`, `confidence`, `kycId`, `organizationId`, `onboardingType` | *(fallback title-case)* | **No** |

> **`AML_APPROVED` is a designed manual-override path, not the live AML mechanism — verified
> 2026-08-24.** Full chain of evidence:
> - `POST /v1/admin/onboarding-applications/:id/approve-aml` → `AdminService.approveAmlScreening`
>   → `createOnboardingLogRow({ eventType: "AML_APPROVED" })` — the route, service, SDK client
>   method, and the `useApproveAmlScreening` React hook (`use-onboarding-applications.ts`) **all
>   exist**, but **zero `.tsx` files import or call that hook**. `onboarding-review-dialog.tsx`
>   (the actual admin review UI for the `PENDING_AML` phase) only offers an "Open KYB/AML Review"
>   deep link to RegTank and a generic "Refresh" button — never an "Approve AML" action.
> - **Live AML progression is 100% automatic.** Both the RegTank webhook path
>   (`kyc-handler.ts`, `kyb-handler.ts`) and the admin "Refresh" button
>   (`refreshCorporateAmlStatus` / `refreshOnboardingStatus` in `admin/service.ts`) converge on the
>   same helper, `org-aml-milestone.ts:maybeAdvanceOrgAfterAmlScreeningCleared`, which **re-queries
>   RegTank's live result** (never a manual admin decision) and writes
>   `ONBOARDING_STATUS_UPDATED` with `metadata.amlApproved:true` plus a path-specific `trigger`
>   (`REGTANK_KYC_PERSONAL_AML_CLEARED`, `REGTANK_KYB_MAIN_COMPANY_APPROVED`,
>   `ADMIN_MANUAL_AML_REFRESH`, `ADMIN_MANUAL_ONBOARDING_REFRESH_PERSONAL`,
>   `SELF_SERVICE_AML_REFRESH`, …). This is the **canonical live AML event shape** — treat
>   `AML_APPROVED` as dormant plumbing, not a second active canonical path.
> - **`KYC_APPROVED` is not a standalone production event under any writer.** The RegTank KYC
>   webhook (`kyc-handler.ts`) writes `ONBOARDING_STATUS_UPDATED` with
>   `metadata.trigger:"KYC_APPROVED"` as an **informational** log entry only — it does not itself
>   change `onboarding_status` or `aml_approved`. For personal (`INDIVIDUAL`) onboardings the same
>   handler separately calls `maybeAdvanceOrgAfterAmlScreeningCleared` with
>   `trigger:"REGTANK_KYC_PERSONAL_AML_CLEARED"`, which is the row that actually advances AML. See
>   §9 #11 for the full reclassification record and Q&A.

**Dead / non-production values in `onboarding_logs`:**

| Value | Status | Evidence | Live equivalent |
|---|---|---|---|
| `TNC_ACCEPTED` | SEED_ONLY | Only `apps/api/prisma/seed.ts` (~344). Removed from the admin filter 2026-08-24; label retained in `organization-activity-timeline.tsx` so historical seed rows still render | `TNC_APPROVED` |
| `KYC_APPROVED` | SEED_ONLY | No production writer | `ONBOARDING_STATUS_UPDATED` with `metadata.trigger:"KYC_APPROVED"` |
| `KYB_APPROVED` | ~~SEED_ONLY~~ **DEAD, code removed** (corrected 2026-08-25 — confirmed zero occurrences in `seed.ts` too, unlike `KYC_STATUS_UPDATED`/`TNC_ACCEPTED`/`KYC_APPROVED`; label/switch-case/union entries removed the same day, see §9 #14) | No writer anywhere, not even `seed.ts` | none — corporate approval flows through `ONBOARDING_APPROVED` |
| `USER_COMPLETED` | DEV_ONLY | `regtank/webhook-handler-dev.ts` (~492), reachable only via the `POST /v1/webhooks/regtank/dev` route and writing to the **dev** database | `FINAL_APPROVAL_COMPLETED` |
| `DIRECTOR_KYC_STATUS_UPDATED` | **NOT_AN_ACTUAL_EVENT** | Previously catalogued as "a writer module with zero importers". **The module `director-kyc-outcomes.ts` no longer exists on disk and the string has zero occurrences in the repository.** Corrected 2026-08-24 — see §9 | none |

---

### 2.4 Application / Contract / Invoice / Signing (`application_logs`)

All four domains share one table, one enum, and one set of surfaces, so they are documented
together. Because 45 event types × 8 surfaces would be unreadable as prose, this domain uses a
**surface copy matrix** (§2.4.2) plus a **writer & evidence table** (§2.4.3), followed by detail
blocks for the events with genuinely confusing semantics (§2.4.4). Every surface is still covered
for every event.

#### 2.4.1 Domain facts and surface definitions

**Enum:** `ApplicationLogEventType` in `apps/api/src/modules/applications/logs/types.ts` — **45
declared values**. `level`, `target`, and `action` columns are `@deprecated`; **`event_type` is the
single source of truth**.

**Table columns:** `user_id`, `application_id`, `event_type`, `review_cycle`, `entity_id`,
**`remark`**, `portal` (`ISSUER` \| `ADMIN`), `metadata`, plus the standard forensic set.
`application_logs` is the **only** audit table in the system with a first-class `remark` column.

**Writer:** `logApplicationActivity` → `createApplicationLog` in
`apps/api/src/modules/applications/logs/repository.ts`.

**Secondary table:** `application_review_events` is a forensic mirror written in-transaction for
exactly three moments — `CONTRACT_OFFER_SENT`, `INVOICE_OFFER_SENT`, `AMENDMENTS_SUBMITTED`. It has
**no production reader**; nothing in the product queries it.

```
ADMIN ACTIVITY:            N/A — there is no global application-audit page. Application events are
                           only ever viewed per-application.
ADMIN DETAIL:              admin-activity-timeline.tsx. getEventLabel() is DISPLAY-ONLY with a
                           title-case fallback, so every event renders. Visibility is controlled
                           separately by TIMELINE_HIDDEN_EVENT_TYPES, which currently holds exactly
                           one value: SIGNING_PACKAGE_COMPLETED.
ISSUER GENERAL ACTIVITY:   ApplicationLogAdapter. getEventTypes() is a QUERY ALLOWLIST of 28 values;
                           anything outside it is never fetched. buildPresentation() supplies
                           title + description, buildDescription() adds dynamic per-event detail.
ISSUER APPLICATION DETAIL: application-timeline.ts. ISSUER_VISIBLE_EVENTS is derived as
                           new Set(Object.keys(EVENT_LABELS)) — so the label map IS the
                           VISIBILITY FILTER. Adding a label here makes an event visible.
ISSUER FACILITY DETAIL:    facility-transactions.ts. Rows are filtered by
                           .filter(log => Boolean(LOG_LABELS[log.event_type])) — again the label
                           map IS the VISIBILITY FILTER.
INVESTOR GENERAL ACTIVITY: N/A. ApplicationLogAdapter.getScopedApplicationIds() returns
                           ["__none__"] when portalType === "investor", so the query can never
                           match. This is a hard structural exclusion, not a missing label.
INVESTOR DETAIL:           N/A — apps/investor has no application/contract/invoice surface at all.
CSV / EXPORT:              contract-activity-csv.ts (formatContractActivityEventLabel) with a
                           title-case fallback, so every event exports. The admin timeline's own
                           CSV export uses the same admin labels and DOES include
                           SIGNING_PACKAGE_COMPLETED even though the UI hides it.
```

> **The single most important safety rule in this domain:** on the issuer application-detail and
> facility-detail surfaces, **the label map is the visibility filter**. Adding an entry to
> `EVENT_LABELS` or `LOG_LABELS` does not just rename something — it exposes a previously hidden
> event to issuers.

#### 2.4.2 Surface copy matrix

Verbatim copy per surface. `—` means not shown on that surface. `(fallback)` means the surface
renders it through its generic title-case fallback rather than a curated label.

| Event Type | Admin detail | Issuer general activity (title / description) | Issuer application detail | Issuer facility detail | CSV |
|---|---|---|---|---|---|
| `APPLICATION_CREATED` | `Application Created` | `Application Started` / `You created a financing application and can continue it before submitting.` | `You Started This Application` | `Facility Application Started` | `Application Created` |
| `APPLICATION_SUBMITTED` | `Application Submitted` | `Application Submitted` / `Your financing application was submitted and is now under review.` | `You Submitted This Application` | `Facility Application Submitted` | `Application Submitted` |
| `APPLICATION_RESUBMITTED` | `Application Resubmitted` | `Application Resubmitted` / `You resubmitted your application after making the requested updates.` (or `…after updating the requested information.` when `resubmit_changes.activity_summary` is present) | `You Resubmitted This Application` | `Facility Application Resubmitted` | `Application Resubmitted` |
| `APPLICATION_APPROVED` *(dead)* | `Application Approved` (fallback) | `Application Approved` / `Your financing application was approved and no further action is needed.` | `Application approved` | `Facility application approved` | `Application approved` |
| `APPLICATION_REJECTED` | `Application Rejected` | `Application Rejected` / `Your financing application was rejected and will not continue.` | `Your Application Was Not Approved` | `Facility Application Was Not Approved` | `Application Rejected` |
| `APPLICATION_WITHDRAWN` | `Application Withdrawn` | `Application Withdrawn` / `Your financing application was withdrawn and is no longer active.` | `You Withdrew This Application` | `Facility Application Withdrawn` | `Application Withdrawn` |
| `APPLICATION_COMPLETED` | `Application Completed` | `Application Completed` / `Your financing application completed successfully.` | `Application Completed` | `Facility Application Completed` | `Application Completed` |
| `APPLICATION_RESET_TO_UNDER_REVIEW` | `Application Returned to Review` | — *(not in allowlist)* | `Your Application Is Under Review Again` | — | `Application Returned to Review` |
| `SECTION_REVIEWED_APPROVED` | `{Section} Section Approved` | — | — | — | `Section approved` |
| `SECTION_REVIEWED_REJECTED` | `{Section} Section Rejected` | — | `A Section Was Not Approved` | — | `Section Rejected` |
| `SECTION_REVIEWED_AMENDMENT_REQUESTED` | `{Section} Section Amendment Requested` | — | `Changes Requested on a Section` | — | `Section Amendment Requested` |
| `SECTION_REVIEWED_PENDING` | `{Section} Section Reset to Pending` | — | — | — | `Section reset to pending` |
| `ITEM_REVIEWED_APPROVED` | `{Item} Approved` | — | — | — | `Item approved` |
| `ITEM_REVIEWED_REJECTED` | `{Item} Rejected` | — | `An Item Was Not Approved` | — | `Item Rejected` |
| `ITEM_REVIEWED_AMENDMENT_REQUESTED` | `{Item} Amendment Requested` | — | `Changes Requested on an Item` | — | `Item Amendment Requested` |
| `ITEM_REVIEWED_PENDING` | `{Item} Reset to Pending` | — | — | — | `Item reset to pending` |
| `CONTRACT_OFFER_SENT` | `Facility Offer Sent` | `You Received a Facility Offer` / `You received a facility offer for application [Application Ref]. Review and respond.` | `You Received a Facility Offer` | `You Received a Facility Offer` | `Facility Offer Sent` |
| `CONTRACT_OFFER_ACCEPTANCE_SUBMITTED` | `Facility Offer Acceptance Submitted` | `You Submitted Your Facility Offer Acceptance` / `You submitted offer acceptance documents for CashSouk review.` | `You Submitted Your Facility Offer Acceptance` | `You Submitted Your Facility Offer Acceptance` | `Facility Offer Acceptance Submitted` |
| `CONTRACT_OFFER_ACCEPTANCE_RESUBMITTED` | `Facility Offer Acceptance Resubmitted` | `You Resubmitted Your Facility Offer Acceptance` / `You resubmitted offer acceptance documents after CashSouk requested changes.` | `You Resubmitted Your Facility Offer Acceptance` | `You Resubmitted Your Facility Offer Acceptance` | `Facility Offer Acceptance Resubmitted` |
| `CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING` | `Facility Acceptance Approved for Signing` | — | — | — | `Facility acceptance approved for signing` |
| `CONTRACT_OFFER_ACCEPTED` | `Facility Offer Signed` | `Facility Offer Signed` / `All signers completed the facility offer signing package.` | `Facility Offer Signed` | `Facility Offer Signed` | `Facility Offer Signed` |
| `CONTRACT_OFFER_REJECTED` *(dead)* | `Facility Offer Withdrawn` | `Facility Offer Declined` / `The facility offer was declined and this application is now closed.` | `You declined the facility offer` | `Facility offer declined` | `Facility offer withdrawn` |
| `CONTRACT_OFFER_RETRACTED` | `Facility Offer Retracted` | `CashSouk Retracted the Facility Offer` / `CashSouk retracted the facility offer on your application before it was accepted.` | `CashSouk Retracted the Facility Offer` | `CashSouk Retracted the Facility Offer` | `Facility Offer Retracted` |
| `CONTRACT_FACILITY_OCCUPANCY_UPDATED` | `Facility Occupancy Updated` | `Facility occupancy updated` / `Live facility occupancy changed after a draw, funding close, or repayment.` *(in allowlist)* | — | — | `Facility occupancy updated` |
| `CONTRACT_OFFER_EXPIRED` | `Facility Offer Expired` | `Facility Offer Expired` / `The facility offer expired. A new offer can be sent from the Facility tab.` | `Facility offer expired` | `Facility offer expired` | `Facility offer expired` |
| `CONTRACT_SIGNING_DEADLINE_EXTENDED` | `Signing Deadline Extended` | `Signing Deadline Extended` / `CashSouk extended the signing deadline so you can complete the signing package.` | `Signing deadline extended` | `Signing deadline extended` | `Signing deadline extended` |
| `CONTRACT_WITHDRAWN` | `Facility Offer Declined` | `Facility Offer Declined` / `The facility offer was declined and this application is now closed.` | `You Declined the Facility Offer` | `Facility Offer Declined` | `Facility Offer Declined` |
| `CONTRACT_FACILITY_FEE_WAIVED` | `Facility Fee Waived` | — | — | — | `Facility Fee Waived` |
| `CONTRACT_FACILITY_DISABLED` | `Facility Disabled` | — | — | — | `Facility Disabled` |
| `CONTRACT_FACILITY_ENABLED` | `Facility Enabled` | — | — | — | `Facility Enabled` |
| `INVOICE_OFFER_SENT` | `Invoice {n} Offer Sent` / `Invoice Offer Sent` | `You Received an Invoice Offer` / `You received an invoice offer for invoice [Invoice Number]. Review and respond.` | `You Received an Invoice Offer` | `You Received an Invoice Offer` | `Invoice Offer Sent` (fallback) |
| `INVOICE_OFFER_ACCEPTANCE_SUBMITTED` | `Invoice {n} Acceptance Submitted` / `Invoice Offer Acceptance Submitted` | `You Submitted Your Invoice Offer Acceptance` / `You submitted offer acceptance documents for CashSouk review.` | `You Submitted Your Invoice Offer Acceptance` | `You Submitted Your Invoice Offer Acceptance` | *(fallback)* |
| `INVOICE_OFFER_ACCEPTANCE_RESUBMITTED` | `Invoice Offer Acceptance Resubmitted` | `You Resubmitted Your Invoice Offer Acceptance` / `You resubmitted offer acceptance documents after CashSouk requested changes.` | `You Resubmitted Your Invoice Offer Acceptance` | `You Resubmitted Your Invoice Offer Acceptance` | *(fallback)* |
| `INVOICE_ACCEPTANCE_APPROVED_FOR_SIGNING` | `Invoice Acceptance Approved for Signing` | — | — | — | *(fallback)* |
| `INVOICE_OFFER_ACCEPTED` | `Invoice {n} Offer Signed` / `Invoice Offer Signed` | `Invoice Offer Signed` / `All signers completed the invoice offer signing package.` | `Invoice Offer Signed` | `Invoice Offer Signed` | `Invoice Offer Signed` |
| `INVOICE_OFFER_REJECTED` | `Invoice Offer Declined` | `Invoice Offer Declined` / `The invoice offer was declined and this application has stopped moving forward.` | `You Declined the Invoice Offer` | `Invoice Offer Declined` | `Invoice Offer Declined` |
| `INVOICE_OFFER_RETRACTED` | `Invoice Offer Retracted` | `CashSouk Retracted the Invoice Offer` / `CashSouk retracted the invoice offer for invoice [Invoice Number] before it was accepted.` | `CashSouk Retracted the Invoice Offer` | `CashSouk Retracted the Invoice Offer` | *(fallback)* |
| `INVOICE_OFFER_EXPIRED` | `Invoice {n} Offer Expired` / `Invoice Offer Expired` | `Invoice Offer Expired` / `The invoice offer expired. A new offer can be sent from the Invoice tab.` | `Invoice offer expired` | `Invoice offer expired` | *(fallback)* |
| `INVOICE_SIGNING_DEADLINE_EXTENDED` | `Signing Deadline Extended` | `Signing Deadline Extended` / `CashSouk extended the signing deadline so you can complete the signing package.` | `Signing deadline extended` | `Signing deadline extended` | *(fallback)* |
| `INVOICE_WITHDRAWN` | `Invoice {n} Withdrawn` / `Invoice Withdrawn` | `Invoice Withdrawn` / `An invoice linked to this application was withdrawn.` | `Invoice withdrawn` | `Invoice withdrawn` | *(fallback)* |
| `AMENDMENTS_SUBMITTED` | `Amendment Requested` | `CashSouk Requested an Amendment` / `CashSouk requested an amendment to application [Application Ref].` | `CashSouk Requested an Amendment` | `CashSouk Requested an Amendment` | `Amendment Requested` |
| `SIGNING_PACKAGE_CREATED` | `Signing Package Created` | — | — | — | `Signing Package Created` |
| `SIGNING_PACKAGE_SENT` | `Signing package sent` | `Signing package sent` / `The signing package was sent to all required signers.` | — | `Signing package sent` | `Signing package sent` |
| `SIGNING_PACKAGE_COMPLETED` | **Hidden (intentional)** — `TIMELINE_HIDDEN_EVENT_TYPES` | — *(not in allowlist)* | — | `Signing package completed` | `Signing package completed` |
| `SIGNING_PACKAGE_VOIDED` | `Signing package voided` | — | — | — | `Signing package voided` |

**Investor surfaces are `N/A` for every row above.** There is no investor-facing application,
contract, invoice, or signing surface anywhere in the product.

**Pseudo-event:** `OFFER_EXPIRED` appears in both issuer label maps with the copy
`"An offer expired"`, but it is **not a value of `ApplicationLogEventType`** and no writer produces
it. It is a leftover from when the *entity status* string was used as a timeline key. Harmless, but
do not treat it as an event — see §8.

#### 2.4.3 Writer, trigger, actor, and evidence

Standard evidence on every row: `application_id`, `review_cycle`, `portal`, IP / user-agent /
device, plus the forensic set. Only business-specific evidence is listed.

| Event Type | Status | Trigger | Actor | Writer | Business-specific evidence |
|---|---|---|---|---|---|
| `APPLICATION_CREATED` | LIVE | Issuer `POST /v1/applications` | Issuer | `applications/controller.ts:createApplication` (~51) | `review_cycle: 1` |
| `APPLICATION_SUBMITTED` | LIVE | Issuer `PATCH …/status` → `SUBMITTED` | Issuer | `applications/controller.ts:updateApplicationStatus` (~297) | none beyond standard |
| `APPLICATION_RESUBMITTED` | LIVE | **Path A (rich):** issuer resubmits after amendments · **Path B (bare):** `PATCH …/status` → `RESUBMITTED` | Issuer | A: `amendments/service.ts:resubmitApplication` (~299) · B: `applications/controller.ts` (~297) | A: `amendment_remarks[]`, `resubmit_changes{section_keys, section_labels, contract_updated, invoices_updated, activity_summary, field_changes}` · B: **none** — falls back to `"Application resubmitted for review"` |
| `APPLICATION_APPROVED` | **DEAD** | — | — | none | — |
| `APPLICATION_REJECTED` | LIVE | Admin sets status `REJECTED` | Admin | `admin/service.ts:updateApplicationStatus` (~6655) | No `remark`. **Current overall rejection flow does not collect a reason; therefore no reason is expected on this audit row. This is a future product decision, not an audit-evidence defect** (re-traced 2026-08-25 — the confirm dialog, request schema, and service signature are all reason-free end to end; contrast `SECTION_REVIEWED_*`/`ITEM_REVIEWED_*` below, which require and store `remark`) |
| `APPLICATION_WITHDRAWN` | LIVE | Three paths: issuer cancels; issuer declines the facility; last invoice withdrawn | Issuer | `applications/service.ts:cancelApplication` (~1667) · `contracts/service.ts:withdrawContract` (~455) · `invoices/service.ts:withdrawInvoice` (~761) | `withdraw_reason` (e.g. `USER_CANCELLED`) |
| `APPLICATION_COMPLETED` | LIVE | Contract or invoice offer accepted, completing the application | Issuer | `applications/service.ts:respondToContractOffer` (~2881) / `respondToInvoiceOffer` (~3272) | `portal: ISSUER` only |
| `APPLICATION_RESET_TO_UNDER_REVIEW` | LIVE | Admin sets status back to `UNDER_REVIEW` | Admin | `admin/service.ts:updateApplicationStatus` (~6644) | `previous_status` |
| `SECTION_REVIEWED_*` / `ITEM_REVIEWED_*` | LIVE | Admin approves / rejects / requests amendment / resets a section or item. Event name is built dynamically as `SECTION_REVIEWED_${newStatus}` | Admin | `admin/service.ts:logReviewActivity` (~7836) | `old_status`, `new_status`, `scope`, `scope_key`; **`remark` on the top-level column**; `entity_id` = scope key for items |
| `SECTION_REVIEWED_PENDING` *(system path)* | LIVE | A CTOS update leaves AML pending, resetting the financial section | System (`userId:"system"`) | `ctos-report-service.ts:resetFinancialReviewAfterCtosUpdateIfNeeded` (~117) | `scope:"section"`, `scope_key:"financial"`, `old_status:"APPROVED"`, `new_status:"PENDING"`, remark `"Reset due to CTOS update / AML pending"` |
| `CONTRACT_OFFER_SENT` | LIVE | Admin sends the facility offer | Admin | `admin/service.ts:sendContractOffer` (~8218) **+ `application_review_events` mirror** (~8181) | `contract_id`, `contract_number`, `requested_facility`, `offered_facility`, `version`, `acceptance_expires_at?` |
| `CONTRACT_OFFER_ACCEPTANCE_SUBMITTED` | LIVE | Issuer submits acceptance documents (first time) | Issuer | `applications/service.ts:submitContractOfferAcceptance` (~2355) | `contract_id`, `contract_number?`, `offer_acceptance_status`, `submitted_at`, `offered_facility?`, `requested_facility?` |
| `CONTRACT_OFFER_ACCEPTANCE_RESUBMITTED` | LIVE | Issuer resubmits after `CHANGES_REQUESTED` | Issuer | same writer (~2360) | as above + `resubmitted_from:"CHANGES_REQUESTED"` |
| `CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING` | LIVE | Two paths: auto-approval on submit, or admin review clearing the documents | Issuer *(auto)* / Admin | `applications/service.ts` (~2381) · `admin/service.ts:syncOfferAcceptancePhaseFromReview` (~7659) | `contract_id`, `contract_number?`, `auto_approved: true` on the auto path |
| `CONTRACT_OFFER_ACCEPTED` | LIVE | Issuer accepts the offer, **or** the signing envelope completes and finalises it | Issuer | `applications/service.ts:respondToContractOffer` (~2839), also reached via `finalizeOfferAfterEnvelopeCompletion` | `contract_id`, `contract_number`, `offered_facility`, `requested_facility`, `responded_at` |
| `CONTRACT_OFFER_REJECTED` | **DEAD** | — | — | none — issuer decline writes `CONTRACT_WITHDRAWN` | — |
| `CONTRACT_OFFER_RETRACTED` | LIVE | Admin resets the `contract_details` section away from `OFFER_SENT` | Admin | `admin/service.ts:resetSectionReviewToPending` (~9239) | `contract_id`, `contract_number` |
| `CONTRACT_WITHDRAWN` | LIVE | **Issuer declines the facility offer** | Issuer | `applications/service.ts:respondToContractOffer` (~2839), `action !== "accept"` branch | same as accept + `rejection_reason?` |
| `CONTRACT_OFFER_EXPIRED` | LIVE | System expiry sweep after the acceptance or signing deadline | System | `lib/jobs/acceptance-signing-expiry.ts:expireOffer` (~476) | `trigger:"{clock}_deadline_expired"`, `offer_kind:"contract"`, `contract_id`; `actor_type: SYSTEM`, `source: SYSTEM_JOB`, actor `SYS`, correlation `cron:acceptance-signing-expiry` |
| `CONTRACT_SIGNING_DEADLINE_EXTENDED` | LIVE | Admin restamps `signing_expires_at` | Admin | `admin/service.ts:extendContractSigningDeadline` (~8371) | `contract_id`, `signing_expires_at` |
| `CONTRACT_FACILITY_OCCUPANCY_UPDATED` | LIVE | Revolving capacity recomputed after a draw, funding close, or repayment | Issuer / Admin / System | `refresh-contract-facility.ts:recordFacilityOccupancyAudit` (~580) | `reason`, `contract_id`, `note_id`, `invoice_id`, **`before{…}` / `after{…}` snapshots**; `remark` from `occupancyRemark()`; `source: INTERNAL` |
| `CONTRACT_FACILITY_FEE_WAIVED` | LIVE | Admin waives the remaining facility fee | Admin | `admin/service.ts:waiveContractFacilityFee` (~5968) | `contract_id`, `waived_amount`, `paid_amount`, `total_owed`, `reason` |
| `CONTRACT_FACILITY_DISABLED` / `CONTRACT_FACILITY_ENABLED` | LIVE | Admin toggles the facility | Admin | `admin/service.ts:setContractFacilityEnabled` (~6064) | `contract_id`, `enabled`, `reason` *(disable path)* |
| `INVOICE_OFFER_SENT` | LIVE | Admin sends the invoice offer | Admin | `admin/service.ts:sendInvoiceOffer` (~8725) **+ `application_review_events` mirror** (~8668) | `invoice_id`, `invoice_number`, amounts, ratios, fees, `version`, `acceptance_expires_at?` |
| `INVOICE_OFFER_ACCEPTANCE_SUBMITTED` / `_RESUBMITTED` | LIVE | Issuer submits / resubmits acceptance documents | Issuer | `applications/service.ts:submitInvoiceOfferAcceptance` (~2515) | `invoice_id`, `invoice_number?`, `offer_acceptance_status`, `submitted_at`, amounts; `resubmitted_from` on resubmit |
| `INVOICE_ACCEPTANCE_APPROVED_FOR_SIGNING` | LIVE | Auto-approval on submit, or admin review | Issuer / Admin | `applications/service.ts` (~2539) · `admin/service.ts` (~7696) | `invoice_id`, `invoice_number?`, `auto_approved?` |
| `INVOICE_OFFER_ACCEPTED` | LIVE | Issuer accepts, or signing completes | Issuer | `applications/service.ts:respondToInvoiceOffer` (~3238) | `invoice_id`, `invoice_number`, amounts, `responded_at` |
| `INVOICE_OFFER_REJECTED` | LIVE | **Issuer declines the invoice offer** | Issuer | same writer, `action !== "accept"` branch | as above + `rejection_reason?` |
| `INVOICE_OFFER_RETRACTED` | LIVE | Admin resets the invoice item away from `OFFER_SENT` | Admin | `admin/service.ts:resetItemReviewToPending` (~9399) | `invoice_id`, `invoice_number` |
| `INVOICE_OFFER_EXPIRED` | LIVE | System expiry sweep | System | `acceptance-signing-expiry.ts:expireOffer` (~476) | `trigger`, `offer_kind:"invoice"`, `invoice_id`; `actor_type: SYSTEM`, `source: SYSTEM_JOB`, actor `SYS` |
| `INVOICE_SIGNING_DEADLINE_EXTENDED` | LIVE | Admin restamps the invoice signing deadline | Admin | `admin/service.ts:extendInvoiceSigningDeadline` (~8901) | `invoice_id`, `signing_expires_at` |
| `INVOICE_WITHDRAWN` | LIVE | Issuer withdraws an invoice | Issuer | `invoices/service.ts:withdrawInvoice` (~724) | `invoice_id`, `withdraw_reason`, `invoice_number?` |
| `AMENDMENTS_SUBMITTED` | LIVE | **Admin submits a batch of amendment requests to the issuer** | Admin | `admin/service.ts:submitPendingAmendments` (~10639) **+ `application_review_events` mirror** (~10625) | `count`; remark `"{n} amendment(s) sent to issuer"` |
| `SIGNING_PACKAGE_CREATED` | LIVE | Issuer creates the signing package | Issuer | `signing/service.ts:createIssuerEnvelope` → `logSigningPackageActivity` (~866) | `envelope_id`, `contract_id?`, `invoice_id?`, `envelope_title?` |
| `SIGNING_PACKAGE_SENT` | LIVE | Package dispatched; signature-request emails go out | Issuer *(envelope creator)* | `signing/service.ts:sendEnvelope` (~1290) | same base metadata |
| `SIGNING_PACKAGE_COMPLETED` | LIVE | Envelope rollup reaches COMPLETED | Issuer *(creator)* | `signing/service.ts:rollupEnvelope` (~1932) | same base metadata. **Also triggers `finalizeOfferAfterEnvelopeCompletion`**, which writes `CONTRACT_OFFER_ACCEPTED` / `INVOICE_OFFER_ACCEPTED` |
| `SIGNING_PACKAGE_VOIDED` | LIVE | A signer declines, or an admin voids the envelope | Actor / creator | `signing/service.ts:rollupEnvelope` on DECLINED (~1942); `voidEnvelope` (~2005) | + `void_reason` (`"declined"` or a custom reason) |

#### 2.4.4 Events that are easy to get wrong

**`CONTRACT_WITHDRAWN` — the biggest naming trap in the codebase.**
Despite the name, this is **the issuer declining a facility offer**. It has nothing to do with
withdrawing an application or a facility. It is written by `respondToContractOffer` on the
non-accept branch. The correctly-named `CONTRACT_OFFER_REJECTED` exists in the enum but is
**dead** — nothing writes it.

The consequence is that the two admin surfaces label the pair in a way that reads backwards
relative to the enum names:

| Enum value | Reality | Admin detail label | CSV label |
|---|---|---|---|
| `CONTRACT_WITHDRAWN` | Issuer declined the offer | `Facility Offer Declined` | `Facility Offer Declined` |
| `CONTRACT_OFFER_REJECTED` *(dead)* | never fires | `Facility Offer Withdrawn` | `Facility offer withdrawn` |

The **labels are semantically correct** for what actually happens; it is the **enum names** that are
misleading. Do not "fix" the labels to match the enum names — that would make the admin surface
wrong. Issuer-facing copy is unambiguous on every surface (`You declined the facility offer` /
`Facility offer declined`).

**Contract vs invoice decline are asymmetric.** An issuer declining an *invoice* offer writes the
sensibly-named `INVOICE_OFFER_REJECTED`. An issuer declining a *facility* offer writes
`CONTRACT_WITHDRAWN`. Same business action, two different naming conventions. This is a historical
artifact, not a design decision.

**`AMENDMENTS_SUBMITTED` reads backwards.** The name suggests the issuer submitted amendments. It
actually fires when an **admin sends amendment requests to the issuer**. The admin label
(`Amendment Requested`) and all issuer copy (`CashSouk Requested an Amendment`) state the direction correctly;
only the enum name is misleading. The issuer's *response* is `APPLICATION_RESUBMITTED`.

**`SIGNING_PACKAGE_COMPLETED` is deliberately hidden from the admin timeline.** The enum's own doc
comment says so: *"Audit-only: envelope rollup COMPLETED. UI shows CONTRACT/INVOICE_OFFER_ACCEPTED
instead."* It is in `TIMELINE_HIDDEN_EVENT_TYPES` because the same moment also produces a
`*_OFFER_ACCEPTED` row, and showing both would double-report the signing completion. It **is** still
included in the CSV export and **is** shown on the issuer facility-detail surface.

**`CONTRACT_OFFER_EXPIRED` vs entity status `OFFER_EXPIRED`.** The *entity* transitions to status
`OFFER_EXPIRED`; the *audit row* is `CONTRACT_OFFER_EXPIRED` or `INVOICE_OFFER_EXPIRED`. The bare
string `OFFER_EXPIRED` in the issuer label maps is a status leaking into an event map — not an event.

**`APPLICATION_RESUBMITTED` has two writer paths with very different evidence.** The rich amendment
path carries a full diff (`resubmit_changes`); the bare `PATCH …/status` path carries none. Since
2026-08-24 the bare path renders the fallback description `"Application resubmitted for review"`
rather than a blank string. Both paths remain live and are treated as the same business action.

**`APPLICATION_COMPLETED`, not `APPLICATION_APPROVED`, is the terminal success event.**
`APPLICATION_APPROVED` is dead but still carries labels on the admin, issuer-activity,
issuer-detail, facility-detail, and CSV surfaces, plus a dead `application_approved` notification
template. Do not merge the two concepts; the product has no "approved" state distinct from
"completed".

---

### 2.5 Legal Documents (`legal_document_audit_logs`, `legal_document_acceptances`)

This domain has **two independent trails** that are easy to confuse.

#### 2.5.1 Admin change trail — `legal_document_audit_logs`

**Event declaration:** `legalDocumentEventTypes` in
`apps/api/src/modules/legal-documents/schemas.ts` (lines 149–157) — 7 values, **all live**.
**Writer:** every path goes through `LegalDocumentsService.recordAuditEvent()` →
`legalDocumentAuditLogService.record()` (`audit-log-service.ts:39`), always with
`portal: AUDIT_PORTAL.ADMIN`. **Actor: Admin, always.**

**Business-specific columns** (this table is unusually rich): `action`, `legal_document_id`,
`legal_document_version_id`, `document_type`, `version_number`, **`document_hash`**,
`actor_name_snapshot`, `actor_email_snapshot`, **`before_json` / `after_json`**, **`reason`**.

**Surface profile: `ADMIN-FORENSIC`.** ADMIN ACTIVITY = Audit → Legal Documents tab
(`legal-document-audit-panel.tsx`, permission `document_management.view`). Its `ACTION_OPTIONS`
array is **both** the query filter and the label source; unknown actions fall back to the raw
string. The API mirrors the same labels in `AUDIT_ACTION_LABELS`
(`audit-admin-controller.ts:13`). CSV export uses the human labels.

| Event Type | Trigger / writer | Business-specific evidence | Admin + CSV copy |
|---|---|---|---|
| `LEGAL_DOCUMENT_CREATED` | `service.ts:createDefinition` (~138) | `after_json`: title, description, audience, `required_for_onboarding`, `public_visibility`, `show_in_account` | `Document created` |
| `LEGAL_DOCUMENT_UPDATED` | `service.ts:updateDefinition` (~217) | `before_json` / `after_json` per changed field | `Document updated` |
| `LEGAL_VERSION_UPLOADED` | `service.ts:createVersion` (~327) | `document_hash`; `after_json`: version, `file_name`, `file_hash`, status | `Version uploaded` |
| `LEGAL_VERSION_FILE_REPLACED` | `service.ts:replaceDraftFile` (~486) | before/after `file_name`, `file_hash` | `Version file replaced` |
| `LEGAL_VERSION_PUBLISHED` | `service.ts:publishVersion` (~549) | before/after status, `reacceptance_required`, version, `file_hash` | `Version published` |
| `LEGAL_VERSION_ARCHIVED` | `publishVersion` auto-archive (~568), `archiveVersion` (~603), `restoreVersion` auto-archive (~657) | before/after status; `reason` is `"auto_archived_on_publish"` or `"auto_archived_on_restore_publish"` on the automatic paths | `Version archived` |
| `LEGAL_VERSION_RESTORED` | `service.ts:restoreVersion` (~669, ~695) | before/after status + `restored_as` | `Version restored` |

**NOTIFICATION for all seven: NO.** There are zero notification or email calls anywhere in
`apps/api/src/modules/legal-documents/`.

#### 2.5.2 User acceptance trail — `legal_document_acceptances`

**Not event-typed.** This table records a *status* per (user, document version) rather than a
stream of events. Status enum `LegalAcceptanceStatus`: `NOT_OPENED` → `OPENED` → `ACCEPTED`.

**Writer:** `acceptance-service.ts:recordOpened()` (~389) and `recordAccepted()` (~450).
**Actor:** the Issuer or Investor user themselves.

**Stored evidence — this is the strongest compliance evidence in the system:**
`opened_at`, `opened_ip_address`, `opened_user_agent`, `opened_device_info`, `accepted_at`,
`accepted_ip_address`, `accepted_user_agent`, `accepted_device_info`, `document_hash`,
**`acknowledgement_text`** (the exact wording the user agreed to), `document_type`,
`version_number`, `legal_document_id`, `legal_document_version_id`, plus user and organization
name/type snapshots.

```
ADMIN ACTIVITY:            Shown — /legal-document-acceptances page ("Legal Acceptances"), plus
                           organization-legal-acceptances-panel.tsx and a per-row detail sheet.
                           Copy: "Not opened" / "Opened" / "Accepted"
ADMIN DETAIL:              Shown — legal-acceptance-detail-sheet.tsx (full evidence view)
ISSUER GENERAL ACTIVITY:   N/A — no adapter reads this table
ISSUER APPLICATION DETAIL: N/A
ISSUER FACILITY DETAIL:    N/A
INVESTOR GENERAL ACTIVITY: N/A
INVESTOR DETAIL:           N/A — portals have legal *interaction* UI (legal-updates page,
                           use-account-documents) but no acceptance-audit viewer
CSV / EXPORT:              Included — GET /v1/admin/legal-document-acceptances/export,
                           a 25-column evidence export. Copy: acceptanceStatusLabel()
```

**NOTIFICATION: NO.**

#### 2.5.3 Relationship to `TNC_APPROVED`

These are **two separate rows for two related but distinct moments**, and conflating them is a
common mistake:

| | `legal_document_acceptances` | `onboarding_logs.TNC_APPROVED` |
|---|---|---|
| Granularity | One row **per legal document version** | One row **per organization** |
| What it proves | This user opened and accepted *this exact PDF version*, with hash, IP, and acknowledgement wording | The organization's T&C gate is satisfied |
| Writer | `acceptance-service.ts` | `organization/service.ts:acceptTnc` (~835) |
| Order | Written **first** — all required PDFs must be `ACCEPTED` before the gate can pass | Written **second**, only after the gate check at `organization/service.ts:773–793` passes |

`TNC_ACCEPTED` (`SEED_ONLY`) is **not** part of either trail — see §8.

---

### 2.6 Notes / Funding / Prospectus / Repayment / Withdrawal (`note_events`)

#### 2.6.1 Domain facts

**There is no canonical enum for note event types.** `note_events.event_type` is a plain `String`,
and `createNoteEventRow()` (`apps/api/src/lib/audit/note-events.ts`) types `eventType` as `string`.
The closest things to a declared list are all **partial**:

| List | Location | Size | What it actually is |
|---|---|---|---|
| `ALL_NOTE_EVENT_TYPES` | `activity/adapters/note-log.ts` | 12 | Portal query allowlist |
| `eventTypes.noteEvent` | `lib/audit/preservation-baseline.json` | 18 | Regression baseline, not exhaustive |
| `EVENT_LABELS` | `admin/src/notes/utils/note-activity-csv.ts` | ~50 | Display labels, **including 8 legacy aliases** |
| priority list | `admin-note-events-sorting.ts` | — | Sort tie-break only, includes one dead value |

**Writers.** Two helpers in `notes/service.ts` (~6702–6754):
- `logEvent` → one `note_events` row.
- `logAdminAction` → a `note_admin_actions` row **and then** a mirrored `note_events` row with the
  same type and `metadata.{beforeState, afterState}`. The admin row additionally gets
  `metadata.changedFields`.

Three writers bypass `logEvent`:
- `createFromInvoice` (~2451) writes a nested Prisma create — `note_events.NOTE_CREATED_FROM_INVOICE`
  **plus** `note_admin_actions.CREATE_FROM_INVOICE` (a *different* string, not mirrored).
- `prospectus-review.service.ts:logProspectusAction` (~191) writes both tables with the same type.
- `shoraka-stp-service.ts:logShorakaStpEvent` (~330) writes `note_events` only, with
  `actorUserId: null` and `source: INTERNAL`.

**`note_events` has no `remark` column.** `note_admin_actions.reason` exists but `logAdminAction`
**never sets it**, so no note-domain row carries a free-text remark today.

#### 2.6.2 Surface definitions

```
ADMIN ACTIVITY:            N/A — no global note-audit page
ADMIN DETAIL:              note-timeline-panel.tsx. Renders EVERY event on the note with no
                           client-side type filter. Labels via formatNoteActivityEventLabel(),
                           display-only with a title-case fallback plus a "Shoraka" → "Tawarruq"
                           string substitution.
ISSUER GENERAL ACTIVITY:   NoteLogAdapter, query allowlist = SHARED + ISSUER_ONLY (10 values),
                           then a post-query visibility filter (isVisibleRecord)
ISSUER APPLICATION DETAIL: N/A — notes are not shown on the application timeline
ISSUER FACILITY DETAIL:    N/A
INVESTOR GENERAL ACTIVITY: NoteLogAdapter, query allowlist = SHARED + INVESTOR_ONLY (6 values),
                           then the same post-query filter
INVESTOR DETAIL:           N/A for note_events. The "Recent note activity" card on
                           /investments/[id] renders investor BALANCE LEDGER entries
                           (useInvestorBalanceActivity), NOT note_events. Empty-state copy:
                           "No note-specific balance activity has been recorded yet."
CSV / EXPORT:              note-activity-csv.ts, driven from the same note.events payload as the
                           admin timeline
```

**Portal allowlists (verbatim from `note-log.ts`):**

```ts
SHARED_EVENT_TYPES        = ["FAIL_FUNDING", "ACTIVATE", "WITHDRAWAL_COMPLETED", "NOTE_DEFAULT_MARKED"]
ISSUER_ONLY_EVENT_TYPES   = ["NOTE_CREATED_FROM_INVOICE", "PUBLISH", "PAUSE_LISTING",
                             "RESUME_LISTING", "CLOSE_FUNDING", "ISSUER_PAYMENT_SUBMITTED"]
INVESTOR_ONLY_EVENT_TYPES = ["INVESTMENT_COMMITTED", "SETTLEMENT_POSTED"]
```

**Two post-query visibility rules** (`isVisibleRecord`, note-log.ts:326–353) that a label map alone
would not reveal:
1. `WITHDRAWAL_COMPLETED` is shown **only** when the linked withdrawal has
   `withdrawal_type === ISSUER_DISBURSEMENT`. Any other withdrawal type is dropped. Note that this
   check sits **above** the portal branch and returns early, so the rule is portal-independent:
   **both** the issuer and the investor feed show issuer-disbursement completions (each scoped to
   notes their own organization is party to). It is not issuer-only.
2. `INVESTMENT_COMMITTED` is shown to an investor **only** when
   `metadata.investorOrganizationId` matches their own organization — otherwise one investor could
   see another's commitment on a shared note.

**The admin note timeline UI stays capped at 50 events**
(`notes/repository.ts:19` — `events: { orderBy: { created_at: "desc" }, take: 50 }`), but the
**CSV/export path is uncapped** (resolved 2026-08-24 — see `audit-event-catalog.md` §3.4 and
`audit-product-gap-review.md` §4 item 9). `NoteService.listEvents` (the export data source) uses
`NoteRepository.findAllEventsByNoteId`, which has no `take` limit, so a note with a long servicing
history loses earliest events only from the paginated UI timeline, never from the export.

#### 2.6.3 Note lifecycle events

Portal copy comes from `NoteLogAdapter.buildPresentation()`; `{note}` expands to
`note {noteReference}` or `note {noteTitle}`. Issuer and investor share the same copy — only the
allowlist differs.

| Event Type | Status | Trigger / writer | Actor | Evidence | Admin + CSV copy | Portal copy (title / description) | Notification |
|---|---|---|---|---|---|---|---|
| `NOTE_CREATED_FROM_INVOICE` | LIVE | Note created from an approved invoice — `service.ts:createFromInvoice` (~2453) | Admin | `applicationId`, `invoiceId` | `Note created` | *(issuer)* `Note Created` / `{note} was created from an approved invoice and can now be prepared for listing.` | NO |
| `UPDATE_DRAFT` | LIVE | Draft note edited — `updateDraft` (~2559), `logAdminAction` | Admin | before/after note snapshots | `Draft updated` | — *(not in allowlist)* | NO |
| `UPDATE_FEATURED_SETTINGS` | LIVE | Featured flag or rank changed — `updateFeaturedSettings` (~2646) | Admin | before/after | `Featured settings updated` | — | NO |
| `PUBLISH` | LIVE | Note published to the marketplace — `publish` (~2801) | Admin | before/after | `Note Published` | *(issuer)* `Note Published` / `{note} is now live and open for investment.` | **YES — `note_published`** |
| `UNPUBLISH` | LIVE | Note withdrawn from the marketplace (no commitments) — `unpublish` (~2855) | Admin | before/after | `Unpublished from marketplace` | — | NO |
| `PAUSE_LISTING` | LIVE | Campaign paused — `pauseListing` (~2925) | Admin | before/after | `Campaign paused` | *(issuer)* `Campaign Paused` / `{note} was temporarily closed to new investment. Existing commitments are held.` | NO |
| `RESUME_LISTING` | LIVE | Campaign resumed — `resumeListing` (~2988) | Admin | before/after | `Campaign resumed` | *(issuer)* `Campaign Resumed` / `{note} is open for investment again.` | NO |
| `INVESTMENT_COMMITTED` | LIVE | Investor commits funds — `createInvestment` (~3173) | Investor | `investorOrganizationId`, `amount`, `prospectusPublicationId`, `prospectusAcknowledgedAt` | `Investment committed` | *(investor, own org only)* `Investment Committed` / `Your investment in {note} was committed successfully.` | NO |
| `CLOSE_FUNDING` | LIVE | Funding threshold met / campaign closed — `closeFunding` (~3498) | Admin, or System on auto-close | before/after | `Funding Closed` | *(issuer)* `Funding Closed` / `{note} completed funding and disbursement can proceed.` | **YES — `note_funding_succeeded`** |
| `FAIL_FUNDING` | LIVE | Minimum threshold not reached — `failFunding` (~3609) | Admin / System | before/after | `Funding unsuccessful` | `Funding Unsuccessful` / `{note} did not meet the minimum funding threshold and committed funds were released.` | **YES — `note_funding_failed_issuer` + `note_funding_failed_investor`** |
| `ACTIVATE` | LIVE | Note manually activated; servicing begins — `activate` (~3688) | Admin | before/after | `Note Activated` | Issuer: `Your Note Is Active` / Investor: `Your Investment Is Active` / `{note} is now active and servicing has started.` | **YES — `note_active_issuer` + `note_active_investor`** |
| `NOTE_FACILITY_FEE_COLLECTION_WAIVED` | LIVE | Admin waives facility-fee collection — `waiveFacilityFeeCollection` (~3270) | Admin | `reason` | `Facility fee collection waived` | — | NO |
| `WAIVE_FACILITY_FEE_COLLECTION` | LIVE | Same action, `logAdminAction` mirror (~3273) | Admin | before/after + `changedFields` | `Facility Fee Collection Waived` (label map; `note_admin_actions` has no dedicated production reader) | — | NO |
| `FACILITY_OCCUPANCY_UPDATED` | LIVE | Contract occupancy recomputed with a `noteId` in scope — `refresh-contract-facility.ts` (~599) | System | full occupancy snapshot | `Facility occupancy updated` | — | NO |
| `NOTE_DEFAULT_MARKED` | LIVE | Note marked in default — `markDefault` (~5806) | Admin | `reason` | `Note Defaulted` | Issuer: `Your Note Is in Default` / Investor: `Your Investment Is in Default` / `{note} was marked in default and requires attention.` | **YES — `note_defaulted` + `note_defaulted_investor`** |
| ~~`ISSUER_RESIDUAL_WITHDRAWAL_CREATED`~~ | ~~**DEAD**~~ | ~~No writer. Appeared only in `admin-note-events-sorting.ts:38`~~ | — | — | — | — | **REMOVED (2026-08-25)** — the array entry was deleted; nothing looked it up (no row can ever have this `event_type`), so the sort order of every real note event is unchanged. See §9 #13 |

> **`ACTIVATE` is not written on issuer disbursement completion.** Completing an issuer disbursement
> can set the note `ACTIVE`, but that path writes **only** `WITHDRAWAL_COMPLETED`. It does **not**
> write `ACTIVATE` and does **not** call `notifyNoteActivated` (which would also send
> `note_active_issuer`). Issuer users keep disbursement-complete Activity/notification. Investors
> see investment-active Activity copy for the same row and receive `note_active_investor`. The
> manual `activate()` API still writes `ACTIVATE` and sends both `note_active_*` types; it is not
> reachable from current Admin UI.

#### 2.6.4 Prospectus events

All six are **admin-only** — none appear in `ALL_NOTE_EVENT_TYPES`, so no portal can show them. All
are written by `prospectus-review.service.ts:logProspectusAction` and mirrored to
`note_admin_actions` with `metadata.{beforeState, afterState}`. **Actor: Admin. Notification: NO.**

| Event Type | Trigger (writer line) | Admin + CSV copy |
|---|---|---|
| `PROSPECTUS_REVIEW_CREATE` | Review record created (~461) | `Prospectus review created` |
| `PROSPECTUS_REVIEW_DRAFT_UPDATE` | Draft content saved (~713) | `Prospectus draft updated` |
| `PROSPECTUS_REVIEW_APPROVE` | Prospectus approved (~875) | `Prospectus approved` |
| `PROSPECTUS_APPROVAL_INVALIDATED_EDIT` | An edit cleared the approval (~689) | `Prospectus approval cleared after edit` |
| `PROSPECTUS_APPROVAL_INVALIDATED_SOURCE` | A source change cleared the approval (~528) | `Prospectus approval cleared after source change` |
| `PROSPECTUS_APPROVAL_INVALIDATED_UNPUBLISH` | Unpublish cleared the approval (~313) | `Prospectus approval cleared after unpublish` |

#### 2.6.5 Repayment / settlement events

Portal visibility: only `ISSUER_PAYMENT_SUBMITTED` (issuer) and `SETTLEMENT_POSTED` (investor) are
in an allowlist. Everything else is **Hidden (not queried)** on both portals, and `N/A` on the
application/facility/investor-detail surfaces.

| Event Type | Trigger / writer | Actor | Evidence | Admin + CSV copy | Portal copy | Notification |
|---|---|---|---|---|---|---|
| `ISSUER_PAYMENT_SUBMITTED` | Issuer submits a repayment for review — `recordPayment` (~4559→4582) when `actor.portal === "ISSUER"` | Issuer | full payment input incl. `paymentPurpose` | `Repayment Submitted` | *(issuer)* `You Submitted a Repayment` / `A repayment for {note} was submitted and is awaiting review.` | NO |
| `PAYMENT_RECEIVED` | Admin records a repayment directly — same writer, admin portal | Admin | same | `Repayment received` | — | **YES — `note_payment_received`** (to investors) |
| `PAYMENT_APPROVED` | Pending repayment approved — `approvePayment` (~4634) | Admin | `paymentId` | `Repayment approved` | — | **YES — `note_payment_received`** |
| `PAYMENT_REJECTED` | Pending repayment rejected — `rejectPayment` (~4673) | Admin | `paymentId`, `reason` | `Repayment rejected` | — | **YES — `note_payment_rejected`** (issuer org, platform only) |
| `SETTLEMENT_PREVIEWED` | Settlement preview saved — `previewSettlement` (~4848) | Admin | `settlementId` + full snapshot | `Settlement previewed` | — | NO |
| `SETTLEMENT_APPROVED` | Preview approved — `approveSettlement` (~4957) | Admin | `settlementId` | `Settlement approved` | — | NO |
| `SETTLEMENT_POSTED` | Settlement posted to the ledger — `postSettlement` (~5102) | Admin | `settlementId`, `investorPayoutCount`, `residualAmount`, `residualWithdrawalCreated` | `Settlement posted` | *(investor)* `Settlement Posted` / `Your returns for {note} were posted.` | **YES — `note_settlement_posted`** (investors) **+ `note_repaid_issuer`** (issuer, when no trustee step follows) |
| `OVERDUE_LATE_CHARGE_CHECKED` | Overdue / late-fee check executed — `applyOverdueLateCharge` (~5284) | Admin | full result object: `dueDate`, `overdue`, `daysLate`, suggested amounts, message | `Overdue Review Completed` | — | **YES — `note_arrears` + `note_arrears_investor`**, but only when the check moves the note into arrears |
| `LATE_CHARGE_APPROVED` | Late charge calculated and approved — `approveLateCharge` (~5309) | Admin | `calculateLateCharge` result | `Late charge approved` | — | NO |
| `ARREARS_LETTER_GENERATED` | Arrears letter PDF — `generateNoteLetter("arrears")` (~5326) | Admin | `s3Key` | `Arrears letter generated` | — | NO |
| `DEFAULT_LETTER_GENERATED` | Default letter PDF — `generateNoteLetter("default")` (~5326) | Admin | `s3Key` | `Default letter generated` | — | NO |
| `SETTLEMENT_TRUSTEE_LETTER_GENERATED` | Settlement trustee letter PDF — `generateSettlementTrusteeLetter` | Admin | `s3Key`, `settlementId` | `Settlement Trustee Letter Generated` | Hidden (not queried) | NO. |
| `SETTLEMENT_TRUSTEE_EMAIL_SENT` | Trustee SES email delivered — `persistSettlementTrusteeEmailSent` via `markSettlementTrusteeLetterSubmitted` (auto-send, before submit tx) or `resendSettlementTrusteeEmail` | Admin | `settlementId`, `settlementReference` (from already-loaded `display_reference`), `messageId`, optional `resend`. | `Settlement Trustee Email Sent` / `Settlement Trustee Email Redelivered` | Hidden (not queried) | NO registry. Direct SES to trustee. |
| `SETTLEMENT_TRUSTEE_LETTER_SUBMITTED` | Letter submitted — `markSettlementTrusteeLetterSubmitted` | Admin | `settlementId` | `Settlement Trustee Letter Submitted` | Hidden (not queried) | NO. |
| `SETTLEMENT_TRUSTEE_INSTRUCTION_COMPLETED` | Trustee instruction completed — `markSettlementTrusteeInstructionCompleted` | Admin | `settlementId`, `completedAt` | `Settlement Trustee Instruction Completed` | Hidden (not queried) | **YES — `note_repaid_issuer`**. |

> **There is no `NOTE_ARREARS` event.** Arrears is a *state* the note enters during
> `applyOverdueLateCharge`. The audit evidence for it is `OVERDUE_LATE_CHARGE_CHECKED`, and the
> user-facing signal is the `note_arrears` / `note_arrears_investor` notification pair. If you are
> looking for "when did this note go into arrears", read `OVERDUE_LATE_CHARGE_CHECKED` metadata.

#### 2.6.6 Withdrawal / trustee events

Backed by the `withdrawal_instructions` table (`status`, `withdrawal_type`, `amount`,
`beneficiary_snapshot`, `letter_s3_key`, `generated_at`, `submitted_to_trustee_at`, `completed_at`,
`display_reference`, `trustee_email_sent_at`). **Actor: Admin**. Portal surfaces are `Hidden (not queried)`
except where noted.

Do not merge these three moments:
1. **Trustee operational email** — `WITHDRAWAL_TRUSTEE_EMAIL_SENT` (SES to trustee; auto-send before submit, or later resend).
2. **Trustee submission status** — `WITHDRAWAL_SUBMITTED_TO_TRUSTEE`.
3. **Issuer platform notification** — `withdrawal_submitted_to_trustee` (issuer org, platform-only), fired after the submit audit write.

| Event Type | Trigger / writer | Evidence | Admin + CSV copy | Portal | Notification |
|---|---|---|---|---|---|
| `ISSUER_DISBURSEMENT_WITHDRAWAL_CREATED` | Disbursement instruction auto-created when funding closes — `closeFunding` | `netDisbursement`, `fundedAmount`, `platformFee`, `facilityFeeCharged`, `additionalFees`, `facilityFeeCollectionWaived`, `contractFacilityFeeWaived` | `Disbursement instruction created` | Hidden (not queried) | NO |
| `WITHDRAWAL_LETTER_GENERATED` | Trustee letter PDF generated — `generateWithdrawalLetter` | `withdrawalId`, `s3Key` | `Withdrawal letter generated` | Hidden (not queried) | NO |
| `WITHDRAWAL_TRUSTEE_EMAIL_SENT` | Trustee SES email delivered — `persistWithdrawalTrusteeEmailSent` via `markWithdrawalSubmitted` (auto-send, before submit tx) or `resendWithdrawalTrusteeEmail` | `withdrawalId`, `withdrawalReference` (new writes; from already-loaded `display_reference`), `messageId`, optional `resend`. Historical rows may omit `withdrawalReference`. | `Withdrawal Trustee Email Sent` / `Withdrawal Trustee Email Redelivered` | Hidden (not queried) | NO registry. Direct SES to trustee. |
| `WITHDRAWAL_SUBMITTED_TO_TRUSTEE` | Instruction marked submitted — `markWithdrawalSubmitted` | `withdrawalId`, `withdrawalReference` | `Withdrawal Submitted to Trustee` | Hidden (not queried) | **YES — `withdrawal_submitted_to_trustee`** |
| `WITHDRAWAL_BENEFICIARY_UPDATED` | Beneficiary edited while draft — `updateWithdrawalBeneficiary` | `withdrawalId` | `Withdrawal beneficiary updated` | Hidden (not queried) | NO |
| `WITHDRAWAL_COMPLETED` | Trustee payout completed — `markWithdrawalCompleted` | `withdrawalId`, `amount` | `Withdrawal Completed` | **Shown when `withdrawal_type === ISSUER_DISBURSEMENT`, in both portals** (the check precedes the portal branch). Issuer: `Your Disbursement Is Complete` / `Disbursement for {note} has been completed.` Investor: `Your Investment Is Active` / `{note} is now active and servicing has started.` Any other withdrawal type is dropped. | **YES — `withdrawal_completed` (issuer)** + **`note_active_investor` (confirmed investors)** when the ISSUER_DISBURSEMENT path also activates the note. No `note_active_issuer`. Investor cash withdrawals use `investor_withdrawal_completed`, not this type. Residual/admin-adjustment stay silent |

**`WITHDRAWAL_SUBMITTED_TO_TRUSTEE` notification detail:**
- **TYPE ID:** `withdrawal_submitted_to_trustee`
- **TITLE:** `"Withdrawal Submitted to Trustee"`
- **MESSAGE:** `"Withdrawal instruction {withdrawalReference} has been submitted to the trustee."`
- **PAYLOAD:** `{ withdrawalId, withdrawalReference }` — internal id kept for linking/idempotency; display reference used in copy. Historical rows may still have only `withdrawalId`.
- **RECIPIENT:** issuer organization owner **+ all members** (`sendToIssuerOrg` →
  `listIssuerOrgMemberUserIds`)
- **CHANNEL:** platform only (`sendTypedPlatformOnly`)
- **TRIGGER RELATION:** SAME MOMENT — fires immediately after the **submit** audit write. Not the trustee SES email (`WITHDRAWAL_TRUSTEE_EMAIL_SENT`).
- **SOURCE:** `notes/service.ts:markWithdrawalSubmitted` (~6274) →
  `note-lifecycle-notifications.ts:notifyWithdrawalSubmittedToTrustee`
- **History:** wired 2026-08-24. Before that the event fired but no notification was sent.

#### 2.6.7 Tawarruq / Shoraka STP events

Two system events covering the straight-through-processing commodity-trade leg. Written by
`shoraka-stp-service.ts:logShorakaStpEvent` (~330) with **`actorUserId: null`** and
`source: INTERNAL` — the only note-domain events with no human actor. **No `note_admin_actions`
mirror. Notification: NO. Not in any portal allowlist**, so both are admin-only.

| Event Type | Status | Trigger / writer | Actor | Evidence | Admin + CSV copy |
|---|---|---|---|---|---|
| `SHORAKA_ORDER_SUBMITTED` | LIVE | Tawarruq order submitted to the provider — `submitOrder` (~524) | System | `provider_order_id`, `order_amount`, `murabaha_amount`, `value_date`, `order_date` | `Tawarruq order submitted` |
| `SHORAKA_CERTIFICATE_FETCHED` | LIVE | Trade certificate retrieved and stored — `fetchCertificate` (~677) | System | `document_type`, `certificate_available`, `provider_order_id` | `Tawarruq certificate fetched` |

> **Naming note:** "Shoraka" is the **provider/internal** name; "Tawarruq" is the **user-facing**
> name. `formatNoteActivityEventLabel()` performs a deliberate string substitution
> (`Shoraka Stp` → `Tawarruq Transaction`, then `Shoraka` → `Tawarruq`) so that any current or
> future `SHORAKA_*` event renders with the customer-facing term without needing a label entry.
> The stored `event_type` keeps the `SHORAKA_` prefix — do not rename it.

---

### 2.7 Gateway / Payments (`gateway_payment_events`)

**Enum:** `GatewayPaymentEventType` — a real **Prisma enum** (`schema.prisma:2272`), unlike every
other domain in this system, which uses free strings. 11 values, **8 live, 3 dead**.

**Writer:** `recordGatewayPaymentEvent()` in `apps/api/src/modules/payment/gateway-events.ts` (~26).
There is **no `gateway` module** — everything lives under `apps/api/src/modules/payment/`.

**Business-specific columns:** `gateway_payment_id`, `type`, `from_status`, `to_status`,
**`reason`** (human-readable), `metadata`.

**Distinct from `note_events` payments.** `PAYMENT_RECEIVED`, `PAYMENT_APPROVED`, etc. are
**note-domain** events about issuer repayments. `gateway_payment_events` covers Curlec
checkout / deposit / fee / refund flows. Different table, different adapter, different business
meaning. Related but separate operational tables: `gateway_webhook_events` (raw webhook dedup),
`gateway_recon_runs` / `gateway_recon_exceptions` (settlement reconciliation).

**Surface profile: `ADMIN-FORENSIC`**, with:
- ADMIN DETAIL = the gateway payment detail timeline
  (`apps/admin/src/app/finance/gateway-payments/[id]/page.tsx`), copy from `EVENT_COPY` in
  `gateway-payment-copy.ts` (~213), **display-only** with a `formatGatewayEventTitle()` fallback.
- CSV / EXPORT: **N/A** — no export exists for this table.

**NOTIFICATION:** silent for most of this domain, with three live exceptions gated to
`GatewayPaymentPurpose.INVESTOR_DEPOSIT` (platform only, members of the deposit's investor
organization) — `NAME_CHECK_REJECTED` → `deposit_name_check_rejected`, `REFUND_INITIATED` →
`deposit_refund_initiated`, `REFUNDED` → `deposit_refunded` (added 2026-08-25; see §3.2 below and
`apps/api/src/modules/notification/gateway-payment-notifications.ts`). `NAME_CHECK`,
`NAME_CHECK_APPROVED`, `CAPTURE_MISMATCH`, `EXPIRED`, and `REFUND_WALLET_REVERSAL_FAILED` remain
silent.

| Event Type | Status | Trigger / writer | Actor | Evidence | Admin copy |
|---|---|---|---|---|---|
| `NAME_CHECK` | LIVE | Auto name-check needs admin review after deposit capture — `deposit-service.ts:transitionToNameCheckPending` (~379) | System | `reason` = review message; `score`, `matchedVariant` | `Name check needed` |
| `NAME_CHECK_APPROVED` | LIVE | Admin approves the name match — `admin-service.ts:approveNameCheck` (~438) | Admin | status transition only | `Name check approved` |
| `NAME_CHECK_REJECTED` | LIVE | Admin rejects the match, triggering a refund — `admin-service.ts:rejectNameCheck` (~476) | Admin | `reason`: `"Admin rejected the name match. A refund was started."` | `Name Check Rejected` |
| `CAPTURE_MISMATCH` | LIVE | Currency or amount mismatch on capture — `webhook-service.ts` (~333); `amount-mismatch-service.ts` (~147) | System / Admin | `mismatchType`, `gatewayAccount`, `purpose`, `curlecOrderId`, `curlecPaymentId`, `expectedCurrency`, `actualCurrency`, `expectedSen`, `actualSen` | `Payment mismatch found` (specialised for currency vs amount) |
| `EXPIRED` | LIVE | Cron expires an abandoned `CREATED` checkout — `lib/jobs/gateway-stuck-order-poller.ts` (~64) | System | `reason`: `"Abandoned checkout — no Curlec capture after … minutes"` | `Payment expired` |
| `REFUND_INITIATED` | LIVE | Refund started, manually or automatically — `refund-service.ts` (~284, ~810, ~873, ~1320, ~1464) | Admin / System | **`auto: !actorUserId`**, `refundId`, `reason`, `gatewayAccount`, `purpose`, `amountSen`, `source` | `Refund Started` |
| `REFUNDED` | LIVE | Curlec refund confirmed and wallet reversal complete — `refund-service.ts` (~367, ~958) | Admin / System | `refundId`, `purpose`, `event`, `externalCurlecRefund` | `Refund completed` |
| `REFUND_WALLET_REVERSAL_FAILED` | LIVE | Wallet debit failed after a refund — `refund-service.ts` (~433, ~486, ~1103, ~1232) | System / Admin | error context (varies by path) | `Wallet balance could not be updated` |
| `OVERRIDE_PROPOSED` | **DEAD** | No writer. `getOpenOverrideProposal()` (~62) only **reads** for proposals | — | — | `Status change proposed` *(copy only)* |
| `OVERRIDE_APPROVED` | **DEAD** | No writer | — | — | `Status change approved` *(copy only)* |
| `OVERRIDE_REJECTED` | **DEAD** | No writer | — | — | `Status change rejected` *(copy only)* |

> **Evidence asymmetry.** A *successful* deposit capture writes **no** event row. Every exception
> path does. Success evidence lives in `gateway_payments.status`,
> `investor_balance_transactions`, and `note_ledger_entries`. Arguably correct-by-design (the ledger
> entry *is* the evidence), but flagged for explicit product confirmation in
> `audit-product-gap-review.md` §6.6.

---

### 2.8 Products (`product_logs`)

**Enum:** `productEventTypes` in `apps/api/src/modules/products/schemas.ts` (lines 9–15) — 5 values.
**Writer:** `createProductLogRow()` in `apps/api/src/modules/products/audit.ts`, always with
`portal: ADMIN`. **Actor: Admin, always. Notification: NO** for all five.

**Business-specific columns:** `product_id`, `event_type`, `metadata` (a full workflow snapshot).
**No `remark` column** — the snapshot in `metadata` is the only narrative evidence.

**Surface profile: `ADMIN-FORENSIC`.** ADMIN ACTIVITY = Audit → Products tab
(`apps/admin/src/components/audit/product-logs-panel.tsx`, permission `audit.product.view`). Its
`PRODUCT_EVENT_TYPES` array supplies both filter values and badge labels for **all five** types;
unknown types fall back to a plain badge. CSV export (`GET /v1/admin/product-logs/export`) uses the
same friendly labels via `PRODUCT_EVENT_LABELS`.

| Event Type | Status | Trigger / writer | Business-specific evidence | Admin + CSV copy |
|---|---|---|---|---|
| `PRODUCT_CREATED` | LIVE | `POST /v1/products` — `repository.ts:create` (~270) | Workflow snapshot, `category_display_order`, `product_display_order`, `marketplace_listing_duration_days`, `service_fee_rate_percent`, `default_facility_fee_rate_percent`, `product_code`, `version`, `base_id`, `status`, product timestamps | `Created` |
| `PRODUCT_UPDATED` | LIVE | `PATCH /v1/products/:id` — `repository.ts:update`, both the in-place path (~430) and the versioned path (~592) | Same snapshot **+ `replaced_product_id`** (`null` in place, the old product id on the versioned path) | `Updated` |
| `PRODUCT_DELETED` | LIVE | `DELETE /v1/products/:id` (soft delete) — `repository.ts:delete` (~632) | Workflow snapshot, `version`, `base_id`, `status`, `replaced_product_id: null` | `Deleted` |
| `PRODUCT_INACTIVATED` | **UNREACHABLE** | `repository.ts:setInactive` (~679) exists but has **zero callers** outside the repository | *(would be)* `previous_status`, `new_status`, `version`, `base_id` | `Inactivated` |
| `PRODUCT_REACTIVATED` | **UNREACHABLE** | `repository.ts:restoreProduct` (~713) exists but has **zero callers** | *(would be)* `previous_status`, `new_status`, `version`, `base_id` | `Reactivated` |

`PRODUCT_INACTIVATED` / `PRODUCT_REACTIVATED` are a distinct case from `DEAD`: the writer code is
complete and correct, it simply has no route wired to it. If a route is ever added, they will start
producing rows and the admin panel will render them correctly with no UI work required.

**Legacy dead code:** `apps/api/src/modules/products/log/service.ts:createProductLogEntry()` has no
importers anywhere in the repository.

---

## 3. Notification catalogue

Source of truth: `apps/api/src/modules/notification/registry.ts` (templates and payloads) and
`seed-data.ts` (channel defaults). **45 registry type ids** exist.

### 3.1 How delivery actually works

`sendTyped` and `sendTypedPlatformOnly` both resolve copy through
`getNotificationContent(typeId, payload)`. They differ only in channel gating
(`notification/service.ts:84–93`):

| | Platform inbox | Email |
|---|---|---|
| `sendTyped` | seed `enabled_platform` **AND** (if `user_configurable`, the user's preference, defaulting to true) | seed `enabled_email` **AND** (if `user_configurable`, the user's preference, defaulting to true) |
| `sendTypedPlatformOnly` | **always on** (`sendToPlatform: true`) | **always suppressed** (`sendToEmail: false`) — regardless of seed defaults or user preference |

If both channels resolve to false, `create()` returns `null` and nothing is recorded.

**Recipient helpers — these are not interchangeable:**

| Helper | Returns |
|---|---|
| `getIssuerRecipientUserIdsForApplication` (`application-recipients.ts`) | Org `owner_user_id` **+ members with role `OWNER` or `ORGANIZATION_ADMIN`**. Not all members. |
| `listIssuerOrgMemberUserIds` (`org-member-recipients.ts`) | Owner **+ every** organization member, any role. Broader. |
| `listInvestorOrgMemberUserIds` | Owner + every investor-org member. |
| `sendToInvestorsOnNote` (`note-lifecycle-notifications.ts`) | Every member of every investor org holding an investment on the note in the given statuses (typically `CONFIRMED`). |
| `sendToInvestorOrganizations` | Every member of an explicitly supplied org-id list. |
| Director/shareholder senders | **`ownerUserId` only.** Narrowest. |

The same organization therefore sees **different audiences** depending on which domain fired the
notification. That is intentional per-domain design, not a defect — but be aware of it when adding
new notifications.

### 3.2 Full registry

`LIVE` = at least one hardcoded production `sendTyped` / `sendTypedPlatformOnly` call site.
`BULK-ONLY` = no hardcoded call site, but reachable through the admin bulk-broadcast tool.
`DEAD` = registry entry with no send path at all.
`DEAD_NOT_CONFIGURABLE` = `DEAD`, plus (2026-08-25) explicitly hidden from the Admin Notification
Configuration toggle list so admins aren't offered a switch for something that can never fire; the
registry/seed row itself is retained for FK/historical-log compatibility — see the note after this
table.

| Type ID | Status | Title | Message (template) | Recipient | Channel | Fired by |
|---|---|---|---|---|---|---|
| `password_changed` | LIVE | `Password Changed` | `The password for your account was changed on {changedAt}.` | The user | platform + email (not configurable) | `auth/service.ts:changePassword` (~980) |
| `login_new_device` | **DEAD_NOT_CONFIGURABLE** | `Login from New Device` | `A new login was detected on {deviceName} from {location} at {time}.` | — | *(would be platform + email)* | none — no device-fingerprinting code exists |
| `kyc_approved` | **DEAD_NOT_CONFIGURABLE** | `Identity Verification Approved` | `Hello {userName}, your identity verification has been approved.` | — | — | none — superseded by `onboarding_approved` |
| `kyc_rejected` | **DEAD_NOT_CONFIGURABLE** | `Identity Verification Rejected` | `Hello {userName}, your identity verification was rejected.` + ` Reason: {reason}` | — | — | none — superseded by `onboarding_rejected` |
| `onboarding_approved` | LIVE | `Onboarding Approved` | `Congratulations! Your {onboardingType} onboarding for {orgName} has been completed successfully. You now have full access to the platform.` | Applicant (`onboarding.user_id`) | platform + email (not configurable) | `admin/service.ts:completeFinalApproval` (~4188) — event `FINAL_APPROVAL_COMPLETED` |
| `onboarding_rejected` | LIVE | `Onboarding Rejected` | `Unfortunately, your {onboardingType} onboarding for {orgName} was rejected.` + ` Reason: {reason}` | Applicant | platform + email (not configurable) | `individual-onboarding-handler.ts` (~235, ~288); `cod-handler.ts` (~1580, ~1632) |
| `system_announcement` | **BULK-ONLY** | `{title}` (admin-supplied) | `{message}` (admin-supplied) | Chosen audience | admin-selected | `sendBulkNotification` only |
| `new_product_alert` | **BULK-ONLY** | `New Investment Opportunity` | `A new product "{productName}" is now available for investment.` | Investors | admin-selected | `sendBulkNotification` only |
| `application_amendments_requested` | LIVE | `Amendment Requested` | `An amendment is required for application {ref}. Review the request and resubmit your application.` | Issuer owner + org admins | platform + email | `admin/service.ts:submitPendingAmendments` (~10652) — event `AMENDMENTS_SUBMITTED` |
| `acceptance_document_changes_requested` | LIVE | `Acceptance Documents Need Updates` | `A reviewer requested updates to acceptance documents on application {ref}. Open Review Offer to see which files to replace.` | Issuer owner + org admins | **platform only** (`platformOnly: true`; seed `enabled_email:false`) | `admin/service.ts` (~10192) |
| `application_approved` | **DEAD_NOT_CONFIGURABLE** | `Application Approved` | `Your application {ref} has been approved.` | — | — | none — the `APPLICATION_APPROVED` DB event is dead too (a display-only synthetic UI alias of the same name is unrelated and still active — see §2.4) |
| `application_rejected` | LIVE | `Application Rejected` | `Your application {ref} has been rejected.` | Issuer owner + org admins | platform + email | `admin/service.ts:updateApplicationStatus` (~6668) — event `APPLICATION_REJECTED` |
| `contract_offer_sent` | LIVE | `Facility Offer Received` | `A facility offer of {offeredFacility} has been sent to your application {ref}.` + ` It expires on {expiresAt}.` | Issuer owner + org admins | platform + email | `admin/service.ts:sendContractOffer` (~8242) — event `CONTRACT_OFFER_SENT` |
| `invoice_offer_sent` | LIVE | `Invoice Offer Received` | `An invoice offer for invoice {invoiceNumber} of RM{offeredAmount} has been sent.` + ` It expires on {expiresAt}.` | Issuer owner + org admins | platform + email | `admin/service.ts:sendInvoiceOffer` (~8757) — event `INVOICE_OFFER_SENT` |
| `offer_retracted_or_reset` | LIVE | `Facility Offer Retracted` / `Invoice Offer Retracted` | Facility: `The facility offer on your application was retracted and is no longer active.` Invoice: `The invoice offer for invoice {invoiceNumber} was retracted and is no longer active.` | Issuer owner + org admins | **platform only** (seed `enabled_email:false`) | `admin/service.ts:resetSectionReviewToPending` (~9256), `resetItemReviewToPending` (~9419) |
| `offer_expired` | LIVE | `Offer Expired` | `{Facility\|Invoice} offer ({invoiceNumber}) has expired.` | Issuer owner + org admins | platform + email | `lib/jobs/acceptance-signing-expiry.ts` (~490) — events `CONTRACT_OFFER_EXPIRED` / `INVOICE_OFFER_EXPIRED` |
| `offer_expiry_reminder_24h` | LIVE | `Offer Expiring Soon` | `{Facility\|Invoice} offer ({invoiceNumber}) expires {today\|in 1 day\|in N days\|soon} on {expiresAt}.` | Issuer owner + org admins | platform + email | `acceptance-signing-expiry.ts` (~572) — **no audit event** |
| `application_resubmitted_confirmation` | LIVE | `Application Resubmitted` | `Your application {ref} was successfully resubmitted for review (review cycle {reviewCycle}).` | Issuer owner + org admins | **platform only** (seed `enabled_email:false`) | `applications/service.ts:resubmitApplication` (~1072) |
| `application_withdrawn_confirmation` | LIVE | `Application Withdrawn` (true withdrawal) / `Facility Offer Declined` / `Invoice Offer Declined` | True withdrawal: `Your application {ref} has been withdrawn successfully.` Facility decline: `The facility offer on your application {ref} was declined and the application is now closed.` Invoice decline: `The invoice offer for invoice {invoiceNumber} was declined.` | Issuer owner + org admins | **platform only** | `applications/service.ts` (~1675, ~2867, ~3258) — payload `withdrawalReason` branches copy without a new notification type |
| `application_completed` | LIVE | `Application Completed` | `Your application {ref} has been completed successfully.` | Issuer owner + org admins | **platform only** | `applications/service.ts` (~2888, ~3279) — event `APPLICATION_COMPLETED` |
| `application_submitted_confirmation` | LIVE | `Application Submitted` | `Your application {ref} has been submitted successfully and is now under review.` | Issuer owner + org admins | **platform only** (seed `enabled_email:false`) | `applications/service.ts:updateApplicationStatus` — event `APPLICATION_SUBMITTED`. Idempotency suffix `submitted`. Coexists with the submitter's session toast; does not fire on `RESUBMITTED`. |
| `contract_signing_deadline_extended` | LIVE | `Signing Deadline Extended` | `The signing deadline for application {ref} has been extended to {deadline}.` | Issuer owner + org admins | platform + email | `admin/service.ts:extendContractSigningDeadline` — event `CONTRACT_SIGNING_DEADLINE_EXTENDED`. Deadline taken from the writer (`signingExpiresAt`); no extra query. |
| `invoice_signing_deadline_extended` | LIVE | `Signing Deadline Extended` | `The signing deadline for invoice {invoiceNumber} has been extended to {deadline}.` | Issuer owner + org admins | platform + email | `admin/service.ts:extendInvoiceSigningDeadline` — event `INVOICE_SIGNING_DEADLINE_EXTENDED`. Invoice number from `getInvoiceReference` already in scope. |
| `facility_disabled` | LIVE | `Facility Disabled` | `Your facility for application {ref} has been disabled. New drawdowns are currently unavailable.` | Issuer owner + org admins | platform + email | `admin/service.ts:setContractFacilityEnabled` — event `CONTRACT_FACILITY_DISABLED`. Idempotency includes disable timestamp so a later re-disable after re-enable still notifies. |
| `director_shareholder_action_required` | LIVE | `Action Required: Complete Director/Shareholder Onboarding` | `Please complete onboarding for {personName}.` | **Issuer org owner only** | platform + email (not configurable) | `director-shareholder-notifications.ts` (~172, ~246) — **no audit event** |
| `investor_director_shareholder_action_required` | LIVE | `Action Required: Complete Director/Shareholder Onboarding` | Same as above | **Investor org owner only** | platform + email (not configurable) | `director-shareholder-notifications.ts` (~172) — **no audit event** |
| `note_published` | LIVE | `Note Published` | `Your note "{noteTitle}" has been published to the marketplace for investor funding.` | Issuer org owner + **all** members | platform only | `notes/service.ts:publish` (~2811) — event `PUBLISH` |
| `note_funding_succeeded` | LIVE | `Funding Closed` | `Funding for "{noteTitle}" has closed — the minimum threshold was reached and commitments are locked in.` | Issuer org, all members | platform only | `closeFunding` (~3519) — event `CLOSE_FUNDING` |
| `note_funding_failed_issuer` | LIVE | `Note funding did not complete` | `Funding for "{noteTitle}" did not reach the minimum threshold before the listing closed.` | Issuer org, all members | platform only | `failFunding` (~3630) — event `FAIL_FUNDING` |
| `note_funding_failed_investor` | LIVE | `Commitment released` | `The listing for "{noteTitle}" did not complete funding. Your reserved commitment has been released back to your available balance.` | Investor orgs with commitments, all members | platform only | `failFunding` (~3630) — event `FAIL_FUNDING` |
| `note_active_issuer` | LIVE | `Your Note Is Active` | `Your note "{noteTitle}" is now active. Disbursement and servicing proceeds under the agreed terms.` | Issuer org, all members | platform only | `activate` (~3698) — event `ACTIVATE` |
| `note_active_investor` | LIVE | `Your Investment Is Active` | `Funding for "{noteTitle}" is complete and the note is now active. Servicing has started.` | Confirmed investors on the note | platform only | `activate` (`notifyNoteActivated`) and issuer-disbursement completion (`notifyNoteActiveInvestors` after `WITHDRAWAL_COMPLETED`). Same idempotency prefix `note:lifecycle:{noteId}:active:investor`. |
| `note_repaid_issuer` | LIVE | `Note repaid` | `"{noteTitle}" has been fully repaid and settled. Any residual handling will follow operational workflow if applicable.` | Issuer org, all members | platform only | `postSettlement` (~5130); trustee completion (~5777) |
| `note_payment_received` | LIVE | `Repayment Received` | `A repayment was recorded for "{noteTitle}".` | Confirmed investors on the note | platform only | `recordPayment` (~4587), `approvePayment` (~4637) |
| `note_settlement_posted` | LIVE | `Settlement Posted` | `Settlement has been posted for "{noteTitle}".` | Investor orgs in the settlement | platform only | `postSettlement` (~5122) — event `SETTLEMENT_POSTED` |
| `note_arrears` | LIVE | `Note in Arrears` | `"{noteTitle}" has moved into arrears. Review repayment status and obligations.` | Issuer org, all members | platform only | `applyOverdueLateCharge` (~5288) — event `OVERDUE_LATE_CHARGE_CHECKED` |
| `note_arrears_investor` | LIVE | `Note in Arrears` | `"{noteTitle}" is in arrears. We will keep you informed as servicing actions progress.` | Confirmed investors | platform only | `applyOverdueLateCharge` (~5288) |
| `note_defaulted` | LIVE | `Your Note Is in Default` | `"{noteTitle}" has been marked as default.` | Issuer org, all members | platform only | `markDefault` (~5807) — event `NOTE_DEFAULT_MARKED` |
| `note_defaulted_investor` | LIVE | `Your Investment Is in Default` | `"{noteTitle}" has been marked as default. This may affect recovery timelines; check your investments view for updates.` | Confirmed investors | platform only | `markDefault` (~5807) |
| `withdrawal_submitted_to_trustee` | LIVE | `Withdrawal Submitted to Trustee` | `Withdrawal instruction {withdrawalReference} has been submitted to the trustee.` | Issuer org, all members | platform only | `markWithdrawalSubmitted` (~6274) — event `WITHDRAWAL_SUBMITTED_TO_TRUSTEE` |
| `note_payment_rejected` | LIVE | `Repayment Rejected` | `Your repayment for note {noteTitle} was rejected. Please review the repayment details.` | Issuer org, all members | platform only | `notes/service.ts:rejectPayment` — event `PAYMENT_REJECTED`. Idempotency includes `paymentId`. |
| `withdrawal_completed` | LIVE | `Your Disbursement Is Complete` | `The disbursement for note {noteTitle} has been completed.` | Issuer org, all members | platform only | `notes/service.ts:markWithdrawalCompleted` — event `WITHDRAWAL_COMPLETED`, **only when `isIssuerFinancingDisbursement`**. Residual return / investor / admin-adjustment withdrawals stay silent. Idempotency includes `withdrawalId`. Investors are notified separately via `note_active_investor`, not this type. |
| `investor_withdrawal_submitted` | LIVE | `Withdrawal Submitted` | `Your withdrawal request of RM{amount} has been submitted for processing.` | Requesting investor (`requested_by_user_id`) | platform only | `notes/service.ts:createInvestorWithdrawal` after wallet debit. `INVESTOR_WITHDRAWAL` only. No `note_events`. Idempotency `withdrawal:{id}:notif:investor_withdrawal_submitted:user:{userId}`. |
| `investor_withdrawal_completed` | LIVE | `Withdrawal Completed` | `Your withdrawal of RM{amount} has been completed.` | Requesting investor (`requested_by_user_id`) | platform only | `notes/service.ts:markWithdrawalCompleted` when type is `INVESTOR_WITHDRAWAL`. Not sent for issuer disbursement / residual / admin-adjustment. Retry 409 does not re-send. Idempotency `withdrawal:{id}:notif:investor_withdrawal_completed:user:{userId}`. |
| `deposit_name_check_rejected` | LIVE | `Deposit Verification Failed` | `Your deposit could not be verified and will be returned.` | Members of the deposit's investor organization | platform only | `payment/admin-service.ts:rejectNameCheck` — event `NAME_CHECK_REJECTED`. `GatewayPayment` has no depositor user id; ownership is `investor_organization_id`. Gated to `INVESTOR_DEPOSIT`. Idempotency per payment + type + user. |
| `deposit_refund_initiated` | LIVE | `Refund Started` | `A refund for your deposit of RM{amount} has been initiated.` | Members of the deposit's investor organization | platform only | `refund-service.ts:initiateGatewayPaymentRefund` — event `REFUND_INITIATED`. Gated to `INVESTOR_DEPOSIT`. |
| `deposit_refunded` | LIVE | `Refund Completed` | `Your refund of RM{amount} has been completed.` | Members of the deposit's investor organization | platform only | `refund-service.ts:completeGatewayPaymentRefund` — event `REFUNDED`, after the wallet-reversal transaction commits. Gated to `INVESTOR_DEPOSIT`. |

**`DEAD_NOT_CONFIGURABLE` (added 2026-08-25):** `login_new_device`, `kyc_approved`, `kyc_rejected`,
and `application_approved` have zero automatic send path and never appeared in the end-user Account
settings preferences page (that page only renders `MARKETING`-category types). They previously *did*
still appear as platform/email toggles in **Admin → Settings → Notifications → Configuration**, since
that tab lists every `SYSTEM`/`AUTHENTICATION`-category type regardless of `user_configurable` — an
admin could toggle a notification that could never fire. Fixed by hiding these 4 type IDs from that
tab's rendering only (`apps/admin/src/app/settings/notifications/page.tsx`, a client-side filter). Not
removed from `notification_types`/`seed-data.ts`/`registry.ts`: that table has cascade-delete foreign
keys from real `notifications`/`user_notification_preferences` rows, and the Logs tab's type filter
still needs every type to be enumerable for filtering historical sends. See §9 #14.

### 3.3 Seed name vs inbox title mismatches

`seed-data.ts` `name` is what an **admin** sees when picking a notification type (e.g. in the bulk
broadcast tool and preference screens); `registry.ts` `title` is what the **user** sees in their
inbox. These 28 differ. None is a defect — they serve different audiences — but do not assume one
from the other:

| Type ID | Admin-facing seed name | User-facing inbox title |
|---|---|---|
| `onboarding_approved` | Onboarding Approved | Onboarding Approved |
| `onboarding_rejected` | Onboarding Rejected | Onboarding Rejected |
| `kyc_approved` | KYC Approved | Identity Verification Approved |
| `kyc_rejected` | KYC Rejected | Identity Verification Rejected |
| `contract_offer_sent` | Facility Offer **Sent** | Facility Offer **Received** |
| `invoice_offer_sent` | Invoice Offer **Sent** | Invoice Offer **Received** |
| `offer_expiry_reminder_24h` | Offer Expiry Reminder | Offer Expiring Soon |
| `application_resubmitted_confirmation` | Application Resubmitted Confirmation | Application Resubmitted |
| `application_withdrawn_confirmation` | Application Withdrawn Confirmation | Application Withdrawn |
| `director_shareholder_action_required` | Director/Shareholder Action Required | Action Required: Complete Director/Shareholder Onboarding |
| `investor_director_shareholder_action_required` | Investor Director/Shareholder Action Required | Action Required: Complete Director/Shareholder Onboarding |
| `note_funding_succeeded` | Note funding succeeded | Funding closed successfully |
| `note_funding_failed_issuer` | Note funding failed | Note funding did not complete |
| `note_funding_failed_investor` | Note funding failed | Commitment released |
| `note_active_issuer` | Note active | Your Note Is Active |
| `note_active_investor` | Note active | Your Investment Is Active |
| `note_payment_received` | Note repayment recorded | Repayment Received |
| `note_settlement_posted` | Note settlement posted | Settlement Posted |
| `note_defaulted` | Note defaulted (issuer) | Your Note Is in Default |
| `withdrawal_submitted_to_trustee` | Withdrawal submitted to trustee | Withdrawal Submitted to Trustee |
| `application_submitted_confirmation` | Application Submitted Confirmation | Application Submitted |
| `contract_signing_deadline_extended` | Facility Signing Deadline Extended | Signing Deadline Extended |
| `invoice_signing_deadline_extended` | Invoice Signing Deadline Extended | Signing Deadline Extended |
| `note_payment_rejected` | Repayment rejected | Repayment Rejected |
| `withdrawal_completed` | Disbursement completed | Your Disbursement Is Complete |
| `deposit_name_check_rejected` | Deposit verification failed | Deposit Verification Failed |
| `deposit_refund_initiated` | Deposit refund started | Refund Started |
| `deposit_refunded` | Deposit refund completed | Refund Completed |
| `investor_withdrawal_submitted` | Withdrawal submitted | Withdrawal Submitted |
| `investor_withdrawal_completed` | Withdrawal completed | Withdrawal Completed |

---

## 4. Notification types with no one-to-one audit event

Not every notification maps to an audit event, and not every audit event deserves a notification.
These are the notifications that exist **independently** of a single event.

**`offer_expiry_reminder_24h`**
- **STATUS:** LIVE
- **BUSINESS TRIGGER:** The expiry sweep finds an offer approaching its deadline. Nothing has
  changed in the domain yet, so **no audit event is written**. The offer only produces an event
  later, if it actually lapses.
- **RECIPIENT:** issuer org owner + `OWNER`/`ORGANIZATION_ADMIN` members
- **CHANNEL:** platform + email
- **RELATED EVENTS:** `CONTRACT_OFFER_EXPIRED` / `INVOICE_OFFER_EXPIRED` — the *later* consequence
- **SOURCE:** `lib/jobs/acceptance-signing-expiry.ts` (~572)
- **NOTES:** The `_24h` suffix is a misnomer — the same type is reused for **every** configured
  reminder day. The copy itself is dynamic (`in N days`), so there is no user-visible defect.
  Invoice reminder payloads omit `invoiceNumber`, so invoice reminders read more generically than
  contract reminders.

**`director_shareholder_action_required` / `investor_director_shareholder_action_required`**
- **STATUS:** LIVE
- **BUSINESS TRIGGER:** A CTOS organization report insert reveals new directors or shareholders who
  must complete their own onboarding; also triggerable from an admin API. This is a *derived*
  condition, not a discrete logged event.
- **RECIPIENT:** organization **owner only** — the narrowest audience in the system
- **CHANNEL:** platform + email, not user-configurable
- **RELATED EVENTS:** loosely related to `EOD_APPROVED`/`EOD_REJECTED`/`EOD_WEBHOOK`, which record
  the eventual outcome. There is **no** event for "we asked them".
- **SOURCE:** `director-shareholder-notifications.ts` (~172, ~246); triggered from
  `ctos-report-service.ts` (~371, ~551) and `admin/service.ts` (~2993)
- **NOTES:** One notification per newly-discovered party.

**`system_announcement` / `new_product_alert`**
- **STATUS:** BULK-ONLY — registry entries with no hardcoded send path
- **BUSINESS TRIGGER:** An admin composes a broadcast. See §6.2.
- **NOTES:** `sendBulkNotification` supplies **admin-typed** `title` and `message` and never calls
  `getNotificationContent`, so the registry templates for these two are effectively unused
  placeholder copy.

**Dead registry entries with no trigger of any kind:** `kyc_approved`, `kyc_rejected`,
`login_new_device`, `application_approved`. All four are cleanup candidates, not coverage gaps —
each has either a live replacement or no supporting feature. See
`audit-product-gap-review.md` §3.1.

**Events that deliberately have no notification.** The following are logged but intentionally
silent, because a later, larger milestone carries the user-facing message:
`ONBOARDING_APPROVED` (superseded by `FINAL_APPROVAL_COMPLETED`), `SSM_APPROVED`,
`TNC_APPROVED`, `SETTLEMENT_APPROVED`, all
`SHORAKA_*`, all prospectus events, all letter-generation events.
`APPLICATION_SUBMITTED`, `WITHDRAWAL_COMPLETED` (issuer financing disbursement only),
`PAYMENT_REJECTED`, `NAME_CHECK_REJECTED`, `REFUND_INITIATED`, and `REFUNDED` **now notify**
(2026-08-25 coverage pass — see §3.2). Remaining silent candidates are tracked in
`audit-product-gap-review.md` §3.2 — **do not infer a requirement from the absence.**
(`AML_APPROVED` is excluded from this list: it is `UNREACHABLE`, not merely silent — see §2.3.
The live AML milestone, `ONBOARDING_STATUS_UPDATED` + `metadata.amlApproved:true`, is covered by
§13 of the Pass B notification policy review below and is currently silent for the same
"intermediate admin gate" reason.)

---

## 5. Event → Notification cross reference

Every event that fires a notification, plus the notable events that do not.

### 5.1 Events that DO notify

```
FINAL_APPROVAL_COMPLETED
  Audit: YES (onboarding_logs)
  Notification: onboarding_approved
  Recipient: applicant only
  Channel: platform + email

ONBOARDING_REJECTED
  Audit: YES (onboarding_logs)
  Notification: onboarding_rejected
  Recipient: applicant only
  Channel: platform + email

COD_REJECTED
  Audit: YES (onboarding_logs)
  Notification: onboarding_rejected   ← same type as the individual path
  Recipient: applicant only
  Channel: platform + email

PASSWORD_CHANGED (security_logs)
  Audit: YES
  Notification: password_changed
  Recipient: the user
  Channel: platform + email
  Note: the event is also written on failure; the notification fires only on success

APPLICATION_REJECTED
  Audit: YES
  Notification: application_rejected
  Recipient: issuer owner + org admins
  Channel: platform + email

APPLICATION_RESUBMITTED (rich amendment path only)
  Audit: YES
  Notification: application_resubmitted_confirmation
  Recipient: issuer owner + org admins
  Channel: platform only

APPLICATION_WITHDRAWN / CONTRACT_WITHDRAWN / INVOICE_OFFER_REJECTED
  Audit: YES
  Notification: application_withdrawn_confirmation
  Recipient: issuer owner + org admins
  Channel: platform only
  Note: three different events share one notification type

APPLICATION_COMPLETED
  Audit: YES
  Notification: application_completed
  Recipient: issuer owner + org admins
  Channel: platform only

APPLICATION_SUBMITTED
  Audit: YES
  Notification: application_submitted_confirmation
  Recipient: issuer owner + org admins
  Channel: platform only
  Note: session toast on the submitter's browser already exists; this is the persistent org-admin inbox confirmation, matching resubmit

CONTRACT_SIGNING_DEADLINE_EXTENDED
  Audit: YES
  Notification: contract_signing_deadline_extended
  Recipient: issuer owner + org admins
  Channel: platform + email
  Idempotency: includes the new signingExpiresAt

INVOICE_SIGNING_DEADLINE_EXTENDED
  Audit: YES
  Notification: invoice_signing_deadline_extended
  Recipient: issuer owner + org admins
  Channel: platform + email
  Idempotency: includes invoiceId + signingExpiresAt

CONTRACT_FACILITY_DISABLED
  Audit: YES
  Notification: facility_disabled
  Recipient: issuer owner + org admins
  Channel: platform + email
  Idempotency: includes contractId + facilityDisabledAt so a later re-disable still notifies

AMENDMENTS_SUBMITTED
  Audit: YES
  Notification: application_amendments_requested
  Recipient: issuer owner + org admins
  Channel: platform + email

CONTRACT_OFFER_SENT
  Audit: YES
  Notification: contract_offer_sent
  Recipient: issuer owner + org admins
  Channel: platform + email

INVOICE_OFFER_SENT
  Audit: YES
  Notification: invoice_offer_sent
  Recipient: issuer owner + org admins
  Channel: platform + email

CONTRACT_OFFER_RETRACTED / INVOICE_OFFER_RETRACTED
  Audit: YES
  Notification: offer_retracted_or_reset
  Recipient: issuer owner + org admins
  Channel: platform only

CONTRACT_OFFER_EXPIRED / INVOICE_OFFER_EXPIRED
  Audit: YES
  Notification: offer_expired
  Recipient: issuer owner + org admins
  Channel: platform + email

(acceptance-document review — no dedicated event type)
  Audit: only the generic SECTION/ITEM_REVIEWED_AMENDMENT_REQUESTED row
  Notification: acceptance_document_changes_requested
  Recipient: issuer owner + org admins
  Channel: platform only

PUBLISH
  Audit: YES (note_events)
  Notification: note_published
  Recipient: issuer org owner + ALL members
  Channel: platform only

CLOSE_FUNDING
  Audit: YES
  Notification: note_funding_succeeded
  Recipient: issuer org owner + ALL members
  Channel: platform only

FAIL_FUNDING
  Audit: YES
  Notification: note_funding_failed_issuer + note_funding_failed_investor
  Recipient: issuer org (all members) + investor orgs with commitments
  Channel: platform only

ACTIVATE
  Audit: YES
  Notification: note_active_issuer + note_active_investor
  Recipient: issuer org (all members) + confirmed investors
  Channel: platform only
  Note: the MANUAL activate() API writes ACTIVATE and fires both note_active_*.
        Issuer disbursement completion writes WITHDRAWAL_COMPLETED (not ACTIVATE),
        keeps issuer withdrawal_completed, and sends note_active_investor only.

PAYMENT_RECEIVED / PAYMENT_APPROVED
  Audit: YES
  Notification: note_payment_received
  Recipient: confirmed investors on the note
  Channel: platform only

SETTLEMENT_POSTED
  Audit: YES
  Notification: note_settlement_posted (investors) + note_repaid_issuer (issuer)
  Recipient: settlement investor orgs; issuer org all members
  Channel: platform only

SETTLEMENT_TRUSTEE_INSTRUCTION_COMPLETED
  Audit: YES
  Notification: note_repaid_issuer
  Recipient: issuer org, all members
  Channel: platform only

OVERDUE_LATE_CHARGE_CHECKED
  Audit: YES
  Notification: note_arrears + note_arrears_investor  (only when arrears is entered)
  Recipient: issuer org (all members) + confirmed investors
  Channel: platform only

NOTE_DEFAULT_MARKED
  Audit: YES
  Notification: note_defaulted + note_defaulted_investor
  Recipient: issuer org (all members) + confirmed investors
  Channel: platform only

WITHDRAWAL_SUBMITTED_TO_TRUSTEE
  Audit: YES
  Notification: withdrawal_submitted_to_trustee
  Recipient: issuer org owner + ALL members
  Channel: platform only

PAYMENT_REJECTED
  Audit: YES
  Notification: note_payment_rejected
  Recipient: issuer org owner + ALL members
  Channel: platform only
  Idempotency: includes paymentId

WITHDRAWAL_COMPLETED
  Audit: YES
  Notification: withdrawal_completed (issuer) + note_active_investor (confirmed investors)
                ← ISSUER_DISBURSEMENT only; note_active_investor only when that path
                also activates the note. Does not write ACTIVATE or send note_active_issuer.
  Recipient: issuer org owner + ALL members; confirmed investors on the note
  Channel: platform only
  Idempotency: withdrawalId (issuer); note:lifecycle:{noteId}:active:investor (investors)
  Guard: isIssuerFinancingDisbursement; residual/investor/admin-adjustment stay silent

NAME_CHECK_REJECTED
  Audit: YES (gateway_payment_events)
  Notification: deposit_name_check_rejected  ← INVESTOR_DEPOSIT only
  Recipient: members of the deposit's investor organization
  Channel: platform only
  Idempotency: gateway-payment:{id}:notif:{type}:user:{userId}:name_check_rejected

REFUND_INITIATED
  Audit: YES
  Notification: deposit_refund_initiated  ← INVESTOR_DEPOSIT only
  Recipient: members of the deposit's investor organization
  Channel: platform only

REFUNDED
  Audit: YES
  Notification: deposit_refunded  ← INVESTOR_DEPOSIT only
  Recipient: members of the deposit's investor organization
  Channel: platform only
  Trigger: after wallet-reversal transaction commits

SIGNING_PACKAGE_SENT
  Audit: YES
  Notification: NO registry notification.
                A DIRECT SES EMAIL goes to each signer instead — see §6.1
```

### 5.2 Notable events that do NOT notify

```
APPLICATION_CREATED              Audit: YES   Notification: NO
ONBOARDING_APPROVED              Audit: YES   Notification: NO (deferred to FINAL_APPROVAL_COMPLETED)
AML_APPROVED                     Audit: N/A — UNREACHABLE, never written (see §2.3)
ONBOARDING_STATUS_UPDATED        Audit: YES   Notification: NO (live AML milestone; intermediate)
  {amlApproved:true}
SSM_APPROVED                     Audit: YES   Notification: NO (intermediate admin gate)
TNC_APPROVED                     Audit: YES   Notification: NO
CONTRACT_OFFER_ACCEPTED          Audit: YES   Notification: NO (APPLICATION_COMPLETED covers it)
INVOICE_OFFER_ACCEPTED           Audit: YES   Notification: NO
SETTLEMENT_APPROVED              Audit: YES   Notification: NO
All SECTION_/ITEM_REVIEWED_*     Audit: YES   Notification: NO (batched into AMENDMENTS_SUBMITTED)
All prospectus events            Audit: YES   Notification: NO
All SHORAKA_* events             Audit: YES   Notification: NO
All legal-document events        Audit: YES   Notification: NO
All product events               Audit: YES   Notification: NO
Gateway diagnostic events        Audit: YES   Notification: NO
CONTRACT_FACILITY_ENABLED        Audit: YES   Notification: NO (investigated 2026-08-25 — OPTIONAL)
CONTRACT_FACILITY_FEE_WAIVED     Audit: YES   Notification: NO (investigated 2026-08-25 — KEEP_SILENT)
INVOICE_WITHDRAWN                Audit: YES   Notification: NO (investigated 2026-08-25 — OPTIONAL)
SIGNING_PACKAGE_VOIDED           Audit: YES   Notification: NO (investigated 2026-08-25 — OPTIONAL)
UNPUBLISH / PAUSE_LISTING / RESUME_LISTING  Audit: YES   Notification: NO (investigated 2026-08-25)
ISSUER_PAYMENT_SUBMITTED         Audit: YES   Notification: NO (investigated 2026-08-25 — KEEP_SILENT)
LATE_CHARGE_APPROVED             Audit: YES   Notification: NO (investigated 2026-08-25 — OPTIONAL)
WITHDRAWAL_TRUSTEE_EMAIL_SENT    Audit: YES   Notification: NO registry (direct SES to trustee; not issuer notify)
SETTLEMENT_TRUSTEE_EMAIL_SENT    Audit: YES   Notification: NO registry (direct SES to trustee; not issuer notify)
SOPHISTICATED_STATUS_UPDATED     Audit: YES   Notification: NO (investigated 2026-08-25 — OPTIONAL)
ONBOARDING_CANCELLED             Audit: YES   Notification: NO (investigated 2026-08-25 — KEEP_SILENT)
```

---

## 6. Communications outside the notification registry

### 6.1 Direct emails (bypass the registry entirely)

These never create a `Notification` row and are not governed by user preferences or seed channel
defaults. They are sent straight through SES.

| Purpose | Recipient | Trigger / source | Related event |
|---|---|---|---|
| Signature request / reminder | Each signer's email — **not necessarily a platform user** | `signing/service.ts:sendEnvelope` (~1264), `remindRecipient` (~2084). Subject: `Signature requested: {title}` or `Reminder: {title}`; body includes "You have been asked to sign **{title}**" and an IC confirmation note | `SIGNING_PACKAGE_SENT` — but note the audit row is written **only if email delivery succeeds** |
| Withdrawal trustee instruction PDF | Configured trustee email (+ optional CC from trustee letter config) | `notes/service.ts:deliverWithdrawalTrusteeEmail` → `sendTrusteeInstructionPdfEmail`. Auto-send on `markWithdrawalSubmitted` when enabled; also `resendWithdrawalTrusteeEmail`. Audit row only after persist of `trustee_email_sent_at` | `WITHDRAWAL_TRUSTEE_EMAIL_SENT` (`resend: true` on redelivery). Not the issuer platform notification. |
| Settlement trustee instruction PDF | Configured trustee email (+ optional CC) | `notes/service.ts:deliverSettlementTrusteeEmail` → `sendTrusteeInstructionPdfEmail` (kind `SETTLEMENT`). Auto-send on `markSettlementTrusteeLetterSubmitted` when enabled; also `resendSettlementTrusteeEmail` | `SETTLEMENT_TRUSTEE_EMAIL_SENT` (`resend: true` on redelivery). |
| Organization member invitation | Invitee email | `organization/service.ts:inviteMember` (~967) | none |
| Organization invitation resend | Invitation email | `organization/service.ts:resendInvitation` (~1346) | none |
| Admin portal invitation | Invitee email | `admin/service.ts:inviteAdmin` (~1956) | none |
| Admin invitation resend | Invitation email | `admin/service.ts:resendInvitation` (~2242) | none |
| Director CTOS verification link | Supplementary party email | `organization/service.ts:sendDirectorCtosPartyOnboarding` (~2080) → `lib/email/ses.ts:sendOnboardingEmail` | none |
| RegTank onboarding fallback | Individual verification recipient | `lib/email/ses.ts:sendOnboardingEmail` | none |

Registry-backed notifications that *do* send email use `email-templates.ts:buildNotificationEmail`.

### 6.2 Admin bulk broadcast

A separate mechanism from the per-user registry, and easy to mistake for it.

| | Registry (`sendTyped*`) | Bulk broadcast (`sendBulkNotification`) |
|---|---|---|
| Copy source | `registry.ts` templates via `getNotificationContent` | **Admin-typed** `title` and `message` — templates are never consulted |
| Type id | Hardcoded at the call site | **Admin-selected**; the schema accepts any `z.string()` that satisfies the `notification_types` foreign key |
| Audience | Resolved by a recipient helper | `ALL_USERS` \| `INVESTORS` \| `ISSUERS` \| `SPECIFIC_USERS` \| `GROUP` |
| Channels | Seed defaults + user preferences | Admin sets `sendToPlatform` / `sendToEmail` explicitly |
| Audit | One `notifications` row per user | One `notifications` row per user **plus one `notification_logs` row per broadcast** |

`notification_logs` (`schema.prisma:2052`) records `admin_user_id`, `target_type`,
`notification_type_id`, the admin's `title`/`message`, `recipient_count`, `success_count`,
`failed_count`, and the standard forensic columns. **Source:** `notification/controller.ts` (~333)
→ `notification/service.ts:sendBulkNotification` (~489).

---

## 7. Counts

Reconciled against source on **2026-08-26** for scheduled-job attribution, platform finance settings history, and investor cash-withdrawal notifications. Prior store totals were reconciled **2026-08-25**.
Where these differ from earlier documents, **these numbers supersede them** — see §9. Audit event
live totals last changed when `PLATFORM_FINANCE_SETTINGS_UPDATED` was added (documented 162→163 live 139→140). Notification totals last
changed in this same pass (registry 45→51, live automatic 39→45): +2 investor cash-withdrawal types, and source already included 4 facility-fee / excess-late-charge types that predated the previous documented 45/39.

### 7.1 Events

| Store | Documented | Live | Not live | Breakdown of "not live" |
|---|---|---|---|---|
| `access_logs` | 14 | 4 | 10 | 6 declared-but-written-elsewhere, 1 seed-only, 3 unreachable (`ROLE_ADDED`, `ROLE_REMOVED`, `ONBOARDING_RESET` — reclassified 2026-08-25, see §9 #12) |
| `security_logs` | 10 | 10 | 0 | — |
| `onboarding_logs` | 27 | 21 | 6 | ~~3 seed-only~~ **2 seed-only, 1 dead** (`KYB_APPROVED` reclassified SEED_ONLY → DEAD 2026-08-25 — zero occurrences in `seed.ts`, unlike the other two; see §9 #13), 1 dev-only, 2 unreachable (`AML_APPROVED` — reclassified 2026-08-24; `ONBOARDING_RESET` — reclassified 2026-08-25, see §9 #11–#12) |
| `application_logs` | 45 | 43 | 2 | 2 dead (`APPLICATION_APPROVED`, `CONTRACT_OFFER_REJECTED`) |
| `note_events` | ~~43~~ ~~42~~ **44** | **44** | ~~1~~ **0** | 2026-08-26: settlement trustee family is `SETTLEMENT_TRUSTEE_*` only. Earlier post-rebase: added `WITHDRAWAL_TRUSTEE_EMAIL_SENT` and the settlement trustee email writer from main. Earlier: `ISSUER_RESIDUAL_WITHDRAWAL_CREATED` removed 2026-08-25 |
| `legal_document_audit_logs` | 7 | 7 | 0 | — |
| `product_logs` | 5 | 3 | 2 | 2 unreachable (writer exists, no caller) |
| `gateway_payment_events` | 11 | 8 | 3 | 3 dead (`OVERRIDE_*`) — investigated 2026-08-25, retained: real Prisma enum, removal would require a schema migration (see §9 #13) |
| **Total** | ~~161~~ ~~160~~ ~~162~~ **163** | ~~137~~ ~~139~~ **140** | ~~24~~ **23** | 2026-08-26: +1 live `security_logs.PLATFORM_FINANCE_SETTINGS_UPDATED`. Earlier 2026-08-26: +2 live `note_events` trustee-email writers from main. 2026-08-25: `note_events.ISSUER_RESIDUAL_WITHDRAWAL_CREATED` removed (−1 documented, −1 not-live) |

Not counted as events above, documented separately:

| Kind | Count | Items |
|---|---|---|
| `NOT_AN_ACTUAL_EVENT` | 2 | `OFFER_EXPIRED` (a status string in two issuer label maps), `DIRECTOR_KYC_STATUS_UPDATED` (no longer exists in the repository) |
| `DISPLAY_ALIAS` | 8 | `NOTE_CREATED`, `NOTE_DRAFT_UPDATED`, `NOTE_PUBLISHED`, `NOTE_UNPUBLISHED`, `NOTE_FUNDING_CLOSED`, `NOTE_FUNDING_FAILED`, `NOTE_ACTIVATED`, `PAYMENT_RECORDED` |
| Admin-action-only type | 1 | `CREATE_FROM_INVOICE` — written to `note_admin_actions` but never to `note_events` |
| Non-event compliance trail | 1 | `legal_document_acceptances` (status-based, not event-typed) |

### 7.2 Notifications

| Metric | Count |
|---|---|
| Registry type ids | **51** |
| Live (≥1 hardcoded `sendTyped`/`sendTypedPlatformOnly` call site) | **45** |
| Bulk-broadcast-only | **2** (`system_announcement`, `new_product_alert`) |
| Dead (zero send path) | **4** (`kyc_approved`, `kyc_rejected`, `login_new_device`, `application_approved`) — **DEAD_NOT_CONFIGURABLE**: hidden from Admin Notification Configuration; retained in registry/seed/history |
| Distinct **events** that fire a registry notification | **37** |
| Live events with **no** registry notification | **108** |
| Events that trigger a **direct email** instead | **3** (`SIGNING_PACKAGE_SENT`, `WITHDRAWAL_TRUSTEE_EMAIL_SENT`, `SETTLEMENT_TRUSTEE_EMAIL_SENT`) |
| Direct-email paths outside the registry | **9** |

### 7.3 Surface coverage

| Surface | Events reachable |
|---|---|
| Issuer general activity — application domain (`ApplicationLogAdapter.getEventTypes()`) | 28 of 45 — but 2 of those 28 are dead, so 26 can actually render |
| Issuer general activity — onboarding (`OrganizationLogAdapter.getEventTypes()`) | 6 of 27 |
| Investor general activity — onboarding | the same 6 |
| Issuer general activity — notes (`SHARED` + `ISSUER_ONLY`) | 10 of 45 |
| Investor general activity — notes (`SHARED` + `INVESTOR_ONLY`) | 6 of 45 |
| Issuer application detail (`EVENT_LABELS` = visibility filter) | 32 keys, of which 1 (`OFFER_EXPIRED`) is not a real event and 2 are dead |
| Issuer facility detail (`LOG_LABELS` = visibility filter) | 29 keys, of which 1 (`OFFER_EXPIRED`) is not a real event and 2 are dead |
| Admin application detail (`baseLabels` + review-label map) | 41 curated labels; 1 explicitly hidden (`SIGNING_PACKAGE_COMPLETED`); 3 render via fallback (`CONTRACT_FACILITY_FEE_WAIVED` / `_DISABLED` / `_ENABLED`) |
| Admin CSV export (`contract-activity-csv.ts`) | 32 curated labels; the whole invoice family exports via title-case fallback |
| Admin note detail | all note events, **capped at the 50 most recent** |
| Investor — application / contract / invoice / signing | **0** (hard structural exclusion) |

---

## 8. Legacy / renamed terminology

The purpose of this section is to stop future work from reintroducing names that look plausible but
are wrong. **No entry here claims a rename without source evidence.**

### 8.1 The unmerged cutover vocabulary — the biggest trap

A future/abandoned audit refactor lives in editor search indexes but **not on disk**. Files such as
`apps/api/src/modules/auth/audit/events.ts`, `security/audit/events.ts`,
`onboarding/audit/events.ts`, `applications/audit/events.ts`, `signing/audit/events.ts`, and
`*/audit/cutover.test.ts` return index hits and will happily show you contents that **no longer
exist in the repository**.

**CURRENT EVENT TYPE:** the values documented in §2
**OLD / LEGACY TERM:** `USER_LOGGED_IN`, `USER_LOGGED_OUT`, `USER_SIGNED_UP`,
`USER_ONBOARDING_STATUS_UPDATED`, `ONBOARDING_STATUS_CHANGED`,
`ONBOARDING_FINAL_APPROVAL_COMPLETED`, `INVESTOR_SOPHISTICATED_STATUS_UPDATED`,
`CONTRACT_ACCEPTANCE_SUBMITTED`, `CONTRACT_ACCEPTANCE_CHANGES_REQUESTED`,
`CONTRACT_CUSTOMER_LARGE_PRIVATE_UPDATED`, `SIGNING_PACKAGE_DECLINED`, `SIGNING_PACKAGE_EXPIRED`,
`BOARD_RESOLUTION_UPLOADED`, `BOARD_RESOLUTION_REMOVED`, `DIRECTOR_KYC_STATUS_UPDATED`, and the
various `ADMIN_*` / `ORGANIZATION_*` security names
**RELATION:** **`NOT_AN_ACTUAL_EVENT`** — these are indexed artifacts of an unmerged branch. They
have never been production `event_type` values on this branch. Verify with `ls`/`cat` before acting
on any index hit under a `*/audit/` path.

**Exception (2026-08-26):** `PLATFORM_FINANCE_SETTINGS_UPDATED` is now a live `security_logs` writer
for Admin platform-finance settings change history (`previousValues` / `nextValues`). It is no
longer an unmerged-index artifact.

Specifically: **`CONTRACT_ACCEPTANCE_SUBMITTED` is not a renamed form of
`CONTRACT_OFFER_ACCEPTANCE_SUBMITTED`.** It is a name from the unmerged vocabulary. Only
`CONTRACT_OFFER_ACCEPTANCE_SUBMITTED` has ever been written. The one exception in that family is
`CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING`, which **is** a real, live enum value — note it lacks the
`OFFER_` infix that its siblings have, which is itself a naming inconsistency, not a rename.

### 8.2 Enum names whose business meaning differs from the literal name

These are the real, live events where the name will mislead you.

**CURRENT EVENT TYPE:** `CONTRACT_WITHDRAWN`
**OLD / LEGACY TERM:** conceptually "contract offer rejected / declined by the issuer"
**RELATION:** `CONCEPTUAL_ALIAS` — the enum name was never renamed; the *meaning* drifted. The
correctly-named `CONTRACT_OFFER_REJECTED` exists but is dead. Admin labels deliberately say
"Facility Offer Rejected" for `CONTRACT_WITHDRAWN` because that is what actually happened.

**CURRENT EVENT TYPE:** `AMENDMENTS_SUBMITTED`
**OLD / LEGACY TERM:** reads as "the issuer submitted amendments"
**RELATION:** `CONCEPTUAL_ALIAS` — it actually means "the **admin sent** amendment requests to the
issuer". Every user-facing label states the direction correctly; only the enum name is backwards.
The issuer's response is the separate `APPLICATION_RESUBMITTED` event.

**CURRENT EVENT TYPE:** `EMAIL_CHANGED` (`security_logs`)
**OLD / LEGACY TERM:** reads as "the user changed their email address"
**RELATION:** `CONCEPTUAL_ALIAS` — it records **email verification** outcomes, success or failure.

**CURRENT EVENT TYPE:** `ROLE_REMOVED` (`security_logs`)
**OLD / LEGACY TERM:** reads as "a user lost a role"
**RELATION:** `CONCEPTUAL_ALIAS` — in `security_logs` it means an **admin role-catalogue entry was
deleted**. The "user lost a role" event is `access_logs.ROLE_REMOVED`. Same string, two tables, two
meanings.

**CURRENT EVENT TYPE:** `OVERDUE_LATE_CHARGE_CHECKED`
**OLD / LEGACY TERM:** "note entered arrears"
**RELATION:** `CONCEPTUAL_ALIAS` — there is no `NOTE_ARREARS` event. This check event is the only
audit evidence that a note entered arrears, and it also fires the arrears notifications.

**CURRENT EVENT TYPE:** `SHORAKA_ORDER_SUBMITTED`, `SHORAKA_CERTIFICATE_FETCHED`
**OLD / LEGACY TERM:** user-facing name is **Tawarruq**, not Shoraka
**RELATION:** `UI_ALIAS` — the display layer substitutes the term at render time. The stored value
keeps the `SHORAKA_` prefix.

### 8.3 Superseded events (a real replacement exists)

| Current event type | Old / legacy term | Relation | Evidence |
|---|---|---|---|
| `FINAL_APPROVAL_COMPLETED` | `USER_COMPLETED` | `DEAD_REPLACEMENT` | The only remaining `USER_COMPLETED` writer is `webhook-handler-dev.ts` (~492), which writes to the **dev** database. `auth/service.ts:cancelOnboarding` still *reads* the old value for historical rows. |
| `TNC_APPROVED` | `TNC_ACCEPTED` | `DEAD_REPLACEMENT` | `TNC_ACCEPTED` appears only in `seed.ts` (~344). The live writer `organization/service.ts:acceptTnc` writes `TNC_APPROVED`. |
| `ONBOARDING_STATUS_UPDATED` + `metadata.trigger:"KYC_APPROVED"` | `KYC_APPROVED`, `KYC_STATUS_UPDATED` | `DEAD_REPLACEMENT` | Both bare forms are seed-only. The live KYC path writes the generic status event with a `trigger` discriminator. |
| *(none)* | `KYB_APPROVED` | `DEAD_REPLACEMENT` | No writer ever existed; corporate approval flows through `ONBOARDING_APPROVED`. |
| `CONTRACT_WITHDRAWN` | `CONTRACT_OFFER_REJECTED` | `DEAD_REPLACEMENT` | `CONTRACT_OFFER_REJECTED` has no writer; the decline path writes `CONTRACT_WITHDRAWN`. |
| `APPLICATION_COMPLETED` | `APPLICATION_APPROVED` | `DEAD_REPLACEMENT` | No writer for `APPLICATION_APPROVED`; the product has no distinct "approved" state. |

### 8.4 Display aliases (keep them — they render historical rows)

`note-activity-csv.ts` carries eight legacy strings alongside the live ones so that older
`note_events` rows still render with a human label instead of a title-cased raw string.

| Display alias | Live event it shadows | Relation |
|---|---|---|
| `NOTE_CREATED` | `NOTE_CREATED_FROM_INVOICE` | `UI_ALIAS` |
| `NOTE_DRAFT_UPDATED` | `UPDATE_DRAFT` | `UI_ALIAS` |
| `NOTE_PUBLISHED` | `PUBLISH` | `UI_ALIAS` |
| `NOTE_UNPUBLISHED` | `UNPUBLISH` | `UI_ALIAS` |
| `NOTE_FUNDING_CLOSED` | `CLOSE_FUNDING` | `UI_ALIAS` |
| `NOTE_FUNDING_FAILED` | `FAIL_FUNDING` | `UI_ALIAS` |
| `NOTE_ACTIVATED` | `ACTIVATE` | `UI_ALIAS` |
| `PAYMENT_RECORDED` | `PAYMENT_RECEIVED` | `UI_ALIAS` |

**Do not delete these.** They are display-only and cost nothing; removing them would degrade the
rendering of historical rows. Equally, **do not write new rows using these strings.**

### 8.5 Status strings that are not events

| String | What it really is | Relation |
|---|---|---|
| `OFFER_EXPIRED` | A contract/invoice **entity status**. It appears as a key in both issuer label maps, a leftover from when status strings keyed the timeline. | `NOT_AN_ACTUAL_EVENT` |
| `NOT_OPENED` / `OPENED` / `ACCEPTED` | `LegalAcceptanceStatus` values on `legal_document_acceptances` | `NOT_AN_ACTUAL_EVENT` |
| `APPROVED_FOR_SIGNING` | An `OfferAcceptanceStatus` phase badge, rendered product-agnostically as "Approved for Signing" | `NOT_AN_ACTUAL_EVENT` |
| `CREATE_FROM_INVOICE` | A `note_admin_actions.action_type`, never a `note_events.event_type` | Admin-action-only |

---

## 9. Reconciliation log

Corrections applied to the companion documents on 2026-08-24 after verifying against source. History
is preserved in each document via strikethrough / BEFORE-DECISION-AFTER annotations rather than
deletion.

| # | Document | Stale claim | Verified reality | Action |
|---|---|---|---|---|
| 1 | `audit-product-gap-review.md` §4.2 | "`ONBOARDING_APPROVED` and `FINAL_APPROVAL_COMPLETED` share the identical portal title 'Onboarding Approved'" | They are **distinct**: `"Onboarding Submission Approved"` vs `"Onboarding Approved"`, with different descriptions (`organization-log.ts:216–225`) | Marked RESOLVED |
| 2 | `audit-product-gap-review.md` §4.5 | "`CONTRACT_WITHDRAWN` is labeled 'Facility Offer Withdrawn' in the admin timeline and CSV — identical wording to `CONTRACT_OFFER_RETRACTED`" | `CONTRACT_WITHDRAWN` is labeled `"Facility Offer Rejected"` / `"Facility offer rejected"`; `CONTRACT_OFFER_RETRACTED` is `"Facility Offer Retracted"`. The confusing label now sits on the **dead** `CONTRACT_OFFER_REJECTED` | Rewritten with the current labels and reclassified |
| 3 | `audit-product-gap-review.md` §4.5 | Parenthetical: "the issuer-facing timeline already labels this as 'Facility withdrawn'" | Issuer copy is `"You declined the facility offer"` | Corrected |
| 4 | `audit-product-gap-review.md` §4.6 | "`AMENDMENTS_SUBMITTED` issuer-facing label reads 'You submitted requested changes'" | Both issuer surfaces read `"Changes requested"` | Marked RESOLVED |
| 5 | `audit-product-gap-review.md` §4.10 | "Product-log panel only styles CREATED/UPDATED/DELETED; INACTIVATED/REACTIVATED fall back to a raw badge" | All five have labels and colours in `product-logs-panel.tsx:39–43`. The real issue is that the two writers are **unreachable** | Marked RESOLVED and replaced with the accurate finding |
| 6 | `audit-product-gap-review.md` §5 | "`DIRECTOR_KYC_STATUS_UPDATED` has a writer module (`director-kyc-outcomes.ts`) with zero importers" | The module **does not exist** and the string has **zero occurrences** in the repository | Reclassified `NOT_AN_ACTUAL_EVENT`; dead-event total corrected |
| 7 | `audit-product-gap-review.md` §5 | "`BOARD_RESOLUTION_UPLOADED` / `BOARD_RESOLUTION_REMOVED` — never referenced outside `cutover.test.ts`" | `cutover.test.ts` does not exist; both strings have zero occurrences | Reclassified as unmerged-branch artifacts |
| 8 | `audit-product-gap-review.md` §1, §5 | Dead-event total of 17 | 19 non-live values across the eight stores, using precise classifications | Superseded by §7.1 here |
| 9 | All four documents | No stated division of responsibility; each read as a competing source of truth | — | Responsibility header added to each, cross-referencing §0.1 |
| 10 | All four documents | No warning about the stale `*/audit/events.ts` index entries | The vocabulary in those index hits is not real | Warning added; full detail in §8.1 |
| 11 | This document (previously) | `AML_APPROVED` classified **LIVE** | Re-traced from source 2026-08-24: the route (`POST /v1/admin/onboarding-applications/:id/approve-aml`), service (`approveAmlScreening`), SDK method, and `useApproveAmlScreening` hook all exist, but **zero `.tsx` files call the hook**. It is designed manual-override plumbing that has never been wired into the Admin UI. Live AML progression is fully automatic via `maybeAdvanceOrgAfterAmlScreeningCleared`, which writes `ONBOARDING_STATUS_UPDATED` + `metadata.amlApproved:true`. Standalone `KYC_APPROVED` remains SEED_ONLY; the live KYC audit trail is `ONBOARDING_STATUS_UPDATED` + `metadata.trigger:"KYC_APPROVED"` | Reclassified **UNREACHABLE**; §2.3, §7.1 totals, and §4/§5 notification cross-references updated (Live 142→141, Not-live 19→20) |
| 12 | This document (previously, and the 2026-08-24 Pass A filter-fix rationale in `use-access-logs.ts`) | `access_logs.ROLE_ADDED`, `access_logs.ROLE_REMOVED`, `access_logs.ONBOARDING_RESET`, and `onboarding_logs.ONBOARDING_RESET` classified **LIVE** on the strength of "writer exists" alone | Re-traced from source 2026-08-25, starting from `AdminService.updateUserRoles` and `AdminService.resetOnboarding` per explicit user request. `updateUserRoles`: route `PATCH /v1/admin/users/:id/roles`, SDK method, and `useUpdateUserRoles()` hook all exist, but **zero `.tsx` callers** — the only UI path that changes portal roles is the "Portal access" panel, which calls the unrelated `useUpdateUserOnboarding` and never reaches this writer. `resetOnboarding`: route `POST /v1/admin/users/:id/reset-onboarding` exists (its own Swagger comment calls it "temporary feature for testing") but has **no SDK method, no hook, no `.tsx` caller** at all — one tier more unreachable than the roles writer. `access_logs.PROFILE_UPDATED` was re-confirmed genuinely **LIVE_UI_REACHABLE** (`useUpdateUserProfile` → `user-account-profile-panel.tsx` / `organization-member-edit-dialog.tsx`), as were all four `security_logs` additions from the same Pass A fix (`ROLE_CREATED`, `ROLE_REMOVED`, `ROLE_PERMISSIONS_UPDATED`, `INVITATION_REVOKED` — all wired to `admin-permission-configuration.tsx` or `app/settings/roles/page.tsx`). Also documented two writer-behavior nuances: `ROLE_ADDED` is the fallback branch of `updateUserRoles` for *any* non-ADMIN-removal outcome (not literally "a role was added"), and `ROLE_REMOVED` fires only when `ADMIN` is specifically stripped (not "any role removed") | Reclassified **UNREACHABLE** (3 in `access_logs`, 1 in `onboarding_logs`); filter/query allowlist and code left unchanged on purpose — see the `use-access-logs.ts` comment. §1.1, §1.3, §2.1, §2.3, and §7.1 totals updated (Live 141→137, Not-live 20→24); `security_logs` additions re-confirmed with no changes |
| 13 | This document / `audit-product-gap-review.md` §5 (dead-events table) | 14 candidate `DEAD`/`SEED_ONLY` audit and notification artifacts flagged as generic "cleanup candidates" without a per-item safety verdict | **2026-08-25 cleanup pass**, verified from source, not from prior docs. **1 of 14 was safe to remove**: `note_events.ISSUER_RESIDUAL_WITHDRAWAL_CREATED` had zero writers anywhere in `apps/api/src` and existed only as one never-looked-up entry in `admin-note-events-sorting.ts`'s lifecycle-priority array — deleted from that array (and its docs mirror), `presentation-baseline.json` regenerated, full API + Admin test suites green, no schema/enum touched (the column is a plain `String`). **13 of 14 were investigated and retained**, each for a source-verified reason rather than "docs said so": (i) `KYC_STATUS_UPDATED`/`TNC_ACCEPTED`/`KYC_APPROVED`/`KYB_APPROVED` — already excluded from the default admin query allowlists (2026-08-24 pass); the remaining label/dropdown-option code exists specifically to render/filter `seed.ts`'s real historical seed rows and already degrades gracefully, so removing it has no safety benefit; (ii) `APPLICATION_APPROVED`/`CONTRACT_OFFER_REJECTED` — `apps/api/src/lib/audit/preservation.test.ts` explicitly asserts a source reference must survive for these two ("a reader/label reference to them already exists and must keep existing"); removing it would fail that regression test and reverse a documented prior design decision; (iii) `OVERRIDE_PROPOSED`/`OVERRIDE_APPROVED`/`OVERRIDE_REJECTED` — confirmed a real Prisma `enum GatewayPaymentEventType` (`schema.prisma:2272-2284`), not a plain string column; removing enum members is a migration, forbidden by this pass's "no destructive database migration" rule; the surviving read path (`getOpenOverrideProposal()`) suggests a paused feature, not cruft; (iv) `kyc_approved`/`kyc_rejected`/`login_new_device`/`application_approved` notification types — `notification_types` is a real cascading-FK-backed table (`schema.prisma:1972-2078`); removing the row (or the registry/seed-data entry that syncs it) risks orphaning or cascade-deleting historical `notifications`/`notification_logs` rows, exactly the destructive-history risk this pass must avoid; (v) `USER_COMPLETED` — confirmed `webhook-handler-dev.ts` is an intentionally-live-registered dev-only testing route (writes to `DATABASE_URL_DEV`, never production data), not obsolete, so out of scope per explicit instruction. **Correction (same day, re-verified against fresh source):** `KYB_APPROVED` in group (i) is not actually `SEED_ONLY` like the other three — it has **zero** occurrences in `seed.ts` as well, so it is `DEAD`, not `SEED_ONLY` (only the classification label changed; the retain decision and reasoning in (i) are unchanged). Also, `notification_types` cascade FKs in (iv) are from `notifications` and `user_notification_preferences` only — `notification_logs`'s FK has no explicit `onDelete` (defaults to `RESTRICT`), not `Cascade`. And none of the 4 dead notification types in (iv) show as end-user toggles in Account settings (that page filters to `category === "MARKETING"`, and all 4 are `SYSTEM`/`AUTHENTICATION`); they instead show as global platform/email toggles in Admin → Settings → Notifications → Configuration, which lists every `SYSTEM`/`AUTHENTICATION` type regardless of `user_configurable` | Removed 1 (`note_events.ISSUER_RESIDUAL_WITHDRAWAL_CREATED`); retained 13, one relabelled `SEED_ONLY`→`DEAD` (`KYB_APPROVED`, no count-total change — see §7.1). §1.9, §2.6.3, and §7.1 totals updated (Documented 161→160, Not-live 24→23); full per-item reasoning in `audit-product-gap-review.md` §4 item 12; catalog lines updated in `audit-event-catalog.md` §1.1, §2.1, §3.1, §3.3, and §5 |
| 14 | Follow-up to #13 — narrow code cleanup on the retained items, not another investigation | Several items in #13 were retained with no code change; a second pass asked whether any *specific dead reference* within those retained items could still be cleaned safely | **2026-08-25 same-day follow-up pass.** `access_logs.USER_COMPLETED` — **CODE_REMOVED**: confirmed zero writers ever emit it into `access_logs` (only writer is `onboardingLog.create` in the dev-only regtank webhook handler, a different table/domain); removed from the `EventType` union (`packages/types/src/admin.ts`), the `AccessLog` OpenAPI enum (`swagger.ts`), and the access-log label/color/dropdown maps (`access-log-table-row.tsx`, `access-log-details-dialog.tsx`, `access-logs-toolbar.tsx`). `onboarding_logs.USER_COMPLETED` (DEV_ONLY) and its dev webhook writer, `cancelOnboarding`'s historical reader, and the split `DATABASE_URL_DEV` behavior are all untouched. `onboarding_logs.KYB_APPROVED` — **CODE_REMOVED**: unlike `KYC_STATUS_UPDATED`/`TNC_ACCEPTED`/`KYC_APPROVED` (real `seed.ts` rows, kept for historical rendering), `KYB_APPROVED` has zero occurrences anywhere including `seed.ts`, so its label-map/switch-case/union entries served no historical-compatibility purpose — removed from `OnboardingEventType` (`packages/types/src/admin.ts`), `activity-events.json`, and `organization-activity-timeline.tsx`'s label map and `buildEventDescription` switch; status stays `DEAD` (declared value, no schema/enum change). `application_logs.CONTRACT_OFFER_REJECTED` — **RETAINED, classified `HISTORICAL_COMPATIBILITY_ONLY`**: `event_type` is a plain `String`/TEXT column and a real production writer existed for this value before the live issuer-decline path was renamed to `CONTRACT_WITHDRAWN`, so historical rows may reasonably exist; removing it from `application-log.ts`'s `CONTRACT_EVENT_TYPES`/`getEventTypes()` would hide any such row from the API-served activity feed (the same `VISIBILITY_MISMATCH` risk class fixed for `ROLE_ADDED`/`ROLE_REMOVED` in #12 of the prior pass) — no code changed. `application_logs.APPLICATION_APPROVED` — **DB event stays DEAD; distinguished from an ACTIVE synthetic UI alias**: `apps/issuer/src/components/financing/facility-transactions.ts` synthesizes a display-only row with `eventType: "APPLICATION_APPROVED"` for approved invoices (not a DB write) — that alias is live and was not touched; no code changed, only documented (§2.4). Dead notification types (`kyc_approved`, `kyc_rejected`, `login_new_device`, `application_approved`) — **UI hidden, registry/seed retained**: added a client-side exclusion filter in `apps/admin/src/app/settings/notifications/page.tsx` so these 4 no longer appear as platform/email toggles in Admin → Settings → Notifications → Configuration (they never appeared in the end-user Account preferences page, which only shows `MARKETING`-category types); `notification_types`/`seed-data.ts`/`registry.ts` rows untouched (cascade-delete FK risk on real historical `notifications`/`user_notification_preferences` rows) and the Logs tab's type filter still lists them for historical-log filtering. Reclassified `DEAD` → `DEAD_NOT_CONFIGURABLE` in §3.2 | `packages/types/src/admin.ts` (2 union members removed), `packages/types/src/activity-events.json`, `apps/api/src/lib/swagger.ts`, `apps/admin/src/components/{access-log-table-row,access-log-details-dialog,access-logs-toolbar,organization-activity-timeline}.tsx`, `apps/admin/src/hooks/{use-access-logs,use-organization-logs}.ts` (comments), `apps/admin/src/app/settings/notifications/page.tsx`, `apps/api/src/lib/audit/presentation-baseline.json` (regenerated). Full API suite (269/270 suites, 2473/2474 tests — 1 known unrelated pre-existing failure in `site-document-removal.test.ts`) and full Admin suite (69/69 suites, 506/506 tests) green; typecheck clean for `api` and `admin`; `packages/types` rebuilt | 2 **CODE_REMOVED** (`access_logs.USER_COMPLETED`, `onboarding_logs.KYB_APPROVED`); 1 **RETAINED — HISTORICAL_COMPATIBILITY_ONLY** (`CONTRACT_OFFER_REJECTED`); 1 **documented distinction, no change** (`APPLICATION_APPROVED` DB-dead vs. synthetic-UI-active); 4 notification types **UI hidden (DEAD_NOT_CONFIGURABLE), registry retained**. No schema/enum/DB migration; no historical row rewritten; no runtime business behavior changed |
| 15 | Focused user-notification coverage pass (not audit cleanup) | Nine LIVE business events had audit/log writers but no registry notification | **2026-08-25.** Added 9 live notification types, triggered from the same successful mutation path as the existing audit event. No audit events added/renamed/deleted. Recipients follow existing helpers: application domain → owner+org admins (`sendTyped`); note lifecycle → all issuer org members (`sendTypedPlatformOnly`); gateway deposits → members of the deposit's investor org (`sendTypedPlatformOnly`) because `GatewayPayment` has no depositor `user_id`. `WITHDRAWAL_COMPLETED` is type-gated to `ISSUER_DISBURSEMENT`. Gateway types use per-payment+user idempotency keys so webhook retries do not duplicate. Session toast on application submit already existed and is not treated as a duplicate of the persistent org-admin inbox confirmation (same pattern as resubmit). | `registry.ts`, `seed-data.ts`, application/admin/notes/payment services, `note-lifecycle-notifications.ts`, `gateway-payment-notifications.ts`, focused tests, presentation baseline regenerated | Live notification types 30→39; dead still 4; bulk-only still 2; events-with-notification 28→37; live-events-without-notification 114→105. Audit event counts unchanged. |




