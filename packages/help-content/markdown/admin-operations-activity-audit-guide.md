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

Customer **Activity** is the issuer or investor Activity feed.

For payment confirmation, use **Finance - Payments - Gateway Payments**. Do not use Activity alone as payment proof.

For proof of document acceptance, use **Audit - Legal Acceptances** or **Audit - External Acceptances**. Do not use Activity alone as legal proof.

Declined means the signer said no. Voided means Operations cancelled the signing package.

## Issuer Journey

### 1. Onboarding

| What happened | Customer sees | Where to check in Admin | Message sent | Delivery |
| --- | --- | --- | --- | --- |
| Onboarding started | Activity | Issuer record - Activity | — | No automatic message |
| Onboarding fee paid | Activity | Issuer record - Activity. Finance - Payments - Gateway Payments | — | No automatic message |
| Onboarding resumed | No customer-facing entry | Issuer record - Activity | — | No automatic message |
| More information required | Activity | Issuer record - Activity | — | No automatic message |
| Onboarding restarted | Activity | Issuer record - Activity | — | No automatic message |
| Onboarding reset | No customer-facing entry | Issuer record - Activity | — | No automatic message |
| Onboarding rejected | Activity + notification | Issuer record - Activity | Onboarding Rejected | In-app + email by default |
| Corporate onboarding rejected | Activity + notification | Issuer record - Activity | Onboarding Rejected | In-app + email by default |
| Onboarding submission approved | Activity | Issuer record - Activity | — | No automatic message |
| Onboarding completed | Activity + notification | Issuer record - Activity | Onboarding Completed | In-app + email by default |
| Terms and conditions accepted | No customer-facing entry | Issuer record - Activity. Audit - Legal Acceptances | — | No automatic message |
| AML approved | No customer-facing entry | Issuer record - Activity | — | No automatic message |
| Company registry check approved | No customer-facing entry | Issuer record - Activity | — | No automatic message |
| Enhanced due diligence approved | No customer-facing entry | Issuer record - Activity | — | No automatic message |
| Enhanced due diligence rejected | No customer-facing entry | Issuer record - Activity | — | No automatic message |
| Director or shareholder must complete onboarding | Notification | Issuer record - People | Director/Shareholder Action Required | In-app + email by default |
| Director or shareholder verification email | Email only | Issuer record - People | Director/Shareholder Verification | Email only |

### 2. Application

| What happened | Customer sees | Where to check in Admin | Message sent | Delivery |
| --- | --- | --- | --- | --- |
| Application started | Activity | Application record - Activity Timeline | — | No automatic message |
| Application processing fee paid | Activity | Application record - Activity Timeline. Finance - Payments - Gateway Payments | — | No automatic message |
| Application submitted | Activity + notification | Application record - Activity Timeline | Application Submitted Confirmation | In-app by default; email can be enabled |
| Amendment requested | Activity + notification | Application record - Activity Timeline | Application Amendments Requested | In-app + email by default |
| Application resubmitted | Activity + notification | Application record - Activity Timeline | Application Resubmitted Confirmation | In-app + email by default |
| Application rejected | Activity + notification | Application record - Activity Timeline | Application Rejected | In-app + email by default |
| Application withdrawn | Activity + notification | Application record - Activity Timeline | Application Withdrawn Confirmation | In-app + email by default |
| Application completed | Activity + notification | Application record - Activity Timeline | Application Completed | In-app + email by default |
| Application returned to review | No customer-facing entry | Application record - Activity Timeline | Offer Retracted or Reset | In-app + email by default |

### 3. Facility / Invoice Offer

| What happened | Customer sees | Where to check in Admin | Message sent | Delivery |
| --- | --- | --- | --- | --- |
| Facility offer sent | Activity + notification | Application record - Activity Timeline | Facility Offer Sent | In-app + email by default |
| Facility acceptance submitted | Activity | Application record - Activity Timeline | — | No automatic message |
| Facility acceptance resubmitted | Activity | Application record - Activity Timeline | — | No automatic message |
| Facility acceptance approved for signing | No customer-facing entry | Application record - Activity Timeline | — | No automatic message |
| Facility offer accepted | Activity | Application record - Activity Timeline | — | No automatic message |
| Facility offer declined | Activity + notification | Application record - Activity Timeline | Application Withdrawn Confirmation | In-app + email by default |
| Facility offer retracted | Activity + notification | Application record - Activity Timeline | Offer Retracted or Reset | In-app + email by default |
| Facility offer expired | Activity + notification | Application record - Activity Timeline | Offer Expired | In-app + email by default |
| Offer expiring soon | Notification | Application record - Activity Timeline | Offer Expiry Reminder | In-app + email by default |
| Facility signing deadline extended | Activity + notification | Application record - Activity Timeline | Facility Signing Deadline Extended | In-app + email by default |
| Facility occupancy updated | Activity | Facility record - Activity | — | No automatic message |
| Facility fee waived | No customer-facing entry | Facility record - Activity | — | No automatic message |
| Facility disabled | Notification | Facility record - Activity | Facility Disabled | In-app + email by default |
| Facility enabled | No customer-facing entry | Facility record - Activity | — | No automatic message |
| Large-private customer flag updated | No customer-facing entry | Facility record - Activity | — | No automatic message |
| Invoice offer sent | Activity + notification | Application record - Activity Timeline | Invoice Offer Sent | In-app + email by default |
| Invoice acceptance submitted | Activity | Application record - Activity Timeline | — | No automatic message |
| Invoice acceptance resubmitted | Activity | Application record - Activity Timeline | — | No automatic message |
| Invoice acceptance approved for signing | No customer-facing entry | Application record - Activity Timeline | — | No automatic message |
| Invoice offer accepted | Activity | Application record - Activity Timeline | — | No automatic message |
| Invoice offer declined | Activity + notification | Application record - Activity Timeline | Application Withdrawn Confirmation | In-app + email by default |
| Invoice offer retracted | Activity + notification | Application record - Activity Timeline | Offer Retracted or Reset | In-app + email by default |
| Invoice offer expired | Activity + notification | Application record - Activity Timeline | Offer Expired | In-app + email by default |
| Invoice signing deadline extended | Activity + notification | Application record - Activity Timeline | Invoice Signing Deadline Extended | In-app + email by default |
| Invoice withdrawn | Activity | Application record - Activity Timeline | — | No automatic message |
| Acceptance documents need updates | Notification | Application record - Acceptance | Acceptance Documents Need Updates | In-app + email by default |
| Invoice offer verification code | Email only | Application record - Acceptance | Invoice Offer Verification Code | Email only |

### 4. Signing

Declined means the signer said no. Voided means Operations cancelled the signing package.

| What happened | Customer sees | Where to check in Admin | Message sent | Delivery |
| --- | --- | --- | --- | --- |
| Signing package created | No customer-facing entry | Application record - Activity Timeline | — | No automatic message |
| Signing package sent | Activity | Application record - Activity Timeline. Application record - Acceptance | Signing Package / Reminder | Email only |
| Signing completed | Activity | Application record - Activity Timeline | — | No automatic message |
| Signing declined | Activity | Application record - Activity Timeline | — | No automatic message |
| Signing expired | Activity | Application record - Activity Timeline | — | No automatic message |
| Signing voided | No customer-facing entry | Application record - Activity Timeline | — | No automatic message |
| Signing reminder | Email only | Application record - Acceptance | Signing Package / Reminder | Email only |
| Signer opened the link | No customer-facing entry | Application record - Acceptance | — | No automatic message |

### 5. Fees and Payments

For payment confirmation, use **Finance - Payments - Gateway Payments**. Do not use Activity alone as payment proof.

| What happened | Customer sees | Where to check in Admin | Message sent | Delivery |
| --- | --- | --- | --- | --- |
| Upfront facility fee requested | Notification | Facility record - Facility & Offer | Upfront Facility Fee Payment Required | In-app + email by default |
| Facility fee paid | Activity + notification | Application record - Activity Timeline. Finance - Payments - Gateway Payments | Upfront Facility Fee Paid | In-app + email by default |
| Facility fee collection waived on the Note | No customer-facing entry | Note record - Activity | — | No automatic message |
| Outstanding late charges to pay | Notification | Note record - Activity | Outstanding Late Charges To Pay | In-app + email by default |
| Late payment charges received | Notification | Finance - Payments - Gateway Payments | Late Payment Charges Received | In-app + email by default |

### 6. Funding / Note

| What happened | Customer sees | Where to check in Admin | Message sent | Delivery |
| --- | --- | --- | --- | --- |
| Note created | Activity (issuer) | Note record - Activity | — | No automatic message |
| Draft updated | No customer-facing entry | Note record - Activity | — | No automatic message |
| Featured settings updated | No customer-facing entry | Note record - Activity | — | No automatic message |
| Note published | Activity + notification (issuer) | Note record - Activity | Note Published | In-app + email by default |
| Unpublished from marketplace | No customer-facing entry | Note record - Activity | — | No automatic message |
| Campaign paused | Activity (issuer) | Note record - Activity | — | No automatic message |
| Campaign resumed | Activity (issuer) | Note record - Activity | — | No automatic message |
| Funding closed | Activity + notification (issuer) | Note record - Activity | Note Funding Succeeded | In-app + email by default |
| Funding unsuccessful | Activity + notification (issuer and investor) | Note record - Activity | Funding Unsuccessful | In-app + email by default |
| Note activated | Activity + notification (issuer and investor) | Note record - Activity | Note Active | In-app + email by default |
| Note occupancy updated | No customer-facing entry | Note record - Activity | — | No automatic message |
| Note fully repaid | Notification (issuer) | Note record - Activity | Note Repaid | In-app + email by default |

### 7. Disbursement

| What happened | Customer sees | Where to check in Admin | Message sent | Delivery |
| --- | --- | --- | --- | --- |
| Disbursement instruction created | No customer-facing entry | Note record - Activity | — | No automatic message |
| Withdrawal letter generated | No customer-facing entry | Note record - Activity | — | No automatic message |
| Submitted to trustee | Notification | Note record - Activity | Withdrawal Submitted To Trustee | In-app + email by default |
| Beneficiary updated | No customer-facing entry | Note record - Activity | — | No automatic message |
| Trustee instruction emailed | No customer-facing entry | Note record - Activity | Trustee Instruction | Email only |
| Disbursement completed | Activity + notification (issuer) | Note record - Activity | Disbursement Completed | In-app by default; email can be enabled |

### 8. Repayment

| What happened | Customer sees | Where to check in Admin | Message sent | Delivery |
| --- | --- | --- | --- | --- |
| Repayment submitted for review | Activity (issuer) | Note record - Activity | — | No automatic message |
| Repayment received | Notification (investor) | Note record - Activity | Repayment Received | In-app + email by default |
| Repayment approved | No customer-facing entry | Note record - Activity | — | No automatic message |
| Repayment rejected | Notification (issuer) | Note record - Activity | Repayment Rejected | In-app by default; email can be enabled |

### 9. Late / Default

| What happened | Customer sees | Where to check in Admin | Message sent | Delivery |
| --- | --- | --- | --- | --- |
| Note in arrears | Notification (issuer) | Note record - Late Payment | Note In Arrears | In-app + email by default |
| Note in arrears | Notification (investor) | Note record - Late Payment | Note In Arrears | In-app + email by default |
| Note defaulted | Activity + notification (issuer) | Note record - Activity | Note Defaulted (Issuer) | In-app + email by default |
| Note defaulted | Activity + notification (investor) | Note record - Activity | Note Defaulted | In-app + email by default |
| Late charge approved | No customer-facing entry | Note record - Activity | — | No automatic message |
| Arrears letter generated | No customer-facing entry | Note record - Activity | — | No automatic message |
| Default letter generated | No customer-facing entry | Note record - Activity | — | No automatic message |

### 10. Settlement

| What happened | Customer sees | Where to check in Admin | Message sent | Delivery |
| --- | --- | --- | --- | --- |
| Settlement approved | No customer-facing entry | Note record - Activity | — | No automatic message |
| Settlement posted | Activity + notification (investor) | Note record - Activity | Note Settlement Posted | In-app + email by default |
| Settlement trustee letter generated | No customer-facing entry | Note record - Activity | — | No automatic message |
| Settlement trustee letter submitted | No customer-facing entry | Note record - Activity | — | No automatic message |
| Settlement trustee instruction completed | No customer-facing entry | Note record - Activity | — | No automatic message |
| Settlement trustee email sent | No customer-facing entry | Note record - Activity | Trustee Instruction | Email only |

## Investor Journey

### 1. Onboarding

| What happened | Customer sees | Where to check in Admin | Message sent | Delivery |
| --- | --- | --- | --- | --- |
| Onboarding started | Activity | Investor record - Activity | — | No automatic message |
| Onboarding resumed | No customer-facing entry | Investor record - Activity | — | No automatic message |
| More information required | Activity | Investor record - Activity | — | No automatic message |
| Onboarding restarted | Activity | Investor record - Activity | — | No automatic message |
| Onboarding reset | No customer-facing entry | Investor record - Activity | — | No automatic message |
| Onboarding rejected | Activity + notification | Investor record - Activity | Onboarding Rejected | In-app + email by default |
| Onboarding submission approved | Activity | Investor record - Activity | — | No automatic message |
| Onboarding completed | Activity + notification | Investor record - Activity | Onboarding Completed | In-app + email by default |
| Terms and conditions accepted | No customer-facing entry | Investor record - Activity. Audit - Legal Acceptances | — | No automatic message |
| Sophisticated investor status updated | No customer-facing entry | Investor record - Activity | — | No automatic message |
| AML approved | No customer-facing entry | Investor record - Activity | — | No automatic message |
| Director or shareholder must complete onboarding | Notification | Investor record - People | Investor Director/Shareholder Action Required | In-app + email by default |

### 2. Deposit

For payment confirmation, use **Finance - Payments - Gateway Payments**. Do not use Activity alone as payment proof.

| What happened | Customer sees | Where to check in Admin | Message sent | Delivery |
| --- | --- | --- | --- | --- |
| Bank account name check started | No customer-facing entry | Finance - Payments - Gateway Payments | — | No automatic message |
| Bank account name check passed | No customer-facing entry | Finance - Payments - Gateway Payments | — | No automatic message |
| Bank account name check failed | Notification (investor) | Finance - Payments - Gateway Payments | Deposit Verification Failed | In-app by default; email can be enabled |
| Deposit successful | Notification (investor) | Finance - Payments - Gateway Payments | Deposit Successful | In-app by default; email can be enabled |
| Payment amount mismatch | No customer-facing entry | Finance - Payments - Gateway Payments | — | No automatic message |
| Payment session expired | No customer-facing entry | Finance - Payments - Gateway Payments | — | No automatic message |
| Refund started | Notification (investor) | Finance - Payments - Gateway Payments | Deposit Refund Started | In-app by default; email can be enabled |
| Refund completed | Notification (investor) | Finance - Payments - Gateway Payments | Deposit Refund Completed | In-app by default; email can be enabled |
| Wallet update failed after refund | No customer-facing entry | Finance - Payments - Gateway Payments | — | No automatic message |

### 3. Investment

| What happened | Customer sees | Where to check in Admin | Message sent | Delivery |
| --- | --- | --- | --- | --- |
| Investment committed | Activity + notification (investor) | Note record - Activity | Investment Committed | In-app by default; email can be enabled |

### 4. Funding

| What happened | Customer sees | Where to check in Admin | Message sent | Delivery |
| --- | --- | --- | --- | --- |
| Funding unsuccessful | Activity + notification (investor) | Note record - Activity | Funding Unsuccessful | In-app + email by default |
| Note became active | Activity + notification (investor) | Note record - Activity | Note Active | In-app + email by default |

### 5. Repayment / Return

| What happened | Customer sees | Where to check in Admin | Message sent | Delivery |
| --- | --- | --- | --- | --- |
| Repayment received | Notification (investor) | Note record - Activity | Repayment Received | In-app + email by default |
| Settlement posted | Activity + notification (investor) | Note record - Activity | Note Settlement Posted | In-app + email by default |
| Note in arrears | Notification (investor) | Note record - Late Payment | Note In Arrears | In-app + email by default |
| Note defaulted | Activity + notification (investor) | Note record - Activity | Note Defaulted | In-app + email by default |
| Residual return completed | Activity (investor) | Note record - Activity | — | No automatic message |

### 6. Withdrawal / Refund

| What happened | Customer sees | Where to check in Admin | Message sent | Delivery |
| --- | --- | --- | --- | --- |
| Cash withdrawal submitted | Notification (investor) | Finance - Investor Withdrawals | Withdrawal Submitted | In-app by default; email can be enabled |
| Cash withdrawal completed | Notification (investor) | Finance - Investor Withdrawals | Withdrawal Completed | In-app by default; email can be enabled |
| Withdrawal submitted to trustee | Notification (investor) | Note record - Activity | Withdrawal Submitted To Trustee | In-app + email by default |

## Admin / Finance / Support

### 1. Application Review

| What happened | Customer sees | Where to check in Admin | Message sent | Delivery |
| --- | --- | --- | --- | --- |
| Section approved | No customer-facing entry | Application record - Activity Timeline | — | No automatic message |
| Section rejected | No customer-facing entry | Application record - Activity Timeline | — | No automatic message |
| Section amendment requested | No customer-facing entry | Application record - Activity Timeline | — | No automatic message |
| Section reset to pending | No customer-facing entry | Application record - Activity Timeline | — | No automatic message |
| Item approved | No customer-facing entry | Application record - Activity Timeline | — | No automatic message |
| Item rejected | No customer-facing entry | Application record - Activity Timeline | — | No automatic message |
| Item amendment requested | No customer-facing entry | Application record - Activity Timeline | — | No automatic message |
| Item reset to pending | No customer-facing entry | Application record - Activity Timeline | — | No automatic message |

### 2. Organisation / Membership

| What happened | Customer sees | Where to check in Admin | Message sent | Delivery |
| --- | --- | --- | --- | --- |
| Member invited | Email only | Issuer record - Activity or Investor record - Activity | Organisation Invitation | Email only |
| Member added | No customer-facing entry | Issuer record - Activity or Investor record - Activity | — | No automatic message |
| Member removed | No customer-facing entry | Issuer record - Activity or Investor record - Activity | — | No automatic message |
| Member role changed | No customer-facing entry | Issuer record - Activity or Investor record - Activity | — | No automatic message |
| Organisation profile updated | No customer-facing entry | Issuer record - Activity or Investor record - Activity | — | No automatic message |
| MARC assessment saved | No customer-facing entry | Issuer record - Activity or Investor record - Activity | — | No automatic message |
| Identity or company-check status updated | No customer-facing entry | Issuer record - Activity or Investor record - Activity | — | No automatic message |
| Identity documents or liveness completed | No customer-facing entry | Issuer record - Activity or Investor record - Activity | — | No automatic message |

### 3. Notes / Prospectus / Paymaster / Tawarruq

| What happened | Customer sees | Where to check in Admin | Message sent | Delivery |
| --- | --- | --- | --- | --- |
| Prospectus review created | No customer-facing entry | Note record - Activity | — | No automatic message |
| Prospectus draft updated | No customer-facing entry | Note record - Activity | — | No automatic message |
| Prospectus approved | No customer-facing entry | Note record - Activity | — | No automatic message |
| Prospectus approval cleared after edit | No customer-facing entry | Note record - Activity | — | No automatic message |
| Prospectus approval cleared after source change | No customer-facing entry | Note record - Activity | — | No automatic message |
| Prospectus approval cleared after unpublish | No customer-facing entry | Note record - Activity | — | No automatic message |
| Paymaster notice generated | No customer-facing entry | Note record - Activity | — | No automatic message |
| Paymaster notice sent | No customer-facing entry | Note record - Activity | — | No automatic message |
| Paymaster notice uploaded | No customer-facing entry | Note record - Activity | — | No automatic message |
| Paymaster acknowledgement uploaded | No customer-facing entry | Note record - Activity | — | No automatic message |
| Paymaster acknowledgement confirmed | No customer-facing entry | Note record - Activity | — | No automatic message |
| Tawarruq order submitted | No customer-facing entry | Note record - Activity | — | No automatic message |
| Tawarruq certificate retrieved | No customer-facing entry | Note record - Activity | — | No automatic message |

### 4. Legal

For proof of document acceptance, use **Audit - Legal Acceptances** or **Audit - External Acceptances**. Do not use Activity alone as legal proof.

| What happened | Customer sees | Where to check in Admin | Message sent | Delivery |
| --- | --- | --- | --- | --- |
| Legal document created | No customer-facing entry | Audit - Legal Documents | — | No automatic message |
| Legal document updated | No customer-facing entry | Audit - Legal Documents | — | No automatic message |
| Version uploaded | No customer-facing entry | Audit - Legal Documents | — | No automatic message |
| Version file replaced | No customer-facing entry | Audit - Legal Documents | — | No automatic message |
| Version published | No customer-facing entry | Audit - Legal Documents | — | No automatic message |
| Version archived | No customer-facing entry | Audit - Legal Documents | — | No automatic message |
| Version restored | No customer-facing entry | Audit - Legal Documents | — | No automatic message |
| Legal document accepted | No customer-facing entry | Audit - Legal Acceptances | — | No automatic message |
| External person or guarantor accepted | No customer-facing entry | Audit - External Acceptances | — | No automatic message |
| Generated letter or document hash stored | No customer-facing entry | Note record - Activity | — | No automatic message |

### 5. Payments / Gateway / Reconciliation

For payment confirmation, use **Finance - Payments - Gateway Payments**. Do not use Activity alone as payment proof.

| What happened | Customer sees | Where to check in Admin | Message sent | Delivery |
| --- | --- | --- | --- | --- |
| Bank account name check started | No customer-facing entry | Finance - Payments - Gateway Payments | — | No automatic message |
| Bank account name check passed | No customer-facing entry | Finance - Payments - Gateway Payments | — | No automatic message |
| Bank account name check failed | Notification (investor) | Finance - Payments - Gateway Payments | Deposit Verification Failed | In-app by default; email can be enabled |
| Payment received successfully (investor deposit) | Notification (investor) | Finance - Payments - Gateway Payments | Deposit Successful | In-app by default; email can be enabled |
| Payment received successfully (application processing fee) | Activity | Application record - Activity Timeline. Finance - Payments - Gateway Payments | — | No automatic message |
| Payment received successfully (onboarding fee) | Activity | Issuer record - Activity. Finance - Payments - Gateway Payments | — | No automatic message |
| Payment received successfully (facility fee) | Activity + notification | Application record - Activity Timeline. Finance - Payments - Gateway Payments | Upfront Facility Fee Paid | In-app + email by default |
| Payment amount mismatch | No customer-facing entry | Finance - Payments - Gateway Payments | — | No automatic message |
| Payment session expired | No customer-facing entry | Finance - Payments - Gateway Payments | — | No automatic message |
| Refund started | Notification (investor) | Finance - Payments - Gateway Payments | Deposit Refund Started | In-app by default; email can be enabled |
| Refund completed | Notification (investor) | Finance - Payments - Gateway Payments | Deposit Refund Completed | In-app by default; email can be enabled |
| Wallet update failed after refund | No customer-facing entry | Finance - Payments - Gateway Payments | — | No automatic message |
| Reconciliation completed | No customer-facing entry | Finance - Reconciliation | — | No automatic message |
| Reconciliation mismatch found | No customer-facing entry | Finance - Reconciliation | — | No automatic message |

### 6. Access / Security

| What happened | Customer sees | Where to check in Admin | Message sent | Delivery |
| --- | --- | --- | --- | --- |
| Login | No customer-facing entry | Audit - Access | — | No automatic message |
| First account created | No customer-facing entry | Audit - Access | — | No automatic message |
| Logout | No customer-facing entry | Audit - Access | — | No automatic message |
| Password changed | Notification | Audit - Security | Password Changed | Always in-app + email |
| Email verification | No customer-facing entry | Audit - Security | — | No automatic message |
| Role created | No customer-facing entry | Audit - Security | — | No automatic message |
| Role permissions updated | No customer-facing entry | Audit - Security | — | No automatic message |
| Role added | No customer-facing entry | Audit - Security | — | No automatic message |
| Role removed | No customer-facing entry | Audit - Security | — | No automatic message |
| Role switched | No customer-facing entry | Audit - Security | — | No automatic message |
| Admin invitation revoked | No customer-facing entry | Audit - Security | — | No automatic message |
| Platform finance settings updated | No customer-facing entry | Audit - Security | — | No automatic message |

### 7. Products

| What happened | Customer sees | Where to check in Admin | Message sent | Delivery |
| --- | --- | --- | --- | --- |
| Product created | No customer-facing entry | Audit - Products | — | No automatic message |
| Product updated | No customer-facing entry | Audit - Products | — | No automatic message |
| Product deleted | No customer-facing entry | Audit - Products | — | No automatic message |

### 8. Notifications / Emails

In-app messages appear in the issuer or investor bell. Delivery of those messages is recorded in **Audit - Notifications**.

Direct emails to a signer, invitee, trustee, or verification person do **not** appear in Audit - Notifications.

#### Platform messages

| Message | Sent to | When it is sent | Delivery | Where Admin checks |
| --- | --- | --- | --- | --- |
| Password Changed | The person who changed the password | Password changed in the portal | Always in-app + email | Audit - Notifications |
| Onboarding Completed | The onboarding user | Final approval | In-app + email by default | Audit - Notifications |
| Onboarding Rejected | The onboarding user | Onboarding rejected | In-app + email by default | Audit - Notifications |
| System Announcement | Selected users or a group | Operations sends a custom announcement | In-app + email by default | Audit - Notifications |
| New Product Alert | Selected investors | Operations sends a custom alert | In-app + email by default | Audit - Notifications |
| Application Amendments Requested | Issuer owner and organisation admins | Amendment pack sent | In-app + email by default | Audit - Notifications |
| Acceptance Documents Need Updates | Issuer owner and organisation admins | First request to update acceptance documents in a cycle | In-app + email by default | Audit - Notifications |
| Application Rejected | Issuer owner and organisation admins | Application rejected | In-app + email by default | Audit - Notifications |
| Facility Offer Sent | Issuer owner and organisation admins | Facility offer sent | In-app + email by default | Audit - Notifications |
| Invoice Offer Sent | Issuer owner and organisation admins | Invoice offer sent | In-app + email by default | Audit - Notifications |
| Offer Retracted or Reset | Issuer owner and organisation admins | Offer retracted or application returned to review | In-app + email by default | Audit - Notifications |
| Offer Expired | Issuer owner and organisation admins | Facility or invoice offer expired | In-app + email by default | Audit - Notifications |
| Offer Expiry Reminder | Issuer owner and organisation admins | Offer is approaching its deadline | In-app + email by default | Audit - Notifications |
| Application Resubmitted Confirmation | Issuer owner and organisation admins | Application resubmitted | In-app + email by default | Audit - Notifications |
| Application Withdrawn Confirmation | Issuer owner and organisation admins | Application withdrawn, or an offer declined | In-app + email by default | Audit - Notifications |
| Application Completed | Issuer owner and organisation admins | Application completed | In-app + email by default | Audit - Notifications |
| Application Submitted Confirmation | Issuer owner and organisation admins | Application first submitted | In-app by default; email can be enabled | Audit - Notifications |
| Facility Signing Deadline Extended | Issuer owner and organisation admins | Facility signing deadline extended | In-app + email by default | Audit - Notifications |
| Invoice Signing Deadline Extended | Issuer owner and organisation admins | Invoice signing deadline extended | In-app + email by default | Audit - Notifications |
| Facility Disabled | Issuer owner and organisation admins | Facility disabled | In-app + email by default | Audit - Notifications |
| Director/Shareholder Action Required | Issuer organisation owner | A director or shareholder still needs to complete onboarding | In-app + email by default | Audit - Notifications |
| Investor Director/Shareholder Action Required | Investor organisation owner | A director or shareholder still needs to complete onboarding | In-app + email by default | Audit - Notifications |
| Note Published | Issuer organisation members | Note published | In-app + email by default | Audit - Notifications |
| Note Funding Succeeded | Issuer organisation members | Funding closed successfully | In-app + email by default | Audit - Notifications |
| Funding Unsuccessful | Issuer organisation members | Funding did not complete | In-app + email by default | Audit - Notifications |
| Funding Unsuccessful | Investors who had committed | Funding did not complete | In-app + email by default | Audit - Notifications |
| Note Active | Issuer organisation members | Note activated | In-app + email by default | Audit - Notifications |
| Note Active | Investors on the Note | Note activated | In-app + email by default | Audit - Notifications |
| Note Repaid | Issuer organisation members | Note fully repaid | In-app + email by default | Audit - Notifications |
| Repayment Received | Investors on the Note | Repayment recorded | In-app + email by default | Audit - Notifications |
| Note Settlement Posted | Investors on the Note | Settlement posted | In-app + email by default | Audit - Notifications |
| Note In Arrears | Issuer organisation members | Note entered arrears | In-app + email by default | Audit - Notifications |
| Note In Arrears | Investors | Note entered arrears | In-app + email by default | Audit - Notifications |
| Note Defaulted (Issuer) | Issuer organisation members | Note marked default | In-app + email by default | Audit - Notifications |
| Note Defaulted | Investors | Note marked default | In-app + email by default | Audit - Notifications |
| Withdrawal Submitted To Trustee | Issuer and investor members, depending on the withdrawal type | Instruction submitted to trustee | In-app + email by default | Audit - Notifications |
| Repayment Rejected | Issuer organisation members | Repayment rejected | In-app by default; email can be enabled | Audit - Notifications |
| Disbursement Completed | Issuer organisation members | Issuer financing disbursement completed | In-app by default; email can be enabled | Audit - Notifications |
| Upfront Facility Fee Payment Required | Issuer owner and organisation admins | Facility offer accepted and an upfront fee is due | In-app + email by default | Audit - Notifications |
| Upfront Facility Fee Paid | Issuer organisation members | Upfront facility fee paid | In-app + email by default | Audit - Notifications |
| Outstanding Late Charges To Pay | Issuer organisation members | Settlement posted with leftover late charges | In-app + email by default | Audit - Notifications |
| Late Payment Charges Received | Issuer organisation members | Outstanding late charges paid | In-app + email by default | Audit - Notifications |
| Deposit Verification Failed | Investor organisation members | Bank account name check failed | In-app by default; email can be enabled | Audit - Notifications |
| Deposit Refund Started | Investor organisation members | Deposit refund started | In-app by default; email can be enabled | Audit - Notifications |
| Deposit Refund Completed | Investor organisation members | Deposit refund completed | In-app by default; email can be enabled | Audit - Notifications |
| Deposit Successful | Investor organisation members | Deposit credited | In-app by default; email can be enabled | Audit - Notifications |
| Investment Committed | The investor who committed | Investment committed | In-app by default; email can be enabled | Audit - Notifications |
| Withdrawal Submitted | The investor who requested cash withdrawal | Cash withdrawal submitted | In-app by default; email can be enabled | Audit - Notifications |
| Withdrawal Completed | The investor who requested cash withdrawal | Cash withdrawal completed | In-app by default; email can be enabled | Audit - Notifications |

#### Direct emails

These do not appear in Audit - Notifications.

| Email | Sent to | When it is sent | Delivery |
| --- | --- | --- | --- |
| Organisation Invitation | Invitee | Member invited or invite resent | Email only |
| Admin Invitation | Invitee | Admin invited or invite resent | Email only |
| Signing Package / Reminder | Named signer | Signing package sent, or reminder requested | Email only |
| Invoice Offer Verification Code | Selected signatory | Issuer requests a code to accept an invoice offer | Email only |
| Director/Shareholder Verification | The person who must verify | Director or shareholder verification is required | Email only |
| Trustee Instruction | Trustee recipients | Trustee letter is sent | Email only |

## Additional records used for investigation

These are not the customer Activity feed. Use them when you need payment proof, legal proof, or support investigation.

| Record | What it proves | Where to check in Admin | Customer sees |
| --- | --- | --- | --- |
| Login session | A session was issued | No dedicated Admin screen | No customer-facing entry |
| Signer viewed the package | The signer opened the signing link | Application record - Acceptance | No customer-facing entry |
| Application review copy | Extra copy of offer sent or amendment sent | Application record - Activity Timeline | No customer-facing entry |
| Reviewer remarks | Comments entered during review | Application record - Activity Timeline | No customer-facing entry |
| Note Admin action copy | Extra copy of Admin Note actions | Note record - Activity | No customer-facing entry |
| Raw payment-provider update | The payment provider sent an update | No dedicated Admin screen | No customer-facing entry |
| Checkout attempt | A payment session was attempted | Finance - Payments - Gateway Payments | No customer-facing entry |
| Payment receipt | Receipt file generated or retried | Finance - Payments - Gateway Payments | No customer-facing entry |
| Reconciliation completed | A settlement reconciliation run | Finance - Reconciliation | No customer-facing entry |
| Reconciliation mismatch found | An unmatched or mismatched payment | Finance - Reconciliation | No customer-facing entry |
| Investor wallet movement | Deposit, invest, refund, or cash withdrawal | Finance - Investor Withdrawals | No customer-facing entry |
| Note ledger | Amounts posted on the Note | Note record - Ledger | No customer-facing entry |
| Invoice offer verification-code record | A verification code was issued | No dedicated Admin screen | Email only |
| Notification delivery record | An in-app or email platform message was sent | Audit - Notifications | Notification |
| Identity check approved (before organisation exists) | Identity was approved before an organisation record existed | No dedicated Admin screen | No customer-facing entry |
| Identity check rejected (provider update) | Identity was rejected by the provider | No dedicated Admin screen | No customer-facing entry |
| Enhanced due diligence provider update | Raw enhanced due diligence update | Issuer record - Activity or Investor record - Activity | No customer-facing entry |

## Actions that may not appear in Activity or Notifications

| Action | What Operations should know | Where to check instead |
| --- | --- | --- |
| User cancelled onboarding | No Activity timeline entry | Issuer record - Activity or Investor record - Activity |
| Signing reminder | No Activity timeline entry | Application record - Acceptance |
| Settlement preview | No Activity timeline entry | Note record - Activity |
| Notification preference changed | No Activity timeline entry | User notification settings |
| Company-search retry | No Activity timeline entry for each retry | Application record - Activity Timeline |
| Signed PDF backfill | No Activity timeline entry | Application record - Acceptance |
| Forgot password or Admin authenticator reset | Handled by the authentication service, not Activity | Follow the account recovery process |
| Onboarding started or onboarding fee paid | No automatic message | Issuer record - Activity or Investor record - Activity |
| More onboarding information required | No automatic message | Issuer record - Activity or Investor record - Activity |
| Onboarding restarted | No automatic message | Issuer record - Activity or Investor record - Activity |
| Facility enabled | No automatic message | Facility record - Activity |
| Facility fee waived | No automatic message | Facility record - Activity or Note record - Activity |
| Invoice withdrawn | No automatic message | Application record - Activity Timeline |
| Campaign paused or resumed | No automatic message | Note record - Activity |
| Note unpublished | No automatic message | Note record - Activity |
| Signing package sent to organisation members who are not the signer | No automatic message to the organisation inbox | Application record - Acceptance |
| Signing completed, declined, expired, or voided | No automatic message | Application record - Activity Timeline |
| Repayment approved | No automatic message | Note record - Activity |
| Settlement approved | No automatic message | Note record - Activity |
| Prospectus, paymaster, or tawarruq | No automatic message | Note record - Activity |
| Product created | No automatic message | Audit - Products |
| Organisation member invited | No in-app platform message | Issuer record - Activity or Investor record - Activity |
| Signing reminder | No in-app platform message | Application record - Acceptance |

## Old items you may see in historical records

These are not created by current flows. Older records can still show them.

| What you may see | What it means |
| --- | --- |
| Application approved | May appear in older records only |
| Facility offer rejected | May appear in older records only. Current decline is Facility Offer Declined |
| Product inactivated or reactivated | May appear in older product records. Current flow deletes a product instead |
| Settlement previewed | May appear in older Note records. Preview no longer creates a timeline row |
| Old trustee service-fee labels | May appear in older records only. Current labels are settlement trustee actions |
| KYC approved | May appear in older records only |
| Terms accepted | May appear in older records only. Current name is Terms and conditions accepted |
| User completed | May appear in older records only. Current completion is Onboarding completed |
| Note created or Note published as older labels | Labels for older rows |
| Account locked | Not created by current flows |
| Ops Alerts | Removed. Not used by the current platform |

## When the same fact appears twice

| What you may see twice | Why |
| --- | --- |
| Facility occupancy and Note occupancy | The same draw, funding, or repayment is recorded on the facility and on the Note |
| Offer or amendment on Activity, plus a review copy | Operations should use Application record - Activity Timeline |
| Admin Note action, plus a second Admin copy | Operations should use Note record - Activity |
| Fee paid on Activity and in Gateway Payments | Activity is the milestone. Finance - Payments - Gateway Payments is payment proof |
| Terms accepted on Activity and Legal Acceptances | Activity is the milestone. Audit - Legal Acceptances is legal proof |
| Payment provider update and Gateway Payments | Finance - Payments - Gateway Payments is the business payment record |
| Identity status, documents completed, and investigation-only identity updates | Same identity check, different layers |
| Letter on Activity and a stored document hash | Timeline for Operations. Hash for investigation |
| Email verification success and failed attempt | Same security record type. Open the detail to see the result |

## Technical reference

For support escalation only.

| Business event | System reference |
| --- | --- |
| Onboarding started | `ONBOARDING_STARTED` |
| Onboarding fee paid | `ONBOARDING_FEE_PAID` |
| Onboarding resumed | `ONBOARDING_RESUMED` |
| Identity or company-check status updated | `ONBOARDING_STATUS_UPDATED` |
| Identity documents or liveness completed | `FORM_FILLED` |
| More information required | `ONBOARDING_AMENDMENT_REQUIRED` |
| Onboarding restarted | `ONBOARDING_CANCELLED` |
| Onboarding reset | `ONBOARDING_RESET` |
| Onboarding rejected | `ONBOARDING_REJECTED` |
| Corporate onboarding rejected | `COD_REJECTED` |
| Onboarding submission approved | `ONBOARDING_APPROVED` |
| Onboarding completed | `FINAL_APPROVAL_COMPLETED` |
| AML approved | `AML_APPROVED` |
| Company registry check approved | `SSM_APPROVED` |
| Terms and conditions accepted | `TNC_APPROVED` |
| Sophisticated investor status updated | `SOPHISTICATED_STATUS_UPDATED` |
| Organisation profile updated | `PROFILE_UPDATED` |
| Member invited | `MEMBER_INVITED` |
| Member added | `MEMBER_ADDED` |
| Member removed | `MEMBER_REMOVED` |
| Member role changed | `MEMBER_ROLE_CHANGED` |
| MARC assessment saved | `MARC_ASSESSMENT_SAVED` |
| Enhanced due diligence approved | `EOD_APPROVED` |
| Enhanced due diligence rejected | `EOD_REJECTED` |
| Enhanced due diligence provider update | `EOD_WEBHOOK` |
| Identity check approved (before organisation exists) | `WEBHOOK_APPROVED` |
| Identity check rejected (provider update) | `WEBHOOK_REJECTED` |
| Application started | `APPLICATION_CREATED` |
| Application processing fee paid | `APPLICATION_PROCESSING_FEE_PAID` |
| Facility fee paid | `FACILITY_FEE_PAID` |
| Application submitted | `APPLICATION_SUBMITTED` |
| Application resubmitted | `APPLICATION_RESUBMITTED` |
| Application rejected | `APPLICATION_REJECTED` |
| Application withdrawn | `APPLICATION_WITHDRAWN` |
| Application completed | `APPLICATION_COMPLETED` |
| Application returned to review | `APPLICATION_RESET_TO_UNDER_REVIEW` |
| Section approved | `SECTION_REVIEWED_APPROVED` |
| Section rejected | `SECTION_REVIEWED_REJECTED` |
| Section amendment requested | `SECTION_REVIEWED_AMENDMENT_REQUESTED` |
| Section reset to pending | `SECTION_REVIEWED_PENDING` |
| Item approved | `ITEM_REVIEWED_APPROVED` |
| Item rejected | `ITEM_REVIEWED_REJECTED` |
| Item amendment requested | `ITEM_REVIEWED_AMENDMENT_REQUESTED` |
| Item reset to pending | `ITEM_REVIEWED_PENDING` |
| Amendment requested | `AMENDMENTS_SUBMITTED` |
| Facility offer sent | `CONTRACT_OFFER_SENT` |
| Facility acceptance submitted | `CONTRACT_OFFER_ACCEPTANCE_SUBMITTED` |
| Facility acceptance resubmitted | `CONTRACT_OFFER_ACCEPTANCE_RESUBMITTED` |
| Facility acceptance approved for signing | `CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING` |
| Facility offer accepted | `CONTRACT_OFFER_ACCEPTED` |
| Facility offer declined | `CONTRACT_OFFER_DECLINED` |
| Facility offer retracted | `CONTRACT_OFFER_RETRACTED` |
| Facility offer expired | `CONTRACT_OFFER_EXPIRED` |
| Facility signing deadline extended | `CONTRACT_SIGNING_DEADLINE_EXTENDED` |
| Facility occupancy updated | `CONTRACT_FACILITY_OCCUPANCY_UPDATED` |
| Facility fee waived | `CONTRACT_FACILITY_FEE_WAIVED` |
| Facility disabled | `CONTRACT_FACILITY_DISABLED` |
| Facility enabled | `CONTRACT_FACILITY_ENABLED` |
| Large-private customer flag updated | `CONTRACT_CUSTOMER_LARGE_PRIVATE_UPDATED` |
| Invoice offer sent | `INVOICE_OFFER_SENT` |
| Invoice acceptance submitted | `INVOICE_OFFER_ACCEPTANCE_SUBMITTED` |
| Invoice acceptance resubmitted | `INVOICE_OFFER_ACCEPTANCE_RESUBMITTED` |
| Invoice acceptance approved for signing | `INVOICE_ACCEPTANCE_APPROVED_FOR_SIGNING` |
| Invoice offer accepted | `INVOICE_OFFER_ACCEPTED` |
| Invoice offer declined | `INVOICE_OFFER_REJECTED` |
| Invoice offer retracted | `INVOICE_OFFER_RETRACTED` |
| Invoice offer expired | `INVOICE_OFFER_EXPIRED` |
| Invoice signing deadline extended | `INVOICE_SIGNING_DEADLINE_EXTENDED` |
| Invoice withdrawn | `INVOICE_WITHDRAWN` |
| Signing package created | `SIGNING_PACKAGE_CREATED` |
| Signing package sent | `SIGNING_PACKAGE_SENT` |
| Signing completed | `SIGNING_PACKAGE_COMPLETED` |
| Signing declined | `SIGNING_PACKAGE_DECLINED` |
| Signing expired | `SIGNING_PACKAGE_EXPIRED` |
| Signing voided | `SIGNING_PACKAGE_VOIDED` |
| Note created | `NOTE_CREATED_FROM_INVOICE` |
| Draft updated | `UPDATE_DRAFT` |
| Featured settings updated | `UPDATE_FEATURED_SETTINGS` |
| Note published | `PUBLISH` |
| Unpublished from marketplace | `UNPUBLISH` |
| Campaign paused | `PAUSE_LISTING` |
| Campaign resumed | `RESUME_LISTING` |
| Funding closed | `CLOSE_FUNDING` |
| Funding unsuccessful | `FAIL_FUNDING` |
| Investment committed | `INVESTMENT_COMMITTED` |
| Note activated | `ACTIVATE` |
| Note occupancy updated | `FACILITY_OCCUPANCY_UPDATED` |
| Repayment submitted for review | `ISSUER_PAYMENT_SUBMITTED` |
| Repayment received | `PAYMENT_RECEIVED` |
| Repayment approved | `PAYMENT_APPROVED` |
| Repayment rejected | `PAYMENT_REJECTED` |
| Settlement approved | `SETTLEMENT_APPROVED` |
| Settlement posted | `SETTLEMENT_POSTED` |
| Late charge approved | `LATE_CHARGE_APPROVED` |
| Note in arrears | `OVERDUE_LATE_CHARGE_CHECKED` |
| Note defaulted | `NOTE_DEFAULT_MARKED` |
| Arrears letter generated | `ARREARS_LETTER_GENERATED` |
| Default letter generated | `DEFAULT_LETTER_GENERATED` |
| Facility fee collection waived on the Note | `WAIVE_FACILITY_FEE_COLLECTION` |
| Disbursement instruction created | `ISSUER_DISBURSEMENT_WITHDRAWAL_CREATED` |
| Withdrawal letter generated | `WITHDRAWAL_LETTER_GENERATED` |
| Submitted to trustee | `WITHDRAWAL_SUBMITTED_TO_TRUSTEE` |
| Beneficiary updated | `WITHDRAWAL_BENEFICIARY_UPDATED` |
| Trustee instruction emailed | `WITHDRAWAL_TRUSTEE_EMAIL_SENT` |
| Disbursement or residual completed | `WITHDRAWAL_COMPLETED` |
| Settlement trustee letter generated | `SETTLEMENT_TRUSTEE_LETTER_GENERATED` |
| Settlement trustee letter submitted | `SETTLEMENT_TRUSTEE_LETTER_SUBMITTED` |
| Settlement trustee instruction completed | `SETTLEMENT_TRUSTEE_INSTRUCTION_COMPLETED` |
| Settlement trustee email sent | `SETTLEMENT_TRUSTEE_EMAIL_SENT` |
| Paymaster notice generated | `PAYMASTER_NOTICE_GENERATED` |
| Paymaster notice sent | `PAYMASTER_NOTICE_SENT` |
| Paymaster notice uploaded | `PAYMASTER_NOTICE_UPLOADED` |
| Paymaster acknowledgement uploaded | `PAYMASTER_ACKNOWLEDGEMENT_UPLOADED` |
| Paymaster acknowledgement confirmed | `PAYMASTER_ACKNOWLEDGEMENT_CONFIRMED` |
| Prospectus review created | `PROSPECTUS_REVIEW_CREATE` |
| Prospectus draft updated | `PROSPECTUS_REVIEW_DRAFT_UPDATE` |
| Prospectus approved | `PROSPECTUS_REVIEW_APPROVE` |
| Prospectus approval cleared after edit | `PROSPECTUS_APPROVAL_INVALIDATED_EDIT` |
| Prospectus approval cleared after source change | `PROSPECTUS_APPROVAL_INVALIDATED_SOURCE` |
| Prospectus approval cleared after unpublish | `PROSPECTUS_APPROVAL_INVALIDATED_UNPUBLISH` |
| Tawarruq order submitted | `SHORAKA_ORDER_SUBMITTED` |
| Tawarruq certificate retrieved | `SHORAKA_CERTIFICATE_FETCHED` |
| Product created | `PRODUCT_CREATED` |
| Product updated | `PRODUCT_UPDATED` |
| Product deleted | `PRODUCT_DELETED` |
| Bank account name check started | `NAME_CHECK` |
| Bank account name check passed | `NAME_CHECK_APPROVED` |
| Bank account name check failed | `NAME_CHECK_REJECTED` |
| Payment received successfully | `GATEWAY_PAYMENT_COMPLETED` |
| Payment amount mismatch | `CAPTURE_MISMATCH` |
| Payment session expired | `EXPIRED` |
| Refund started | `REFUND_INITIATED` |
| Refund completed | `REFUNDED` |
| Wallet update failed after refund | `REFUND_WALLET_REVERSAL_FAILED` |
| Login | `LOGIN` |
| First account created | `SIGNUP` |
| Logout | `LOGOUT` |
| Password changed | `PASSWORD_CHANGED` |
| Email verification | `EMAIL_VERIFIED` |
| Role created | `ROLE_CREATED` |
| Role permissions updated | `ROLE_PERMISSIONS_UPDATED` |
| Role added | `ROLE_ADDED` |
| Role removed | `ROLE_REMOVED` |
| Role switched | `ROLE_SWITCHED` |
| Admin invitation revoked | `INVITATION_REVOKED` |
| Platform finance settings updated | `PLATFORM_FINANCE_SETTINGS_UPDATED` |
| Legal document created | `LEGAL_DOCUMENT_CREATED` |
| Legal document updated | `LEGAL_DOCUMENT_UPDATED` |
| Version uploaded | `LEGAL_VERSION_UPLOADED` |
| Version file replaced | `LEGAL_VERSION_FILE_REPLACED` |
| Version published | `LEGAL_VERSION_PUBLISHED` |
| Version archived | `LEGAL_VERSION_ARCHIVED` |
| Version restored | `LEGAL_VERSION_RESTORED` |
| Legal document accepted | `LEGAL_DOCUMENT_ACCEPTANCE` |
| External person or guarantor accepted | `LEGAL_EXTERNAL_ACCEPTANCE` |
| Generated letter or document hash stored | `GENERATED_DOCUMENT_EVIDENCE` |
| Login session | `UserSession` |
| Signer viewed the package | `viewed_at` |
| Application review copy | `application_review_events` |
| Reviewer remarks | `application_review_remarks` |
| Note Admin action copy | `note_admin_actions` |
| Raw payment-provider update | `gateway_webhook_events` |
| Checkout attempt | `gateway_order_attempts` |
| Payment receipt | `gateway_payment_receipts` |
| Reconciliation completed | `gateway_recon_runs` |
| Reconciliation mismatch found | `gateway_recon_exceptions` |
| Investor wallet movement | `investor_balance_transactions` |
| Note ledger | `note_ledger_entries` |
| Invoice offer verification-code record | `offer_accept_otp_challenges` |
| Notification delivery record | `notification_logs` |

## Quick Check

| If you need to know... | Check here |
| --- | --- |
| What happened during onboarding? | Issuer record - Activity or Investor record - Activity |
| What happened to an application? | Application record - Activity Timeline |
| What happened to a facility? | Facility record - Activity |
| What happened during signing? | Application record - Acceptance |
| What happened to a Note? | Note record - Activity |
| Did a payment succeed? | Finance - Payments - Gateway Payments |
| Did reconciliation match? | Finance - Reconciliation |
| Was a legal document accepted? | Audit - Legal Acceptances |
| Did an external guarantor accept? | Audit - External Acceptances |
| Was a platform message sent? | Audit - Notifications |
| Who logged in or changed permissions? | Audit - Access or Audit - Security |
