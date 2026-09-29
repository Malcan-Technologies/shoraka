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

- [ ] `PATCH /v1/applications/:id/admin-financial-statements/{field,fallback}` are admin-role only; enforce `applications.financial.manage` (and/or `notes.manage` for the prospectus-review dialogs).
- [ ] `GET /admin/withdrawals/:id/shoraka` has no permission guard.
- [ ] `GET /v1/applications/:id/logs` (admin path) has no permission guard; require `applications.view`.
- [ ] `/test-errors` page and `/api/test-errors` proxy have no permission or environment gate.
- [ ] `apps/admin/src/app/settings/roles/page.tsx` passes a literal `true` as `canManageRoles`.
- [ ] Note detail Investors panel: FE `notes.view`, backend `investments.view`.
- [ ] Note detail excess late charge panel: needs `gateway_payments.view`, not checked in the UI.
- [ ] Onboarding Review button / RegTank links require `onboarding.manage` in the UI although the backend read routes need `onboarding.view`.
- [ ] Organization detail Activity tab: FE `organizations.view`, backend `onboarding.view`.
- [ ] Applications list / sidebar depend on `products.view` (`GET /v1/products`), not only `applications.view`.
- [ ] Amendment modal "Remove": FE `applications.manage`, backend section / item permission.

## Decisions recorded (no change planned)

- Onboarding CTOS / AML stays on `onboarding.manage` / `onboarding.view`.
- Issuer disbursement trustee letters (including `ISSUER_RESIDUAL_RETURN` / `ADMIN_ADJUSTMENT` withdrawals) stay on `notes.disbursement.manage`.
