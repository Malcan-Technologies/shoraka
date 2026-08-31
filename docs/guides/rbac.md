# Admin RBAC AI Context

## 1. Purpose

This document describes the admin portal RBAC implementation. It is the primary reference for AI agents and developers working on admin access control.

Permission keys are dotted strings defined in `packages/types/src/rbac.ts`. The core rules:

- `.view` controls page access, sidebar visibility, direct URL blocking, and data fetch enablement
- `.manage` or an action-specific permission controls mutation actions
- Frontend disables mutation buttons (with tooltip) when permission is missing
- Backend enforces every permission with `requirePermission(...)` and returns 403 on failure
- Super Admin (`SUPER_ADMIN` role key) has full access and bypasses all permission checks

The API is the real security boundary. Frontend gating is for navigation and UX affordances only.

---

## 2. Permission source of truth

**File:** `packages/types/src/rbac.ts`

| Export | Purpose |
|---|---|
| `ADMIN_PERMISSIONS` | Readonly tuple of all 53 valid permission strings. Derive `AdminPermission` from this. |
| `AdminPermission` | TypeScript union type of all permission strings. Used as the type for all permission arguments. |
| `ADMIN_PERMISSION_GROUPS` | Groups permissions by module for the Permission Configuration UI. Every permission must appear in a group. |
| `FULL_ACCESS_ADMIN_ROLE_KEYS` | Currently `[AdminRole.SUPER_ADMIN]`. Roles in this list bypass `requirePermission` checks entirely. |
| `SUPER_ADMIN_ROLE_TEMPLATE` | The system template for the Super Admin role — not editable, gets all permissions. |

### Naming conventions

- Use dotted keys: `module.action` or `module.domain.action`
- Use `settlements.view` for the settlement trustee queue page, not `service_fee.view`
- Use `platform_settings` for admin platform finance settings, not `platform_settings.finance`
- Use `document_management` for Legal Documents and Legal Acceptances admin pages
- Use `disbursements` for issuer payouts / issuer money out
- Use `withdrawals` only if a standalone investor withdrawal admin page exists
- Use `settlements` only if a standalone settlement page exists

---

## 3. Frontend RBAC framework

### Sidebar and route gating

- Sidebar menu items are hidden if the user lacks the required `.view` permission
- Direct URL access is blocked by wrapping the page body with `<RequirePermission permission="..." />`
- While permissions load, `RequirePermission` shows skeleton placeholders
- When access is denied, it renders `AccessDeniedCard` (existing component)

### Data fetch gating

React Query hooks accept an `enabled` flag. Pass `canViewX` to prevent fetching when the user lacks `.view`:

```tsx
const { data } = useNotes({ enabled: canViewNotes });
```

### Read-only vs manage

If the user has `.view` but not `.manage`, the page loads and shows data normally. Only mutation buttons are disabled.

### Disabled button pattern

Keep action buttons visible but disabled with a tooltip:

```tsx
<Button
  disabled={!canManage}
  title={!canManage ? "You do not have permission to perform this action." : undefined}
  onClick={handleAction}
>
  Approve
</Button>
```

For Switch components, wrap in a tooltip since `title` on Switch is not reliable:

```tsx
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <div className={!canManage ? "cursor-not-allowed opacity-60" : ""}>
        <Switch disabled={isPending || !canManage} ... />
      </div>
    </TooltipTrigger>
    {!canManage && <TooltipContent>You do not have permission to perform this action.</TooltipContent>}
  </Tooltip>
</TooltipProvider>
```

### Key frontend files

| File | Role |
|---|---|
| `apps/admin/src/hooks/use-permissions.ts` | `usePermissions()` hook — exposes `can()`, `canAny()`, `isLoading` |
| `apps/admin/src/components/require-permission.tsx` | `<RequirePermission permission="...">` — page-level route guard |
| `apps/admin/src/components/app-sidebar.tsx` | Sidebar — gates all menu items and data fetches by `.view` permissions |

### Hook usage

```tsx
const { can, canAny, isLoading } = usePermissions();

const canViewNotes = can("notes.view");
const canManageNotes = can("notes.manage");
const canCreate = can("notes.create");
```

`SUPER_ADMIN` bypasses `can()` and `canAny()` — always returns true.

### Block a whole page

```tsx
<RequirePermission permission="notes.view">
  <NotesPageContent />
</RequirePermission>
```

### Hide a sidebar item

```tsx
{canViewNotes && <SidebarMenuItem href="/notes">Notes</SidebarMenuItem>}
```

---

## 4. Backend RBAC framework

### Auth flow

1. `requireAuth` verifies the Cognito access token and loads `User` → `Admin` → `AdminRoleConfig`
2. `resolveAdminAccess()` returns the effective `roleKey`, `roleName`, and `permissions`
3. The request receives `req.admin`, `req.adminPermissions`, `req.adminRoleKey`, `req.adminRoleName`
4. `requirePermission(...)` checks `req.adminPermissions` — or bypasses for `FULL_ACCESS_ADMIN_ROLE_KEYS`
5. Returns 403 `FORBIDDEN` if permission is not present

### Middleware

```ts
// Single required permission
requirePermission("notes.manage")

// Any one of several permissions
requireAnyPermission("applications.view", "applications.manage")
```

### Base router gates

It is acceptable for a sub-router to use `.use(requireRole(UserRole.ADMIN))` as a first-layer guard, **only if every individual child route also has its own `requirePermission(...)` guard**. Do not rely on the base gate alone.

Example:

```ts
adminNotesRouter.use(requireRole(UserRole.ADMIN)); // first-layer gate
adminNotesRouter.get("/", requirePermission("notes.view"), handler);
adminNotesRouter.post("/", requirePermission("notes.create"), handler);
```

### Backend controller files

| File | Covers |
|---|---|
| `apps/api/src/lib/auth/middleware.ts` | `requireAuth`, `requireRole`, `requirePermission`, `requireAnyPermission`, `hasPermission` |
| `apps/api/src/lib/auth/rbac.ts` | `resolveAdminAccess()` — loads permissions from DB |
| `apps/api/src/modules/admin/controller.ts` | Dashboard, User Accounts, Issuers, Investors, Roles, Audit, Onboarding, Applications, Facilities |
| `apps/api/src/modules/notes/controller.ts` | Notes, Bucket Balances, Repayments, Platform Finance Settings, Investments, Disbursements |
| `apps/api/src/modules/notification/controller.ts` | Notifications |
| `apps/api/src/modules/legal-documents/admin-controller.ts` | Legal Documents management |
| `apps/api/src/modules/legal-documents/acceptance-admin-controller.ts` | Legal Acceptances reporting |
| `apps/api/src/modules/products/controller.ts` | Product Settings |
| `apps/api/src/modules/products/log/controller.ts` | Product audit logs |
| `apps/api/src/modules/products/upload/controller.ts` | Product uploads |
| `apps/api/src/modules/auth/controller.ts` | `POST /auth/admin/create-user` → `roles.manage` |

---

## 5. Permission mapping table

### Dashboard

| | |
|---|---|
| View permission | `dashboard.view` |
| Widget-level | `dashboard.finance.view`, `dashboard.operations.view`, `dashboard.platform.view` |
| Backend | `GET /v1/admin/dashboard/stats` → `dashboard.view` |
| Frontend page | `apps/admin/src/app/page.tsx` (root `page.tsx`, not `app/dashboard/`) |
| Notes | Widget visibility gated by widget-specific permissions on frontend only; single stats endpoint uses `dashboard.view` |

### Notes

| | |
|---|---|
| View | `notes.view` |
| Create note | `notes.create` |
| Manage (featured toggle, lifecycle actions) | `notes.manage` |
| Repayment actions | `notes.repayment.manage` |
| Settlement actions | `notes.settlement.manage` |
| Disbursement / issuer payout actions | `notes.disbursement.manage` |
| Default actions | `notes.default.manage` |
| Backend | `apps/api/src/modules/notes/controller.ts` |
| Frontend pages | `apps/admin/src/app/notes/page.tsx`, `apps/admin/src/app/notes/[id]/page.tsx` |

### Applications

| | |
|---|---|
| View + comments + signed offer letter PDFs | `applications.view` |
| Status change | `applications.manage` |
| Financial section | `applications.financial.manage` |
| Company section | `applications.company.manage` |
| Business & Guarantor section | `applications.business_guarantor.manage` |
| Supporting Documents section | `applications.documents.manage` |
| Contract section | `applications.contract.manage` |
| Invoice section | `applications.invoice.manage` |
| Backend | `apps/api/src/modules/admin/controller.ts` |
| Frontend pages | `apps/admin/src/app/applications/`, `apps/admin/src/app/applications/[productKey]/[id]/page.tsx` |

Section mapping (`SECTION_PERMISSION_MAP` in the detail page):

```
financial             → applications.financial.manage
company_details       → applications.company.manage
business_details      → applications.business_guarantor.manage
supporting_documents  → applications.documents.manage
contract_details      → applications.contract.manage
invoice_details       → applications.invoice.manage
```

Application comments (both view and add) use `applications.view` only. Do not gate comments behind section manage permissions.

Signed contract/invoice offer letter PDFs (`GET .../offers/.../signed-letter`) also use `applications.view` only. Section `.manage` permissions remain for offer mutations (send, extend deadline, etc.).

### Onboarding

| | |
|---|---|
| View | `onboarding.view` |
| Mutations | `onboarding.manage` |
| Backend | `apps/api/src/modules/admin/controller.ts` |
| Frontend page | `apps/admin/src/app/onboarding-approval/page.tsx` |

### User Accounts

| | |
|---|---|
| View | `users.view` |
| Mutations | `users.manage` |
| Backend | `apps/api/src/modules/admin/controller.ts` |
| Frontend pages | `apps/admin/src/app/accounts/page.tsx`, `apps/admin/src/app/accounts/[id]/page.tsx` |

### Issuers & Investors

| | |
|---|---|
| View | `organizations.view` |
| Mutations (sophisticated toggle, CTOS generation) | `organizations.manage` |
| Backend | `apps/api/src/modules/admin/controller.ts` |
| Frontend pages | `apps/admin/src/app/issuers/page.tsx`, `apps/admin/src/app/issuers/[id]/page.tsx`, `apps/admin/src/app/investors/page.tsx`, `apps/admin/src/app/investors/[id]/page.tsx` |

### CTOS / SSM (context-scoped routes)

Shared CTOS services are reused internally, but admin API routes enforce permissions by **surface context**:

| Context | List / view HTML | Fetch / generate |
|---|---|---|
| Onboarding SSM Verification | `onboarding.view` — `/v1/admin/onboarding-applications/:id/ctos-reports` | `onboarding.manage` |
| Organization detail | `organizations.view` — `/v1/admin/organizations/:portal/:id/ctos-reports` | `organizations.manage` |
| Application financial review | `applications.view` — `/v1/admin/applications/:id/ctos-reports` | `applications.financial.manage` |
| Application guarantor CTOS | `applications.view` — `/v1/admin/applications/:id/ctos-subject-reports` | `applications.business_guarantor.manage` |

Do not call organization CTOS routes from onboarding or application review UIs.

### Roles

| | |
|---|---|
| View Roles & Users page | `roles.view` |
| View Permission Configuration page | `roles.view` |
| Mutations (create/edit/delete role, save permissions, invite/deactivate/reactivate users) | `roles.manage` |
| Backend | `apps/api/src/modules/admin/controller.ts`, `apps/api/src/modules/auth/controller.ts` |
| Frontend page | `apps/admin/src/app/settings/roles/page.tsx` |

Do not require `roles.manage` to navigate to or view the Permission Configuration page.

### Notifications

| | |
|---|---|
| View (Configuration, Custom & Groups) | `notifications.view` |
| Mutations (Add Missing Types, toggles, Send Notification, Create/Manage Groups) | `notifications.manage` |
| Backend | `apps/api/src/modules/notification/controller.ts` |
| Frontend page | `apps/admin/src/app/settings/notifications/page.tsx` |
| Delivery evidence | Audit → Notifications (`/audit?tab=notifications`), same `notifications.view` permission |

Do not block any notification tab behind `notifications.manage`.

### Audit Logs

| | |
|---|---|
| Access Logs | `audit.access.view` |
| Security Logs | `audit.security.view` |
| Product Logs | `audit.product.view` |
| Legal Documents | `document_management.view` |
| Legal Acceptances | `document_management.view` |
| External Acceptances | `document_management.view` |
| Notifications | `notifications.view` |
| Backend | `apps/api/src/modules/admin/controller.ts`, product log controller, legal-document controllers, notification controller |
| Frontend page | `apps/admin/src/app/audit/page.tsx` (tabs: Access, Security, Products, Legal Documents, Legal Acceptances, External Acceptances, Notifications) |
| Notes | Audit pages are read-only. Search/filter/export use the same view permission as the source feature. There is no Document Logs tab. Legal Acceptances, External Acceptances, and Notification Logs are evidence views, not configuration. There is no Ops Alerts tab. |

### Legal Documents

| | |
|---|---|
| View | `document_management.view` |
| Mutations (create, upload, replace draft, publish, archive, restore, configuration) | `document_management.manage` |
| Backend | `apps/api/src/modules/legal-documents/admin-controller.ts` |
| Frontend page | `apps/admin/src/app/legal-documents/page.tsx` (`/legal-documents`) |
| Manages | `LegalDocument` definitions; `LegalDocumentVersion` records; draft / published / archived lifecycle; audience; onboarding visibility; public visibility; show-in-account visibility |
| Notes | Application supporting documents and note attachments use parent module permissions (`applications.*` / `notes.*`), not `document_management.*`. |

### Legal Acceptances

| | |
|---|---|
| View (list, detail, export, exact-version download) | `document_management.view` |
| Mutations | None — records are immutable (no update/delete API) |
| Backend | `apps/api/src/modules/legal-documents/acceptance-admin-controller.ts` |
| Frontend page | `apps/admin/src/app/audit/page.tsx` (`/audit?tab=legal-acceptances`); `/legal-document-acceptances` redirects here |
| Shows | Accepted document type; exact version; file hash; organization; accepting user; timestamp; IP; user agent; acknowledgement wording; exact accepted PDF download |
| Notes | Evidence comes from `LegalDocumentAcceptance` only. There is no DocumentLog / SiteDocument audit trail. |

### External Acceptances

| | |
|---|---|
| View (list, detail, export) | `document_management.view` |
| Mutations | None — records are immutable (no update/delete API) |
| Backend | `apps/api/src/modules/legal-documents/external-acceptance-admin-controller.ts` |
| Frontend page | `apps/admin/src/app/audit/page.tsx` (`/audit?tab=external-acceptances`) |
| Shows | Unauthenticated party snapshots (for example guarantors) plus envelope, application, and organisation linkage; search; filters (date, status, document type); CSV export; View details |
| Notes | Evidence comes from `legal_external_acceptances`. Deleting a signing envelope does not cascade-delete this evidence. Not an Activity row. List and export use a masked IC; View details uses the stored IC number. |

### Removed (do not use)

These systems and permissions no longer exist:

- `SiteDocument` / `SiteDocumentType` / site document catalog
- `DocumentLog` / Document Logs admin UI
- Admin page `/documents`
- APIs `/v1/documents`, `/v1/admin/site-documents`, `/v1/admin/document-logs`
- Permission `audit.document.view`

### Investments

| | |
|---|---|
| View | `investments.view` |
| Backend | `apps/api/src/modules/notes/controller.ts` (`adminInvestmentsRouter`) |
| Frontend page | `apps/admin/src/app/investments/page.tsx` |

### Facilities

| | |
|---|---|
| View | `contracts.view` |
| Mutations (resign offer) | `contracts.manage` |
| Backend | `apps/api/src/modules/admin/controller.ts` |
| Frontend pages | `apps/admin/src/app/contracts/page.tsx`, `apps/admin/src/app/contracts/[id]/page.tsx` |
| Notes | Facility tab inside Application Review uses `applications.contract.manage`, not `contracts.manage` |

### Bucket Balances

| | |
|---|---|
| View | `bucket_balances.view` |
| Backend | `apps/api/src/modules/notes/controller.ts` |
| Frontend page | `apps/admin/src/app/finance/buckets/page.tsx` |

### Repayments

| | |
|---|---|
| View | `repayments.view` |
| Backend | `apps/api/src/modules/notes/controller.ts` |
| Frontend page | `apps/admin/src/app/finance/repayments/page.tsx` |
| Notes | Repayment actions inside Note Detail use `notes.repayment.manage` |

### Disbursements / Issuer Payouts

| | |
|---|---|
| View | `disbursements.view` |
| Mutations (generate letter, mark submitted, mark completed, initiate payout, Tawarruq/Shoraka workflow, edit beneficiary) | `notes.disbursement.manage` |
| Backend | `apps/api/src/modules/notes/controller.ts` (`withdrawalsRouter`) |
| Frontend page | `apps/admin/src/app/finance/issuer-payouts/page.tsx` |
| Notes | All withdrawal mutations use `notes.disbursement.manage`. The Issuer Payouts list page itself is read-only and requires only `disbursements.view`. |

### Settlements

| | |
|---|---|
| View | `settlements.view` |
| Backend | `apps/api/src/modules/notes/controller.ts` |
| Frontend page | `apps/admin/src/app/finance/pending-settlement-trustee-letters/page.tsx` |
| Notes | Settlement trustee workflow actions inside Note Detail use `notes.settlement.manage` and `notes.disbursement.manage` |

### Product Settings

| | |
|---|---|
| View | `products.view` |
| Mutations | `products.manage` |
| Backend | `apps/api/src/modules/products/controller.ts` |
| Frontend page | `apps/admin/src/app/settings/products/page.tsx` |

### Platform Finance Settings

| | |
|---|---|
| View | `platform_settings.view` |
| Mutations | `platform_settings.manage` |
| Backend | `apps/api/src/modules/notes/controller.ts` (`platformFinanceSettingsRouter`) |
| Frontend page | `apps/admin/src/app/settings/platform-finance/page.tsx` |

---

## 6. Important special cases

### Dashboard

- Dashboard route is `apps/admin/src/app/page.tsx` — the root `page.tsx`, not `app/dashboard/page.tsx`
- `GET /v1/admin/dashboard/stats` → guarded by `dashboard.view`
- The stats endpoint is not split by widget. Frontend hides widgets using `dashboard.finance.view`, `dashboard.operations.view`, `dashboard.platform.view`
- Dashboard quick action cards follow their target module's `.view` permission

### Applications — comments

```
View section comments  → applications.view
Add section comment    → applications.view
Approve section        → applications.<section>.manage
Reject section         → applications.<section>.manage
Request amendment      → applications.<section>.manage
Reset to pending       → applications.<section>.manage
```

Do not require any section manage permission for comments.

### Roles page

- `/settings/roles` (Roles & Users list): visible and readable with `roles.view`
- `/settings/roles/configuration` (Permission Configuration): visible and readable with `roles.view`
- All mutations (create role, save permissions, invite user, deactivate/reactivate user): require `roles.manage`
- Never gate navigation to the Permission Configuration page behind `roles.manage`

### Notifications page

- The Notification Management page (Configuration, Custom & Groups) is visible with `notifications.view`
- Notification delivery evidence is Audit → Notifications, also `notifications.view`
- Only mutation controls require `notifications.manage`
- Never block entire tabs behind `notifications.manage`

### Legal documents vs documents inside Notes or Applications

Legal Documents and Legal Acceptances use `document_management.view` / `document_management.manage` at:

- `/legal-documents`
- `/audit?tab=legal-acceptances` (`/legal-document-acceptances` redirects here)

Documents inside a Note Detail page follow `notes.view` for read-only viewing, or the relevant `notes.<domain>.manage` if the document action is part of a note workflow.

Documents inside an Application Review section follow `applications.view` for read-only viewing, or `applications.<section>.manage` if the document action is a section workflow step.

Do not use `document_management.*` for Notes or Application Review attachments.

### Settings > General and Settings > Security

`/settings/general` and `/settings/security` are sidebar links that do not yet have backing `page.tsx` files. They are gated behind `platform_settings.view` in the sidebar. When these pages are implemented, use `platform_settings.view` / `platform_settings.manage` unless the feature scope requires a separate permission key.

### RegTank onboarding-settings route

`GET /v1/regtank/admin/onboarding-settings/:formId` uses `requireRole("ADMIN")` only. This route is an internal ops/debug endpoint not used by any admin frontend page. It is outside the RBAC rollout scope.

### Super Admin lockout protection

The system must always have at least one active Super Admin. The following protections are enforced:

| Action | Protection |
|---|---|
| Delete Super Admin role | Backend returns `403` (`"This admin role cannot be deleted"`). Frontend hides/disables delete button for `isSystem` roles. |
| Edit Super Admin permissions | Backend returns `403` (`"System role permissions cannot be edited"`). Frontend sets `isEditable: false` for system roles. |
| Deactivate last active Super Admin | Backend returns `400` (`"At least one active Super Admin must remain…"`). Frontend disables the Deactivate button with tooltip. |
| Change last active Super Admin to another role | Backend returns `400` (`"At least one active Super Admin must remain…"`). Frontend blocks the edit with an error toast. |

**Count logic:** Active Super Admin count is determined by `Admin.role_description === "SUPER_ADMIN"` AND `Admin.status === "ACTIVE"`. Pending invitations do not count.

**Developer rule:** Do not weaken or skip the lockout checks in `adminService.deactivateAdmin()` and `adminService.updateAdminRole()` in `apps/api/src/modules/admin/service.ts`.

---

## 7. Future-only permissions

The following permissions exist in `ADMIN_PERMISSIONS` and `ADMIN_PERMISSION_GROUPS` but do not currently have active admin pages or full workflows. Do not create new routes or pages for these without product confirmation.

These permissions have been removed from the catalog because they have no active code usage. Add them back when the corresponding page or action is implemented.

| Permission | Reason removed |
|---|---|
| `reports.view`, `reports.export` | No reports page exists |
| `investments.manage` | Investment listing is read-only; no admin mutation routes |
| `bucket_balances.manage` | View-only page; no correction/adjustment routes |
| `repayments.manage` | Repayment actions inside Note Detail use `notes.repayment.manage` |
| `service_fee.view` / `service_fee.manage` | Renamed/removed pre-production: queue access is `settlements.view`; trustee actions inside Note Detail use `notes.settlement.manage` / `notes.disbursement.manage` |
| `disbursements.manage` | All withdrawal mutations now use `notes.disbursement.manage`; this permission was redundant |

The following permissions are **not** in this list because they have active backend routes:

| Permission | Active usage |
|---|---|
| `contracts.manage` | `POST /contracts/:id/offers/resign` in `admin/controller.ts` |

---

## 8. Manual QA checklist

### Super Admin

- [ ] All sidebar items visible
- [ ] All pages accessible
- [ ] All action buttons enabled (lifecycle, Turn Into Note, section actions, Save Settings, Upload, etc.)
- [ ] Can create/edit roles and invite/deactivate admin users
- [ ] Can save permission changes in Permission Configuration

### View-only role (all `.view`, no `.manage`)

- [ ] All sidebar items visible; all pages load with data
- [ ] All mutation buttons disabled with tooltip "You do not have permission to perform this action."
- [ ] Application section Approve/Reject/Request Amendment disabled
- [ ] Note lifecycle action buttons and Featured toggle disabled
- [ ] "Turn Into Note" button disabled
- [ ] Legal Documents Upload/Edit/Publish/Archive controls disabled without `document_management.manage`
- [ ] Legal Acceptances remains readable with `document_management.view` and has no edit/delete controls
- [ ] Roles page and Permission Configuration visible and read-only
- [ ] Notifications page visible; Add Missing Types / toggles / Send disabled

### Role with `applications.view` only

- [ ] Only Applications sidebar item visible
- [ ] Applications list and detail accessible
- [ ] Section workflow buttons disabled
- [ ] Comment box works — adding a comment succeeds
- [ ] Direct URL to `/notes`, `/accounts`, etc. shows Access Denied

### Role with `roles.view` only

- [ ] Roles & Users page accessible with admin user list
- [ ] Permission Configuration page accessible and read-only
- [ ] Create Role, Save Changes, Invite User buttons disabled
- [ ] Activate/Deactivate/Resend/Revoke buttons disabled

### Role with `notifications.view` only

- [ ] Settings → Notifications accessible (Configuration, Custom & Groups only)
- [ ] Audit → Notifications visible; other Audit tabs hidden
- [ ] Add Missing Types, toggles, Send Notification, Create Group disabled

### Role with `audit.access.view` only

- [ ] Only Access Logs tab visible under Audit
- [ ] Access Logs page loads correctly
- [ ] Security, Products, Legal Documents, Legal Acceptances, and Notifications tabs hidden or Access Denied
- [ ] No Document Logs tab exists

---

## 9. Developer warning notes

- **Do not add admin routes or pages for future-only permissions** without product confirmation
- **Do not make frontend-only RBAC changes** without adding the matching backend `requirePermission` guard
- **Do not require `.manage` to view a page** — `.view` controls page/sidebar/data access; `.manage` controls mutations only
- **Do not require section manage permission for application comments** — comments use `applications.view`
- **Do not block the Roles Permission Configuration page behind `roles.manage`** — it must be viewable with `roles.view`
- **Do not block Notification Management tabs behind `notifications.manage`** — all tabs are viewable with `notifications.view`
- **Do not rename `settlements.view` back to `service_fee.view`** — the settlement trustee queue is not fee-only
- **Do not rename `platform_settings`** to `platform_settings.finance` or any variant
- **Do not use `document_management.*`** for documents inside Notes or Application Review — use the parent module's permission
- **Do not reintroduce SiteDocument, DocumentLog, `/documents`, or `audit.document.view`** — those systems were removed
- **Do not remove the `requireRole(UserRole.ADMIN)` base gate** from sub-routers without ensuring all child routes have their own `requirePermission` guard

---

## 10. Adding a new permission

1. Add the string to `ADMIN_PERMISSIONS` in `packages/types/src/rbac.ts`
2. Add it to the correct group in `ADMIN_PERMISSION_GROUPS` (or create a new group)
3. Enforce it on the API route with `requirePermission("new.permission")`
4. Gate the related UI with `usePermissions().can("new.permission")` or `<RequirePermission permission="new.permission">`
5. If it is a `.view` permission, add it to the sidebar gating in `app-sidebar.tsx`
6. If it is future-only, add it to section 7 above with a reason

---

## 11. Runtime flow diagram

```mermaid
flowchart TD
  Bearer["Bearer JWT (Cognito)"] --> RequireAuth[requireAuth]
  RequireAuth --> UserRow[(users)]
  UserRow --> AdminRow[(admins)]
  AdminRow --> Catalog[(admin_roles)]
  Catalog --> Resolve["resolveAdminAccess()"]
  Resolve --> ReqState["req.adminPermissions"]
  ReqState --> Middleware["requirePermission(...)"]
  Middleware --> Route[Route handler]
  Resolve --> Me["GET /v1/auth/me"]
  Me --> Hook["usePermissions()"]
  Hook --> UiGate["UI gating"]
  Middleware -->|"SUPER_ADMIN bypass"| Route
  Hook -->|"SUPER_ADMIN bypass"| UiGate
```
