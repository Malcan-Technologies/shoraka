# Audit Event Catalog

> **Document responsibility:** this file owns the **technical writer / storage / evidence**
> reference, organised by module, with an evidence-sufficiency assessment per event. It answers
> *"is the evidence we store for this event good enough?"*
>
> | Question | Document |
> |---|---|
> | What happens for `EVENT_X`? | [`audit-event-surface-matrix.md`](./audit-event-surface-matrix.md) — **primary reference** |
> | What is still broken or awaiting sign-off? | [`audit-product-gap-review.md`](./audit-product-gap-review.md) |
> | What should I *call* this on a new surface? | [`activity-notification-copy-standard.md`](./activity-notification-copy-standard.md) |
> | Why is it worded that way, and was it reviewed? | [`activity-notification-copy-review.md`](./activity-notification-copy-review.md) |
>
> For the authoritative event/notification **counts** and the per-event **surface map**, use
> [`audit-event-surface-matrix.md`](./audit-event-surface-matrix.md) §7 and §2, plus its
> machine-readable companion [`audit-event-registry.json`](./audit-event-registry.json).
>
> ⚠️ Editor search indexes on this repository return phantom files under
> `apps/api/src/modules/*/audit/` that **do not exist on disk** and carry a different event
> vocabulary (`USER_LOGGED_IN`, `CONTRACT_ACCEPTANCE_SUBMITTED`, `SHORAKA_CERTIFICATE_RECEIVED`, …).
> Verify with `ls`/`cat` before trusting any hit under that path. Full list in matrix §8.1.

Developer reference for every live audit/log event and per-user notification type in production code, organized by module. This is a **read-only catalog of what exists today** — it does not propose changes. For gaps, mismatches, and recommended follow-ups, see [`audit-product-gap-review.md`](./audit-product-gap-review.md).

Companion documents:
- [`origin-main-preservation-inventory.md`](./origin-main-preservation-inventory.md) — full table/column/reader inventory as of the preservation audit.
- [`origin-main-standardization-final-report.md`](./origin-main-standardization-final-report.md) — schema/writer standardization work and its verified test results.

Assessment legend used throughout: **ENOUGH** (evidence sufficient for the business action) · **PARTIAL** (evidence present but thin/generic) · **DUPLICATE_BUT_INTENTIONAL** (two writers cover the same moment by design) · **NOT_MEANINGFUL_TO_AUDIT** (technical/catalogue action, not a user-facing decision).

Presentation classification legend: **CONSISTENT** · **INTENTIONALLY_DIFFERENT** (admin vs portal wording differs on purpose) · **MISLEADING** (wording implies something untrue) · **GENERIC_FALLBACK** (falls through to a generic label) · **VISIBILITY_MISMATCH** (stored but hidden from a surface that should show it, or vice versa).

---

## 1. Access / Security / Onboarding (`access_logs`, `security_logs`, `onboarding_logs`)

### 1.1 `access_logs` — admin-forensic, not shown to issuer/investor

| Event | Business action | Trigger | Actor | Stored evidence | Assessment |
|---|---|---|---|---|---|
| `LOGIN` | User login (OAuth callback + sync-user) | `cognito.routes.ts` OAuth callback; `auth/service.ts:syncUser` | Subject | `portal`, `ip_address`, `user_agent`, `device_info`, `device_type`, `success`, `metadata.{requestedRole,activeRole,roles}` | ENOUGH |
| `LOGOUT` | User logout | `cognito.routes.ts`; `auth/service.ts:logout` | Subject | `portal`, IP/UA/device, `metadata.{roles/activeRole}` | ENOUGH |
| `SIGNUP` | First OAuth signup | `cognito.routes.ts` (`isSignup` branch) | Subject | Same as login success | ENOUGH |
| `ROLE_ADDED` | Fallback branch of `updateUserRoles` for any outcome that doesn't strip `ADMIN` — **not literally "a role was added"**; **UNREACHABLE in production** | `admin/service.ts:updateUserRoles`, route `PATCH /v1/admin/users/:id/roles`, SDK method, `useUpdateUserRoles` hook all exist; **no `.tsx` component calls the hook** | Admin *(never actually reached)* | `metadata.{targetUserId,targetUserEmail,newRoles,previousRoles,adminRoleRemoved}` | N/A — evidence shape is fine but the writer cannot fire from the current Admin UI. **Reclassified UNREACHABLE 2026-08-25** (was ENOUGH/LIVE); see `audit-event-surface-matrix.md` §2.1 |
| `ROLE_REMOVED` | Same `updateUserRoles` writer, but only the branch where `ADMIN` was present and is now absent — **not "any role removed"**; **UNREACHABLE in production** | Same route/SDK/hook chain as `ROLE_ADDED`; same zero-`.tsx`-caller finding | Admin *(never actually reached)* | Identical metadata shape to `ROLE_ADDED` | N/A — same reason. **Reclassified UNREACHABLE 2026-08-25** (was ENOUGH/LIVE) |
| `PROFILE_UPDATED` | Admin edits a user's name/phone | `admin/service.ts:updateUserProfile` | Admin | `metadata.{targetUserId,updatedFields,previousValues,nameLockedOverride}` | ENOUGH. **LIVE_UI_REACHABLE** — `useUpdateUserProfile` is called from `user-account-profile-panel.tsx` and `organization-member-edit-dialog.tsx` (verified 2026-08-25) |
| `ONBOARDING_RESET` | Would reset the onboarded flag — its own Swagger comment calls it *"temporary feature for testing"*; **UNREACHABLE, route-only** | `admin/service.ts:resetOnboarding`, route `POST /v1/admin/users/:id/reset-onboarding`; **no SDK method, no hook, no `.tsx` caller** (one tier more unreachable than `ROLE_ADDED`/`ROLE_REMOVED`, which at least have SDK+hook plumbing) | Admin *(never actually reached)* | `metadata.{targetUserId,portal}` | N/A — evidence shape is fine but there is no UI path at all. **Reclassified UNREACHABLE 2026-08-25** (was ENOUGH/LIVE) |

**Dead (declared, no writer):** `ROLE_SWITCHED` (lives in `security_logs` instead), `ONBOARDING`, ~~`USER_COMPLETED` (superseded by `FINAL_APPROVAL_COMPLETED`)~~, `KYC_STATUS_UPDATED` (seed only), `ONBOARDING_STATUS_UPDATED` (lives in `onboarding_logs`), `PASSWORD_CHANGED`, `EMAIL_CHANGED` (both live in `security_logs`). **`KYC_STATUS_UPDATED` re-investigated 2026-08-25** for the dead/seed-only cleanup pass and **retained**: already excluded from `ACCESS_EVENT_TYPES` (2026-08-24); its label-map entries and the dedicated dropdown filter option in `access-logs-toolbar.tsx` exist to render/filter `seed.ts`'s real historical seed rows, and removal would only degrade that seed data's display with no safety benefit — see `audit-product-gap-review.md` §4 item 12. **`USER_COMPLETED` — CODE_REMOVED 2026-08-25 (same-day follow-up pass):** unlike `KYC_STATUS_UPDATED`, it has zero writers into `access_logs` at all (the only `USER_COMPLETED` writer anywhere is the dev-only regtank webhook handler, which targets `onboarding_logs`, not this table) — no `seed.ts` row and no historical-compatibility reason to keep its display code, so it was removed from the `EventType` union, the `AccessLog` OpenAPI enum, and the access-log label/color/dropdown maps. `onboarding_logs.USER_COMPLETED` (its own, unrelated `DEV_ONLY` entry — see §2.3) is untouched.

**Unreachable (writer exists, zero UI callers):** `ROLE_ADDED`, `ROLE_REMOVED` — **reclassified 2026-08-25** after re-tracing `AdminService.updateUserRoles` from source: route, SDK method, and `useUpdateUserRoles()` hook all exist, but no `.tsx` component calls the hook, and no other Admin UI path reaches this route (the "Portal access" panel uses the unrelated `useUpdateUserOnboarding`, which writes `onboarding_logs.ONBOARDING_STATUS_UPDATED` instead). `ONBOARDING_RESET` — same reclassification date; `resetOnboarding` is route-only (no SDK method at all). None of the three were removed from `ACCESS_EVENT_TYPES` — that allowlist gates which *stored* rows a query can return, not which UI buttons exist, so keeping them prevents any row created via direct API/script usage from being silently hidden. See `audit-event-surface-matrix.md` §2.1 and §9 #12 for the full trace.

### 1.2 `security_logs`

| Event | Business action | Trigger | Actor | Stored evidence | Assessment |
|---|---|---|---|---|---|
| `ROLE_ADDED` | User adds own portal role | `auth/service.ts:addRole` | Subject | `metadata.{addedRole,allRoles}` | ENOUGH |
| `ROLE_ADDED` | Admin invitation accepted | `admin/service.ts:acceptAdminInvitation` | Invitee | `metadata.{addedRole:"ADMIN",invitationToken,invitationType}` | ENOUGH |
| `ROLE_SWITCHED` | User switches active role | `auth/service.ts:switchRole` | Subject | `metadata.newRole` | ENOUGH |
| `ROLE_SWITCHED` | Admin deactivates/reactivates via role edit | `admin/service.ts:updateUserRoles` | Affected user | `metadata.{action,previousStatus,newStatus,deactivatedBy/activatedBy}` | ENOUGH |
| `ROLE_SWITCHED` | Admin role description change / deactivate / reactivate | `admin/service.ts:updateAdminRole`, `deactivateAdmin`, `reactivateAdmin` | Subject | `metadata.{previousRole,newRole,updatedBy}` etc. | ENOUGH |
| `PROFILE_UPDATED` | User or admin-override profile edit | `auth/service.ts:updateUserProfile`; `admin/service.ts:updateUserProfile` | Subject | `metadata.{updatedFields,previousValues,adminOverride?}` | ENOUGH |
| `PASSWORD_CHANGED` | Password change success/fail | `auth/service.ts:changePassword` | Subject | `metadata.{reason,sessionRevoked,success?,error?}` | ENOUGH |
| `EMAIL_CHANGED` | Email verification success/fail | `auth/service.ts:verifyEmail` | Subject | `metadata.{email,reason,success?}` | ENOUGH (event name is broader than "email changed" — it's verification) |
| `ROLE_PERMISSIONS_UPDATED` | Admin role permission edit | `admin/service.ts:updateAdminRolePermissions` | Admin | `metadata.{roleKey,previousPermissions,nextPermissions}` | ENOUGH — hidden from Security panel filter |
| `ROLE_CREATED` | Admin role catalogue create | `admin/service.ts:createAdminRole` | Admin | `metadata.{roleKey,roleName,badgeColor}` | ENOUGH — hidden from panel |
| `ROLE_REMOVED` | Admin role catalogue delete | `admin/service.ts:deleteAdminRole` | Admin | `metadata.{deletedRoleKey,deletedRoleName}` | NOT_MEANINGFUL_TO_AUDIT as user-role removal (catalogue-only) |
| `INVITATION_REVOKED` | Admin revokes invitation | `admin/service.ts:revokeInvitation` | Admin | `metadata.{invitationId,email,roleDescription}` | ENOUGH — hidden from panel |

### 1.3 `onboarding_logs`

| Event | Business action | Trigger | Actor | Stored evidence | Assessment |
|---|---|---|---|---|---|
| `ONBOARDING_STARTED` | Start personal/corporate onboarding | `regtank/service.ts:startPersonalOnboarding`/`startCorporateOnboarding` | Applicant | `metadata.{organizationId,requestId,onboardingType,previousOrgStatus}` | ENOUGH |
| `ONBOARDING_RESUMED` | Resume onboarding | `regtank/service.ts` | Applicant | `metadata.{organizationId,previousRequestId,newRequestId,trigger}` | ENOUGH |
| `ONBOARDING_CANCELLED` | Admin restarts onboarding | `admin/service.ts:restartOnboarding` | Applicant (`actor_user_id`=admin) | `metadata.{cancelledOnboardingId,previousStatus,cancelledBy,reason}` | ENOUGH |
| `ONBOARDING_RESET` | Admin resets onboarded flag — **UNREACHABLE** (same `resetOnboarding` writer as `access_logs.ONBOARDING_RESET`; route-only, no UI) | `admin/service.ts:resetOnboarding` | Applicant | `metadata.{resetBy,previousStatus,newStatus,adminAction}` | N/A as a live UI action — evidence shape is ENOUGH **if** the route is invoked. **Reclassified UNREACHABLE 2026-08-25** |
| `ONBOARDING_REJECTED` | RegTank individual rejection | `individual-onboarding-handler.ts` | Applicant | `metadata.{previousStatus,newStatus,trigger:"REGTANK_REJECTION"}` | ENOUGH |
| `COD_REJECTED` | RegTank corporate (COD) rejection | `cod-handler.ts` | Applicant | Same shape, **no rejection reason** | PARTIAL |
| `ONBOARDING_STATUS_UPDATED` | Generic status transitions (webhooks/admin) | Multiple webhook handlers, `admin/service.ts` | Applicant | `metadata.{trigger,previousStatus,newStatus,updatedBy?,amlApproved?}` | PARTIAL (generic bucket). **This is the canonical live AML-progression event** (`metadata.amlApproved:true` + a path-specific `trigger`), not a substitute for `AML_APPROVED` — `AML_APPROVED` is a separate, unreachable manual-override writer (see below). It is also the canonical live KYC-informational event when `metadata.trigger:"KYC_APPROVED"` — standalone `KYC_APPROVED` has no production writer. **Verified 2026-08-24** — see `audit-event-surface-matrix.md` §2.3. |
| `ONBOARDING_APPROVED` | RegTank company-gate approval; admin approves submission | `regtank/service.ts`; `admin/service.ts:approveOnboardingSubmission` | Applicant (actor=admin on admin path) | `metadata.{organizationId,requestId,approvedBy?,approvedAt?}` | ENOUGH; DUPLICATE_BUT_INTENTIONAL (provider gate vs admin gate share the event name) |
| `TNC_APPROVED` | User accepts Terms & Conditions | `organization/service.ts:acceptTermsAndConditions` | Applicant | `metadata.{organizationId,organizationType,role,legalDocumentsRequired}` | ENOUGH |
| `FORM_FILLED` | Form progress / liveness step | `regtank/service.ts:handleWebhookUpdate`; `individual-onboarding-handler.ts` | Applicant | `metadata.{requestId,status,substatus,payload}` or `{section}` | PARTIAL (raw webhook payload) |
| `WEBHOOK_RECEIVED` / `WEBHOOK_APPROVED` / `WEBHOOK_REJECTED` / `WEBHOOK_PENDING_APPROVAL` / `WEBHOOK_IN_PROGRESS` | RegTank webhook telemetry | `regtank/service.ts:handleWebhookUpdate` | Applicant | Full webhook `payload` | PARTIAL (forensic; generic portal fallback) |
| `EOD_APPROVED` / `EOD_REJECTED` / `EOD_WEBHOOK` | Director/shareholder end-of-day KYC | `eod-handler.ts` | Applicant | `metadata.{eodRequestId,codRequestId,status,confidence,kycId}` | ENOUGH |
| `AML_APPROVED` | *(Designed)* manual admin AML approval/override — **UNREACHABLE in production** | `admin/service.ts:approveAmlScreening`, route `POST /v1/admin/onboarding-applications/:id/approve-aml`, SDK method, `useApproveAmlScreening` hook all exist; **no `.tsx` component calls the hook** | Admin *(never actually reached)* | `metadata.{organizationType,onboardingRequestId,previousStatus,newStatus,approvedBy,approvedAt}` | N/A — evidence shape is fine but the writer cannot fire from the current Admin UI. **Reclassified UNREACHABLE 2026-08-24** (was ENOUGH/LIVE); see `audit-event-surface-matrix.md` §2.3 for the full trace |
| `SSM_APPROVED` | Admin SSM/CTOS verification approve | `admin/service.ts:approveSsmVerification` | Applicant (actor=admin) | `metadata.{organizationId,approvedBy,regtankRequestId}` | ENOUGH |
| `FINAL_APPROVAL_COMPLETED` | Admin final approval (platform activation) | `admin/service.ts:completeFinalApproval` | Applicant (actor=admin) | `metadata.{organizationType,portalType,approvedBy,isCorporateOnboarding}` | ENOUGH |
| `SOPHISTICATED_STATUS_UPDATED` | Sophisticated-investor status toggle | `admin/service.ts`; auto in `regtank/service.ts` | Applicant/system | `metadata.{action,newReason,updatedBy,previousStatus,newStatus}` | ENOUGH |
| `PROFILE_UPDATED` | Admin patches org profile (bank fields, etc.) | `admin/organization-admin-profile.ts` | Owner (actor=admin) | `metadata.{updatedBy,updatedFields,bankFieldsChanged,previousValues}` | ENOUGH |

**Dead (declared, no writer):** `TNC_ACCEPTED` (live writer uses `TNC_APPROVED`), `KYC_APPROVED` (seed only; live path uses `ONBOARDING_STATUS_UPDATED` with `trigger:"KYC_APPROVED"`), `KYB_APPROVED` (no writer anywhere). ~~Additionally **`DIRECTOR_KYC_STATUS_UPDATED`** has a writer module (`director-kyc-outcomes.ts`) with zero importers — dead in practice, not previously catalogued.~~ **CORRECTED (2026-08-24):** that claim was wrong. `rg` returns **zero** occurrences of `DIRECTOR_KYC_STATUS_UPDATED` anywhere in the repository and `director-kyc-outcomes.ts` does not exist — it was a phantom search-index hit from an unmerged branch. Reclassified `NOT_AN_ACTUAL_EVENT`; director/shareholder outcomes are recorded as `EOD_APPROVED` / `EOD_REJECTED` / `EOD_WEBHOOK`. **RESOLVED (2026-08-24):** these three dead types were removed from the admin `use-organization-logs.ts` query-filter array (see §1.4); they remain valid, catalogued enum values. **Re-investigated 2026-08-25** for the dead/seed-only cleanup pass and **retained**: the remaining label-map entries in `organization-activity-timeline.tsx` render `seed.ts`'s real historical seed rows and already fall back gracefully when absent, so removing them has no safety benefit — see `audit-product-gap-review.md` §4 item 12. **`KYB_APPROVED` — CODE_REMOVED (same-day follow-up pass):** unlike `TNC_ACCEPTED`/`KYC_APPROVED`, it has zero occurrences in `seed.ts` either, so its label-map/switch-case entries in `organization-activity-timeline.tsx` and its `OnboardingEventType` union member (`packages/types/src/admin.ts`) served no historical-compatibility purpose — removed. `TNC_ACCEPTED`/`KYC_APPROVED` are unaffected and remain for that reason. Status stays `DEAD` (no schema/enum change). See `audit-product-gap-review.md` §4 item 13.

**Unreachable (writer exists, zero UI callers):** `AML_APPROVED` — **reclassified 2026-08-24** from ENOUGH/LIVE after re-tracing `approveAmlScreening`'s route/service/SDK/hook chain and confirming no `.tsx` component calls `useApproveAmlScreening`. Not merged into the "Dead" list above because it has a fully wired backend path (route → service → DB write) and could become reachable with a single UI change — it is dormant manual-override plumbing, not an abandoned enum. Do not treat it as a second live AML mechanism alongside `ONBOARDING_STATUS_UPDATED` + `amlApproved:true`.

### 1.4 Presentation notes (Access/Security/Onboarding)

- ~~Admin Access-log filter (`access-logs-panel.tsx`) lists `KYC_STATUS_UPDATED` (never written) but omits live `ROLE_ADDED`, `ROLE_REMOVED`, `PROFILE_UPDATED`, `ONBOARDING_RESET` — **VISIBILITY_MISMATCH**.~~ **RESOLVED (2026-08-24):** BEFORE — `ACCESS_EVENT_TYPES` (moved from the panel into `use-access-logs.ts` and exported for testability) included the never-written `KYC_STATUS_UPDATED` and omitted four writers that had a production writer function. DECISION — approved cleanup; verified writers existed by tracing every `createAccessLogRow` call site in `admin/service.ts` and `auth/service.ts`. AFTER — `ACCESS_EVENT_TYPES` is now `["LOGIN","LOGOUT","SIGNUP","ROLE_ADDED","ROLE_REMOVED","PROFILE_UPDATED","ONBOARDING_RESET"]`; the `EventType` union in `packages/types/src/admin.ts` gained `"ROLE_REMOVED"` / `"ONBOARDING_RESET"` (previously typed but not selectable). Query/filter only — no enum removal, no writer change. **FOLLOW-UP TRACE (2026-08-25):** re-tracing from `AdminService.updateUserRoles` and `AdminService.resetOnboarding` per explicit request found that `ROLE_ADDED`, `ROLE_REMOVED`, and `ONBOARDING_RESET` are **backend/API reachable but currently unreachable from the Admin UI** (writer + route exist; `ROLE_ADDED`/`ROLE_REMOVED` also have an unused SDK+hook; `ONBOARDING_RESET` has neither) — they were not, in fact, normal live UI business actions at the time of the original fix. Only `PROFILE_UPDATED` is genuinely UI-reachable (`useUpdateUserProfile` → `user-account-profile-panel.tsx`). **This does not reopen the filter fix as a defect** — the query allowlist correctly includes every event type with a real writer so no stored/API-created row is silently hidden; only the "live" characterization of three of the four values was corrected. See §1.1 above and `audit-event-surface-matrix.md` §9 #12.
- ~~Admin Security-log filter shows 5 types; `ROLE_CREATED`, `ROLE_REMOVED`, `ROLE_PERMISSIONS_UPDATED`, `INVITATION_REVOKED` stored but not in filter — **VISIBILITY_MISMATCH**.~~ **RESOLVED (2026-08-24):** BEFORE — `SECURITY_EVENT_TYPES` (moved into `use-security-logs.ts`) omitted four live `security_logs` writers. DECISION — approved cleanup. AFTER — `SECURITY_EVENT_TYPES` now includes all nine live values. `SecurityEventType` in `packages/types/src/admin.ts` gained the four missing members. Confirmed `security_logs.ROLE_REMOVED` (admin role-catalogue deletion) was **not** merged with `access_logs.ROLE_REMOVED` (user role removal) — both remain distinct, same-string-different-table events per §1.1/§1.2 above.
- Portal onboarding presentation (`organization-log.ts`) maps both `ONBOARDING_APPROVED` and `FINAL_APPROVAL_COMPLETED` to the same title "Onboarding Approved" — **MISLEADING** (admin panel keeps them distinct).
- ~~`COD_REJECTED` is excluded from the `OrganizationLogAdapter` allowlist → **hidden from issuer/investor Activity** even though the `ONBOARDING_REJECTED` notification is sent for the same rejection — **VISIBILITY_MISMATCH**.~~ **RESOLVED (2026-08-24):** BEFORE — `OrganizationLogAdapter.getEventTypes()` omitted `COD_REJECTED`. DECISION — approved cleanup item; the affected user already receives an `onboarding_rejected` notification for this exact outcome, so their own Activity history should retain it too. AFTER — `COD_REJECTED` added to `getEventTypes()` with `buildPresentation()` copy "Onboarding Rejected" / "Your organization onboarding was rejected." (no raw webhook/provider fields exposed; matches the canonical onboarding-rejection wording in `activity-notification-copy-standard.md`).
- ~~`COD_REJECTED` is also excluded from the **Admin** organization-detail Activity query allowlist (`use-organization-logs.ts`'s `ONBOARDING_EVENT_TYPES`), separately from the issuer/investor-facing gap above → hidden from Admin org-detail Activity **and** its CSV export, even though it's in the raw onboarding export — **VISIBILITY_MISMATCH**.~~ **RESOLVED (2026-08-24):** BEFORE — `ONBOARDING_EVENT_TYPES` (the admin org-detail query allowlist, distinct from the portal-facing `OrganizationLogAdapter` above) did not include `COD_REJECTED`. DECISION — approved cleanup; admin's own org-detail view should show the same rejection event the affected issuer/investor can already see. AFTER — `COD_REJECTED` added to `ONBOARDING_EVENT_TYPES`, with the existing `"Onboarding Rejected"` label added to `organization-activity-timeline.tsx`'s `EVENT_LABELS` map; the org-detail CSV export shares the same query path and now includes it too. No notification or workflow change.
- ~~`TNC_ACCEPTED`, `KYC_APPROVED`, `KYB_APPROVED` still appear in the admin org-log filter dropdown despite being dead — **VISIBILITY_MISMATCH**.~~ **RESOLVED (2026-08-24):** BEFORE — `apps/admin/src/hooks/use-organization-logs.ts`'s `ONBOARDING_EVENT_TYPES` query-inclusion array listed all three. DECISION — approved cleanup; reconfirmed against the current production-writer inventory that none of the three is ever written as an `event_type` in production. AFTER — the three entries were removed from the array only; the enum values and any historical `onboarding_logs` rows are untouched. **Correction (2026-08-25):** "only in `apps/api/prisma/seed.ts` dev fixtures" is only true for `TNC_ACCEPTED`/`KYC_APPROVED` — `KYB_APPROVED` has zero occurrences in `seed.ts` either, so no `onboarding_logs` row (dev or prod) is expected to carry that value; see §1.1 above.
- ~~Issuer/investor portal copy for `ONBOARDING_CANCELLED` reads "Your organization onboarding was cancelled and will not continue," implying permanent termination — **MISLEADING**. The actual business action is: an admin restarts onboarding by cancelling the previous RegTank request and issuing a new one.~~ **RESOLVED (2026-08-24):** BEFORE — `organization-log.ts`'s `ONBOARDING_CANCELLED` case produced the permanent-termination wording above. DECISION — approved cleanup; the stored `event_type` name (`ONBOARDING_CANCELLED`) stays as-is (it is historically/forensically accurate — the prior request *is* cancelled), but the user-facing copy should describe what actually happens next. AFTER — title changed to `"Onboarding Restarted"`, description to `"Your previous onboarding request was cancelled and a new onboarding request has been started."` Applied consistently to both issuer and investor portals via the shared `OrganizationLogAdapter`. No change to the stored `event_type`, trigger, workflow, or notification behavior; Admin's own forensic wording is untouched.

---

## 2. Application (`application_logs`, `application_review_events`)

### 2.1 Application lifecycle

| Event | Business action | Trigger | Actor | Stored evidence | Assessment |
|---|---|---|---|---|---|
| `APPLICATION_CREATED` | Issuer starts draft | `POST /v1/applications` | Issuer | `reviewCycle`, `portal`, IP/UA | ENOUGH |
| `APPLICATION_SUBMITTED` | Issuer submits | `PATCH .../status` → `SUBMITTED` | Issuer | `reviewCycle`, IP/UA | ENOUGH (no remark). Notification (2026-08-25): `application_submitted_confirmation` |
| `APPLICATION_RESUBMITTED` | Issuer resubmits after amendments | `amendments/service.ts:resubmitApplication` (rich); duplicate path via bare `PATCH` status=`RESUBMITTED` (no metadata) | Issuer | `metadata.resubmit_changes.activity_summary`, `amendment_remarks[]`, `reviewCycle` | PARTIAL (duplicate path lacks metadata). **RESOLVED (2026-08-24):** BEFORE — the bare-PATCH path's log row had no `activity`, so `admin-activity-timeline.tsx` / issuer widgets rendered no description at all. DECISION — approved cleanup; the bare path is the same business action (a resubmission), just without amendment-diff evidence, so it should get a simple accurate description, not invented amendment data. AFTER — `applications/service.ts:getApplicationLogs` now falls back to `"Application resubmitted for review"` only when `resubmit_changes.activity_summary` is absent; the rich `amendments/service.ts` metadata and its `activity_summary` are read and rendered unchanged when present. |
| `APPLICATION_REJECTED` | Admin rejects application (overall/final rejection) | `admin/service.ts:updateApplicationStatus` (~6543) | Admin | `portal`, IP/UA/device — no `remark` | **ENOUGH_FOR_CURRENT_FLOW** (reclassified 2026-08-25, was "ENOUGH (no rejection reason stored on the log)"). Traced end-to-end: the current overall-rejection Admin UI is a plain confirm dialog with no reason input; `updateApplicationStatusSchema` accepts only `{status}`; the service method has no reason parameter. `application_logs.remark` is `null` here because **no reason exists upstream to store** — not because the writer drops available data. This is a **different flow** from `SECTION_REVIEWED_REJECTED`/`ITEM_REVIEWED_REJECTED` (§2.2 below), which already require and immutably store a remark. A future product enhancement could add a required/optional reason to the overall-rejection UI; if it does, this same `remark` column and writer already support snapshotting it with no schema change — see `audit-product-gap-review.md` §6 item 3 |
| `APPLICATION_RESET_TO_UNDER_REVIEW` | Admin reopens review | `admin/service.ts` | Admin | `metadata.previous_status` | ENOUGH |
| `APPLICATION_WITHDRAWN` | Issuer withdraws | `applications/service.ts:cancelApplication`; `contracts/service.ts`; `invoices/service.ts` | Issuer | `metadata.withdraw_reason` | ENOUGH |
| `APPLICATION_COMPLETED` | Application reaches terminal complete | Post contract/invoice offer accept, incl. via signing finalize | Issuer | `portal` | ENOUGH |

**Dead:** `APPLICATION_APPROVED` (enum + UI/formatters only, zero writers — completion is signaled via `APPLICATION_COMPLETED` instead), `CONTRACT_OFFER_REJECTED` (enum + label-only, zero writers — issuer decline writes `CONTRACT_WITHDRAWN` instead; see §2.3). **Both re-investigated 2026-08-25** for the dead/seed-only cleanup pass and **retained, not removed**: `apps/api/src/lib/audit/preservation.test.ts` ("keeps at least a source reference for every application log event that had one") explicitly requires a string reference to survive in `apps/api/src` for both, and its own comment records this as an intentional prior design decision, not an oversight — removing the reference would fail that test. See `audit-product-gap-review.md` §4 item 12. **Same-day follow-up pass (2026-08-25):** for `CONTRACT_OFFER_REJECTED`, confirmed `event_type` is a plain `String`/TEXT column and this value had a real production writer before the live decline path was renamed to `CONTRACT_WITHDRAWN`, so historical rows may reasonably exist — reclassified **`HISTORICAL_COMPATIBILITY_ONLY`**; display maps and the API `getEventTypes()` allowlist stay as-is (removing from the allowlist would hide any such historical row from the activity feed). For `APPLICATION_APPROVED`, confirmed this DB event's DEAD status is independent of an **ACTIVE, unrelated synthetic display alias**: `apps/issuer/src/components/financing/facility-transactions.ts` synthesizes a display-only row with `eventType: "APPLICATION_APPROVED"` for approved invoices (client-side, not a DB write) — that alias was not touched. See `audit-product-gap-review.md` §4 item 13.

### 2.2 Review events

| Event | Trigger | Actor | Stored evidence | Assessment |
|---|---|---|---|---|
| `SECTION_REVIEWED_{APPROVED,REJECTED,AMENDMENT_REQUESTED,PENDING}` | `admin/service.ts:logReviewActivity` | Admin | Top-level `remark`; `metadata.{scope,scope_key,old_status,new_status}` | ENOUGH |
| `ITEM_REVIEWED_{APPROVED,REJECTED,AMENDMENT_REQUESTED,PENDING}` | Same helper, item scope | Admin | Same shape, `entityId`=item scope key | ENOUGH |
| `SECTION_REVIEWED_PENDING` (CTOS reset) | `ctos-report-service.ts` | `userId:"system"` | `remark`, `metadata.scope_key` | ENOUGH |
| `AMENDMENTS_SUBMITTED` | `admin/service.ts:submitPendingAmendments` | Admin | `remark:"${n} amendment(s) sent to issuer"`, `metadata.count` | ENOUGH |

### 2.3 Contract offer / acceptance

| Event | Trigger | Actor | Stored evidence | Assessment |
|---|---|---|---|---|
| `CONTRACT_OFFER_SENT` | `admin/service.ts:sendContractOffer` | Admin | `contract_id`, `contract_number`, facility amounts, `acceptance_expires_at` | ENOUGH |
| `CONTRACT_OFFER_ACCEPTANCE_SUBMITTED` / `_RESUBMITTED` | `applications/service.ts:submitContractOfferAcceptance` | Issuer | `offer_acceptance_status`, `submitted_at` | ENOUGH |
| `CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING` | Auto (issuer submit on auto-approve product) or admin (`admin/service.ts` after doc review) | Issuer/Admin | `contract_id`, optional `auto_approved` | ENOUGH; DUPLICATE_BUT_INTENTIONAL |
| `CONTRACT_OFFER_ACCEPTED` | `respondToContractOffer` accept; or signing-completion finalize path | Issuer | `offered_facility`, `requested_facility`, `responded_at` | ENOUGH |
| `CONTRACT_WITHDRAWN` | `respondToContractOffer` **reject** (not `CONTRACT_OFFER_REJECTED`) | Issuer | `rejection_reason` when provided | ENOUGH (event naming is misleading — see gap review) |
| `CONTRACT_OFFER_RETRACTED` | Admin retracts live offer on section reset | Admin | `contract_id`, `contract_number` | ENOUGH |
| `CONTRACT_OFFER_EXPIRED` | `acceptance-signing-expiry.ts:expireOffer` | System | `trigger`, `offer_kind`, `contract_id` | ENOUGH |
| `CONTRACT_SIGNING_DEADLINE_EXTENDED` | `admin/service.ts:extendContractSigningDeadline` | Admin | `signing_expires_at` | ENOUGH |
| `CONTRACT_FACILITY_OCCUPANCY_UPDATED` | `refresh-contract-facility.ts` | Varies | **`remark`** from `occupancyRemark()`; rich before/after | ENOUGH |
| `CONTRACT_FACILITY_FEE_WAIVED` | `admin/service.ts` | Admin | `waived_amount`, `reason` | ENOUGH |
| `CONTRACT_FACILITY_ENABLED` / `DISABLED` | `admin/service.ts` | Admin | `enabled`, optional `reason` | ENOUGH |
| `CONTRACT_CUSTOMER_LARGE_PRIVATE_UPDATED` | `admin/service.ts` | Admin | `is_large_private_company` | ENOUGH |

**Dead:** `CONTRACT_OFFER_REJECTED` (enum + formatters only; contract rejection actually writes `CONTRACT_WITHDRAWN`).

### 2.4 Invoice offer / acceptance (parallels contract)

`INVOICE_OFFER_SENT`, `INVOICE_OFFER_ACCEPTANCE_SUBMITTED`/`_RESUBMITTED`, `INVOICE_ACCEPTANCE_APPROVED_FOR_SIGNING`, `INVOICE_OFFER_ACCEPTED`, `INVOICE_OFFER_REJECTED` (correctly named, unlike contract), `INVOICE_OFFER_RETRACTED`, `INVOICE_OFFER_EXPIRED`, `INVOICE_SIGNING_DEADLINE_EXTENDED`, `INVOICE_WITHDRAWN` — all ENOUGH, same trigger pattern as §2.3.

### 2.5 `application_review_events` (in-transaction duplicate copies)

`CONTRACT_OFFER_SENT`, `INVOICE_OFFER_SENT`, `AMENDMENTS_SUBMITTED` are written a second time into this table with `scope_key`/`old_status`/`new_status`. **This table has no production reader**: `getApplicationById` does not include it, and `RecentActivityCard` ignores the `events` prop when an `applicationId` is present (renders `AdminActivityTimeline` off `application_logs` only instead). Confirmed via `rg` for `applicationReviewEvent.` outside `review-events.ts` — **zero matches** anywhere (API or admin app).

**Classification: `INTENTIONAL_FORENSIC_ONLY`** (re-verified 2026-08-24). The writer module's own header comment states the design intent directly: rows are "kept as a forensic, in-transaction mirror of the corresponding `application_logs` row... in case a reader is added later," always written inside the same transaction as the state change (`applications/logs/review-events.ts:1-13`). This is not an accidental duplicate or an abandoned table — it is a deliberate append-only forensic copy, written transactionally alongside the primary write, that happens to have no current reader. No UI exposure is recommended without a separate, explicit product decision (per this pass's non-goals).

### 2.6 Presentation notes (Application)

- Investor portal has **zero** application-log visibility by design (`ApplicationLogAdapter.getScopedApplicationIds` returns `["__none__"]` for investor).
- `CONTRACT_WITHDRAWN` is labeled **"Facility Offer Withdrawn"** in the admin timeline for both admin retractions and issuer rejections — **MISLEADING** (an issuer rejecting an offer is not "withdrawn").
- `AMENDMENTS_SUBMITTED` issuer-detail label is **"You submitted requested changes"**, but the writer is the *admin* sending amendments *to* the issuer — **MISLEADING** (backwards direction). **RESOLVED** in the prior copy-consistency pass — relabeled to "Changes requested" in both `application-timeline.ts` and `facility-transactions.ts`.
- Issuer timeline `EVENT_LABELS` map still references dead `OFFER_EXPIRED` / `CONTRACT_OFFER_REJECTED` instead of live `CONTRACT_OFFER_EXPIRED` / `CONTRACT_WITHDRAWN` — those milestones fall through to a generic label or are missing entirely — **VISIBILITY_MISMATCH** / **GENERIC_FALLBACK**.
- ~~`APPLICATION_RESET_TO_UNDER_REVIEW`, offer-acceptance-submitted events, and `CONTRACT_SIGNING_DEADLINE_EXTENDED` are visible in the admin/CSV surface but hidden from the issuer Activity feed — **VISIBILITY_MISMATCH**.~~ **RESOLVED (2026-08-24)** for the offer-acceptance-submitted/resubmitted, offer-expired, and signing-deadline-extended events (both `CONTRACT_*` and `INVOICE_*`): BEFORE — `application-timeline.ts`'s `EVENT_LABELS` (per-application widget) had none of these 8 keys, so those log rows never rendered; `facility-transactions.ts` (facility widget) already had 6 of the 8 but was missing `CONTRACT_SIGNING_DEADLINE_EXTENDED` / `INVOICE_SIGNING_DEADLINE_EXTENDED`. DECISION — approved cleanup; these are already-live, meaningful issuer-facing milestones (already visible on the general Activity feed's `ApplicationLogAdapter.getEventTypes()` allowlist) and should also be visible on the specific financing/application history. AFTER — both label maps now include all 8 keys with copy matching the canonical terminology ("Facility/Invoice acceptance submitted/resubmitted", "Facility/Invoice offer expired", "Signing deadline extended"); `CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING` / `INVOICE_ACCEPTANCE_APPROVED_FOR_SIGNING` remain intentionally absent from both issuer-facing maps (admin-only gate, unchanged). `APPLICATION_RESET_TO_UNDER_REVIEW` was already present in `application-timeline.ts`'s label map prior to this change and remains out of scope for `facility-transactions.ts` (not in the approved list).
- CSV: `remark = log.remark ?? formatActivityText(log.activity) ?? ""`; `SIGNING_PACKAGE_COMPLETED` is hidden in the UI timeline but **is** included in CSV export.

### 2.7 Notifications (Application domain)

| Type ID | Sent? | Recipient | Trigger | Classification |
|---|---|---|---|---|
| `application_amendments_requested` | Yes | Issuer owner + org admins | `submitPendingAmendments` | COVERED |
| `acceptance_document_changes_requested` | Yes (platform-only) | Issuer owner + org admins | Doc review → `CHANGES_REQUESTED` | COVERED |
| `application_approved` | **No** — registry only | — | — | DEAD (no `APPLICATION_APPROVED` log writer either; `application_completed` is the terminal signal) |
| `application_rejected` | Yes | Issuer | `updateApplicationStatus(REJECTED)` | COVERED |
| `contract_offer_sent` / `invoice_offer_sent` | Yes | Issuer | Offer sent | COVERED |
| `offer_retracted_or_reset` | Yes | Issuer | Section/item reset retracts live offer | COVERED |
| `offer_expired` | Yes | Issuer | Expiry job | COVERED (invoice rows omit `invoiceNumber` in payload) |
| `offer_expiry_reminder_24h` | Yes | Issuer | Expiry job, per configured `days_before_expiry` | COVERED for both contract and invoice offers; name says "24H" but supports arbitrary day offsets |
| `application_resubmitted_confirmation` | Yes | Issuer | `resubmitApplication` (amendment path only) | COVERED — **not** sent on the bare `PATCH` resubmit path |
| `application_withdrawn_confirmation` | Yes | Issuer | Withdraw flows | COVERED |
| `application_completed` | Yes | Issuer | Terminal completion (incl. via signing finalize) | COVERED |

**Deadline defaults:** acceptance = 7 days / 1 reminder at day 6; signing = 14 days / reminders at day 11 and day 13 (see §5 compliance findings in the gap review for the mismatch against required day 3/6 and day 7/12 cadence).

---

## 3. Note / Payment / Gateway (`note_events`, `note_admin_actions`, `gateway_payment_events`)

### 3.1 `note_events` (41 live)

| Event | Business action | Trigger | Actor | Stored evidence | Assessment |
|---|---|---|---|---|---|
| `NOTE_CREATED_FROM_INVOICE` | Note created from approved invoice | `createFromInvoiceSource` | Admin | `applicationId`, `invoiceId`, IP/UA/correlation | ENOUGH |
| `UPDATE_DRAFT` | Draft terms edited | `updateDraft` | Admin | before/after state | ENOUGH |
| `UPDATE_FEATURED_SETTINGS` | Featured flag/window changed | `updateFeaturedSettings` | Admin | before/after | ENOUGH |
| `PUBLISH` / `UNPUBLISH` | Note listed/removed from marketplace | `publish` / `unpublish` | Admin | before/after | ENOUGH |
| `PAUSE_LISTING` / `RESUME_LISTING` | Campaign paused/resumed | Same pattern | Admin | before/after | ENOUGH |
| `INVESTMENT_COMMITTED` | Investor commits | `commitInvestment` | Investor | `investorOrganizationId`, `amount`, `prospectusPublicationId`, `prospectusAcknowledgedAt` | ENOUGH |
| `CLOSE_FUNDING` | Funding closed (≥ minimum %) | `closeFunding` / cron | Admin/SYS | before/after | ENOUGH |
| `FAIL_FUNDING` | Funding failed (< minimum %) | `failFunding` / cron | Admin/SYS | before/after | ENOUGH |
| `ACTIVATE` | Note servicing starts | `activate` | Admin | before/after | ENOUGH |
| `NOTE_DEFAULT_MARKED` | Default declared | `markDefaulted` | Admin | `reason` | PARTIAL (reason only) |
| `NOTE_FACILITY_FEE_COLLECTION_WAIVED` | Facility fee waiver | `waiveFacilityFeeCollection` | Admin | Waiver metadata | ENOUGH |
| `ISSUER_DISBURSEMENT_WITHDRAWAL_CREATED` | Auto disbursement instruction | `closeFunding` | Admin | `netDisbursement`, `fundedAmount`, `platformFee`, fees | ENOUGH |
| `ISSUER_PAYMENT_SUBMITTED` | Issuer-submitted repayment pending review | `recordPayment` | Issuer/Admin | Payment fields | ENOUGH |
| `PAYMENT_RECEIVED` | Repayment recorded | `recordPayment` / `approvePayment` | Admin | Payment fields, `paymentId` | ENOUGH |
| `PAYMENT_APPROVED` / `PAYMENT_REJECTED` | Pending payment reviewed | `approvePayment` / `rejectPayment` | Admin | `paymentId` / rejection reason | ENOUGH |
| `SETTLEMENT_PREVIEWED` / `SETTLEMENT_APPROVED` / `SETTLEMENT_POSTED` | Settlement lifecycle | `previewSettlement` → `approveSettlement` → `postSettlement` | Admin | Settlement calc snapshot, waterfall amounts | ENOUGH |
| `OVERDUE_LATE_CHARGE_CHECKED` | Overdue check run | `checkOverdueLateCharges` | Admin/Cron | `dueDate`, `overdue`, `daysLate` | ENOUGH |
| `LATE_CHARGE_APPROVED` | Late charge approved | `approveLateCharge` | Admin | Charge breakdown | ENOUGH |
| `ARREARS_LETTER_GENERATED` / `DEFAULT_LETTER_GENERATED` | Letter PDF generated | `generateLetter` | Admin | `s3Key` | ENOUGH |
| `SETTLEMENT_TRUSTEE_LETTER_GENERATED` / `SETTLEMENT_TRUSTEE_EMAIL_SENT` / `SETTLEMENT_TRUSTEE_LETTER_SUBMITTED` / `SETTLEMENT_TRUSTEE_INSTRUCTION_COMPLETED` | Trustee letter + operational email lifecycle | `generateSettlementTrusteeLetter` / `resendSettlementTrusteeEmail` / `markSettlementTrusteeLetterSubmitted` / `markSettlementTrusteeInstructionCompleted` | Admin | `s3Key`, settlement id, `settlementReference` (email new writes), SES `messageId`, `resend` | ENOUGH. Live IDs are `SETTLEMENT_TRUSTEE_*`. Historical rows may still store `SERVICE_FEE_TRUSTEE_*`. Prisma/HTTP still use legacy `service_fee_trustee_*` / `/service-fee/` names. |
| `WITHDRAWAL_LETTER_GENERATED` / `_TRUSTEE_EMAIL_SENT` / `_SUBMITTED_TO_TRUSTEE` / `_BENEFICIARY_UPDATED` / `_COMPLETED` | Issuer withdrawal lifecycle | Admin service methods | Admin | `withdrawalId`, `withdrawalReference` (email new writes + submit), SES `messageId`, `resend`, beneficiary snapshot, amounts | ENOUGH. Email historical rows may omit `withdrawalReference`. |
| `PROSPECTUS_REVIEW_CREATE` / `_DRAFT_UPDATE` / `_APPROVE` | Prospectus review lifecycle | `prospectus-review.service.ts` | Admin | before/after review state, frozen snapshot refs | ENOUGH |
| `PROSPECTUS_APPROVAL_INVALIDATED_*` (×3) | Approval cleared (unpublish / source change / edit) | Same service | Admin | before/after | ENOUGH |
| `SHORAKA_ORDER_SUBMITTED` / `SHORAKA_CERTIFICATE_FETCHED` | Tawarruq commodity trade | `shoraka-stp-service.ts` | Admin/System | `provider_order_id`, amounts, dates, certificate SHA256 | ENOUGH |
| `FACILITY_OCCUPANCY_UPDATED` | Facility capacity updated | `refresh-contract-facility.ts` | Internal | Utilized/available/repaid, `reason` | ENOUGH |

~~**Dead:** `ISSUER_RESIDUAL_WITHDRAWAL_CREATED` (referenced only in a sort-order helper, never written).~~ **REMOVED (2026-08-25 cleanup pass):** confirmed zero writers anywhere in `apps/api/src`; the sort-order helper (`admin-note-events-sorting.ts`) entry was deleted since it was never looked up (no row can have this `event_type`). No schema change (`event_type` is a plain `String`, not a DB enum) — see `audit-product-gap-review.md` §4 item 12.

### 3.2 `note_admin_actions` (mirror subset)

Every `logAdminAction` / `logProspectusAction` call duplicates into `note_events` **and** this table with `before_state`/`after_state` columns. **No production reader** on `note_admin_actions` — DUPLICATE_BUT_INTENTIONAL, forensic-only.

### 3.3 `gateway_payment_events` (8 live)

| Event | Trigger | Actor | Stored evidence | Assessment |
|---|---|---|---|---|
| `NAME_CHECK` | Deposit name review needed | System | `from_status`/`to_status`, reason | ENOUGH |
| `NAME_CHECK_APPROVED` / `_REJECTED` | Admin reviews name | Admin | Status transition | ENOUGH |
| `CAPTURE_MISMATCH` | Amount/currency mismatch | System/Webhook | `reason`, expected/received metadata | ENOUGH |
| `EXPIRED` | Stuck checkout poller | System | `from_status` CREATED→EXPIRED, reason | ENOUGH |
| `REFUND_INITIATED` / `REFUNDED` | Refund lifecycle | Admin/System | `refund_reference`, amount, provider refs | ENOUGH |
| `REFUND_WALLET_REVERSAL_FAILED` | Wallet debit after refund failed | System | Failure reason | ENOUGH |

**Dead:** `OVERRIDE_PROPOSED` / `OVERRIDE_APPROVED` / `OVERRIDE_REJECTED` (enum only; admin hard-codes the corresponding field to `null`). **Re-investigated 2026-08-25** for the dead/seed-only cleanup pass and **retained, not removed**: confirmed these are real members of the Prisma **enum** `GatewayPaymentEventType` (`schema.prisma:2272-2284`), unlike every other audit table's plain-`String` `event_type` column — removing an enum member is a schema migration, forbidden by that pass's "no destructive database migration" rule. The surviving read path (`getOpenOverrideProposal()`) and copy-only admin labels look like a paused override-workflow feature rather than pure cruft; see `audit-product-gap-review.md` §4 item 12. **Gap (not dead, just absent):** a successful deposit capture does not write a `gateway_payment_events` row at all — evidence lives only in `gateway_payments` status, `investor_balance_transactions`, and `note_ledger_entries`.

**Semantic classification (re-verified 2026-08-24 — `webhook-service.ts`, `deposit-service.ts:creditCompletedDeposit`):** `gateway_payment_events` functions as an **exception/operational log (Classification B)**, not a complete payment lifecycle log. Traced the full happy-path capture call chain — `processInvestorDepositCapture` → name-check `PASS` → `claimCaptureToPaid` → `creditCompletedDeposit` — and confirmed `creditCompletedDeposit` writes `investor_balance_transactions` (via `creditInvestorBalance`), a `note_ledger_entries` posting (via `postLedgerEntry`), and a `gateway_payments` status update, but **never calls `recordGatewayPaymentEvent`**. Every *other* code path that does call it is a deviation from the pure happy path: `NAME_CHECK`/`_APPROVED`/`_REJECTED` (auto-match failed, needs admin review), `CAPTURE_MISMATCH` (amount/currency mismatch), `EXPIRED` (stuck checkout), `REFUND_INITIATED`/`REFUNDED` (reversal), `REFUND_WALLET_REVERSAL_FAILED` (failure). A future `CAPTURE_SUCCEEDED` event would give a single, complete, self-contained audit trail for the happy path instead of requiring a join across three tables — but this is a **product/compliance decision to make explicitly**, not something to add silently, since it changes what "the" gateway audit trail is expected to contain.

### 3.4 Presentation notes (Note/Payment/Gateway)

- ~~Admin note timeline **and its CSV export are capped at 50 events** (`noteInclude.events: { take: 50 }`) — long-lived notes silently lose history in both UI and export, with no unlimited compliance export path.~~ **RESOLVED (2026-08-24):** BEFORE — `NoteService.listEvents` (backing `GET /v1/admin/notes/:id/events`, the export data source) reused the same `noteInclude.events` relation as the UI timeline, so both were capped at 50. DECISION — approved cleanup; the visible timeline may stay paginated for UI performance, but a compliance/audit export must never silently truncate. AFTER — added `NoteRepository.findAllEventsByNoteId` (no `take` limit, same `orderBy: created_at desc`) and switched `listEvents` to use it; extracted the shared actor-name-resolution/sorting logic into `mapNoteEventRecords` so the capped UI timeline (`mapNoteDetail`) and the uncapped export use identical mapping/ordering. `NoteTimelinePanel`'s export button now calls the existing (previously unused) `getAdminNoteEvents` SDK method via a new `useNoteEventsExport` hook instead of exporting only the 50 rows already loaded for display. UI timeline pagination/cap is unchanged.
- Admin timeline detail renderer caps generic metadata display to 6 fields (`GENERIC_LIMIT = 6`).
- Issuer/investor Activity feeds only show an allowlisted subset of `note_events` (via `NoteLogAdapter`) — payments, settlements, Shoraka, and prospectus events are largely admin-only by design; `PAYMENT_RECEIVED` is intentionally hidden from investors (covered by a dedicated notification instead).
- Investor balance statement CSV (`investor_balance_transactions`) is a separate, consistent export unaffected by the 50-row note-event cap.

### 3.5 Notifications (Note lifecycle)

All note lifecycle notifications use `sendTypedPlatformOnly` (in-app only; email disabled by seed default for note types). Live: `note_published`, `note_funding_succeeded`, `note_funding_failed_issuer`, `note_funding_failed_investor`, `note_active_issuer`, `note_active_investor`, `note_repaid_issuer`, `note_payment_received` (investor-only — issuer is not notified per-payment), `note_payment_rejected` (issuer, 2026-08-25), `note_settlement_posted`, `note_arrears` / `note_arrears_investor`, `note_defaulted` / `note_defaulted_investor`, `withdrawal_submitted_to_trustee`, `withdrawal_completed` (issuer financing disbursement only) — all COVERED.

~~**Dead:** `withdrawal_submitted_to_trustee` — template registered, audit event (`WITHDRAWAL_SUBMITTED_TO_TRUSTEE`) is logged, but there is no `sendTyped` call site, so the notification is never actually delivered.~~ **RESOLVED (2026-08-24):** BEFORE — `notes/service.ts:markWithdrawalSubmitted` wrote the `WITHDRAWAL_SUBMITTED_TO_TRUSTEE` audit event but never called `sendTyped*` for the already-registered `withdrawal_submitted_to_trustee` notification. DECISION — approved cleanup; wire the existing notification to the existing business moment, issuer-only, using the established `sendToIssuerOrg` recipient-resolution helper from `note-lifecycle-notifications.ts` (same pattern as `notifyNotePublished`/`notifyNoteActivated`/etc.). AFTER — added `notifyWithdrawalSubmittedToTrustee()` (issuer-org member fan-out via `sendTypedPlatformOnly`), called from `markWithdrawalSubmitted` immediately after the audit-event write, only when `withdrawal.issuer_organization_id` is present (never for investor withdrawals). No change to channel config, preferences, trustee workflow, withdrawal status, or audit event timing.

---

## 4. Legal Documents / Signing / Compliance Flows

### 4.1 `legal_document_audit_logs` (7 live actions)

| Action | Trigger | Actor | Stored evidence | Assessment |
|---|---|---|---|---|
| `LEGAL_DOCUMENT_CREATED` / `_UPDATED` | Admin creates/updates a document definition | `LegalDocumentService` | Admin | `before_json`/`after_json`, IP | ENOUGH |
| `LEGAL_VERSION_UPLOADED` | New draft version uploaded | Same | Admin | Version, hash, file metadata | ENOUGH |
| `LEGAL_VERSION_FILE_REPLACED` | Draft PDF replaced | Same | Admin | Hash, before/after | ENOUGH |
| `LEGAL_VERSION_PUBLISHED` | Draft published (prior version auto-archived) | Same | Admin | Hash, `reacceptance_required`, auto-archive reason | ENOUGH (no SC-clearance field — see gap review) |
| `LEGAL_VERSION_ARCHIVED` / `_RESTORED` | Manual archive / restore | Same | Admin | Status transition | ENOUGH |

Uses dedicated `actor_name_snapshot` / `actor_email_snapshot` columns (per the standardization work) since these log rows must remain identity-evidence even if the acting admin's account is later modified.

### 4.2 `legal_document_acceptances` (consent evidence, not an event log)

| Business action | Trigger | Stored evidence | Assessment |
|---|---|---|---|
| Document opened | `POST .../open` | `opened_at`, `opened_ip_address`, UA, device, version/hash snapshot | ENOUGH |
| Document accepted | `POST .../accept` after open | `accepted_at`, `accepted_ip_address`, `document_hash`, `acknowledgement_text`, version snapshot | ENOUGH |
| Org T&C flag | `acceptTnc` after all required acceptances | `issuer_organizations.tnc_accepted` + `onboarding_logs.TNC_APPROVED` | PASS_IN_ANOTHER_AUTHORITATIVE_TABLE |

Each required legal document type (Terms, PDPA, Risk Statement, Warning, Issuer Agreement) has its **own** acceptance row — not a single "accept all" — and onboarding step order is Terms/PDPA/Risk/Warning → (company fee) → eKYC verify.

### 4.3 Board Resolution / acceptance-documents flow (generic, not a dedicated table)

| Event | Trigger | Table/log | Actor | Assessment |
|---|---|---|---|---|
| Acceptance docs uploaded | Issuer UI save | `applications.acceptance_documents` (S3 keys in JSON) | Issuer | ENOUGH (file storage, not an audit row) |
| Acceptance submitted / resubmitted | `submitContractOfferAcceptance` etc. | `application_logs` (`CONTRACT_OFFER_ACCEPTANCE_SUBMITTED`/`_RESUBMITTED`) | Issuer | ENOUGH |
| Item approved / rejected | Admin per-item review | `application_review_items.status`, `reviewed_at`, `reviewer_user_id` | Admin | ENOUGH |
| Acceptance approved for signing | All items approved | `offer_acceptance.reviewed_at`/`reviewed_by_user_id` + `application_logs.CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING` | Admin | PARTIAL (log metadata is thin — approver identity lives in the JSON blob, not always in the log's own metadata) |

~~**Dead:** `BOARD_RESOLUTION_UPLOADED` / `BOARD_RESOLUTION_REMOVED` (test-fixture-only strings; no production writer — the generic acceptance-documents pipeline is what's actually used).~~ **CORRECTED (2026-08-24):** neither string exists anywhere in the repository — not in production code and not in any test. They are phantom search-index hits from an unmerged branch (see [`audit-event-surface-matrix.md`](./audit-event-surface-matrix.md) §8.1), so they are not "dead events" in this codebase at all. The substantive point stands: board-resolution handling goes through the generic acceptance-documents pipeline, which has no dedicated event type.

### 4.4 Signing (`SIGNING_PACKAGE_*` in `application_logs`, plus `signing_*` tables)

| Event | Trigger | Assessment |
|---|---|---|
| `SIGNING_PACKAGE_CREATED` | Draft envelope created | ENOUGH (coarse) |
| `SIGNING_PACKAGE_SENT` | All signing emails delivered | ENOUGH |
| `SIGNING_PACKAGE_COMPLETED` | Envelope rollup complete; drives `CONTRACT_OFFER_ACCEPTED`/`APPLICATION_COMPLETED` on phased-signing products | ENOUGH (hidden from UI timeline, included in CSV) |
| `SIGNING_PACKAGE_VOIDED` | Void / decline rollup | ENOUGH |

Fine-grained state lives in `signing_envelopes` / `signing_documents` / `signing_recipients` / `signing_assignments` (`signed_at`, `signed_file_sha256`). Signing itself sends notification via direct email (`sendSigningEmail`), not the `NotificationService` registry.

**SigningCloud evidence inventory (re-verified 2026-08-24, source-only — `signingcloud-adapter.ts`, `signing/repository.ts`, `signing/service.ts`, `schema.prisma`):**

| Evidence field | Support | Detail |
|---|---|---|
| Recipient viewed/opened timestamp | **NOT_SUPPORTED** | `signing_recipients.viewed_at` column exists but has **zero writers** anywhere in the repository |
| Signed timestamp | **SUPPORTED** | `signing_assignments.signed_at` is written by `repository.ts:markAssignmentSigned` when the provider reports a signer as signed |
| Signer identity (name/email) | **SUPPORTED** | `SigningRecipient.name`/`.email` (platform-side) and the provider's `getContractDetails` response (`realname`/`email` fields, parsed in `parseSigningCloudContractDetails`) |
| Signed-document hash | **SUPPORTED** | `signing_documents.signed_file_sha256`, computed locally (`crypto.createHash("sha256")`) over the PDF bytes fetched from the provider — this is a hash of the final signed file, not a provider-issued certificate |
| Signer IP address | **UNKNOWN** (provider capability) | Not present anywhere in `SigningCloudProvider`'s parsed responses (`createDocumentContract`, `startSignerSession`, `fetchSignedDocument`, `getContractDetails`) or in the webhook callback handler, which only carries a `contractnum` reference and triggers a re-query, not a payload with signer metadata. **Do not populate from the envelope-creator's request IP** — that is a different actor and would misattribute the evidence. |
| Signer user-agent / device | **UNKNOWN** (provider capability) | Same as above — not present in any parsed provider response |
| Certificate / audit-trail reference | **NOT_SUPPORTED** | Zero occurrences of "certificate"/"audit trail"/"completion cert" anywhere in `signing/` or `signingcloud/` modules — no such concept is implemented; whether SigningCloud's API offers one is outside this trace |

See the final report's "MISSING_COMPLIANCE_EVIDENCE — signer IP" section for the original finding; the table above supersedes it with the full field-by-field breakdown.

### 4.5 Compliance sequence findings (issuer journey PDF cross-check)

See the gap review for full detail; summarized here for the catalog record:

| Requirement | Code reality |
|---|---|
| PDPA separate tick before eKYC | **Matches** — separate row per document type; step order is terms→fee→verify |
| T&C draft/publish with hash + re-acceptance | **Matches** — no SC-clearance field on publish |
| Risk Statement as an active form | **Does not match** — checkbox + PDF open only, no stored risk-questionnaire payload |
| Warning shown at signup + every new application + permanently visible | **Partially matches** — signup capture only; compact portal footer omits the Warning link; no per-application display log |
| Onboarding fee timing (fee after AML approval) | **Does not match** — company issuer fee is charged before eKYC/AML, not after |
| Guarantor acknowledgment paired with LO issuance | **Does not match** — guarantors are only contacted at the signing phase, not at offer/LO issue |
| Notice of Assignment to paymaster before disbursement | **Does not match** — no such gate exists in code |
| Acceptance reminders at day 3 and day 6 (7-day clock) | **Does not match** — only one reminder, at day 6 |
| Signing reminders at day 7 and day 12 (14-day clock) | **Does not match** — reminders fire at day 11 and day 13 |

---

## 5. Product Logs & System-wide Notification Registry

### 5.1 `product_logs` (5 live events)

| Event | Trigger | Actor | Stored evidence | Assessment |
|---|---|---|---|---|
| `PRODUCT_CREATED` | New product version row | `ProductRepository.create` | Admin | Full workflow snapshot, fees, `product_code`, `version` | ENOUGH |
| `PRODUCT_UPDATED` | Product config/version update | `ProductRepository.update`/`completeCreate` | Admin | Changed fields, workflow snapshot | ENOUGH |
| `PRODUCT_DELETED` | Soft-delete product | `ProductRepository.delete` | Admin | Pre-delete snapshot | ENOUGH |
| `PRODUCT_INACTIVATED` | Manual hide → INACTIVE | `ProductRepository.setInactive` | Admin | `previous_status`, `new_status` | ENOUGH **if reached** — **UNREACHABLE** (zero callers) |
| `PRODUCT_REACTIVATED` | Restore → ACTIVE | `ProductRepository.restoreProduct` | Admin | `previous_status`, `new_status` | ENOUGH **if reached** — **UNREACHABLE** (zero callers) |

~~**Presentation gap:** admin panel badge/filter styles only `PRODUCT_CREATED`/`_UPDATED`/`_DELETED`; `_INACTIVATED`/`_REACTIVATED` fall back to a raw badge — **GENERIC_FALLBACK**.~~ **CORRECTED (2026-08-24):** re-verified — `product-logs-panel.tsx:39-43` gives all **five** types a label and a colour; there is no fallback badge in practice. **The real, more serious finding is the inverse:** `ProductRepository.setInactive` and `ProductRepository.restoreProduct` (the only writers of `PRODUCT_INACTIVATED` / `PRODUCT_REACTIVATED`) have **zero callers anywhere in the repository** — no route, no admin UI action, no other status-change mechanism. The admin panel's filter dropdown and colour-coded badge therefore offer two options that can never return a row. There is also no other place in the Admin UI that lets an admin activate/deactivate a product — the only other product-status writer is `PRODUCT_DELETED` (soft delete), a different action. Classified **UNREACHABLE**, not a display defect; see `audit-product-gap-review.md` §4 item 10 for the wire-vs-remove-filter product decision (left open — no code change per this pass's scope).

### 5.2 Per-user `Notification` registry (45 type IDs)

**Scope note:** this registry is for **per-user, per-event notifications** (in-app inbox + optional email), driven automatically by business events via `sendTyped`/`sendTypedPlatformOnly`. It is a **separate system** from `notification_logs`, which records only the admin's manual **bulk-broadcast** tool (see the final report's "Notification scope" section). `system_announcement` and `new_product_alert` are the two type IDs that bridge both worlds — see below.

**Live (39 of 45, as of 2026-08-25), grouped by domain** — full trigger/recipient/copy table lives in `audit-event-surface-matrix.md` §3.2:

- **Auth/account:** `password_changed` (live). `login_new_device`, `kyc_approved`, `kyc_rejected` — **DEAD_NOT_CONFIGURABLE**, zero `sendTyped` call sites anywhere in `apps/api/src`.
- **Onboarding:** `onboarding_approved` (fires only on final platform activation, not earlier admin gates), `onboarding_rejected` — both live.
- **Application/offer:** `application_amendments_requested`, `acceptance_document_changes_requested`, `application_rejected`, `contract_offer_sent`, `invoice_offer_sent`, `offer_retracted_or_reset`, `offer_expired`, `offer_expiry_reminder_24h`, `application_resubmitted_confirmation`, `application_withdrawn_confirmation`, `application_completed`, `application_submitted_confirmation`, `contract_signing_deadline_extended`, `invoice_signing_deadline_extended`, `facility_disabled` — all live. `application_approved` — **DEAD_NOT_CONFIGURABLE** (superseded by `application_completed`).

**`kyc_approved` / `kyc_rejected` / `login_new_device` / `application_approved` re-investigated 2026-08-25** for the dead/seed-only cleanup pass and **retained, not removed**: `notification_types` is a real DB table (`schema.prisma:1972-2078`) with `onDelete: Cascade` foreign keys from `notifications` and `user_notification_preferences` (`notification_logs`'s FK has no explicit `onDelete`, i.e. `RESTRICT`) — deleting the row (or the `seed-data.ts`/`registry.ts` entry that keeps it in sync) risks orphaning or cascade-deleting historical notification data, confirming the pre-existing reasoning in `audit-product-gap-review.md` §3. Separately noted (corrected 2026-08-25 — traced `packages/ui/src/components/notification-preferences.tsx:64-66`): none of the four show up in the end-user **Account settings** preferences page, since that page only renders `user_configurable && category === "MARKETING"` and all four are `SYSTEM`/`AUTHENTICATION`. They **did** appear as global platform/email toggles in the **Admin → Settings → Notifications → Configuration** tab (`apps/admin/src/app/settings/notifications/page.tsx:445-449`, which lists every seeded type with `category === "SYSTEM" || "AUTHENTICATION"` regardless of `user_configurable`) — a minor UX inconsistency (an admin-facing toggle for a notification that can never fire) reported 2026-08-25 in this document, then **fixed the same day**: a small client-side exclusion filter now hides these 4 type IDs from that Configuration tab's rendering only (smallest safe fix — Option A from the follow-up pass). `notification_types`/`seed-data.ts`/`registry.ts` rows are untouched (the cascade-FK/historical-data risk above still applies), and the Logs tab's type filter still lists all four for filtering historical sends. Reclassified `DEAD` → `DEAD_NOT_CONFIGURABLE`. See `audit-product-gap-review.md` §4 items 12–13.
- **Director/shareholder:** `director_shareholder_action_required` (issuer, owner-only), `investor_director_shareholder_action_required` (investor, owner-only) — both live; narrower recipient set than application-domain notifications (owner + org admins).
- **Note lifecycle:** `note_published`, `note_funding_succeeded`, `note_funding_failed_issuer`, `note_funding_failed_investor`, `note_active_issuer`, `note_active_investor`, `note_repaid_issuer`, `note_payment_received`, `note_settlement_posted`, `note_arrears`, `note_arrears_investor`, `note_defaulted`, `note_defaulted_investor`, `note_payment_rejected` — all live, all in-app only (email off by seed default).
- **Trustee:** `withdrawal_submitted_to_trustee`, `withdrawal_completed` (issuer financing disbursement only; residual/investor/admin-adjustment stay silent).
- **Investor deposit / gateway:** `deposit_name_check_rejected`, `deposit_refund_initiated`, `deposit_refunded` — live, platform only, gated to `GatewayPaymentPurpose.INVESTOR_DEPOSIT`, recipients = members of the deposit's investor organization (`GatewayPayment` has no depositor user id).
- **Admin-bulk bridge:** `system_announcement`, `new_product_alert` — **DEAD as automatic triggers** (no `sendTyped` call site); both are only ever delivered through the admin's manual `sendBulkNotification` path, which bypasses the registry template entirely and uses admin-supplied title/message.

### 5.3 Recipient-resolution patterns (cross-cutting)

| Pattern | Helper | Recipients |
|---|---|---|
| Issuer application/offer | `getIssuerRecipientUserIdsForApplication` | Org owner + `OWNER`/`ORGANIZATION_ADMIN` members |
| Issuer note lifecycle | `listIssuerOrgMemberUserIds` | Owner + **all** org members |
| Investor note lifecycle | `listInvestorOrgMemberUserIds` | Confirmed investors' orgs → all members |
| Onboarding / auth / final approval | Direct `userId` | Single applicant user |
| Director/shareholder (issuer + investor) | `director-shareholder-notifications.ts` | Org **owner only** |

These three different recipient scopes (owner-only vs owner+admins vs all-members) are each used intentionally within their own domain, but the same organization will receive different notification audiences depending on which domain triggered the event — worth knowing when investigating "why didn't user X get notified."

### 5.4 Channel model

- `sendTyped` → platform + email, gated by `notification_types.enabled_email` and user preferences.
- `sendTypedPlatformOnly` → email hard-disabled (`sendToEmail: false`), used for all note-lifecycle and some application notifications.
- `sendBulkNotification` (admin tool) → explicit `sendToPlatform`/`sendToEmail` chosen per broadcast.
- Email dispatch happens in a separate `try/catch` **after** the DB insert — not wrapped in the same transaction, so a DB-committed notification can still fail to email.

