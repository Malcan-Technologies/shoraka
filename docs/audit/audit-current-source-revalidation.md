# Audit Current Source Revalidation

**READ-ONLY.** Product code, schema, event catalogues, and the manual verification catalogue were not modified in this pass.

Authority for this file is the working tree at the git state below. Prior forensic reports and dated QA snapshots were used only as *documents to mark CURRENT / STALE / PARTIALLY_STALE*, never as implementation facts.

---

## Git state

| Item | Value |
|---|---|
| Branch | `no_fix_55` |
| HEAD | `9b4ee130efe43611e290b4b4baed8322bb94d518` (`2026-08-24 00:25:31 +0800` — “update docs”) |
| Working tree | Clean (`git status --short` empty) |
| Inspection time | 2026-08-23 16:45:31 UTC |

---

## Executive summary

Current source catalogue size is **179 reserved event IDs** and **171 active writers**. The old **174** figure is the original A001–A174 cutover reserved set only. It is not the current total.

| | Reserved | Active | Retired (schema kept, no live writer) |
|---|---:|---:|---|
| Current source | **179** | **171** | **8** |

Retired IDs (not reused): A004 `USER_ROLE_ADDED`, A005 `ACTIVE_ROLE_CHANGED`, A010 `USER_EMAIL_VERIFIED`, A011 `EMAIL_VERIFICATION_FAILED`, A016 `USER_ROLES_UPDATED`, A040 `ONBOARDING_RESUMED`, A052 `CTOS_REPORT_RECEIVED`, A053 `CORPORATE_ENTITIES_UPDATED`.

**Access vs previously documented Access facts: UNCHANGED.** Three events, same names, dual logout writers still present, failed admin access still Security `ADMIN_ACCESS_DENIED`, filters/search/pagination/export and `audit.access.view` unchanged.

**Living catalogue** (`docs/audit/audit-manual-verification-catalogue.md`) and **living inventory** (`docs/audit/current-audit-logging-inventory.md`) already match these source counts (179/171/8), including Legal A179 and the five retired Security writers. **Do not rewrite the catalogue in this pass** — it is already aligned on totals and the Security/Legal product changes.

**Documents that still need updates** (operator/QA drift, not source):

- `packages/help-content/markdown/admin-audit-and-activity-logs.md` — Security still describes live email-verification failure and generic “role changes”; Legal tab triggers omit clone-from-version.
- `docs/audit/audit-origin-main-vs-current-cross-check.md` — historical by its own banner; Security QA still says “Verify email success and failure”.
- `docs/audit/qa-e2e-review-2026-08-16.md` — dated 174/174 matrix; Security writers marked Yes for now-retired events; Legal count 7.

**Modules unchanged vs living catalogue + current source:** Access, Onboarding, Application, Signing, Note, Payment, Product, Notification.

**Security / Legal vs living catalogue:** implementation matches. Vs older QA/help/origin text: those texts are stale.

---

## Access revalidation

**ACCESS CURRENT STATUS: UNCHANGED**

Previously documented Access facts were re-checked against current source. All eleven questions still hold.

### A. Audit model / table

Prisma `AccessAuditLog` → `access_audit_logs` (`apps/api/prisma/schema.prisma`).

Columns: `id` (cuid), `user_id` (nullable, **no User FK**), `event_type`, `occurred_at`, `created_at`, `actor_type`, `actor_user_id`, `organization_id`, `organization_kind`, `target_type`, `target_id`, `source`, `portal`, `ip_address`, `user_agent`, `correlation_id`, `idempotency_key`, `metadata`.

Special vs other audit tables: subject column is `user_id` (not `subject_user_id`). Writer hard-codes `organization_id` / `organization_kind` / `idempotency_key` to null. Indexes on `occurred_at`, `(event_type, occurred_at)`, `(user_id, occurred_at)`, `(actor_user_id, occurred_at)`, `correlation_id`. No uniqueness / idempotency constraint.

### B. Event catalogue

`ACCESS_AUDIT_EVENTS` in `apps/api/src/modules/auth/audit/events.ts` — **exactly 3**:

1. `USER_SIGNED_UP`
2. `USER_LOGGED_IN`
3. `USER_LOGGED_OUT`

Zod map in `apps/api/src/modules/auth/audit/metadata.ts`: signup/login share `accessLoginAuditMetadataSchema`; logout uses `accessLogoutAuditMetadataSchema`. **3/3 schemas. No add/remove/rename.**

### C. Writers

Single production helper: `writeAccessAuditLogBestEffort` (`apps/api/src/modules/auth/audit/writer.ts`). Inner `writeAccessAuditLog` is not exported. **Best-effort / non-blocking** (catch + pino error; auth must not fail).

| Event | Production writer | Trigger | Reachable? | Blocking? |
|---|---|---|---|---|
| `USER_SIGNED_UP` | `cognito.routes.ts` OAuth callback | Callback after user exists; `isSignup === true` (`stateData.signup === true` from Landing Get Started) | Yes | Best-effort |
| `USER_LOGGED_IN` | Same callback | Same path; `isSignup` false | Yes | Best-effort |
| `USER_LOGGED_OUT` | **Two paths** (see Q6) | See below | Yes | Best-effort |

Top-level fields written: `user_id`, `event_type`, `actor_type`, `actor_user_id`, `organization_id=null`, `organization_kind=null`, `target_type=USER`, `target_id=user_id`, `source`, `portal`, `ip_address`, `user_agent`, `correlation_id`, `idempotency_key=null`, `metadata`.

Signup/login metadata written by callback then parsed: `loginMethod: "COGNITO_OAUTH"`, `requestedRole`, `activeRole`, `roles`, plus writer-injected `actorName` / `actorEmail`. Optional schema field `sessionId` is **not** set by the Cognito callback writer.

Logout metadata: Cognito GET writes `roles`; `AuthService.logout` writes `activeRole` when known; writer injects actor snapshots.

`AuthService.syncUser` does **not** write Access (comment + cutover test). `POST /v1/auth/sync-user` is not a login/signup writer.

### D. Readers / UI

| Surface | Current source |
|---|---|
| List API | `GET /v1/admin/access-logs` — `requirePermission("audit.access.view")` |
| Export API | `GET /v1/admin/access-logs/export` — same permission; `format` csv\|json |
| Query | `page`, `pageSize` (default 15, max 100), `search`, `eventType` / `eventTypes`, `status` success\|failed, `dateRange` 24h\|7d\|30d\|all, `userId` |
| Search | User email / first / last / `user_id`, plus metadata `actorName` / `actorEmail` |
| Status filter | API accepts `failed`; reader matches **nothing** (`id: "__none__"`). UI `showStatusFilter={false}` |
| Order | `occurred_at` desc (export/list) |
| Admin UI | `/audit?tab=access` — `AccessLogsPanel` (`apps/admin/src/lib/audit-tabs.ts`, `apps/admin/src/app/audit/page.tsx`) |
| Issuer / Investor | No Access raw tab. Account **Recent logins** reads Access rows via `findRecentLogins` (`USER_LOGGED_IN` only) — display, not workflow SOT |
| Raw vs Activity | Access is **raw Audit History only** (admin curated / issuer / investor activity HIDE) |

### E. Visibility

Admin raw SHOW for all 3. Admin Activity / Issuer / Investor HIDE (catalogue visibility table matches `packages/types` activity maps).

### F. Source of truth

Access is evidence of successful Cognito callback / logout paths. Business SOT for identity is `User` + Cognito + session tables. **Exception (display-only):** `AccessAuditLogReader.findRecentLogins` feeds account “recent logins” on Admin / Issuer / Investor account pages. That is a read of the audit table for UX, not a workflow gate.

---

### Access — explicit 11-question results

1. **Still exactly 3 Access events?** Yes. `ACCESS_AUDIT_EVENTS` length 3.
2. **Exact names unchanged?** Yes. `USER_SIGNED_UP`, `USER_LOGGED_IN`, `USER_LOGGED_OUT`.
3. **Metadata schemas changed?** No. Login schema: snapshots + `loginMethod: "COGNITO_OAUTH"` + optional `sessionId`, `requestedRole`, `activeRole`, `roles`. Logout: snapshots + optional `activeRole`, `roles`.
4. **Writer payloads changed?** No vs living catalogue. Callback still does not send `sessionId`. Logout GET still sends `roles` only; `AuthService.logout` still sends `activeRole` when known.
5. **Signup/login/logout trigger conditions changed?** No. Signup vs login still mutually exclusive on one OAuth callback via `isSignup`. Portal login without `signup=true` is `USER_LOGGED_IN` even if Hosted UI created the account. `syncUser` still does not write Access.
6. **Dual logout writer still present?** **Yes.**  
   - `AuthService.logout` → `POST /v1/auth/logout` (`service.ts` ~408).  
   - Cognito `GET /logout` (`cognito.routes.ts` ~973).  
   Cutover test still asserts both. Current portal UIs (`apps/admin|issuer|investor/src/lib/auth.ts`) call **only** `GET /v1/auth/cognito/logout`. Two rows only if a caller also hits `POST /v1/auth/logout`. No dedupe.
7. **Failed Admin access behaviour changed?** No. Still **not** Access. `ADMIN_ACCESS_DENIED` via `writeSecurityAuditLogBestEffort` from `lib/auth/middleware.ts` (authenticated admin 403) and Cognito admin-portal gate (`cognito.routes.ts`). 401s are not audited (cutover test).
8. **Filters / search / pagination / export changed?** No. Search, event type, date range, page size 15, CSV/JSON export remain. Status filter still hidden in UI; `status=failed` still empty.
9. **Permission / RBAC changed?** No. `audit.access.view` on list, export, and Admin tab.
10. **Access UI changed?** No material change. Global `/audit` Access tab, `ListToolbar`, no status filter, export kind `access`.
11. **QA inspect fields removed/added/renamed?** No vs living Access cards (A001–A003). `sessionId` remains schema-optional and unpopulated by the live login writer.

---

## Module-by-module results

### Access

Current event count: **3 reserved / 3 active**  
Events added / removed / renamed: none vs living catalogue and vs previously documented Access set  
Metadata / writers / reader / UI / RBAC / visibility / export: as Access section above  
QA documentation changes required: none for Access cards; help-content Access row is CURRENT  
**Overall: UNCHANGED**

---

### Security

Inspected from scratch. Do not copy origin/main Security QA as live procedure.

#### Model

`SecurityAuditLog` → `security_audit_logs`. Columns: shared envelope plus **`subject_user_id`** (no FKs). Indexes on `occurred_at`, `(event_type, occurred_at)`, `(subject_user_id, occurred_at)`, `(actor_user_id, occurred_at)`, `(target_type, target_id, occurred_at)`, `correlation_id`. `idempotency_key` present, writer sets null.

#### Catalogue

`SECURITY_AUDIT_EVENTS`: **35**. `RETIRED_SECURITY_AUDIT_EVENTS`: **5**. **Active writers: 30.**

Retired (IDs reserved, Zod kept, **no** `eventType: "..."` in non-test production sources):

| ID | Event |
|---|---|
| A004 | `USER_ROLE_ADDED` |
| A005 | `ACTIVE_ROLE_CHANGED` |
| A010 | `USER_EMAIL_VERIFIED` |
| A011 | `EMAIL_VERIFICATION_FAILED` |
| A016 | `USER_ROLES_UPDATED` |

Live events (30): `USER_PROFILE_UPDATED`, `USER_PROFILE_UPDATED_BY_ADMIN`, `PASSWORD_CHANGED`, `PASSWORD_CHANGE_FAILED`, `ADMIN_ACCESS_DENIED`, `ADMIN_ROLE_CREATED`, `ADMIN_ROLE_PERMISSIONS_UPDATED`, `ADMIN_ROLE_DELETED`, `ADMIN_USER_ROLE_CHANGED`, `ADMIN_USER_DEACTIVATED`, `ADMIN_USER_REACTIVATED`, `ADMIN_INVITATION_CREATED`, `ADMIN_INVITATION_LINK_GENERATED`, `ADMIN_INVITATION_RESENT`, `ADMIN_INVITATION_REVOKED`, `ADMIN_INVITATION_ACCEPTED`, `USER_PUBLIC_ID_CHANGED`, `ORGANIZATION_MEMBER_INVITED`, `ORGANIZATION_MEMBER_JOINED`, `ORGANIZATION_MEMBER_REMOVED`, `ORGANIZATION_MEMBER_LEFT`, `ORGANIZATION_MEMBER_ROLE_UPDATED`, `ORGANIZATION_OWNERSHIP_TRANSFERRED`, `ORGANIZATION_INVITATION_REVOKED`, `ORGANIZATION_INVITATION_RESENT`, `NOTIFICATION_TYPE_UPDATED`, `NOTIFICATION_GROUP_CREATED`, `NOTIFICATION_GROUP_UPDATED`, `NOTIFICATION_GROUP_DELETED`, `USER_NOTIFICATION_PREFERENCE_UPDATED`.

Zod: **35/35** in `security/audit/metadata.ts` (retired schemas still parse historical rows).

#### Writers (live)

`writeSecurityAuditLog` (transactional with the mutation when the caller passes `tx`) and `writeSecurityAuditLogBestEffort` (denials / password failure — must not change HTTP).

Call sites (non-test): `admin/service.ts`, `organization/service.ts`, `notification/service.ts`, `auth/service.ts` (`USER_PROFILE_UPDATED`, `PASSWORD_CHANGED`, `PASSWORD_CHANGE_FAILED`), `cognito.routes.ts` + `lib/auth/middleware.ts` (`ADMIN_ACCESS_DENIED`).

Investor/Issuer role grant: `OrganizationService.createOrganization` — **not** `USER_ROLE_ADDED` / `USER_ROLES_UPDATED`. Admin catalog role: `ADMIN_USER_ROLE_CHANGED`. Portal switch: navigation only; **no** `ACTIVE_ROLE_CHANGED`; no `POST /v1/auth/switch-role`.

Signup email confirmation: Landing `/verify-email` → `POST /v1/auth/confirm-signup` / `resend-signup-code`. **Does not** write `USER_EMAIL_VERIFIED` / `EMAIL_VERIFICATION_FAILED`. `POST /v1/auth/verify-email` is removed.

#### Readers / UI / RBAC

`GET /v1/admin/security-logs` + export; permission `audit.security.view`. Admin `/audit?tab=security`. Filter dropdown is built from **full** `SECURITY_AUDIT_EVENTS` (35), including retired names, so historical rows remain filterable. `showStatusFilter={false}`. Search / date / event / pagination / CSV export present. No issuer/investor Security tab. All 35 HIDE on curated Activity.

#### Documentation statements (Security)

| Old statement | Status |
|---|---|
| 35 reserved / 30 active; five retired IDs — living catalogue header | CURRENT |
| Live writers for `USER_EMAIL_VERIFIED` / `EMAIL_VERIFICATION_FAILED` (origin QA, qa-e2e matrix “Yes”) | STALE |
| Live writers for `USER_ROLE_ADDED` / `ACTIVE_ROLE_CHANGED` / `USER_ROLES_UPDATED` | STALE |
| Help-content: Security includes “failed password/**email verification**” and “Role changes” as common triggers | PARTIALLY_STALE (password failure and `ADMIN_ACCESS_DENIED` still live; email-verify and portal role-add/switch events are not) |
| Failed admin access is Security `ADMIN_ACCESS_DENIED`, not Access | CURRENT |
| `audit.security.view`, `/audit?tab=security`, search/date/event/export | CURRENT |

QA steps that are now stale: origin/main “Verify email success and failure”; qa-e2e rows 10–11 and 4–5/16 as live writers; any checklist that still treats A004/A005/A010/A011/A016 as LIVE QA.

**Overall vs living catalogue: UNCHANGED. Overall vs origin/help/qa-e2e: those docs are stale (see drift matrix).**

---

### Onboarding

Current event count: **18 reserved / 15 active / 3 retired** (`ONBOARDING_RESUMED`, `CTOS_REPORT_RECEIVED`, `CORPORATE_ENTITIES_UPDATED`).

Zod 18/18. Writer: `writeOnboardingAuditLog` from regtank, admin, organization, director-KYC helpers. Model `OnboardingAuditLog` / `onboarding_audit_logs` with extra columns `onboarding_id`, `subject_user_id`, `organization_type` (no FKs).

Admin raw: `/audit?tab=onboarding`, permission `onboarding.view`. Contextual org Activity is curated onboarding timeline (not the global raw table). Issuer/investor see curated onboarding activity with visibility rules (retired A040/A052/A053 HIDE for portals; admin raw still SHOW historical).

Living catalogue already records 18/15 and A175 `ORGANIZATION_PROFILE_UPDATED_BY_ADMIN`. qa-e2e still says Onboarding 17.

**Overall: UNCHANGED** vs living catalogue + current source. qa-e2e count STALE.

---

### Legal

Inspected from scratch.

#### Model

`LegalAdminAuditLog` → `legal_admin_audit_logs`. Extra columns: **`legal_document_id`**, **`legal_document_version_id`**. No document/user FKs. Indexes include `(legal_document_id, occurred_at)`.

#### Catalogue

`LEGAL_ADMIN_AUDIT_EVENTS`: **8** (all live). A056–A062 plus **A179** `LEGAL_DOCUMENT_VERSION_CREATED_FROM_VERSION`. No retired Legal IDs. Zod **8/8**. Optional metadata on A179: `sourceVersionStatus: "PUBLISHED" | "ARCHIVED"`.

#### Writers

Named helpers in `legal-documents/audit/writer.ts`, called from `LegalDocumentService` inside the Prisma transaction (S3 copy/hash outside). Restore live path: `restoreVersionToDraft` only — `writeLegalDocumentVersionRestoredAudit(..., "DRAFT")`. Previously published archives throw `VERSION_IMMUTABLE`; clone via `createDraftFromVersion`.

`createDraftFromVersion`: source must be `PUBLISHED` **or** `ARCHIVED && published_at != null`. Creates a **new DRAFT** (new id, next version number, copied S3 object). Source row unchanged. No auto-archive, no auto-publish. Admin UI: “Create New Version From This Version”.

Informational Admin onboarding-readiness warning (`GET /v1/admin/legal-documents/onboarding-readiness`, `document_management.view`) writes **no** audit event.

#### Readers / UI / RBAC

Global `/audit?tab=legal-documents`, permission `document_management.view`. User acceptances are **not** this table (`LegalDocumentAcceptance`). No issuer/investor Legal admin audit tab. All 8 HIDE on curated Activity.

Acceptance evidence SOT: `LegalDocumentAcceptance`. Document/version SOT: `LegalDocument` / `LegalDocumentVersion`. Audit is evidence only.

#### Documentation statements (Legal)

| Old statement | Status |
|---|---|
| Legal 7 events / no A179 (qa-e2e 2026-08-16) | STALE |
| Living catalogue + `legal-admin-audit-log.md`: 8 events, clone from published or previously published archived, restore draft-only | CURRENT |
| Help-content Legal tab “Upload, publish, archive, restore” | PARTIALLY_STALE (omits clone-from-version) |
| `AUTO_ARCHIVED_ON_RESTORE_PUBLISH` still in Zod for historical archive rows; live restore does not publish-on-restore | CURRENT as historical enum |

**Overall vs living Legal docs: UNCHANGED. Vs 174-era / qa-e2e Legal 7: those docs are stale.**

---

### Application

Current event count: **41** (A063–A102 + A178 `CONTRACT_FACILITY_OCCUPANCY_UPDATED`). All live. Zod 41/41.

Writers: `writeApplicationAuditLog` / `writeApplicationDocumentAuditLogs` from applications, contracts, invoices, admin, amendments, CTOS report, lifecycle-close, `refresh-contract-facility`, acceptance-signing-expiry job. Some event names are ternary (not a bare `eventType: "X"` literal) — production coverage exists for expiry and acceptance events.

Reader: application-scoped, not a global `/audit` tab. Admin application detail: curated Activity + raw Audit History. Permission `applications.view`. Signing rows merged into curated timeline from `SigningAuditLog`. Issuer sees curated application activity; investor HIDE all 41.

SOT: Application / Contract / Invoice / review tables. Occupancy dual-ledger is business SOT; A178 is evidence.

**Overall: UNCHANGED**

---

### Signing

Current event count: **12**. Zod 12/12. Writer `writeSigningAuditLog` from signing service, expire-envelope, ekyc service. Model extra: `signing_envelope_id`, `application_id`. Admin: merged into application Audit History / envelope logs. Permission `applications.view`. No global tab.

**Overall: UNCHANGED**

---

### Note

Current event count: **37** (includes `NOTE_CAMPAIGN_PAUSED` / `NOTE_CAMPAIGN_RESUMED`). Zod `Record<NoteAuditEventType, z.ZodType>` **37/37** (map is `schemas`, not `metadataByEvent`). Writers `writeNoteAuditLog` / `writeNoteAuditFromActor` plus note `writer.ts` disbursement operation mapping. Call sites include notes service, prospectus-review, shoraka-stp. `note_id` null only for `TRUSTEE_SIGNATURE_UPDATED`. Admin: note detail Audit History; trustee signature on Platform Finance (`notes.view` / `platform_settings.view`).

**Overall: UNCHANGED**

---

### Payment

Current event count: **19**. Zod 19/19 via `schemas` record. **Only audit table with unique `idempotency_key`.** Writer stack: `writeGatewayPaymentAudit`, `writeInvestorWithdrawalAudit`, `writeReconExceptionAudit` (low-level `writePaymentAuditLog` used internally). `gateway_payment_id` null for withdrawal/recon-only. Admin: gateway payment / withdrawal / recon Audit History (not global `/audit`). Investor sees a subset of payment activity under ownership rules.

**Overall: UNCHANGED**

---

### Product

Current event count: **5**. Zod 5/5. Named writers from product service. Admin `/audit?tab=products`, `audit.product.view`. No Product FK (history survives delete). Rollback-create does not emit a dedicated event (`product-audit-log.md` CURRENT on that point).

**Overall: UNCHANGED**

---

### Notification

Current event count: **1** — `NOTIFICATION_BROADCAST_PROCESSED`. Zod 1/1. Writer `writeNotificationBroadcastProcessedAudit`. Extra columns: `audience_type`, `notification_type_id`; `id` is caller-supplied (not cuid default). Admin `/audit?tab=notifications`, `notifications.view`. Type/group/preference changes are **Security** events, not this table.

**Overall: UNCHANGED**

---

## Documentation drift matrix

| Document | Section | Current statement | Current source says | Status | Required documentation change |
|---|---|---|---|---|---|
| `audit-manual-verification-catalogue.md` | Header / totals | 179 reserved, 171 active, 8 retired; Legal 8; Security 35/30 | Same (`*_AUDIT_EVENTS` + `RETIRED_*`) | CURRENT | None this pass (user hold) |
| `audit-manual-verification-catalogue.md` | Access A001–A003 | 3 events, dual logout, Cognito callback, `audit.access.view` | Same | CURRENT | None |
| `current-audit-logging-inventory.md` | Catalogue counts | 179/171/8; A179 clone-from-published-or-archived | Same | CURRENT | None |
| `legal-admin-audit-log.md` | Live events (8), clone, restore, readiness warning | 8 events; clone new DRAFT; restore never-published only; warning unaudited | `LEGAL_ADMIN_AUDIT_EVENTS` length 8; `createDraftFromVersion`; `restoreVersionToDraft`; readiness GET unaudited | CURRENT | None |
| `product-audit-log.md` | 5 events, no rollback event | `PRODUCT_*` five events | Same | CURRENT | None |
| `notification-broadcast-audit-log.md` | One broadcast event | `NOTIFICATION_BROADCAST_PROCESSED` | Same | CURRENT | None |
| `packages/help-content/markdown/admin-audit-and-activity-logs.md` | Security table row | “failed password/**email verification**”; triggers “Role changes … password/email failures” | Email-verify events retired; role-add/switch/update retired; password failure + `ADMIN_ACCESS_DENIED` live | PARTIALLY_STALE | Drop live email-verification audit; distinguish admin catalog role vs retired portal role events |
| Same help file | Legal Documents triggers | “Upload, publish, archive, restore” | Also clone-from-version (A179) | PARTIALLY_STALE | Add “Create New Version From This Version” |
| Same help file | Choosing the Right Log | “password, **email**, profile, role…” | Email *address* verify-audit path removed; signup confirm is unaudited | PARTIALLY_STALE | Clarify signup confirm vs retired A010/A011 |
| Same help file | Access row | Success-only signup/login/logout; denials on Security | Same | CURRENT | None |
| `audit-origin-main-vs-current-cross-check.md` | Banner | Historical snapshot; not living SOT | Correct framing | CURRENT as historical | Do not treat as living |
| Same | Security “WHAT I SHOULD MANUALLY TEST” | “Verify email success and failure” | No live A010/A011 writers; Landing confirm-signup unaudited | STALE | Relabel as historical-only / point to living catalogue |
| Same | Security preserved | “Email verification (success + failure)” as current | Retired | STALE | Same |
| `qa-e2e-review-2026-08-16.md` | Totals table | 174/174; Security 35 writers Yes; Legal 7; Onboarding 17; Application 40; Note 35 | 179/171; Security 30 live; Legal 8; Onboarding 18/15; Application 41; Note 37 | STALE | Keep as dated snapshot; do not use for live QA |
| Same | Matrix rows 4–5, 10–11, 16 | Live writers for retired Security events | No production `eventType` for those five | STALE | Same |
| `people-usage.md` | People UI mapping | Not an audit event catalogue | Unrelated to audit events | CURRENT (out of scope) | None |

---

## QA checklist drift

| Module | Existing QA instruction | Still valid? | New expected behaviour |
|---|---|---|---|
| Access | Sign up / log in / log out → three Access events | Yes | Unchanged |
| Access | Typical portal logout → one `USER_LOGGED_OUT` via Cognito GET | Yes | Dual writer still exists on `POST /v1/auth/logout` but portals do not call it |
| Access | Failed admin Cognito → Security `ADMIN_ACCESS_DENIED`, not Access | Yes | Unchanged |
| Access | Export CSV; failed status empty | Yes | Unchanged |
| Security | Verify email success and failure (origin / qa-e2e) | **No** | Do not live-QA A010/A011. Confirm Landing `/verify-email` uses confirm-signup and writes **no** Security email-verify row |
| Security | Role add / switch / `USER_ROLES_UPDATED` as live | **No** | Org create grants Investor/Issuer without those events. Portal switch writes nothing. Admin catalog uses `ADMIN_USER_ROLE_CHANGED` |
| Security | Password change success and failure | Yes | Unchanged |
| Security | Admin invite / revoke / accept; org membership | Yes | Unchanged |
| Security | Security CSV export | Yes | Unchanged |
| Legal | Only upload / publish / archive / restore | **Partial** | Also clone from **current PUBLISHED** or previously published ARCHIVED → new DRAFT (A179). Restore is never-published archive → DRAFT only |
| Legal | Restore previously published version to live on same id | **No** | `VERSION_IMMUTABLE`; clone then publish |
| Legal | Onboarding readiness Admin warning | N/A in old QA | Informational only; **no** audit event |
| Onboarding | Expect A040 / A052 / A053 as live | **No** | Retired; historical rows readable |
| Totals | Expect 174 events | **No** | **179 reserved / 171 active** |
| Application / Note | 40 / 35 events (qa-e2e) | **No** | 41 and 37 |

---

## Current event totals

Recounted from `apps/api/src/modules/*/audit/events.ts` (Access: `modules/auth/audit/events.ts`).

| Module | Current event count (reserved) | Active |
|---|---:|---:|
| Access | 3 | 3 |
| Security | 35 | 30 |
| Onboarding | 18 | 15 |
| Legal | 8 | 8 |
| Application | 41 | 41 |
| Signing | 12 | 12 |
| Note | 37 | 37 |
| Payment | 19 | 19 |
| Product | 5 | 5 |
| Notification | 1 | 1 |
| **TOTAL** | **179** | **171** |

Verification:

- Event constant arrays: **179** unique names in the ten `*_AUDIT_EVENTS` arrays.
- Metadata/Zod: Access 3, Security 35, Onboarding 18, Legal 8, Application 41, Signing 12, Note 37, Payment 19, Product 5, Notification 1 → **179/179**.
- Production writer coverage: **171** active types have a current `eventType` call site (or ternary/mapped equivalent). **8** retired types have schema + catalogue card and **no** live writer (enforced by `auth/audit/cutover.test.ts` for the five Security retirements).

---

## Current implementation risks / anomalies

Source-backed only:

1. **Two `USER_LOGGED_OUT` writers** (`AuthService.logout` and Cognito `GET /logout`) with no idempotency key. Typical UI uses GET only. Duplicate rows if both fire. Documented in A003; still true.
2. **Account “recent logins” reads `AccessAuditLog`** (`findRecentLogins` where `event_type = USER_LOGGED_IN`). Audit table used as a display feed, not as a workflow gate. Identity SOT remains User/session/Cognito.
3. **`sessionId` on Access login Zod is never populated** by the Cognito callback writer. QA that expects a session id on the row will fail; catalogue already says this.
4. **Access `status=failed` is a deliberate empty match** (`id: "__none__"`). Not a missing filter — success-only table.
5. **Security filter lists retired event names** so historical rows can be found. Live QA must not treat those dropdown values as “emit this today”.
6. **Legal restore writer still types `restoredAs: "DRAFT" | "PUBLISHED"`** and Zod allows `newStatus`/`restoredAs` PUBLISHED, but `restoreVersion` only calls DRAFT. PUBLISHED restore is dead. Historical `AUTO_ARCHIVED_ON_RESTORE_PUBLISH` remains in archive Zod.
7. **Payment unique `idempotency_key`** is the only audit uniqueness constraint. Other modules can duplicate on retry (Access logout especially).
8. **No User/resource FKs on audit tables** — intentional (history survives deletion). Joins for search go through live User rows; deleted users may be metadata-only.
9. **Help-content and dated QA still describe live Security email verification and 174 totals** — documentation risk for testers, not a runtime bug.

No event found with: schema but no catalogue name; writer in the wrong module’s table; missing Zod for a reserved event.

Internal `writeLegalAdminAuditLog` / `writePaymentAuditLog` / `writeProductAuditLog` are used by named wrappers, not orphaned.

---

## Documents inspected

- `docs/audit/audit-manual-verification-catalogue.md` (not rewritten)
- `docs/audit/audit-origin-main-vs-current-cross-check.md`
- `docs/audit/current-audit-logging-inventory.md`
- `docs/audit/legal-admin-audit-log.md`
- `docs/audit/product-audit-log.md`
- `docs/audit/notification-broadcast-audit-log.md`
- `docs/audit/qa-e2e-review-2026-08-16.md`
- `docs/audit/people-usage.md`
- `packages/help-content/markdown/admin-audit-and-activity-logs.md`
- Prisma audit models; all ten `events.ts` / `metadata.ts` / `writer.ts`; Access/Security admin readers; `apps/admin/src/lib/audit-tabs.ts`; portal logout clients
