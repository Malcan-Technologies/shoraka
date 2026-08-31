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
| Onboarding started | Activity | Issuer record - Activity tab | — | No automatic message |
| Onboarding fee paid | Activity | Issuer record - Activity tab. Confirm payment in Finance - Payments - Gateway Payments | — | No automatic message |
| Onboarding resumed | No customer-facing entry | Issuer record - Activity tab | — | No automatic message |
| More information required | Activity | Issuer record - Activity tab | — | No automatic message |
| Onboarding restarted | Activity (shown as Onboarding Restarted) | Issuer record - Activity tab | — | No automatic message |
| Onboarding reset | No customer-facing entry | Issuer record - Activity tab | — | No automatic message |
| Onboarding rejected | Activity + notification | Issuer record - Activity tab | Onboarding Rejected | In-app + email by default |
| Corporate onboarding rejected | Activity + notification | Issuer record - Activity tab | Onboarding Rejected | In-app + email by default |
| Onboarding submission approved | Activity (shown as Onboarding Submission Approved) | Issuer record - Activity tab | — | No automatic message |
| Onboarding completed | Activity + notification (Activity shows Onboarding Approved) | Issuer record - Activity tab | Onboarding Completed | In-app + email by default |
| Terms and conditions accepted | No customer-facing entry | Issuer record - Activity tab. Legal proof: Audit - Legal Acceptances | — | No automatic message |
| AML approved | No customer-facing entry | Issuer record - Activity tab | — | No automatic message |
| Company registry check approved | No customer-facing entry | Issuer record - Activity tab | — | No automatic message |
| Enhanced due diligence approved | No customer-facing entry | Issuer record - Activity tab | — | No automatic message |
| Enhanced due diligence rejected | No customer-facing entry | Issuer record - Activity tab | — | No automatic message |
| Director or shareholder must complete onboarding | Notification | Issuer record - People. Audit - Notifications | Director/Shareholder Action Required | In-app + email by default |
| Director or shareholder verification email | Email | Issuer record - People | Email sent directly to the person who must verify | Email only |

### 2. Application

| What happened | Customer sees | Where to check in Admin | Message sent | Delivery |
| --- | --- | --- | --- | --- |
| Application started | Activity | Application record - Activity Timeline | — | No automatic message |
| Application processing fee paid | Activity | Application record - Activity Timeline. Confirm in Finance - Payments - Gateway Payments | — | No automatic message |
| Application submitted | Activity + notification | Application record - Activity Timeline | Application Submitted Confirmation | In-app by default; email can be enabled |
| Amendment requested | Activity + notification (shown as Amendment Request Sent) | Application record - Activity Timeline | Application Amendments Requested | In-app + email by default |
| Application resubmitted | Activity + notification | Application record - Activity Timeline | Application Resubmitted Confirmation | In-app + email by default |
| Application rejected | Activity + notification | Application record - Activity Timeline | Application Rejected | In-app + email by default |
| Application withdrawn | Activity + notification | Application record - Activity Timeline | Application Withdrawn Confirmation | In-app + email by default |
| Application completed | Activity + notification | Application record - Activity Timeline | Application Completed | In-app + email by default |
| Application returned to review | No customer-facing entry | Application record - Activity Timeline | Offer Retracted or Reset (when an offer is reset) | In-app + email by default |

### 3. Facility / Invoice Offer

| What happened | Customer sees | Where to check in Admin | Message sent | Delivery |
| --- | --- | --- | --- | --- |
| Facility offer sent | Activity + notification | Application record - Activity Timeline | Facility Offer Sent | In-app + email by default |
| Facility acceptance submitted | Activity | Application record - Activity Timeline | — | No automatic message |
| Facility acceptance resubmitted | Activity | Application record - Activity Timeline | — | No automatic message |
| Facility acceptance approved for signing | No customer-facing entry | Application record - Activity Timeline | — | No automatic message |
| Facility offer accepted | Activity | Application record - Activity Timeline | — | No automatic message |
| Facility offer declined | Activity + notification | Application record - Activity Timeline | Application Withdrawn Confirmation (decline wording) | In-app + email by default |
| Facility offer retracted | Activity + notification | Application record - Activity Timeline | Offer Retracted or Reset | In-app + email by default |
| Facility offer expired | Activity + notification | Application record - Activity Timeline | Offer Expired | In-app + email by default |
| Offer expiring soon | Notification | Application record - Activity Timeline | Offer Expiry Reminder | In-app + email by default. Timing follows the product reminder setting, not always 24 hours |
| Facility signing deadline extended | Activity + notification | Application record - Activity Timeline | Facility Signing Deadline Extended | In-app + email by default |
| Facility occupancy updated | Activity | Facility record - Activity tab | — | No automatic message |
| Facility fee waived | No customer-facing entry | Facility record - Activity tab | — | No automatic message |
| Facility disabled | Notification | Facility record - Activity tab | Facility Disabled | In-app + email by default |
| Facility enabled | No customer-facing entry | Facility record - Activity tab | — | No automatic message |
| Large-private customer flag updated | No customer-facing entry | Facility record - Activity tab | — | No automatic message |
| Invoice offer sent | Activity + notification | Application record - Activity Timeline | Invoice Offer Sent | In-app + email by default |
| Invoice acceptance submitted | Activity | Application record - Activity Timeline | — | No automatic message |
| Invoice acceptance resubmitted | Activity | Application record - Activity Timeline | — | No automatic message |
| Invoice acceptance approved for signing | No customer-facing entry | Application record - Activity Timeline | — | No automatic message |
| Invoice offer accepted | Activity | Application record - Activity Timeline | — | No automatic message |
| Invoice offer declined | Activity + notification | Application record - Activity Timeline | Application Withdrawn Confirmation (decline wording) | In-app + email by default |
| Invoice offer retracted | Activity + notification | Application record - Activity Timeline | Offer Retracted or Reset | In-app + email by default |
| Invoice offer expired | Activity + notification | Application record - Activity Timeline | Offer Expired | In-app + email by default |
| Invoice signing deadline extended | Activity + notification | Application record - Activity Timeline | Invoice Signing Deadline Extended | In-app + email by default |
| Invoice withdrawn | Activity | Application record - Activity Timeline | — | No automatic message |
| Acceptance documents need updates | Notification | Application record - Acceptance | Acceptance Documents Need Updates | In-app + email by default |
| Invoice offer verification code | Email | Application record - Acceptance | Email sent to selected signatory | Email only |

### 4. Signing

Declined means the signer said no. Voided means Operations cancelled the signing package.

| What happened | Customer sees | Where to check in Admin | Message sent | Delivery |
| --- | --- | --- | --- | --- |
| Signing package created | No customer-facing entry | Application record - Activity Timeline | — | No automatic message |
| Signing package sent | Activity | Application record - Activity Timeline and Application record - Acceptance | Email sent directly to signer | Email only |
| Signing completed | Activity | Application record - Activity Timeline | — | No automatic message |
| Signing declined | Activity | Application record - Activity Timeline | — | No automatic message |
| Signing expired | Activity | Application record - Activity Timeline | — | No automatic message |
| Signing voided | No customer-facing entry | Application record - Activity Timeline | — | No automatic message |
| Signing reminder | Email | Application record - Acceptance | Email sent directly to signer | Email only |
| Signer opened the link | No customer-facing entry | Application record - Acceptance (status Viewed) | — | No automatic message |

### 5. Fees and Payments

For payment confirmation, use **Finance - Payments - Gateway Payments**. Do not use Activity alone as payment proof.

| What happened | Customer sees | Where to check in Admin | Message sent | Delivery |
| --- | --- | --- | --- | --- |
| Upfront facility fee requested | Notification | Facility record - Facility and Offer | Upfront facility fee payment required | In-app + email by default |
| Facility fee paid | Activity + notification | Application record - Activity Timeline. Confirm in Finance - Payments - Gateway Payments | Upfront facility fee paid | In-app + email by default |
| Facility fee collection waived on the Note | No customer-facing entry | Note record - Activity tab | — | No automatic message |
| Outstanding late charges to pay | Notification | Note record - Activity tab | Outstanding late charges to pay | In-app + email by default |
| Late payment charges received | Notification | Finance - Payments - Gateway Payments | Late payment charges received | In-app + email by default |

### 6. Funding / Note

| What happened | Customer sees | Where to check in Admin | Message sent | Delivery |
| --- | --- | --- | --- | --- |
| Note created | Activity (issuer) | Note record - Activity tab | — | No automatic message |
| Draft updated | No customer-facing entry | Note record - Activity tab | — | No automatic message |
| Featured settings updated | No customer-facing entry | Note record - Activity tab | — | No automatic message |
| Note published | Activity + notification (issuer) | Note record - Activity tab | Note published | In-app + email by default |
| Unpublished from marketplace | No customer-facing entry | Note record - Activity tab | — | No automatic message |
| Campaign paused | Activity (issuer) | Note record - Activity tab | — | No automatic message |
| Campaign resumed | Activity (issuer) | Note record - Activity tab | — | No automatic message |
| Funding closed | Activity + notification (issuer) | Note record - Activity tab | Note funding succeeded | In-app + email by default |
| Funding unsuccessful | Activity + notification | Note record - Activity tab | Funding Unsuccessful (issuer and investor) | In-app + email by default |
| Note activated | Activity + notification | Note record - Activity tab | Note active (issuer and investor) | In-app + email by default |
| Note occupancy updated | No customer-facing entry | Note record - Activity tab | — | No automatic message |
| Note fully repaid | Notification (issuer) | Note record - Activity tab | Note repaid | In-app + email by default |

### 7. Disbursement

| What happened | Customer sees | Where to check in Admin | Message sent | Delivery |
| --- | --- | --- | --- | --- |
| Disbursement instruction created | No customer-facing entry | Note record - Activity tab | — | No automatic message |
| Withdrawal letter generated | No customer-facing entry | Note record - Activity tab | — | No automatic message |
| Submitted to trustee | Notification | Note record - Activity tab | Withdrawal submitted to trustee | In-app + email by default |
| Beneficiary updated | No customer-facing entry | Note record - Activity tab | — | No automatic message |
| Trustee instruction emailed | No customer-facing entry | Note record - Activity tab | Email + PDF sent to trustee | Email only |
| Disbursement completed | Activity + notification (issuer financing disbursement) | Note record - Activity tab | Disbursement completed | In-app by default; email can be enabled |

### 8. Repayment

| What happened | Customer sees | Where to check in Admin | Message sent | Delivery |
| --- | --- | --- | --- | --- |
| Repayment submitted for review | Activity (issuer) | Note record - Activity tab | — | No automatic message |
| Repayment received | Notification (investor). No issuer Activity for this path | Note record - Activity tab | Repayment Received | In-app + email by default |
| Repayment approved | No customer-facing entry | Note record - Activity tab | — | No automatic message |
| Repayment rejected | Notification (issuer) | Note record - Activity tab | Repayment rejected | In-app by default; email can be enabled |

### 9. Late / Default

| What happened | Customer sees | Where to check in Admin | Message sent | Delivery |
| --- | --- | --- | --- | --- |
| Note in arrears | Notification | Note record - Late Payment | Note in arrears (issuer and investor) | In-app + email by default |
| Note defaulted | Activity + notification | Note record - Activity tab | Note defaulted (issuer and investor) | In-app + email by default |
| Late charge approved | No customer-facing entry | Note record - Activity tab | — | No automatic message |
| Arrears letter generated | No customer-facing entry | Note record - Activity tab | — | No automatic message |
| Default letter generated | No customer-facing entry | Note record - Activity tab | — | No automatic message |

### 10. Settlement

| What happened | Customer sees | Where to check in Admin | Message sent | Delivery |
| --- | --- | --- | --- | --- |
| Settlement approved | No customer-facing entry | Note record - Activity tab | — | No automatic message |
| Settlement posted | Activity (investor) + notifications | Note record - Activity tab | Note settlement posted (investor). Note repaid (issuer). Outstanding late charges if leftover | In-app + email by default |
| Settlement trustee letter generated | No customer-facing entry | Note record - Activity tab | — | No automatic message |
| Settlement trustee letter submitted | No customer-facing entry | Note record - Activity tab | — | No automatic message |
| Settlement trustee instruction completed | No customer-facing entry | Note record - Activity tab | — | No automatic message |
| Settlement trustee email sent | No customer-facing entry | Note record - Activity tab | Email + PDF sent to trustee | Email only |

## Investor Journey

### 1. Onboarding

| What happened | Customer sees | Where to check in Admin | Message sent | Delivery |
| --- | --- | --- | --- | --- |
| Onboarding started | Activity | Investor record - Activity tab | — | No automatic message |
| Onboarding resumed | No customer-facing entry | Investor record - Activity tab | — | No automatic message |
| More information required | Activity | Investor record - Activity tab | — | No automatic message |
| Onboarding restarted | Activity (shown as Onboarding Restarted) | Investor record - Activity tab | — | No automatic message |
| Onboarding reset | No customer-facing entry | Investor record - Activity tab | — | No automatic message |
| Onboarding rejected | Activity + notification | Investor record - Activity tab | Onboarding Rejected | In-app + email by default |
| Onboarding submission approved | Activity | Investor record - Activity tab | — | No automatic message |
| Onboarding completed | Activity + notification | Investor record - Activity tab | Onboarding Completed | In-app + email by default |
| Terms and conditions accepted | No customer-facing entry | Investor record - Activity tab. Legal proof: Audit - Legal Acceptances | — | No automatic message |
| Sophisticated investor status updated | No customer-facing entry | Investor record - Activity tab | — | No automatic message |
| AML approved | No customer-facing entry | Investor record - Activity tab | — | No automatic message |
| Director or shareholder must complete onboarding | Notification | Investor record - People. Audit - Notifications | Investor Director/Shareholder Action Required | In-app + email by default |

### 2. Deposit

For payment confirmation, use **Finance - Payments - Gateway Payments**. Do not use Activity alone as payment proof.

| What happened | Customer sees | Where to check in Admin | Message sent | Delivery |
| --- | --- | --- | --- | --- |
| Bank name check started | No customer-facing entry | Finance - Payments - Gateway Payments | — | No automatic message |
| Bank name check approved | No customer-facing entry | Finance - Payments - Gateway Payments | — | No automatic message |
| Bank name check rejected | Notification | Finance - Payments - Gateway Payments | Deposit verification failed | In-app by default; email can be enabled |
| Deposit successful | Notification | Finance - Payments - Gateway Payments | Deposit successful | In-app by default; email can be enabled |
| Capture amount mismatch | No customer-facing entry | Finance - Payments - Gateway Payments | — | No automatic message |
| Checkout expired | No customer-facing entry | Finance - Payments - Gateway Payments | — | No automatic message |
| Deposit refund started | Notification | Finance - Payments - Gateway Payments | Deposit refund started | In-app by default; email can be enabled |
| Deposit refund completed | Notification | Finance - Payments - Gateway Payments | Deposit refund completed | In-app by default; email can be enabled |
| Wallet reversal failed after refund | No customer-facing entry | Finance - Payments - Gateway Payments | — | No automatic message |

### 3. Investment

| What happened | Customer sees | Where to check in Admin | Message sent | Delivery |
| --- | --- | --- | --- | --- |
| Investment committed | Activity + notification | Note record - Activity tab | Investment committed | In-app by default; email can be enabled |

### 4. Funding

| What happened | Customer sees | Where to check in Admin | Message sent | Delivery |
| --- | --- | --- | --- | --- |
| Funding unsuccessful | Activity + notification | Note record - Activity tab | Funding Unsuccessful (commitment released) | In-app + email by default |
| Note became active | Activity + notification | Note record - Activity tab | Note active | In-app + email by default |

### 5. Repayment / Return

| What happened | Customer sees | Where to check in Admin | Message sent | Delivery |
| --- | --- | --- | --- | --- |
| Repayment received | Notification | Note record - Activity tab | Repayment Received | In-app + email by default |
| Settlement posted | Activity + notification | Note record - Activity tab | Note settlement posted | In-app + email by default |
| Note in arrears | Notification | Note record - Late Payment | Note in arrears | In-app + email by default |
| Note defaulted | Activity + notification | Note record - Activity tab | Note defaulted | In-app + email by default |
| Residual return completed | Activity | Note record - Activity tab | — | No automatic message |

### 6. Withdrawal / Refund

| What happened | Customer sees | Where to check in Admin | Message sent | Delivery |
| --- | --- | --- | --- | --- |
| Cash withdrawal submitted | Notification | Finance - Money movement - Investor Withdrawals | Withdrawal submitted | In-app by default; email can be enabled |
| Cash withdrawal completed | Notification | Finance - Money movement - Investor Withdrawals | Withdrawal completed | In-app by default; email can be enabled |
| Withdrawal submitted to trustee | Notification | Note record - Activity tab | Withdrawal submitted to trustee | In-app + email by default |

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
| Member invited | Email (invitee) | Issuer or Investor record - Activity tab | Email sent to invitee | Email only |
| Member added | No customer-facing entry | Issuer or Investor record - Activity tab | — | No automatic message |
| Member removed | No customer-facing entry | Issuer or Investor record - Activity tab | — | No automatic message |
| Member role changed | No customer-facing entry | Issuer or Investor record - Activity tab | — | No automatic message |
| Organisation profile updated | No customer-facing entry | Issuer or Investor record - Activity tab | — | No automatic message |
| MARC assessment saved | No customer-facing entry | Issuer or Investor record - Activity tab | — | No automatic message |
| Identity or company-check status updated | No customer-facing entry | Issuer or Investor record - Activity tab | — | No automatic message |
| Identity documents or liveness completed | No customer-facing entry | Issuer or Investor record - Activity tab | — | No automatic message |

### 3. Notes / Prospectus / Paymaster / Tawarruq

| What happened | Customer sees | Where to check in Admin | Message sent | Delivery |
| --- | --- | --- | --- | --- |
| Prospectus review created | No customer-facing entry | Note record - Activity tab | — | No automatic message |
| Prospectus draft updated | No customer-facing entry | Note record - Activity tab | — | No automatic message |
| Prospectus approved | No customer-facing entry | Note record - Activity tab | — | No automatic message |
| Prospectus approval cleared after edit | No customer-facing entry | Note record - Activity tab | — | No automatic message |
| Prospectus approval cleared after source change | No customer-facing entry | Note record - Activity tab | — | No automatic message |
| Prospectus approval cleared after unpublish | No customer-facing entry | Note record - Activity tab | — | No automatic message |
| Paymaster notice generated | No customer-facing entry | Note record - Activity tab | — | No automatic message |
| Paymaster notice sent | No customer-facing entry | Note record - Activity tab | — | No automatic message |
| Paymaster notice uploaded | No customer-facing entry | Note record - Activity tab | — | No automatic message |
| Paymaster acknowledgement uploaded | No customer-facing entry | Note record - Activity tab | — | No automatic message |
| Paymaster acknowledgement confirmed | No customer-facing entry | Note record - Activity tab | — | No automatic message |
| Tawarruq order submitted | No customer-facing entry | Note record - Activity tab | — | No automatic message |
| Tawarruq certificate retrieved | No customer-facing entry | Note record - Activity tab | — | No automatic message |

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
| Generated letter or document hash stored | No customer-facing entry | Note record - Activity tab may show the letter. Hash itself has no dedicated Audit tab | — | No automatic message |

### 5. Payments / Gateway / Reconciliation

For payment confirmation, use **Finance - Payments - Gateway Payments**. Do not use Activity alone as payment proof.

| What happened | Customer sees | Where to check in Admin | Message sent | Delivery |
| --- | --- | --- | --- | --- |
| Bank name check started | No customer-facing entry | Finance - Payments - Gateway Payments | — | No automatic message |
| Bank name check approved | No customer-facing entry | Finance - Payments - Gateway Payments | — | No automatic message |
| Bank name check rejected | Notification (investor deposit) | Finance - Payments - Gateway Payments | Deposit verification failed | In-app by default; email can be enabled |
| Payment captured | Notification or Activity depending on the payment type | Finance - Payments - Gateway Payments | Deposit successful or the matching fee-paid message | See Fees, Deposit, or Onboarding |
| Capture amount mismatch | No customer-facing entry | Finance - Payments - Gateway Payments | — | No automatic message |
| Checkout expired | No customer-facing entry | Finance - Payments - Gateway Payments | — | No automatic message |
| Refund started | Notification (investor deposit) | Finance - Payments - Gateway Payments | Deposit refund started | In-app by default; email can be enabled |
| Refund completed | Notification (investor deposit) | Finance - Payments - Gateway Payments | Deposit refund completed | In-app by default; email can be enabled |
| Wallet reversal failed after refund | No customer-facing entry | Finance - Payments - Gateway Payments | — | No automatic message |
| Settlement reconciliation run | No customer-facing entry | Finance - Reconciliation | — | No automatic message |
| Reconciliation exception | No customer-facing entry | Finance - Reconciliation | — | No automatic message |

### 6. Access / Security

| What happened | Customer sees | Where to check in Admin | Message sent | Delivery |
| --- | --- | --- | --- | --- |
| Login | No customer-facing entry | Audit - Access | — | No automatic message |
| First account created | No customer-facing entry | Audit - Access | — | No automatic message |
| Logout | No customer-facing entry | Audit - Access | — | No automatic message |
| Password changed | Notification | Audit - Security | Password Changed | Always in-app + email |
| Email verification (success or failed attempt) | No customer-facing entry | Audit - Security | — | No automatic message |
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
| Product created | No customer-facing entry | Audit - Products | New Product Alert only if Operations sends it manually | In-app + email by default when sent |
| Product updated | No customer-facing entry | Audit - Products | — | No automatic message |
| Product deleted | No customer-facing entry | Audit - Products | — | No automatic message |

### 8. Notifications / Emails

In-app messages appear in the issuer or investor bell. Delivery of those messages is recorded in **Audit - Notifications**.

Emails sent only to a signer, invitee, trustee, or verification person do **not** appear in Audit - Notifications.

#### Platform messages

| Message | Sent to | When it is sent | Delivery | Where Admin checks |
| --- | --- | --- | --- | --- |
| Password Changed | The person who changed the password | Password changed in the portal | Always in-app + email | Audit - Notifications |
| Onboarding Completed | The onboarding user | Final approval | In-app + email by default | Audit - Notifications |
| Onboarding Rejected | The onboarding user | Onboarding rejected | In-app + email by default | Audit - Notifications |
| System Announcement | Selected users or a group | Operations sends a custom announcement | In-app + email by default | Audit - Notifications |
| New Product Alert | Selected investors | Operations sends a custom alert (not automatic when a product is created) | In-app + email by default | Audit - Notifications |
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
| Note published | Issuer organisation members | Note published | In-app + email by default | Audit - Notifications |
| Note funding succeeded | Issuer org members | Funding closed successfully | In-app + email by default | Audit - Notifications |
| Funding Unsuccessful (issuer) | Issuer org members | Funding did not complete | In-app + email by default | Audit - Notifications |
| Funding Unsuccessful (investor) | Investors who had committed | Funding did not complete | In-app + email by default | Audit - Notifications |
| Note active (issuer) | Issuer org members | Note activated | In-app + email by default | Audit - Notifications |
| Note active (investor) | Investors on the Note | Note activated | In-app + email by default | Audit - Notifications |
| Note repaid | Issuer org members | Note fully repaid | In-app + email by default | Audit - Notifications |
| Repayment Received | Investors on the Note | Repayment recorded | In-app + email by default | Audit - Notifications |
| Note settlement posted | Investors on the Note | Settlement posted | In-app + email by default | Audit - Notifications |
| Note in arrears (issuer) | Issuer org members | Note entered arrears | In-app + email by default | Audit - Notifications |
| Note in arrears (investor) | Investors | Note entered arrears | In-app + email by default | Audit - Notifications |
| Note defaulted (issuer) | Issuer org members | Note marked default | In-app + email by default | Audit - Notifications |
| Note defaulted (investor) | Investors | Note marked default | In-app + email by default | Audit - Notifications |
| Withdrawal submitted to trustee | Issuer and/or investor members, depending on the withdrawal type | Instruction submitted to trustee | In-app + email by default | Audit - Notifications |
| Repayment rejected | Issuer org members | Repayment rejected | In-app by default; email can be enabled | Audit - Notifications |
| Disbursement completed | Issuer org members | Issuer financing disbursement completed | In-app by default; email can be enabled | Audit - Notifications |
| Upfront facility fee payment required | Issuer owner and organisation admins | Facility offer accepted and an upfront fee is due | In-app + email by default | Audit - Notifications |
| Upfront facility fee paid | Issuer org members | Upfront facility fee paid | In-app + email by default | Audit - Notifications |
| Outstanding late charges to pay | Issuer org members | Settlement posted with leftover late charges | In-app + email by default | Audit - Notifications |
| Late payment charges received | Issuer org members | Outstanding late charges paid | In-app + email by default | Audit - Notifications |
| Deposit verification failed | Investor org members | Deposit name check rejected | In-app by default; email can be enabled | Audit - Notifications |
| Deposit refund started | Investor org members | Deposit refund started | In-app by default; email can be enabled | Audit - Notifications |
| Deposit refund completed | Investor org members | Deposit refund completed | In-app by default; email can be enabled | Audit - Notifications |
| Deposit successful | Investor org members | Deposit credited | In-app by default; email can be enabled | Audit - Notifications |
| Investment committed | The investor who committed | Investment committed | In-app by default; email can be enabled | Audit - Notifications |
| Withdrawal submitted | The investor who requested cash withdrawal | Cash withdrawal submitted | In-app by default; email can be enabled | Audit - Notifications |
| Withdrawal completed | The investor who requested cash withdrawal | Cash withdrawal completed | In-app by default; email can be enabled | Audit - Notifications |

#### Direct emails (not in Audit - Notifications)

| Email | Sent to | When it is sent | Delivery |
| --- | --- | --- | --- |
| Organisation invitation | Invitee | Member invited or invite resent | Email sent to invitee |
| Admin invitation | Invitee | Admin invited or invite resent | Email sent to invitee |
| Signing package / reminder | Named signer | Signing package sent, or reminder requested | Email sent directly to signer |
| Invoice offer verification code | Selected signatory | Issuer requests a code to accept an invoice offer | Email sent to selected signatory |
| Director/shareholder verification | The person who must verify | Director or shareholder verification is required | Email sent directly to the person who must verify |
| Trustee instruction | Trustee recipients | Trustee letter is sent | Email + PDF sent to trustee |

## Additional records used for investigation

These are not the customer Activity feed. Use them when you need payment proof, legal proof, or support investigation.

| Record | What it proves | Where to check in Admin | Customer sees |
| --- | --- | --- | --- |
| Login session | A session was issued | No dedicated Admin screen | No customer-facing entry |
| Signer viewed the package | The signer opened the signing link | Application record - Acceptance (status Viewed) | No customer-facing entry |
| Application review copy | Extra copy of offer sent / amendment sent | No dedicated Admin screen. Use Application record - Activity Timeline | No customer-facing entry |
| Reviewer remarks | Comments entered during review | Application review screens | No customer-facing entry |
| Note Admin action copy | Extra copy of Admin Note actions | No dedicated Admin screen. Use Note record - Activity tab | No customer-facing entry |
| Raw payment-provider update | The payment provider sent an update | No dedicated Admin screen | No customer-facing entry |
| Checkout attempt | A payment checkout was attempted | Finance - Payments - Gateway Payments (payment detail) | No customer-facing entry |
| Payment receipt | Receipt file generated or retried | Finance - Payments - Gateway Payments (payment detail) | No customer-facing entry |
| Reconciliation run | A settlement reconciliation run | Finance - Reconciliation | No customer-facing entry |
| Reconciliation exception | An unmatched or mismatched payment in recon | Finance - Reconciliation | No customer-facing entry |
| Investor wallet movement | Deposit, invest, refund, or cash withdrawal | Investor record and Finance - Money movement - Investor Withdrawals | Wallet history |
| Note ledger | Money movement on the Note | Note record - Ledger | No customer-facing entry |
| Invoice offer verification-code record | A verification code was issued | No dedicated Admin screen | Email |
| Notification delivery record | An in-app or email platform message was sent | Audit - Notifications | Inbox when a platform message was sent |
| Identity check approved (before organisation exists) | Provider approved identity when no organisation record existed yet | Additional investigation only | No customer-facing entry |
| Identity check rejected (provider update) | Provider rejected identity at the transport layer | Additional investigation only | No customer-facing entry |
| Enhanced due diligence provider update | Raw enhanced due diligence update | Additional investigation only. Business result is on the Activity tab as approved or rejected | No customer-facing entry |

## Actions that may not appear in Activity or Notifications

| Action | What Operations should know | Where to check instead |
| --- | --- | --- |
| User cancelled onboarding | No Activity row is created | Issuer or Investor record - current onboarding status |
| Signing reminder | No new Activity row is created | Application record - Acceptance / Signing Package |
| Settlement preview | No Activity row is created | The settlement preview screen |
| Notification preference changed | No Activity entry is created | User notification settings |
| Company-search retry | No Activity row per retry | Later financial-section reset may appear on Application record - Activity Timeline |
| Signed PDF backfill | No Activity row that files were repaired | Application record - Acceptance / documents |
| Forgot password or Admin authenticator reset | Handled by the authentication service, not the Activity log | Follow the account recovery process |
| Onboarding started or onboarding fee paid | No automatic message | Issuer or Investor record - Activity tab |
| More onboarding information required | No automatic message unless a director/shareholder action is raised | Issuer or Investor record - Activity tab |
| Onboarding restarted | No automatic message | Issuer or Investor record - Activity tab |
| Facility enabled | No automatic message | Facility record - Activity tab |
| Facility fee waived | No automatic message | Facility record or Note record - Activity tab |
| Invoice withdrawn | No automatic message | Application record - Activity Timeline |
| Campaign paused or resumed | No automatic message | Note record - Activity tab |
| Note unpublished | No automatic message | Note record - Activity tab |
| Signing package sent (organisation members who are not the signer) | Organisation inbox is not notified | Application record - Acceptance. Signer receives email |
| Signing completed, declined, expired, or voided | No automatic message | Application record - Activity Timeline |
| Repayment approved | No automatic message | Note record - Activity tab |
| Settlement approved (before posting) | No automatic message | Note record - Activity tab |
| Prospectus, paymaster, or tawarruq | No automatic message | Note record - Activity tab |
| Product created | No automatic investor message | Audit - Products. Send New Product Alert only if needed |
| Organisation member invited | No in-app platform message | Email sent to invitee |
| Signing reminder | No in-app platform message | Email sent directly to signer |

## Old items you may see in historical records

These are not created by current flows. Older records can still show them.

| What you may see | What it means |
| --- | --- |
| Application approved | May appear in older records only. Current flows do not create this |
| Facility offer rejected | May appear in older records only. Current decline is Facility Offer Declined |
| Product inactivated / reactivated | May appear in older product records. Current flow deletes a product instead |
| Settlement previewed | May appear in older Note records. Preview no longer creates a timeline row |
| Old trustee service-fee labels | May appear in older records only. Current labels are settlement trustee actions |
| KYC approved (as the stored name) | May appear in older records only. Current identity updates use a status update |
| Terms accepted (old name) | May appear in older records only. Current name is Terms and conditions accepted |
| User completed | May appear in older records only. Current completion is Onboarding completed |
| Note created / Note published (old names) | Labels for older rows. Current names are Note created and Note published from the live actions |
| Account locked | Not created by current flows |
| Ops Alerts | Removed. Not used by the current platform |

## When the same fact appears twice

| What you may see twice | Why |
| --- | --- |
| Facility occupancy and Note occupancy | The same draw, funding, or repayment is recorded on the facility and on the Note |
| Offer or amendment on Activity, plus a review copy | Operations should use the Activity Timeline |
| Admin Note action, plus a second Admin copy | Operations should use the Note Activity tab |
| Fee paid on Activity and in Gateway Payments | Activity is the milestone. Gateway Payments is payment proof |
| Terms accepted on Activity and Legal Acceptances | Activity is the milestone. Legal Acceptances is legal proof |
| Payment provider update and Gateway Payments timeline | Gateway Payments is the business payment record |
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
| Bank name check started | `NAME_CHECK` |
| Bank name check approved | `NAME_CHECK_APPROVED` |
| Bank name check rejected | `NAME_CHECK_REJECTED` |
| Payment captured | `GATEWAY_PAYMENT_COMPLETED` |
| Capture amount mismatch | `CAPTURE_MISMATCH` |
| Checkout expired | `EXPIRED` |
| Refund started | `REFUND_INITIATED` |
| Refund completed | `REFUNDED` |
| Wallet reversal failed after refund | `REFUND_WALLET_REVERSAL_FAILED` |
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
| Reconciliation run | `gateway_recon_runs` |
| Reconciliation exception | `gateway_recon_exceptions` |
| Investor wallet movement | `investor_balance_transactions` |
| Note ledger | `note_ledger_entries` |
| Invoice offer verification-code record | `offer_accept_otp_challenges` |
| Notification delivery record | `notification_logs` |

## Quick Check

| If you need to know... | Check here |
| --- | --- |
| What happened during onboarding? | Issuer / Investor record - Activity tab |
| What happened to an application? | Application record - Activity Timeline |
| What happened to a facility? | Facility record - Activity tab |
| What happened during signing? | Application record - Acceptance / Signing Package |
| What happened to a Note? | Note record - Activity tab |
| Did a payment succeed? | Finance - Payments - Gateway Payments |
| Did reconciliation match? | Finance - Reconciliation |
| Was a legal document accepted? | Audit - Legal Acceptances |
| Did an external guarantor accept? | Audit - External Acceptances |
| Was a platform message sent? | Audit - Notifications |
| Who logged in or changed permissions? | Audit - Access / Security |
