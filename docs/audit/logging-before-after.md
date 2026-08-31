# Logging and notifications — BEFORE vs AFTER

Evidence report. Not a product spec.

| | Git |
|---|---|
| BEFORE | `2e80520c` (`2e80520c5d350dd0b39c1a4e2f7fbb157bb06925`) |
| AFTER / current | `1deb2f8b` (`1deb2f8bc425a05f0285b4a428a968f44aedfca9`) |
| Branch | `redo_log_4` |

Method: `git show` / `git grep` / `git log -S` against those commits. Current catalogue checked against production writers. Tests and seeds are not live writers.

Do not treat this file as the source of truth for runtime. Runtime is `apps/api/src/lib/audit/visibility-matrix.ts` and the writers it names.

---

## What already existed at BEFORE

CashSouk already logged the business. The revamp did **not** invent application timelines, note timelines, onboarding logs, gateway events, legal acceptances, or the notification inbox.

At `2e80520c` production already wrote to:

| Store | What it was for | Actor model then |
|---|---|---|
| `application_logs` | Application / offer / signing package | `user_id` required; `portal` optional; **no** `source` / `actor_type` / `correlation_id` |
| `onboarding_logs` | Organisation KYC/KYB | `user_id` + `portal`; **no** `source` / `actor_type` |
| `note_events` | Note lifecycle, servicing, trustee | Already had `actor_user_id`, `portal`, `correlation_id` |
| `product_logs` | Product CRUD | `user_id` |
| `access_logs` | Login / logout / signup | `user_id`, `portal` |
| `security_logs` | Roles, password, email | `user_id` |
| `gateway_payment_events` | Name-check, refund, expiry, mismatch | `actor_user_id` |
| `legal_document_acceptances` | Logged-in legal PDF accept | Party + document hash |
| `legal_document_audit_logs` | Legal document admin lifecycle | `actor_user_id`, `correlation_id` |
| `notifications` + `notification_logs` | Inbox + delivery evidence | 36 seeded types |

**Not present at BEFORE:** `legal_external_acceptances`, `generated_document_evidence`, `ApplicationLog.actor_type` / `source` / `correlation_id`, nullable `application_logs.user_id`, signing `viewed_at`, unified `visibility-matrix.ts`.

---

## PART 1 — BEFORE inventory (`2e80520c`)

### Application logs

Enum: `apps/api/src/modules/applications/logs/types.ts` — **46** `ApplicationLogEventType` values.

Writer: `logApplicationActivity` → `createApplicationLog`. Overlay: errors swallowed. Submit log lived in the **controller after** `persistSubmittedApplication` committed (`applications/controller.ts` ~304, `catch { // swallow errors }`). The submit transaction itself did **not** write the log.

| Event | Production writer | Trigger | Who saw it |
|---|---|---|---|
| `APPLICATION_CREATED` | `applications/controller.ts` | Issuer creates draft | Issuer Activity + Admin timeline |
| `APPLICATION_SUBMITTED` | `applications/controller.ts` **after** tx | Issuer Submit | Issuer Activity + Admin timeline. **No** submit confirmation notification |
| `APPLICATION_RESUBMITTED` | controller / amendments | Issuer resubmit | Issuer + Admin |
| `APPLICATION_APPROVED` | **none** | — | Historical label only |
| `APPLICATION_REJECTED` | `admin/service.ts` | Admin reject | Issuer Activity + `application_rejected` |
| `APPLICATION_WITHDRAWN` | applications / contracts / invoices | Withdraw | Issuer + `application_withdrawn_confirmation` |
| `APPLICATION_COMPLETED` | `applications/service.ts` | Last offer accepted | Issuer + `application_completed` |
| Section / item review `*_REVIEWED_*` | `admin/service.ts` `logReviewActivity` | Admin review | Admin timeline (not user feed) |
| `AMENDMENTS_SUBMITTED` | `admin/service.ts` | Admin send amendments | Issuer Activity + `application_amendments_requested` |
| `CONTRACT_OFFER_SENT` | `admin/service.ts` | Send facility offer | Issuer + `contract_offer_sent` |
| `CONTRACT_OFFER_ACCEPTED` | `applications/service.ts` | Issuer accept | Issuer Activity |
| Facility decline | wrote **`CONTRACT_WITHDRAWN`** (`applications/service.ts` ~2886) | Issuer reject offer | Issuer Activity. Enum also had unused `CONTRACT_OFFER_REJECTED` |
| `INVOICE_OFFER_REJECTED` | `applications/service.ts` | Issuer decline invoice offer | Issuer Activity |
| `SIGNING_PACKAGE_CREATED` / `SENT` / `COMPLETED` / `VOIDED` | `signing/service.ts` | Envelope lifecycle | Admin. User feed listed **SENT** only. **Decline wrote `VOIDED`** with `void_reason: "declined"` (`signing/service.ts` ~1940–1947). Completed/void **skipped** if `created_by_user_id` was null |
| Offer expiry | `acceptance-signing-expiry.ts` | Hourly job | `CONTRACT_OFFER_EXPIRED` / `INVOICE_OFFER_EXPIRED` + `offer_expired` |

### Onboarding logs

Free-string `event_type`. Production writers in RegTank handlers, `regtank/service.ts`, `admin/service.ts`, `organization/service.ts`.

User `/activity` (`OrganizationLogAdapter`) showed only: `ONBOARDING_STARTED`, `ONBOARDING_CANCELLED`, `ONBOARDING_REJECTED`, `FINAL_APPROVAL_COMPLETED`, `ONBOARDING_APPROVED`.

COD amendment lived as forensic `ONBOARDING_STATUS_UPDATED`. There was **no** `ONBOARDING_AMENDMENT_REQUIRED` and **no** `ONBOARDING_FEE_PAID` timeline event (fee existed as a gateway purpose only).

No `MEMBER_*` organisation membership events.

### Note events

Already rich: create, publish, pause/resume, close/fail funding, activate, invest, repayment submit/receive/approve/reject, settlement preview/approve/posted, default, trustee letters, Shoraka, prospectus.

`SETTLEMENT_PREVIEWED` was a **live writer**.

Paymaster notice events: **not written** at BEFORE (`git grep PAYMASTER_NOTICE 2e80520c` — empty).

### Gateway / legal / security

Gateway wrote name-check, capture mismatch, refund, expired. `OVERRIDE_*` declared, **no write**.

Legal: in-app `LegalDocumentAcceptance` + admin `LegalDocumentAuditLog`. **No** external-guarantor table. **No** generated-document hash table.

Access: `LOGIN` / `LOGOUT` / `SIGNUP`. Security: roles, `PASSWORD_CHANGED`, `EMAIL_CHANGED`. `EMAIL_VERIFIED` existed as a **reason string**, not `eventType`.

### BEFORE notifications — 36 types

`apps/api/src/modules/notification/seed-data.ts` at `2e80520c`.

Typed production senders for the application/note/onboarding/fee set. **Catalog-only (no typed sender):** `system_announcement`, `new_product_alert` (admin bulk can still send arbitrary `typeId`).

**Not seeded at BEFORE:** submit confirmation, signing-deadline extended, facility disabled, note payment rejected, withdrawal completed, deposit name-check/refund/success, investment committed, investor withdrawal submitted/completed.

### BEFORE numbers

| | Count | How counted |
|---|---|---|
| Application log enum | 46 | `ApplicationLogEventType` |
| Unique `eventType`/`event_type` writer strings (under-count: misses some ternaries) | 83 | Scan of `apps/api/src` excluding tests |
| Production writer files (same scan) | 47 | Files matching writer patterns |
| Notification types | **36** | `seed-data.ts` `id:` |

There was **no** live-event catalogue and **no** `EVENT_LIFECYCLE`.

---

## PART 2 — CURRENT inventory (`1deb2f8b`)

Source of classification: `visibility-matrix.ts`. Recount: `apps/api/src/lib/audit/audit-recount.json`.

| Lifecycle | Count |
|---|---|
| LIVE | **145** |
| HISTORICAL_READER | **11** |
| DEV_ONLY | **7** |
| Catalogue total | **163** |
| Regex writerHits | **100** |
| unknown | **0** |

HISTORICAL (reader-only unless noted): `APPLICATION_APPROVED`, `CONTRACT_OFFER_REJECTED`, `TNC_ACCEPTED`, `KYC_APPROVED`, `USER_COMPLETED`, `SETTLEMENT_PREVIEWED`, `PRODUCT_INACTIVATED`, `PRODUCT_REACTIVATED`, `OVERRIDE_PROPOSED`, `OVERRIDE_APPROVED`, `OVERRIDE_REJECTED`.

**Exception checked:** `INVOICE_OFFER_REJECTED` is **LIVE** and still written in `applications/service.ts`.

DEV_ONLY: `WEBHOOK_*` from `webhook-handler-dev.ts`.

### Attribution (new columns / helpers)

`apps/api/src/lib/audit/context.ts` (`c775cada`, expanded `0c7dd795`):

| Helper | source | actor |
|---|---|---|
| `auditContextFromRequest` / `issuerActivityFromRequest` | `API` | USER, portal of request |
| `adminAuditContextFromRequest` | `API` | ADMIN |
| `webhookAuditContext` | `WEBHOOK` | INTEGRATION, null user |
| `systemAuditContext` | `SYSTEM_JOB` | SYSTEM |
| `internalAuditContext` | `INTERNAL` | derived / repair |

`application_logs.user_id` is nullable so jobs and webhooks are not forced to impersonate a human.

### Atomic vs overlay (current)

| Event | Behaviour |
|---|---|
| `APPLICATION_SUBMITTED` | Inside `persistSubmittedApplication` **same transaction** as `status` + `submitted_at` (`applications/service.ts` ~2194). Failed insert aborts submit. Introduced `864c294b`. |
| `APPLICATION_CREATED` | Inside `createApplication` **same transaction** as the draft `applications` row (`applications/service.ts`). Failed insert aborts create. Controller overlay removed. Hourly `application-timeline-repair.ts` remains as a **legacy/backfill** for historical missing created/submitted rows (`source=INTERNAL`, null actor). |
| Material onboarding | Same Prisma transaction as org state (`onboarding-tx.ts` / `createOnboardingLogRow`). |

### Catalogue gaps (live label, weak/no writer)

Do not demo these as new capabilities:

- `ACCOUNT_LOCKED` — no production writer
- Catalogue keys `CREATED` / `COMPLETED` / `FAILED` on `gateway_payment_events` — **not** in Prisma `GatewayPaymentEventType`. Live completion type is `GATEWAY_PAYMENT_COMPLETED`
- `PAYMENT_RECEIVED` is still written on notes (`notes/service.ts`) but is **not** a catalogue key (admin note timeline / notification `note_payment_received`)

---

## PART 3 — BEFORE vs AFTER categories

### EXISTED_BEFORE_AND_STILL_EXISTS

Most of the origination and note journey: create/submit/resubmit/reject/withdraw/complete; section/item review; offers sent/accepted/retracted/expired; invoice withdraw; signing created/sent/completed/voided; onboarding start/approve/reject/cancel/reset; note publish through default; legal in-app acceptance; gateway name-check/refund; login/logout; 36 of today’s notification *ideas* (not all IDs).

### ADDED_BY_LOGGING_REVAMP (new type, table, or user-visible milestone)

Git `-S` first appearance after `2e80520c`:

| Event / store | First commit | Writer today |
|---|---|---|
| `ApplicationLog.actor_type` / `source` / `correlation_id` | `c775cada` Redo log (#232) | `applications/logs/repository.ts` |
| `CONTRACT_OFFER_DECLINED` | `c775cada` | `applications/service.ts` (was `CONTRACT_WITHDRAWN`) |
| `application_submitted_confirmation` | `c775cada` | `applications/service.ts` |
| `EMAIL_VERIFIED` as `eventType` | `c775cada` | `auth/service.ts` |
| Deposit / investment / investor-withdrawal notification IDs | `c775cada` | `gateway-payment-notifications.ts`, `investment-notifications.ts`, `investor-withdrawal-notifications.ts` |
| `ONBOARDING_FEE_PAID`, `ONBOARDING_AMENDMENT_REQUIRED`, `MEMBER_*` | `0befd2d3` overnight | webhook / organisation service |
| `SIGNING_PACKAGE_DECLINED`, `SIGNING_PACKAGE_EXPIRED` | `0c7dd795` xhigh | `signing/service.ts` |
| `FACILITY_FEE_PAID` application log | `0c7dd795` | `payment/webhook-service.ts` |
| `APPLICATION_PROCESSING_FEE_PAID` | `0197aab9` fix log | `payment/webhook-service.ts` |
| `GATEWAY_PAYMENT_COMPLETED` | `0c7dd795` | `payment/gateway-events.ts` |
| `webhookAuditContext` / metadata sanitize | `0c7dd795` | `lib/audit/context.ts`, `sanitize-metadata.ts` |
| Signing recipient `viewed_at` | `0c7dd795` | `signing/repository.ts` (state, **not** an Activity event) |
| `generated_document_evidence` | `0c7dd795` | `generated-documents/service.ts` |
| `PAYMASTER_*`, `MARC_ASSESSMENT_SAVED` | `0b7af35f` / `0c7dd795` | paymaster services |
| `LegalExternalAcceptance` | `96e5b8a6` Feat/acceptance documents (#235) | `legal-documents/external-acceptance-service.ts` |
| Atomic `APPLICATION_SUBMITTED` + timeline repair | `864c294b` | `applications/service.ts`, `application-timeline-repair.ts` |
| Catalogue / visibility matrix | `0c7dd795` and later | `visibility-matrix.ts` |

`96e5b8a6` is on this branch history (`2e80520c..1deb2f8b`). External acceptance is **in AFTER**, even though the commit message is the acceptance-documents PR, not “Redo log”.

### EXISTED_BEFORE_BUT_CHANGED

| Topic | BEFORE | AFTER | Why |
|---|---|---|---|
| Submit actor | Overlay in controller; swallow errors | Same tx as submit (`864c294b`) | Submitter is not lost if logging fails after commit |
| Create actor | Overlay in controller after draft commit; swallow errors | Same tx as draft create | Creator is not lost if logging fails after commit |
| Facility decline name | `CONTRACT_WITHDRAWN` | `CONTRACT_OFFER_DECLINED` (`c775cada`) | Decline is not the same as withdrawing the application |
| Signing decline | `SIGNING_PACKAGE_VOIDED` + `void_reason: "declined"` | `SIGNING_PACKAGE_DECLINED` (`0c7dd795`) | Admin can tell customer decline from CashSouk void |
| Signing completed | Skipped if no `created_by_user_id` | Written with null actor + `internalAuditContext` | Envelope completion is not lost |
| User signing visibility | SENT only; COMPLETED hidden | SENT / COMPLETED / DECLINED / EXPIRED user-visible | Issuer sees the signing outcome |
| COD amendment | Forensic `ONBOARDING_STATUS_UPDATED` | Plus customer `ONBOARDING_AMENDMENT_REQUIRED` | Users are not shown provider internals |
| Fee paid | Gateway purpose + notification | Also application/org **timeline** events | Activity matches money-in |
| `SETTLEMENT_PREVIEWED` | Live note writer | HISTORICAL_READER; preview no longer writes (`0c7dd795`) | Preview is not a decision |
| Product inactivate/reactivate | Writers existed | HISTORICAL; versioning uses `PRODUCT_UPDATED` | Unmounted helpers |
| Onboarding notification id | `onboarding_approved` | `onboarding_completed` (`c775cada`) | Same journey, clearer name |
| User `/activity` allowlist | Hardcoded adapter lists | Application/org lists from `visibility-matrix.ts` | One visibility rule |
| Metadata | Raw provider-ish fields possible | `sanitize-metadata.ts` strips secrets/PII at onboarding writer | Compliance |

---

## PART 4 — Notifications BEFORE vs AFTER

Activity log ≠ notification. A timeline row can exist with no inbox message. A notification can fire with no new event type.

| | BEFORE `2e80520c` | AFTER `1deb2f8b` |
|---|---|---|
| Seeded types | **36** | **49** |
| Catalog-only (no typed sender) | `system_announcement`, `new_product_alert` | same two |
| Typed automatic senders | 34 | 47 |

### Added notification types (13)

All first appear in `seed-data.ts` at `c775cada` unless noted.

| ID | Trigger | Recipient | Why |
|---|---|---|---|
| `application_submitted_confirmation` | Issuer submit (`applications/service.ts`) | Issuer | Confirms CashSouk received the application |
| `contract_signing_deadline_extended` | Admin extend (`admin/service.ts`) | Issuer | Signing clock moved |
| `invoice_signing_deadline_extended` | Admin extend | Issuer | Same for invoice-only |
| `facility_disabled` | Admin disable facility | Issuer | Facility no longer usable |
| `note_payment_rejected` | Admin reject repayment | Issuer | Proof not accepted |
| `withdrawal_completed` | Trustee payout completed | Issuer | Money left |
| `deposit_name_check_rejected` | Deposit name-check fail | Investor | Wallet credit blocked |
| `deposit_refund_initiated` | Refund started | Investor | Refund in flight |
| `deposit_refunded` | Refund completed | Investor | Money back |
| `deposit_successful` | Deposit completed | Investor | Wallet funded |
| `investment_committed` | Commit + hold (`investment-notifications.ts`) | Investor | Commitment confirmed (note event already existed) |
| `investor_withdrawal_submitted` | Investor requests withdrawal | Investor | Request received |
| `investor_withdrawal_completed` | Investor withdrawal paid | Investor | Payout done |

Renamed: `onboarding_approved` → `onboarding_completed`.

Channels remain platform + email per seed defaults (password-changed always both).

---

## PART 8 — Why the major additions exist

| Addition | Class | Simple why |
|---|---|---|
| Actor / source / portal | ADMIN_TRACEABILITY, DATA_INTEGRITY | Tell API vs webhook vs job apart |
| Atomic submit | DATA_INTEGRITY, CUSTOMER_CLARITY | Do not lose “who submitted” |
| Timeline repair | DATA_INTEGRITY | Rebuild created/submitted **without inventing** a person |
| `CONTRACT_OFFER_DECLINED` | CUSTOMER_CLARITY | Decline ≠ application withdrawn |
| `SIGNING_PACKAGE_DECLINED` vs `VOIDED` | ADMIN_TRACEABILITY, LEGAL_EVIDENCE | Customer said no vs CashSouk cancelled |
| `SIGNING_PACKAGE_EXPIRED` | ADMIN_TRACEABILITY | Clock ran out |
| `viewed_at` | LEGAL_EVIDENCE, DEBUG_SUPPORT | Signer opened the link (envelope row, not Activity) |
| `ONBOARDING_AMENDMENT_REQUIRED` | CUSTOMER_CLARITY | User sees “you must fix this”, not COD internals |
| `ONBOARDING_FEE_PAID` / fee timeline events | FINANCIAL_EVIDENCE, CUSTOMER_CLARITY | Fee success is a milestone |
| `GATEWAY_PAYMENT_COMPLETED` | FINANCIAL_EVIDENCE | Durable gateway completion distinct from name-check |
| `MEMBER_*` | SECURITY, ADMIN_TRACEABILITY | Who was added/removed from the org |
| External legal acceptance | LEGAL_EVIDENCE | Guarantor on a signing link accepted a PDF |
| Generated document evidence | LEGAL_EVIDENCE | Template + output hashes for LO files |
| Metadata sanitize | COMPLIANCE_SUPPORT | Do not store IC / JWT / raw RegTank blobs on Activity |
| Visibility matrix | CUSTOMER_CLARITY | Users do not see Admin forensic rows |

---

## PART 9 — Strongest BEFORE/AFTER examples

1. **Application submitted**  
   BEFORE: status committed, log attempted later and swallowed. No notification.  
   AFTER: log in the same tx; `application_submitted_confirmation`.  
   WHY: dispute “we never submitted” vs “we never logged it”.

2. **Webhook vs Admin**  
   BEFORE: often a user id or empty; no `source`.  
   AFTER: `WEBHOOK` + `INTEGRATION` vs `API` + `ADMIN`.  
   WHY: a Curlec callback is not an issuer click.

3. **Facility offer declined**  
   BEFORE: `CONTRACT_WITHDRAWN`.  
   AFTER: `CONTRACT_OFFER_DECLINED`.  
   WHY: withdrawn application and declined offer were easy to mix up.

4. **Signing declined vs voided**  
   BEFORE: both `SIGNING_PACKAGE_VOIDED`.  
   AFTER: `DECLINED` vs `VOIDED`.  
   WHY: operations and legal need the difference.

5. **Signing completed with no creator**  
   BEFORE: skip log if `created_by_user_id` null.  
   AFTER: write with null actor.  
   WHY: the envelope still completed.

6. **Signing expiry**  
   BEFORE: offer expiry job existed; envelope expiry was not a distinct application event.  
   AFTER: `SIGNING_PACKAGE_EXPIRED` + `systemAuditContext`.  
   WHY: package clock vs offer calendar clock.

7. **Signer viewed**  
   BEFORE: no `viewed_at` on recipients (`git grep viewed_at 2e80520c -- signing` empty).  
   AFTER: `viewed_at` from link + provider (`0c7dd795`).  
   WHY: “never opened” vs “opened but did not sign”.

8. **COD amendment**  
   BEFORE: forensic status only.  
   AFTER: customer milestone `ONBOARDING_AMENDMENT_REQUIRED`.  
   WHY: issuer/investor Activity must not leak provider codes.

9. **Onboarding / processing / facility fee**  
   BEFORE: money in gateway tables; weak Activity.  
   AFTER: `ONBOARDING_FEE_PAID`, `APPLICATION_PROCESSING_FEE_PAID`, `FACILITY_FEE_PAID`.  
   WHY: “I paid” belongs on the journey timeline.

10. **Gateway completed**  
    BEFORE: completion inferred from payment row / other event types.  
    AFTER: `GATEWAY_PAYMENT_COMPLETED`.  
    WHY: finance can filter a single completion event.

11. **External guarantor acceptance**  
    BEFORE: no table.  
    AFTER: `legal_external_acceptances` (`96e5b8a6`).  
    WHY: unauthenticated signer acceptance must survive envelope delete.

12. **Generated LO hash**  
    BEFORE: file in object storage.  
    AFTER: `generated_document_evidence` SHA-256.  
    WHY: which template produced which PDF.

13. **Membership**  
    BEFORE: org members changed with little dedicated log.  
    AFTER: `MEMBER_ADDED` / `INVITED` / `REMOVED` / `ROLE_CHANGED`.  
    WHY: who had access when a decision was made.

14. **Investment notification**  
    BEFORE: `INVESTMENT_COMMITTED` note event, no inbox type.  
    AFTER: `investment_committed`.  
    WHY: investors do not live on Admin note timeline.

15. **Settlement preview**  
    BEFORE: preview wrote a note event.  
    AFTER: not written.  
    WHY: looking at a worksheet is not an approval.

---

## PART 11 — Developer sync (major revamp items)

| Item | Trigger | Writer | Table | Source | BEFORE/AFTER | Evidence |
|---|---|---|---|---|---|---|
| Submit log | Issuer Submit | `applications/service.ts` `persistSubmittedApplication` | `application_logs` | API | Overlay → atomic | `864c294b`; `git show 2e80520c:apps/api/src/modules/applications/controller.ts` ~304 |
| Create log | Issuer creates draft | `applications/service.ts` `createApplication` | `application_logs` | API | Overlay → atomic | Same pattern as submit; controller overlay removed |
| Repair | Hourly job | `application-timeline-repair.ts` | `application_logs` | INTERNAL | Legacy/backfill for missing created/submitted rows | `864c294b`; live create/submit are atomic |
| Facility decline | Issuer reject offer | `applications/service.ts` | `application_logs` | API | `CONTRACT_WITHDRAWN` → `CONTRACT_OFFER_DECLINED` | `c775cada`; BEFORE ~2886 |
| Signing declined | Provider/signer decline | `signing/service.ts` | `application_logs` | WEBHOOK/INTERNAL | VOIDED → DECLINED | `0c7dd795`; BEFORE ~1940 |
| Signing expired | Envelope `expires_at` | `signing/service.ts` | `application_logs` | SYSTEM_JOB | New type | `0c7dd795` |
| Fee paid milestones | Curlec success | `payment/webhook-service.ts` | `application_logs` / `onboarding_logs` | WEBHOOK | New types | `0197aab9`, `0befd2d3`, `0c7dd795` |
| COD amendment milestone | COD PENDING_AMENDMENT | `cod-handler.ts` | `onboarding_logs` | WEBHOOK | New user-visible | `0befd2d3` |
| External acceptance | Unauthenticated accept | `external-acceptance-service.ts` | `legal_external_acceptances` | WEBHOOK/API | New table | `96e5b8a6` |
| Generated evidence | LO generate | `generated-documents/service.ts` | `generated_document_evidence` | API | New table | `0c7dd795` |
| Visibility | Read path | `visibility-matrix.ts` | n/a | — | New | current catalogue 163 |

---

## PART 12 — Git range on this branch

`git log --oneline 2e80520c..1deb2f8b` (18 commits), including:

- `c775cada` Redo log (#232)
- `0b7af35f` Redo log 2 (#233)
- `a5edc577` Redo log 3 (#234)
- `96e5b8a6` Feat/acceptance documents (#235)
- later: `0c7dd795`, `0befd2d3`, `864c294b`, `6348ea2d` (remove ops), `a7e6cdc8`, `1deb2f8b`

Authorship is from **diffs**, not commit titles.

---

## FINAL COUNTS

### BEFORE (`2e80520c`)

LIVE LOG/EVENT TYPES: ~110 across stores (no catalogue). Application enum **46**.

PRODUCTION WRITER LOCATIONS: **47** files (API src scan, excluding tests).

NOTIFICATION TYPES: **36**

### CURRENT (`1deb2f8b`)

LIVE EVENTS: **145**

HISTORICAL: **11**

DEV: **7**

CURRENT WRITER HITS: **100**

NOTIFICATION TYPES: **49**

### REVAMP (`2e80520c` → `1deb2f8b`)

NEW LIVE EVENTS: **22** new type/table keys listed in Part 3 (includes decline rename and paymaster/MARC).

CHANGED EXISTING EVENTS: **12** material behaviours in Part 3, plus additive attribution on existing writers.

REMOVED/RETIRED LIVE EVENTS: **4** writer behaviours — `CONTRACT_WITHDRAWN`, `SETTLEMENT_PREVIEWED`, product inactivate/reactivate, decline-as-`VOIDED`.

NEW USER-FACING MILESTONES: **7** — onboarding fee paid, amendment required, processing fee paid, facility fee paid, signing declined, signing expired, signing completed on the user feed.

NEW ADMIN-ONLY EVENTS: **10** — `MEMBER_*` (4), `PAYMASTER_*` (5), `MARC_ASSESSMENT_SAVED`.

NEW LEGAL EVIDENCE: **2** stores — external acceptances, generated document evidence.

NEW FINANCIAL EVIDENCE: **1** completion event + **3** fee timeline events (onboarding/processing/facility).

NEW SECURITY/AUDIT EVENTS: **2** — `EMAIL_VERIFIED` event type, `PLATFORM_FINANCE_SETTINGS_UPDATED`.

NOTIFICATION ADDITIONS/CHANGES: **13** new types + **1** rename (`onboarding_approved` → `onboarding_completed`).
