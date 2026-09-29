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
