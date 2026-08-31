---
title: "Operations Guide: Activity, Logs and Notifications"
description: Exhaustive live Activity events, logs, notifications, and emails for Operations and Finance.
category: Platform Operations
tags:
  - admin
  - operations
  - audit
  - notifications
order: 29
updated: 2026-08-31
---

Customer **Activity** is the portal `/activity` feed. **Admin checks** is the Operations screen. **None** means no typed inbox or email. **Email only** is SES that is not a typed inbox type and does not appear in Audit → Notifications.

## Issuer Journey

### 1. Onboarding

| What happened | System event | Customer sees | Admin checks | Notification / email |
| --- | --- | --- | --- | --- |
| Onboarding started | `ONBOARDING_STARTED` | Activity | Issuers → Activity | None |
| Onboarding fee paid | `ONBOARDING_FEE_PAID` | Activity | Issuers → Activity | None |
| Onboarding resumed | `ONBOARDING_RESUMED` | No | Issuers → Activity | None |
| KYC / KYB / COD status update | `ONBOARDING_STATUS_UPDATED` | No | Issuers → Activity | None |
| Form / liveness / ID uploaded | `FORM_FILLED` | No | Issuers → Activity | None |
| More information required | `ONBOARDING_AMENDMENT_REQUIRED` | Activity | Issuers → Activity | None |
| Onboarding restarted | `ONBOARDING_CANCELLED` | Activity (title: Onboarding Restarted) | Issuers → Activity | None |
| Onboarding reset | `ONBOARDING_RESET` | No | Issuers → Activity | None |
| Onboarding rejected | `ONBOARDING_REJECTED` | Activity + notification | Issuers → Activity | Onboarding Rejected |
| Corporate onboarding rejected | `COD_REJECTED` | Activity + notification | Issuers → Activity | Onboarding Rejected |
| Onboarding submission approved | `ONBOARDING_APPROVED` | Activity | Issuers → Activity | None |
| Onboarding completed (final approval) | `FINAL_APPROVAL_COMPLETED` | Activity + notification | Issuers → Activity | Onboarding Completed |
| AML approved | `AML_APPROVED` | No | Issuers → Activity | None |
| SSM / KYB company approved | `SSM_APPROVED` | No | Issuers → Activity | None |
| T&C accepted | `TNC_APPROVED` | No | Issuers → Activity | None |
| EOD approved | `EOD_APPROVED` | No | Issuers → Activity | None |
| EOD rejected | `EOD_REJECTED` | No | Issuers → Activity | None |
| EOD webhook (raw) | `EOD_WEBHOOK` | No | Internal / forensic only | None |
| Provider webhook approved (no org yet) | `WEBHOOK_APPROVED` | No | Internal / forensic only | None |
| Provider webhook rejected | `WEBHOOK_REJECTED` | No | Internal / forensic only | None |
| Director / shareholder action required | (no Activity event) | Notification | Issuers → People | Director/Shareholder Action Required |
| Director / shareholder verify link | (no Activity event) | Email only | Issuers → People | Email only: Complete your verification |

### 2. Application

| What happened | System event | Customer sees | Admin checks | Notification / email |
| --- | --- | --- | --- | --- |
| Application started | `APPLICATION_CREATED` | Activity | Applications → Activity Timeline | None |
| Processing fee paid | `APPLICATION_PROCESSING_FEE_PAID` | Activity | Applications → Activity Timeline | None |
| Application submitted | `APPLICATION_SUBMITTED` | Activity + notification | Applications → Activity Timeline | Application Submitted Confirmation (inbox; email off by default) |
| Amendment pack sent | `AMENDMENTS_SUBMITTED` | Activity + notification (title: Amendment Request Sent) | Applications → Activity Timeline | Application Amendments Requested |
| Application resubmitted | `APPLICATION_RESUBMITTED` | Activity + notification | Applications → Activity Timeline | Application Resubmitted Confirmation |
| Application rejected | `APPLICATION_REJECTED` | Activity + notification | Applications → Activity Timeline | Application Rejected |
| Application withdrawn | `APPLICATION_WITHDRAWN` | Activity + notification | Applications → Activity Timeline | Application Withdrawn Confirmation |
| Application completed | `APPLICATION_COMPLETED` | Activity + notification | Applications → Activity Timeline | Application Completed |
| Application returned to review | `APPLICATION_RESET_TO_UNDER_REVIEW` | No | Applications → Activity Timeline | Offer Retracted or Reset (when an offer is reset) |

### 3. Offer / Facility / Invoice

| What happened | System event | Customer sees | Admin checks | Notification / email |
| --- | --- | --- | --- | --- |
| Facility offer sent | `CONTRACT_OFFER_SENT` | Activity + notification | Applications → Activity Timeline | Facility Offer Sent |
| Facility acceptance submitted | `CONTRACT_OFFER_ACCEPTANCE_SUBMITTED` | Activity | Applications → Activity Timeline | None |
| Facility acceptance resubmitted | `CONTRACT_OFFER_ACCEPTANCE_RESUBMITTED` | Activity | Applications → Activity Timeline | None |
| Facility acceptance approved for signing | `CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING` | No | Applications → Activity Timeline | None |
| Facility offer accepted | `CONTRACT_OFFER_ACCEPTED` | Activity | Applications → Activity Timeline | None |
| Facility offer declined | `CONTRACT_OFFER_DECLINED` | Activity + notification | Applications → Activity Timeline | Application Withdrawn Confirmation (decline copy) |
| Facility offer retracted | `CONTRACT_OFFER_RETRACTED` | Activity + notification | Applications → Activity Timeline | Offer Retracted or Reset |
| Facility offer expired | `CONTRACT_OFFER_EXPIRED` | Activity + notification | Applications → Activity Timeline | Offer Expired |
| Offer expiring soon | (no Activity event) | Notification | Applications → Activity Timeline | Offer Expiry Reminder (uses product `days_before_expiry`, not always 24h) |
| Facility signing deadline extended | `CONTRACT_SIGNING_DEADLINE_EXTENDED` | Activity + notification | Applications → Activity Timeline | Facility Signing Deadline Extended |
| Facility occupancy updated | `CONTRACT_FACILITY_OCCUPANCY_UPDATED` | Activity | Facilities → Activity | None |
| Facility fee waived (contract) | `CONTRACT_FACILITY_FEE_WAIVED` | No | Facilities → Activity | None |
| Facility disabled | `CONTRACT_FACILITY_DISABLED` | Notification | Facilities → Activity | Facility Disabled |
| Facility enabled | `CONTRACT_FACILITY_ENABLED` | No | Facilities → Activity | None |
| Large-private customer flag updated | `CONTRACT_CUSTOMER_LARGE_PRIVATE_UPDATED` | No | Facilities → Activity | None |
| Invoice offer sent | `INVOICE_OFFER_SENT` | Activity + notification | Applications → Activity Timeline | Invoice Offer Sent |
| Invoice acceptance submitted | `INVOICE_OFFER_ACCEPTANCE_SUBMITTED` | Activity | Applications → Activity Timeline | None |
| Invoice acceptance resubmitted | `INVOICE_OFFER_ACCEPTANCE_RESUBMITTED` | Activity | Applications → Activity Timeline | None |
| Invoice acceptance approved for signing | `INVOICE_ACCEPTANCE_APPROVED_FOR_SIGNING` | No | Applications → Activity Timeline | None |
| Invoice offer accepted | `INVOICE_OFFER_ACCEPTED` | Activity | Applications → Activity Timeline | None |
| Invoice offer declined | `INVOICE_OFFER_REJECTED` | Activity + notification | Applications → Activity Timeline | Application Withdrawn Confirmation (decline copy) |
| Invoice offer retracted | `INVOICE_OFFER_RETRACTED` | Activity + notification | Applications → Activity Timeline | Offer Retracted or Reset |
| Invoice offer expired | `INVOICE_OFFER_EXPIRED` | Activity + notification | Applications → Activity Timeline | Offer Expired |
| Invoice signing deadline extended | `INVOICE_SIGNING_DEADLINE_EXTENDED` | Activity + notification | Applications → Activity Timeline | Invoice Signing Deadline Extended |
| Invoice withdrawn | `INVOICE_WITHDRAWN` | Activity | Applications → Activity Timeline | None |
| Acceptance documents need updates | (no dedicated Activity event) | Notification | Applications → Acceptance | Acceptance Documents Need Updates |
| Invoice offer accept OTP | (no Activity event) | Email only | Applications → Acceptance | Email only: verification code |

### 4. Signing

Declined = signer said no. Voided = Operations cancelled it.

| What happened | System event | Customer sees | Admin checks | Notification / email |
| --- | --- | --- | --- | --- |
| Signing package created | `SIGNING_PACKAGE_CREATED` | No | Applications → Activity Timeline | None |
| Signing package sent | `SIGNING_PACKAGE_SENT` | Activity | Applications → Activity Timeline | Email only: Signature requested (signer). Org inbox: None |
| Signing completed | `SIGNING_PACKAGE_COMPLETED` | Activity | Applications → Activity Timeline | None |
| Signing declined | `SIGNING_PACKAGE_DECLINED` | Activity | Applications → Activity Timeline | None |
| Signing expired | `SIGNING_PACKAGE_EXPIRED` | Activity | Applications → Activity Timeline | None |
| Signing voided | `SIGNING_PACKAGE_VOIDED` | No | Applications → Activity Timeline | None |
| Signing reminder | (no Activity event) | Email only | Applications → Acceptance | Email only: Reminder (signer) |

### 5. Fees / Payments

Use Gateway Payments for payment proof.

| What happened | System event | Customer sees | Admin checks | Notification / email |
| --- | --- | --- | --- | --- |
| Facility fee requested | (no Activity event) | Notification | Facilities → Facility & Offer | Upfront facility fee payment required |
| Facility fee paid | `FACILITY_FEE_PAID` | Activity + notification | Applications → Activity Timeline | Upfront facility fee paid |
| Facility fee collection waived (note) | `WAIVE_FACILITY_FEE_COLLECTION` | No | Notes → Activity | None |
| Late charges due | (see settlement) | Notification | Notes → Activity | Outstanding late charges to pay |
| Late charges paid | (see gateway) | Notification | Finance → Payments → Gateway Payments | Late payment charges received |

### 6. Funding / Note

| What happened | System event | Customer sees | Admin checks | Notification / email |
| --- | --- | --- | --- | --- |
| Note created | `NOTE_CREATED_FROM_INVOICE` | Activity (issuer) | Notes → Activity | None |
| Draft updated | `UPDATE_DRAFT` | No | Notes → Activity | None |
| Featured settings updated | `UPDATE_FEATURED_SETTINGS` | No | Notes → Activity | None |
| Note published | `PUBLISH` | Activity + notification (issuer) | Notes → Activity | Note published |
| Unpublished from marketplace | `UNPUBLISH` | No | Notes → Activity | None |
| Campaign paused | `PAUSE_LISTING` | Activity (issuer) | Notes → Activity | None |
| Campaign resumed | `RESUME_LISTING` | Activity (issuer) | Notes → Activity | None |
| Funding closed | `CLOSE_FUNDING` | Activity + notification (issuer) | Notes → Activity | Note funding succeeded |
| Funding unsuccessful | `FAIL_FUNDING` | Activity + notification | Notes → Activity | Funding Unsuccessful (issuer + investor) |
| Note activated | `ACTIVATE` | Activity + notification | Notes → Activity | Note active (issuer + investor) |
| Note occupancy updated | `FACILITY_OCCUPANCY_UPDATED` | No | Notes → Activity | None |
| Note fully repaid | `SETTLEMENT_POSTED` (issuer notif) | Notification (issuer) | Notes → Activity | Note repaid |

### 7. Disbursement

| What happened | System event | Customer sees | Admin checks | Notification / email |
| --- | --- | --- | --- | --- |
| Disbursement instruction created | `ISSUER_DISBURSEMENT_WITHDRAWAL_CREATED` | No | Notes → Activity | None |
| Withdrawal letter generated | `WITHDRAWAL_LETTER_GENERATED` | No | Notes → Activity | None |
| Submitted to trustee | `WITHDRAWAL_SUBMITTED_TO_TRUSTEE` | Notification | Notes → Activity | Withdrawal submitted to trustee |
| Beneficiary updated | `WITHDRAWAL_BENEFICIARY_UPDATED` | No | Notes → Activity | None |
| Trustee email sent | `WITHDRAWAL_TRUSTEE_EMAIL_SENT` | No | Notes → Activity | Email only: trustee instruction + PDF |
| Disbursement completed | `WITHDRAWAL_COMPLETED` | Activity + notification (issuer, financing disbursement only) | Notes → Activity | Disbursement completed (inbox; email off by default) |

### 8. Repayment

| What happened | System event | Customer sees | Admin checks | Notification / email |
| --- | --- | --- | --- | --- |
| Repayment submitted (needs review) | `ISSUER_PAYMENT_SUBMITTED` | Activity (issuer) | Notes → Activity | None |
| Repayment received (no review) | `PAYMENT_RECEIVED` | No (issuer Activity). Investor: notification | Notes → Activity | Repayment Received (investor) |
| Repayment approved | `PAYMENT_APPROVED` | No | Notes → Activity | None |
| Repayment rejected | `PAYMENT_REJECTED` | Notification (issuer) | Notes → Activity | Repayment rejected (inbox; email off by default) |

### 9. Late / Default

| What happened | System event | Customer sees | Admin checks | Notification / email |
| --- | --- | --- | --- | --- |
| Servicing moved to arrears | `OVERDUE_LATE_CHARGE_CHECKED` | Notification | Notes → Late Payment | Note in arrears (issuer + investor) |
| Note defaulted | `NOTE_DEFAULT_MARKED` | Activity + notification | Notes → Activity | Note defaulted (issuer + investor) |
| Late charge approved | `LATE_CHARGE_APPROVED` | No | Notes → Activity | None |
| Arrears letter generated | `ARREARS_LETTER_GENERATED` | No | Notes → Activity | None |
| Default letter generated | `DEFAULT_LETTER_GENERATED` | No | Notes → Activity | None |

### 10. Settlement

| What happened | System event | Customer sees | Admin checks | Notification / email |
| --- | --- | --- | --- | --- |
| Settlement approved | `SETTLEMENT_APPROVED` | No | Notes → Activity | None |
| Settlement posted | `SETTLEMENT_POSTED` | Activity (investor) + notifications | Notes → Activity | Note settlement posted (investor). Note repaid (issuer). Outstanding late charges if leftover |
| Settlement trustee letter generated | `SETTLEMENT_TRUSTEE_LETTER_GENERATED` | No | Notes → Activity | None |
| Settlement trustee letter submitted | `SETTLEMENT_TRUSTEE_LETTER_SUBMITTED` | No | Notes → Activity | None |
| Settlement trustee instruction completed | `SETTLEMENT_TRUSTEE_INSTRUCTION_COMPLETED` | No | Notes → Activity | None |
| Settlement trustee email sent | `SETTLEMENT_TRUSTEE_EMAIL_SENT` | No | Notes → Activity | Email only: trustee instruction + PDF |

## Investor Journey

### 1. Onboarding

| What happened | System event | Customer sees | Admin checks | Notification / email |
| --- | --- | --- | --- | --- |
| Onboarding started | `ONBOARDING_STARTED` | Activity | Investors → Activity | None |
| Onboarding resumed | `ONBOARDING_RESUMED` | No | Investors → Activity | None |
| KYC / KYB status update | `ONBOARDING_STATUS_UPDATED` | No | Investors → Activity | None |
| Form / liveness / ID uploaded | `FORM_FILLED` | No | Investors → Activity | None |
| More information required | `ONBOARDING_AMENDMENT_REQUIRED` | Activity | Investors → Activity | None |
| Onboarding restarted | `ONBOARDING_CANCELLED` | Activity (title: Onboarding Restarted) | Investors → Activity | None |
| Onboarding reset | `ONBOARDING_RESET` | No | Investors → Activity | None |
| Onboarding rejected | `ONBOARDING_REJECTED` | Activity + notification | Investors → Activity | Onboarding Rejected |
| Onboarding submission approved | `ONBOARDING_APPROVED` | Activity | Investors → Activity | None |
| Onboarding completed | `FINAL_APPROVAL_COMPLETED` | Activity + notification | Investors → Activity | Onboarding Completed |
| T&C accepted | `TNC_APPROVED` | No | Investors → Activity | None |
| Sophisticated status updated | `SOPHISTICATED_STATUS_UPDATED` | No | Investors → Activity | None |
| AML approved | `AML_APPROVED` | No | Investors → Activity | None |
| Investor director / shareholder action | (no Activity event) | Notification | Investors → People | Investor Director/Shareholder Action Required |

### 2. Deposit

Use Gateway Payments for payment proof.

| What happened | System event | Customer sees | Admin checks | Notification / email |
| --- | --- | --- | --- | --- |
| Name check started | `NAME_CHECK` | No | Finance → Payments → Gateway Payments | None |
| Name check approved | `NAME_CHECK_APPROVED` | No | Finance → Payments → Gateway Payments | None |
| Name check rejected | `NAME_CHECK_REJECTED` | Notification | Finance → Payments → Gateway Payments | Deposit verification failed (inbox; email off by default) |
| Payment captured | `GATEWAY_PAYMENT_COMPLETED` | Notification (when deposit credited) | Finance → Payments → Gateway Payments | Deposit successful (inbox; email off by default) |
| Capture amount mismatch | `CAPTURE_MISMATCH` | No | Finance → Payments → Gateway Payments | None |
| Checkout expired | `EXPIRED` | No | Finance → Payments → Gateway Payments | None |
| Refund started | `REFUND_INITIATED` | Notification | Finance → Payments → Gateway Payments | Deposit refund started (inbox; email off by default) |
| Refund completed | `REFUNDED` | Notification | Finance → Payments → Gateway Payments | Deposit refund completed (inbox; email off by default) |
| Wallet reversal failed | `REFUND_WALLET_REVERSAL_FAILED` | No | Finance → Payments → Gateway Payments | None |

### 3. Investment

| What happened | System event | Customer sees | Admin checks | Notification / email |
| --- | --- | --- | --- | --- |
| Investment committed | `INVESTMENT_COMMITTED` | Activity + notification | Notes → Activity | Investment committed (inbox; email off by default) |

### 4. Funding

| What happened | System event | Customer sees | Admin checks | Notification / email |
| --- | --- | --- | --- | --- |
| Funding unsuccessful | `FAIL_FUNDING` | Activity + notification | Notes → Activity | Funding Unsuccessful (commitment released) |
| Note became active | `ACTIVATE` | Activity + notification | Notes → Activity | Note active |

### 5. Repayment / Return

| What happened | System event | Customer sees | Admin checks | Notification / email |
| --- | --- | --- | --- | --- |
| Repayment received | `PAYMENT_RECEIVED` | Notification | Notes → Activity | Repayment Received |
| Settlement posted | `SETTLEMENT_POSTED` | Activity + notification | Notes → Activity | Note settlement posted |
| Note in arrears | `OVERDUE_LATE_CHARGE_CHECKED` | Notification | Notes → Late Payment | Note in arrears |
| Note defaulted | `NOTE_DEFAULT_MARKED` | Activity + notification | Notes → Activity | Note defaulted |
| Residual return completed | `WITHDRAWAL_COMPLETED` | Activity (label depends on withdrawal type) | Notes → Activity | None (not the issuer disbursement type) |

### 6. Withdrawal / Refund

| What happened | System event | Customer sees | Admin checks | Notification / email |
| --- | --- | --- | --- | --- |
| Cash withdrawal submitted | (wallet + typed notif) | Notification | Finance → Money movement → Investor Withdrawals | Withdrawal submitted (inbox; email off by default) |
| Cash withdrawal completed | (wallet + typed notif) | Notification | Finance → Money movement → Investor Withdrawals | Withdrawal completed (inbox; email off by default) |
| Withdrawal submitted to trustee | `WITHDRAWAL_SUBMITTED_TO_TRUSTEE` | Notification | Notes → Activity | Withdrawal submitted to trustee |

## Admin & Support

### 1. Application Review

| What happened | System event | Customer sees | Admin checks | Notification / email |
| --- | --- | --- | --- | --- |
| Section approved | `SECTION_REVIEWED_APPROVED` | No | Applications → Activity Timeline | None |
| Section rejected | `SECTION_REVIEWED_REJECTED` | No | Applications → Activity Timeline | None |
| Section amendment requested | `SECTION_REVIEWED_AMENDMENT_REQUESTED` | No | Applications → Activity Timeline | None |
| Section reset to pending | `SECTION_REVIEWED_PENDING` | No | Applications → Activity Timeline | None |
| Item approved | `ITEM_REVIEWED_APPROVED` | No | Applications → Activity Timeline | None |
| Item rejected | `ITEM_REVIEWED_REJECTED` | No | Applications → Activity Timeline | None |
| Item amendment requested | `ITEM_REVIEWED_AMENDMENT_REQUESTED` | No | Applications → Activity Timeline | None |
| Item reset to pending | `ITEM_REVIEWED_PENDING` | No | Applications → Activity Timeline | None |

### 2. Organisation / Membership

| What happened | System event | Customer sees | Admin checks | Notification / email |
| --- | --- | --- | --- | --- |
| Member invited | `MEMBER_INVITED` | No | Issuers / Investors → Activity | Email only: organisation invite |
| Member added | `MEMBER_ADDED` | No | Issuers / Investors → Activity | None |
| Member removed | `MEMBER_REMOVED` | No | Issuers / Investors → Activity | None |
| Member role changed | `MEMBER_ROLE_CHANGED` | No | Issuers / Investors → Activity | None |
| Profile updated | `PROFILE_UPDATED` | No | Issuers / Investors → Activity | None |
| MARC assessment saved | `MARC_ASSESSMENT_SAVED` | No | Issuers / Investors → Activity | None |

### 3. Notes / Prospectus / Paymaster / Tawarruq

| What happened | System event | Customer sees | Admin checks | Notification / email |
| --- | --- | --- | --- | --- |
| Prospectus review created | `PROSPECTUS_REVIEW_CREATE` | No | Notes → Activity | None |
| Prospectus draft updated | `PROSPECTUS_REVIEW_DRAFT_UPDATE` | No | Notes → Activity | None |
| Prospectus approved | `PROSPECTUS_REVIEW_APPROVE` | No | Notes → Activity | None |
| Prospectus approval cleared after edit | `PROSPECTUS_APPROVAL_INVALIDATED_EDIT` | No | Notes → Activity | None |
| Prospectus approval cleared after source change | `PROSPECTUS_APPROVAL_INVALIDATED_SOURCE` | No | Notes → Activity | None |
| Prospectus approval cleared after unpublish | `PROSPECTUS_APPROVAL_INVALIDATED_UNPUBLISH` | No | Notes → Activity | None |
| Paymaster notice generated | `PAYMASTER_NOTICE_GENERATED` | No | Notes → Activity | None |
| Paymaster notice sent | `PAYMASTER_NOTICE_SENT` | No | Notes → Activity | None |
| Paymaster notice uploaded | `PAYMASTER_NOTICE_UPLOADED` | No | Notes → Activity | None |
| Paymaster acknowledgement uploaded | `PAYMASTER_ACKNOWLEDGEMENT_UPLOADED` | No | Notes → Activity | None |
| Paymaster acknowledgement confirmed | `PAYMASTER_ACKNOWLEDGEMENT_CONFIRMED` | No | Notes → Activity | None |
| Tawarruq order submitted | `SHORAKA_ORDER_SUBMITTED` | No | Notes → Activity | None |
| Tawarruq certificate retrieved | `SHORAKA_CERTIFICATE_FETCHED` | No | Notes → Activity | None |

### 4. Legal

Use Legal Acceptances for legal proof. These are not Activity events.

| What happened | System event | Customer sees | Admin checks | Notification / email |
| --- | --- | --- | --- | --- |
| Legal document created | `LEGAL_DOCUMENT_CREATED` | No | Audit → Legal Documents | None |
| Legal document updated | `LEGAL_DOCUMENT_UPDATED` | No | Audit → Legal Documents | None |
| Version uploaded | `LEGAL_VERSION_UPLOADED` | No | Audit → Legal Documents | None |
| Version file replaced | `LEGAL_VERSION_FILE_REPLACED` | No | Audit → Legal Documents | None |
| Version published | `LEGAL_VERSION_PUBLISHED` | No | Audit → Legal Documents | None |
| Version archived | `LEGAL_VERSION_ARCHIVED` | No | Audit → Legal Documents | None |
| Version restored | `LEGAL_VERSION_RESTORED` | No | Audit → Legal Documents | None |
| Legal document accepted | `LEGAL_DOCUMENT_ACCEPTANCE` | No | Audit → Legal Acceptances | None |
| External person accepted | `LEGAL_EXTERNAL_ACCEPTANCE` | No | Audit → External Acceptances | None |
| Generated document hash stored | `GENERATED_DOCUMENT_EVIDENCE` | No | Internal / forensic only (letter may also show on Notes → Activity) | None |

### 5. Payments / Gateway / Reconciliation

| What happened | System event | Customer sees | Admin checks | Notification / email |
| --- | --- | --- | --- | --- |
| Name check started | `NAME_CHECK` | No | Finance → Payments → Gateway Payments | None |
| Name check approved | `NAME_CHECK_APPROVED` | No | Finance → Payments → Gateway Payments | None |
| Name check rejected | `NAME_CHECK_REJECTED` | Notification (investor deposit) | Finance → Payments → Gateway Payments | Deposit verification failed |
| Payment captured | `GATEWAY_PAYMENT_COMPLETED` | Activity when it is an application/onboarding/facility fee | Finance → Payments → Gateway Payments | Deposit successful or fee paid types when those flows apply |
| Capture mismatch | `CAPTURE_MISMATCH` | No | Finance → Payments → Gateway Payments | None |
| Checkout expired | `EXPIRED` | No | Finance → Payments → Gateway Payments | None |
| Refund started | `REFUND_INITIATED` | Notification (investor deposit) | Finance → Payments → Gateway Payments | Deposit refund started |
| Refund completed | `REFUNDED` | Notification (investor deposit) | Finance → Payments → Gateway Payments | Deposit refund completed |
| Wallet reversal failed | `REFUND_WALLET_REVERSAL_FAILED` | No | Finance → Payments → Gateway Payments | None |

### 6. Access / Security

| What happened | System event | Customer sees | Admin checks | Notification / email |
| --- | --- | --- | --- | --- |
| Login | `LOGIN` | No | Audit → Access | None |
| Sign up (first user row) | `SIGNUP` | No | Audit → Access | None |
| Logout | `LOGOUT` | No | Audit → Access | None |
| Password changed | `PASSWORD_CHANGED` | Notification | Audit → Security | Password Changed (always inbox + email) |
| Email verified (success or failure) | `EMAIL_VERIFIED` | No | Audit → Security | None |
| Role created | `ROLE_CREATED` | No | Audit → Security | None |
| Role permissions updated | `ROLE_PERMISSIONS_UPDATED` | No | Audit → Security | None |
| Role added | `ROLE_ADDED` | No | Audit → Security | None |
| Role removed | `ROLE_REMOVED` | No | Audit → Security | None |
| Role switched | `ROLE_SWITCHED` | No | Audit → Security | None |
| Admin invitation revoked | `INVITATION_REVOKED` | No | Audit → Security | None |
| Platform finance settings updated | `PLATFORM_FINANCE_SETTINGS_UPDATED` | No | Audit → Security | None |

### 7. Products

| What happened | System event | Customer sees | Admin checks | Notification / email |
| --- | --- | --- | --- | --- |
| Product created | `PRODUCT_CREATED` | No | Audit → Products | None (New Product Alert is Admin custom send only) |
| Product updated | `PRODUCT_UPDATED` | No | Audit → Products | None |
| Product deleted | `PRODUCT_DELETED` | No | Audit → Products | None |

### 8. Notifications / Emails

Typed types write inbox rows and `notification_logs`. Email-only SES does **not** appear in Audit → Notifications.

#### Typed notifications

| Notification | Recipient | Trigger | Channel | Related event | Admin checks |
| --- | --- | --- | --- | --- | --- |
| Password Changed | Acting user | In-app password change | Inbox + email (forced) | `PASSWORD_CHANGED` | Audit → Notifications |
| Onboarding Completed | Onboarding user | Final approval | Inbox + email | `FINAL_APPROVAL_COMPLETED` | Audit → Notifications |
| Onboarding Rejected | Onboarding user | Provider reject | Inbox + email | `ONBOARDING_REJECTED` / `COD_REJECTED` | Audit → Notifications |
| System Announcement | Selected users / group | Admin custom send | Prefs (default both) | None (manual) | Audit → Notifications (`source=ADMIN`) |
| New Product Alert | Selected investors | Admin custom send only | Prefs (default both) | Not `PRODUCT_CREATED` | Audit → Notifications |
| Application Amendments Requested | Issuer owner + org admins | Amendment pack sent | Inbox + email | `AMENDMENTS_SUBMITTED` | Audit → Notifications |
| Acceptance Documents Need Updates | Issuer owner + org admins | First CHANGES_REQUESTED in a cycle | Inbox + email | Review item status | Audit → Notifications |
| Application Rejected | Issuer owner + org admins | Application rejected | Inbox + email | `APPLICATION_REJECTED` | Audit → Notifications |
| Facility Offer Sent | Issuer owner + org admins | Facility offer sent | Inbox + email | `CONTRACT_OFFER_SENT` | Audit → Notifications |
| Invoice Offer Sent | Issuer owner + org admins | Invoice offer sent | Inbox + email | `INVOICE_OFFER_SENT` | Audit → Notifications |
| Offer Retracted or Reset | Issuer owner + org admins | Retract or reset to review | Inbox + email | `CONTRACT_OFFER_RETRACTED` / `INVOICE_OFFER_RETRACTED` / `APPLICATION_RESET_TO_UNDER_REVIEW` | Audit → Notifications |
| Offer Expired | Issuer owner + org admins | Offer deadline job | Inbox + email | `CONTRACT_OFFER_EXPIRED` / `INVOICE_OFFER_EXPIRED` | Audit → Notifications |
| Offer Expiry Reminder | Issuer owner + org admins | Deadline reminder job | Inbox + email | (no Activity event) | Audit → Notifications |
| Application Resubmitted Confirmation | Issuer owner + org admins | Resubmit | Inbox + email | `APPLICATION_RESUBMITTED` | Audit → Notifications |
| Application Withdrawn Confirmation | Issuer owner + org admins | Withdraw or offer declined | Inbox + email | `APPLICATION_WITHDRAWN` / `CONTRACT_OFFER_DECLINED` / `INVOICE_OFFER_REJECTED` | Audit → Notifications |
| Application Completed | Issuer owner + org admins | Application completed | Inbox + email | `APPLICATION_COMPLETED` | Audit → Notifications |
| Application Submitted Confirmation | Issuer owner + org admins | First submit | Inbox; email off by default | `APPLICATION_SUBMITTED` | Audit → Notifications |
| Facility Signing Deadline Extended | Issuer owner + org admins | Facility deadline extended | Inbox + email | `CONTRACT_SIGNING_DEADLINE_EXTENDED` | Audit → Notifications |
| Invoice Signing Deadline Extended | Issuer owner + org admins | Invoice deadline extended | Inbox + email | `INVOICE_SIGNING_DEADLINE_EXTENDED` | Audit → Notifications |
| Facility Disabled | Issuer owner + org admins | Facility disabled | Inbox + email | `CONTRACT_FACILITY_DISABLED` | Audit → Notifications |
| Director/Shareholder Action Required | Issuer org owner | CTOS finds new person | Inbox + email | (no Activity event) | Audit → Notifications |
| Investor Director/Shareholder Action Required | Investor org owner | CTOS finds new person | Inbox + email | (no Activity event) | Audit → Notifications |
| Note published | Issuer org members | Publish | Inbox + email | `PUBLISH` | Audit → Notifications |
| Note funding succeeded | Issuer org members | Funding closed | Inbox + email | `CLOSE_FUNDING` | Audit → Notifications |
| Funding Unsuccessful (issuer) | Issuer org members | Funding fail | Inbox + email | `FAIL_FUNDING` | Audit → Notifications |
| Funding Unsuccessful (investor) | Committed investor orgs | Funding fail | Inbox + email | `FAIL_FUNDING` | Audit → Notifications |
| Note active (issuer) | Issuer org members | Note activated | Inbox + email | `ACTIVATE` | Audit → Notifications |
| Note active (investor) | Investors on the note | Note activated | Inbox + email | `ACTIVATE` | Audit → Notifications |
| Note repaid | Issuer org members | Fully repaid | Inbox + email | `SETTLEMENT_POSTED` | Audit → Notifications |
| Repayment Received | Investors on the note | Repayment recorded | Inbox + email | `PAYMENT_RECEIVED` | Audit → Notifications |
| Note settlement posted | Investors on the note | Settlement posted | Inbox + email | `SETTLEMENT_POSTED` | Audit → Notifications |
| Note in arrears (issuer) | Issuer org members | Arrears | Inbox + email | `OVERDUE_LATE_CHARGE_CHECKED` | Audit → Notifications |
| Note in arrears (investor) | Investors | Arrears | Inbox + email | `OVERDUE_LATE_CHARGE_CHECKED` | Audit → Notifications |
| Note defaulted (issuer) | Issuer org members | Default | Inbox + email | `NOTE_DEFAULT_MARKED` | Audit → Notifications |
| Note defaulted (investor) | Investors | Default | Inbox + email | `NOTE_DEFAULT_MARKED` | Audit → Notifications |
| Withdrawal submitted to trustee | Issuer and/or investor members by type | Trustee instruction submitted | Inbox + email | `WITHDRAWAL_SUBMITTED_TO_TRUSTEE` | Audit → Notifications |
| Repayment rejected | Issuer org members | Repayment rejected | Inbox; email off by default | `PAYMENT_REJECTED` | Audit → Notifications |
| Disbursement completed | Issuer org members | Issuer financing disbursement completed | Inbox; email off by default | `WITHDRAWAL_COMPLETED` | Audit → Notifications |
| Upfront facility fee payment required | Issuer owner + org admins | Accept facility that needs fee | Inbox + email | (no Activity event) | Audit → Notifications |
| Upfront facility fee paid | Issuer org members | Fee captured | Inbox + email | `FACILITY_FEE_PAID` | Audit → Notifications |
| Outstanding late charges to pay | Issuer org members | Settlement leftover late charges | Inbox + email | `SETTLEMENT_POSTED` | Audit → Notifications |
| Late payment charges received | Issuer org members | Excess late charges paid | Inbox + email | Gateway capture | Audit → Notifications |
| Deposit verification failed | Investor org members | Name check rejected | Inbox; email off by default | `NAME_CHECK_REJECTED` | Audit → Notifications |
| Deposit refund started | Investor org members | Refund initiated | Inbox; email off by default | `REFUND_INITIATED` | Audit → Notifications |
| Deposit refund completed | Investor org members | Refund completed | Inbox; email off by default | `REFUNDED` | Audit → Notifications |
| Deposit successful | Investor org members | Deposit credited | Inbox; email off by default | `GATEWAY_PAYMENT_COMPLETED` | Audit → Notifications |
| Investment committed | Acting investor | Commit funds | Inbox; email off by default | `INVESTMENT_COMMITTED` | Audit → Notifications |
| Withdrawal submitted | Acting investor | Cash withdrawal requested | Inbox; email off by default | Wallet row | Audit → Notifications |
| Withdrawal completed | Acting investor | Cash withdrawal completed | Inbox; email off by default | Wallet row | Audit → Notifications |

#### Email only (not typed)

| Email | Recipient | Trigger | Related event | In Audit → Notifications |
| --- | --- | --- | --- | --- |
| Organisation member invite / resend | Invitee | Org admin invite or resend | `MEMBER_INVITED` | No |
| Admin invite / resend | Invitee | Admin invite or resend | Revoke is `INVITATION_REVOKED` | No |
| Signing package / reminder | Named signer | Send package or remind | `SIGNING_PACKAGE_SENT` on first send only | No |
| Invoice offer accept OTP | Signatory | Issuer requests OTP | OTP challenge row | No |
| Director/shareholder verification | Person’s email | CTOS verify link | Owner also gets typed action-required | No |
| Trustee instruction + PDF | Trustee recipients | Auto-send trustee letter | `*_TRUSTEE_EMAIL_SENT` | No |

### 9. Internal / Forensic Records

Named forensic events are in Onboarding above (`EOD_WEBHOOK`, `WEBHOOK_APPROVED`, `WEBHOOK_REJECTED`). Related families:

| Record | What it proves | Where Ops sees it | Customer sees |
| --- | --- | --- | --- |
| `UserSession` | Login session issued | No dedicated Admin screen | No |
| Signer `viewed_at` | Signer opened the signing link | Applications → Acceptance (status Viewed). Not an Activity event | No |
| `application_review_events` | Mirror of offer sent / amendments submitted | No dedicated Admin screen (timeline uses Activity) | No |
| `application_review_remarks` | Reviewer remarks | Application review UI | No |
| `note_admin_actions` | Mirror of Admin note actions | No dedicated Admin screen (Notes → Activity uses note events) | No |
| `gateway_webhook_events` | Raw Curlec webhook received | No dedicated Admin screen | No |
| `gateway_order_attempts` | Checkout order attempts | Gateway payment detail | No |
| `gateway_payment_receipts` | Receipt PDF generated or retried | Gateway payment detail | No |
| `gateway_recon_runs` | Daily / manual settlement recon run | Finance → Reconciliation | No |
| `gateway_recon_exceptions` | Orphan or amount mismatch in recon | Finance → Reconciliation | No |
| `investor_balance_transactions` | Wallet deposit, invest, refund, cash withdrawal | Investor org / Finance withdrawals | Wallet history |
| `note_ledger_entries` | Note money movement | Notes → Ledger | No |
| `offer_accept_otp_challenges` | Invoice-offer OTP issued | No dedicated Admin screen | Email only |
| `notification_logs` | Typed inbox/email delivery attempt | Audit → Notifications | Inbox when typed |

## Naming differences

| Stored name | What people see |
| --- | --- |
| `ONBOARDING_CANCELLED` | Onboarding Restarted |
| `ONBOARDING_APPROVED` | Onboarding Submission Approved (customer) |
| `FINAL_APPROVAL_COMPLETED` | Onboarding Approved (customer). Notification: Onboarding Completed |
| `AMENDMENTS_SUBMITTED` | Amendment Request Sent |
| `offer_expiry_reminder_24h` | Timing uses product `days_before_expiry` |
| `EMAIL_VERIFIED` | Metadata may be success or `VERIFICATION_FAILED` |

## Expected overlaps

| Overlap | Why it exists |
| --- | --- |
| Facility occupancy + note occupancy | Same draw/fund/repay fact on facility and note |
| Offer / amendment Activity + `application_review_events` | Forensic mirror; Ops reads Activity |
| Admin note action + `note_admin_actions` | Second copy of Admin note actions; Ops reads Notes → Activity |
| Fee Activity + gateway payment event | Customer milestone plus payment proof |
| T&C Activity + legal acceptance | Org milestone plus legal hash/party proof |
| Raw gateway webhook + gateway payment event | Provider payload vs business status change |
| Onboarding status / form filled / webhook forensic | Same provider callback, different layers |
| Letter Activity + generated-document evidence | Human timeline plus file hash |
| `EMAIL_VERIFIED` success and failure | Same event name; open metadata for the result |

## Current gaps

Not framed as defects. Live actions with no Activity/audit event or no customer notification.

| Action | Missing | What exists instead |
| --- | --- | --- |
| User-initiated onboarding cancel | Logging | No `onboarding_logs` row |
| Signing reminder | Logging | Email only to the signer |
| Settlement preview | Logging | Computation only; no event |
| Notification preference change | Logging | Preference row only |
| CTOS KYB retry tick | Logging | Process log; later section reset may write `SECTION_REVIEWED_PENDING` |
| Signing PDF reconcile | Logging | Envelope files updated; no Activity |
| Admin 2FA reset / forgot password | Logging | Cognito, outside this app |
| Onboarding started / fee paid | Notification | Activity only |
| Onboarding amendment required (generic) | Notification | Activity; director/shareholder type is separate |
| Admin restart onboarding | Notification | Activity “Onboarding Restarted” |
| Facility enabled | Notification | `CONTRACT_FACILITY_ENABLED` only |
| Facility fee waived | Notification | Contract or note waiver events |
| Invoice withdrawn | Notification | Activity only |
| Pause / resume listing | Notification | Issuer Activity only |
| Unpublish | Notification | Notes → Activity |
| Signing sent (org members who are not the signer) | Notification | Signer gets email only |
| Signing completed / declined / expired / voided | Notification | Activity (voided = Admin only) |
| Repayment approved | Notification | `PAYMENT_APPROVED` |
| Settlement approved (before post) | Notification | `SETTLEMENT_APPROVED` |
| Prospectus / paymaster / tawarruq | Notification | Notes → Activity |
| Product created | Notification | Product log; New Product Alert is manual |
| Org member invited | Typed notification | Email only to invitee |
| Signing reminder | Typed notification | Email only to signer |

## Not active / historical

Old rows may still appear. These are not current writers.

| Event | Why not active |
| --- | --- |
| `APPLICATION_APPROVED` | Historical. No live writer. Old rows can still show as Application Approved |
| `CONTRACT_OFFER_REJECTED` | Historical. Live decline is `CONTRACT_OFFER_DECLINED` |
| `PRODUCT_INACTIVATED` | Unmounted. Products are deleted, not inactivated |
| `PRODUCT_REACTIVATED` | Unmounted |
| `ACCOUNT_LOCKED` | No production writer |
| `CREATED` (gateway catalogue) | Not written. Live type is `GATEWAY_PAYMENT_COMPLETED` and others |
| `COMPLETED` (gateway catalogue) | Not written |
| `FAILED` (gateway catalogue) | Not written |
| `OVERRIDE_PROPOSED` | Enum only |
| `OVERRIDE_APPROVED` | Enum only |
| `OVERRIDE_REJECTED` | Enum only |
| `SETTLEMENT_PREVIEWED` | Preview does not write an event |
| `SERVICE_FEE_TRUSTEE_*` | Not written. Live types are `SETTLEMENT_TRUSTEE_*` |
| `KYC_APPROVED` as event name | Historical. Live path uses `ONBOARDING_STATUS_UPDATED` with trigger in metadata |
| `TNC_ACCEPTED` | Live writer is `TNC_APPROVED` |
| `USER_COMPLETED` | Not a current writer. Final access is `FINAL_APPROVAL_COMPLETED` |
| `WEBHOOK_RECEIVED` | Dev webhook handler only |
| `WEBHOOK_PENDING_APPROVAL` | Dev webhook handler only |
| `WEBHOOK_LIVENESS_PASSED` | Dev webhook handler only |
| `WEBHOOK_FORM_FILLING` | Dev webhook handler only |
| `WEBHOOK_IN_PROGRESS` | Dev webhook handler only |
| Ops Alerts | Removed |
| `NOTE_CREATED` as writer | Label for old rows. Live type is `NOTE_CREATED_FROM_INVOICE` |
| `NOTE_PUBLISHED` as writer | Label for old rows. Live type is `PUBLISH` |

## Quick Check

| Question | Check here |
| --- | --- |
| What happened to onboarding? | Issuers / Investors → Activity |
| What happened to an application? | Applications → Activity Timeline |
| What happened to a facility? | Facilities → Activity |
| What happened to signing? | Applications → Acceptance |
| What happened to a Note? | Notes → Activity |
| Did payment succeed? | Finance → Payments → Gateway Payments |
| Did recon match? | Finance → Reconciliation |
| Was a legal document accepted? | Audit → Legal Acceptances |
| Did a guarantor accept? | Audit → External Acceptances |
| Did we send a typed notification? | Audit → Notifications |
| Who logged in or changed access? | Audit → Access / Security |
