# Audit Log Register

**As of:** 1 September 2026  
**Scope:** Named events the **current live platform can still produce**. Historical, deprecated, dead, and unreachable names are excluded.  
**Method:** Traced from Admin / Issuer / Investor UI → API → service → Prisma / jobs / webhooks.

This is the Operations Audit Log Register. Each active event appears **once**, grouped by module — not by issuer/investor journey.

Help (Admin Operations Guide) stays journey-oriented. This register is the unique-event inventory.

Do not treat `apps/api/src/lib/audit/visibility-matrix.ts` or `docs/logging-event-catalogue.md` as this register. The catalogue includes historical readers and a few LIVE names with no production writer (`ACCOUNT_LOCKED`, gateway `CREATED` / `COMPLETED` / `FAILED`). Those are excluded here. Extra live writers missing from the catalogue are included.

**Acronyms in this register follow this codebase, not general English:**

| Code | Meaning in this platform |
| --- | --- |
| EOD | Entity Onboarding Data (RegTank director/shareholder onboarding; `/eodliveness`) |
| COD | Company Onboarding Data (RegTank corporate onboarding; `/codliveness`) |
| SSM | Admin “SSM Verification” step (`ssm_approved` / `ssm_checked`). Not expanded here. |
| AML | Admin “AML” screening step (`aml_approved`). Not expanded here. |
| MARC | Issuer MARC credit assessment saved on the organisation. |

---

## How to read

| Field | Meaning |
| --- | --- |
| Event ID | Stable inventory id |
| Module | Business / system area |
| Event / Activity | Operations name shown in Admin (past tense, object included) |
| System Event Code | Stored backend code. Not renamed |
| Description | What happened |
| Trigger / Condition | What causes the write |
| Actor | Customer, Admin, System, Gateway, Webhook |
| Affected Record | Entity the event is about |
| Recorded Data | Important stored values |
| Record Source | Prisma table / store |
| Admin Location | Where Operations can see it today |
| Customer Visible | Yes = issuer or investor Activity feed |
| Notes | Visibility class, overlaps, caveats |

**Admin location wording** uses: Issuer record - Activity, Investor record - Activity, Application record - Activity Timeline, Application record - Acceptance, Facility record - Activity, Note record - Activity, Note record - Late Payment, Finance - Payments - Gateway Payments, Finance - Reconciliation, Finance - Investor Withdrawals, Audit - Access / Security / Products / Legal Documents / Legal Acceptances / External Acceptances / Notifications.

**Source labels** on rows: Portal / Webhook / System job / Internal process.

**Customer Activity** only shows a subset of milestones. Admin timelines show a wider set.

**There is no single cross-platform Audit table.** Operations still open the record that owns the event. Opening a row (where a drawer exists) shows the system event code, metadata, actor, source, and related ids.

---

## Where Operations looks today

| Admin surface | Reads | Typical use |
| --- | --- | --- |
| Application record - Activity Timeline | `application_logs` | Application, offer, signing, facility occupancy |
| Facility record - Activity / Facility & Offer | `application_logs` (facility-scoped) | Facility offer and occupancy |
| Issuer / Investor record - Activity | `onboarding_logs` (not forensic `WEBHOOK_*` / `EOD_WEBHOOK`) | Onboarding and membership |
| Application record - Acceptance | Envelope + recipient, including Viewed | Signing status; Viewed is not an Activity event |
| Note record - Activity | `note_events` | Note lifecycle, servicing, trustee |
| Note record - Late Payment / Ledger | Note state + `note_ledger_entries` | Arrears / money on the Note |
| Finance - Payments - Gateway Payments | `gateway_payments` + `gateway_payment_events` | Payment proof |
| Finance - Reconciliation | `gateway_recon_runs` / `gateway_recon_exceptions` | Settlement match |
| Finance - Investor Withdrawals | Wallet / withdrawal screens | Investor cash movement |
| Audit - Access / Security / Products / Legal Documents / Legal Acceptances / External Acceptances / Notifications | Matching audit tables | Cross-cutting records |

---

## Active event register

### 1. Onboarding

| Event ID | Event / Activity | System Event Code | Description | Trigger / Condition | Actor | Affected Record | Recorded Data | Record Source | Admin Location | Customer Visible | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LOG-ONB-001 | Onboarding Started | `ONBOARDING_STARTED` | Issuer or investor onboarding began | User starts onboarding | Customer | User / organisation | Portal, org ids | `onboarding_logs` | Issuer record - Activity or Investor record - Activity | Yes | Operations activity |
| LOG-ONB-002 | Onboarding Fee Paid | `ONBOARDING_FEE_PAID` | Issuer registration fee captured | Gateway capture of onboarding fee | Gateway | Organisation | Payment refs | `onboarding_logs` | Issuer record - Activity. Finance - Payments - Gateway Payments | Yes | Also gateway payment. Use Gateway Payments as payment proof |
| LOG-ONB-003 | Onboarding Resumed | `ONBOARDING_RESUMED` | Onboarding continued after an interruption | User or provider resume | Customer / Webhook | User / organisation | Request id | `onboarding_logs` | Issuer record - Activity or Investor record - Activity | No | — |
| LOG-ONB-004 | Onboarding Status Updated | `ONBOARDING_STATUS_UPDATED` | Provider or Admin status change that is not a dedicated milestone | Webhook or Admin refresh | Webhook / Admin | Organisation | trigger, status, substatus | `onboarding_logs` | Issuer record - Activity or Investor record - Activity | No | Open detail for trigger. Can pair with Form Submitted. Provider AML clearance also uses this code (`AML_APPROVED` has no live Admin caller) |
| LOG-ONB-005 | Additional Information Required | `ONBOARDING_AMENDMENT_REQUIRED` | More onboarding information is required | Corporate onboarding amendment path | Webhook | Organisation | Request refs | `onboarding_logs` | Issuer record - Activity or Investor record - Activity | Yes | Director/shareholder inbox type is separate |
| LOG-ONB-006 | Onboarding Restarted | `ONBOARDING_CANCELLED` | Admin restarted onboarding (stored name still says cancelled) | Admin restart | Admin | Organisation | Restart metadata | `onboarding_logs` | Issuer record - Activity or Investor record - Activity | Yes | A new Onboarding Started follows |
| LOG-ONB-008 | Onboarding Rejected | `ONBOARDING_REJECTED` | Individual or organisation onboarding rejected | Provider reject | Webhook | User / organisation | Reason when present | `onboarding_logs` | Issuer record - Activity or Investor record - Activity | Yes | Pairs with Onboarding Rejected notification |
| LOG-ONB-009 | Onboarding Rejected | `COD_REJECTED` | Company Onboarding Data (COD) rejected; organisation set to REJECTED | RegTank `/codliveness` reject | Webhook | Organisation | Request refs | `onboarding_logs` | Issuer record - Activity or Investor record - Activity | Yes | Distinct stored code from `ONBOARDING_REJECTED`. Admin and customer labels are both Onboarding Rejected. COD = Company Onboarding Data |
| LOG-ONB-010 | Onboarding Submission Approved | `ONBOARDING_APPROVED` | Submission approved; not always final access | Provider approval (RegTank) | Webhook | Organisation | Approval refs | `onboarding_logs` | Issuer record - Activity or Investor record - Activity | Yes | Different from Final Approval Completed. Admin `POST .../approve-onboarding` has no UI caller |
| LOG-ONB-011 | Final Approval Completed | `FINAL_APPROVAL_COMPLETED` | Admin granted full platform access | Admin final approval | Admin | User / organisation | Final approval refs | `onboarding_logs` | Issuer record - Activity or Investor record - Activity | Yes | Customer Activity title is Onboarding Approved |
| LOG-ONB-013 | SSM Approved | `SSM_APPROVED` | Admin approved SSM verification | Admin `POST .../approve-ssm` | Admin | Organisation | SSM metadata | `onboarding_logs` | Issuer record - Activity or Investor record - Activity | No | Admin UI: SSM Verification. Sets `ssm_approved` (investor) or `ssm_checked` (issuer) |
| LOG-ONB-014 | Terms and Conditions Approved | `TNC_APPROVED` | Organisation terms accepted | User accepts T&C | Customer | Organisation | Version refs | `onboarding_logs` | Issuer record - Activity or Investor record - Activity. Audit - Legal Acceptances | No | Legal Acceptances is legal proof |
| LOG-ONB-015 | Form Submitted | `FORM_FILLED` | Investor personal liveness passed; organisation moved toward pending approval | Investor `/liveness` webhook status `LIVENESS_PASSED` | Webhook | User / organisation | Status | `onboarding_logs` | Investor record - Activity | No | Issuer liveness writes `ONBOARDING_STATUS_UPDATED` instead. Admin label Form Submitted |
| LOG-ONB-016 | Sophisticated Investor Status Updated | `SOPHISTICATED_STATUS_UPDATED` | Sophisticated-investor flag changed | Admin `PATCH .../sophisticated-status`, or RegTank extract grants the flag | Admin / Webhook | Organisation / user | New status | `onboarding_logs` | Investor record - Activity | No | — |
| LOG-ONB-017 | Entity Onboarding Data Approved | `EOD_APPROVED` | A director/shareholder Entity Onboarding Data (EOD) request was approved; director KYC JSON may update | RegTank `/eodliveness` status APPROVED | Webhook | Organisation | eodRequestId, codRequestId, status, kycId | `onboarding_logs` | Issuer record - Activity or Investor record - Activity | No | EOD is **not** Enhanced Due Diligence. Code: “EOD (Entity Onboarding Data)” |
| LOG-ONB-018 | Entity Onboarding Data Rejected | `EOD_REJECTED` | A director/shareholder EOD request was rejected; director KYC JSON may update | RegTank `/eodliveness` status REJECTED | Webhook | Organisation | eodRequestId, status | `onboarding_logs` | Issuer record - Activity or Investor record - Activity | No | Same EOD meaning as LOG-ONB-017 |

### 2. Applications

| Event ID | Event / Activity | System Event Code | Description | Trigger / Condition | Actor | Affected Record | Recorded Data | Record Source | Admin Location | Customer Visible | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LOG-APP-001 | Application Created | `APPLICATION_CREATED` | Draft application created | Issuer creates draft (same transaction as the application row) | Customer | Application | Application refs | `application_logs` | Application record - Activity Timeline | Yes | Customer title Application Started. No recurring timeline repair job |
| LOG-APP-002 | Application Processing Fee Paid | `APPLICATION_PROCESSING_FEE_PAID` | Application processing fee captured | Fee capture | Gateway | Application | Payment refs | `application_logs` | Application record - Activity Timeline. Finance - Payments - Gateway Payments | Yes | Gateway Payments is payment proof |
| LOG-APP-003 | Application Submitted | `APPLICATION_SUBMITTED` | Application first submitted | Issuer submit (same transaction as status and submitted_at) | Customer | Application | submitted_at | `application_logs` | Application record - Activity Timeline | Yes | Inbox type application_submitted_confirmation |
| LOG-APP-004 | Application Resubmitted | `APPLICATION_RESUBMITTED` | Application resubmitted after amendment | Issuer resubmit | Customer | Application | Review cycle | `application_logs` | Application record - Activity Timeline | Yes | — |
| LOG-APP-005 | Application Rejected | `APPLICATION_REJECTED` | Application rejected | Admin reject | Admin | Application | Remark | `application_logs` | Application record - Activity Timeline | Yes | — |
| LOG-APP-006 | Application Withdrawn | `APPLICATION_WITHDRAWN` | Application withdrawn or closed by decline | Issuer withdraw or decline close | Customer | Application | Reason | `application_logs` | Application record - Activity Timeline | Yes | Decline also uses withdrawn confirmation notification |
| LOG-APP-007 | Application Completed | `APPLICATION_COMPLETED` | Application reached completed | Accept / complete path | System / Customer | Application | Completion refs | `application_logs` | Application record - Activity Timeline | Yes | — |
| LOG-APP-008 | Application Returned to Review | `APPLICATION_RESET_TO_UNDER_REVIEW` | Admin returned application to review | Admin reset | Admin | Application | Remark | `application_logs` | Application record - Activity Timeline | No | May send Offer Retracted or Reset notification |
| LOG-APP-009 | Section Approved | `SECTION_REVIEWED_APPROVED` | A review section was approved | Admin section approve | Admin | Application section | scope_key, statuses, remark | `application_logs` | Application record - Activity Timeline | No | Title includes section name |
| LOG-APP-010 | Section Rejected | `SECTION_REVIEWED_REJECTED` | A review section was rejected | Admin section reject | Admin | Application section | scope_key, remark | `application_logs` | Application record - Activity Timeline | No | — |
| LOG-APP-011 | Section Amendment Requested | `SECTION_REVIEWED_AMENDMENT_REQUESTED` | Amendment requested on a section | Admin section amend | Admin | Application section | scope_key, remark | `application_logs` | Application record - Activity Timeline | No | Pack send is Amendment Request Sent |
| LOG-APP-012 | Section Reset to Pending | `SECTION_REVIEWED_PENDING` | Section reset to pending | Admin or CTOS reset | Admin / System | Application section | Reason | `application_logs` | Application record - Activity Timeline | No | — |
| LOG-APP-013 | Item Approved | `ITEM_REVIEWED_APPROVED` | A checklist item was approved | Admin item approve | Admin | Application item | scope_key, statuses | `application_logs` | Application record - Activity Timeline | No | — |
| LOG-APP-014 | Item Rejected | `ITEM_REVIEWED_REJECTED` | A checklist item was rejected | Admin item reject | Admin | Application item | scope_key | `application_logs` | Application record - Activity Timeline | No | — |
| LOG-APP-015 | Item Amendment Requested | `ITEM_REVIEWED_AMENDMENT_REQUESTED` | Amendment requested on an item | Admin item amend | Admin | Application item | scope_key | `application_logs` | Application record - Activity Timeline | No | — |
| LOG-APP-016 | Item Reset to Pending | `ITEM_REVIEWED_PENDING` | Checklist item reset to pending | Admin item reset | Admin | Application item | scope_key | `application_logs` | Application record - Activity Timeline | No | — |
| LOG-APP-017 | Amendment Request Sent | `AMENDMENTS_SUBMITTED` | Admin sent the amendment pack to the issuer | Admin submit amendment pack | Admin | Application | Cycle, remark | `application_logs` | Application record - Activity Timeline | Yes | Also mirrored in application_review_events |
| LOG-APP-018 | Invoice Details Offer Sent | `SECTION_REVIEWED_OFFER_SENT` | Invoice-details section rolled up to OFFER_SENT | Admin send invoice offer then syncs invoice-details from items | Admin | Application section | scope_key=invoice_details | `application_logs` | Application record - Activity Timeline | No | Dynamic `SECTION_REVIEWED_${status}` from invoice-details sync after `sendInvoiceOffer`. Distinct from `INVOICE_OFFER_SENT` |
| LOG-APP-020 | Invoice Details Withdrawn | `SECTION_REVIEWED_WITHDRAWN` | Invoice-details section rolled up to WITHDRAWN | Admin invoice-details sync after at least one invoice review item is WITHDRAWN (issuer declined an invoice while others remain) | Admin | Application section | scope_key=invoice_details | `application_logs` | Application record - Activity Timeline | No | Issuer decline writes `INVOICE_OFFER_REJECTED` and does not call `logReviewActivity`. A later Admin send/reject/amend/reset sync can roll the section to WITHDRAWN. Expiry does not use this writer |

### 3. Offers

| Event ID | Event / Activity | System Event Code | Description | Trigger / Condition | Actor | Affected Record | Recorded Data | Record Source | Admin Location | Customer Visible | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LOG-OFR-001 | Facility Offer Sent | `CONTRACT_OFFER_SENT` | Facility offer sent to the issuer | Admin send offer | Admin | Contract / application | Amounts, expiry | `application_logs` | Application record - Activity Timeline. Facility record - Activity | Yes | Review-event mirror |
| LOG-OFR-002 | Facility Offer Acceptance Submitted | `CONTRACT_OFFER_ACCEPTANCE_SUBMITTED` | Issuer submitted facility acceptance documents | Issuer submit acceptance | Customer | Contract | Acceptance refs | `application_logs` | Application record - Activity Timeline | Yes | — |
| LOG-OFR-003 | Facility Offer Acceptance Resubmitted | `CONTRACT_OFFER_ACCEPTANCE_RESUBMITTED` | Issuer resubmitted facility acceptance documents | Issuer resubmit | Customer | Contract | Acceptance refs | `application_logs` | Application record - Activity Timeline | Yes | — |
| LOG-OFR-004 | Facility Acceptance Approved for Signing | `CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING` | Admin approved facility acceptance for signing | Admin approve for signing | Admin | Contract | Approval refs | `application_logs` | Application record - Activity Timeline | No | — |
| LOG-OFR-005 | Facility Offer Accepted | `CONTRACT_OFFER_ACCEPTED` | Facility offer accepted | Issuer accept path | Customer / System | Contract | Acceptance refs | `application_logs` | Application record - Activity Timeline | Yes | May also complete the application |
| LOG-OFR-006 | Facility Offer Declined | `CONTRACT_OFFER_DECLINED` | Issuer declined the facility offer | Issuer decline | Customer | Contract | Decline refs | `application_logs` | Application record - Activity Timeline | Yes | Live decline is not CONTRACT_OFFER_REJECTED |
| LOG-OFR-007 | Facility Offer Retracted | `CONTRACT_OFFER_RETRACTED` | Admin retracted the facility offer | Admin retract | Admin | Contract | Retract refs | `application_logs` | Application record - Activity Timeline | Yes | — |
| LOG-OFR-008 | Facility Offer Expired | `CONTRACT_OFFER_EXPIRED` | Facility offer expired | Hourly expiry job | System | Contract | Expiry refs | `application_logs` | Application record - Activity Timeline | Yes | — |

### 4. Signing

| Event ID | Event / Activity | System Event Code | Description | Trigger / Condition | Actor | Affected Record | Recorded Data | Record Source | Admin Location | Customer Visible | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LOG-SGN-001 | Facility Signing Deadline Extended | `CONTRACT_SIGNING_DEADLINE_EXTENDED` | Facility signing deadline extended | Admin extend | Admin | Contract | New deadline | `application_logs` | Application record - Activity Timeline | Yes | — |
| LOG-SGN-002 | Invoice Signing Deadline Extended | `INVOICE_SIGNING_DEADLINE_EXTENDED` | Invoice signing deadline extended | Admin extend | Admin | Invoice | New deadline | `application_logs` | Application record - Activity Timeline | Yes | — |
| LOG-SGN-003 | Signing Package Created | `SIGNING_PACKAGE_CREATED` | Signing envelope created | Admin or system create envelope | Admin / System | Envelope | Envelope id | `application_logs` | Application record - Activity Timeline | No | Envelope table is source of truth for signing status |
| LOG-SGN-004 | Signing Package Sent | `SIGNING_PACKAGE_SENT` | Signing links emailed | Send package | Admin / System | Envelope | Recipients | `application_logs` | Application record - Activity Timeline. Application record - Acceptance | Yes | Reminder send does not write a second Activity event |
| LOG-SGN-005 | Signing Package Completed | `SIGNING_PACKAGE_COMPLETED` | Signing package completed | Signing webhook | Webhook | Envelope | Envelope refs | `application_logs` | Application record - Activity Timeline | Yes | — |
| LOG-SGN-006 | Signing Package Declined | `SIGNING_PACKAGE_DECLINED` | Signer declined | Signer decline | Customer / signer | Envelope | Envelope refs | `application_logs` | Application record - Activity Timeline | Yes | Different from voided |
| LOG-SGN-007 | Signing Package Expired | `SIGNING_PACKAGE_EXPIRED` | Signing package expired | Signing expiry job | System | Envelope | Envelope refs | `application_logs` | Application record - Activity Timeline | Yes | Offer expiry is a different event |
| LOG-SGN-008 | Signing Package Voided | `SIGNING_PACKAGE_VOIDED` | Admin voided the signing package | Admin void | Admin | Envelope | Envelope refs | `application_logs` | Application record - Activity Timeline | No | — |

### 5. Facilities

| Event ID | Event / Activity | System Event Code | Description | Trigger / Condition | Actor | Affected Record | Recorded Data | Record Source | Admin Location | Customer Visible | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LOG-FAC-001 | Facility Fee Paid | `FACILITY_FEE_PAID` | Upfront facility fee captured | Fee capture | Gateway | Contract / application | Amount, payment | `application_logs` | Application record - Activity Timeline. Finance - Payments - Gateway Payments | Yes | Notification Upfront Facility Fee Paid |
| LOG-FAC-002 | Facility Occupancy Updated | `CONTRACT_FACILITY_OCCUPANCY_UPDATED` | Facility occupancy figures changed | Draw, funding, or repayment | System | Contract | Occupancy figures | `application_logs` | Application record - Activity Timeline. Facility record - Activity | Yes | Twin of Note occupancy |
| LOG-FAC-003 | Facility Fee Waived | `CONTRACT_FACILITY_FEE_WAIVED` | Facility fee waived on the contract | Admin waive | Admin | Contract | Waiver refs | `application_logs` | Facility record - Activity | No | Different from Note-level waive |
| LOG-FAC-004 | Facility Disabled | `CONTRACT_FACILITY_DISABLED` | Facility disabled (new drawdowns blocked) | Admin disable | Admin | Contract | Disable refs | `application_logs` | Facility record - Activity | No | — |
| LOG-FAC-005 | Facility Enabled | `CONTRACT_FACILITY_ENABLED` | Facility enabled | Admin enable | Admin | Contract | Enable refs | `application_logs` | Facility record - Activity | No | No enable notification |
| LOG-FAC-006 | Large Private Customer Flag Updated | `CONTRACT_CUSTOMER_LARGE_PRIVATE_UPDATED` | Large-private customer flag changed | Admin update flag | Admin | Contract | Flag value | `application_logs` | Facility record - Activity | No | — |
| LOG-FAC-007 | Note Occupancy Updated | `FACILITY_OCCUPANCY_UPDATED` | Note-layer occupancy figures changed | Same occupancy refresh as facility | System | Note / contract | Occupancy figures | `note_events` | Note record - Activity | No | Twin of Facility Occupancy Updated |
| LOG-FAC-008 | Facility Fee Collection Waived | `WAIVE_FACILITY_FEE_COLLECTION` | Collecting the facility fee on the Note was waived | Admin waive on Note | Admin | Note | Waiver refs | `note_events` | Note record - Activity | No | Different from contract waive |
| LOG-FAC-009 | Paymaster Created | `PAYMASTER_CREATED` | New Paymaster master created Unverified from issuer Customer Details | Issuer Save of Customer Details when SSM is not already on a master | Issuer | Paymaster + originating application | Paymaster id, SSM, legal name, Unverified | `application_logs` | Application record - Activity Timeline; Paymaster record - Activity | No | Initial issuer link is included. Do not also write Linked to Issuer |
| LOG-FAC-010 | Paymaster Linked to Issuer | `PAYMASTER_LINKED_TO_ISSUER` | New issuer link created on an existing Paymaster master | Issuer Save when this issuer did not already have a link | Issuer | Paymaster + originating application | Link id, Paymaster id, related-party, verification status | `application_logs` | Application record - Activity Timeline; Paymaster record - Activity | No | Not written for same-issuer reuse or last-used updates |
| LOG-FAC-011 | Paymaster Identity Verified | `PAYMASTER_VERIFIED` | Admin reviewed Paymaster identity Unverified → Verified | Admin Verify Paymaster | Admin | Paymaster + originating application when supplied | Previous/new status, verified by | `application_logs` | Application record - Activity Timeline; Paymaster record - Activity | No | Not application approval. Not Notice acknowledgement. Idempotent re-verify writes nothing |
| LOG-FAC-012 | Paymaster Identity Resolved | `PAYMASTER_IDENTITY_RESOLVED` | Admin overlaid verified Paymaster identity onto this application's submitted customer details | Admin Use Verified Paymaster | Admin | Application + Paymaster | Submitted identity before, verified identity used, resolution | `application_logs` | Application record - Activity Timeline; Paymaster record - Activity | No | Does not notify the issuer. Revision snapshots from submit stay unchanged |

### 6. Invoices

| Event ID | Event / Activity | System Event Code | Description | Trigger / Condition | Actor | Affected Record | Recorded Data | Record Source | Admin Location | Customer Visible | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LOG-INV-001 | Invoice Offer Sent | `INVOICE_OFFER_SENT` | Invoice offer sent | Admin send offer | Admin | Invoice | Invoice number, amounts, expiry | `application_logs` | Application record - Activity Timeline | Yes | — |
| LOG-INV-002 | Invoice Offer Acceptance Submitted | `INVOICE_OFFER_ACCEPTANCE_SUBMITTED` | Issuer submitted invoice acceptance documents | Issuer submit | Customer | Invoice | Acceptance refs | `application_logs` | Application record - Activity Timeline | Yes | OTP email is a separate direct email |
| LOG-INV-003 | Invoice Offer Acceptance Resubmitted | `INVOICE_OFFER_ACCEPTANCE_RESUBMITTED` | Issuer resubmitted invoice acceptance documents | Issuer resubmit | Customer | Invoice | Acceptance refs | `application_logs` | Application record - Activity Timeline | Yes | — |
| LOG-INV-004 | Invoice Acceptance Approved for Signing | `INVOICE_ACCEPTANCE_APPROVED_FOR_SIGNING` | Admin approved invoice acceptance for signing | Admin approve | Admin | Invoice | Approval refs | `application_logs` | Application record - Activity Timeline | No | — |
| LOG-INV-005 | Invoice Offer Accepted | `INVOICE_OFFER_ACCEPTED` | Invoice offer accepted | Issuer accept | Customer | Invoice | Acceptance refs | `application_logs` | Application record - Activity Timeline | Yes | — |
| LOG-INV-006 | Invoice Offer Declined | `INVOICE_OFFER_REJECTED` | Issuer declined the invoice offer | Issuer decline | Customer | Invoice | Decline refs | `application_logs` | Application record - Activity Timeline | Yes | Stored code says REJECTED; Admin label is Declined |
| LOG-INV-007 | Invoice Offer Retracted | `INVOICE_OFFER_RETRACTED` | Admin retracted the invoice offer | Admin retract | Admin | Invoice | Retract refs | `application_logs` | Application record - Activity Timeline | Yes | — |
| LOG-INV-008 | Invoice Offer Expired | `INVOICE_OFFER_EXPIRED` | Invoice offer expired | Hourly expiry job | System | Invoice | Expiry refs | `application_logs` | Application record - Activity Timeline | Yes | — |
| LOG-INV-009 | Invoice Withdrawn | `INVOICE_WITHDRAWN` | Issuer withdrew an invoice from the application | Issuer withdraw invoice | Customer | Invoice | Withdrawal refs | `application_logs` | Application record - Activity Timeline | Yes | No dedicated notification type |

### 7. Investment Notes

| Event ID | Event / Activity | System Event Code | Description | Trigger / Condition | Actor | Affected Record | Recorded Data | Record Source | Admin Location | Customer Visible | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LOG-NTE-001 | Note Created | `NOTE_CREATED_FROM_INVOICE` | Note created from a funded invoice | Create Note | Admin / System | Note | Invoice / application refs | `note_events` | Note record - Activity | Yes | — |
| LOG-NTE-002 | Draft Updated | `UPDATE_DRAFT` | Draft Note updated | Admin edit draft | Admin | Note | Draft fields | `note_events` | Note record - Activity | No | Also mirrored in note_admin_actions |
| LOG-NTE-003 | Featured Settings Updated | `UPDATE_FEATURED_SETTINGS` | Featured-Note flags changed | Admin featured settings | Admin | Note | Featured flags | `note_events` | Note record - Activity | No | — |
| LOG-NTE-004 | Note Published | `PUBLISH` | Note published to the marketplace | Admin publish | Admin | Note | Publish refs | `note_events` | Note record - Activity | Yes | — |
| LOG-NTE-005 | Note Unpublished | `UNPUBLISH` | Note unpublished from the marketplace | Admin unpublish | Admin | Note | Unpublish refs | `note_events` | Note record - Activity | No | May clear prospectus approval |
| LOG-NTE-006 | Campaign Paused | `PAUSE_LISTING` | Campaign paused | Admin pause | Admin | Note | Listing state | `note_events` | Note record - Activity | Yes | — |
| LOG-NTE-007 | Campaign Resumed | `RESUME_LISTING` | Campaign resumed | Admin resume | Admin | Note | Listing state | `note_events` | Note record - Activity | Yes | — |
| LOG-NTE-008 | Funding Closed | `CLOSE_FUNDING` | Funding closed because the minimum was met | Admin close or listing-expiry job | Admin / System | Note | Funding refs | `note_events` | Note record - Activity | Yes | Issuer only on customer Activity |
| LOG-NTE-009 | Funding Unsuccessful | `FAIL_FUNDING` | Funding did not complete | Admin fail or listing-expiry job | Admin / System | Note | Failure refs | `note_events` | Note record - Activity | Yes | Issuer and investor |
| LOG-NTE-010 | Note Activated | `ACTIVATE` | Note activated after funding | Admin or system activate | Admin / System | Note | Activation refs | `note_events` | Note record - Activity | Yes | — |
| LOG-NTE-011 | Paymaster Notice Generated | `PAYMASTER_NOTICE_GENERATED` | Paymaster assignment notice generated | Admin generate notice | Admin | Notice | Notice id | `note_events` | Note record - Activity | No | — |
| LOG-NTE-012 | Paymaster Notice Sent | `PAYMASTER_NOTICE_SENT` | Paymaster notice sent | Admin send notice | Admin | Notice | Notice id | `note_events` | Note record - Activity | No | — |
| LOG-NTE-013 | Paymaster Notice Uploaded | `PAYMASTER_NOTICE_UPLOADED` | Paymaster notice uploaded | Admin upload | Admin | Notice | Notice id | `note_events` | Note record - Activity | No | — |
| LOG-NTE-014 | Paymaster Acknowledgement Uploaded | `PAYMASTER_ACKNOWLEDGEMENT_UPLOADED` | Paymaster acknowledgement uploaded | Admin upload ack | Admin | Notice | Notice id | `note_events` | Note record - Activity | No | — |
| LOG-NTE-015 | Paymaster Acknowledgement Confirmed | `PAYMASTER_ACKNOWLEDGEMENT_CONFIRMED` | Paymaster acknowledgement confirmed | Admin confirm | Admin | Notice | Notice id | `note_events` | Note record - Activity | No | — |
| LOG-NTE-016 | Prospectus Review Created | `PROSPECTUS_REVIEW_CREATE` | Prospectus review started | Admin start review | Admin | Prospectus | Review refs | `note_events` | Note record - Activity | No | — |
| LOG-NTE-017 | Prospectus Draft Updated | `PROSPECTUS_REVIEW_DRAFT_UPDATE` | Prospectus draft updated | Admin draft update | Admin | Prospectus | Review refs | `note_events` | Note record - Activity | No | — |
| LOG-NTE-018 | Prospectus Approved | `PROSPECTUS_REVIEW_APPROVE` | Prospectus approved | Admin approve | Admin | Prospectus | Review refs | `note_events` | Note record - Activity | No | — |
| LOG-NTE-019 | Prospectus Approval Cleared After Edit | `PROSPECTUS_APPROVAL_INVALIDATED_EDIT` | Prospectus approval cleared after edit | Edit after approve | Admin / System | Prospectus | Reason | `note_events` | Note record - Activity | No | — |
| LOG-NTE-020 | Prospectus Approval Cleared After Source Change | `PROSPECTUS_APPROVAL_INVALIDATED_SOURCE` | Prospectus approval cleared after source change | Source change | System | Prospectus | Reason | `note_events` | Note record - Activity | No | — |
| LOG-NTE-021 | Prospectus Approval Cleared After Unpublish | `PROSPECTUS_APPROVAL_INVALIDATED_UNPUBLISH` | Prospectus approval cleared after unpublish | Unpublish | System | Prospectus | Reason | `note_events` | Note record - Activity | No | — |

### 8. Investments

| Event ID | Event / Activity | System Event Code | Description | Trigger / Condition | Actor | Affected Record | Recorded Data | Record Source | Admin Location | Customer Visible | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LOG-CMT-001 | Investment Committed | `INVESTMENT_COMMITTED` | Investor committed funds to a Note | Investor commit | Customer | Note / investment | Amount, user | `note_events` | Note record - Activity | Yes | Investor Activity. Wallet hold is a related journal |

### 9. Payments

| Event ID | Event / Activity | System Event Code | Description | Trigger / Condition | Actor | Affected Record | Recorded Data | Record Source | Admin Location | Customer Visible | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LOG-PAY-001 | Bank Account Name Check Started | `NAME_CHECK` | Deposit entered bank-name check | Deposit name-check | Webhook | Gateway payment | from/to status | `gateway_payment_events` | Finance - Payments - Gateway Payments | No | Finance record |
| LOG-PAY-002 | Bank Account Name Check Passed | `NAME_CHECK_APPROVED` | Bank-name check passed | Admin approve name check | Admin | Gateway payment | Status | `gateway_payment_events` | Finance - Payments - Gateway Payments | No | May then complete the deposit |
| LOG-PAY-003 | Bank Account Name Check Failed | `NAME_CHECK_REJECTED` | Bank-name check failed | Admin reject name check | Admin | Gateway payment | Status | `gateway_payment_events` | Finance - Payments - Gateway Payments | No | Deposit Verification Failed notification |
| LOG-PAY-004 | Payment Received Successfully | `GATEWAY_PAYMENT_COMPLETED` | Payment capture completed | Gateway capture | Gateway | Gateway payment | Status | `gateway_payment_events` | Finance - Payments - Gateway Payments | No | Onboarding, processing, and facility fees also write Activity milestones |
| LOG-PAY-005 | Payment Amount Mismatch | `CAPTURE_MISMATCH` | Captured amount or currency did not match | Mismatch on capture | Webhook | Gateway payment | Amounts, reason | `gateway_payment_events` | Finance - Payments - Gateway Payments | No | Admin title may be Payment Currency Mismatch |
| LOG-PAY-006 | Payment Session Expired | `EXPIRED` | Checkout session expired | Stuck-order poller | System | Gateway payment | Expiry refs | `gateway_payment_events` | Finance - Payments - Gateway Payments | No | — |
| LOG-PAY-007 | Refund Started | `REFUND_INITIATED` | Refund started | Refund request | Webhook / Admin / System | Gateway payment | Refund refs | `gateway_payment_events` | Finance - Payments - Gateway Payments | No | — |
| LOG-PAY-008 | Refund Completed | `REFUNDED` | Refund completed | Refund confirmed | Webhook / System | Gateway payment | Refund refs | `gateway_payment_events` | Finance - Payments - Gateway Payments | No | — |
| LOG-PAY-009 | Wallet Update Failed After Refund | `REFUND_WALLET_REVERSAL_FAILED` | Wallet could not be updated after refund | Wallet reversal failed | System | Gateway payment | Error metadata | `gateway_payment_events` | Finance - Payments - Gateway Payments | No | — |

### 10. Disbursement

| Event ID | Event / Activity | System Event Code | Description | Trigger / Condition | Actor | Affected Record | Recorded Data | Record Source | Admin Location | Customer Visible | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LOG-DSB-001 | Disbursement Instruction Created | `ISSUER_DISBURSEMENT_WITHDRAWAL_CREATED` | Disbursement instruction created | Admin create withdrawal | Admin | Withdrawal | Withdrawal refs | `note_events` | Note record - Activity | No | — |
| LOG-DSB-002 | Withdrawal Letter Generated | `WITHDRAWAL_LETTER_GENERATED` | Trustee letter generated | Admin generate letter | Admin | Withdrawal | Letter refs; residual relabel | `note_events` | Note record - Activity | No | Residual return uses Residual Return Letter Generated |
| LOG-DSB-003 | Withdrawal Submitted to Trustee | `WITHDRAWAL_SUBMITTED_TO_TRUSTEE` | Instruction submitted to trustee | Admin submit | Admin | Withdrawal | Submission refs | `note_events` | Note record - Activity | No | Typed notification may go to issuer and/or investor |
| LOG-DSB-004 | Withdrawal Beneficiary Updated | `WITHDRAWAL_BENEFICIARY_UPDATED` | Withdrawal beneficiary changed | Admin update beneficiary | Admin | Withdrawal | Beneficiary refs | `note_events` | Note record - Activity | No | — |
| LOG-DSB-005 | Trustee Instruction Emailed | `WITHDRAWAL_TRUSTEE_EMAIL_SENT` | Trustee instruction emailed | Send or resend trustee email | Admin / System | Withdrawal | resend flag | `note_events` | Note record - Activity | No | Direct email to trustee. Resend label: Redelivered |
| LOG-DSB-006 | Withdrawal Completed | `WITHDRAWAL_COMPLETED` | Withdrawal, disbursement, or residual return completed | Admin complete | Admin | Withdrawal | Type in metadata | `note_events` | Note record - Activity | Yes | Issuer disbursement may notify. Residual Return Completed when type is residual |

### 11. Repayment

| Event ID | Event / Activity | System Event Code | Description | Trigger / Condition | Actor | Affected Record | Recorded Data | Record Source | Admin Location | Customer Visible | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LOG-RPY-001 | Repayment Submitted | `ISSUER_PAYMENT_SUBMITTED` | Issuer submitted a repayment that needs Admin review | Issuer submit needing review | Customer | Payment | Payment id | `note_events` | Note record - Activity | Yes | Mutually exclusive with Repayment Received |
| LOG-RPY-002 | Repayment Received | `PAYMENT_RECEIVED` | Repayment recorded without Admin review | Issuer repayment auto-record | Customer / System | Payment | Payment id | `note_events` | Note record - Activity | No | Not on customer Note Activity. Investor notification is separate |
| LOG-RPY-003 | Repayment Approved | `PAYMENT_APPROVED` | Admin approved a repayment | Admin approve | Admin | Payment | Payment id | `note_events` | Note record - Activity | No | No issuer approved notification |
| LOG-RPY-004 | Repayment Rejected | `PAYMENT_REJECTED` | Admin rejected a repayment | Admin reject | Admin | Payment | Reason | `note_events` | Note record - Activity | No | — |

### 12. Late Payment / Arrears / Default

| Event ID | Event / Activity | System Event Code | Description | Trigger / Condition | Actor | Affected Record | Recorded Data | Record Source | Admin Location | Customer Visible | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LOG-LTE-001 | Late Charge Approved | `LATE_CHARGE_APPROVED` | Admin approved a late charge | Admin approve charge | Admin | Note | Charge refs | `note_events` | Note record - Activity | No | — |
| LOG-LTE-002 | Note Entered Arrears | `OVERDUE_LATE_CHARGE_CHECKED` | Servicing status changed (arrears path) | Servicing status change only | System | Note | Servicing status, due date | `note_events` | Note record - Late Payment. Note record - Activity | No | Written only when status actually changes |
| LOG-LTE-003 | Note Defaulted | `NOTE_DEFAULT_MARKED` | Note marked default | Admin mark default | Admin | Note | Reason | `note_events` | Note record - Activity | Yes | Issuer and investor |
| LOG-LTE-004 | Arrears Letter Generated | `ARREARS_LETTER_GENERATED` | Arrears letter generated | Admin generate letter | Admin | Note / document | Hash | `note_events` | Note record - Activity | No | Also generated_document_evidence |
| LOG-LTE-005 | Default Letter Generated | `DEFAULT_LETTER_GENERATED` | Default letter generated | Admin generate letter | Admin | Note / document | Hash | `note_events` | Note record - Activity | No | Also generated_document_evidence |

### 13. Settlement

| Event ID | Event / Activity | System Event Code | Description | Trigger / Condition | Actor | Affected Record | Recorded Data | Record Source | Admin Location | Customer Visible | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LOG-STL-001 | Settlement Approved | `SETTLEMENT_APPROVED` | Admin approved a settlement | Admin approve | Admin | Settlement | Settlement id | `note_events` | Note record - Activity | No | Preview has no event |
| LOG-STL-002 | Settlement Posted | `SETTLEMENT_POSTED` | Settlement posted to ledgers | Admin or system post | Admin / System | Settlement | Posting refs | `note_events` | Note record - Activity | Yes | Investor Activity. Related ledger and late-charge notifications |
| LOG-STL-003 | Settlement Trustee Letter Generated | `SETTLEMENT_TRUSTEE_LETTER_GENERATED` | Settlement trustee letter generated | Admin generate | Admin | Settlement | Letter refs | `note_events` | Note record - Activity | No | — |
| LOG-STL-004 | Settlement Trustee Letter Submitted | `SETTLEMENT_TRUSTEE_LETTER_SUBMITTED` | Settlement trustee letter submitted | Admin submit | Admin | Settlement | Letter refs | `note_events` | Note record - Activity | No | — |
| LOG-STL-005 | Settlement Trustee Instruction Completed | `SETTLEMENT_TRUSTEE_INSTRUCTION_COMPLETED` | Settlement trustee instruction completed | Admin complete | Admin | Settlement | Instruction refs | `note_events` | Note record - Activity | No | — |
| LOG-STL-006 | Settlement Trustee Email Sent | `SETTLEMENT_TRUSTEE_EMAIL_SENT` | Settlement trustee instruction emailed | Send or resend | Admin / System | Settlement | resend flag | `note_events` | Note record - Activity | No | Direct email. Resend label: Redelivered |

### 14. Legal

| Event ID | Event / Activity | System Event Code | Description | Trigger / Condition | Actor | Affected Record | Recorded Data | Record Source | Admin Location | Customer Visible | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LOG-LGL-001 | Document Created | `LEGAL_DOCUMENT_CREATED` | Legal document created | Admin create document | Admin | Legal document | Document id | `legal_document_audit_logs` | Audit - Legal Documents | No | Legal record |
| LOG-LGL-002 | Document Updated | `LEGAL_DOCUMENT_UPDATED` | Legal document metadata updated | Admin update | Admin | Legal document | Document id | `legal_document_audit_logs` | Audit - Legal Documents | No | — |
| LOG-LGL-003 | Version Uploaded | `LEGAL_VERSION_UPLOADED` | Legal document version uploaded | Admin upload | Admin | Legal version | Hash | `legal_document_audit_logs` | Audit - Legal Documents | No | — |
| LOG-LGL-004 | Version File Replaced | `LEGAL_VERSION_FILE_REPLACED` | Legal version file replaced | Admin replace file | Admin | Legal version | Hash | `legal_document_audit_logs` | Audit - Legal Documents | No | — |
| LOG-LGL-005 | Version Published | `LEGAL_VERSION_PUBLISHED` | Legal version published | Admin publish | Admin | Legal version | Version refs | `legal_document_audit_logs` | Audit - Legal Documents | No | — |
| LOG-LGL-006 | Version Archived | `LEGAL_VERSION_ARCHIVED` | Legal version archived | Admin archive | Admin | Legal version | Version refs | `legal_document_audit_logs` | Audit - Legal Documents | No | — |
| LOG-LGL-007 | Version Restored | `LEGAL_VERSION_RESTORED` | Legal version restored | Admin restore | Admin | Legal version | Version refs | `legal_document_audit_logs` | Audit - Legal Documents | No | — |
| LOG-LGL-008 | Legal Document Accepted | `LEGAL_DOCUMENT_ACCEPTANCE` | User accepted a published legal document | User accept | Customer | Acceptance | User, org, version, hash | `legal_document_acceptances` | Audit - Legal Acceptances | No | Row insert is the event. Primary legal proof |
| LOG-LGL-009 | External Person or Guarantor Accepted | `LEGAL_EXTERNAL_ACCEPTANCE` | External signer or guarantor accepted | Signing webhook | Webhook / signer | External acceptance | Envelope, application, org | `legal_external_acceptances` | Audit - External Acceptances | No | Overlaps signing package events |
| LOG-LGL-010 | Generated Document Hash Stored | `GENERATED_DOCUMENT_EVIDENCE` | Generated letter or LO hash stored | Persist generated PDF | Admin / System | Generated document | Template and output SHA-256 | `generated_document_evidence` | No current Admin UI | No | Letter Activity is the Operations view |

### 15. Users / Organisation

| Event ID | Event / Activity | System Event Code | Description | Trigger / Condition | Actor | Affected Record | Recorded Data | Record Source | Admin Location | Customer Visible | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LOG-ORG-001 | Organisation Profile Updated | `PROFILE_UPDATED` | Organisation profile patched | Admin or org-admin profile patch | Admin / Customer | Organisation | Updated fields | `onboarding_logs` | Issuer record - Activity or Investor record - Activity | No | Same code is also written to access_logs (Admin user profile) and security_logs (self-service profile). Open Record Source to tell them apart |
| LOG-ORG-002 | Member Added | `MEMBER_ADDED` | Member joined the organisation | Accept invite or add | Customer | Membership | Role | `onboarding_logs` | Issuer record - Activity or Investor record - Activity | No | — |
| LOG-ORG-003 | Member Invited | `MEMBER_INVITED` | Organisation member invited | Org admin invite | Customer | Invite | Email, role | `onboarding_logs` | Issuer record - Activity or Investor record - Activity | No | Invite email is a direct email, not a typed notification |
| LOG-ORG-004 | Member Removed | `MEMBER_REMOVED` | Member removed | Org admin remove | Customer | Membership | User, org | `onboarding_logs` | Issuer record - Activity or Investor record - Activity | No | — |
| LOG-ORG-005 | Member Role Changed | `MEMBER_ROLE_CHANGED` | Member role changed | Org admin role change | Customer | Membership | From/to role | `onboarding_logs` | Issuer record - Activity or Investor record - Activity | No | — |

### 16. Access & Security

| Event ID | Event / Activity | System Event Code | Description | Trigger / Condition | Actor | Affected Record | Recorded Data | Record Source | Admin Location | Customer Visible | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LOG-SEC-001 | Login | `LOGIN` | Successful sign-in for an existing user | OAuth callback | Customer | User | Portal, IP, user agent | `access_logs` | Audit - Access | No | First-ever user is Sign Up |
| LOG-SEC-002 | Sign Up | `SIGNUP` | First CashSouk user record created | First user on OAuth callback | Customer | User | Portal, IP, user agent | `access_logs` | Audit - Access | No | Mutually exclusive with Login on that callback |
| LOG-SEC-003 | Logout | `LOGOUT` | Sign-out | User sign-out | Customer | User | Best-effort | `access_logs` | Audit - Access | No | May be missing if the token is already invalid |
| LOG-SEC-004 | Role Created | `ROLE_CREATED` | Admin created a custom role | Admin create role | Admin | Role | Permissions snapshot | `security_logs` | Audit - Security | No | — |
| LOG-SEC-005 | Role Permissions Updated | `ROLE_PERMISSIONS_UPDATED` | Role permissions changed | Admin edit role | Admin | Role | Before/after permissions | `security_logs` | Audit - Security | No | — |
| LOG-SEC-006 | Role Added | `ROLE_ADDED` | Role granted to a user | Admin invitation accepted (OAuth callback) | System / Customer | User | Role, invitation refs | `security_logs` | Audit - Security | No | Live path is invite accept. `PATCH /users/:id/roles` and `POST /v1/auth/add-role` have no current UI callers |
| LOG-SEC-007 | Role Removed | `ROLE_REMOVED` | Role removed from a user | Admin remove role | Admin | User | Role | `security_logs` | Audit - Security | No | — |
| LOG-SEC-008 | Role Switched | `ROLE_SWITCHED` | Active role changed, or Admin deactivated/reactivated | Switch role or Admin deactivate | Customer / Admin | User | From/to, action | `security_logs` | Audit - Security | No | Label may be Admin Deactivated / Reactivated / Role Changed |
| LOG-SEC-009 | Password Changed | `PASSWORD_CHANGED` | In-app password change | Portal ChangePassword | Customer | User | Security metadata | `security_logs` | Audit - Security | No | Cognito forgot-password does not write this |
| LOG-SEC-010 | Email Verified | `EMAIL_VERIFIED` | Email verification attempt (success or failure) | Verify email | Customer | User | success / VERIFICATION_FAILED | `security_logs` | Audit - Security | No | Open detail for failed attempts |
| LOG-SEC-011 | Invitation Revoked | `INVITATION_REVOKED` | Admin invitation revoked | Admin revoke invite | Admin | Invite | Invitee | `security_logs` | Audit - Security | No | Invite send is a direct email only |

### 17. Products

| Event ID | Event / Activity | System Event Code | Description | Trigger / Condition | Actor | Affected Record | Recorded Data | Record Source | Admin Location | Customer Visible | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LOG-PRD-001 | Product Created | `PRODUCT_CREATED` | Product created | Admin create product | Admin | Product | Config snapshot | `product_logs` | Audit - Products | No | Does not auto-send New Product Alert |
| LOG-PRD-002 | Product Updated | `PRODUCT_UPDATED` | Product updated or versioned | Admin update | Admin | Product | Snapshot | `product_logs` | Audit - Products | No | — |
| LOG-PRD-003 | Product Deleted | `PRODUCT_DELETED` | Product deleted | Admin delete | Admin | Product | Snapshot | `product_logs` | Audit - Products | No | — |

### 18. Administration / Configuration

| Event ID | Event / Activity | System Event Code | Description | Trigger / Condition | Actor | Affected Record | Recorded Data | Record Source | Admin Location | Customer Visible | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LOG-ADM-001 | Platform Finance Settings Updated | `PLATFORM_FINANCE_SETTINGS_UPDATED` | Platform finance settings saved | Admin settings save | Admin | Platform settings | Changed keys | `security_logs` | Audit - Security | No | — |
| LOG-ADM-002 | MARC Assessment Saved | `MARC_ASSESSMENT_SAVED` | Issuer MARC credit assessment saved | Admin save MARC on issuer organisation | Admin | Issuer organisation | Assessment fields | `onboarding_logs` | Issuer record - Activity | No | Issuer only. Not written for investor organisations |

### 19. Integrations / Gateway / System

| Event ID | Event / Activity | System Event Code | Description | Trigger / Condition | Actor | Affected Record | Recorded Data | Record Source | Admin Location | Customer Visible | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LOG-INT-001 | Entity Onboarding Data Provider Update | `EOD_WEBHOOK` | EOD webhook with a status other than APPROVED or REJECTED | RegTank `/eodliveness` non-approve/reject status | Webhook | Organisation | eodRequestId, status | `onboarding_logs` | No current Admin UI | No | Organisation Activity query excludes this type. Approve/reject write LOG-ONB-017/018 instead |
| LOG-INT-002 | Tawarruq Order Submitted | `SHORAKA_ORDER_SUBMITTED` | Tawarruq order submitted | Admin `POST .../shoraka/submit-order` on first trade-order create | Admin | Trade order | trade_order_id | `note_events` | Note record - Activity | No | Stored code uses SHORAKA. Admin note timeline labels Tawarruq |
| LOG-INT-003 | Tawarruq Certificate Retrieved | `SHORAKA_CERTIFICATE_FETCHED` | Tawarruq certificate retrieved | Admin `POST .../shoraka/fetch-certificate` when provider COMPLETED | Admin | Trade order | Certificate refs | `note_events` | Note record - Activity | No | Same SHORAKA stored prefix |
| LOG-INT-004 | Investment Note Certificate Generated | `INVESTMENT_NOTE_CERTIFICATE_GENERATED` | Islamic Investment Note Certificate PDFs stored for a funded, disbursed note | After issuer disbursement completion (or Admin retry of a failed generation) | Admin / System | Note | certificateNumber, version, snapshotSha256, investorCount, source | `note_events` | Note record - Activity | No | Written once per successful version. Not issuer/investor Activity |
| LOG-INT-004A | Investment Note Certificate Reissued | `INVESTMENT_NOTE_CERTIFICATE_REISSUED` | New certificate version generated from a READY snapshot using latest Document Authorisation settings | Admin Regenerate / Reissue on a READY certificate | Admin | Note | documentType, previousVersion, newVersion, source, generatedAt, oldSnapshotSha256, newSnapshotSha256 | `note_events` | Note record - Activity | No | Does not overwrite the previous READY PDF. Not issuer/investor Activity |
| LOG-INT-005 | Settlement Hibah Receipt Generated | `SETTLEMENT_HIBAH_RECEIPT_GENERATED` | Issuer-copy Settlement & Hibah Receipt PDF stored after financing is fully settled | After posted settlement also marks the note REPAID/SETTLED, or after trustee/legacy residual completion that does so (or Admin retry of a failed generation) | Admin / System | Settlement | receiptNumber, version, settlementReference, snapshotSha256, pdfSha256, hibahAmount, source | `note_events` | Note record - Activity | No | Written once per successful version. Not issuer/investor Activity. PDF failure does not undo settlement |
| LOG-INT-005A | Settlement Hibah Receipt Reissued | `SETTLEMENT_HIBAH_RECEIPT_REISSUED` | New receipt version generated from a READY snapshot using latest Document Authorisation settings | Admin Regenerate / Reissue on a READY receipt | Admin | Settlement | documentType, previousVersion, newVersion, source, generatedAt, oldSnapshotSha256, newSnapshotSha256 | `note_events` | Note record - Activity | No | Does not overwrite the previous READY PDF. Not issuer/investor Activity |

## Supporting Investigation Records

These are not normal business Activity events. Use them to investigate what happened. They are not duplicated as Activity rows in the register above (except where a named event already exists).

| Record | Purpose | Source | Admin Location | Primary Use |
| --- | --- | --- | --- | --- |
| Signer viewed the package | Signer opened the signing link | `SigningRecipient.viewed_at` | Application record - Acceptance | Signing investigation |
| Application review copy | Extra copy of offer sent or amendment sent | `application_review_events` | No current Admin UI | Investigation. Use Application record - Activity Timeline |
| Reviewer remarks | Comments entered during review | `application_review_remarks` | Application review remarks | Review comments |
| Note Admin action copy | Extra copy of Admin Note actions | `note_admin_actions` | No current Admin UI | Duplicate of Note record - Activity |
| Raw payment-provider update | Provider webhook received | `gateway_webhook_events` | No current Admin UI | Provider / dedup investigation |
| Checkout attempt | Payment session attempted | `gateway_order_attempts` | Finance - Payments - Gateway Payments | Payment investigation |
| Payment receipt | Receipt file generated or retried | `gateway_payment_receipts` | Finance - Payments - Gateway Payments | Receipt file |
| Reconciliation completed | Settlement reconciliation run | `gateway_recon_runs` | Finance - Reconciliation | Finance match |
| Reconciliation mismatch found | Unmatched or mismatched payment | `gateway_recon_exceptions` | Finance - Reconciliation | Finance exception |
| Investor wallet movement | Deposit, invest, refund, cash withdrawal | `investor_balance_transactions` | Finance - Investor Withdrawals | Wallet journal |
| Note ledger | Money movement on the Note | `note_ledger_entries` | Note record - Ledger | Note money journal |
| Invoice offer verification-code record | Verification code issued | `offer_accept_otp_challenges` | No current Admin UI | Invoice-accept OTP |
| Notification delivery record | Typed in-app / email send | `notification_logs` | Audit - Notifications | Delivery proof for typed messages |

Count: **13** families.

`user_sessions` is not listed: `AuthRepository.upsertUserSession` has no production caller, so the table is not a live supporting family.

---

## Related Records and Source of Truth

Do not delete overlapping stores. Use the primary record for the question you are answering.

| Business Action | Related Records | Primary Record for Operations | Reason |
| --- | --- | --- | --- |
| Payment confirmation (deposit, fee, refund) | Activity fee milestones + `gateway_payment_events` + wallet journal | Finance - Payments - Gateway Payments | Activity is the business milestone. Gateway Payments is payment proof |
| Legal document accepted | `TNC_APPROVED` Activity + `legal_document_acceptances` | Audit - Legal Acceptances | Activity is the milestone. Acceptances hold hash and party proof |
| External / guarantor acceptance | Signing package events + `legal_external_acceptances` | Audit - External Acceptances | Signing status vs legal proof |
| Facility occupancy | `CONTRACT_FACILITY_OCCUPANCY_UPDATED` + `FACILITY_OCCUPANCY_UPDATED` | Facility record - Activity for facility; Note record - Activity for Note | Same draw/fund/repay, two layers |
| Offer sent or amendment pack sent | `application_logs` + `application_review_events` | Application record - Activity Timeline | Review mirror has no Admin reader |
| Admin Note action | `note_events` + `note_admin_actions` | Note record - Activity | Admin action mirror has no Admin reader |
| Letter generated | `*_LETTER_GENERATED` + `generated_document_evidence` | Note record - Activity for Operations; hash table for investigation | No Audit tab for hashes |
| Provider identity update | `EOD_WEBHOOK` + EOD Approved/Rejected | Issuer / Investor record - Activity for APPROVED/REJECTED | Forensic `EOD_WEBHOOK` has no Org Activity UI |
| Investment committed | `INVESTMENT_COMMITTED` + wallet hold | Note record - Activity for the commitment; wallet for money | Two purposes |
| Typed notification vs Activity | Activity row + inbox + `notification_logs` | Activity for what happened; Audit - Notifications for whether the message was sent | Different questions |

---

## Logging Gaps

Live actions that currently produce no proper named audit / Activity event. Not implemented in this change.

| Action | Current Behaviour | Recommended Audit Event | Priority |
| --- | --- | --- | --- |
| User cancelled onboarding | Explicitly no `onboarding_logs` | Onboarding Cancelled by User | Medium |
| Signing reminder | Direct email only; no Activity | Signing Reminder Sent | Low |
| Settlement preview | Computation only | None, unless Finance needs a preview trail | Low |
| Notification preference changed | Preference row only | Notification Preference Updated | Low |
| Company-search / CTOS retry tick | Process log | None per tick | No notification needed / keep process log |
| Signing PDF backfill | Envelope files repaired | None | Low |
| Forgot password / Admin authenticator reset | Cognito only | Outside this app | n/a |
| Admin custom announcement | `notification_logs` only | Keep as notification delivery, not Activity | n/a |
| Invoice-offer verification code | OTP row + SES; no application Activity | Optional Application OTP Sent | Low |

Invoice-offer OTP **does** persist `offer_accept_otp_challenges`. It is listed under Supporting Investigation Records.

---

## Admin UI notes (display mapping)

No unified Date / Time · Module · Event · Actor · Reference · Summary · Status table exists. Timelines are vertical cards; Audit tabs are separate tables. Detail drawers already expose system event code and metadata.

Display-only label updates made with this register (stored codes unchanged):

| System Event Code | Previous Admin wording | Operations name now |
| --- | --- | --- |
| `ONBOARDING_APPROVED` | Onboarding Approved | Onboarding Submission Approved |
| `EOD_APPROVED` | Enhanced Due Diligence Approved | Entity Onboarding Data Approved |
| `EOD_REJECTED` | Enhanced Due Diligence Rejected | Entity Onboarding Data Rejected |
| `EOD_WEBHOOK` | Enhanced Due Diligence Provider Update | Entity Onboarding Data Provider Update |
| `SSM_APPROVED` | Company Registry Check Approved | SSM Approved |
| `COD_REJECTED` | Corporate Onboarding Rejected | Onboarding Rejected (same Admin label as individual reject) |
| `FORM_FILLED` | Identity Documents Submitted | Form Submitted |
| `OVERDUE_LATE_CHARGE_CHECKED` | Overdue Late Charge Checked | Note Entered Arrears |
| `CONTRACT_CUSTOMER_LARGE_PRIVATE_UPDATED` | Humanized token | Large Private Customer Flag Updated |
| `PAYMASTER_CREATED` | Humanized token | Paymaster Created |
| `PAYMASTER_LINKED_TO_ISSUER` | Humanized token | Paymaster Linked to Issuer |
| `PAYMASTER_VERIFIED` | Paymaster Verified | Paymaster Identity Verified |
| `PAYMASTER_IDENTITY_RESOLVED` | Humanized token | Paymaster Identity Resolved |
| `GATEWAY_PAYMENT_COMPLETED` | Gateway Payment Completed | Payment Received Successfully |
| `NAME_CHECK` / `NAME_CHECK_APPROVED` / `NAME_CHECK_REJECTED` | Name check needed / approved / rejected | Bank Account Name Check Started / Passed / Failed |
| `CAPTURE_MISMATCH` | Payment mismatch found | Payment Amount Mismatch (or Payment Currency Mismatch) |
| `EXPIRED` | Payment expired | Payment Session Expired |
| `REFUND_WALLET_REVERSAL_FAILED` | Wallet balance could not be updated | Wallet Update Failed After Refund |
| `SIGNING_PACKAGE_SENT` / declined / expired / voided | Mixed sentence case | Signing Package Sent / Declined / Expired / Voided |

Remaining UI limits (not changed):

- No Module column on timelines or Audit tabs
- External Acceptances hash, IP, user agent, and acknowledgement wording are in the detail drawer, not the table
- Forensic `EOD_WEBHOOK` has no Admin reader (Organisation Activity allowlist excludes it)
- `WEBHOOK_APPROVED` / `WEBHOOK_REJECTED` are not current production events: live callers never hit those branches (dev webhook handler only)
- `generated_document_evidence`, `application_review_events`, `note_admin_actions` have no Admin reader
- Customer Activity titles can still differ (example: Final Approval Completed vs customer “Onboarding Approved”)
- Facility compact metadata can still show technical field keys

---

## Count snapshot

| Bucket | Count |
| --- | --- |
| Active named event types | **157** |
| Supporting investigation record families | **13** |
| Events with no current Admin reader | 2 named (`EOD_WEBHOOK`, `GENERATED_DOCUMENT_EVIDENCE`) plus supporting families without a screen |
| Related-record patterns | **9** |
| Logging gaps (named audit missing) | **7** live actions listed above |

Excluded on purpose: historical readers, unmounted product inactivate/reactivate, `ACCOUNT_LOCKED`, unused gateway `CREATED` / `COMPLETED` / `FAILED`, `OVERRIDE_*` (enum only), unreachable `WEBHOOK_APPROVED` / `WEBHOOK_REJECTED` production branches, Cognito-only mail, Ops Alerts (removed), unused `user_sessions` upsert, temporary `ONBOARDING_RESET` (`POST .../reset-onboarding`), unreachable `AML_APPROVED` (approve-aml hook unused; live AML is `ONBOARDING_STATUS_UPDATED`), `SECTION_REVIEWED_OFFER_EXPIRED` (hourly expiry job updates the section without `logReviewActivity`).
