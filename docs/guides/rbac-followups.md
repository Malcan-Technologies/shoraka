# RBAC follow-up TODO

Items found during the admin RBAC audit that were intentionally **not** part of the
"broad business-stage" cleanup batch (dashboard sub-permissions, Offer & Acceptance /
signing, CTOS / AML alignment, trustee letters, late charge waiver). Each needs its own
change and tests.

## S3 permission-aware guarding (dedicated task)

`POST /v1/s3/view-url` and `POST /v1/s3/download-url` (`apps/api/src/modules/s3/controller.ts`)
are `requireAuth` only. `assertCanAccessS3Key` enforces ownership for `applications/…` keys and
admin-only access for `operator-profile/signing-signatures/…`; every other prefix is unrestricted.

- [ ] Audit every caller (admin, issuer, investor, `packages/config` `use-s3-view-url`) and list the key prefixes each one requests.
- [ ] Map prefixes to the owning resource permission for admins, e.g.:
  - `applications/`, `invoices/` → `applications.view`
  - `contracts/` → `contracts.view`
  - `marc-reports/` → `organizations.view`
  - `legal-documents/` → `document_management.view`
  - `note-letters/`, `notes/`, `prospectuses/`, `investment-note-certificates/`, `investment-settlement-confirmations/`, `settlement-hibah-receipts/`, `assignment-notices/`, `shoraka-certificates/` → `notes.view`
  - `withdrawal-letters/` → `investor_withdrawals.view` / `disbursements.view` (by withdrawal type)
  - `receipts/` → `gateway_payments.view`
  - `products/` → `products.view`
  - `operator-profile/signing-signatures/` → `operator_profile.view`
- [ ] Decide non-admin behaviour (issuer / investor callers) per prefix before denying by default.
- [ ] Add tests to `s3/controller.test.ts`.

## Other guard / mismatch items

- [ ] `GET /v1/applications/:id/logs` (admin path) has no permission guard; require `applications.view`.
- [ ] `/test-errors` page and `/api/test-errors` proxy have no permission or environment gate.
- [ ] `/v1/admin/demos/contract-lo/*` (`GET /fixture`, `GET /prefill`, `POST /generate`) is a demo route that checks the ADMIN role only, with no permission guard. Decide whether to remove it, gate it by environment, or put it on a permission.
- [ ] `GET /v1/applications/:id/generated-documents/:type` (`apps/api/src/modules/generated-documents/controller.ts`) treats any ADMIN role as admin access, with no permission check. The admin-mounted routes under `/v1/admin/applications/:id/generated-documents` already require `applications.view`; require the same here for admin callers.

## Resolved

- [x] `PATCH /v1/applications/:id/admin-financial-statements/{field,fallback}` require `applications.financial.manage` or `notes.manage` (prospectus-review dialogs). The Financial tab Add / Edit statement buttons are disabled without `applications.financial.manage`.
- [x] `apps/admin/src/app/settings/roles/page.tsx` passes the computed `can("roles.manage")` as `canManageRoles`; admin-user role edit, deactivate and reactivate are disabled without it.
- [x] Applications list / sidebar: `GET /v1/products` and `GET /v1/products/:id` accept `products.view` or `applications.view`; product writes stay on `products.manage`.
- [x] `POST /v1/admin/applications/:id/reviews/pending-amendments` (item scope) checks the permission against `itemId`, the key the handler stores. A client `scopeKey` can no longer point the check at a different section.

- [x] Page-ownership reads (see `rbac.md` §3 "Page-ownership reads"):
  - Organization detail Activity tab reads `GET /v1/admin/organizations/:portal/:id/onboarding-logs` (`organizations.view`, organization forced from the URL). `GET /v1/admin/onboarding-logs` stays on `onboarding.view`.
  - Note detail Investors panel reads `GET /v1/admin/notes/:id/investments` (`notes.view`, note forced). `GET /v1/admin/investments` stays on `investments.view`.
  - Note detail excess late charge history reads `GET /v1/admin/notes/:id/excess-late-charge-payments` (`notes.view`, note and `EXCESS_LATE_CHARGES` purpose forced). `GET /v1/admin/gateway-payments` stays on `gateway_payments.view`; the "View payment" link to the Gateway Payments page shows only with `gateway_payments.view`.
- [x] `GET /v1/admin/withdrawals/:id/shoraka` requires `notes.view` or `disbursements.view`. Shoraka STP actions stay on `notes.disbursement.manage`.
- [x] Onboarding Review button and RegTank view links use `onboarding.view`. Restart, approve, final approval and refresh stay on `onboarding.manage`.
- [x] Signing readiness loads for every Application Review viewer (`applications.view`). Auto-sign Retry requires `applications.offer_acceptance.manage` and is disabled without it.
- [x] Amendment modal "Remove" is enabled per row by that row's section / item manage permission (same key as `requirePendingAmendmentRoute`), not by `applications.manage`.

- [x] `PATCH /v1/admin/users/:id/roles` no longer lets `users.manage` manage admin access. Adding or removing `ADMIN` also needs `roles.manage` (403 before any write). The route never creates an admin record, so it can no longer create a Super Admin; adding `ADMIN` to a user with no admin record returns 400. Removing `ADMIN` from the last active Super Admin is rejected. Investor / Issuer portal access changes still need `users.manage` only.
- [x] Late/default fee amounts belong to `notes.default.manage`. `POST /v1/admin/notes/:id/settlements/preview` stays on `notes.settlement.manage`, and also needs `notes.default.manage` when the request sets, changes or clears Ta'widh, Gharamah or the Ta'widh investor share compared with the saved preview. The Ta'widh investor share input is disabled without `notes.default.manage`.

## Deferred product decisions

- [ ] **Admin role hierarchy.** Not decided, waiting for the client. Candidate rules, none implemented:
  - only a Super Admin can assign Super Admin
  - an admin cannot grant permissions they do not hold
  - an admin cannot edit roles above their own permission level
- [ ] `deactivateAdmin` and `reactivateAdmin` (`roles.manage`) create a missing admin record as `SUPER_ADMIN`. Decide the default together with the hierarchy rules.
- [ ] A user with `notes.default.manage` only cannot save fee amounts, because saving happens in settlement preview. A separate fee-save route would be needed to change that.
- [ ] Prospectus page: without `organizations.view` the MARC read fails and Approve Prospectus stays disabled with no reason shown. This is UX messaging, not a permission change.

## Decisions recorded (no change planned)

- **`roles.manage` is a trusted permission.** It controls the Admin Roles & Users page: admin roles, permissions, invitations, role assignment, deactivate / reactivate, and Super Admin assignment. A user with `roles.manage` can assign Super Admin. Accepted until the client confirms stricter requirements.
- **`users.manage` is for the User Accounts page only.** It covers account details and Investor / Issuer portal access. Any admin access or RBAC role change belongs to `roles.manage`.
- **Prospectus / MARC.** Saving a MARC assessment stays on `organizations.manage`; reading it stays on `organizations.view`. Prospectus approval stays on `notes.manage`. Prospectus approval only checks that the MARC assessment is complete; it does not approve or change MARC.
- Onboarding CTOS / AML stays on `onboarding.manage` / `onboarding.view`.
- Issuer disbursement trustee letters (including `ISSUER_RESIDUAL_RETURN` / `ADMIN_ADJUSTMENT` withdrawals) stay on `notes.disbursement.manage`.
- **No automatic role-data backfill for this RBAC change.** Role permissions are stored in `admin_roles.permissions`, and keys that are no longer in the catalog are dropped when access is resolved. This environment is not production, so there is no backfill in `ensureAdminRoleCatalog` and no SQL migration. Before go-live, reconfigure each custom role by hand in Settings > Roles:
  - `applications.contract.manage` / `applications.invoice.manage` (removed) → grant `applications.offer_acceptance.manage`. This also covers signing package actions, which previously showed for `applications.manage`.
  - Shoraka / Company profile moved from `platform_settings.*` → grant `operator_profile.view` / `operator_profile.manage`.
  - Dashboard PAR / Credit quality moved from `reports.view` → grant `dashboard.reports.view`.
  - Guarantor Start AML moved from `applications.manage` → `applications.business_guarantor.manage`.
  - Settlement-phase trustee letters moved from `notes.disbursement.manage` → `notes.settlement.manage`.
  - Ta'widh / Gharamah late charge waiver moved from `notes.settlement.manage` → `notes.default.manage`.

  Super Admin gets every permission automatically, so it needs no change.
