---
title: "Operations Guide: Activity, Logs and Notifications"
description: Where Finance and Operations check Activity, payments, legal proof, and customer messages.
category: Platform Operations
tags:
  - admin
  - operations
  - audit
  - notifications
order: 29
updated: 2026-08-31
---

Customer **Activity** is the issuer or investor Activity feed. Admin timelines show more than customers see.

**Payment confirmation:** use **Finance → Payments → Gateway Payments**. Do not use Activity alone as payment proof.

**Legal acceptance:** use **Audit → Legal Acceptances**. For an external guarantor, use **Audit → External Acceptances**. Do not use Activity alone as legal proof.

**Signing status:** use **Application → Acceptance**. Declined means the signer said no. Voided means Operations cancelled the signing package.

This page is a day-to-day guide. It does not list every system event code. For the complete list of audit events and notification types, use the Audit Log Register and Notification Register in the project documentation.

## Where to check

| If you need to know... | Check here |
| --- | --- |
| What happened during onboarding? | Issuer → Activity or Investor → Activity |
| What happened to an application? | Application → Activity Timeline |
| What happened to a facility? | Facility → Activity |
| What happened during signing? | Application → Acceptance |
| What happened to a Note? | Note → Activity |
| Did a payment succeed? | Finance → Payments → Gateway Payments |
| Did reconciliation match? | Finance → Reconciliation |
| Was a legal document accepted? | Audit → Legal Acceptances |
| Did a guarantor accept? | Audit → External Acceptances |
| Was a platform notification sent? | Audit → Notifications |
| Who logged in or changed permissions? | Audit → Access or Audit → Security |

## How to read the tables

| Column | Meaning |
| --- | --- |
| Activity | What happened, in Operations wording |
| Customer Visibility | What the customer can see |
| Admin Location | Where Operations should look |
| Notification | Customer inbox title, or None. Admin Settings may use a slightly different name |
| Delivery | How the message is sent |

**Customer Visibility**

- **Activity** — appears on the customer Activity feed
- **Notification** — inbox and/or email, depending on settings
- **Activity + Notification** — both
- **Email only** — a direct email, not a platform inbox message
- **No customer-facing activity** — Admin can see it; the customer Activity feed does not

**Delivery**

- **Follows Admin notification settings** — Platform and/or email, according to **Settings → Notifications → Configuration**
- **Always Platform + Email** — cannot be turned off
- **Direct email** — not controlled by those settings, and not listed in Audit → Notifications
- **Channels chosen when sending** — Admin chooses Platform and/or email at send time
- **None** — no message

Password Changed is always Platform + Email. Other automatic messages follow the current Admin configuration.

On the customer Activity feed, **Final Approval Completed** may appear as **Onboarding Approved**. In Admin it is **Final Approval Completed**.

---

## Issuer Journey

### 1. Onboarding

| Activity | Customer Visibility | Admin Location | Notification | Delivery |
| --- | --- | --- | --- | --- |
| Onboarding Started | Activity | Issuer → Activity | None | None |
| Onboarding Fee Paid | Activity | Issuer → Activity. Finance → Payments → Gateway Payments | None | None |
| Onboarding Resumed | No customer-facing activity | Issuer → Activity | None | None |
| Additional Information Required | Activity | Issuer → Activity | None | None |
| Onboarding Restarted | Activity | Issuer → Activity | None | None |
| Onboarding Reset | No customer-facing activity | Issuer → Activity | None | None |
| Onboarding Rejected | Activity + Notification | Issuer → Activity | Onboarding Application Rejected | Follows Admin notification settings |
| Corporate Onboarding Rejected | Activity + Notification | Issuer → Activity | Onboarding Application Rejected | Follows Admin notification settings |
| Onboarding Submission Approved | Activity | Issuer → Activity | None | None |
| Final Approval Completed | Activity + Notification | Issuer → Activity | Onboarding Completed | Follows Admin notification settings |
| Terms and Conditions Approved | No customer-facing activity | Issuer → Activity. Audit → Legal Acceptances | None | None |
| AML Approved | No customer-facing activity | Issuer → Activity | None | None |
| Company Registry Check Approved | No customer-facing activity | Issuer → Activity | None | None |
| Enhanced Due Diligence Approved | No customer-facing activity | Issuer → Activity | None | None |
| Enhanced Due Diligence Rejected | No customer-facing activity | Issuer → Activity | None | None |
| Action Required: Complete Director/Shareholder Onboarding | Notification | Issuer → People | Action Required: Complete Director/Shareholder Onboarding | Follows Admin notification settings |
| Director/Shareholder Verification | Email only | Issuer → People | Director/Shareholder Verification | Direct email |

### 2. Application

| Activity | Customer Visibility | Admin Location | Notification | Delivery |
| --- | --- | --- | --- | --- |
| Application Created | Activity | Application → Activity Timeline | None | None |
| Application Processing Fee Paid | Activity | Application → Activity Timeline. Finance → Payments → Gateway Payments | None | None |
| Application Submitted | Activity + Notification | Application → Activity Timeline | Application Submitted | Follows Admin notification settings |
| Amendment Request Sent | Activity + Notification | Application → Activity Timeline | Amendment Requested | Follows Admin notification settings |
| Application Resubmitted | Activity + Notification | Application → Activity Timeline | Application Resubmitted | Follows Admin notification settings |
| Application Rejected | Activity + Notification | Application → Activity Timeline | Application Rejected | Follows Admin notification settings |
| Application Withdrawn | Activity + Notification | Application → Activity Timeline | Application Withdrawn | Follows Admin notification settings |
| Application Completed | Activity + Notification | Application → Activity Timeline | Application Completed | Follows Admin notification settings |
| Application Returned to Review | Notification | Application → Activity Timeline | Offer Updated | Follows Admin notification settings |

The customer Activity feed labels Application Created as **Application Started**.

### 3. Offer

| Activity | Customer Visibility | Admin Location | Notification | Delivery |
| --- | --- | --- | --- | --- |
| Facility Offer Sent | Activity + Notification | Application → Activity Timeline. Facility → Activity | Facility Offer Received | Follows Admin notification settings |
| Facility Offer Acceptance Submitted | Activity | Application → Activity Timeline | None | None |
| Facility Offer Acceptance Resubmitted | Activity | Application → Activity Timeline | None | None |
| Facility Acceptance Approved for Signing | No customer-facing activity | Application → Activity Timeline | None | None |
| Facility Offer Accepted | Activity | Application → Activity Timeline | None | None |
| Facility Offer Declined | Activity + Notification | Application → Activity Timeline | Facility Offer Declined | Follows Admin notification settings |
| Facility Offer Retracted | Activity + Notification | Application → Activity Timeline | Offer Updated | Follows Admin notification settings |
| Facility Offer Expired | Activity + Notification | Application → Activity Timeline | Offer Expired | Follows Admin notification settings |
| Offer Expiring Soon | Notification | Audit → Notifications | Offer Expiring Soon | Follows Admin notification settings |
| Facility Occupancy Updated | Activity | Facility → Activity | None | None |
| Facility Fee Waived | No customer-facing activity | Facility → Activity | None | None |
| Facility Disabled | Notification | Facility → Activity | Facility Disabled | Follows Admin notification settings |
| Facility Enabled | No customer-facing activity | Facility → Activity | None | None |
| Large Private Customer Flag Updated | No customer-facing activity | Facility → Activity | None | None |
| Invoice Offer Sent | Activity + Notification | Application → Activity Timeline | Invoice Offer Received | Follows Admin notification settings |
| Invoice Offer Acceptance Submitted | Activity | Application → Activity Timeline | None | None |
| Invoice Offer Acceptance Resubmitted | Activity | Application → Activity Timeline | None | None |
| Invoice Acceptance Approved for Signing | No customer-facing activity | Application → Activity Timeline | None | None |
| Invoice Offer Accepted | Activity | Application → Activity Timeline | None | None |
| Invoice Offer Declined | Activity + Notification | Application → Activity Timeline | Invoice Offer Declined | Follows Admin notification settings |
| Invoice Offer Retracted | Activity + Notification | Application → Activity Timeline | Offer Updated | Follows Admin notification settings |
| Invoice Offer Expired | Activity + Notification | Application → Activity Timeline | Offer Expired | Follows Admin notification settings |
| Invoice Withdrawn | Activity | Application → Activity Timeline | None | None |
| Acceptance Documents Need Updates | Notification | Application → Acceptance | Acceptance Documents Need Updates | Follows Admin notification settings |
| Invoice Offer Verification Code | Email only | Application → Acceptance | Invoice Offer Verification Code | Direct email |

Offer Expiring Soon is a reminder only. It does not create an Activity Timeline row. Check the application for the offer deadline, and Audit → Notifications for the message.

### 4. Signing

Declined means the signer said no. Voided means Operations cancelled the signing package.

Whether the signer opened the link is on **Application → Acceptance**, not on the Activity Timeline.

| Activity | Customer Visibility | Admin Location | Notification | Delivery |
| --- | --- | --- | --- | --- |
| Facility Signing Deadline Extended | Activity + Notification | Application → Activity Timeline | Signing Deadline Extended | Follows Admin notification settings |
| Invoice Signing Deadline Extended | Activity + Notification | Application → Activity Timeline | Signing Deadline Extended | Follows Admin notification settings |
| Signing Package Created | No customer-facing activity | Application → Activity Timeline | None | None |
| Signing Package Sent | Activity | Application → Activity Timeline. Application → Acceptance | Signing Package Email | Direct email |
| Signing Package Completed | Activity | Application → Activity Timeline | None | None |
| Signing Package Declined | Activity | Application → Activity Timeline | None | None |
| Signing Package Expired | Activity | Application → Activity Timeline | None | None |
| Signing Package Voided | No customer-facing activity | Application → Activity Timeline | None | None |
| Signing reminder | Email only | Application → Acceptance | Signing Package Email | Direct email |

A signing reminder emails the signer again. It does not create a second Activity Timeline row.

### 5. Fees / Payments

For payment confirmation, use **Finance → Payments → Gateway Payments**. Do not use Activity alone as payment proof.

| Activity | Customer Visibility | Admin Location | Notification | Delivery |
| --- | --- | --- | --- | --- |
| Upfront Facility Fee Payment Required | Notification | Facility → Facility & Offer | Upfront Facility Fee Payment Required | Follows Admin notification settings |
| Facility Fee Paid | Activity + Notification | Application → Activity Timeline. Finance → Payments → Gateway Payments | Upfront Facility Fee Paid | Follows Admin notification settings |
| Facility Fee Collection Waived | No customer-facing activity | Note → Activity | None | None |
| Outstanding Late Charges to Pay | Notification | Note → Activity | Outstanding Late Charges to Pay | Follows Admin notification settings |
| Late Payment Charges Received | Notification | Finance → Payments → Gateway Payments | Late Payment Charges Received | Follows Admin notification settings |

### 6. Funding / Note

| Activity | Customer Visibility | Admin Location | Notification | Delivery |
| --- | --- | --- | --- | --- |
| Note Created | Activity | Note → Activity | None | None |
| Draft Updated | No customer-facing activity | Note → Activity | None | None |
| Featured Settings Updated | No customer-facing activity | Note → Activity | None | None |
| Note Published | Activity + Notification | Note → Activity | Note Published | Follows Admin notification settings |
| Note Unpublished | No customer-facing activity | Note → Activity | None | None |
| Campaign Paused | Activity | Note → Activity | None | None |
| Campaign Resumed | Activity | Note → Activity | None | None |
| Funding Closed | Activity + Notification | Note → Activity | Funding Closed Successfully | Follows Admin notification settings |
| Funding Unsuccessful | Activity + Notification | Note → Activity | Note Funding Did Not Complete | Follows Admin notification settings |
| Note Activated | Activity + Notification | Note → Activity | Note Is Active | Follows Admin notification settings |
| Note Occupancy Updated | No customer-facing activity | Note → Activity | None | None |
| Note fully repaid | Notification | Note → Activity | Note Repaid | Follows Admin notification settings |

### 7. Disbursement

| Activity | Customer Visibility | Admin Location | Notification | Delivery |
| --- | --- | --- | --- | --- |
| Disbursement Instruction Created | No customer-facing activity | Note → Activity | None | None |
| Withdrawal Letter Generated | No customer-facing activity | Note → Activity | None | None |
| Withdrawal Submitted to Trustee | Notification | Note → Activity | Withdrawal Submitted to Trustee | Follows Admin notification settings |
| Withdrawal Beneficiary Updated | No customer-facing activity | Note → Activity | None | None |
| Trustee Instruction Emailed | No customer-facing activity | Note → Activity | Trustee Instruction | Direct email |
| Withdrawal Completed | Activity + Notification | Note → Activity | Your Disbursement Is Complete | Follows Admin notification settings |

If the withdrawal is a residual return, Admin Activity may show **Residual Return Letter Generated**, **Residual Return Submitted to Trustee**, or **Residual Return Completed** instead of the withdrawal wording.

### 8. Repayment

| Activity | Customer Visibility | Admin Location | Notification | Delivery |
| --- | --- | --- | --- | --- |
| Repayment Submitted | Activity | Note → Activity | None | None |
| Repayment Received | Notification (investor) | Note → Activity | Repayment Received | Follows Admin notification settings |
| Repayment Approved | No customer-facing activity | Note → Activity | None | None |
| Repayment Rejected | Notification | Note → Activity | Repayment Rejected | Follows Admin notification settings |

Repayment Submitted is used when the issuer payment needs Admin review. Repayment Received is used when the repayment is recorded without that review. They are not both written for the same payment.

### 9. Late / Default

| Activity | Customer Visibility | Admin Location | Notification | Delivery |
| --- | --- | --- | --- | --- |
| Note Entered Arrears | Notification | Note → Late Payment. Note → Activity | Note in Arrears | Follows Admin notification settings |
| Note Defaulted | Activity + Notification | Note → Activity | Your Note Is in Default | Follows Admin notification settings |
| Late Charge Approved | No customer-facing activity | Note → Activity | None | None |
| Arrears Letter Generated | No customer-facing activity | Note → Activity | None | None |
| Default Letter Generated | No customer-facing activity | Note → Activity | None | None |

### 10. Settlement

| Activity | Customer Visibility | Admin Location | Notification | Delivery |
| --- | --- | --- | --- | --- |
| Settlement Approved | No customer-facing activity | Note → Activity | None | None |
| Settlement Posted | Activity + Notification (investor) | Note → Activity | Settlement Posted | Follows Admin notification settings |
| Settlement Trustee Letter Generated | No customer-facing activity | Note → Activity | None | None |
| Settlement Trustee Letter Submitted | No customer-facing activity | Note → Activity | None | None |
| Settlement Trustee Instruction Completed | No customer-facing activity | Note → Activity | None | None |
| Settlement Trustee Email Sent | No customer-facing activity | Note → Activity | Trustee Instruction | Direct email |

Previewing a settlement does not create an Activity row.

---

## Investor Journey

### 1. Onboarding

| Activity | Customer Visibility | Admin Location | Notification | Delivery |
| --- | --- | --- | --- | --- |
| Onboarding Started | Activity | Investor → Activity | None | None |
| Onboarding Resumed | No customer-facing activity | Investor → Activity | None | None |
| Additional Information Required | Activity | Investor → Activity | None | None |
| Onboarding Restarted | Activity | Investor → Activity | None | None |
| Onboarding Reset | No customer-facing activity | Investor → Activity | None | None |
| Onboarding Rejected | Activity + Notification | Investor → Activity | Onboarding Application Rejected | Follows Admin notification settings |
| Onboarding Submission Approved | Activity | Investor → Activity | None | None |
| Final Approval Completed | Activity + Notification | Investor → Activity | Onboarding Completed | Follows Admin notification settings |
| Terms and Conditions Approved | No customer-facing activity | Investor → Activity. Audit → Legal Acceptances | None | None |
| Sophisticated Investor Status Updated | No customer-facing activity | Investor → Activity | None | None |
| AML Approved | No customer-facing activity | Investor → Activity | None | None |
| Company Registry Check Approved | No customer-facing activity | Investor → Activity | None | None |
| Enhanced Due Diligence Approved | No customer-facing activity | Investor → Activity | None | None |
| Enhanced Due Diligence Rejected | No customer-facing activity | Investor → Activity | None | None |
| Action Required: Complete Director/Shareholder Onboarding | Notification | Investor → People | Action Required: Complete Director/Shareholder Onboarding | Follows Admin notification settings |
| Director/Shareholder Verification | Email only | Investor → People | Director/Shareholder Verification | Direct email |

### 2. Deposit

For payment confirmation, use **Finance → Payments → Gateway Payments**. Do not use Activity alone as payment proof.

| Activity | Customer Visibility | Admin Location | Notification | Delivery |
| --- | --- | --- | --- | --- |
| Bank Account Name Check Started | No customer-facing activity | Finance → Payments → Gateway Payments | None | None |
| Bank Account Name Check Passed | No customer-facing activity | Finance → Payments → Gateway Payments | None | None |
| Bank Account Name Check Failed | Notification | Finance → Payments → Gateway Payments | Deposit Verification Failed | Follows Admin notification settings |
| Payment Received Successfully | Notification | Finance → Payments → Gateway Payments | Deposit Successful | Follows Admin notification settings |
| Payment Amount Mismatch | No customer-facing activity | Finance → Payments → Gateway Payments | None | None |
| Payment Session Expired | No customer-facing activity | Finance → Payments → Gateway Payments | None | None |
| Refund Started | Notification | Finance → Payments → Gateway Payments | Refund Started | Follows Admin notification settings |
| Refund Completed | Notification | Finance → Payments → Gateway Payments | Refund Completed | Follows Admin notification settings |
| Wallet Update Failed After Refund | No customer-facing activity | Finance → Payments → Gateway Payments | None | None |

If the captured currency is wrong, Admin may show **Payment Currency Mismatch** instead of Payment Amount Mismatch.

### 3. Investment

| Activity | Customer Visibility | Admin Location | Notification | Delivery |
| --- | --- | --- | --- | --- |
| Investment Committed | Activity + Notification | Note → Activity | Investment Committed | Follows Admin notification settings |

### 4. Funding

| Activity | Customer Visibility | Admin Location | Notification | Delivery |
| --- | --- | --- | --- | --- |
| Funding Unsuccessful | Activity + Notification | Note → Activity | Commitment Released | Follows Admin notification settings |
| Note Activated | Activity + Notification | Note → Activity | Investment Is Active | Follows Admin notification settings |

### 5. Repayment / Return

| Activity | Customer Visibility | Admin Location | Notification | Delivery |
| --- | --- | --- | --- | --- |
| Repayment Received | Notification | Note → Activity | Repayment Received | Follows Admin notification settings |
| Settlement Posted | Activity + Notification | Note → Activity | Settlement Posted | Follows Admin notification settings |
| Note Entered Arrears | Notification | Note → Late Payment | Note in Arrears | Follows Admin notification settings |
| Note Defaulted | Activity + Notification | Note → Activity | Your Investment Is in Default | Follows Admin notification settings |
| Residual Return Completed | Activity | Note → Activity | None | None |

### 6. Withdrawal

| Activity | Customer Visibility | Admin Location | Notification | Delivery |
| --- | --- | --- | --- | --- |
| Cash withdrawal submitted | Notification | Finance → Investor Withdrawals | Withdrawal Submitted | Follows Admin notification settings |
| Cash withdrawal completed | Notification | Finance → Investor Withdrawals | Withdrawal Completed | Follows Admin notification settings |
| Withdrawal Submitted to Trustee | Notification | Note → Activity | Withdrawal Submitted to Trustee | Follows Admin notification settings |

---

## Admin / Finance / Support

### 1. Application Review

| Activity | Customer Visibility | Admin Location | Notification | Delivery |
| --- | --- | --- | --- | --- |
| Section Approved | No customer-facing activity | Application → Activity Timeline | None | None |
| Section Rejected | No customer-facing activity | Application → Activity Timeline | None | None |
| Section Amendment Requested | No customer-facing activity | Application → Activity Timeline | None | None |
| Section Reset to Pending | No customer-facing activity | Application → Activity Timeline | None | None |
| Item Approved | No customer-facing activity | Application → Activity Timeline | None | None |
| Item Rejected | No customer-facing activity | Application → Activity Timeline | None | None |
| Item Amendment Requested | No customer-facing activity | Application → Activity Timeline | None | None |
| Item Reset to Pending | No customer-facing activity | Application → Activity Timeline | None | None |

Sending the amendment pack to the issuer is **Amendment Request Sent** on the Application journey, not a section row.

### 2. Organisation / Membership

| Activity | Customer Visibility | Admin Location | Notification | Delivery |
| --- | --- | --- | --- | --- |
| Member Invited | Email only | Issuer → Activity or Investor → Activity | Organisation Invitation | Direct email |
| Member Added | No customer-facing activity | Issuer → Activity or Investor → Activity | None | None |
| Member Removed | No customer-facing activity | Issuer → Activity or Investor → Activity | None | None |
| Member Role Changed | No customer-facing activity | Issuer → Activity or Investor → Activity | None | None |
| Organisation Profile Updated | No customer-facing activity | Issuer → Activity or Investor → Activity | None | None |
| MARC Assessment Saved | No customer-facing activity | Issuer → Activity or Investor → Activity | None | None |
| Onboarding Status Updated | No customer-facing activity | Issuer → Activity or Investor → Activity | None | None |
| Identity Documents Submitted | No customer-facing activity | Issuer → Activity or Investor → Activity | None | None |

### 3. Notes / Prospectus / Paymaster / Tawarruq

| Activity | Customer Visibility | Admin Location | Notification | Delivery |
| --- | --- | --- | --- | --- |
| Prospectus Review Created | No customer-facing activity | Note → Activity | None | None |
| Prospectus Draft Updated | No customer-facing activity | Note → Activity | None | None |
| Prospectus Approved | No customer-facing activity | Note → Activity | None | None |
| Prospectus Approval Cleared After Edit | No customer-facing activity | Note → Activity | None | None |
| Prospectus Approval Cleared After Source Change | No customer-facing activity | Note → Activity | None | None |
| Prospectus Approval Cleared After Unpublish | No customer-facing activity | Note → Activity | None | None |
| Paymaster Notice Generated | No customer-facing activity | Note → Activity | None | None |
| Paymaster Notice Sent | No customer-facing activity | Note → Activity | None | None |
| Paymaster Notice Uploaded | No customer-facing activity | Note → Activity | None | None |
| Paymaster Acknowledgement Uploaded | No customer-facing activity | Note → Activity | None | None |
| Paymaster Acknowledgement Confirmed | No customer-facing activity | Note → Activity | None | None |
| Tawarruq Order Submitted | No customer-facing activity | Note → Activity | None | None |
| Tawarruq Certificate Retrieved | No customer-facing activity | Note → Activity | None | None |

### 4. Legal

For proof of document acceptance, use **Audit → Legal Acceptances** or **Audit → External Acceptances**. Do not use Activity alone as legal proof.

| Activity | Customer Visibility | Admin Location | Notification | Delivery |
| --- | --- | --- | --- | --- |
| Document Created | No customer-facing activity | Audit → Legal Documents | None | None |
| Document Updated | No customer-facing activity | Audit → Legal Documents | None | None |
| Version Uploaded | No customer-facing activity | Audit → Legal Documents | None | None |
| Version File Replaced | No customer-facing activity | Audit → Legal Documents | None | None |
| Version Published | No customer-facing activity | Audit → Legal Documents | None | None |
| Version Archived | No customer-facing activity | Audit → Legal Documents | None | None |
| Version Restored | No customer-facing activity | Audit → Legal Documents | None | None |
| Legal Document Accepted | No customer-facing activity | Audit → Legal Acceptances | None | None |
| External Person or Guarantor Accepted | No customer-facing activity | Audit → External Acceptances | None | None |

Generated letters appear on **Note → Activity**. A stored document hash is kept for investigation and has no Admin screen.

### 5. Payments / Gateway / Reconciliation

For payment confirmation, use **Finance → Payments → Gateway Payments**. Do not use Activity alone as payment proof.

Onboarding fees, application processing fees, facility fees, and deposits all appear here as **Payment Received Successfully** when capture completes. The matching Activity milestone (if any) is on the issuer, application, or Note record.

| Activity | Customer Visibility | Admin Location | Notification | Delivery |
| --- | --- | --- | --- | --- |
| Bank Account Name Check Started | No customer-facing activity | Finance → Payments → Gateway Payments | None | None |
| Bank Account Name Check Passed | No customer-facing activity | Finance → Payments → Gateway Payments | None | None |
| Bank Account Name Check Failed | Notification | Finance → Payments → Gateway Payments | Deposit Verification Failed | Follows Admin notification settings |
| Payment Received Successfully | Notification (deposit) or Activity (fees) | Finance → Payments → Gateway Payments | Deposit Successful, when it is a deposit | Follows Admin notification settings |
| Payment Amount Mismatch | No customer-facing activity | Finance → Payments → Gateway Payments | None | None |
| Payment Session Expired | No customer-facing activity | Finance → Payments → Gateway Payments | None | None |
| Refund Started | Notification | Finance → Payments → Gateway Payments | Refund Started | Follows Admin notification settings |
| Refund Completed | Notification | Finance → Payments → Gateway Payments | Refund Completed | Follows Admin notification settings |
| Wallet Update Failed After Refund | No customer-facing activity | Finance → Payments → Gateway Payments | None | None |
| Reconciliation completed | No customer-facing activity | Finance → Reconciliation | None | None |
| Reconciliation mismatch found | No customer-facing activity | Finance → Reconciliation | None | None |

### 6. Access / Security

| Activity | Customer Visibility | Admin Location | Notification | Delivery |
| --- | --- | --- | --- | --- |
| Login | No customer-facing activity | Audit → Access | None | None |
| Sign Up | No customer-facing activity | Audit → Access | None | None |
| Logout | No customer-facing activity | Audit → Access | None | None |
| Password Changed | Notification | Audit → Security | Password Changed | Always Platform + Email |
| Email Verified | No customer-facing activity | Audit → Security | None | None |
| Role Created | No customer-facing activity | Audit → Security | None | None |
| Role Permissions Updated | No customer-facing activity | Audit → Security | None | None |
| Role Added | No customer-facing activity | Audit → Security | None | None |
| Role Removed | No customer-facing activity | Audit → Security | None | None |
| Role Switched | No customer-facing activity | Audit → Security | None | None |
| Invitation Revoked | No customer-facing activity | Audit → Security | None | None |
| Platform Finance Settings Updated | No customer-facing activity | Audit → Security | None | None |

Admin invitations are a direct email. Revoking an invitation is the Access / Security row above. Sending the invite does not appear in Audit → Notifications.

Forgot password and Admin authenticator reset are handled by the authentication service, not by Activity.

### 7. Products

| Activity | Customer Visibility | Admin Location | Notification | Delivery |
| --- | --- | --- | --- | --- |
| Product Created | No customer-facing activity | Audit → Products | None | None |
| Product Updated | No customer-facing activity | Audit → Products | None | None |
| Product Deleted | No customer-facing activity | Audit → Products | None | None |

Creating a product does not automatically send **New Investment Opportunity**. That message is sent only from **Settings → Notifications → Custom & Groups**.

### 8. Notifications

Platform inbox messages appear in the issuer or investor bell. Whether a typed message was sent is recorded in **Audit → Notifications**.

The name in **Settings → Notifications** and the **Event** column in Audit → Notifications can differ from the title in the customer inbox. This guide uses the inbox title in the Notification column.

Examples:

- Admin Activity **Facility Offer Sent** → customer message **Facility Offer Received**
- Settings **Offer Retracted or Reset** → customer message **Offer Updated**
- Settings **Offer Expiry Reminder** → customer message **Offer Expiring Soon**
- Settings **Onboarding Rejected** → customer message **Onboarding Application Rejected**
- Settings **Disbursement completed** → customer message **Your Disbursement Is Complete**

Some Note inbox titles use sentence case (for example **Note published**).

#### How notification delivery works

- Admin can control **Platform** and **Email** for supported automatic types under **Settings → Notifications → Configuration**.
- Changing those settings affects future automatic notifications.
- **Password Changed** is always sent through both supported channels and cannot be disabled.
- **Custom & Groups** messages use the channel choices selected when the message is sent.
- Direct transactional emails are separate and do not follow the normal notification settings.

If both Platform and Email are off for a type, that automatic message is not sent.

**Reset to default** turns Platform and Email on for every type. Confirm in the popup before continuing.

#### Direct emails

These emails are sent directly as part of the related process and do not follow the normal Platform/Email notification configuration.

They do **not** appear in Audit → Notifications.

| Email | Trigger | Recipient | Configurable? | Where to check |
| --- | --- | --- | --- | --- |
| Organisation Invitation | Member invited or invite resent | Invitee | No. Always sent when the invite runs | Issuer → Activity or Investor → Activity |
| Admin Invitation | Admin invited or invite resent | Invitee | No | Audit → Security (revoke only) |
| Signing Package / Reminder | Signing package sent, or reminder requested | Named signer | No | Application → Acceptance |
| Invoice Offer Verification Code | Issuer requests a code to accept an invoice offer | Selected signatory | No | Application → Acceptance (the offer). The code record has no Admin screen |
| Director/Shareholder Verification | The person must verify | The person | No | Issuer → People or Investor → People |
| Trustee Instruction | Trustee letter is sent | Trustee recipients | Trustee recipient config, not notification settings | Note → Activity |

#### Automatic platform messages

Delivery follows Admin notification settings, except **Password Changed** (always Platform + Email).

| Notification | Sent to | When it is sent |
| --- | --- | --- |
| Password Changed | The person who changed the password | Password changed in the portal |
| Onboarding Completed | The onboarding user | Final approval |
| Onboarding Application Rejected | The onboarding user | Onboarding rejected |
| Action Required: Complete Director/Shareholder Onboarding | Organisation owner | A director or shareholder still needs to complete onboarding |
| Amendment Requested | Issuer owner and organisation admins | Amendment pack sent |
| Acceptance Documents Need Updates | Issuer owner and organisation admins | First request to update acceptance documents in a cycle |
| Application Rejected | Issuer owner and organisation admins | Application rejected |
| Facility Offer Received | Issuer owner and organisation admins | Facility offer sent |
| Invoice Offer Received | Issuer owner and organisation admins | Invoice offer sent |
| Offer Updated | Issuer owner and organisation admins | Offer retracted or application returned to review |
| Offer Expired | Issuer owner and organisation admins | Facility or invoice offer expired |
| Offer Expiring Soon | Issuer owner and organisation admins | Offer is approaching its deadline |
| Application Resubmitted | Issuer owner and organisation admins | Application resubmitted |
| Application Withdrawn | Issuer owner and organisation admins | Application withdrawn |
| Facility Offer Declined / Invoice Offer Declined | Issuer owner and organisation admins | Offer declined |
| Application Completed | Issuer owner and organisation admins | Application completed |
| Application Submitted | Issuer owner and organisation admins | Application first submitted |
| Signing Deadline Extended | Issuer owner and organisation admins | Facility or invoice signing deadline extended |
| Facility Disabled | Issuer owner and organisation admins | Facility disabled |
| Note Published | Issuer organisation members | Note published |
| Funding Closed Successfully | Issuer organisation members | Funding closed successfully |
| Note Funding Did Not Complete | Issuer organisation members | Funding did not complete |
| Commitment Released | Investors who had committed | Funding did not complete |
| Note Is Active | Issuer organisation members | Note activated |
| Investment Is Active | Investors on the Note | Note activated |
| Note Repaid | Issuer organisation members | Note fully repaid |
| Repayment Received | Investors on the Note | Repayment recorded |
| Settlement Posted | Investors on the Note | Settlement posted |
| Note in Arrears | Issuer organisation members and investors | Note entered arrears |
| Your Note Is in Default | Issuer organisation members | Note marked default |
| Your Investment Is in Default | Investors | Note marked default |
| Withdrawal Submitted to Trustee | Issuer and/or investor members, depending on the withdrawal | Instruction submitted to trustee |
| Repayment Rejected | Issuer organisation members | Repayment rejected |
| Your Disbursement Is Complete | Issuer organisation members | Issuer financing disbursement completed |
| Upfront Facility Fee Payment Required | Issuer owner and organisation admins | Facility offer accepted and an upfront fee is due |
| Upfront Facility Fee Paid | Issuer organisation members | Upfront facility fee paid |
| Outstanding Late Charges to Pay | Issuer organisation members | Settlement posted with leftover late charges |
| Late Payment Charges Received | Issuer organisation members | Outstanding late charges paid |
| Deposit Verification Failed | Investor organisation members | Bank account name check failed |
| Refund Started | Investor organisation members | Deposit refund started |
| Refund Completed | Investor organisation members | Deposit refund completed |
| Deposit Successful | Investor organisation members | Deposit credited |
| Investment Committed | The investor who committed | Investment committed |
| Withdrawal Submitted | The investor who requested cash withdrawal | Cash withdrawal submitted |
| Withdrawal Completed | The investor who requested cash withdrawal | Cash withdrawal completed |

#### Custom messages

**System Announcement** and **New Investment Opportunity** (Settings name: **New Product Alert**) are sent from **Settings → Notifications → Custom & Groups**. Delivery uses the channels chosen when sending. Check **Audit → Notifications**.

---

## Supporting Investigation Records

These are not the customer Activity feed. Use them when you need payment proof, legal proof, or support investigation.

| Record | What it helps confirm | Where to check |
| --- | --- | --- |
| Login session | A session was issued | No dedicated Admin screen |
| Signer viewed the package | The signer opened the signing link | Application → Acceptance |
| Reviewer comments | Comments entered during application review | Application review |
| Checkout attempt | A payment session was attempted | Finance → Payments → Gateway Payments |
| Payment receipt | Receipt file generated or retried | Finance → Payments → Gateway Payments |
| Reconciliation completed | A settlement reconciliation run | Finance → Reconciliation |
| Reconciliation mismatch found | An unmatched or mismatched payment | Finance → Reconciliation |
| Investor wallet movement | Deposit, invest, refund, or cash withdrawal | Finance → Investor Withdrawals |
| Note ledger | Amounts posted on the Note | Note → Ledger |
| Notification delivery record | A platform inbox or email message was sent | Audit → Notifications |

Raw payment-provider updates and some identity-provider updates are stored for investigation and have no Admin screen. Use Gateway Payments for payment proof, and Issuer/Investor → Activity for the business onboarding result.

---

## Known Coverage Gaps

These live actions can happen without a normal Activity row. They are not listed as expected Activity in the tables above.

| Action | What Operations should know | Where to check instead |
| --- | --- | --- |
| User cancelled onboarding | No Activity row is written | Issuer → Activity or Investor → Activity if they later restart |
| Signing reminder | Email goes to the signer; no extra Activity row | Application → Acceptance |
| Settlement preview | Preview does not create an Activity row | Note → Activity after approval or posting |
| Notification preference changed | No Activity row | The user's notification settings |
| Signed PDF backfill | Repair does not create an Activity row | Application → Acceptance |
| Forgot password or Admin authenticator reset | Handled by the authentication service | Follow the account recovery process |

---

## When the same fact appears twice

| What you may see | Trust this |
| --- | --- |
| Fee paid on Activity and in Gateway Payments | Finance → Payments → Gateway Payments for payment proof |
| Terms accepted on Activity and Legal Acceptances | Audit → Legal Acceptances for legal proof |
| Signing status and External Acceptances | Application → Acceptance for signing status. Audit → External Acceptances for guarantor legal proof |
| Facility occupancy and Note occupancy | Facility → Activity for the facility. Note → Activity for the Note |
| Offer or amendment on Activity, plus a review copy | Application → Activity Timeline |
| Admin Note action, plus a second Admin copy | Note → Activity |
| Payment in Gateway Payments and a wallet movement | Gateway Payments for payment proof. Finance → Investor Withdrawals for the wallet |
| Letter on Activity and a stored document hash | Note → Activity for Operations |

---

## Quick Check

| If you need to know... | Check here |
| --- | --- |
| What happened during onboarding? | Issuer → Activity or Investor → Activity |
| What happened to an application? | Application → Activity Timeline |
| What happened to a facility? | Facility → Activity |
| What happened during signing? | Application → Acceptance |
| What happened to a Note? | Note → Activity |
| Did a payment succeed? | Finance → Payments → Gateway Payments |
| Did reconciliation match? | Finance → Reconciliation |
| Was a legal document accepted? | Audit → Legal Acceptances |
| Did a guarantor accept? | Audit → External Acceptances |
| Was a platform notification sent? | Audit → Notifications |
| Who logged in or changed permissions? | Audit → Access or Audit → Security |
