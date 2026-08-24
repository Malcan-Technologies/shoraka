# Audit & Notification Product Gap Review

> **Document responsibility:** this file owns **unresolved product/compliance gaps** and the
> **historical resolution record** for gaps that have since been closed. It answers *"what is still
> broken or awaiting product sign-off?"* It is deliberately **not** the place to look up what an
> event does or where it appears.
>
> | Question | Document |
> |---|---|
> | What happens for `EVENT_X`? | [`audit-event-surface-matrix.md`](./audit-event-surface-matrix.md) — **primary reference** |
> | Is the evidence we store good enough? | [`audit-event-catalog.md`](./audit-event-catalog.md) |
> | What should I *call* this on a new surface? | [`activity-notification-copy-standard.md`](./activity-notification-copy-standard.md) |
> | Why is it worded that way, and was it reviewed? | [`activity-notification-copy-review.md`](./activity-notification-copy-review.md) |
>
> **Reconciled against source 2026-08-24.** Several findings below were stale — either already fixed
> or never accurate. Rather than deleting them, each carries a strikethrough plus a
> **RESOLVED** / **CORRECTED** annotation so the history stays legible. Counts in §1 and §5 are
> superseded by [`audit-event-surface-matrix.md`](./audit-event-surface-matrix.md) §7.
>
> ⚠️ **Before acting on any finding here, re-verify against source with `rg`/`cat`.** Editor search
> indexes on this repository return phantom files under `apps/api/src/modules/*/audit/` that do not
> exist on disk and carry a different event vocabulary. See matrix §8.1.

This is a **findings-and-recommendations report**, not an implementation. It covers log completeness, correct representation of business actions, notification correctness, and compliance-evidence gaps across Admin, Issuer, and Investor portals, cross-checked against the *Cashsouk Issuer User Journey v2 ATS* compliance document.

Companion document: [`audit-event-catalog.md`](./audit-event-catalog.md) (developer reference for every live event/notification, by module).

**Change policy applied to this pass:** per the preservation-first contract that governs this codebase's audit system, findings below are only auto-implemented when they are (a) test/documentation defects, (b) low-risk missing evidence on an *existing* writer that adds no new UI-visible output, or (c) broken description/remark propagation. Everything else — wording changes, new notifications, reminder-cadence changes, sequencing/business-rule changes — is **reported for a product decision**, not silently fixed, because it changes user-visible behavior or compliance posture.

---

## 1. Executive summary

| Category | Count | Severity |
|---|---|---|
| Compliance sequence/requirement gaps vs. issuer journey PDF | 9 | **HIGH** — several are hard regulatory requirements (reminder cadence, fee timing, Notice of Assignment, guarantor acknowledgment) |
| Notification correctness issues (dead, misdirected, or missing) | 8 | MEDIUM–HIGH |
| Presentation/visibility mismatches (stored but hidden, or mislabeled) | ~~11~~ **6 still open** — 5 of the 11 have since been resolved or were found to be inaccurate (see §4) | MEDIUM |
| Dead events (declared, never written) | ~~17 confirmed (16 previously catalogued + `DIRECTOR_KYC_STATUS_UPDATED`)~~ **19 non-live values, using precise classifications** — see matrix §7.1. `DIRECTOR_KYC_STATUS_UPDATED` was **not** a real event and has been withdrawn from the count | LOW (no user impact; cleanup candidates only) |
| Data-quality / evidence gaps on live writers | 6 | LOW–MEDIUM |
| Fixed in this pass | 1 (stale code comment) | — |

**Bottom line:** the audit/logging *plumbing* (writers, tables, standard fields) built in the prior preservation-standardization phase is sound and well-tested. The gaps found in **this** phase are almost entirely **product/business-logic gaps that predate that work** — things origin/main never implemented, not things the standardization broke. The highest-priority items are the four compliance-sequence mismatches in §2, because they represent code behavior that contradicts a written regulatory requirement today, in production, regardless of any audit-logging work.

**Follow-up implementation pass (2026-08-24):** product subsequently approved and this repo now implements 5 of the previously-reported, non-compliance items: §3.1 `withdrawal_submitted_to_trustee` wiring; §4 items 1 (`COD_REJECTED` Activity visibility), 7 (issuer timeline milestone visibility), and 11 (dead onboarding filter cleanup); and §6 item 4 (`APPLICATION_RESUBMITTED` bare-path description). All nine §2 compliance-sequence gaps and every other §3/§4/§6 item are explicitly **left untouched** — see the inline strikethrough/RESOLVED annotations below for exactly what changed and why. Full BEFORE/DECISION/AFTER detail lives in `audit-event-catalog.md`.

---

## 2. Compliance sequence gaps (issuer journey PDF cross-check)

These were verified by direct code inspection, not by the writer/catalog audit — they are business-logic findings, but they surfaced *because* this audit review was matching each event's evidence against a written requirement.

| # | Requirement (issuer journey PDF) | Code reality | Evidence | Classification |
|---|---|---|---|---|
| 1 | LO acceptance reminders at **day 3 and day 6** of a 7-day clock | Only **one** reminder, at day 6 (`days_before_expiry: 1`) | `packages/types/src/deadline-config.ts:25-28` | **WRONG_TIMING** |
| 2 | Signing reminders at **day 7 and day 12** of a 14-day clock | Reminders at **day 11 and day 13** (`days_before_expiry: 3` and `1`) | `packages/types/src/deadline-config.ts:30-33` | **WRONG_TIMING** |
| 3 | Onboarding fee charged **after** AML approval | Company issuer fee is charged **before** eKYC/AML (`terms → fee → verify`) | `packages/config/src/onboarding-flow.ts:114-135` | **WRONG_SEQUENCE** |
| 4 | Notice of Assignment + written paymaster acknowledgment **before disbursement** | No such gate anywhere in code; searched application/signing/disbursement modules | Repo-wide search, zero matches | **MISSING** |
| 5 | Guarantee Acknowledgment paired with Letter of Offer at issuance | Guarantors are only contacted at the **signing** phase, not at offer/LO issue; no acknowledgment-tracking entity | `admin/service.ts:sendContractOffer` (issuer-only notify); `signing/service.ts` (signing-phase emails) | **MISSING** |
| 6 | Risk Statement as an active, exportable self-declaration form | Checkbox + PDF-open only; acceptance row has no risk-questionnaire payload | `legal-documents.ts` (`RISK_STATEMENT` wording); `acceptance-service.ts` | **MISSING** |
| 7 | Warning Statement shown at signup, on every new financing application, and permanently visible; each display logged | Signup capture only; compact portal footer omits the Warning link; no per-application display/acknowledgment log | `legal-documents.ts:89-96` (footer list); `compact-portal-legal-links.ts:18-25` | **PARTIAL** |
| 8 | T&C publication gated by Securities Commission clearance | Draft/publish + hash + optional re-acceptance exists; no SC-clearance field or gate | `legal-documents/schemas.ts:publishVersionSchema` (only has `reacceptanceRequired`) | **PARTIAL** |
| 9 | Sale Contract profit rate capped at 18% p.a. | No cap validation; schema allows any non-negative rate | `notes/schemas.ts:133` (`profitRatePercent: min(0)`) | **MISSING** |

**Not a gap — confirmed working:** the 80%-minimum-funding rule and investor refund-on-failure path are fully implemented (`closeFunding`/`failFunding` + `creditInvestorBalance`), and money movements are correctly segregated into ledger buckets (`INVESTOR_POOL`, `REPAYMENT_POOL`, `ISSUER_PAYABLE`, `OPERATING_ACCOUNT`) even though there is no single schema-level "trust account" entity.

**Recommended next step:** items 1, 2, and 3 are the most concrete and lowest-effort to fix (they're config/sequencing changes, not new features) but **all three change user-facing timing/flow behavior**, so they need explicit product sign-off before implementation — not because the fix is technically hard, but because changing when a fee is charged or when a reminder fires is a business decision, not a logging decision. Items 4–9 are larger product gaps (missing entities/workflows) that should go on a backlog, prioritized by legal/compliance review.

---

## 3. Notification correctness issues

### 3.1 Dead notification types (registered, zero automatic trigger)

Confirmed via exhaustive `sendTyped`/`sendTypedPlatformOnly` call-site search across `apps/api/src`:

| Type ID | Why it matters | Classification |
|---|---|---|
| `login_new_device` | Template exists ("Login from New Device") but no device-fingerprinting/new-device-detection code calls it | MISSING_REQUIRED_NOTIFICATION (if still wanted) |
| `kyc_approved` / `kyc_rejected` | Identity-verification decisions are communicated via `onboarding_approved`/`onboarding_rejected` instead; these two are pure leftovers | DEAD — candidate for registry cleanup, not a coverage gap |
| `application_approved` | No `APPLICATION_APPROVED` log writer either (see catalog §2.1); `application_completed` is the real terminal signal | DEAD — candidate for registry cleanup |
| ~~`withdrawal_submitted_to_trustee`~~ | ~~Audit event **is** logged (`WITHDRAWAL_SUBMITTED_TO_TRUSTEE` in `note_events`); the user-facing notification for the same moment is simply never sent~~ | ~~**MISSING_REQUIRED_NOTIFICATION**~~ **RESOLVED (2026-08-24)** — see recommendation below |
| `system_announcement` / `new_product_alert` | Never triggered via `sendTyped*`; only reachable through the admin's manual bulk-broadcast tool, which bypasses these registry templates entirely and uses admin-typed copy instead | DEAD as automatic triggers — registry entries are effectively unused templates |

**Recommendation:** `withdrawal_submitted_to_trustee` is the one item here that looks like an unintentional gap rather than a stale registry entry — the audit trail proves the business moment fires in production, but the corresponding user notification was apparently never wired up. This is a **product decision** on whether issuers should be told when their withdrawal is submitted to the trustee (most likely yes), but wiring it is a one-line `sendTyped` call once approved — flagging for product sign-off rather than implementing silently, since it changes what issuers see in their inbox.

**RESOLVED (2026-08-24):** BEFORE — as described above, no `sendTyped*` call site existed. DECISION — approved; issuers should be told (informational only). AFTER — `notes/service.ts:markWithdrawalSubmitted` now calls `notifyWithdrawalSubmittedToTrustee()` (in `note-lifecycle-notifications.ts`) right after the existing `WITHDRAWAL_SUBMITTED_TO_TRUSTEE` audit-event write, reusing the established `sendToIssuerOrg` recipient helper (issuer org owner + members, platform-only channel, same pattern as other note-lifecycle notifications). No new notification type, no channel/preference/workflow/status/timing change.

### 3.2 Missing notifications for business decisions that currently only log

| Business moment | Currently | Classification |
|---|---|---|
| Admin approves onboarding submission (pre-AML gate) | `ONBOARDING_APPROVED` logged, no notification | BUSINESS_DECISION_REQUIRED |
| Admin approves AML screening | `AML_APPROVED` logged, no notification | BUSINESS_DECISION_REQUIRED |
| Admin approves SSM/CTOS verification | `SSM_APPROVED` logged, no notification | BUSINESS_DECISION_REQUIRED |
| Application submitted (issuer's own confirmation) | `APPLICATION_SUBMITTED` logged, no confirmation notification | BUSINESS_DECISION_REQUIRED |
| Issuer full repayment / note payoff to issuer per-payment | Only `note_repaid_issuer` on full payoff; no partial-payment notice to issuer | BUSINESS_DECISION_REQUIRED |
| Gateway refund/deposit events | No notification types exist for refund or deposit-name-check outcomes | MISSING_REQUIRED_NOTIFICATION (if product requires) |

These are almost all intermediate admin gates that precede a later, larger milestone that *is* notified (e.g., AML approval precedes final activation, which is notified). Whether the intermediate steps deserve their own notification is a UX decision for product, not something to infer from the code.

### 3.3 Recipient-scope inconsistency (not wrong, but worth knowing)

Three different, independently-intentional recipient patterns exist across domains for what is conceptually the same "who represents this org" question:

- **Application/offer notifications:** org owner + `OWNER`/`ORGANIZATION_ADMIN` members.
- **Note-lifecycle notifications:** org owner + **all** org members (broader).
- **Director/shareholder action-required notifications:** org owner **only** (narrower).

None of these is "wrong" in isolation, but the same organization will see different notification audiences depending on which domain fired the event. This is worth product awareness, not a code defect — no action taken.

### 3.4 Reminder-copy gap

`offer_expiry_reminder_24h` is used for **every** configured reminder day (not just 24h before expiry) — its name is misleading internally but has no user-facing impact since the copy itself says "expires in N days." Invoice-offer expiry/reminder payloads omit `invoiceNumber`, so invoice reminder copy is generically worded where contract reminders include the contract number. Low-priority copy improvement, reported not fixed.

---

## 4. Presentation / visibility mismatches

| # | Finding | Where | Classification |
|---|---|---|---|
| 1 | ~~`COD_REJECTED` (corporate onboarding rejection) is excluded from the issuer/investor Activity feed allowlist, even though the `ONBOARDING_REJECTED` notification **is** sent for the same rejection~~ **RESOLVED (2026-08-24)** — added to `getEventTypes()` with canonical "Onboarding Rejected" copy; see `audit-event-catalog.md` §1.4 for BEFORE/DECISION/AFTER | `OrganizationLogAdapter.getEventTypes()` | VISIBILITY_MISMATCH — user gets a notification pointing at an event that then doesn't appear in their own activity history |
| 2 | ~~`ONBOARDING_APPROVED` and `FINAL_APPROVAL_COMPLETED` share the identical portal title "Onboarding Approved"~~ **CORRECTED (2026-08-24)** — the finding is stale. BEFORE: reported as identical. DECISION: re-verify in source. AFTER: `organization-log.ts:216–225` gives them **distinct** titles and descriptions — `ONBOARDING_APPROVED` → "Onboarding Submission Approved", `FINAL_APPROVAL_COMPLETED` → "Onboarding Approved". No action required | ~~`organization-log.ts:211-216`~~ `organization-log.ts:216-225` | ~~MISLEADING~~ **NOT A DEFECT** |
| 3 | Admin Access-log filter dropdown lists `KYC_STATUS_UPDATED` (never written) but omits live `ROLE_ADDED`, `ROLE_REMOVED`, `PROFILE_UPDATED`, `ONBOARDING_RESET` | `access-logs-panel.tsx:11-16` | VISIBILITY_MISMATCH |
| 4 | Admin Security-log filter shows 5 types; `ROLE_CREATED`, `ROLE_REMOVED`, `ROLE_PERMISSIONS_UPDATED`, `INVITATION_REVOKED` are stored but excluded | `security-logs-panel.tsx` | VISIBILITY_MISMATCH |
| 5 | ~~`CONTRACT_WITHDRAWN` (fired when an **issuer rejects** an offer) is labeled **"Facility Offer Withdrawn"** in the admin timeline and CSV — identical wording to `CONTRACT_OFFER_RETRACTED`~~ **RESOLVED (2026-08-24)**. BEFORE: as described; the parenthetical also claimed the issuer timeline said "Facility withdrawn". DECISION: relabel so the admin surfaces state who acted. AFTER, verified in source: admin timeline `CONTRACT_WITHDRAWN: "Facility Offer Rejected"` (`admin-activity-timeline.tsx:149`) vs `CONTRACT_OFFER_RETRACTED: "Facility Offer Retracted"` (:145); CSV `"Facility offer rejected"` (`contract-activity-csv.ts:35`) vs `"Facility offer retracted"` (:31). Issuer copy is **"You declined the facility offer"** (`application-timeline.ts:33`), not "Facility withdrawn". The confusing `"Facility Offer Withdrawn"` string now sits only on the **dead** `CONTRACT_OFFER_REJECTED`, which no writer can produce | `admin-activity-timeline.tsx:144-149`; `contract-activity-csv.ts:30-35` | ~~MISLEADING~~ **RESOLVED** |
| 6 | ~~`AMENDMENTS_SUBMITTED` issuer-facing label reads **"You submitted requested changes"** — but the writer is the **admin** sending amendment requests **to** the issuer~~ **RESOLVED (2026-08-24)**. BEFORE: as described. DECISION: reword so the direction of action is correct. AFTER, verified in source: **both** issuer surfaces now read **"Changes requested"** (`facility-transactions.ts:52`, `application-timeline.ts:44`), the issuer activity feed reads "Changes Requested" / "We need updates to your application before it can continue." (`application-log.ts:602`), admin reads "Amendment Request Sent" and CSV reads "Amendment request sent". The misleading *enum name* remains — it is documented as a permanent naming trap in matrix §8.2, not renamed | `facility-transactions.ts:52`; `application-timeline.ts:44` | ~~MISLEADING~~ **RESOLVED (copy)**; enum name intentionally left alone |
| 7 | ~~Issuer timeline `EVENT_LABELS` map still keys off dead `OFFER_EXPIRED`/`CONTRACT_OFFER_REJECTED` instead of the live `CONTRACT_OFFER_EXPIRED`/`CONTRACT_WITHDRAWN` — those milestones fall through to a generic label or don't render~~ **RESOLVED** — `CONTRACT_WITHDRAWN` relabeled in the prior copy-consistency pass; `CONTRACT_OFFER_EXPIRED` (plus the other 7 approved milestones, contract + invoice) added to the label map on 2026-08-24, see `audit-event-catalog.md` §2.2 | `application-timeline.ts:27-35` | VISIBILITY_MISMATCH / GENERIC_FALLBACK |
| 8 | `application_review_events` table has no production reader at all (confirmed: `admin/repository.ts` never queries it; `RecentActivityCard` ignores its `events` prop when `applicationId` is set) | catalog §2.5 | Documentation fixed in this pass (stale header comment corrected); table itself left untouched per the preservation contract |
| 9 | Admin note timeline **and** its CSV export are hard-capped at 50 events (`take: 50`), with no unlimited compliance-export path | `noteInclude.events`; `NoteTimelinePanel` | MEDIUM — a note with a long servicing history can silently lose early events from both the UI and any export pulled from it |
| 10 | ~~Product-log admin panel badges/filters only style `PRODUCT_CREATED`/`_UPDATED`/`_DELETED`; `_INACTIVATED`/`_REACTIVATED` fall back to a raw badge~~ **CORRECTED (2026-08-24)** — the finding was inaccurate. All **five** types have a label and a colour (`product-logs-panel.tsx:39-43`). The real, more serious issue is the inverse: `PRODUCT_INACTIVATED` and `PRODUCT_REACTIVATED` are **UNREACHABLE** — their writers (`setInactive()`, `restoreProduct()`) have zero callers, so the panel offers two filter options that can never return a row. Reclassified below | ~~`product-logs-panel.tsx:38-42`~~ `product-logs-panel.tsx:39-43` | ~~GENERIC_FALLBACK~~ **UNREACHABLE_WRITER** — still open, cosmetic impact only |
| 11 | ~~Legacy dead event types (`TNC_ACCEPTED`, `KYC_APPROVED`, `KYB_APPROVED`) still appear as filter options in the admin org-log dropdown despite never being written~~ **RESOLVED (2026-08-24)** — removed from the `ONBOARDING_EVENT_TYPES` query-inclusion array after reconfirming zero production writers; enum values and historical rows untouched | `use-organization-logs.ts` filter list | VISIBILITY_MISMATCH — dropdown offers options that always return zero results |

**Items 1, 7, and 11 were approved and implemented on 2026-08-24**; **items 5 and 6 were also
resolved** by the copy-consistency pass; **items 2 and 10 were found to be inaccurate** and are
corrected above. That leaves **items 3, 4, 8, 9, and the reclassified 10 open**:

| Still open | Nature | Why it was not silently fixed |
|---|---|---|
| 3, 4 | Admin filter dropdowns omit live event types and offer dead ones | Changing a filter list changes which rows an admin sees; needs sign-off |
| 8 | `application_review_events` has no production reader | Table left in place per the preservation contract |
| 9 | Note timeline **and** its CSV export are hard-capped at 50 events | Export/pagination behaviour change |
| 10 *(reclassified)* | `PRODUCT_INACTIVATED` / `PRODUCT_REACTIVATED` writers are unreachable | Either wire the callers or remove the filter options — a product decision either way |

See `audit-event-catalog.md` for full BEFORE/DECISION/AFTER detail on the implemented items.

---

## 5. Dead events (confirmed, no action needed)

These were already largely known from the preservation inventory. **Re-verified 2026-08-24** — two
of the previously-reported entries turned out not to be real events at all.

| Table | Non-live values | Status |
|---|---|---|
| `access_logs` | `ROLE_SWITCHED`, `ONBOARDING`, `USER_COMPLETED`, `ONBOARDING_STATUS_UPDATED`, `PASSWORD_CHANGED`, `EMAIL_CHANGED` (6 — each has a live equivalent in a *different* table) | Confirmed |
| `access_logs` | `KYC_STATUS_UPDATED` | Reclassified **SEED_ONLY** (written by `seed.ts`, so not strictly "never written") |
| `onboarding_logs` | `TNC_ACCEPTED`, `KYC_APPROVED`, `KYB_APPROVED` (3) | Reclassified **SEED_ONLY**; removed from the admin filter list on 2026-08-24, enum/rows untouched — see §4 item 11 |
| `onboarding_logs` | `USER_COMPLETED` | Reclassified **DEV_ONLY** — the sole writer is `regtank/webhook-handler-dev.ts` (~492), which targets `DATABASE_URL_DEV` |
| ~~`onboarding_logs` (**new find**)~~ | ~~`DIRECTOR_KYC_STATUS_UPDATED` — has a writer module (`director-kyc-outcomes.ts`) but zero importers anywhere~~ | **WITHDRAWN (2026-08-24)** — `rg` returns **zero** occurrences of that string anywhere in the repository, and `director-kyc-outcomes.ts` does not exist. Reclassified `NOT_AN_ACTUAL_EVENT`; almost certainly a phantom search-index hit. Director/shareholder outcomes are recorded as `EOD_APPROVED` / `EOD_REJECTED` / `EOD_WEBHOOK` |
| `application_logs` | `APPLICATION_APPROVED`, `CONTRACT_OFFER_REJECTED` (2) | Confirmed **DEAD** |
| `note_events` | `ISSUER_RESIDUAL_WITHDRAWAL_CREATED` (1) | Confirmed **DEAD** |
| `gateway_payment_events` | `OVERRIDE_PROPOSED`, `OVERRIDE_APPROVED`, `OVERRIDE_REJECTED` (3) | Confirmed **DEAD** |
| `product_logs` | `PRODUCT_INACTIVATED`, `PRODUCT_REACTIVATED` (2) | **UNREACHABLE** — writers exist, zero callers. Newly classified; see §4 item 10 |
| ~~`legal-documents` (test-fixture only)~~ | ~~`BOARD_RESOLUTION_UPLOADED`, `BOARD_RESOLUTION_REMOVED` — never referenced outside `cutover.test.ts`~~ | **WITHDRAWN (2026-08-24)** — `cutover.test.ts` does not exist on disk and both strings have zero occurrences. Phantom index hits from an unmerged branch; see matrix §8.1 |

~~**Total: 17 confirmed dead events/actions**~~ **Total: 19 non-live values across the eight stores**,
using the precise classifications above. The full per-store breakdown lives in
[`audit-event-surface-matrix.md`](./audit-event-surface-matrix.md) §7.1, which is now the
authoritative count. Per the preservation contract, **none were removed** — dead enum members and
unused columns are cleanup candidates for a future, separate change, not something to touch here.

---

## 6. Data-quality / evidence gaps on live writers

| # | Finding | Assessment | Recommended action |
|---|---|---|---|
| 1 | `COD_REJECTED` (corporate onboarding rejection) metadata has no rejection reason field, unlike the individual-onboarding `ONBOARDING_REJECTED` path | PARTIAL | Report — adding a reason requires confirming the COD webhook payload actually carries one; not a zero-query, guaranteed-available field at this call site, so not auto-fixed. **Note:** the *visibility* half of this event (Activity feed exposure) was separately resolved on 2026-08-24; this specific evidence-quality gap (no reason field) remains open/reported. |
| 2 | Automated AML clearance (`org-aml-milestone.ts`) writes `ONBOARDING_STATUS_UPDATED` with `amlApproved: true` in metadata, instead of the dedicated `AML_APPROVED` event used by the admin-driven path | PARTIAL — no human decision-maker captured for the automated path | Report — changing the event *type* written by a live path is a presentation/filter-affecting change (would move rows between admin timeline categories), not a safe silent fix |
| 3 | `APPLICATION_REJECTED` log does not store the rejection reason on the log row itself | PARTIAL | Report — reason may exist elsewhere in the application record; needs product confirmation of the desired evidence shape before touching |
| 4 | ~~`APPLICATION_RESUBMITTED` has two writer paths: the rich `amendments/service.ts:resubmitApplication` (full metadata) and a bare `PATCH .../status` with `status=RESUBMITTED` that writes no metadata at all~~ **RESOLVED (2026-08-24)** — confirmed both paths represent the same business action (a resubmission); the bare path now gets a plain, non-invented fallback description ("Application resubmitted for review") instead of rendering blank. Both writer paths and all existing rich metadata are otherwise unchanged; see `audit-event-catalog.md` §2.1 | PARTIAL on the second path | Report — the two paths may represent genuinely different UI actions; conflating them without confirming intent risks changing which flow issuers actually use |
| 5 | `signing_recipients.viewed_at` column exists in schema but is **never written** by any signing code path | MISSING_COMPLIANCE_EVIDENCE | Report — would need SigningCloud webhook/API investigation similar to the signer-IP gap already documented in the final report |
| 6 | A successful gateway deposit **capture** does not write any `gateway_payment_events` row — evidence for a successful deposit lives only in `gateway_payments` status + `investor_balance_transactions` + `note_ledger_entries`, while every *exception* path (name-check, mismatch, expiry, refund) does get an event row | Asymmetric evidence — the "happy path" is the only one without a discrete event | Report — this is arguably correct-by-design (the ledger entry *is* the evidence for a routine success), but worth explicit product confirmation given how much weight the compliance review places on gateway events specifically |

---

## 7. Notable things verified as compliant / working correctly

To keep this report honest about what is *not* broken:

- 80% minimum-funding rule and investor refund-on-failure path: **fully implemented and correct**.
- Ledger segregation (`INVESTOR_POOL`/`REPAYMENT_POOL`/`ISSUER_PAYABLE`/`OPERATING_ACCOUNT`) with idempotent posting (`note_ledger_entries.idempotency_key`): **correct**.
- PDPA consent captured as its own record, separate from other legal documents, and enforced before the eKYC step: **correct**.
- Legal document audit trail (version, hash, timestamp, IP, acknowledgement text) for every acceptance: **correct** (Rule C.2 for legal documents specifically — signing-time signer IP remains the separately-documented UNKNOWN gap from the final report).
- Board Resolution / acceptance-document upload → admin per-item review → approve-for-signing gate: **implemented**, via the generic acceptance-documents pipeline (not a dedicated "Board Resolution" table, but functionally equivalent and hard-gated before signing can start).
- Risk-rating capture (A–F) before an invoice offer can be sent, frozen into the prospectus at approval/publish: **correct**.
- Automatic offer/signing expiry enforcement (Rule C.1's "hard blocks + automatic lapse"): **correct** — the expiry job reliably transitions stale offers to `EXPIRED`/`OFFER_EXPIRED` regardless of the reminder-cadence gap noted in §2.

---

## 8. Recommended next steps (for product/compliance sign-off, not auto-implemented)

Ranked by combination of compliance risk and implementation simplicity:

1. **Reminder cadence (§2.1–2)** — config-only change (`deadline-config.ts` reminder arrays) once product confirms the exact required days; lowest engineering effort, highest compliance visibility.
2. ~~**`withdrawal_submitted_to_trustee` notification (§3.1)** — one `sendTyped` call once product confirms issuers should be told; audit trail already proves the underlying event fires.~~ **DONE (2026-08-24)** — see §3.1 for BEFORE/DECISION/AFTER.
3. **Onboarding fee sequencing (§2.3)** — requires product/legal decision on whether to move the fee step after AML approval, since it changes a monetization flow, not just a log.
4. ~~**Admin timeline mislabeling for `CONTRACT_WITHDRAWN` and `AMENDMENTS_SUBMITTED` (§4.5–6)** — pure string changes, but user-facing, so listed for product copy sign-off rather than engineering judgment call.~~ **DONE (2026-08-24)** — both resolved by the copy-consistency pass; see §4 items 5 and 6 for the verified after-state.
5. **Notice of Assignment, guarantor acknowledgment, Risk Statement form, T&C SC-clearance gate (§2.4–6, 2.9)** — larger workflow/entity additions; recommend a dedicated compliance-engineering backlog item per requirement, scoped and estimated separately from this audit review.
6. **Note timeline 50-event cap (§4.9)** — if compliance needs a full, unlimited export path, this is a straightforward addition (a dedicated export endpoint without the `take: 50`) that doesn't change the existing UI behavior at all.

No code beyond the one documentation-comment fix (§4.8 / catalog §2.5) was changed in this pass, consistent with the preservation-first contract governing this codebase's audit system.
