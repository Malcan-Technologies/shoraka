# Current audit / activity architecture

Living documentation for `no_fix_55` (includes `b9a26e39` investor wallet / organization Activity tab). Authority: current Prisma schema, event catalogues, writers, readers, adapters, UI, then tests. If this file’s older cutover notes conflict with source, **source wins**.

Do not treat audit as source of truth. Do not invent metadata or event behavior.

## Stores

Live Prisma audit models (append-only; stored ids are historical scalars, not FKs that cascade-delete history):

| Model | Table |
|-------|--------|
| AccessAuditLog | access_audit_logs |
| SecurityAuditLog | security_audit_logs |
| OnboardingAuditLog | onboarding_audit_logs |
| LegalAdminAuditLog | legal_admin_audit_logs |
| ApplicationAuditLog | application_audit_logs |
| SigningAuditLog | signing_audit_logs |
| NoteAuditLog | note_audit_logs |
| PaymentAuditLog | payment_audit_logs |
| ProductAuditLog | product_audit_logs |
| NotificationBroadcastAuditLog | notification_broadcast_audit_logs |

There is no canonical/global `AuditEvent` table.

Removed runtime stores (do not document as active): `ApplicationLog`, `NoteEvent`, `NoteAdminAction`, `OnboardingLog`, `ProductLog`, `SecurityLog`, `AccessLog`, `GatewayPaymentEvent`, `ApplicationReviewEvent`, `NotificationLog`, helpers `logApplicationActivity` / `recordGatewayPaymentEvent`. Adapter class names such as `ApplicationLogAdapter` / `NoteLogAdapter` are preserved but read AuditLog tables.

## Catalogue counts (source)

Reserved IDs **A001–A177** (**177**). Active writers **174**. Retired onboarding IDs (readable historical rows, IDs not reused): A040 `ONBOARDING_RESUMED`, A052 `CTOS_REPORT_RECEIVED`, A053 `CORPORATE_ENTITIES_UPDATED`.

| Module | Count | File |
|--------|------:|------|
| Access | 3 | `apps/api/src/modules/auth/audit/events.ts` |
| Security | 35 | `apps/api/src/modules/security/audit/events.ts` |
| Onboarding | 18 reserved / 15 active | `apps/api/src/modules/onboarding/audit/events.ts` |
| Legal | 7 | `apps/api/src/modules/legal-documents/audit/events.ts` |
| Application | 40 | `apps/api/src/modules/applications/audit/events.ts` |
| Signing | 12 | `apps/api/src/modules/signing/audit/events.ts` |
| Note | 37 | `apps/api/src/modules/notes/audit/events.ts` |
| Payment | 19 | `apps/api/src/modules/payment/audit/events.ts` |
| Product | 5 | `apps/api/src/modules/products/audit/events.ts` |
| Notification | 1 | `apps/api/src/modules/notification/audit/events.ts` |

Per-event cards: `docs/audit/audit-manual-verification-catalogue.md`.

## Audit is history, not source of truth

Typical write path:

```
Business action → SOT mutation → Audit writer → AuditLog row → raw Audit History
```

Where a curated feed exists:

```
AuditLog → visibility (`activity-visibility.ts`) → adapter → presentation (`activity-presentation.ts`) → Activity timeline / ActivityFeed
```

SOT examples: `UserSession` / Cognito; organization `onboarding_status`; `Application` + review/remark/revision tables; signing envelope graph; `Note` / ledger / investments / withdrawals; `GatewayPayment` / wallet / recon; `LegalDocumentAcceptance`; `GatewayWebhookEvent` (provider transport, updated after processing).

Audit is never payment, balance, listing, or review **state**.

## Presentation architecture

`AdminVerticalTimeline`, `ActivityFeed`, `ListToolbar`, and status-token helpers are UI infrastructure. They do not own audit data.

- Admin curated Activity uses AuditLog DTOs through visibility + `format*Activity`.
- Admin raw Audit History uses AuditLog DTOs (`ContextualAuditHistoryPanel`, global `/audit` tabs).
- Issuer/investor `/activity` uses `ActivityFeed` over the same AuditLogs.
- Admin/investor **wallet activity** is cash-statement UI over `InvestorBalanceTransaction` (plus overlay). It is not an AuditLog adapter.

## Three surfaces (do not call all three “audit logs”)

| Surface | What it is | Store |
|---------|------------|-------|
| **A. Wallet Activity / cash statement** | Operational money view for an investor organization | `InvestorBalanceTransaction` plus a read-time `GatewayPayment` overlay for uncredited in-flight deposits. **Not** `PaymentAuditLog`. **Not** `/v1/activities`. |
| **B. Onboarding Activity** | Curated organization onboarding timeline | `OnboardingAuditLog` via current audit DTOs (`eventType`, `occurredAt`, `actor.displayName`, `formatOnboardingActivity`) |
| **C. Raw Audit History** | Forensic evidence (global `/audit` tabs and contextual Audit History panels) | Matching `*AuditLog` tables |

Pending wallet overlay rows are synthetic at read time (`affectsAvailableBalance: false`). They are not persisted audit evidence and did not add a new audit event. Running balance must skip those rows so they are not double-counted. `PaymentAuditLog` remains historical/compliance evidence for gateway payment, investor-withdrawal, and recon-exception writers.

## Raw Audit History vs curated Activity

| Surface | What it shows |
|---------|----------------|
| Global `/audit` tabs | Raw Access, Security, Onboarding, Product, Legal Documents, Notifications |
| Application detail | Curated Activity (`RecentActivityCard`) **and** raw Audit History (`ApplicationAuditHistoryCard`) |
| Note detail | Curated note timeline **and** raw Audit History |
| Organization detail (issuer) | Onboarding Activity only (`OrganizationActivityTimeline` from `OnboardingAuditLog`) |
| Organization detail (investor) Activity tab | **Wallet Activity first** (cash statement), then Onboarding Activity titled “Onboarding activity”. Two separate data concepts. |
| Gateway payment / withdrawal / recon / platform finance | Contextual raw Payment or Note audit history; gateway detail also renders a `PaymentAuditLog` timeline |

Access is success-only (`USER_SIGNED_UP`, `USER_LOGGED_IN`, `USER_LOGGED_OUT`). Denials and security failures are Security (`ADMIN_ACCESS_DENIED`, password/email failures, and so on).

## Writers, readers, adapters

Writers: `apps/api/src/modules/*/audit/writer.ts` (typed to each module’s event union + Zod metadata).

Readers (names often preserved from older APIs):

- Access / Security / Onboarding / Product / Legal / Notification list+export under `/v1/admin/...`
- `GET /v1/applications/:id/logs` — merged Application + Signing projection
- Note events on `NoteDetail.events`; `GET /v1/admin/notes/:id/events` for full history
- Gateway payment `events[]` from `PaymentAuditLog`
- Admin investor wallet activity `GET /v1/admin/organizations/investor/:id/balance-activity` — `InvestorBalanceTransaction` + in-flight `GatewayPayment` overlay (not `PaymentAuditLog`)

Activity adapters: `organization-log`, `application-log`, `signing-log`, `note-log`, `payment-log`.

## Visibility, RBAC, exports

Issuer/investor visibility is not “everything in the table”. See `activity-visibility.ts` and `docs/guides/activity-log-inventory.md`.

Admin global tabs (`apps/admin/src/lib/audit-tabs.ts`):

| Tab | Route | Permission |
|-----|-------|------------|
| Access | `/audit?tab=access` | `audit.access.view` |
| Security | `/audit?tab=security` | `audit.security.view` |
| Onboarding | `/audit?tab=onboarding` | `onboarding.view` |
| Product | `/audit?tab=products` | `audit.product.view` |
| Legal Documents | `/audit?tab=legal-documents` | `document_management.view` |
| Notifications | `/audit?tab=notifications` | `notifications.view` |

Contextual:

| Surface | Permission |
|---------|------------|
| Application Activity / Audit History | `applications.view` |
| Note timeline / Audit History | `notes.view` |
| Organization detail (onboarding timeline + investor wallet activity) | `organizations.view` |
| Admin investor wallet activity API `GET /v1/admin/organizations/investor/:id/balance-activity` | `organizations.view` |
| Gateway payments | `gateway_payments.view` |
| Investor withdrawals | `investor_withdrawals.view` |
| Reconciliation | `gateway_reconciliation.view` |
| Platform finance trustee signature | `platform_settings.view` |

CSV export is available on global tabs and admin timelines that expose it. Notification broadcast has no export in this phase.

## Idempotency and transactions

`PaymentAuditLog.idempotency_key` is the dedicated uniqueness path (`PAYMENT_AUDIT_IDEMPOTENCY` in `payment/audit/events.ts`). Investor withdraw uses client `withdrawalIntentId` stored on `WithdrawalInstruction.idempotency_key`.

Legal document mutations and `LegalAdminAuditLog` inserts share one Prisma transaction (S3 stays outside). Application review-started writes the status change and audit row in one transaction. Payment/onboarding/notification paths vary; see the catalogue card. If an audit insert is best-effort, the card says so.

## Legacy / display aliases (not live writers)

Admin CSV/label maps may still recognize historical strings. Unless a current writer emits the name, treat it as a display fallback:

| String | What it is now |
|--------|----------------|
| `LOGIN` / `LOGOUT` / `SIGNUP` | Retired Access names. Live: `USER_LOGGED_IN` / `USER_LOGGED_OUT` / `USER_SIGNED_UP` |
| `LEGAL_VERSION_*` | Retired. Live: `LEGAL_DOCUMENT_VERSION_*` |
| `CONTRACT_OFFER_ACCEPTANCE_*` | Display alias. Live: `CONTRACT_ACCEPTANCE_*` |
| `AMENDMENTS_SUBMITTED` | Display alias. Live: `APPLICATION_AMENDMENTS_REQUESTED` |
| `SECTION_REVIEWED_*` / `ITEM_REVIEWED_*` | Display aliases. Live: `APPLICATION_SECTION_REVIEW_UPDATED` / `APPLICATION_ITEM_REVIEW_UPDATED` |
| `APPLICATION_RESET_TO_UNDER_REVIEW` | Display alias. Live: `APPLICATION_REOPENED_FOR_REVIEW` |
| `APPLICATION_APPROVED` | Not a live application audit event (notification type id still exists separately) |
| `FAIL_FUNDING` | Display alias. Live: `NOTE_FUNDING_FAILED` |
| `CLOSE_FUNDING` | Display alias **and** issuer-disbursement `metadata.source`. Live event: `NOTE_FUNDING_CLOSED` / `DISBURSEMENT_INITIATED` |
| `UNPUBLISH` | Prospectus invalidation **reason**. Live event: `NOTE_UNPUBLISHED` |
| `NOTE_DEFAULT_MARKED` | Display alias. Live: `NOTE_MARKED_DEFAULT` |
| `SHORAKA_CERTIFICATE_FETCHED` | Display alias. Live: `SHORAKA_CERTIFICATE_RECEIVED` |
| `OVERDUE_LATE_CHARGE_CHECKED` / `LATE_CHARGE_APPROVED` | Display aliases; no current note writers |
| `NOTE_CREATED_FROM_INVOICE` / `PUBLISH` / `ACTIVATE` | Display/historical names. Live: `NOTE_CREATED` / `NOTE_PUBLISHED` / `NOTE_ACTIVATED` |

Do not confuse metadata/reason/source values with `event_type`.

## Issuer / investor Activity defaults

See `docs/guides/activity-log-inventory.md`. After onboarding complete: issuer defaults `application`, `note`, `signing`; investor defaults `note`, `payment`.

---

## Historical cutover notes

Phase banners below still describe the live tables after the AuditLog cutover. They are not merge narration. Use the architecture section above as the current map.

**Phase 9 PaymentAuditLog cutover (current state):**


- `PaymentAuditLog` (`payment_audit_logs`) is the sole payment/wallet-withdrawal/recon-exception business-audit history table (append-only, no FKs).
- `GatewayPayment`, `GatewayOrderAttempt`, `GatewayWebhookEvent`, `InvestorBalance`, `InvestorBalanceTransaction`, `WithdrawalInstruction`, `GatewayPaymentReceipt`, `GatewayReconRun`, and `GatewayReconException` remain SOT. Audit is never payment, balance, or reconciliation state.
- Hard cutover: live writers use `PaymentAuditLog`. No dual-write. No backfill.
- `GatewayPaymentEvent` / `gateway_payment_events` **removed**. `GatewayPaymentEventType` dropped.
- Investor wallet withdrawals (`WithdrawalType.INVESTOR_WITHDRAWAL`) are audited here. Issuer disbursement / residual stay on `NoteAuditLog`.
- Investor-portal withdrawal requests use a client `withdrawalIntentId` stored on `WithdrawalInstruction.idempotency_key` so retries do not double-debit.

---

**Phase 8 NoteAuditLog cutover (current state):**

- `NoteAuditLog` (`note_audit_logs`) is the **sole** Note-domain history table (append-only, no Note/User/org FKs).
- Ledger, `NotePayment`, `NoteSettlement`, `NoteInvestment`, `WithdrawalInstruction`, `ShorakaTradeOrder`, prospectus models, and `Note` remain SOT. Audit is never financial/workflow state.
- Hard cutover: all Note/prospectus/Shoraka writers and admin/activity readers use `NoteAuditLog`. No dual-write. No backfill.
- `NoteEvent` / `note_events` **removed**.
- `NoteAdminAction` / `note_admin_actions` **removed**.
- Title/summary-only edits, featured settings, and prospectus draft saves remain intentionally unaudited.
- Investor-wallet withdrawals are PaymentAuditLog (Phase 9). GatewayPayment events are PaymentAuditLog.
- There is **no** canonical/global `AuditEvent` table. Live catalogue: **177** reserved IDs, **174** active writers, **3** retired (A040/A052/A053). A175 is OnboardingAuditLog. A176/A177 are NoteAuditLog.

---

**Phase 7 ApplicationAuditLog + SigningAuditLog cutover (current state):**

- Legacy `ApplicationLog` / `application_logs` **removed**. No Prisma model, no writers, no readers, no helper module (`logApplicationActivity` / `createApplicationLog`).
- `ApplicationAuditLog` (`application_audit_logs`) owns application/review/contract/invoice history (append-only, no Application/User FKs).
- `SigningAuditLog` (`signing_audit_logs`) owns signing history (append-only, no envelope/application/user FKs). `SIGNING_PACKAGE_*` are live Signing events.
- `GET /v1/applications/:id/logs` is a merged reader projection of `ApplicationAuditLog` + `SigningAuditLog`. It is not a store and not workflow state.
- `ApplicationRevision` / `ApplicationReview` / `ApplicationReviewItem` / `ApplicationReviewRemark` remain workflow/evidence SOT. Resubmit comparison reads revisions + cycle-scoped remarks — never audit.
- Signing envelope graph / `SigningCloudEkyc` remain signing SOT. Envelope log APIs read `SigningAuditLog`.
- Activity feed uses ApplicationAuditLog + SigningAuditLog adapters (`ApplicationLogAdapter` is a preserved adapter name).
- `ApplicationReviewEvent` / `application_review_events` **removed**.
- Audit tables are never used as workflow state. There is **no** canonical/global `AuditEvent` table.

**Phase 4 cutover + legacy cleanup (current state):**

- `AccessLog` / `access_logs` **removed**. `AccessAuditLog` (`access_audit_logs`) is the **sole** authentication-history audit table (`USER_SIGNED_UP`, `USER_LOGGED_IN`, `USER_LOGGED_OUT`).
- `SecurityLog` / `security_logs` **removed**. `SecurityAuditLog` (`security_audit_logs`) is the **sole** security/admin-control audit table.
- `UserSession` remains session source of truth. Cognito remains auth authority.
- There is **no** canonical/global `AuditEvent` table.

Known limitations (not fixed in the cleanup):

1. Two `USER_LOGGED_OUT` writers exist with no deduplication (`POST /v1/auth/logout` via `AuthService.logout`, and Cognito `GET /v1/auth/cognito/logout`). This is **not** normal portal behavior. Typical portal flow: 1 logout action → Cognito GET logout → 1 audit row. Two rows are possible only if a caller explicitly invokes both paths. Current portal UIs call the GET path only. Cognito GET logout portal: valid `?portal=issuer|investor|admin` → Origin/Referer hostname → `null` (`user.roles[0]` is not a fallback).
2. Access query `status=failed` is preserved for API compatibility but matches no Access event (Access has no failure events).
3. Admin deactivation is DB-only; no Cognito `AdminDisableUser` / session revoke in that path yet.
4. Password/email verification/role-sync and invitation/org email resend remain non-atomic with Cognito/SES.

**Phase 5 cutover + legacy OnboardingLog cleanup (current state):**

- `OnboardingLog` / `onboarding_logs` **removed**. `OnboardingAuditLog` (`onboarding_audit_logs`) is the **sole** onboarding/compliance history table.
- Organization `onboarding_status` / flags remain workflow source of truth.
- `RegTankOnboarding` remains provider-session source of truth.
- `LegalDocumentAcceptance` remains legal acceptance source of truth.
- CTOS report rows remain report source of truth.
- Audit is never workflow state. No User/org/RegTank FKs on `OnboardingAuditLog` (scalar historical ids only). Append-only create.
- Reserved onboarding IDs: **18** = original A039–A055 plus later-appended A175 (`ORGANIZATION_PROFILE_UPDATED_BY_ADMIN`). Current active onboarding event types: **15**. Retired / no current writer: `ONBOARDING_RESUMED` (A040), `CTOS_REPORT_RECEIVED` (A052), and `CORPORATE_ENTITIES_UPDATED` (A053). Historical rows remain readable. IDs are not reused. Live catalogue is **177** reserved IDs (A001–A177) with **174** active writers.
- Onboarding audit records CashSouk business actions, stages, decisions, and outcomes. Detailed provider synchronization remains in its source-of-truth storage (`corporate_entities`, `director_kyc_status`, `RegTankOnboarding.webhook_payloads`) and is not duplicated as onboarding audit noise.
- `DIRECTOR_KYC_STATUS_UPDATED` writes only when an existing director newly becomes `APPROVED` or `REJECTED`.
- `ONBOARDING_STATUS_CHANGED` is the core stage event, including review landing, amendment requested, and amendment resubmission. Admin Organization contextual history includes it. Dedicated SSM/AML/approval/final/reject/restart events do not also write a sibling A044 row.
- `AML_APPROVED` `onboarding_id` is optional linkage to `reg_tank_onboarding.id` (CashSouk cuid) when the writer already knows the session. Self-service AML sync may leave it NULL. Provider ids stay in metadata.
- `DIRECTOR_ONBOARDING_INVITATION_SENT` is written only from Issuer/Investor COMPANY Profile → Directors and Shareholders → Confirm & Send after company onboarding is COMPLETED.
- Admin URLs `GET /v1/admin/onboarding-logs` (list, `/:id`, `/export`) are preserved names; they read `OnboardingAuditLog`.
- There is **no** canonical/global `AuditEvent` table.

Known limitations (not fixed in this cleanup):

1. `retryOnboarding` can persist a new provider session without writing `ONBOARDING_RESTARTED`.
2. Company auto-regenerate may label a stale/cancelled session as `EXPIRED_SESSION`.
3. Legacy complete-onboarding routes still exist and emit `ONBOARDING_COMPLETED`.
4. User cancel remains a no-op workflow action.

---

## 1. Executive Summary

CashSouk does not have a single audit system. It has **many specialized tables** plus **business source-of-truth rows** that also serve as evidence. Named log tables (`access_audit_logs`, `security_audit_logs`, `onboarding_audit_logs`, `application_audit_logs`, `signing_audit_logs`, `product_audit_logs`, `note_audit_logs`, `payment_audit_logs`, `legal_admin_audit_logs`, `notification_broadcast_audit_logs`) sit beside evidence tables (`legal_document_acceptances`, `application_revisions`, ledgers, gateway payments, signing envelopes, RegTank/CTOS/Shoraka records). Legacy `access_logs`, `security_logs`, `onboarding_logs`, `application_logs`, `note_events`, `note_admin_actions`, `gateway_payment_events`, and `application_review_events` have been dropped.

### Current architecture (factual)

- **Auth/security:** `AccessAuditLog` (signup/login/logout) + `SecurityAuditLog` (RBAC, profile, invitations, membership, notification config). No User FK; history survives User deletion. `UserSession` is session SOT; Cognito is auth authority. Legacy `AccessLog` / `SecurityLog` removed.
- **Onboarding:** `OnboardingAuditLog` is the sole onboarding/compliance history table (append-only). Organization `onboarding_status`/flags, `RegTankOnboarding`, `LegalDocumentAcceptance`, and CTOS rows remain SOT. Audit is never workflow state. Legacy `OnboardingLog` / `onboarding_logs` removed. Onboarding has **18** reserved IDs (A039–A055 original block + appended A175) and **15** active writers; A040, A052, and A053 are retired (historical rows readable). `DIRECTOR_KYC_STATUS_UPDATED` is outcome-only (`APPROVED`/`REJECTED`). `AML_APPROVED` links `onboarding_id` to `reg_tank_onboarding.id` when the writer already has the session. A175 is admin organization-profile history (issuer/investor Activity HIDE).
- **Applications:** `ApplicationAuditLog` (`application_audit_logs`) is the application/review/contract/invoice history table (append-only, no Application/User FKs). `ApplicationReview` / `ApplicationReviewItem` are current review status. `ApplicationReviewRemark` is cycle-scoped amendment remark SOT. `ApplicationRevision` is comparison/snapshot SOT. Resubmit comparison reads `ApplicationRevision` + remarks, never audit. Legacy `ApplicationLog` / `application_logs` and `ApplicationReviewEvent` / `application_review_events` **removed**.
- **Signing:** `SigningAuditLog` (`signing_audit_logs`) is the signing history table (append-only). Envelope graph / `SigningCloudEkyc` remain signing SOT. `GET /v1/applications/:id/logs` merges Application + Signing audit rows. Envelope log APIs read `SigningAuditLog` only.
- **Notes:** `NoteAuditLog` (`note_audit_logs`) is the sole Note-domain history table (append-only, no Note/User/org FKs). Ledger, `NotePayment`, `NoteSettlement`, `NoteInvestment`, `WithdrawalInstruction`, `ShorakaTradeOrder`, prospectus models, and `Note` remain SOT. Activity feed reads a **subset** of `NoteAuditLog` types. `NoteEvent` / `note_events` and `NoteAdminAction` / `note_admin_actions` **removed**. Title/summary edits, featured settings, and prospectus draft saves are intentionally unaudited. Catalogue count is **37** (A115–A149 original + appended A176 `NOTE_CAMPAIGN_PAUSED` / A177 `NOTE_CAMPAIGN_RESUMED`). Pause/resume are listing-axis events, not `NOTE_UNPUBLISHED` / `NOTE_PUBLISHED`.
- **Legal admin:** dedicated `LegalAdminAuditLog`. User open/accept is **not** that table; it is `LegalDocumentAcceptance` updated **in place**. Legacy `LegalDocumentAuditLog` / `legal_document_audit_logs` has been removed.
- **Payments:** `GatewayPayment` is payment-state SOT; `PaymentAuditLog` is the sole payment business-audit history (append-only, no FKs). `GatewayWebhookEvent` remains provider transport/replay evidence and is **updated** after processing. `InvestorBalance` / `InvestorBalanceTransaction` remain wallet/cash statement SOT (admin/investor wallet activity, including the read-time in-flight overlay). `WithdrawalInstruction`, `GatewayPaymentReceipt`, and `GatewayReconException` remain withdrawal/receipt/recon SOT. Legacy `GatewayPaymentEvent` / `gateway_payment_events` **removed**.
- **Products:** `ProductAuditLog` is append-only and is not deleted on product rollback. Legacy `ProductLog` / `product_logs` has been removed.
- **Notifications:** `NotificationBroadcastAuditLog` for admin bulk send (`NOTIFICATION_BROADCAST_PROCESSED`). In-app `Notification` rows are delivery, not business audit. Legacy `NotificationLog` / `notification_logs` has been removed.

### Biggest risks

1. **Named `*AuditLog` tables have no User/Application/Note FKs**, so deleting a User/Application/Note does not cascade-delete those audit rows. Related **evidence/SOT** tables (acceptances, envelopes, gateway rows, and so on) may still cascade — that is not the AuditLog store.
2. **`AuthService.cancelOnboarding` is a no-op workflow action** (reads org `onboarding_status` / `onboarded_at` and `RegTankOnboarding`, not audit). Historical `USER_COMPLETED` reader is gone with `OnboardingLog`.
3. **Legal acceptance evidence is mutated in place** (OPENED → ACCEPTED on one row).
4. **Payment capture/complete history is `PaymentAuditLog`**; money SOT remains `GatewayPayment` / balance / recon / receipt.
5. **Invite create, org members/ownership, trustee signature, public-id change, and investor withdrawal request are audited** (`SecurityAuditLog` invitation/member events, `NoteAuditLog.TRUSTEE_SIGNATURE_UPDATED`, `USER_PUBLIC_ID_CHANGED`, `PaymentAuditLog` `INVESTOR_WITHDRAWAL_*`). Remaining gaps, if any, are in the historical scan tables below — do not treat the pre-cutover “missing invite” bullet as current.
6. **Product audit history is retained** (`ProductAuditLog`); failed-create rollback does not delete it. Legacy `product_logs` dropped.
7. **Do not treat CSV/display aliases as live writers** (`LOGIN`/`LOGOUT`/`SIGNUP`, `SECTION_REVIEWED_*`, `FAIL_FUNDING`, `APPLICATION_APPROVED` as an application audit event). Live Access events are `USER_*`. Dual `USER_LOGGED_OUT` writers remain a known limitation (typical UI uses one path).
8. **`ApplicationReviewEvent` / `application_review_events` removed.** `NoteEvent` / `note_events` and `NoteAdminAction` / `note_admin_actions` have been removed.

### Counts (this scan)

| Metric | Count |
|---|---|
| Named audit/history tables (this historical scan) | 12 (includes evidence tables inspected at the time; live `*AuditLog` models are **10**) |
| Additional evidence/history/SOT models inspected | 22 |
| Mutation/business actions classified | 227 |
| Fully logged (dedicated audit/history event) | ~95 |
| Partially logged | ~45 |
| Missing dedicated audit | ~87 |
| Critical findings | 8 |
| High findings | 22 |
| Unresolved items (pre-closure) | 9 (closed in §19) |

Exact logged/partial/missing split is in §4 and §14. “Partial” means SOT/provider evidence exists but no proper audit event, or the event is missing actor/IP/org.

---

## 2. Repository Coverage Checklist

> The numbered scan below is the original cutover inventory. Live stores, event names, and UI are in the architecture section at the top of this file and in `docs/audit/audit-manual-verification-catalogue.md`. Mentions of `recordGatewayPaymentEvent`, `GatewayPaymentEvent`, `LOGIN` as a live Access event, or “missing invite audit” inside later findings are historical unless restated in the architecture section.


Legend: ✅ inspected · N/A none found · ⚠ leftover/unused

| Module | Routes | Service | DB writes | Frontend mutations | Jobs | Webhooks | Log writes | Readers/UI |
|---|---|---|---|---|---|---|---|---|
| AUTH | ✅ | ✅ | ✅ | ✅ portals + Cognito | N/A | Cognito callback | AccessAuditLog/SecurityAuditLog | `/audit` + account recent logins |
| USER / PROFILE | ✅ | ✅ | ✅ | ✅ admin/issuer/investor | N/A | N/A | PARTIAL | Admin users |
| ADMIN / RBAC | ✅ | ✅ | ✅ | ✅ | N/A | N/A | SecurityAuditLog | Admin roles UI + `/audit` security |
| ADMIN INVITATIONS | ✅ | ✅ | ✅ | ✅ | N/A | SES | revoke only | Invitation rows |
| ORGANIZATION | ✅ | ✅ | ✅ | ✅ issuer/investor | N/A | N/A | TNC_APPROVED only | Org pages |
| ORGANIZATION MEMBERS | ✅ | ✅ | ✅ | ✅ | N/A | N/A | **none** | Members UI |
| ONBOARDING | ✅ | ✅ | ✅ | ✅ admin/portals | N/A | RegTank | OnboardingAuditLog | Admin `/onboarding-logs` + org activity |
| KYC / KYB / AML | ✅ | ✅ | ✅ | ✅ | CTOS retry | RegTank | mixed | Admin onboarding |
| REGTANK | ✅ | ✅ | ✅ | admin refresh | N/A | 8+legacy+dev | OnboardingAuditLog | Admin + SOT |
| CTOS | ✅ | ✅ | ✅ | ✅ admin | ctos-kyb-retry | N/A | SECTION_REVIEWED_PENDING only | Admin CTOS cards |
| LEGAL DOCUMENTS | ✅ | ✅ | ✅ | ✅ admin | N/A | N/A | LegalAdminAuditLog | `/audit` legal tab + export |
| LEGAL ACCEPTANCES | ✅ | ✅ | ✅ | ✅ all portals | N/A | N/A | SOT not audit table | Admin acceptances |
| APPLICATION | ✅ | ✅ | ✅ | ✅ issuer | N/A | N/A | ApplicationAuditLog | Issuer timeline, GET logs (merged), activity |
| APPLICATION REVIEW | ✅ | ✅ | ✅ | ✅ admin | N/A | N/A | ApplicationAuditLog (+ unread ReviewEvent writes) | Admin timeline |
| AMENDMENTS | ✅ | ✅ | ✅ | ✅ | N/A | N/A | submit yes; drafts no | Resubmit comparison reads **revision + remarks** |
| CONTRACT / INVOICE | ✅ | ✅ | ✅ | ✅ | N/A | N/A | withdraw only | Application UI |
| OFFER | ✅ | ✅ | ✅ | ✅ | expiry job | N/A | yes except reminders | Timelines + notifications |
| SIGNING / SIGNINGCLOUD | ✅ | ✅ | ✅ | ✅ admin/issuer/external | expiry + reconcile | SigningCloud | SigningAuditLog | Signing UI + envelope logs |
| PRODUCT | ✅ | ✅ | ✅ | ✅ admin | N/A | N/A | ProductAuditLog | `/audit` products + CSV |
| PLATFORM FINANCE SETTINGS | ✅ | ✅ | ✅ | ✅ admin | N/A | N/A | **none** | Settings UI |
| SITE DOCUMENTS | N/A removed | tests assert absence | **no model** | N/A | N/A | N/A | N/A | Removed from invest path |
| NOTIFICATIONS | ✅ | ✅ | ✅ | ✅ | cleanup cron | N/A | NotificationBroadcastAuditLog bulk only | Admin logs + inbox |
| NOTE / MARKETPLACE | ✅ | ✅ | ✅ | ✅ | listing expiry | N/A | NoteAuditLog | Admin events + activity subset |
| INVESTMENT / BALANCE | ✅ | ✅ | ✅ | ✅ investor | N/A | Curlec | INVESTMENT_COMMITTED; deposit partial | Investor/admin wallet activity (cash statement SOT, not `/v1/activities`) |
| DEPOSIT / GATEWAY / REFUND / NAME CHECK | ✅ | ✅ | ✅ | ✅ | poller/receipt | Curlec | PaymentAuditLog | Admin payment detail (typed metadata; workflow still GatewayPayment SOT). In-flight deposits also overlay wallet activity; overlay is not an audit event. |
| RECONCILIATION | ✅ | ✅ | ✅ | ✅ | daily recon | Curlec fetch | PaymentAuditLog exception detect/resolve only | Admin recon UI (GatewayReconException SOT) |
| WITHDRAWAL / DISBURSEMENT | ✅ | ✅ | ✅ | ✅ | N/A | N/A | issuer NoteAuditLog; investor wallet PaymentAuditLog | Admin withdrawals |
| REPAYMENT / SETTLEMENT / LEDGER | ✅ | ✅ | ✅ | ✅ | N/A | N/A | NoteAuditLog + ledger SOT | Admin note + ledger GET |
| TRUSTEE LETTERS | ✅ | ✅ | ✅ | ✅ | N/A | N/A | DISBURSEMENT_/RESIDUAL_/SERVICE_FEE_TRUSTEE_* | Admin |
| LATE PAYMENT / ARREARS / DEFAULT | ✅ | ✅ | ✅ | ✅ | N/A | N/A | servicing/default/letter NoteAuditLog | Admin |
| SHORAKA / STP | ✅ | ✅ | ✅ | ✅ | N/A | callback | NoteAuditLog INTEGRATION; no callback audit | Admin shoraka panel |
| PROSPECTUS | ✅ | ✅ | ✅ | ✅ admin/investor | N/A | N/A | NoteAuditLog review/approve/invalidate; draft-save **no**; view **no** | Admin review; investor GET |
| S3 / UPLOADS | ✅ | ✅ | keys on entities | ✅ | N/A | N/A | none (except legal admin hash) | View/download |
| BACKGROUND JOBS | ✅ `lib/jobs` | ✅ | ✅ | N/A | ✅ 9 jobs | N/A | mixed | pino |
| ACTIVITY FEED | ✅ GET | adapters | reads logs | issuer/investor `/activity` | N/A | N/A | n/a | `/v1/activities` (curated AuditLog subset). Admin org wallet activity is a different endpoint. |
| eKYC | ✅ | ✅ | ✅ | external | N/A | via signing | **no audit event** | Signing UI |
| GUARANTOR AML | ✅ | ✅ | ✅ | ✅ admin | N/A | RegTank | **no ApplicationLog** | Admin application |
| ISSUER DASHBOARD | ✅ GET | ✅ | N/A | ✅ | N/A | N/A | N/A | read-only |
| PUBLIC MARKETPLACE / LEGAL | ✅ GET | ✅ | N/A | landing | N/A | N/A | N/A | read-only |
| LEGACY Loan / Investment models | ⚠ no API writes | ⚠ leftover schema + `User._count` | schema + unused mock UI | N/A | N/A | N/A | N/A | CODE: unused writes; DB rows require live DB check |

`DocumentLog` **does not exist** in Prisma.

---

## 3. Database Audit/History Inventory

Classification: **A** = audit/history evidence · **B** = source-of-truth business · **C** = mixed.

### 3.1 Named log / event tables

#### AccessAuditLog → `access_audit_logs` · AUTH · **A**

Sole authentication-history table. Events: `USER_SIGNED_UP`, `USER_LOGGED_IN`, `USER_LOGGED_OUT`.  
No User FK (scalar `user_id` / `actor_user_id` only). Required `metadata` Json. `occurred_at` + `created_at`. No `updated_at`. Append-only create. Device derived at read from `user_agent`.  
**REMOVED:** `AccessLog` / `access_logs`.

#### SecurityAuditLog → `security_audit_logs` · SECURITY/RBAC · **A**

Sole security/admin-control table. Distinguishes `actor_user_id` vs `subject_user_id`. No User / role / invitation / membership FKs.  
**REMOVED:** `SecurityLog` / `security_logs`.

#### OnboardingAuditLog → `onboarding_audit_logs` · ONBOARDING · **A**

Sole onboarding/compliance history table. Append-only create. Required `metadata` Json. `occurred_at` + `created_at`. No `updated_at`. No User/org/RegTank FKs (scalar historical ids only).  
Reserved IDs (18): original A039–A055 plus appended A175 `ORGANIZATION_PROFILE_UPDATED_BY_ADMIN`. Types: `ONBOARDING_STARTED`, `ONBOARDING_RESUMED` (retired, historical rows readable), `ONBOARDING_RESTARTED`, `ONBOARDING_RESET`, `USER_ONBOARDING_STATUS_UPDATED`, `ONBOARDING_STATUS_CHANGED`, `ONBOARDING_APPROVED`, `ONBOARDING_REJECTED`, `ONBOARDING_FINAL_APPROVAL_COMPLETED`, `ONBOARDING_COMPLETED`, `AML_APPROVED`, `SSM_APPROVED`, `INVESTOR_SOPHISTICATED_STATUS_UPDATED`, `CTOS_REPORT_RECEIVED` (retired, `ctos_reports` still persisted), `CORPORATE_ENTITIES_UPDATED` (retired, `corporate_entities` still persisted), `DIRECTOR_ONBOARDING_INVITATION_SENT`, `DIRECTOR_KYC_STATUS_UPDATED` (APPROVED/REJECTED outcomes only), `ORGANIZATION_PROFILE_UPDATED_BY_ADMIN`.
Current active onboarding event types: **15**. `AML_APPROVED.onboarding_id` is optional linkage to `reg_tank_onboarding.id` when the writer already knows the session. **REMOVED:** `OnboardingLog` / `onboarding_logs`. Audit is never workflow state. There is **no** canonical/global `AuditEvent` table. Live catalogue: **177** reserved / **174** active / **3** retired.

#### ApplicationAuditLog → `application_audit_logs` · APPLICATION · **A**

Append-only application/review/contract/invoice history. Required `metadata` Json. `occurred_at` + `created_at`. No `updated_at`. No Application/User FKs (scalar historical ids only).  
**REMOVED:** `ApplicationLog` / `application_logs`. Audit is never workflow state. Resubmit comparison reads `ApplicationRevision` + `ApplicationReviewRemark`.

#### SigningAuditLog → `signing_audit_logs` · SIGNING · **A**

Append-only signing package history. Required `metadata` Json. `occurred_at` + `created_at`. No `updated_at`. No envelope/application/user FKs (scalar historical ids only).  
Events include `SIGNING_PACKAGE_CREATED/SENT/COMPLETED/VOIDED/DECLINED/EXPIRED`, recipient, eKYC, and reminder events. Envelope graph / `SigningCloudEkyc` remain signing SOT.

#### ApplicationReviewEvent → `application_review_events` · REVIEW · **removed**

Legacy table **dropped**. Application history is `ApplicationAuditLog`. Current review status is `ApplicationReview` / `ApplicationReviewItem`. Cycle-scoped amendment remarks are `ApplicationReviewRemark`. Comparison snapshots are `ApplicationRevision`.

#### ProductAuditLog → `product_audit_logs` · PRODUCT · **A**

Fields: `id`, `product_id`, `event_type`, `occurred_at`, `created_at`, `actor_type`, `actor_user_id`, org fields, `target_type`, `target_id`, `source`, `portal`, `ip_address`, `user_agent`, `correlation_id`, `idempotency_key`, `metadata`.  
**No Product or User FK.** Append-only. Replaced and removed legacy `ProductLog` / `product_logs`. Failed-create rollback does not delete these rows.

#### LegalAdminAuditLog → `legal_admin_audit_logs` · LEGAL ADMIN · **A**

Fields: `id` (cuid), `legal_document_id`, `legal_document_version_id`, `event_type`, `occurred_at`, `created_at`, `actor_type`, `actor_user_id`, org fields, `target_type`, `target_id`, `source`, `portal`, `ip_address`, `user_agent`, `correlation_id`, `idempotency_key`, `metadata`.  
**No LegalDocument, LegalDocumentVersion, or User FK.** Append-only. Replaced and removed legacy `LegalDocumentAuditLog` / `legal_document_audit_logs`.

#### NoteAuditLog → `note_audit_logs` · NOTE · **A**

Fields: `id` (cuid), `note_id` (nullable only for `TRUSTEE_SIGNATURE_UPDATED`), `event_type` (string), `occurred_at`, `created_at`, `actor_type`, `actor_user_id`, `organization_id`, `organization_kind`, `target_type`, `target_id`, `source`, `portal`, `ip_address`, `user_agent`, `correlation_id`, `idempotency_key`, `metadata` (required Json).  
**No Note/User/org FKs.** No `updated_at`. Append-only create. Not financial/workflow SOT. Replaced and removed leftover `NoteEvent` / `note_events` and `NoteAdminAction` / `note_admin_actions`. Title/summary edits, featured settings, and prospectus draft saves remain intentionally unaudited.

#### GatewayPaymentEvent → `gateway_payment_events` · PAYMENT · **removed**

Legacy table **dropped**. `PaymentAuditLog` is the payment business-audit history. `GatewayWebhookEvent` remains transport/replay evidence.

#### GatewayWebhookEvent → `gateway_webhook_events` · PAYMENT TRANSPORT · **C**

Fields: `id`, `event_id`, `event_type` (provider string), `gatewayAccount`, `payload` (JSON), `signature_valid`, `processed_at`, `error`, `created_at`.  
Unique (gatewayAccount, event_id). **Updated** after processing (`processed_at`/`error`).

#### NotificationBroadcastAuditLog → `notification_broadcast_audit_logs` · NOTIFICATION ADMIN · **A**

Fields: `id`, `event_type` (`NOTIFICATION_BROADCAST_PROCESSED`), `occurred_at`, `created_at`, `actor_type`, `actor_user_id` (no FK), `organization_id`/`organization_kind` (null), `target_type` (`NOTIFICATION_BROADCAST`), `target_id` (= row id), `source`, `portal`, `ip_address`, `user_agent`, `correlation_id`, `idempotency_key` (null), `metadata` (required), `audience_type`, `notification_type_id` (no FK).  
Create-only for bulk send. Legacy `NotificationLog` / `notification_logs` has been removed.

### 3.2 Evidence / history / SOT (not named Log, still historical)

| Model | Table | Class | Mutability | Cascade risk |
|---|---|---|---|---|
| UserSession | user_sessions | B/C session evidence | upsert, revoked_at | User Cascade |
| AdminInvitation | admin_invitations | B | updated on accept | — |
| ApplicationRevision | application_revisions | **B snapshot evidence** | create | Application Cascade |
| ApplicationReview / Item / Remark | application_reviews* | **B current review state** | **updated in place** | Application Cascade |
| LegalDocumentAcceptance | legal_document_acceptances | **B legal evidence** | **updated OPENED→ACCEPTED** | version Restrict; user SetNull |
| LegalDocumentVersion | legal_document_versions | B | status timestamps | definition Cascade |
| SigningEnvelope/Document/Recipient/Assignment | signing_* | **B signing SOT** | updated | Envelope Cascade from Application |
| SigningCloudEkyc | signingcloud_ekyc | B | updated | User SetNull |
| InvestorBalanceTransaction | investor_balance_transactions | **B accounting** | create + unique idempotency | Org Cascade |
| NoteLedgerEntry | note_ledger_entries | **B accounting** | create + unique idempotency | Note SetNull; account Restrict |
| NoteLedgerAccount | note_ledger_accounts | B config | seed/system; **no API mutate found** | Restrict entries |
| NotePayment / NoteSettlement | note_payments / note_settlements | B | status updates | Note Cascade |
| GatewayPayment | gateway_payments | B | status updates | — |
| GatewayOrderAttempt | gateway_order_attempts | B/C transport | upsert/update | — |
| GatewayPaymentReceipt | gateway_payment_receipts | B generated evidence | update | — |
| GatewayReconRun / Exception | gateway_recon_* | B ops history | exception **resolved_at update** | Run Cascade exceptions |
| WithdrawalInstruction | withdrawal_instructions | B | status timestamps | — |
| ShorakaTradeOrder | shoraka_trade_orders | B provider order | payloads + callback JSON | — |
| RegTankOnboarding | regtank_onboarding | B | **webhook_payloads array mutated**; status updated | Org/User Cascade |
| CtosReport | ctos_reports | B snapshot | create | Org Restrict |
| CtosPartySupplement | ctos_party_supplements | B | onboarding_json updated | — |
| NoteProspectusReview / Publication | note_prospectus_* | B | review updated; publication create | Note Cascade |
| Notification | notifications | B delivery | read_at/resolved; **deleted by cleanup** | User Cascade |
| DisplayReferenceAllocation | display_reference_allocations | B | create | — |
| corporate_individual_kyc | corporate_individual_kyc | B | updates | RegTank Cascade |
| AmlIdentityMapping | aml_identity_mapping | B | upsert | — |
| PlatformFinanceSetting | platform_finance_settings | B current config | **upsert in place** | — |
| AdminRoleConfig | admin_roles | B current config | update/delete | Admin SetNull |
| Loan / Investment | loans / investments | ⚠ leftover schema | **no `prisma.loan` / `prisma.investment` writers**; admin user detail **reads** `User._count.loans` / `_count.investments` | Admin user stats only; `recent-loans.tsx` is unused mock |

### 3.3 Confirmed absences

- **No `DocumentLog` model.**
- **No `SiteDocument` / `DocumentLog` models** (dropped by `20260805190000_remove_site_documents_and_document_logs`; tests assert route 404). S3 object leftovers cannot be proven from the repo.
- **No `ApplicationLog` / `application_logs`.** Dropped after ApplicationAuditLog + SigningAuditLog cutover. `ApplicationAuditLog` and `SigningAuditLog` use scalar ids (no FKs).

---

## 4. Complete Business Mutation Inventory

IDs are report-only original inventory case numbers (A001…). They are **not** the current catalogue A001–A177 IDs (for example, original case A049 here is admin refresh-corporate-entities, while catalogue A049 is `AML_APPROVED`). Trigger paths in this section were captured before Phase 4 Access/Security cutover. **Current writers are AccessAuditLog / SecurityAuditLog / OnboardingAuditLog as documented in the header and §5–§7.** Historical `LOGIN`/`access_logs` labels in the table below are not live.

Actor: USER / ADMIN / SYSTEM / PROVIDER / EXTERNAL SIGNER / WEBHOOK.

| ID | Module | Trigger | Function | Meaning | Actor | Logged? | Event / table |
|---|---|---|---|---|---|---|---|
| A001 | AUTH | GET Cognito callback | `cognito.routes.ts` | Login/signup | USER | YES | LOGIN/SIGNUP access_logs |
| A002 | AUTH | POST `/v1/auth/sync-user` | `AuthService.syncUser` | Sync + LOGIN | USER | YES | LOGIN access_logs |
| A003 | AUTH | POST `/v1/auth/logout` | `AuthService` | Logout | USER | YES | LOGOUT |
| A004 | AUTH | GET `/api/auth/logout` | cognito.routes | Logout | USER | YES | LOGOUT |
| A005 | AUTH | POST `/v1/auth/add-role` | `addRole` | Add portal role | USER | YES | ROLE_ADDED security_logs |
| A006 | AUTH | switch-role | AuthService | Switch role | USER | YES | ROLE_SWITCHED |
| A007 | AUTH | PATCH `/v1/auth/profile` | AuthService | Own profile | USER | YES | PROFILE_UPDATED security |
| A008/A009 | AUTH | password change | AuthService | Success **and** failure | USER | YES misleading | PASSWORD_CHANGED both |
| A010/A011 | AUTH | email change | AuthService | Success **and** failure | USER | YES misleading | EMAIL_CHANGED both |
| A012 | AUTH | POST confirm-signup | auth controller | Confirm Cognito | USER | **MISSING AUDIT** | Cognito only |
| A013 | AUTH | resend-signup-code | auth controller | Resend | USER | **MISSING AUDIT** | |
| A014 | AUTH | refresh-token | auth controller | Refresh | USER | **MISSING AUDIT** | session |
| A015 | AUTH | POST start-onboarding | AuthService | Explicit start log | USER | YES | ONBOARDING_STARTED |
| A016 | SECURITY | requirePermission 403 | middleware | Failed admin access | SYSTEM | **MISSING AUDIT** | pino |
| A017–A019 | RBAC | POST/PATCH/DELETE `/v1/admin/roles` | AdminService | Role CRUD | ADMIN | YES | ROLE_CREATED / PERMISSIONS_UPDATED / REMOVED |
| A020 | RBAC | PATCH users/:id/roles | updateUserRoles | Change user roles | ADMIN | YES | ROLE_ADDED/REMOVED **on admin user_id** |
| A021–A023 | RBAC | PUT admin-users role/deactivate/reactivate | AdminService | Role/status | ADMIN | YES misleading | all ROLE_SWITCHED |
| A024–A026 | INVITE | invite / generate-url / resend | AdminService | Create/resend invite | ADMIN | **MISSING AUDIT** | AdminInvitation + SES |
| A027 | INVITE | DELETE invitations/:id/revoke | revokeInvitation | Revoke | ADMIN | YES | INVITATION_REVOKED |
| A028 | INVITE | POST accept-invitation | | Accept admin invite | USER | PARTIAL | invitation + possible ROLE_ADDED |
| A029 | USER | PATCH users/:id/onboarding | updateUserOnboarding | Admin onboarding flags | ADMIN | YES | ONBOARDING_STATUS_UPDATED |
| A030 | USER | PATCH users/:id/profile | updateUserProfile | Admin edits profile | ADMIN | YES dual | AccessLog + SecurityLog PROFILE_UPDATED |
| A031 | USER | PATCH users/:id/user-id | updateUserId | Assign public user_id | ADMIN | **MISSING AUDIT** HIGH | User row |
| A032/A033 | ORG | POST organizations investor/issuer | organization service | Create org | USER | **MISSING AUDIT** | Org row |
| A034 | ORG | PATCH org | | Update org | USER | **MISSING AUDIT** | |
| A035 | ORG | POST .../complete-onboarding | `OrganizationService.completeOnboarding` | Owner can set org COMPLETED | USER | **MISSING AUDIT** HIGH | No portal page caller. Distinct from admin `complete-final-approval` and `POST /v1/auth/complete-onboarding`. |
| A036 | ORG | POST accept-tnc | `acceptTnc` | Org tnc_accepted | USER | YES | TNC_APPROVED onboarding_logs |
| A037–A044 | ORG MEMBERS | invite/remove/leave/role/ownership/invites | organization service | Membership lifecycle | USER | **MISSING AUDIT** HIGH | membership tables |
| A045 | ORG | PATCH corporate-info | | Corporate JSON | USER | **MISSING AUDIT** | |
| A046 | CTOS | PATCH ctos-party-email | | Party email | USER | **MISSING AUDIT** | |
| A047/A050 | ORG | send-director-onboarding / admin notify | | Director action | USER/ADMIN | PARTIAL | Confirm & Send writes catalogue A054 `DIRECTOR_ONBOARDING_INVITATION_SENT` after company COMPLETED. Admin notify-owner remains notification only. |
| A048 | ORG | POST refresh-aml | RegTank service | Refresh AML | USER | PARTIAL | maybe ONBOARDING_STATUS_UPDATED |
| A049 | ORG | admin refresh-corporate-entities | AdminService | Entities JSON | ADMIN | Intentional no audit | `corporate_entities` still persists; A053 `CORPORATE_ENTITIES_UPDATED` retired |
| A051 | ORG | PATCH sophisticated-status | updateSophisticatedStatus | Sophisticated flag | ADMIN | YES | SOPHISTICATED_STATUS_UPDATED |
| A052/A058 | ONBOARDING | restart / reset-onboarding | AdminService | Reset | ADMIN | YES dual | OnboardingLog + AccessLog ONBOARDING_RESET |
| A053 | ONBOARDING | complete-final-approval | completeFinalApproval | Org COMPLETED | ADMIN | YES | FINAL_APPROVAL_COMPLETED |
| A054–A056 | ONBOARDING | approve-aml/ssm/onboarding | AdminService | Gates | ADMIN | YES | AML_APPROVED / SSM_APPROVED / ONBOARDING_APPROVED |
| A057 | ONBOARDING | refresh-status* | AdminService | Live RegTank pull | ADMIN | YES | ONBOARDING_STATUS_UPDATED |
| A059 | ONBOARDING | cancel | AdminService | Cancel | ADMIN | YES | ONBOARDING_CANCELLED |
| A060/A061 | REGTANK | start/resume APIs | regtank/service.ts | Start/resume | USER | PARTIAL | start writes ONBOARDING_STARTED; resume writes no onboarding audit (A040 retired) |
| A062–A067 | REGTANK | webhooks liveness/cod/eod/kyc | handlers | Status/AML JSON | WEBHOOK | YES mixed | see §10 |
| A065 | KYB | POST /webhooks/regtank/kyb | kyb-handler | KYB JSON | WEBHOOK | YES via helper | main-company APPROVED → `AML_APPROVED` (`onboarding_id` = `reg_tank_onboarding.id` when the COD session is already loaded) |
| A068 | KYT | POST /webhooks/regtank/kyt | kyt-handler | Appends `webhook_payloads` only | WEBHOOK | **MISSING AUDIT** | No org/AML/OnboardingLog/notification. Inline TODO. |
| A070/A072 | CTOS | POST ctos-reports / subject | ctos-report-service | Insert reports | ADMIN | **MISSING** (A071 partial) | CtosReport |
| A071 | CTOS | same if financial APPROVED | reset financial review | Section → PENDING | SYSTEM | YES | SECTION_REVIEWED_PENDING userId `"system"` |
| A073 | CTOS | cron */5 | ctos-kyb-retry | Retry KYB attach | SYSTEM | **MISSING AUDIT** | lastKybAttemptAt |
| A074–A080 | LEGAL ADMIN | admin legal-documents CRUD | legalDocumentService | Create/update/upload/replace/publish/archive/restore | ADMIN | YES | LEGAL_* audit log |
| A081 | LEGAL | POST versions/:id/open | recordOpened | Display legal PDF | USER | **MISSING audit event** | SOT acceptance OPENED |
| A082 | LEGAL | POST accept | accept | Consent | USER | **MISSING audit event** | SOT ACCEPTED in place |
| A083 | APP | POST /v1/applications | createApplication | Create draft | USER | YES | APPLICATION_CREATED |
| A084–A086 | APP | step / upload / delete doc | applications | Wizard/files | USER | **MISSING AUDIT** | JSON+S3 |
| A087 | APP | PATCH status SUBMITTED | controller | Submit | USER | YES | APPLICATION_SUBMITTED |
| A088 | APP | POST :id/resubmit | amendments/service | Resubmit | USER | YES | APPLICATION_RESUBMITTED (may duplicate via PATCH) |
| A089 | APP | POST acknowledge-workflow | acknowledgeWorkflow | Ack amendment | USER | **MISSING AUDIT** | remarks |
| A090 | APP | POST archive | archiveApplication | Archive | USER | **MISSING AUDIT** | status |
| A091 | APP | DELETE draft | deleteDraftApplication | Delete | USER | **MISSING AUDIT** | row gone |
| A092 | APP | POST cancel | cancelApplication | Withdraw | USER | YES | APPLICATION_WITHDRAWN |
| A093 | APP | PATCH REJECTED issuer route | controller | Reject | USER | YES misleading | APPLICATION_REJECTED portal ADMIN |
| A094/A095 | APP | PATCH admin status | AdminService | Reject / reset UNDER_REVIEW | ADMIN | YES | APPLICATION_REJECTED / RESET_TO_UNDER_REVIEW |
| A096 | APP | — | — | Application “approved” | — | **DEFINED NEVER WRITTEN** | enum + notification type |
| A097/A098 | REVIEW | section/item approve/reject/amend/reset | logReviewActivity | Review decision | ADMIN | YES | SECTION/ITEM_REVIEWED_* |
| A099–A102 | REVIEW | comments + pending CRUD | AdminService | Comments/drafts | ADMIN | **MISSING AUDIT** | remarks/pending |
| A103 | REVIEW | submit-amendment-request | submitPendingAmendments | Send amendments | ADMIN | YES | APPLICATION_AMENDMENTS_REQUESTED |
| A104–A111 | CONTRACT/INVOICE | CRUD/upload/unlink/delete | services | Draft entities | USER | withdraw YES; rest **MISSING** | CONTRACT/INVOICE_WITHDRAWN |
| A112/A113 | OFFER | send contract/invoice offer | AdminService | Offer sent | ADMIN | YES | *_OFFER_SENT ApplicationAuditLog |
| A114/A115 | OFFER | reset section/item when OFFER_SENT | AdminService | Retract | ADMIN | YES | *_OFFER_RETRACTED |
| A116/A117 | OFFER | extend-signing-deadline | AdminService | Extend | ADMIN | YES | *_SIGNING_DEADLINE_EXTENDED |
| A118/A119 | OFFER | POST acceptance | ApplicationService | Submit BR/docs | USER | YES | *_ACCEPTANCE_SUBMITTED/RESUBMITTED |
| A120 | OFFER | admin approve acceptance | AdminService | Unlock signing | ADMIN | YES | *_ACCEPTANCE_APPROVED_FOR_SIGNING |
| A121 | OFFER | request acceptance doc change | review | CHANGES_REQUESTED | ADMIN | PARTIAL | ITEM/SECTION_REVIEWED_* + notification |
| A122 | OFFER | accept contract | respondToContractOffer | Accept | USER | YES | CONTRACT_OFFER_ACCEPTED |
| A123 | OFFER | reject contract | same | Reject | USER | YES misleading | **CONTRACT_WITHDRAWN** not CONTRACT_OFFER_REJECTED |
| A124/A125 | OFFER | accept/reject invoice | respondToInvoiceOffer | | USER | YES | INVOICE_OFFER_ACCEPTED/REJECTED |
| A126/A127 | OFFER | hourly job | acceptance-signing-expiry | Expire | SYSTEM | YES | *_OFFER_EXPIRED userId system |
| A128 | OFFER | same job | reminders | 24h reminder | SYSTEM | **MISSING AUDIT** | notification only |
| A129 | OFFER | PATCH large-private | AdminService | Flag | ADMIN | YES | CONTRACT_CUSTOMER_LARGE_PRIVATE_UPDATED |
| A130 | BOARD | acceptance_documents upload | application JSON | BR file | USER | **MISSING AUDIT** | JSON s3_key only |
| A131–A134 | SIGNING | create/send/complete/void | SigningService | Package lifecycle | ADMIN/USER/PROVIDER | YES | SIGNING_PACKAGE_* |
| A135–A143 | SIGNING | remind, access, eKYC, per-signer, return, expire, reconcile | signing/ekyc/jobs | | mixed | **MISSING AUDIT** | Signing* SOT |
| A144 | SIGNINGCLOUD | webhook | webhook-controller | Provider sync | WEBHOOK | PARTIAL | may cause COMPLETED |
| A145–A153 | NOTE | create/update/featured/publish/unpublish/close/fail/activate | NoteService | Note admin | ADMIN/SYSTEM | YES dual | see catalogue |
| A154–A158 | PROSPECTUS | create/save/invalidate/approve | prospectus-review.service | Review | ADMIN | YES dual | PROSPECTUS_* |
| A159 | PROSPECTUS | GET marketplace prospectus | | Investor view | USER | **MISSING AUDIT** | publication hash |
| A160 | INVEST | POST marketplace investments | createInvestment | Commit funds | USER | YES | INVESTMENT_COMMITTED |
| A161 | DEPOSIT | POST deposits + webhook | deposit + webhook | Credit wallet | USER/WEBHOOK | PARTIAL | NAME_CHECK; no CAPTURED event |
| A162 | BALANCE | test-topup | testTopUpInvestorBalance | Dev credit | USER | **MISSING AUDIT** | balance txn |
| A163 | WITHDRAW | POST investor/balance/withdraw | createInvestorWithdrawal | Request payout | USER | **MISSING AUDIT** HIGH | WithdrawalInstruction + debit |
| A164/A165 | FEE | onboarding-fee / processing-fee | fee services | Checkout create | USER | **MISSING** event on create | GatewayPayment CREATED |
| A166–A175 | GATEWAY | name-check / refunds / expire | payment modules | | ADMIN/SYSTEM | YES those types | gateway_payment_events |
| A176 | GATEWAY | Curlec webhook | webhook-service | Transport | WEBHOOK | TRANSPORT | gateway_webhook_events |
| A177 | GATEWAY | capture complete | webhook-service | PAID/COMPLETED | WEBHOOK | **MISSING** payment event type | GatewayPayment + ledger |
| A178 | GATEWAY | receipt retry | job/admin | PDF | SYSTEM/ADMIN | **MISSING AUDIT** | receipt |
| A179/A180 | RECON | run / resolve | recon-controller | Recon | ADMIN/SYSTEM | **MISSING AUDIT** HIGH | recon tables |
| A181–A185 | DISBURSE | closeFunding + withdrawal APIs | NoteService | Trustee flow | ADMIN | YES | WITHDRAWAL_* / ISSUER_DISBURSEMENT_* |
| A186 | SHORAKA | submit-order | shoraka-stp-service | Submit | ADMIN | YES incomplete | SHORAKA_ORDER_SUBMITTED actor null |
| A187 | SHORAKA | query-status | | Poll | ADMIN | **MISSING AUDIT** | order row |
| A188 | SHORAKA | fetch-certificate | | Cert | ADMIN | YES incomplete | SHORAKA_CERTIFICATE_FETCHED actor null |
| A189 | SHORAKA | POST callback | webhook controller | Provider status | WEBHOOK | **MISSING** NoteEvent | callback_payload |
| A190–A193 | REPAY | record/approve/reject | NoteService | Payments | ADMIN/USER | YES | PAYMENT_* / ISSUER_PAYMENT_SUBMITTED |
| A194–A196 | SETTLE | preview/approve/post | NoteService | Settlement | ADMIN | YES | SETTLEMENT_* |
| A197–A199 | FEE | service-fee trustee | NoteService | Service fee | ADMIN | YES | SERVICE_FEE_* |
| A200 | ARREARS | late-charge/calculate | | Preview only | ADMIN | n/a no persist | |
| A201–A205 | ARREARS/DEFAULT | check/approve/letters/mark | NoteService | | ADMIN | YES | LATE_CHARGE_* / *_LETTER / NOTE_DEFAULT_MARKED |
| A206–A210 | PRODUCT | products CRUD | products/repository + audit/writer | | ADMIN | YES (`ProductAuditLog`, retained on rollback) | product_audit_logs |
| A212 | NOTIF | POST notifications/admin/send | sendBulkNotification | Broadcast | ADMIN | YES | notification_broadcast_audit_logs |
| A213–A216 | NOTIF | groups/types/preferences | notification controller | Config | ADMIN/USER | **MISSING AUDIT** | tables |
| A217 | NOTIF | cron 00:00 | runCleanup | Delete old notifs | SYSTEM | **MISSING AUDIT** | deletions |
| A218/A219 | SETTINGS | PATCH platform-finance + trustee sig | NoteService | Caps/templates/fees | ADMIN | **MISSING AUDIT** CRITICAL | settings upsert |
| A220 | GUARANTOR | start-aml | startApplicationGuarantorAcurisScreening | Start screening | ADMIN | **MISSING AUDIT** | RegTank ids |
| A221 | FEE | fee captured | webhook | Fee paid flag | WEBHOOK | **MISSING** onboarding/application event | GatewayPayment |
| A222 | AUTH | LOGIN_NEW_DEVICE | registry only | | — | **DEFINED NEVER WRITTEN** | |
| A223 | NOTE | ISSUER_RESIDUAL_WITHDRAWAL_CREATED | sort helper only | | — | **DEFINED NEVER WRITTEN** | residual in SETTLEMENT_POSTED |
| A224 | GATEWAY | OVERRIDE_* | enum + unused `getOpenOverrideProposal` + admin copy labels | | — | **DEFINED NEVER WRITTEN** | Helper never called; no endpoint/UI mutation |
| A226 | OFFER | GET signed-letter | | View PDF | USER/ADMIN | read-only | generated PDF |

GET routes that mutate: prospectus `getOrCreateReview` may **create** review + `PROSPECTUS_REVIEW_CREATE` / invalidate approval. Signing sync-from-provider POSTs mutate envelope.

---

## 5. Current Log/Event Writers

### AccessAuditLog

OAuth callback: `USER_SIGNED_UP` / `USER_LOGGED_IN` (`source=API`, `metadata.loginMethod=COGNITO_OAUTH`).  
Normal portal logout produces one `USER_LOGGED_OUT` row through Cognito `GET /v1/auth/cognito/logout`. Two rows are possible only if both the `POST /v1/auth/logout` (`AuthService.logout`) and Cognito GET `/logout` paths are explicitly invoked. Current portal UIs do not normally call both. GET logout portal: valid `?portal=issuer|investor|admin` → Origin/Referer hostname → `null` (`user.roles[0]` is not a fallback).  
`POST /v1/auth/sync-user` does **not** write login audit.

### SecurityAuditLog

`AuthService`: `USER_ROLE_ADDED`, `ACTIVE_ROLE_CHANGED`, `USER_PROFILE_UPDATED`, `PASSWORD_CHANGED` / `PASSWORD_CHANGE_FAILED`, `USER_EMAIL_VERIFIED` / `EMAIL_VERIFICATION_FAILED`.  
`AdminService`: role config C/U/D, `USER_ROLES_UPDATED`, `ADMIN_USER_ROLE_CHANGED`, deactivate/reactivate, invitation lifecycle, `USER_PUBLIC_ID_CHANGED`, `USER_PROFILE_UPDATED_BY_ADMIN`.  
Organization membership: `ORGANIZATION_MEMBER_*`, ownership transfer, invitation resend/revoke.  
Notification config (not broadcasts): type/group/preference.  
Middleware + Cognito admin gate: `ADMIN_ACCESS_DENIED`.

Legacy `AuthRepository.createAccessLog` / `AdminRepository.createAccessLog` / `createSecurityLog` **removed**.

### OnboardingAuditLog

Writers: `writeOnboardingAuditLog` (`apps/api/src/modules/onboarding/audit/writer.ts`) only. Live callers include start (not resume), restart, reset, status transitions (including amendment requested/resubmitted), admin approvals, AML/SSM/sophisticated/director invitation, director APPROVED/REJECTED outcomes (`writeDirectorKycOutcomeAuditLogs`), and legacy complete-onboarding (`ONBOARDING_COMPLETED`). Resume does **not** write `ONBOARDING_RESUMED`. Corporate-entity JSON sync does **not** write `CORPORATE_ENTITIES_UPDATED`. CTOS fetch/storage does **not** write `CTOS_REPORT_RECEIVED` (`ctos_reports` still persists). TNC, guarantor AML, and fee capture do **not** write this table. `AML_APPROVED` from the shared helper threads `onboarding_id` when the caller already has `reg_tank_onboarding.id`.

Production final approval writes **`ONBOARDING_FINAL_APPROVAL_COMPLETED`**. `AuthService.cancelOnboarding` does **not** read audit as state. Legacy `OnboardingLog` writers/readers **removed**. Admin `GET /v1/admin/onboarding-logs` reads `OnboardingAuditLog`.

### ApplicationAuditLog

`writeApplicationAuditLog` (`apps/api/src/modules/applications/audit/writer.ts`) only. Live callers: applications controller/service, admin/service, amendments/service, contracts/service, invoices/service, CTOS, acceptance-signing-expiry job. Append-only create. Legacy `logApplicationActivity` / `createApplicationLog` / `applications/logs/*` **removed**.

### SigningAuditLog

`writeSigningAuditLog` (`apps/api/src/modules/signing/audit/writer.ts`) only. Live callers: signing/service, eKYC, envelope/offer expiry jobs, reconcile. Envelope log APIs and the application timeline merge **read** this table. Append-only create.

### ApplicationReviewEvent

**Removed.** Table `application_review_events` dropped. No Prisma model, writers, or readers. Offer-sent and amendment-submit history is `ApplicationAuditLog` (`CONTRACT_OFFER_SENT`, `INVOICE_OFFER_SENT`, `APPLICATION_AMENDMENTS_REQUESTED`).

### ProductAuditLog

`products/audit/writer.ts` via `products/repository.ts` on create/update/inactivate/reactivate/delete. Append-only; not deleted on failed-create rollback. Legacy `ProductLog` removed.

### LegalAdminAuditLog

`legal-documents/audit/writer.ts` via `LegalDocumentService` in the same Prisma transaction as the legal mutation. Append-only. Legacy `LegalDocumentAuditLog` / `audit-log-service.ts` removed.

### NoteAuditLog

`notes/audit/writer.ts` (`writeNoteAuditLog` / `writeNoteAuditFromActor`); prospectus and Shoraka writers call it. `GET /v1/admin/notes/:id/events` and admin note detail read `NoteAuditLog` (full history, newest first, no hidden 50 cap). `NoteLogAdapter` reads `note_audit_logs` only. `NoteEvent` / `note_events` and `NoteAdminAction` / `note_admin_actions` **removed**.

### PaymentAuditLog

`payment/audit/writer.ts` (`writePaymentAuditLog` / `writeGatewayPaymentAudit` / `writeInvestorWithdrawalAudit` / `writeReconExceptionAudit`). `GET /v1/admin/gateway-payments/:id` `events[]` reads `PaymentAuditLog`. Legacy `GatewayPaymentEvent` / `gateway-events.ts` **removed**.

Admin/investor **wallet activity** does not read or write this table. In-flight deposit overlay rows are built from `GatewayPayment` at read time and must not be documented as `PaymentAuditLog` events.

### GatewayWebhookEvent

Created on ingest; **`updateMany` processed_at/error** in `webhook-service.ts`.

### NotificationBroadcastAuditLog

`writeNotificationBroadcastProcessedAudit` via `NotificationService.sendBulkNotification` only. Event: `NOTIFICATION_BROADCAST_PROCESSED`.

### LegalDocumentAcceptance

`acceptance-service.ts` `recordOpened` / accept: **create or update in place**.

---

## 6. Current Log/Event Readers & Dependencies

| Table | Reader | Category | Fields/filters | Severity |
|---|---|---|---|---|
| access_audit_logs | `AdminService.listAccessLogs` `GET /v1/admin/access-logs` (+ export + detail) | Admin UI `/audit` AccessLogsPanel | eventType, search, dates, pagination; `status=failed` matches nothing | MEDIUM |
| access_audit_logs | `accessAuditLogReader.findRecentLogins` via `AuthService.getCurrentUser` `GET /v1/auth/me` | Account “recent logins” | `event_type=USER_LOGGED_IN`, last 3 | MEDIUM |
| access_audit_logs | `accessAuditLogReader.countForUser` | Admin user page `stats.accessLogs` | count only | LOW |
| security_audit_logs | `GET /v1/admin/security-logs` (+ export) | Admin UI `/audit` security | all live Security events | MEDIUM |
| onboarding_audit_logs | `GET` org timeline via `OrganizationLogAdapter` | Activity feeds issuer/investor/admin org | curated user-facing: STARTED, RESTARTED, review/amendment STATUS_CHANGED, REJECTED, APPROVED, COMPLETED; issuer invitation + director APPROVED/REJECTED; investor sophisticated when value changes; FINAL_APPROVAL hidden from users; RESUMED not user-facing; scoped by `organization_id` / `subject_user_id` | MEDIUM |
| onboarding_audit_logs | Admin `listOnboardingLogs` / `getOnboardingLogById` / `exportOnboardingLogs` | Admin `/audit` onboarding | Phase 5 event catalogue | MEDIUM |
| application_audit_logs | `GET /v1/applications/:id/logs` `ApplicationService` (merged with signing) | Issuer/admin application timeline | application-domain types for app | MEDIUM |
| application_audit_logs | `ApplicationLogAdapter` `GET /v1/activities` | Activity feeds | curated application-domain subset | MEDIUM |
| signing_audit_logs | `GET /v1/applications/:id/logs` merge + envelope `GET .../logs` | Application timeline + signing envelope APIs | signing catalogue | MEDIUM |
| signing_audit_logs | `SigningLogAdapter` `GET /v1/activities` | Activity feeds | signing subset | MEDIUM |
| application_review_events | **removed** | — | — | — |
| product_audit_logs | `GET /v1/admin/product-logs` + export CSV/JSON | Admin `/audit` products | eventType filter | MEDIUM |
| legal_admin_audit_logs | `GET /v1/admin/legal-document-audit-logs` + export | Admin `/audit` legal | action → event_type filters | MEDIUM |
| legal_document_acceptances | acceptance-admin + user required/pending | Compliance UI + **onboarding gate** `hasCompletedRequiredAcceptances` | **HIGH** |
| note_audit_logs | `GET admin notes/:id/events` + note detail mapper | Admin note timeline | full history newest-first; no hidden 50 cap | MEDIUM |
| note_audit_logs | `NoteLogAdapter` | Activity | **subset only** (NOTE_CREATED/PUBLISHED/UNPUBLISHED/CAMPAIGN_PAUSED/CAMPAIGN_RESUMED/FUNDING_*/ACTIVATED, INVESTMENT_COMMITTED, SETTLEMENT_POSTED, DISBURSEMENT_COMPLETED, REPAYMENT_*, NOTE_MARKED_DEFAULT, plus issuer terms/servicing rules). Investor pause/resume requires COMMITTED|CONFIRMED|SETTLED. Only `NOTE_ACTIVATED` is “Note Active”. | MEDIUM |
| payment_audit_logs | `getGatewayPaymentDetail` `events[]` | Admin payment detail timeline | typed metadata; not payment SOT | MEDIUM |
| gateway_webhook_events | webhook-service findFirst/update | **Idempotency / processing** | HIGH transport |
| notification_broadcast_audit_logs | `GET /v1/notifications/admin/logs` | Admin notification logs | type → notification_type_id; target → audience_type | MEDIUM |
| application_revisions | admin resubmit comparison | Compliance/compare | HIGH |
| investor_balance_transactions | `GET /v1/investor/balance/activity`; admin `GET /v1/admin/organizations/investor/:id/balance-activity` (`organizations.view`) | Wallet / cash statement | Posted ledger rows. Uncredited in-flight deposits overlay from `GatewayPayment` (`PAID` / `NAME_CHECK_PENDING` / `HELD` / `REFUND_INITIATED`), `affectsAvailableBalance: false`. **Not** `PaymentAuditLog`. **Not** `/v1/activities`. | HIGH keep |
| note_ledger_entries | notes/payment services | Note bucket accounting | HIGH keep |

Changing event strings **breaks** activity adapters, issuer `application-timeline.ts` labels, resubmit comparison metadata keys, and AuthService completion detection.

---

## 7. Current Event Catalogue

Do not treat this as a target schema. Names are as written.

### Access (`AccessAuditLog`)

`USER_SIGNED_UP`, `USER_LOGGED_IN`, `USER_LOGGED_OUT`.

### Security (`SecurityAuditLog`)

`USER_ROLE_ADDED`, `ACTIVE_ROLE_CHANGED`, `USER_PROFILE_UPDATED`, `USER_PROFILE_UPDATED_BY_ADMIN`, `PASSWORD_CHANGED`, `PASSWORD_CHANGE_FAILED`, `USER_EMAIL_VERIFIED`, `EMAIL_VERIFICATION_FAILED`, `ADMIN_ACCESS_DENIED`, `ADMIN_ROLE_CREATED`, `ADMIN_ROLE_PERMISSIONS_UPDATED`, `ADMIN_ROLE_DELETED`, `USER_ROLES_UPDATED`, `ADMIN_USER_ROLE_CHANGED`, `ADMIN_USER_DEACTIVATED`, `ADMIN_USER_REACTIVATED`, `ADMIN_INVITATION_*`, `USER_PUBLIC_ID_CHANGED`, `ORGANIZATION_MEMBER_*`, `ORGANIZATION_OWNERSHIP_TRANSFERRED`, `ORGANIZATION_INVITATION_REVOKED` / `RESENT`, `NOTIFICATION_TYPE_UPDATED`, `NOTIFICATION_GROUP_*`, `USER_NOTIFICATION_PREFERENCE_UPDATED`.

Retired with `AccessLog`/`SecurityLog`: `LOGIN`, `SIGNUP`, `LOGOUT`, `ROLE_SWITCHED`, `ROLE_ADDED`, `ROLE_REMOVED`, `PROFILE_UPDATED`, `EMAIL_CHANGED` (verification was misnamed).

### Onboarding (`OnboardingAuditLog`)

Current writers (**15**): `ONBOARDING_STARTED`, `ONBOARDING_RESTARTED`, `ONBOARDING_RESET`, `USER_ONBOARDING_STATUS_UPDATED`, `ONBOARDING_STATUS_CHANGED`, `ONBOARDING_APPROVED`, `ONBOARDING_REJECTED`, `ONBOARDING_FINAL_APPROVAL_COMPLETED`, `ONBOARDING_COMPLETED`, `AML_APPROVED`, `SSM_APPROVED`, `INVESTOR_SOPHISTICATED_STATUS_UPDATED`, `DIRECTOR_ONBOARDING_INVITATION_SENT`, `DIRECTOR_KYC_STATUS_UPDATED` (APPROVED/REJECTED outcomes only), `ORGANIZATION_PROFILE_UPDATED_BY_ADMIN`.
Retired, still reserved (historical rows readable): `ONBOARDING_RESUMED`, `CTOS_REPORT_RECEIVED`, `CORPORATE_ENTITIES_UPDATED`.  
`AML_APPROVED` `onboarding_id` links to `reg_tank_onboarding.id` when the current writer already has that session (KYB/KYC webhooks, admin AML refresh, admin Approve AML). Self-service AML sync may leave it NULL.  
Issuer Company clean happy path: `ONBOARDING_STARTED` → `ONBOARDING_STATUS_CHANGED` (Verification Submitted) → `SSM_APPROVED` → optional `DIRECTOR_KYC_STATUS_UPDATED` (final APPROVED/REJECTED only) → `ONBOARDING_APPROVED` → `AML_APPROVED` → `ONBOARDING_FINAL_APPROVAL_COMPLETED`. No A040/A052/A053 and no sibling A044 beside those milestone events.  
Retired with `OnboardingLog`: `ONBOARDING_CANCELLED`, `WEBHOOK_*`, `FORM_FILLED`, `EOD_WEBHOOK`, `USER_COMPLETED`, `TNC_APPROVED`, `TNC_ACCEPTED`, `COD_REJECTED`, generic `ONBOARDING_STATUS_UPDATED`.  
Activity UI curated subset: STARTED, RESTARTED, review/amendment STATUS_CHANGED, REJECTED, APPROVED, COMPLETED; issuer invitation + director APPROVED/REJECTED; investor sophisticated when the value changes. FINAL_APPROVAL is admin-only. RESUMED is not user-facing.

### Application (`APPLICATION_AUDIT_EVENTS`)

`APPLICATION_CREATED/SUBMITTED/REVIEW_STARTED/RESUBMITTED/AMENDMENT_ACKNOWLEDGED/AMENDMENTS_REQUESTED/REOPENED_FOR_REVIEW/WITHDRAWN/REJECTED/ARCHIVED/DRAFT_DELETED/COMPLETED`, section/item review updated, document upload/remove/replace, contract/invoice offer/acceptance/expiry/withdraw events including `CONTRACT_OFFER_REJECTED`.  
Signing package events are **not** on this table; they belong to `SigningAuditLog`.

### Signing (`SIGNING_AUDIT_EVENTS`)

`SIGNING_PACKAGE_CREATED/SENT/COMPLETED/VOIDED/DECLINED/EXPIRED`, `SIGNING_RECIPIENT_COMPLETED/DECLINED`, `SIGNING_EKYC_STARTED/VERIFIED/FAILED`, `SIGNING_REMINDER_SENT`.

### Note (`NOTE_AUDIT_EVENTS` — 37 current)

`NOTE_CREATED`, `NOTE_TERMS_UPDATED`, `NOTE_PROSPECTUS_REVIEW_CREATED`, `NOTE_PROSPECTUS_APPROVED`, `NOTE_PROSPECTUS_INVALIDATED`, `NOTE_PUBLISHED`, `NOTE_UNPUBLISHED`, `NOTE_CAMPAIGN_PAUSED`, `NOTE_CAMPAIGN_RESUMED`, `INVESTMENT_COMMITTED`, `NOTE_FUNDING_CLOSED`, `NOTE_FUNDING_FAILED`, `NOTE_ACTIVATED`, `NOTE_SERVICING_STATUS_CHANGED`, `NOTE_MARKED_DEFAULT`, disbursement/residual/repayment/settlement/service-fee/Shoraka/letter events, `TRUSTEE_SIGNATURE_UPDATED`.
A176/A177 are campaign listing pause/resume (note stays `PUBLISHED`, funding stays `OPEN`). They are not `NOTE_UNPUBLISHED` / `NOTE_PUBLISHED`.
Title/summary edits, featured settings, and prospectus draft saves remain intentionally unaudited.
Historical `NoteEvent` / `NoteAdminAction` names in §4 (NOTE_CREATED_FROM_INVOICE, UPDATE_FEATURED_SETTINGS, …) are **pre-cutover** and are not live writers.

### Product

PRODUCT_CREATED/UPDATED/INACTIVATED/REACTIVATED/DELETED.

### Legal admin

LEGAL_DOCUMENT_CREATED/UPDATED, LEGAL_DOCUMENT_VERSION_UPLOADED/FILE_REPLACED/PUBLISHED/ARCHIVED/RESTORED.  
Retired (removed with `LegalDocumentAuditLog`): `LEGAL_VERSION_*`.

### Gateway enum

NAME_CHECK, NAME_CHECK_APPROVED, NAME_CHECK_REJECTED, REFUND_INITIATED, REFUNDED, EXPIRED, CAPTURE_MISMATCH, REFUND_WALLET_REVERSAL_FAILED.  
**DEFINED NEVER WRITTEN:** OVERRIDE_PROPOSED/APPROVED/REJECTED. `getOpenOverrideProposal` is never called. Admin gateway-payment copy has labels only.

### Notifications (not audit events)

See `NotificationTypeIds` in `notification/registry.ts`. Several types have **no send caller** (`login_new_device`, `application_approved`, `new_product_alert`).

---

## 8. Frontend Action → Backend → Audit Matrix

Portals checked: `apps/admin`, `apps/issuer`, `apps/investor`, `apps/landing` (read-only + Cognito).

| UI | Hook / page | Endpoint | Audit |
|---|---|---|---|
| Login/logout | Cognito callback | `/api/auth/*` | LOGGED (duplicate LOGIN if sync-user also runs) |
| Profile save | issuer/investor/admin account pages | PATCH `/v1/auth/profile` or admin profile | LOGGED |
| Password/email | auth pages | auth endpoints | LOGGED WITH WRONG EVENT on failure |
| Create org / members / invite / ownership | org invitation hooks | `/v1/organizations/...` | **NOT LOGGED** except TNC |
| Accept T&C | onboarding | accept-tnc + legal open/accept | PARTIAL (TNC_APPROVED + SOT acceptance) |
| Open/accept legal PDF | legal-documents hooks | `/v1/legal-documents/versions/:id/open\|accept` | **NOT LOGGED** as audit; SOT yes |
| Create/submit/resubmit/cancel application | `use-applications.ts` | `/v1/applications` | LOGGED for create/submit/resubmit/cancel; archive/delete **NOT** |
| Upload docs / BR | application forms | upload-document-url | **NOT LOGGED** |
| Admin review approve/reject/amend | admin application pages | `/v1/admin/applications/:id/reviews/...` | LOGGED; comments/pending drafts **NOT** |
| Send/retract/extend offer | admin | offers/* | LOGGED |
| Accept/reject offer | issuer | offers/accept\|reject | LOGGED; contract reject **WRONG EVENT** |
| Signing send/void/remind | `use-signing-envelopes.ts` | `/v1/admin/signing` / `/v1/signing` | send/void LOGGED; remind **NOT** |
| External signer eKYC/sign | signing external pages | `/v1/signing/external/*` `/v1/ekyc/*` | **NOT LOGGED** |
| Products CRUD | `use-products.ts` | `/v1/products` | LOGGED (history deleted on rollback) |
| Legal admin publish | admin legal docs | `/v1/admin/legal-documents` | LOGGED |
| Note publish/close/fail/activate/payments/settlement/default | `use-notes.ts` | `/v1/admin/notes` | LOGGED |
| Marketplace invest | `use-marketplace-notes.ts` | POST investments | LOGGED |
| Deposit | `use-investor-deposit.ts` | `/v1/investor/deposits` | PARTIAL |
| Investor withdraw | `transactions/page.tsx` | `/investor/balance/withdraw` | **NOT LOGGED** |
| Name check / refund | `use-gateway-payments.ts` | admin gateway-payments | LOGGED |
| Recon run/resolve | `use-gateway-recon.ts` | gateway-recon | **NOT LOGGED** |
| Platform finance settings | admin notes/settings | platform-finance-settings | **NOT LOGGED** |
| Admin invite/roles | `use-admin-users` / `use-admin-role-config` | `/v1/admin/invite` `/roles` | roles LOGGED; invite create **NOT** |
| Assign user_id | `use-users.ts` | PATCH user-id | **NOT LOGGED** |
| CTOS fetch | org CTOS cards | ctos-reports | PARTIAL |
| Bulk notification | notification admin | `/notifications/admin/send` | LOGGED |
| Notification groups/types | notification admin | groups/types | **NOT LOGGED** |
| Landing browse | public marketplace | GET | n/a |

---

## 9. System Jobs / Automatic Events

Source: `apps/api/src/lib/jobs/index.ts`.

| Job | File | Schedule | State change | Audit | Actor | Idempotency |
|---|---|---|---|---|---|---|
| Notification cleanup | `notification/service.ts` `runCleanup` | `0 0 * * *` | delete notifications | **MISSING** | SYSTEM | none |
| CTOS KYB retry | `ctos-kyb-retry.ts` | `*/5` | lastKybAttemptAt | **MISSING** | SYSTEM | 5-min window |
| Note listing expiry | `note-listing-expiry.ts` | hourly | closeFunding/failFunding | YES NoteAuditLog | `"SYS"` | advisory not used; service guards |
| Signing envelope expiry | `signing-envelope-expiry.ts` | hourly | status EXPIRED | **MISSING** | SYSTEM | advisory lock |
| Acceptance/signing expiry | `acceptance-signing-expiry.ts` | hourly | OFFER_EXPIRED + reminders | YES expire; **no** reminder audit | `systemUserId` | advisory lock |
| Stuck order poller | `gateway-stuck-order-poller.ts` | `*/15` | EXPIRED or recover capture | EXPIRED yes; capture **no event type** | SYSTEM | advisory lock |
| Receipt retry | `gateway-receipt-retry.ts` | `*/10` | receipt PDF | **MISSING** | SYSTEM | advisory lock |
| Settlement recon | `gateway-settlement-recon.ts` | `0 18 * * *` UTC | recon runs | **MISSING** | SYSTEM | unique run_date+account |
| Signing reconcile | `signing-reconcile.ts` | `*/30` | PDFs/sessions | **MISSING** | SYSTEM | advisory lock |

SYS/`systemUserId`/`"system"` can appear in human timelines unless filtered.

---

## 10. Webhooks / External Provider Events

**Separate TRANSPORT from BUSINESS.**

### Cognito

- Endpoints: `/api/auth/callback`, `/logout`, token refresh.  
- Business: AccessAuditLog `USER_SIGNED_UP` / `USER_LOGGED_IN` / `USER_LOGGED_OUT`. Confirm/resend not audited.  
- `sync-user` does **not** write login audit. Normal portal logout produces one `USER_LOGGED_OUT` row through Cognito `GET /v1/auth/cognito/logout`. Two rows are possible only if both the `POST /v1/auth/logout` and Cognito GET `/logout` paths are explicitly invoked.

### RegTank

| Endpoint | Handler | Transport storage | Business audit |
|---|---|---|---|
| `/v1/webhooks/regtank/liveness` | individual-onboarding-handler | `webhook_payloads` JSON array **appended/updated** | `ONBOARDING_STATUS_CHANGED` / `ONBOARDING_REJECTED` on business-stage moves |
| `/codliveness` | cod-handler | same | `ONBOARDING_STATUS_CHANGED` (review landing / amendment / resubmission); no sibling A044 beside dedicated milestone events |
| `/eodliveness` | eod-handler | same | `DIRECTOR_KYC_STATUS_UPDATED` only when an existing director newly becomes APPROVED/REJECTED |
| `/kyc` (ACURIS) + `/djkyc` (DOWJONES) | **shared** `KYCWebhookHandler` (constructor provider only) | `webhook_payloads` + org `kyc_response` on APPROVED | personal INDIVIDUAL + PERSONAL org → `AML_APPROVED` via org-aml-milestone (`onboarding_id` = session cuid); **no notification** |
| `/kyb` (ACURIS) + `/djkyb` (DOWJONES) | **shared** `KYBWebhookHandler` | `webhook_payloads`; shareholder `director_aml_status` JSON | main-company APPROVED → `AML_APPROVED` via org-aml-milestone (`onboarding_id` = session cuid); **no notification** |
| `/kyt` | `KYTWebhookHandler` (separate) | `webhook_payloads` if onboarding found | **no OnboardingLog, no org/AML mutation, no notification** |
| `/regtank` legacy | individual | same as liveness | same |
| `/regtank/dev*` | same handlers or dev | | WEBHOOK_* or production events |

Signature validation in `base-webhook-handler.ts`. Actor stored as onboarded **user_id**, not provider.

### CTOS

No inbound webhook. Outbound fetch inserts `CtosReport`. Retry job has no audit event.

### SigningCloud

`apps/api/src/modules/signingcloud/webhook-controller.ts`. Mutates envelope/recipient/document. Business audit only if mapped to SIGNING_PACKAGE_COMPLETED/VOIDED. Per-signer no ApplicationLog. Signer IP not stored.

### Curlec

Webhook router in `payment/webhook-controller.ts` (raw body, registered before JSON).  
**TRANSPORT:** `GatewayWebhookEvent` unique (account, event_id); `processed_at` updated.  
**BUSINESS:** payment status on `GatewayPayment`; wallet/ledger; NAME_CHECK / refund / mismatch events. **No PAYMENT_CAPTURED / DEPOSIT_CONFIRMED event type.**

### Shoraka STP

`POST` `shoraka-stp-webhook-controller.ts` signature fields in body. Stores `callback_payload`. **No NoteAuditLog for raw callback.** Admin submit/fetch write NoteAuditLog with INTEGRATION actor.

### SES / S3

No callback audit. Invite emails unaudited except revoke.

---

## 11. Legal & Compliance Evidence Matrix

Legal types in schema: `PDPA_NOTICE_AND_CONSENT`, `TERMS_OF_USE`, `RISK_STATEMENT`, `ISSUER_WARNING_STATEMENT`, `INVESTOR_WARNING_STATEMENT`, `ISSUER_AGREEMENT`, `INVESTOR_AGREEMENT`.

| Requirement | Current support | Completeness |
|---|---|---|
| Terms of Use | type TERMS_OF_USE; open/accept SOT | PARTIAL (SOT strong; no append-only audit; org also has `tnc_accepted` + TNC_APPROVED) |
| PDPA consent | PDPA_NOTICE_AND_CONSENT | PARTIAL same |
| T&C | mapped to Terms of Use + org flag | PARTIAL dual mechanism |
| Risk Statement | RISK_STATEMENT | PARTIAL |
| Warning Statement | ISSUER/INVESTOR_WARNING_STATEMENT; display = open | PARTIAL (open IP/UA/hash; not a named audit event) |
| Issuer Agreement | ISSUER_AGREEMENT | PARTIAL |
| AML approval | `AML_APPROVED` OnboardingAuditLog + org.aml_approved | YES (admin Approve AML, KYB/KYC webhook helper, admin AML refresh). `onboarding_id` = `reg_tank_onboarding.id` when the session is already known; self-service refresh may leave it NULL. |
| Disclosure / Receivable Verification / Guarantee ack / Notice of Assignment / paymaster ack / per-note Shariah sequence as **named legal types** | **not in LegalDocumentType enum** | NOT first-class legal types. Code mapping of nearby names is in §19 item 4. Whether legal/product **intended** those names to equal the implemented artifacts cannot be decided from code. |
| Letter of Offer issue | CONTRACT/INVOICE_OFFER_SENT | PARTIAL (amounts/version; letter PDF generated separately) |
| Letter of Offer acceptance | offer accept + signing complete | PARTIAL |
| Board Resolution upload | `acceptance_documents` JSON s3_key, uploaded_at | **MISSING** hash/IP/dedicated event |
| Board Resolution approval | admin review item/section | PARTIAL via ITEM_REVIEWED_* |
| Execution pack / signatures | SigningEnvelope/Document/Recipient; signed_file_sha256 | PARTIAL (no signer IP; no per-recipient ApplicationLog) |
| Signing certificate | Shoraka cert sha256 on trade order; SigningCloud provider_ref | PARTIAL |
| Re-acceptance | `reacceptance_required` on version; assertNoPendingReacceptance | PARTIAL (SOT; no dedicated REACCEPT event) |
| Document version/hash at accept | acceptance snapshots + file_hash | COMPLETE on LegalDocumentAcceptance |
| Date/time to the second | DateTime fields | COMPLETE |
| Actor/org/IP/UA on accept | yes on acceptance row | COMPLETE for SOT |
| Legal admin publish trail | LegalAdminAuditLog | COMPLETE |

---

## 12. Finance / Payment / Ledger Evidence Matrix

| Flow | SOT | Audit event | Reconstruct from audit alone? |
|---|---|---|---|
| Investor deposit checkout | GatewayPayment CREATED + OrderAttempt | **no create event** | No |
| Deposit captured | GatewayPayment PAID/COMPLETED + InvestorBalanceTransaction + ledger | **no capture event**; webhook transport | No (need SOT) |
| Name check | GatewayPayment name fields | NAME_CHECK / APPROVED / REJECTED | Partial |
| Onboarding / processing fee | GatewayPayment + org/app flags | **no fee-paid event** | No |
| Investment commit | NoteInvestment + balance debit + ledger | INVESTMENT_COMMITTED | Partial (amounts in metadata) |
| Funding close | Note status + optional disbursement withdrawal | CLOSE_FUNDING + ISSUER_DISBURSEMENT_WITHDRAWAL_CREATED | Partial |
| Funding fail/release | Note + released commitments | FAIL_FUNDING | Partial |
| Issuer disbursement / trustee | WithdrawalInstruction | WITHDRAWAL_* | Partial |
| Repayment | NotePayment | PAYMENT_* | Partial |
| Settlement preview/approve/post | NoteSettlement + ledger + investor credits | SETTLEMENT_* | Partial (preview omits IP) |
| Service fee / tawidh / gharamah / residual | settlement columns + ledger | inside SETTLEMENT_POSTED metadata; residual event unused | Partial — **keep ledger SOT** |
| Investor withdrawal request | WithdrawalInstruction + debit | **MISSING** | SOT only |
| Refund | GatewayPayment + events + possible reversal | REFUND_* | Partial |
| Recon | GatewayReconRun/Exception | **MISSING** | SOT only |
| Test top-up | balance txn MANUAL_TOPUP | **MISSING** | SOT |

**Do not replace** `InvestorBalanceTransaction` or `NoteLedgerEntry` with audit events. They are accounting SOT (idempotency_key unique).

---

## 13. Admin / RBAC / Settings Audit Matrix

| Change | Audit? | Severity if missing |
|---|---|---|
| Create/update/delete admin role + permissions | YES SecurityAuditLog | — |
| Assign user roles | YES SecurityAuditLog `USER_ROLES_UPDATED` (actor vs subject) | — |
| Deactivate/reactivate admin | YES `ADMIN_USER_DEACTIVATED` / `ADMIN_USER_REACTIVATED` (DB-only; no Cognito disable) | — |
| Invite admin create/resend | YES `ADMIN_INVITATION_CREATED` / `RESENT` / `LINK_GENERATED` | — |
| Revoke invite | YES `ADMIN_INVITATION_REVOKED` | — |
| Admin profile edit of user | YES `USER_PROFILE_UPDATED_BY_ADMIN` | — |
| Assign user_id | YES `USER_PUBLIC_ID_CHANGED` (admin rewrite only; initial assign not audited) | — |
| Onboarding reset/restart/approvals | YES | — |
| Sophisticated investor | YES | — |
| Product CRUD | YES; **deleted on rollback** | HIGH |
| Platform finance settings / trustee signature / fee caps | **NO** | **CRITICAL** |
| Ledger bucket config | no API mutate found | N/A unless seed changes |
| Notification type/group config | **NO** | HIGH |
| Legal document admin | YES | — |
| Site documents | flow removed | N/A |
| RegTank refresh | YES ONBOARDING_STATUS_UPDATED | — |

---

## 14. Missing Audit Events

Conceptual future names only — **not implemented**.

| Module | Business action | Current audit? | Current evidence | Risk | Suggested future concept | Priority |
|---|---|---|---|---|---|---|
| ORG | Create org | No | Org row | HIGH | ORGANIZATION_CREATED | HIGH |
| ORG | Member invite/remove/role/ownership/leave | No | membership | HIGH | ORGANIZATION_MEMBER_* | HIGH |
| ORG | User `complete-onboarding` (API exists; **no portal caller**) | No | status COMPLETED | HIGH | ONBOARDING_USER_COMPLETED | HIGH |
| ADMIN | Invite create/resend | No | invitation | HIGH | ADMIN_INVITATION_CREATED | HIGH |
| ADMIN | Assign user_id | No | User | HIGH | USER_PUBLIC_ID_ASSIGNED | HIGH |
| SETTINGS | Platform finance / trustee / fees | No | settings upsert | CRITICAL | PLATFORM_FINANCE_SETTINGS_UPDATED | CRITICAL |
| LEGAL | Open warning/T&C PDF | No event | acceptance OPENED | HIGH | LEGAL_DOCUMENT_DISPLAYED | HIGH |
| LEGAL | Accept legal PDF | No event | acceptance ACCEPTED | CRITICAL | LEGAL_DOCUMENT_ACCEPTED (keep SOT) | CRITICAL |
| APP | Archive / delete draft / ack amendment | No | status/remarks | MEDIUM | APPLICATION_ARCHIVED etc. | MEDIUM |
| APP | Doc/BR upload | No | JSON/S3 | HIGH | ACCEPTANCE_DOCUMENT_UPLOADED | HIGH |
| REVIEW | Comments / pending draft CRUD | No | remarks | MEDIUM | REVIEW_COMMENT_ADDED | LOW |
| SIGNING | Per-signer complete, eKYC, remind, auto-expire | No | Signing* | HIGH | SIGNING_RECIPIENT_COMPLETED / ENVELOPE_EXPIRED | HIGH |
| PAYMENT | Checkout create / capture / fee paid | No event type | GatewayPayment + ledger | CRITICAL | PAYMENT_CAPTURED / FEE_PAID | CRITICAL |
| WALLET | Investor withdrawal request | No | instruction + debit | HIGH | INVESTOR_WITHDRAWAL_REQUESTED | HIGH |
| RECON | Run/resolve | No | recon tables | HIGH | GATEWAY_RECON_RUN / EXCEPTION_RESOLVED | HIGH |
| SHORAKA | Callback / query | No NoteEvent | trade order | HIGH | SHORAKA_STATUS_UPDATED | HIGH |
| CTOS | Fetch report / KYB retry | A052 retired; `ctos_reports` SOT | CtosReport | MEDIUM | CTOS_REPORT_FETCHED | MEDIUM |
| KYB/KYT | Webhook processed | Weak | JSON | HIGH | KYB_WEBHOOK_PROCESSED | HIGH |
| GUARANTOR | Start AML | No | RegTank | HIGH | GUARANTOR_AML_STARTED | HIGH |
| NOTIF | Type/group config | No | tables | MEDIUM | NOTIFICATION_CONFIG_UPDATED | MEDIUM |
| SECURITY | Failed permission | No | HTTP | MEDIUM | ADMIN_ACCESS_DENIED | MEDIUM |
| AUTH | Confirm signup | No | Cognito | LOW | USER_SIGNUP_CONFIRMED | LOW |
| JOB | Notification cleanup | No | deletions | LOW | NOTIFICATION_CLEANUP_RAN | LOW |

Keep specialized SOT even if audit events are added later.

---

## 15. Inconsistencies / Bugs / Design Risks

| Sev | Module | Where | Example | Why it matters | Later migration |
|---|---|---|---|---|---|
| CRITICAL | AUTH/ONBOARDING | `auth/service.ts` ~385–415 vs `admin/service.ts` ~4271 | Cancel logic looks for `USER_COMPLETED`; prod writes `FINAL_APPROVAL_COMPLETED` | May cancel or skip cancellation incorrectly | Must map both names or fix reader before table merge |
| CRITICAL | LEGAL | `acceptance-service.ts` update in place | OPENED overwritten to ACCEPTED | Loses independent open vs accept rows | Preserve both timestamps; do not flatten away |
| CRITICAL | PAYMENT | no CAPTURED type | Deposit/fee complete only on GatewayPayment | Cannot prove capture from payment_events | Do not treat webhook payload as the audit event |
| CRITICAL | SETTINGS | `updatePlatformFinanceSettings` | No audit of fee caps / tawidh / templates | Money + Shariah config unaudited | High-priority new events; keep settings SOT |
| CRITICAL | CASCADE | Access/Security/Onboarding/Note/Gateway events | User/Note/Payment delete | History disappears | Snapshot actor; avoid Cascade on audit |
| CRITICAL | PRODUCT | *(resolved)* `productLog.deleteMany` removed | Rollback no longer wipes Product audit | `ProductAuditLog` is append-only; `product_logs` dropped |
| HIGH | AUTH | sync-user + callback | Two LOGIN rows | Inflated login stats | Dedupe rule |
| HIGH | AUTH | PASSWORD_CHANGED / EMAIL_CHANGED | Failure uses success name | Misleading investigations | Distinguish outcome |
| HIGH | RBAC | updateUserRoles | user_id = admin | Looks like admin logged in as target | Actor vs target split |
| HIGH | RBAC | deactivate uses ROLE_SWITCHED | Same as role switch | Misleading | |
| HIGH | APP | APPLICATION_APPROVED enum/UI | Never written; no APPROVED status | False activity presentations | Do not migrate unread enum as real |
| HIGH | APP | contract reject → CONTRACT_WITHDRAWN | Duplicate meaning with withdraw | Wrong legal narrative | |
| HIGH | APP | ReviewEvent write-only | Three dual-writes never read | Duplicate storage | |
| HIGH | NOTE | Shoraka actor null | SYSTEM action blank | Looks unattributed | |
| HIGH | NOTE | listing expiry actor SYS | Human timeline pollution | |
| HIGH | SIGNING | envelope expiry no log | Status EXPIRED only | |
| HIGH | ORG | members/ownership unaudited | Permission changes | |
| HIGH | INVITE | create unaudited, revoke audited | Asymmetric | |
| HIGH | CTOS | userId `"system"` string | Not a real user FK | |
| HIGH | GATEWAY | webhook row updated | Transport not append-only | Keep as transport |
| HIGH | GATEWAY | mapGatewayPaymentEvent strips metadata | Admin cannot see stored metadata | |
| HIGH | APP | (historical) logApplicationActivity swallowed errors | Silent audit loss | Mitigated: helper removed; ApplicationAuditLog/SigningAuditLog writers do not swallow |
| HIGH | APP | (historical) ApplicationLog no FK | Orphans | Table dropped; new audit tables keep scalar ids by design |
| MEDIUM | ACTIVITY | curated subsets | Many events invisible in feeds | Reader assumptions |
| MEDIUM | ONBOARDING | WEBHOOK_* vs business events | Inconsistent naming | |
| MEDIUM | APP | resubmit dual writers | Duplicate rows | |
| MEDIUM | SETTLEMENT | preview omits IP/UA | Weaker than other NoteEvents | |
| MEDIUM | LEGAL | TNC_APPROVED vs legal accept | Two consent stories | |
| LOW | SCHEMA | Loan/Investment unused writes | Confusion; admin user page still counts leftover relations | leftover **data** needs DB check |
| LOW | TEST/SEED | TNC_ACCEPTED; UI still labels USER_COMPLETED | Catalogue noise vs live AuthService reader | |

---

## 16. Source-of-Truth vs Audit Classification

| Table | Classification |
|---|---|
| InvestorBalanceTransaction | **KEEP AS SOURCE OF TRUTH** |
| NoteLedgerEntry / NoteLedgerAccount | **KEEP AS SOURCE OF TRUTH** |
| GatewayPayment / OrderAttempt / Receipt | **KEEP AS SOURCE OF TRUTH** |
| NotePayment / NoteSettlement / WithdrawalInstruction | **KEEP AS SOURCE OF TRUTH** |
| ShorakaTradeOrder | **KEEP AS SOURCE OF TRUTH** (provider order) |
| LegalDocumentAcceptance | **KEEP AS SPECIALIZED HISTORY/EVIDENCE** (legal SOT; mutable status) |
| ApplicationRevision | **KEEP AS SPECIALIZED HISTORY/EVIDENCE** |
| SigningEnvelope/Document/Recipient | **KEEP AS SPECIALIZED HISTORY/EVIDENCE** |
| CtosReport / RegTankOnboarding | **KEEP AS SOURCE OF TRUTH** (provider + compliance snapshots) |
| GatewayWebhookEvent | **KEEP AS SPECIALIZED HISTORY/EVIDENCE** (transport; not business audit) |
| GatewayReconRun/Exception | **KEEP AS SOURCE OF TRUTH** (ops) |
| LegalAdminAuditLog | **KEEP AS SPECIALIZED HISTORY** (admin legal-document mutations; not a canonical AuditEvent) |
| AccessLog / SecurityLog | **REMOVED** — replaced by `AccessAuditLog` + `SecurityAuditLog` (two physical tables; no canonical AuditEvent) |
| OnboardingLog | **REMOVED** — replaced by `OnboardingAuditLog` (`onboarding_audit_logs`) |
| ApplicationLog | **REMOVED** — replaced by `ApplicationAuditLog` + `SigningAuditLog` (`application_logs` dropped) |
| ApplicationReviewEvent | **REMOVED** — table `application_review_events` dropped; `ApplicationAuditLog` is application history |
| NoteAuditLog | **KEEP AS SPECIALIZED HISTORY** (Note-domain; not a canonical AuditEvent; not financial SOT) |
| NoteEvent | **REMOVED** — table `note_events` dropped; `NoteAuditLog` is the sole Note history table |
| NoteAdminAction | **REMOVED** — table `note_admin_actions` dropped; unused write-only leftover |
| ProductLog | **REMOVED** — replaced by `ProductAuditLog` (`product_audit_logs`) |
| NotificationBroadcastAuditLog | **KEEP AS SPECIALIZED HISTORY** (admin bulk send; not a canonical AuditEvent) |
| NotificationLog | **REMOVED** — replaced by `NotificationBroadcastAuditLog` (`notification_broadcast_audit_logs`) |
| GatewayPaymentEvent | **REMOVED** — replaced by `PaymentAuditLog` (`payment_audit_logs`). `GatewayWebhookEvent` remains provider evidence, not business audit. |
| ApplicationReview current rows | **KEEP AS SOURCE OF TRUTH** (not audit) |
| PlatformFinanceSetting | **KEEP AS SOURCE OF TRUTH** (needs audit events, not replacement) |
| Notification / NotificationType | **KEEP AS SOURCE OF TRUTH** delivery/config |
| Loan / Investment | **LEGACY / VERIFY REMOVAL** — no production writers; leftover Prisma + `User._count` + unused mock UI |

---

## 17. Old Log Table Migration Dependency Matrix

| Old table | Writers | Readers | UI | Exports | Business logic | Notifications | Tests | Difficulty | Suggested order | Delete after? |
|---|---|---|---|---|---|---|---|---|---|---|
| ApplicationReviewEvent | **removed** | n/a | n/a | n/a | n/a | n/a | n/a | — | done | table dropped; `ApplicationAuditLog` is live |
| ProductLog | **removed** | n/a | n/a | n/a | n/a | n/a | n/a | — | done | table dropped; `ProductAuditLog` is live |
| NotificationLog | **removed** | n/a | n/a | n/a | n/a | n/a | n/a | — | done | table dropped; `NotificationBroadcastAuditLog` is live |
| LegalDocumentAuditLog | **removed** | n/a | n/a | n/a | n/a | n/a | n/a | — | done | table dropped; `LegalAdminAuditLog` is live |
| GatewayPaymentEvent | payment modules | payment detail; `getOpenOverrideProposal` **never called** | admin payments (labels include OVERRIDE_*) | no | no live override logic | no | many payment tests | HIGH | 5 with payments | NO until capture events exist |
| AccessLog | **removed** | n/a | n/a | n/a | n/a | n/a | n/a | — | done | table dropped; `AccessAuditLog` is live |
| SecurityLog | **removed** | n/a | n/a | n/a | n/a | n/a | n/a | — | done | table dropped; `SecurityAuditLog` is live |
| OnboardingLog | **removed** | n/a | n/a | n/a | n/a | n/a | n/a | — | done | table dropped; `OnboardingAuditLog` is live |
| ApplicationLog | **removed** | n/a | n/a | n/a | n/a | n/a | n/a | — | done | table dropped; `ApplicationAuditLog` + `SigningAuditLog` are live |
| NoteEvent | **removed** | n/a | n/a | n/a | n/a | n/a | n/a | — | done | table dropped; `NoteAuditLog` is live |
| NoteAdminAction | **removed** | n/a | n/a | n/a | n/a | n/a | n/a | — | done | table dropped; unused write-only leftover |

`GatewayWebhookEvent` should **not** be in the replace-with-audit queue.

---

## 18. Recommended Migration Order

Do not design final schema here. Sequence by dependency/risk:

1. **ApplicationReviewEvent** **removed** — `application_review_events` dropped; `ApplicationAuditLog` is application history. Review SOT remains `ApplicationReview` / `ApplicationReviewItem` / `ApplicationReviewRemark` / `ApplicationRevision`.
2. **Decouple business logic from logs:** `AuthService` no longer reads OnboardingLog as state; resubmit comparison reads `ApplicationRevision` + remarks, never audit.
3. **Payment capture gap** must be understood before touching GatewayPaymentEvent (accounting SOT stays).
4. **Legal acceptances stay** as evidence; legal admin log can migrate later with `/audit` + export.
5. **Access/Security** after audit UI + CSV exporters have a dual-read period.
6. **OnboardingLog** replaced by append-only `OnboardingAuditLog`; `onboarding_logs` dropped. AuthService no longer reads logs as state.
7. **ApplicationLog** **removed** — `application_logs` dropped; `ApplicationAuditLog` + `SigningAuditLog` are live. `ApplicationReviewEvent` **removed**.
8. **NoteEvent** and **NoteAdminAction** **removed** — `note_events` and `note_admin_actions` dropped; `NoteAuditLog` is the sole Note history table.
9. **ProductLog** replaced by append-only `ProductAuditLog`; `product_logs` dropped.
10. **Platform settings / org members / invitations** have nothing to migrate — they need **new** events, not table moves.

Minimize risk: never delete a table that still has HIGH readers; never migrate ledgers into audit.

---

## Inventory Corrections

Internal contradictions found during the closure pass. Source code wins.

### C1 — AccessLog readers vs dashboard / `/audit`-only

**Superseded — `AccessLog` removed.** Current readers use `AccessAuditLog` (`/audit`, `GET /me` recentLogins, user-detail count). Dashboard stats still do not read access audit.

### C2 — `getOpenOverrideProposal` as live business-logic reader

Original statement: §6 listed `getOpenOverrideProposal` as a HIGH business-logic reader of `gateway_payment_events`.

Correct statement: The helper is defined in `payment/gateway-events.ts` and is **never called**. No writer, no endpoint, no admin mutation UI. Labels exist in `gateway-payment-copy.ts` only.

Evidence: repo-wide grep; only definition at `gateway-events.ts` ~40.

Sections that need correction: §6, §7 OVERRIDE, A224, §17. **Corrected.**

### C3 — Loan / Investment “schema only” vs leftover production read

Original statement: Loan/Investment are schema-only with no API usage; leftover data UNRESOLVED as if code could not classify usage.

Correct statement: **No production writers** (`prisma.loan` / `prisma.investment` never called). Production **read**: admin user DTO `_count.loans` / `_count.investments` displayed on `apps/admin/src/app/users/[id]/page.tsx`. `recent-loans.tsx` is unused mock. Types leftover in `packages/types`. Docs example in `docs/guides/development.md` is not application code. Whether `loans`/`investments` tables have rows requires a DB check.

Evidence: `schema.prisma` models; `AdminService` ~1067–1069; unused `recent-loans.tsx`.

Sections that need correction: §2 coverage, §3 leftover table, §15 LOW finding, §16. **Corrected.**

### C4 — `USER_COMPLETED` “seed/test only”

Original statement: §7 listed `USER_COMPLETED` with seed/test events.

Correct statement (after Phase 5 cleanup): `OnboardingLog` / `onboarding_logs` **removed**. Live final approval writes `ONBOARDING_FINAL_APPROVAL_COMPLETED`. Legacy complete-onboarding writes `ONBOARDING_COMPLETED`. `AuthService.cancelOnboarding` does **not** read audit as state. `USER_COMPLETED` is retired.

Evidence: `onboarding/audit/writer.ts`; `admin/service.ts` completeFinalApproval; `auth/service.ts` cancelOnboarding; drop migration `20260813280000_drop_onboarding_logs`.

### C5 — KYT “UNRESOLVED business impact”

Original statement: A068 KYT business impact unresolved.

Correct statement: `KYTWebhookHandler` appends payload (if onboarding found), skips cancelled rows, and returns. No org status, AML flag, OnboardingLog, or notification. Inline TODO.

Evidence: `apps/api/src/modules/regtank/webhooks/kyt-handler.ts`.

Sections that need correction: A068, §10. **Corrected.**

### C6 — Site documents leftover S3 as inventory gap

Original statement: Site documents leftover S3 objects UNRESOLVED.

Correct statement: Code status is fully known (models dropped, routes gone, tests assert absence). S3 bucket contents cannot be proven from the repository and are out of scope for this inventory.

Evidence: migrations `add_site_documents` / `remove_site_documents`; `site-document-removal*.test.ts`.

Sections that need correction: former §19 item 7. **Corrected** (code); S3 remains an external ops check, not a code-search gap.

### C7 — Org `complete-onboarding` as the live user happy path

Original statement: A035 “User marks COMPLETED” implied a live portal happy path; §19 asked which of user vs admin was live.

Correct statement: Admin `POST /v1/admin/onboarding-applications/:id/complete-final-approval` is the **active UI happy path**. Org `complete-onboarding` has backend + unused context client and **no page caller**. Auth `POST /v1/auth/complete-onboarding` has **no frontend caller**.

Evidence: `use-onboarding-applications.ts`; `organization-context.tsx` (method unused by pages); no issuer/investor `completeOnboarding` usage.

Sections that need correction: A035, §14 missing-events row. **Corrected.**

### C8 — Auth coverage “AccessLog → `/audit` only”

**Superseded — `AccessLog` removed.** `AccessAuditLog` backs `/audit` and GET `/me` recent logins.

---

## 19. Closure Results

### Item 1 — Legacy Loan / Investment

**EXTERNAL VERIFICATION REQUIRED — leftover table rows cannot be proven without a live database query.**

CODE STATUS: **LEGACY/UNUSED** for application writes.

- Production writes: none. No `prisma.loan` / `prisma.investment` in `apps/` or `packages/`.
- Production reads: admin user detail `_count.loans` and `_count.investments` (`admin/service.ts` ~1067–1069) shown on `apps/admin/src/app/users/[id]/page.tsx`.
- Tests: none asserting Loan/Investment business flows.
- Seed/demo: no Prisma seed writers found. `docs/guides/development.md` has example `prisma.loan.findMany` (docs only).
- Type/schema-only: `schema.prisma` `model Loan` / `model Investment`; `LoanStatus`; `packages/types` `Loan` / `LoanStatus`; unused mock `apps/admin/src/components/recent-loans.tsx` (never imported).

DATABASE DATA STATUS: **REQUIRES DB CHECK** (`SELECT count(*) FROM loans` / `investments`).

### Item 2 — KYT / DJKYC / DJKYB / KYC / KYB

**RESOLVED — handlers traced; `/kyc` shares code with `/djkyc`; `/kyb` shares code with `/djkyb`; `/kyt` is separate and has no business side effects.**

Shared wiring: `apps/api/src/modules/regtank/webhook-controller.ts` (`KYCWebhookHandler("ACURIS"|"DOWJONES")`, `KYBWebhookHandler("ACURIS"|"DOWJONES")`, `KYTWebhookHandler`). Provider only changes the handler label (and KYC CTOS-party `screening.provider` ACURIS vs DOW_JONES). Inspected payload fields are the same.

#### `/kyt` — `KYTWebhookHandler`

- Provider event: RegTank KYT notification (`requestId`, `referenceId`, `riskScore`, `riskLevel`, `typeOfChange`, `status`, `messageStatus`).
- Lookup: `referenceId` then `requestId`.
- DB: `appendWebhookPayload` if onboarding found; skip if cancelled. If no onboarding: warn and return (no throw).
- Org / AML / KYC / KYB status: **unchanged**.
- OnboardingLog: **none**.
- Notification: **none**.
- Shared with: nothing.

#### `/kyc` (ACURIS) and `/djkyc` (DOWJONES) — shared `KYCWebhookHandler`

Inspected: `requestId`, `referenceId`, `riskScore`, `riskLevel`, `status`, `messageStatus`, `possibleMatchCount`, `blacklistedMatchCount`, `onboardingId`. Missing `status` → skip (no persist).

Lookup: `onboardingId` → `referenceId` → EOD parent COD search. If still missing: guarantor AML sync, then CTOS party KYC.

Always (when onboarding found and type-consistent): append full webhook payload. Cancelled → skip further work.

**Branch APPROVED + org found**

- DB: `investorOrganization`/`issuerOrganization.kyc_response` = payload.
- Org `onboarding_status` / `aml_approved`: **not set by this branch** except the personal AML helper below.
- This handler does **not** write `ONBOARDING_STATUS_CHANGED`.
- Personal INDIVIDUAL + PERSONAL org: `maybeAdvanceOrgAfterAmlScreeningCleared` trigger `REGTANK_KYC_PERSONAL_AML_CLEARED` extraMetadata `{ kycRequestId, onboardingRequestId }` and `onboardingId: onboarding.id`. That helper may set `aml_approved` and write `AML_APPROVED` with `onboarding_id` = `reg_tank_onboarding.id`.
- Notification: **none**.

**Branch status !== APPROVED**

- Org `kyc_response` / onboarding_status: **unchanged** (debug log only).
- OnboardingLog from this branch: **none**.

**Branch EOD director (onboardingId starts with EOD, corporate)**

- DB: `director_aml_status.directors[]` patched. `amlStatus` from `mapRegTankKycScreeningStatusToAmlStatus`: APPROVED/RISK_ASSESSED → Approved; REJECTED/TERMINATED → Rejected; UNRESOLVED/NO_MATCH/POSITIVE_MATCH → Unresolved; else Pending.
- OnboardingLog: **none** for this patch.
- Notification: **none**.

**Branch guarantor (no onboarding row)**

- Updates application guarantor AML via `syncApplicationGuarantorsFromRegTankAmlWebhook`. No OnboardingLog. No org onboarding status.

**Branch CTOS party KYC**

- Merges `onboarding_json.screening` `{ provider, requestId, status, riskLevel, riskScore, updatedAt, messageStatus?, referenceId?, possibleMatchCount?, blacklistedMatchCount? }`. May `linkCtosPartyToKyb`. No OnboardingLog.

#### `/kyb` (ACURIS) and `/djkyb` (DOWJONES) — shared `KYBWebhookHandler`

Inspected: same core fields as KYC (`requestId` is KYB/DJKYB id). Missing status → skip.

Does **not** overwrite `reg_tank_onboarding.status`. Raw payload appended to `webhook_payloads`.

**Branch APPROVED + corporate + main-company COD**

- `maybeAdvanceOrgAfterAmlScreeningCleared` trigger `REGTANK_KYB_MAIN_COMPANY_APPROVED` extraMetadata `{ kybRequestId, onboardingRequestId, riskLevel, riskScore }` and `onboardingId: onboarding.id`.
- Handler itself does not write audit. Milestone helper writes `AML_APPROVED` with `onboarding_id` = `reg_tank_onboarding.id`. No sibling `ONBOARDING_STATUS_CHANGED`.
- Notification: **none**.
- Main-company AML identity mapping: log-only, not stored.

**Branch APPROVED + non-corporate or non-main COD**

- Org status: **unchanged** (debug skip).

**Branch business shareholder KYB**

- Updates `director_aml_status.businessShareholders[]`. Mapping: RISK ASSESSED or APPROVED → Approved; REJECTED → Rejected; UNRESOLVED or NO_MATCH → Unresolved; else Pending. Also `syncCorporateShareholderStatusInOrganization`.
- OnboardingLog: **none**.
- Notification: **none**.

**Branch guarantor (no onboarding)**

- Same guarantor sync as KYC. Then may continue as shareholder COD.

Admin/frontend visibility: org AML JSON and onboarding timeline (only if milestone/KYC APPROVED logs exist). KYT has no admin-specific event.

### Item 3 — Gateway override flow

**RESOLVED — PARTIALLY IMPLEMENTED BUT UNREACHABLE.**

- Production writer: **none** (`recordGatewayPaymentEvent` never uses OVERRIDE_*).
- Production endpoint: **none**.
- Admin UI action: **none**. Copy only in `apps/admin/src/app/finance/gateway-payments/[id]/gateway-payment-copy.ts`.
- `getOpenOverrideProposal`: **not reachable** (defined, never called).
- Prospectus `PAGE_TWO_OVERRIDE_FIELDS` is unrelated financial-statement overrides.

### Item 4 — Legal / product workflow document mapping

**EXTERNAL VERIFICATION REQUIRED — code can classify current artifacts; it cannot decide whether legal/product intended names (e.g. “Guarantee Acknowledgement” vs “Guarantor Agreement”) are the same requirement.**

| Name searched | Classification | Paths |
|---|---|---|
| Guarantee Acknowledgement | **NOT FOUND** | — |
| Guarantee / Guarantor Agreement | **IMPLEMENTED AS GENERIC WORKFLOW ITEM** (signing template keys `guarantee` in tests, `guarantor_agreement` in product builder) | `signing-plan.test.ts`; `signing-package-config.tsx`; `packages/types/src/signing-envelopes.ts` |
| Notice of Assignment | **NOT FOUND** as a document type | — |
| Deed of Assignment | **REFERENCED ONLY** (prospectus invoice/paymaster row; often DNA) | `page-two-coverage.ts`; `prospectus-review` labels; issuer supporting-docs comments |
| Paymaster | **IMPLEMENTED FIRST-CLASS** as note/prospectus field, **not** a LegalDocumentType | note `paymaster_snapshot`; prospectus dates/highlight/track-record |
| Receivable Verification / RVD | **NOT FOUND** as a document/action type | — |
| Disclosure Statement | **REFERENCED ONLY** (prospectus footer copy “Product Terms and Risk Disclosure Statement”) | `prospectus-footer.html.ts`; `prospectus-static-copy.ts` |
| Utilisation Request | **NOT FOUND** as a document; utilisation % is financing UI | `issuer/.../contract-card.tsx` |
| Letter of Agency | **NOT FOUND** | — |
| Purchase Requisition | **NOT FOUND** | — |
| Sale Contract | **NOT FOUND** | — |
| Investment Note | **REFERENCED ONLY** as prospectus identity label for a Note | `prospectus-note-identity.types.ts` |
| Board Resolution | **IMPLEMENTED AS GENERIC WORKFLOW ITEM** (`acceptance_documents` JSON, item key `board_resolution`) | `packages/types`; admin acceptance-document tests |
| Execution pack | **REFERENCED ONLY** (signing-package deadline copy) | `signing-package-config.tsx` ~508 |
| Letter of Offer | **IMPLEMENTED FIRST-CLASS** generated signing doc `offer_letter` | signing template + offer flow |
| LegalDocumentType enum (PDPA, Terms, Risk, Warning, Agreements) | **IMPLEMENTED FIRST-CLASS** | `schema.prisma`; `legal-documents/` |

Code cannot decide: whether “Guarantee Acknowledgement” is meant to be `guarantor_agreement`; whether Notice/Deed of Assignment should be a signing doc vs prospectus label; whether Disclosure Statement should be `RISK_STATEMENT` or a separate note document; whether live `Product.signing_template` JSON in the database contains extra keys beyond `offer_letter` / `guarantor_agreement` (that is a DB check).

### Item 5 — Refund metadata

**RESOLVED — exhaustive `recordGatewayPaymentEvent` refund branches below.** Related non-refund events that start refunds: `NAME_CHECK_REJECTED` (admin-service, **no metadata object**); `CAPTURE_MISMATCH` is not a refund event.

Currency: not a dedicated event-metadata key except where noted. Amount is `amountSen` only on initiate. `refundId` comes from Curlec refund id / `input.refundId` / `payment.refund_reference`.

#### REFUND_INITIATED

**Branch A — `initiateGatewayPaymentRefund` (also `initiateInvestorDepositRefund`, name-check reject, amount-mismatch auto refund)**  
`refund-service.ts` ~282

- actor: `input.actorUserId` (null = automatic)
- from_status: `current.status`
- to_status: `REFUND_INITIATED`
- reason: `notes` = `input.adminReason?.trim()` or `refundReasonLabel(input.reason)` (`NAME_MISMATCH` / `NAME_UNAVAILABLE` / `AMOUNT_MISMATCH` / `ADMIN_INITIATED`)
- provider reference: `metadata.refundId` = Curlec `refund.id`
- metadata: `{ auto, refundId, reason: input.reason, gatewayAccount, purpose, amountSen, source: "admin_retry" \| "automatic" }`

**Branch B — `adoptExternalCurlecRefundFromCompleted` wallet hold**  
~808 (only if a hold is newly created)

- actor: `input.actorUserId`
- from_status: `COMPLETED`
- to_status: `REFUND_INITIATED`
- reason: `"Wallet funds blocked after external Curlec refund detected"`
- metadata: `{ event: "wallet_funds_blocked", blockedAmount, holdIdempotencyKey, refundId }`

**Branch C — `adoptExternalCurlecRefundFromCompleted` detection**  
~871

- actor: `input.actorUserId`
- from_status: `COMPLETED`
- to_status: `REFUND_INITIATED`
- reason: `"External Curlec refund detected on completed payment"`
- metadata: `{ event: "external_curlec_refund_detected", refundId, purpose, detectedOnEvent, fundsProtected, blockedAmount }`

**Branch D — `failGatewayPaymentRefund` restore after external fail**  
~1318

- actor: omitted
- from_status: `REFUND_INITIATED`
- to_status: `COMPLETED` (event type is still REFUND_INITIATED)
- reason: `"External Curlec refund failed — restored completed payment and released holds"`
- metadata: `{ event: "external_curlec_refund_failed_restored", refundId, purpose }`

**Branch E — `adoptGatewayRefundCreated` recoverable HELD**  
~1462

- actor: omitted
- from_status: `HELD`
- to_status: `REFUND_INITIATED`
- reason: `"Curlec refund.created recovered pending refund"`
- metadata: `{ refundId, purpose, source: "refund_created_webhook", recoverableHold: "autoRefundFailed" }`

No event: Curlec create-refund API failure → `markRefundHeldFallback` (HELD, no `recordGatewayPaymentEvent`).

#### REFUNDED

**Branch A — `holdForWalletReversalFailure` already reversed**  
~365

- actor: `input.actorUserId`
- from_status: `current.status`
- to_status: `REFUNDED`
- reason: `"Wallet reversal already present — completed after prior failure path"`
- metadata: `{ refundId, purpose }`

**Branch B — `completeGatewayPaymentRefund`**  
~958

- actor: `input.actorUserId`
- from_status: `current.status`
- to_status: `REFUNDED`
- reason: omitted
- metadata: `{ refundId, purpose, event: "wallet_reversal_completed", externalCurlecRefund }`

#### REFUND_WALLET_REVERSAL_FAILED

**Branch A — funds blocked while holding**  
~431

- actor: `input.actorUserId`
- from_status: `current.status`
- to_status: `REFUND_INITIATED` → `HELD`, else unchanged
- reason: `"Wallet funds blocked pending refund reversal retry"`
- metadata: `{ event: "wallet_funds_blocked", blockedAmount, holdIdempotencyKey, refundId }`

**Branch B — reversal failed marker**  
~484

- actor: `input.actorUserId`
- from_status: `current.status`
- to_status: `HELD`
- reason: `marker.error`
- metadata: `{ event: "wallet_reversal_failed", refundId, gatewayAccount, failureCode, failureCategory, blockedAmount, fundsProtected, attemptCount }`

**Branch C — retry started**  
~1101

- actor: `input.actorUserId`
- from_status: `HELD`
- to_status: `HELD`
- reason: `"Automatic wallet reversal retry started"` or `"Admin wallet reversal retry started"`
- metadata: `{ event: "automatic_wallet_reversal_retry_started" \| "admin_wallet_reversal_retry_started", refundId }`

**Branch D — external refund failed on COMPLETED**  
~1230

- actor: omitted
- from_status: `COMPLETED`
- to_status: `COMPLETED`
- reason: `"External Curlec refund failed — completed payment unchanged"`
- metadata: `{ event: "external_curlec_refund_failed", refundId, purpose }`

No event: `failGatewayPaymentRefund` path that only sets `metadata.refundFailed` and status HELD (~1335).

### Item 6 — AccessLog dashboard / statistics

**RESOLVED — `AccessLog` / `access_logs` removed.** Authentication history is `AccessAuditLog` only.

Confirmed production readers:

1. `AdminService.listAccessLogs` → `GET /v1/admin/access-logs` + export + detail → admin `/audit` (AccessAuditLog)
2. `accessAuditLogReader.findRecentLogins` → `AuthService.getCurrentUser` → `GET /v1/auth/me` → account “recent logins” (`USER_LOGGED_IN`)
3. `accessAuditLogReader.countForUser` → admin user detail `stats.accessLogs`

Not readers: `getDashboardStats` / `useDashboardStats`.

### Item 7 — Site documents (code status)

**RESOLVED — code removed. S3 contents are out of repository scope (not a remaining code-search item).**

- Current Prisma model? **No** (`SiteDocument` / `DocumentLog` absent).
- Current backend production route? **No** (tests: `/v1/admin/site-documents`, `/v1/admin/document-logs`, `/v1/documents*` not mounted).
- Current frontend UI? **No**.
- Current production writer? **No**.
- Current production reader? **No**.
- Old migration/schema remnants? **Yes** — create `20251231135100_add_site_documents_and_document_logs`; drop `20260805190000_remove_site_documents_and_document_logs`.
- Tests asserting removal? **Yes** — `site-document-removal.test.ts`, `site-document-removal.routes-rbac.test.ts`.

### Item 8 — USER_COMPLETED vs FINAL_APPROVAL_COMPLETED

**RESOLVED in code.** `OnboardingLog` / `onboarding_logs` dropped. Live final approval writes `ONBOARDING_FINAL_APPROVAL_COMPLETED`. Legacy complete-onboarding writes `ONBOARDING_COMPLETED`. `AuthService.cancelOnboarding` no longer reads audit as state. Historical `USER_COMPLETED` rows (if any) were in the dropped table.

CURRENT CODE FACT:

| Occurrence | Classification |
|---|---|
| `AdminService.completeFinalApproval` writes `ONBOARDING_FINAL_APPROVAL_COMPLETED` | production writer |
| `AuthService.cancelOnboarding` | reads org/RegTank SOT only; no-op workflow action |
| org `completeOnboarding` | production writer of `ONBOARDING_COMPLETED` (legacy route) |
| `OnboardingLog` / `USER_COMPLETED` | **removed** |

- Could current production code create `USER_COMPLETED`? **No.**

### Item 9 — complete-onboarding reachability

**RESOLVED**

| Endpoint | UI | Classification |
|---|---|---|
| `POST /v1/admin/onboarding-applications/:id/complete-final-approval` | Admin `use-onboarding-applications.ts` / `apiClient.completeFinalApproval` | **ACTIVE HAPPY-PATH** (sets org COMPLETED + `FINAL_APPROVAL_COMPLETED`) |
| `POST /v1/organizations/{investor\|issuer}/:id/complete-onboarding` | `organization-context.completeOnboarding` exists; **no page/hook calls it** | **REACHABLE BUT NOT NORMAL HAPPY-PATH** (authenticated owner can hit API; not a current portal button) |
| `POST /v1/auth/complete-onboarding` | **no API-client / page caller** | **BACKEND ONLY / NO UI CALLER** (updates user role/onboarding flags; does not write USER_COMPLETED) |

`payment/webhook-service.ts` `completeOnboardingFeePayment` is fee capture, not org completion.

A normal current issuer/investor **cannot** trigger org/auth complete-onboarding through the portal UI. Admin final approval is the live completion path.

---

## 20. Final Completeness Statement

Phase 16 re-scan plus this closure pass of unresolved §19 items against schema, routes, jobs, webhooks, and frontend callers was performed.

**Modules checked:** AUTH, USER, ADMIN/RBAC, invitations, organization/members, onboarding, KYC/KYB/AML, RegTank, CTOS, legal documents/acceptances, application/review/amendments, contract/invoice/offer, signing/SigningCloud/eKYC, product, platform finance settings, notifications, note/marketplace/investment/balance, deposit/gateway/refund/name-check/recon, withdrawal/disbursement, repayment/settlement/ledger, trustee letters, arrears/default, Shoraka, prospectus, S3, jobs, webhooks, activity feed, guarantor AML, issuer dashboard, public landing. Site documents: removed from code. DocumentLog: does not exist. Legacy Loan/Investment: leftover schema + count read; no writers.

**Mutation routes checked:** All `router.post/patch/put/delete` under `apps/api/src/modules/*` plus Cognito routes, webhook routers in `app` bootstrap, notes/payment/signing/legal/admin/organization/applications/auth/notification/products. GET `getOrCreateReview` classified as mutating.

**Frontend portals checked:** admin, issuer, investor mutation hooks and key pages; landing public GET + Cognito.

**Jobs checked:** all 9 registrations in `apps/api/src/lib/jobs/index.ts`.

**Webhooks checked:** RegTank (8 + legacy + dev suffixes), Curlec, SigningCloud, Shoraka STP, Cognito OAuth.

**Audit/history tables checked:** 12 named log/event tables + 22 evidence/SOT models listed in §3. Writers and readers mapped. `ApplicationReviewEvent` / `application_review_events` **removed**. `NoteAdminAction` / `note_admin_actions` **removed**. `getOpenOverrideProposal` has **no callers**.

**Known remaining external checks:** live DB rows for `loans`/`investments` and historical `USER_COMPLETED`; legal/product intended name mapping; optional S3 leftovers from removed site documents. No remaining code-search UNRESOLVED items from the former §19 list.

---

## 21. Inventory Confidence

- Fully resolved from repository: **6/9** (items 2, 3, 5, 6, 7, 9)
- External/database/business verification required: **3/9** (item 1 leftover DB rows; item 4 legal/product intended mapping; item 8 historical `USER_COMPLETED` rows)
- Internal contradictions found and corrected: **8**
- Remaining known code blind spots: **0** (live `Product.signing_template` extra keys would be a database check, not a missing file search)

This inventory is certain about **current repository code**. It is not certain about production database contents, S3 objects, or legal/business intent that the repository does not encode.

---

*End of inventory. No application code, schema, or migrations were changed.*
