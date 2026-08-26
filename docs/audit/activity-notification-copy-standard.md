# Activity & Notification Copy Standard

> **Document responsibility:** this file owns the **canonical terminology rules** — which word means
> which business action, and the casing conventions. It answers *"what should I call this on a new
> surface?"*
>
> | Question | Document |
> |---|---|
> | What happens for `EVENT_X`? | [`audit-event-surface-matrix.md`](./audit-event-surface-matrix.md) — **primary reference** |
> | Is the evidence we store good enough? | [`audit-event-catalog.md`](./audit-event-catalog.md) |
> | Why is it worded that way, and was it reviewed? | [`activity-notification-copy-review.md`](./activity-notification-copy-review.md) |
> | What is still broken or awaiting sign-off? | [`audit-product-gap-review.md`](./audit-product-gap-review.md) |
>
> This file states the **rule**. For the *actual current copy on every surface, verbatim*, see
> [`audit-event-surface-matrix.md`](./audit-event-surface-matrix.md) §2 — that is where the
> transcription of what the code says today is maintained.

Canonical terminology for user-visible audit/activity/notification copy, aligned to the
2026-08-26 wording pass (`docs/audit/final-copy-standardization-plan.md`). Same business action = same
core term everywhere; phrasing may soften per audience (Admin sees technical/forensic language,
Issuer/Investor see plain, audience-appropriate language), but the **business meaning must never
diverge** between surfaces.

This is a wording reference, not a workflow spec. It does not define when an event fires, who
receives it, or what is stored — see `docs/audit/audit-event-catalog.md` for that. Gaps in log
completeness or notification coverage are tracked in `docs/audit/audit-product-gap-review.md`, not
here.

Companion document: `docs/audit/activity-notification-copy-review.md` (per-event consistency
matrix, classifications, and implementation status).

---

## 1. Application Lifecycle

| Concept | Admin | Issuer | Notification |
|---|---|---|---|
| Draft created | Application Created | Application Started / You Started This Application | — |
| Submitted for review | Application Submitted | You Submitted This Application | Application Submitted |
| Amendments requested (admin → issuer) | Amendment Requested | **CashSouk Requested an Amendment** | Amendment Requested |
| Amendments resubmitted (issuer → admin) | Application Resubmitted | You Resubmitted This Application | Application Resubmitted |
| Rejected | Application Rejected | Your Application Was Not Approved | Application Rejected |
| Withdrawn (issuer-initiated) | Application Withdrawn | You Withdrew This Application / **Application Withdrawn** | Application Withdrawn |
| Returned to review | Application Returned to Review | Your Application Is Under Review Again (admin-only surface otherwise) | — |
| Completed (terminal) | Application Completed | Application Completed | Application Completed |

**DO NOT CONFUSE WITH:** "Completed" (funding/signing finished, terminal success) vs "Approved"
(dead event type, never written — do not reintroduce). "Withdrawn" (issuer closes their own
application) is a different action from "Rejected" (admin declines it) and "Retracted" (CashSouk
pulls back an offer before response) — see §2.

**LIVE EVENT TYPES:** `APPLICATION_CREATED`, `APPLICATION_SUBMITTED`, `APPLICATION_RESUBMITTED`,
`APPLICATION_REJECTED`, `APPLICATION_WITHDRAWN`, `APPLICATION_COMPLETED`,
`APPLICATION_RESET_TO_UNDER_REVIEW`, `AMENDMENTS_SUBMITTED`.
**DEAD:** `APPLICATION_APPROVED` (no writer; "completed" is the real terminal state — never merge
the two).

---

## 2. Facility / Invoice Offer & Acceptance

The three-way distinction below is the single most important terminology rule in this document —
it was previously collapsed into "Withdrawn" everywhere, which hid who took the action.

| Business moment | Actor | Canonical term |
|---|---|---|
| Issuer declines an offer sent to them | Issuer | **Declined / Rejected** |
| CashSouk pulls back an offer before the issuer responds | Admin/System | **Retracted** |
| A deadline passes with no response | System | **Expired** |
| Issuer application/offer is closed by the issuer themselves | Issuer | **Withdrawn** |

| Concept | Admin | Issuer | Notification |
|---|---|---|---|
| Offer sent | Facility/Invoice Offer Sent | You Received a Facility/Invoice Offer | Facility/Invoice Offer Received |
| Issuer declines the offer (`CONTRACT_WITHDRAWN` / `INVOICE_OFFER_REJECTED`) | **Facility/Invoice Offer Declined** | **You Declined the Facility/Invoice Offer** | Facility Offer Declined / Invoice Offer Declined (`application_withdrawn_confirmation` branches on `withdrawalReason`) |
| CashSouk retracts the offer (`CONTRACT_OFFER_RETRACTED` / `INVOICE_OFFER_RETRACTED`) | Facility/Invoice Offer Retracted | CashSouk Retracted the Facility/Invoice Offer | Facility Offer Retracted / Invoice Offer Retracted |
| Offer expires (`CONTRACT_OFFER_EXPIRED` / `INVOICE_OFFER_EXPIRED`) | Facility/Invoice Offer Expired | Facility/invoice offer expired | Offer Expired / Offer Expiring Soon |
| Acceptance documents submitted | Facility/Invoice Offer Acceptance Submitted | Facility/invoice acceptance submitted | — |
| Acceptance documents resubmitted after changes requested | Facility/Invoice Offer Acceptance Resubmitted | Facility/invoice acceptance resubmitted | Acceptance Documents Need Updates (on request) |
| Acceptance approved, ready to sign | Facility/Invoice Acceptance Approved for Signing | (admin-only surface) | — |
| Offer fully signed (`CONTRACT_OFFER_ACCEPTED` / `INVOICE_OFFER_ACCEPTED`) | Facility/Invoice Offer Signed | **Facility/Invoice Offer Signed** | — |
| Signing deadline extended | Signing Deadline Extended | Signing deadline extended | Signing Deadline Extended |
| Facility disabled | Facility Disabled | — | Facility Disabled |

**DO NOT CONFUSE WITH:** Do not use "Withdrawn" or "Rejected" for an issuer's decline (`CONTRACT_WITHDRAWN`) —
that is a **decline**, not a withdrawal. "Withdrawn" is reserved for `APPLICATION_WITHDRAWN` (issuer closes
their own application). "Retracted" is reserved for CashSouk pulling back an offer
(`CONTRACT_OFFER_RETRACTED` / `INVOICE_OFFER_RETRACTED`). Do not use
"Accepted" for the terminal signed state — "signed" is the correct verb
because the moment fires when the signing package completes, not when the issuer clicks "accept."

**Note on the Acceptance-tab phase badge:** `getOfferAcceptanceStatusPresentation` (`packages/types`)
renders the `APPROVED_FOR_SIGNING` sub-status as **"Approved for Signing"** (no Facility/Invoice
prefix) because that function is shared, product-agnostic UI used by both contract and invoice
offer-acceptance panels — it has no product-type input to key a prefix off of. This is not a copy
bug; product context is already visible elsewhere on that screen. Only the audit-log/CSV/Admin-timeline
copy for the underlying `CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING` / `INVOICE_ACCEPTANCE_APPROVED_FOR_SIGNING`
events uses the full "Facility/Invoice Acceptance Approved for Signing" term below.

**LIVE EVENT TYPES (contract):** `CONTRACT_OFFER_SENT`, `CONTRACT_OFFER_ACCEPTANCE_SUBMITTED`,
`CONTRACT_OFFER_ACCEPTANCE_RESUBMITTED`, `CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING`,
`CONTRACT_OFFER_ACCEPTED`, `CONTRACT_OFFER_RETRACTED`, `CONTRACT_OFFER_EXPIRED`,
`CONTRACT_SIGNING_DEADLINE_EXTENDED`, `CONTRACT_WITHDRAWN`, `CONTRACT_FACILITY_OCCUPANCY_UPDATED`,
`CONTRACT_FACILITY_DISABLED`, `CONTRACT_FACILITY_ENABLED`, `CONTRACT_FACILITY_FEE_WAIVED`.
**Invoice equivalents:** same suffixes under `INVOICE_*` (plus `INVOICE_SIGNING_DEADLINE_EXTENDED`).
**DEAD / HISTORICAL_COMPATIBILITY_ONLY:** `CONTRACT_OFFER_REJECTED` (zero current production writer — do not confuse with live `CONTRACT_WITHDRAWN`,
which is the event that actually fires when an issuer declines). `CONTRACT_FACILITY_ENABLED` and
`CONTRACT_FACILITY_FEE_WAIVED` are live audit events; they do **not** currently send a registry
notification (investigated 2026-08-25 — OPTIONAL / KEEP_SILENT).

---

## 3. Signing Packages

| Concept | Canonical term | Notes |
|---|---|---|
| Draft package created | Signing Package Created | Title Case on Admin/CSV |
| Sent to signers | Signing package sent | Direct email uses "Signature requested: {title}" — audience-appropriate, not a copy bug |
| All signers complete | Signing package completed | Hidden from admin/issuer timeline UI by design (audit/CSV-only); the user-facing milestone is "Facility/Invoice Offer Signed" |
| Voided | Signing package voided | |
| Per-signer status | Pending / Email sent / Viewed / Signed / Declined | Consistent across admin and issuer progress matrices |
| Container status | Draft / Sent / In Progress / Completed / Declined / Voided / Expired | |

**DO NOT CONFUSE WITH:** "Signing Package Completed" (the internal envelope/audit event) is not
the same user-facing milestone as "Facility Offer Signed" (the business outcome an issuer/admin
actually cares about) — both are correct, for different audiences, and should not be merged.

**LIVE EVENT TYPES:** `SIGNING_PACKAGE_CREATED`, `SIGNING_PACKAGE_SENT`,
`SIGNING_PACKAGE_COMPLETED`, `SIGNING_PACKAGE_VOIDED`.

---

## 4. Onboarding

| Concept | Admin | General Activity (Issuer/Investor) |
|---|---|---|
| Started | Onboarding Started | Onboarding Started |
| Admin restarts onboarding (`ONBOARDING_CANCELLED` — forensic name; actor is admin, not the user) | Onboarding Restarted | **Onboarding Restarted** (not "Closed", and not "Cancelled" — "cancelled" reads as permanent termination, but the actual action is a restart. Description: "Your previous onboarding request was cancelled and a new onboarding request has been started.") |
| Rejected by admin | Onboarding Rejected | Onboarding Rejected |
| Submission approved (admin clears a gate; onboarding continues) | Onboarding Approved | **Onboarding Submission Approved** — "no further action needed" must never appear here, since more steps may follow |
| Final approval (terminal, full platform access granted) | Final Approval | **Onboarding Approved** — this is the only moment where "no further action is needed" is true |

**DO NOT CONFUSE WITH:** `ONBOARDING_APPROVED` (an intermediate submission-approval gate that can
fire mid-flow) and `FINAL_APPROVAL_COMPLETED` (the terminal, full-access moment) are **different
business moments that happen to share a similar name** — they must never share identical "no
further action is needed" copy on a portal-facing surface.

**LIVE EVENT TYPES:** `ONBOARDING_STARTED`, `ONBOARDING_CANCELLED`, `ONBOARDING_REJECTED`,
`ONBOARDING_APPROVED`, `FINAL_APPROVAL_COMPLETED`, plus admin-only compliance sub-steps
(`SSM_APPROVED`, `TNC_APPROVED`, `ONBOARDING_STATUS_UPDATED` — the generic status-transition bucket
that also carries KYC-status changes via `metadata.trigger` (e.g. `trigger:"KYC_APPROVED"`) **and**
the live AML-clearance milestone via `metadata.amlApproved:true` — `FORM_FILLED`,
`SOPHISTICATED_STATUS_UPDATED`).

**UNREACHABLE (writer exists, no UI caller — reclassified 2026-08-24):** `AML_APPROVED` is a
designed manual admin AML approval/override — the route, service, SDK method, and
`useApproveAmlScreening` hook all exist, but no `.tsx` component calls the hook, so it can never
actually be written from the current Admin UI. The live AML mechanism is
`ONBOARDING_STATUS_UPDATED` + `metadata.amlApproved:true` (listed above), not `AML_APPROVED`. If a
copy need ever arises for `AML_APPROVED`, do not assume it behaves like the other admin-only
sub-steps above — confirm reachability first. Full trace in `audit-event-surface-matrix.md` §2.3.

**DEAD / LEGACY (declared, no production writer):** `TNC_ACCEPTED` (`onboarding_logs` — **SEED_ONLY**; the live
terms-acceptance path writes `TNC_APPROVED`, not this), `KYC_APPROVED` (`onboarding_logs` — **SEED_ONLY**;
the live KYC-status path writes `ONBOARDING_STATUS_UPDATED` with `trigger:"KYC_APPROVED"` in metadata
instead), `KYB_APPROVED` (`onboarding_logs` — **DEAD**, not seed-only: zero `seed.ts` writer; display
union/label artifacts removed 2026-08-25), `KYC_STATUS_UPDATED` (declared under `access_logs`,
not `onboarding_logs` — despite the name, it is not an onboarding compliance sub-step; **SEED_ONLY**).
`TNC_ACCEPTED` / `KYC_APPROVED` / `KYC_STATUS_UPDATED` remain in seed/history display maps for
historical compatibility. See `audit-event-catalog.md` §1.1–1.3.

---

## 5. Access & Security

| Concept | Canonical term |
|---|---|
| Account created | Sign Up (two words, matches the table-row badge; toolbar filter now aligned) |
| Login / Logout | Login / Logout |
| Password changed | Password Changed |
| Role added / switched | Role Added / Role Switched |
| Email verified (`EMAIL_CHANGED`) | Email Verified (not "Email Changed") |
| Access-log user profile edit (`access_logs.PROFILE_UPDATED`) | User Profile Updated |
| Onboarding org profile edit (`onboarding_logs.PROFILE_UPDATED`) | Organization Profile Updated |
| Security self-service profile (`security_logs.PROFILE_UPDATED`) | Profile Updated |

**LIVE EVENT TYPES:** `LOGIN`, `LOGOUT`, `SIGNUP`, `PASSWORD_CHANGED`, `EMAIL_CHANGED`,
`ROLE_SWITCHED`, `PROFILE_UPDATED` (`access_logs.PROFILE_UPDATED` is **LIVE_UI_REACHABLE**).
`security_logs.ROLE_CREATED`, `ROLE_REMOVED` (catalogue), `ROLE_PERMISSIONS_UPDATED`, and
`INVITATION_REVOKED` are also **LIVE_UI_REACHABLE**.
**UNREACHABLE_FROM_UI / API_REACHABLE:** `access_logs.ROLE_ADDED`, `access_logs.ROLE_REMOVED`.
**UNREACHABLE_FROM_UI / ROUTE_ONLY:** `access_logs.ONBOARDING_RESET`.
**UNREACHABLE:** `onboarding_logs.ONBOARDING_RESET`. Do not treat `access_logs.ROLE_ADDED` as a
normal live UI action.

---

## 6. Notes (Issuance, Funding, Servicing)

| Concept | Admin | Issuer | Investor | Notification |
|---|---|---|---|---|
| Published to marketplace | **Note Published** | Note Published | (not shown) | Note Published |
| Campaign paused / resumed | Campaign paused / resumed | Campaign Paused / Resumed | — | — |
| Funding closed (success) | Funding Closed | Funding Closed | — | Funding Closed |
| Funding failed | **Funding unsuccessful** | Funding Unsuccessful | Funding Unsuccessful | Note funding did not complete (issuer) / Commitment released (investor) |
| Note activated / servicing starts | **Note Activated** | Your Note Is Active | Your Investment Is Active | Your Note Is Active (issuer) / Your Investment Is Active (investor) |
| Issuer repayment submitted | **Repayment Submitted** | You Submitted a Repayment | — | — |
| Repayment recorded | **Repayment received** | — | — | Repayment Received |
| Repayment approved / rejected | **Repayment approved / rejected** | — | — | Repayment Rejected (issuer, on reject) |
| Settlement posted | Settlement posted | — | Settlement Posted | Settlement Posted |
| Default | **Note Defaulted** | Your Note Is in Default | Your Investment Is in Default | Your Note Is in Default / Your Investment Is in Default |
| Disbursement to issuer completed (`WITHDRAWAL_COMPLETED`) | **Withdrawal Completed** | **Your Disbursement Is Complete** (ISSUER_DISBURSEMENT only) | **Your Investment Is Active** (ISSUER_DISBURSEMENT only) | Issuer: Your Disbursement Is Complete *(ISSUER_DISBURSEMENT only)* · Investor: Your Investment Is Active (`note_active_investor`, same moment) |

**DO NOT CONFUSE WITH:** `ACTIVATE` (manual/fallback servicing start; writes `ACTIVATE`) and
`WITHDRAWAL_COMPLETED` (issuer disbursement payout completes; this is the live path that also
sets the note ACTIVE). They remain different audit events. Issuer copy stays disbursement-complete;
investor copy for the same `WITHDRAWAL_COMPLETED` row is investment-active, matching `ACTIVATE`
investor wording, without duplicating an `ACTIVATE` event. Use "Payment"/"Repayment"
consistently as **Repayment** (the noun issuers and investors actually see in descriptions) rather
than the more generic "Payment" that leaked into several admin-only fallback labels.

**LIVE EVENT TYPES (`note_events`, 42 live / 42 documented):** see `docs/audit/audit-event-catalog.md` §3
for the full list; headline terms above cover the ones with more than one presentation surface.

---

## 7. Legal Documents & Acceptance Evidence

| Concept | Canonical term |
|---|---|
| Document/version admin actions | Document created / updated; Version uploaded / file replaced / published / archived / restored |
| Acceptance evidence status | Not opened / Opened / Accepted |

**LIVE EVENT TYPES:** `LEGAL_DOCUMENT_CREATED`, `LEGAL_DOCUMENT_UPDATED`,
`LEGAL_VERSION_UPLOADED`, `LEGAL_VERSION_FILE_REPLACED`, `LEGAL_VERSION_PUBLISHED`,
`LEGAL_VERSION_ARCHIVED`, `LEGAL_VERSION_RESTORED`.
~~**DEAD:** `BOARD_RESOLUTION_UPLOADED` / `BOARD_RESOLUTION_REMOVED` (test-fixture only).~~
**CORRECTED (2026-08-24):** these strings do not exist anywhere in the repository. They are phantom
search-index hits from an unmerged branch — see
[`audit-event-surface-matrix.md`](./audit-event-surface-matrix.md) §8.1. Do not coin copy for them.

---

## 8. Products

| Concept | Canonical term |
|---|---|
| Created / Updated / Deleted | Created / Updated / Deleted |
| Hidden from issuers | **Inactivated** |
| Restored | **Reactivated** |

**LIVE EVENT TYPES:** `PRODUCT_CREATED`, `PRODUCT_UPDATED`, `PRODUCT_DELETED`.
**UNREACHABLE (writer exists, zero callers):** `PRODUCT_INACTIVATED`, `PRODUCT_REACTIVATED` — filter
badges exist, but `setInactive` / `restoreProduct` have no route or UI caller. Do not describe them
as normal live product actions.

---

## 9. Gateway Payment Events (Admin-only)

| Concept | Canonical term |
|---|---|
| Name mismatch found | Name check needed / approved / rejected |
| Amount/currency mismatch | Amount mismatch found / Currency mismatch found |
| Expired | Payment expired |
| Refund | Refund requested → Refund completed |

**LIVE EVENT TYPES:** `NAME_CHECK`, `NAME_CHECK_APPROVED`, `NAME_CHECK_REJECTED`,
`CAPTURE_MISMATCH`, `EXPIRED`, `REFUND_INITIATED`, `REFUNDED`, `REFUND_WALLET_REVERSAL_FAILED`.
**DEAD:** `OVERRIDE_PROPOSED` / `OVERRIDE_APPROVED` / `OVERRIDE_REJECTED` (PostgreSQL enum members
exist, never triggered — do not claim removed).

Investor-deposit notifications (2026-08-25; `INVESTOR_DEPOSIT` only; platform only; deposit's
investor organization members): name-check rejected → **Deposit Verification Failed**; refund
started → **Refund Started**; refund completed → **Refund Completed**. There is **no** discrete
gateway success/capture event and **no** successful-deposit inbox notification.

---

## 10. Notifications — General Rules

- Notification title/message must use the **same core term** as the Activity surface for the same
  event, even when phrasing is shortened for a push/inbox format.
- Only **live, automatically-sent** notification types are copy-governed by this standard. The
  following registry entries have no live `sendTyped`/`sendTypedPlatformOnly` call site and their
  template text is dead copy, excluded from consistency requirements until wired up:
  `system_announcement`, `new_product_alert` (**BULK-ONLY**), `kyc_approved`, `kyc_rejected`,
  `login_new_device`, `application_approved` (**DEAD_NOT_CONFIGURABLE** — zero automatic send path;
  hidden from Admin Notification Configuration; retained in registry/seed/history; never shown in
  end-user Account preferences, which only list `MARKETING` types).
  `withdrawal_submitted_to_trustee` is **no longer in this dead list** — as of 2026-08-24 it is
  wired via `notifyWithdrawalSubmittedToTrustee()` (`note-lifecycle-notifications.ts`), called from
  `notes/service.ts:markWithdrawalSubmitted` right after the `WITHDRAWAL_SUBMITTED_TO_TRUSTEE`
  audit-event write, and is copy-governed like any other live notification.
- **2026-08-25 coverage pass (live, copy-governed):** `application_submitted_confirmation`,
  `contract_signing_deadline_extended`, `invoice_signing_deadline_extended`, `facility_disabled`,
  `note_payment_rejected`, `withdrawal_completed`, `deposit_name_check_rejected`,
  `deposit_refund_initiated`, `deposit_refunded`. Use the same core term as the matching Activity
  label where one exists (`Application Submitted`, `Signing Deadline Extended`, `Repayment rejected`,
  `Disbursement Completed`, `Refund requested`/`Refund completed`).
- Audience framing is allowed to differ (issuer vs. investor notifications for the same event may
  use different actor framing — e.g. "Note is active" vs "Investment is active") as long as the
  underlying business fact stated is identical.
