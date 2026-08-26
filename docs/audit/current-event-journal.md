# Current Audit / Activity / Notification Journal

Verified: 2026-08-26 (CURRENT USER-FACING COPY includes settlement trustee technical IDs `SETTLEMENT_TRUSTEE_LETTER_GENERATED` / `_EMAIL_SENT` / `_LETTER_SUBMITTED` / `_INSTRUCTION_COMPLETED`; source still wins on any remaining discrepancy)

Current audit counts:
- documented: 163
- live: 140
- not-live: 23

Current notification counts:
- registry: 51
- live automatic: 45
- dead: 4
- bulk-only: 2

## Standardization Summary

Count:
- CONSISTENT: 71
- INTENTIONALLY_DIFFERENT: 10
- STANDARDIZATION_RECOMMENDED: 43
- LEGACY_NAMING_TRAP: 15
- REQUIRES_DATA_CHANGE: 1

Primary classification is one of the first four. REQUIRES_DATA_CHANGE is an additional flag on the recommended wording, not a fifth exclusive class.


## How to use this journal

- Look up the **technical event** (`APPLICATION_SUBMITTED`).
- Read **CURRENT USER-FACING COPY** for what a human sees today on each surface.
- `Visible: NO` means the row exists (or would exist) but this surface does not show it.
- `Visible: N/A` means that surface does not exist for this domain.
- Investor Detail is **N/A for every audit event** — it renders `investor_balance_transactions`, not audit logs.
- **RECOMMENDED CANONICAL PRESENTATION** is a wording standard only. Do not implement from this file.
- Parked compliance items (LO reminders day 3+6, signing reminders day 7+12, onboarding fee after AML, Notice of Assignment/paymaster, Guarantee Acknowledgment, Risk Statement, Warning Statement, T&C SC-clearance, 18% Tawarruq cap) are out of scope here.


## Modules

- Application (7)
- Application Review / Amendments (9)
- Facility / Contract Offer (13)
- Invoice Offer (10)
- Signing (4)
- Onboarding / KYC / AML (21)
- Legal Documents / T&C (7)
- Notes / Funding (23)
- Repayment (15)
- Withdrawal / Disbursement / Trustee (6)
- Investor Deposit / Gateway / Refund (8)
- Products (3)
- Access (4)
- Security (10)



## Source vs document discrepancies noted in this pass

Source wins. These matrix leftovers were **not** journaled as current copy:

1. `docs/audit/audit-event-surface-matrix.md` §2.3 still quotes `ONBOARDING_CANCELLED` portal copy as `Onboarding Cancelled` / `Your organization onboarding was cancelled and will not continue.` **Current source** (`apps/api/src/modules/activity/adapters/organization-log.ts`) is `Onboarding Restarted` / `Your previous onboarding request was cancelled and a new onboarding request has been started.`
2. Matrix §2.3 still says admin detail for `COD_REJECTED` is Hidden (not queried). **Current source** includes `COD_REJECTED` in `ONBOARDING_EVENT_TYPES` (`apps/admin/src/hooks/use-organization-logs.ts`).
3. Matrix §2.7 still says notification for every gateway event is NO. **Current source** sends `deposit_name_check_rejected`, `deposit_refund_initiated`, and `deposit_refunded` for `INVESTOR_DEPOSIT` (registry JSON already matches source).
4. Matrix §2.6 still says the admin note timeline CSV inherits a 50-event cap. **Current source**: UI timeline `take: 50`; dedicated export uses `findAllEventsByNoteId` (uncapped). Journal CSV for note events is the dedicated export label, not the capped UI payload.


# Application

## `APPLICATION_CREATED`

Status: LIVE

Module: Application

Business action:
Issuer creates a draft financing application.

Technical event:
`APPLICATION_CREATED`

Canonical business name:
`Application Created`

Actor:
Issuer

Trigger:
Issuer POST /v1/applications.

Stored in:
`application_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Application Created`
- Description: `—`

Admin Detail
- Visible: YES
- Title: `Application Created`
- Description: `—`

Issuer General Activity
- Visible: YES
- Title: `Application Started`
- Description: `You created a financing application and can continue it before submitting.`

Issuer Application Detail
- Visible: YES
- Title: `You Started This Application`
- Description: `— (label only)`

Issuer Facility / Transaction Detail
- Visible: YES
- Title: `Facility Application Started`
- Description: `— (label only)`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Application Created`
- Description/Remark: `remark column (usually empty)`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Application Ref] exists after activity enrich but is not currently interpolated into this copy

### CONSISTENCY REVIEW

Classification:
STANDARDIZATION_RECOMMENDED

Admin/CSV use Created; issuer general activity and application detail use Started; facility detail prefixes Facility application.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Application Created`

Preferred Admin Description:
`[Actor] created application [Application Ref].`

Preferred User Description:
`You created application [Application Ref] and can continue it before submitting.`

Preferred Notification Title:
`Application Created`

Preferred Notification Message:
`You created application [Application Ref]. Continue the draft and submit it for review when ready.`

## `APPLICATION_SUBMITTED`

Status: LIVE

Module: Application

Business action:
Issuer submits an application for review.

Technical event:
`APPLICATION_SUBMITTED`

Canonical business name:
`Application Submitted`

Actor:
Issuer

Trigger:
Issuer PATCH application status to SUBMITTED.

Stored in:
`application_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Application Submitted`
- Description: `—`

Admin Detail
- Visible: YES
- Title: `Application Submitted`
- Description: `—`

Issuer General Activity
- Visible: YES
- Title: `Application Submitted`
- Description: `Your financing application was submitted and is now under review.`

Issuer Application Detail
- Visible: YES
- Title: `You Submitted This Application`
- Description: `— (label only)`

Issuer Facility / Transaction Detail
- Visible: YES
- Title: `Facility Application Submitted`
- Description: `— (label only)`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Application Submitted`
- Description/Remark: `remark column (usually empty)`

Notification
- Sends: YES
- Type: `application_submitted_confirmation`
- Title: `Application Submitted`
- Message: `Your application [Application Ref] has been submitted successfully and is now under review.`
- Recipient: `issuer owner + org admins`
- Channel: `platform only`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Application Ref]

### CONSISTENCY REVIEW

Classification:
STANDARDIZATION_RECOMMENDED

The business title is stable on admin and general activity, but application-detail and facility-detail titles are different sentences, and CSV uses sentence case.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Application Submitted`

Preferred Admin Description:
`[Actor] submitted application [Application Ref] for review.`

Preferred User Description:
`Your application [Application Ref] was submitted for review.`

Preferred Notification Title:
`Application Submitted`

Preferred Notification Message:
`Your application [Application Ref] has been submitted successfully and is now under review.`

## `APPLICATION_RESUBMITTED`

Status: LIVE

Module: Application

Business action:
Issuer resubmits an application after requested amendments.

Technical event:
`APPLICATION_RESUBMITTED`

Canonical business name:
`Application Resubmitted`

Actor:
Issuer

Trigger:
Path A: issuer resubmit-after-amendments. Path B: PATCH status to RESUBMITTED.

Stored in:
`application_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Application Resubmitted`
- Description: `Path A may show Changes submitted: [section labels]`

Admin Detail
- Visible: YES
- Title: `Application Resubmitted`
- Description: `Path A: Changes submitted: [section labels]. Path B: none.`

Issuer General Activity
- Visible: YES
- Title: `Application Resubmitted`
- Description: `You resubmitted your application after making the requested updates. (or You resubmitted your application after updating the requested information. when resubmit_changes.activity_summary is present)`

Issuer Application Detail
- Visible: YES
- Title: `You Resubmitted This Application`
- Description: `— (label only)`

Issuer Facility / Transaction Detail
- Visible: YES
- Title: `Facility Application Resubmitted`
- Description: `— (label only)`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Application Resubmitted`
- Description/Remark: `remark / metadata as stored`

Notification
- Sends: YES
- Type: `application_resubmitted_confirmation`
- Title: `Application Resubmitted`
- Message: `Your application [Application Ref] was successfully resubmitted for review (review cycle [review cycle]).`
- Recipient: `issuer owner + org admins`
- Channel: `platform + email per registry`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Application Ref]

### CONSISTENCY REVIEW

Classification:
STANDARDIZATION_RECOMMENDED

Same title-split as Submitted: detail and facility surfaces use different sentences; two description variants exist for general activity.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Application Resubmitted`

Preferred Admin Description:
`[Actor] resubmitted application [Application Ref] for review.`

Preferred User Description:
`You resubmitted application [Application Ref] after making the requested updates.`

Preferred Notification Title:
`Application Resubmitted`

Preferred Notification Message:
`Your application [Application Ref] was successfully resubmitted for review (review cycle [review cycle]).`

## `APPLICATION_REJECTED`

Status: LIVE

Module: Application

Business action:
Admin rejects the application. No rejection reason is collected on the current overall-reject flow.

Technical event:
`APPLICATION_REJECTED`

Canonical business name:
`Application Rejected`

Actor:
Admin

Trigger:
Admin sets application status to REJECTED.

Stored in:
`application_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Application Rejected`
- Description: `— (remark is null by design on this flow)`

Admin Detail
- Visible: YES
- Title: `Application Rejected`
- Description: `— (remark is null by design on this flow)`

Issuer General Activity
- Visible: YES
- Title: `Application Rejected`
- Description: `Your financing application was rejected and will not continue.`

Issuer Application Detail
- Visible: YES
- Title: `Your Application Was Not Approved`
- Description: `— (label only)`

Issuer Facility / Transaction Detail
- Visible: YES
- Title: `Facility Application Was Not Approved`
- Description: `— (label only)`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Application Rejected`
- Description/Remark: `remark column is empty on this flow`

Notification
- Sends: YES
- Type: `application_rejected`
- Title: `Application Rejected`
- Message: `Your application [Application Ref] has been rejected.`
- Recipient: `issuer owner + org admins`
- Channel: `platform + email per registry`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Application Ref]

### CONSISTENCY REVIEW

Classification:
STANDARDIZATION_RECOMMENDED

General-activity title is Application Rejected, but application-detail and facility-detail titles switch to was not approved. Do not add a [Reason] — the current flow does not collect one.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Application Rejected`

Preferred Admin Description:
`[Actor] rejected application [Application Ref].`

Preferred User Description:
`Your application [Application Ref] was not approved.`

Preferred Notification Title:
`Application Rejected`

Preferred Notification Message:
`Your application [Application Ref] has been rejected.`

## `APPLICATION_WITHDRAWN`

Status: LIVE

Module: Application

Business action:
Issuer closes their own application (direct cancel, or cascaded from declining the facility / withdrawing the last invoice).

Technical event:
`APPLICATION_WITHDRAWN`

Canonical business name:
`Application Withdrawn`

Actor:
Issuer

Trigger:
Issuer cancel; issuer declines facility (cascade); last invoice withdrawn (cascade).

Stored in:
`application_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Application Withdrawn`
- Description: `withdraw_reason when stored (e.g. USER_CANCELLED)`

Admin Detail
- Visible: YES
- Title: `Application Withdrawn`
- Description: `withdraw_reason when stored`

Issuer General Activity
- Visible: YES
- Title: `Application Withdrawn`
- Description: `Your financing application was withdrawn and is no longer active.`

Issuer Application Detail
- Visible: YES
- Title: `You Withdrew This Application`
- Description: `— (label only)`

Issuer Facility / Transaction Detail
- Visible: YES
- Title: `Facility Application Withdrawn`
- Description: `— (label only)`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Application Withdrawn`
- Description/Remark: `remark / withdraw_reason when stored`

Notification
- Sends: YES
- Type: `application_withdrawn_confirmation`
- Title: `Application Withdrawn`
- Message: `Your application [Application Ref] has been withdrawn successfully.`
- Recipient: `issuer owner + org admins`
- Channel: `platform + email per registry`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Application Ref], [Reason]

### CONSISTENCY REVIEW

Classification:
STANDARDIZATION_RECOMMENDED

Keep Withdrawn as the business term. Detail and facility titles currently paraphrase it. Distinct from Admin Rejected and from issuer declining a facility offer.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Application Withdrawn`

Preferred Admin Description:
`[Actor] withdrew application [Application Ref].`

Preferred User Description:
`Your application [Application Ref] was withdrawn and is no longer active.`

Preferred Notification Title:
`Application Withdrawn`

Preferred Notification Message:
`Your application [Application Ref] has been withdrawn successfully.`

## `APPLICATION_COMPLETED`

Status: LIVE

Module: Application

Business action:
Offer accepted; application reaches terminal success.

Technical event:
`APPLICATION_COMPLETED`

Canonical business name:
`Application Completed`

Actor:
Issuer

Trigger:
Contract or invoice offer accepted, completing the application.

Stored in:
`application_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Application Completed`
- Description: `—`

Admin Detail
- Visible: YES
- Title: `Application Completed`
- Description: `—`

Issuer General Activity
- Visible: YES
- Title: `Application Completed`
- Description: `Your financing application completed successfully.`

Issuer Application Detail
- Visible: YES
- Title: `Application Completed`
- Description: `— (label only)`

Issuer Facility / Transaction Detail
- Visible: YES
- Title: `Facility Application Completed`
- Description: `— (label only)`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Application Completed`
- Description/Remark: `remark column (usually empty)`

Notification
- Sends: YES
- Type: `application_completed`
- Title: `Application Completed`
- Message: `Your application [Application Ref] has been completed successfully.`
- Recipient: `issuer owner + org admins`
- Channel: `platform + email per registry`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Application Ref]

### CONSISTENCY REVIEW

Classification:
STANDARDIZATION_RECOMMENDED

Title is stable except CSV/detail sentence-case and the facility-detail Facility application prefix.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Application Completed`

Preferred Admin Description:
`Application [Application Ref] completed successfully.`

Preferred User Description:
`Your application [Application Ref] completed successfully.`

Preferred Notification Title:
`Application Completed`

Preferred Notification Message:
`Your application [Application Ref] has been completed successfully.`

## `APPLICATION_RESET_TO_UNDER_REVIEW`

Status: LIVE

Module: Application

Business action:
Admin returns the application to under review.

Technical event:
`APPLICATION_RESET_TO_UNDER_REVIEW`

Canonical business name:
`Application Reset to Under Review`

Actor:
Admin

Trigger:
Admin sets application status back to UNDER_REVIEW.

Stored in:
`application_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Application Returned to Review`
- Description: `previous_status in metadata`

Admin Detail
- Visible: YES
- Title: `Application Returned to Review`
- Description: `previous_status in metadata`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: YES
- Title: `Your Application Is Under Review Again`
- Description: `— (label only)`

Issuer Facility / Transaction Detail
- Visible: NO
- Note: fetched then dropped by the surface label/visibility map
- Title: `—`
- Description: `Hidden (visibility map)`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Application Returned to Review`
- Description/Remark: `previous_status in metadata`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Application Ref], [Old Status]

### CONSISTENCY REVIEW

Classification:
STANDARDIZATION_RECOMMENDED

Application-detail title Back under review does not match the admin/CSV canonical phrase.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Application Reset to Under Review`

Preferred Admin Description:
`[Actor] reset application [Application Ref] to under review (from [Old Status]).`

Preferred User Description:
`Application [Application Ref] is back under review.`

Preferred Notification Title:
`Application Reset to Under Review`

Preferred Notification Message:
`Application [Application Ref] was returned to under review.`

# Application Review / Amendments

## `SECTION_REVIEWED_APPROVED`

Status: LIVE

Module: Application Review / Amendments

Business action:
Admin approves a review section.

Technical event:
`SECTION_REVIEWED_APPROVED`

Canonical business name:
`Section Approved`

Actor:
Admin

Trigger:
Admin sets a section status to APPROVED (event type built as SECTION_REVIEWED_${newStatus}).

Stored in:
`application_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `[Section] Section Approved`
- Description: `remark when stored`

Admin Detail
- Visible: YES
- Title: `[Section] Section Approved`
- Description: `remark when stored`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: NO
- Note: fetched then dropped by the surface label/visibility map
- Title: `—`
- Description: `Hidden (visibility map)`

Issuer Facility / Transaction Detail
- Visible: NO
- Note: fetched then dropped by the surface label/visibility map
- Title: `—`
- Description: `Hidden (visibility map)`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Section approved`
- Description/Remark: `remark when stored`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Section], [Reason]

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Admin title includes the section name; CSV drops it. No issuer timeline by design.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Section Approved`

Preferred Admin Description:
`[Actor] approved the [Section] section on application [Application Ref].`

Preferred User Description:
`— (not shown to users today; keep admin-only unless product changes visibility)`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `SECTION_REVIEWED_REJECTED`

Status: LIVE

Module: Application Review / Amendments

Business action:
Admin rejects a review section.

Technical event:
`SECTION_REVIEWED_REJECTED`

Canonical business name:
`Section Rejected`

Actor:
Admin

Trigger:
Admin sets a section status to REJECTED.

Stored in:
`application_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `[Section] Section Rejected`
- Description: `[Reason] from remark (required on this flow)`

Admin Detail
- Visible: YES
- Title: `[Section] Section Rejected`
- Description: `[Reason] from remark`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: YES
- Title: `A Section Was Not Approved`
- Description: `— (label only)`

Issuer Facility / Transaction Detail
- Visible: NO
- Note: fetched then dropped by the surface label/visibility map
- Title: `—`
- Description: `Hidden (visibility map)`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Section Rejected`
- Description/Remark: `remark = [Reason]`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Section], [Reason], [Application Ref]

### CONSISTENCY REVIEW

Classification:
STANDARDIZATION_RECOMMENDED

Issuer application-detail title is generic (A section was not approved) while admin names the section and uses Rejected.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Section Rejected`

Preferred Admin Description:
`[Actor] rejected the [Section] section on application [Application Ref]. [Reason]`

Preferred User Description:
`The [Section] section on application [Application Ref] was not approved.`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `SECTION_REVIEWED_AMENDMENT_REQUESTED`

Status: LIVE

Module: Application Review / Amendments

Business action:
Admin requests changes on a review section.

Technical event:
`SECTION_REVIEWED_AMENDMENT_REQUESTED`

Canonical business name:
`Section Amendment Requested`

Actor:
Admin

Trigger:
Admin sets a section status to AMENDMENT_REQUESTED.

Stored in:
`application_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `[Section] Section Amendment Requested`
- Description: `[Reason] from remark`

Admin Detail
- Visible: YES
- Title: `[Section] Section Amendment Requested`
- Description: `[Reason] from remark`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: YES
- Title: `Changes Requested on a Section`
- Description: `— (label only)`

Issuer Facility / Transaction Detail
- Visible: NO
- Note: fetched then dropped by the surface label/visibility map
- Title: `—`
- Description: `Hidden (visibility map)`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Section Amendment Requested`
- Description/Remark: `remark = [Reason]`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Section], [Reason], [Application Ref]

### CONSISTENCY REVIEW

Classification:
STANDARDIZATION_RECOMMENDED

Issuer detail uses Changes requested; admin uses Amendment Requested plus the section name.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Section Amendment Requested`

Preferred Admin Description:
`[Actor] requested amendments on the [Section] section of application [Application Ref]. [Reason]`

Preferred User Description:
`CashSouk requested changes to the [Section] section on application [Application Ref].`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `SECTION_REVIEWED_PENDING`

Status: LIVE

Module: Application Review / Amendments

Business action:
A review section is reset to pending (admin action, or CTOS/AML re-check).

Technical event:
`SECTION_REVIEWED_PENDING`

Canonical business name:
`Section Reset to Pending`

Actor:
Admin / System

Trigger:
Admin reset, or CTOS update leaving AML pending (system actor, financial section).

Stored in:
`application_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `[Section] Section Reset to Pending`
- Description: `remark when stored (system path: Reset due to CTOS update / AML pending)`

Admin Detail
- Visible: YES
- Title: `[Section] Section Reset to Pending`
- Description: `remark when stored`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: NO
- Note: fetched then dropped by the surface label/visibility map
- Title: `—`
- Description: `Hidden (visibility map)`

Issuer Facility / Transaction Detail
- Visible: NO
- Note: fetched then dropped by the surface label/visibility map
- Title: `—`
- Description: `Hidden (visibility map)`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Section reset to pending`
- Description/Remark: `remark when stored`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Section], [Old Status], [New Status], [Reason]

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Admin-only forensic step. CSV sentence case is the only wording drift.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Section Reset to Pending`

Preferred Admin Description:
`[Actor] reset the [Section] section on application [Application Ref] to pending.`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `ITEM_REVIEWED_APPROVED`

Status: LIVE

Module: Application Review / Amendments

Business action:
Admin approves a review item.

Technical event:
`ITEM_REVIEWED_APPROVED`

Canonical business name:
`Item Approved`

Actor:
Admin

Trigger:
Admin sets an item status to APPROVED.

Stored in:
`application_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `[Item] Approved`
- Description: `remark when stored`

Admin Detail
- Visible: YES
- Title: `[Item] Approved`
- Description: `remark when stored`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: NO
- Note: fetched then dropped by the surface label/visibility map
- Title: `—`
- Description: `Hidden (visibility map)`

Issuer Facility / Transaction Detail
- Visible: NO
- Note: fetched then dropped by the surface label/visibility map
- Title: `—`
- Description: `Hidden (visibility map)`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Item approved`
- Description/Remark: `remark when stored`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Item]

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Admin names the item; CSV uses a generic Item approved label. Not shown to issuers.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Item Approved`

Preferred Admin Description:
`[Actor] approved [Item] on application [Application Ref].`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `ITEM_REVIEWED_REJECTED`

Status: LIVE

Module: Application Review / Amendments

Business action:
Admin rejects a review item.

Technical event:
`ITEM_REVIEWED_REJECTED`

Canonical business name:
`Item Rejected`

Actor:
Admin

Trigger:
Admin sets an item status to REJECTED.

Stored in:
`application_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `[Item] Rejected`
- Description: `[Reason] from remark`

Admin Detail
- Visible: YES
- Title: `[Item] Rejected`
- Description: `[Reason] from remark`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: YES
- Title: `An Item Was Not Approved`
- Description: `— (label only)`

Issuer Facility / Transaction Detail
- Visible: NO
- Note: fetched then dropped by the surface label/visibility map
- Title: `—`
- Description: `Hidden (visibility map)`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Item Rejected`
- Description/Remark: `remark = [Reason]`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Item], [Reason], [Application Ref]

### CONSISTENCY REVIEW

Classification:
STANDARDIZATION_RECOMMENDED

Issuer detail is generic (An item was not approved) while admin names the item and uses Rejected.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Item Rejected`

Preferred Admin Description:
`[Actor] rejected [Item] on application [Application Ref]. [Reason]`

Preferred User Description:
`[Item] on application [Application Ref] was not approved.`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `ITEM_REVIEWED_AMENDMENT_REQUESTED`

Status: LIVE

Module: Application Review / Amendments

Business action:
Admin requests changes on a review item.

Technical event:
`ITEM_REVIEWED_AMENDMENT_REQUESTED`

Canonical business name:
`Item Amendment Requested`

Actor:
Admin

Trigger:
Admin sets an item status to AMENDMENT_REQUESTED.

Stored in:
`application_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `[Item] Amendment Requested`
- Description: `[Reason] from remark`

Admin Detail
- Visible: YES
- Title: `[Item] Amendment Requested`
- Description: `[Reason] from remark`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: YES
- Title: `Changes Requested on an Item`
- Description: `— (label only)`

Issuer Facility / Transaction Detail
- Visible: NO
- Note: fetched then dropped by the surface label/visibility map
- Title: `—`
- Description: `Hidden (visibility map)`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Item Amendment Requested`
- Description/Remark: `remark = [Reason]`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Item], [Reason], [Application Ref]

### CONSISTENCY REVIEW

Classification:
STANDARDIZATION_RECOMMENDED

Issuer detail uses Changes requested; admin uses Amendment Requested plus the item name.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Item Amendment Requested`

Preferred Admin Description:
`[Actor] requested amendments on [Item] for application [Application Ref]. [Reason]`

Preferred User Description:
`CashSouk requested changes to [Item] on application [Application Ref].`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `ITEM_REVIEWED_PENDING`

Status: LIVE

Module: Application Review / Amendments

Business action:
Admin resets a review item to pending.

Technical event:
`ITEM_REVIEWED_PENDING`

Canonical business name:
`Item Reset to Pending`

Actor:
Admin

Trigger:
Admin sets an item status to PENDING.

Stored in:
`application_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `[Item] Reset to Pending`
- Description: `remark when stored`

Admin Detail
- Visible: YES
- Title: `[Item] Reset to Pending`
- Description: `remark when stored`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: NO
- Note: fetched then dropped by the surface label/visibility map
- Title: `—`
- Description: `Hidden (visibility map)`

Issuer Facility / Transaction Detail
- Visible: NO
- Note: fetched then dropped by the surface label/visibility map
- Title: `—`
- Description: `Hidden (visibility map)`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Item reset to pending`
- Description/Remark: `remark when stored`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Item]

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Admin-only. CSV sentence case is the only wording drift.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Item Reset to Pending`

Preferred Admin Description:
`[Actor] reset [Item] on application [Application Ref] to pending.`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `AMENDMENTS_SUBMITTED`

Status: LIVE

Module: Application Review / Amendments

Business action:
Admin sent a batch of amendment requests to the issuer. The technical name reads as if the issuer submitted amendments.

Technical event:
`AMENDMENTS_SUBMITTED`

Canonical business name:
`Amendment Requested`

Actor:
Admin

Trigger:
Admin submits the amendment-request batch to the issuer.

Stored in:
`application_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Amendment Requested`
- Description: `amendment remarks in metadata`

Admin Detail
- Visible: YES
- Title: `Amendment Requested`
- Description: `amendment remarks in metadata`

Issuer General Activity
- Visible: YES
- Title: `CashSouk Requested an Amendment`
- Description: `CashSouk requested an amendment to application [Application Ref].`

Issuer Application Detail
- Visible: YES
- Title: `CashSouk Requested an Amendment`
- Description: `— (label only)`

Issuer Facility / Transaction Detail
- Visible: YES
- Title: `CashSouk Requested an Amendment`
- Description: `— (label only)`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Amendment Requested`
- Description/Remark: `amendment remarks in metadata`

Notification
- Sends: YES
- Type: `application_amendments_requested`
- Title: `Amendment Requested`
- Message: `An amendment is required for application [Application Ref]. Review the request and resubmit your application.`
- Recipient: `issuer owner + org admins`
- Channel: `platform + email per registry`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Application Ref]

### CONSISTENCY REVIEW

Classification:
LEGACY_NAMING_TRAP

Technical event AMENDMENTS_SUBMITTED is the admin request, not an issuer submission. Titles currently split across Amendment Request Sent, Changes Requested, and notification Amendment Requested.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Amendment Requested`

Preferred Admin Description:
`[Actor] requested amendments for application [Application Ref].`

Preferred User Description:
`CashSouk requested changes to application [Application Ref].`

Preferred Notification Title:
`Amendment Requested`

Preferred Notification Message:
`Changes are required for application [Application Ref]. Review the requested amendments and resubmit your application.`

# Facility / Contract Offer

## `CONTRACT_OFFER_SENT`

Status: LIVE

Module: Facility / Contract Offer

Business action:
Admin sends the facility offer to the issuer.

Technical event:
`CONTRACT_OFFER_SENT`

Canonical business name:
`Facility Offer Sent`

Actor:
Admin

Trigger:
Admin send-contract-offer.

Stored in:
`application_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Facility Offer Sent`
- Description: `offered/requested facility and expiry in metadata`

Admin Detail
- Visible: YES
- Title: `Facility Offer Sent`
- Description: `offered/requested facility; [Deadline] when acceptance_expires_at is present`

Issuer General Activity
- Visible: YES
- Title: `You Received a Facility Offer`
- Description: `You received a facility offer for application [Application Ref]. Review and respond.`

Issuer Application Detail
- Visible: YES
- Title: `You Received a Facility Offer`
- Description: `— (label only)`

Issuer Facility / Transaction Detail
- Visible: YES
- Title: `You Received a Facility Offer`
- Description: `— (label only)`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Facility Offer Sent`
- Description/Remark: `metadata (offered facility, [Deadline])`

Notification
- Sends: YES
- Type: `contract_offer_sent`
- Title: `Facility Offer Received`
- Message: `A facility offer of [Amount] has been sent to your application [Application Ref].[Deadline]`
- Recipient: `issuer owner + org admins`
- Channel: `platform + email per registry`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Application Ref], [Facility Ref], [Amount], [Deadline]

### CONSISTENCY REVIEW

Classification:
STANDARDIZATION_RECOMMENDED

Notification title is Facility Offer Received while every audit surface uses Sent. Application-detail inserts financing.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Facility Offer Sent`

Preferred Admin Description:
`[Actor] sent a facility offer on application [Application Ref].`

Preferred User Description:
`A facility offer is ready for your review on application [Application Ref].`

Preferred Notification Title:
`Facility Offer Sent`

Preferred Notification Message:
`A facility offer of [Amount] has been sent for application [Application Ref].[Deadline]`

## `CONTRACT_OFFER_ACCEPTANCE_SUBMITTED`

Status: LIVE

Module: Facility / Contract Offer

Business action:
Issuer submits facility offer acceptance documents for the first time.

Technical event:
`CONTRACT_OFFER_ACCEPTANCE_SUBMITTED`

Canonical business name:
`Facility Offer Acceptance Submitted`

Actor:
Issuer

Trigger:
Issuer submitContractOfferAcceptance (first submission).

Stored in:
`application_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Facility Offer Acceptance Submitted`
- Description: `submitted_at / offer_acceptance_status in metadata`

Admin Detail
- Visible: YES
- Title: `Facility Offer Acceptance Submitted`
- Description: `submitted_at / offer_acceptance_status in metadata`

Issuer General Activity
- Visible: YES
- Title: `You Submitted Your Facility Offer Acceptance`
- Description: `You submitted offer acceptance documents for CashSouk review.`

Issuer Application Detail
- Visible: YES
- Title: `You Submitted Your Facility Offer Acceptance`
- Description: `— (label only)`

Issuer Facility / Transaction Detail
- Visible: YES
- Title: `You Submitted Your Facility Offer Acceptance`
- Description: `— (label only)`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Facility Offer Acceptance Submitted`
- Description/Remark: `metadata`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Application Ref], [Facility Ref]

### CONSISTENCY REVIEW

Classification:
STANDARDIZATION_RECOMMENDED

CSV drops Facility Offer from the label. General-activity title also shortens Offer Acceptance to Acceptance.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Facility Offer Acceptance Submitted`

Preferred Admin Description:
`[Actor] submitted facility offer acceptance documents for application [Application Ref].`

Preferred User Description:
`You submitted facility offer acceptance documents for application [Application Ref].`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `CONTRACT_OFFER_ACCEPTANCE_RESUBMITTED`

Status: LIVE

Module: Facility / Contract Offer

Business action:
Issuer resubmits facility offer acceptance documents after CashSouk requested changes.

Technical event:
`CONTRACT_OFFER_ACCEPTANCE_RESUBMITTED`

Canonical business name:
`Facility Offer Acceptance Resubmitted`

Actor:
Issuer

Trigger:
Issuer resubmits acceptance documents.

Stored in:
`application_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Facility Offer Acceptance Resubmitted`
- Description: `metadata`

Admin Detail
- Visible: YES
- Title: `Facility Offer Acceptance Resubmitted`
- Description: `metadata`

Issuer General Activity
- Visible: YES
- Title: `You Resubmitted Your Facility Offer Acceptance`
- Description: `You resubmitted offer acceptance documents after CashSouk requested changes.`

Issuer Application Detail
- Visible: YES
- Title: `You Resubmitted Your Facility Offer Acceptance`
- Description: `— (label only)`

Issuer Facility / Transaction Detail
- Visible: YES
- Title: `You Resubmitted Your Facility Offer Acceptance`
- Description: `— (label only)`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Facility Offer Acceptance Resubmitted`
- Description/Remark: `metadata`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Application Ref], [Facility Ref]

### CONSISTENCY REVIEW

Classification:
STANDARDIZATION_RECOMMENDED

Same title shortening as first submission. CSV is Acceptance resubmitted.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Facility Offer Acceptance Resubmitted`

Preferred Admin Description:
`[Actor] resubmitted facility offer acceptance documents for application [Application Ref].`

Preferred User Description:
`You resubmitted facility offer acceptance documents for application [Application Ref].`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING`

Status: LIVE

Module: Facility / Contract Offer

Business action:
Acceptance documents cleared; signing package unlocked. This is not final signed acceptance.

Technical event:
`CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING`

Canonical business name:
`Facility Acceptance Approved for Signing`

Actor:
Issuer (auto-approve path) / Admin

Trigger:
Auto-approve path or admin clearance of acceptance documents.

Stored in:
`application_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Facility Acceptance Approved for Signing`
- Description: `metadata`

Admin Detail
- Visible: YES
- Title: `Facility Acceptance Approved for Signing`
- Description: `metadata`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: NO
- Note: fetched then dropped by the surface label/visibility map
- Title: `—`
- Description: `Hidden (visibility map)`

Issuer Facility / Transaction Detail
- Visible: NO
- Note: fetched then dropped by the surface label/visibility map
- Title: `—`
- Description: `Hidden (visibility map)`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Facility acceptance approved for signing`
- Description/Remark: `metadata`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Application Ref], [Facility Ref]

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Admin/CSV already use the precise Approved for Signing wording. Hidden from issuer timelines by design — do not confuse with Facility Offer Signed.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Facility Acceptance Approved for Signing`

Preferred Admin Description:
`Facility offer acceptance on application [Application Ref] was approved for signing.`

Preferred User Description:
`Your facility offer on application [Application Ref] is approved and ready for signing.`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `CONTRACT_OFFER_ACCEPTED`

Status: LIVE

Module: Facility / Contract Offer

Business action:
All signers completed the facility offer signing package. Technical name still says ACCEPTED.

Technical event:
`CONTRACT_OFFER_ACCEPTED`

Canonical business name:
`Facility Offer Signed`

Actor:
Issuer

Trigger:
Signing package completed for the facility offer.

Stored in:
`application_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Facility Offer Signed`
- Description: `metadata`

Admin Detail
- Visible: YES
- Title: `Facility Offer Signed`
- Description: `metadata`

Issuer General Activity
- Visible: YES
- Title: `Facility Offer Signed`
- Description: `All signers completed the facility offer signing package.`

Issuer Application Detail
- Visible: YES
- Title: `Facility Offer Signed`
- Description: `— (label only)`

Issuer Facility / Transaction Detail
- Visible: YES
- Title: `Facility Offer Signed`
- Description: `— (label only)`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Facility Offer Signed`
- Description/Remark: `metadata`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Application Ref], [Facility Ref]

### CONSISTENCY REVIEW

Classification:
LEGACY_NAMING_TRAP

Human wording already uses Signed. Keep the technical event CONTRACT_OFFER_ACCEPTED. Do not call this Approved for Signing.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Facility Offer Signed`

Preferred Admin Description:
`The facility offer for application [Application Ref] was signed.`

Preferred User Description:
`The facility offer for application [Application Ref] has been signed.`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `CONTRACT_OFFER_RETRACTED`

Status: LIVE

Module: Facility / Contract Offer

Business action:
CashSouk/Admin retracts the facility offer before it is accepted.

Technical event:
`CONTRACT_OFFER_RETRACTED`

Canonical business name:
`Facility Offer Retracted`

Actor:
Admin

Trigger:
Admin retracts the facility offer.

Stored in:
`application_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Facility Offer Retracted`
- Description: `metadata`

Admin Detail
- Visible: YES
- Title: `Facility Offer Retracted`
- Description: `metadata`

Issuer General Activity
- Visible: YES
- Title: `CashSouk Retracted the Facility Offer`
- Description: `CashSouk retracted the facility offer on your application before it was accepted.`

Issuer Application Detail
- Visible: YES
- Title: `CashSouk Retracted the Facility Offer`
- Description: `— (label only)`

Issuer Facility / Transaction Detail
- Visible: YES
- Title: `CashSouk Retracted the Facility Offer`
- Description: `— (label only)`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Facility Offer Retracted`
- Description/Remark: `metadata`

Notification
- Sends: YES
- Type: `offer_retracted_or_reset`
- Title: `Facility Offer Retracted`
- Message: `The facility offer on your application was retracted and is no longer active.`
- Recipient: `issuer owner + org admins`
- Channel: `platform + email per registry`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Application Ref], [Facility Ref]

### CONSISTENCY REVIEW

Classification:
STANDARDIZATION_RECOMMENDED

Keep Retracted as the business title (distinct from issuer Declined and from Expired). Detail/facility titles currently say withdrawn. Notification type is offer_retracted_or_reset with title Offer Updated.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Facility Offer Retracted`

Preferred Admin Description:
`[Actor] retracted the facility offer on application [Application Ref].`

Preferred User Description:
`CashSouk retracted the facility offer on application [Application Ref] before it was accepted.`

Preferred Notification Title:
`Facility Offer Retracted`

Preferred Notification Message:
`The facility offer on application [Application Ref] was retracted and is no longer active.`

## `CONTRACT_WITHDRAWN`

Status: LIVE

Module: Facility / Contract Offer

Business action:
Issuer declined the facility offer. Technical name still says WITHDRAWN.

Technical event:
`CONTRACT_WITHDRAWN`

Canonical business name:
`Facility Offer Declined`

Actor:
Issuer

Trigger:
Issuer declines/withdraws the facility offer.

Stored in:
`application_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Facility Offer Declined`
- Description: `metadata`

Admin Detail
- Visible: YES
- Title: `Facility Offer Declined`
- Description: `metadata`

Issuer General Activity
- Visible: YES
- Title: `Facility Offer Declined`
- Description: `The facility offer was declined and this application is now closed.`

Issuer Application Detail
- Visible: YES
- Title: `You Declined the Facility Offer`
- Description: `— (label only)`

Issuer Facility / Transaction Detail
- Visible: YES
- Title: `Facility Offer Declined`
- Description: `— (label only)`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Facility Offer Declined`
- Description/Remark: `metadata`

Notification
- Sends: YES
- Type: `application_withdrawn_confirmation`
- Title: `Facility Offer Declined`
- Message: `The facility offer on your application [Application Ref] was declined and the application is now closed.`
- Recipient: `issuer owner + org admins`
- Channel: `platform + email per registry`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Application Ref], [Facility Ref]

### CONSISTENCY REVIEW

Classification:
LEGACY_NAMING_TRAP

Technical CONTRACT_WITHDRAWN is issuer decline, not Application Withdrawn. Admin/CSV say Rejected; issuer says Declined. Notification is application_withdrawn_confirmation.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Facility Offer Declined`

Preferred Admin Description:
`[Actor] declined the facility offer on application [Application Ref].`

Preferred User Description:
`You declined the facility offer on application [Application Ref]. The application is now closed.`

Preferred Notification Title:
`Facility Offer Declined`

Preferred Notification Message:
`The facility offer on application [Application Ref] was declined and the application is now closed.`

## `CONTRACT_OFFER_EXPIRED`

Status: LIVE

Module: Facility / Contract Offer

Business action:
Facility acceptance or signing deadline lapsed.

Technical event:
`CONTRACT_OFFER_EXPIRED`

Canonical business name:
`Facility Offer Expired`

Actor:
System

Trigger:
System expiry of the facility offer deadline. Cron writes `actor_type: SYSTEM`, `source: SYSTEM_JOB`, actor `SYS`, correlation `cron:acceptance-signing-expiry`. Not a human Admin action.

Stored in:
`application_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Facility Offer Expired`
- Description: `[Deadline] in metadata when stored`

Admin Detail
- Visible: YES
- Title: `Facility Offer Expired`
- Description: `[Deadline] in metadata when stored`

Issuer General Activity
- Visible: YES
- Title: `Facility Offer Expired`
- Description: `The facility offer expired. A new offer can be sent from the Facility tab.`

Issuer Application Detail
- Visible: YES
- Title: `Facility offer expired`
- Description: `— (label only)`

Issuer Facility / Transaction Detail
- Visible: YES
- Title: `Facility offer expired`
- Description: `— (label only)`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Facility offer expired`
- Description/Remark: `metadata`

Notification
- Sends: YES
- Type: `offer_expired`
- Title: `Offer Expired`
- Message: `Facility/Invoice offer ([Invoice Number] when invoice) has expired.`
- Recipient: `issuer owner + org admins`
- Channel: `platform + email per registry`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Application Ref], [Facility Ref], [Deadline]

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Title is stable across surfaces except sentence case. Distinct from Retracted and from issuer Declined.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Facility Offer Expired`

Preferred Admin Description:
`The facility offer on application [Application Ref] expired.`

Preferred User Description:
`The facility offer on application [Application Ref] expired. A new offer can be sent from the Facility tab.`

Preferred Notification Title:
`Facility Offer Expired`

Preferred Notification Message:
`The facility offer on application [Application Ref] has expired.`

## `CONTRACT_SIGNING_DEADLINE_EXTENDED`

Status: LIVE

Module: Facility / Contract Offer

Business action:
Admin restamps the facility signing deadline.

Technical event:
`CONTRACT_SIGNING_DEADLINE_EXTENDED`

Canonical business name:
`Signing Deadline Extended`

Actor:
Admin

Trigger:
Admin extends the facility signing deadline.

Stored in:
`application_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Signing Deadline Extended`
- Description: `[Deadline] in metadata when stored`

Admin Detail
- Visible: YES
- Title: `Signing Deadline Extended`
- Description: `[Deadline] in metadata when stored`

Issuer General Activity
- Visible: YES
- Title: `Signing Deadline Extended`
- Description: `CashSouk extended the signing deadline so you can complete the signing package.`

Issuer Application Detail
- Visible: YES
- Title: `Signing deadline extended`
- Description: `— (label only)`

Issuer Facility / Transaction Detail
- Visible: YES
- Title: `Signing deadline extended`
- Description: `— (label only)`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Signing deadline extended`
- Description/Remark: `metadata`

Notification
- Sends: YES
- Type: `contract_signing_deadline_extended`
- Title: `Signing Deadline Extended`
- Message: `The signing deadline for application [Application Ref] has been extended to [Deadline].`
- Recipient: `issuer owner + org admins`
- Channel: `platform + email`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Application Ref], [Deadline]

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Title already matches across admin, issuer general activity, and the notification.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Signing Deadline Extended`

Preferred Admin Description:
`[Actor] extended the signing deadline for application [Application Ref] to [Deadline].`

Preferred User Description:
`CashSouk extended the signing deadline for application [Application Ref] to [Deadline].`

Preferred Notification Title:
`Signing Deadline Extended`

Preferred Notification Message:
`The signing deadline for application [Application Ref] has been extended to [Deadline].`

## `CONTRACT_FACILITY_OCCUPANCY_UPDATED`

Status: LIVE

Module: Facility / Contract Offer

Business action:
Revolving facility capacity recomputed after a draw, funding close, or repayment.

Technical event:
`CONTRACT_FACILITY_OCCUPANCY_UPDATED`

Canonical business name:
`Facility Occupancy Updated`

Actor:
Issuer / Admin / System

Trigger:
refresh-contract-facility occupancy recompute.

Stored in:
`application_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Facility Occupancy Updated`
- Description: `occupancy snapshot in metadata`

Admin Detail
- Visible: YES
- Title: `Facility Occupancy Updated`
- Description: `occupancy snapshot in metadata`

Issuer General Activity
- Visible: YES
- Title: `Facility occupancy updated`
- Description: `Live facility occupancy changed after a draw, funding close, or repayment.`

Issuer Application Detail
- Visible: NO
- Note: fetched then dropped by the surface label/visibility map
- Title: `—`
- Description: `Hidden (visibility map)`

Issuer Facility / Transaction Detail
- Visible: NO
- Note: fetched then dropped by the surface label/visibility map
- Title: `—`
- Description: `Hidden (visibility map)`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Facility occupancy updated`
- Description/Remark: `occupancy snapshot in metadata`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Facility Ref]

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Issuer general activity is in the allowlist; application/facility detail hide it. Title meaning is stable.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Facility Occupancy Updated`

Preferred Admin Description:
`Facility occupancy for [Facility Ref] was updated.`

Preferred User Description:
`Live facility occupancy changed after a draw, funding close, or repayment.`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `CONTRACT_FACILITY_FEE_WAIVED`

Status: LIVE

Module: Facility / Contract Offer

Business action:
Admin waived the remaining contract facility fee.

Technical event:
`CONTRACT_FACILITY_FEE_WAIVED`

Canonical business name:
`Facility Fee Waived`

Actor:
Admin

Trigger:
Admin waive remaining facility fee.

Stored in:
`application_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Note: rendered via generic title-case fallback
- Title: `Facility Fee Waived`
- Description: `— (no curated description)`

Admin Detail
- Visible: YES
- Note: rendered via generic title-case fallback
- Title: `Facility Fee Waived`
- Description: `— (no curated description)`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: NO
- Note: fetched then dropped by the surface label/visibility map
- Title: `—`
- Description: `Hidden (visibility map)`

Issuer Facility / Transaction Detail
- Visible: NO
- Note: fetched then dropped by the surface label/visibility map
- Title: `—`
- Description: `Hidden (visibility map)`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Note: exported via generic title-case fallback
- Title/Event: `Facility Fee Waived`
- Description/Remark: `metadata`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Facility Ref]

### CONSISTENCY REVIEW

Classification:
STANDARDIZATION_RECOMMENDED

No curated label — generic title-case of the technical event. Distinct from note-level NOTE_FACILITY_FEE_COLLECTION_WAIVED.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Facility Fee Waived`

Preferred Admin Description:
`[Actor] waived the remaining facility fee on [Facility Ref].`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `CONTRACT_FACILITY_DISABLED`

Status: LIVE

Module: Facility / Contract Offer

Business action:
Admin disabled the facility so new drawdowns are unavailable.

Technical event:
`CONTRACT_FACILITY_DISABLED`

Canonical business name:
`Facility Disabled`

Actor:
Admin

Trigger:
Admin disables the facility.

Stored in:
`application_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Note: rendered via generic title-case fallback
- Title: `Facility Disabled`
- Description: `— (no curated description)`

Admin Detail
- Visible: YES
- Note: rendered via generic title-case fallback
- Title: `Facility Disabled`
- Description: `— (no curated description)`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: NO
- Note: fetched then dropped by the surface label/visibility map
- Title: `—`
- Description: `Hidden (visibility map)`

Issuer Facility / Transaction Detail
- Visible: NO
- Note: fetched then dropped by the surface label/visibility map
- Title: `—`
- Description: `Hidden (visibility map)`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Note: exported via generic title-case fallback
- Title/Event: `Facility Disabled`
- Description/Remark: `metadata`

Notification
- Sends: YES
- Type: `facility_disabled`
- Title: `Facility Disabled`
- Message: `Your facility for application [Application Ref] has been disabled. New drawdowns are currently unavailable.`
- Recipient: `issuer owner + org admins`
- Channel: `platform + email`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Application Ref], [Facility Ref]

### CONSISTENCY REVIEW

Classification:
STANDARDIZATION_RECOMMENDED

Issuer activity is hidden, but a live notification Facility Disabled is sent. Admin/CSV use uncurated fallback titles.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Facility Disabled`

Preferred Admin Description:
`[Actor] disabled the facility on application [Application Ref].`

Preferred User Description:
`Your facility for application [Application Ref] has been disabled. New drawdowns are currently unavailable.`

Preferred Notification Title:
`Facility Disabled`

Preferred Notification Message:
`Your facility for application [Application Ref] has been disabled. New drawdowns are currently unavailable.`

## `CONTRACT_FACILITY_ENABLED`

Status: LIVE

Module: Facility / Contract Offer

Business action:
Admin re-enabled the facility.

Technical event:
`CONTRACT_FACILITY_ENABLED`

Canonical business name:
`Facility Enabled`

Actor:
Admin

Trigger:
Admin re-enables the facility.

Stored in:
`application_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Note: rendered via generic title-case fallback
- Title: `Facility Enabled`
- Description: `— (no curated description)`

Admin Detail
- Visible: YES
- Note: rendered via generic title-case fallback
- Title: `Facility Enabled`
- Description: `— (no curated description)`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: NO
- Note: fetched then dropped by the surface label/visibility map
- Title: `—`
- Description: `Hidden (visibility map)`

Issuer Facility / Transaction Detail
- Visible: NO
- Note: fetched then dropped by the surface label/visibility map
- Title: `—`
- Description: `Hidden (visibility map)`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Note: exported via generic title-case fallback
- Title/Event: `Facility Enabled`
- Description/Remark: `metadata`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Application Ref], [Facility Ref]

### CONSISTENCY REVIEW

Classification:
STANDARDIZATION_RECOMMENDED

Same fallback-title problem as Disabled, with no notification counterpart.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Facility Enabled`

Preferred Admin Description:
`[Actor] enabled the facility on application [Application Ref].`

Preferred User Description:
`Your facility for application [Application Ref] has been enabled.`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

# Invoice Offer

## `INVOICE_OFFER_SENT`

Status: LIVE

Module: Invoice Offer

Business action:
Admin sends an invoice offer to the issuer.

Technical event:
`INVOICE_OFFER_SENT`

Canonical business name:
`Invoice Offer Sent`

Actor:
Admin

Trigger:
Admin send-invoice-offer.

Stored in:
`application_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Invoice [Invoice Number] Offer Sent / Invoice Offer Sent`
- Description: `offered amount and expiry in metadata`

Admin Detail
- Visible: YES
- Title: `Invoice [Invoice Number] Offer Sent / Invoice Offer Sent`
- Description: `offered amount; [Deadline] when present`

Issuer General Activity
- Visible: YES
- Title: `You Received an Invoice Offer`
- Description: `You received an invoice offer for invoice [Invoice Number]. Review and respond.`

Issuer Application Detail
- Visible: YES
- Title: `You Received an Invoice Offer`
- Description: `— (label only)`

Issuer Facility / Transaction Detail
- Visible: YES
- Title: `You Received an Invoice Offer`
- Description: `— (label only)`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Note: exported via generic title-case fallback
- Title/Event: `Invoice Offer Sent (fallback)`
- Description/Remark: `metadata (no curated CSV label)`

Notification
- Sends: YES
- Type: `invoice_offer_sent`
- Title: `Invoice Offer Received`
- Message: `An invoice offer for invoice [Invoice Number] of RM[Amount] has been sent.[Deadline]`
- Recipient: `issuer owner + org admins`
- Channel: `platform + email per registry`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Invoice Number], [Amount], [Deadline], [Application Ref]

### CONSISTENCY REVIEW

Classification:
STANDARDIZATION_RECOMMENDED

Notification title is Invoice Offer Received. CSV has no curated label (title-case fallback). Application-detail inserts financing.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Invoice Offer Sent`

Preferred Admin Description:
`[Actor] sent an invoice offer for invoice [Invoice Number] on application [Application Ref].`

Preferred User Description:
`An invoice offer for invoice [Invoice Number] is ready for your review.`

Preferred Notification Title:
`Invoice Offer Sent`

Preferred Notification Message:
`An invoice offer for invoice [Invoice Number] of RM[Amount] has been sent.[Deadline]`

## `INVOICE_OFFER_ACCEPTANCE_SUBMITTED`

Status: LIVE

Module: Invoice Offer

Business action:
Issuer submits invoice offer acceptance documents for the first time.

Technical event:
`INVOICE_OFFER_ACCEPTANCE_SUBMITTED`

Canonical business name:
`Invoice Offer Acceptance Submitted`

Actor:
Issuer

Trigger:
Issuer submit invoice offer acceptance (first submission).

Stored in:
`application_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Invoice [Invoice Number] Acceptance Submitted / Invoice Offer Acceptance Submitted`
- Description: `metadata`

Admin Detail
- Visible: YES
- Title: `Invoice [Invoice Number] Acceptance Submitted / Invoice Offer Acceptance Submitted`
- Description: `metadata`

Issuer General Activity
- Visible: YES
- Title: `You Submitted Your Invoice Offer Acceptance`
- Description: `You submitted offer acceptance documents for CashSouk review.`

Issuer Application Detail
- Visible: YES
- Title: `You Submitted Your Invoice Offer Acceptance`
- Description: `— (label only)`

Issuer Facility / Transaction Detail
- Visible: YES
- Title: `You Submitted Your Invoice Offer Acceptance`
- Description: `— (label only)`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Note: exported via generic title-case fallback
- Title/Event: `Invoice Offer Acceptance Submitted (fallback)`
- Description/Remark: `metadata`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Invoice Number], [Application Ref]

### CONSISTENCY REVIEW

Classification:
STANDARDIZATION_RECOMMENDED

CSV is uncurated fallback. General-activity title drops Offer.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Invoice Offer Acceptance Submitted`

Preferred Admin Description:
`[Actor] submitted invoice offer acceptance documents for invoice [Invoice Number].`

Preferred User Description:
`You submitted invoice offer acceptance documents for invoice [Invoice Number].`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `INVOICE_OFFER_ACCEPTANCE_RESUBMITTED`

Status: LIVE

Module: Invoice Offer

Business action:
Issuer resubmits invoice offer acceptance documents after CashSouk requested changes.

Technical event:
`INVOICE_OFFER_ACCEPTANCE_RESUBMITTED`

Canonical business name:
`Invoice Offer Acceptance Resubmitted`

Actor:
Issuer

Trigger:
Issuer resubmits invoice acceptance documents.

Stored in:
`application_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Invoice Offer Acceptance Resubmitted`
- Description: `metadata`

Admin Detail
- Visible: YES
- Title: `Invoice Offer Acceptance Resubmitted`
- Description: `metadata`

Issuer General Activity
- Visible: YES
- Title: `You Resubmitted Your Invoice Offer Acceptance`
- Description: `You resubmitted offer acceptance documents after CashSouk requested changes.`

Issuer Application Detail
- Visible: YES
- Title: `You Resubmitted Your Invoice Offer Acceptance`
- Description: `— (label only)`

Issuer Facility / Transaction Detail
- Visible: YES
- Title: `You Resubmitted Your Invoice Offer Acceptance`
- Description: `— (label only)`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Note: exported via generic title-case fallback
- Title/Event: `Invoice Offer Acceptance Resubmitted (fallback)`
- Description/Remark: `metadata`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Invoice Number], [Application Ref]

### CONSISTENCY REVIEW

Classification:
STANDARDIZATION_RECOMMENDED

Same title shortening and CSV fallback as the first submission.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Invoice Offer Acceptance Resubmitted`

Preferred Admin Description:
`[Actor] resubmitted invoice offer acceptance documents for invoice [Invoice Number].`

Preferred User Description:
`You resubmitted invoice offer acceptance documents for invoice [Invoice Number].`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `INVOICE_ACCEPTANCE_APPROVED_FOR_SIGNING`

Status: LIVE

Module: Invoice Offer

Business action:
Invoice acceptance documents cleared; signing package unlocked. Not final signed acceptance.

Technical event:
`INVOICE_ACCEPTANCE_APPROVED_FOR_SIGNING`

Canonical business name:
`Invoice Acceptance Approved for Signing`

Actor:
Issuer (auto-approve path) / Admin

Trigger:
Auto-approve path or admin clearance of invoice acceptance documents.

Stored in:
`application_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Invoice Acceptance Approved for Signing`
- Description: `metadata`

Admin Detail
- Visible: YES
- Title: `Invoice Acceptance Approved for Signing`
- Description: `metadata`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: NO
- Note: fetched then dropped by the surface label/visibility map
- Title: `—`
- Description: `Hidden (visibility map)`

Issuer Facility / Transaction Detail
- Visible: NO
- Note: fetched then dropped by the surface label/visibility map
- Title: `—`
- Description: `Hidden (visibility map)`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Note: exported via generic title-case fallback
- Title/Event: `Invoice Acceptance Approved For Signing (fallback)`
- Description/Remark: `metadata`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Invoice Number], [Application Ref]

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Admin wording is already precise. Hidden from issuer timelines. Do not confuse with Invoice Offer Signed.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Invoice Acceptance Approved for Signing`

Preferred Admin Description:
`Invoice offer acceptance for invoice [Invoice Number] was approved for signing.`

Preferred User Description:
`Your invoice offer for invoice [Invoice Number] is approved and ready for signing.`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `INVOICE_OFFER_ACCEPTED`

Status: LIVE

Module: Invoice Offer

Business action:
All signers completed the invoice offer signing package. Technical name still says ACCEPTED.

Technical event:
`INVOICE_OFFER_ACCEPTED`

Canonical business name:
`Invoice Offer Signed`

Actor:
Issuer

Trigger:
Signing package completed for the invoice offer.

Stored in:
`application_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Invoice [Invoice Number] Offer Signed / Invoice Offer Signed`
- Description: `metadata`

Admin Detail
- Visible: YES
- Title: `Invoice [Invoice Number] Offer Signed / Invoice Offer Signed`
- Description: `metadata`

Issuer General Activity
- Visible: YES
- Title: `Invoice Offer Signed`
- Description: `All signers completed the invoice offer signing package.`

Issuer Application Detail
- Visible: YES
- Title: `Invoice Offer Signed`
- Description: `— (label only)`

Issuer Facility / Transaction Detail
- Visible: YES
- Title: `Invoice Offer Signed`
- Description: `— (label only)`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Note: exported via generic title-case fallback
- Title/Event: `Invoice Offer Signed`
- Description/Remark: `metadata — fallback still says Accepted`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Invoice Number], [Application Ref]

### CONSISTENCY REVIEW

Classification:
LEGACY_NAMING_TRAP

Human UI already uses Signed, but CSV fallback still title-cases ACCEPTED to Invoice Offer Accepted.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Invoice Offer Signed`

Preferred Admin Description:
`The invoice offer for invoice [Invoice Number] was signed.`

Preferred User Description:
`The invoice offer for invoice [Invoice Number] has been signed.`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `INVOICE_OFFER_REJECTED`

Status: LIVE

Module: Invoice Offer

Business action:
Issuer declined the invoice offer. This is the live invoice-decline event (unlike facility, which uses CONTRACT_WITHDRAWN).

Technical event:
`INVOICE_OFFER_REJECTED`

Canonical business name:
`Invoice Offer Declined`

Actor:
Issuer

Trigger:
Issuer declines the invoice offer.

Stored in:
`application_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Invoice Offer Declined`
- Description: `metadata`

Admin Detail
- Visible: YES
- Title: `Invoice Offer Declined`
- Description: `metadata`

Issuer General Activity
- Visible: YES
- Title: `Invoice Offer Declined`
- Description: `The invoice offer was declined and this application has stopped moving forward.`

Issuer Application Detail
- Visible: YES
- Title: `You Declined the Invoice Offer`
- Description: `— (label only)`

Issuer Facility / Transaction Detail
- Visible: YES
- Title: `Invoice Offer Declined`
- Description: `— (label only)`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Note: exported via generic title-case fallback
- Title/Event: `Invoice Offer Declined`
- Description/Remark: `metadata`

Notification
- Sends: YES
- Type: `application_withdrawn_confirmation`
- Title: `Invoice Offer Declined`
- Message: `The invoice offer for invoice [Invoice Number] was declined.`
- Recipient: `issuer owner + org admins`
- Channel: `platform + email per registry`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Invoice Number], [Application Ref]

### CONSISTENCY REVIEW

Classification:
STANDARDIZATION_RECOMMENDED

Admin/CSV say Rejected; issuer says Declined. Notification is application_withdrawn_confirmation. Keep this distinct from Retracted and Expired.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Invoice Offer Declined`

Preferred Admin Description:
`[Actor] declined the invoice offer for invoice [Invoice Number].`

Preferred User Description:
`You declined the invoice offer for invoice [Invoice Number].`

Preferred Notification Title:
`Invoice Offer Declined`

Preferred Notification Message:
`The invoice offer for invoice [Invoice Number] was declined.`

## `INVOICE_OFFER_RETRACTED`

Status: LIVE

Module: Invoice Offer

Business action:
CashSouk/Admin retracts the invoice offer before it is accepted.

Technical event:
`INVOICE_OFFER_RETRACTED`

Canonical business name:
`Invoice Offer Retracted`

Actor:
Admin

Trigger:
Admin retracts the invoice offer.

Stored in:
`application_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Invoice Offer Retracted`
- Description: `metadata`

Admin Detail
- Visible: YES
- Title: `Invoice Offer Retracted`
- Description: `metadata`

Issuer General Activity
- Visible: YES
- Title: `CashSouk Retracted the Invoice Offer`
- Description: `CashSouk retracted the invoice offer for invoice [Invoice Number] before it was accepted.`

Issuer Application Detail
- Visible: YES
- Title: `CashSouk Retracted the Invoice Offer`
- Description: `— (label only)`

Issuer Facility / Transaction Detail
- Visible: YES
- Title: `CashSouk Retracted the Invoice Offer`
- Description: `— (label only)`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Note: exported via generic title-case fallback
- Title/Event: `Invoice Offer Retracted (fallback)`
- Description/Remark: `metadata`

Notification
- Sends: YES
- Type: `offer_retracted_or_reset`
- Title: `Invoice Offer Retracted`
- Message: `The invoice offer for invoice [Invoice Number] was retracted and is no longer active.`
- Recipient: `issuer owner + org admins`
- Channel: `platform + email per registry`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Invoice Number], [Application Ref]

### CONSISTENCY REVIEW

Classification:
STANDARDIZATION_RECOMMENDED

Keep Retracted as the title. Detail/facility currently say withdrawn. Notification type is offer_retracted_or_reset / Offer Updated.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Invoice Offer Retracted`

Preferred Admin Description:
`[Actor] retracted the invoice offer for invoice [Invoice Number].`

Preferred User Description:
`CashSouk retracted the invoice offer for invoice [Invoice Number] before it was accepted.`

Preferred Notification Title:
`Invoice Offer Retracted`

Preferred Notification Message:
`The invoice offer for invoice [Invoice Number] was retracted and is no longer active.`

## `INVOICE_OFFER_EXPIRED`

Status: LIVE

Module: Invoice Offer

Business action:
Invoice acceptance or signing deadline lapsed.

Technical event:
`INVOICE_OFFER_EXPIRED`

Canonical business name:
`Invoice Offer Expired`

Actor:
System

Trigger:
System expiry of the invoice offer deadline. Cron writes `actor_type: SYSTEM`, `source: SYSTEM_JOB`, actor `SYS`, correlation `cron:acceptance-signing-expiry`. Not a human Admin action.

Stored in:
`application_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Invoice [Invoice Number] Offer Expired / Invoice Offer Expired`
- Description: `[Deadline] when stored`

Admin Detail
- Visible: YES
- Title: `Invoice [Invoice Number] Offer Expired / Invoice Offer Expired`
- Description: `[Deadline] when stored`

Issuer General Activity
- Visible: YES
- Title: `Invoice Offer Expired`
- Description: `The invoice offer expired. A new offer can be sent from the Invoice tab.`

Issuer Application Detail
- Visible: YES
- Title: `Invoice offer expired`
- Description: `— (label only)`

Issuer Facility / Transaction Detail
- Visible: YES
- Title: `Invoice offer expired`
- Description: `— (label only)`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Note: exported via generic title-case fallback
- Title/Event: `Invoice Offer Expired (fallback)`
- Description/Remark: `metadata`

Notification
- Sends: YES
- Type: `offer_expired`
- Title: `Offer Expired`
- Message: `Facility/Invoice offer ([Invoice Number] when invoice) has expired.`
- Recipient: `issuer owner + org admins`
- Channel: `platform + email per registry`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Invoice Number], [Deadline], [Application Ref]

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Title meaning is stable. Distinct from Retracted and Declined. CSV is uncurated fallback only.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Invoice Offer Expired`

Preferred Admin Description:
`The invoice offer for invoice [Invoice Number] expired.`

Preferred User Description:
`The invoice offer for invoice [Invoice Number] expired. A new offer can be sent from the Invoice tab.`

Preferred Notification Title:
`Invoice Offer Expired`

Preferred Notification Message:
`The invoice offer for invoice [Invoice Number] has expired.`

## `INVOICE_SIGNING_DEADLINE_EXTENDED`

Status: LIVE

Module: Invoice Offer

Business action:
Admin restamps the invoice signing deadline.

Technical event:
`INVOICE_SIGNING_DEADLINE_EXTENDED`

Canonical business name:
`Signing Deadline Extended`

Actor:
Admin

Trigger:
Admin extends the invoice signing deadline.

Stored in:
`application_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Signing Deadline Extended`
- Description: `[Deadline] when stored`

Admin Detail
- Visible: YES
- Title: `Signing Deadline Extended`
- Description: `[Deadline] when stored`

Issuer General Activity
- Visible: YES
- Title: `Signing Deadline Extended`
- Description: `CashSouk extended the signing deadline so you can complete the signing package.`

Issuer Application Detail
- Visible: YES
- Title: `Signing deadline extended`
- Description: `— (label only)`

Issuer Facility / Transaction Detail
- Visible: YES
- Title: `Signing deadline extended`
- Description: `— (label only)`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Note: exported via generic title-case fallback
- Title/Event: `Invoice Signing Deadline Extended (fallback)`
- Description/Remark: `metadata`

Notification
- Sends: YES
- Type: `invoice_signing_deadline_extended`
- Title: `Signing Deadline Extended`
- Message: `The signing deadline for invoice [Invoice Number] has been extended to [Deadline].`
- Recipient: `issuer owner + org admins`
- Channel: `platform + email`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Invoice Number], [Deadline], [Application Ref]

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Same human title as the facility deadline event, which is acceptable — descriptions/notification distinguish invoice vs application.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Signing Deadline Extended`

Preferred Admin Description:
`[Actor] extended the signing deadline for invoice [Invoice Number] to [Deadline].`

Preferred User Description:
`CashSouk extended the signing deadline for invoice [Invoice Number] to [Deadline].`

Preferred Notification Title:
`Signing Deadline Extended`

Preferred Notification Message:
`The signing deadline for invoice [Invoice Number] has been extended to [Deadline].`

## `INVOICE_WITHDRAWN`

Status: LIVE

Module: Invoice Offer

Business action:
Issuer withdrew an invoice linked to the application.

Technical event:
`INVOICE_WITHDRAWN`

Canonical business name:
`Invoice Withdrawn`

Actor:
Issuer

Trigger:
Issuer withdrawInvoice.

Stored in:
`application_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Invoice [Invoice Number] Withdrawn / Invoice Withdrawn`
- Description: `metadata`

Admin Detail
- Visible: YES
- Title: `Invoice [Invoice Number] Withdrawn / Invoice Withdrawn`
- Description: `metadata`

Issuer General Activity
- Visible: YES
- Title: `Invoice Withdrawn`
- Description: `An invoice linked to this application was withdrawn.`

Issuer Application Detail
- Visible: YES
- Title: `Invoice withdrawn`
- Description: `— (label only)`

Issuer Facility / Transaction Detail
- Visible: YES
- Title: `Invoice withdrawn`
- Description: `— (label only)`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Note: exported via generic title-case fallback
- Title/Event: `Invoice Withdrawn (fallback)`
- Description/Remark: `metadata`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Invoice Number], [Application Ref]

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Title is stable. Distinct from declining an invoice offer and from withdrawing the whole application.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Invoice Withdrawn`

Preferred Admin Description:
`[Actor] withdrew invoice [Invoice Number] on application [Application Ref].`

Preferred User Description:
`Invoice [Invoice Number] was withdrawn.`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

# Signing

## `SIGNING_PACKAGE_CREATED`

Status: LIVE

Module: Signing

Business action:
Issuer created the signing package.

Technical event:
`SIGNING_PACKAGE_CREATED`

Canonical business name:
`Signing Package Created`

Actor:
Issuer

Trigger:
Issuer creates the signing envelope.

Stored in:
`application_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Signing Package Created`
- Description: `envelope metadata`

Admin Detail
- Visible: YES
- Title: `Signing Package Created`
- Description: `envelope metadata`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: NO
- Note: fetched then dropped by the surface label/visibility map
- Title: `—`
- Description: `Hidden (visibility map)`

Issuer Facility / Transaction Detail
- Visible: NO
- Note: fetched then dropped by the surface label/visibility map
- Title: `—`
- Description: `Hidden (visibility map)`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Signing Package Created`
- Description/Remark: `envelope metadata`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Application Ref]

### CONSISTENCY REVIEW

Classification:
STANDARDIZATION_RECOMMENDED

Admin/CSV already match. Sentence case vs Title Case is the only drift. Not shown on issuer general activity.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Signing Package Created`

Preferred Admin Description:
`[Actor] created the signing package for application [Application Ref].`

Preferred User Description:
`The signing package for application [Application Ref] was created.`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `SIGNING_PACKAGE_SENT`

Status: LIVE

Module: Signing

Business action:
Signing package dispatched to all required signers.

Technical event:
`SIGNING_PACKAGE_SENT`

Canonical business name:
`Signing Package Sent`

Actor:
Issuer (package creator)

Trigger:
Issuer sends the envelope; each signer also receives a direct SES email outside the notification registry.

Stored in:
`application_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Signing package sent`
- Description: `envelope metadata`

Admin Detail
- Visible: YES
- Title: `Signing package sent`
- Description: `envelope metadata`

Issuer General Activity
- Visible: YES
- Title: `Signing package sent`
- Description: `The signing package was sent to all required signers.`

Issuer Application Detail
- Visible: NO
- Note: fetched then dropped by the surface label/visibility map
- Title: `—`
- Description: `Hidden (visibility map)`

Issuer Facility / Transaction Detail
- Visible: YES
- Title: `Signing package sent`
- Description: `— (label only)`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Signing package sent`
- Description/Remark: `envelope metadata`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- YES
- Purpose: `Signing invitation to each recipient (may be external / non-platform). Subject: `Signature requested: [envelope title]`. Reminder subject: `Reminder: [envelope title]`.`

### PLACEHOLDERS USED

[Application Ref]

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Audit titles match. Direct email (not a registry notification) is the signer-facing channel.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Signing Package Sent`

Preferred Admin Description:
`[Actor] sent the signing package for application [Application Ref].`

Preferred User Description:
`The signing package was sent to all required signers.`

Preferred Notification Title:
`— (no registry notification)`

Preferred Notification Message:
`Direct email subject: Signature requested: [envelope title]. Body: You have been asked to sign [envelope title].`

## `SIGNING_PACKAGE_COMPLETED`

Status: LIVE

Module: Signing

Business action:
All signers completed the envelope (audit rollup). Offer-signed events are written separately.

Technical event:
`SIGNING_PACKAGE_COMPLETED`

Canonical business name:
`Signing Package Completed`

Actor:
Issuer (package creator)

Trigger:
All recipients completed the envelope.

Stored in:
`application_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Signing package completed`
- Description: `Visible on admin activity list`

Admin Detail
- Visible: NO
- Note: stored but deliberately withheld from this surface
- Title: `—`
- Description: `Hidden (intentional) — TIMELINE_HIDDEN_EVENT_TYPES`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: NO
- Note: fetched then dropped by the surface label/visibility map
- Title: `—`
- Description: `Hidden (visibility map)`

Issuer Facility / Transaction Detail
- Visible: YES
- Title: `Signing package completed`
- Description: `— (label only)`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Signing package completed`
- Description/Remark: `envelope metadata`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Application Ref]

### CONSISTENCY REVIEW

Classification:
INTENTIONALLY_DIFFERENT

Admin detail hides this rollup so the timeline shows Facility/Invoice Offer Signed instead. Facility-detail and CSV still include it.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Signing Package Completed`

Preferred Admin Description:
`The signing package for application [Application Ref] was completed.`

Preferred User Description:
`All required signers completed the signing package.`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `SIGNING_PACKAGE_VOIDED`

Status: LIVE

Module: Signing

Business action:
A signer declined, or the package was manually voided.

Technical event:
`SIGNING_PACKAGE_VOIDED`

Canonical business name:
`Signing Package Voided`

Actor:
Signer / package creator

Trigger:
Signer declined, or package creator voided the envelope.

Stored in:
`application_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Signing package voided`
- Description: `envelope metadata`

Admin Detail
- Visible: YES
- Title: `Signing package voided`
- Description: `envelope metadata`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: NO
- Note: fetched then dropped by the surface label/visibility map
- Title: `—`
- Description: `Hidden (visibility map)`

Issuer Facility / Transaction Detail
- Visible: NO
- Note: fetched then dropped by the surface label/visibility map
- Title: `—`
- Description: `Hidden (visibility map)`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Signing package voided`
- Description/Remark: `envelope metadata`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Application Ref]

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Admin/CSV match. Not shown on issuer activity.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Signing Package Voided`

Preferred Admin Description:
`The signing package for application [Application Ref] was voided.`

Preferred User Description:
`The signing package was voided.`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

# Onboarding / KYC / AML

## `ONBOARDING_STARTED`

Status: LIVE

Module: Onboarding / KYC / AML

Business action:
Personal or corporate onboarding request is created.

Technical event:
`ONBOARDING_STARTED`

Canonical business name:
`Onboarding Started`

Actor:
Applicant

Trigger:
startPersonalOnboarding / startCorporateOnboarding.

Stored in:
`onboarding_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `ONBOARDING_STARTED (raw access/onboarding export) / Onboarding Started (org timeline)`
- Description: `—`

Admin Detail
- Visible: YES
- Title: `Onboarding Started`
- Description: `—`

Issuer General Activity
- Visible: YES
- Title: `Onboarding Started`
- Description: `Your organization onboarding has started and you can continue it at any time.`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A (organization-scoped)`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: YES
- Title: `Onboarding Started`
- Description: `Your organization onboarding has started and you can continue it at any time.`

CSV / Export
- Included: YES
- Title/Event: `Onboarding Started (org-timeline CSV) / ONBOARDING_STARTED (raw /onboarding-logs/export)`
- Description/Remark: `metadata`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Organization Name]

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Portal and admin-detail titles match. Raw admin export uses the event_type string.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Onboarding Started`

Preferred Admin Description:
`[Actor] started onboarding for [Organization Name].`

Preferred User Description:
`Your organization onboarding has started and you can continue it at any time.`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `ONBOARDING_RESUMED`

Status: LIVE

Module: Onboarding / KYC / AML

Business action:
Onboarding resumed or an expired link was regenerated.

Technical event:
`ONBOARDING_RESUMED`

Canonical business name:
`Onboarding Resumed`

Actor:
Applicant

Trigger:
RegTank resume / regenerate expired link.

Stored in:
`onboarding_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Onboarding Resumed`
- Description: `trigger in metadata`

Admin Detail
- Visible: YES
- Title: `Onboarding Resumed`
- Description: `trigger in metadata`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Onboarding Resumed`
- Description/Remark: `metadata`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Organization Name]

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Admin-only. Portal allowlist excludes it by design.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Onboarding Resumed`

Preferred Admin Description:
`Onboarding for [Organization Name] was resumed.`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `ONBOARDING_CANCELLED`

Status: LIVE

Module: Onboarding / KYC / AML

Business action:
Admin restarted onboarding (cancels the previous RegTank request and issues a new one).

Technical event:
`ONBOARDING_CANCELLED`

Canonical business name:
`Onboarding Restarted`

Actor:
Admin

Trigger:
Admin restart onboarding.

Stored in:
`onboarding_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Onboarding Restarted`
- Description: `[Reason] from metadata.reason when present (Restart requested by admin)`

Admin Detail
- Visible: YES
- Title: `Onboarding Restarted`
- Description: `[Reason] from metadata.reason when present`

Issuer General Activity
- Visible: YES
- Title: `Onboarding Restarted`
- Description: `Your previous onboarding request was cancelled and a new onboarding request has been started.`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: YES
- Title: `Onboarding Restarted`
- Description: `Your previous onboarding request was cancelled and a new onboarding request has been started.`

CSV / Export
- Included: YES
- Title/Event: `Onboarding Restarted`
- Description/Remark: `reason when stored`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Organization Name], [Reason]

### CONSISTENCY REVIEW

Classification:
LEGACY_NAMING_TRAP

Technical event and admin/CSV still say Cancelled. Portal copy (source: OrganizationLogAdapter) already says Restarted. Matrix §2.3 still quotes the old Cancelled / will not continue portal copy — source wins.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Onboarding Restarted`

Preferred Admin Description:
`[Actor] restarted onboarding for [Organization Name].`

Preferred User Description:
`Your previous onboarding request was cancelled and a new onboarding request has been started.`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `ONBOARDING_STATUS_UPDATED`

Status: LIVE

Module: Onboarding / KYC / AML

Business action:
Generic onboarding status transition. Live AML/KYC outcomes are carried here via metadata.trigger (there is no live AML_APPROVED row).

Technical event:
`ONBOARDING_STATUS_UPDATED`

Canonical business name:
`Onboarding Status Updated`

Actor:
Applicant / Admin / System

Trigger:
Multiple writers (admin refresh, KYC/COD webhooks, org-aml-milestone, RegTank).

Stored in:
`onboarding_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Onboarding Status Updated`
- Description: `Triggered by [trigger]`

Admin Detail
- Visible: YES
- Title: `Onboarding Status Updated`
- Description: `Triggered by [trigger]`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Onboarding Status Updated`
- Description/Remark: `Triggered by [trigger]; previousStatus / newStatus; amlApproved when present`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Old Status], [New Status]

### CONSISTENCY REVIEW

Classification:
STANDARDIZATION_RECOMMENDED

One technical event covers many business moments (including live AML). Admin copy is only Status Updated / Triggered by [trigger].

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Onboarding Status Updated`

Preferred Admin Description:
`Onboarding status for [Organization Name] changed from [Old Status] to [New Status] ([trigger]).`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `ONBOARDING_REJECTED`

Status: LIVE

Module: Onboarding / KYC / AML

Business action:
RegTank rejected individual (personal) onboarding.

Technical event:
`ONBOARDING_REJECTED`

Canonical business name:
`Onboarding Rejected`

Actor:
System

Trigger:
RegTank individual-onboarding webhook rejection.

Stored in:
`onboarding_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Onboarding Rejected`
- Description: `[Reason] from metadata.reason, else trigger`

Admin Detail
- Visible: YES
- Title: `Onboarding Rejected`
- Description: `[Reason] from metadata.reason, else trigger`

Issuer General Activity
- Visible: YES
- Title: `Onboarding Rejected`
- Description: `Your organization onboarding was rejected: [Reason] (or a trailing period when no reason)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: YES
- Title: `Onboarding Rejected`
- Description: `Your organization onboarding was rejected: [Reason] (or a trailing period when no reason)`

CSV / Export
- Included: YES
- Title/Event: `Onboarding Rejected`
- Description/Remark: `reason when stored`

Notification
- Sends: YES
- Type: `onboarding_rejected`
- Title: `Onboarding Rejected`
- Message: `Unfortunately, your [onboarding type] onboarding for [Organization Name] was rejected.[Reason]`
- Recipient: `the applicant user`
- Channel: `platform + email`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Organization Name], [Reason]

### CONSISTENCY REVIEW

Classification:
STANDARDIZATION_RECOMMENDED

Notification title is Onboarding Application Rejected. Distinct from COD_REJECTED (corporate path).

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Onboarding Rejected`

Preferred Admin Description:
`Onboarding for [Organization Name] was rejected.`

Preferred User Description:
`Your organization onboarding was rejected.`

Preferred Notification Title:
`Onboarding Rejected`

Preferred Notification Message:
`Your [onboarding type] onboarding for [Organization Name] was rejected.[Reason]`

## `COD_REJECTED`

Status: LIVE

Module: Onboarding / KYC / AML

Business action:
RegTank rejected corporate onboarding (COD). No reason field is stored.

Technical event:
`COD_REJECTED`

Canonical business name:
`Onboarding Rejected`

Actor:
System

Trigger:
RegTank COD webhook rejection.

Stored in:
`onboarding_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Onboarding Rejected`
- Description: `— (no reason stored)`

Admin Detail
- Visible: YES
- Title: `Onboarding Rejected`
- Description: `— (no reason stored; now included in ORGANIZATION_ACTIVITY_EVENT_TYPES)`

Issuer General Activity
- Visible: YES
- Title: `Onboarding Rejected`
- Description: `Your organization onboarding was rejected.`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: YES
- Title: `Onboarding Rejected`
- Description: `Your organization onboarding was rejected.`

CSV / Export
- Included: YES
- Title/Event: `Onboarding Rejected (org-timeline CSV) / COD_REJECTED (raw export)`
- Description/Remark: `no reason field`

Notification
- Sends: YES
- Type: `onboarding_rejected`
- Title: `Onboarding Rejected`
- Message: `Unfortunately, your [onboarding type] onboarding for [Organization Name] was rejected.[Reason]`
- Recipient: `the applicant user`
- Channel: `platform + email`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Organization Name]

### CONSISTENCY REVIEW

Classification:
LEGACY_NAMING_TRAP

Technical name COD_REJECTED is provider jargon. Portal title is the same as ONBOARDING_REJECTED. No [Reason] is stored. Matrix §2.3 still says admin detail Hidden — source now includes COD_REJECTED in the org-timeline query.

REQUIRES_DATA_CHANGE: recommended wording needs a field the current writer/notification payload does not pass.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Onboarding Rejected`

Preferred Admin Description:
`Corporate onboarding for [Organization Name] was rejected.`

Preferred User Description:
`Your organization onboarding was rejected.`

Preferred Notification Title:
`Onboarding Rejected`

Preferred Notification Message:
`Your corporate onboarding for [Organization Name] was rejected.`

## `ONBOARDING_APPROVED`

Status: LIVE

Module: Onboarding / KYC / AML

Business action:
Onboarding submission / provider gate approved. The user does not yet have platform access.

Technical event:
`ONBOARDING_APPROVED`

Canonical business name:
`Onboarding Submission Approved`

Actor:
System / Admin

Trigger:
RegTank gate approval, or admin approveOnboardingSubmission.

Stored in:
`onboarding_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Onboarding Approved`
- Description: `—`

Admin Detail
- Visible: YES
- Title: `Onboarding Approved`
- Description: `—`

Issuer General Activity
- Visible: YES
- Title: `Onboarding Submission Approved`
- Description: `Your onboarding submission was approved. We'll notify you when your onboarding is fully complete.`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: YES
- Title: `Onboarding Submission Approved`
- Description: `Your onboarding submission was approved. We'll notify you when your onboarding is fully complete.`

CSV / Export
- Included: YES
- Title/Event: `Onboarding Approved`
- Description/Remark: `metadata`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Organization Name]

### CONSISTENCY REVIEW

Classification:
INTENTIONALLY_DIFFERENT

Portal title adds Submission to distinguish this intermediate gate from FINAL_APPROVAL_COMPLETED. No notification by design — users are notified at final approval.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Onboarding Submission Approved`

Preferred Admin Description:
`Onboarding submission for [Organization Name] was approved (platform access not yet granted).`

Preferred User Description:
`Your onboarding submission was approved. We'll notify you when your onboarding is fully complete.`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `FINAL_APPROVAL_COMPLETED`

Status: LIVE

Module: Onboarding / KYC / AML

Business action:
Admin grants platform access. This is the terminal onboarding approval.

Technical event:
`FINAL_APPROVAL_COMPLETED`

Canonical business name:
`Onboarding Approved`

Actor:
Admin

Trigger:
Admin completeFinalApproval.

Stored in:
`onboarding_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Final Approval Completed`
- Description: `—`

Admin Detail
- Visible: YES
- Title: `Final Approval Completed`
- Description: `—`

Issuer General Activity
- Visible: YES
- Title: `Onboarding Approved`
- Description: `Your organization onboarding was approved and no further action is needed.`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: YES
- Title: `Onboarding Approved`
- Description: `Your organization onboarding was approved and no further action is needed.`

CSV / Export
- Included: YES
- Title/Event: `Final Approval Completed`
- Description/Remark: `metadata`

Notification
- Sends: YES
- Type: `onboarding_approved`
- Title: `Onboarding Approved`
- Message: `Congratulations! Your [onboarding type] onboarding for [Organization Name] has been completed successfully. You now have full access to the platform.`
- Recipient: `the applicant user`
- Channel: `platform + email`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Organization Name]

### CONSISTENCY REVIEW

Classification:
LEGACY_NAMING_TRAP

Notification type id is onboarding_approved and portal title is Onboarding Approved, but the technical event is FINAL_APPROVAL_COMPLETED. Do not wire new code to ONBOARDING_APPROVED expecting this notification.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Onboarding Approved`

Preferred Admin Description:
`[Actor] completed final approval for [Organization Name]. Platform access granted.`

Preferred User Description:
`Your organization onboarding was approved and no further action is needed.`

Preferred Notification Title:
`Onboarding Approved`

Preferred Notification Message:
`Your [onboarding type] onboarding for [Organization Name] has been completed successfully. You now have full access to the platform.`

## `TNC_APPROVED`

Status: LIVE

Module: Onboarding / KYC / AML

Business action:
Applicant accepted required Terms & Conditions (organization T&C gate).

Technical event:
`TNC_APPROVED`

Canonical business name:
`T&C Approved`

Actor:
Applicant

Trigger:
organization/service acceptTnc after required PDFs are ACCEPTED.

Stored in:
`onboarding_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `T&C Approved`
- Description: `—`

Admin Detail
- Visible: YES
- Title: `T&C Approved`
- Description: `—`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `T&C Approved`
- Description/Remark: `metadata`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Organization Name]

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Admin-only onboarding log. Distinct from per-document legal_document_acceptances rows.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`T&C Approved`

Preferred Admin Description:
`[Actor] accepted Terms & Conditions for [Organization Name].`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `SSM_APPROVED`

Status: LIVE

Module: Onboarding / KYC / AML

Business action:
Admin approved SSM/CTOS company verification.

Technical event:
`SSM_APPROVED`

Canonical business name:
`SSM Approved`

Actor:
Admin

Trigger:
Admin approveSsmVerification.

Stored in:
`onboarding_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `SSM Approved`
- Description: `—`

Admin Detail
- Visible: YES
- Title: `SSM Approved`
- Description: `—`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `SSM Approved`
- Description/Remark: `metadata`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Organization Name]

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Admin-only compliance gate with a stable label.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`SSM Approved`

Preferred Admin Description:
`[Actor] approved SSM verification for [Organization Name].`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `SOPHISTICATED_STATUS_UPDATED`

Status: LIVE

Module: Onboarding / KYC / AML

Business action:
Sophisticated-investor status granted or revoked.

Technical event:
`SOPHISTICATED_STATUS_UPDATED`

Canonical business name:
`Sophisticated Status Updated`

Actor:
Admin / System

Trigger:
Admin update, or RegTank auto-grant.

Stored in:
`onboarding_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Sophisticated Status Updated`
- Description: `Granted / Revoked + [Reason]`

Admin Detail
- Visible: YES
- Title: `Sophisticated Status Updated`
- Description: `Granted / Revoked + [Reason]`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Sophisticated Status Updated`
- Description/Remark: `Granted/Revoked + reason`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Reason], [Old Status], [New Status]

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Admin description already encodes granted vs revoked.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Sophisticated Status Updated`

Preferred Admin Description:
`Sophisticated-investor status for [Organization Name] was [granted/revoked]. [Reason]`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `FORM_FILLED`

Status: LIVE

Module: Onboarding / KYC / AML

Business action:
Onboarding form progress or liveness webhook step.

Technical event:
`FORM_FILLED`

Canonical business name:
`Form Submitted`

Actor:
Applicant / System

Trigger:
individual-onboarding-handler / RegTank handleWebhookUpdate.

Stored in:
`onboarding_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Form Submitted`
- Description: `Section: [section] when present`

Admin Detail
- Visible: YES
- Title: `Form Submitted`
- Description: `Section: [section] when present`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Form Submitted`
- Description/Remark: `section when present`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

none in current user-facing copy

### CONSISTENCY REVIEW

Classification:
STANDARDIZATION_RECOMMENDED

Technical event is FORM_FILLED; admin label is Form Submitted.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Form Submitted`

Preferred Admin Description:
`An onboarding form step was submitted.`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `onboarding_logs.PROFILE_UPDATED`

Status: LIVE

Module: Onboarding / KYC / AML

Business action:
Admin patched the organization profile (not a user profile).

Technical event:
`PROFILE_UPDATED`

Canonical business name:
`Organization Profile Updated`

Actor:
Admin

Trigger:
admin/organization-admin-profile.

Stored in:
`onboarding_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Organization Profile Updated`
- Description: `[Actor] updated the organization profile for [Organization Name] ([fields]).`

Admin Detail
- Visible: YES
- Title: `Organization Profile Updated`
- Description: `[Actor] updated the organization profile for [Organization Name] ([fields]).`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Organization Profile Updated`
- Description/Remark: `updated fields`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Organization Name]

### CONSISTENCY REVIEW

Classification:
LEGACY_NAMING_TRAP

Same event_type string PROFILE_UPDATED is used on access_logs (admin edits a user), security_logs (self-service/user profile), and onboarding_logs (organization profile).

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Organization Profile Updated`

Preferred Admin Description:
`[Actor] updated the organization profile for [Organization Name] ([fields]).`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `WEBHOOK_RECEIVED`

Status: LIVE

Module: Onboarding / KYC / AML

Business action:
RegTank diagnostic/onboarding webhook event (WEBHOOK_RECEIVED).

Technical event:
`WEBHOOK_RECEIVED`

Canonical business name:
`Webhook Received`

Actor:
System

Trigger:
RegTank webhook handler.

Stored in:
`onboarding_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `Webhook Received (fallback title-case)`
- Description: `payload / status in metadata`

Admin Detail
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `Webhook Received (fallback; not in admin org-timeline filter)`
- Description: `Hidden from org-timeline query`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `—`

CSV / Export
- Included: NO
- Note: not included in this export
- Title/Event: `WEBHOOK_RECEIVED (raw export only)`
- Description/Remark: `excluded from org-timeline CSV`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

none in current user-facing copy

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Diagnostic rows. Admin org timeline does not query them. Fallback title-case only.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Webhook Received`

Preferred Admin Description:
`Webhook Received was recorded for the onboarding request.`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `WEBHOOK_APPROVED`

Status: LIVE

Module: Onboarding / KYC / AML

Business action:
RegTank diagnostic/onboarding webhook event (WEBHOOK_APPROVED).

Technical event:
`WEBHOOK_APPROVED`

Canonical business name:
`Webhook Approved`

Actor:
System

Trigger:
RegTank webhook handler.

Stored in:
`onboarding_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `Webhook Approved (fallback title-case)`
- Description: `payload / status in metadata`

Admin Detail
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `Webhook Approved (fallback; not in admin org-timeline filter)`
- Description: `Hidden from org-timeline query`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `—`

CSV / Export
- Included: NO
- Note: not included in this export
- Title/Event: `WEBHOOK_APPROVED (raw export only)`
- Description/Remark: `excluded from org-timeline CSV`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

none in current user-facing copy

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Diagnostic rows. Admin org timeline does not query them. Fallback title-case only.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Webhook Approved`

Preferred Admin Description:
`Webhook Approved was recorded for the onboarding request.`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `WEBHOOK_REJECTED`

Status: LIVE

Module: Onboarding / KYC / AML

Business action:
RegTank diagnostic/onboarding webhook event (WEBHOOK_REJECTED).

Technical event:
`WEBHOOK_REJECTED`

Canonical business name:
`Webhook Rejected`

Actor:
System

Trigger:
RegTank webhook handler.

Stored in:
`onboarding_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `Webhook Rejected (fallback title-case)`
- Description: `payload / status in metadata`

Admin Detail
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `Webhook Rejected (fallback; not in admin org-timeline filter)`
- Description: `Hidden from org-timeline query`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `—`

CSV / Export
- Included: NO
- Note: not included in this export
- Title/Event: `WEBHOOK_REJECTED (raw export only)`
- Description/Remark: `excluded from org-timeline CSV`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

none in current user-facing copy

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Diagnostic rows. Admin org timeline does not query them. Fallback title-case only.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Webhook Rejected`

Preferred Admin Description:
`Webhook Rejected was recorded for the onboarding request.`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `WEBHOOK_PENDING_APPROVAL`

Status: LIVE

Module: Onboarding / KYC / AML

Business action:
RegTank diagnostic/onboarding webhook event (WEBHOOK_PENDING_APPROVAL).

Technical event:
`WEBHOOK_PENDING_APPROVAL`

Canonical business name:
`Webhook Pending Approval`

Actor:
System

Trigger:
RegTank webhook handler.

Stored in:
`onboarding_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `Webhook Pending Approval (fallback title-case)`
- Description: `payload / status in metadata`

Admin Detail
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `Webhook Pending Approval (fallback; not in admin org-timeline filter)`
- Description: `Hidden from org-timeline query`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `—`

CSV / Export
- Included: NO
- Note: not included in this export
- Title/Event: `WEBHOOK_PENDING_APPROVAL (raw export only)`
- Description/Remark: `excluded from org-timeline CSV`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

none in current user-facing copy

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Diagnostic rows. Admin org timeline does not query them. Fallback title-case only.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Webhook Pending Approval`

Preferred Admin Description:
`Webhook Pending Approval was recorded for the onboarding request.`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `WEBHOOK_IN_PROGRESS`

Status: LIVE

Module: Onboarding / KYC / AML

Business action:
RegTank diagnostic/onboarding webhook event (WEBHOOK_IN_PROGRESS).

Technical event:
`WEBHOOK_IN_PROGRESS`

Canonical business name:
`Webhook In Progress`

Actor:
System

Trigger:
RegTank webhook handler.

Stored in:
`onboarding_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `Webhook In Progress (fallback title-case)`
- Description: `payload / status in metadata`

Admin Detail
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `Webhook In Progress (fallback; not in admin org-timeline filter)`
- Description: `Hidden from org-timeline query`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `—`

CSV / Export
- Included: NO
- Note: not included in this export
- Title/Event: `WEBHOOK_IN_PROGRESS (raw export only)`
- Description/Remark: `excluded from org-timeline CSV`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

none in current user-facing copy

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Diagnostic rows. Admin org timeline does not query them. Fallback title-case only.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Webhook In Progress`

Preferred Admin Description:
`Webhook In Progress was recorded for the onboarding request.`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `EOD_APPROVED`

Status: LIVE

Module: Onboarding / KYC / AML

Business action:
RegTank diagnostic/onboarding webhook event (EOD_APPROVED).

Technical event:
`EOD_APPROVED`

Canonical business name:
`EOD Approved`

Actor:
System

Trigger:
RegTank webhook handler.

Stored in:
`onboarding_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `EOD Approved (fallback title-case)`
- Description: `payload / status in metadata`

Admin Detail
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `EOD Approved (fallback; not in admin org-timeline filter)`
- Description: `Hidden from org-timeline query`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `—`

CSV / Export
- Included: NO
- Note: not included in this export
- Title/Event: `EOD_APPROVED (raw export only)`
- Description/Remark: `excluded from org-timeline CSV`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

none in current user-facing copy

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Diagnostic rows. Admin org timeline does not query them. Fallback title-case only.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`EOD Approved`

Preferred Admin Description:
`EOD Approved was recorded for the onboarding request.`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `EOD_REJECTED`

Status: LIVE

Module: Onboarding / KYC / AML

Business action:
RegTank diagnostic/onboarding webhook event (EOD_REJECTED).

Technical event:
`EOD_REJECTED`

Canonical business name:
`EOD Rejected`

Actor:
System

Trigger:
RegTank webhook handler.

Stored in:
`onboarding_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `EOD Rejected (fallback title-case)`
- Description: `payload / status in metadata`

Admin Detail
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `EOD Rejected (fallback; not in admin org-timeline filter)`
- Description: `Hidden from org-timeline query`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `—`

CSV / Export
- Included: NO
- Note: not included in this export
- Title/Event: `EOD_REJECTED (raw export only)`
- Description/Remark: `excluded from org-timeline CSV`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

none in current user-facing copy

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Diagnostic rows. Admin org timeline does not query them. Fallback title-case only.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`EOD Rejected`

Preferred Admin Description:
`EOD Rejected was recorded for the onboarding request.`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `EOD_WEBHOOK`

Status: LIVE

Module: Onboarding / KYC / AML

Business action:
RegTank diagnostic/onboarding webhook event (EOD_WEBHOOK).

Technical event:
`EOD_WEBHOOK`

Canonical business name:
`EOD Webhook`

Actor:
System

Trigger:
RegTank webhook handler.

Stored in:
`onboarding_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `EOD Webhook (fallback title-case)`
- Description: `payload / status in metadata`

Admin Detail
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `EOD Webhook (fallback; not in admin org-timeline filter)`
- Description: `Hidden from org-timeline query`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `—`

CSV / Export
- Included: NO
- Note: not included in this export
- Title/Event: `EOD_WEBHOOK (raw export only)`
- Description/Remark: `excluded from org-timeline CSV`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

none in current user-facing copy

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Diagnostic rows. Admin org timeline does not query them. Fallback title-case only.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`EOD Webhook`

Preferred Admin Description:
`EOD Webhook was recorded for the onboarding request.`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

# Legal Documents / T&C

## `LEGAL_DOCUMENT_CREATED`

Status: LIVE

Module: Legal Documents / T&C

Business action:
Admin created a legal document definition.

Technical event:
`LEGAL_DOCUMENT_CREATED`

Canonical business name:
`Document created`

Actor:
Admin

Trigger:
createDefinition

Stored in:
`legal_document_audit_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Document created`
- Description: `before_json / after_json / document_hash when stored`

Admin Detail
- Visible: YES
- Title: `Document created`
- Description: `before_json / after_json / document_hash when stored`

Issuer General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A (admin-forensic domain)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Document created`
- Description/Remark: `reason / hashes when stored`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

none in current user-facing copy

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Admin activity, detail, and CSV share the same human label. No portal or notification.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Document created`

Preferred Admin Description:
`[Actor] — Document created.`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `LEGAL_DOCUMENT_UPDATED`

Status: LIVE

Module: Legal Documents / T&C

Business action:
Admin edited a legal document definition.

Technical event:
`LEGAL_DOCUMENT_UPDATED`

Canonical business name:
`Document updated`

Actor:
Admin

Trigger:
updateDefinition

Stored in:
`legal_document_audit_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Document updated`
- Description: `before_json / after_json / document_hash when stored`

Admin Detail
- Visible: YES
- Title: `Document updated`
- Description: `before_json / after_json / document_hash when stored`

Issuer General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A (admin-forensic domain)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Document updated`
- Description/Remark: `reason / hashes when stored`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

none in current user-facing copy

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Admin activity, detail, and CSV share the same human label. No portal or notification.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Document updated`

Preferred Admin Description:
`[Actor] — Document updated.`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `LEGAL_VERSION_UPLOADED`

Status: LIVE

Module: Legal Documents / T&C

Business action:
Admin uploaded a new draft version.

Technical event:
`LEGAL_VERSION_UPLOADED`

Canonical business name:
`Version uploaded`

Actor:
Admin

Trigger:
createVersion

Stored in:
`legal_document_audit_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Version uploaded`
- Description: `before_json / after_json / document_hash when stored`

Admin Detail
- Visible: YES
- Title: `Version uploaded`
- Description: `before_json / after_json / document_hash when stored`

Issuer General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A (admin-forensic domain)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Version uploaded`
- Description/Remark: `reason / hashes when stored`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

none in current user-facing copy

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Admin activity, detail, and CSV share the same human label. No portal or notification.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Version uploaded`

Preferred Admin Description:
`[Actor] — Version uploaded.`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `LEGAL_VERSION_FILE_REPLACED`

Status: LIVE

Module: Legal Documents / T&C

Business action:
Admin replaced a draft PDF in place.

Technical event:
`LEGAL_VERSION_FILE_REPLACED`

Canonical business name:
`Version file replaced`

Actor:
Admin

Trigger:
replaceDraftFile

Stored in:
`legal_document_audit_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Version file replaced`
- Description: `before_json / after_json / document_hash when stored`

Admin Detail
- Visible: YES
- Title: `Version file replaced`
- Description: `before_json / after_json / document_hash when stored`

Issuer General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A (admin-forensic domain)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Version file replaced`
- Description/Remark: `reason / hashes when stored`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

none in current user-facing copy

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Admin activity, detail, and CSV share the same human label. No portal or notification.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Version file replaced`

Preferred Admin Description:
`[Actor] — Version file replaced.`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `LEGAL_VERSION_PUBLISHED`

Status: LIVE

Module: Legal Documents / T&C

Business action:
Admin published a version.

Technical event:
`LEGAL_VERSION_PUBLISHED`

Canonical business name:
`Version published`

Actor:
Admin

Trigger:
publishVersion

Stored in:
`legal_document_audit_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Version published`
- Description: `before_json / after_json / document_hash when stored`

Admin Detail
- Visible: YES
- Title: `Version published`
- Description: `before_json / after_json / document_hash when stored`

Issuer General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A (admin-forensic domain)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Version published`
- Description/Remark: `reason / hashes when stored`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

none in current user-facing copy

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Admin activity, detail, and CSV share the same human label. No portal or notification.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Version published`

Preferred Admin Description:
`[Actor] — Version published.`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `LEGAL_VERSION_ARCHIVED`

Status: LIVE

Module: Legal Documents / T&C

Business action:
Version archived, manually or automatically on publish/restore.

Technical event:
`LEGAL_VERSION_ARCHIVED`

Canonical business name:
`Version archived`

Actor:
Admin

Trigger:
archiveVersion / auto-archive

Stored in:
`legal_document_audit_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Version archived`
- Description: `before_json / after_json / document_hash when stored`

Admin Detail
- Visible: YES
- Title: `Version archived`
- Description: `before_json / after_json / document_hash when stored`

Issuer General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A (admin-forensic domain)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Version archived`
- Description/Remark: `reason / hashes when stored`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

none in current user-facing copy

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Admin activity, detail, and CSV share the same human label. No portal or notification.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Version archived`

Preferred Admin Description:
`[Actor] — Version archived.`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `LEGAL_VERSION_RESTORED`

Status: LIVE

Module: Legal Documents / T&C

Business action:
Admin restored an archived version.

Technical event:
`LEGAL_VERSION_RESTORED`

Canonical business name:
`Version restored`

Actor:
Admin

Trigger:
restoreVersion

Stored in:
`legal_document_audit_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Version restored`
- Description: `before_json / after_json / document_hash when stored`

Admin Detail
- Visible: YES
- Title: `Version restored`
- Description: `before_json / after_json / document_hash when stored`

Issuer General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A (admin-forensic domain)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Version restored`
- Description/Remark: `reason / hashes when stored`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

none in current user-facing copy

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Admin activity, detail, and CSV share the same human label. No portal or notification.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Version restored`

Preferred Admin Description:
`[Actor] — Version restored.`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

# Notes / Funding

## `NOTE_CREATED_FROM_INVOICE`

Status: LIVE

Module: Notes / Funding

Business action:
Note created from an approved invoice.

Technical event:
`NOTE_CREATED_FROM_INVOICE`

Canonical business name:
`Note Created`

Actor:
Admin

Trigger:
Admin createFromInvoice.

Stored in:
`note_events`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Note created`
- Description: `applicationId / invoiceId in metadata`

Admin Detail
- Visible: YES
- Title: `Note created`
- Description: `applicationId / invoiceId in metadata`

Issuer General Activity
- Visible: YES
- Title: `Note Created`
- Description: `[Note Ref] / [Note Title] was created from an approved invoice and can now be prepared for listing.`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Note created`
- Description/Remark: `metadata`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Note Ref], [Note Title]

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Admin/CSV sentence case vs portal Title Case. Meaning is the same.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Note Created`

Preferred Admin Description:
`[Actor] created [Note Ref] from an approved invoice.`

Preferred User Description:
`[Note Ref] was created from an approved invoice and can now be prepared for listing.`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `UPDATE_DRAFT`

Status: LIVE

Module: Notes / Funding

Business action:
Draft note edited.

Technical event:
`UPDATE_DRAFT`

Canonical business name:
`Draft Updated`

Actor:
Admin

Trigger:
Admin updateDraft.

Stored in:
`note_events`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Draft updated`
- Description: `before/after snapshots`

Admin Detail
- Visible: YES
- Title: `Draft updated`
- Description: `before/after snapshots`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Draft updated`
- Description/Remark: `changed fields in metadata`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Note Ref]

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Admin-only draft edit. CSV matches.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Draft Updated`

Preferred Admin Description:
`[Actor] updated the draft for [Note Ref].`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `UPDATE_FEATURED_SETTINGS`

Status: LIVE

Module: Notes / Funding

Business action:
Featured flag or rank changed.

Technical event:
`UPDATE_FEATURED_SETTINGS`

Canonical business name:
`Featured Settings Updated`

Actor:
Admin

Trigger:
Admin updateFeaturedSettings.

Stored in:
`note_events`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Featured settings updated`
- Description: `before/after`

Admin Detail
- Visible: YES
- Title: `Featured settings updated`
- Description: `before/after`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Featured settings updated`
- Description/Remark: `metadata`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Note Ref]

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Admin-only. CSV matches.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Featured Settings Updated`

Preferred Admin Description:
`[Actor] updated featured settings for [Note Ref].`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `PUBLISH`

Status: LIVE

Module: Notes / Funding

Business action:
Note published to the marketplace.

Technical event:
`PUBLISH`

Canonical business name:
`Note Published`

Actor:
Admin

Trigger:
Admin publish.

Stored in:
`note_events`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Note Published`
- Description: `before/after`

Admin Detail
- Visible: YES
- Title: `Note Published`
- Description: `before/after`

Issuer General Activity
- Visible: YES
- Title: `Note Published`
- Description: `[Note Ref] / [Note Title] is now live and open for investment.`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Note Published`
- Description/Remark: `metadata`

Notification
- Sends: YES
- Type: `note_published`
- Title: `Note Published`
- Message: `Your note "[Note Title]" has been published to the marketplace for investor funding.`
- Recipient: `issuer org members`
- Channel: `platform + email per registry`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Note Ref], [Note Title]

### CONSISTENCY REVIEW

Classification:
STANDARDIZATION_RECOMMENDED

Technical event is PUBLISH. Notification title is Note published (sentence case). Portal title is Note Published.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Note Published`

Preferred Admin Description:
`[Actor] published [Note Title] to the marketplace.`

Preferred User Description:
`[Note Title] is now live and open for investment.`

Preferred Notification Title:
`Note Published`

Preferred Notification Message:
`Your note "[Note Title]" has been published to the marketplace for investor funding.`

## `UNPUBLISH`

Status: LIVE

Module: Notes / Funding

Business action:
Note withdrawn from the marketplace (no commitments).

Technical event:
`UNPUBLISH`

Canonical business name:
`Unpublished from Marketplace`

Actor:
Admin

Trigger:
Admin unpublish.

Stored in:
`note_events`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Unpublished from marketplace`
- Description: `before/after`

Admin Detail
- Visible: YES
- Title: `Unpublished from marketplace`
- Description: `before/after`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Unpublished from marketplace`
- Description/Remark: `metadata`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Note Ref]

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Admin-only. Label already describes the business action.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Unpublished from Marketplace`

Preferred Admin Description:
`[Actor] unpublished [Note Title] from the marketplace.`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `PAUSE_LISTING`

Status: LIVE

Module: Notes / Funding

Business action:
Funding campaign paused.

Technical event:
`PAUSE_LISTING`

Canonical business name:
`Campaign Paused`

Actor:
Admin

Trigger:
Admin pauseListing.

Stored in:
`note_events`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Campaign paused`
- Description: `before/after`

Admin Detail
- Visible: YES
- Title: `Campaign paused`
- Description: `before/after`

Issuer General Activity
- Visible: YES
- Title: `Campaign Paused`
- Description: `[Note Ref] / [Note Title] was temporarily closed to new investment. Existing commitments are held.`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Campaign paused`
- Description/Remark: `metadata`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Note Ref], [Note Title]

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Admin/CSV and portal titles match aside from case.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Campaign Paused`

Preferred Admin Description:
`[Actor] paused the campaign for [Note Title].`

Preferred User Description:
`[Note Title] was temporarily closed to new investment. Existing commitments are held.`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `RESUME_LISTING`

Status: LIVE

Module: Notes / Funding

Business action:
Funding campaign resumed.

Technical event:
`RESUME_LISTING`

Canonical business name:
`Campaign Resumed`

Actor:
Admin

Trigger:
Admin resumeListing.

Stored in:
`note_events`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Campaign resumed`
- Description: `before/after`

Admin Detail
- Visible: YES
- Title: `Campaign resumed`
- Description: `before/after`

Issuer General Activity
- Visible: YES
- Title: `Campaign Resumed`
- Description: `[Note Ref] / [Note Title] is open for investment again.`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Campaign resumed`
- Description/Remark: `metadata`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Note Ref], [Note Title]

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Admin/CSV and portal titles match aside from case.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Campaign Resumed`

Preferred Admin Description:
`[Actor] resumed the campaign for [Note Title].`

Preferred User Description:
`[Note Title] is open for investment again.`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `INVESTMENT_COMMITTED`

Status: LIVE

Module: Notes / Funding

Business action:
Investor commits funds to a note.

Technical event:
`INVESTMENT_COMMITTED`

Canonical business name:
`Investment Committed`

Actor:
Investor

Trigger:
createInvestment.

Stored in:
`note_events`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Investment committed`
- Description: `[Amount]; investorOrganizationId`

Admin Detail
- Visible: YES
- Title: `Investment committed`
- Description: `[Amount]; investorOrganizationId`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: YES
- Title: `Investment Committed`
- Description: `Your investment in [Note Ref] / [Note Title] was committed successfully. (own org only)`

CSV / Export
- Included: YES
- Title/Event: `Investment committed`
- Description/Remark: `amount in metadata`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Note Ref], [Note Title], [Amount]

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Investor-only portal copy. Admin/CSV use the same business term.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Investment Committed`

Preferred Admin Description:
`[Actor] committed [Amount] to [Note Title].`

Preferred User Description:
`Your investment in [Note Title] was committed successfully.`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `CLOSE_FUNDING`

Status: LIVE

Module: Notes / Funding

Business action:
Funding threshold met / campaign closed.

Technical event:
`CLOSE_FUNDING`

Canonical business name:
`Funding Closed`

Actor:
Admin / System

Trigger:
Admin closeFunding, or system auto-close (`note-listing-expiry` cron / fully-funded inline close). Scheduled auto-close writes `actor_type: SYSTEM`, `source: SYSTEM_JOB`, actor `SYS`. Manual Admin close stays `ADMIN` / `API`.

Stored in:
`note_events`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Funding Closed`
- Description: `before/after`

Admin Detail
- Visible: YES
- Title: `Funding Closed`
- Description: `before/after`

Issuer General Activity
- Visible: YES
- Title: `Funding Closed`
- Description: `[Note Ref] / [Note Title] completed funding and disbursement can proceed.`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Funding Closed`
- Description/Remark: `metadata`

Notification
- Sends: YES
- Type: `note_funding_succeeded`
- Title: `Funding Closed`
- Message: `Funding for "[Note Title]" has closed — the minimum threshold was reached and commitments are locked in.`
- Recipient: `issuer org members`
- Channel: `platform + email per registry`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Note Ref], [Note Title]

### CONSISTENCY REVIEW

Classification:
STANDARDIZATION_RECOMMENDED

Notification title is Funding closed successfully — extra adverb vs the audit title.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Funding Closed`

Preferred Admin Description:
`Funding for [Note Title] closed.`

Preferred User Description:
`[Note Title] completed funding and disbursement can proceed.`

Preferred Notification Title:
`Funding Closed`

Preferred Notification Message:
`Funding for "[Note Title]" has closed — the minimum threshold was reached and commitments are locked in.`

## `FAIL_FUNDING`

Status: LIVE

Module: Notes / Funding

Business action:
Minimum funding threshold not reached; committed funds released.

Technical event:
`FAIL_FUNDING`

Canonical business name:
`Funding Unsuccessful`

Actor:
Admin / System

Trigger:
Admin/system failFunding. Scheduled listing-expiry auto-fail writes `actor_type: SYSTEM`, `source: SYSTEM_JOB`, actor `SYS`. Manual Admin fail stays `ADMIN` / `API`.

Stored in:
`note_events`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Funding unsuccessful`
- Description: `before/after`

Admin Detail
- Visible: YES
- Title: `Funding unsuccessful`
- Description: `before/after`

Issuer General Activity
- Visible: YES
- Title: `Funding Unsuccessful`
- Description: `[Note Ref] / [Note Title] did not meet the minimum funding threshold and committed funds were released.`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: YES
- Title: `Funding Unsuccessful`
- Description: `[Note Ref] / [Note Title] did not meet the minimum funding threshold and committed funds were released.`

CSV / Export
- Included: YES
- Title/Event: `Funding unsuccessful`
- Description/Remark: `metadata`

Notification
- Sends: YES
- Type: `note_funding_failed_issuer + note_funding_failed_investor`
- Title: `Note funding did not complete [note_funding_failed_issuer] | Commitment released [note_funding_failed_investor]`
- Message: `Funding for "[Note Title]" did not reach the minimum threshold before the listing closed. [note_funding_failed_issuer] | The listing for "[Note Title]" did not complete funding. Your reserved commitment has been released back to your available balance. [note_funding_failed_investor]`
- Recipient: `issuer org members; investors on the note`
- Channel: `platform + email per registry`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Note Ref], [Note Title]

### CONSISTENCY REVIEW

Classification:
INTENTIONALLY_DIFFERENT

Audit title is Funding Unsuccessful for both portals. Notifications split: issuer Note funding did not complete vs investor Commitment released.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Funding Unsuccessful`

Preferred Admin Description:
`Funding for [Note Title] did not meet the minimum threshold.`

Preferred User Description:
`[Note Title] did not meet the minimum funding threshold and committed funds were released.`

Preferred Notification Title:
`Funding Unsuccessful`

Preferred Notification Message:
`Issuer: Funding for "[Note Title]" did not reach the minimum threshold before the listing closed. Investor: The listing for "[Note Title]" did not complete funding. Your reserved commitment has been released.`

## `ACTIVATE`

Status: LIVE

Module: Notes / Funding

Business action:
Note manually activated; servicing begins. Auto-activation from disbursement does not write this event.

Technical event:
`ACTIVATE`

Canonical business name:
`Note Activated`

Actor:
Admin

Trigger:
Admin activate() only — disbursement completion does not write ACTIVATE.

Stored in:
`note_events`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Note Activated`
- Description: `[Actor] activated [Note Title]. Servicing has started.`

Admin Detail
- Visible: YES
- Title: `Note Activated`
- Description: `[Actor] activated [Note Title]. Servicing has started.`

Issuer General Activity
- Visible: YES
- Title: `Your Note Is Active`
- Description: `[Note Ref] / [Note Title] is now active and servicing has started.`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: YES
- Title: `Your Investment Is Active`
- Description: `[Note Ref] / [Note Title] is now active and servicing has started.`

CSV / Export
- Included: YES
- Title/Event: `Note Activated`
- Description/Remark: `metadata`

Notification
- Sends: YES
- Type: `note_active_issuer + note_active_investor`
- Title: `Your Note Is Active [note_active_issuer] | Your Investment Is Active [note_active_investor]`
- Message: `Your note "[Note Title]" is now active. Disbursement and servicing proceeds under the agreed terms. [note_active_issuer] | Funding for "[Note Title]" is complete and the note is now active. Servicing has started. [note_active_investor]`
- Recipient: `issuer org members; investors on the note`
- Channel: `platform + email per registry`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Note Ref], [Note Title]

### CONSISTENCY REVIEW

Classification:
STANDARDIZATION_RECOMMENDED

Admin/CSV Note activated vs portal Note Active vs notifications Note is active / Investment is active. Technical event is ACTIVATE.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Note Activated`

Preferred Admin Description:
`[Actor] activated [Note Title]. Servicing has started.`

Preferred User Description:
`[Note Title] is now active and servicing has started.`

Preferred Notification Title:
`Note Activated`

Preferred Notification Message:
`Issuer: Your note "[Note Title]" is now active. Investor: Funding for "[Note Title]" is complete and the note is now active.`

## `NOTE_FACILITY_FEE_COLLECTION_WAIVED`

Status: LIVE

Module: Notes / Funding

Business action:
Admin waived facility-fee collection on this note.

Technical event:
`NOTE_FACILITY_FEE_COLLECTION_WAIVED`

Canonical business name:
`Facility Fee Collection Waived`

Actor:
Admin

Trigger:
Admin waiveFacilityFeeCollection.

Stored in:
`note_events`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Facility fee collection waived`
- Description: `[Reason]`

Admin Detail
- Visible: YES
- Title: `Facility fee collection waived`
- Description: `[Reason]`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Facility fee collection waived`
- Description/Remark: `reason`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Note Ref], [Reason]

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Admin/CSV match. Distinct from CONTRACT_FACILITY_FEE_WAIVED.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Facility Fee Collection Waived`

Preferred Admin Description:
`[Actor] waived facility-fee collection on [Note Title]. [Reason]`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `WAIVE_FACILITY_FEE_COLLECTION`

Status: LIVE

Module: Notes / Funding

Business action:
Admin-action mirror of the same facility-fee collection waiver (logAdminAction).

Technical event:
`WAIVE_FACILITY_FEE_COLLECTION`

Canonical business name:
`Facility Fee Collection Waived`

Actor:
Admin

Trigger:
Same waiveFacilityFeeCollection call, note_admin_actions mirror.

Stored in:
`note_events + note_admin_actions`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Note: rendered via generic title-case fallback
- Title: `Facility Fee Collection Waived`
- Description: `before/after + changedFields`

Admin Detail
- Visible: YES
- Note: rendered via generic title-case fallback
- Title: `Facility Fee Collection Waived`
- Description: `before/after + changedFields`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Note: exported via generic title-case fallback
- Title/Event: `Facility Fee Collection Waived`
- Description/Remark: `metadata`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Note Ref], [Reason]

### CONSISTENCY REVIEW

Classification:
LEGACY_NAMING_TRAP

Duplicate of NOTE_FACILITY_FEE_COLLECTION_WAIVED with an uncurated fallback label that reads as an imperative.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Facility Fee Collection Waived`

Preferred Admin Description:
`[Actor] waived facility-fee collection on [Note Title].`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `FACILITY_OCCUPANCY_UPDATED`

Status: LIVE

Module: Notes / Funding

Business action:
Contract occupancy recomputed with this note in scope.

Technical event:
`FACILITY_OCCUPANCY_UPDATED`

Canonical business name:
`Facility Occupancy Updated`

Actor:
System

Trigger:
refresh-contract-facility with noteId.

Stored in:
`note_events`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Facility occupancy updated`
- Description: `occupancy snapshot`

Admin Detail
- Visible: YES
- Title: `Facility occupancy updated`
- Description: `occupancy snapshot`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Facility occupancy updated`
- Description/Remark: `snapshot`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Note Ref], [Facility Ref]

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Note-scoped twin of CONTRACT_FACILITY_OCCUPANCY_UPDATED. Admin/CSV match.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Facility Occupancy Updated`

Preferred Admin Description:
`Facility occupancy was updated for [Note Title].`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `NOTE_DEFAULT_MARKED`

Status: LIVE

Module: Notes / Funding

Business action:
Note marked in default.

Technical event:
`NOTE_DEFAULT_MARKED`

Canonical business name:
`Note Defaulted`

Actor:
Admin

Trigger:
Admin markDefault.

Stored in:
`note_events`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Note Defaulted`
- Description: `[Reason]`

Admin Detail
- Visible: YES
- Title: `Note Defaulted`
- Description: `[Reason]`

Issuer General Activity
- Visible: YES
- Title: `Your Note Is in Default`
- Description: `[Note Ref] / [Note Title] was marked in default and requires attention.`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: YES
- Title: `Your Investment Is in Default`
- Description: `[Note Ref] / [Note Title] was marked in default and requires attention.`

CSV / Export
- Included: YES
- Title/Event: `Note Defaulted`
- Description/Remark: `reason`

Notification
- Sends: YES
- Type: `note_defaulted + note_defaulted_investor`
- Title: `Your Note Is in Default [note_defaulted] | Your Investment Is in Default [note_defaulted_investor]`
- Message: `"[Note Title]" has been marked as default. [note_defaulted] | "[Note Title]" has been marked as default. This may affect recovery timelines; check your investments view for updates. [note_defaulted_investor]`
- Recipient: `issuer org members; investors on the note`
- Channel: `platform + email per registry`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Note Ref], [Note Title], [Reason]

### CONSISTENCY REVIEW

Classification:
STANDARDIZATION_RECOMMENDED

Audit title is Note Defaulted; notifications say Note marked as default.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Note Defaulted`

Preferred Admin Description:
`[Actor] marked [Note Title] in default. [Reason]`

Preferred User Description:
`[Note Title] was marked in default and requires attention.`

Preferred Notification Title:
`Note Defaulted`

Preferred Notification Message:
`"[Note Title]" has been marked as default.`

## `PROSPECTUS_REVIEW_CREATE`

Status: LIVE

Module: Notes / Funding

Business action:
Prospectus review created.

Technical event:
`PROSPECTUS_REVIEW_CREATE`

Canonical business name:
`Prospectus review created`

Actor:
Admin

Trigger:
prospectus-review.service logProspectusAction.

Stored in:
`note_events`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Prospectus review created`
- Description: `beforeState / afterState`

Admin Detail
- Visible: YES
- Title: `Prospectus review created`
- Description: `beforeState / afterState`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Prospectus review created`
- Description/Remark: `before/after snapshots`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Note Ref]

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Admin-only prospectus trail. Admin and CSV share the same label.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Prospectus review created`

Preferred Admin Description:
`[Actor] — Prospectus review created for [Note Title].`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `PROSPECTUS_REVIEW_DRAFT_UPDATE`

Status: LIVE

Module: Notes / Funding

Business action:
Prospectus draft updated.

Technical event:
`PROSPECTUS_REVIEW_DRAFT_UPDATE`

Canonical business name:
`Prospectus draft updated`

Actor:
Admin

Trigger:
prospectus-review.service logProspectusAction.

Stored in:
`note_events`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Prospectus draft updated`
- Description: `beforeState / afterState`

Admin Detail
- Visible: YES
- Title: `Prospectus draft updated`
- Description: `beforeState / afterState`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Prospectus draft updated`
- Description/Remark: `before/after snapshots`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Note Ref]

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Admin-only prospectus trail. Admin and CSV share the same label.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Prospectus draft updated`

Preferred Admin Description:
`[Actor] — Prospectus draft updated for [Note Title].`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `PROSPECTUS_REVIEW_APPROVE`

Status: LIVE

Module: Notes / Funding

Business action:
Prospectus approved.

Technical event:
`PROSPECTUS_REVIEW_APPROVE`

Canonical business name:
`Prospectus approved`

Actor:
Admin

Trigger:
prospectus-review.service logProspectusAction.

Stored in:
`note_events`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Prospectus approved`
- Description: `beforeState / afterState`

Admin Detail
- Visible: YES
- Title: `Prospectus approved`
- Description: `beforeState / afterState`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Prospectus approved`
- Description/Remark: `before/after snapshots`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Note Ref]

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Admin-only prospectus trail. Admin and CSV share the same label.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Prospectus approved`

Preferred Admin Description:
`[Actor] — Prospectus approved for [Note Title].`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `PROSPECTUS_APPROVAL_INVALIDATED_EDIT`

Status: LIVE

Module: Notes / Funding

Business action:
Prospectus approval cleared after edit.

Technical event:
`PROSPECTUS_APPROVAL_INVALIDATED_EDIT`

Canonical business name:
`Prospectus approval cleared after edit`

Actor:
Admin

Trigger:
prospectus-review.service logProspectusAction.

Stored in:
`note_events`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Prospectus approval cleared after edit`
- Description: `beforeState / afterState`

Admin Detail
- Visible: YES
- Title: `Prospectus approval cleared after edit`
- Description: `beforeState / afterState`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Prospectus approval cleared after edit`
- Description/Remark: `before/after snapshots`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Note Ref]

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Admin-only prospectus trail. Admin and CSV share the same label.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Prospectus approval cleared after edit`

Preferred Admin Description:
`[Actor] — Prospectus approval cleared after edit for [Note Title].`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `PROSPECTUS_APPROVAL_INVALIDATED_SOURCE`

Status: LIVE

Module: Notes / Funding

Business action:
Prospectus approval cleared after source change.

Technical event:
`PROSPECTUS_APPROVAL_INVALIDATED_SOURCE`

Canonical business name:
`Prospectus approval cleared after source change`

Actor:
Admin

Trigger:
prospectus-review.service logProspectusAction.

Stored in:
`note_events`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Prospectus approval cleared after source change`
- Description: `beforeState / afterState`

Admin Detail
- Visible: YES
- Title: `Prospectus approval cleared after source change`
- Description: `beforeState / afterState`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Prospectus approval cleared after source change`
- Description/Remark: `before/after snapshots`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Note Ref]

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Admin-only prospectus trail. Admin and CSV share the same label.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Prospectus approval cleared after source change`

Preferred Admin Description:
`[Actor] — Prospectus approval cleared after source change for [Note Title].`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `PROSPECTUS_APPROVAL_INVALIDATED_UNPUBLISH`

Status: LIVE

Module: Notes / Funding

Business action:
Prospectus approval cleared after unpublish.

Technical event:
`PROSPECTUS_APPROVAL_INVALIDATED_UNPUBLISH`

Canonical business name:
`Prospectus approval cleared after unpublish`

Actor:
Admin

Trigger:
prospectus-review.service logProspectusAction.

Stored in:
`note_events`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Prospectus approval cleared after unpublish`
- Description: `beforeState / afterState`

Admin Detail
- Visible: YES
- Title: `Prospectus approval cleared after unpublish`
- Description: `beforeState / afterState`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Prospectus approval cleared after unpublish`
- Description/Remark: `before/after snapshots`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Note Ref]

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Admin-only prospectus trail. Admin and CSV share the same label.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Prospectus approval cleared after unpublish`

Preferred Admin Description:
`[Actor] — Prospectus approval cleared after unpublish for [Note Title].`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `SHORAKA_ORDER_SUBMITTED`

Status: LIVE

Module: Notes / Funding

Business action:
Tawarruq commodity order submitted to the provider.

Technical event:
`SHORAKA_ORDER_SUBMITTED`

Canonical business name:
`Tawarruq Order Submitted`

Actor:
System

Trigger:
shoraka-stp-service submitOrder.

Stored in:
`note_events`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Tawarruq Order Submitted`
- Description: `provider_order_id / amounts / dates`

Admin Detail
- Visible: YES
- Title: `Tawarruq Order Submitted`
- Description: `provider_order_id / amounts / dates`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Tawarruq Order Submitted`
- Description/Remark: `provider_order_id, amounts`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Note Ref], [Amount]

### CONSISTENCY REVIEW

Classification:
LEGACY_NAMING_TRAP

Stored event_type keeps SHORAKA_ prefix; admin/CSV substitute Tawarruq. Do not rename the technical event.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Tawarruq Order Submitted`

Preferred Admin Description:
`Tawarruq order submitted for [Note Title].`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `SHORAKA_CERTIFICATE_FETCHED`

Status: LIVE

Module: Notes / Funding

Business action:
Tawarruq trade certificate retrieved and stored.

Technical event:
`SHORAKA_CERTIFICATE_FETCHED`

Canonical business name:
`Tawarruq Certificate Fetched`

Actor:
System

Trigger:
shoraka-stp-service fetchCertificate.

Stored in:
`note_events`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Tawarruq Certificate Retrieved`
- Description: `document_type / provider_order_id`

Admin Detail
- Visible: YES
- Title: `Tawarruq Certificate Retrieved`
- Description: `document_type / provider_order_id`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Tawarruq Certificate Retrieved`
- Description/Remark: `metadata`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Note Ref]

### CONSISTENCY REVIEW

Classification:
LEGACY_NAMING_TRAP

Same Shoraka vs Tawarruq naming trap as the order event.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Tawarruq Certificate Fetched`

Preferred Admin Description:
`Tawarruq certificate fetched for [Note Title].`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

# Repayment

## `ISSUER_PAYMENT_SUBMITTED`

Status: LIVE

Module: Repayment

Business action:
Issuer submits a repayment for review.

Technical event:
`ISSUER_PAYMENT_SUBMITTED`

Canonical business name:
`Repayment Submitted`

Actor:
Issuer

Trigger:
recordPayment when actor.portal === ISSUER.

Stored in:
`note_events`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Repayment Submitted`
- Description: `payment input including paymentPurpose`

Admin Detail
- Visible: YES
- Title: `Repayment Submitted`
- Description: `payment input including paymentPurpose`

Issuer General Activity
- Visible: YES
- Title: `You Submitted a Repayment`
- Description: `A repayment for [Note Ref] / [Note Title] was submitted and is awaiting review.`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Repayment Submitted`
- Description/Remark: `payment metadata`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Note Ref], [Note Title], [Amount], [Payment Ref]

### CONSISTENCY REVIEW

Classification:
STANDARDIZATION_RECOMMENDED

Admin/CSV say Repayment submitted; issuer portal title is Payment Submitted while the description still says repayment.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Repayment Submitted`

Preferred Admin Description:
`[Actor] submitted a repayment for [Note Title].`

Preferred User Description:
`A repayment for [Note Title] was submitted and is awaiting review.`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `PAYMENT_RECEIVED`

Status: LIVE

Module: Repayment

Business action:
Admin records a repayment directly.

Technical event:
`PAYMENT_RECEIVED`

Canonical business name:
`Repayment Received`

Actor:
Admin

Trigger:
recordPayment from the admin portal.

Stored in:
`note_events`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Repayment received`
- Description: `payment input`

Admin Detail
- Visible: YES
- Title: `Repayment received`
- Description: `payment input`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Repayment received`
- Description/Remark: `payment metadata`

Notification
- Sends: YES
- Type: `note_payment_received`
- Title: `Repayment Received`
- Message: `A repayment was recorded for "[Note Title]".`
- Recipient: `investors on the note`
- Channel: `platform + email per registry`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Note Ref], [Note Title], [Amount], [Payment Ref]

### CONSISTENCY REVIEW

Classification:
INTENTIONALLY_DIFFERENT

Investors are notified (note_payment_received) even though this event is hidden from investor activity. Same notification type as PAYMENT_APPROVED.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Repayment Received`

Preferred Admin Description:
`[Actor] recorded a repayment for [Note Title].`

Preferred User Description:
`A repayment was recorded for [Note Title].`

Preferred Notification Title:
`Repayment Received`

Preferred Notification Message:
`A repayment was recorded for "[Note Title]".`

## `PAYMENT_APPROVED`

Status: LIVE

Module: Repayment

Business action:
Pending issuer repayment approved.

Technical event:
`PAYMENT_APPROVED`

Canonical business name:
`Repayment Approved`

Actor:
Admin

Trigger:
Admin approvePayment.

Stored in:
`note_events`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Repayment approved`
- Description: `paymentId`

Admin Detail
- Visible: YES
- Title: `Repayment approved`
- Description: `paymentId`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Repayment approved`
- Description/Remark: `paymentId`

Notification
- Sends: YES
- Type: `note_payment_received`
- Title: `Repayment Received`
- Message: `A repayment was recorded for "[Note Title]".`
- Recipient: `investors on the note`
- Channel: `platform + email per registry`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Note Ref], [Note Title], [Payment Ref]

### CONSISTENCY REVIEW

Classification:
INTENTIONALLY_DIFFERENT

Admin title is Approved; investor notification reuses Repayment Received (note_payment_received). Issuer is not notified of approval.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Repayment Approved`

Preferred Admin Description:
`[Actor] approved a repayment for [Note Title].`

Preferred User Description:
`A repayment was recorded for [Note Title].`

Preferred Notification Title:
`Repayment Received`

Preferred Notification Message:
`A repayment was recorded for "[Note Title]".`

## `PAYMENT_REJECTED`

Status: LIVE

Module: Repayment

Business action:
Pending issuer repayment rejected.

Technical event:
`PAYMENT_REJECTED`

Canonical business name:
`Repayment Rejected`

Actor:
Admin

Trigger:
Admin rejectPayment.

Stored in:
`note_events`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Repayment Rejected`
- Description: `paymentId + [Reason]`

Admin Detail
- Visible: YES
- Title: `Repayment Rejected`
- Description: `paymentId + [Reason]`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Repayment Rejected`
- Description/Remark: `reason`

Notification
- Sends: YES
- Type: `note_payment_rejected`
- Title: `Repayment Rejected`
- Message: `Your repayment for note [Note Title] was rejected. Please review the repayment details.`
- Recipient: `issuer org members`
- Channel: `platform only`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Note Ref], [Note Title], [Payment Ref], [Reason]

### CONSISTENCY REVIEW

Classification:
STANDARDIZATION_RECOMMENDED

Issuer is notified (platform only) but the event is hidden from issuer general activity.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Repayment Rejected`

Preferred Admin Description:
`[Actor] rejected a repayment for [Note Title]. [Reason]`

Preferred User Description:
`Your repayment for [Note Title] was rejected.`

Preferred Notification Title:
`Repayment Rejected`

Preferred Notification Message:
`Your repayment for note [Note Title] was rejected. Please review the repayment details.`

## `SETTLEMENT_PREVIEWED`

Status: LIVE

Module: Repayment

Business action:
Settlement preview saved.

Technical event:
`SETTLEMENT_PREVIEWED`

Canonical business name:
`Settlement Previewed`

Actor:
Admin

Trigger:
Admin previewSettlement.

Stored in:
`note_events`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Settlement previewed`
- Description: `settlement snapshot`

Admin Detail
- Visible: YES
- Title: `Settlement previewed`
- Description: `settlement snapshot`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Settlement previewed`
- Description/Remark: `settlementId + snapshot`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Note Ref]

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Admin-only preview step. CSV matches.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Settlement Previewed`

Preferred Admin Description:
`[Actor] previewed settlement for [Note Title].`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `SETTLEMENT_APPROVED`

Status: LIVE

Module: Repayment

Business action:
Settlement preview approved.

Technical event:
`SETTLEMENT_APPROVED`

Canonical business name:
`Settlement Approved`

Actor:
Admin

Trigger:
Admin approveSettlement.

Stored in:
`note_events`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Settlement approved`
- Description: `settlementId`

Admin Detail
- Visible: YES
- Title: `Settlement approved`
- Description: `settlementId`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Settlement approved`
- Description/Remark: `settlementId`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Note Ref]

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Admin-only. Distinct from Settlement Posted.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Settlement Approved`

Preferred Admin Description:
`[Actor] approved settlement for [Note Title].`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `SETTLEMENT_POSTED`

Status: LIVE

Module: Repayment

Business action:
Settlement posted to the ledger.

Technical event:
`SETTLEMENT_POSTED`

Canonical business name:
`Settlement Posted`

Actor:
Admin

Trigger:
Admin postSettlement.

Stored in:
`note_events`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Settlement posted`
- Description: `settlementId, investorPayoutCount, residualAmount`

Admin Detail
- Visible: YES
- Title: `Settlement posted`
- Description: `settlementId, investorPayoutCount, residualAmount`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: YES
- Title: `Settlement Posted`
- Description: `Your returns for [Note Ref] / [Note Title] were posted.`

CSV / Export
- Included: YES
- Title/Event: `Settlement posted`
- Description/Remark: `settlement metadata`

Notification
- Sends: YES
- Type: `note_settlement_posted + note_repaid_issuer on final settlement)`
- Title: `Settlement Posted [note_settlement_posted] | note_repaid_issuer on final settlement) [note_repaid_issuer on final settlement)]`
- Message: `Settlement has been posted for "[Note Title]". [note_settlement_posted] | (see registry.ts) [note_repaid_issuer on final settlement)]`
- Recipient: `investors on the note; issuer org members`
- Channel: `platform + email per registry`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Note Ref], [Note Title]

### CONSISTENCY REVIEW

Classification:
INTENTIONALLY_DIFFERENT

Investor activity and note_settlement_posted use Settlement Posted. Issuer may also get note_repaid_issuer (Note repaid) when no trustee step follows.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Settlement Posted`

Preferred Admin Description:
`[Actor] posted settlement for [Note Title].`

Preferred User Description:
`Your returns for [Note Title] were posted.`

Preferred Notification Title:
`Settlement Posted`

Preferred Notification Message:
`Settlement has been posted for "[Note Title]".`

## `OVERDUE_LATE_CHARGE_CHECKED`

Status: LIVE

Module: Repayment

Business action:
Overdue / late-fee check executed. This is the de-facto arrears audit event (there is no NOTE_ARREARS event).

Technical event:
`OVERDUE_LATE_CHARGE_CHECKED`

Canonical business name:
`Overdue Late Charge Checked`

Actor:
Admin

Trigger:
Admin applyOverdueLateCharge.

Stored in:
`note_events`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Overdue Review Completed`
- Description: `dueDate / overdue / daysLate / suggested amounts`

Admin Detail
- Visible: YES
- Title: `Overdue Review Completed`
- Description: `dueDate / overdue / daysLate / suggested amounts`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Overdue Review Completed`
- Description/Remark: `full result object`

Notification
- Sends: YES
- Type: `note_arrears + note_arrears_investor`
- Title: `Note in Arrears [note_arrears] | Note in Arrears [note_arrears_investor]`
- Message: `"[Note Title]" has moved into arrears. Review repayment status and obligations. [note_arrears] | "[Note Title]" is in arrears. We will keep you informed as servicing actions progress. [note_arrears_investor]`
- Recipient: `issuer org members; investors on the note`
- Channel: `platform + email per registry (condition: only when the check determines the note has entered arrears)`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Note Ref], [Note Title]

### CONSISTENCY REVIEW

Classification:
STANDARDIZATION_RECOMMENDED

Audit title describes the check. Notifications (only when the note enters arrears) use Note in arrears.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Overdue Late Charge Checked`

Preferred Admin Description:
`[Actor] ran the overdue / late-charge check for [Note Title].`

Preferred User Description:
`[Note Title] has moved into arrears.`

Preferred Notification Title:
`Note in Arrears`

Preferred Notification Message:
`"[Note Title]" has moved into arrears. Review repayment status and obligations.`

## `LATE_CHARGE_APPROVED`

Status: LIVE

Module: Repayment

Business action:
Late charge calculated and approved.

Technical event:
`LATE_CHARGE_APPROVED`

Canonical business name:
`Late Charge Approved`

Actor:
Admin

Trigger:
Admin approveLateCharge.

Stored in:
`note_events`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Late charge approved`
- Description: `calculateLateCharge result`

Admin Detail
- Visible: YES
- Title: `Late charge approved`
- Description: `calculateLateCharge result`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Late charge approved`
- Description/Remark: `result object`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Note Ref], [Amount]

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Admin-only. CSV matches.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Late Charge Approved`

Preferred Admin Description:
`[Actor] approved a late charge for [Note Title].`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `ARREARS_LETTER_GENERATED`

Status: LIVE

Module: Repayment

Business action:
Arrears letter PDF generated.

Technical event:
`ARREARS_LETTER_GENERATED`

Canonical business name:
`Arrears Letter Generated`

Actor:
Admin

Trigger:
generateNoteLetter('arrears').

Stored in:
`note_events`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Arrears letter generated`
- Description: `s3Key`

Admin Detail
- Visible: YES
- Title: `Arrears letter generated`
- Description: `s3Key`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Arrears letter generated`
- Description/Remark: `s3Key`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Note Ref]

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Admin-only document generation.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Arrears Letter Generated`

Preferred Admin Description:
`[Actor] generated an arrears letter for [Note Title].`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `DEFAULT_LETTER_GENERATED`

Status: LIVE

Module: Repayment

Business action:
Default letter PDF generated.

Technical event:
`DEFAULT_LETTER_GENERATED`

Canonical business name:
`Default Letter Generated`

Actor:
Admin

Trigger:
generateNoteLetter('default').

Stored in:
`note_events`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Default letter generated`
- Description: `s3Key`

Admin Detail
- Visible: YES
- Title: `Default letter generated`
- Description: `s3Key`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Default letter generated`
- Description/Remark: `s3Key`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Note Ref]

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Admin-only document generation.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Default Letter Generated`

Preferred Admin Description:
`[Actor] generated a default letter for [Note Title].`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `SETTLEMENT_TRUSTEE_LETTER_GENERATED`

Status: LIVE

Module: Repayment

Business action:
Settlement-wide trustee instruction PDF generated for a posted settlement (investor repayment, service fee, tawidh, gharamah, residual when present). Distinct from `SETTLEMENT_TRUSTEE_EMAIL_SENT` (operational SES delivery), `SETTLEMENT_TRUSTEE_LETTER_SUBMITTED` (status submitted), and `SETTLEMENT_TRUSTEE_INSTRUCTION_COMPLETED` (instruction completed).

Technical event:
`SETTLEMENT_TRUSTEE_LETTER_GENERATED`


Canonical business name:
`Settlement Trustee Letter Generated`

Actor:
Admin

Trigger:
`generateSettlementTrusteeLetter` — Admin generates the settlement trustee instruction PDF after settlement is posted.

Stored in:
`note_events`

Metadata:
`s3Key`, `settlementId`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Settlement Trustee Letter Generated`
- Description: `s3Key, settlementId` (`s3Key` is used for download, not shown as a timeline field)

Admin Detail
- Visible: YES
- Title: `Settlement Trustee Letter Generated`
- Description: `s3Key, settlementId`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Settlement Trustee Letter Generated`
- Description/Remark: `s3Key, settlementId`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: Trustee operational email, if any, is `SETTLEMENT_TRUSTEE_EMAIL_SENT` — a separate event.

### PLACEHOLDERS USED

[Note Ref]

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Admin-only. Canonical technical ID is `SETTLEMENT_TRUSTEE_LETTER_GENERATED`. Distinct from email / submit / completion.

Technical-name mismatch:
NO

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Settlement Trustee Letter Generated`

Preferred Admin Description:
`[Actor] generated the settlement trustee letter for [Note Title].`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`


## `SETTLEMENT_TRUSTEE_EMAIL_SENT`

Status: LIVE

Module: Repayment

Business action:
Operational trustee email for the posted-settlement trustee instruction was delivered or redelivered. This is settlement-wide (investor repayment, service fee, tawidh, gharamah, residual when present), not a service-fee-only payment.

Technical event:
`SETTLEMENT_TRUSTEE_EMAIL_SENT`


Canonical business name:
`Settlement Trustee Email Sent`

Actor:
Admin

Trigger:
`deliverSettlementTrusteeEmail` / `persistSettlementTrusteeEmailSent`, called from `markSettlementTrusteeLetterSubmitted` when trustee auto-send is enabled (before the submit status transaction), or from `resendSettlementTrusteeEmail`.

Stored in:
`note_events`

Metadata:
`settlementId`, `settlementReference` (from already-loaded `note_settlements.display_reference`; new writes only), `messageId`, optional `resend: true`. Historical rows may omit `settlementReference` and are not rewritten.

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Settlement Trustee Email Sent` (metadata `resend: true` → `Settlement Trustee Email Redelivered`)
- Description: `settlementId`, `settlementReference` (new writes), `messageId`, optional `resend`

Admin Detail
- Visible: YES
- Title: same metadata-aware title as Activity
- Description: `settlementId`, `settlementReference` (new writes), `messageId`; `resend: true` renders as Redelivery / Redelivered

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Settlement Trustee Email Sent` / `Settlement Trustee Email Redelivered`
- Description/Remark: `settlementId`, `settlementReference` (new writes), `messageId`, optional `resend`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- YES
- Purpose: SES trustee instruction PDF email (`sendTrusteeInstructionPdfEmail`, kind `SETTLEMENT`) to the configured trustee recipient/CC. Not a platform notification. Distinct from `SETTLEMENT_TRUSTEE_LETTER_GENERATED` (PDF generated), `SETTLEMENT_TRUSTEE_LETTER_SUBMITTED` (business status), and issuer `note_repaid_issuer` (later, on instruction completed).

### PLACEHOLDERS USED

[Note Ref]

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Admin-only operational delivery. Canonical technical ID is `SETTLEMENT_TRUSTEE_EMAIL_SENT`. Do not merge with letter-generated (`SETTLEMENT_TRUSTEE_LETTER_GENERATED`), letter-submitted (`SETTLEMENT_TRUSTEE_LETTER_SUBMITTED`), or instruction-completed (`SETTLEMENT_TRUSTEE_INSTRUCTION_COMPLETED`).

Technical-name mismatch:
NO

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Settlement Trustee Email Sent` / `Settlement Trustee Email Redelivered`

Preferred Admin Description:
`[Actor] sent the settlement trustee instruction email.`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`


## `SETTLEMENT_TRUSTEE_LETTER_SUBMITTED`

Status: LIVE

Module: Repayment

Business action:
Settlement trustee instruction status moved to submitted-to-trustee. Distinct from `SETTLEMENT_TRUSTEE_LETTER_GENERATED` (PDF generated), `SETTLEMENT_TRUSTEE_EMAIL_SENT` (operational SES delivery), and `SETTLEMENT_TRUSTEE_INSTRUCTION_COMPLETED` (instruction completed).

Technical event:
`SETTLEMENT_TRUSTEE_LETTER_SUBMITTED`


Canonical business name:
`Settlement Trustee Letter Submitted`

Actor:
Admin

Trigger:
`markSettlementTrusteeLetterSubmitted` — status transition to `SUBMITTED_TO_TRUSTEE` after any auto-send email attempt. Distinct from `SETTLEMENT_TRUSTEE_EMAIL_SENT`.

Stored in:
`note_events`

Metadata:
`settlementId`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Settlement Trustee Letter Submitted`
- Description: `settlementId`

Admin Detail
- Visible: YES
- Title: `Settlement Trustee Letter Submitted`
- Description: `settlementId`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Settlement Trustee Letter Submitted`
- Description/Remark: `settlementId`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: Trustee operational email, if any, is `SETTLEMENT_TRUSTEE_EMAIL_SENT` — a separate event.

### PLACEHOLDERS USED

[Note Ref]

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Admin-only status transition. Canonical technical ID is `SETTLEMENT_TRUSTEE_LETTER_SUBMITTED`. Distinct from `SETTLEMENT_TRUSTEE_EMAIL_SENT` (operational SES delivery, which may run first when auto-send is enabled) and from generation / completion.

Technical-name mismatch:
NO

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Settlement Trustee Letter Submitted`

Preferred Admin Description:
`[Actor] submitted the settlement trustee letter for [Note Title].`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`


## `SETTLEMENT_TRUSTEE_INSTRUCTION_COMPLETED`

Status: LIVE

Module: Repayment

Business action:
Settlement trustee instruction marked completed. Distinct from `SETTLEMENT_TRUSTEE_LETTER_GENERATED`, `SETTLEMENT_TRUSTEE_EMAIL_SENT`, and `SETTLEMENT_TRUSTEE_LETTER_SUBMITTED`. May trigger issuer `note_repaid_issuer` at this same completion moment — not a new notification type.

Technical event:
`SETTLEMENT_TRUSTEE_INSTRUCTION_COMPLETED`


Canonical business name:
`Settlement Trustee Instruction Completed`

Actor:
Admin

Trigger:
`markSettlementTrusteeInstructionCompleted` — complete trustee settlement instruction.

Stored in:
`note_events`

Metadata:
`settlementId`, `completedAt`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Settlement Trustee Instruction Completed`
- Description: `settlementId, completedAt`

Admin Detail
- Visible: YES
- Title: `Settlement Trustee Instruction Completed`
- Description: `settlementId, completedAt`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Settlement Trustee Instruction Completed`
- Description/Remark: `settlementId`

Notification
- Sends: YES
- Type: `note_repaid_issuer`
- Title: `Note repaid`
- Message: `"[Note Title]" has been fully repaid and settled. Any residual handling will follow operational workflow if applicable.`
- Recipient: `issuer org members`
- Channel: `platform + email per registry`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Note Ref], [Note Title]

### CONSISTENCY REVIEW

Classification:
INTENTIONALLY_DIFFERENT

Audit title is the trustee-instruction completion. Issuer notification is `note_repaid_issuer` (Note repaid). Canonical technical ID is `SETTLEMENT_TRUSTEE_INSTRUCTION_COMPLETED`. Notification type, timing, recipients, and channel are unchanged.

Technical-name mismatch:
NO

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Settlement Trustee Instruction Completed`

Preferred Admin Description:
`[Actor] completed the settlement trustee instruction for [Note Title].`

Preferred User Description:
`"[Note Title]" has been fully repaid and settled.`

Preferred Notification Title:
`Note Repaid`

Preferred Notification Message:
`"[Note Title]" has been fully repaid and settled. Any residual handling will follow operational workflow if applicable.`


## `ISSUER_DISBURSEMENT_WITHDRAWAL_CREATED`

Status: LIVE

Module: Withdrawal / Disbursement / Trustee

Business action:
Disbursement instruction auto-created when funding closes.

Technical event:
`ISSUER_DISBURSEMENT_WITHDRAWAL_CREATED`

Canonical business name:
`Disbursement Instruction Created`

Actor:
Admin / System

Trigger:
closeFunding auto-creates the instruction.

Stored in:
`note_events`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Disbursement instruction created`
- Description: `netDisbursement / fees snapshot`

Admin Detail
- Visible: YES
- Title: `Disbursement instruction created`
- Description: `netDisbursement / fees snapshot`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Disbursement instruction created`
- Description/Remark: `amount snapshot`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Note Ref], [Amount]

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Admin/CSV already use Disbursement, not Withdrawal, for this creation event.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Disbursement Instruction Created`

Preferred Admin Description:
`A disbursement instruction was created for [Note Title].`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `WITHDRAWAL_LETTER_GENERATED`

Status: LIVE

Module: Withdrawal / Disbursement / Trustee

Business action:
Trustee withdrawal letter PDF generated.

Technical event:
`WITHDRAWAL_LETTER_GENERATED`

Canonical business name:
`Withdrawal Letter Generated`

Actor:
Admin

Trigger:
generateWithdrawalLetter.

Stored in:
`note_events`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Withdrawal letter generated`
- Description: `withdrawalId, s3Key`

Admin Detail
- Visible: YES
- Title: `Withdrawal letter generated`
- Description: `withdrawalId, s3Key`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Withdrawal letter generated`
- Description/Remark: `s3Key`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Note Ref]

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Admin-only document generation. Distinct from `WITHDRAWAL_TRUSTEE_EMAIL_SENT` (operational SES delivery of that PDF) and `WITHDRAWAL_SUBMITTED_TO_TRUSTEE` (status submitted + issuer platform notification).

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Withdrawal Letter Generated`

Preferred Admin Description:
`[Actor] generated the withdrawal letter.`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `WITHDRAWAL_TRUSTEE_EMAIL_SENT`

Status: LIVE

Module: Withdrawal / Disbursement / Trustee

Business action:
Operational trustee email for a withdrawal/disbursement instruction was delivered or redelivered.

Technical event:
`WITHDRAWAL_TRUSTEE_EMAIL_SENT`

Canonical business name:
`Withdrawal Trustee Email Sent`

Actor:
Admin

Trigger:
`deliverWithdrawalTrusteeEmail` / `persistWithdrawalTrusteeEmailSent`, called from `markWithdrawalSubmitted` when trustee auto-send is enabled (before the submit status transaction), or from `resendWithdrawalTrusteeEmail`.

Stored in:
`note_events`

Metadata:
`withdrawalId`, `withdrawalReference` (from already-loaded `withdrawal_instructions.display_reference`; new writes only), `messageId`, optional `resend: true`. Historical rows may omit `withdrawalReference` and are not rewritten.

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Withdrawal Trustee Email Sent` (metadata `resend: true` → `Withdrawal Trustee Email Redelivered`)
- Description: `withdrawalId`, `withdrawalReference` (new writes), `messageId`, optional `resend`

Admin Detail
- Visible: YES
- Title: same metadata-aware title as Activity
- Description: `withdrawalId`, `withdrawalReference` (new writes), `messageId`; `resend: true` renders as Redelivery / Redelivered

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Withdrawal Trustee Email Sent` / `Withdrawal Trustee Email Redelivered`
- Description/Remark: `withdrawalId`, `withdrawalReference` (new writes), `messageId`, optional `resend`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- YES
- Purpose: SES trustee instruction PDF email (`sendTrusteeInstructionPdfEmail`) to the configured trustee recipient/CC. Not a platform notification. Distinct from `WITHDRAWAL_SUBMITTED_TO_TRUSTEE` (business status + issuer platform notification `withdrawal_submitted_to_trustee`).

### PLACEHOLDERS USED

[Note Ref]

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Admin-only operational delivery. Metadata-aware formatter keeps initial vs redelivery titles. Not a duplicate of letter generation or trustee submission. Historical rows are not rewritten.

Technical-name mismatch:
NO

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Withdrawal Trustee Email Sent` / `Withdrawal Trustee Email Redelivered`

Preferred Admin Description:
`[Actor] sent the withdrawal trustee instruction email.`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `WITHDRAWAL_SUBMITTED_TO_TRUSTEE`

Status: LIVE

Module: Withdrawal / Disbursement / Trustee

Business action:
Withdrawal instruction marked submitted to the trustee.

Technical event:
`WITHDRAWAL_SUBMITTED_TO_TRUSTEE`

Canonical business name:
`Withdrawal Submitted to Trustee`

Actor:
Admin

Trigger:
`markWithdrawalSubmitted` — status transition to `SUBMITTED_TO_TRUSTEE` after any auto-send email attempt. Issuer platform notification fires after this audit write. Distinct from `WITHDRAWAL_TRUSTEE_EMAIL_SENT`.

Stored in:
`note_events`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Withdrawal Submitted to Trustee`
- Description: `withdrawalId`, `withdrawalReference`

Admin Detail
- Visible: YES
- Title: `Withdrawal Submitted to Trustee`
- Description: `withdrawalId`, `withdrawalReference`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Withdrawal Submitted to Trustee`
- Description/Remark: `withdrawalId`, `withdrawalReference`

Notification
- Sends: YES
- Type: `withdrawal_submitted_to_trustee`
- Title: `Withdrawal Submitted to Trustee`
- Message: `Withdrawal instruction [withdrawalReference] has been submitted to the trustee.`
- Recipient: `issuer owner + org members`
- Channel: `platform-only (sendTypedPlatformOnly)`

Direct Email Outside Notification Registry
- NO
- Purpose: Trustee operational email, if any, is `WITHDRAWAL_TRUSTEE_EMAIL_SENT` — a separate SES path, not this event.

### PLACEHOLDERS USED

[Note Ref]

### CONSISTENCY REVIEW

Classification:
STANDARDIZATION_RECOMMENDED

Notification is sent (issuer org, platform only) but the event is hidden from issuer activity. Message interpolates the withdrawal display reference (`withdrawalReference`); the internal `withdrawalId` remains in audit metadata and notification payload for linking.

These are three distinct products, not duplicates:
1. Trustee operational email — `WITHDRAWAL_TRUSTEE_EMAIL_SENT` (SES to trustee, auto-send or resend)
2. This event — withdrawal instruction status submitted to trustee
3. Issuer platform notification — `withdrawal_submitted_to_trustee` (issuer org, platform-only)

RESOLVED (2026-08-26): `REQUIRES_DATA_CHANGE` for the UUID-in-message is closed. The existing `display_reference` is now stored as `withdrawalReference` on new events and used in notification copy. Historical rows are not rewritten. Recommended actor-sentence / note-title wording below is still not implemented.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Withdrawal Submitted to Trustee`

Preferred Admin Description:
`[Actor] submitted withdrawal instruction [Payment Ref] to the trustee.`

Preferred User Description:
`A withdrawal instruction for [Note Title] has been submitted to the trustee.`

Preferred Notification Title:
`Withdrawal Submitted to Trustee`

Preferred Notification Message:
`A withdrawal instruction for [Note Title] has been submitted to the trustee.`

## `WITHDRAWAL_BENEFICIARY_UPDATED`

Status: LIVE

Module: Withdrawal / Disbursement / Trustee

Business action:
Beneficiary bank details edited on a draft instruction.

Technical event:
`WITHDRAWAL_BENEFICIARY_UPDATED`

Canonical business name:
`Withdrawal Beneficiary Updated`

Actor:
Admin

Trigger:
updateWithdrawalBeneficiary.

Stored in:
`note_events`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Withdrawal beneficiary updated`
- Description: `withdrawalId`

Admin Detail
- Visible: YES
- Title: `Withdrawal beneficiary updated`
- Description: `withdrawalId`

Issuer General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `Hidden (not queried)`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: NO
- Note: not in this surface's query allowlist
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Withdrawal beneficiary updated`
- Description/Remark: `withdrawalId`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

none in current user-facing copy

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Admin-only draft edit. CSV matches.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Withdrawal Beneficiary Updated`

Preferred Admin Description:
`[Actor] updated the withdrawal beneficiary.`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `WITHDRAWAL_COMPLETED`

Status: LIVE

Module: Withdrawal / Disbursement / Trustee

Business action:
Trustee payout completed. Portal copy and notification fire only for ISSUER_DISBURSEMENT.

Technical event:
`WITHDRAWAL_COMPLETED`

Canonical business name:
`Disbursement Completed`

Actor:
Admin

Trigger:
markWithdrawalCompleted. Portal/notification gated to ISSUER_DISBURSEMENT.

Stored in:
`note_events`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Withdrawal Completed`
- Description: `withdrawalId, [Amount]`

Admin Detail
- Visible: YES
- Title: `Withdrawal Completed`
- Description: `withdrawalId, [Amount]`

Issuer General Activity
- Visible: YES
- Title: `Your Disbursement Is Complete`
- Description: `Disbursement for [Note Ref] / [Note Title] has been completed.`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: YES
- Title: `Your Investment Is Active`
- Description: `[Note Ref] / [Note Title] is now active and servicing has started.`

CSV / Export
- Included: YES
- Title/Event: `Withdrawal Completed`
- Description/Remark: `amount`

Notification
- Sends: YES
- Type: `withdrawal_completed` (issuer) + `note_active_investor` (confirmed investors)
- Title: `Your Disbursement Is Complete [withdrawal_completed] | Your Investment Is Active [note_active_investor]`
- Message: `The disbursement for note [Note Title] has been completed. [withdrawal_completed] | Funding for "[Note Title]" is complete and the note is now active. Servicing has started. [note_active_investor]`
- Recipient: `issuer org members` (`withdrawal_completed`); `confirmed investors on the note` (`note_active_investor`)
- Channel: `platform only`

Does not write `ACTIVATE` and does not send `note_active_issuer`. Issuer Activity/notification stay disbursement-complete copy. Investor Activity/notification use investment-active copy for the same `WITHDRAWAL_COMPLETED` row.

Investor cash withdrawals (`withdrawal_type: INVESTOR_WITHDRAWAL`, `note_id` null) do not write this event. They send separate platform-only types `investor_withdrawal_submitted` / `investor_withdrawal_completed` to the requesting investor. Residual/admin-adjustment stay silent.

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Note Ref], [Note Title], [Amount]

### CONSISTENCY REVIEW

Classification:
STANDARDIZATION_RECOMMENDED

Admin/CSV keep Withdrawal completed. Issuer portal and `withdrawal_completed` use disbursement-complete copy. Investor Activity and `note_active_investor` use investment-active copy for the same ISSUER_DISBURSEMENT completion. Residual/admin withdrawals stay silent on both portals. Investor cash withdrawals are notified via `investor_withdrawal_*` types, not this event.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Disbursement Completed`

Preferred Admin Description:
`[Actor] completed disbursement of [Amount] for [Note Title].`

Preferred User Description:
`Disbursement for [Note Title] has been completed.`

Preferred Notification Title:
`Disbursement Completed`

Preferred Notification Message:
`The disbursement for note [Note Title] has been completed.`

# Investor Deposit / Gateway / Refund

## `NAME_CHECK`

Status: LIVE

Module: Investor Deposit / Gateway / Refund

Business action:
Automatic payer name-check flagged the deposit for admin review.

Technical event:
`NAME_CHECK`

Canonical business name:
`Name Check Needed`

Actor:
System

Trigger:
deposit-service transitionToNameCheckPending.

Stored in:
`gateway_payment_events`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Name check needed`
- Description: `Payment received, but the bank name could not be matched to the investor profile. Waiting for review.`

Admin Detail
- Visible: YES
- Title: `Name check needed`
- Description: `Payment received, but the bank name could not be matched to the investor profile. Waiting for review. (reason column may override)`

Issuer General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: N/A
- Note: no such surface for this domain
- Title/Event: `—`
- Description/Remark: `N/A — no gateway_payment_events export`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Reason]

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Admin-forensic only. Title and description are curated.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Name Check Needed`

Preferred Admin Description:
`Payer name check needs review.`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `NAME_CHECK_APPROVED`

Status: LIVE

Module: Investor Deposit / Gateway / Refund

Business action:
Admin approved the payer name match.

Technical event:
`NAME_CHECK_APPROVED`

Canonical business name:
`Name Check Approved`

Actor:
Admin

Trigger:
Admin approveNameCheck.

Stored in:
`gateway_payment_events`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Name check approved`
- Description: `The names were confirmed to match. The deposit was completed.`

Admin Detail
- Visible: YES
- Title: `Name check approved`
- Description: `The names were confirmed to match. The deposit was completed.`

Issuer General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: N/A
- Note: no such surface for this domain
- Title/Event: `—`
- Description/Remark: `N/A — no export`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

none in current user-facing copy

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Admin-forensic only. No investor notification on approval.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Name Check Approved`

Preferred Admin Description:
`[Actor] approved the deposit name check.`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `NAME_CHECK_REJECTED`

Status: LIVE

Module: Investor Deposit / Gateway / Refund

Business action:
Admin rejected the payer name match, triggering a refund. Notification only for INVESTOR_DEPOSIT.

Technical event:
`NAME_CHECK_REJECTED`

Canonical business name:
`Name Check Rejected`

Actor:
Admin

Trigger:
Admin rejectNameCheck.

Stored in:
`gateway_payment_events`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Name Check Rejected`
- Description: `The names did not match. A refund was started.`

Admin Detail
- Visible: YES
- Title: `Name Check Rejected`
- Description: `The names did not match. A refund was started.`

Issuer General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: N/A
- Note: no such surface for this domain
- Title/Event: `—`
- Description/Remark: `N/A — no export`

Notification
- Sends: YES
- Type: `deposit_name_check_rejected`
- Title: `Deposit Verification Failed`
- Message: `Your deposit could not be verified and will be returned.`
- Recipient: `deposit investor-org members`
- Channel: `platform only`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Amount]

### CONSISTENCY REVIEW

Classification:
STANDARDIZATION_RECOMMENDED

Admin title is Name check rejected. Investor notification title is Deposit Verification Failed. Amount is on the payment payload but the current template ignores it. Matrix §2.7 leftover still says gateway notifications NO — source sends deposit_name_check_rejected.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Name Check Rejected`

Preferred Admin Description:
`[Actor] rejected the deposit name check. A refund was started.`

Preferred User Description:
`Your deposit could not be verified and will be returned.`

Preferred Notification Title:
`Deposit Verification Failed`

Preferred Notification Message:
`Your deposit could not be verified and will be returned.`

## `CAPTURE_MISMATCH`

Status: LIVE

Module: Investor Deposit / Gateway / Refund

Business action:
Currency or amount mismatch detected on capture.

Technical event:
`CAPTURE_MISMATCH`

Canonical business name:
`Payment Mismatch Found`

Actor:
System / Admin

Trigger:
webhook-service / amount-mismatch-service.

Stored in:
`gateway_payment_events`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Payment mismatch found`
- Description: `The payment details did not match what Cashsouk expected. (specialised currency vs amount copy when reason matches)`

Admin Detail
- Visible: YES
- Title: `Payment mismatch found`
- Description: `Specialised: currency mismatch vs amount mismatch; else stored reason`

Issuer General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: N/A
- Note: no such surface for this domain
- Title/Event: `—`
- Description/Remark: `N/A — no export`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Amount]

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Admin-forensic with specialised reason copy. No notification.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Payment Mismatch Found`

Preferred Admin Description:
`A payment mismatch was found.`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `EXPIRED`

Status: LIVE

Module: Investor Deposit / Gateway / Refund

Business action:
Cron expires an abandoned CREATED checkout.

Technical event:
`EXPIRED`

Canonical business name:
`Payment Expired`

Actor:
System

Trigger:
gateway-stuck-order-poller.

Stored in:
`gateway_payment_events`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Payment expired`
- Description: `The payment link timed out before payment was finished.`

Admin Detail
- Visible: YES
- Title: `Payment expired`
- Description: `The payment link timed out before payment was finished. (reason may name the abandoned-checkout window)`

Issuer General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: N/A
- Note: no such surface for this domain
- Title/Event: `—`
- Description/Remark: `N/A — no export`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

none in current user-facing copy

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Admin-forensic only. Title is unambiguous.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Payment Expired`

Preferred Admin Description:
`The checkout expired before capture.`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `REFUND_INITIATED`

Status: LIVE

Module: Investor Deposit / Gateway / Refund

Business action:
Refund started, manually or automatically. Notification only for INVESTOR_DEPOSIT.

Technical event:
`REFUND_INITIATED`

Canonical business name:
`Refund Started`

Actor:
Admin / System

Trigger:
refund-service (manual or automatic paths).

Stored in:
`gateway_payment_events`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Refund Started`
- Description: `A full refund was requested. Waiting for Curlec to confirm the result.`

Admin Detail
- Visible: YES
- Title: `Refund Started`
- Description: `A full refund was requested. Waiting for Curlec to confirm the result.`

Issuer General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: N/A
- Note: no such surface for this domain
- Title/Event: `—`
- Description/Remark: `N/A — no export`

Notification
- Sends: YES
- Type: `deposit_refund_initiated`
- Title: `Refund Started`
- Message: `A refund for your deposit of RM[Amount] has been initiated.`
- Recipient: `deposit investor-org members`
- Channel: `platform only`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Amount]

### CONSISTENCY REVIEW

Classification:
STANDARDIZATION_RECOMMENDED

Admin title is Refund requested; notification title is Refund Started. Matrix §2.7 leftover still says no gateway notifications.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Refund Started`

Preferred Admin Description:
`A refund of [Amount] was started.`

Preferred User Description:
`A refund for your deposit of RM[Amount] has been initiated.`

Preferred Notification Title:
`Refund Started`

Preferred Notification Message:
`A refund for your deposit of RM[Amount] has been initiated.`

## `REFUNDED`

Status: LIVE

Module: Investor Deposit / Gateway / Refund

Business action:
Curlec refund confirmed and wallet reversal complete. Notification only for INVESTOR_DEPOSIT.

Technical event:
`REFUNDED`

Canonical business name:
`Refund Completed`

Actor:
Admin / System

Trigger:
refund-service after wallet reversal commits.

Stored in:
`gateway_payment_events`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Refund completed`
- Description: `The refund was confirmed. Money was returned to the payer.`

Admin Detail
- Visible: YES
- Title: `Refund completed`
- Description: `The refund was confirmed. Money was returned to the payer.`

Issuer General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: N/A
- Note: no such surface for this domain
- Title/Event: `—`
- Description/Remark: `N/A — no export`

Notification
- Sends: YES
- Type: `deposit_refunded`
- Title: `Refund Completed`
- Message: `Your refund of RM[Amount] has been completed.`
- Recipient: `deposit investor-org members`
- Channel: `platform only`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Amount]

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Admin title Refund completed matches notification Refund Completed aside from case.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Refund Completed`

Preferred Admin Description:
`Refund of [Amount] was completed.`

Preferred User Description:
`Your refund of RM[Amount] has been completed.`

Preferred Notification Title:
`Refund Completed`

Preferred Notification Message:
`Your refund of RM[Amount] has been completed.`

## `REFUND_WALLET_REVERSAL_FAILED`

Status: LIVE

Module: Investor Deposit / Gateway / Refund

Business action:
Wallet debit failed after a refund was issued.

Technical event:
`REFUND_WALLET_REVERSAL_FAILED`

Canonical business name:
`Wallet Balance Could Not Be Updated`

Actor:
System / Admin

Trigger:
refund-service wallet reversal failure paths.

Stored in:
`gateway_payment_events`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Wallet balance could not be updated`
- Description: `The refund was completed, but the wallet balance could not be fully updated. Part of the amount may still need attention.`

Admin Detail
- Visible: YES
- Title: `Wallet balance could not be updated`
- Description: `The refund was completed, but the wallet balance could not be fully updated. Part of the amount may still need attention.`

Issuer General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: N/A
- Note: no such surface for this domain
- Title/Event: `—`
- Description/Remark: `N/A — no export`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Amount]

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Admin-forensic operational failure. No user notification.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Wallet Balance Could Not Be Updated`

Preferred Admin Description:
`Wallet reversal failed after refund.`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

# Products

## `PRODUCT_CREATED`

Status: LIVE

Module: Products

Business action:
Admin created a product.

Technical event:
`PRODUCT_CREATED`

Canonical business name:
`Product Created`

Actor:
Admin

Trigger:
products repository created.

Stored in:
`product_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Created`
- Description: `workflow snapshot in metadata (no remark column)`

Admin Detail
- Visible: YES
- Title: `Created`
- Description: `workflow snapshot in metadata`

Issuer General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Created`
- Description/Remark: `workflow snapshot`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

none in current user-facing copy

### CONSISTENCY REVIEW

Classification:
INTENTIONALLY_DIFFERENT

Admin/CSV use a short verb on a forensic-only surface. Canonical human wording can still be Product Created/Updated/Deleted.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Product Created`

Preferred Admin Description:
`[Actor] created a product.`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `PRODUCT_UPDATED`

Status: LIVE

Module: Products

Business action:
Admin edited a product, in place or by creating a new version.

Technical event:
`PRODUCT_UPDATED`

Canonical business name:
`Product Updated`

Actor:
Admin

Trigger:
products repository updated.

Stored in:
`product_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Updated`
- Description: `workflow snapshot in metadata (no remark column)`

Admin Detail
- Visible: YES
- Title: `Updated`
- Description: `workflow snapshot in metadata`

Issuer General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Updated`
- Description/Remark: `workflow snapshot`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

none in current user-facing copy

### CONSISTENCY REVIEW

Classification:
INTENTIONALLY_DIFFERENT

Admin/CSV use a short verb on a forensic-only surface. Canonical human wording can still be Product Created/Updated/Deleted.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Product Updated`

Preferred Admin Description:
`[Actor] updated a product.`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `PRODUCT_DELETED`

Status: LIVE

Module: Products

Business action:
Admin soft-deleted a product.

Technical event:
`PRODUCT_DELETED`

Canonical business name:
`Product Deleted`

Actor:
Admin

Trigger:
products repository deleted.

Stored in:
`product_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Deleted`
- Description: `workflow snapshot in metadata (no remark column)`

Admin Detail
- Visible: YES
- Title: `Deleted`
- Description: `workflow snapshot in metadata`

Issuer General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Deleted`
- Description/Remark: `workflow snapshot`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

none in current user-facing copy

### CONSISTENCY REVIEW

Classification:
INTENTIONALLY_DIFFERENT

Admin/CSV use a short verb on a forensic-only surface. Canonical human wording can still be Product Created/Updated/Deleted.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Product Deleted`

Preferred Admin Description:
`[Actor] deleted a product.`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

# Access

## `LOGIN`

Status: LIVE

Module: Access

Business action:
User signed in (successful OAuth/sync-user). Failed admin-portal login also writes LOGIN with success:false.

Technical event:
`LOGIN`

Canonical business name:
`Login`

Actor:
User

Trigger:
OAuth callback, POST sync-user, or failed admin login.

Stored in:
`access_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Login`
- Description: `success / portal / device_type in the row; no narrative description`

Admin Detail
- Visible: YES
- Title: `Login`
- Description: `success, requestedRole / activeRole / roles; failure adds reason`

Issuer General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Login`
- Description/Remark: `raw export — no friendly label`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

none in current user-facing copy

### CONSISTENCY REVIEW

Classification:
STANDARDIZATION_RECOMMENDED

Admin UI says Login; CSV writes LOGIN. login_new_device exists in the registry but is not sent.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Login`

Preferred Admin Description:
`[Actor] signed in.`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `LOGOUT`

Status: LIVE

Module: Access

Business action:
User signed out.

Technical event:
`LOGOUT`

Canonical business name:
`Logout`

Actor:
User

Trigger:
Logout route / logout service.

Stored in:
`access_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Logout`
- Description: `—`

Admin Detail
- Visible: YES
- Title: `Logout`
- Description: `roles / activeRole in metadata`

Issuer General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Logout`
- Description/Remark: `raw export`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

none in current user-facing copy

### CONSISTENCY REVIEW

Classification:
STANDARDIZATION_RECOMMENDED

Admin UI says Logout; CSV writes LOGOUT.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Logout`

Preferred Admin Description:
`[Actor] signed out.`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `SIGNUP`

Status: LIVE

Module: Access

Business action:
First OAuth signup. A LOGIN row is also written for the same moment.

Technical event:
`SIGNUP`

Canonical business name:
`Sign Up`

Actor:
User

Trigger:
OAuth callback with isSignup.

Stored in:
`access_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Sign Up`
- Description: `—`

Admin Detail
- Visible: YES
- Title: `Sign Up`
- Description: `requestedRole / activeRole / roles`

Issuer General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Sign Up`
- Description/Remark: `raw export`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

none in current user-facing copy

### CONSISTENCY REVIEW

Classification:
STANDARDIZATION_RECOMMENDED

Admin UI says Sign Up; CSV writes SIGNUP. Distinct from ONBOARDING_STARTED.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Sign Up`

Preferred Admin Description:
`[Actor] signed up.`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `access_logs.PROFILE_UPDATED`

Status: LIVE

Module: Access

Business action:
Admin edited a user's name/phone from user detail / org member edit.

Technical event:
`PROFILE_UPDATED`

Canonical business name:
`User Profile Updated`

Actor:
Admin

Trigger:
Admin PATCH /v1/admin/users/:id/profile.

Stored in:
`access_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `User Profile Updated`
- Description: `updatedFields / previousValues`

Admin Detail
- Visible: YES
- Title: `User Profile Updated`
- Description: `updatedFields / previousValues / nameLockedOverride`

Issuer General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `User Profile Updated`
- Description/Remark: `raw export`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

none in current user-facing copy

### CONSISTENCY REVIEW

Classification:
LEGACY_NAMING_TRAP

Same string PROFILE_UPDATED on three tables (access user edit, security self-service, onboarding org profile).

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`User Profile Updated`

Preferred Admin Description:
`[Actor] updated a user's profile ([fields]).`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

# Security

## `ROLE_ADDED`

Status: LIVE

Module: Security

Business action:
User self-added a portal role, or an admin invitation was accepted.

Technical event:
`ROLE_ADDED`

Canonical business name:
`Role Added`

Actor:
User / Invitee

Trigger:
auth addRole, or acceptAdminInvitation.

Stored in:
`security_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Role Added`
- Description: `addedRole / allRoles (or invitation metadata)`

Admin Detail
- Visible: YES
- Title: `Role Added`
- Description: `addedRole / allRoles (or invitation metadata)`

Issuer General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Role Added`
- Description/Remark: `raw export`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

none in current user-facing copy

### CONSISTENCY REVIEW

Classification:
STANDARDIZATION_RECOMMENDED

Admin UI sentence case vs CSV raw. Distinct from unreachable access_logs.ROLE_ADDED.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Role Added`

Preferred Admin Description:
`[Actor] added role [role].`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `ROLE_SWITCHED`

Status: LIVE

Module: Security

Business action:
Active role switch, or admin account activate/deactivate (overloaded onto this event).

Technical event:
`ROLE_SWITCHED`

Canonical business name:
`Role Switched`

Actor:
User / Subject admin

Trigger:
auth switchRole, or admin activate/deactivate/updateAdminRole.

Stored in:
`security_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Role Switched`
- Description: `newRole, or action / previousStatus / newStatus`

Admin Detail
- Visible: YES
- Title: `Role Switched`
- Description: `newRole, or action / previousStatus / newStatus`

Issuer General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Role Switched`
- Description/Remark: `raw export`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

[Old Status], [New Status]

### CONSISTENCY REVIEW

Classification:
STANDARDIZATION_RECOMMENDED

One event covers both an active-role switch and admin activate/deactivate. CSV is raw.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Role Switched`

Preferred Admin Description:
`[Actor] switched role, or an admin account status changed.`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `security_logs.PROFILE_UPDATED`

Status: LIVE

Module: Security

Business action:
Self-service profile edit, or admin override of an onboarded name (subject-actored).

Technical event:
`PROFILE_UPDATED`

Canonical business name:
`Profile Updated`

Actor:
User

Trigger:
auth updateProfile, or admin updateUserProfile (security_logs path).

Stored in:
`security_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Profile Updated`
- Description: `updatedFields / previousValues (adminOverride when applicable)`

Admin Detail
- Visible: YES
- Title: `Profile Updated`
- Description: `updatedFields / previousValues`

Issuer General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Profile Updated`
- Description/Remark: `raw export`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

none in current user-facing copy

### CONSISTENCY REVIEW

Classification:
LEGACY_NAMING_TRAP

Collides with access_logs and onboarding_logs PROFILE_UPDATED. Admin filter uses sentence case Profile updated.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Profile Updated`

Preferred Admin Description:
`[Actor] updated profile fields ([fields]).`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `PASSWORD_CHANGED`

Status: LIVE

Module: Security

Business action:
Password change attempt (success and failure). Notification fires only on success.

Technical event:
`PASSWORD_CHANGED`

Canonical business name:
`Password Changed`

Actor:
User

Trigger:
auth changePassword (success and failure writers).

Stored in:
`security_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Password changed`
- Description: `success path: USER_INITIATED / sessionRevoked; failure: success:false / error`

Admin Detail
- Visible: YES
- Title: `Password changed`
- Description: `success path: USER_INITIATED / sessionRevoked; failure: success:false / error`

Issuer General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `PASSWORD_CHANGED (raw event_type)`
- Description/Remark: `raw export`

Notification
- Sends: YES
- Type: `password_changed`
- Title: `Password Changed`
- Message: `The password for your account was changed on [date].`
- Recipient: `the user`
- Channel: `platform + email`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

none in current user-facing copy

### CONSISTENCY REVIEW

Classification:
CONSISTENT

UI title and notification title already match. CSV is raw. Failed attempts are logged but not notified.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Password Changed`

Preferred Admin Description:
`[Actor] changed their password.`

Preferred User Description:
`The password for your account was changed on [date].`

Preferred Notification Title:
`Password Changed`

Preferred Notification Message:
`The password for your account was changed on [date].`

## `EMAIL_CHANGED`

Status: LIVE

Module: Security

Business action:
Email verification result — not an email-address change.

Technical event:
`EMAIL_CHANGED`

Canonical business name:
`Email Verified`

Actor:
User

Trigger:
auth verifyEmail (success and failure).

Stored in:
`security_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Email Verified`
- Description: `success: email / EMAIL_VERIFIED; failure: VERIFICATION_FAILED`

Admin Detail
- Visible: YES
- Title: `Email Verified`
- Description: `success: email / EMAIL_VERIFIED; failure: VERIFICATION_FAILED`

Issuer General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `Email Verified`
- Description/Remark: `raw export`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

none in current user-facing copy

### CONSISTENCY REVIEW

Classification:
LEGACY_NAMING_TRAP

The stored event and admin label say Email changed; the action is email verification.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Email Verified`

Preferred Admin Description:
`[Actor] verified their email.`

Preferred User Description:
`Your email address was verified.`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `ROLE_CREATED`

Status: LIVE

Module: Security

Business action:
Admin created a role catalogue entry.

Technical event:
`ROLE_CREATED`

Canonical business name:
`Role Created`

Actor:
Admin

Trigger:
createAdminRole.

Stored in:
`security_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `—`
- Description: `Hidden (not queried) — outside SECURITY_EVENT_TYPES filter`

Admin Detail
- Visible: YES
- Title: `—`
- Description: `Hidden (not queried)`

Issuer General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `—`
- Description/Remark: `Excluded (same filter)`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

none in current user-facing copy

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Written but not shown on the current security-logs panel.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Role Created`

Preferred Admin Description:
`[Actor] created role catalogue entry [role].`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `ROLE_REMOVED`

Status: LIVE

Module: Security

Business action:
Admin deleted a role catalogue entry — not a user losing a role.

Technical event:
`ROLE_REMOVED`

Canonical business name:
`Role Catalogue Entry Deleted`

Actor:
Admin

Trigger:
deleteAdminRole.

Stored in:
`security_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `—`
- Description: `Hidden (not queried)`

Admin Detail
- Visible: YES
- Title: `—`
- Description: `Hidden (not queried)`

Issuer General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `—`
- Description/Remark: `Excluded`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

none in current user-facing copy

### CONSISTENCY REVIEW

Classification:
LEGACY_NAMING_TRAP

Same string ROLE_REMOVED as the unreachable access_logs event that strips ADMIN from a user. This live event deletes a catalogue entry.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Role Catalogue Entry Deleted`

Preferred Admin Description:
`[Actor] deleted role catalogue entry [role].`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `ROLE_PERMISSIONS_UPDATED`

Status: LIVE

Module: Security

Business action:
Admin edited role permissions.

Technical event:
`ROLE_PERMISSIONS_UPDATED`

Canonical business name:
`Role Permissions Updated`

Actor:
Admin

Trigger:
updateAdminRolePermissions.

Stored in:
`security_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `—`
- Description: `Hidden (not queried)`

Admin Detail
- Visible: YES
- Title: `—`
- Description: `Hidden (not queried)`

Issuer General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `—`
- Description/Remark: `Excluded`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

none in current user-facing copy

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Written but not shown on the current security-logs panel.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Role Permissions Updated`

Preferred Admin Description:
`[Actor] updated permissions for role [role].`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `PLATFORM_FINANCE_SETTINGS_UPDATED`

Status: LIVE

Module: Security

Business action:
Admin updated platform finance settings. Append-only before/after snapshot; no new table.

Technical event:
`PLATFORM_FINANCE_SETTINGS_UPDATED`

Canonical business name:
`Platform Finance Settings Updated`

Actor:
Admin

Trigger:
updatePlatformFinanceSettings.

Stored in:
`security_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `Platform Finance Settings Updated`
- Description: `previousValues / nextValues (account numbers and trustee emails kept; auth secrets redacted)`

Admin Detail
- Visible: YES
- Title: `Platform Finance Settings Updated`
- Description: `previousValues / nextValues (account numbers and trustee emails kept; auth secrets redacted)`

Issuer General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `PLATFORM_FINANCE_SETTINGS_UPDATED`
- Description/Remark: `previousValues / nextValues`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

none in current user-facing copy

### CONSISTENCY REVIEW

Classification:
CONSISTENT

One `security_logs` row per Admin save. Operational config (account numbers, trustee emails, letter settings) is stored in full. Only authentication secrets (password, API secret, access token, private key) are redacted if present. Settings write itself is unchanged.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Platform Finance Settings Updated`

Preferred Admin Description:
`[Actor] updated platform finance settings.`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

## `INVITATION_REVOKED`

Status: LIVE

Module: Security

Business action:
Admin revoked a pending invitation.

Technical event:
`INVITATION_REVOKED`

Canonical business name:
`Invitation Revoked`

Actor:
Admin

Trigger:
revokeInvitation.

Stored in:
`security_logs`

### CURRENT USER-FACING COPY

Admin Activity
- Visible: YES
- Title: `—`
- Description: `Hidden (not queried)`

Admin Detail
- Visible: YES
- Title: `—`
- Description: `Hidden (not queried)`

Issuer General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Application Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Issuer Facility / Transaction Detail
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `N/A`

Investor General Activity
- Visible: N/A
- Note: no such surface for this domain
- Title: `—`
- Description: `—`

CSV / Export
- Included: YES
- Title/Event: `—`
- Description/Remark: `Excluded`

Notification
- Sends: NO
- Type: `—`
- Title: `—`
- Message: `—`
- Recipient: `—`
- Channel: `—`

Direct Email Outside Notification Registry
- NO
- Purpose: `—`

### PLACEHOLDERS USED

none in current user-facing copy

### CONSISTENCY REVIEW

Classification:
CONSISTENT

Written but not shown on the current security-logs panel.

### RECOMMENDED CANONICAL PRESENTATION

This is a recommendation only.
DO NOT implement.

Preferred Title:
`Invitation Revoked`

Preferred Admin Description:
`[Actor] revoked invitation for [email].`

Preferred User Description:
`—`

Preferred Notification Title:
`—`

Preferred Notification Message:
`—`

# Appendix — not live

Do not mix these into the live journal.

### DEAD (12)

| Technical event | Store | Canonical / note |
|---|---|---|
| `ROLE_SWITCHED` | `access_logs` | — |
| `ONBOARDING` | `access_logs` | — |
| `USER_COMPLETED` | `access_logs` | — |
| `ONBOARDING_STATUS_UPDATED` | `access_logs` | — |
| `PASSWORD_CHANGED` | `access_logs` | — |
| `EMAIL_CHANGED` | `access_logs` | — |
| `KYB_APPROVED` | `onboarding_logs` | — |
| `APPLICATION_APPROVED` | `application_logs` | — |
| `CONTRACT_OFFER_REJECTED` | `application_logs` | — |
| `OVERRIDE_PROPOSED` | `gateway_payment_events` | — |
| `OVERRIDE_APPROVED` | `gateway_payment_events` | — |
| `OVERRIDE_REJECTED` | `gateway_payment_events` | — |

### SEED_ONLY (3)

| Technical event | Store | Canonical / note |
|---|---|---|
| `KYC_STATUS_UPDATED` | `access_logs` | — |
| `TNC_ACCEPTED` | `onboarding_logs` | — |
| `KYC_APPROVED` | `onboarding_logs` | — |

### DEV_ONLY (1)

| Technical event | Store | Canonical / note |
|---|---|---|
| `USER_COMPLETED` | `onboarding_logs (dev database)` | Dev-mode webhook onboarding completion |

### UNREACHABLE (7)

| Technical event | Store | Canonical / note |
|---|---|---|
| `ROLE_ADDED` | `access_logs` | Fallback branch of updateUserRoles for any outcome that doesn't strip ADMIN (not literally "a role was added") |
| `ROLE_REMOVED` | `access_logs` | ADMIN role specifically stripped from a user (not "any role removed") |
| `ONBOARDING_RESET` | `access_logs` | Route-only "temporary feature for testing" that would clear the onboarded flag |
| `ONBOARDING_RESET` | `onboarding_logs` | Admin cleared the onboarded flag |
| `AML_APPROVED` | `onboarding_logs` | Would be a manual admin AML approval/override |
| `PRODUCT_INACTIVATED` | `product_logs` | Would mark a product inactive |
| `PRODUCT_REACTIVATED` | `product_logs` | Would restore an inactive product |

### REMOVED_FROM_SOURCE (1)

| Technical event | Store | Canonical / note |
|---|---|---|
| `ISSUER_RESIDUAL_WITHDRAWAL_CREATED` | `note_events` | — |

### HISTORICAL_COMPATIBILITY_ONLY / display aliases

These are **not** live writers. They still appear in some label maps.

| Alias / leftover | Kind | Current meaning |
|---|---|---|
| `APPLICATION_APPROVED` | DEAD writer; synthetic issuer UI alias still ACTIVE | Issuer general-activity / application-detail / facility-detail still have labels (`Application Approved` / `Application approved` / `Facility application approved`). Notification `application_approved` is DEAD_NOT_CONFIGURABLE. |
| `CONTRACT_OFFER_REJECTED` | HISTORICAL_COMPATIBILITY_ONLY | Live facility decline is `CONTRACT_WITHDRAWN`. Label maps still exist (`Facility Offer Withdrawn` / `Facility Offer Declined` / `You declined the facility offer`). |
| `OFFER_EXPIRED` | NOT_AN_ACTUAL_EVENT | Appears in issuer application-detail and facility-detail label maps as `An offer expired`. Not an `ApplicationLogEventType`. |
| `USER_LOGGED_IN` / `USER_LOGGED_OUT` / `USER_SIGNED_UP` | not real | Unmerged cutover-schema names. Live events are `LOGIN` / `LOGOUT` / `SIGNUP`. |
| `onboarding_approved` notification type | naming trap | Fired by `FINAL_APPROVAL_COMPLETED`, not by `ONBOARDING_APPROVED`. |
| `KYC_APPROVED` as a standalone event | not a production writer | Live path is `ONBOARDING_STATUS_UPDATED` with `metadata.trigger:"KYC_APPROVED"`. Seed-only `onboarding_logs.KYC_APPROVED` is not live. |

### Dead / bulk-only notifications (not audit events)

Registry: **51**. Live automatic: **45**. Dead: **4**. Bulk-only: **2**.

| Type id | Status | Notes |
|---|---|---|
| `login_new_device` | DEAD_NOT_CONFIGURABLE | Template exists; no device-fingerprinting sender. |
| `kyc_approved` | DEAD_NOT_CONFIGURABLE | No live KYC_APPROVED audit event. |
| `kyc_rejected` | DEAD_NOT_CONFIGURABLE | No live KYC_REJECTED audit event. |
| `application_approved` | DEAD_NOT_CONFIGURABLE | `APPLICATION_APPROVED` writer is dead. |
| `system_announcement` | bulk-only | Admin broadcast (`sendBulkNotification`). Not tied to an audit event. |
| `new_product_alert` | bulk-only | Admin broadcast. Template title `New Investment Opportunity`. |
| `director_shareholder_action_required` | live automatic | Not mapped from a journaled audit event in this pass (CTOS director/shareholder action). |
| `investor_director_shareholder_action_required` | live automatic | Investor counterpart of the above. |
| `acceptance_document_changes_requested` | live automatic | Fired on first acceptance-document change request; not a dedicated audit event type. |
| `offer_expiry_reminder_24h` | live automatic | Reminder job; not a dedicated audit event type. |
| `investor_withdrawal_submitted` | live automatic | Investor cash withdrawal created/debited. No `note_events` row (`note_id` is null). |
| `investor_withdrawal_completed` | live automatic | Investor cash withdrawal marked COMPLETED. Not `withdrawal_completed` (issuer disbursement). |

## Admin notification / broadcast

`system_announcement` and `new_product_alert` are bulk admin broadcasts. They are not audit-log events and have no row in this live journal.
