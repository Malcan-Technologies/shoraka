# Audit / Activity — origin/main vs current source cross-check

**READ-ONLY comparison.** Product code was not modified.

> **Historical snapshot.** This comparison is `origin/main` (`cc58bb43…`) versus `no_fix_55` (`679a1c4c…` plus that working tree). Later living-source changes include: A040 `ONBOARDING_RESUMED`, A052 `CTOS_REPORT_RECEIVED`, and A053 `CORPORATE_ENTITIES_UPDATED` retired; A055 outcome-only (`APPROVED`/`REJECTED`); A044 amendment/resubmission support; and `AML_APPROVED` `onboarding_id` threading to `reg_tank_onboarding.id` when the session is already known. The tables below are left as written for that git comparison. Living behaviour is in `docs/audit/audit-manual-verification-catalogue.md`.

| Side | Git ref | Branch / tree |
|---|---|---|
| BEFORE | `cc58bb43dc694a02169ae3c1a5f5afd1ff953d8c` | `origin/main` (“No fix 54 (#226)”) |
| AFTER | `679a1c4c7405687c7610c146ed6b18e4ffdd2385` plus working tree | `no_fix_55` |

Authority is `git show origin/main:<path>` versus the current working tree. Prior audit reports were not used as the source of truth.

**Question:** Did anything useful that existed on `origin/main` disappear after the audit redesign?

**Short answer:** Core business evidence is still present — usually in a new `*AuditLog` table, a renamed event, or a business source of truth (SOT). A small set of **history breadcrumbs** (featured-note changes, late-charge calculator approval, no-op overdue checks, letter `s3Key` on the note timeline) have no current audit equivalent. Those are called out under POSSIBLE LOSSES. Nothing in Access / Application / Payment / Legal / Product / Notification looks like an accidental wipe of a live writer.

---

## 19. Beginner-friendly cross-check

### ACCESS

✅ **Preserved**
- Signup, login, logout
- IP, user agent, portal, actor snapshots
- Admin `/audit` Access tab, search, date filter, event filter, pagination (15), CSV export

🔄 **Replaced**
- `AccessLog` / `access_logs` → `AccessAuditLog` / `access_audit_logs`
- `SIGNUP` / `LOGIN` / `LOGOUT` → `USER_SIGNED_UP` / `USER_LOGGED_IN` / `USER_LOGGED_OUT`
- Failed **admin portal gate** (`AccessLog` `LOGIN` + `success: false`) → Security `ADMIN_ACCESS_DENIED`

🗑 **Removed intentionally**
- Access rows for roles, profile, password, KYC, onboarding (those were mixed into Access on `origin/main` or only appeared as filter labels)
- Stored `success` boolean (Access is success-only now)
- Status column on the Access table (`showStatusFilter={false}`)

⚠️ **Check carefully**
- Status / failed filter on Access no longer finds rows. Failed admin access is on the **Security** tab.

**WHAT I SHOULD MANUALLY TEST**
- [ ] Sign up, log in, log out → Access tab shows the three events
- [ ] Non-admin / inactive admin hitting Admin Cognito → Security `ADMIN_ACCESS_DENIED`, not an Access failure row
- [ ] Access export still downloads CSV
- [ ] Access “failed” filter (if you force it) returns empty — expected

### SECURITY

✅ **Preserved**
- Password change (success + failure)
- Email verification (success + failure) — old name was `EMAIL_CHANGED` but the writer was `verifyEmail`
- Role add / switch / admin role CRUD / invitations / org membership
- IP, user agent, metadata

🔄 **Replaced**
- `SecurityLog` / `security_logs` → `SecurityAuditLog` / `security_audit_logs`
- Many short names → longer catalogue names (`ROLE_SWITCHED` → `ACTIVE_ROLE_CHANGED`, etc.)
- Security export now uses the Security export path (on `origin/main` the Security panel reused the Access toolbar/export wiring)

🗑 **Removed intentionally**
- `USER_EMAIL_CHANGED` as a distinct “email address changed” event (never a separate writer; verify-email used `EMAIL_CHANGED`)
- Onboarding events that had leaked into Security (`ONBOARDING_RESET`, sophisticated status)

⚠️ **Check carefully**
- Password / email **failure** rows exist as `PASSWORD_CHANGE_FAILED` / `EMAIL_VERIFICATION_FAILED` (old used the same event name + `success: false` in metadata)

**WHAT I SHOULD MANUALLY TEST**
- [ ] Change password success and failure
- [ ] Verify email success and failure
- [ ] Admin invite / revoke / accept
- [ ] Org invite / join / remove / transfer
- [ ] Security CSV export actually exports Security rows

### ONBOARDING

✅ **Preserved**
- Started / resumed / approved / rejected / reset / final approval / completed
- AML, SSM, sophisticated status, CTOS received, corporate entities, director invite / KYC
- Org activity timeline still exists
- New global `/audit` Onboarding tab (did not exist on `origin/main`)

🔄 **Replaced**
- `OnboardingLog` / `onboarding_logs` → `OnboardingAuditLog` / `onboarding_audit_logs`
- Admin restart `ONBOARDING_CANCELLED` → `ONBOARDING_RESTARTED` (`ADMIN_RESTART`)
- `ONBOARDING_STATUS_UPDATED` → `ONBOARDING_STATUS_CHANGED` / `USER_ONBOARDING_STATUS_UPDATED`

🗑 **Removed intentionally**
- `TNC_APPROVED` / `TNC_ACCEPTED` as onboarding audit (acceptance lives on `LegalDocumentAcceptance` + `tnc_accepted`)
- `FORM_FILLED`, raw `WEBHOOK_*` / `EOD_*` / `COD_REJECTED` as audit events
- Logout `cancelOnboarding` still does **not** write a cancel audit (same as `origin/main` comments)

⚠️ **Check carefully**
- T&C acceptance: use **Legal Acceptances**, not Onboarding audit
- Director KYC status: `DIRECTOR_KYC_STATUS_UPDATED`, not Access `KYC_STATUS_UPDATED`

**WHAT I SHOULD MANUALLY TEST**
- [ ] Start / resume / admin restart / reset
- [ ] AML / SSM / onboarding approve
- [ ] Accept legal docs → Legal Acceptances row, not Onboarding `TNC_*`
- [ ] Global Onboarding tab + org-page timeline both show the same events
- [ ] Onboarding CSV export

### APPLICATION

✅ **Preserved**
- Create, submit, resubmit, withdraw, reject, complete
- Section / item review
- Contract and invoice offer send / retract / expire / accept / reject / withdraw / deadline extend
- Acceptance submit / resubmit / approved-for-signing
- Amendment request + issuer resubmit
- Signing package create / send / complete / void (now on `SigningAuditLog`)
- Application Activity + raw Application Audit History

🔄 **Replaced**
- `ApplicationLog` / `application_logs` → `ApplicationAuditLog` / `application_audit_logs`
- `ApplicationReviewEvent` (duplicate of three offer/amendment events) → dropped; those events live only on Application audit
- `APPLICATION_RESET_TO_UNDER_REVIEW` → `APPLICATION_REOPENED_FOR_REVIEW`
- `CONTRACT_OFFER_ACCEPTANCE_*` → `CONTRACT_ACCEPTANCE_*` (same for invoice)
- `AMENDMENTS_SUBMITTED` → `APPLICATION_RESUBMITTED` + `APPLICATION_AMENDMENT_ACKNOWLEDGED`
- Issuer contract reject now writes `CONTRACT_OFFER_REJECTED` (old live writer used `CONTRACT_WITHDRAWN`)
- Signing events moved out of Application logs

🗑 **Removed intentionally**
- `APPLICATION_APPROVED` (enum-only on `origin/main`; never written)
- Deprecated `level` / `target` / `action` columns (already deprecated on `origin/main`)
- Draft review remarks as audit (still on `ApplicationReviewRemark`)

⚠️ **Check carefully**
- Review remarks / amendment history: SOT is `ApplicationReviewRemark`, not audit
- Documents: **new** audit events (`APPLICATION_DOCUMENT_*`) — improvement, not a loss
- Admin `GET /v1/applications/:id/logs` now requires `applications.view` (stricter than `origin/main`)

**WHAT I SHOULD MANUALLY TEST**
- [ ] Submit → review start → section/item review → amendments → resubmit
- [ ] Contract offer send / accept / reject / retract / expire
- [ ] Invoice offer same path
- [ ] Signing package create / send / complete / void on Application Audit History (merged)
- [ ] Activity vs raw Audit History: Activity is curated; Audit History is complete
- [ ] Admin without `applications.view` cannot open application logs

### SIGNING

✅ **Preserved**
- Package created / sent / completed / voided

🔄 **Replaced**
- Old rows sat on `ApplicationLog` → `SigningAuditLog` / `signing_audit_logs`

🗑 **Removed intentionally**
- `SIGNING_SESSION_OPENED` / `SIGNING_RECIPIENT_VIEWED` / `SIGNING_PACKAGE_IN_PROGRESS` (never live writers on `origin/main`; cutover forbids them)

⚠️ **Check carefully**
- Current adds recipient completed/declined, eKYC, reminder, expired — more than `origin/main`

**WHAT I SHOULD MANUALLY TEST**
- [ ] Create / send / complete / void package
- [ ] Recipient complete / decline
- [ ] Envelope expiry and offer-clock expiry
- [ ] Admin envelope logs require `applications.view`

### NOTE

✅ **Preserved**
- Create from invoice, material term edits, publish / unpublish, funding close / fail, activate
- Investment commit
- Prospectus create / approve / invalidate
- Disbursement + residual-return letter / submit / complete
- Shoraka order submit + certificate
- Repayment submit / receive / reject
- Settlement preview / approve / post
- Service-fee trustee letter / submit / complete
- Arrears letter / default notice
- Trustee signature image change
- Note Activity + raw Note Audit History

🔄 **Replaced**
- `NoteEvent` / `note_events` + `NoteAdminAction` / `note_admin_actions` → `NoteAuditLog` / `note_audit_logs`
- `NOTE_CREATED_FROM_INVOICE` → `NOTE_CREATED` (`sourceType: "INVOICE"`)
- `UPDATE_DRAFT` → `NOTE_TERMS_UPDATED` (material fields only)
- `PUBLISH` / `UNPUBLISH` / `CLOSE_FUNDING` / `FAIL_FUNDING` / `ACTIVATE` → `NOTE_*` names
- `ISSUER_PAYMENT_SUBMITTED` / `PAYMENT_RECEIVED` / `PAYMENT_REJECTED` → `REPAYMENT_*`
- `NOTE_DEFAULT_MARKED` → `NOTE_MARKED_DEFAULT`
- `SHORAKA_CERTIFICATE_FETCHED` → `SHORAKA_CERTIFICATE_RECEIVED`
- `SERVICE_FEE_TRUSTEE_LETTER_SUBMITTED` / `INSTRUCTION_COMPLETED` → `SERVICE_FEE_TRUSTEE_SUBMITTED` / `COMPLETED`
- Issuer/investor withdrawal letter events split: issuer/residual stay on Note audit; investor withdrawals moved to Payment audit

🗑 **Removed intentionally**
- `UPDATE_FEATURED_SETTINGS` audit (featured flags remain on `Note`)
- `PROSPECTUS_REVIEW_DRAFT_UPDATE` (draft body is SOT; invalidation still audited)
- `OVERDUE_LATE_CHARGE_CHECKED` on every check (status change → `NOTE_SERVICING_STATUS_CHANGED`)
- `LATE_CHARGE_APPROVED` (calculator; fees land on `NoteSettlement`)
- `s3Key` inside letter audit metadata (now `fileName` + `fileHash`)
- Duplicate `NoteAdminAction` before/after snapshots

⚠️ **Check carefully**
- Featured-note **history** (who changed featured when) is gone
- Note timeline “view/download letter” from audit `s3Key` is gone (`extractS3Key` returns `null`)
- Late-charge **calculator approval** no longer leaves an audit row

**WHAT I SHOULD MANUALLY TEST**
- [ ] Create note, edit material terms, publish / unpublish
- [ ] Change featured settings → confirm Note fields update, no audit row
- [ ] Invest, close/fail funding, activate
- [ ] Disbursement letter → trustee → complete; residual return same
- [ ] Investor withdrawal → Payment Audit History, not Note
- [ ] Settlement preview / approve / post
- [ ] Generate arrears/default letter → download from the generate action, not from timeline `s3Key`
- [ ] Trustee signature change only (other platform finance fields unaudited)

### PAYMENT

✅ **Preserved**
- Name check pending / approved / rejected
- Refund initiated / refunded / wallet reversal failed
- Expiry, capture mismatch
- Gateway webhook technical table (`GatewayWebhookEvent`) still exists

🔄 **Replaced**
- `GatewayPaymentEvent` / `gateway_payment_events` → `PaymentAuditLog` / `payment_audit_logs`
- Curated `from → to` payment timeline → raw **Audit History** table

🗑 **Removed intentionally**
- `OVERRIDE_PROPOSED` / `OVERRIDE_APPROVED` / `OVERRIDE_REJECTED` (enum-only; no writers on `origin/main`)

⚠️ **Check carefully**
- Initiate / capture / fail / deposit / withdrawal / recon are **new** business audits (improvement)
- Provider payload remains on `GatewayPayment` / `GatewayPaymentReceipt` / `GatewayWebhookEvent`

**WHAT I SHOULD MANUALLY TEST**
- [ ] Deposit initiate → capture → name check → deposit received
- [ ] Fail / expire / mismatch / refund
- [ ] Investor withdrawal letter → trustee → complete on Payment Audit History
- [ ] Recon exception detect / resolve (inline detail, no nested sheet)
- [ ] Webhook replay still uses `GatewayWebhookEvent`, not Payment audit

### LEGAL

✅ **Preserved**
- Document create / update
- Version upload / file replace / publish / archive / restore
- `/audit` Legal Documents tab
- Acceptances page + `LegalDocumentAcceptance` SOT (IP, UA, hash, acknowledgement text)

🔄 **Replaced**
- `LegalDocumentAuditLog` / `legal_document_audit_logs` → `LegalAdminAuditLog` / `legal_admin_audit_logs`
- `LEGAL_VERSION_*` → `LEGAL_DOCUMENT_VERSION_*`

🗑 **Removed intentionally**
- `LEGAL_REACCEPTANCE_REQUIRED` / orphan-cleanup strings as audit actions (they are error/log codes, not catalogue events)

⚠️ **Check carefully**
- Legal export is CSV **and** JSON (old was CSV-oriented)
- Page size 15 (old legal panel used 20)

**WHAT I SHOULD MANUALLY TEST**
- [ ] Create document, upload version, publish, archive, restore
- [ ] User accept → Legal Acceptances, not Legal admin audit
- [ ] Export CSV and JSON

### PRODUCT

✅ **Preserved**
- Created / updated / inactivated / reactivated / deleted
- `/audit` Product tab, IP, device, export

🔄 **Replaced**
- `ProductLog` / `product_logs` → `ProductAuditLog` / `product_audit_logs`
- Event names prefixed (`CREATED` → `PRODUCT_CREATED`, already prefixed on `origin/main` writers)

**WHAT I SHOULD MANUALLY TEST**
- [ ] Create / update / inactivate / reactivate / delete product
- [ ] Product CSV/JSON export

### NOTIFICATION

✅ **Preserved**
- Admin broadcast record (audience, type, title, message, counts)
- Search / type / audience filters
- IP / device / recipient counts in the **detail sheet**

🔄 **Replaced**
- `NotificationLog` / `notification_logs` → `NotificationBroadcastAuditLog` / `notification_broadcast_audit_logs`
- Settings → Notifications “logs” tab → `/audit` Notifications tab
- One row per send → `NOTIFICATION_BROADCAST_PROCESSED` with targeted/created/skipped/failed

🗑 **Removed intentionally**
- Inline Recipients / IP / Device columns (moved into View details)

⚠️ **Check carefully**
- Preference / type / group mutations are Security events, not Notification broadcast rows

**WHAT I SHOULD MANUALLY TEST**
- [ ] Send a broadcast → Notifications audit tab
- [ ] Open View → IP, device, targeted/created/skipped/failed
- [ ] Settings page no longer hosts the log table

---

## 1. Goal

Answer whether useful functionality, data, metadata, readers, UI, permissions, filters, export, history, or business evidence from `origin/main` disappeared.

This is not limited to the live catalogue (now **177** reserved IDs / **174** active writers; this comparison was written against the A001–A174 cutover). Every old audit/log/history writer and reader found on `origin/main` is classified.

---

## 20. Git evidence (comparison method)

Inspected both sides for every claim below.

```text
git rev-parse origin/main   # cc58bb43dc694a02169ae3c1a5f5afd1ff953d8c
git rev-parse HEAD          # 679a1c4c7405687c7610c146ed6b18e4ffdd2385
git show origin/main:apps/api/prisma/schema.prisma
# current: apps/api/prisma/schema.prisma
```

Old event enums / writers:

| Topic | origin/main path | Current path |
|---|---|---|
| Prisma models | `apps/api/prisma/schema.prisma` | same path, old models gone |
| Application events | `apps/api/src/modules/applications/logs/types.ts` | `apps/api/src/modules/applications/audit/events.ts` |
| Application writers | `apps/api/src/modules/applications/service.ts`, `admin/service.ts` | same + `amendments/service.ts` |
| Note writers | `apps/api/src/modules/notes/service.ts` (`logEvent` / `logAdminAction`) | `notes/audit/writer.ts` + service |
| Prospectus | `apps/api/src/modules/notes/prospectus-review/prospectus-review.service.ts` | same |
| Access/Security writers | `apps/api/src/modules/auth/service.ts`, `cognito.routes.ts` | same + `security/audit/*` |
| Onboarding | `apps/api/src/modules/organization/service.ts`, `admin/service.ts` | `onboarding/audit/*` |
| Payment | Prisma `GatewayPaymentEventType` + payment services | `payment/audit/events.ts` |
| Admin `/audit` | `apps/admin/src/app/audit/page.tsx` | same + `apps/admin/src/lib/audit-tabs.ts` |
| Access table | `apps/admin/src/components/access-logs-table.tsx` | same |
| Note timeline | `apps/admin/src/notes/components/note-timeline-panel.tsx` | same (`extractS3Key` → `null`) |
| Notification logs | `apps/admin/src/app/settings/notifications/page.tsx` | `apps/admin/src/components/audit/notification-logs-panel.tsx` |
| App logs RBAC | `apps/api/src/modules/applications/controller.ts` | same (`applications.view` added) |

Cutover tests document **intentional** drops (not used as authority, only as a map of what current source forbids):

- `apps/api/src/modules/auth/audit/cutover.test.ts`
- `apps/api/src/modules/onboarding/audit/cutover.test.ts`
- `apps/api/src/modules/applications/audit/cutover.test.ts`
- `apps/api/src/modules/notes/audit/cutover.test.ts`
- `apps/api/src/modules/payment/audit/cutover.test.ts`
- `apps/api/src/modules/signing/audit/cutover.test.ts`

---

## 2. Old audit / log models

Discovered on `origin/main` via `git show origin/main:apps/api/prisma/schema.prisma` (not limited to the suggested list).

Also searched for `audit|log|history|event|timeline` models. Related **non-audit** tables kept as SOT: `ApplicationRevision`, `ApplicationReview`, `ApplicationReviewItem`, `ApplicationReviewRemark`, `LegalDocumentAcceptance`, `GatewayPayment`, `GatewayPaymentReceipt`, `GatewayWebhookEvent`, `NoteLedgerEntry`, `NotePayment`, `NoteSettlement`, `InvestorBalanceTransaction`, `SigningEnvelope`, `SigningRecipient`.

There is **no** `InvestorTransaction` model on either side. Cash movements use `InvestorBalanceTransaction` (present on both).

### 2.1 AccessLog

| | origin/main | Current |
|---|---|---|
| Model / table | `AccessLog` / `access_logs` | `AccessAuditLog` / `access_audit_logs` |
| Purpose | Signup/login/logout plus a mixed bag of other event_type strings | Signup/login/logout only |
| Fields | `id`, `user_id` (FK), `event_type`, `ip_address`, `user_agent`, `device_info`, `cognito_event`, `success`, `metadata`, `created_at`, `device_type`, `portal` | `id`, `user_id` (no FK), `event_type`, `occurred_at`, `created_at`, `actor_type`, `actor_user_id`, `organization_id`, `organization_kind`, `target_type`, `target_id`, `source`, `portal`, `ip_address`, `user_agent`, `correlation_id`, `idempotency_key`, `metadata` |
| Events written | `SIGNUP`, `LOGIN`, `LOGOUT`; also `ROLE_ADDED`, `ROLE_REMOVED`, `PROFILE_UPDATED`, `ONBOARDING_RESET` via `createAccessLog` | `USER_SIGNED_UP`, `USER_LOGGED_IN`, `USER_LOGGED_OUT` |
| Writers | `auth/cognito.routes.ts`, `auth/service.ts`, `admin/service.ts` | `cognito.routes.ts`, `auth/service.ts` via `writeAccessAuditLog` |
| Readers / UI | Admin Access tab | Admin Access tab |

**Classification:** REPLACED + IMPROVED (forensic columns) + INTENTIONALLY_REMOVED (`success`, `cognito_event`, mixed event types).

`cognito_event` had **no live writers** on `origin/main` (column only). DEAD_OLD_CODE.

### 2.2 SecurityLog

| | origin/main | Current |
|---|---|---|
| Model / table | `SecurityLog` / `security_logs` | `SecurityAuditLog` / `security_audit_logs` |
| Purpose | Password, email verify, roles, invitations, profile | Same domain, expanded catalogue (org membership, notification prefs, admin 403) |
| Fields | `id`, `user_id` (FK), `event_type`, `ip_address`, `user_agent`, `device_info`, `metadata`, `created_at` | Shared forensic envelope + `subject_user_id` |
| Events written | `PASSWORD_CHANGED`, `EMAIL_CHANGED`, `ROLE_ADDED`, `ROLE_SWITCHED`, `PROFILE_UPDATED`, `ROLE_PERMISSIONS_UPDATED`, `ROLE_CREATED`, `ROLE_REMOVED`, `INVITATION_REVOKED` | 35 `SECURITY_AUDIT_EVENTS` |
| UI | Admin Security tab | Admin Security tab |

**Classification:** REPLACED + IMPROVED.

### 2.3 OnboardingLog

| | origin/main | Current |
|---|---|---|
| Model / table | `OnboardingLog` / `onboarding_logs` | `OnboardingAuditLog` / `onboarding_audit_logs` |
| Purpose | Org/user onboarding lifecycle | Same, plus CTOS/director events in catalogue |
| Extra old fields | `organization_name`, `investor_organization_id`, `issuer_organization_id` (FKs), `device_info`, `device_type` | `onboarding_id`, `subject_user_id`, `organization_kind`, `organization_type`, no FKs |
| UI | Org activity timeline + export button; **no** global `/audit` tab | Org timeline **and** `/audit` Onboarding tab |

**Classification:** REPLACED + IMPROVED (global tab).

### 2.4 ApplicationLog

| | origin/main | Current |
|---|---|---|
| Model / table | `ApplicationLog` / `application_logs` | `ApplicationAuditLog` / `application_audit_logs` |
| Extra old fields | `review_cycle`, `level`, `target`, `action`, `entity_id`, `remark`, `device_info` | Shared forensic envelope; cycle/remark live in metadata + `ApplicationReviewRemark` |
| UI | Admin Recent Activity + issuer timeline + `GET /v1/applications/:id/logs` | Activity + raw Audit History + same route (stricter admin RBAC) |

**Classification:** REPLACED + IMPROVED (documents, review started, archive, draft delete, offer-reject correctness).

### 2.5 ApplicationReviewEvent

| | origin/main | Current |
|---|---|---|
| Model / table | `ApplicationReviewEvent` / `application_review_events` | **gone** |
| Purpose | `CONTRACT_OFFER_SENT`, `INVOICE_OFFER_SENT`, `AMENDMENTS_SUBMITTED` with `old_status` / `new_status` | Same facts on `ApplicationAuditLog` |
| Readers | Passed into Recent Activity on `origin/main` | Activity reads Application audit only |

**Classification:** REPLACED (duplicate of ApplicationLog). SOT for review status remains `ApplicationReview` / `ApplicationReviewItem`.

### 2.6 NoteEvent

| | origin/main | Current |
|---|---|---|
| Model / table | `NoteEvent` / `note_events` | `NoteAuditLog` / `note_audit_logs` |
| Fields | `note_id` FK, `event_type`, `actor_user_id`, `actor_role`, `portal`, `ip_address`, `user_agent`, `correlation_id`, `metadata`, `created_at` | Shared forensic envelope; `note_id` nullable only for trustee signature |
| Writers | `logEvent` / `logAdminAction` in `notes/service.ts`; prospectus `noteEvent.create` | `writeNoteAuditFromActor` |

**Classification:** REPLACED. See Note event matrix for featured / late-charge / `s3Key`.

### 2.7 NoteAdminAction

| | origin/main | Current |
|---|---|---|
| Model / table | `NoteAdminAction` / `note_admin_actions` | **gone** |
| Purpose | Parallel admin snapshot (`action_type`, `reason`, `before_state`, `after_state`) | Material term diffs on `NOTE_TERMS_UPDATED`; publish/funding are single Note audit rows |
| Actions written | `CREATE_FROM_INVOICE`, `UPDATE_DRAFT`, `UPDATE_FEATURED_SETTINGS`, `PUBLISH`, `UNPUBLISH`, `CLOSE_FUNDING`, `FAIL_FUNDING`, `ACTIVATE` | Mapped except featured |

**Classification:** REPLACED for lifecycle; POSSIBLE_LOSS for featured before/after snapshots (Note SOT has **current** featured fields only).

### 2.8 GatewayPaymentEvent

| | origin/main | Current |
|---|---|---|
| Model / table | `GatewayPaymentEvent` / `gateway_payment_events` | `PaymentAuditLog` / `payment_audit_logs` |
| Enum | 11 types including unused `OVERRIDE_*` | 19 payment events |
| Fields | `from_status`, `to_status`, `reason`, `metadata` | Forensic envelope; status/reason in metadata |
| Technical sibling | `GatewayWebhookEvent` | **still present** |

**Classification:** REPLACED + IMPROVED (initiate/capture/fail/deposit/withdrawal/recon). `OVERRIDE_*` = DEAD_OLD_CODE.

### 2.9 GatewayWebhookEvent

**Classification:** PRESERVED. Still `gateway_webhook_events`. Not a business-audit table.

### 2.10 ProductLog

| | origin/main | Current |
|---|---|---|
| Model / table | `ProductLog` / `product_logs` | `ProductAuditLog` / `product_audit_logs` |
| Events | `PRODUCT_CREATED` / `UPDATED` / `INACTIVATED` / `REACTIVATED` / `DELETED` | Same five |

**Classification:** REPLACED (same events, richer envelope).

### 2.11 LegalDocumentAuditLog

| | origin/main | Current |
|---|---|---|
| Model / table | `LegalDocumentAuditLog` / `legal_document_audit_logs` | `LegalAdminAuditLog` / `legal_admin_audit_logs` |
| Extra old fields | `actor_name_snapshot`, `actor_email_snapshot`, `before_json`, `after_json`, `reason`, `document_hash`, `version_number` as columns | Snapshots / before-after / hash live in `metadata`; actor snapshots still loaded |

**Classification:** REPLACED. Acceptance evidence was never this table — it is `LegalDocumentAcceptance` on both sides.

### 2.12 NotificationLog

| | origin/main | Current |
|---|---|---|
| Model / table | `NotificationLog` / `notification_logs` | `NotificationBroadcastAuditLog` / `notification_broadcast_audit_logs` |
| Extra old fields | `admin_user_id` FK, `title`, `message`, `recipient_count`, `target_type`, `target_group_id`, `notification_type_id` as columns | `audience_type`, `notification_type_id` as columns; title/message/counts in metadata + DTO |
| UI | Settings → Notifications → logs tab | `/audit` Notifications tab |

**Classification:** REPLACED + MOVED (UI). Counts are **more** detailed (targeted/created/skipped/failed).

---

## 5. Top-level audit data

| Field | origin/main | Current | Verdict |
|---|---|---|---|
| actor | `user_id` / `actor_user_id` (often FK) | `actor_type` + `actor_user_id` + name/email snapshots in metadata | MORE |
| subject | implied `user_id` | `subject_user_id` (Security/Onboarding) | MORE |
| organization | Onboarding FKs + some metadata | `organization_id` + `organization_kind` on all new tables | MORE |
| target | Application `entity_id`; else implied | `target_type` + `target_id` | MORE |
| source | absent | `source` (`API`, webhook, system) | MORE |
| portal | some tables | all business audit tables | MORE |
| IP | most tables | all | SAME |
| user agent | most tables | all | SAME |
| device | stored `device_info` / `device_type` | derived at read time from user agent | SAME (derived) |
| correlation id | Note, NoteAdminAction, Legal | all new tables | MORE |
| idempotency | absent (except payment flows in SOT) | `idempotency_key` (unique on Payment) | MORE |
| occurred vs created | `created_at` only | `occurred_at` + `created_at` | MORE |
| success flag | Access `success` | Access success-only; failures are distinct Security events | SAME evidence, different shape |
| FK survival | most old logs FK-cascade on user delete | no User/Application/Note FKs | MORE (survives deletion) |

**Forensic context: MORE than origin/main.**

---

## 3–4 / H–I. Old → new event matrix and metadata

Status values: `EXACT_EQUIVALENT` | `RENAMED` | `SPLIT_INTO_MULTIPLE_EVENTS` | `MERGED_INTO_EVENT` | `REPLACED_BY_SOT` | `INTENTIONALLY_NOT_AUDITED` | `REMOVED_DEAD_EVENT` | `POSSIBLE_LOSS` | `UNKNOWN`

Metadata status: `PRESERVED` | `RENAMED` | `MORE_DETAILED_NOW` | `MOVED_TO_TOP_LEVEL` | `AVAILABLE_FROM_SOT` | `INTENTIONALLY_REMOVED` | `POSSIBLE_DATA_LOSS`

### Access / Security

| Old event | Old table | Old trigger | Old metadata / extras | Old UI | Current event(s) | Current table | Current UI | Status | Difference | Risk |
|---|---|---|---|---|---|---|---|---|---|---|
| `SIGNUP` | `access_logs` | Cognito OAuth first login | portal, roles, requested/active role | Access | `USER_SIGNED_UP` | `access_audit_logs` | Access | RENAMED | `loginMethod: COGNITO_OAUTH`, actor snapshots | Low |
| `LOGIN` success | `access_logs` | Cognito OAuth | same | Access | `USER_LOGGED_IN` | `access_audit_logs` | Access | RENAMED | `syncUser` no longer writes login (OAuth callback only) | Low |
| `LOGIN` `success: false` | `access_logs` | Admin Cognito gate (no ADMIN role / inactive) | `requestedRole`, `hasAdminRole`, `adminStatus`, `wasPreviouslyAdmin`, reason | Access Status=failed | `ADMIN_ACCESS_DENIED` | `security_audit_logs` | Security | RENAMED | Cognito gate: `actor_type USER` + `MISSING_ADMIN_ROLE`, or `actor_type ADMIN` + `ADMIN_INACTIVE`; `portal=ADMIN` is where, not who. Also 403 middleware: `actor_type ADMIN` + `INSUFFICIENT_PERMISSIONS` | Low — **moved**, not dropped |
| `LOGOUT` | `access_logs` | AuthService + GET `/logout` | portal | Access | `USER_LOGGED_OUT` | `access_audit_logs` | Access | RENAMED | Portal UIs call Cognito GET `/logout` only (one row). Two rows only if both POST `/v1/auth/logout` and GET `/logout` run. GET portal: valid `?portal=` → Origin/Referer hostname → `null` (not `user.roles[0]`). AuthService still uses `activeRole` / `session.active_role`. | Low |
| `PASSWORD_CHANGED` success | `security_logs` | `changePassword` after Cognito | | Security | `PASSWORD_CHANGED` | `security_audit_logs` | Security | EXACT_EQUIVALENT | | Low |
| `PASSWORD_CHANGED` fail | `security_logs` | same event + `success: false` | `error` | Security | `PASSWORD_CHANGE_FAILED` | `security_audit_logs` | Security | SPLIT_INTO_MULTIPLE_EVENTS | Distinct event | Low |
| `EMAIL_CHANGED` success | `security_logs` | `verifyEmail` (`reason: EMAIL_VERIFIED`) | `email` | Security | `USER_EMAIL_VERIFIED` | `security_audit_logs` | Security | RENAMED | **Not** an email-address-change event on either side | Low |
| `EMAIL_CHANGED` fail | `security_logs` | verify fail | `reason: VERIFICATION_FAILED` | Security | `EMAIL_VERIFICATION_FAILED` | `security_audit_logs` | Security | RENAMED | `reasonCode` INVALID_CODE / EXPIRED_CODE / … | Low |
| `ROLE_ADDED` | access + security | `addRole` | | both | `USER_ROLE_ADDED` | `security_audit_logs` | Security | RENAMED | No longer written to Access | Low |
| `ROLE_REMOVED` | access/security | admin role updates | | Security | `USER_ROLES_UPDATED` / `ADMIN_USER_ROLE_CHANGED` / `ADMIN_ROLE_DELETED` | `security_audit_logs` | Security | SPLIT_INTO_MULTIPLE_EVENTS | | Low |
| `ROLE_SWITCHED` | security | `switchRole` | | Security | `ACTIVE_ROLE_CHANGED` | `security_audit_logs` | Security | RENAMED | | Low |
| `PROFILE_UPDATED` | access/security | user or admin | | both | `USER_PROFILE_UPDATED` / `USER_PROFILE_UPDATED_BY_ADMIN` | `security_audit_logs` | Security | SPLIT_INTO_MULTIPLE_EVENTS | | Low |
| `ROLE_CREATED` | security | create admin role | | Security | `ADMIN_ROLE_CREATED` | `security_audit_logs` | Security | RENAMED | | Low |
| `ROLE_PERMISSIONS_UPDATED` | security | update permissions | | Security | `ADMIN_ROLE_PERMISSIONS_UPDATED` | `security_audit_logs` | Security | RENAMED | | Low |
| `INVITATION_REVOKED` | security | revoke admin invite | | Security | `ADMIN_INVITATION_REVOKED` | `security_audit_logs` | Security | RENAMED | Create/resend/accept now also audited | Low |
| `ONBOARDING_RESET` on Access | `access_logs` | admin reset | | Access | `ONBOARDING_RESET` | `onboarding_audit_logs` | Onboarding | RENAMED | Correct module | Low |
| Filter label `KYC_STATUS_UPDATED` | Access toolbar only | no Access writer found | | Access filter | `DIRECTOR_KYC_STATUS_UPDATED` | `onboarding_audit_logs` | Onboarding | RENAMED | Was a filter label, not a live Access writer | Low |
| Generic password-login failure | — | Cognito hosted UI; **no** Access writer | | — | none | — | — | INTENTIONALLY_NOT_AUDITED | 401s still not audited (same as `origin/main`) | None |

**Access/Security metadata highlights**

| Old field | Old source | Current field | Current source | Status |
|---|---|---|---|---|
| `ip_address` | request | `ip_address` | request | PRESERVED |
| `user_agent` | request | `user_agent` | request | PRESERVED |
| `device_info` | stored string | `deviceInfo` on DTO | parsed from UA | PRESERVED |
| `success` | Access column | distinct fail events | writer | RENAMED |
| `email` + `reason` | Security metadata | `email` + `reasonCode` | Security metadata | RENAMED |
| `requestedRole` / `activeRole` | Access metadata | same + `roles` + `loginMethod` | Access metadata | MORE_DETAILED_NOW |
| `cognito_event` | unused column | — | — | INTENTIONALLY_REMOVED (never written) |

### Onboarding

| Old event | Old table | Old trigger | Current event(s) | Status | Where the fact lives now | Risk |
|---|---|---|---|---|---|---|
| `ONBOARDING_STARTED` | `onboarding_logs` | start session | `ONBOARDING_STARTED` | EXACT_EQUIVALENT | Onboarding audit | Low |
| `ONBOARDING_RESUMED` | `onboarding_logs` | resume | `ONBOARDING_RESUMED` | EXACT_EQUIVALENT | Onboarding audit | Low |
| `ONBOARDING_CANCELLED` | `onboarding_logs` | **admin restart only** (`auth/service.ts` comments on `origin/main`) | `ONBOARDING_RESTARTED` | RENAMED | metadata `ADMIN_RESTART` / expired / stale | Low |
| `ONBOARDING_STATUS_UPDATED` | `onboarding_logs` | status machine | `ONBOARDING_STATUS_CHANGED` / `USER_ONBOARDING_STATUS_UPDATED` | SPLIT_INTO_MULTIPLE_EVENTS | Onboarding audit; org `onboarding_status` SOT | Low |
| `ONBOARDING_APPROVED` | `onboarding_logs` | admin approve | `ONBOARDING_APPROVED` | EXACT_EQUIVALENT | Does not also emit status-changed (deduped) | Low |
| `ONBOARDING_REJECTED` | `onboarding_logs` | reject | `ONBOARDING_REJECTED` | EXACT_EQUIVALENT | | Low |
| `ONBOARDING_RESET` | access + onboarding | admin reset | `ONBOARDING_RESET` | EXACT_EQUIVALENT | metadata `statusScope: USER_ACCOUNT_MARKER` | Low |
| `FINAL_APPROVAL_COMPLETED` | `onboarding_logs` | admin final | `ONBOARDING_FINAL_APPROVAL_COMPLETED` | RENAMED | | Low |
| `USER_COMPLETED` | `onboarding_logs` | legacy complete | `ONBOARDING_COMPLETED` | RENAMED | `LEGACY_COMPLETE_ONBOARDING` | Low |
| `AML_APPROVED` | `onboarding_logs` | admin AML | `AML_APPROVED` | EXACT_EQUIVALENT | | Low |
| `SSM_APPROVED` | `onboarding_logs` | admin SSM | `SSM_APPROVED` | EXACT_EQUIVALENT | | Low |
| `SOPHISTICATED_STATUS_UPDATED` | `onboarding_logs` | admin | `INVESTOR_SOPHISTICATED_STATUS_UPDATED` | RENAMED | | Low |
| `TNC_APPROVED` | `onboarding_logs` | `acceptTnc` | none | REPLACED_BY_SOT | `LegalDocumentAcceptance` (hash, IP, UA, acknowledgement, snapshots) + `tnc_accepted` | None — **richer SOT** |
| `TNC_ACCEPTED` | union-only | no writer | none | REMOVED_DEAD_EVENT | same SOT | None |
| `FORM_FILLED` | `onboarding_logs` | form webhook | none | INTENTIONALLY_NOT_AUDITED | RegTank / org onboarding JSON SOT | Low |
| `COD_REJECTED` | raw write | COD webhook | `DIRECTOR_KYC_STATUS_UPDATED` when status changes | REPLACED_BY_SOT | `corporate_individual_kyc.status` | Low |
| `KYC_APPROVED` / `KYB_APPROVED` | union-only | no writer | none | REMOVED_DEAD_EVENT | RegTank SOT + director KYC event | None |
| Raw `WEBHOOK_*` / `EOD_*` | occasional raw | webhooks | none | INTENTIONALLY_NOT_AUDITED | webhook handlers + RegTank tables | Low |

Logout still calls `cancelOnboarding` and still does **not** write a cancel audit (`origin/main` comments said cancel logs are only for admin restart).

### Application

Old enum: `git show origin/main:apps/api/src/modules/applications/logs/types.ts` (`ApplicationLogEventType`).

| Old event | Status | Current event(s) | Difference / SOT | Risk |
|---|---|---|---|---|
| `APPLICATION_CREATED` | EXACT_EQUIVALENT | `APPLICATION_CREATED` | | Low |
| `APPLICATION_SUBMITTED` | EXACT_EQUIVALENT | `APPLICATION_SUBMITTED` | | Low |
| `APPLICATION_RESUBMITTED` | EXACT_EQUIVALENT | `APPLICATION_RESUBMITTED` | Written once in amendments (not PATCH status) | Low |
| `APPLICATION_APPROVED` | REMOVED_DEAD_EVENT | none | Enum only; never written | None |
| `APPLICATION_REJECTED` | EXACT_EQUIVALENT | `APPLICATION_REJECTED` | | Low |
| `APPLICATION_WITHDRAWN` | EXACT_EQUIVALENT | `APPLICATION_WITHDRAWN` | | Low |
| `APPLICATION_COMPLETED` | EXACT_EQUIVALENT | `APPLICATION_COMPLETED` | | Low |
| `APPLICATION_RESET_TO_UNDER_REVIEW` | RENAMED | `APPLICATION_REOPENED_FOR_REVIEW` | | Low |
| `SECTION_REVIEWED_*` | MERGED_INTO_EVENT | `APPLICATION_SECTION_REVIEW_UPDATED` | `previousStatus` / `newStatus` / scope in metadata; skip no-ops | Low |
| `ITEM_REVIEWED_*` | MERGED_INTO_EVENT | `APPLICATION_ITEM_REVIEW_UPDATED` | same | Low |
| `CONTRACT_OFFER_SENT` | EXACT_EQUIVALENT | `CONTRACT_OFFER_SENT` | Also dropped duplicate `ApplicationReviewEvent` | Low |
| `CONTRACT_OFFER_ACCEPTANCE_SUBMITTED` | RENAMED | `CONTRACT_ACCEPTANCE_SUBMITTED` | | Low |
| `CONTRACT_OFFER_ACCEPTANCE_RESUBMITTED` | RENAMED | `CONTRACT_ACCEPTANCE_RESUBMITTED` | | Low |
| `CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING` | EXACT_EQUIVALENT | `CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING` | | Low |
| `CONTRACT_OFFER_ACCEPTED` | EXACT_EQUIVALENT | `CONTRACT_OFFER_ACCEPTED` | `DIRECT_ACCEPTANCE` vs `SIGNING_COMPLETION` | Low — **more** detail |
| `CONTRACT_OFFER_REJECTED` | EXACT_EQUIVALENT | `CONTRACT_OFFER_REJECTED` | Old **live** issuer reject wrote `CONTRACT_WITHDRAWN`; current writes reject | Low — **fixed** |
| `CONTRACT_OFFER_RETRACTED` | EXACT_EQUIVALENT | `CONTRACT_OFFER_RETRACTED` | | Low |
| `CONTRACT_OFFER_EXPIRED` | EXACT_EQUIVALENT | `CONTRACT_OFFER_EXPIRED` | Job still writes in the same transaction | Low |
| `CONTRACT_SIGNING_DEADLINE_EXTENDED` | EXACT_EQUIVALENT | `CONTRACT_SIGNING_DEADLINE_EXTENDED` | | Low |
| `CONTRACT_WITHDRAWN` | EXACT_EQUIVALENT | `CONTRACT_WITHDRAWN` | Used for true withdraw, not reject | Low |
| `CONTRACT_CUSTOMER_LARGE_PRIVATE_UPDATED` | EXACT_EQUIVALENT | `CONTRACT_CUSTOMER_LARGE_PRIVATE_UPDATED` | Written on `origin/main` even though not in the enum | Low |
| Invoice `INVOICE_*` twins | same mapping as contract | `INVOICE_*` | | Low |
| `AMENDMENTS_SUBMITTED` | SPLIT_INTO_MULTIPLE_EVENTS | `APPLICATION_RESUBMITTED` + `APPLICATION_AMENDMENT_ACKNOWLEDGED` | Remarks SOT: `ApplicationReviewRemark` | Low |
| `SIGNING_PACKAGE_CREATED/SENT/COMPLETED/VOIDED` | RENAMED (module) | same names on `SigningAuditLog` | Merged into Application Audit History reader | Low |

**New on current (not losses):** `APPLICATION_REVIEW_STARTED`, `APPLICATION_AMENDMENTS_REQUESTED`, `APPLICATION_ARCHIVED`, `APPLICATION_DRAFT_DELETED`, `APPLICATION_DOCUMENT_*`, `CONTRACT_ACCEPTANCE_CHANGES_REQUESTED`, `INVOICE_ACCEPTANCE_CHANGES_REQUESTED`, plus signing recipient/eKYC/reminder/expired.

**Application metadata**

| Old field | Current | Status |
|---|---|---|
| `remark` column | `ApplicationReviewRemark` + metadata on review events | AVAILABLE_FROM_SOT / PRESERVED |
| `review_cycle` | metadata | MOVED_TO_TOP_LEVEL (metadata) |
| `old_status` / `new_status` (review event table) | `previousStatus` / `newStatus` | RENAMED |
| `scope` / `scope_key` | metadata + `target_type` REVIEW_SECTION / REVIEW_ITEM | PRESERVED |
| `level` / `target` / `action` | unused (deprecated on `origin/main`) | INTENTIONALLY_REMOVED |
| IP / UA / portal | top-level | PRESERVED |

### Signing (old lived on ApplicationLog)

| Old | Current | Status |
|---|---|---|
| `SIGNING_PACKAGE_CREATED` | `SIGNING_PACKAGE_CREATED` | EXACT_EQUIVALENT |
| `SIGNING_PACKAGE_SENT` | `SIGNING_PACKAGE_SENT` | EXACT_EQUIVALENT |
| `SIGNING_PACKAGE_COMPLETED` | `SIGNING_PACKAGE_COMPLETED` | EXACT_EQUIVALENT |
| `SIGNING_PACKAGE_VOIDED` | `SIGNING_PACKAGE_VOIDED` | EXACT_EQUIVALENT |

Envelope / recipient / assignment SOT: `SigningEnvelope`, `SigningRecipient` (both sides).

### Note

Writers on `origin/main`: `logEvent` / `logAdminAction` in `apps/api/src/modules/notes/service.ts`; prospectus `noteEvent.create` with `event_type: actionType`.

| Old event / action | Status | Current | SOT / notes | Risk |
|---|---|---|---|---|
| `NOTE_CREATED_FROM_INVOICE` + `CREATE_FROM_INVOICE` | RENAMED | `NOTE_CREATED` | `sourceType: "INVOICE"` | Low |
| `UPDATE_DRAFT` | RENAMED | `NOTE_TERMS_UPDATED` | `changedFields` / material terms only | Low |
| `UPDATE_FEATURED_SETTINGS` | POSSIBLE_LOSS | none | `Note.is_featured`, `featured_rank`, `featured_from`, `featured_until` — **current state only** | Medium — no who/when history |
| `PUBLISH` | RENAMED | `NOTE_PUBLISHED` | | Low |
| `UNPUBLISH` | RENAMED | `NOTE_UNPUBLISHED` | | Low |
| `CLOSE_FUNDING` | RENAMED | `NOTE_FUNDING_CLOSED` | ledger SOT `NoteLedgerEntry` | Low |
| `FAIL_FUNDING` | RENAMED | `NOTE_FUNDING_FAILED` | | Low |
| `ACTIVATE` | RENAMED | `NOTE_ACTIVATED` | | Low |
| `INVESTMENT_COMMITTED` | EXACT_EQUIVALENT | `INVESTMENT_COMMITTED` | `InvestorBalanceTransaction` debit | Low |
| `ISSUER_DISBURSEMENT_WITHDRAWAL_CREATED` | RENAMED | `DISBURSEMENT_INITIATED` | `WithdrawalInstruction` | Low |
| `ISSUER_PAYMENT_SUBMITTED` | RENAMED | `REPAYMENT_SUBMITTED` | `NotePayment` | Low |
| `PAYMENT_RECEIVED` | RENAMED | `REPAYMENT_RECEIVED` | `NotePayment` | Low |
| `PAYMENT_APPROVED` | MERGED_INTO_EVENT | `REPAYMENT_RECEIVED` (admin-recorded receive) | `NotePayment` status | Low |
| `PAYMENT_REJECTED` | RENAMED | `REPAYMENT_REJECTED` | | Low |
| `SETTLEMENT_PREVIEWED` | EXACT_EQUIVALENT | `SETTLEMENT_PREVIEWED` | `NoteSettlement`; snapshot no longer dumped raw | Low |
| `SETTLEMENT_APPROVED` | EXACT_EQUIVALENT | `SETTLEMENT_APPROVED` | | Low |
| `SETTLEMENT_POSTED` | EXACT_EQUIVALENT | `SETTLEMENT_POSTED` | ledger `postSettlementLedger` | Low |
| `OVERDUE_LATE_CHARGE_CHECKED` | POSSIBLE_LOSS (no-op checks) | `NOTE_SERVICING_STATUS_CHANGED` **only if** status changes | `Note.servicing_status`, `arrears_started_at`, settlement tawidh/gharamah | Low–Medium |
| `LATE_CHARGE_APPROVED` | POSSIBLE_LOSS | none | Old writer also did **not** persist — only logged `calculateLateCharge` result. Actual fees on `NoteSettlement` | Medium (breadcrumb only) |
| `ARREARS_LETTER_GENERATED` / `DEFAULT_LETTER_GENERATED` | EXACT_EQUIVALENT / RENAMED | `ARREARS_LETTER_GENERATED` / `DEFAULT_NOTICE_GENERATED` | metadata `fileName`+`fileHash`; **no** `s3Key` | Medium UI |
| `SERVICE_FEE_TRUSTEE_LETTER_GENERATED` | EXACT_EQUIVALENT | same | | Low |
| `SERVICE_FEE_TRUSTEE_LETTER_SUBMITTED` | RENAMED | `SERVICE_FEE_TRUSTEE_SUBMITTED` | | Low |
| `SERVICE_FEE_TRUSTEE_INSTRUCTION_COMPLETED` | RENAMED | `SERVICE_FEE_TRUSTEE_COMPLETED` | | Low |
| `NOTE_DEFAULT_MARKED` | RENAMED | `NOTE_MARKED_DEFAULT` | | Low |
| `WITHDRAWAL_LETTER_GENERATED` (issuer/residual) | SPLIT_INTO_MULTIPLE_EVENTS | `DISBURSEMENT_LETTER_GENERATED` / `RESIDUAL_RETURN_LETTER_GENERATED` | `WithdrawalInstruction.letter_s3_key` | Low |
| `WITHDRAWAL_*` investor | RENAMED (module) | `INVESTOR_WITHDRAWAL_*` on Payment | Payment audit | Low |
| `WITHDRAWAL_BENEFICIARY_UPDATED` | RENAMED | `DISBURSEMENT_BENEFICIARY_UPDATED` (issuer) | Investor beneficiary is Payment | Low |
| `WITHDRAWAL_SUBMITTED_TO_TRUSTEE` | RENAMED | `DISBURSEMENT_SUBMITTED_TO_TRUSTEE` / residual / investor payment | | Low |
| `WITHDRAWAL_COMPLETED` | RENAMED | `DISBURSEMENT_COMPLETED` / residual / investor | | Low |
| `SHORAKA_ORDER_SUBMITTED` | EXACT_EQUIVALENT | `SHORAKA_ORDER_SUBMITTED` | Shoraka order SOT | Low |
| `SHORAKA_CERTIFICATE_FETCHED` | RENAMED | `SHORAKA_CERTIFICATE_RECEIVED` | `certificate_file_sha256`; no callback payload | Low |
| `PROSPECTUS_REVIEW_CREATE` | RENAMED | `NOTE_PROSPECTUS_REVIEW_CREATED` | | Low |
| `PROSPECTUS_REVIEW_APPROVE` | RENAMED | `NOTE_PROSPECTUS_APPROVED` | | Low |
| `PROSPECTUS_APPROVAL_INVALIDATED_*` | RENAMED | `NOTE_PROSPECTUS_INVALIDATED` | | Low |
| `PROSPECTUS_REVIEW_DRAFT_UPDATE` | INTENTIONALLY_NOT_AUDITED | none (invalidation still audited) | prospectus review draft SOT | Low |
| `ISSUER_RESIDUAL_WITHDRAWAL_CREATED` | REMOVED_DEAD_EVENT | residual letter/submit/complete | No create writer on `origin/main` | None |

**Note letter metadata**

| Old | Current | Status |
|---|---|---|
| `s3Key` in NoteEvent metadata | not stored on audit | INTENTIONALLY_REMOVED from audit |
| — | `fileName`, `fileHash` | MORE_DETAILED_NOW (integrity) |
| Withdrawal `letter_s3_key` | still on `WithdrawalInstruction` | AVAILABLE_FROM_SOT |
| Arrears/default letter key | generate API still returns `{ s3Key }`; **no** note column | POSSIBLE_DATA_LOSS **only if** you reconstruct the letter from the audit row alone |

Timeline: `extractS3Key` currently returns `null` (`apps/admin/src/notes/components/note-timeline-panel.tsx`). Download from the **generate** action still works (`late-default-panel.tsx` uses `result.s3Key`).

### Payment

| Old `GatewayPaymentEventType` | Status | Current | Notes |
|---|---|---|---|
| `NAME_CHECK` | RENAMED | `PAYMENT_NAME_CHECK_PENDING` | |
| `NAME_CHECK_APPROVED` | RENAMED | `PAYMENT_NAME_CHECK_APPROVED` | |
| `NAME_CHECK_REJECTED` | RENAMED | `PAYMENT_NAME_CHECK_REJECTED` | |
| `OVERRIDE_*` (3) | REMOVED_DEAD_EVENT | none | No writers on `origin/main` |
| `REFUND_INITIATED` | RENAMED | `PAYMENT_REFUND_INITIATED` | |
| `REFUNDED` | RENAMED | `PAYMENT_REFUNDED` | |
| `EXPIRED` | RENAMED | `PAYMENT_EXPIRED` | |
| `CAPTURE_MISMATCH` | RENAMED | `PAYMENT_CAPTURE_MISMATCH_DETECTED` | |
| `REFUND_WALLET_REVERSAL_FAILED` | RENAMED | `PAYMENT_REFUND_WALLET_REVERSAL_FAILED` | |

**New (not losses):** `PAYMENT_INITIATED`, `PAYMENT_CAPTURED`, `PAYMENT_FAILED`, `INVESTOR_DEPOSIT_RECEIVED`, `INVESTOR_WITHDRAWAL_*`, `PAYMENT_RECONCILIATION_EXCEPTION_*`.

Provider identifiers: `GatewayPayment`, `GatewayPaymentReceipt`, `GatewayWebhookEvent` (payload, signature, event_id). Business audit is not the provider dump — that is intentional.

### Product / Legal / Notification

| Old | Current | Status |
|---|---|---|
| `PRODUCT_CREATED` … `PRODUCT_DELETED` | same names | EXACT_EQUIVALENT |
| `LEGAL_DOCUMENT_CREATED` / `UPDATED` | same | EXACT_EQUIVALENT |
| `LEGAL_VERSION_UPLOADED` | `LEGAL_DOCUMENT_VERSION_UPLOADED` | RENAMED |
| `LEGAL_VERSION_FILE_REPLACED` | `LEGAL_DOCUMENT_VERSION_FILE_REPLACED` | RENAMED |
| `LEGAL_VERSION_PUBLISHED` | `LEGAL_DOCUMENT_VERSION_PUBLISHED` | RENAMED |
| `LEGAL_VERSION_ARCHIVED` | `LEGAL_DOCUMENT_VERSION_ARCHIVED` | RENAMED |
| `LEGAL_VERSION_RESTORED` | `LEGAL_DOCUMENT_VERSION_RESTORED` | RENAMED |
| `LEGAL_REACCEPTANCE_REQUIRED` | error code, not audit | REMOVED_DEAD_EVENT |
| `LEGAL_DOCUMENT_UPLOAD_ORPHAN_CLEANUP_FAILED` | logger code | REMOVED_DEAD_EVENT |
| NotificationLog row | `NOTIFICATION_BROADCAST_PROCESSED` | RENAMED + MORE_DETAILED_NOW |

Legal `before_json` / `after_json` / `document_hash` / actor snapshots → metadata / DTO. PRESERVED.

Notification `recipient_count` → `targetedCount` / `createdCount` / `skippedCount` / `failedCount`. MORE_DETAILED_NOW.

---

## 6 / J. Old UI surface inventory

| Portal | Page | Component (origin/main) | Data source | Classification | Current |
|---|---|---|---|---|---|
| Admin | `/audit` | 4 tabs: Access, Security, Products, Legal Documents | old log tables | IMPROVED | 6 tabs; title “Audit Logs” |
| Admin | `/audit` Access | `AccessLogsPanel` | AccessLog | REPLACED | AccessAuditLog; **Status column removed** |
| Admin | `/audit` Security | `SecurityLogsPanel` | SecurityLog | IMPROVED | Security export works |
| Admin | `/audit` Product | `ProductLogsPanel` | ProductLog | SAME | ProductAuditLog |
| Admin | `/audit` Legal | `LegalDocumentAuditPanel` | LegalDocumentAuditLog | IMPROVED | CSV+JSON; page size 15 |
| Admin | — | no Onboarding tab | org timeline only | IMPROVED | `/audit?tab=onboarding` |
| Admin | Settings → Notifications logs | table with IP/Device/recipients | NotificationLog | MOVED | `/audit` Notifications; IP/device in detail sheet |
| Admin | Org detail | `OrganizationActivityTimeline` | OnboardingLog | REPLACED | OnboardingAuditLog |
| Admin | Application detail | `RecentActivityCard` (+ review events) | ApplicationLog + ApplicationReviewEvent | REPLACED | Application audit only; plus raw Audit History panel |
| Admin | Note detail | `note-timeline-panel` | NoteEvent | REPLACED | NoteAuditLog; letter download from `s3Key` gone |
| Admin | Gateway payment | curated `from → to` timeline | GatewayPaymentEvent | REPLACED | `ContextualAuditHistoryPanel` labeled Audit History |
| Admin | Withdrawal / Recon / Trustee | limited or none | mixed | IMPROVED | contextual raw Audit History |
| Admin | Legal Acceptances | `/legal-document-acceptances` | LegalDocumentAcceptance | SAME | still present |
| Admin | Finance buckets | ledger activity | NoteLedgerEntry | SAME | not an audit table |
| Issuer | `/activity` | `IssuerActivityList` | activity aggregator | SAME / IMPROVED | adapters read new tables |
| Issuer | Application | `application-timeline` | application logs | REPLACED | new logs API |
| Investor | `/activity` | activity page | activity aggregator | IMPROVED | shared empty state + clear filters |

If `origin/main` showed a field that the current **page** does not:

| Missing on page | Still in raw Audit History / detail? | Label |
|---|---|---|
| Access Status column | Admin-gate failures on Security detail | MOVED_TO_RAW_AUDIT (other tab) |
| Notification IP / Device / recipient count | Notification detail sheet | MOVED_TO_RAW_AUDIT |
| Gateway from/to prose | Payment audit metadata + SOT status | MOVED_TO_RAW_AUDIT |
| Note timeline letter `s3Key` | **No** on audit row; withdrawal SOT yes; arrears/default generate response only | POSSIBLE_UI_LOSS |

---

## 7. Admin global `/audit`

| Capability | origin/main | Current | Flag |
|---|---|---|---|
| Tabs | Access, Security, Products, Legal Documents | + Onboarding + Notifications | IMPROVED |
| Access columns | User, Event, IP, Device, **Status** | Actor, Event, IP, Device, Actions | Status **removed** (Access is success-only) |
| Access filters | search, event, **status**, date | search, event, date; `showStatusFilter={false}` | Status filter hidden |
| Access export | CSV | CSV | SAME |
| Security export | toolbar reused Access export wiring | `exportKind="security"` | IMPROVED (was broken/wrong) |
| Product export | CSV/JSON | CSV/JSON | SAME |
| Legal export | CSV-oriented | CSV + JSON | IMPROVED |
| Legal page size | 20 | 15 | Difference only |
| Onboarding | not on `/audit` | tab + CSV export | IMPROVED |
| Notifications | Settings | `/audit` tab | MOVED |
| Detail | dialogs | `AuditLogDetailSheet` (IP, UA, device, correlation, metadata JSON) | IMPROVED |
| Ordering | created_at | `occurred_at DESC, id DESC` | IMPROVED |
| Truncation | — | 10k export header | IMPROVED |

---

## 8–12. Module deep compares (summary)

Covered in the beginner section and event matrix. Extra proofs:

**Application SOT still present:** `ApplicationRevision`, `ApplicationReview`, `ApplicationReviewItem`, `ApplicationReviewRemark` (cycle-scoped unique). Resubmit comparison reads remarks SOT, not audit (`applications/audit/cutover.test.ts` asserts this against current source).

**Note SOT still present:** `Note`, `NotePayment`, `NoteSettlement`, `NoteLedgerEntry`, `WithdrawalInstruction`, prospectus review rows, Shoraka order/certificate hashes.

**Payment SOT still present:** `GatewayPayment`, `GatewayPaymentReceipt`, `GatewayWebhookEvent`, `InvestorBalanceTransaction`.

**TNC / legal SOT:** `LegalDocumentAcceptance` includes `opened_*` / `accepted_*` IP/UA/device, `document_hash`, `acknowledgement_text`, name/email/org snapshots. This is **more** than old `TNC_APPROVED` onboarding metadata.

---

## 13 / K. RBAC

| Surface | origin/main permission | Current permission | Change |
|---|---|---|---|
| `/audit` Access | `audit.access.view` | `audit.access.view` | SAME |
| `/audit` Security | `audit.security.view` | `audit.security.view` | SAME |
| `/audit` Product | `audit.product.view` | `audit.product.view` | SAME |
| `/audit` Legal | `document_management.view` | `document_management.view` | SAME |
| `/audit` Onboarding | n/a (org page used `onboarding.view`) | `onboarding.view` | SAME scope, new surface |
| `/audit` Notifications | Settings used `notifications.view` | `notifications.view` | SAME |
| `GET /v1/applications/:id/logs` as Admin | any authenticated `ADMIN` role | `applications.view` | **MORE_RESTRICTIVE** |
| Signing envelope admin logs | admin role | `applications.view` | **MORE_RESTRICTIVE** |
| Issuer own application logs | owner | owner | SAME |
| Investor note activity | note membership | active membership `COMMITTED\|CONFIRMED\|SETTLED` (plus `RELEASED` for funding-failed) | MORE_RESTRICTIVE (excludes cancelled) |

**No LESS_RESTRICTIVE change found.** Nothing to flag as HIGH for loosened RBAC.

---

## 14. Export / filter / search

| Capability | origin/main | Current | Flag |
|---|---|---|---|
| Access CSV | yes | yes | SAME |
| Access search / event / date | yes | yes | SAME |
| Access status filter | yes (success/failed) | hidden; `failed` matches nothing | INTENTIONAL (no Access fail rows) |
| Security CSV | intended; wired like Access | dedicated Security export | IMPROVED |
| Onboarding CSV | export button on org tools | global tab + export | IMPROVED |
| Product CSV/JSON | yes | yes | SAME |
| Legal CSV | yes | CSV+JSON | IMPROVED |
| Notification list filters | search, type, target | search, type, audience | SAME |
| Notification page size | 10 | 15 | IMPROVED |
| Pagination | yes | yes; Application/Note admin audit-history now paginated | IMPROVED |
| Contextual export | limited | raw history panels | IMPROVED |

No accidental removal of CSV/search/date/event/org filters except Access **status**, which is obsolete.

---

## 15. Business SOT safety

| Removed old event/table | Business fact still in |
|---|---|
| `ApplicationReviewEvent` | `ApplicationReview` / items + `ApplicationAuditLog` |
| `ApplicationLog.remark` | `ApplicationReviewRemark` |
| `TNC_APPROVED` | `LegalDocumentAcceptance` + `tnc_accepted` |
| `FORM_FILLED` | org / RegTank onboarding JSON |
| `UPDATE_FEATURED_SETTINGS` | `Note` featured columns (**current** only) |
| `PROSPECTUS_REVIEW_DRAFT_UPDATE` | prospectus review draft SOT |
| `OVERDUE_LATE_CHARGE_CHECKED` | `Note.servicing_status` when it changes; settlement fee columns |
| `LATE_CHARGE_APPROVED` | **not persisted on either side**; posted fees on `NoteSettlement` |
| Letter `s3Key` on audit | `WithdrawalInstruction.letter_s3_key`; generate API return value; S3 object |
| `OVERRIDE_*` | never existed as data |
| `APPLICATION_APPROVED` | never written; approval is offer/signing SOT |
| `GatewayPaymentEvent` | `GatewayPayment.status` + receipts + webhooks + `PaymentAuditLog` |
| `NoteAdminAction` | Note audit + Note row |
| `NotificationLog` | `Notification` inbox rows + broadcast audit |
| `AccessLog.success` | Security `ADMIN_ACCESS_DENIED` |

Do **not** treat featured-history or late-charge-approval breadcrumbs as “safe” merely because the table dropped. See POSSIBLE LOSSES.

---

## 16. POSSIBLE LOSSES

Only items where `origin/main` had useful evidence and current has **no** clear audit **and** no historical SOT.

### PL-1 — Featured-note change history

| | |
|---|---|
| What existed before | `NoteAdminAction` + `NoteEvent` `UPDATE_FEATURED_SETTINGS` with `before_state` / `after_state` (`logAdminAction` in `origin/main` `notes/service.ts`) |
| What is missing now | No `writeNoteAuditFromActor` in `updateFeaturedSettings` (current `notes/service.ts` + cutover assertion) |
| Why it matters | You can see **current** featured flags on `Note`, not who featured/unfeatured a note or previous window/rank |
| Severity | **MEDIUM** |
| Recommended action | **NEEDS_DECISION** — restore a `NOTE_FEATURED_SETTINGS_UPDATED` event if compliance wants marketplace-config history; otherwise **KEEP_REMOVED** |

### PL-2 — Late-charge “approved” breadcrumb

| | |
|---|---|
| What existed before | `LATE_CHARGE_APPROVED` NoteEvent with the calculator `result` (`approveLateCharge` on `origin/main`) |
| What is missing now | `approveLateCharge` still only calculates and returns; **no** audit write |
| Why it matters | Old “approval” also did not persist a late-charge row. Posted tawidh/gharamah still live on `NoteSettlement`. What disappeared is “admin ran Approve Late Charge at time T with these numbers” |
| Severity | **MEDIUM** |
| Recommended action | **NEEDS_DECISION** — **ADD_TO_CURRENT_AUDIT** if that click is an approval; **KEEP_REMOVED** if it is only a calculator |

### PL-3 — No-op overdue late-charge checks

| | |
|---|---|
| What existed before | Every `applyOverdueLateCharge` wrote `OVERDUE_LATE_CHARGE_CHECKED` with the full result |
| What is missing now | Audit only if servicing/note status **changes** (`NOTE_SERVICING_STATUS_CHANGED`) |
| Why it matters | “We checked and it was not overdue” is gone. Status transitions are kept |
| Severity | **LOW** |
| Recommended action | **KEEP_REMOVED** unless ops need check-frequency evidence |

### PL-4 — Note timeline letter download from audit `s3Key`

| | |
|---|---|
| What existed before | Letter events stored `s3Key`; timeline `extractS3Key` opened/downloaded the file |
| What is missing now | Audit metadata has `fileName` + `fileHash` only; `extractS3Key` returns `null` |
| Why it matters | Cannot open arrears/default letters from the timeline. Generate action still returns `s3Key`. Withdrawal letters still have `letter_s3_key` |
| Severity | **MEDIUM** (UI) / **LOW** (data — file still in S3, hash recorded) |
| Recommended action | **RESTORE** timeline download via SOT/`letter_s3_key` or a signed URL service — not by putting raw `s3Key` back on audit if that was rejected for a reason |

No HIGH loss of a live financial or access-control writer was found.

---

## 17. Intentional safe removals

| What was removed | Why (source) | Where it lives now | Why no loss |
|---|---|---|---|
| Mixed Access events (roles, KYC filter labels, onboarding reset) | Access catalogue is signup/login/logout only (`auth/audit/events.ts`) | Security / Onboarding | Same facts, correct module |
| Access `success` + Status column | Access is success-only (`auth/audit/reader.ts`) | `ADMIN_ACCESS_DENIED` | Admin-gate failure still written |
| `EMAIL_CHANGED` name | Writer was always `verifyEmail` | `USER_EMAIL_VERIFIED` / `EMAIL_VERIFICATION_FAILED` | Same trigger |
| `ONBOARDING_CANCELLED` | Admin restart only | `ONBOARDING_RESTARTED` | Same trigger, clearer name |
| `TNC_APPROVED` onboarding audit | `acceptTnc` does not write onboarding audit | `LegalDocumentAcceptance` | Stronger evidence |
| `FORM_FILLED` / raw webhooks | Cutover forbids raw webhook events | RegTank / org JSON | Form data is SOT |
| `APPLICATION_APPROVED` | Never written | Offer/signing SOT | Dead enum |
| `ApplicationReviewEvent` | Duplicate of ApplicationLog | Application audit | Duplicate |
| `NoteAdminAction` table | Duplicate snapshots | Note audit + Note row | Duplicate except featured (PL-1) |
| Prospectus draft-save events | Draft is SOT | prospectus review + `NOTE_PROSPECTUS_INVALIDATED` | Avoid noise |
| Gateway `OVERRIDE_*` | No writers | — | Dead enum |
| Signing session-opened / viewed | Never written | envelope/recipient SOT | Dead |
| Letter `s3Key` on audit | Avoid storing storage keys on forensic rows | hash + generate API + withdrawal SOT | Integrity kept; UI download is PL-4 |
| `device_info` column | Derived from UA | reader `formatDeviceInfoFromUserAgent` | Same device string |
| `cognito_event` column | Unused | — | Never written |
| Deprecated Application `level/target/action` | Already deprecated on `origin/main` | `event_type` | Dead |
| Investor withdrawal on Note audit | Payment domain | `PaymentAuditLog` `INVESTOR_WITHDRAWAL_*` | Moved, not dropped |
| Notification logs on Settings | Central `/audit` | Notifications tab | Moved |
| 401 unauthenticated probes | Still not audited | — | Same as `origin/main` |

---

## 18. Module summary

| Module | Old models | Current model | Old events/actions | Current events | Preserved | Replaced | Intentional removals | Possible losses | UI loss? | Metadata loss? | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Access | AccessLog | AccessAuditLog | SIGNUP/LOGIN/LOGOUT + mixed | 3 | Yes | Yes | Mixed types, success flag | No | Status column moved | Unused cognito_event | **SAFE_WITH_DIFFERENCES** |
| Security | SecurityLog | SecurityAuditLog | ~9 written | 35 | Yes | Yes | Name cleanup | No | No | Failures split | **SAFE** |
| Onboarding | OnboardingLog | OnboardingAuditLog | ~12 written | 17 | Yes | Yes | TNC/FORM/webhooks | No | No | TNC → SOT | **SAFE** |
| Application | ApplicationLog, ApplicationReviewEvent | ApplicationAuditLog | 44 enum / ~subset written | 40 | Yes | Yes | APPROVED dead, review-event table | No | No | remark → SOT | **SAFE** |
| Signing | ApplicationLog rows | SigningAuditLog | 4 | 12 | Yes | Yes | unwritten session events | No | No | No | **SAFE** |
| Note | NoteEvent, NoteAdminAction | NoteAuditLog | see matrix | 35 | Most | Yes | draft/featured/late-check | Featured, late-approve, letter s3Key UI | Timeline download | s3Key | **NEEDS_REVIEW** |
| Payment | GatewayPaymentEvent | PaymentAuditLog | 11 enum / 8 live | 19 | Yes | Yes | OVERRIDE_* | No | Curated timeline → raw | from/to in metadata | **SAFE** |
| Product | ProductLog | ProductAuditLog | 5 | 5 | Yes | Yes | — | No | No | No | **SAFE** |
| Legal | LegalDocumentAuditLog | LegalAdminAuditLog | 7 live | 7 | Yes | Yes | error-code “actions” | No | No | columns → metadata | **SAFE** |
| Notification | NotificationLog | NotificationBroadcastAuditLog | 1 row type | 1 | Yes | Yes | inline columns | No | Moved to `/audit` | Counts richer | **SAFE** |
| Webhooks | GatewayWebhookEvent | GatewayWebhookEvent | technical | technical | Yes | — | — | No | No | No | **SAFE** |

---

## 21. Final verdict

### A. OVERALL VERDICT

**SAFE_WITH_DIFFERENCES**, with **Note** as **NEEDS_REVIEW** for three breadcrumbs (featured history, late-charge approve click, letter `s3Key` on the timeline).

The redesign did **not** accidentally delete the live Access / Security / Onboarding / Application / Signing / Payment / Legal / Product / Notification writers that `origin/main` actually used. Those facts are on new append-only tables, renamed events, or stronger SOT.

### B. POSSIBLE FUNCTIONALITY LOSS

- Access **Status** filter/column (obsolete; failures are Security).
- Note timeline **letter download** from audit metadata.
- Featured-settings **history** (current flags remain).
- Late-charge **approve** audit breadcrumb (calculator; settlement SOT remains).

### C. POSSIBLE AUDIT DATA LOSS

- Featured before/after snapshots (PL-1).
- Late-charge approve result rows (PL-2).
- No-op overdue-check rows (PL-3).
- Letter `s3Key` on arrears/default audit rows (PL-4) — hash remains.

### D. POSSIBLE UI LOSS

- Access Status column.
- Notification IP/Device/recipients **inline** (still in detail sheet) — classify as moved.
- Gateway prose timeline (replaced by raw Audit History) — classify as moved.
- Note timeline `s3Key` actions — **POSSIBLE_UI_LOSS**.

### E. INTENTIONAL SAFE REMOVALS

See §17. Dead enums, duplicate tables, TNC-as-onboarding-audit, raw webhooks, draft-save noise, unused `cognito_event`, Access mixed types.

### F. IMPROVEMENTS OVER ORIGIN/MAIN

- Shared forensic envelope (actor/org/target/source/portal/correlation/idempotency/occurred_at).
- Logs survive user/application/note deletion (no FKs).
- Access catalogue is clean; Security is complete (org, invites, 403s, notification prefs).
- Global Onboarding + Notifications tabs.
- Application documents, review started, archive, draft delete, correct offer-reject event.
- Signing split with recipient/eKYC/expiry/reminder.
- Payment initiate/capture/fail/deposit/withdrawal/recon.
- Residual-return events (old create event was never written).
- Security export actually exports Security.
- Admin application/signing logs require `applications.view`.
- Raw Audit History vs curated Activity split.
- Legal CSV+JSON; richer notification counts.

### G. MODULE-BY-MODULE BEGINNER CHECKLIST

See §19 at the top.

### H. FULL OLD → NEW EVENT MATRIX

See §3–4 tables.

### I. OLD → NEW METADATA MATRIX

See metadata subsections in §3–4.

### J. OLD → NEW UI MATRIX

See §6 / §7.

### K. RBAC COMPARISON

See §13. **MORE_RESTRICTIVE** on application/signing admin logs and investor note membership. **No LESS_RESTRICTIVE**.

### L. THINGS I MUST MANUALLY TEST BEFORE MERGE

- [ ] Access: signup / login / logout; export
- [ ] Security: password + email verify success/fail; admin 403 → `ADMIN_ACCESS_DENIED`; Security export
- [ ] Onboarding: restart vs reset; AML/SSM/approve; T&C appears on Legal Acceptances only
- [ ] Application: full offer + amendment + signing merge on Audit History; Activity curated
- [ ] Admin without `applications.view` cannot read application/signing logs
- [ ] Note: publish/funding/settlement/Shoraka; featured change has **no** audit row
- [ ] Note: generate letter download works; timeline has **no** s3 download
- [ ] Payment: gateway Audit History; investor withdrawal on Payment not Note
- [ ] Legal/Product/Notification tabs and exports
- [ ] Issuer `/activity` and Investor `/activity` still populate from new adapters

---

## Inspection attestation

Every preserved/replaced/removed claim above was checked against:

1. `git show origin/main:<file>` (or `git grep` / `git show` of the listed `origin/main` paths), and
2. the current working tree at the listed current paths.

Items were **not** marked PRESERVED from prior audit documents alone.
