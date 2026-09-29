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

- [ ] `GET /admin/withdrawals/:id/shoraka` has no permission guard.
- [ ] `GET /v1/applications/:id/logs` (admin path) has no permission guard; require `applications.view`.
- [ ] `/test-errors` page and `/api/test-errors` proxy have no permission or environment gate.
- [ ] Note detail Investors panel: FE `notes.view`, backend `investments.view`.
- [ ] Note detail excess late charge panel: needs `gateway_payments.view`, not checked in the UI.
- [ ] Onboarding Review button / RegTank links require `onboarding.manage` in the UI although the backend read routes need `onboarding.view`.
- [ ] Organization detail Activity tab: FE `organizations.view`, backend `onboarding.view`.
- [ ] Amendment modal "Remove": FE `applications.manage`, backend section / item permission.

## Resolved

- [x] `PATCH /v1/applications/:id/admin-financial-statements/{field,fallback}` require `applications.financial.manage` or `notes.manage` (prospectus-review dialogs). The Financial tab Add / Edit statement buttons are disabled without `applications.financial.manage`.
- [x] `apps/admin/src/app/settings/roles/page.tsx` passes the computed `can("roles.manage")` as `canManageRoles`; admin-user role edit, deactivate and reactivate are disabled without it.
- [x] Applications list / sidebar: `GET /v1/products` and `GET /v1/products/:id` accept `products.view` or `applications.view`; product writes stay on `products.manage`.
- [x] `POST /v1/admin/applications/:id/reviews/pending-amendments` (item scope) checks the permission against `itemId`, the key the handler stores. A client `scopeKey` can no longer point the check at a different section.

## Decisions recorded (no change planned)

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
