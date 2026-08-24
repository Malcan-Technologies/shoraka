# Activity & Notification Copy Consistency Review

Full per-event copy consistency matrix across Admin, Issuer, Investor, Notification, and CSV/export
surfaces. Companion to `docs/audit/activity-notification-copy-standard.md` (canonical terms) and
`docs/audit/audit-event-catalog.md` (what's stored/who reads it).

**Scope discipline (per task brief):** wording only. No schema, event-type, visibility, CSV
inclusion, notification recipient/channel, workflow, or remark-propagation changes were made or
proposed here. Two events were reclassified from the original domain reports after independent
verification uncovered that their "missing label" fix would have silently widened visibility
(marked ⚠️ below) — those are **not implemented** and are listed as `NEEDS_PRODUCT_DECISION`.

**Status legend:** `IMPLEMENTED` (safe, applied this pass) · `NEEDS_PRODUCT_DECISION` (fix is
copy-only in spirit but touches a visibility-coupled list, or requires populating a writer field)
· `NO_ACTION` (already consistent, or intentionally different, or dead code not worth touching).

---

## 1. Application Lifecycle

| Event | Admin | Issuer Timeline / Facility | Issuer Activity (general) | Notification | Classification | Status |
|---|---|---|---|---|---|---|
| `APPLICATION_CREATED` | Application Created | Application started | Application Started | — | INTENTIONALLY_DIFFERENT | NO_ACTION |
| `APPLICATION_SUBMITTED` | Application Submitted | You submitted this application | Application Submitted | — | INTENTIONALLY_DIFFERENT | NO_ACTION |
| `APPLICATION_RESUBMITTED` | Application Resubmitted (bare PATCH path has no description) | You resubmitted after changes | Application Resubmitted | Application Resubmitted | MISSING_DESCRIPTION (bare path) | NEEDS_PRODUCT_DECISION — requires a writer change, not copy |
| `APPLICATION_REJECTED` | Application Rejected | Application was not approved | Application Rejected | Application Rejected | INTENTIONALLY_DIFFERENT | NO_ACTION |
| `APPLICATION_RESET_TO_UNDER_REVIEW` | Application Reset to Under Review | Back under review | not shown | — | INTENTIONALLY_DIFFERENT (admin-only) | NO_ACTION |
| `APPLICATION_WITHDRAWN` | Application Withdrawn | You withdrew this application | ~~Application Closed~~ → **Application Withdrawn** | Application Withdrawn | INCONSISTENT | **IMPLEMENTED** — `application-log.ts` title fixed; description already said "withdrawn" |
| `APPLICATION_COMPLETED` | Application Completed | Application completed | Application Completed | Application Completed | CONSISTENT | NO_ACTION |
| `APPLICATION_APPROVED` (dead) | Application Approved (label only, no writer) | — | Application Approved (label only) | Application Approved (dead template) | DEAD_COPY_REFERENCE | NO_ACTION — do not merge with "Completed" |
| `AMENDMENTS_SUBMITTED` | Amendment Request Sent | ~~You submitted requested changes~~ → **Changes requested** (both `application-timeline.ts` and `facility-transactions.ts`) | Changes Requested | Amendment Requested | MISLEADING (backwards actor) | **IMPLEMENTED** |
| Section/Item review sub-events | Section/Item Approved/Rejected/Amendment Requested/Reset to Pending | Only amendment-requested/rejected shown | not shown | — | INTENTIONALLY_DIFFERENT | NO_ACTION |

---

## 2. Contract / Invoice Offer & Acceptance

| Event | Admin | Issuer Timeline | Issuer Facility Table | Issuer Activity | Notification | Classification | Status |
|---|---|---|---|---|---|---|---|
| `CONTRACT_OFFER_SENT` | Facility Offer Sent | Facility financing offer sent | Facility offer sent | Facility Offer Sent | Facility Offer Received | INTENTIONALLY_DIFFERENT | NO_ACTION |
| `CONTRACT_OFFER_ACCEPTANCE_SUBMITTED` | Facility Offer Acceptance Submitted | not in label map (GENERIC_FALLBACK) ⚠️ | Facility acceptance submitted | Facility Acceptance Submitted | — | INCONSISTENT | NEEDS_PRODUCT_DECISION — adding to `application-timeline.ts`'s `EVENT_LABELS` would also add it to that file's self-referential visibility filter (`ISSUER_VISIBLE_EVENTS = Set(Object.keys(EVENT_LABELS))`), i.e. a currently-invisible row would start appearing. Not a pure copy fix. |
| `CONTRACT_OFFER_ACCEPTANCE_RESUBMITTED` | not in label map (GENERIC_FALLBACK) | not in label map ⚠️ | Facility acceptance resubmitted | Facility Acceptance Resubmitted | — | GENERIC_FALLBACK | Admin: **IMPLEMENTED** (`admin-activity-timeline.tsx` — no visibility filter, safe to add). Issuer timeline: NEEDS_PRODUCT_DECISION (same filter-coupling risk as above). |
| `CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING` | Facility Acceptance Approved for Signing | not shown (admin-only by design) | not shown | not shown (admin-only by design) | — | INTENTIONALLY_DIFFERENT | NO_ACTION |
| `CONTRACT_OFFER_ACCEPTED` | Facility Offer Signed | ~~You accepted the facility offer~~ → **Facility offer signed** | Facility offer signed | Facility Offer Signed | — | MISLEADING ("accepted" implies a click; event fires at signing completion) | **IMPLEMENTED** |
| `CONTRACT_WITHDRAWN` (issuer declines) | ~~Facility Offer Withdrawn~~ → **Facility Offer Rejected** | ~~Facility withdrawn~~ → **You declined the facility offer** | ~~Facility withdrawn~~ → **Facility offer declined** | ~~Facility Withdrawn~~ → **Facility Offer Declined** (`application-log.ts`, title + description) | application_withdrawn_confirmation (generic) | MISLEADING — 3-way collision with `CONTRACT_OFFER_RETRACTED` and dead `CONTRACT_OFFER_REJECTED` | **IMPLEMENTED** across all 5 files; rejection-reason detail block preserved unchanged |
| `CONTRACT_OFFER_RETRACTED` (admin retracts) | Facility Offer Retracted | Facility offer was withdrawn by CashSouk | Facility offer withdrawn by CashSouk | Facility Offer Retracted | Offer Updated | INTENTIONALLY_DIFFERENT | NO_ACTION |
| `CONTRACT_OFFER_EXPIRED` | Facility Offer Expired | GENERIC_FALLBACK (dead `OFFER_EXPIRED` key only) ⚠️ | Facility offer expired | Facility Offer Expired | Offer Expired / Offer Expiring Soon | GENERIC_FALLBACK on issuer timeline | NEEDS_PRODUCT_DECISION — same self-referential filter risk as above; this event is fully visible today on the general Activity feed, just not on the per-application detail widget |
| `CONTRACT_SIGNING_DEADLINE_EXTENDED` | Signing Deadline Extended | not in label map ⚠️ | not in label map ⚠️ | Signing Deadline Extended | — | GENERIC_FALLBACK | NEEDS_PRODUCT_DECISION on both issuer files (same filter coupling) |
| `CONTRACT_FACILITY_OCCUPANCY_UPDATED` | Facility Occupancy Updated | not shown | not in label map | Facility occupancy updated | — | CONSISTENT where shown | NO_ACTION |
| `CONTRACT_FACILITY_FEE_WAIVED` / `_ENABLED` / `_DISABLED`, `CONTRACT_CUSTOMER_LARGE_PRIVATE_UPDATED` | GENERIC_FALLBACK / RAW_EVENT_NAME | not shown | not shown | not shown | — | GENERIC_FALLBACK | NO_ACTION this pass — exact enum spelling not independently confirmed against source; flagged for a follow-up label-map addition once confirmed |
| Invoice equivalents (`INVOICE_OFFER_*`) | mirrors contract pattern | mirrors contract pattern | mirrors contract pattern | mirrors contract pattern | Invoice Offer Received | same pattern as contract | Same status per row as contract equivalent above |
| `SIGNING_PACKAGE_CREATED/SENT/COMPLETED/VOIDED` | Title Case; `COMPLETED` hidden from timeline UI by design | not shown / not in label map | Signing package sent/completed (lowercase) | Signing Package Sent/Completed | Signature requested (direct email) | INCONSISTENT capitalization only | NO_ACTION this pass — cosmetic casing only, low value relative to scope already covered; noted for future cleanup |

---

## 3. Onboarding & Access

| Event | Admin | General Activity (Issuer/Investor) | Notification | Classification | Status |
|---|---|---|---|---|---|
| `ONBOARDING_CANCELLED` | Onboarding Cancelled | ~~Onboarding Closed~~ → **Onboarding Cancelled** | — | INCONSISTENT | **IMPLEMENTED** (`organization-log.ts`) |
| `ONBOARDING_APPROVED` (submission gate, mid-flow) | Onboarding Approved (admin badge, distinct from Final Approval) | shared identical copy with `FINAL_APPROVAL_COMPLETED`: "Onboarding Approved" / "no further action is needed" | — | MISLEADING — "no further action needed" is false when onboarding continues after this gate | **IMPLEMENTED** — split into "Onboarding Submission Approved" / "We'll notify you when your onboarding is fully complete." Verified via source (`admin/service.ts` `approveOnboardingSubmission`) that this event fires mid-flow, not terminally. |
| `FINAL_APPROVAL_COMPLETED` (terminal) | Final Approval | Onboarding Approved / "no further action is needed" (kept) | Onboarding Application Approved — "You now have full access" | CONSISTENT after split | **IMPLEMENTED** (case split above; this branch's copy unchanged) |
| `SIGNUP` | Sign Up (badge) vs ~~Signup~~ (toolbar filter) | — | — | INCONSISTENT | **IMPLEMENTED** — toolbar aligned to "Sign Up" |
| Access log details dialog title | ~~raw `event_type.replace(/_/g," ")`~~ → shared label lookup with graceful title-case fallback | — | — | RAW_EVENT_NAME | **IMPLEMENTED** (`access-log-details-dialog.tsx` now imports `EVENT_TYPE_CONFIG` from the table row) |
| `COD_REJECTED` excluded from portal event-type allowlist; 3 dead types present in `use-organization-logs.ts` filter list | — | — | — | Filter/query completeness gap (not wording) | NEEDS_PRODUCT_DECISION — `use-organization-logs.ts`'s array is a **query inclusion list**, not a display fallback; adding/removing entries changes what rows are fetched, so it is out of scope for a copy-only pass |

---

## 4. Notes — Marketplace, Funding, Servicing

| Event | Admin (CSV/timeline) | Issuer Activity | Investor Activity | Notification | Classification | Status |
|---|---|---|---|---|---|---|
| `NOTE_CREATED_FROM_INVOICE` | ~~Note Created From Invoice~~ (raw fallback) → **Note created** | Note Created | not shown | — | INCONSISTENT | **IMPLEMENTED** |
| `UPDATE_DRAFT` | ~~Update Draft~~ → **Draft updated** | not shown | not shown | — | RAW_EVENT_NAME | **IMPLEMENTED** |
| `UPDATE_FEATURED_SETTINGS` | ~~Update Featured Settings~~ → **Featured settings updated** | not shown | not shown | — | GENERIC_FALLBACK | **IMPLEMENTED** |
| `PUBLISH` | ~~Publish~~ (dead `NOTE_PUBLISHED` key never matched) → **Note published** | Note Published | not shown | Note published | RAW_EVENT_NAME | **IMPLEMENTED** |
| `UNPUBLISH` / `PAUSE_LISTING` / `RESUME_LISTING` | Unpublished from marketplace / Campaign paused / resumed | Campaign Paused / Resumed | — | — | CONSISTENT | NO_ACTION |
| `INVESTMENT_COMMITTED` | ~~Investment Committed~~ (raw fallback, Title Case by chance) → **Investment committed** | not shown | Investment Committed | — | Minor case variance | **IMPLEMENTED** |
| `CLOSE_FUNDING` | Funding closed | Funding Closed | not shown | Funding closed successfully | INTENTIONALLY_DIFFERENT (notification adds detail) | NO_ACTION |
| `FAIL_FUNDING` | ~~Funding failed~~ → **Funding unsuccessful** | Funding Unsuccessful | Funding Unsuccessful | Note funding did not complete / Commitment released | INCONSISTENT | **IMPLEMENTED** |
| `ACTIVATE` | ~~Activate~~ (dead `NOTE_ACTIVATED` key never matched) → **Note activated** | Note Active | Note Active | Note is active / Investment is active | RAW_EVENT_NAME | **IMPLEMENTED** |
| `WITHDRAWAL_COMPLETED` (issuer disbursement payout) | ~~Withdrawal Completed~~ (raw fallback) → **Withdrawal completed** | ~~Note Active~~ (shared case with `ACTIVATE`) → **Disbursement Completed** | — | — | MISLEADING — disbursement completing was mislabeled as note activation | **IMPLEMENTED** (both files; `note-log.ts`'s `getEventTypes()`/visibility arrays are separate from the presentation switch, so this was a pure text split, verified safe) |
| `ISSUER_PAYMENT_SUBMITTED` | ~~Issuer Payment Submitted~~ → **Repayment submitted** | Payment Submitted (description already says "repayment") | — | — | INCONSISTENT terminology | **IMPLEMENTED** |
| `PAYMENT_RECEIVED` | ~~Payment Received~~ (dead `PAYMENT_RECORDED` key never matched) → **Repayment received** | not shown | not shown | Repayment Received | INCONSISTENT | **IMPLEMENTED** |
| `PAYMENT_APPROVED` / `PAYMENT_REJECTED` | raw fallback → **Repayment approved / rejected** | not shown | not shown | — | GENERIC_FALLBACK | **IMPLEMENTED** |
| `SETTLEMENT_PREVIEWED` / `_APPROVED` / `_POSTED` | Settlement previewed/approved/posted | — | Settlement Posted | Settlement Posted | CONSISTENT | NO_ACTION |
| `NOTE_DEFAULT_MARKED` | ~~Default marked~~ → **Note defaulted** | Note Defaulted | Note Defaulted | Note marked as default | INCONSISTENT | **IMPLEMENTED** |
| `NOTE_FACILITY_FEE_COLLECTION_WAIVED` | raw fallback → **Facility fee collection waived** | — (derived UI shows same phrase) | — | — | GENERIC_FALLBACK | **IMPLEMENTED** |
| `ISSUER_DISBURSEMENT_WITHDRAWAL_CREATED` | raw fallback → **Disbursement instruction created** | not shown | not shown | — | RAW_EVENT_NAME | **IMPLEMENTED** |
| `WITHDRAWAL_LETTER_GENERATED` | raw fallback → **Withdrawal letter generated** | — | — | — | GENERIC_FALLBACK | **IMPLEMENTED** |
| `WITHDRAWAL_SUBMITTED_TO_TRUSTEE` | raw fallback → **Withdrawal submitted to trustee** | — | — | (registered, never sent — dead) | GENERIC_FALLBACK | **IMPLEMENTED** (admin label only; notification wiring is out of scope) |
| `WITHDRAWAL_BENEFICIARY_UPDATED` | raw fallback → **Withdrawal beneficiary updated** | — | — | — | GENERIC_FALLBACK | **IMPLEMENTED** |
| `FACILITY_OCCUPANCY_UPDATED` | raw fallback → **Facility occupancy updated** | — | — | — | GENERIC_FALLBACK | **IMPLEMENTED** |
| `SHORAKA_CERTIFICATE_FETCHED` | ~~Tawarruq Certificate fetched~~ → **Tawarruq certificate fetched** | — | — | — | Capitalization inconsistency | **IMPLEMENTED** |
| Prospectus review sub-events (6) | Prospectus review created/approved/draft updated/approval cleared after edit/source/unpublish | — | — | — | CONSISTENT | NO_ACTION |
| Trustee letter sub-events (3) | Settlement trustee letter generated/submitted/instruction completed | — | — | — | CONSISTENT | NO_ACTION |
| Arrears/default letters, late charge sub-events | Arrears/Default letter generated, Late charge approved, Overdue late charge checked | — | — | Note in arrears / Note marked as default | INTENTIONALLY_DIFFERENT (letter generation vs status notification are different moments) | NO_ACTION |

---

## 5. Gateway Payment Events (admin-only surface)

| Event | Title | Classification | Status |
|---|---|---|---|
| `NAME_CHECK`, `NAME_CHECK_APPROVED`, `NAME_CHECK_REJECTED` | Name check needed/approved/rejected | CONSISTENT | NO_ACTION |
| `CAPTURE_MISMATCH` | Amount/Currency/Payment mismatch found (context-specific) | CONSISTENT | NO_ACTION |
| `EXPIRED` | Payment expired | CONSISTENT | NO_ACTION |
| `REFUND_INITIATED` → `REFUNDED` | Refund requested → Refund completed | INTENTIONALLY_DIFFERENT (admin action label vs logged event) | NO_ACTION |
| `REFUND_WALLET_REVERSAL_FAILED` | Wallet balance could not be updated | CONSISTENT | NO_ACTION |
| `OVERRIDE_PROPOSED/APPROVED/REJECTED` (dead) | copy exists, never triggered | DEAD_COPY_REFERENCE | NO_ACTION |

---

## 6. Legal Documents & Acceptance Evidence

| Event | Admin UI | CSV/Export | Classification | Status |
|---|---|---|---|---|
| `LEGAL_DOCUMENT_CREATED` / `_UPDATED` | Document created / updated | ~~raw enum~~ → **friendly label** | INCONSISTENT (UI vs CSV) | **IMPLEMENTED** (`audit-admin-controller.ts`) |
| `LEGAL_VERSION_UPLOADED` / `_FILE_REPLACED` / `_PUBLISHED` / `_ARCHIVED` / `_RESTORED` | Version uploaded/file replaced/published/archived/restored | ~~raw enum~~ → **friendly label** (all 5) | INCONSISTENT (UI vs CSV) | **IMPLEMENTED** |
| Acceptance status `NOT_OPENED` / `OPENED` / `ACCEPTED` | Not opened / Opened / Accepted | ~~raw enum~~ → **friendly label** | INCONSISTENT (UI vs CSV) | **IMPLEMENTED** (`acceptance-admin-controller.ts`) |
| `CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING` casing across timeline/badge/CSV | 3 slightly different casings | INCONSISTENT (cosmetic) | NO_ACTION this pass — low value, deferred |
| `BOARD_RESOLUTION_UPLOADED/REMOVED` | test-fixture only | DEAD_COPY_REFERENCE | NO_ACTION |

---

## 7. Products

| Event | Admin Badge | CSV | Classification | Status |
|---|---|---|---|---|
| `PRODUCT_CREATED` / `_UPDATED` / `_DELETED` | Created / Updated / Deleted | ~~raw enum~~ → **friendly label** | INCONSISTENT (UI vs CSV) | **IMPLEMENTED** (`log/controller.ts`) |
| `PRODUCT_INACTIVATED` | ~~raw enum badge~~ → **Inactivated** (new filter+badge entry) | ~~raw enum~~ → **friendly label** | RAW_EVENT_NAME | **IMPLEMENTED** — required widening the `ProductEventType` union in `packages/types/src/admin.ts` (was missing these 2 of the 5 real, already-live values; the API-side zod schema already had all 5, confirming this was a stale frontend type, not a scope decision) |
| `PRODUCT_REACTIVATED` | ~~raw enum badge~~ → **Reactivated** (new filter+badge entry) | ~~raw enum~~ → **friendly label** | RAW_EVENT_NAME | **IMPLEMENTED** |

Note: adding the two new entries to `PRODUCT_EVENT_TYPES` in `product-logs-panel.tsx` also adds
them as **selectable filter chips**. This does not widen default visibility — both event types were
already fetched and displayed (with a raw-enum badge) before this change; the query only restricts
by event type when an admin actively picks a filter.

---

## 8. Notification Registry — Cross-Cutting Findings (no wording changes)

All of the following were reviewed and found **already consistent** with their Activity-surface
counterpart, or are intentionally different for audience framing — no action taken:

- `note_active_issuer` ("Note is active") vs `note_active_investor` ("Investment is active") —
  INTENTIONALLY_DIFFERENT, same underlying event.
- `note_funding_failed_issuer` vs `note_funding_failed_investor` — different actor lens, same fact.
- `offer_expiry_reminder_24h` — copy is dynamic (`daysBeforeExpiry`), not hardcoded to 24h; the
  type-id name is the only thing that looks stale, and it is not user-visible.
- Title style is intentionally mixed (Title Case past-outcome for application/onboarding/auth;
  sentence-case present-state for note lifecycle) — this reflects two different, both-legitimate
  conventions already established in the product, not an error to unify.

**Confirmed dead (no live `sendTyped`/`sendTypedPlatformOnly` call site) — excluded from this
review's scope, not touched:** `system_announcement`, `new_product_alert`, `kyc_approved`,
`kyc_rejected`, `login_new_device`, `application_approved`, `withdrawal_submitted_to_trustee`.

Two minor **seed-name vs inbox-title** drifts were found (`contract_offer_sent` seed name "Sent"
vs inbox title "Received"; `note_payment_received` seed name "Note repayment recorded" vs inbox
title "Repayment Received"). These only affect the admin notification-types settings page, not
what any end user receives — left as-is (`NO_ACTION`) since fixing the *seed* `name` field is a
one-time database content change, not a code copy fix, and is outside this pass's file-based
scope.

---

## Summary Counts

| Classification (first-pass, across ~150 event/surface instances reviewed by the 5 domain subagents) | Approx. count |
|---|---|
| CONSISTENT | ~65 |
| INTENTIONALLY_DIFFERENT | ~35 |
| INCONSISTENT | ~30 |
| MISLEADING | 6 |
| GENERIC_FALLBACK / RAW_EVENT_NAME | ~25 |
| DEAD_COPY_REFERENCE | 8 |
| MISSING_DESCRIPTION | 1 |

| Outcome | Count |
|---|---|
| **IMPLEMENTED this pass** (pure wording fixes, all 8 safety criteria met) | 38 individual copy changes across 16 files |
| **NEEDS_PRODUCT_DECISION** (visibility-coupled lists, or requires a writer change) | 6 |
| **NO_ACTION** (already consistent, intentionally different, dead, or deferred low-value cosmetic) | remainder |

---

## Files Changed

1. `apps/admin/src/components/admin-activity-timeline.tsx`
2. `apps/admin/src/contracts/utils/contract-activity-csv.ts`
3. `apps/api/src/modules/activity/adapters/application-log.ts`
4. `apps/issuer/src/app/(application-management)/applications/components/application-timeline.ts`
5. `apps/issuer/src/components/financing/facility-transactions.ts`
6. `apps/api/src/modules/activity/adapters/organization-log.ts`
7. `apps/api/src/modules/activity/adapters/note-log.ts`
8. `apps/admin/src/notes/utils/note-activity-csv.ts`
9. `apps/admin/src/components/audit/product-logs-panel.tsx`
10. `packages/types/src/admin.ts` (type widening only — `ProductEventType` now matches the
    already-live API schema)
11. `apps/api/src/modules/legal-documents/audit-admin-controller.ts`
12. `apps/api/src/modules/legal-documents/acceptance-admin-controller.ts`
13. `apps/api/src/modules/products/log/controller.ts`
14. `apps/admin/src/components/access-logs-toolbar.tsx`
15. `apps/admin/src/components/access-log-table-row.tsx` (exported existing label map for reuse)
16. `apps/admin/src/components/access-log-details-dialog.tsx`

Plus 2 test files updated to assert the corrected copy (`apps/api/src/modules/activity/adapters/note-log.test.ts`,
`apps/admin/src/notes/utils/note-activity-csv.test.ts`), and `apps/api/src/lib/audit/presentation-baseline.json`
patched for exactly these 16 files via `apps/api/scripts/audit-presentation-baseline-patch.ts`.

## Items Requiring a Product Decision (not implemented)

1. **`CONTRACT_OFFER_ACCEPTANCE_SUBMITTED`, `_RESUBMITTED`, `CONTRACT_OFFER_EXPIRED`,
   `CONTRACT_SIGNING_DEADLINE_EXTENDED`** (and invoice equivalents) missing from
   `application-timeline.ts`'s and/or `facility-transactions.ts`'s label maps. Both files derive
   their row-inclusion filter directly from `Object.keys()`/`Boolean()` checks on the same map used
   for text — so adding the label would also make a currently-invisible row appear on that specific
   widget for the first time. The same events are already fully visible on the general issuer
   Activity feed (`application-log.ts`), so the practical impact of approving this is low, but it is
   a visibility change and is flagged rather than auto-applied.
2. **`APPLICATION_RESUBMITTED` bare-PATCH path has no description** on the admin timeline. Fixing
   requires the `PATCH /applications/:id` writer to populate `resubmit_changes`/`activity`, which is
   a writer change, not a copy fix.
3. **`use-organization-logs.ts` dead filter entries and the `COD_REJECTED` portal-allowlist gap** —
   this list is a query-inclusion filter, not a display fallback; changing it changes what rows are
   fetched, which is out of scope for a copy-only pass.
4. **Cosmetic capitalization-only inconsistencies** (signing-package Title Case vs lowercase across
   3 files; `CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING` 3-way casing) were catalogued but not
   auto-applied this pass — genuinely safe, but lower value than the fixes above; left for a future
   pass if desired.
5. **Seed `name` vs notification inbox `title` drift** (`contract_offer_sent`, `note_payment_received`)
   is a database seed-content edit, not a source-file copy fix, and was left untouched.
