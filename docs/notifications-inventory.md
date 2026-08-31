# Notification Register

**As of:** 1 September 2026  
**Scope:** Messages the **current live platform can still send**: typed inbox/email, Admin custom sends, and other live transactional emails.  
**Method:** Traced from UI/API → `NotificationService` / SES → `notifications` / `notification_logs`. A seeded type is listed as automatic only if a production caller exists.

This register is separate from the [Audit Log Register](./logs-inventory.md).

Delivery is **not** permanently fixed. Admin Settings → Notifications → Configuration controls `notification_types.enabled_platform` and `enabled_email` for SYSTEM and AUTHENTICATION types. Current seed defaults are listed; Operations can change them later.

---

## How configuration actually works

### Typed send path (`NotificationService.createInternal`)

For automatic / `sendTyped` sends:

- **In-app** is sent if AUTHENTICATION **or** (`sendToPlatform` override if set) **or** (`type.enabled_platform` AND (if `user_configurable`, user pref in-app, defaulting to true)).
- **Email** uses the same pattern for `enabled_email`.
- If both channels are false, nothing is stored (no inbox row).

**Admin disabling a type in Configuration stops automatic sends** of that channel.

Exceptions:

| Exception | Behaviour |
| --- | --- |
| `password_changed` | AUTHENTICATION. Both channels forced. Admin switches locked. API rejects turning either off |
| Admin Custom & Groups send | Passes `sendToPlatform` / `sendToEmail` and **bypasses** type flags and user prefs |
| Direct / transactional emails | Do not use `NotificationService` or these toggles |

### Admin Settings → Notifications

| UI | What it does |
| --- | --- |
| Tab **Configuration**, card **System Notification Types** | Lists SYSTEM and AUTHENTICATION types only. Toggles labelled **Platform** and **Email** |
| Badge **Always on for security** | `category === AUTHENTICATION` (`password_changed`) |
| Portal Scope Investor / Issuer / Both | Filters by `portal_targets` |
| **Reset to default** | Turns Platform + Email **on for every catalog type** (including marketing). Does not restore seed email-off defaults |
| Tab **Custom & Groups** | Manual send. Type picker is MARKETING + ANNOUNCEMENT only (`new_product_alert`, `system_announcement`) |

`system_announcement` and `new_product_alert` are **not** on the Configuration list.

Seed insert is `createTypeIfNotExist`. Changing seed names or default toggles does **not** update existing production rows until Reset (and Reset turns **both** channels on).

### User portal preferences

Account → **Marketing emails** only lists `user_configurable && category === MARKETING`. Today that is **`new_product_alert`** (investor-only). Issuers see an empty list.

Most SYSTEM types are `user_configurable: true` in seed, but the portal **does not expose them**. The API would honour a pref row if one existed.

### Delivery records

| Path | Store |
| --- | --- |
| Typed automatic send | `notifications` + `notification_logs` `source=SYSTEM` |
| Admin custom send | Inbox + `notification_logs` `source=ADMIN` |
| Email success on typed send | `email_sent_at` on the inbox row. Subject is `[CashSouk] ` + inbox title |
| Direct emails | **Not** in `notification_logs` |

Audit → Notifications **Event** column uses seed `name`. Drawer **Title** uses the inbox / Admin-supplied title.

---

## Name mapping

| Layer | What Operations see |
| --- | --- |
| System Type | `notification_types.id` |
| Admin Display Name | seed `name` (Settings Configuration and Audit Event) |
| Notification / inbox / email subject body | `registry.ts` title (or Admin custom title) |
| Email subject | `[CashSouk] ` + that title |

They are not always the same. This register lists all three.

---

## Typed notification register

### Access & Security

| Notification ID | Notification (inbox) | System Type | Admin Display Name | Trigger | Recipient | Recipient Role | Automatic / Manual | In-App Supported | Email Supported | Admin Configurable | Default Delivery | Preference Source | Delivery Record | Admin Location | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| NTF-SEC-001 | Password Changed | `password_changed` | Password Changed | In-app ChangePassword (not Cognito forgot-password) | Acting user | Issuer or Investor | Automatic | Yes | Yes | No — AUTHENTICATION always on | Always in-app + Email | Forced both channels. Admin cannot disable. User prefs ignored | Inbox + `notification_logs` source=SYSTEM | Audit - Notifications | Mandatory. Inbox title matches Admin name |

### Onboarding

| Notification ID | Notification (inbox) | System Type | Admin Display Name | Trigger | Recipient | Recipient Role | Automatic / Manual | In-App Supported | Email Supported | Admin Configurable | Default Delivery | Preference Source | Delivery Record | Admin Location | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| NTF-ONB-001 | Onboarding Completed | `onboarding_completed` | Onboarding Completed | Admin final approval | Onboarding user | Issuer or Investor | Automatic | Yes | Yes | Yes — Settings Configuration | In-app + Email | Type flags. Not user-configurable | Inbox + SYSTEM log | Audit - Notifications | — |
| NTF-ONB-002 | Onboarding Application Rejected | `onboarding_rejected` | Onboarding Rejected | Provider reject (individual and/or COD) | Onboarding user | Issuer or Investor | Automatic | Yes | Yes | Yes — Settings Configuration | In-app + Email | Type flags. Not user-configurable | Inbox + SYSTEM log | Audit - Notifications | Inbox title differs from Admin name |
| NTF-ONB-003 | Action Required: Complete Director/Shareholder Onboarding | `director_shareholder_action_required` | Director/Shareholder Action Required | CTOS pull finds a director/shareholder who must complete onboarding | Issuer organisation owner | Issuer | Automatic | Yes | Yes | Yes — Settings Configuration | In-app + Email | Type flags. Not user-configurable | Inbox + SYSTEM log | Audit - Notifications | Verify-link SES to the person is a separate direct email. `POST .../director-shareholders/notify-action-required` is mounted with no Admin UI caller and is not a production business path |
| NTF-ONB-004 | Action Required: Complete Director/Shareholder Onboarding | `investor_director_shareholder_action_required` | Investor Director/Shareholder Action Required | Same, investor organisation | Investor organisation owner | Investor | Automatic | Yes | Yes | Yes — Settings Configuration | In-app + Email | Type flags. Not user-configurable | Inbox + SYSTEM log | Audit - Notifications | Same inbox title as issuer type |

### Applications

| Notification ID | Notification (inbox) | System Type | Admin Display Name | Trigger | Recipient | Recipient Role | Automatic / Manual | In-App Supported | Email Supported | Admin Configurable | Default Delivery | Preference Source | Delivery Record | Admin Location | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| NTF-APP-001 | Amendment Requested | `application_amendments_requested` | Application Amendments Requested | Admin sends amendment pack | Issuer owner and organisation admins | Issuer | Automatic | Yes | Yes | Yes | In-app + Email | Type flags. Seed marks user_configurable but portal UI does not expose SYSTEM types | Inbox + SYSTEM log | Audit - Notifications | — |
| NTF-APP-002 | Application Rejected | `application_rejected` | Application Rejected | Admin rejects application | Issuer owner and organisation admins | Issuer | Automatic | Yes | Yes | Yes | In-app + Email | Type flags ± unused user prefs | Inbox + SYSTEM log | Audit - Notifications | — |
| NTF-APP-003 | Application Resubmitted | `application_resubmitted_confirmation` | Application Resubmitted Confirmation | Issuer resubmits | Issuer owner and organisation admins | Issuer | Automatic | Yes | Yes | Yes | In-app + Email | Type flags ± unused user prefs | Inbox + SYSTEM log | Audit - Notifications | — |
| NTF-APP-004 | Application Withdrawn / Facility Offer Declined / Invoice Offer Declined | `application_withdrawn_confirmation` | Application Withdrawn Confirmation | Withdraw or decline offer | Issuer owner and organisation admins | Issuer | Automatic | Yes | Yes | Yes | In-app + Email | Type flags ± unused user prefs | Inbox + SYSTEM log | Audit - Notifications | Inbox title switches by withdrawalReason |
| NTF-APP-005 | Application Completed | `application_completed` | Application Completed | Application completed | Issuer owner and organisation admins | Issuer | Automatic | Yes | Yes | Yes | In-app + Email | Type flags ± unused user prefs | Inbox + SYSTEM log | Audit - Notifications | — |
| NTF-APP-006 | Application Submitted | `application_submitted_confirmation` | Application Submitted Confirmation | First submit | Issuer owner and organisation admins | Issuer | Automatic | Yes | Yes | Yes | In-app; email off in seed (Admin can enable) | Type flags ± unused user prefs | Inbox + SYSTEM log | Audit - Notifications | Email can be enabled in Settings Configuration |

### Offers

| Notification ID | Notification (inbox) | System Type | Admin Display Name | Trigger | Recipient | Recipient Role | Automatic / Manual | In-App Supported | Email Supported | Admin Configurable | Default Delivery | Preference Source | Delivery Record | Admin Location | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| NTF-OFR-001 | Acceptance Documents Need Updates | `acceptance_document_changes_requested` | Acceptance Documents Need Updates | First CHANGES_REQUESTED in an acceptance cycle | Issuer owner and organisation admins | Issuer | Automatic | Yes | Yes | Yes | In-app + Email | Type flags ± unused user prefs | Inbox + SYSTEM log | Audit - Notifications | Further requests in the same cycle do not re-notify |
| NTF-OFR-002 | Facility Offer Received | `contract_offer_sent` | Facility Offer Sent | Admin sends facility offer | Issuer owner and organisation admins | Issuer | Automatic | Yes | Yes | Yes | In-app + Email | Type flags ± unused user prefs | Inbox + SYSTEM log | Audit - Notifications | Admin name says Sent; inbox says Received |
| NTF-OFR-003 | Invoice Offer Received | `invoice_offer_sent` | Invoice Offer Sent | Admin sends invoice offer | Issuer owner and organisation admins | Issuer | Automatic | Yes | Yes | Yes | In-app + Email | Type flags ± unused user prefs | Inbox + SYSTEM log | Audit - Notifications | — |
| NTF-OFR-004 | Offer Updated | `offer_retracted_or_reset` | Offer Retracted or Reset | Admin retracts offer or returns application to review | Issuer owner and organisation admins | Issuer | Automatic | Yes | Yes | Yes | In-app + Email | Type flags ± unused user prefs | Inbox + SYSTEM log | Audit - Notifications | One type covers two Admin actions |
| NTF-OFR-005 | Offer Expired | `offer_expired` | Offer Expired | Hourly acceptance/signing expiry job | Issuer owner and organisation admins | Issuer | Automatic | Yes | Yes | Yes | In-app + Email | Type flags ± unused user prefs | Inbox + SYSTEM log | Audit - Notifications | — |
| NTF-OFR-006 | Offer Expiring Soon | `offer_expiry_reminder_24h` | Offer Expiry Reminder | Same job, before deadline | Issuer owner and organisation admins | Issuer | Automatic | Yes | Yes | Yes | In-app + Email | Type flags ± unused user prefs | Inbox + SYSTEM log | Audit - Notifications | Id is historical. Window is product days_before_expiry, not always 24h |

### Signing

| Notification ID | Notification (inbox) | System Type | Admin Display Name | Trigger | Recipient | Recipient Role | Automatic / Manual | In-App Supported | Email Supported | Admin Configurable | Default Delivery | Preference Source | Delivery Record | Admin Location | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| NTF-SGN-001 | Signing Deadline Extended | `contract_signing_deadline_extended` | Facility Signing Deadline Extended | Admin extends facility signing deadline | Issuer owner and organisation admins | Issuer | Automatic | Yes | Yes | Yes | In-app + Email | Type flags ± unused user prefs | Inbox + SYSTEM log | Audit - Notifications | Same inbox title as invoice type |
| NTF-SGN-002 | Signing Deadline Extended | `invoice_signing_deadline_extended` | Invoice Signing Deadline Extended | Admin extends invoice signing deadline | Issuer owner and organisation admins | Issuer | Automatic | Yes | Yes | Yes | In-app + Email | Type flags ± unused user prefs | Inbox + SYSTEM log | Audit - Notifications | — |

### Facilities

| Notification ID | Notification (inbox) | System Type | Admin Display Name | Trigger | Recipient | Recipient Role | Automatic / Manual | In-App Supported | Email Supported | Admin Configurable | Default Delivery | Preference Source | Delivery Record | Admin Location | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| NTF-FAC-001 | Facility Disabled | `facility_disabled` | Facility Disabled | Admin disables facility | Issuer owner and organisation admins | Issuer | Automatic | Yes | Yes | Yes | In-app + Email | Type flags ± unused user prefs | Inbox + SYSTEM log | Audit - Notifications | No matching enable notification |
| NTF-FAC-002 | Upfront Facility Fee Payment Required | `facility_fee_payment_requested` | Upfront facility fee payment required | Issuer accepts a facility offer that requires a gateway fee | Issuer owner and organisation admins | Issuer | Automatic | Yes | Yes | Yes | In-app + Email | Type flags ± unused user prefs | Inbox + SYSTEM log | Audit - Notifications | — |
| NTF-FAC-003 | Upfront Facility Fee Paid | `facility_fee_upfront_paid` | Upfront facility fee paid | Upfront facility fee captured in full | Issuer organisation members | Issuer | Automatic | Yes | Yes | Yes | In-app + Email | Type flags ± unused user prefs | Inbox + SYSTEM log | Audit - Notifications | — |

### Investment Notes

| Notification ID | Notification (inbox) | System Type | Admin Display Name | Trigger | Recipient | Recipient Role | Automatic / Manual | In-App Supported | Email Supported | Admin Configurable | Default Delivery | Preference Source | Delivery Record | Admin Location | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| NTF-NTE-001 | Note Published | `note_published` | Note published | Note published | All issuer organisation members | Issuer | Automatic | Yes | Yes | Yes | In-app + Email | Type flags ± unused user prefs | Inbox + SYSTEM log | Audit - Notifications | — |
| NTF-NTE-002 | Funding Closed Successfully | `note_funding_succeeded` | Note funding succeeded | Funding closed successfully | Issuer organisation members | Issuer | Automatic | Yes | Yes | Yes | In-app + Email | Type flags ± unused user prefs | Inbox + SYSTEM log | Audit - Notifications | — |
| NTF-NTE-003 | Note Funding Did Not Complete | `note_funding_failed_issuer` | Funding Unsuccessful | Funding fail | Issuer organisation members | Issuer | Automatic | Yes | Yes | Yes | In-app + Email | Type flags ± unused user prefs | Inbox + SYSTEM log | Audit - Notifications | Paired with investor type |
| NTF-NTE-004 | Note Is Active | `note_active_issuer` | Note active | Note activated | Issuer organisation members | Issuer | Automatic | Yes | Yes | Yes | In-app + Email | Type flags ± unused user prefs | Inbox + SYSTEM log | Audit - Notifications | — |
| NTF-NTE-005 | Note Repaid | `note_repaid_issuer` | Note repaid | Note fully repaid | Issuer organisation members | Issuer | Automatic | Yes | Yes | Yes | In-app + Email | Type flags ± unused user prefs | Inbox + SYSTEM log | Audit - Notifications | Investors get Settlement Posted instead |

### Investments

| Notification ID | Notification (inbox) | System Type | Admin Display Name | Trigger | Recipient | Recipient Role | Automatic / Manual | In-App Supported | Email Supported | Admin Configurable | Default Delivery | Preference Source | Delivery Record | Admin Location | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| NTF-CMT-001 | Commitment Released | `note_funding_failed_investor` | Funding Unsuccessful | Same funding fail | Members of investing organisations | Investor | Automatic | Yes | Yes | Yes | In-app + Email | Type flags ± unused user prefs | Inbox + SYSTEM log | Audit - Notifications | Paired with issuer type |
| NTF-CMT-002 | Investment Is Active | `note_active_investor` | Note active | Same activation | Investors on the Note | Investor | Automatic | Yes | Yes | Yes | In-app + Email | Type flags ± unused user prefs | Inbox + SYSTEM log | Audit - Notifications | — |
| NTF-CMT-003 | Investment Committed | `investment_committed` | Investment committed | Investor commits to a Note | Acting investor | Investor | Automatic | Yes | Yes | Yes | In-app; email off in seed (Admin can enable) | Type flags ± unused user prefs | Inbox + SYSTEM log | Audit - Notifications | — |

### Payments

| Notification ID | Notification (inbox) | System Type | Admin Display Name | Trigger | Recipient | Recipient Role | Automatic / Manual | In-App Supported | Email Supported | Admin Configurable | Default Delivery | Preference Source | Delivery Record | Admin Location | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| NTF-PAY-001 | Deposit Verification Failed | `deposit_name_check_rejected` | Deposit verification failed | Bank account name check failed | Investor organisation members | Investor | Automatic | Yes | Yes | Yes | In-app; email off in seed (Admin can enable) | Type flags ± unused user prefs | Inbox + SYSTEM log | Audit - Notifications | — |
| NTF-PAY-002 | Refund Started | `deposit_refund_initiated` | Deposit refund started | Deposit refund started | Investor organisation members | Investor | Automatic | Yes | Yes | Yes | In-app; email off in seed (Admin can enable) | Type flags ± unused user prefs | Inbox + SYSTEM log | Audit - Notifications | — |
| NTF-PAY-003 | Refund Completed | `deposit_refunded` | Deposit refund completed | Deposit refund completed | Investor organisation members | Investor | Automatic | Yes | Yes | Yes | In-app; email off in seed (Admin can enable) | Type flags ± unused user prefs | Inbox + SYSTEM log | Audit - Notifications | — |
| NTF-PAY-004 | Deposit Successful | `deposit_successful` | Deposit successful | Deposit credited | Investor organisation members | Investor | Automatic | Yes | Yes | Yes | In-app; email off in seed (Admin can enable) | Type flags ± unused user prefs | Inbox + SYSTEM log | Audit - Notifications | — |

### Disbursement

| Notification ID | Notification (inbox) | System Type | Admin Display Name | Trigger | Recipient | Recipient Role | Automatic / Manual | In-App Supported | Email Supported | Admin Configurable | Default Delivery | Preference Source | Delivery Record | Admin Location | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| NTF-DSB-001 | Withdrawal Submitted to Trustee | `withdrawal_submitted_to_trustee` | Withdrawal submitted to trustee | Trustee instruction submitted | Issuer and/or investor members depending on withdrawal type | Issuer and/or Investor | Automatic | Yes | Yes | Yes | In-app + Email | Type flags ± unused user prefs | Inbox + SYSTEM log | Audit - Notifications | Trustee PDF email is a separate direct email |
| NTF-DSB-002 | Your Disbursement Is Complete | `withdrawal_completed` | Disbursement completed | Issuer financing disbursement completed | Issuer organisation members | Issuer | Automatic | Yes | Yes | Yes | In-app; email off in seed (Admin can enable) | Type flags ± unused user prefs | Inbox + SYSTEM log | Audit - Notifications | Not investor cash withdrawal |
| NTF-DSB-003 | Withdrawal Submitted | `investor_withdrawal_submitted` | Withdrawal submitted | Investor cash withdrawal requested | Acting investor | Investor | Automatic | Yes | Yes | Yes | In-app; email off in seed (Admin can enable) | Type flags ± unused user prefs | Inbox + SYSTEM log | Audit - Notifications | — |
| NTF-DSB-004 | Withdrawal Completed | `investor_withdrawal_completed` | Withdrawal completed | Investor cash withdrawal completed | Acting investor | Investor | Automatic | Yes | Yes | Yes | In-app; email off in seed (Admin can enable) | Type flags ± unused user prefs | Inbox + SYSTEM log | Audit - Notifications | Distinct from issuer Disbursement completed |

### Repayment

| Notification ID | Notification (inbox) | System Type | Admin Display Name | Trigger | Recipient | Recipient Role | Automatic / Manual | In-App Supported | Email Supported | Admin Configurable | Default Delivery | Preference Source | Delivery Record | Admin Location | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| NTF-RPY-001 | Repayment Received | `note_payment_received` | Repayment Received | Repayment recorded | Investors on the Note | Investor | Automatic | Yes | Yes | Yes | In-app + Email | Type flags ± unused user prefs | Inbox + SYSTEM log | Audit - Notifications | — |
| NTF-RPY-002 | Repayment Rejected | `note_payment_rejected` | Repayment rejected | Admin rejects issuer repayment | Issuer organisation members | Issuer | Automatic | Yes | Yes | Yes | In-app; email off in seed (Admin can enable) | Type flags ± unused user prefs | Inbox + SYSTEM log | Audit - Notifications | — |

### Late Payment / Arrears / Default

| Notification ID | Notification (inbox) | System Type | Admin Display Name | Trigger | Recipient | Recipient Role | Automatic / Manual | In-App Supported | Email Supported | Admin Configurable | Default Delivery | Preference Source | Delivery Record | Admin Location | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| NTF-LTE-001 | Note in Arrears | `note_arrears` | Note in arrears | Note entered arrears | Issuer organisation members | Issuer | Automatic | Yes | Yes | Yes | In-app + Email | Type flags ± unused user prefs | Inbox + SYSTEM log | Audit - Notifications | — |
| NTF-LTE-002 | Note in Arrears | `note_arrears_investor` | Note in arrears | Same arrears | Investors | Investor | Automatic | Yes | Yes | Yes | In-app + Email | Type flags ± unused user prefs | Inbox + SYSTEM log | Audit - Notifications | Inbox casing Note in Arrears |
| NTF-LTE-003 | Your Note Is in Default | `note_defaulted` | Note defaulted (issuer) | Note marked default | Issuer organisation members | Issuer | Automatic | Yes | Yes | Yes | In-app + Email | Type flags ± unused user prefs | Inbox + SYSTEM log | Audit - Notifications | — |
| NTF-LTE-004 | Your Investment Is in Default | `note_defaulted_investor` | Note defaulted | Same default | Investors | Investor | Automatic | Yes | Yes | Yes | In-app + Email | Type flags ± unused user prefs | Inbox + SYSTEM log | Audit - Notifications | — |
| NTF-LTE-005 | Outstanding Late Charges to Pay | `excess_late_charges_due` | Outstanding late charges to pay | Settlement posted with leftover late charges | Issuer organisation members | Issuer | Automatic | Yes | Yes | Yes | In-app + Email | Type flags ± unused user prefs | Inbox + SYSTEM log | Audit - Notifications | May send with Settlement Posted |
| NTF-LTE-006 | Late Payment Charges Received | `excess_late_charges_paid` | Late payment charges received | Outstanding late charges paid in full | Issuer organisation members | Issuer | Automatic | Yes | Yes | Yes | In-app + Email | Type flags ± unused user prefs | Inbox + SYSTEM log | Audit - Notifications | — |

### Settlement

| Notification ID | Notification (inbox) | System Type | Admin Display Name | Trigger | Recipient | Recipient Role | Automatic / Manual | In-App Supported | Email Supported | Admin Configurable | Default Delivery | Preference Source | Delivery Record | Admin Location | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| NTF-STL-001 | Settlement Posted | `note_settlement_posted` | Note settlement posted | Settlement posted | Investors on the Note | Investor | Automatic | Yes | Yes | Yes | In-app + Email | Type flags ± unused user prefs | Inbox + SYSTEM log | Audit - Notifications | — |

### Products

| Notification ID | Notification (inbox) | System Type | Admin Display Name | Trigger | Recipient | Recipient Role | Automatic / Manual | In-App Supported | Email Supported | Admin Configurable | Default Delivery | Preference Source | Delivery Record | Admin Location | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| NTF-PRD-001 | New Investment Opportunity | `new_product_alert` | New Product Alert | Admin Custom & Groups send only. Not fired on product create | Selected investors | Investor | Manual | Yes | Yes | Not in Configuration tab (MARKETING). User Marketing card can change prefs; send form overrides | In-app + Email (send form override) | User prefs only apply if a typed path is used; Custom send overrides | Inbox + ADMIN log | Audit - Notifications | Only type exposed on the portal Marketing emails card |

### Administration / Configuration

| Notification ID | Notification (inbox) | System Type | Admin Display Name | Trigger | Recipient | Recipient Role | Automatic / Manual | In-App Supported | Email Supported | Admin Configurable | Default Delivery | Preference Source | Delivery Record | Admin Location | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| NTF-ADM-001 | System Announcement | `system_announcement` | System Announcement | Admin Custom & Groups send | Selected users or group | Issuer and/or Investor | Manual | Yes | Yes | Not in Configuration tab (ANNOUNCEMENT). Send form chooses channels | In-app + Email (send form override) | Admin send overrides type flags and user prefs | Inbox + `notification_logs` source=ADMIN | Audit - Notifications | Admin supplies title and body |

## Direct / Transactional Emails

These bypass Admin notification preferences and `NotificationService`. They are not the 49 typed types.

| Email | Trigger | Recipient | Configurable? | Delivery Record | Admin Location | Ignores notification prefs? | In `notification_logs`? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Organisation Invitation | Member invited or invite resent | Invitee | No. Always sent when the invite action runs | Invite row + `MEMBER_INVITED` | Issuer record - Activity or Investor record - Activity | Yes | No |
| Admin Invitation | Admin invited or invite resent | Invitee | No | Invite row. Revoke is `INVITATION_REVOKED` | Audit - Security (revoke only) | Yes | No |
| Signing Package | Admin send signing package | Named signer | No | Envelope / recipient. `SIGNING_PACKAGE_SENT` on first send | Application record - Acceptance | Yes | No |
| Signing Reminder | Admin remind signer | Named signer | No | Recipient delivery status. No second Activity event | Application record - Acceptance | Yes | No |
| Invoice Offer Verification Code | Issuer requests a code to accept an invoice offer | Selected signatory | No | `offer_accept_otp_challenges` | No current Admin UI | Yes | No |
| Director/Shareholder Verification | Person must verify (RegTank verify-link fallback) | The person | No | Onboarding / provider state | Issuer record - People or Investor record - People | Yes | No |
| Trustee Instruction | Withdrawal or settlement trustee letter send/resend | Configured trustee recipients | Trustee recipient config, not notification prefs | Note events `*_TRUSTEE_EMAIL_SENT` | Note record - Activity | Yes | No |

Count: **7**.

---

## Notification gaps

Live actions with no typed inbox/email to the customer. Do not assume every action needs a message.

| Action | Current Notification | Potential Recipient | Recommendation |
| --- | --- | --- | --- |
| Onboarding started / fee paid | None (Activity only) | Onboarding user | No notification needed |
| Generic additional onboarding information required | Activity only (director/shareholder type is separate) | Onboarding user | Consider notification |
| Admin restart onboarding | Activity only | Onboarding user | No notification needed |
| Facility enabled | Log only | Issuer owner / admins | Consider notification |
| Facility fee waived | Logs only | Issuer | Business decision required |
| Invoice withdrawn (not offer decline) | Activity only | Issuer | Consider notification |
| Campaign paused / resumed / unpublished | Activity only | Issuer | Business decision required |
| Signing package sent to organisation members who are not the signer | Signer gets SES; org inbox silent | Organisation members | Business decision required |
| Signing completed / declined / expired / voided | Activity only | Organisation / signer | Recommended for completed / declined / expired (signers already get SES) |
| Repayment approved | Activity only | Issuer | No notification needed (investor gets Repayment Received) |
| Settlement approved (before post) | Activity only | Issuer / investor | No notification needed (investors get Settlement Posted) |
| Prospectus / paymaster / tawarruq | Note Activity only | n/a | No notification needed |
| Product created | Product log; no auto `new_product_alert` | Investors | Business decision required |
| Organisation member invited (existing members) | SES to invitee only | Existing members | No notification needed |
| Signing reminder | SES to signer | Signer | No notification needed |

---

## Notification Admin UI notes

Settings page columns today: **Name** (`type.name`), description, **Platform**, **Email**, optional **Always on for security**. There is no explicit “mandatory channel” field except AUTHENTICATION.

Audit → Notifications columns: Timestamp, Event (seed name), Actor/Source, Audience, Platform Delivered, Email Delivered.

Remaining naming splits (documented, not silently renamed in the database):

| System Type | Admin Display Name | Inbox / email title |
| --- | --- | --- |
| `contract_offer_sent` | Facility Offer Sent | Facility Offer Received |
| `invoice_offer_sent` | Invoice Offer Sent | Invoice Offer Received |
| `offer_retracted_or_reset` | Offer Retracted or Reset | Offer Updated |
| `onboarding_rejected` | Onboarding Rejected | Onboarding Application Rejected |
| `note_funding_failed_*` | Funding Unsuccessful | Note funding did not complete / Commitment released |
| `withdrawal_completed` | Disbursement completed | Your Disbursement Is Complete |
| `new_product_alert` | New Product Alert | New Investment Opportunity (or Admin override) |

Renaming seed `name` would not update existing production rows (`createTypeIfNotExist`). Inbox titles are customer-facing and were left unchanged.

---

## Count snapshot

| Bucket | Count |
| --- | --- |
| Active typed notification types | **49** |
| Automatic | **47** |
| Admin / manual only | **2** (`system_announcement`, `new_product_alert`) |
| Direct / transactional emails | **7** |
| Types supporting in-app | **49** |
| Types supporting email | **49** (email may be off in seed or disabled later) |
| Shown on Settings Configuration | SYSTEM + AUTHENTICATION (not MARKETING / ANNOUNCEMENT) |
| User-configurable in portal UI | **1** (`new_product_alert`) |
| Mandatory / non-configurable | **5** seed `user_configurable: false` (password + 2 onboarding + 2 director/shareholder). Password is the only always-on channel pair |
| Seed email off (Admin can still enable) | **10** |
