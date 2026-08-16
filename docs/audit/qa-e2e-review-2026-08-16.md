# Audit / Activity E2E QA Review

**Date:** 2026-08-16  
**Scope:** Read-only verification of the current source. No product code was changed.  
**Result:** **PASS WITH CLEANUP**

> **Historical snapshot.** This document records the 2026-08-16 E2E matrix. Later living-source changes include: A040 `ONBOARDING_RESUMED`, A052 `CTOS_REPORT_RECEIVED`, and A053 `CORPORATE_ENTITIES_UPDATED` retired (IDs reserved; historical rows readable); A055 `DIRECTOR_KYC_STATUS_UPDATED` outcome-only (`APPROVED`/`REJECTED`); A044 amendment/resubmission support; and `AML_APPROVED` `onboarding_id` threading to `reg_tank_onboarding.id` when the session is already known. Do not treat the matrices below as current living behaviour. See `docs/audit/audit-manual-verification-catalogue.md`.

This artifact is the full 174-event traceability matrix plus supporting notes. The chat report summarizes findings; this file is the authoritative row-level record.

---

## Catalogue counts (verified from source)

| Module | Expected | Actual | Events file | Metadata | Writer |
|---|---:|---:|---|---|---|
| Access | 3 | 3 | `apps/api/src/modules/auth/audit/events.ts` | Yes | Yes |
| Security | 35 | 35 | `apps/api/src/modules/security/audit/events.ts` | Yes | Yes |
| Onboarding | 17 | 17 | `apps/api/src/modules/onboarding/audit/events.ts` | Yes | Yes |
| Legal | 7 | 7 | `apps/api/src/modules/legal-documents/audit/events.ts` | Yes | Yes |
| Application | 40 | 40 | `apps/api/src/modules/applications/audit/events.ts` | Yes | Yes |
| Signing | 12 | 12 | `apps/api/src/modules/signing/audit/events.ts` | Yes | Yes |
| Note | 35 | 35 | `apps/api/src/modules/notes/audit/events.ts` | Yes | Yes |
| Payment | 19 | 19 | `apps/api/src/modules/payment/audit/events.ts` | Yes | Yes |
| Product | 5 | 5 | `apps/api/src/modules/products/audit/events.ts` | Yes | Yes |
| Notification | 1 | 1 | `apps/api/src/modules/notification/audit/events.ts` | Yes | Yes |
| **Total** | **174** | **174** | | **174/174** | **174/174** |

Reconciliation:

- No dead catalogue events.
- No orphan writers.
- No writer event-name mismatches (writers are typed to the catalogue unions).
- No active legacy `AccessLog` / `SecurityLog` models in Prisma.
- Seed writes `accessAuditLog` directly in `apps/api/prisma/seed.ts` (bypass, not a runtime writer).
- Idempotency uniqueness exists only on `PaymentAuditLog.idempotency_key`.

---

## Surface / visibility notes used in the matrix

- **Admin raw** for Application + Signing is Application Detail Audit History via `GET /v1/applications/:id/logs` (unfiltered merge).
- **Admin curated Application Activity** uses `isAdminApplicationTimelineVisible`.
- **Admin Organization Activity** requests 15 onboarding types (excludes `USER_ONBOARDING_STATUS_UPDATED`, `ONBOARDING_STATUS_CHANGED`).
- **Admin Note Activity** is unfiltered (all note events with `note_id`).
- `TRUSTEE_SIGNATURE_UPDATED` has `note_id = null` and appears on Platform Finance raw audit, not Note Detail.
- Issuer Activity domains: onboarding, application, signing, note. No payment.
- Investor Activity domains: onboarding, note, payment. No application/signing.
- Payment ownership: `organization_id` must match viewer org and `organization_kind = INVESTOR`. No userId fallback.

---

## 174-event traceability matrix

| # | Event | Audit Table | Writer | Admin Raw | Admin Curated | Issuer | Investor | Presentation | Schema | Tests | Issue |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `USER_SIGNED_UP` | AccessAuditLog | Yes | /audit Access | No | No | No | N/A (raw audit only; formatAuditEventLabel) | Yes | cutover/schema; UI source-string |  |
| 2 | `USER_LOGGED_IN` | AccessAuditLog | Yes | /audit Access | No | No | No | N/A (raw audit only; formatAuditEventLabel) | Yes | cutover/schema; UI source-string |  |
| 3 | `USER_LOGGED_OUT` | AccessAuditLog | Yes | /audit Access | No | No | No | N/A (raw audit only; formatAuditEventLabel) | Yes | cutover/schema; UI source-string |  |
| 4 | `USER_ROLE_ADDED` | SecurityAuditLog | Yes | /audit Security | No | No | No | N/A (raw audit only; formatAuditEventLabel) | Yes | cutover/schema; UI source-string |  |
| 5 | `ACTIVE_ROLE_CHANGED` | SecurityAuditLog | Yes | /audit Security | No | No | No | N/A (raw audit only; formatAuditEventLabel) | Yes | cutover/schema; UI source-string |  |
| 6 | `USER_PROFILE_UPDATED` | SecurityAuditLog | Yes | /audit Security | No | No | No | N/A (raw audit only; formatAuditEventLabel) | Yes | cutover/schema; UI source-string |  |
| 7 | `USER_PROFILE_UPDATED_BY_ADMIN` | SecurityAuditLog | Yes | /audit Security | No | No | No | N/A (raw audit only; formatAuditEventLabel) | Yes | cutover/schema; UI source-string |  |
| 8 | `PASSWORD_CHANGED` | SecurityAuditLog | Yes | /audit Security | No | No | No | N/A (raw audit only; formatAuditEventLabel) | Yes | cutover/schema; UI source-string |  |
| 9 | `PASSWORD_CHANGE_FAILED` | SecurityAuditLog | Yes | /audit Security | No | No | No | N/A (raw audit only; formatAuditEventLabel) | Yes | cutover/schema; UI source-string |  |
| 10 | `USER_EMAIL_VERIFIED` | SecurityAuditLog | Yes | /audit Security | No | No | No | N/A (raw audit only; formatAuditEventLabel) | Yes | cutover/schema; UI source-string |  |
| 11 | `EMAIL_VERIFICATION_FAILED` | SecurityAuditLog | Yes | /audit Security | No | No | No | N/A (raw audit only; formatAuditEventLabel) | Yes | cutover/schema; UI source-string |  |
| 12 | `ADMIN_ACCESS_DENIED` | SecurityAuditLog | Yes | /audit Security | No | No | No | N/A (raw audit only; formatAuditEventLabel) | Yes | cutover/schema; UI source-string |  |
| 13 | `ADMIN_ROLE_CREATED` | SecurityAuditLog | Yes | /audit Security | No | No | No | N/A (raw audit only; formatAuditEventLabel) | Yes | cutover/schema; UI source-string |  |
| 14 | `ADMIN_ROLE_PERMISSIONS_UPDATED` | SecurityAuditLog | Yes | /audit Security | No | No | No | N/A (raw audit only; formatAuditEventLabel) | Yes | cutover/schema; UI source-string |  |
| 15 | `ADMIN_ROLE_DELETED` | SecurityAuditLog | Yes | /audit Security | No | No | No | N/A (raw audit only; formatAuditEventLabel) | Yes | cutover/schema; UI source-string |  |
| 16 | `USER_ROLES_UPDATED` | SecurityAuditLog | Yes | /audit Security | No | No | No | N/A (raw audit only; formatAuditEventLabel) | Yes | cutover/schema; UI source-string |  |
| 17 | `ADMIN_USER_ROLE_CHANGED` | SecurityAuditLog | Yes | /audit Security | No | No | No | N/A (raw audit only; formatAuditEventLabel) | Yes | cutover/schema; UI source-string |  |
| 18 | `ADMIN_USER_DEACTIVATED` | SecurityAuditLog | Yes | /audit Security | No | No | No | N/A (raw audit only; formatAuditEventLabel) | Yes | cutover/schema; UI source-string |  |
| 19 | `ADMIN_USER_REACTIVATED` | SecurityAuditLog | Yes | /audit Security | No | No | No | N/A (raw audit only; formatAuditEventLabel) | Yes | cutover/schema; UI source-string |  |
| 20 | `ADMIN_INVITATION_CREATED` | SecurityAuditLog | Yes | /audit Security | No | No | No | N/A (raw audit only; formatAuditEventLabel) | Yes | cutover/schema; UI source-string |  |
| 21 | `ADMIN_INVITATION_LINK_GENERATED` | SecurityAuditLog | Yes | /audit Security | No | No | No | N/A (raw audit only; formatAuditEventLabel) | Yes | cutover/schema; UI source-string |  |
| 22 | `ADMIN_INVITATION_RESENT` | SecurityAuditLog | Yes | /audit Security | No | No | No | N/A (raw audit only; formatAuditEventLabel) | Yes | cutover/schema; UI source-string |  |
| 23 | `ADMIN_INVITATION_REVOKED` | SecurityAuditLog | Yes | /audit Security | No | No | No | N/A (raw audit only; formatAuditEventLabel) | Yes | cutover/schema; UI source-string |  |
| 24 | `ADMIN_INVITATION_ACCEPTED` | SecurityAuditLog | Yes | /audit Security | No | No | No | N/A (raw audit only; formatAuditEventLabel) | Yes | cutover/schema; UI source-string |  |
| 25 | `USER_PUBLIC_ID_CHANGED` | SecurityAuditLog | Yes | /audit Security | No | No | No | N/A (raw audit only; formatAuditEventLabel) | Yes | cutover/schema; UI source-string |  |
| 26 | `ORGANIZATION_MEMBER_INVITED` | SecurityAuditLog | Yes | /audit Security | No | No | No | N/A (raw audit only; formatAuditEventLabel) | Yes | cutover/schema; UI source-string |  |
| 27 | `ORGANIZATION_MEMBER_JOINED` | SecurityAuditLog | Yes | /audit Security | No | No | No | N/A (raw audit only; formatAuditEventLabel) | Yes | cutover/schema; UI source-string |  |
| 28 | `ORGANIZATION_MEMBER_REMOVED` | SecurityAuditLog | Yes | /audit Security | No | No | No | N/A (raw audit only; formatAuditEventLabel) | Yes | cutover/schema; UI source-string |  |
| 29 | `ORGANIZATION_MEMBER_LEFT` | SecurityAuditLog | Yes | /audit Security | No | No | No | N/A (raw audit only; formatAuditEventLabel) | Yes | cutover/schema; UI source-string |  |
| 30 | `ORGANIZATION_MEMBER_ROLE_UPDATED` | SecurityAuditLog | Yes | /audit Security | No | No | No | N/A (raw audit only; formatAuditEventLabel) | Yes | cutover/schema; UI source-string |  |
| 31 | `ORGANIZATION_OWNERSHIP_TRANSFERRED` | SecurityAuditLog | Yes | /audit Security | No | No | No | N/A (raw audit only; formatAuditEventLabel) | Yes | cutover/schema; UI source-string |  |
| 32 | `ORGANIZATION_INVITATION_REVOKED` | SecurityAuditLog | Yes | /audit Security | No | No | No | N/A (raw audit only; formatAuditEventLabel) | Yes | cutover/schema; UI source-string |  |
| 33 | `ORGANIZATION_INVITATION_RESENT` | SecurityAuditLog | Yes | /audit Security | No | No | No | N/A (raw audit only; formatAuditEventLabel) | Yes | cutover/schema; UI source-string |  |
| 34 | `NOTIFICATION_TYPE_UPDATED` | SecurityAuditLog | Yes | /audit Security | No | No | No | N/A (raw audit only; formatAuditEventLabel) | Yes | cutover/schema; UI source-string |  |
| 35 | `NOTIFICATION_GROUP_CREATED` | SecurityAuditLog | Yes | /audit Security | No | No | No | N/A (raw audit only; formatAuditEventLabel) | Yes | cutover/schema; UI source-string |  |
| 36 | `NOTIFICATION_GROUP_UPDATED` | SecurityAuditLog | Yes | /audit Security | No | No | No | N/A (raw audit only; formatAuditEventLabel) | Yes | cutover/schema; UI source-string |  |
| 37 | `NOTIFICATION_GROUP_DELETED` | SecurityAuditLog | Yes | /audit Security | No | No | No | N/A (raw audit only; formatAuditEventLabel) | Yes | cutover/schema; UI source-string |  |
| 38 | `USER_NOTIFICATION_PREFERENCE_UPDATED` | SecurityAuditLog | Yes | /audit Security | No | No | No | N/A (raw audit only; formatAuditEventLabel) | Yes | cutover/schema; UI source-string |  |
| 39 | `ONBOARDING_STARTED` | OnboardingAuditLog | Yes | /audit Onboarding | Organization Activity | Yes | Yes | activity-presentation.ts | Yes | cutover/schema; visibility; presentation; UI source-string |  |
| 40 | `ONBOARDING_RESUMED` | OnboardingAuditLog | Yes | /audit Onboarding | Organization Activity | Yes | Yes | activity-presentation.ts | Yes | cutover/schema; visibility; presentation; UI source-string |  |
| 41 | `ONBOARDING_RESTARTED` | OnboardingAuditLog | Yes | /audit Onboarding | Organization Activity | Yes | Yes | activity-presentation.ts | Yes | cutover/schema; visibility; presentation; UI source-string |  |
| 42 | `ONBOARDING_RESET` | OnboardingAuditLog | Yes | /audit Onboarding | Organization Activity | No | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation; UI source-string |  |
| 43 | `USER_ONBOARDING_STATUS_UPDATED` | OnboardingAuditLog | Yes | /audit Onboarding | No (hidden from Org Activity; still on /audit) | No | No | Generic/unknown fallback | Yes | cutover/schema; visibility; presentation; UI source-string |  |
| 44 | `ONBOARDING_STATUS_CHANGED` | OnboardingAuditLog | Yes | /audit Onboarding | No (hidden from Org Activity; still on /audit) | No | No | Generic/unknown fallback | Yes | cutover/schema; visibility; presentation; UI source-string |  |
| 45 | `ONBOARDING_APPROVED` | OnboardingAuditLog | Yes | /audit Onboarding | Organization Activity | Yes | Yes | activity-presentation.ts | Yes | cutover/schema; visibility; presentation; UI source-string |  |
| 46 | `ONBOARDING_REJECTED` | OnboardingAuditLog | Yes | /audit Onboarding | Organization Activity | Yes | Yes | activity-presentation.ts | Yes | cutover/schema; visibility; presentation; UI source-string |  |
| 47 | `ONBOARDING_FINAL_APPROVAL_COMPLETED` | OnboardingAuditLog | Yes | /audit Onboarding | Organization Activity | No | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation; UI source-string |  |
| 48 | `ONBOARDING_COMPLETED` | OnboardingAuditLog | Yes | /audit Onboarding | Organization Activity | Yes | Yes | activity-presentation.ts | Yes | cutover/schema; visibility; presentation; UI source-string |  |
| 49 | `AML_APPROVED` | OnboardingAuditLog | Yes | /audit Onboarding | Organization Activity | No | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation; UI source-string |  |
| 50 | `SSM_APPROVED` | OnboardingAuditLog | Yes | /audit Onboarding | Organization Activity | No | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation; UI source-string |  |
| 51 | `INVESTOR_SOPHISTICATED_STATUS_UPDATED` | OnboardingAuditLog | Yes | /audit Onboarding | Organization Activity | No | Conditional (previousValue !== newValue) | activity-presentation.ts | Yes | cutover/schema; visibility; presentation; UI source-string |  |
| 52 | `CTOS_REPORT_RECEIVED` | OnboardingAuditLog | Yes | /audit Onboarding | Organization Activity | No | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation; UI source-string |  |
| 53 | `CORPORATE_ENTITIES_UPDATED` | OnboardingAuditLog | Yes | /audit Onboarding | Organization Activity | No | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation; UI source-string |  |
| 54 | `DIRECTOR_ONBOARDING_INVITATION_SENT` | OnboardingAuditLog | Yes | /audit Onboarding | Organization Activity | Conditional (issuer company) | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation; UI source-string |  |
| 55 | `DIRECTOR_KYC_STATUS_UPDATED` | OnboardingAuditLog | Yes | /audit Onboarding | Organization Activity | Conditional (APPROVED/REJECTED/ACTION_REQUIRED) | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation; UI source-string |  |
| 56 | `LEGAL_DOCUMENT_CREATED` | LegalAdminAuditLog | Yes | /audit Legal Documents | No | No | No | N/A (raw audit only; formatAuditEventLabel) | Yes | cutover/schema; UI source-string |  |
| 57 | `LEGAL_DOCUMENT_UPDATED` | LegalAdminAuditLog | Yes | /audit Legal Documents | No | No | No | N/A (raw audit only; formatAuditEventLabel) | Yes | cutover/schema; UI source-string |  |
| 58 | `LEGAL_DOCUMENT_VERSION_UPLOADED` | LegalAdminAuditLog | Yes | /audit Legal Documents | No | No | No | N/A (raw audit only; formatAuditEventLabel) | Yes | cutover/schema; UI source-string |  |
| 59 | `LEGAL_DOCUMENT_VERSION_FILE_REPLACED` | LegalAdminAuditLog | Yes | /audit Legal Documents | No | No | No | N/A (raw audit only; formatAuditEventLabel) | Yes | cutover/schema; UI source-string |  |
| 60 | `LEGAL_DOCUMENT_VERSION_PUBLISHED` | LegalAdminAuditLog | Yes | /audit Legal Documents | No | No | No | N/A (raw audit only; formatAuditEventLabel) | Yes | cutover/schema; UI source-string |  |
| 61 | `LEGAL_DOCUMENT_VERSION_ARCHIVED` | LegalAdminAuditLog | Yes | /audit Legal Documents | No | No | No | N/A (raw audit only; formatAuditEventLabel) | Yes | cutover/schema; UI source-string |  |
| 62 | `LEGAL_DOCUMENT_VERSION_RESTORED` | LegalAdminAuditLog | Yes | /audit Legal Documents | No | No | No | N/A (raw audit only; formatAuditEventLabel) | Yes | cutover/schema; UI source-string |  |
| 63 | `APPLICATION_CREATED` | ApplicationAuditLog | Yes | Application Detail Audit History | Application Activity | Yes | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation | Admin raw API lacks applications.view |
| 64 | `APPLICATION_SUBMITTED` | ApplicationAuditLog | Yes | Application Detail Audit History | Application Activity | Yes | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation | Admin raw API lacks applications.view |
| 65 | `APPLICATION_REVIEW_STARTED` | ApplicationAuditLog | Yes | Application Detail Audit History | Application Activity | No | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation | Admin raw API lacks applications.view |
| 66 | `APPLICATION_RESUBMITTED` | ApplicationAuditLog | Yes | Application Detail Audit History | Application Activity | Yes | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation | Admin raw API lacks applications.view |
| 67 | `APPLICATION_AMENDMENT_ACKNOWLEDGED` | ApplicationAuditLog | Yes | Application Detail Audit History | No (raw-only) | No | No | Generic/unknown fallback | Yes | cutover/schema; visibility; presentation | Admin raw API lacks applications.view |
| 68 | `APPLICATION_AMENDMENTS_REQUESTED` | ApplicationAuditLog | Yes | Application Detail Audit History | Application Activity | Yes | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation | Admin raw API lacks applications.view |
| 69 | `APPLICATION_REOPENED_FOR_REVIEW` | ApplicationAuditLog | Yes | Application Detail Audit History | Application Activity | Yes | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation | Admin raw API lacks applications.view |
| 70 | `APPLICATION_WITHDRAWN` | ApplicationAuditLog | Yes | Application Detail Audit History | Application Activity | Yes | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation | Admin raw API lacks applications.view |
| 71 | `APPLICATION_REJECTED` | ApplicationAuditLog | Yes | Application Detail Audit History | Application Activity | Yes | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation | Admin raw API lacks applications.view |
| 72 | `APPLICATION_ARCHIVED` | ApplicationAuditLog | Yes | Application Detail Audit History | No (raw-only) | No | No | Generic/unknown fallback | Yes | cutover/schema; visibility; presentation | Admin raw API lacks applications.view |
| 73 | `APPLICATION_DRAFT_DELETED` | ApplicationAuditLog | Yes | Application Detail Audit History | No (raw-only) | No | No | Generic/unknown fallback | Yes | cutover/schema; visibility; presentation | Admin raw API lacks applications.view |
| 74 | `APPLICATION_COMPLETED` | ApplicationAuditLog | Yes | Application Detail Audit History | Application Activity | Yes | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation | Admin raw API lacks applications.view |
| 75 | `APPLICATION_SECTION_REVIEW_UPDATED` | ApplicationAuditLog | Yes | Application Detail Audit History | Application Activity (conditional: amendment status) | Conditional (amendment status) | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation | Admin raw API lacks applications.view |
| 76 | `APPLICATION_ITEM_REVIEW_UPDATED` | ApplicationAuditLog | Yes | Application Detail Audit History | No (raw-only) | No | No | Generic/unknown fallback | Yes | cutover/schema; visibility; presentation | Admin raw API lacks applications.view |
| 77 | `APPLICATION_DOCUMENT_UPLOADED` | ApplicationAuditLog | Yes | Application Detail Audit History | No (raw-only) | No | No | Generic/unknown fallback | Yes | cutover/schema; visibility; presentation | Admin raw API lacks applications.view |
| 78 | `APPLICATION_DOCUMENT_REMOVED` | ApplicationAuditLog | Yes | Application Detail Audit History | No (raw-only) | No | No | Generic/unknown fallback | Yes | cutover/schema; visibility; presentation | Admin raw API lacks applications.view |
| 79 | `APPLICATION_DOCUMENT_REPLACED` | ApplicationAuditLog | Yes | Application Detail Audit History | No (raw-only) | No | No | Generic/unknown fallback | Yes | cutover/schema; visibility; presentation | Admin raw API lacks applications.view |
| 80 | `CONTRACT_OFFER_SENT` | ApplicationAuditLog | Yes | Application Detail Audit History | Application Activity | Yes | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation | Admin raw API lacks applications.view |
| 81 | `CONTRACT_OFFER_RETRACTED` | ApplicationAuditLog | Yes | Application Detail Audit History | Application Activity | Yes | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation | Admin raw API lacks applications.view |
| 82 | `CONTRACT_SIGNING_DEADLINE_EXTENDED` | ApplicationAuditLog | Yes | Application Detail Audit History | Application Activity | Yes | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation | Admin raw API lacks applications.view |
| 83 | `CONTRACT_OFFER_EXPIRED` | ApplicationAuditLog | Yes | Application Detail Audit History | Application Activity | Yes | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation | Admin raw API lacks applications.view |
| 84 | `CONTRACT_ACCEPTANCE_SUBMITTED` | ApplicationAuditLog | Yes | Application Detail Audit History | Application Activity | Yes | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation | Admin raw API lacks applications.view |
| 85 | `CONTRACT_ACCEPTANCE_RESUBMITTED` | ApplicationAuditLog | Yes | Application Detail Audit History | Application Activity | Yes | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation | Admin raw API lacks applications.view |
| 86 | `CONTRACT_ACCEPTANCE_CHANGES_REQUESTED` | ApplicationAuditLog | Yes | Application Detail Audit History | Application Activity | Yes | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation | Admin raw API lacks applications.view |
| 87 | `CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING` | ApplicationAuditLog | Yes | Application Detail Audit History | Application Activity | Yes | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation | Admin raw API lacks applications.view |
| 88 | `CONTRACT_OFFER_ACCEPTED` | ApplicationAuditLog | Yes | Application Detail Audit History | Application Activity | Yes | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation | Admin raw API lacks applications.view |
| 89 | `CONTRACT_OFFER_REJECTED` | ApplicationAuditLog | Yes | Application Detail Audit History | Application Activity | Yes | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation | Admin raw API lacks applications.view |
| 90 | `CONTRACT_WITHDRAWN` | ApplicationAuditLog | Yes | Application Detail Audit History | Application Activity | Yes | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation | Admin raw API lacks applications.view |
| 91 | `CONTRACT_CUSTOMER_LARGE_PRIVATE_UPDATED` | ApplicationAuditLog | Yes | Application Detail Audit History | No (raw-only) | No | No | Generic/unknown fallback | Yes | cutover/schema; visibility; presentation | Admin raw API lacks applications.view |
| 92 | `INVOICE_OFFER_SENT` | ApplicationAuditLog | Yes | Application Detail Audit History | Application Activity | Yes | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation | Admin raw API lacks applications.view |
| 93 | `INVOICE_OFFER_RETRACTED` | ApplicationAuditLog | Yes | Application Detail Audit History | Application Activity | Yes | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation | Admin raw API lacks applications.view |
| 94 | `INVOICE_SIGNING_DEADLINE_EXTENDED` | ApplicationAuditLog | Yes | Application Detail Audit History | Application Activity | Yes | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation | Admin raw API lacks applications.view |
| 95 | `INVOICE_OFFER_EXPIRED` | ApplicationAuditLog | Yes | Application Detail Audit History | Application Activity | Yes | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation | Admin raw API lacks applications.view |
| 96 | `INVOICE_ACCEPTANCE_SUBMITTED` | ApplicationAuditLog | Yes | Application Detail Audit History | Application Activity | Yes | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation | Admin raw API lacks applications.view |
| 97 | `INVOICE_ACCEPTANCE_RESUBMITTED` | ApplicationAuditLog | Yes | Application Detail Audit History | Application Activity | Yes | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation | Admin raw API lacks applications.view |
| 98 | `INVOICE_ACCEPTANCE_CHANGES_REQUESTED` | ApplicationAuditLog | Yes | Application Detail Audit History | Application Activity | Yes | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation | Admin raw API lacks applications.view |
| 99 | `INVOICE_ACCEPTANCE_APPROVED_FOR_SIGNING` | ApplicationAuditLog | Yes | Application Detail Audit History | Application Activity | Yes | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation | Admin raw API lacks applications.view |
| 100 | `INVOICE_OFFER_ACCEPTED` | ApplicationAuditLog | Yes | Application Detail Audit History | Application Activity | Yes | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation | Admin raw API lacks applications.view |
| 101 | `INVOICE_OFFER_REJECTED` | ApplicationAuditLog | Yes | Application Detail Audit History | Application Activity | Yes | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation | Admin raw API lacks applications.view |
| 102 | `INVOICE_WITHDRAWN` | ApplicationAuditLog | Yes | Application Detail Audit History | Application Activity | Yes | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation | Admin raw API lacks applications.view |
| 103 | `SIGNING_PACKAGE_CREATED` | SigningAuditLog | Yes | Application Detail Audit History | Application Activity | No | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation | Envelope logs ADMIN-role only |
| 104 | `SIGNING_PACKAGE_SENT` | SigningAuditLog | Yes | Application Detail Audit History | Application Activity | Yes | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation | Envelope logs ADMIN-role only |
| 105 | `SIGNING_PACKAGE_COMPLETED` | SigningAuditLog | Yes | Application Detail Audit History | Application Activity | Yes | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation | Envelope logs ADMIN-role only |
| 106 | `SIGNING_PACKAGE_VOIDED` | SigningAuditLog | Yes | Application Detail Audit History | Application Activity | Yes | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation | Envelope logs ADMIN-role only |
| 107 | `SIGNING_PACKAGE_DECLINED` | SigningAuditLog | Yes | Application Detail Audit History | Application Activity | Yes | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation | Envelope logs ADMIN-role only |
| 108 | `SIGNING_PACKAGE_EXPIRED` | SigningAuditLog | Yes | Application Detail Audit History | Application Activity | Yes | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation | Envelope logs ADMIN-role only |
| 109 | `SIGNING_RECIPIENT_COMPLETED` | SigningAuditLog | Yes | Application Detail Audit History | Application Activity | No | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation | Envelope logs ADMIN-role only |
| 110 | `SIGNING_RECIPIENT_DECLINED` | SigningAuditLog | Yes | Application Detail Audit History | Application Activity | Yes | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation | Envelope logs ADMIN-role only |
| 111 | `SIGNING_EKYC_STARTED` | SigningAuditLog | Yes | Application Detail Audit History | No (raw-only) | No | No | Generic/unknown fallback | Yes | cutover/schema; visibility; presentation | Envelope logs ADMIN-role only |
| 112 | `SIGNING_EKYC_VERIFIED` | SigningAuditLog | Yes | Application Detail Audit History | No (raw-only) | No | No | Generic/unknown fallback | Yes | cutover/schema; visibility; presentation | Envelope logs ADMIN-role only |
| 113 | `SIGNING_EKYC_FAILED` | SigningAuditLog | Yes | Application Detail Audit History | Application Activity | Yes (all issuer-scoped rows) | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation | Envelope logs ADMIN-role only |
| 114 | `SIGNING_REMINDER_SENT` | SigningAuditLog | Yes | Application Detail Audit History | No (raw-only) | No | No | Generic/unknown fallback | Yes | cutover/schema; visibility; presentation | Envelope logs ADMIN-role only |
| 115 | `NOTE_CREATED` | NoteAuditLog | Yes | Note Detail Audit History | Note Activity (unfiltered all note events) | Yes | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation |  |
| 116 | `NOTE_TERMS_UPDATED` | NoteAuditLog | Yes | Note Detail Audit History | Note Activity (unfiltered all note events) | Conditional (published/listing) | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation |  |
| 117 | `NOTE_PROSPECTUS_REVIEW_CREATED` | NoteAuditLog | Yes | Note Detail Audit History | Note Activity (unfiltered all note events) | No | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation |  |
| 118 | `NOTE_PROSPECTUS_APPROVED` | NoteAuditLog | Yes | Note Detail Audit History | Note Activity (unfiltered all note events) | No | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation |  |
| 119 | `NOTE_PROSPECTUS_INVALIDATED` | NoteAuditLog | Yes | Note Detail Audit History | Note Activity (unfiltered all note events) | No | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation |  |
| 120 | `NOTE_PUBLISHED` | NoteAuditLog | Yes | Note Detail Audit History | Note Activity (unfiltered all note events) | Yes | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation |  |
| 121 | `NOTE_UNPUBLISHED` | NoteAuditLog | Yes | Note Detail Audit History | Note Activity (unfiltered all note events) | Yes | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation |  |
| 122 | `INVESTMENT_COMMITTED` | NoteAuditLog | Yes | Note Detail Audit History | Note Activity (unfiltered all note events) | No | Own org via metadata.investorOrganizationId | activity-presentation.ts | Yes | cutover/schema; visibility; presentation |  |
| 123 | `NOTE_FUNDING_CLOSED` | NoteAuditLog | Yes | Note Detail Audit History | Note Activity (unfiltered all note events) | Yes | If any note_investments row for org (status unfiltered) | activity-presentation.ts | Yes | cutover/schema; visibility; presentation | Investor committed set ignores investment status |
| 124 | `NOTE_FUNDING_FAILED` | NoteAuditLog | Yes | Note Detail Audit History | Note Activity (unfiltered all note events) | Yes | If any note_investments row for org (status unfiltered) | activity-presentation.ts | Yes | cutover/schema; visibility; presentation | Investor committed set ignores investment status |
| 125 | `NOTE_ACTIVATED` | NoteAuditLog | Yes | Note Detail Audit History | Note Activity (unfiltered all note events) | Yes | If any note_investments row for org (status unfiltered) | activity-presentation.ts | Yes | cutover/schema; visibility; presentation | Investor committed set ignores investment status |
| 126 | `NOTE_SERVICING_STATUS_CHANGED` | NoteAuditLog | Yes | Note Detail Audit History | Note Activity (unfiltered all note events) | Yes | If committed + LATE/ARREARS/DEFAULTED | activity-presentation.ts | Yes | cutover/schema; visibility; presentation |  |
| 127 | `NOTE_MARKED_DEFAULT` | NoteAuditLog | Yes | Note Detail Audit History | Note Activity (unfiltered all note events) | Yes | If any note_investments row for org (status unfiltered) | activity-presentation.ts | Yes | cutover/schema; visibility; presentation | Investor committed set ignores investment status |
| 128 | `DISBURSEMENT_INITIATED` | NoteAuditLog | Yes | Note Detail Audit History | Note Activity (unfiltered all note events) | No | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation |  |
| 129 | `DISBURSEMENT_LETTER_GENERATED` | NoteAuditLog | Yes | Note Detail Audit History | Note Activity (unfiltered all note events) | No | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation |  |
| 130 | `DISBURSEMENT_SUBMITTED_TO_TRUSTEE` | NoteAuditLog | Yes | Note Detail Audit History | Note Activity (unfiltered all note events) | No | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation |  |
| 131 | `DISBURSEMENT_BENEFICIARY_UPDATED` | NoteAuditLog | Yes | Note Detail Audit History | Note Activity (unfiltered all note events) | No | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation |  |
| 132 | `DISBURSEMENT_COMPLETED` | NoteAuditLog | Yes | Note Detail Audit History | Note Activity (unfiltered all note events) | Yes | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation |  |
| 133 | `RESIDUAL_RETURN_LETTER_GENERATED` | NoteAuditLog | Yes | Note Detail Audit History | Note Activity (unfiltered all note events) | No | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation |  |
| 134 | `RESIDUAL_RETURN_SUBMITTED_TO_TRUSTEE` | NoteAuditLog | Yes | Note Detail Audit History | Note Activity (unfiltered all note events) | No | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation |  |
| 135 | `RESIDUAL_RETURN_COMPLETED` | NoteAuditLog | Yes | Note Detail Audit History | Note Activity (unfiltered all note events) | Yes | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation |  |
| 136 | `SHORAKA_ORDER_SUBMITTED` | NoteAuditLog | Yes | Note Detail Audit History | Note Activity (unfiltered all note events) | No | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation |  |
| 137 | `SHORAKA_CERTIFICATE_RECEIVED` | NoteAuditLog | Yes | Note Detail Audit History | Note Activity (unfiltered all note events) | No | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation |  |
| 138 | `REPAYMENT_SUBMITTED` | NoteAuditLog | Yes | Note Detail Audit History | Note Activity (unfiltered all note events) | Yes | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation |  |
| 139 | `REPAYMENT_RECEIVED` | NoteAuditLog | Yes | Note Detail Audit History | Note Activity (unfiltered all note events) | Yes | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation |  |
| 140 | `REPAYMENT_REJECTED` | NoteAuditLog | Yes | Note Detail Audit History | Note Activity (unfiltered all note events) | Yes | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation |  |
| 141 | `SETTLEMENT_PREVIEWED` | NoteAuditLog | Yes | Note Detail Audit History | Note Activity (unfiltered all note events) | No | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation |  |
| 142 | `SETTLEMENT_APPROVED` | NoteAuditLog | Yes | Note Detail Audit History | Note Activity (unfiltered all note events) | No | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation |  |
| 143 | `SETTLEMENT_POSTED` | NoteAuditLog | Yes | Note Detail Audit History | Note Activity (unfiltered all note events) | No | If snapshot allocation matches org | activity-presentation.ts | Yes | cutover/schema; visibility; presentation |  |
| 144 | `SERVICE_FEE_TRUSTEE_LETTER_GENERATED` | NoteAuditLog | Yes | Note Detail Audit History | Note Activity (unfiltered all note events) | No | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation |  |
| 145 | `SERVICE_FEE_TRUSTEE_SUBMITTED` | NoteAuditLog | Yes | Note Detail Audit History | Note Activity (unfiltered all note events) | No | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation |  |
| 146 | `SERVICE_FEE_TRUSTEE_COMPLETED` | NoteAuditLog | Yes | Note Detail Audit History | Note Activity (unfiltered all note events) | No | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation |  |
| 147 | `ARREARS_LETTER_GENERATED` | NoteAuditLog | Yes | Note Detail Audit History | Note Activity (unfiltered all note events) | No | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation |  |
| 148 | `DEFAULT_NOTICE_GENERATED` | NoteAuditLog | Yes | Note Detail Audit History | Note Activity (unfiltered all note events) | No | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation |  |
| 149 | `TRUSTEE_SIGNATURE_UPDATED` | NoteAuditLog | Yes | Platform Finance trustee | No (note_id null; formatter exists) | No | No | activity-presentation.ts | Yes | cutover/schema; visibility; presentation | Formatter not in operational allowlist array |
| 150 | `PAYMENT_INITIATED` | PaymentAuditLog | Yes | Gateway Payment timeline (not shared sheet) | No | No | No | Generic/unknown fallback | Yes | cutover/schema; visibility; presentation | Gateway payment uses custom timeline, not AuditLogDetailSheet |
| 151 | `PAYMENT_CAPTURED` | PaymentAuditLog | Yes | Gateway Payment timeline (not shared sheet) | No | No | No | Generic/unknown fallback | Yes | cutover/schema; visibility; presentation | Gateway payment uses custom timeline, not AuditLogDetailSheet |
| 152 | `PAYMENT_FAILED` | PaymentAuditLog | Yes | Gateway Payment timeline (not shared sheet) | No | No | organization_id + organization_kind=INVESTOR match | activity-presentation.ts | Yes | cutover/schema; visibility; presentation | Gateway payment uses custom timeline, not AuditLogDetailSheet |
| 153 | `PAYMENT_EXPIRED` | PaymentAuditLog | Yes | Gateway Payment timeline (not shared sheet) | No | No | organization_id + organization_kind=INVESTOR match | activity-presentation.ts | Yes | cutover/schema; visibility; presentation | Gateway payment uses custom timeline, not AuditLogDetailSheet |
| 154 | `PAYMENT_CAPTURE_MISMATCH_DETECTED` | PaymentAuditLog | Yes | Gateway Payment timeline (not shared sheet) | No | No | No | Generic/unknown fallback | Yes | cutover/schema; visibility; presentation | Gateway payment uses custom timeline, not AuditLogDetailSheet |
| 155 | `PAYMENT_REFUND_INITIATED` | PaymentAuditLog | Yes | Gateway Payment timeline (not shared sheet) | No | No | organization_id + organization_kind=INVESTOR match | activity-presentation.ts | Yes | cutover/schema; visibility; presentation | Gateway payment uses custom timeline, not AuditLogDetailSheet |
| 156 | `PAYMENT_REFUNDED` | PaymentAuditLog | Yes | Gateway Payment timeline (not shared sheet) | No | No | organization_id + organization_kind=INVESTOR match | activity-presentation.ts | Yes | cutover/schema; visibility; presentation | Gateway payment uses custom timeline, not AuditLogDetailSheet |
| 157 | `PAYMENT_REFUND_WALLET_REVERSAL_FAILED` | PaymentAuditLog | Yes | Gateway Payment timeline (not shared sheet) | No | No | No | Generic/unknown fallback | Yes | cutover/schema; visibility; presentation | Gateway payment uses custom timeline, not AuditLogDetailSheet |
| 158 | `PAYMENT_NAME_CHECK_PENDING` | PaymentAuditLog | Yes | Gateway Payment timeline (not shared sheet) | No | No | No | Generic/unknown fallback | Yes | cutover/schema; visibility; presentation | Gateway payment uses custom timeline, not AuditLogDetailSheet |
| 159 | `PAYMENT_NAME_CHECK_APPROVED` | PaymentAuditLog | Yes | Gateway Payment timeline (not shared sheet) | No | No | No | Generic/unknown fallback | Yes | cutover/schema; visibility; presentation | Gateway payment uses custom timeline, not AuditLogDetailSheet |
| 160 | `PAYMENT_NAME_CHECK_REJECTED` | PaymentAuditLog | Yes | Gateway Payment timeline (not shared sheet) | No | No | organization_id + organization_kind=INVESTOR match | activity-presentation.ts | Yes | cutover/schema; visibility; presentation | Gateway payment uses custom timeline, not AuditLogDetailSheet |
| 161 | `INVESTOR_DEPOSIT_RECEIVED` | PaymentAuditLog | Yes | Gateway Payment timeline (not shared sheet) | No | No | organization_id + organization_kind=INVESTOR match | activity-presentation.ts | Yes | cutover/schema; visibility; presentation | Gateway payment uses custom timeline, not AuditLogDetailSheet |
| 162 | `INVESTOR_WITHDRAWAL_REQUESTED` | PaymentAuditLog | Yes | Withdrawal Detail Audit History | No | No | organization_id + organization_kind=INVESTOR match | activity-presentation.ts | Yes | cutover/schema; visibility; presentation |  |
| 163 | `INVESTOR_WITHDRAWAL_LETTER_GENERATED` | PaymentAuditLog | Yes | Withdrawal Detail Audit History | No | No | No | Generic/unknown fallback | Yes | cutover/schema; visibility; presentation |  |
| 164 | `INVESTOR_WITHDRAWAL_BENEFICIARY_UPDATED` | PaymentAuditLog | Yes | Withdrawal Detail Audit History | No | No | No | Generic/unknown fallback | Yes | cutover/schema; visibility; presentation |  |
| 165 | `INVESTOR_WITHDRAWAL_SUBMITTED_TO_TRUSTEE` | PaymentAuditLog | Yes | Withdrawal Detail Audit History | No | No | organization_id + organization_kind=INVESTOR match | activity-presentation.ts | Yes | cutover/schema; visibility; presentation |  |
| 166 | `INVESTOR_WITHDRAWAL_COMPLETED` | PaymentAuditLog | Yes | Withdrawal Detail Audit History | No | No | organization_id + organization_kind=INVESTOR match | activity-presentation.ts | Yes | cutover/schema; visibility; presentation |  |
| 167 | `PAYMENT_RECONCILIATION_EXCEPTION_DETECTED` | PaymentAuditLog | Yes | Reconciliation Audit | No | No | No | Generic/unknown fallback | Yes | cutover/schema; visibility; presentation |  |
| 168 | `PAYMENT_RECONCILIATION_EXCEPTION_RESOLVED` | PaymentAuditLog | Yes | Reconciliation Audit | No | No | No | Generic/unknown fallback | Yes | cutover/schema; visibility; presentation |  |
| 169 | `PRODUCT_CREATED` | ProductAuditLog | Yes | /audit Product | No | No | No | N/A (raw audit only; formatAuditEventLabel) | Yes | cutover/schema; UI source-string |  |
| 170 | `PRODUCT_UPDATED` | ProductAuditLog | Yes | /audit Product | No | No | No | N/A (raw audit only; formatAuditEventLabel) | Yes | cutover/schema; UI source-string |  |
| 171 | `PRODUCT_INACTIVATED` | ProductAuditLog | Yes | /audit Product | No | No | No | N/A (raw audit only; formatAuditEventLabel) | Yes | cutover/schema; UI source-string |  |
| 172 | `PRODUCT_REACTIVATED` | ProductAuditLog | Yes | /audit Product | No | No | No | N/A (raw audit only; formatAuditEventLabel) | Yes | cutover/schema; UI source-string |  |
| 173 | `PRODUCT_DELETED` | ProductAuditLog | Yes | /audit Product | No | No | No | N/A (raw audit only; formatAuditEventLabel) | Yes | cutover/schema; UI source-string |  |
| 174 | `NOTIFICATION_BROADCAST_PROCESSED` | NotificationBroadcastAuditLog | Yes | /audit Notifications | No | No | No | N/A (raw audit only; formatAuditEventLabel) | Yes | UI source-string |  |

---

## Matrix summary counts

- Events: **174**
- Metadata schemas: **174 / 174**
- Typed writers: **174 / 174**
- Admin raw surface assigned: **174 / 174**
- Admin curated Activity: onboarding 15 + application allowlist + signing allowlist + all note events except trustee-signature
- Issuer Activity: onboarding/application/signing/note allowlists + conditionals
- Investor Activity: onboarding subset + note ownership + payment ownership

Row-level "Issue" flags are repeated per event when a module-wide defect applies (for example every Application event inherits the `applications.view` API gap). Unique defects are listed in the chat report section R.
