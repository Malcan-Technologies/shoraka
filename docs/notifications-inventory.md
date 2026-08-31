# Notifications Inventory

**As of:** 31 August 2026  
**Scope:** Messages the **current live platform can still send**: typed inbox/email, Admin custom sends, and other live SES emails.  
**Method:** Traced from UI/API → `NotificationService` / SES → `notifications` / `notification_logs`. A seeded type or template is not listed as automatic unless a production caller exists.

---

## How notifications work

| Channel | Store | Who sees it |
| --- | --- | --- |
| In-app (platform) | `notifications` | Issuer / Investor bell + `/notifications` |
| Email | SES via `lib/email/ses-client.ts`; `email_sent_at` on inbox row when sent | User mailbox |
| Delivery audit | `notification_logs` (`source=SYSTEM` or `ADMIN`) | Admin Audit → Notifications |
| User channel prefs | `user_notification_preferences` | Settings in portals (except non-configurable types) |

**Recipient helpers:**

- Application issuer types: organisation **owner** plus members with `OWNER` or `ORGANIZATION_ADMIN` (`getIssuerRecipientUserIdsForApplication`).
- Note lifecycle: typically **all org members** of issuer and/or investing orgs (`note-lifecycle-notifications.ts`).
- Deposits: all members of the investor organisation.
- Investment committed / investor cash withdrawal: the **acting user**.
- Password changed: the user who changed the password.

**Password Changed** is always both channels and not user-configurable.

Inbox-only **defaults** (`enabled_email: false` in seed): `application_submitted_confirmation`, `note_payment_rejected`, `withdrawal_completed` (issuer disbursement), `deposit_name_check_rejected`, `deposit_refund_initiated`, `deposit_refunded`, `deposit_successful`, `investment_committed`, `investor_withdrawal_submitted`, `investor_withdrawal_completed`.

Users can still turn email on later for configurable types.

**Admin custom send** is live: Settings → Notifications → Custom & Groups → `POST /v1/notifications/admin/send` → `NotificationService.sendBulkNotification`. Type picker is limited to **MARKETING** or **ANNOUNCEMENT**, which maps to `new_product_alert` and `system_announcement`. Product create/update does **not** auto-send `new_product_alert`.

---

## A. Typed notifications (49)

Seed: `apps/api/src/modules/notification/seed-data.ts`. Copy: `apps/api/src/modules/notification/registry.ts`.

Reachability: **Automatic** = production sender on a live flow. **Admin custom** = only via Admin send UI.

### Authentication

| Name / id | Trigger | Recipient | Role | Channel | Title / content | Code | Stored | Reachable | Sent as designed | Duplicates | Same event → more than one |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Password Changed `password_changed` | In-app `changePassword` (not Cognito forgot-password) | Acting user | Issuer or Investor | Inbox + email (forced) | “Password Changed” + date | `auth/service.ts` | Inbox + SYSTEM log | Yes | Yes | Security log `PASSWORD_CHANGED` is a log, not a second notification | No |

### Onboarding / KYC / KYB / AML

| Name / id | Trigger | Recipient | Role | Channel | Title / content | Code | Stored | Reachable | Sent as designed | Duplicates | Same event → more than one |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Onboarding Completed `onboarding_completed` | Admin **final** approval | Onboarding user | Issuer or Investor | Inbox + email | “Onboarding Completed” + org name | `admin/service.ts` `completeFinalApproval` | Inbox + log | Yes | Yes. Seed id used to be `onboarding_approved`; live id is `onboarding_completed` | Activity has `FINAL_APPROVAL_COMPLETED` (customer title “Onboarding Approved”) | No |
| Onboarding Rejected `onboarding_rejected` | Provider reject (individual and/or COD) | Onboarding user | Issuer or Investor | Inbox + email | “Onboarding Application Rejected” + optional reason | `regtank/webhooks/individual-onboarding-handler.ts`, `cod-handler.ts` | Inbox + log | Yes | Yes | Two log types (`ONBOARDING_REJECTED` / `COD_REJECTED`) can pair with one notif | Handler may send from more than one reject branch; idempotency keys apply |
| Director/Shareholder Action Required `director_shareholder_action_required` | CTOS pull finds new director/shareholder needing action | Issuer **org owner** | Issuer | Inbox + email (not user-configurable) | “Action Required…” + person name | `notification/director-shareholder-notifications.ts` | Inbox + log | Yes | Yes | Verify-link SES is a **separate** email to the person | One notif per person/idempotency key |
| Investor Director/Shareholder Action Required `investor_director_shareholder_action_required` | Same, investor org | Investor org owner | Investor | Inbox + email | Same title pattern | same module | Inbox + log | Yes | Yes | Same | Same |

**Not typed (no inbox):** onboarding started, fee paid, amendment required (Activity only), Admin restart, SSM/AML/EOD milestones, membership add/remove.

Director/shareholder **verify link** is listed under Other SES.

### Admin announcements (not automatic)

| Name / id | Trigger | Recipient | Role | Channel | Title / content | Code | Stored | Reachable | Sent as designed | Duplicates |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| System Announcement `system_announcement` | Admin custom send | Selected users / group | Issuer and/or Investor | Prefs (default both) | Admin-supplied title and body | `notification/service.ts` `sendBulkNotification` | Inbox + `source=ADMIN` log | Yes — Settings → Notifications → Custom & Groups | Yes if Admin fills title/message | None automatic |
| New Product Alert `new_product_alert` | Admin custom send **only** | Selected users (investor-targeted type) | Investor | Prefs (default both) | Template: “New Investment Opportunity” + product name **or** Admin override if send uses custom title | `sendBulkNotification`; template in `registry.ts` | Inbox + ADMIN log | Yes as **manual** send. **Not** fired on product create | Template mentions product; Admin send may use custom copy | Product `PRODUCT_CREATED` log is unrelated |

### Applications, offers, signing deadlines (issuer)

| Name / id | Trigger | Recipient | Role | Channel | Title / content | Code | Stored | Reachable | Sent as designed | Duplicates | Same event → more than one |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Application Amendments Requested `application_amendments_requested` | Admin submits amendment pack | Issuer owner + org admins | Issuer | Inbox + email | “Amendment Requested” + APP ref | `admin/service.ts` | Inbox + log | Yes | Yes | Log `AMENDMENTS_SUBMITTED` | No |
| Acceptance Documents Need Updates `acceptance_document_changes_requested` | First CHANGES_REQUESTED in an acceptance cycle | Issuer owner + org admins | Issuer | Inbox + email | Asks issuer to replace files on Review Offer | `admin/service.ts` | Inbox + log | Yes | Further requests in the **same cycle do not re-notify** (by design) | — | No |
| Application Rejected `application_rejected` | Admin rejects application | Issuer owner + org admins | Issuer | Inbox + email | Application rejected + APP ref | `admin/service.ts` | Inbox + log | Yes | Yes | — | No |
| Facility Offer Sent `contract_offer_sent` | Admin sends facility offer | Issuer owner + org admins | Issuer | Inbox + email | “Facility Offer Received” + amount + expiry | `admin/service.ts` | Inbox + log | Yes | Title says Received; seed name says Sent | — | No |
| Invoice Offer Sent `invoice_offer_sent` | Admin sends invoice offer | Issuer owner + org admins | Issuer | Inbox + email | Invoice offer + RM amount + expiry | `admin/service.ts` | Inbox + log | Yes | Yes | OTP email is extra when they **accept** | No |
| Offer Retracted or Reset `offer_retracted_or_reset` | Admin retracts offer **or** resets application to review | Issuer owner + org admins | Issuer | Inbox + email | “Offer Updated” — retracted or reset, no longer active | `admin/service.ts` (retract + reset paths) | Inbox + log | Yes | One type covers two Admin actions | Title does not say which action | No |
| Offer Expired `offer_expired` | Hourly acceptance/signing expiry job | Issuer owner + org admins | Issuer | Inbox + email | Facility or invoice offer has expired | `lib/jobs/acceptance-signing-expiry.ts` | Inbox + log | Yes | Yes | Signing package expiry is a **log**, not this type | Job may also write offer expired **logs** |
| Offer Expiry Reminder `offer_expiry_reminder_24h` | Same job, before deadline | Issuer owner + org admins | Issuer | Inbox + email | “Offer Expiring Soon” + days window | `acceptance-signing-expiry.ts` | Inbox + log | Yes | **Id is historical.** Window is product `days_before_expiry`, not always 24h | — | No |
| Application Resubmitted Confirmation `application_resubmitted_confirmation` | Issuer resubmits | Issuer owner + org admins | Issuer | Inbox + email | Resubmitted + review cycle | `applications/service.ts` | Inbox + log | Yes | Yes | — | No |
| Application Withdrawn Confirmation `application_withdrawn_confirmation` | Withdraw **or** facility/invoice offer declined | Issuer owner + org admins | Issuer | Inbox + email | Title switches: Withdrawn / Facility Offer Declined / Invoice Offer Declined | `applications/service.ts` | Inbox + log | Yes | Same type, different copy via `withdrawalReason` | Not a second type for decline | One send per action |
| Application Completed `application_completed` | Application status completed (incl. after accept paths) | Issuer owner + org admins | Issuer | Inbox + email | Completed successfully | `applications/service.ts` | Inbox + log | Yes | Yes | — | No |
| Application Submitted Confirmation `application_submitted_confirmation` | First submit | Issuer owner + org admins | Issuer | **Inbox only** (email off by default) | “Application Submitted” + under review | `applications/service.ts` | Inbox + log | Yes | Email off unless user enables | — | No |
| Facility Signing Deadline Extended `contract_signing_deadline_extended` | Admin extends facility signing deadline | Issuer owner + org admins | Issuer | Inbox + email | Deadline extended + date | `admin/service.ts` | Inbox + log | Yes | Yes | — | No |
| Invoice Signing Deadline Extended `invoice_signing_deadline_extended` | Admin extends invoice signing deadline | Issuer owner + org admins | Issuer | Inbox + email | Invoice deadline extended | `admin/service.ts` | Inbox + log | Yes | Yes | — | No |
| Facility Disabled `facility_disabled` | Admin disables facility | Issuer owner + org admins | Issuer | Inbox + email | Disabled; new drawdowns unavailable | `admin/service.ts` | Inbox + log | Yes | Yes | **No** matching enable notification | No |
| Upfront facility fee payment required `facility_fee_payment_requested` | Issuer accepts facility offer that requires gateway fee | Issuer owner + org admins | Issuer | Inbox + email | RM due; pay before invoice financing | `applications/service.ts` via `facility-fee-notifications.ts` | Inbox + log | Yes | Yes | — | No |
| Upfront facility fee paid `facility_fee_upfront_paid` | Fee captured in full | Issuer org members (typed helper) | Issuer | Inbox + email | Fee received; facility usable | `facility-fee-notifications.ts` | Inbox + log | Yes | Yes | Log `FACILITY_FEE_PAID` | No |

**Signing package sent/completed/declined/expired/voided** have **no** typed types. Signers get SES (section B). Org inbox is not notified of signing status.

### Notes — publish, funding, servicing, default

Senders: `notification/note-lifecycle-notifications.ts` unless noted.

| Name / id | Trigger | Recipient | Role | Channel | Title / content | Code | Stored | Reachable | Sent as designed | Duplicates | Same event → more than one |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Note published `note_published` | Publish | All issuer org members | Issuer | Inbox + email | Note published to marketplace | `notifyNotePublished` | Inbox + log | Yes | Yes | Log `PUBLISH` | No |
| Note funding succeeded `note_funding_succeeded` | Funding close success | Issuer org members | Issuer | Inbox + email | Minimum reached; commitments locked | `notifyNoteFundingSucceeded` | Inbox + log | Yes | Yes | Log `CLOSE_FUNDING` | No |
| Funding Unsuccessful `note_funding_failed_issuer` | Funding fail | Issuer org members | Issuer | Inbox + email | Did not reach minimum | `notifyNoteFundingFailed` | Inbox + log | Yes | Yes | — | **Yes** — also investor type |
| Funding Unsuccessful `note_funding_failed_investor` | Same fail | Members of orgs that had commitments | Investor | Inbox + email | “Commitment released” | same | Inbox + log | Yes | Yes | — | Pair with issuer type |
| Note active `note_active_issuer` | Note activated | Issuer org members | Issuer | Inbox + email | Note active; disbursement/servicing | lifecycle notify activate | Inbox + log | Yes | Yes | — | **Yes** — investor type |
| Note active `note_active_investor` | Same | Investors on the note | Investor | Inbox + email | “Investment is active” | same | Inbox + log | Yes | Yes | — | Pair |
| Note repaid `note_repaid_issuer` | Fully repaid / settled | Issuer org members | Issuer | Inbox + email | Fully repaid and settled | lifecycle | Inbox + log | Yes | Yes | Investor gets `note_settlement_posted` instead of a “repaid” type | Different types per role |
| Repayment Received `note_payment_received` | Repayment recorded (received path) | Investors on the note | Investor | Inbox + email | Repayment recorded | lifecycle | Inbox + log | Yes | Issuer **Activity** may show submitted/received; this type is investor-only | Admin “Repayment received” log is not this inbox | No issuer payment-received type |
| Note settlement posted `note_settlement_posted` | Settlement posted | Investors on the note | Investor | Inbox + email | Settlement posted | lifecycle | Inbox + log | Yes | Yes | May coincide with excess late-charge types | Excess late charges are extra types |
| Note in arrears `note_arrears` | Servicing → arrears | Issuer org members | Issuer | Inbox + email | Moved into arrears | lifecycle | Inbox + log | Yes | Yes | — | **Yes** — investor type |
| Note in arrears `note_arrears_investor` | Same | Investors | Investor | Inbox + email | In arrears | lifecycle | Inbox + log | Yes | Yes | — | Pair |
| Note defaulted (issuer) `note_defaulted` | Marked default | Issuer org members | Issuer | Inbox + email | “Your Note Is in Default” | lifecycle | Inbox + log | Yes | Yes | — | **Yes** — investor type |
| Note defaulted `note_defaulted_investor` | Same | Investors | Investor | Inbox + email | “Your Investment Is in Default” | lifecycle | Inbox + log | Yes | Yes | — | Pair |
| Repayment rejected `note_payment_rejected` | Admin rejects issuer repayment | Issuer org members | Issuer | **Inbox only** default | Repayment rejected; review details | lifecycle | Inbox + log | Yes | Email off by default | Log `PAYMENT_REJECTED` | No |
| Outstanding late charges `excess_late_charges_due` | Settlement posted with leftover late charges | Issuer org members | Issuer | Inbox + email | RM outstanding on note | `excess-late-charge-notifications.ts` | Inbox + log | Yes | Yes | — | May send with settlement posted |
| Late payment charges received `excess_late_charges_paid` | Excess late charges paid in full | Issuer org members | Issuer | Inbox + email | Charges received | same | Inbox + log | Yes | Yes | — | No |

**No typed types:** pause/resume/unpublish, prospectus, paymaster, tawarruq, occupancy, facility fee **waive**, payment **approved**, settlement **approved**.

### Withdrawals and disbursement

| Name / id | Trigger | Recipient | Role | Channel | Title / content | Code | Stored | Reachable | Sent as designed | Duplicates | Same event → more than one |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Withdrawal submitted to trustee `withdrawal_submitted_to_trustee` | Trustee instruction submitted | Issuer and/or investor org members depending on withdrawal type | Issuer and/or Investor (`portalType` in payload) | Inbox + email | Instruction + display ref + withdrawal type | `notification/withdrawal-notifications.ts` | Inbox + log | Yes | Title is generic; residual vs disbursement is in `withdrawalType` | Trustee **SES+PDF** is a different email to the trustee | Can notify both portals for some types |
| Disbursement completed `withdrawal_completed` | Issuer financing disbursement completed | Issuer org members | Issuer | **Inbox only** default | “Your Disbursement Is Complete” | note-lifecycle | Inbox + log | Yes | **Not** investor cash withdrawal (that is `investor_withdrawal_completed`) | Residual completion is Activity-relabelled, not this type unless the same helper runs | Confirm residual uses Activity not this type |
| Withdrawal submitted `investor_withdrawal_submitted` | Investor cash withdrawal requested | Acting investor user | Investor | **Inbox only** default | Request submitted | `investor-withdrawal-notifications.ts` | Inbox + log | Yes | Email off | — | No |
| Withdrawal completed `investor_withdrawal_completed` | Investor cash withdrawal completed | Acting investor user | Investor | **Inbox only** default | Withdrawal completed + RM | same | Inbox + log | Yes | Email off | Distinct from issuer `withdrawal_completed` | No |

### Investor wallet / gateway

| Name / id | Trigger | Recipient | Role | Channel | Title / content | Code | Stored | Reachable | Sent as designed | Duplicates |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Deposit verification failed `deposit_name_check_rejected` | Name check rejected | Investor org members | Investor | Inbox only default | Could not verify; will be returned | `gateway-payment-notifications.ts` | Inbox + log | Yes | Email off | Gateway event `NAME_CHECK_REJECTED` | No |
| Deposit refund started `deposit_refund_initiated` | Refund initiated | Investor org members | Investor | Inbox only default | Refund started + RM | same | Inbox + log | Yes | Email off | `REFUND_INITIATED` | No |
| Deposit refund completed `deposit_refunded` | Refund completed | Investor org members | Investor | Inbox only default | Refund completed + RM | same | Inbox + log | Yes | Email off | `REFUNDED` | No |
| Deposit successful `deposit_successful` | Deposit credited | Investor org members | Investor | Inbox only default | Credited to wallet + RM | same | Inbox + log | Yes | Email off | Gateway completed + wallet journal | No |
| Investment committed `investment_committed` | Investor commits to a note | Acting investor | Investor | Inbox only default | RM + note title | `investment-notifications.ts` | Inbox + log | Yes | Email off | Log `INVESTMENT_COMMITTED` | No |

---

## B. Other live emails (not the 49 types)

These are reachable SES messages **without** an inbox `NotificationType`.

| Name | Trigger | Recipient | Role | Channel | Subject | Main content | Code | Stored | Reachable | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Organisation member invite / resend | Org admin invites or resends | Invitee email | Future issuer or investor member | Email only | `You've been invited to join {org} on CashSouk` | Role + accept link | `organization/service.ts` + `organizationInvitationTemplate` | Invite row; `MEMBER_INVITED` log; **no** inbox type | Yes | Resend uses the same template |
| Admin invite / resend | Admin invites or resends | Invitee email | Future Admin | Email only | `You've been invited to join CashSouk as {role}` | Role + 24h link | `admin/service.ts` + `adminInvitationTemplate` | Invite row; revoke is `INVITATION_REVOKED` | Yes | Accept is Cognito/admin signup |
| Signing package / reminder | Send package or `remindRecipient` | Named signer email | External signer / authorised rep (may not be a portal user) | Email only | `Signature requested: {title}` or `Reminder: {title}` | Unique signing URL; IC check | `signing/service.ts` `sendSigningEmail` | Envelope/recipient; `SIGNING_PACKAGE_SENT` only on first send | Yes | Reminder does not write Activity. Skipped if `ISSUER_URL` missing |
| Invoice offer-accept OTP | Issuer requests OTP to accept invoice offer | Signatory email | Issuer signatory | Email only | `Verification code to accept invoice offer {invoice ref}` | Code, invoice, facility, amount, TTL | `applications/offer-accept-otp.ts` | `offer_accept_otp_challenges` | Yes | Not an inbox notification; cooldown/resend limits |
| Director/shareholder verify link | CTOS path needs the person to verify | Person’s email | Director/shareholder (may be new) | Email only | `Complete your verification` | 24h verify URL | `lib/email/ses.ts` `sendOnboardingEmail` from `organization/service.ts` | Onboarding/provider state | Yes | Separate from owner’s `director_shareholder_action_required` inbox |
| Trustee instruction + PDF | Auto-send trustee letter | Configured trustee recipients | Trustee (external) | Email + PDF attachment | `Trustee instruction — {purpose} — {reference}` | Attached signed instruction | `notes/trustee-letters/trustee-instruction-email.ts` | Note events `*_TRUSTEE_EMAIL_SENT`; S3 letter | Yes if trustee recipients configured | Kinds: issuer disbursement, investor withdrawal, residual return, admin adjustment, settlement |

Typed notification emails use the same SES client with titles/bodies from `NOTIFICATION_TEMPLATES` (HTML wrappers in notification email templates). Those are **not** extra types.

---

## C. What is not a platform notification

| Item | Why excluded |
| --- | --- |
| Cognito forgot-password / hosted UI mail | AWS Cognito, not `NotificationService` or app SES templates |
| Admin 2FA reset | Cognito console |
| Ops Alerts | Removed |
| Dev RegTank webhook emails | None; dev handler is logs only |
| Product create auto-alert | Type exists; **no** product-create caller |

---

## Active actions with no notification

Customer or issuer/investor can complete these live actions and get **no** typed inbox/email (Activity or SES-to-someone-else may still exist):

| Action | What they get instead |
| --- | --- |
| Onboarding started / fee paid | Activity only |
| Onboarding amendment required (generic COD) | Activity `ONBOARDING_AMENDMENT_REQUIRED`; DS action is a different type |
| Admin restart onboarding | Activity “Onboarding Restarted”; no inbox |
| Facility **enabled** | Log `CONTRACT_FACILITY_ENABLED` only |
| Facility fee waived (contract or note) | Logs only |
| Invoice withdrawn | Activity only |
| Pause / resume listing | Issuer Activity only |
| Unpublish | Admin/issuer Activity only |
| Signing sent (org members who are not the signer) | Signers get SES; org inbox silent |
| Signing completed / declined / expired / voided | Activity (voided = Admin only) |
| Repayment **approved** | Activity `PAYMENT_APPROVED` |
| Settlement **approved** (before post) | Activity `SETTLEMENT_APPROVED` |
| Prospectus review / paymaster / tawarruq | Admin Note Activity only |
| Product created | Product log; investors not auto-notified |
| Org member invited | SES invite; no inbox type for existing members |
| Signing reminder | SES to signer only |

Whether each “should” notify is a product decision. They are listed because the live action exists and no typed (or, for signing status, no org) notification fires.

---

## Duplicate / overlapping notifications

| Pattern | What happens |
| --- | --- |
| Funding fail | **Two** types: issuer + investor |
| Note activate | **Two** types: issuer + investor |
| Arrears | **Two** types |
| Default | **Two** types |
| Offer declined | Log `CONTRACT_OFFER_DECLINED` / `INVOICE_OFFER_REJECTED` + notif type `application_withdrawn_confirmation` |
| Offer retract **and** reset-to-review | Same notif type `offer_retracted_or_reset` |
| Settlement posted + leftover late charges | `note_settlement_posted` (investors) **and** `excess_late_charges_due` (issuer) |
| Director/shareholder | Owner inbox type **and** SES verify link to the person |
| Trustee flow | User typed `withdrawal_submitted_to_trustee` **and** SES+PDF to trustee |
| Invoice accept | Offer-sent inbox earlier; OTP email at accept |
| Admin custom send | Can use `system_announcement` / `new_product_alert` in addition to any automatic types |

These are overlapping **by design**, not dead duplicates.

## Count snapshot (this inventory)

| Bucket | Count |
| --- | --- |
| Seeded typed types | **49** (`seed-data.ts`) |
| Automatic typed senders | **47** |
| Admin-custom-only typed types | **2** (`system_announcement`, `new_product_alert`) |
| Other live SES (not typed) | **6** |
| Total distinct live message kinds | **55** |
| Same-event dual types (issuer+investor pairs) | **4** funding fail, activate, arrears, default |
| Active actions with no typed/org notification | **16** listed in the gap table |

Inbox delivery was **code-traced**, not live-sent in this review (no Playwright mail/inbox pass).
