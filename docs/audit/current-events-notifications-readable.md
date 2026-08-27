# Current Events and Notifications (readable)

This is a **reader-friendly expansion** of live behaviour.

**Technical source of truth:** [`current-audit-notification-catalog.md`](./current-audit-notification-catalog.md).

Source code is authoritative. Titles below are current source strings. Do not treat this file as a place to invent planned wording.

## Fictional mock dataset

Every example is **Mock example** / **FICTIONAL**. Do not treat names or references as real customers.

| Role | Value |
|---|---|
| User | Nur Aisyah |
| Admin | Adam Lee |
| Organisation | ABC Trading Sdn Bhd |
| Application | APP-CS-2026-001 |
| Facility | FAC-CS-2026-005 |
| Invoice | INV-2026-0042 |
| Note | NOTE-CS-2026-018 |
| Investment | INVEST-2026-0104 |
| Payment | PAY-2026-0098 |
| Withdrawal | WD-2026-0031 |
| Product | Invoice Financing |
| Legal document | Terms of Use v3 |
| Amounts | RM10,000.00 / RM50,000.00 / RM100,000.00 |

Admin timestamps use the current Admin format, e.g. `27 Aug 2026, 10:15 AM`.

## How this relates to the technical catalogue

The technical master counted **138** live IDs because `application_logs.CONTRACT_CUSTOMER_LARGE_PRIVATE_UPDATED` was omitted from its application enum table. Source has a live Admin writer and UI (`contract-section.tsx`). After adding `MEMBER_*` and then classifying `NOTE_FACILITY_FEE_COLLECTION_WAIVED` as historical, this readable file lists **138** live event IDs.

After the 2026-08-27 cleanup pass:

- New live IDs: `MEMBER_ADDED`, `MEMBER_INVITED`, `MEMBER_REMOVED`, `MEMBER_ROLE_CHANGED` (Admin organisation Activity only).
- User-portal organisation Activity remains onboarding milestones. `MEMBER_*` are **not** shown there (**INTENTIONALLY_UNCHANGED**).
- `OVERRIDE_*` are **not live** (no writer).
- `FORM_FILLED` does **not** store `section`.
- Production webhook pending/in-progress/unknown statuses write `ONBOARDING_STATUS_UPDATED`, not `WEBHOOK_*`.
- Facility-fee waive writes one live note event (`WAIVE_FACILITY_FEE_COLLECTION`). `NOTE_FACILITY_FEE_COLLECTION_WAIVED` is historical.
- Shoraka `target_id` is the CashSouk trade-order id; `provider_order_id` stays in metadata.

Live note IDs are **current writers only**, each listed separately. CSV aliases with no current writer (`NOTE_PUBLISHED`, `PAYMENT_RECORDED`, `NOTE_FACILITY_FEE_COLLECTION_WAIVED`, …) are in the non-live appendix, not mixed into live modules.

`notification_logs` rows are delivery batches, not a second copy of the business event.

## Counts (this file)

- Live events expanded: 138
- Live notification types expanded: 49
- Duplicate (store, raw ID) pairs: none
- Duplicate notification type IDs: none

# 1. Access / Authentication

## Events

### Event — Login

- Raw event ID: `LOGIN`
- Store: `access_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Login
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Later real Cognito authentication after the user already exists on CashSouk. Failed admin-portal access also writes LOGIN with success false. POST /v1/auth/sync-user does not write LOGIN. portal is the initiating frontend, not role. LOGIN does not store a fake activeRole.
- Who triggers it: User via Cognito OAuth callback, or failed admin access gate
- Important metadata: `requestedRole` (OAuth requested persona, not active session role), `roles`, `portal` (or null if unknown), `stateId`. Fail path also `userRoles`, `hasAdminRole`, `adminStatus`, `wasPreviouslyAdmin`, `reason`.
- Canonical evidence: this access_logs row
- Where Ops sees it: Admin Audit → Access table and Event details drawer
- Export: CSV Event `Login` + Event Type `LOGIN`; extra User ID, Portal, IP, Device (`device_info`), User Agent. JSON raw `event_type`.
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Nur Aisyah signed in from the Issuer portal (portal=`issuer`, requestedRole is request context only).

### Event — Sign Up

- Raw event ID: `SIGNUP`
- Store: `access_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Sign Up
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: First CashSouk user establishment: new user and no successful SIGNUP yet (`classifyAccessAuthEvent`). Same OAuth callback as LOGIN.
- Who triggers it: User via Cognito OAuth callback on first CashSouk establishment
- Important metadata: Same success keys as LOGIN: `requestedRole`, `roles`, `portal`, `stateId`. No fake `activeRole`.
- Canonical evidence: this access_logs row
- Where Ops sees it: Admin Audit → Access
- Export: CSV Event `Sign Up` + Event Type `SIGNUP`; JSON raw `event_type`.
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Nur Aisyah established a CashSouk user for the first time (SIGNUP, not LOGIN).

### Event — Logout

- Raw event ID: `LOGOUT`
- Store: `access_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Logout
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Logout from Cognito logout route and auth/service logout.
- Who triggers it: User
- Important metadata: Cognito path: `roles`, `portal`. Service logout may include observed session `activeRole` from `req.activeRole` (not invented on LOGIN).
- Canonical evidence: this access_logs row
- Where Ops sees it: Admin Audit → Access
- Export: CSV Event `Logout` + Event Type `LOGOUT`
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Nur Aisyah logged out (portal=`issuer` or null if unknown).

### Event — User Profile Updated

- Raw event ID: `PROFILE_UPDATED`
- Store: `access_logs`
- Status: `LIVE_UI`
- Title shown in Admin: User Profile Updated
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Admin edits another user’s name/phone. Access table override uses User Profile Updated (not Security’s Profile Updated).
- Who triggers it: Admin Adam Lee via updateUserProfile
- Important metadata: `targetUserId`, `updatedFields`, `previousValues`, `nextValues`, `nameLockedOverride`
- Canonical evidence: this access_logs row
- Where Ops sees it: Admin Audit → Access
- Export: CSV Event `User Profile Updated`
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee updated Nur Aisyah’s user profile (Access row).

## Notifications

No live notification types are owned by this module.

# 2. Security / Roles

## Events

### Event — Password Changed

- Raw event ID: `PASSWORD_CHANGED`
- Store: `security_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Password Changed
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Password change success or fail. Lives on security_logs, not access_logs.
- Who triggers it: User changePassword
- Important metadata: `reason`, `sessionRevoked`, `success?`, `error?`
- Canonical evidence: this security_logs row
- Where Ops sees it: Admin Audit → Security
- Export: CSV Event `Password Changed` (humanize) + Event Type `PASSWORD_CHANGED`
- Related notification: `password_changed` on success only
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Nur Aisyah changed the account password (success).

### Event — Email Verified

- Raw event ID: `EMAIL_VERIFIED`
- Store: `security_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Email Verified
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Email verification success or fail. Raw ID is EMAIL_VERIFIED.
- Who triggers it: User verifyEmail
- Important metadata: `email`, `reason`, `success?`
- Canonical evidence: this security_logs row
- Where Ops sees it: Admin Audit → Security
- Export: CSV Event `Email Verified`
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Nur Aisyah’s email was verified.

### Event — Role Added

- Raw event ID: `ROLE_ADDED`
- Store: `security_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Role Added
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: User adds their own portal role, or an admin invitation is accepted. Distinct from unreachable access_logs.ROLE_ADDED.
- Who triggers it: User addRole, or invitee acceptAdminInvitation
- Important metadata: `addedRole`, `allRoles`; invitation also `invitationToken`, `invitationType`
- Canonical evidence: this security_logs row
- Where Ops sees it: Admin Audit → Security
- Export: CSV Event `Role Added`
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Nur Aisyah added the Issuer portal role (addedRole=ISSUER).

### Event — Role Switched

- Raw event ID: `ROLE_SWITCHED`
- Store: `security_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Admin Deactivated / Admin Reactivated / Admin Role Changed / Role Switched (metadata-driven; raw ID stays ROLE_SWITCHED). There is no UI string Admin Role Deleted.
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Mid-session role switch, or Admin deactivate/reactivate/role-description change. Display uses formatRoleSwitchedLabel: DEACTIVATED or DEACTIVATED_VIA_ROLE_REMOVAL → Admin Deactivated; REACTIVATED or ACTIVATED_VIA_ROLE_ADDITION → Admin Reactivated; previousRole+newRole strings → Admin Role Changed; else Role Switched.
- Who triggers it: User switchRole; Admin updateUserRoles / updateAdminRole / deactivateAdmin / reactivateAdmin
- Important metadata: `newRole`; or `action` (`DEACTIVATED`, `DEACTIVATED_VIA_ROLE_REMOVAL`, `REACTIVATED`, `ACTIVATED_VIA_ROLE_ADDITION`); or `previousRole` + `newRole`
- Canonical evidence: this security_logs row
- Where Ops sees it: Admin Audit → Security
- Export: CSV Event uses formatRoleSwitchedLabel; Event Type stays ROLE_SWITCHED
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee deactivated an admin (display Admin Deactivated; raw ROLE_SWITCHED).

### Event — Role Created

- Raw event ID: `ROLE_CREATED`
- Store: `security_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Role Created
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Admin role catalogue create.
- Who triggers it: Admin settings
- Important metadata: `roleKey`, `roleName`, `badgeColor`
- Canonical evidence: this security_logs row
- Where Ops sees it: Admin Audit → Security
- Export: CSV Event `Role Created` (humanize)
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee created a catalogue role.

### Event — Role Permissions Updated

- Raw event ID: `ROLE_PERMISSIONS_UPDATED`
- Store: `security_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Role Permissions Updated
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Admin role permission edit.
- Who triggers it: Admin settings
- Important metadata: `roleKey`, `previousPermissions`, `nextPermissions`
- Canonical evidence: this security_logs row
- Where Ops sees it: Admin Audit → Security
- Export: CSV Event `Role Permissions Updated` (humanize)
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee updated role permissions.

### Event — Role Removed

- Raw event ID: `ROLE_REMOVED`
- Store: `security_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Role Removed
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Admin role catalogue delete — not a user’s portal role. Not Admin Role Deleted.
- Who triggers it: Admin settings deleteAdminRole
- Important metadata: `deletedRoleKey`, `deletedRoleName`
- Canonical evidence: this security_logs row
- Where Ops sees it: Admin Audit → Security
- Export: CSV Event `Role Removed` (humanize)
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee deleted a catalogue role (Role Removed).

### Event — Invitation Revoked

- Raw event ID: `INVITATION_REVOKED`
- Store: `security_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Invitation Revoked
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Admin revokes an invitation.
- Who triggers it: Settings → Roles (useRevokeInvitation)
- Important metadata: `invitationId`, `email`, `roleDescription`
- Canonical evidence: this security_logs row
- Where Ops sees it: Admin Audit → Security
- Export: CSV Event `Invitation Revoked` (humanize)
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee revoked an invitation.

### Event — Profile Updated

- Raw event ID: `PROFILE_UPDATED`
- Store: `security_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Profile Updated
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Self-service or admin-override profile edit. Security table says Profile Updated (Access uses User Profile Updated for a different writer). Admin phone-only edits of onboarded users also write this row with `adminOverride: true`.
- Who triggers it: User or admin profile
- Important metadata: `updatedFields`, `previousValues`, `nextValues`, `adminOverride?`
- Canonical evidence: this security_logs row
- Where Ops sees it: Admin Audit → Security
- Export: CSV Event `Profile Updated`
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Nur Aisyah updated her own profile.

### Event — Platform Finance Settings Updated

- Raw event ID: `PLATFORM_FINANCE_SETTINGS_UPDATED`
- Store: `security_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Platform Finance Settings Updated
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Admin finance settings save.
- Who triggers it: Admin notes finance settings
- Important metadata: before/after snapshot in metadata
- Canonical evidence: this security_logs row
- Where Ops sees it: Admin Audit → Security
- Export: CSV Event `Platform Finance Settings Updated` (humanize)
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee saved platform finance settings.

## Notifications

### Notification — Password Changed

- Notification type ID: `password_changed`
- Catalogue name: Password Changed
- Exact title: Password Changed
- Purpose / description: Sent when your account password has been successfully changed.
- Trigger: changePassword success
- Recipient: Actor user
- Portal: request portal if known; else unset (email uses landing FRONTEND_URL)
- Platform default: true
- Email default: true
- User configurable: false
- Related event/canonical evidence: security_logs.PASSWORD_CHANGED
- Exact message template (source): `The password for your account was changed on ${formatDateDDMMYYYY(data.changedAt)}.`
- Example (fictional): Mock example — Title `Password Changed`. Mock context: Nur Aisyah — password changed.

# 3. Onboarding

## Events

### Event — Onboarding Started

- Raw event ID: `ONBOARDING_STARTED`
- Store: `onboarding_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Onboarding Started
- Title shown to Issuer: Onboarding Started — Your organization onboarding has started and you can continue it at any time.
- Title shown to Investor: Onboarding Started — Your organization onboarding has started and you can continue it at any time.
- Description: Start personal or corporate onboarding.
- Who triggers it: Applicant + RegTank start
- Important metadata: `organizationId`, `requestId`, `onboardingType`, `previousOrgStatus`
- Canonical evidence: this onboarding_logs row
- Where Ops sees it: Admin organisation Activity; Issuer/Investor Activity
- Export: CSV Event `Onboarding Started`; Organisation uses organizationName
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Nur Aisyah started onboarding for ABC Trading Sdn Bhd.

### Event — Onboarding Resumed

- Raw event ID: `ONBOARDING_RESUMED`
- Store: `onboarding_logs`
- Status: `LIVE_UI / LIVE_SYSTEM`
- Title shown in Admin: Onboarding Resumed
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Resume onboarding / new request id. Not in portal Activity allowlist.
- Who triggers it: Applicant + auto-regen
- Important metadata: `organizationId`, `previousRequestId`, `newRequestId`, `trigger`
- Canonical evidence: this onboarding_logs row
- Where Ops sees it: Admin organisation Activity
- Export: CSV Event `Onboarding Resumed`
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — ABC Trading Sdn Bhd onboarding resumed with a new request id.

### Event — Onboarding Restarted

- Raw event ID: `ONBOARDING_CANCELLED`
- Store: `onboarding_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Onboarding Restarted
- Title shown to Issuer: Onboarding Restarted — Your previous onboarding request was cancelled and a new onboarding request has been started.
- Title shown to Investor: Onboarding Restarted — Your previous onboarding request was cancelled and a new onboarding request has been started.
- Description: Admin restart. Stored ID ONBOARDING_CANCELLED is historical/forensic; display is Onboarding Restarted.
- Who triggers it: Admin
- Important metadata: `cancelledOnboardingId`, `previousStatus`, `cancelledBy`, `reason`
- Canonical evidence: this onboarding_logs row
- Where Ops sees it: Admin organisation Activity; Issuer/Investor Activity
- Export: CSV Event `Onboarding Restarted`
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee restarted onboarding for ABC Trading Sdn Bhd.

### Event — Onboarding Rejected

- Raw event ID: `ONBOARDING_REJECTED`
- Store: `onboarding_logs`
- Status: `LIVE_WEBHOOK`
- Title shown in Admin: Onboarding Rejected
- Title shown to Issuer: Onboarding Rejected — Your organization onboarding was rejected (optional reason).
- Title shown to Investor: Onboarding Rejected — Your organization onboarding was rejected (optional reason).
- Description: Individual RegTank rejection.
- Who triggers it: LIVE_WEBHOOK individual-onboarding-handler
- Important metadata: `previousStatus`, `newStatus`, `trigger`
- Canonical evidence: this onboarding_logs row
- Where Ops sees it: Admin organisation Activity; portal Activity
- Export: CSV Event `Onboarding Rejected`
- Related notification: `onboarding_rejected` when that path notifies
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — ABC Trading Sdn Bhd individual onboarding was rejected.

### Event — Onboarding Rejected

- Raw event ID: `COD_REJECTED`
- Store: `onboarding_logs`
- Status: `LIVE_WEBHOOK`
- Title shown in Admin: Onboarding Rejected
- Title shown to Issuer: Onboarding Rejected — Your organization onboarding was rejected.
- Title shown to Investor: Onboarding Rejected — Your organization onboarding was rejected.
- Description: Corporate onboarding data (COD) rejection. Same Admin/CSV label as ONBOARDING_REJECTED; different raw ID.
- Who triggers it: LIVE_WEBHOOK cod-handler
- Important metadata: COD/request fields
- Canonical evidence: this onboarding_logs row
- Where Ops sees it: Admin organisation Activity; portal Activity
- Export: CSV Event `Onboarding Rejected`
- Related notification: `onboarding_rejected` if that path notifies
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — ABC Trading Sdn Bhd corporate onboarding was rejected (COD_REJECTED).

### Event — Onboarding Approved

- Raw event ID: `ONBOARDING_APPROVED`
- Store: `onboarding_logs`
- Status: `LIVE_UI / LIVE_WEBHOOK`
- Title shown in Admin: Onboarding Approved
- Title shown to Issuer: Onboarding Submission Approved — Your onboarding submission was approved. We'll notify you when your onboarding is fully complete.
- Title shown to Investor: Onboarding Submission Approved — Your onboarding submission was approved. We'll notify you when your onboarding is fully complete.
- Description: Intermediate submission approval. Not the same as FINAL_APPROVAL_COMPLETED. Does not send onboarding_completed.
- Who triggers it: Admin/webhook
- Important metadata: status/trigger
- Canonical evidence: this onboarding_logs row
- Where Ops sees it: Admin organisation Activity; portal Activity
- Export: CSV Event `Onboarding Approved`
- Related notification: not `onboarding_completed`
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — ABC Trading Sdn Bhd onboarding submission was approved (not yet fully complete).

### Event — Final Approval Completed

- Raw event ID: `FINAL_APPROVAL_COMPLETED`
- Store: `onboarding_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Final Approval Completed
- Title shown to Issuer: Onboarding Approved — Your organization onboarding was approved and no further action is needed.
- Title shown to Investor: Onboarding Approved — Your organization onboarding was approved and no further action is needed.
- Description: Full platform access. Admin/CSV is Final Approval Completed. Portal title is Onboarding Approved. Notification title is Onboarding Completed.
- Who triggers it: Admin final approve
- Important metadata: org/status
- Canonical evidence: this onboarding_logs row
- Where Ops sees it: Admin organisation Activity; portal Activity
- Export: CSV Event `Final Approval Completed`
- Related notification: `onboarding_completed` title `Onboarding Completed`
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee completed final approval for ABC Trading Sdn Bhd.

### Event — Onboarding Status Updated

- Raw event ID: `ONBOARDING_STATUS_UPDATED`
- Store: `onboarding_logs`
- Status: `LIVE_UI / LIVE_WEBHOOK`
- Title shown in Admin: Onboarding Status Updated
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Generic status/trigger evidence. Do not invent AML_APPROVED or KYC_APPROVED as this event’s ID. KYC success writes this row with metadata.trigger KYC_APPROVED. Live AML progression also uses this ID, not AML_APPROVED.
- Who triggers it: Webhooks + Admin portal-access toggle
- Important metadata: `trigger` (e.g. KYC_APPROVED), `previousStatus`, `newStatus`
- Canonical evidence: this onboarding_logs row
- Where Ops sees it: Admin organisation Activity (not portal allowlist)
- Export: CSV Event `Onboarding Status Updated`
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — ABC Trading Sdn Bhd onboarding status updated (trigger in metadata; not a dedicated KYC_APPROVED row).

### Event — Form Submitted

- Raw event ID: `FORM_FILLED`
- Store: `onboarding_logs`
- Status: `LIVE_WEBHOOK`
- Title shown in Admin: Form Submitted
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Form liveness / form-filling / processing / ID uploaded from RegTank. Do not invent a `section` key — writers store request/status/payload (service) or org/status/trigger keys (individual handler).
- Who triggers it: LIVE_WEBHOOK / RegTank service
- Important metadata: `requestId`, `status`, `substatus`, `payload` (service path)
- Canonical evidence: this onboarding_logs row
- Where Ops sees it: Admin organisation Activity
- Export: CSV Event `Form Submitted`
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — A form section was submitted for ABC Trading Sdn Bhd (FORM_FILLED).

### Event — SSM Approved

- Raw event ID: `SSM_APPROVED`
- Store: `onboarding_logs`
- Status: `LIVE_UI`
- Title shown in Admin: SSM Approved
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Admin SSM verification approve. Wired in onboarding-review-dialog.tsx.
- Who triggers it: Admin approveSsmVerification
- Important metadata: org/SSM ids
- Canonical evidence: this onboarding_logs row
- Where Ops sees it: Admin organisation Activity
- Export: CSV Event `SSM Approved`
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee approved SSM verification for ABC Trading Sdn Bhd.

### Event — T&C Approved

- Raw event ID: `TNC_APPROVED`
- Store: `onboarding_logs`
- Status: `LIVE_UI`
- Title shown in Admin: T&C Approved
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: User accepted legal T&C in onboarding. Acceptance proof is also legal_document_acceptances.
- Who triggers it: organization/service accept T&C
- Important metadata: document/version ids
- Canonical evidence: legal_document_acceptances (no duplicate required); this row is the onboarding trail
- Where Ops sees it: Admin organisation Activity
- Export: CSV Event `T&C Approved`
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Nur Aisyah accepted Terms of Use v3 during onboarding (TNC_APPROVED).

### Event — Sophisticated Status Updated

- Raw event ID: `SOPHISTICATED_STATUS_UPDATED`
- Store: `onboarding_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Sophisticated Status Updated
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Sophisticated investor flag granted or revoked.
- Who triggers it: Admin
- Important metadata: `action` granted/revoked, `newReason`
- Canonical evidence: this onboarding_logs row
- Where Ops sees it: Admin organisation Activity
- Export: CSV Event `Sophisticated Status Updated`
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee updated sophisticated status for ABC Trading Sdn Bhd.

### Event — Organization Profile Updated

- Raw event ID: `PROFILE_UPDATED`
- Store: `onboarding_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Organization Profile Updated
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Admin or self-service organisation profile edit. Same raw ID. Nested corporate field names are stored when they change. Bank JSON is not dumped.
- Who triggers it: Admin or organisation owner/admin
- Important metadata: `updatedFields`, `previousValues`, `nextValues`, `bankFieldsChanged`, `organizationReference?`, `updatedBy?`
- Canonical evidence: this onboarding_logs row
- Where Ops sees it: Admin organisation Activity
- Export: CSV Event `Organization Profile Updated`
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee updated the organisation profile for ABC Trading Sdn Bhd.

### Event — Member Added

- Raw event ID: `MEMBER_ADDED`
- Store: `onboarding_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Member Added
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: A user was added to the organisation. Not security `ROLE_ADDED`.
- Who triggers it: Organisation owner or organisation admin
- Important metadata: `organizationId`, `organizationReference?`, `memberUserId`, `memberEmail?`, `newRole`
- Canonical evidence: this onboarding_logs row
- Where Ops sees it: Admin organisation Activity
- Export: CSV Event `Member Added`
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Nur Aisyah added a member to ABC Trading Sdn Bhd.

### Event — Member Invited

- Raw event ID: `MEMBER_INVITED`
- Store: `onboarding_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Member Invited
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: An organisation invitation was created.
- Who triggers it: Organisation owner or organisation admin
- Important metadata: `organizationId`, `memberEmail`, `newRole`, `invitationId`
- Canonical evidence: this onboarding_logs row
- Where Ops sees it: Admin organisation Activity
- Export: CSV Event `Member Invited`
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Nur Aisyah invited a member to ABC Trading Sdn Bhd.

### Event — Member Removed

- Raw event ID: `MEMBER_REMOVED`
- Store: `onboarding_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Member Removed
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: A member was removed from the organisation. Not security `ROLE_REMOVED`.
- Who triggers it: Organisation owner or organisation admin
- Important metadata: `organizationId`, `memberUserId`, `previousRole`
- Canonical evidence: this onboarding_logs row
- Where Ops sees it: Admin organisation Activity
- Export: CSV Event `Member Removed`
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Nur Aisyah removed a member from ABC Trading Sdn Bhd.

### Event — Member Role Changed

- Raw event ID: `MEMBER_ROLE_CHANGED`
- Store: `onboarding_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Member Role Changed
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: An organisation member’s role changed.
- Who triggers it: Organisation owner or organisation admin
- Important metadata: `organizationId`, `memberUserId`, `previousRole`, `newRole`
- Canonical evidence: this onboarding_logs row
- Where Ops sees it: Admin organisation Activity
- Export: CSV Event `Member Role Changed`
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Nur Aisyah changed a member’s role in ABC Trading Sdn Bhd.

## Notifications

### Notification — Onboarding Completed

- Notification type ID: `onboarding_completed`
- Catalogue name: Onboarding Completed
- Exact title: Onboarding Completed
- Purpose / description: Sent when your onboarding has been completed and you have full platform access.
- Trigger: Admin final approval (FINAL_APPROVAL_COMPLETED)
- Recipient: Organisation owner
- Portal: investor or issuer from payload
- Platform default: true
- Email default: true
- User configurable: false
- Related event/canonical evidence: onboarding_logs.FINAL_APPROVAL_COMPLETED
- Exact message template (source): `Congratulations! Your ${data.onboardingType.toLowerCase()} onboarding for ${data.orgName} has been completed successfully. You now have full access to the platform.`
- Example (fictional): Mock example — Title `Onboarding Completed`. Mock context: ABC Trading Sdn Bhd.

### Notification — Onboarding Application Rejected

- Notification type ID: `onboarding_rejected`
- Catalogue name: Onboarding Rejected
- Exact title: Onboarding Application Rejected
- Purpose / description: Sent when your onboarding application has been rejected.
- Trigger: ONBOARDING_REJECTED / COD_REJECTED paths
- Recipient: Organisation owner
- Portal: payload portal
- Platform default: true
- Email default: true
- User configurable: false
- Related event/canonical evidence: onboarding_logs.ONBOARDING_REJECTED or COD_REJECTED
- Exact message template (source): `Unfortunately, your ${data.onboardingType.toLowerCase()} onboarding for ${data.orgName} was rejected.${data.reason ? ` Reason: ${data.reason}` : ""}`
- Example (fictional): Mock example — Title `Onboarding Application Rejected`. Mock context: ABC Trading Sdn Bhd.

### Notification — Action Required: Complete Director/Shareholder Onboarding

- Notification type ID: `director_shareholder_action_required`
- Catalogue name: Director/Shareholder Action Required
- Exact title: Action Required: Complete Director/Shareholder Onboarding
- Purpose / description: Sent to the issuer organization owner when a CTOS pull finds new directors or shareholders who need onboarding action.
- Trigger: CTOS/admin
- Recipient: Issuer organisation owner
- Portal: issuer
- Platform default: true
- Email default: true
- User configurable: false
- Related event/canonical evidence: none required (not a duplicate onboarding_logs ID)
- Exact message template (source): `Please complete onboarding${who}.` where who is ` for ${data.personName.trim()}` when present.
- Example (fictional): Mock example — Title `Action Required: Complete Director/Shareholder Onboarding`. Mock context: ABC Trading Sdn Bhd.

### Notification — Action Required: Complete Director/Shareholder Onboarding

- Notification type ID: `investor_director_shareholder_action_required`
- Catalogue name: Investor Director/Shareholder Action Required
- Exact title: Action Required: Complete Director/Shareholder Onboarding
- Purpose / description: Sent to the investor organization owner when a CTOS pull finds new directors or shareholders who need onboarding action.
- Trigger: CTOS
- Recipient: Investor organisation owner
- Portal: investor
- Platform default: true
- Email default: true
- User configurable: false
- Related event/canonical evidence: none required
- Exact message template (source): `Please complete onboarding${who}.` (same template as issuer type; portal is investor)
- Example (fictional): Mock example — Title `Action Required: Complete Director/Shareholder Onboarding`. Mock context: ABC Trading Sdn Bhd (investor).

# 4. Applications

## Events

### Event — Application Created

- Raw event ID: `APPLICATION_CREATED`
- Store: `application_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Application Created
- Title shown to Issuer: Application Started — You created a financing application and can continue it before submitting.
- Title shown to Investor: Not shown on Investor Activity
- Description: Draft financing application created.
- Who triggers it: Issuer
- Important metadata: application/review fields as supplied
- Canonical evidence: `application_revisions` for submitted content (no duplicate required). This `application_logs` row is the trail.
- Where Ops sees it: Admin application timeline / Event details; facility activity where contract-scoped
- Export: Application timeline CSV uses Admin `getEventLabel`. Facility CSV uses `contract-activity-csv.ts` (some sentence-case). JSON: no. PDF: issuer-voice labels where listed. PDF: Application started
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Nur Aisyah created APP-CS-2026-001.

### Event — Application Submitted

- Raw event ID: `APPLICATION_SUBMITTED`
- Store: `application_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Application Submitted
- Title shown to Issuer: Application Submitted — Your financing application was submitted and is now under review.
- Title shown to Investor: Not shown on Investor Activity
- Description: First submit of the application.
- Who triggers it: Issuer (controller writes APPLICATION_SUBMITTED unless RESUBMITTED)
- Important metadata: status/review cycle as supplied
- Canonical evidence: `application_revisions` for submitted content (no duplicate required). This `application_logs` row is the trail.
- Where Ops sees it: Admin application timeline / Event details; facility activity where contract-scoped
- Export: Application timeline CSV uses Admin `getEventLabel`. Facility CSV uses `contract-activity-csv.ts` (some sentence-case). JSON: no. PDF: issuer-voice labels where listed. PDF: You submitted this application
- Related notification: `application_submitted_confirmation` title `Application Submitted`
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Nur Aisyah submitted APP-CS-2026-001.

### Event — Application Resubmitted

- Raw event ID: `APPLICATION_RESUBMITTED`
- Store: `application_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Application Resubmitted
- Title shown to Issuer: Application Resubmitted — You resubmitted your application after making the requested updates.
- Title shown to Investor: Not shown on Investor Activity
- Description: Issuer submitted updated application content after an amendment request. Not AMENDMENTS_SUBMITTED.
- Who triggers it: Issuer
- Important metadata: review cycle as supplied
- Canonical evidence: `application_revisions` for submitted content (no duplicate required). This `application_logs` row is the trail.
- Where Ops sees it: Admin application timeline / Event details; facility activity where contract-scoped
- Export: Application timeline CSV uses Admin `getEventLabel`. Facility CSV uses `contract-activity-csv.ts` (some sentence-case). JSON: no. PDF: issuer-voice labels where listed. PDF: You resubmitted after changes
- Related notification: `application_resubmitted_confirmation` title `Application Resubmitted`
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Nur Aisyah resubmitted APP-CS-2026-001 after requested updates.

### Event — Amendment Request Sent

- Raw event ID: `AMENDMENTS_SUBMITTED`
- Store: `application_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Amendment Request Sent
- Title shown to Issuer: Amendment Request Sent — CashSouk sent an amendment request for this application.
- Title shown to Investor: Not shown on Investor Activity
- Description: Admin/CashSouk sent the amendment request batch. Not the issuer submitting updated content.
- Who triggers it: Admin Adam Lee
- Important metadata: amendment batch fields as supplied
- Canonical evidence: `application_revisions` for submitted content (no duplicate required). This `application_logs` row is the trail.
- Where Ops sees it: Admin application timeline / Event details; facility activity where contract-scoped
- Export: Application timeline CSV uses Admin `getEventLabel`. Facility CSV uses `contract-activity-csv.ts` (some sentence-case). JSON: no. PDF: issuer-voice labels where listed. PDF: Amendment Request Sent
- Related notification: `application_amendments_requested` catalogue `Application Amendments Requested`, title `Amendment Requested`
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee sent an amendment request for APP-CS-2026-001.

### Event — Application Rejected

- Raw event ID: `APPLICATION_REJECTED`
- Store: `application_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Application Rejected
- Title shown to Issuer: Application Rejected — Your financing application was rejected and will not continue.
- Title shown to Investor: Not shown on Investor Activity
- Description: Application rejected.
- Who triggers it: Admin
- Important metadata: reason as supplied
- Canonical evidence: `application_revisions` for submitted content (no duplicate required). This `application_logs` row is the trail.
- Where Ops sees it: Admin application timeline / Event details; facility activity where contract-scoped
- Export: Application timeline CSV uses Admin `getEventLabel`. Facility CSV uses `contract-activity-csv.ts` (some sentence-case). JSON: no. PDF: issuer-voice labels where listed. PDF: Application was not approved
- Related notification: `application_rejected` title `Application Rejected`
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee rejected APP-CS-2026-001.

### Event — Application Withdrawn

- Raw event ID: `APPLICATION_WITHDRAWN`
- Store: `application_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Application Withdrawn
- Title shown to Issuer: Application Withdrawn — Your financing application was withdrawn and is no longer active.
- Title shown to Investor: Not shown on Investor Activity
- Description: Application withdrawn (issuer or related path).
- Who triggers it: Issuer / related withdraw path
- Important metadata: withdrawal fields as supplied
- Canonical evidence: `application_revisions` for submitted content (no duplicate required). This `application_logs` row is the trail.
- Where Ops sees it: Admin application timeline / Event details; facility activity where contract-scoped
- Export: Application timeline CSV uses Admin `getEventLabel`. Facility CSV uses `contract-activity-csv.ts` (some sentence-case). JSON: no. PDF: issuer-voice labels where listed. PDF: You withdrew this application
- Related notification: `application_withdrawn_confirmation` title `Application Withdrawn` when not an offer decline
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Nur Aisyah withdrew APP-CS-2026-001.

### Event — Application Completed

- Raw event ID: `APPLICATION_COMPLETED`
- Store: `application_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Application Completed
- Title shown to Issuer: Application Completed — Your financing application completed successfully.
- Title shown to Investor: Not shown on Investor Activity
- Description: Application reached completed status.
- Who triggers it: Application service on complete
- Important metadata: as supplied
- Canonical evidence: `application_revisions` for submitted content (no duplicate required). This `application_logs` row is the trail.
- Where Ops sees it: Admin application timeline / Event details; facility activity where contract-scoped
- Export: Application timeline CSV uses Admin `getEventLabel`. Facility CSV uses `contract-activity-csv.ts` (some sentence-case). JSON: no. PDF: issuer-voice labels where listed. PDF: Application completed
- Related notification: `application_completed` title `Application Completed`
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — APP-CS-2026-001 completed.

### Event — Application Returned to Review

- Raw event ID: `APPLICATION_RESET_TO_UNDER_REVIEW`
- Store: `application_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Application Returned to Review
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Returned to under review. Not in issuer Activity allowlist.
- Who triggers it: Admin
- Important metadata: as supplied
- Canonical evidence: `application_revisions` for submitted content (no duplicate required). This `application_logs` row is the trail.
- Where Ops sees it: Admin application timeline / Event details; facility activity where contract-scoped
- Export: Application timeline CSV uses Admin `getEventLabel`. Facility CSV uses `contract-activity-csv.ts` (some sentence-case). JSON: no. PDF: issuer-voice labels where listed. PDF: Back under review
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee returned APP-CS-2026-001 to review.

### Event — Section Approved

- Raw event ID: `SECTION_REVIEWED_APPROVED`
- Store: `application_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Section Approved
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: A review section was approved.
- Who triggers it: Admin reviewer
- Important metadata: `scope`, `scope_key`, `old_status`, `new_status` (review writer)
- Canonical evidence: `application_revisions` for submitted content (no duplicate required). This `application_logs` row is the trail.
- Where Ops sees it: Admin application timeline / Event details; facility activity where contract-scoped
- Export: Admin CSV Section Approved. Facility CSV: Section approved. Not on PDF as this ID.
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee approved a section on APP-CS-2026-001.

### Event — Section Rejected

- Raw event ID: `SECTION_REVIEWED_REJECTED`
- Store: `application_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Section Rejected
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: A review section was not approved.
- Who triggers it: Admin reviewer
- Important metadata: `scope`, `scope_key`, `old_status`, `new_status`
- Canonical evidence: `application_revisions` for submitted content (no duplicate required). This `application_logs` row is the trail.
- Where Ops sees it: Admin application timeline / Event details; facility activity where contract-scoped
- Export: Admin CSV Section Rejected. PDF: A section was not approved.
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee rejected a section on APP-CS-2026-001.

### Event — Section Amendment Requested

- Raw event ID: `SECTION_REVIEWED_AMENDMENT_REQUESTED`
- Store: `application_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Section Amendment Requested
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Amendment requested at section level.
- Who triggers it: Admin reviewer
- Important metadata: `scope`, `scope_key`, `old_status`, `new_status`
- Canonical evidence: `application_revisions` for submitted content (no duplicate required). This `application_logs` row is the trail.
- Where Ops sees it: Admin application timeline / Event details; facility activity where contract-scoped
- Export: PDF: Changes requested on a section
- Related notification: `acceptance_document_changes_requested` once per cycle for post-offer docs
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee requested a section amendment on APP-CS-2026-001.

### Event — Section Reset to Pending

- Raw event ID: `SECTION_REVIEWED_PENDING`
- Store: `application_logs`
- Status: `LIVE_UI / LIVE_SYSTEM`
- Title shown in Admin: Section Reset to Pending
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Section reset to pending, including CTOS financial reset.
- Who triggers it: Admin reviewer or CTOS (`ctos-report-service.ts`)
- Important metadata: `scope`, `scope_key`, `old_status`, `new_status` (CTOS uses financial / APPROVED→PENDING)
- Canonical evidence: `application_revisions` for submitted content (no duplicate required). This `application_logs` row is the trail.
- Where Ops sees it: Admin application timeline / Event details; facility activity where contract-scoped
- Export: Facility CSV: Section reset to pending
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Section on APP-CS-2026-001 reset to pending.

### Event — Approved

- Raw event ID: `ITEM_REVIEWED_APPROVED`
- Store: `application_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Approved
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: A review item was approved. Admin timeline label is Approved (item map).
- Who triggers it: Admin reviewer
- Important metadata: `scope`, `scope_key`, `old_status`, `new_status`
- Canonical evidence: `application_revisions` for submitted content (no duplicate required). This `application_logs` row is the trail.
- Where Ops sees it: Admin application timeline / Event details; facility activity where contract-scoped
- Export: Facility CSV: Item approved
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee approved an item on APP-CS-2026-001.

### Event — Rejected

- Raw event ID: `ITEM_REVIEWED_REJECTED`
- Store: `application_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Rejected
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: A review item was rejected. Admin timeline label is Rejected.
- Who triggers it: Admin reviewer
- Important metadata: `scope`, `scope_key`, `old_status`, `new_status`
- Canonical evidence: `application_revisions` for submitted content (no duplicate required). This `application_logs` row is the trail.
- Where Ops sees it: Admin application timeline / Event details; facility activity where contract-scoped
- Export: Facility CSV: Item Rejected. PDF: An item was not approved.
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee rejected an item on APP-CS-2026-001.

### Event — Amendment Requested

- Raw event ID: `ITEM_REVIEWED_AMENDMENT_REQUESTED`
- Store: `application_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Amendment Requested
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Amendment requested at item level.
- Who triggers it: Admin reviewer
- Important metadata: `scope`, `scope_key`, `old_status`, `new_status`
- Canonical evidence: `application_revisions` for submitted content (no duplicate required). This `application_logs` row is the trail.
- Where Ops sees it: Admin application timeline / Event details; facility activity where contract-scoped
- Export: Facility CSV: Item Amendment Requested. PDF: Changes requested on an item.
- Related notification: `acceptance_document_changes_requested` once per cycle for post-offer docs
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee requested an item amendment on APP-CS-2026-001.

### Event — Reset to Pending

- Raw event ID: `ITEM_REVIEWED_PENDING`
- Store: `application_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Reset to Pending
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Item reset via `ITEM_REVIEWED_${newStatus}` when newStatus is PENDING.
- Who triggers it: Admin reviewer
- Important metadata: `scope`, `scope_key`, `old_status`, `new_status`
- Canonical evidence: `application_revisions` for submitted content (no duplicate required). This `application_logs` row is the trail.
- Where Ops sees it: Admin application timeline / Event details; facility activity where contract-scoped
- Export: Facility CSV: Item reset to pending
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — An item on APP-CS-2026-001 was reset to pending.

## Notifications

### Notification — Amendment Requested

- Notification type ID: `application_amendments_requested`
- Catalogue name: Application Amendments Requested
- Exact title: Amendment Requested
- Purpose / description: Sent when reviewers submit amendment requests on your application.
- Trigger: Admin submit amendments (AMENDMENTS_SUBMITTED)
- Recipient: Issuer
- Portal: issuer
- Platform default: true
- Email default: true
- User configurable: true
- Related event/canonical evidence: application_logs.AMENDMENTS_SUBMITTED
- Exact message template (source): `An amendment is required for application ${getApplicationNotificationRef(data)}. Review the request and resubmit your application.`
- Example (fictional): Mock example — Title `Amendment Requested`. Mock context: ABC Trading Sdn Bhd — APP-CS-2026-001.

### Notification — Acceptance Documents Need Updates

- Notification type ID: `acceptance_document_changes_requested`
- Catalogue name: Acceptance Documents Need Updates
- Exact title: Acceptance Documents Need Updates
- Purpose / description: Sent once when a reviewer first requests acceptance-document changes after offer submission (further requests in the same cycle do not re-notify).
- Trigger: First post-offer item/section change request in a cycle
- Recipient: Issuer
- Portal: issuer
- Platform default: true
- Email default: true
- User configurable: true
- Related event/canonical evidence: ITEM_REVIEWED_AMENDMENT_REQUESTED / SECTION_REVIEWED_AMENDMENT_REQUESTED (once per cycle)
- Exact message template (source): `A reviewer requested updates to acceptance documents on application ${getApplicationNotificationRef(data)}. Open Review Offer to see which files to replace.`
- Example (fictional): Mock example — Title `Acceptance Documents Need Updates`. Mock context: APP-CS-2026-001.

### Notification — Application Rejected

- Notification type ID: `application_rejected`
- Catalogue name: Application Rejected
- Exact title: Application Rejected
- Purpose / description: Sent when your application is rejected.
- Trigger: Reject application
- Recipient: Issuer
- Portal: issuer
- Platform default: true
- Email default: true
- User configurable: true
- Related event/canonical evidence: APPLICATION_REJECTED
- Exact message template (source): `Your application ${getApplicationNotificationRef(data)} has been rejected.`
- Example (fictional): Mock example — Title `Application Rejected`. Mock context: APP-CS-2026-001.

### Notification — Application Resubmitted

- Notification type ID: `application_resubmitted_confirmation`
- Catalogue name: Application Resubmitted Confirmation
- Exact title: Application Resubmitted
- Purpose / description: Confirmation sent after you resubmit your application.
- Trigger: Issuer resubmit
- Recipient: Issuer
- Portal: issuer
- Platform default: true
- Email default: true
- User configurable: true
- Related event/canonical evidence: APPLICATION_RESUBMITTED
- Exact message template (source): `Your application ${getApplicationNotificationRef(data)} was successfully resubmitted for review (review cycle ${data.reviewCycle}).`
- Example (fictional): Mock example — Title `Application Resubmitted`. Mock context: APP-CS-2026-001.

### Notification — Application Withdrawn / Facility Offer Declined / Invoice Offer Declined

- Notification type ID: `application_withdrawn_confirmation`
- Catalogue name: Application Withdrawn Confirmation
- Exact title: `Application Withdrawn` (default) **or** `Facility Offer Declined` (`withdrawalReason=contract_offer_declined`) **or** `Invoice Offer Declined` (`withdrawalReason=invoice_offer_declined`)
- Purpose / description: One type, three titles. Confirmation after a true withdrawal, or after declining a facility/invoice offer (application also moves to WITHDRAWN).
- Trigger: Withdraw or offer decline
- Recipient: Issuer
- Portal: issuer
- Platform default: true
- Email default: true
- User configurable: true
- Related event/canonical evidence: APPLICATION_WITHDRAWN / CONTRACT_OFFER_DECLINED / INVOICE_OFFER_REJECTED
- Exact message template (source): If `contract_offer_declined`: title `Facility Offer Declined`; message `The facility offer on your application ${getApplicationNotificationRef(data)} was declined and the application is now closed.` If `invoice_offer_declined`: title `Invoice Offer Declined`; message `The invoice offer for invoice ${data.invoiceNumber} was declined.` (or application ref when no invoice number). Else title `Application Withdrawn`; message `Your application ${getApplicationNotificationRef(data)} has been withdrawn successfully.`
- Example (fictional): Mock example — Title `Application Withdrawn`. Mock context: APP-CS-2026-001. Alternate mock titles: `Facility Offer Declined` / `Invoice Offer Declined`.

### Notification — Application Completed

- Notification type ID: `application_completed`
- Catalogue name: Application Completed
- Exact title: Application Completed
- Purpose / description: Sent when your application reaches completed status.
- Trigger: Complete application
- Recipient: Issuer
- Portal: issuer
- Platform default: true
- Email default: true
- User configurable: true
- Related event/canonical evidence: APPLICATION_COMPLETED
- Exact message template (source): `Your application ${getApplicationNotificationRef(data)} has been completed successfully.`
- Example (fictional): Mock example — Title `Application Completed`. Mock context: APP-CS-2026-001.

### Notification — Application Submitted

- Notification type ID: `application_submitted_confirmation`
- Catalogue name: Application Submitted Confirmation
- Exact title: Application Submitted
- Purpose / description: Confirmation sent after you submit a new application for review.
- Trigger: First submit
- Recipient: Issuer
- Portal: issuer
- Platform default: true
- Email default: **false**
- User configurable: true
- Related event/canonical evidence: APPLICATION_SUBMITTED
- Exact message template (source): `Your application ${getApplicationNotificationRef(data)} has been submitted successfully and is now under review.`
- Example (fictional): Mock example — Title `Application Submitted`. Mock context: APP-CS-2026-001.

# 5. Facility / Contract

## Events

### Event — Facility Offer Sent

- Raw event ID: `CONTRACT_OFFER_SENT`
- Store: `application_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Facility Offer Sent
- Title shown to Issuer: You Received a Facility Offer — You received a facility offer. Review and respond.
- Title shown to Investor: Not shown on Investor Activity
- Description: CashSouk sent a facility offer.
- Who triggers it: Admin
- Important metadata: offer amount/expiry as supplied
- Canonical evidence: `application_revisions` for submitted content (no duplicate required). This `application_logs` row is the trail. Offer PDFs: signing_documents when generated.
- Where Ops sees it: Admin application timeline / Event details; facility activity where contract-scoped
- Export: Application timeline CSV uses Admin `getEventLabel`. Facility CSV uses `contract-activity-csv.ts` (some sentence-case). JSON: no. PDF: issuer-voice labels where listed. PDF: Facility financing offer sent
- Related notification: `contract_offer_sent` catalogue `Facility Offer Sent`, title `Facility Offer Received`
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee sent a facility offer on APP-CS-2026-001 (FAC-CS-2026-005).

### Event — Facility Offer Acceptance Submitted

- Raw event ID: `CONTRACT_OFFER_ACCEPTANCE_SUBMITTED`
- Store: `application_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Facility Offer Acceptance Submitted
- Title shown to Issuer: You Submitted Your Facility Offer Acceptance — You submitted offer acceptance documents for CashSouk review.
- Title shown to Investor: Not shown on Investor Activity
- Description: Issuer submitted Step 1 acceptance documents. Not signed.
- Who triggers it: Issuer
- Important metadata: `contract_id`, `submitted_at`, `offer_acceptance_status`
- Canonical evidence: `signing_documents` / `signing_assignments` / `signing_envelopes` (no duplicate required). This row is the trail.
- Where Ops sees it: Admin application timeline / Event details; facility activity where contract-scoped
- Export: Application timeline CSV uses Admin `getEventLabel`. Facility CSV uses `contract-activity-csv.ts` (some sentence-case). JSON: no. PDF: issuer-voice labels where listed.
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Nur Aisyah submitted facility offer acceptance documents for FAC-CS-2026-005.

### Event — Facility Offer Acceptance Resubmitted

- Raw event ID: `CONTRACT_OFFER_ACCEPTANCE_RESUBMITTED`
- Store: `application_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Facility Offer Acceptance Resubmitted
- Title shown to Issuer: You Resubmitted Your Facility Offer Acceptance — You resubmitted offer acceptance documents after CashSouk requested changes.
- Title shown to Investor: Not shown on Investor Activity
- Description: Issuer resubmitted acceptance documents after CHANGES_REQUESTED.
- Who triggers it: Issuer
- Important metadata: `contract_id`, `submitted_at`, `offer_acceptance_status`
- Canonical evidence: `signing_documents` / `signing_assignments` / `signing_envelopes` (no duplicate required). This row is the trail.
- Where Ops sees it: Admin application timeline / Event details; facility activity where contract-scoped
- Export: Application timeline CSV uses Admin `getEventLabel`. Facility CSV uses `contract-activity-csv.ts` (some sentence-case). JSON: no. PDF: issuer-voice labels where listed.
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Nur Aisyah resubmitted facility offer acceptance documents for FAC-CS-2026-005.

### Event — Facility Acceptance Approved for Signing

- Raw event ID: `CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING`
- Store: `application_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Facility Acceptance Approved for Signing
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Admin approved acceptance docs; signing package unlocked. Not in issuer getEventTypes().
- Who triggers it: Admin
- Important metadata: contract ids as supplied
- Canonical evidence: `signing_documents` / `signing_assignments` / `signing_envelopes` (no duplicate required). This row is the trail.
- Where Ops sees it: Admin application timeline / Event details; facility activity where contract-scoped
- Export: Admin: Facility Acceptance Approved for Signing. Facility CSV: Facility acceptance approved for signing.
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee approved facility acceptance for signing on FAC-CS-2026-005.

### Event — Facility Offer Accepted

- Raw event ID: `CONTRACT_OFFER_ACCEPTED`
- Store: `application_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Facility Offer Accepted
- Title shown to Issuer: Facility Offer Accepted — The facility offer was accepted.
- Title shown to Investor: Not shown on Investor Activity
- Description: Facility offer accepted. NOT signed. Signing is SIGNING_PACKAGE_COMPLETED.
- Who triggers it: Issuer accept action
- Important metadata: as supplied
- Canonical evidence: `signing_documents` / `signing_assignments` / `signing_envelopes` (no duplicate required). This row is the trail.
- Where Ops sees it: Admin application timeline / Event details; facility activity where contract-scoped
- Export: Application timeline CSV uses Admin `getEventLabel`. Facility CSV uses `contract-activity-csv.ts` (some sentence-case). JSON: no. PDF: issuer-voice labels where listed. PDF: You accepted the facility offer
- Related notification: none (fee payment is a separate notification when due)
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Nur Aisyah accepted the facility offer for FAC-CS-2026-005 (accepted, not signed).

### Event — Facility Offer Declined

- Raw event ID: `CONTRACT_OFFER_DECLINED`
- Store: `application_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Facility Offer Declined
- Title shown to Issuer: Facility Offer Declined — The facility offer was declined and this application is now closed.
- Title shown to Investor: Not shown on Investor Activity
- Description: Live issuer decline writer. Distinct from historical CONTRACT_OFFER_REJECTED.
- Who triggers it: Issuer decline
- Important metadata: as supplied
- Canonical evidence: `application_revisions` for submitted content (no duplicate required). This `application_logs` row is the trail.
- Where Ops sees it: Admin application timeline / Event details; facility activity where contract-scoped
- Export: Application timeline CSV uses Admin `getEventLabel`. Facility CSV uses `contract-activity-csv.ts` (some sentence-case). JSON: no. PDF: issuer-voice labels where listed. PDF: Facility offer declined
- Related notification: `application_withdrawn_confirmation` title `Facility Offer Declined` when withdrawalReason is contract_offer_declined
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Nur Aisyah declined the facility offer on APP-CS-2026-001.

### Event — Facility Offer Retracted

- Raw event ID: `CONTRACT_OFFER_RETRACTED`
- Store: `application_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Facility Offer Retracted
- Title shown to Issuer: CashSouk Retracted the Facility Offer — CashSouk retracted the facility offer on your application before it was accepted.
- Title shown to Investor: Not shown on Investor Activity
- Description: CashSouk retracted the facility offer.
- Who triggers it: Admin
- Important metadata: as supplied
- Canonical evidence: `application_revisions` for submitted content (no duplicate required). This `application_logs` row is the trail.
- Where Ops sees it: Admin application timeline / Event details; facility activity where contract-scoped
- Export: Application timeline CSV uses Admin `getEventLabel`. Facility CSV uses `contract-activity-csv.ts` (some sentence-case). JSON: no. PDF: issuer-voice labels where listed. PDF: Facility offer was withdrawn by CashSouk
- Related notification: `offer_retracted_or_reset` title `Offer Updated`
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee retracted the facility offer on APP-CS-2026-001.

### Event — Facility Offer Expired

- Raw event ID: `CONTRACT_OFFER_EXPIRED`
- Store: `application_logs`
- Status: `LIVE_SYSTEM`
- Title shown in Admin: Facility Offer Expired
- Title shown to Issuer: Facility Offer Expired — The facility offer expired. A new offer can be sent from the Facility tab.
- Title shown to Investor: Not shown on Investor Activity
- Description: Expiry job after acceptance/signing deadline.
- Who triggers it: SYSTEM_JOB
- Important metadata: as supplied
- Canonical evidence: `application_revisions` for submitted content (no duplicate required). This `application_logs` row is the trail.
- Where Ops sees it: Admin application timeline / Event details; facility activity where contract-scoped
- Export: Admin: Facility Offer Expired. Facility CSV: Facility offer expired. PDF uses key OFFER_EXPIRED: An offer expired.
- Related notification: `offer_expired` title `Offer Expired`
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Facility offer on APP-CS-2026-001 expired.

### Event — Signing Deadline Extended

- Raw event ID: `CONTRACT_SIGNING_DEADLINE_EXTENDED`
- Store: `application_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Signing Deadline Extended
- Title shown to Issuer: Signing Deadline Extended — CashSouk extended the signing deadline so you can complete the signing package.
- Title shown to Investor: Not shown on Investor Activity
- Description: Admin restamped signing_expires_at.
- Who triggers it: Admin
- Important metadata: deadline as supplied
- Canonical evidence: `signing_documents` / `signing_assignments` / `signing_envelopes` (no duplicate required). This row is the trail.
- Where Ops sees it: Admin application timeline / Event details; facility activity where contract-scoped
- Export: Facility CSV: Signing deadline extended
- Related notification: `contract_signing_deadline_extended` title `Signing Deadline Extended`
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee extended the signing deadline on APP-CS-2026-001.

### Event — Facility Occupancy Updated

- Raw event ID: `CONTRACT_FACILITY_OCCUPANCY_UPDATED`
- Store: `application_logs`
- Status: `LIVE_SYSTEM`
- Title shown in Admin: Facility Occupancy Updated
- Title shown to Issuer: Facility occupancy updated — Live facility occupancy changed after a draw, funding close, or repayment.
- Title shown to Investor: Not shown on Investor Activity
- Description: Revolving occupancy changed. Display references are snapshotted from already-loaded contract/invoice/note rows (no extra lookup).
- Who triggers it: System / occupancy refresh
- Important metadata: occupancy `before`/`after`, `applicationReference` / `contractReference` / `invoiceReference` / `noteReference` when in scope
- Canonical evidence: this row plus facility records
- Where Ops sees it: Admin application timeline / Event details; facility activity where contract-scoped
- Export: Facility CSV: Facility occupancy updated
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Occupancy updated on FAC-CS-2026-005.

### Event — Facility Fee Waived

- Raw event ID: `CONTRACT_FACILITY_FEE_WAIVED`
- Store: `application_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Facility Fee Waived
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Facility fee waived.
- Who triggers it: Admin
- Important metadata: as supplied
- Canonical evidence: this row / contract fee fields
- Where Ops sees it: Admin application timeline / Event details; facility activity where contract-scoped
- Export: Application timeline CSV uses Admin `getEventLabel`. Facility CSV uses `contract-activity-csv.ts` (some sentence-case). JSON: no. PDF: issuer-voice labels where listed.
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee waived the facility fee on FAC-CS-2026-005.

### Event — Facility Disabled

- Raw event ID: `CONTRACT_FACILITY_DISABLED`
- Store: `application_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Facility Disabled
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Admin disabled a facility, blocking new drawdowns.
- Who triggers it: Admin
- Important metadata: as supplied
- Canonical evidence: this row / contract status
- Where Ops sees it: Admin application timeline / Event details; facility activity where contract-scoped
- Export: Application timeline CSV uses Admin `getEventLabel`. Facility CSV uses `contract-activity-csv.ts` (some sentence-case). JSON: no. PDF: issuer-voice labels where listed.
- Related notification: `facility_disabled` title `Facility Disabled`
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee disabled FAC-CS-2026-005.

### Event — Facility Enabled

- Raw event ID: `CONTRACT_FACILITY_ENABLED`
- Store: `application_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Facility Enabled
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Admin enabled a facility.
- Who triggers it: Admin
- Important metadata: as supplied
- Canonical evidence: this row / contract status
- Where Ops sees it: Admin application timeline / Event details; facility activity where contract-scoped
- Export: Application timeline CSV uses Admin `getEventLabel`. Facility CSV uses `contract-activity-csv.ts` (some sentence-case). JSON: no. PDF: issuer-voice labels where listed.
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee enabled FAC-CS-2026-005.

### Event — Contract Customer Large Private Updated

- Raw event ID: `CONTRACT_CUSTOMER_LARGE_PRIVATE_UPDATED`
- Store: `application_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Contract Customer Large Private Updated (humanize — not in Admin getEventLabel map)
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Admin saved customer_details.is_large_private_company. Live writer in admin/service.ts; UI contract-section.tsx. Not in ApplicationLogEventType enum. Source count includes this ID (master table omitted it).
- Who triggers it: Admin
- Important metadata: `is_large_private_company`
- Canonical evidence: contract.customer_details (canonical). This row is the trail.
- Where Ops sees it: Admin application timeline if returned by query
- Export: CSV humanize if exported
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee updated large-private-company confirmation on FAC-CS-2026-005.

## Notifications

### Notification — Facility Offer Received

- Notification type ID: `contract_offer_sent`
- Catalogue name: Facility Offer Sent
- Exact title: Facility Offer Received
- Purpose / description: Sent when a facility offer is sent to your application.
- Trigger: Send facility offer
- Recipient: Issuer
- Portal: issuer
- Platform default: true
- Email default: true
- User configurable: true
- Related event/canonical evidence: CONTRACT_OFFER_SENT
- Exact message template (source): `A facility offer of ${data.offeredFacility.toLocaleString()} has been sent to your application ${getApplicationNotificationRef(data)}.${data.expiresAt ? ` It expires on ${formatPhaseDeadlineDateDDMMYYYY(data.expiresAt)}.` : ""}`
- Example (fictional): Mock example — Title `Facility Offer Received`. Mock context: APP-CS-2026-001, RM100,000.00.

### Notification — Offer Updated

- Notification type ID: `offer_retracted_or_reset`
- Catalogue name: Offer Retracted or Reset
- Exact title: Offer Updated
- Purpose / description: Sent when a previously sent offer is retracted or reset by reviewer action.
- Trigger: Retract/reset facility or invoice offer
- Recipient: Issuer
- Portal: issuer
- Platform default: true
- Email default: true
- User configurable: true
- Related event/canonical evidence: CONTRACT_OFFER_RETRACTED / INVOICE_OFFER_RETRACTED
- Exact message template (source): `${data.offerType === "contract" ? "Facility" : "Invoice"} offer${data.invoiceNumber ? ` (${data.invoiceNumber})` : ""} was retracted or reset and is no longer active.`
- Example (fictional): Mock example — Title `Offer Updated`. Mock context: APP-CS-2026-001.

### Notification — Offer Expired

- Notification type ID: `offer_expired`
- Catalogue name: Offer Expired
- Exact title: Offer Expired
- Purpose / description: Sent when a facility or invoice offer expires.
- Trigger: Expiry job
- Recipient: Issuer
- Portal: issuer
- Platform default: true
- Email default: true
- User configurable: true
- Related event/canonical evidence: CONTRACT_OFFER_EXPIRED / INVOICE_OFFER_EXPIRED
- Exact message template (source): `${data.offerType === "contract" ? "Facility" : "Invoice"} offer${data.invoiceNumber ? ` (${data.invoiceNumber})` : ""} has expired.`
- Example (fictional): Mock example — Title `Offer Expired`. Mock context: APP-CS-2026-001.

### Notification — Offer Expiring Soon

- Notification type ID: `offer_expiry_reminder_24h`
- Catalogue name: Offer Expiry Reminder
- Exact title: Offer Expiring Soon
- Purpose / description: Reminder sent before an acceptance or signing deadline (days_before_expiry from product config).
- Trigger: Reminder job (no dedicated audit event)
- Recipient: Issuer
- Portal: issuer
- Platform default: true
- Email default: true
- User configurable: true
- Related event/canonical evidence: none (clock) — not a duplicate audit row
- Exact message template (source): `${Facility|Invoice} offer expires ${today|in 1 day|in N days|soon} on ${formatPhaseDeadlineDateDDMMYYYY(data.expiresAt)}.`
- Example (fictional): Mock example — Title `Offer Expiring Soon`. Mock context: APP-CS-2026-001.

### Notification — Signing Deadline Extended

- Notification type ID: `contract_signing_deadline_extended`
- Catalogue name: Facility Signing Deadline Extended
- Exact title: Signing Deadline Extended
- Purpose / description: Sent when the signing deadline for a facility offer is extended.
- Trigger: Admin extend
- Recipient: Issuer
- Portal: issuer
- Platform default: true
- Email default: true
- User configurable: true
- Related event/canonical evidence: CONTRACT_SIGNING_DEADLINE_EXTENDED
- Exact message template (source): `The signing deadline for application ${getApplicationNotificationRef(data)} has been extended${data.deadline ? ` to ${formatPhaseDeadlineDateDDMMYYYY(data.deadline)}` : ""}.`
- Example (fictional): Mock example — Title `Signing Deadline Extended`. Mock context: APP-CS-2026-001.

### Notification — Facility Disabled

- Notification type ID: `facility_disabled`
- Catalogue name: Facility Disabled
- Exact title: Facility Disabled
- Purpose / description: Sent when an admin disables a facility, blocking new drawdowns.
- Trigger: Admin disable
- Recipient: Issuer
- Portal: issuer
- Platform default: true
- Email default: true
- User configurable: true
- Related event/canonical evidence: CONTRACT_FACILITY_DISABLED
- Exact message template (source): `Your facility for application ${getApplicationNotificationRef(data)} has been disabled. New drawdowns are currently unavailable.`
- Example (fictional): Mock example — Title `Facility Disabled`. Mock context: FAC-CS-2026-005.

### Notification — Upfront facility fee payment required

- Notification type ID: `facility_fee_payment_requested`
- Catalogue name: Upfront facility fee payment required
- Exact title: Upfront facility fee payment required
- Purpose / description: Sent after you accept a facility offer that requires an upfront facility fee gateway payment.
- Trigger: After accept when fee due
- Recipient: Issuer
- Portal: issuer
- Platform default: true
- Email default: true
- User configurable: true
- Related event/canonical evidence: gateway_payments purpose FACILITY_FEE (no duplicate audit ID required)
- Exact message template (source): `An upfront facility fee of RM${data.upfrontAmount.toLocaleString()} is due on your financing contract. Pay it before starting invoice financing.`
- Example (fictional): Mock example — Title `Upfront facility fee payment required`. Mock context: FAC-CS-2026-005, RM10,000.00.

### Notification — Upfront facility fee paid

- Notification type ID: `facility_fee_upfront_paid`
- Catalogue name: Upfront facility fee paid
- Exact title: Upfront facility fee paid
- Purpose / description: Sent once when the upfront facility fee on a facility has been paid in full.
- Trigger: Fee paid in full
- Recipient: Issuer
- Portal: issuer
- Platform default: true
- Email default: true
- User configurable: true
- Related event/canonical evidence: gateway_payments
- Exact message template (source): `The upfront facility fee of RM${data.upfrontAmount.toLocaleString()} has been received. You can now use this facility for invoice financing.`
- Example (fictional): Mock example — Title `Upfront facility fee paid`. Mock context: FAC-CS-2026-005, RM10,000.00.

# 6. Invoice Offer

## Events

### Event — Invoice Offer Sent

- Raw event ID: `INVOICE_OFFER_SENT`
- Store: `application_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Invoice Offer Sent, or `Invoice {n} Offer Sent` when metadata.invoice_number is set
- Title shown to Issuer: You Received an Invoice Offer — You received an invoice offer. Review and respond.
- Title shown to Investor: Not shown on Investor Activity
- Description: CashSouk sent an invoice offer.
- Who triggers it: Admin
- Important metadata: `invoice_number` when present
- Canonical evidence: `application_revisions` for submitted content (no duplicate required). This `application_logs` row is the trail.
- Where Ops sees it: Admin application timeline / Event details; facility activity where contract-scoped
- Export: Application timeline CSV uses Admin `getEventLabel`. Facility CSV uses `contract-activity-csv.ts` (some sentence-case). JSON: no. PDF: issuer-voice labels where listed. PDF: Invoice financing offer sent
- Related notification: `invoice_offer_sent` title `Invoice Offer Received`
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee sent an invoice offer for INV-2026-0042 on APP-CS-2026-001.

### Event — Invoice Offer Acceptance Submitted

- Raw event ID: `INVOICE_OFFER_ACCEPTANCE_SUBMITTED`
- Store: `application_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Invoice Offer Acceptance Submitted, or `Invoice {n} Acceptance Submitted`
- Title shown to Issuer: You Submitted Your Invoice Offer Acceptance — You submitted offer acceptance documents for CashSouk review.
- Title shown to Investor: Not shown on Investor Activity
- Description: Issuer submitted Step 1 invoice acceptance documents.
- Who triggers it: Issuer
- Important metadata: `invoice_id`, `submitted_at`, `offer_acceptance_status`, `invoice_number`
- Canonical evidence: `signing_documents` / `signing_assignments` / `signing_envelopes` (no duplicate required). This row is the trail.
- Where Ops sees it: Admin application timeline / Event details; facility activity where contract-scoped
- Export: Application timeline CSV uses Admin `getEventLabel`. Facility CSV uses `contract-activity-csv.ts` (some sentence-case). JSON: no. PDF: issuer-voice labels where listed.
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Nur Aisyah submitted invoice offer acceptance for INV-2026-0042.

### Event — Invoice Offer Acceptance Resubmitted

- Raw event ID: `INVOICE_OFFER_ACCEPTANCE_RESUBMITTED`
- Store: `application_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Invoice Offer Acceptance Resubmitted
- Title shown to Issuer: You Resubmitted Your Invoice Offer Acceptance — You resubmitted offer acceptance documents after CashSouk requested changes.
- Title shown to Investor: Not shown on Investor Activity
- Description: Issuer resubmitted invoice acceptance documents.
- Who triggers it: Issuer
- Important metadata: `invoice_id`, `submitted_at`, `offer_acceptance_status`
- Canonical evidence: `signing_documents` / `signing_assignments` / `signing_envelopes` (no duplicate required). This row is the trail.
- Where Ops sees it: Admin application timeline / Event details; facility activity where contract-scoped
- Export: Application timeline CSV uses Admin `getEventLabel`. Facility CSV uses `contract-activity-csv.ts` (some sentence-case). JSON: no. PDF: issuer-voice labels where listed.
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Nur Aisyah resubmitted invoice offer acceptance for INV-2026-0042.

### Event — Invoice Acceptance Approved for Signing

- Raw event ID: `INVOICE_ACCEPTANCE_APPROVED_FOR_SIGNING`
- Store: `application_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Invoice Acceptance Approved for Signing
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Admin approved invoice acceptance docs; signing unlocked. Not in issuer getEventTypes().
- Who triggers it: Admin
- Important metadata: invoice ids as supplied
- Canonical evidence: `signing_documents` / `signing_assignments` / `signing_envelopes` (no duplicate required). This row is the trail.
- Where Ops sees it: Admin application timeline / Event details; facility activity where contract-scoped
- Export: Application timeline CSV uses Admin `getEventLabel`. Facility CSV uses `contract-activity-csv.ts` (some sentence-case). JSON: no. PDF: issuer-voice labels where listed.
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee approved invoice acceptance for signing on INV-2026-0042.

### Event — Invoice Offer Accepted

- Raw event ID: `INVOICE_OFFER_ACCEPTED`
- Store: `application_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Invoice Offer Accepted, or `Invoice {n} Offer Accepted`
- Title shown to Issuer: Invoice Offer Accepted — The invoice offer was accepted.
- Title shown to Investor: Not shown on Investor Activity
- Description: Invoice offer accepted. Not the signing completion event.
- Who triggers it: Issuer accept
- Important metadata: `invoice_number` when present
- Canonical evidence: `signing_documents` / `signing_assignments` / `signing_envelopes` (no duplicate required). This row is the trail.
- Where Ops sees it: Admin application timeline / Event details; facility activity where contract-scoped
- Export: Application timeline CSV uses Admin `getEventLabel`. Facility CSV uses `contract-activity-csv.ts` (some sentence-case). JSON: no. PDF: issuer-voice labels where listed. PDF: You accepted an invoice offer
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Nur Aisyah accepted the invoice offer for INV-2026-0042.

### Event — Invoice Offer Declined

- Raw event ID: `INVOICE_OFFER_REJECTED`
- Store: `application_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Invoice Offer Declined
- Title shown to Issuer: Invoice Offer Declined — The invoice offer was declined and this application has stopped moving forward.
- Title shown to Investor: Not shown on Investor Activity
- Description: Live decline writer. There is no INVOICE_OFFER_DECLINED raw ID.
- Who triggers it: Issuer decline (`action !== accept` → INVOICE_OFFER_REJECTED)
- Important metadata: as supplied
- Canonical evidence: `application_revisions` for submitted content (no duplicate required). This `application_logs` row is the trail.
- Where Ops sees it: Admin application timeline / Event details; facility activity where contract-scoped
- Export: Application timeline CSV uses Admin `getEventLabel`. Facility CSV uses `contract-activity-csv.ts` (some sentence-case). JSON: no. PDF: issuer-voice labels where listed. PDF: You declined an invoice offer
- Related notification: `application_withdrawn_confirmation` title `Invoice Offer Declined` when withdrawalReason is invoice_offer_declined
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Nur Aisyah declined the invoice offer for INV-2026-0042 (raw ID INVOICE_OFFER_REJECTED).

### Event — Invoice Offer Retracted

- Raw event ID: `INVOICE_OFFER_RETRACTED`
- Store: `application_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Invoice Offer Retracted
- Title shown to Issuer: CashSouk Retracted the Invoice Offer — CashSouk retracted the invoice offer for your invoice before it was accepted.
- Title shown to Investor: Not shown on Investor Activity
- Description: CashSouk retracted the invoice offer.
- Who triggers it: Admin
- Important metadata: as supplied
- Canonical evidence: `application_revisions` for submitted content (no duplicate required). This `application_logs` row is the trail.
- Where Ops sees it: Admin application timeline / Event details; facility activity where contract-scoped
- Export: Application timeline CSV uses Admin `getEventLabel`. Facility CSV uses `contract-activity-csv.ts` (some sentence-case). JSON: no. PDF: issuer-voice labels where listed. PDF: Invoice offer was withdrawn by CashSouk
- Related notification: `offer_retracted_or_reset` title `Offer Updated`
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee retracted the invoice offer for INV-2026-0042.

### Event — Invoice Offer Expired

- Raw event ID: `INVOICE_OFFER_EXPIRED`
- Store: `application_logs`
- Status: `LIVE_SYSTEM`
- Title shown in Admin: Invoice Offer Expired, or `Invoice {n} Offer Expired`
- Title shown to Issuer: Invoice Offer Expired — The invoice offer expired. A new offer can be sent from the Invoice tab.
- Title shown to Investor: Not shown on Investor Activity
- Description: Expiry job.
- Who triggers it: SYSTEM_JOB
- Important metadata: `invoice_number` when present
- Canonical evidence: `application_revisions` for submitted content (no duplicate required). This `application_logs` row is the trail.
- Where Ops sees it: Admin application timeline / Event details; facility activity where contract-scoped
- Export: Application timeline CSV uses Admin `getEventLabel`. Facility CSV uses `contract-activity-csv.ts` (some sentence-case). JSON: no. PDF: issuer-voice labels where listed.
- Related notification: `offer_expired`
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Invoice offer for INV-2026-0042 expired.

### Event — Signing Deadline Extended

- Raw event ID: `INVOICE_SIGNING_DEADLINE_EXTENDED`
- Store: `application_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Signing Deadline Extended
- Title shown to Issuer: Signing Deadline Extended — CashSouk extended the signing deadline so you can complete the signing package.
- Title shown to Investor: Not shown on Investor Activity
- Description: Admin restamped invoice signing deadline.
- Who triggers it: Admin
- Important metadata: deadline as supplied
- Canonical evidence: `signing_documents` / `signing_assignments` / `signing_envelopes` (no duplicate required). This row is the trail.
- Where Ops sees it: Admin application timeline / Event details; facility activity where contract-scoped
- Export: Application timeline CSV uses Admin `getEventLabel`. Facility CSV uses `contract-activity-csv.ts` (some sentence-case). JSON: no. PDF: issuer-voice labels where listed.
- Related notification: `invoice_signing_deadline_extended` title `Signing Deadline Extended`
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee extended the signing deadline for INV-2026-0042.

### Event — Invoice Withdrawn

- Raw event ID: `INVOICE_WITHDRAWN`
- Store: `application_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Invoice Withdrawn, or `Invoice {n} Withdrawn`
- Title shown to Issuer: Invoice Withdrawn — An invoice linked to this application was withdrawn.
- Title shown to Investor: Not shown on Investor Activity
- Description: Invoice withdrawn.
- Who triggers it: Issuer/admin withdraw path
- Important metadata: `invoice_number` when present
- Canonical evidence: `application_revisions` for submitted content (no duplicate required). This `application_logs` row is the trail.
- Where Ops sees it: Admin application timeline / Event details; facility activity where contract-scoped
- Export: Application timeline CSV uses Admin `getEventLabel`. Facility CSV uses `contract-activity-csv.ts` (some sentence-case). JSON: no. PDF: issuer-voice labels where listed. PDF: Invoice withdrawn
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Invoice INV-2026-0042 was withdrawn.

## Notifications

### Notification — Invoice Offer Received

- Notification type ID: `invoice_offer_sent`
- Catalogue name: Invoice Offer Sent
- Exact title: Invoice Offer Received
- Purpose / description: Sent when an invoice offer is sent to your application.
- Trigger: Send invoice offer
- Recipient: Issuer
- Portal: issuer
- Platform default: true
- Email default: true
- User configurable: true
- Related event/canonical evidence: INVOICE_OFFER_SENT
- Exact message template (source): `An invoice offer${data.invoiceNumber ? ` for invoice ${data.invoiceNumber}` : ""} of RM${data.offeredAmount.toLocaleString()} has been sent.${data.expiresAt ? ` It expires on ${formatPhaseDeadlineDateDDMMYYYY(data.expiresAt)}.` : ""}`
- Example (fictional): Mock example — Title `Invoice Offer Received`. Mock context: INV-2026-0042, RM50,000.00.

### Notification — Signing Deadline Extended

- Notification type ID: `invoice_signing_deadline_extended`
- Catalogue name: Invoice Signing Deadline Extended
- Exact title: Signing Deadline Extended
- Purpose / description: Sent when the signing deadline for an invoice offer is extended.
- Trigger: Admin extend
- Recipient: Issuer
- Portal: issuer
- Platform default: true
- Email default: true
- User configurable: true
- Related event/canonical evidence: INVOICE_SIGNING_DEADLINE_EXTENDED
- Exact message template (source): `The signing deadline for invoice ${data.invoiceNumber ?? getApplicationNotificationRef(data)} has been extended${data.deadline ? ` to ${formatPhaseDeadlineDateDDMMYYYY(data.deadline)}` : ""}.`
- Example (fictional): Mock example — Title `Signing Deadline Extended`. Mock context: INV-2026-0042.

# 7. Signing

## Events

### Event — Signing Package Created

- Raw event ID: `SIGNING_PACKAGE_CREATED`
- Store: `application_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Signing Package Created
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Signing package created. Not in issuer getEventTypes().
- Who triggers it: Admin/signing service
- Important metadata: envelope ids as supplied
- Canonical evidence: `signing_documents` / `signing_assignments` / `signing_envelopes` (no duplicate required). This row is the trail.
- Where Ops sees it: Admin application timeline
- Export: Application timeline CSV uses Admin `getEventLabel`. Facility CSV uses `contract-activity-csv.ts` (some sentence-case). JSON: no. PDF: issuer-voice labels where listed.
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Signing package created for APP-CS-2026-001.

### Event — Signing package sent

- Raw event ID: `SIGNING_PACKAGE_SENT`
- Store: `application_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Signing package sent
- Title shown to Issuer: Signing package sent — The signing package was sent to all required signers.
- Title shown to Investor: Not shown on Investor Activity
- Description: Package sent to signers.
- Who triggers it: Admin/signing service
- Important metadata: envelope/recipient fields as supplied
- Canonical evidence: `signing_documents` / `signing_assignments` / `signing_envelopes` (no duplicate required). This row is the trail.
- Where Ops sees it: Admin application timeline / Event details; facility activity where contract-scoped
- Export: Application timeline CSV uses Admin `getEventLabel`. Facility CSV uses `contract-activity-csv.ts` (some sentence-case). JSON: no. PDF: issuer-voice labels where listed.
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Signing package sent for APP-CS-2026-001.

### Event — Signing Package Completed

- Raw event ID: `SIGNING_PACKAGE_COMPLETED`
- Store: `application_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Signing Package Completed
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Envelope rollup COMPLETED — actual signing completion. Distinct from CONTRACT_OFFER_ACCEPTED. Issuer adapter has title `Signing package completed` but ID is not in getEventTypes(), so Issuer Activity does not list it. Facility CSV: Signing package completed.
- Who triggers it: SigningCloud envelope completed (signing service)
- Important metadata: envelope completion fields as supplied
- Canonical evidence: `signing_documents` / `signing_assignments` / `signing_envelopes` (no duplicate required). This row is the trail. signed_s3_key / signed_file_sha256 / signed_at. No signer IP in schema.
- Where Ops sees it: Admin application timeline / Event details
- Export: Admin CSV Signing Package Completed. Facility CSV Signing package completed.
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Signing package completed for APP-CS-2026-001 (actual signing event).

### Event — Signing package voided

- Raw event ID: `SIGNING_PACKAGE_VOIDED`
- Store: `application_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Signing package voided
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Signing package voided. Not in issuer getEventTypes().
- Who triggers it: Admin/signing service
- Important metadata: as supplied
- Canonical evidence: `signing_documents` / `signing_assignments` / `signing_envelopes` (no duplicate required). This row is the trail.
- Where Ops sees it: Admin application timeline
- Export: Application timeline CSV uses Admin `getEventLabel`. Facility CSV uses `contract-activity-csv.ts` (some sentence-case). JSON: no. PDF: issuer-voice labels where listed.
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Signing package voided for APP-CS-2026-001.

## Notifications

No live notification types are owned by this module.

# 8. Notes

## Events

### Event — Note created

- Raw event ID: `NOTE_CREATED_FROM_INVOICE`
- Store: `note_events`
- Status: `LIVE_UI`
- Title shown in Admin: Note created
- Title shown to Issuer: Note Created — A new note was created from an approved invoice and can now be prepared for listing.
- Title shown to Investor: Not shown on Investor Activity
- Description: Note spawned from an approved invoice.
- Who triggers it: System/issuer path on invoice approval
- Important metadata: invoice snapshot fields as supplied
- Canonical evidence: this note_events row
- Where Ops sees it: Admin note Activity / Event details (CSV export). Portal Activity only if listed below.
- Export: Note Activity CSV Event uses formatNoteActivityEventLabel; Event Type is the raw ID.
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — NOTE-CS-2026-018 was created from INV-2026-0042.

### Event — Draft updated

- Raw event ID: `UPDATE_DRAFT`
- Store: `note_events`
- Status: `LIVE_UI`
- Title shown in Admin: Draft updated
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Admin updated the note draft. Also mirrored to note_admin_actions.
- Who triggers it: Admin
- Important metadata: `beforeState`, `afterState` (and admin-action changedFields)
- Canonical evidence: this note_events row
- Where Ops sees it: Admin note Activity / Event details (CSV export). Portal Activity only if listed below.
- Export: Note Activity CSV Event uses formatNoteActivityEventLabel; Event Type is the raw ID.
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee updated the draft for NOTE-CS-2026-018.

### Event — Featured settings updated

- Raw event ID: `UPDATE_FEATURED_SETTINGS`
- Store: `note_events`
- Status: `LIVE_UI`
- Title shown in Admin: Featured settings updated
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Admin updated featured settings.
- Who triggers it: Admin
- Important metadata: `beforeState`, `afterState`
- Canonical evidence: this note_events row
- Where Ops sees it: Admin note Activity / Event details (CSV export). Portal Activity only if listed below.
- Export: Note Activity CSV Event uses formatNoteActivityEventLabel; Event Type is the raw ID.
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee updated featured settings for NOTE-CS-2026-018.

### Event — Unpublished from marketplace

- Raw event ID: `UNPUBLISH`
- Store: `note_events`
- Status: `LIVE_UI`
- Title shown in Admin: Unpublished from marketplace
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Note unpublished from the marketplace. Live writer ID is UNPUBLISH (not NOTE_UNPUBLISHED).
- Who triggers it: Admin
- Important metadata: `beforeState`, `afterState`
- Canonical evidence: this note_events row
- Where Ops sees it: Admin note Activity / Event details (CSV export). Portal Activity only if listed below.
- Export: Note Activity CSV Event uses formatNoteActivityEventLabel; Event Type is the raw ID.
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee unpublished NOTE-CS-2026-018.

### Event — Campaign paused

- Raw event ID: `PAUSE_LISTING`
- Store: `note_events`
- Status: `LIVE_UI`
- Title shown in Admin: Campaign paused
- Title shown to Issuer: Campaign Paused — The campaign was temporarily closed to new investment. Existing commitments are held.
- Title shown to Investor: Not shown on Investor Activity
- Description: Listing paused.
- Who triggers it: Admin
- Important metadata: `beforeState`, `afterState`
- Canonical evidence: this note_events row
- Where Ops sees it: Admin note Activity / Event details (CSV export). Portal Activity only if listed below.
- Export: Note Activity CSV Event uses formatNoteActivityEventLabel; Event Type is the raw ID.
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee paused the campaign for NOTE-CS-2026-018.

### Event — Campaign resumed

- Raw event ID: `RESUME_LISTING`
- Store: `note_events`
- Status: `LIVE_UI`
- Title shown in Admin: Campaign resumed
- Title shown to Issuer: Campaign Resumed — The campaign is open for investment again.
- Title shown to Investor: Not shown on Investor Activity
- Description: Listing resumed.
- Who triggers it: Admin
- Important metadata: `beforeState`, `afterState`
- Canonical evidence: this note_events row
- Where Ops sees it: Admin note Activity / Event details (CSV export). Portal Activity only if listed below.
- Export: Note Activity CSV Event uses formatNoteActivityEventLabel; Event Type is the raw ID.
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee resumed the campaign for NOTE-CS-2026-018.

### Event — Prospectus review created

- Raw event ID: `PROSPECTUS_REVIEW_CREATE`
- Store: `note_events`
- Status: `LIVE_UI`
- Title shown in Admin: Prospectus review created
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Prospectus review created.
- Who triggers it: Admin
- Important metadata: `beforeState`, `afterState`; target note prospectus
- Canonical evidence: this note_events row
- Where Ops sees it: Admin note Activity / Event details (CSV export). Portal Activity only if listed below.
- Export: Note Activity CSV Event uses formatNoteActivityEventLabel; Event Type is the raw ID.
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Prospectus review created for NOTE-CS-2026-018.

### Event — Prospectus draft updated

- Raw event ID: `PROSPECTUS_REVIEW_DRAFT_UPDATE`
- Store: `note_events`
- Status: `LIVE_UI`
- Title shown in Admin: Prospectus draft updated
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Prospectus draft updated.
- Who triggers it: Admin
- Important metadata: `beforeState`, `afterState`
- Canonical evidence: this note_events row
- Where Ops sees it: Admin note Activity / Event details (CSV export). Portal Activity only if listed below.
- Export: Note Activity CSV Event uses formatNoteActivityEventLabel; Event Type is the raw ID.
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Prospectus draft updated for NOTE-CS-2026-018.

### Event — Prospectus approved

- Raw event ID: `PROSPECTUS_REVIEW_APPROVE`
- Store: `note_events`
- Status: `LIVE_UI`
- Title shown in Admin: Prospectus approved
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Prospectus approved.
- Who triggers it: Admin
- Important metadata: `beforeState`, `afterState`
- Canonical evidence: this note_events row
- Where Ops sees it: Admin note Activity / Event details (CSV export). Portal Activity only if listed below.
- Export: Note Activity CSV Event uses formatNoteActivityEventLabel; Event Type is the raw ID.
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee approved the prospectus for NOTE-CS-2026-018.

### Event — Prospectus approval cleared after edit

- Raw event ID: `PROSPECTUS_APPROVAL_INVALIDATED_EDIT`
- Store: `note_events`
- Status: `LIVE_UI`
- Title shown in Admin: Prospectus approval cleared after edit
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Prospectus approval cleared after an edit.
- Who triggers it: Admin/system on edit
- Important metadata: `beforeState`, `afterState`
- Canonical evidence: this note_events row
- Where Ops sees it: Admin note Activity / Event details (CSV export). Portal Activity only if listed below.
- Export: Note Activity CSV Event uses formatNoteActivityEventLabel; Event Type is the raw ID.
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Prospectus approval cleared after edit on NOTE-CS-2026-018.

### Event — Prospectus approval cleared after source change

- Raw event ID: `PROSPECTUS_APPROVAL_INVALIDATED_SOURCE`
- Store: `note_events`
- Status: `LIVE_UI`
- Title shown in Admin: Prospectus approval cleared after source change
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Prospectus approval cleared after source change.
- Who triggers it: System/admin
- Important metadata: `beforeState`, `afterState`
- Canonical evidence: this note_events row
- Where Ops sees it: Admin note Activity / Event details (CSV export). Portal Activity only if listed below.
- Export: Note Activity CSV Event uses formatNoteActivityEventLabel; Event Type is the raw ID.
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Prospectus approval cleared after source change on NOTE-CS-2026-018.

### Event — Prospectus approval cleared after unpublish

- Raw event ID: `PROSPECTUS_APPROVAL_INVALIDATED_UNPUBLISH`
- Store: `note_events`
- Status: `LIVE_UI`
- Title shown in Admin: Prospectus approval cleared after unpublish
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Prospectus approval cleared after unpublish.
- Who triggers it: System/admin
- Important metadata: `beforeState`, `afterState`
- Canonical evidence: this note_events row
- Where Ops sees it: Admin note Activity / Event details (CSV export). Portal Activity only if listed below.
- Export: Note Activity CSV Event uses formatNoteActivityEventLabel; Event Type is the raw ID.
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Prospectus approval cleared after unpublish on NOTE-CS-2026-018.

### Event — Facility Fee Collection Waived

- Raw event ID: `WAIVE_FACILITY_FEE_COLLECTION`
- Store: `note_events`
- Status: `LIVE_UI`
- Title shown in Admin: Facility Fee Collection Waived
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Admin waived facility fee collection. One `note_events` row stores before/after and the waiver reason. Historical rows may still exist as `NOTE_FACILITY_FEE_COLLECTION_WAIVED`.
- Who triggers it: Admin
- Important metadata: `beforeState`, `afterState`, `reason`
- Canonical evidence: this note_events row
- Where Ops sees it: Admin note Activity / Event details (CSV export). Portal Activity only if listed below.
- Export: Note Activity CSV Event uses formatNoteActivityEventLabel; Event Type is the raw ID.
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee waived facility fee collection on NOTE-CS-2026-018 (WAIVE_FACILITY_FEE_COLLECTION).

### Event — Facility fee collection waived (historical)

- Raw event ID: `NOTE_FACILITY_FEE_COLLECTION_WAIVED`
- Store: `note_events`
- Status: `HISTORICAL`
- Title shown in Admin: Facility fee collection waived
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Previous dual-write ID from the same waive action. Live flow now writes only `WAIVE_FACILITY_FEE_COLLECTION`. CSV still labels historical rows.
- Who triggers it: none (no live writer)
- Important metadata: `reason`
- Canonical evidence: this note_events row (historical)
- Where Ops sees it: Admin note Activity / Event details (CSV export) if old rows exist
- Export: Note Activity CSV Event uses formatNoteActivityEventLabel; Event Type is the raw ID.
- Related notification: none
- Example (fictional): Mock example — historical row on NOTE-CS-2026-018 (`NOTE_FACILITY_FEE_COLLECTION_WAIVED`, reason stored).

### Event — Facility occupancy updated

- Raw event ID: `FACILITY_OCCUPANCY_UPDATED`
- Store: `note_events`
- Status: `LIVE_SYSTEM`
- Title shown in Admin: Facility occupancy updated
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Note-side occupancy update from refresh-contract-facility (distinct from application_logs.CONTRACT_FACILITY_OCCUPANCY_UPDATED).
- Who triggers it: System occupancy refresh
- Important metadata: occupancy before/after plus `applicationReference` / `contractReference` / `invoiceReference` / `noteReference` when already loaded
- Canonical evidence: this note_events row
- Where Ops sees it: Admin note Activity / Event details (CSV export). Portal Activity only if listed below.
- Export: Note Activity CSV Event uses formatNoteActivityEventLabel; Event Type is the raw ID.
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Facility occupancy updated for NOTE-CS-2026-018.

### Event — Note Defaulted

- Raw event ID: `NOTE_DEFAULT_MARKED`
- Store: `note_events`
- Status: `LIVE_UI`
- Title shown in Admin: Note Defaulted
- Title shown to Issuer: Your Note Is in Default
- Title shown to Investor: Your Investment Is in Default
- Description: Note marked in default.
- Who triggers it: Admin
- Important metadata: `reason`
- Canonical evidence: this note_events row
- Where Ops sees it: Admin note Activity / Event details (CSV export). Portal Activity only if listed below.
- Export: Note Activity CSV Event uses formatNoteActivityEventLabel; Event Type is the raw ID.
- Related notification: `note_defaulted` title `Your Note Is in Default`; `note_defaulted_investor` title `Your Investment Is in Default`
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee marked NOTE-CS-2026-018 in default.

### Event — Arrears letter generated

- Raw event ID: `ARREARS_LETTER_GENERATED`
- Store: `note_events`
- Status: `LIVE_UI`
- Title shown in Admin: Arrears letter generated
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Arrears warning letter generated (`generateNoteLetter` type arrears → ARREARS_LETTER_GENERATED).
- Who triggers it: Admin
- Important metadata: `s3Key`
- Canonical evidence: letter S3 object + this row
- Where Ops sees it: Admin note Activity / Event details (CSV export). Portal Activity only if listed below.
- Export: Note Activity CSV Event uses formatNoteActivityEventLabel; Event Type is the raw ID.
- Related notification: `note_arrears` / `note_arrears_investor` relate to arrears status, not this letter ID specifically
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Arrears letter generated for NOTE-CS-2026-018.

### Event — Default letter generated

- Raw event ID: `DEFAULT_LETTER_GENERATED`
- Store: `note_events`
- Status: `LIVE_UI`
- Title shown in Admin: Default letter generated
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Default notice letter generated (`generateNoteLetter` type default).
- Who triggers it: Admin
- Important metadata: `s3Key`
- Canonical evidence: letter S3 object + this row
- Where Ops sees it: Admin note Activity / Event details (CSV export). Portal Activity only if listed below.
- Export: Note Activity CSV Event uses formatNoteActivityEventLabel; Event Type is the raw ID.
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Default letter generated for NOTE-CS-2026-018.

## Notifications

### Notification — Your Note Is in Default

- Notification type ID: `note_defaulted`
- Catalogue name: Note defaulted (issuer)
- Exact title: Your Note Is in Default
- Purpose / description: A note was marked as default.
- Trigger: Default mark
- Recipient: Issuer
- Portal: issuer
- Platform default: true
- Email default: true
- User configurable: true
- Related event/canonical evidence: NOTE_DEFAULT_MARKED
- Exact message template (source): `"${data.noteTitle}" has been marked as default.`
- Example (fictional): Mock example — Title `Your Note Is in Default`. Mock context: NOTE-CS-2026-018.

### Notification — Your Investment Is in Default

- Notification type ID: `note_defaulted_investor`
- Catalogue name: Note defaulted
- Exact title: Your Investment Is in Default
- Purpose / description: A note you invested in was marked as default.
- Trigger: Default mark
- Recipient: Investors
- Portal: investor
- Platform default: true
- Email default: true
- User configurable: true
- Related event/canonical evidence: NOTE_DEFAULT_MARKED
- Exact message template (source): `"${data.noteTitle}" has been marked as default. This may affect recovery timelines; check your investments view for updates.`
- Example (fictional): Mock example — Title `Your Investment Is in Default`. Mock context: NOTE-CS-2026-018 / INVEST-2026-0104.

### Notification — Note in arrears

- Notification type ID: `note_arrears`
- Catalogue name: Note in arrears
- Exact title: Note in arrears
- Purpose / description: A note entered arrears status.
- Trigger: Arrears mark
- Recipient: Issuer
- Portal: issuer
- Platform default: true
- Email default: true
- User configurable: true
- Related event/canonical evidence: note servicing status (letter event is ARREARS_LETTER_GENERATED)
- Exact message template (source): `"${data.noteTitle}" has moved into arrears. Review repayment status and obligations.`
- Example (fictional): Mock example — Title `Note in arrears`. Mock context: NOTE-CS-2026-018.

### Notification — Note in Arrears

- Notification type ID: `note_arrears_investor`
- Catalogue name: Note in arrears
- Exact title: Note in Arrears
- Purpose / description: A note you invested in is in arrears.
- Trigger: Arrears
- Recipient: Investors
- Portal: investor
- Platform default: true
- Email default: true
- User configurable: true
- Related event/canonical evidence: note servicing status
- Exact message template (source): `"${data.noteTitle}" is in arrears. We will keep you informed as servicing actions progress.`
- Example (fictional): Mock example — Title `Note in Arrears`. Mock context: NOTE-CS-2026-018.

# 9. Funding / Investment

## Events

### Event — Note Published

- Raw event ID: `PUBLISH`
- Store: `note_events`
- Status: `LIVE_UI`
- Title shown in Admin: Note Published
- Title shown to Issuer: Note Published — The note is now live and open for investment.
- Title shown to Investor: Not shown on Investor Activity
- Description: Note published to the marketplace. Live writer ID is PUBLISH (not NOTE_PUBLISHED).
- Who triggers it: Admin
- Important metadata: `beforeState`, `afterState`
- Canonical evidence: this note_events row
- Where Ops sees it: Admin note Activity / Event details (CSV export). Portal Activity only if listed below.
- Export: Note Activity CSV Event uses formatNoteActivityEventLabel; Event Type is the raw ID.
- Related notification: `note_published` title `Note published`
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee published NOTE-CS-2026-018.

### Event — Funding Closed

- Raw event ID: `CLOSE_FUNDING`
- Store: `note_events`
- Status: `LIVE_UI / LIVE_SYSTEM`
- Title shown in Admin: Funding Closed
- Title shown to Issuer: Funding Closed — Funding completed and disbursement can proceed.
- Title shown to Investor: Not shown on Investor Activity
- Description: Minimum met; funding closed. Live writer ID is CLOSE_FUNDING (not NOTE_FUNDING_CLOSED).
- Who triggers it: Admin close funding / system
- Important metadata: `beforeState`, `afterState`
- Canonical evidence: this note_events row
- Where Ops sees it: Admin note Activity / Event details (CSV export). Portal Activity only if listed below.
- Export: Note Activity CSV Event uses formatNoteActivityEventLabel; Event Type is the raw ID.
- Related notification: `note_funding_succeeded` title `Funding closed successfully`
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Funding closed for NOTE-CS-2026-018.

### Event — Funding unsuccessful

- Raw event ID: `FAIL_FUNDING`
- Store: `note_events`
- Status: `LIVE_SYSTEM`
- Title shown in Admin: Funding unsuccessful
- Title shown to Issuer: Funding Unsuccessful — The note did not meet the minimum funding threshold and committed funds were released.
- Title shown to Investor: Funding Unsuccessful — The note did not meet the minimum funding threshold and committed funds were released.
- Description: Minimum not met. Admin CSV is `Funding unsuccessful`. Portal is `Funding Unsuccessful`. Live writer ID is FAIL_FUNDING.
- Who triggers it: Admin fail funding / system
- Important metadata: `beforeState`, `afterState`
- Canonical evidence: this note_events row
- Where Ops sees it: Admin note Activity / Event details (CSV export). Portal Activity only if listed below.
- Export: Note Activity CSV Event uses formatNoteActivityEventLabel; Event Type is the raw ID.
- Related notification: `note_funding_failed_issuer` title `Note funding did not complete`; `note_funding_failed_investor` title `Commitment released`
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Funding unsuccessful for NOTE-CS-2026-018.

### Event — Investment committed

- Raw event ID: `INVESTMENT_COMMITTED`
- Store: `note_events`
- Status: `LIVE_UI`
- Title shown in Admin: Investment committed
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Investment Committed — Your investment was committed successfully.
- Description: Investor committed funds to the note.
- Who triggers it: Investor Nur Aisyah
- Important metadata: `investmentAmount` / amount keys as supplied
- Canonical evidence: this note_events row; wallet/ledger for money movement
- Where Ops sees it: Admin note Activity / Event details (CSV export). Portal Activity only if listed below.
- Export: Note Activity CSV Event uses formatNoteActivityEventLabel; Event Type is the raw ID.
- Related notification: `investment_committed` title `Investment Committed`
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Nur Aisyah committed RM10,000.00 to NOTE-CS-2026-018 (INVEST-2026-0104).

### Event — Note Activated

- Raw event ID: `ACTIVATE`
- Store: `note_events`
- Status: `LIVE_UI / LIVE_SYSTEM`
- Title shown in Admin: Note Activated
- Title shown to Issuer: Your Note Is Active
- Title shown to Investor: Your Investment Is Active
- Description: Note is active after funding. Live writer ID is ACTIVATE (not NOTE_ACTIVATED).
- Who triggers it: Admin activate / system
- Important metadata: `beforeState`, `afterState`
- Canonical evidence: this note_events row
- Where Ops sees it: Admin note Activity / Event details (CSV export). Portal Activity only if listed below.
- Export: Note Activity CSV Event uses formatNoteActivityEventLabel; Event Type is the raw ID.
- Related notification: `note_active_issuer` title `Note is active`; `note_active_investor` title `Investment is active`
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — NOTE-CS-2026-018 was activated.

## Notifications

### Notification — Note published

- Notification type ID: `note_published`
- Catalogue name: Note published
- Exact title: Note published
- Purpose / description: Your note was published to the marketplace for funding.
- Trigger: Publish
- Recipient: Issuer
- Portal: issuer
- Platform default: true
- Email default: true
- User configurable: true
- Related event/canonical evidence: PUBLISH
- Exact message template (source): `Your note "${data.noteTitle}" has been published to the marketplace for investor funding.`
- Example (fictional): Mock example — Title `Note published`. Mock context: NOTE-CS-2026-018.

### Notification — Funding closed successfully

- Notification type ID: `note_funding_succeeded`
- Catalogue name: Note funding succeeded
- Exact title: Funding closed successfully
- Purpose / description: Funding closed successfully for your note.
- Trigger: Close funding
- Recipient: Issuer
- Portal: issuer
- Platform default: true
- Email default: true
- User configurable: true
- Related event/canonical evidence: CLOSE_FUNDING
- Exact message template (source): `Funding for "${data.noteTitle}" has closed — the minimum threshold was reached and commitments are locked in.`
- Example (fictional): Mock example — Title `Funding closed successfully`. Mock context: NOTE-CS-2026-018.

### Notification — Note funding did not complete

- Notification type ID: `note_funding_failed_issuer`
- Catalogue name: Funding Unsuccessful
- Exact title: Note funding did not complete
- Purpose / description: A note listing did not reach the minimum funding threshold.
- Trigger: Fail funding
- Recipient: Issuer
- Portal: issuer
- Platform default: true
- Email default: true
- User configurable: true
- Related event/canonical evidence: FAIL_FUNDING
- Exact message template (source): `Funding for "${data.noteTitle}" did not reach the minimum threshold before the listing closed.`
- Example (fictional): Mock example — Title `Note funding did not complete`. Mock context: NOTE-CS-2026-018.

### Notification — Commitment released

- Notification type ID: `note_funding_failed_investor`
- Catalogue name: Funding Unsuccessful
- Exact title: Commitment released
- Purpose / description: Reserved commitment released because a note did not complete funding.
- Trigger: Fail funding
- Recipient: Investors on note
- Portal: investor
- Platform default: true
- Email default: true
- User configurable: true
- Related event/canonical evidence: FAIL_FUNDING
- Exact message template (source): `The listing for "${data.noteTitle}" did not complete funding. Your reserved commitment has been released back to your available balance.`
- Example (fictional): Mock example — Title `Commitment released`. Mock context: NOTE-CS-2026-018 / INVEST-2026-0104.

### Notification — Note is active

- Notification type ID: `note_active_issuer`
- Catalogue name: Note active
- Exact title: Note is active
- Purpose / description: Your note is active after funding.
- Trigger: Activate
- Recipient: Issuer
- Portal: issuer
- Platform default: true
- Email default: true
- User configurable: true
- Related event/canonical evidence: ACTIVATE
- Exact message template (source): `Your note "${data.noteTitle}" is now active. Disbursement and servicing proceeds under the agreed terms.`
- Example (fictional): Mock example — Title `Note is active`. Mock context: NOTE-CS-2026-018.

### Notification — Investment is active

- Notification type ID: `note_active_investor`
- Catalogue name: Note active
- Exact title: Investment is active
- Purpose / description: A note you funded is active.
- Trigger: Activate
- Recipient: Investors
- Portal: investor
- Platform default: true
- Email default: true
- User configurable: true
- Related event/canonical evidence: ACTIVATE
- Exact message template (source): `Funding for "${data.noteTitle}" is complete and the note is now active. Monitor repayments from your investments view.`
- Example (fictional): Mock example — Title `Investment is active`. Mock context: NOTE-CS-2026-018.

### Notification — Investment Committed

- Notification type ID: `investment_committed`
- Catalogue name: Investment committed
- Exact title: Investment Committed
- Purpose / description: Sent when you successfully commit funds to a note.
- Trigger: Commit
- Recipient: Investor
- Portal: investor
- Platform default: true
- Email default: **false**
- User configurable: true
- Related event/canonical evidence: INVESTMENT_COMMITTED
- Exact message template (source): `Your investment of RM${data.amount.toLocaleString()} in "${data.noteTitle}" has been successfully committed.`
- Example (fictional): Mock example — Title `Investment Committed`. Mock context: RM10,000.00, NOTE-CS-2026-018.

# 10. Repayment / Settlement

## Events

### Event — Repayment Submitted

- Raw event ID: `ISSUER_PAYMENT_SUBMITTED`
- Store: `note_events`
- Status: `LIVE_UI`
- Title shown in Admin: Repayment Submitted
- Title shown to Issuer: You Submitted a Repayment — A repayment was submitted and is awaiting review.
- Title shown to Investor: Not shown on Investor Activity
- Description: Issuer submitted a repayment that requires admin review (not yet PAYMENT_RECEIVED).
- Who triggers it: Issuer Nur Aisyah
- Important metadata: `paymentId` and payment input fields
- Canonical evidence: `note_payments` is canonical for amount/date/reviewer. This row is the trail.
- Where Ops sees it: Admin note Activity / Event details (CSV export). Portal Activity only if listed below.
- Export: Note Activity CSV Event uses formatNoteActivityEventLabel; Event Type is the raw ID.
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Nur Aisyah submitted repayment PAY-2026-0098 for NOTE-CS-2026-018.

### Event — Repayment received

- Raw event ID: `PAYMENT_RECEIVED`
- Store: `note_events`
- Status: `LIVE_UI`
- Title shown in Admin: Repayment received
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Repayment recorded as received. Distinct from PAYMENT_APPROVED. Live writer when admin review is not required.
- Who triggers it: Admin/system record payment
- Important metadata: `paymentId` and payment input fields (amount may be on note_payments, not this row)
- Canonical evidence: `note_payments` (no duplicate required)
- Where Ops sees it: Admin note Activity / Event details (CSV export). Portal Activity only if listed below.
- Export: Note Activity CSV Event uses formatNoteActivityEventLabel; Event Type is the raw ID.
- Related notification: `note_payment_received` title `Repayment Received`
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Repayment PAY-2026-0098 received on NOTE-CS-2026-018 (PAYMENT_RECEIVED, not approved).

### Event — Repayment approved

- Raw event ID: `PAYMENT_APPROVED`
- Store: `note_events`
- Status: `LIVE_UI`
- Title shown in Admin: Repayment approved
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Repayment approved after review. Distinct from PAYMENT_RECEIVED.
- Who triggers it: Admin
- Important metadata: `paymentId`
- Canonical evidence: `note_payments`
- Where Ops sees it: Admin note Activity / Event details (CSV export). Portal Activity only if listed below.
- Export: Note Activity CSV Event uses formatNoteActivityEventLabel; Event Type is the raw ID.
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee approved repayment PAY-2026-0098.

### Event — Repayment Rejected

- Raw event ID: `PAYMENT_REJECTED`
- Store: `note_events`
- Status: `LIVE_UI`
- Title shown in Admin: Repayment Rejected
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Repayment rejected.
- Who triggers it: Admin
- Important metadata: `paymentId` / reason as supplied
- Canonical evidence: `note_payments`
- Where Ops sees it: Admin note Activity / Event details (CSV export). Portal Activity only if listed below.
- Export: Note Activity CSV Event uses formatNoteActivityEventLabel; Event Type is the raw ID.
- Related notification: `note_payment_rejected` title `Repayment Rejected`
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee rejected repayment PAY-2026-0098.

### Event — Settlement previewed

- Raw event ID: `SETTLEMENT_PREVIEWED`
- Store: `note_events`
- Status: `LIVE_UI`
- Title shown in Admin: Settlement previewed
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Settlement previewed.
- Who triggers it: Admin
- Important metadata: `settlementId` / preview fields as supplied
- Canonical evidence: `note_settlements`
- Where Ops sees it: Admin note Activity / Event details (CSV export). Portal Activity only if listed below.
- Export: Note Activity CSV Event uses formatNoteActivityEventLabel; Event Type is the raw ID.
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Settlement previewed for NOTE-CS-2026-018.

### Event — Settlement approved

- Raw event ID: `SETTLEMENT_APPROVED`
- Store: `note_events`
- Status: `LIVE_UI`
- Title shown in Admin: Settlement approved
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Settlement approved.
- Who triggers it: Admin
- Important metadata: `settlementId`
- Canonical evidence: `note_settlements`
- Where Ops sees it: Admin note Activity / Event details (CSV export). Portal Activity only if listed below.
- Export: Note Activity CSV Event uses formatNoteActivityEventLabel; Event Type is the raw ID.
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee approved settlement for NOTE-CS-2026-018.

### Event — Settlement posted

- Raw event ID: `SETTLEMENT_POSTED`
- Store: `note_events`
- Status: `LIVE_UI`
- Title shown in Admin: Settlement posted
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Settlement Posted — Your returns for the note were posted.
- Description: Settlement posted.
- Who triggers it: Admin
- Important metadata: settlement fields as supplied
- Canonical evidence: `note_settlements`
- Where Ops sees it: Admin note Activity / Event details (CSV export). Portal Activity only if listed below.
- Export: Note Activity CSV Event uses formatNoteActivityEventLabel; Event Type is the raw ID.
- Related notification: `note_settlement_posted` title `Settlement Posted`
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Settlement posted for NOTE-CS-2026-018.

### Event — Overdue Late Charge Checked

- Raw event ID: `OVERDUE_LATE_CHARGE_CHECKED`
- Store: `note_events`
- Status: `LIVE_UI`
- Title shown in Admin: Overdue Late Charge Checked
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Overdue late charge checked.
- Who triggers it: Admin/system
- Important metadata: result payload as supplied
- Canonical evidence: `note_settlements` / late charge records
- Where Ops sees it: Admin note Activity / Event details (CSV export). Portal Activity only if listed below.
- Export: Note Activity CSV Event uses formatNoteActivityEventLabel; Event Type is the raw ID.
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Overdue late charge checked on NOTE-CS-2026-018.

### Event — Late charge approved

- Raw event ID: `LATE_CHARGE_APPROVED`
- Store: `note_events`
- Status: `LIVE_UI`
- Title shown in Admin: Late charge approved
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Late charge approved.
- Who triggers it: Admin
- Important metadata: result payload as supplied
- Canonical evidence: late charge / settlement records
- Where Ops sees it: Admin note Activity / Event details (CSV export). Portal Activity only if listed below.
- Export: Note Activity CSV Event uses formatNoteActivityEventLabel; Event Type is the raw ID.
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee approved a late charge on NOTE-CS-2026-018.

### Event — Settlement Trustee Letter Generated

- Raw event ID: `SETTLEMENT_TRUSTEE_LETTER_GENERATED`
- Store: `note_events`
- Status: `LIVE_UI`
- Title shown in Admin: Settlement Trustee Letter Generated
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Settlement trustee instruction PDF generated.
- Who triggers it: Admin
- Important metadata: `s3Key`, `settlementId`
- Canonical evidence: `note_settlements` trustee fields + letter S3
- Where Ops sees it: Admin note Activity / Event details (CSV export). Portal Activity only if listed below.
- Export: Note Activity CSV Event uses formatNoteActivityEventLabel; Event Type is the raw ID.
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Settlement trustee letter generated for NOTE-CS-2026-018.

### Event — Settlement Trustee Letter Submitted

- Raw event ID: `SETTLEMENT_TRUSTEE_LETTER_SUBMITTED`
- Store: `note_events`
- Status: `LIVE_UI`
- Title shown in Admin: Settlement Trustee Letter Submitted
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Settlement trustee letter marked submitted.
- Who triggers it: Admin
- Important metadata: `settlementId` as supplied
- Canonical evidence: `note_settlements` settlement_trustee_status
- Where Ops sees it: Admin note Activity / Event details (CSV export). Portal Activity only if listed below.
- Export: Note Activity CSV Event uses formatNoteActivityEventLabel; Event Type is the raw ID.
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Settlement trustee letter submitted for NOTE-CS-2026-018.

### Event — Settlement Trustee Instruction Completed

- Raw event ID: `SETTLEMENT_TRUSTEE_INSTRUCTION_COMPLETED`
- Store: `note_events`
- Status: `LIVE_UI`
- Title shown in Admin: Settlement Trustee Instruction Completed
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Settlement trustee instruction completed.
- Who triggers it: Admin
- Important metadata: `settlementId` as supplied
- Canonical evidence: `note_settlements` / `withdrawal_instructions` as applicable
- Where Ops sees it: Admin note Activity / Event details (CSV export). Portal Activity only if listed below.
- Export: Note Activity CSV Event uses formatNoteActivityEventLabel; Event Type is the raw ID.
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Settlement trustee instruction completed for NOTE-CS-2026-018.

### Event — Settlement Trustee Email Sent

- Raw event ID: `SETTLEMENT_TRUSTEE_EMAIL_SENT`
- Store: `note_events`
- Status: `LIVE_UI`
- Title shown in Admin: Settlement Trustee Email Sent, or Settlement Trustee Email Redelivered when metadata.resend is true
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Trustee email sent (or redelivered). Same raw ID; display changes only when resend=true.
- Who triggers it: Admin
- Important metadata: `resend?`, message ids as supplied
- Canonical evidence: email delivery evidence + this row
- Where Ops sees it: Admin note Activity / Event details (CSV export). Portal Activity only if listed below.
- Export: Note Activity CSV Event uses formatNoteActivityEventLabel; Event Type is the raw ID.
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Settlement trustee email sent for NOTE-CS-2026-018.

## Notifications

### Notification — Repayment Received

- Notification type ID: `note_payment_received`
- Catalogue name: Repayment Received
- Exact title: Repayment Received
- Purpose / description: A repayment was recorded on a note.
- Trigger: Payment recorded
- Recipient: Investors
- Portal: investor
- Platform default: true
- Email default: true
- User configurable: true
- Related event/canonical evidence: PAYMENT_RECEIVED + note_payments
- Exact message template (source): `A repayment was recorded for "${data.noteTitle}".`
- Example (fictional): Mock example — Title `Repayment Received`. Mock context: NOTE-CS-2026-018 / PAY-2026-0098.

### Notification — Settlement Posted

- Notification type ID: `note_settlement_posted`
- Catalogue name: Note settlement posted
- Exact title: Settlement Posted
- Purpose / description: Settlement posted for a note.
- Trigger: Post settlement
- Recipient: Investors
- Portal: investor
- Platform default: true
- Email default: true
- User configurable: true
- Related event/canonical evidence: SETTLEMENT_POSTED
- Exact message template (source): `Settlement has been posted for "${data.noteTitle}".`
- Example (fictional): Mock example — Title `Settlement Posted`. Mock context: NOTE-CS-2026-018.

### Notification — Repayment Rejected

- Notification type ID: `note_payment_rejected`
- Catalogue name: Repayment rejected
- Exact title: Repayment Rejected
- Purpose / description: A repayment you submitted for a note was rejected.
- Trigger: Reject repayment
- Recipient: Issuer
- Portal: issuer
- Platform default: true
- Email default: **false**
- User configurable: true
- Related event/canonical evidence: PAYMENT_REJECTED
- Exact message template (source): `Your repayment for note ${data.noteTitle} was rejected. Please review the repayment details.`
- Example (fictional): Mock example — Title `Repayment Rejected`. Mock context: NOTE-CS-2026-018 / PAY-2026-0098.

### Notification — Note repaid

- Notification type ID: `note_repaid_issuer`
- Catalogue name: Note repaid
- Exact title: Note repaid
- Purpose / description: Your note has been fully repaid and settled.
- Trigger: Fully repaid (note status / settlement — no dedicated note_events ID named NOTE_REPAID)
- Recipient: Issuer
- Portal: issuer
- Platform default: true
- Email default: true
- User configurable: true
- Related event/canonical evidence: note repaid status / settlement records (no extra audit ID required)
- Exact message template (source): `"${data.noteTitle}" has been fully repaid and settled. Any residual handling will follow operational workflow if applicable.`
- Example (fictional): Mock example — Title `Note repaid`. Mock context: NOTE-CS-2026-018.

### Notification — Outstanding late charges to pay

- Notification type ID: `excess_late_charges_due`
- Catalogue name: Outstanding late charges to pay
- Exact title: Outstanding late charges to pay
- Purpose / description: Sent after a settlement is posted with late charges that did not fit into the repayment.
- Trigger: Settlement leftover
- Recipient: Issuer
- Portal: issuer
- Platform default: true
- Email default: true
- User configurable: true
- Related event/canonical evidence: note_settlements / gateway EXCESS_LATE_CHARGES
- Exact message template (source): `RM${data.outstandingAmount.toLocaleString()} in late payment charges is due on note ${data.noteReference}.`
- Example (fictional): Mock example — Title `Outstanding late charges to pay`. Mock context: NOTE-CS-2026-018, RM10,000.00.

### Notification — Late payment charges received

- Notification type ID: `excess_late_charges_paid`
- Catalogue name: Late payment charges received
- Exact title: Late payment charges received
- Purpose / description: Sent once when separately collected late charges on a note have been paid in full.
- Trigger: Charges paid
- Recipient: Issuer
- Portal: issuer
- Platform default: true
- Email default: true
- User configurable: true
- Related event/canonical evidence: gateway_payments EXCESS_LATE_CHARGES
- Exact message template (source): `The outstanding late payment charges of RM${data.paidAmount.toLocaleString()} on note ${data.noteReference} have been received.`
- Example (fictional): Mock example — Title `Late payment charges received`. Mock context: NOTE-CS-2026-018, RM10,000.00.

# 11. Withdrawals / Disbursement

## Events

### Event — Disbursement instruction created

- Raw event ID: `ISSUER_DISBURSEMENT_WITHDRAWAL_CREATED`
- Store: `note_events`
- Status: `LIVE_UI`
- Title shown in Admin: Disbursement instruction created
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Issuer disbursement withdrawal instruction created.
- Who triggers it: Admin
- Important metadata: `withdrawalId`, `withdrawalReference`, fee/net amounts
- Canonical evidence: `withdrawal_instructions` (no duplicate required)
- Where Ops sees it: Admin note Activity / Event details (CSV export). Portal Activity only if listed below.
- Export: Note Activity CSV Event uses formatNoteActivityEventLabel; Event Type is the raw ID.
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Disbursement instruction WD-2026-0031 created for NOTE-CS-2026-018.

### Event — Withdrawal letter generated

- Raw event ID: `WITHDRAWAL_LETTER_GENERATED`
- Store: `note_events`
- Status: `LIVE_UI`
- Title shown in Admin: Withdrawal letter generated
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Withdrawal letter generated.
- Who triggers it: Admin
- Important metadata: `withdrawalId`, `withdrawalReference`, `s3Key`
- Canonical evidence: `withdrawal_instructions` + letter file
- Where Ops sees it: Admin note Activity / Event details (CSV export). Portal Activity only if listed below.
- Export: Note Activity CSV Event uses formatNoteActivityEventLabel; Event Type is the raw ID.
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Withdrawal letter generated for WD-2026-0031.

### Event — Withdrawal Submitted to Trustee

- Raw event ID: `WITHDRAWAL_SUBMITTED_TO_TRUSTEE`
- Store: `note_events`
- Status: `LIVE_UI`
- Title shown in Admin: Withdrawal Submitted to Trustee
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Withdrawal instruction submitted to the trustee.
- Who triggers it: Admin
- Important metadata: withdrawal reference / type as supplied
- Canonical evidence: `withdrawal_instructions`
- Where Ops sees it: Admin note Activity / Event details (CSV export). Portal Activity only if listed below.
- Export: Note Activity CSV Event uses formatNoteActivityEventLabel; Event Type is the raw ID.
- Related notification: `withdrawal_submitted_to_trustee` title `Withdrawal Submitted to Trustee`
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — WD-2026-0031 submitted to trustee for NOTE-CS-2026-018.

### Event — Withdrawal beneficiary updated

- Raw event ID: `WITHDRAWAL_BENEFICIARY_UPDATED`
- Store: `note_events`
- Status: `LIVE_UI`
- Title shown in Admin: Withdrawal beneficiary updated
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Withdrawal beneficiary updated.
- Who triggers it: Admin
- Important metadata: beneficiary fields as supplied
- Canonical evidence: `withdrawal_instructions`
- Where Ops sees it: Admin note Activity / Event details (CSV export). Portal Activity only if listed below.
- Export: Note Activity CSV Event uses formatNoteActivityEventLabel; Event Type is the raw ID.
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Beneficiary updated on WD-2026-0031.

### Event — Withdrawal Completed

- Raw event ID: `WITHDRAWAL_COMPLETED`
- Store: `note_events`
- Status: `LIVE_UI`
- Title shown in Admin: Withdrawal Completed
- Title shown to Issuer: Your Disbursement Is Complete — Disbursement for the note has been completed.
- Title shown to Investor: Your Investment Is Active — The note is now active and servicing has started. (investor portalType; same title as ACTIVATE for investors)
- Description: Admin forensic withdrawal/disbursement completion. Issuer Activity matches notification withdrawal_completed. Investor Activity uses Your Investment Is Active.
- Who triggers it: Admin complete withdrawal
- Important metadata: `withdrawalId`, `withdrawalReference`
- Canonical evidence: `withdrawal_instructions`
- Where Ops sees it: Admin note Activity / Event details (CSV export). Portal Activity only if listed below.
- Export: Note Activity CSV Event uses formatNoteActivityEventLabel; Event Type is the raw ID.
- Related notification: `withdrawal_completed` title `Your Disbursement Is Complete` (issuer only)
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Disbursement WD-2026-0031 completed for NOTE-CS-2026-018.

### Event — Withdrawal Trustee Email Sent

- Raw event ID: `WITHDRAWAL_TRUSTEE_EMAIL_SENT`
- Store: `note_events`
- Status: `LIVE_UI`
- Title shown in Admin: Withdrawal Trustee Email Sent, or Withdrawal Trustee Email Redelivered when metadata.resend is true
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Trustee email sent or redelivered. Same raw ID.
- Who triggers it: Admin
- Important metadata: `resend?`, message ids as supplied
- Canonical evidence: email + withdrawal_instructions
- Where Ops sees it: Admin note Activity / Event details (CSV export). Portal Activity only if listed below.
- Export: Note Activity CSV Event uses formatNoteActivityEventLabel; Event Type is the raw ID.
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Withdrawal trustee email sent for WD-2026-0031.

### Event — Tawarruq Order Submitted

- Raw event ID: `SHORAKA_ORDER_SUBMITTED`
- Store: `note_events`
- Status: `LIVE_SYSTEM`
- Title shown in Admin: Tawarruq Order Submitted
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Tawarruq (Shoraka) order submitted. Raw ID stays SHORAKA_ORDER_SUBMITTED. Admin CSV rewrites Shoraka → Tawarruq.
- Who triggers it: Shoraka STP internal (no human actor)
- Important metadata: `trade_order_id` (CashSouk trade-order id / `target_id`), `provider_order_id`, `order_amount`, `murabaha_amount`, `value_date`, `order_date`
- Canonical evidence: `shoraka_trade_orders`
- Where Ops sees it: Admin note Activity / Event details (CSV export). Portal Activity only if listed below.
- Export: Note Activity CSV Event uses formatNoteActivityEventLabel; Event Type is the raw ID.
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Tawarruq order submitted for NOTE-CS-2026-018 / WD-2026-0031.

### Event — Tawarruq Certificate Retrieved

- Raw event ID: `SHORAKA_CERTIFICATE_FETCHED`
- Store: `note_events`
- Status: `LIVE_SYSTEM`
- Title shown in Admin: Tawarruq Certificate Retrieved
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Tawarruq certificate fetched/stored. Raw ID SHORAKA_CERTIFICATE_FETCHED. Do not invent five Shariah artefacts.
- Who triggers it: Shoraka STP internal
- Important metadata: `trade_order_id`, `document_type` (Tawarruq Certificate), `certificate_available`, `provider_order_id`, `certificate_file_sha256`, `certificate_s3_key`
- Canonical evidence: `shoraka_trade_orders.certificate_file_sha256`
- Where Ops sees it: Admin note Activity / Event details (CSV export). Portal Activity only if listed below.
- Export: Note Activity CSV Event uses formatNoteActivityEventLabel; Event Type is the raw ID.
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Tawarruq certificate retrieved for NOTE-CS-2026-018.

## Notifications

### Notification — Withdrawal Submitted to Trustee

- Notification type ID: `withdrawal_submitted_to_trustee`
- Catalogue name: Withdrawal submitted to trustee
- Exact title: Withdrawal Submitted to Trustee
- Purpose / description: A withdrawal instruction was submitted to the trustee.
- Trigger: Submit instruction
- Recipient: issuer and/or investor by portalType
- Portal: payload portal
- Platform default: true
- Email default: true
- User configurable: true
- Related event/canonical evidence: WITHDRAWAL_SUBMITTED_TO_TRUSTEE
- Exact message template (source): `Withdrawal instruction ${ref} for "${data.noteTitle}" (${data.withdrawalType}) has been submitted to the trustee.`
- Example (fictional): Mock example — Title `Withdrawal Submitted to Trustee`. Mock context: WD-2026-0031, NOTE-CS-2026-018.

### Notification — Your Disbursement Is Complete

- Notification type ID: `withdrawal_completed`
- Catalogue name: Disbursement completed
- Exact title: Your Disbursement Is Complete
- Purpose / description: Your note's financing disbursement has been completed.
- Trigger: Complete issuer disbursement
- Recipient: Issuer
- Portal: issuer
- Platform default: true
- Email default: **false**
- User configurable: true
- Related event/canonical evidence: WITHDRAWAL_COMPLETED
- Exact message template (source): `The disbursement for note ${data.noteTitle} has been completed.`
- Example (fictional): Mock example — Title `Your Disbursement Is Complete`. Mock context: NOTE-CS-2026-018 / WD-2026-0031.

### Notification — Withdrawal Submitted

- Notification type ID: `investor_withdrawal_submitted`
- Catalogue name: Withdrawal submitted
- Exact title: Withdrawal Submitted
- Purpose / description: Sent when your cash withdrawal request has been submitted for processing.
- Trigger: Investor cash withdrawal request
- Recipient: Investor
- Portal: investor
- Platform default: true
- Email default: **false**
- User configurable: true
- Related event/canonical evidence: `withdrawal_instructions` (no extra note_events ID required)
- Exact message template (source): `Your withdrawal request of RM${data.amount.toLocaleString()} has been submitted for processing.`
- Example (fictional): Mock example — Title `Withdrawal Submitted`. Mock context: Nur Aisyah, RM10,000.00.

### Notification — Withdrawal Completed

- Notification type ID: `investor_withdrawal_completed`
- Catalogue name: Withdrawal completed
- Exact title: Withdrawal Completed
- Purpose / description: Sent when your cash withdrawal has been completed.
- Trigger: Investor cash withdrawal done
- Recipient: Investor
- Portal: investor
- Platform default: true
- Email default: **false**
- User configurable: true
- Related event/canonical evidence: `withdrawal_instructions`
- Exact message template (source): `Your withdrawal of RM${data.amount.toLocaleString()} has been completed.`
- Example (fictional): Mock example — Title `Withdrawal Completed`. Mock context: Nur Aisyah, RM10,000.00.

# 12. Legal Documents

## Events

### Event — Document Created

- Raw event ID: `LEGAL_DOCUMENT_CREATED`
- Store: `legal_document_audit_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Document Created
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Legal document definition created. Distinct from Version Uploaded.
- Who triggers it: Admin
- Important metadata: document type, before/after JSON
- Canonical evidence: legal document row + this audit row
- Where Ops sees it: Admin Audit → Legal Documents
- Export: CSV Event Document Created; Event Type LEGAL_DOCUMENT_CREATED
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee created Terms of Use.

### Event — Document Updated

- Raw event ID: `LEGAL_DOCUMENT_UPDATED`
- Store: `legal_document_audit_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Document Updated
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Legal document definition updated.
- Who triggers it: Admin
- Important metadata: before/after
- Canonical evidence: this audit row
- Where Ops sees it: Admin Audit → Legal Documents
- Export: CSV Event Document Updated
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee updated Terms of Use.

### Event — Version Uploaded

- Raw event ID: `LEGAL_VERSION_UPLOADED`
- Store: `legal_document_audit_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Version Uploaded
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Version file uploaded, including v1. Distinct from Document Created. v1 upload stays visible.
- Who triggers it: Admin
- Important metadata: version id, number, hash, file_name
- Canonical evidence: `legal_document_versions` hash (no duplicate required)
- Where Ops sees it: Admin Audit → Legal Documents
- Export: CSV Event Version Uploaded
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee uploaded Terms of Use v3.

### Event — Version File Replaced

- Raw event ID: `LEGAL_VERSION_FILE_REPLACED`
- Store: `legal_document_audit_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Version File Replaced
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Version file replaced.
- Who triggers it: Admin
- Important metadata: hash
- Canonical evidence: `legal_document_versions`
- Where Ops sees it: Admin Audit → Legal Documents
- Export: CSV Event Version File Replaced
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee replaced the file for Terms of Use v3.

### Event — Version Published

- Raw event ID: `LEGAL_VERSION_PUBLISHED`
- Store: `legal_document_audit_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Version Published
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Version published. May auto-archive previous; archive reason stays metadata only.
- Who triggers it: Admin
- Important metadata: may include archive `reason`
- Canonical evidence: `legal_document_versions`
- Where Ops sees it: Admin Audit → Legal Documents
- Export: CSV Event Version Published
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee published Terms of Use v3.

### Event — Version Archived

- Raw event ID: `LEGAL_VERSION_ARCHIVED`
- Store: `legal_document_audit_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Version Archived
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Version archived (admin or auto on publish). `reason` is metadata only.
- Who triggers it: Admin / auto on publish
- Important metadata: `reason`
- Canonical evidence: `legal_document_versions`
- Where Ops sees it: Admin Audit → Legal Documents
- Export: CSV Event Version Archived
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Previous Terms of Use version archived (reason in metadata).

### Event — Version Restored

- Raw event ID: `LEGAL_VERSION_RESTORED`
- Store: `legal_document_audit_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Version Restored
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Version restored.
- Who triggers it: Admin
- Important metadata: version id
- Canonical evidence: `legal_document_versions`
- Where Ops sees it: Admin Audit → Legal Documents
- Export: CSV Event Version Restored
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee restored a Terms of Use version.

## Notifications

No live notification types are owned by this module.

# 13. Legal Acceptances

## Events

### Event — Legal document not opened

- Raw event ID: `NOT_OPENED`
- Store: `legal_document_acceptances`
- Status: `LIVE_UI`
- Title shown in Admin: Legal document not opened
- Title shown to Issuer: Acceptance status is a snapshot, not an activity timeline event.
- Title shown to Investor: Same — status snapshot if shown
- Description: User has never opened the document. Status badge: Not opened.
- Who triggers it: System default until open/accept
- Important metadata: IPs, acknowledgement, org/user snapshots, portal, version when present
- Canonical evidence: this acceptance row (no duplicate onboarding event required)
- Where Ops sees it: Admin Audit → Legal Acceptances
- Export: CSV Event Legal document not opened; Status Not opened; Document Type friendly label; Document Type ID enum
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Terms of Use v3 not opened for Nur Aisyah / ABC Trading Sdn Bhd.

### Event — Legal document opened

- Raw event ID: `OPENED`
- Store: `legal_document_acceptances`
- Status: `LIVE_UI`
- Title shown in Admin: Legal document opened
- Title shown to Issuer: Status snapshot
- Title shown to Investor: Status snapshot
- Description: Opened, not accepted. Status badge: Opened.
- Who triggers it: User open
- Important metadata: open timestamp / IP as stored
- Canonical evidence: this acceptance row
- Where Ops sees it: Admin Audit → Legal Acceptances
- Export: CSV Status Opened
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Nur Aisyah opened Terms of Use v3 (not accepted).

### Event — Legal document accepted

- Raw event ID: `ACCEPTED`
- Store: `legal_document_acceptances`
- Status: `LIVE_UI`
- Title shown in Admin: Legal document accepted
- Title shown to Issuer: Status snapshot
- Title shown to Investor: Status snapshot
- Description: Accepted. Status badge: Accepted.
- Who triggers it: User accept
- Important metadata: acknowledgement text, hash, IPs, version
- Canonical evidence: this acceptance row; hash on legal_document_versions
- Where Ops sees it: Admin Audit → Legal Acceptances
- Export: CSV Status Accepted
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Nur Aisyah accepted Terms of Use v3 for ABC Trading Sdn Bhd.

## Notifications

No live notification types are owned by this module.

# 14. Products

## Events

### Event — Product Created

- Raw event ID: `PRODUCT_CREATED`
- Store: `product_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Product Created
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Product created. Product Name from metadata.workflow[0].config.name then config.type.name.
- Who triggers it: Admin
- Important metadata: workflow snapshot
- Canonical evidence: this product_logs row (name is snapshot, not a live join)
- Where Ops sees it: Admin Audit → Products
- Export: CSV/JSON Product Name from same snapshot path
- Related notification: none required (`new_product_alert` is a separate marketing send)
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee created product Invoice Financing.

### Event — Product Updated

- Raw event ID: `PRODUCT_UPDATED`
- Store: `product_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Product Updated
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Product updated. After snapshot plus `replaced_product_id` on versioned saves. Previous configuration remains on the prior product row (INACTIVE). Admin delete is soft. No previous blob is duplicated onto this event.
- Who triggers it: Admin
- Important metadata: workflow snapshot
- Canonical evidence: this product_logs row
- Where Ops sees it: Admin Audit → Products
- Export: CSV/JSON Product Name from snapshot
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee updated product Invoice Financing.

### Event — Product Deleted

- Raw event ID: `PRODUCT_DELETED`
- Store: `product_logs`
- Status: `LIVE_UI`
- Title shown in Admin: Product Deleted
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Product deleted (soft-delete path logs this ID).
- Who triggers it: Admin
- Important metadata: workflow snapshot
- Canonical evidence: this product_logs row
- Where Ops sees it: Admin Audit → Products
- Export: CSV/JSON Product Name from snapshot
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee deleted product Invoice Financing.

## Notifications

### Notification — New Investment Opportunity

- Notification type ID: `new_product_alert`
- Catalogue name: New Product Alert
- Exact title: New Investment Opportunity
- Purpose / description: Be the first to know about new investment opportunities and products.
- Trigger: Product publish/alert
- Recipient: Investors
- Portal: investor (template hardcodes investor)
- Platform default: true
- Email default: true
- User configurable: true
- Related event/canonical evidence: none required (not a product_logs duplicate)
- Exact message template (source): `A new product "${data.productName}" is now available for investment.`
- Example (fictional): Mock example — Title `New Investment Opportunity`. Mock context: Invoice Financing.

# 15. Gateway / Payments

## Events

### Event — Name check needed

- Raw event ID: `NAME_CHECK`
- Store: `gateway_payment_events`
- Status: `LIVE_SYSTEM`
- Title shown in Admin: Name check needed
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Payment received, but the bank name could not be matched to the investor profile. Waiting for review.
- Who triggers it: Gateway webhook / system
- Important metadata: reason/name fields as supplied
- Canonical evidence: `gateway_payments` canonical row; this event is the trail
- Where Ops sees it: Admin gateway payment detail activity
- Export: CSV Event = formatGatewayEventTitle
- Related notification: none yet
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Name check needed on Nur Aisyah deposit RM10,000.00.

### Event — Name check approved

- Raw event ID: `NAME_CHECK_APPROVED`
- Store: `gateway_payment_events`
- Status: `LIVE_UI`
- Title shown in Admin: Name check approved
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: The names were confirmed to match. The deposit was completed.
- Who triggers it: Admin
- Important metadata: as supplied
- Canonical evidence: `gateway_payments`
- Where Ops sees it: Admin gateway payment detail
- Export: CSV same title
- Related notification: `deposit_successful` on completed deposit
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee approved the name check for RM10,000.00.

### Event — Name Check Rejected

- Raw event ID: `NAME_CHECK_REJECTED`
- Store: `gateway_payment_events`
- Status: `LIVE_UI`
- Title shown in Admin: Name Check Rejected
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: The names did not match. A refund was started.
- Who triggers it: Admin
- Important metadata: as supplied
- Canonical evidence: `gateway_payments`
- Where Ops sees it: Admin gateway payment detail
- Export: CSV same title
- Related notification: `deposit_name_check_rejected` title `Deposit Verification Failed`
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee rejected the name check; refund started.

### Event — Payment mismatch found

- Raw event ID: `CAPTURE_MISMATCH`
- Store: `gateway_payment_events`
- Status: `LIVE_SYSTEM`
- Title shown in Admin: Payment mismatch found, or Currency mismatch found, or Amount mismatch found (formatGatewayEventTitle)
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Amount or currency mismatch versus expected capture.
- Who triggers it: Gateway webhook / system
- Important metadata: `reason` (AMOUNT_MISMATCH / Currency mismatch / etc.)
- Canonical evidence: `gateway_payments`
- Where Ops sees it: Admin gateway payment detail
- Export: CSV uses the formatted title
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Amount mismatch found on a RM10,000.00 capture.

### Event — Payment expired

- Raw event ID: `EXPIRED`
- Store: `gateway_payment_events`
- Status: `LIVE_SYSTEM`
- Title shown in Admin: Payment expired
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: The payment link timed out before payment was finished.
- Who triggers it: System
- Important metadata: as supplied
- Canonical evidence: `gateway_payments`
- Where Ops sees it: Admin gateway payment detail
- Export: CSV Payment expired
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Payment link expired.

### Event — Status change proposed

- Raw event ID: `OVERRIDE_PROPOSED`
- Store: `gateway_payment_events`
- Status: `DEAD`
- Title shown in Admin: Status change proposed
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: Enum + `getOpenOverrideProposal` reader only. **No live writer.** Do not activate.
- Who triggers it: Admin
- Important metadata: from/to status
- Canonical evidence: `gateway_payments`
- Where Ops sees it: Admin gateway payment detail
- Export: CSV same title
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Admin Adam Lee proposed a status change.

### Event — Status change approved

- Raw event ID: `OVERRIDE_APPROVED`
- Store: `gateway_payment_events`
- Status: `DEAD`
- Title shown in Admin: Status change approved
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: **No live writer.** Do not activate.
- Who triggers it: Admin
- Important metadata: from/to status
- Canonical evidence: `gateway_payments`
- Where Ops sees it: Admin gateway payment detail
- Export: CSV same title
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Status change approved.

### Event — Status change rejected

- Raw event ID: `OVERRIDE_REJECTED`
- Store: `gateway_payment_events`
- Status: `DEAD`
- Title shown in Admin: Status change rejected
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: **No live writer.** Do not activate.
- Who triggers it: Admin
- Important metadata: reason
- Canonical evidence: `gateway_payments`
- Where Ops sees it: Admin gateway payment detail
- Export: CSV same title
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Status change rejected.

### Event — Refund Started

- Raw event ID: `REFUND_INITIATED`
- Store: `gateway_payment_events`
- Status: `LIVE_UI / LIVE_SYSTEM`
- Title shown in Admin: Refund Started
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: A full refund was requested. Waiting for Curlec to confirm the result.
- Who triggers it: Admin or system
- Important metadata: reason (e.g. ADMIN_INITIATED)
- Canonical evidence: `gateway_payments`
- Where Ops sees it: Admin gateway payment detail
- Export: CSV Refund Started
- Related notification: `deposit_refund_initiated` title `Refund Started`
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Refund started for RM10,000.00.

### Event — Refund completed

- Raw event ID: `REFUNDED`
- Store: `gateway_payment_events`
- Status: `LIVE_SYSTEM`
- Title shown in Admin: Refund completed
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: The refund was confirmed. Money was returned to the payer.
- Who triggers it: System/webhook
- Important metadata: as supplied
- Canonical evidence: `gateway_payments`
- Where Ops sees it: Admin gateway payment detail
- Export: CSV Refund completed
- Related notification: `deposit_refunded` title `Refund Completed`
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Refund completed for RM10,000.00.

### Event — Wallet balance could not be updated

- Raw event ID: `REFUND_WALLET_REVERSAL_FAILED`
- Store: `gateway_payment_events`
- Status: `LIVE_SYSTEM`
- Title shown in Admin: Wallet balance could not be updated
- Title shown to Issuer: Not shown on Issuer Activity
- Title shown to Investor: Not shown on Investor Activity
- Description: The refund was completed, but the wallet balance could not be fully updated.
- Who triggers it: System
- Important metadata: as supplied
- Canonical evidence: `gateway_payments` + wallet ledger
- Where Ops sees it: Admin gateway payment detail
- Export: CSV same title
- Related notification: none
- Example (fictional): Mock example — `27 Aug 2026, 10:15 AM` — Refund done but wallet reversal failed for RM10,000.00.

## Notifications

### Notification — Deposit Verification Failed

- Notification type ID: `deposit_name_check_rejected`
- Catalogue name: Deposit verification failed
- Exact title: Deposit Verification Failed
- Purpose / description: Sent when a deposit fails bank-name verification and will be returned.
- Trigger: Name check reject
- Recipient: Investor
- Portal: investor
- Platform default: true
- Email default: **false**
- User configurable: true
- Related event/canonical evidence: NAME_CHECK_REJECTED
- Exact message template (source): `Your deposit could not be verified and will be returned.`
- Example (fictional): Mock example — Title `Deposit Verification Failed`. Mock context: Nur Aisyah, RM10,000.00.

### Notification — Refund Started

- Notification type ID: `deposit_refund_initiated`
- Catalogue name: Deposit refund started
- Exact title: Refund Started
- Purpose / description: Sent when a refund for a deposit has been initiated.
- Trigger: Refund start
- Recipient: Investor
- Portal: investor
- Platform default: true
- Email default: **false**
- User configurable: true
- Related event/canonical evidence: REFUND_INITIATED
- Exact message template (source): `A refund for your deposit of RM${data.amount.toLocaleString()} has been initiated.`
- Example (fictional): Mock example — Title `Refund Started`. Mock context: RM10,000.00.

### Notification — Refund Completed

- Notification type ID: `deposit_refunded`
- Catalogue name: Deposit refund completed
- Exact title: Refund Completed
- Purpose / description: Sent when a deposit refund has been completed.
- Trigger: Refund done
- Recipient: Investor
- Portal: investor
- Platform default: true
- Email default: **false**
- User configurable: true
- Related event/canonical evidence: REFUNDED
- Exact message template (source): `Your refund of RM${data.amount.toLocaleString()} has been completed.`
- Example (fictional): Mock example — Title `Refund Completed`. Mock context: RM10,000.00.

### Notification — Deposit Successful

- Notification type ID: `deposit_successful`
- Catalogue name: Deposit successful
- Exact title: Deposit Successful
- Purpose / description: Sent when a deposit has been credited to your wallet.
- Trigger: Deposit credited
- Recipient: Investor
- Portal: investor
- Platform default: true
- Email default: **false**
- User configurable: true
- Related event/canonical evidence: payment COMPLETED + name check / gateway_payments
- Exact message template (source): `Your deposit of RM${data.amount.toLocaleString()} has been successfully credited to your wallet.`
- Example (fictional): Mock example — Title `Deposit Successful`. Mock context: RM10,000.00.

# 16. Notifications / Broadcasts

## Events

## Notifications

### Notification — System Announcement

- Notification type ID: `system_announcement`
- Catalogue name: System Announcement
- Exact title: payload title (`data.title`)
- Purpose / description: General announcements about platform updates and maintenance.
- Trigger: Admin broadcast
- Recipient: audience (All Users / Investors / Issuers / specific)
- Portal: unset when mixed — email uses landing FRONTEND_URL, not Investor fallback
- Platform default: true
- Email default: true
- User configurable: true
- Related event/canonical evidence: `notification_logs` ADMIN batch (idempotency not SYSTEM key)
- Exact message template (source): `data.message` (payload). Title is `data.title`.
- Example (fictional): Mock example — Title from payload. Mock context: platform maintenance announcement.

# 17. Other live system/admin events

Covered in the modules above (including `CONTRACT_CUSTOMER_LARGE_PRIVATE_UPDATED` under Facility / Contract, `PLATFORM_FINANCE_SETTINGS_UPDATED` under Security, and Shoraka/Tawarruq under Withdrawals / Disbursement).

---

# Non-Live / Preservation IDs

Do not mix these with live events.

## UNREACHABLE

| Raw ID | Store | Old/intended meaning | Why not live | Current replacement |
|---|---|---|---|---|
| `ROLE_ADDED` | `access_logs` | Fallback of `updateUserRoles` when ADMIN is not stripped | Writer + hook; **no `.tsx` caller** | Security `ROLE_ADDED` for self-add / invitation; Portal access uses `onboarding_logs.ONBOARDING_STATUS_UPDATED` |
| `ROLE_REMOVED` | `access_logs` | `updateUserRoles` only when ADMIN was present and is now absent | Same unreachable hook | Security `ROLE_REMOVED` is catalogue delete |
| `ONBOARDING_RESET` | `access_logs` | Temporary onboarded-flag reset | Route-only; no SDK/UI | none |
| `AML_APPROVED` | `onboarding_logs` | Manual Admin AML override | Hook exists; **no `.tsx` caller** | Live AML progression: `ONBOARDING_STATUS_UPDATED` |
| `ONBOARDING_RESET` | `onboarding_logs` | Same reset | Route-only; not in org timeline query | none |
| `PRODUCT_INACTIVATED` | `product_logs` | Mark product inactive | `setInactive` has **zero callers** | `PRODUCT_UPDATED` / `PRODUCT_DELETED` as used |
| `PRODUCT_REACTIVATED` | `product_logs` | Mark product active | Writer with **zero callers** | none |

## DEAD

| Raw ID | Store | Old/intended meaning | Why not live | Current replacement |
|---|---|---|---|---|
| `ROLE_SWITCHED` | `access_logs` | Role switch | Not written to this store | `security_logs.ROLE_SWITCHED` |
| `PASSWORD_CHANGED` | `access_logs` | Password change | Not written to this store | `security_logs.PASSWORD_CHANGED` |
| `EMAIL_VERIFIED` | `access_logs` | Email verified | Not written to this store | `security_logs.EMAIL_VERIFIED` |
| `ONBOARDING` | `access_logs` | Onboarding | Not written to this store | `onboarding_logs` |
| `ONBOARDING_STATUS_UPDATED` | `access_logs` | Status update | Not written to this store | `onboarding_logs.ONBOARDING_STATUS_UPDATED` |
| `TNC_ACCEPTED` | `onboarding_logs` | T&C accepted as this ID | No production writer as event_type | `TNC_APPROVED` + `legal_document_acceptances` |
| `KYC_APPROVED` | `onboarding_logs` | KYC approved as this ID | No production writer as event_type | `ONBOARDING_STATUS_UPDATED` with `trigger: "KYC_APPROVED"` |
| `APPLICATION_APPROVED` | `application_logs` | Application approved | Labels/allowlist exist; **no production writer** | none |

## HISTORICAL

| Raw ID | Store | Old/intended meaning | Why not live | Current replacement |
|---|---|---|---|---|
| `CONTRACT_OFFER_REJECTED` | `application_logs` | Admin display Facility Offer Withdrawn; issuer adapter Facility Offer Declined | No live writer; live decline is `CONTRACT_OFFER_DECLINED` | `CONTRACT_OFFER_DECLINED` |
| `NOTE_CREATED` | `note_events` | CSV alias Note created | No current writer | `NOTE_CREATED_FROM_INVOICE` |
| `NOTE_DRAFT_UPDATED` | `note_events` | CSV alias Draft updated | No current writer | `UPDATE_DRAFT` |
| `NOTE_PUBLISHED` | `note_events` | CSV alias Note Published | No current writer | `PUBLISH` |
| `NOTE_UNPUBLISHED` | `note_events` | CSV alias Unpublished from marketplace | No current writer | `UNPUBLISH` |
| `NOTE_FUNDING_CLOSED` | `note_events` | CSV alias Funding Closed | No current writer | `CLOSE_FUNDING` |
| `NOTE_FUNDING_FAILED` | `note_events` | CSV alias Funding unsuccessful | No current writer | `FAIL_FUNDING` |
| `NOTE_ACTIVATED` | `note_events` | CSV alias Note Activated | No current writer | `ACTIVATE` |
| `PAYMENT_RECORDED` | `note_events` | CSV alias Repayment received | No current writer | `PAYMENT_RECEIVED` |
| `NOTE_FACILITY_FEE_COLLECTION_WAIVED` | `note_events` | Previous dual-write waive reason row | Live flow writes `WAIVE_FACILITY_FEE_COLLECTION` with reason + before/after | `WAIVE_FACILITY_FEE_COLLECTION` |

## SEED_ONLY

| Raw ID | Store | Old/intended meaning | Why not live | Current replacement |
|---|---|---|---|---|
| `KYC_STATUS_UPDATED` | `access_logs` | Toolbar union `KYC status updated`; table map `KYC Updated` | No production writer; excluded from `ACCESS_EVENT_TYPES` | KYC evidence via `onboarding_logs.ONBOARDING_STATUS_UPDATED` |

## DEV_ONLY

| Raw ID | Store | Old/intended meaning | Why not live | Current replacement |
|---|---|---|---|---|
| `USER_COMPLETED` | `onboarding_logs` | User completed | Remaining writer `regtank/webhook-handler-dev.ts` | `FINAL_APPROVAL_COMPLETED` |

---

# Validation

| Check | Value |
|---|---|
| Live events expanded | 139 |
| Expected live events (source writers, including CONTRACT_CUSTOMER_LARGE_PRIVATE_UPDATED) | 139 |
| Live notifications expanded | 49 |
| Expected live notifications | 49 |
| Non-live IDs in appendix (UNREACHABLE 7 store-pairs + DEAD 8 + HISTORICAL 9 + SEED 1 + DEV 1) | 26 rows |
| Master catalogue live count (omitted CONTRACT_CUSTOMER_LARGE_PRIVATE_UPDATED) | 138 |
| All note live writers individually expanded | YES (44 IDs; aliases in HISTORICAL) |
