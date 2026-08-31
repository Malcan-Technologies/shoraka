---
title: "Operations Guide: Activity, Logs and Notifications"
description: Activity records, Admin logs, notifications, and direct emails in the current platform.
category: Platform Operations
tags:
  - admin
  - operations
  - audit
  - notifications
order: 29
updated: 2026-09-01
---

This guide lists the Activity records, Admin logs, notifications, and direct emails available in the current platform.

It shows where each item appears in Admin and whether it is visible or sent to customers.

Only current live behaviour is included.

## How to read the tables

| Column | Meaning |
| --- | --- |
| Activity | The live action or event |
| Admin Location | Where it appears in Admin |
| Customer Visibility | What the customer sees |
| Notification | Customer inbox or email title, or None |
| Delivery | How the message is sent |

**Customer Visibility:** Activity, Notification, Activity + Notification, Email only, Not customer visible.

**Delivery:** Follows Admin notification settings, Always Platform + Email, Direct email, Channels selected by Admin, None.

The customer Activity feed shows **Application Created** as **Application Started**, and **Final Approval Completed** as **Onboarding Approved**.

Signing Package Declined is when the signer declined. Signing Package Voided is when the signing package was cancelled.

**Entity Onboarding Data** is a director or shareholder onboarding update from the identity provider. It is not Enhanced Due Diligence. **Company onboarding rejected** uses the same Admin label as individual onboarding rejected. **SSM Approved** is the Admin SSM Verification step.

---

## Issuer

### Onboarding

| Activity | Admin Location | Customer Visibility | Notification | Delivery |
| --- | --- | --- | --- | --- |
| Onboarding Started | Issuer → Activity | Activity | None | None |
| Onboarding Fee Paid | Issuer → Activity; Finance → Payments → Gateway Payments | Activity | None | None |
| Onboarding Resumed | Issuer → Activity | Not customer visible | None | None |
| Additional Information Required | Issuer → Activity | Activity | None | None |
| Onboarding Restarted | Issuer → Activity | Activity | None | None |
| Onboarding Rejected | Issuer → Activity | Activity + Notification | Onboarding Application Rejected | Follows Admin notification settings |
| Onboarding Rejected (company onboarding) | Issuer → Activity | Activity + Notification | Onboarding Application Rejected | Follows Admin notification settings |
| Onboarding Submission Approved | Issuer → Activity | Activity | None | None |
| Final Approval Completed | Issuer → Activity | Activity + Notification | Onboarding Completed | Follows Admin notification settings |
| Terms and Conditions Approved | Issuer → Activity; Audit → Legal Acceptances | Not customer visible | None | None |
| SSM Approved | Issuer → Activity | Not customer visible | None | None |
| Entity Onboarding Data Approved | Issuer → Activity | Not customer visible | None | None |
| Entity Onboarding Data Rejected | Issuer → Activity | Not customer visible | None | None |
| Action Required: Complete Director/Shareholder Onboarding | Issuer → People | Notification | Action Required: Complete Director/Shareholder Onboarding | Follows Admin notification settings |
| Director/Shareholder Verification | Issuer → People | Email only | Director/Shareholder Verification | Direct email |

### Application

| Activity | Admin Location | Customer Visibility | Notification | Delivery |
| --- | --- | --- | --- | --- |
| Application Created | Application → Activity Timeline | Activity | None | None |
| Application Processing Fee Paid | Application → Activity Timeline; Finance → Payments → Gateway Payments | Activity | None | None |
| Application Submitted | Application → Activity Timeline | Activity + Notification | Application Submitted | Follows Admin notification settings |
| Amendment Request Sent | Application → Activity Timeline | Activity + Notification | Amendment Requested | Follows Admin notification settings |
| Application Resubmitted | Application → Activity Timeline | Activity + Notification | Application Resubmitted | Follows Admin notification settings |
| Application Rejected | Application → Activity Timeline | Activity + Notification | Application Rejected | Follows Admin notification settings |
| Application Withdrawn | Application → Activity Timeline | Activity + Notification | Application Withdrawn | Follows Admin notification settings |
| Application Completed | Application → Activity Timeline | Activity + Notification | Application Completed | Follows Admin notification settings |
| Application Returned to Review | Application → Activity Timeline | Notification | Offer Updated | Follows Admin notification settings |

### Offer

| Activity | Admin Location | Customer Visibility | Notification | Delivery |
| --- | --- | --- | --- | --- |
| Facility Offer Sent | Application → Activity Timeline; Facility → Activity | Activity + Notification | Facility Offer Received | Follows Admin notification settings |
| Facility Offer Acceptance Submitted | Application → Activity Timeline | Activity | None | None |
| Facility Offer Acceptance Resubmitted | Application → Activity Timeline | Activity | None | None |
| Facility Acceptance Approved for Signing | Application → Activity Timeline | Not customer visible | None | None |
| Facility Offer Accepted | Application → Activity Timeline | Activity | None | None |
| Facility Offer Declined | Application → Activity Timeline | Activity + Notification | Facility Offer Declined | Follows Admin notification settings |
| Facility Offer Retracted | Application → Activity Timeline | Activity + Notification | Offer Updated | Follows Admin notification settings |
| Facility Offer Expired | Application → Activity Timeline | Activity + Notification | Offer Expired | Follows Admin notification settings |
| Offer Expiring Soon | Audit → Notifications | Notification | Offer Expiring Soon | Follows Admin notification settings |
| Facility Occupancy Updated | Application → Activity Timeline; Facility → Activity | Activity | None | None |
| Facility Fee Waived | Facility → Activity | Not customer visible | None | None |
| Facility Disabled | Facility → Activity | Notification | Facility Disabled | Follows Admin notification settings |
| Facility Enabled | Facility → Activity | Not customer visible | None | None |
| Large Private Customer Flag Updated | Facility → Activity | Not customer visible | None | None |
| Invoice Offer Sent | Application → Activity Timeline | Activity + Notification | Invoice Offer Received | Follows Admin notification settings |
| Invoice Offer Acceptance Submitted | Application → Activity Timeline | Activity | None | None |
| Invoice Offer Acceptance Resubmitted | Application → Activity Timeline | Activity | None | None |
| Invoice Acceptance Approved for Signing | Application → Activity Timeline | Not customer visible | None | None |
| Invoice Offer Accepted | Application → Activity Timeline | Activity | None | None |
| Invoice Offer Declined | Application → Activity Timeline | Activity + Notification | Invoice Offer Declined | Follows Admin notification settings |
| Invoice Offer Retracted | Application → Activity Timeline | Activity + Notification | Offer Updated | Follows Admin notification settings |
| Invoice Offer Expired | Application → Activity Timeline | Activity + Notification | Offer Expired | Follows Admin notification settings |
| Invoice Withdrawn | Application → Activity Timeline | Activity | None | None |
| Acceptance Documents Need Updates | Application → Acceptance | Notification | Acceptance Documents Need Updates | Follows Admin notification settings |

### Signing

| Activity | Admin Location | Customer Visibility | Notification | Delivery |
| --- | --- | --- | --- | --- |
| Facility Signing Deadline Extended | Application → Activity Timeline | Activity + Notification | Signing Deadline Extended | Follows Admin notification settings |
| Invoice Signing Deadline Extended | Application → Activity Timeline | Activity + Notification | Signing Deadline Extended | Follows Admin notification settings |
| Signing Package Created | Application → Activity Timeline | Not customer visible | None | None |
| Signing Package Sent | Application → Activity Timeline; Application → Acceptance | Activity | Signing Package Email | Direct email |
| Signing Package Completed | Application → Activity Timeline | Activity | None | None |
| Signing Package Declined | Application → Activity Timeline | Activity | None | None |
| Signing Package Expired | Application → Activity Timeline | Activity | None | None |
| Signing Package Voided | Application → Activity Timeline | Not customer visible | None | None |
| Signing Reminder | Application → Acceptance | Email only | Signing Package Email | Direct email |

### Fees / Payments

| Activity | Admin Location | Customer Visibility | Notification | Delivery |
| --- | --- | --- | --- | --- |
| Upfront Facility Fee Payment Required | Facility → Facility & Offer | Notification | Upfront Facility Fee Payment Required | Follows Admin notification settings |
| Facility Fee Paid | Application → Activity Timeline; Finance → Payments → Gateway Payments | Activity + Notification | Upfront Facility Fee Paid | Follows Admin notification settings |
| Facility Fee Collection Waived | Note → Activity | Not customer visible | None | None |
| Outstanding Late Charges to Pay | Note → Activity | Notification | Outstanding Late Charges to Pay | Follows Admin notification settings |
| Late Payment Charges Received | Finance → Payments → Gateway Payments | Notification | Late Payment Charges Received | Follows Admin notification settings |

### Funding / Note

| Activity | Admin Location | Customer Visibility | Notification | Delivery |
| --- | --- | --- | --- | --- |
| Note Created | Note → Activity | Activity | None | None |
| Draft Updated | Note → Activity | Not customer visible | None | None |
| Featured Settings Updated | Note → Activity | Not customer visible | None | None |
| Note Published | Note → Activity | Activity + Notification | Note Published | Follows Admin notification settings |
| Note Unpublished | Note → Activity | Not customer visible | None | None |
| Campaign Paused | Note → Activity | Activity | None | None |
| Campaign Resumed | Note → Activity | Activity | None | None |
| Funding Closed | Note → Activity | Activity + Notification | Funding Closed Successfully | Follows Admin notification settings |
| Funding Unsuccessful | Note → Activity | Activity + Notification | Note Funding Did Not Complete | Follows Admin notification settings |
| Note Activated | Note → Activity | Activity + Notification | Note Is Active | Follows Admin notification settings |
| Note Occupancy Updated | Note → Activity | Not customer visible | None | None |
| Note Fully Repaid | Note → Activity | Notification | Note Repaid | Follows Admin notification settings |

### Disbursement

| Activity | Admin Location | Customer Visibility | Notification | Delivery |
| --- | --- | --- | --- | --- |
| Disbursement Instruction Created | Note → Activity | Not customer visible | None | None |
| Withdrawal Letter Generated | Note → Activity | Not customer visible | None | None |
| Withdrawal Submitted to Trustee | Note → Activity | Notification | Withdrawal Submitted to Trustee | Follows Admin notification settings |
| Withdrawal Beneficiary Updated | Note → Activity | Not customer visible | None | None |
| Trustee Instruction Emailed | Note → Activity | Not customer visible | Trustee Instruction | Direct email |
| Withdrawal Completed | Note → Activity | Activity + Notification | Your Disbursement Is Complete | Follows Admin notification settings |

For a residual return, Admin Activity may show Residual Return Letter Generated, Residual Return Submitted to Trustee, or Residual Return Completed.

### Repayment

| Activity | Admin Location | Customer Visibility | Notification | Delivery |
| --- | --- | --- | --- | --- |
| Repayment Submitted | Note → Activity | Activity | None | None |
| Repayment Received | Note → Activity | Notification | Repayment Received | Follows Admin notification settings |
| Repayment Approved | Note → Activity | Not customer visible | None | None |
| Repayment Rejected | Note → Activity | Notification | Repayment Rejected | Follows Admin notification settings |

### Late / Default

| Activity | Admin Location | Customer Visibility | Notification | Delivery |
| --- | --- | --- | --- | --- |
| Note Entered Arrears | Note → Late Payment; Note → Activity | Notification | Note in Arrears | Follows Admin notification settings |
| Note Defaulted | Note → Activity | Activity + Notification | Your Note Is in Default | Follows Admin notification settings |
| Late Charge Approved | Note → Activity | Not customer visible | None | None |
| Arrears Letter Generated | Note → Activity | Not customer visible | None | None |
| Default Letter Generated | Note → Activity | Not customer visible | None | None |

### Settlement

| Activity | Admin Location | Customer Visibility | Notification | Delivery |
| --- | --- | --- | --- | --- |
| Settlement Approved | Note → Activity | Not customer visible | None | None |
| Settlement Posted | Note → Activity | Activity + Notification | Settlement Posted | Follows Admin notification settings |
| Settlement Trustee Letter Generated | Note → Activity | Not customer visible | None | None |
| Settlement Trustee Letter Submitted | Note → Activity | Not customer visible | None | None |
| Settlement Trustee Instruction Completed | Note → Activity | Not customer visible | None | None |
| Settlement Trustee Email Sent | Note → Activity | Not customer visible | Trustee Instruction | Direct email |

---

## Investor

### Onboarding

| Activity | Admin Location | Customer Visibility | Notification | Delivery |
| --- | --- | --- | --- | --- |
| Onboarding Started | Investor → Activity | Activity | None | None |
| Onboarding Resumed | Investor → Activity | Not customer visible | None | None |
| Additional Information Required | Investor → Activity | Activity | None | None |
| Onboarding Restarted | Investor → Activity | Activity | None | None |
| Onboarding Rejected | Investor → Activity | Activity + Notification | Onboarding Application Rejected | Follows Admin notification settings |
| Onboarding Rejected (company onboarding) | Investor → Activity | Activity + Notification | Onboarding Application Rejected | Follows Admin notification settings |
| Onboarding Submission Approved | Investor → Activity | Activity | None | None |
| Final Approval Completed | Investor → Activity | Activity + Notification | Onboarding Completed | Follows Admin notification settings |
| Terms and Conditions Approved | Investor → Activity; Audit → Legal Acceptances | Not customer visible | None | None |
| Sophisticated Investor Status Updated | Investor → Activity | Not customer visible | None | None |
| SSM Approved | Investor → Activity | Not customer visible | None | None |
| Form Submitted | Investor → Activity | Not customer visible | None | None |
| Entity Onboarding Data Approved | Investor → Activity | Not customer visible | None | None |
| Entity Onboarding Data Rejected | Investor → Activity | Not customer visible | None | None |
| Action Required: Complete Director/Shareholder Onboarding | Investor → People | Notification | Action Required: Complete Director/Shareholder Onboarding | Follows Admin notification settings |
| Director/Shareholder Verification | Investor → People | Email only | Director/Shareholder Verification | Direct email |

### Deposit

| Activity | Admin Location | Customer Visibility | Notification | Delivery |
| --- | --- | --- | --- | --- |
| Bank Account Name Check Started | Finance → Payments → Gateway Payments | Not customer visible | None | None |
| Bank Account Name Check Passed | Finance → Payments → Gateway Payments | Not customer visible | None | None |
| Bank Account Name Check Failed | Finance → Payments → Gateway Payments | Notification | Deposit Verification Failed | Follows Admin notification settings |
| Payment Received Successfully | Finance → Payments → Gateway Payments | Notification | Deposit Successful | Follows Admin notification settings |
| Payment Amount Mismatch | Finance → Payments → Gateway Payments | Not customer visible | None | None |
| Payment Session Expired | Finance → Payments → Gateway Payments | Not customer visible | None | None |
| Refund Started | Finance → Payments → Gateway Payments | Notification | Refund Started | Follows Admin notification settings |
| Refund Completed | Finance → Payments → Gateway Payments | Notification | Refund Completed | Follows Admin notification settings |
| Wallet Update Failed After Refund | Finance → Payments → Gateway Payments | Not customer visible | None | None |

Payment Amount Mismatch may appear as Payment Currency Mismatch when the currency does not match.

### Investment

| Activity | Admin Location | Customer Visibility | Notification | Delivery |
| --- | --- | --- | --- | --- |
| Investment Committed | Note → Activity | Activity + Notification | Investment Committed | Follows Admin notification settings |

### Funding

| Activity | Admin Location | Customer Visibility | Notification | Delivery |
| --- | --- | --- | --- | --- |
| Funding Unsuccessful | Note → Activity | Activity + Notification | Commitment Released | Follows Admin notification settings |
| Note Activated | Note → Activity | Activity + Notification | Investment Is Active | Follows Admin notification settings |

### Repayment / Return

| Activity | Admin Location | Customer Visibility | Notification | Delivery |
| --- | --- | --- | --- | --- |
| Repayment Received | Note → Activity | Notification | Repayment Received | Follows Admin notification settings |
| Settlement Posted | Note → Activity | Activity + Notification | Settlement Posted | Follows Admin notification settings |
| Note Entered Arrears | Note → Late Payment; Note → Activity | Notification | Note in Arrears | Follows Admin notification settings |
| Note Defaulted | Note → Activity | Activity + Notification | Your Investment Is in Default | Follows Admin notification settings |
| Residual Return Completed | Note → Activity | Activity | None | None |

### Withdrawal

| Activity | Admin Location | Customer Visibility | Notification | Delivery |
| --- | --- | --- | --- | --- |
| Cash Withdrawal Submitted | Finance → Investor Withdrawals | Notification | Withdrawal Submitted | Follows Admin notification settings |
| Cash Withdrawal Completed | Finance → Investor Withdrawals | Notification | Withdrawal Completed | Follows Admin notification settings |
| Withdrawal Submitted to Trustee | Note → Activity | Notification | Withdrawal Submitted to Trustee | Follows Admin notification settings |

---

## Admin / Finance

### Application Review

| Activity | Admin Location | Customer Visibility | Notification | Delivery |
| --- | --- | --- | --- | --- |
| Section Approved | Application → Activity Timeline | Not customer visible | None | None |
| Section Rejected | Application → Activity Timeline | Not customer visible | None | None |
| Section Amendment Requested | Application → Activity Timeline | Not customer visible | None | None |
| Section Reset to Pending | Application → Activity Timeline | Not customer visible | None | None |
| Invoice Details Offer Sent | Application → Activity Timeline | Not customer visible | None | None |
| Invoice Details Withdrawn | Application → Activity Timeline | Not customer visible | None | None |
| Item Approved | Application → Activity Timeline | Not customer visible | None | None |
| Item Rejected | Application → Activity Timeline | Not customer visible | None | None |
| Item Amendment Requested | Application → Activity Timeline | Not customer visible | None | None |
| Item Reset to Pending | Application → Activity Timeline | Not customer visible | None | None |

### Organisation / Membership

| Activity | Admin Location | Customer Visibility | Notification | Delivery |
| --- | --- | --- | --- | --- |
| Member Invited | Issuer → Activity; Investor → Activity | Email only | Organisation Invitation | Direct email |
| Member Added | Issuer → Activity; Investor → Activity | Not customer visible | None | None |
| Member Removed | Issuer → Activity; Investor → Activity | Not customer visible | None | None |
| Member Role Changed | Issuer → Activity; Investor → Activity | Not customer visible | None | None |
| Organisation Profile Updated | Issuer → Activity; Investor → Activity | Not customer visible | None | None |
| MARC Assessment Saved | Issuer → Activity | Not customer visible | None | None |
| Onboarding Status Updated | Issuer → Activity; Investor → Activity | Not customer visible | None | None |

### Notes / Prospectus / Paymaster / Tawarruq

| Activity | Admin Location | Customer Visibility | Notification | Delivery |
| --- | --- | --- | --- | --- |
| Prospectus Review Created | Note → Activity | Not customer visible | None | None |
| Prospectus Draft Updated | Note → Activity | Not customer visible | None | None |
| Prospectus Approved | Note → Activity | Not customer visible | None | None |
| Prospectus Approval Cleared After Edit | Note → Activity | Not customer visible | None | None |
| Prospectus Approval Cleared After Source Change | Note → Activity | Not customer visible | None | None |
| Prospectus Approval Cleared After Unpublish | Note → Activity | Not customer visible | None | None |
| Paymaster Notice Generated | Note → Activity | Not customer visible | None | None |
| Paymaster Notice Sent | Note → Activity | Not customer visible | None | None |
| Paymaster Notice Uploaded | Note → Activity | Not customer visible | None | None |
| Paymaster Acknowledgement Uploaded | Note → Activity | Not customer visible | None | None |
| Paymaster Acknowledgement Confirmed | Note → Activity | Not customer visible | None | None |
| Paymaster Created | Application → Activity Timeline; Paymaster → Activity | Not customer visible | None | None |
| Paymaster Linked to Issuer | Application → Activity Timeline; Paymaster → Activity | Not customer visible | None | None |
| Paymaster Identity Verified | Application → Activity Timeline; Paymaster → Activity | Not customer visible | None | None |
| Tawarruq Order Submitted | Note → Activity | Not customer visible | None | None |
| Tawarruq Certificate Retrieved | Note → Activity | Not customer visible | None | None |

### Legal

Legal acceptance records appear under Audit → Legal Acceptances and Audit → External Acceptances. External Acceptances uses the same Audit toolbar as Legal Acceptances (search, filters, export, refresh, and View details).

| Activity | Admin Location | Customer Visibility | Notification | Delivery |
| --- | --- | --- | --- | --- |
| Document Created | Audit → Legal Documents | Not customer visible | None | None |
| Document Updated | Audit → Legal Documents | Not customer visible | None | None |
| Version Uploaded | Audit → Legal Documents | Not customer visible | None | None |
| Version File Replaced | Audit → Legal Documents | Not customer visible | None | None |
| Version Published | Audit → Legal Documents | Not customer visible | None | None |
| Version Archived | Audit → Legal Documents | Not customer visible | None | None |
| Version Restored | Audit → Legal Documents | Not customer visible | None | None |
| Legal Document Accepted | Audit → Legal Acceptances | Not customer visible | None | None |
| External Person or Guarantor Accepted | Audit → External Acceptances | Not customer visible | None | None |

### Payments / Gateway / Reconciliation

Payment activity may appear under both the related Activity timeline and Finance → Payments → Gateway Payments.

| Activity | Admin Location | Customer Visibility | Notification | Delivery |
| --- | --- | --- | --- | --- |
| Bank Account Name Check Started | Finance → Payments → Gateway Payments | Not customer visible | None | None |
| Bank Account Name Check Passed | Finance → Payments → Gateway Payments | Not customer visible | None | None |
| Bank Account Name Check Failed | Finance → Payments → Gateway Payments | Notification | Deposit Verification Failed | Follows Admin notification settings |
| Payment Received Successfully | Finance → Payments → Gateway Payments | Not customer visible | None | None |
| Payment Amount Mismatch | Finance → Payments → Gateway Payments | Not customer visible | None | None |
| Payment Session Expired | Finance → Payments → Gateway Payments | Not customer visible | None | None |
| Refund Started | Finance → Payments → Gateway Payments | Notification | Refund Started | Follows Admin notification settings |
| Refund Completed | Finance → Payments → Gateway Payments | Notification | Refund Completed | Follows Admin notification settings |
| Wallet Update Failed After Refund | Finance → Payments → Gateway Payments | Not customer visible | None | None |
| Reconciliation Completed | Finance → Reconciliation | Not customer visible | None | None |
| Reconciliation Mismatch Found | Finance → Reconciliation | Not customer visible | None | None |

### Access / Security

| Activity | Admin Location | Customer Visibility | Notification | Delivery |
| --- | --- | --- | --- | --- |
| Login | Audit → Access | Not customer visible | None | None |
| Sign Up | Audit → Access | Not customer visible | None | None |
| Logout | Audit → Access | Not customer visible | None | None |
| Password Changed | Audit → Security | Notification | Password Changed | Always Platform + Email |
| Email Verified | Audit → Security | Not customer visible | None | None |
| Role Created | Audit → Security | Not customer visible | None | None |
| Role Permissions Updated | Audit → Security | Not customer visible | None | None |
| Role Added | Audit → Security | Not customer visible | None | None |
| Role Removed | Audit → Security | Not customer visible | None | None |
| Role Switched | Audit → Security | Not customer visible | None | None |
| Invitation Revoked | Audit → Security | Not customer visible | None | None |
| Platform Finance Settings Updated | Audit → Security | Not customer visible | None | None |

### Products

| Activity | Admin Location | Customer Visibility | Notification | Delivery |
| --- | --- | --- | --- | --- |
| Product Created | Audit → Products | Not customer visible | None | None |
| Product Updated | Audit → Products | Not customer visible | None | None |
| Product Deleted | Audit → Products | Not customer visible | None | None |

---

## Notifications

Automatic platform notifications may be delivered through Platform, Email, or both depending on the current Admin notification configuration.

Password Changed is always sent through both channels.

Direct transactional emails are separate from the standard notification configuration.

Custom messages use the channels selected when they are sent.

Platform inbox messages appear in the issuer or investor bell. Send records appear under Audit → Notifications.

Settings → Notifications may use a different name from the customer inbox title shown below.

### Automatic Notifications

| Notification | Sent to | When it is sent | Delivery |
| --- | --- | --- | --- |
| Password Changed | The person who changed the password | Password changed in the portal | Always Platform + Email |
| Onboarding Completed | The onboarding user | Final approval | Follows Admin notification settings |
| Onboarding Application Rejected | The onboarding user | Onboarding rejected | Follows Admin notification settings |
| Action Required: Complete Director/Shareholder Onboarding | Organisation owner | A director or shareholder still needs to complete onboarding | Follows Admin notification settings |
| Amendment Requested | Issuer owner and organisation admins | Amendment pack sent | Follows Admin notification settings |
| Acceptance Documents Need Updates | Issuer owner and organisation admins | First request to update acceptance documents in a cycle | Follows Admin notification settings |
| Application Rejected | Issuer owner and organisation admins | Application rejected | Follows Admin notification settings |
| Facility Offer Received | Issuer owner and organisation admins | Facility offer sent | Follows Admin notification settings |
| Invoice Offer Received | Issuer owner and organisation admins | Invoice offer sent | Follows Admin notification settings |
| Offer Updated | Issuer owner and organisation admins | Offer retracted or application returned to review | Follows Admin notification settings |
| Offer Expired | Issuer owner and organisation admins | Facility or invoice offer expired | Follows Admin notification settings |
| Offer Expiring Soon | Issuer owner and organisation admins | Offer is approaching its deadline | Follows Admin notification settings |
| Application Resubmitted | Issuer owner and organisation admins | Application resubmitted | Follows Admin notification settings |
| Application Withdrawn | Issuer owner and organisation admins | Application withdrawn | Follows Admin notification settings |
| Facility Offer Declined / Invoice Offer Declined | Issuer owner and organisation admins | Offer declined | Follows Admin notification settings |
| Application Completed | Issuer owner and organisation admins | Application completed | Follows Admin notification settings |
| Application Submitted | Issuer owner and organisation admins | Application first submitted | Follows Admin notification settings |
| Signing Deadline Extended | Issuer owner and organisation admins | Facility or invoice signing deadline extended | Follows Admin notification settings |
| Facility Disabled | Issuer owner and organisation admins | Facility disabled | Follows Admin notification settings |
| Note Published | Issuer organisation members | Note published | Follows Admin notification settings |
| Funding Closed Successfully | Issuer organisation members | Funding closed successfully | Follows Admin notification settings |
| Note Funding Did Not Complete | Issuer organisation members | Funding did not complete | Follows Admin notification settings |
| Commitment Released | Investors who had committed | Funding did not complete | Follows Admin notification settings |
| Note Is Active | Issuer organisation members | Note activated | Follows Admin notification settings |
| Investment Is Active | Investors on the Note | Note activated | Follows Admin notification settings |
| Note Repaid | Issuer organisation members | Note fully repaid | Follows Admin notification settings |
| Repayment Received | Investors on the Note | Repayment recorded | Follows Admin notification settings |
| Settlement Posted | Investors on the Note | Settlement posted | Follows Admin notification settings |
| Note in Arrears | Issuer organisation members and investors | Note entered arrears | Follows Admin notification settings |
| Your Note Is in Default | Issuer organisation members | Note marked default | Follows Admin notification settings |
| Your Investment Is in Default | Investors | Note marked default | Follows Admin notification settings |
| Withdrawal Submitted to Trustee | Issuer and/or investor members, depending on the withdrawal | Instruction submitted to trustee | Follows Admin notification settings |
| Repayment Rejected | Issuer organisation members | Repayment rejected | Follows Admin notification settings |
| Your Disbursement Is Complete | Issuer organisation members | Issuer financing disbursement completed | Follows Admin notification settings |
| Upfront Facility Fee Payment Required | Issuer owner and organisation admins | Facility offer accepted and an upfront fee is due | Follows Admin notification settings |
| Upfront Facility Fee Paid | Issuer organisation members | Upfront facility fee paid | Follows Admin notification settings |
| Outstanding Late Charges to Pay | Issuer organisation members | Settlement posted with leftover late charges | Follows Admin notification settings |
| Late Payment Charges Received | Issuer organisation members | Outstanding late charges paid | Follows Admin notification settings |
| Deposit Verification Failed | Investor organisation members | Bank account name check failed | Follows Admin notification settings |
| Refund Started | Investor organisation members | Deposit refund started | Follows Admin notification settings |
| Refund Completed | Investor organisation members | Deposit refund completed | Follows Admin notification settings |
| Deposit Successful | Investor organisation members | Deposit credited | Follows Admin notification settings |
| Investment Committed | The investor who committed | Investment committed | Follows Admin notification settings |
| Withdrawal Submitted | The investor who requested cash withdrawal | Cash withdrawal submitted | Follows Admin notification settings |
| Withdrawal Completed | The investor who requested cash withdrawal | Cash withdrawal completed | Follows Admin notification settings |

### Custom Notifications

| Notification | Sent to | When it is sent | Delivery |
| --- | --- | --- | --- |
| System Announcement | Selected users or a group | Admin sends from Settings → Notifications → Custom & Groups | Channels selected by Admin |
| New Investment Opportunity | Selected investors | Admin sends from Settings → Notifications → Custom & Groups | Channels selected by Admin |

Settings lists New Investment Opportunity as New Product Alert.

### Direct Emails

These are direct emails and are separate from standard platform notifications.

| Email | Trigger | Recipient | Admin Location |
| --- | --- | --- | --- |
| Organisation Invitation | Member invited or invite resent | Invitee | Issuer → Activity; Investor → Activity |
| Admin Invitation | Admin invited or invite resent | Invitee | Audit → Security |
| Signing Package | Signing package sent | Named signer | Application → Acceptance |
| Signing Reminder | Reminder requested | Named signer | Application → Acceptance |
| Invoice Offer Verification Code | Issuer requests a code to accept an invoice offer | Selected signatory | No current Admin UI |
| Director/Shareholder Verification | The person must verify | The person | Issuer → People; Investor → People |
| Trustee Instruction | Trustee letter is sent | Trustee recipients | Note → Activity |
