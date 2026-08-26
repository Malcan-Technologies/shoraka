# Activity & Notification Copy Consistency Review

> **Document responsibility:** this file owns the **historical copy-consistency review and
> implementation record** — the BEFORE/AFTER of every wording change, and why each was or was not
> applied. It answers *"why does this surface word it that way, and was it reviewed?"* It is a
> **historical record**, so entries are annotated rather than rewritten as work lands.
>
> | Question | Document |
> |---|---|
> | What happens for `EVENT_X`? | [`audit-event-surface-matrix.md`](./audit-event-surface-matrix.md) — **primary reference** |
> | What should I *call* this on a new surface? | [`activity-notification-copy-standard.md`](./activity-notification-copy-standard.md) |
> | Is the evidence we store good enough? | [`audit-event-catalog.md`](./audit-event-catalog.md) |
> | What is still broken or awaiting sign-off? | [`audit-product-gap-review.md`](./audit-product-gap-review.md) |
>
> **Do not read this file as the current state of the copy.** Because it preserves history, some
> BEFORE values here no longer exist in code. For the copy that is live *today*, see
> [`audit-event-surface-matrix.md`](./audit-event-surface-matrix.md) §2.

**2026-08-26 copy standardization:** the approved wording in
[`final-copy-standardization-plan.md`](./final-copy-standardization-plan.md) was implemented as a
presentation/template/CSV-label pass. Historical BEFORE/AFTER rows below are **not rewritten**.
Live copy is in the surface matrix and `current-event-journal.md` CURRENT USER-FACING COPY sections.

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
| `APPLICATION_SUBMITTED` | Application Submitted | You submitted this application | Application Submitted | — *(copy-review)* · **CURRENT (2026-08-25):** `application_submitted_confirmation` (platform only; issuer owner + org admins; session toast is a separate existing channel) | INTENTIONALLY_DIFFERENT | NO_ACTION |
| `APPLICATION_RESUBMITTED` | ~~Application Resubmitted (bare PATCH path has no description)~~ → **"Application resubmitted for review"** fallback on the bare path | You resubmitted after changes | Application Resubmitted | Application Resubmitted | MISSING_DESCRIPTION (bare path) | ~~NEEDS_PRODUCT_DECISION~~ **RESOLVED (2026-08-24)** — approved as a writer-level fix, not copy-only. BEFORE: bare `PATCH .../status` (status=`RESUBMITTED`) wrote no `resubmit_changes` metadata, so `getApplicationLogs` rendered an empty/generic activity string. DECISION: confirmed same business action as the rich amendment-resubmit flow; populate only a plain accurate fallback, no invented amendment count/remarks. AFTER: `applications/service.ts:getApplicationLogs` now falls back to `"Application resubmitted for review"` only when `resubmit_changes.activity_summary` is absent; the rich `amendments/service.ts` resubmit path and its existing metadata are unchanged. |
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
| `CONTRACT_OFFER_ACCEPTANCE_SUBMITTED` | Facility Offer Acceptance Submitted | ~~not in label map (GENERIC_FALLBACK)~~ → **"Facility acceptance submitted"** | Facility acceptance submitted | Facility Acceptance Submitted | — | INCONSISTENT | ~~NEEDS_PRODUCT_DECISION~~ **RESOLVED (2026-08-24)** — product approved deliberately widening visibility for this milestone. BEFORE: absent from `application-timeline.ts`'s `EVENT_LABELS` (and therefore from `ISSUER_VISIBLE_EVENTS`). DECISION: this is a meaningful, already-live issuer milestone that belongs on the per-application timeline, not just the general Activity feed. AFTER: added to `EVENT_LABELS` using the canonical copy-standard term; admin-only events (`CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING`) were deliberately left out. |
| `CONTRACT_OFFER_ACCEPTANCE_RESUBMITTED` | not in label map (GENERIC_FALLBACK) | ~~not in label map~~ → **"Facility acceptance resubmitted"** | Facility acceptance resubmitted | Facility Acceptance Resubmitted | — | GENERIC_FALLBACK | Admin: **IMPLEMENTED** (`admin-activity-timeline.tsx` — no visibility filter, safe to add). Issuer timeline: **RESOLVED (2026-08-24)** — same approval/fix as `CONTRACT_OFFER_ACCEPTANCE_SUBMITTED` above. |
| `CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING` | Facility Acceptance Approved for Signing | not shown (admin-only by design) | not shown | not shown (admin-only by design) | — | INTENTIONALLY_DIFFERENT | NO_ACTION |
| `CONTRACT_OFFER_ACCEPTED` | Facility Offer Signed | ~~You accepted the facility offer~~ → **Facility offer signed** | Facility offer signed | Facility Offer Signed | — | MISLEADING ("accepted" implies a click; event fires at signing completion) | **IMPLEMENTED** |
| `CONTRACT_WITHDRAWN` (issuer declines) | ~~Facility Offer Withdrawn~~ → **Facility Offer Rejected** | ~~Facility withdrawn~~ → **You declined the facility offer** | ~~Facility withdrawn~~ → **Facility offer declined** | ~~Facility Withdrawn~~ → **Facility Offer Declined** (`application-log.ts`, title + description) | application_withdrawn_confirmation (generic) | MISLEADING — 3-way collision with `CONTRACT_OFFER_RETRACTED` and dead `CONTRACT_OFFER_REJECTED` | **IMPLEMENTED** across all 5 files; rejection-reason detail block preserved unchanged |
| `CONTRACT_OFFER_RETRACTED` (admin retracts) | Facility Offer Retracted | Facility offer was withdrawn by CashSouk | Facility offer withdrawn by CashSouk | Facility Offer Retracted | Offer Updated | INTENTIONALLY_DIFFERENT | NO_ACTION |
| `CONTRACT_OFFER_EXPIRED` | Facility Offer Expired | ~~GENERIC_FALLBACK (dead `OFFER_EXPIRED` key only)~~ → **"Facility offer expired"** | Facility offer expired | Facility Offer Expired | Offer Expired / Offer Expiring Soon | GENERIC_FALLBACK on issuer timeline | **RESOLVED (2026-08-24)** — added the live `CONTRACT_OFFER_EXPIRED` key (dead `OFFER_EXPIRED` key left in place, harmless/unused) to both `application-timeline.ts` and `facility-transactions.ts` label maps using the canonical term. |
| `CONTRACT_SIGNING_DEADLINE_EXTENDED` | Signing Deadline Extended | ~~not in label map~~ → **"Signing deadline extended"** | ~~not in label map~~ → **"Signing deadline extended"** | Signing Deadline Extended | — *(copy-review)* · **CURRENT (2026-08-25):** `contract_signing_deadline_extended` (issuer owner + org admins; platform + email). Invoice equivalent: `invoice_signing_deadline_extended` | GENERIC_FALLBACK | **RESOLVED (2026-08-24)** on both issuer files — added to `EVENT_LABELS` (`application-timeline.ts`) and to both the label map and `INVOICE_LOG_TYPES` set (`facility-transactions.ts` — also fixes the invoice equivalent below). |
| `CONTRACT_FACILITY_OCCUPANCY_UPDATED` | Facility Occupancy Updated | not shown | not in label map | Facility occupancy updated | — | CONSISTENT where shown | NO_ACTION |
| `CONTRACT_FACILITY_FEE_WAIVED` / `_ENABLED` / `_DISABLED`, `CONTRACT_CUSTOMER_LARGE_PRIVATE_UPDATED` | GENERIC_FALLBACK / RAW_EVENT_NAME | not shown | not shown | not shown | — *(copy-review)* · **CURRENT (2026-08-25):** `CONTRACT_FACILITY_DISABLED` → `facility_disabled`. `_ENABLED` OPTIONAL / `_FEE_WAIVED` KEEP_SILENT — not implemented | GENERIC_FALLBACK | NO_ACTION this pass — exact enum spelling not independently confirmed against source; flagged for a follow-up label-map addition once confirmed |
| Invoice equivalents (`INVOICE_OFFER_*`) | mirrors contract pattern | mirrors contract pattern | mirrors contract pattern | mirrors contract pattern | Invoice Offer Received | same pattern as contract | Same status per row as contract equivalent above |
| `SIGNING_PACKAGE_CREATED/SENT/COMPLETED/VOIDED` | ~~Title Case~~ → sentence case; `COMPLETED` hidden from timeline UI by design (unchanged) | not shown / not in label map | Signing package sent/completed (lowercase, unchanged) | ~~Signing Package Sent/Completed~~ → **Signing package sent/completed** | Signature requested (direct email) | ~~INCONSISTENT capitalization only~~ | **RESOLVED (2026-08-24)** — BEFORE: `admin-activity-timeline.tsx`'s `CREATED`/`SENT`/`VOIDED` labels and the general-Activity `application-log.ts` presentation titles for `SENT`/`COMPLETED` used Title Case ("Signing Package Sent"), while the Facility Table and CSV surfaces already used the canonical sentence case ("Signing package sent") per `activity-notification-copy-standard.md` §3. DECISION: align the two Title Case surfaces to the documented canonical sentence case. AFTER: `admin-activity-timeline.tsx` now reads "Signing package created/sent/voided"; `application-log.ts`'s presentation titles now read "Signing package sent"/"Signing package completed". `SIGNING_PACKAGE_COMPLETED` remains absent from the admin timeline's visible label map (still hidden by design via `TIMELINE_HIDDEN_EVENT_TYPES`) and absent from `application-log.ts`'s `getEventTypes()` query allowlist — no visibility change on either surface, text-only. |

---

## 3. Onboarding & Access

| Event | Admin | General Activity (Issuer/Investor) | Notification | Classification | Status |
|---|---|---|---|---|---|
| `ONBOARDING_CANCELLED` | Onboarding Cancelled (forensic wording — a prior request was cancelled; unchanged) | ~~Onboarding Closed~~ → ~~Onboarding Cancelled~~ → **Onboarding Restarted** (2026-08-24) | — | INCONSISTENT → **MISLEADING** (2026-08-24 finding: "Onboarding Cancelled" + "was cancelled and will not continue" implied permanent termination, but the actual business action is an admin-initiated restart) | **IMPLEMENTED** (`organization-log.ts`). **RESOLVED (2026-08-24):** BEFORE — title "Onboarding Cancelled", description "Your organization onboarding was cancelled and will not continue." DECISION — approved; describe the actual business outcome (a new onboarding request has already started) rather than the forensic event name. AFTER — title `"Onboarding Restarted"`, description `"Your previous onboarding request was cancelled and a new onboarding request has been started."` Applied identically to issuer and investor portals via the shared `OrganizationLogAdapter`; stored `event_type` and Admin's own forensic wording unchanged. |
| `ONBOARDING_APPROVED` (submission gate, mid-flow) | Onboarding Approved (admin badge, distinct from Final Approval) | shared identical copy with `FINAL_APPROVAL_COMPLETED`: "Onboarding Approved" / "no further action is needed" | — | MISLEADING — "no further action needed" is false when onboarding continues after this gate | **IMPLEMENTED** — split into "Onboarding Submission Approved" / "We'll notify you when your onboarding is fully complete." Verified via source (`admin/service.ts` `approveOnboardingSubmission`) that this event fires mid-flow, not terminally. |
| `FINAL_APPROVAL_COMPLETED` (terminal) | Final Approval | Onboarding Approved / "no further action is needed" (kept) | Onboarding Application Approved — "You now have full access" | CONSISTENT after split | **IMPLEMENTED** (case split above; this branch's copy unchanged) |
| `SIGNUP` | Sign Up (badge) vs ~~Signup~~ (toolbar filter) | — | — | INCONSISTENT | **IMPLEMENTED** — toolbar aligned to "Sign Up" |
| Access log details dialog title | ~~raw `event_type.replace(/_/g," ")`~~ → shared label lookup with graceful title-case fallback | — | — | RAW_EVENT_NAME | **IMPLEMENTED** (`access-log-details-dialog.tsx` now imports `EVENT_TYPE_CONFIG` from the table row) |
| `COD_REJECTED` excluded from portal event-type allowlist; 3 dead types present in `use-organization-logs.ts` filter list | — | — | — | Filter/query completeness gap (not wording) | ~~NEEDS_PRODUCT_DECISION~~ **RESOLVED (2026-08-24)** — product approved both halves. BEFORE: `OrganizationLogAdapter.getEventTypes()` omitted `COD_REJECTED`; `use-organization-logs.ts`'s `ONBOARDING_EVENT_TYPES` still listed `TNC_ACCEPTED`/`KYC_APPROVED`/`KYB_APPROVED`. DECISION: expose `COD_REJECTED` with canonical "Onboarding Rejected" copy (user already gets the notification); remove the 3 dead filter entries after reconfirming zero production writers. AFTER: `organization-log.ts` now includes `COD_REJECTED` in both `getEventTypes()` and `buildPresentation()`; `use-organization-logs.ts` no longer lists the 3 dead types (enum/rows untouched). See `audit-event-catalog.md` §1.4 for full detail. |
| `COD_REJECTED` excluded from the **Admin's own** organization-detail Activity query allowlist — a separate gap from the row above, which only covered the issuer/investor-facing `OrganizationLogAdapter` | Not shown in org-detail Activity/CSV despite existing in the raw onboarding export | n/a (admin-only surface) | — | Filter/query completeness gap (not wording), admin-side | **RESOLVED (2026-08-24)** — BEFORE: `use-organization-logs.ts`'s `ONBOARDING_EVENT_TYPES` (the Admin org-detail query allowlist) omitted `COD_REJECTED`, even after the issuer/investor half was fixed above. AFTER: added to `ONBOARDING_EVENT_TYPES` with the existing `"Onboarding Rejected"` label added to `organization-activity-timeline.tsx`'s `EVENT_LABELS`; the org-detail CSV export shares the same query and now includes it too. |
| Admin Access-log filter (`ACCESS_EVENT_TYPES`) listed the never-written `KYC_STATUS_UPDATED` and omitted 4 live writers (`ROLE_ADDED`/`ROLE_REMOVED`/`PROFILE_UPDATED`/`ONBOARDING_RESET`) | — | — | — | Filter/query completeness gap (not wording) | **RESOLVED (2026-08-24)** — moved into `use-access-logs.ts` (exported for testing), corrected to the 4 verified live writers, `KYC_STATUS_UPDATED` excluded from the query filter but kept as a dropdown/label option for historical rows. **FOLLOW-UP (2026-08-25):** `ROLE_ADDED`/`ROLE_REMOVED` are UNREACHABLE_FROM_UI / API_REACHABLE; `ONBOARDING_RESET` is UNREACHABLE_FROM_UI / ROUTE_ONLY; only `PROFILE_UPDATED` is LIVE_UI_REACHABLE. Filter allowlist unchanged on purpose. |
| Admin Security-log filter (`SECURITY_EVENT_TYPES`) omitted 4 live writers (`ROLE_CREATED`/`ROLE_REMOVED`/`ROLE_PERMISSIONS_UPDATED`/`INVITATION_REVOKED`) | — | — | — | Filter/query completeness gap (not wording) | **RESOLVED (2026-08-24)** — moved into `use-security-logs.ts` (exported for testing), now includes all 9 verified live writers. `security_logs.ROLE_REMOVED` and `access_logs.ROLE_REMOVED` remain distinct, unmerged strings. **Re-confirmed 2026-08-25 LIVE_UI_REACHABLE.** |

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
| `WITHDRAWAL_COMPLETED` (issuer disbursement payout) | ~~Withdrawal Completed~~ (raw fallback) → **Withdrawal completed** | ~~Note Active~~ (shared case with `ACTIVATE`) → **Your Disbursement Is Complete** | **CURRENT (2026-08-26):** Investor Activity `Your Investment Is Active` / `{note} is now active and servicing has started.` | **CURRENT (2026-08-26):** issuer `withdrawal_completed`; investor `note_active_investor` (confirmed investors, platform only). No `ACTIVATE` / `note_active_issuer` | ISSUER copy is disbursement-complete; INVESTOR copy is investment-active for the same live activation moment | **IMPLEMENTED** (2026-08-26 audience split; still one `WITHDRAWAL_COMPLETED` event) |
| `ISSUER_PAYMENT_SUBMITTED` | ~~Issuer Payment Submitted~~ → **Repayment submitted** | Payment Submitted (description already says "repayment") | — | — | INCONSISTENT terminology | **IMPLEMENTED** |
| `PAYMENT_RECEIVED` | ~~Payment Received~~ (dead `PAYMENT_RECORDED` key never matched) → **Repayment received** | not shown | not shown | Repayment Received | INCONSISTENT | **IMPLEMENTED** |
| `PAYMENT_APPROVED` / `PAYMENT_REJECTED` | raw fallback → **Repayment approved / rejected** | not shown | not shown | — *(copy-review)* · **CURRENT (2026-08-25):** `PAYMENT_REJECTED` → `note_payment_rejected` (issuer org, platform only). `PAYMENT_APPROVED` still uses investor `note_payment_received` | GENERIC_FALLBACK | **IMPLEMENTED** |
| `SETTLEMENT_PREVIEWED` / `_APPROVED` / `_POSTED` | Settlement previewed/approved/posted | — | Settlement Posted | Settlement Posted | CONSISTENT | NO_ACTION |
| `NOTE_DEFAULT_MARKED` | ~~Default marked~~ → **Note defaulted** | Note Defaulted | Note Defaulted | Note marked as default | INCONSISTENT | **IMPLEMENTED** |
| `NOTE_FACILITY_FEE_COLLECTION_WAIVED` | raw fallback → **Facility fee collection waived** | — (derived UI shows same phrase) | — | — | GENERIC_FALLBACK | **IMPLEMENTED** |
| `ISSUER_DISBURSEMENT_WITHDRAWAL_CREATED` | raw fallback → **Disbursement instruction created** | not shown | not shown | — | RAW_EVENT_NAME | **IMPLEMENTED** |
| `WITHDRAWAL_LETTER_GENERATED` | raw fallback → **Withdrawal letter generated** | — | — | — | GENERIC_FALLBACK | **IMPLEMENTED** |
| `WITHDRAWAL_SUBMITTED_TO_TRUSTEE` | raw fallback → **Withdrawal submitted to trustee** | — | — | ~~(registered, never sent — dead)~~ **RESOLVED (2026-08-24):** now live `withdrawal_submitted_to_trustee` (issuer org, platform only) | GENERIC_FALLBACK | **IMPLEMENTED** (admin label this pass; notification wiring landed in a later pass — see `audit-event-surface-matrix.md` §3.2) |
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
| `NAME_CHECK`, `NAME_CHECK_APPROVED`, `NAME_CHECK_REJECTED` | Name check needed/approved/rejected | CONSISTENT | NO_ACTION · **CURRENT (2026-08-25):** `NAME_CHECK_REJECTED` → `deposit_name_check_rejected` (investor-deposit org, platform only). `NAME_CHECK` / `NAME_CHECK_APPROVED` stay silent |
| `CAPTURE_MISMATCH` | Amount/Currency/Payment mismatch found (context-specific) | CONSISTENT | NO_ACTION |
| `EXPIRED` | Payment expired | CONSISTENT | NO_ACTION |
| `REFUND_INITIATED` → `REFUNDED` | Refund requested → Refund completed | INTENTIONALLY_DIFFERENT (admin action label vs logged event) | NO_ACTION · **CURRENT (2026-08-25):** `deposit_refund_initiated` / `deposit_refunded` (investor-deposit org, platform only) |
| `REFUND_WALLET_REVERSAL_FAILED` | Wallet balance could not be updated | CONSISTENT | NO_ACTION |
| `OVERRIDE_PROPOSED/APPROVED/REJECTED` (dead) | copy exists, never triggered | DEAD_COPY_REFERENCE | NO_ACTION |

---

## 6. Legal Documents & Acceptance Evidence

| Event | Admin UI | CSV/Export | Classification | Status |
|---|---|---|---|---|
| `LEGAL_DOCUMENT_CREATED` / `_UPDATED` | Document created / updated | ~~raw enum~~ → **friendly label** | INCONSISTENT (UI vs CSV) | **IMPLEMENTED** (`audit-admin-controller.ts`) |
| `LEGAL_VERSION_UPLOADED` / `_FILE_REPLACED` / `_PUBLISHED` / `_ARCHIVED` / `_RESTORED` | Version uploaded/file replaced/published/archived/restored | ~~raw enum~~ → **friendly label** (all 5) | INCONSISTENT (UI vs CSV) | **IMPLEMENTED** |
| Acceptance status `NOT_OPENED` / `OPENED` / `ACCEPTED` | Not opened / Opened / Accepted | ~~raw enum~~ → **friendly label** | INCONSISTENT (UI vs CSV) | **IMPLEMENTED** (`acceptance-admin-controller.ts`) |
| `CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING` casing across timeline/badge/CSV | ~~3 slightly different casings~~ → aligned to canonical | ~~INCONSISTENT (cosmetic)~~ | **RESOLVED (2026-08-24)** — BEFORE: `admin-activity-timeline.tsx` already read "Facility/Invoice Acceptance Approved for Signing" (canonical); `contract-activity-csv.ts` read "Acceptance approved for signing" (no product prefix, all-lowercase); the Acceptance-tab phase badge (`getOfferAcceptanceStatusPresentation` in `packages/types/src/offer-acceptance.ts`, shared by both contract and invoice offer-acceptance UI) read "Approved For Signing" (capitalized "For"). DECISION: align wording/preposition casing to the canonical `Facility/Invoice Acceptance Approved for Signing` term from `activity-notification-copy-standard.md` §2 without threading product-type context into the shared, product-agnostic badge function (that would be a component/prop-signature change, out of scope for a copy-only pass). AFTER: CSV now reads "Facility acceptance approved for signing" (product-prefixed, matches this CSV's own sentence-case convention); badge now reads "Approved for Signing" (lowercase preposition, same meaning, no product prefix since the shared function has no product-type input). Admin timeline copy was already correct and is unchanged. Meaning, visibility, and workflow are unchanged on all three surfaces. |
| ~~`BOARD_RESOLUTION_UPLOADED/REMOVED`~~ | ~~test-fixture only~~ **CORRECTED (2026-08-24)** — zero occurrences in the repository; phantom search-index hits from an unmerged branch, not real event types (matrix §8.1) | ~~DEAD_COPY_REFERENCE~~ NOT_AN_ACTUAL_EVENT | NO_ACTION |

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
`kyc_rejected`, `login_new_device`, `application_approved`.

~~`withdrawal_submitted_to_trustee`~~ — **RESOLVED (2026-08-24)**, no longer dead. BEFORE: the
`WITHDRAWAL_SUBMITTED_TO_TRUSTEE` audit event fired in `notes/service.ts:markWithdrawalSubmitted`
but no `sendTyped*` call site existed for the registered `withdrawal_submitted_to_trustee`
notification. DECISION: product approved wiring it (informational-only, no new type). AFTER: that
same method now calls `notifyWithdrawalSubmittedToTrustee()` right after the audit-event write,
reusing the existing `sendToIssuerOrg` recipient helper — same channel/preference/workflow as every
other note-lifecycle notification, only the trigger was added.

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

**Later passes (2026-08-24):** the 2026-08-24 non-compliance cleanup pass resolved 3 of the 6
`NEEDS_PRODUCT_DECISION` items above (§1 row 41/42, §2 rows 47/48, plus the onboarding/trustee items
tracked in `audit-product-gap-review.md`). The 2026-08-24 cosmetic-only follow-up pass separately
resolved 2 of the remaining deferred low-value cosmetic items (signing-package casing; `*_ACCEPTANCE_APPROVED_FOR_SIGNING`
casing). Only the seed `name` vs inbox `title` drift (item 5 in "Items Requiring a Product Decision")
remains open, by explicit product decision to leave seed content untouched.

**Later pass (2026-08-25 notification coverage):** nine live audit events gained registry
notifications. This copy-review's original Notification-column "—" / "never sent" cells above are
**historical of the copy pass**, not current coverage. Current mappings (see matrix §3.2 / §5.1):
`APPLICATION_SUBMITTED` → `application_submitted_confirmation`;
`CONTRACT_SIGNING_DEADLINE_EXTENDED` → `contract_signing_deadline_extended`;
`INVOICE_SIGNING_DEADLINE_EXTENDED` → `invoice_signing_deadline_extended`;
`CONTRACT_FACILITY_DISABLED` → `facility_disabled`;
`PAYMENT_REJECTED` → `note_payment_rejected`;
`WITHDRAWAL_COMPLETED` → `withdrawal_completed` (issuer, ISSUER_DISBURSEMENT only) + `note_active_investor` (confirmed investors, same moment, 2026-08-26);
`NAME_CHECK_REJECTED` → `deposit_name_check_rejected`;
`REFUND_INITIATED` → `deposit_refund_initiated`;
`REFUNDED` → `deposit_refunded`.
`PRODUCT_INACTIVATED` / `PRODUCT_REACTIVATED` were later reclassified **UNREACHABLE** (writers exist,
zero callers) — the "already-live values" note in §7 refers to the copy-pass type-union widening,
not current UI reachability.

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

**Follow-up implementation pass (2026-08-24)** — files changed for items 1–3 above (see
`audit-event-catalog.md` for the complete list including new/updated test files):
`application-timeline.ts`, `facility-transactions.ts`, `apps/api/src/modules/applications/service.ts`,
`apps/api/src/modules/activity/adapters/organization-log.ts`,
`apps/admin/src/hooks/use-organization-logs.ts`,
`apps/api/src/modules/notification/note-lifecycle-notifications.ts`,
`apps/api/src/modules/notes/service.ts`.

**Cosmetic-only follow-up pass (2026-08-24)** — files changed for item 4 above:
`apps/admin/src/components/admin-activity-timeline.tsx` (signing-package label casing),
`apps/api/src/modules/activity/adapters/application-log.ts` (signing-package presentation-title
casing), `apps/admin/src/contracts/utils/contract-activity-csv.ts` (acceptance-approved-for-signing
label), `packages/types/src/offer-acceptance.ts` (offer-acceptance-phase badge preposition casing).
New/updated test files: `apps/admin/src/components/admin-activity-timeline-copy.test.ts` (new),
`apps/admin/src/contracts/utils/contract-activity-csv.test.ts` (updated),
`apps/issuer/src/lib/offer-acceptance-status-presentation.test.ts` (new),
`apps/api/src/modules/activity/adapters/application-log.test.ts` (updated). Presentation baseline
patched for `application-log.ts`, `admin-activity-timeline.tsx`, and `contract-activity-csv.ts`.

## Items Requiring a Product Decision (originally not implemented)

**Update (2026-08-24): items 1–3 below were subsequently approved by product and are now
implemented.** Items 4–5 remain deferred cosmetic items, unchanged. See
`audit-event-catalog.md` and `audit-product-gap-review.md` for the full BEFORE/DECISION/AFTER
record of each fix.

1. ~~**`CONTRACT_OFFER_ACCEPTANCE_SUBMITTED`, `_RESUBMITTED`, `CONTRACT_OFFER_EXPIRED`,
   `CONTRACT_SIGNING_DEADLINE_EXTENDED`** (and invoice equivalents) missing from
   `application-timeline.ts`'s and/or `facility-transactions.ts`'s label maps.~~ **RESOLVED** — all
   four (plus invoice equivalents) added to both files' label maps (and `facility-transactions.ts`'s
   `INVOICE_LOG_TYPES` set for the invoice signing-deadline event); intentionally-admin-only events
   (`CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING` / `INVOICE_ACCEPTANCE_APPROVED_FOR_SIGNING`) were
   deliberately left out of both maps.
2. ~~**`APPLICATION_RESUBMITTED` bare-PATCH path has no description** on the admin timeline.~~
   **RESOLVED** — `applications/service.ts:getApplicationLogs` now falls back to a plain
   `"Application resubmitted for review"` description when no `resubmit_changes.activity_summary`
   metadata exists; the rich `amendments/service.ts` resubmit path is unchanged.
3. ~~**`use-organization-logs.ts` dead filter entries and the `COD_REJECTED` portal-allowlist
   gap**~~ **RESOLVED** — `TNC_ACCEPTED`/`KYC_APPROVED`/`KYB_APPROVED` removed from the admin filter
   list (confirmed zero production writers; enum/rows untouched); `COD_REJECTED` added to
   `organization-log.ts`'s `getEventTypes()` and `buildPresentation()` with canonical copy.
4. ~~**Cosmetic capitalization-only inconsistencies** (signing-package Title Case vs lowercase across
   3 files; `CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING` 3-way casing) were catalogued but not
   auto-applied this pass — genuinely safe, but lower value than the fixes above; left for a future
   pass if desired.~~ **RESOLVED (2026-08-24), cosmetic-only follow-up pass** — see §5 and §6 rows
   above for the per-surface BEFORE/AFTER. Signing-package labels aligned to sentence case in
   `admin-activity-timeline.tsx` and `application-log.ts` (Facility Table and CSV were already
   correct); `CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING`/`INVOICE_ACCEPTANCE_APPROVED_FOR_SIGNING`
   aligned in `contract-activity-csv.ts` and the shared offer-acceptance-phase badge
   (`packages/types/src/offer-acceptance.ts`). No event, schema, visibility, remark, CSV
   row-inclusion, or notification-recipient/channel change in any of these edits.
5. **Seed `name` vs notification inbox `title` drift** (`contract_offer_sent`, `note_payment_received`)
   is a database seed-content edit, not a source-file copy fix, and remains intentionally untouched
   per product decision (seed changes don't guarantee existing environments update; left documented
   only, not implemented).
6. **Second same-day cleanup pass (2026-08-24):** additional non-compliance items approved and
   implemented — Admin Access-log and Security-log filter completeness (§3 above); the Admin-side
   `COD_REJECTED` org-detail visibility gap, separate from the issuer/investor-facing fix in item 3
   above (§3); the misleading `ONBOARDING_CANCELLED` portal copy, now "Onboarding Restarted" (§3);
   and the Note timeline/export 50-event cap (export path now unlimited, UI stays paginated). Also
   completed a documentation-only investigation and reclassified `AML_APPROVED` from LIVE to
   **UNREACHABLE** — see `audit-event-surface-matrix.md` §2.3/§9 and `audit-product-gap-review.md`
   §3.2/§5/§6 for the full trace; no copy or visibility change resulted from that reclassification,
   since the event was never actually written.
