---
title: "Operations Guide: Activity, Logs and Notifications"
description: Where Operations and Finance check Activity, payments, legal proof, and notifications.
category: Platform Operations
tags:
  - admin
  - operations
  - audit
  - notifications
order: 29
updated: 2026-08-31
---

## Issuer Journey

### 1. Onboarding

| What happened | Customer sees | Admin checks | Notification |
| --- | --- | --- | --- |
| Onboarding started | Activity | Issuers → Activity | None |
| Onboarding fee paid | Activity | Issuers → Activity | None |
| More information required | Activity | Issuers → Activity | None |
| Onboarding submission approved | Activity | Issuers → Activity | None |
| Onboarding completed | Activity + notification | Issuers → Activity | Onboarding Completed |
| Onboarding rejected | Activity + notification | Issuers → Activity | Onboarding Rejected |
| Onboarding restarted | Activity | Issuers → Activity | None |

### 2. Application

| What happened | Customer sees | Admin checks | Notification |
| --- | --- | --- | --- |
| Application started | Activity | Applications → Activity Timeline | None |
| Application submitted | Activity + notification | Applications → Activity Timeline | Application Submitted Confirmation |
| Amendment requested | Activity + notification | Applications → Activity Timeline | Application Amendments Requested |
| Application resubmitted | Activity + notification | Applications → Activity Timeline | Application Resubmitted Confirmation |
| Application rejected | Activity + notification | Applications → Activity Timeline | Application Rejected |
| Application withdrawn | Activity + notification | Applications → Activity Timeline | Application Withdrawn Confirmation |
| Application completed | Activity + notification | Applications → Activity Timeline | Application Completed |
| Processing fee paid | Activity | Applications → Activity Timeline | None |

### 3. Offer / Facility / Invoice

| What happened | Customer sees | Admin checks | Notification |
| --- | --- | --- | --- |
| Facility offer sent | Activity + notification | Applications → Activity Timeline | Facility Offer Sent |
| Facility offer accepted | Activity | Applications → Activity Timeline | None |
| Facility offer declined | Activity | Applications → Activity Timeline | None |
| Facility offer expired | Activity + notification | Applications → Activity Timeline | Offer Expired |
| Facility offer retracted | Activity + notification | Applications → Activity Timeline | Offer Retracted or Reset |
| Facility signing deadline extended | Activity + notification | Applications → Activity Timeline | Facility Signing Deadline Extended |
| Invoice signing deadline extended | Activity + notification | Applications → Activity Timeline | Invoice Signing Deadline Extended |
| Invoice offer sent | Activity + notification | Applications → Activity Timeline | Invoice Offer Sent |
| Invoice offer accepted | Activity | Applications → Activity Timeline | None |
| Invoice offer declined | Activity | Applications → Activity Timeline | None |
| Invoice offer expired | Activity + notification | Applications → Activity Timeline | Offer Expired |
| Invoice withdrawn | Activity | Applications → Activity Timeline | None |
| Facility disabled | Notification only | Facilities → Activity | Facility Disabled |
| Facility enabled | No | Facilities → Activity | None |

### 4. Signing

Declined = signer said no. Voided = Operations cancelled it.

| What happened | Customer sees | Admin checks | Notification |
| --- | --- | --- | --- |
| Signing package sent | Activity | Applications → Acceptance | None |
| Signing completed | Activity | Applications → Activity Timeline | None |
| Signing declined | Activity | Applications → Activity Timeline | None |
| Signing expired | Activity | Applications → Activity Timeline | None |
| Signing voided | No | Applications → Activity Timeline | None |
| Signer opened the link | No | Applications → Acceptance | None |

### 5. Fees and Payments

Use Gateway Payments for payment proof.

| What happened | Customer sees | Admin checks | Notification |
| --- | --- | --- | --- |
| Facility fee requested | Notification only | Facilities → Facility & Offer | Upfront facility fee payment required |
| Facility fee paid | Activity + notification | Applications → Activity Timeline | Upfront facility fee paid |
| Late charges due | Notification only | Notes → Activity | Outstanding late charges to pay |
| Late charges paid | Notification only | Finance → Payments → Gateway Payments | Late payment charges received |

### 6. Funding / Note

| What happened | Customer sees | Admin checks | Notification |
| --- | --- | --- | --- |
| Note created | Activity | Notes → Activity | None |
| Note published | Activity + notification | Notes → Activity | Note published |
| Funding closed | Activity + notification | Notes → Activity | Note funding succeeded |
| Funding unsuccessful | Activity + notification | Notes → Activity | Funding Unsuccessful |
| Note activated | Activity + notification | Notes → Activity | Note active |

### 7. Disbursement

| What happened | Customer sees | Admin checks | Notification |
| --- | --- | --- | --- |
| Instruction created | No | Notes → Activity | None |
| Submitted to trustee | Notification only | Notes → Activity | Withdrawal submitted to trustee |
| Disbursement completed | Activity + notification | Notes → Activity | Disbursement completed |

### 8. Repayment

| What happened | Customer sees | Admin checks | Notification |
| --- | --- | --- | --- |
| Repayment submitted | Activity | Notes → Activity | None |
| Repayment received | No | Notes → Activity | None |
| Repayment approved | No | Notes → Activity | None |
| Repayment rejected | Notification only | Notes → Activity | Repayment rejected |

### 9. Late / Default

| What happened | Customer sees | Admin checks | Notification |
| --- | --- | --- | --- |
| Note in arrears | Notification only | Notes → Late Payment | Note in arrears |
| Note defaulted | Activity + notification | Notes → Activity | Note defaulted (issuer) |
| Late charge approved | No | Notes → Activity | None |

### 10. Settlement

| What happened | Customer sees | Admin checks | Notification |
| --- | --- | --- | --- |
| Settlement approved | No | Notes → Activity | None |
| Settlement posted | No | Notes → Activity | None |
| Trustee instruction | No | Notes → Activity | None |

## Investor Journey

### 1. Onboarding

| What happened | Customer sees | Admin checks | Notification |
| --- | --- | --- | --- |
| Onboarding started | Activity | Investors → Activity | None |
| More information required | Activity | Investors → Activity | None |
| Onboarding submission approved | Activity | Investors → Activity | None |
| Onboarding completed | Activity + notification | Investors → Activity | Onboarding Completed |
| Onboarding rejected | Activity + notification | Investors → Activity | Onboarding Rejected |
| Onboarding restarted | Activity | Investors → Activity | None |

### 2. Deposit

Use Gateway Payments for payment proof.

| What happened | Customer sees | Admin checks | Notification |
| --- | --- | --- | --- |
| Deposit successful | Notification only | Finance → Payments → Gateway Payments | Deposit successful |
| Deposit verification failed | Notification only | Finance → Payments → Gateway Payments | Deposit verification failed |
| Deposit refund started | Notification only | Finance → Payments → Gateway Payments | Deposit refund started |
| Deposit refund completed | Notification only | Finance → Payments → Gateway Payments | Deposit refund completed |

### 3. Investment

| What happened | Customer sees | Admin checks | Notification |
| --- | --- | --- | --- |
| Investment committed | Activity + notification | Notes → Activity | Investment committed |

### 4. Funding Outcome

| What happened | Customer sees | Admin checks | Notification |
| --- | --- | --- | --- |
| Funding unsuccessful | Activity + notification | Notes → Activity | Funding Unsuccessful |
| Note became active | Activity + notification | Notes → Activity | Note active |

### 5. Repayment / Return

| What happened | Customer sees | Admin checks | Notification |
| --- | --- | --- | --- |
| Repayment received | Notification only | Notes → Activity | Repayment Received |
| Settlement posted | Activity + notification | Notes → Activity | Note settlement posted |
| Note in arrears | Notification only | Notes → Late Payment | Note in arrears |
| Note defaulted | Activity + notification | Notes → Activity | Note defaulted |

### 6. Withdrawal / Refund

| What happened | Customer sees | Admin checks | Notification |
| --- | --- | --- | --- |
| Withdrawal submitted | Notification only | Finance → Money movement → Investor Withdrawals | Withdrawal submitted |
| Withdrawal completed | Notification only | Finance → Money movement → Investor Withdrawals | Withdrawal completed |

## Admin & Support

### Application Review

| What happened | Customer sees | Admin checks | Notification |
| --- | --- | --- | --- |
| Section approved | No | Applications → Activity Timeline | None |
| Section rejected | No | Applications → Activity Timeline | None |
| Amendment requested | No | Applications → Activity Timeline | None |
| Item approved | No | Applications → Activity Timeline | None |
| Item rejected | No | Applications → Activity Timeline | None |
| Application returned to review | No | Applications → Activity Timeline | None |

### Organisation / Members

| What happened | Customer sees | Admin checks | Notification |
| --- | --- | --- | --- |
| Member invited | No | Issuers / Investors → Activity | None |
| Member added | No | Issuers / Investors → Activity | None |
| Member removed | No | Issuers / Investors → Activity | None |
| Member role changed | No | Issuers / Investors → Activity | None |
| Profile updated | No | Issuers / Investors → Activity | None |
| MARC assessment saved | No | Issuers / Investors → Activity | None |

### Legal

Use Legal Acceptances for legal proof.

| What happened | Customer sees | Admin checks | Notification |
| --- | --- | --- | --- |
| Legal document changed | No | Audit → Legal Documents | None |
| Legal document accepted | No | Audit → Legal Acceptances | None |
| External person accepted | No | Audit → External Acceptances | None |
| Generated document proof | No | Internal record only | None |

### Payments

Use Gateway Payments for payment proof.

| What happened | Customer sees | Admin checks | Notification |
| --- | --- | --- | --- |
| Payment completed | No | Finance → Payments → Gateway Payments | None |
| Payment failed | No | Finance → Payments → Gateway Payments | None |
| Payment expired | No | Finance → Payments → Gateway Payments | None |
| Payment refunded | No | Finance → Payments → Gateway Payments | None |

### Security

| What happened | Customer sees | Admin checks | Notification |
| --- | --- | --- | --- |
| Login | No | Audit → Access | None |
| Logout | No | Audit → Access | None |
| Password changed | Notification only | Audit → Security | Password Changed |
| Roles / permissions changed | No | Audit → Security | None |

### Notifications

Customer: Bell / inbox and email when enabled.

Admin: Audit → Notifications.

### Products

| What happened | Customer sees | Admin checks | Notification |
| --- | --- | --- | --- |
| Product created | No | Audit → Products | None |
| Product updated | No | Audit → Products | None |
| Product deleted | No | Audit → Products | None |

## Quick Check

| Question | Check here |
| --- | --- |
| What happened to onboarding? | Issuers / Investors → Activity |
| What happened to an application? | Applications → Activity Timeline |
| What happened to a facility? | Facilities → Activity |
| What happened to a Note? | Notes → Activity |
| Did payment succeed? | Finance → Payments → Gateway Payments |
| Was a legal document accepted? | Audit → Legal Acceptances |
| Did a guarantor accept? | Audit → External Acceptances |
| Did we send a notification? | Audit → Notifications |
| Who logged in or changed access? | Audit → Access / Security |
