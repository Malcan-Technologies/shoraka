# Activity & Notification Copy Standard

Canonical terminology for user-visible audit/activity/notification copy, derived from the
majority-usage wording already live in the product (not invented). Same business action = same
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
| Draft created | Application Created | Application started / You created it | — |
| Submitted for review | Application Submitted | You submitted this application | — |
| Amendments requested (admin → issuer) | Amendment Request Sent | **Changes requested** | Amendment Requested |
| Amendments resubmitted (issuer → admin) | Application Resubmitted | You resubmitted after changes | Application Resubmitted |
| Rejected | Application Rejected | Application was not approved | Application Rejected |
| Withdrawn (issuer-initiated) | Application Withdrawn | You withdrew this application / **Application Withdrawn** | Application Withdrawn |
| Reset to review | Application Reset to Under Review | Back under review (admin-only surface otherwise) | — |
| Completed (terminal) | Application Completed | Application completed | Application Completed |

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
| Offer sent | Facility/Invoice Offer Sent | Facility/Invoice offer sent | Facility/Invoice Offer Received |
| Issuer declines the offer (`CONTRACT_WITHDRAWN` / `INVOICE_OFFER_REJECTED`) | **Facility/Invoice Offer Rejected** | **You declined the facility/invoice offer** | (application_withdrawn / offer-specific) |
| CashSouk retracts the offer (`CONTRACT_OFFER_RETRACTED` / `INVOICE_OFFER_RETRACTED`) | Facility/Invoice Offer Retracted | Facility/invoice offer was withdrawn by CashSouk | Offer Updated |
| Offer expires (`CONTRACT_OFFER_EXPIRED` / `INVOICE_OFFER_EXPIRED`) | Facility/Invoice Offer Expired | Facility/invoice offer expired | Offer Expired / Offer Expiring Soon |
| Acceptance documents submitted | Facility/Invoice Offer Acceptance Submitted | Facility/invoice acceptance submitted | — |
| Acceptance documents resubmitted after changes requested | Facility/Invoice Offer Acceptance Resubmitted | Facility/invoice acceptance resubmitted | Acceptance Documents Need Updates (on request) |
| Acceptance approved, ready to sign | Facility/Invoice Acceptance Approved for Signing | (admin-only surface) | — |
| Offer fully signed (`CONTRACT_OFFER_ACCEPTED` / `INVOICE_OFFER_ACCEPTED`) | Facility/Invoice Offer Signed | **Facility/invoice offer signed** | — |

**DO NOT CONFUSE WITH:** Do not use "Withdrawn" for an issuer's decline (`CONTRACT_WITHDRAWN`) —
that is a rejection, not a withdrawal, and "Withdrawn" is reserved for `CONTRACT_OFFER_RETRACTED`
(admin/CashSouk side) and `APPLICATION_WITHDRAWN` (issuer closes their own application). Do not use
"Accepted" for the terminal signed state on issuer-facing surfaces — "signed" is the correct verb
because the moment fires when the signing package completes, not when the issuer clicks "accept."

**LIVE EVENT TYPES (contract):** `CONTRACT_OFFER_SENT`, `CONTRACT_OFFER_ACCEPTANCE_SUBMITTED`,
`CONTRACT_OFFER_ACCEPTANCE_RESUBMITTED`, `CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING`,
`CONTRACT_OFFER_ACCEPTED`, `CONTRACT_OFFER_RETRACTED`, `CONTRACT_OFFER_EXPIRED`,
`CONTRACT_SIGNING_DEADLINE_EXTENDED`, `CONTRACT_WITHDRAWN`, `CONTRACT_FACILITY_OCCUPANCY_UPDATED`.
**Invoice equivalents:** same suffixes under `INVOICE_*`.
**DEAD:** `CONTRACT_OFFER_REJECTED` (no writer — do not confuse with live `CONTRACT_WITHDRAWN`,
which is the event that actually fires when an issuer declines).

---

## 3. Signing Packages

| Concept | Canonical term | Notes |
|---|---|---|
| Draft package created | Signing package created | Sentence case, matches CSV/facility surfaces |
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
| Cancelled by user | Onboarding Cancelled | **Onboarding Cancelled** (not "Closed") |
| Rejected by admin | Onboarding Rejected | Onboarding Rejected |
| Submission approved (admin clears a gate; onboarding continues) | Onboarding Approved | **Onboarding Submission Approved** — "no further action needed" must never appear here, since more steps may follow |
| Final approval (terminal, full platform access granted) | Final Approval | **Onboarding Approved** — this is the only moment where "no further action is needed" is true |

**DO NOT CONFUSE WITH:** `ONBOARDING_APPROVED` (an intermediate submission-approval gate that can
fire mid-flow) and `FINAL_APPROVAL_COMPLETED` (the terminal, full-access moment) are **different
business moments that happen to share a similar name** — they must never share identical "no
further action is needed" copy on a portal-facing surface.

**LIVE EVENT TYPES:** `ONBOARDING_STARTED`, `ONBOARDING_CANCELLED`, `ONBOARDING_REJECTED`,
`ONBOARDING_APPROVED`, `FINAL_APPROVAL_COMPLETED`, plus admin-only compliance sub-steps
(`AML_APPROVED`, `SSM_APPROVED`, `TNC_APPROVED`/`TNC_ACCEPTED`, `KYC_STATUS_UPDATED`,
`FORM_FILLED`, `SOPHISTICATED_STATUS_UPDATED`).

---

## 5. Access & Security

| Concept | Canonical term |
|---|---|
| Account created | Sign Up (two words, matches the table-row badge; toolbar filter now aligned) |
| Login / Logout | Login / Logout |
| Password changed | Password Changed |
| Role added / switched | Role Added / Role Switched |

**LIVE EVENT TYPES:** `LOGIN`, `LOGOUT`, `SIGNUP`, `PASSWORD_CHANGED`, `EMAIL_CHANGED`,
`ROLE_ADDED`, `ROLE_SWITCHED`, `PROFILE_UPDATED`.

---

## 6. Notes (Issuance, Funding, Servicing)

| Concept | Admin | Issuer | Investor | Notification |
|---|---|---|---|---|
| Published to marketplace | **Note published** | Note Published | (not shown) | Note published |
| Campaign paused / resumed | Campaign paused / resumed | Campaign Paused / Resumed | — | — |
| Funding closed (success) | Funding closed | Funding Closed | — | Funding closed successfully |
| Funding failed | **Funding unsuccessful** | Funding Unsuccessful | Funding Unsuccessful | Note funding did not complete (issuer) / Commitment released (investor) |
| Note activated / servicing starts | **Note activated** | Note Active | Note Active | Note is active (issuer) / Investment is active (investor) |
| Issuer repayment submitted | **Repayment submitted** | Payment Submitted (description says "repayment") | — | — |
| Repayment recorded | **Repayment received** | — | — | Repayment Received |
| Repayment approved / rejected | **Repayment approved / rejected** | — | — | — |
| Settlement posted | Settlement posted | — | Settlement Posted | Settlement Posted |
| Default | **Note defaulted** | Note Defaulted | Note Defaulted | Note marked as default |
| Disbursement to issuer completed (`WITHDRAWAL_COMPLETED`) | **Withdrawal completed** | **Disbursement Completed** (was incorrectly sharing "Note Active" with `ACTIVATE`) | — | — |

**DO NOT CONFUSE WITH:** `ACTIVATE` (note servicing begins — the whole note goes live) and
`WITHDRAWAL_COMPLETED` (an issuer disbursement payout completes) are different business moments
that happened to share identical "Note Active" copy — disbursement completing does not mean the
note itself just activated (it may have activated earlier). Use "Payment"/"Repayment"
consistently as **Repayment** (the noun issuers and investors actually see in descriptions) rather
than the more generic "Payment" that leaked into several admin-only fallback labels.

**LIVE EVENT TYPES (`note_events`, 41 total):** see `docs/audit/audit-event-catalog.md` §for the
full list; headline terms above cover the ones with more than one presentation surface.

---

## 7. Legal Documents & Acceptance Evidence

| Concept | Canonical term |
|---|---|
| Document/version admin actions | Document created / updated; Version uploaded / file replaced / published / archived / restored |
| Acceptance evidence status | Not opened / Opened / Accepted |

**LIVE EVENT TYPES:** `LEGAL_DOCUMENT_CREATED`, `LEGAL_DOCUMENT_UPDATED`,
`LEGAL_VERSION_UPLOADED`, `LEGAL_VERSION_FILE_REPLACED`, `LEGAL_VERSION_PUBLISHED`,
`LEGAL_VERSION_ARCHIVED`, `LEGAL_VERSION_RESTORED`.
**DEAD:** `BOARD_RESOLUTION_UPLOADED` / `BOARD_RESOLUTION_REMOVED` (test-fixture only).

---

## 8. Products

| Concept | Canonical term |
|---|---|
| Created / Updated / Deleted | Created / Updated / Deleted |
| Hidden from issuers | **Inactivated** |
| Restored | **Reactivated** |

**LIVE EVENT TYPES:** `PRODUCT_CREATED`, `PRODUCT_UPDATED`, `PRODUCT_DELETED`,
`PRODUCT_INACTIVATED`, `PRODUCT_REACTIVATED`.

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
**DEAD:** `OVERRIDE_PROPOSED` / `OVERRIDE_APPROVED` / `OVERRIDE_REJECTED` (enum exists, never
triggered).

---

## 10. Notifications — General Rules

- Notification title/message must use the **same core term** as the Activity surface for the same
  event, even when phrasing is shortened for a push/inbox format.
- Only **live, automatically-sent** notification types are copy-governed by this standard. The
  following registry entries have no live `sendTyped`/`sendTypedPlatformOnly` call site and their
  template text is dead copy, excluded from consistency requirements until wired up:
  `system_announcement`, `new_product_alert`, `kyc_approved`, `kyc_rejected`,
  `login_new_device`, `application_approved`, `withdrawal_submitted_to_trustee`.
- Audience framing is allowed to differ (issuer vs. investor notifications for the same event may
  use different actor framing — e.g. "Note is active" vs "Investment is active") as long as the
  underlying business fact stated is identical.
