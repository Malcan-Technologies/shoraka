# People Usage Audit

## Summary
- Total files found: 13
- Scope includes places that render people rows and places that build/match people rows for UI behavior.

---

## Admin Portal

### File: `apps/admin/src/components/onboarding-review-dialog.tsx`
- Component: `OnboardingReviewDialog`
- Data Source: `application.directorKycStatus`, `application.directorAmlStatus`, `application.latestOrganizationCtosCompanyJson`, `application.ctosPartySupplements` via `getDirectorShareholderDisplayRows(...)`
- Description: Shows director/shareholder KYC and AML status tables in onboarding review flow.

### File: `apps/admin/src/components/ssm-verification-panel.tsx`
- Component: `SSMVerificationPanel`
- Data Source: Onboarding side (`directorKycStatus` / `corporateEntities`) and CTOS side (`company_json.directors`) via `buildOnboardingCtosComparison(...)`
- Description: Renders side-by-side director/shareholder compare tables for SSM/CTOS verification.

### File: `apps/admin/src/lib/onboarding-ctos-compare.ts`
- Component: Data-mapping helper for `SSMVerificationPanel`
- Data Source: `application.directorKycStatus`, `application.corporateEntities`, CTOS `company_json.directors`
- Description: Splits and maps directors/shareholders into matched, app-only, CTOS-only buckets for UI tables.

### File: `apps/admin/src/app/organizations/[portal]/[id]/page.tsx`
- Component: `OrganizationDetailPage` (`CorporateEntitiesDisplay`, `DirectorStatusDisplay`, `BusinessShareholderStatusDisplay`)
- Data Source: `org.corporateEntities`, `org.directorKycStatus`, `org.directorAmlStatus`
- Description: Renders directors/shareholders/corporate shareholders and their KYC/AML status cards.

### File: `apps/admin/src/components/application-financial-review-content.tsx`
- Component: `ApplicationFinancialReviewContent`
- Data Source: `app.issuer_organization.corporate_entities`, `director_kyc_status`, `director_aml_status`, `latest_organization_ctos_company_json`, `ctos_party_supplements` via `getDirectorShareholderDisplayRows(...)`
- Description: Renders "Director and Shareholders" table in financial review and CTOS subject actions.

### File: `apps/admin/src/components/application-review/sections/financial-section.tsx`
- Component: `FinancialSection`
- Data Source: Same issuer org sources via `getDirectorShareholderDisplayRows(...)`
- Description: Maps directors/shareholders into KYC readiness gate for approve action state and warning banner.

---

## Issuer Portal

### File: `apps/issuer/src/app/profile/page.tsx`
- Component: `ProfilePage`
- Data Source: `orgData.corporateEntities`, `orgData.directorKycStatus`, `orgData.directorAmlStatus`, `orgData.latestOrganizationCtosCompanyJson`, `orgData.ctosPartySupplements`
- Description: Mounts the unified directors/shareholders section on issuer profile page.

### File: `apps/issuer/src/components/director-shareholders-unified-section.tsx`
- Component: `DirectorShareholdersUnifiedSection`
- Data Source: Unified rows from `getDirectorShareholderDisplayRows(...)` with CTOS supplements and issuer statuses
- Description: Main issuer UI for directors/shareholders (individual and corporate), statuses, email capture, and onboarding send actions.

### File: `apps/issuer/src/components/onboarding-status-card.tsx`
- Component: `OnboardingStatusCard`
- Data Source: `organization.corporateEntities`, `organization.directorKycStatus`, `organization.directorAmlStatus`, `organization.latestOrganizationCtosCompanyJson`, `organization.ctosPartySupplements`
- Description: Shows read-only unified KYC/AML rows during issuer onboarding status steps.

### File: `apps/issuer/src/app/(application-flow)/applications/steps/company-details-step.tsx`
- Component: `CompanyDetailsStep`
- Data Source: `useCorporateEntities(...)` + `getDirectorShareholderDisplayRows(...)`
- Description: Displays director/shareholder summary rows in application flow and links users to profile completion when needed.

---

## Investor Portal

### File: `apps/investor/src/app/profile/page.tsx`
- Component: `ProfilePage`
- Data Source: `orgData.corporateEntities`, `orgData.directorKycStatus`, `orgData.directorAmlStatus`, `orgData.latestOrganizationCtosCompanyJson`, `orgData.ctosPartySupplements`
- Description: Mounts unified directors/shareholders card for investor company profiles.

### File: `apps/investor/src/components/directors-shareholders-card.tsx`
- Component: `DirectorsShareholdersCard`
- Data Source: Unified rows from `getDirectorShareholderDisplayRows(...)`
- Description: Renders grouped sections for directors, individual shareholders, and corporate shareholders with KYC/AML badges.

### File: `apps/investor/src/components/onboarding-status-card.tsx`
- Component: `OnboardingStatusCard`
- Data Source: `organization.corporateEntities`, `organization.directorKycStatus`, `organization.directorAmlStatus`, `organization.latestOrganizationCtosCompanyJson`, `organization.ctosPartySupplements`
- Description: Shows read-only unified KYC/AML rows in investor onboarding status steps.

### File: `apps/investor/src/components/directors-list-card.tsx`
- Component: `DirectorsListCard`
- Data Source: `useCorporateEntities(...).data.directors`
- Description: Standalone directors card component (currently not referenced in investor profile page).

### File: `apps/investor/src/components/shareholders-list-card.tsx`
- Component: `ShareholdersListCard`
- Data Source: `useCorporateEntities(...).data.shareholders`
- Description: Standalone individual shareholders card component (currently not referenced in investor profile page).

### File: `apps/investor/src/components/business-shareholders-list-card.tsx`
- Component: `BusinessShareholdersListCard`
- Data Source: `useCorporateEntities(...).data.corporateShareholders`
- Description: Standalone business shareholders card component (currently not referenced in investor profile page).

---

## Observations

- Duplicated logic found:
  - Unified people rendering exists in multiple portals (`issuer` and `investor`) with similar grouping and status-badge behavior.
  - Admin has separate compare and review renderers that each rebuild people rows from mixed sources.

- Inconsistent data sources:
  - Some screens use unified helper output (`getDirectorShareholderDisplayRows(...)`), while older standalone investor cards use raw `corporateEntities` lists.
  - Admin org-detail page still renders legacy/direct source views (`corporateEntities`, `directorKycStatus`, `directorAmlStatus`) in parallel with unified compare/review views.

- Places that should switch to `people[]`:
  - `apps/admin/src/components/application-financial-review-content.tsx` (director/shareholder table).
  - `apps/admin/src/components/onboarding-review-dialog.tsx` (corporate unified rows in KYC/AML phases).
  - `apps/admin/src/app/organizations/[portal]/[id]/page.tsx` (multiple legacy people/status cards).
  - `apps/admin/src/components/ssm-verification-panel.tsx` (after confirming side-by-side CTOS compare requirements).
  - `apps/issuer/src/components/director-shareholders-unified-section.tsx` and `apps/investor/src/components/directors-shareholders-card.tsx` (to consume backend-ready normalized status/action model consistently).

---
