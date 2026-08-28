---
title: Logs, Activity & Notifications
description: What activity, logs, evidence and notifications currently exist in CashSouk, and where Operations, Finance, Legal and Compliance can find them.
category: Platform Operations
tags:
  - admin
  - operations
  - audit
  - notifications
order: 30
updated: 2026-08-28
---

CashSouk records important actions across the platform.

Use this page to see what activity, logs, evidence and notifications are available and where to find them.

Internal IDs may also be shown on some screens for investigation.

---

## Quick index

- [Onboarding](#onboarding)
- [Applications](#applications)
- [Facilities](#facilities)
- [Invoices](#invoices)
- [Signing](#signing)
- [Notes & Investments](#notes--investments)
- [Payments](#payments)
- [Repayments & Settlement](#repayments--settlement)
- [Withdrawals & Trustee](#withdrawals--trustee)
- [Legal Documents](#legal-documents)
- [Legal Acceptances](#legal-acceptances)
- [Products](#products)
- [Access & Security](#access--security)
- [Notifications](#notifications)

---

## Onboarding

Organisation onboarding history.

**Where Operations checks:** Admin → Issuers or Investors → Activity

Issuer and Investor also see a shorter milestone list on **Activity**.

**Onboarding Fee Paid**

Meaning:
The issuer registration/onboarding fee was paid successfully.

Where to find:
Admin → Issuers → Activity
Issuer → Activity
Admin → Finance → Gateway Payments (Issuer Registration Fee)

Visible to:
Admin, Issuer

Notification:
None

System event: `ONBOARDING_FEE_PAID`

**Onboarding Started**

Meaning:
The organisation started onboarding.

Where to find:
Admin → Issuers / Investors → Activity
Issuer → Activity
Investor → Activity

Visible to:
Admin, Issuer, Investor

Notification:
None

System event: `ONBOARDING_STARTED`

**Onboarding Resumed**

Meaning:
Onboarding continued, or a new onboarding request was started.

Where to find:
Admin → Issuers / Investors → Activity

Visible to:
Admin

Notification:
None

System event: `ONBOARDING_RESUMED`

**Onboarding Restarted**

Meaning:
Operations cancelled the previous onboarding request and started a new one.

Where to find:
Admin → Issuers / Investors → Activity
Issuer → Activity
Investor → Activity

Visible to:
Admin, Issuer, Investor

Notification:
None

System event: `ONBOARDING_CANCELLED`

**Onboarding Status Updated**

Meaning:
Onboarding status changed. This includes KYC, AML and other review progress.

Where to find:
Admin → Issuers / Investors → Activity

Visible to:
Admin

Notification:
None

System event: `ONBOARDING_STATUS_UPDATED`

**Form Submitted**

Meaning:
Identity or company form progress was recorded during onboarding checks.

Where to find:
Admin → Issuers / Investors → Activity

Visible to:
Admin

Notification:
None

System event: `FORM_FILLED`

**Onboarding Approved** (submission)

Meaning:
The onboarding submission was approved. Full platform access is not granted yet.

Where to find:
Admin → Issuers / Investors → Activity
Issuer → Activity (shown as Onboarding Submission Approved)
Investor → Activity (shown as Onboarding Submission Approved)

Visible to:
Admin, Issuer, Investor

Notification:
None

System event: `ONBOARDING_APPROVED`

**Final Approval Completed**

Meaning:
Onboarding is fully complete. The organisation has platform access.

Where to find:
Admin → Issuers / Investors → Activity
Issuer → Activity (shown as Onboarding Approved)
Investor → Activity (shown as Onboarding Approved)

Visible to:
Admin, Issuer, Investor

Notification:
Onboarding Completed

System event: `FINAL_APPROVAL_COMPLETED`

**Onboarding Rejected**

Meaning:
Onboarding was rejected.

Where to find:
Admin → Issuers / Investors → Activity
Issuer → Activity
Investor → Activity

Visible to:
Admin, Issuer, Investor

Notification:
Onboarding Application Rejected

System event: `ONBOARDING_REJECTED` or `COD_REJECTED`

**SSM Approved**

Meaning:
Operations approved SSM verification for a company.

Where to find:
Admin → Issuers / Investors → Activity

Visible to:
Admin

Notification:
None

System event: `SSM_APPROVED`

**T&C Approved**

Meaning:
The user accepted the required legal terms during onboarding.

Where to find:
Admin → Issuers / Investors → Activity
Admin → Audit → Legal Acceptances (full evidence)

Visible to:
Admin

Notification:
None

System event: `TNC_APPROVED`

**Sophisticated Status Updated**

Meaning:
Sophisticated investor status was granted or revoked.

Where to find:
Admin → Investors → Activity

Visible to:
Admin

Notification:
None

System event: `SOPHISTICATED_STATUS_UPDATED`

**Organization Profile Updated**

Meaning:
Organisation profile details were changed.

Where to find:
Admin → Issuers / Investors → Activity

Visible to:
Admin

Notification:
None

System event: `PROFILE_UPDATED`

**Member Invited**

Meaning:
Someone was invited to join the organisation.

Where to find:
Admin → Issuers / Investors → Activity

Visible to:
Admin

Notification:
None

System event: `MEMBER_INVITED`

**Member Added**

Meaning:
A member was added to the organisation.

Where to find:
Admin → Issuers / Investors → Activity

Visible to:
Admin

Notification:
None

System event: `MEMBER_ADDED`

**Member Removed**

Meaning:
A member was removed from the organisation.

Where to find:
Admin → Issuers / Investors → Activity

Visible to:
Admin

Notification:
None

System event: `MEMBER_REMOVED`

**Member Role Changed**

Meaning:
A member’s organisation role was changed.

Where to find:
Admin → Issuers / Investors → Activity

Visible to:
Admin

Notification:
None

System event: `MEMBER_ROLE_CHANGED`

**MARC Assessment Saved**

Meaning:
Operations saved an issuer MARC credit assessment.

Where to find:
Admin → Issuers → Activity

Visible to:
Admin

Notification:
None

System event: `MARC_ASSESSMENT_SAVED`

---

## Applications

Application review history.

**Where Operations checks:** Admin → Applications → Activity Timeline

Issuers also see application milestones on **Activity**.

**Application Created**

Meaning:
A financing application draft was created.

Where to find:
Admin → Applications → Activity Timeline
Issuer → Activity (shown as Application Started)

Visible to:
Admin, Issuer

Notification:
None

System event: `APPLICATION_CREATED`

**Application Processing Fee Paid**

Meaning:
The application processing fee was paid successfully.

Where to find:
Admin → Applications → Activity Timeline
Issuer → Activity
Admin → Finance → Gateway Payments (Application Processing Fee)

Visible to:
Admin, Issuer

Notification:
None

System event: `APPLICATION_PROCESSING_FEE_PAID`

**Application Submitted**

Meaning:
The issuer submitted the application for review.

Where to find:
Admin → Applications → Activity Timeline
Issuer → Activity

Visible to:
Admin, Issuer

Notification:
Application Submitted (platform only)

System event: `APPLICATION_SUBMITTED`

**Application Resubmitted**

Meaning:
The issuer submitted updated application content after changes were requested.

Where to find:
Admin → Applications → Activity Timeline
Issuer → Activity

Visible to:
Admin, Issuer

Notification:
Application Resubmitted

System event: `APPLICATION_RESUBMITTED`

**Amendment Request Sent**

Meaning:
Operations sent an amendment request to the issuer.

Where to find:
Admin → Applications → Activity Timeline
Issuer → Activity

Visible to:
Admin, Issuer

Notification:
Amendment Requested

System event: `AMENDMENTS_SUBMITTED`

**Section Approved**

Meaning:
Operations approved an application section.

Where to find:
Admin → Applications → Activity Timeline

Visible to:
Admin

Notification:
None

System event: `SECTION_REVIEWED_APPROVED`

**Section Rejected**

Meaning:
Operations rejected an application section.

Where to find:
Admin → Applications → Activity Timeline

Visible to:
Admin

Notification:
None

System event: `SECTION_REVIEWED_REJECTED`

**Section Amendment Requested**

Meaning:
Operations asked for changes on an application section.

Where to find:
Admin → Applications → Activity Timeline

Visible to:
Admin

Notification:
Acceptance Documents Need Updates (only for post-offer acceptance documents, once per cycle)

System event: `SECTION_REVIEWED_AMENDMENT_REQUESTED`

**Section Reset to Pending**

Meaning:
A section was returned to pending review.

Where to find:
Admin → Applications → Activity Timeline

Visible to:
Admin

Notification:
None

System event: `SECTION_REVIEWED_PENDING`

**Item Approved**

Meaning:
Operations approved an invoice or supporting document item.

Where to find:
Admin → Applications → Activity Timeline

Visible to:
Admin

Notification:
None

System event: `ITEM_REVIEWED_APPROVED`

**Item Rejected**

Meaning:
Operations rejected an invoice or supporting document item.

Where to find:
Admin → Applications → Activity Timeline

Visible to:
Admin

Notification:
None

System event: `ITEM_REVIEWED_REJECTED`

**Item Amendment Requested**

Meaning:
Operations asked for changes on an invoice or supporting document item.

Where to find:
Admin → Applications → Activity Timeline

Visible to:
Admin

Notification:
Acceptance Documents Need Updates (only for post-offer acceptance documents, once per cycle)

System event: `ITEM_REVIEWED_AMENDMENT_REQUESTED`

**Item Reset to Pending**

Meaning:
An item was returned to pending review.

Where to find:
Admin → Applications → Activity Timeline

Visible to:
Admin

Notification:
None

System event: `ITEM_REVIEWED_PENDING`

**Application Rejected**

Meaning:
The application was not approved.

Where to find:
Admin → Applications → Activity Timeline
Issuer → Activity

Visible to:
Admin, Issuer

Notification:
Application Rejected

System event: `APPLICATION_REJECTED`

**Application Withdrawn**

Meaning:
The issuer withdrew the application.

Where to find:
Admin → Applications → Activity Timeline
Issuer → Activity

Visible to:
Admin, Issuer

Notification:
Application Withdrawn

System event: `APPLICATION_WITHDRAWN`

**Application Completed**

Meaning:
The application reached completed status.

Where to find:
Admin → Applications → Activity Timeline
Issuer → Activity

Visible to:
Admin, Issuer

Notification:
Application Completed

System event: `APPLICATION_COMPLETED`

**Application Returned to Review**

Meaning:
Operations sent the application back under review.

Where to find:
Admin → Applications → Activity Timeline

Visible to:
Admin

Notification:
None

System event: `APPLICATION_RESET_TO_UNDER_REVIEW`

**Contract Customer Large Private Updated**

Meaning:
Operations updated the large-private customer flag on the facility.

Where to find:
Admin → Applications → Activity Timeline

Visible to:
Admin

Notification:
None

System event: `CONTRACT_CUSTOMER_LARGE_PRIVATE_UPDATED`

---

## Facilities

Facility / contract offer and occupancy history.

**Where Operations checks:** Admin → Facilities → Activity, or Admin → Applications → Activity Timeline

**Facility Offer Sent**

Meaning:
Operations sent a facility offer to the issuer.

Where to find:
Admin → Facilities → Activity
Admin → Applications → Activity Timeline
Issuer → Activity (shown as You Received a Facility Offer)

Visible to:
Admin, Issuer

Notification:
Facility Offer Received

System event: `CONTRACT_OFFER_SENT`

**Facility Offer Acceptance Submitted**

Meaning:
The issuer submitted acceptance documents for the facility offer.

Where to find:
Admin → Facilities → Activity
Admin → Applications → Activity Timeline
Issuer → Activity (shown as You Submitted Your Facility Offer Acceptance)

Visible to:
Admin, Issuer

Notification:
None

System event: `CONTRACT_OFFER_ACCEPTANCE_SUBMITTED`

**Facility Offer Acceptance Resubmitted**

Meaning:
The issuer resubmitted acceptance documents after changes were requested.

Where to find:
Admin → Facilities → Activity
Admin → Applications → Activity Timeline
Issuer → Activity (shown as You Resubmitted Your Facility Offer Acceptance)

Visible to:
Admin, Issuer

Notification:
None

System event: `CONTRACT_OFFER_ACCEPTANCE_RESUBMITTED`

**Facility Acceptance Approved for Signing**

Meaning:
Operations approved the acceptance documents. Signing can proceed.

Where to find:
Admin → Facilities → Activity
Admin → Applications → Activity Timeline

Visible to:
Admin

Notification:
None

System event: `CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING`

**Facility Offer Accepted**

Meaning:
The issuer accepted the facility offer. This is not the same as signing completed.

Where to find:
Admin → Facilities → Activity
Admin → Applications → Activity Timeline
Issuer → Activity

Visible to:
Admin, Issuer

Notification:
Upfront facility fee payment required (only if an upfront facility fee is due)

System event: `CONTRACT_OFFER_ACCEPTED`

**Facility Offer Declined**

Meaning:
The issuer declined the facility offer.

Where to find:
Admin → Facilities → Activity
Admin → Applications → Activity Timeline
Issuer → Activity

Visible to:
Admin, Issuer

Notification:
Facility Offer Declined

System event: `CONTRACT_OFFER_DECLINED`

**Facility Offer Retracted**

Meaning:
Operations retracted the facility offer before it was accepted.

Where to find:
Admin → Facilities → Activity
Admin → Applications → Activity Timeline
Issuer → Activity (shown as CashSouk Retracted the Facility Offer)

Visible to:
Admin, Issuer

Notification:
Offer Updated

System event: `CONTRACT_OFFER_RETRACTED`

**Facility Offer Expired**

Meaning:
The facility offer expired because the acceptance or signing deadline passed.

Where to find:
Admin → Facilities → Activity
Admin → Applications → Activity Timeline
Issuer → Activity

Visible to:
Admin, Issuer

Notification:
Offer Expired

System event: `CONTRACT_OFFER_EXPIRED`

**Signing Deadline Extended**

Meaning:
Operations extended the facility signing deadline.

Where to find:
Admin → Facilities → Activity
Admin → Applications → Activity Timeline
Issuer → Activity

Visible to:
Admin, Issuer

Notification:
Signing Deadline Extended

System event: `CONTRACT_SIGNING_DEADLINE_EXTENDED`

**Facility Occupancy Updated**

Meaning:
Live facility occupancy changed after a draw, funding, or repayment.

Where to find:
Admin → Facilities → Activity
Admin → Applications → Activity Timeline
Admin → Notes → Activity
Issuer → Activity

Visible to:
Admin, Issuer

Notification:
None

System event: `CONTRACT_FACILITY_OCCUPANCY_UPDATED` or `FACILITY_OCCUPANCY_UPDATED`

**Facility Fee Waived**

Meaning:
Operations waived the facility fee on the facility.

Where to find:
Admin → Facilities → Activity
Admin → Applications → Activity Timeline

Visible to:
Admin

Notification:
None

System event: `CONTRACT_FACILITY_FEE_WAIVED`

**Facility Disabled**

Meaning:
Operations disabled the facility. New drawdowns are blocked.

Where to find:
Admin → Facilities → Activity
Admin → Applications → Activity Timeline

Visible to:
Admin

Notification:
Facility Disabled

System event: `CONTRACT_FACILITY_DISABLED`

**Facility Enabled**

Meaning:
Operations re-enabled the facility.

Where to find:
Admin → Facilities → Activity
Admin → Applications → Activity Timeline

Visible to:
Admin

Notification:
None

System event: `CONTRACT_FACILITY_ENABLED`

---

## Invoices

Invoice offer and withdrawal history.

**Where Operations checks:** Admin → Applications → Activity Timeline

**Invoice Offer Sent**

Meaning:
Operations sent an invoice offer to the issuer.

Where to find:
Admin → Applications → Activity Timeline
Issuer → Activity (shown as You Received an Invoice Offer)

Visible to:
Admin, Issuer

Notification:
Invoice Offer Received

System event: `INVOICE_OFFER_SENT`

**Invoice Offer Acceptance Submitted**

Meaning:
The issuer submitted acceptance documents for the invoice offer.

Where to find:
Admin → Applications → Activity Timeline
Issuer → Activity (shown as You Submitted Your Invoice Offer Acceptance)

Visible to:
Admin, Issuer

Notification:
None

System event: `INVOICE_OFFER_ACCEPTANCE_SUBMITTED`

**Invoice Offer Acceptance Resubmitted**

Meaning:
The issuer resubmitted invoice acceptance documents after changes were requested.

Where to find:
Admin → Applications → Activity Timeline
Issuer → Activity (shown as You Resubmitted Your Invoice Offer Acceptance)

Visible to:
Admin, Issuer

Notification:
None

System event: `INVOICE_OFFER_ACCEPTANCE_RESUBMITTED`

**Invoice Acceptance Approved for Signing**

Meaning:
Operations approved the invoice acceptance documents. Signing can proceed.

Where to find:
Admin → Applications → Activity Timeline

Visible to:
Admin

Notification:
None

System event: `INVOICE_ACCEPTANCE_APPROVED_FOR_SIGNING`

**Invoice Offer Accepted**

Meaning:
The issuer accepted the invoice offer.

Where to find:
Admin → Applications → Activity Timeline
Issuer → Activity

Visible to:
Admin, Issuer

Notification:
None

System event: `INVOICE_OFFER_ACCEPTED`

**Invoice Offer Declined**

Meaning:
The issuer declined the invoice offer.

Where to find:
Admin → Applications → Activity Timeline
Issuer → Activity

Visible to:
Admin, Issuer

Notification:
Invoice Offer Declined

System event: `INVOICE_OFFER_REJECTED`

**Invoice Offer Retracted**

Meaning:
Operations retracted the invoice offer before it was accepted.

Where to find:
Admin → Applications → Activity Timeline
Issuer → Activity (shown as CashSouk Retracted the Invoice Offer)

Visible to:
Admin, Issuer

Notification:
Offer Updated

System event: `INVOICE_OFFER_RETRACTED`

**Invoice Offer Expired**

Meaning:
The invoice offer expired because the acceptance or signing deadline passed.

Where to find:
Admin → Applications → Activity Timeline
Issuer → Activity

Visible to:
Admin, Issuer

Notification:
Offer Expired

System event: `INVOICE_OFFER_EXPIRED`

**Signing Deadline Extended** (invoice)

Meaning:
Operations extended the invoice signing deadline.

Where to find:
Admin → Applications → Activity Timeline
Issuer → Activity

Visible to:
Admin, Issuer

Notification:
Signing Deadline Extended

System event: `INVOICE_SIGNING_DEADLINE_EXTENDED`

**Invoice Withdrawn**

Meaning:
The invoice was withdrawn from the application.

Where to find:
Admin → Applications → Activity Timeline
Issuer → Activity

Visible to:
Admin, Issuer

Notification:
None

System event: `INVOICE_WITHDRAWN`

---

## Signing

Signing package history for facility and invoice offers.

**Where Operations checks:** Admin → Applications → Activity Timeline, or Admin → Facilities → Activity

**Signing Package Created**

Meaning:
A signing package was created.

Where to find:
Admin → Applications → Activity Timeline
Admin → Facilities → Activity

Visible to:
Admin

Notification:
None

System event: `SIGNING_PACKAGE_CREATED`

**Signing Package Sent**

Meaning:
The signing package was sent to signers.

Where to find:
Admin → Applications → Activity Timeline
Admin → Facilities → Activity
Issuer → Activity

Visible to:
Admin, Issuer

Notification:
None

System event: `SIGNING_PACKAGE_SENT`

**Signing Package Completed**

Meaning:
All signers completed the signing package.

Where to find:
Admin → Applications → Activity Timeline
Admin → Facilities → Activity

Visible to:
Admin

Notification:
None

System event: `SIGNING_PACKAGE_COMPLETED`

**Signing Package Voided**

Meaning:
The signing package was voided.

Where to find:
Admin → Applications → Activity Timeline
Admin → Facilities → Activity

Visible to:
Admin

Notification:
None

System event: `SIGNING_PACKAGE_VOIDED`

---

## Notes & Investments

Note lifecycle, prospectus, funding, investment, Tawarruq and Paymaster history.

**Where Operations checks:** Admin → Notes → Activity

Issuers and investors see a shorter milestone list on **Activity**.

**Note Created**

Meaning:
A note was created from an approved invoice.

Where to find:
Admin → Notes → Activity
Issuer → Activity

Visible to:
Admin, Issuer

Notification:
None

System event: `NOTE_CREATED_FROM_INVOICE`

**Draft Updated**

Meaning:
Operations updated the note draft.

Where to find:
Admin → Notes → Activity

Visible to:
Admin

Notification:
None

System event: `UPDATE_DRAFT`

**Featured Settings Updated**

Meaning:
Marketplace featured settings for the note were changed.

Where to find:
Admin → Notes → Activity

Visible to:
Admin

Notification:
None

System event: `UPDATE_FEATURED_SETTINGS`

**Prospectus Review Created**

Meaning:
A prospectus review was created for the note.

Where to find:
Admin → Notes → Activity

Visible to:
Admin

Notification:
None

System event: `PROSPECTUS_REVIEW_CREATE`

**Prospectus Draft Updated**

Meaning:
The prospectus draft was updated.

Where to find:
Admin → Notes → Activity

Visible to:
Admin

Notification:
None

System event: `PROSPECTUS_REVIEW_DRAFT_UPDATE`

**Prospectus Approved**

Meaning:
Operations approved the prospectus.

Where to find:
Admin → Notes → Activity

Visible to:
Admin

Notification:
None

System event: `PROSPECTUS_REVIEW_APPROVE`

**Prospectus Approval Cleared After Edit**

Meaning:
Prospectus approval was cleared because the draft was edited.

Where to find:
Admin → Notes → Activity

Visible to:
Admin

Notification:
None

System event: `PROSPECTUS_APPROVAL_INVALIDATED_EDIT`

**Prospectus Approval Cleared After Source Change**

Meaning:
Prospectus approval was cleared because source information changed.

Where to find:
Admin → Notes → Activity

Visible to:
Admin

Notification:
None

System event: `PROSPECTUS_APPROVAL_INVALIDATED_SOURCE`

**Prospectus Approval Cleared After Unpublish**

Meaning:
Prospectus approval was cleared because the note was unpublished.

Where to find:
Admin → Notes → Activity

Visible to:
Admin

Notification:
None

System event: `PROSPECTUS_APPROVAL_INVALIDATED_UNPUBLISH`

**Note Published**

Meaning:
The note was published to the marketplace for funding.

Where to find:
Admin → Notes → Activity
Issuer → Activity

Visible to:
Admin, Issuer

Notification:
Note published

System event: `PUBLISH`

**Unpublished from Marketplace**

Meaning:
The note was unpublished from the marketplace.

Where to find:
Admin → Notes → Activity

Visible to:
Admin

Notification:
None

System event: `UNPUBLISH`

**Campaign Paused**

Meaning:
The listing was paused. Existing commitments are held.

Where to find:
Admin → Notes → Activity
Issuer → Activity

Visible to:
Admin, Issuer

Notification:
None

System event: `PAUSE_LISTING`

**Campaign Resumed**

Meaning:
The listing was opened for investment again.

Where to find:
Admin → Notes → Activity
Issuer → Activity

Visible to:
Admin, Issuer

Notification:
None

System event: `RESUME_LISTING`

**Investment Committed**

Meaning:
An investor committed funds to the note.

Where to find:
Admin → Notes → Activity
Investor → Activity

Visible to:
Admin, Investor

Notification:
Investment Committed (platform only)

System event: `INVESTMENT_COMMITTED`

**Funding Closed**

Meaning:
Funding closed successfully. Disbursement can proceed.

Where to find:
Admin → Notes → Activity
Issuer → Activity

Visible to:
Admin, Issuer

Notification:
Funding closed successfully

System event: `CLOSE_FUNDING`

**Funding Unsuccessful**

Meaning:
The note did not reach the minimum funding threshold. Commitments were released.

Where to find:
Admin → Notes → Activity
Issuer → Activity
Investor → Activity

Visible to:
Admin, Issuer, Investor

Notification:
Note funding did not complete (issuer)
Commitment released (investor)

System event: `FAIL_FUNDING`

**Facility Fee Collection Waived**

Meaning:
Operations waived collection of the facility fee on this note.

Where to find:
Admin → Notes → Activity

Visible to:
Admin

Notification:
None

System event: `WAIVE_FACILITY_FEE_COLLECTION`

**Note Activated**

Meaning:
The note is active and servicing has started.

Where to find:
Admin → Notes → Activity
Issuer → Activity (shown as Your Note Is Active)
Investor → Activity (shown as Your Investment Is Active)

Visible to:
Admin, Issuer, Investor

Notification:
Note is active (issuer)
Investment is active (investor)

System event: `ACTIVATE`

**Tawarruq Order Submitted**

Meaning:
The Tawarruq order was submitted.

Where to find:
Admin → Notes → Activity

Visible to:
Admin

Notification:
None

System event: `SHORAKA_ORDER_SUBMITTED`

**Tawarruq Certificate Retrieved**

Meaning:
The Tawarruq certificate was retrieved.

Where to find:
Admin → Notes → Activity

Visible to:
Admin

Notification:
None

System event: `SHORAKA_CERTIFICATE_FETCHED`

**Paymaster Notice Generated**

Meaning:
A Notice of Assignment was generated for the note.

Where to find:
Admin → Notes → Activity

Visible to:
Admin

Notification:
None

System event: `PAYMASTER_NOTICE_GENERATED`

**Paymaster Notice Sent**

Meaning:
The Notice of Assignment was marked as sent.

Where to find:
Admin → Notes → Activity

Visible to:
Admin

Notification:
None

System event: `PAYMASTER_NOTICE_SENT`

**Paymaster Notice Uploaded**

Meaning:
A Notice of Assignment file was uploaded.

Where to find:
Admin → Notes → Activity

Visible to:
Admin

Notification:
None

System event: `PAYMASTER_NOTICE_UPLOADED`

**Paymaster Acknowledgement Uploaded**

Meaning:
The paymaster acknowledgement file was uploaded.

Where to find:
Admin → Notes → Activity

Visible to:
Admin

Notification:
None

System event: `PAYMASTER_ACKNOWLEDGEMENT_UPLOADED`

**Paymaster Acknowledgement Confirmed**

Meaning:
The paymaster acknowledgement was confirmed.

Where to find:
Admin → Notes → Activity

Visible to:
Admin

Notification:
None

System event: `PAYMASTER_ACKNOWLEDGEMENT_CONFIRMED`

**Note Defaulted**

Meaning:
The note was marked in default.

Where to find:
Admin → Notes → Activity
Issuer → Activity (shown as Your Note Is in Default)
Investor → Activity (shown as Your Investment Is in Default)

Visible to:
Admin, Issuer, Investor

Notification:
Your Note Is in Default (issuer)
Your Investment Is in Default (investor)

System event: `NOTE_DEFAULT_MARKED`

**Arrears Letter Generated**

Meaning:
An arrears letter was generated.

Where to find:
Admin → Notes → Activity

Visible to:
Admin

Notification:
None

System event: `ARREARS_LETTER_GENERATED`

**Default Letter Generated**

Meaning:
A default letter was generated.

Where to find:
Admin → Notes → Activity

Visible to:
Admin

Notification:
None

System event: `DEFAULT_LETTER_GENERATED`

---

## Payments

Gateway payment records and payment activity.

**Where Operations checks:** Admin → Finance → Gateway Payments

Provider references such as Curlec Payment ID may also be shown.

### Payment purposes

These are the current payment types:

- Investor Deposit
- Issuer Registration Fee
- Application Processing Fee
- Facility Fee
- Late Payment Charges

### Payment record status

Shown on the payment record:

- Awaiting payment
- Paid
- Name check pending
- Completed
- Needs attention
- Refund pending
- Refunded
- Payment failed
- Expired

### Payment activity

**Name Check Needed**

Meaning:
Payment was received, but the payer name could not be matched. Waiting for review.

Where to find:
Admin → Finance → Gateway Payments → payment detail

Visible to:
Admin

Notification:
None

System event: `NAME_CHECK`

**Name Check Approved**

Meaning:
The names matched. The deposit was completed.

Where to find:
Admin → Finance → Gateway Payments → payment detail

Visible to:
Admin

Notification:
Deposit Successful (investor, platform only)

System event: `NAME_CHECK_APPROVED`

**Name Check Rejected**

Meaning:
The names did not match. A refund was started.

Where to find:
Admin → Finance → Gateway Payments → payment detail

Visible to:
Admin

Notification:
Deposit Verification Failed (investor, platform only)

System event: `NAME_CHECK_REJECTED`

**Payment Mismatch Found**

Meaning:
The amount or currency received did not match what was expected. Also shown as Amount mismatch found or Currency mismatch found.

Where to find:
Admin → Finance → Gateway Payments → payment detail

Visible to:
Admin

Notification:
None

System event: `CAPTURE_MISMATCH`

**Payment Expired**

Meaning:
The payment link timed out before payment was finished.

Where to find:
Admin → Finance → Gateway Payments → payment detail

Visible to:
Admin

Notification:
None

System event: `EXPIRED`

**Refund Started**

Meaning:
A refund was requested.

Where to find:
Admin → Finance → Gateway Payments → payment detail

Visible to:
Admin

Notification:
Refund Started (investor deposits, platform only)

System event: `REFUND_INITIATED`

**Refund Completed**

Meaning:
The refund was confirmed. Money was returned to the payer.

Where to find:
Admin → Finance → Gateway Payments → payment detail

Visible to:
Admin

Notification:
Refund Completed (investor deposits, platform only)

System event: `REFUNDED`

**Wallet Balance Could Not Be Updated**

Meaning:
The refund completed, but the investor wallet balance could not be fully updated.

Where to find:
Admin → Finance → Gateway Payments → payment detail

Visible to:
Admin

Notification:
None

System event: `REFUND_WALLET_REVERSAL_FAILED`

### Receipt evidence

Where Operations checks:
Admin → Finance → Gateway Payments → payment detail

Receipt information may include:

- Receipt status
  - Being prepared
  - Ready
  - Could not be prepared
  - Refunded
- Receipt number
- Receipt name
- Receipt company
- Payment date
- Related reference
- View PDF
- Download PDF
- Retry receipt generation

---

## Repayments & Settlement

Note repayment and settlement history.

**Where Operations checks:** Admin → Notes → Activity

Finance queues: Admin → Finance → Repayments, Admin → Finance → Settlements

**Repayment Submitted**

Meaning:
The issuer submitted a repayment for review.

Where to find:
Admin → Notes → Activity
Issuer → Activity (shown as You Submitted a Repayment)

Visible to:
Admin, Issuer

Notification:
None

System event: `ISSUER_PAYMENT_SUBMITTED`

**Repayment Received**

Meaning:
A repayment was recorded on the note.

Where to find:
Admin → Notes → Activity

Visible to:
Admin

Notification:
Repayment Received (investor)

System event: `PAYMENT_RECEIVED`

**Repayment Approved**

Meaning:
Operations approved a submitted repayment.

Where to find:
Admin → Notes → Activity

Visible to:
Admin

Notification:
None

System event: `PAYMENT_APPROVED`

**Repayment Rejected**

Meaning:
Operations rejected a submitted repayment.

Where to find:
Admin → Notes → Activity

Visible to:
Admin

Notification:
Repayment Rejected (issuer, platform only)

System event: `PAYMENT_REJECTED`

**Overdue Late Charge Checked**

Meaning:
An overdue late-charge check was recorded.

Where to find:
Admin → Notes → Activity

Visible to:
Admin

Notification:
None

System event: `OVERDUE_LATE_CHARGE_CHECKED`

**Late Charge Approved**

Meaning:
Operations approved a late charge.

Where to find:
Admin → Notes → Activity

Visible to:
Admin

Notification:
None

System event: `LATE_CHARGE_APPROVED`

**Settlement Previewed**

Meaning:
Operations previewed the settlement.

Where to find:
Admin → Notes → Activity

Visible to:
Admin

Notification:
None

System event: `SETTLEMENT_PREVIEWED`

**Settlement Approved**

Meaning:
Operations approved the settlement.

Where to find:
Admin → Notes → Activity

Visible to:
Admin

Notification:
None

System event: `SETTLEMENT_APPROVED`

**Settlement Posted**

Meaning:
The settlement was posted.

Where to find:
Admin → Notes → Activity
Investor → Activity

Visible to:
Admin, Investor

Notification:
Settlement Posted (investor)

System event: `SETTLEMENT_POSTED`

**Settlement Trustee Letter Generated**

Meaning:
The settlement trustee letter was generated.

Where to find:
Admin → Notes → Activity

Visible to:
Admin

Notification:
None

System event: `SETTLEMENT_TRUSTEE_LETTER_GENERATED`

**Settlement Trustee Letter Submitted**

Meaning:
The settlement trustee letter was submitted.

Where to find:
Admin → Notes → Activity

Visible to:
Admin

Notification:
None

System event: `SETTLEMENT_TRUSTEE_LETTER_SUBMITTED`

**Settlement Trustee Email Sent**

Meaning:
The settlement instruction email was sent to the trustee. If redelivered, this is shown as Settlement Trustee Email Redelivered.

Where to find:
Admin → Notes → Activity

Visible to:
Admin

Notification:
None

System event: `SETTLEMENT_TRUSTEE_EMAIL_SENT`

**Settlement Trustee Instruction Completed**

Meaning:
The settlement trustee instruction was marked completed.

Where to find:
Admin → Notes → Activity

Visible to:
Admin

Notification:
None

System event: `SETTLEMENT_TRUSTEE_INSTRUCTION_COMPLETED`

---

## Withdrawals & Trustee

Issuer disbursement, residual return, and investor cash withdrawal history.

**Where Operations checks:** Admin → Notes → Activity for note-linked withdrawals. Admin → Finance → Issuer Payouts, Admin → Finance → Investor Withdrawals

**Disbursement Instruction Created**

Meaning:
An issuer disbursement instruction was created.

Where to find:
Admin → Notes → Activity

Visible to:
Admin

Notification:
None

System event: `ISSUER_DISBURSEMENT_WITHDRAWAL_CREATED`

**Withdrawal Letter Generated**

Meaning:
A trustee withdrawal letter was generated.

If the instruction is a residual return, Admin Note Activity and CSV show this as Residual Return Letter Generated. The stored event stays `WITHDRAWAL_LETTER_GENERATED`.

Where to find:
Admin → Notes → Activity

Visible to:
Admin

Notification:
None

System event: `WITHDRAWAL_LETTER_GENERATED`

**Withdrawal Beneficiary Updated**

Meaning:
The withdrawal beneficiary details were updated.

Where to find:
Admin → Notes → Activity

Visible to:
Admin

Notification:
None

System event: `WITHDRAWAL_BENEFICIARY_UPDATED`

**Withdrawal Submitted to Trustee**

Meaning:
The withdrawal instruction was submitted to the trustee.

If the instruction is a residual return, Admin Note Activity and CSV show this as Residual Return Submitted to Trustee. The stored event stays `WITHDRAWAL_SUBMITTED_TO_TRUSTEE`. Residual return completions stay Admin-only on Activity.

Where to find:
Admin → Notes → Activity

Visible to:
Admin

Notification:
Withdrawal Submitted to Trustee (issuer and/or investor)

System event: `WITHDRAWAL_SUBMITTED_TO_TRUSTEE`

**Withdrawal Trustee Email Sent**

Meaning:
The withdrawal instruction email was sent to the trustee. If redelivered, this is shown as Withdrawal Trustee Email Redelivered.

Where to find:
Admin → Notes → Activity

Visible to:
Admin

Notification:
None

System event: `WITHDRAWAL_TRUSTEE_EMAIL_SENT`

**Withdrawal Completed**

Meaning:
The withdrawal or disbursement was completed.

If the instruction is a residual return, Admin Note Activity and CSV show this as Residual Return Completed. The stored event stays `WITHDRAWAL_COMPLETED`. Issuer and Investor Activity still show this milestone only for issuer disbursement.

Where to find:
Admin → Notes → Activity
Issuer → Activity (shown as Your Disbursement Is Complete, for issuer disbursement)
Investor → Activity (shown as Your Investment Is Active, for issuer disbursement completion)

Visible to:
Admin, Issuer, Investor (issuer disbursement completion only)

Notification:
Your Disbursement Is Complete (issuer disbursement, platform only)
Withdrawal Completed (investor cash withdrawal, platform only)

System event: `WITHDRAWAL_COMPLETED`

---

## Legal Documents

Document-management logs for Legal and Compliance.

**Where Operations checks:** Admin → Audit → Legal Documents

Current document definitions are also under Admin → Legal Documents.

**Document Created**

Meaning:
A legal document definition was created.

Where to find:
Admin → Audit → Legal Documents

Visible to:
Admin

Notification:
None

System event: `LEGAL_DOCUMENT_CREATED`

**Document Updated**

Meaning:
A legal document definition was updated.

Where to find:
Admin → Audit → Legal Documents

Visible to:
Admin

Notification:
None

System event: `LEGAL_DOCUMENT_UPDATED`

**Version Uploaded**

Meaning:
A document version file was uploaded, including the first version.

Where to find:
Admin → Audit → Legal Documents

Visible to:
Admin

Notification:
None

System event: `LEGAL_VERSION_UPLOADED`

**Version File Replaced**

Meaning:
The file for a document version was replaced.

Where to find:
Admin → Audit → Legal Documents

Visible to:
Admin

Notification:
None

System event: `LEGAL_VERSION_FILE_REPLACED`

**Version Published**

Meaning:
A document version was published.

Where to find:
Admin → Audit → Legal Documents

Visible to:
Admin

Notification:
None

System event: `LEGAL_VERSION_PUBLISHED`

**Version Archived**

Meaning:
A document version was archived. This can happen when a new version is published.

Where to find:
Admin → Audit → Legal Documents

Visible to:
Admin

Notification:
None

System event: `LEGAL_VERSION_ARCHIVED`

**Version Restored**

Meaning:
An archived document version was restored.

Where to find:
Admin → Audit → Legal Documents

Visible to:
Admin

Notification:
None

System event: `LEGAL_VERSION_RESTORED`

---

## Legal Acceptances

Evidence that a user opened or accepted a legal document.

**Where Operations checks:** Admin → Audit → Legal Acceptances

Organisation pages also have an Acceptances tab.

**Legal document not opened**

Meaning:
The acceptance record exists, but the document has not been opened yet.

Where to find:
Admin → Audit → Legal Acceptances

Visible to:
Admin

Notification:
None

Status: `NOT_OPENED`

**Legal document opened**

Meaning:
The user opened the legal document and has not accepted it yet.

Where to find:
Admin → Audit → Legal Acceptances

Visible to:
Admin

Notification:
None

Status: `OPENED`

**Legal document accepted**

Meaning:
The user accepted that exact document version.

Where to find:
Admin → Audit → Legal Acceptances

Visible to:
Admin

Notification:
None

Status: `ACCEPTED`

### Evidence available

Shown on the acceptance detail:

- Event
- Acceptance ID
- Status
- Created at
- Opened at
- Open IP
- Open user agent
- Open device
- Accepted at
- Accept IP
- Accept user agent
- Accept device
- Document type
- Version
- Version ID
- Document ID
- Hash
- File name
- Version status
- Content type
- File size
- Acknowledgement wording
- User ID
- User name snapshot
- User email snapshot
- Organization ID
- Organization name snapshot
- Organization type snapshot
- Portal

Hash:
Identifies the exact document version that was accepted.

Internal IDs may also be shown for investigation.

The accepted PDF can be downloaded from the same detail.

---

## Products

Product configuration history.

**Where Operations checks:** Admin → Audit → Products

**Product Created**

Meaning:
A product was created.

Where to find:
Admin → Audit → Products

Visible to:
Admin

Notification:
None

System event: `PRODUCT_CREATED`

**Product Updated**

Meaning:
A product was updated.

Where to find:
Admin → Audit → Products

Visible to:
Admin

Notification:
None

System event: `PRODUCT_UPDATED`

**Product Deleted**

Meaning:
A product was deleted.

Where to find:
Admin → Audit → Products

Visible to:
Admin

Notification:
None

System event: `PRODUCT_DELETED`

---

## Access & Security

Authentication and security-sensitive account events.

**Where Operations checks:** Admin → Audit → Access, Admin → Audit → Security

### Access

**Login**

Meaning:
The user signed in to CashSouk.

Where to find:
Admin → Audit → Access

Visible to:
Admin

Notification:
None

System event: `LOGIN`

**Failed access attempt**

Meaning:
An unsuccessful access attempt was recorded, including failed admin portal access.

Where to find:
Admin → Audit → Access (status Failed)

Visible to:
Admin

Notification:
None

System event: `LOGIN`

**Sign Up**

Meaning:
A CashSouk user account was established for the first time.

Where to find:
Admin → Audit → Access

Visible to:
Admin

Notification:
None

System event: `SIGNUP`

**Logout**

Meaning:
The user signed out.

Where to find:
Admin → Audit → Access

Visible to:
Admin

Notification:
None

System event: `LOGOUT`

**User Profile Updated**

Meaning:
Operations edited another user’s name or phone.

Where to find:
Admin → Audit → Access

Visible to:
Admin

Notification:
None

System event: `PROFILE_UPDATED`

### Security

**Password Changed**

Meaning:
The account password was changed, or a change attempt failed.

Where to find:
Admin → Audit → Security

Visible to:
Admin

Notification:
Password Changed (on success)

System event: `PASSWORD_CHANGED`

**Email Verified**

Meaning:
Email verification succeeded or failed.

Where to find:
Admin → Audit → Security

Visible to:
Admin

Notification:
None

System event: `EMAIL_VERIFIED`

**Role Added**

Meaning:
A user added a portal role, or an admin invitation was accepted.

Where to find:
Admin → Audit → Security

Visible to:
Admin

Notification:
None

System event: `ROLE_ADDED`

**Role Switched**

Meaning:
The user switched role, or an admin account was deactivated, reactivated, or had its admin role changed.

Also shown as:
Admin Deactivated
Admin Reactivated
Admin Role Changed

Where to find:
Admin → Audit → Security

Visible to:
Admin

Notification:
None

System event: `ROLE_SWITCHED`

**Role Created**

Meaning:
An admin role was created.

Where to find:
Admin → Audit → Security

Visible to:
Admin

Notification:
None

System event: `ROLE_CREATED`

**Role Permissions Updated**

Meaning:
Permissions for an admin role were changed.

Where to find:
Admin → Audit → Security

Visible to:
Admin

Notification:
None

System event: `ROLE_PERMISSIONS_UPDATED`

**Role Removed**

Meaning:
An admin role was deleted.

Where to find:
Admin → Audit → Security

Visible to:
Admin

Notification:
None

System event: `ROLE_REMOVED`

**Invitation Revoked**

Meaning:
An admin invitation was revoked.

Where to find:
Admin → Audit → Security

Visible to:
Admin

Notification:
None

System event: `INVITATION_REVOKED`

**Profile Updated**

Meaning:
A user profile was updated by the user or by Operations.

Where to find:
Admin → Audit → Security

Visible to:
Admin

Notification:
None

System event: `PROFILE_UPDATED`

**Platform Finance Settings Updated**

Meaning:
Platform finance settings were saved.

Where to find:
Admin → Audit → Security

Visible to:
Admin

Notification:
None

System event: `PLATFORM_FINANCE_SETTINGS_UPDATED`

---

## Notifications

Users receive alerts on the platform (bell and notifications list) and, for most types, by email.

**Where Operations checks:**

- What was sent: Admin → Audit → Notifications
- What is turned on: Admin → Settings → Notifications
- What a user sees: Issuer → Notifications, Investor → Notifications

Admin rows are broadcasts. System rows are automatic alerts.

Custom announcements are sent from Settings → Notifications → Custom & Groups.

### Onboarding

**Onboarding Completed**

Sent to:
Issuer or Investor

Channel:
Platform + Email

Triggered when:
Operations completes final onboarding approval.

**Onboarding Application Rejected**

Sent to:
Issuer or Investor

Channel:
Platform + Email

Triggered when:
Onboarding is rejected.

**Action Required: Complete Director/Shareholder Onboarding**

Sent to:
Issuer owner, or Investor owner

Channel:
Platform + Email

Triggered when:
A director or shareholder still needs to finish onboarding.

### Applications

**Application Submitted**

Sent to:
Issuer

Channel:
Platform

Triggered when:
The issuer submits a new application for review.

**Amendment Requested**

Sent to:
Issuer

Channel:
Platform + Email

Triggered when:
Operations sends an amendment request.

**Acceptance Documents Need Updates**

Sent to:
Issuer

Channel:
Platform + Email

Triggered when:
Operations first requests changes to post-offer acceptance documents.

**Application Resubmitted**

Sent to:
Issuer

Channel:
Platform + Email

Triggered when:
The issuer resubmits the application.

**Application Rejected**

Sent to:
Issuer

Channel:
Platform + Email

Triggered when:
Operations rejects the application.

**Application Withdrawn**

Sent to:
Issuer

Channel:
Platform + Email

Triggered when:
The issuer withdraws the application.

**Application Completed**

Sent to:
Issuer

Channel:
Platform + Email

Triggered when:
The application is completed.

### Offers

**Facility Offer Received**

Sent to:
Issuer

Channel:
Platform + Email

Triggered when:
Operations sends a facility offer.

**Invoice Offer Received**

Sent to:
Issuer

Channel:
Platform + Email

Triggered when:
Operations sends an invoice offer.

**Offer Updated**

Sent to:
Issuer

Channel:
Platform + Email

Triggered when:
Operations retracts or resets an offer.

**Offer Expiring Soon**

Sent to:
Issuer

Channel:
Platform + Email

Triggered when:
An acceptance or signing deadline is approaching.

**Offer Expired**

Sent to:
Issuer

Channel:
Platform + Email

Triggered when:
A facility or invoice offer expires.

**Signing Deadline Extended**

Sent to:
Issuer

Channel:
Platform + Email

Triggered when:
Operations extends a facility or invoice signing deadline.

**Facility Disabled**

Sent to:
Issuer

Channel:
Platform + Email

Triggered when:
Operations disables a facility.

**Upfront facility fee payment required**

Sent to:
Issuer

Channel:
Platform + Email

Triggered when:
The issuer accepts a facility offer that requires an upfront facility fee.

**Upfront facility fee paid**

Sent to:
Issuer

Channel:
Platform + Email

Triggered when:
The upfront facility fee has been paid in full.

### Notes

**Note published**

Sent to:
Issuer

Channel:
Platform + Email

Triggered when:
The note is published to the marketplace.

**Funding closed successfully**

Sent to:
Issuer

Channel:
Platform + Email

Triggered when:
Funding closes successfully.

**Note funding did not complete**

Sent to:
Issuer

Channel:
Platform + Email

Triggered when:
The note does not reach the minimum funding threshold.

**Note is active**

Sent to:
Issuer

Channel:
Platform + Email

Triggered when:
The note becomes active.

**Note repaid**

Sent to:
Issuer

Channel:
Platform + Email

Triggered when:
The note is fully repaid and settled.

**Note in arrears**

Sent to:
Issuer

Channel:
Platform + Email

Triggered when:
The note enters arrears.

**Your Note Is in Default**

Sent to:
Issuer

Channel:
Platform + Email

Triggered when:
The note is marked in default.

### Investments

**Investment Committed**

Sent to:
Investor

Channel:
Platform

Triggered when:
The investor commits funds to a note.

**Commitment released**

Sent to:
Investor

Channel:
Platform + Email

Triggered when:
A reserved commitment is released because the note did not complete funding.

**Investment is active**

Sent to:
Investor

Channel:
Platform + Email

Triggered when:
A note the investor funded becomes active.

**Note in Arrears**

Sent to:
Investor

Channel:
Platform + Email

Triggered when:
A note the investor invested in enters arrears.

**Your Investment Is in Default**

Sent to:
Investor

Channel:
Platform + Email

Triggered when:
A note the investor invested in is marked in default.

### Payments

**Deposit Successful**

Sent to:
Investor

Channel:
Platform

Triggered when:
A deposit is credited to the investor wallet.

**Deposit Verification Failed**

Sent to:
Investor

Channel:
Platform

Triggered when:
A deposit fails name verification and will be returned.

**Refund Started**

Sent to:
Investor

Channel:
Platform

Triggered when:
A deposit refund is started.

**Refund Completed**

Sent to:
Investor

Channel:
Platform

Triggered when:
A deposit refund is completed.

**Outstanding late charges to pay**

Sent to:
Issuer

Channel:
Platform + Email

Triggered when:
A settlement is posted with late charges that still need to be paid separately.

**Late payment charges received**

Sent to:
Issuer

Channel:
Platform + Email

Triggered when:
Separately collected late charges have been paid in full.

### Withdrawals

**Withdrawal Submitted to Trustee**

Sent to:
Issuer and/or Investor

Channel:
Platform + Email

Triggered when:
A withdrawal instruction is submitted to the trustee.

**Your Disbursement Is Complete**

Sent to:
Issuer

Channel:
Platform

Triggered when:
Issuer disbursement is completed.

**Withdrawal Submitted**

Sent to:
Investor

Channel:
Platform

Triggered when:
An investor cash withdrawal request is submitted.

**Withdrawal Completed**

Sent to:
Investor

Channel:
Platform

Triggered when:
An investor cash withdrawal is completed.

### Repayments

**Repayment Received**

Sent to:
Investor

Channel:
Platform + Email

Triggered when:
A repayment is recorded on a note.

**Repayment Rejected**

Sent to:
Issuer

Channel:
Platform

Triggered when:
Operations rejects a repayment submitted by the issuer.

**Settlement Posted**

Sent to:
Investor

Channel:
Platform + Email

Triggered when:
Settlement is posted for a note.

### Other

**Password Changed**

Sent to:
Issuer or Investor

Channel:
Platform + Email

Triggered when:
The account password is changed successfully. This cannot be turned off.

**System Announcement**

Sent to:
Audience chosen by Operations

Channel:
Platform and/or Email, as chosen

Triggered when:
Operations sends a custom announcement.

**New Investment Opportunity**

Sent to:
Investor

Channel:
Platform + Email

Triggered when:
A new product alert is sent.

---

## Record references

Operations can use these prefixes when searching or communicating about a record:

| Prefix | Meaning |
| --- | --- |
| APP | Application |
| CON | Facility / Contract |
| INV | Invoice |
| NOTE | Investment Note |
| SET | Settlement |
| WDL | Withdrawal |
| ISS | Issuer Organisation |
| IVT | Investor Organisation |
| RCP | Receipt |

---

## Where to check

| Area | Where Operations checks |
| --- | --- |
| Onboarding activity | Admin → Issuers / Investors → Activity |
| Application activity | Admin → Applications → Activity Timeline |
| Facility activity | Admin → Facilities → Activity |
| Note activity | Admin → Notes → Activity |
| Legal documents | Admin → Audit → Legal Documents |
| Legal acceptances | Admin → Audit → Legal Acceptances |
| Access logs | Admin → Audit → Access |
| Security logs | Admin → Audit → Security |
| Product logs | Admin → Audit → Products |
| Payments | Admin → Finance → Gateway Payments |
| Receipts | Admin → Finance → Gateway Payments → payment detail |
| Notification delivery | Admin → Audit → Notifications |
| Notification settings | Admin → Settings → Notifications |
| Issuer / Investor activity | Issuer → Activity, Investor → Activity |
| User notifications | Issuer → Notifications, Investor → Notifications |
