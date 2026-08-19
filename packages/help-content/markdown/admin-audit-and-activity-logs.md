---
title: Audit and Activity Logs Guide
description: Where admins can find access, security, product, organization, and application logs, plus where legal acceptance evidence lives.
category: Platform Operations
tags:
  - admin
order: 30
updated: 2026-08-20
---

## Purpose

Use this guide to understand which admin log to check when investigating user access, security-sensitive account changes, product configuration changes, onboarding history, or issuer application review activity.

Legal document acceptance evidence is not an Audit tab. Use Legal Acceptances for that.

Audit rows are history. They are not the current workflow, payment, or review state.

## Audit Pages

Global audit lives at `/audit`. Tabs use the shared list toolbar and current event-type filters.

| Log | Admin Location | What It Shows | Common Triggers |
| --- | -------------- | ------------- | --------------- |
| Access | Audit → Access (`/audit?tab=access`) | Successful signup, login, and logout with user, portal, IP, and device. Access is success-only. | `USER_SIGNED_UP`, `USER_LOGGED_IN`, `USER_LOGGED_OUT` |
| Security | Audit → Security (`/audit?tab=security`) | Security-sensitive account, invitation, membership, and notification-config events, including access denial and failed password/email verification. | Role changes, invitations, org membership, `ADMIN_ACCESS_DENIED`, password/email failures |
| Onboarding | Audit → Onboarding (`/audit?tab=onboarding`) | Organization onboarding and compliance history. | Start, restart, status changes, approvals, director KYC outcomes |
| Product | Audit → Product (`/audit?tab=products`) | Product lifecycle changes with a metadata snapshot. | Created, updated, inactivated, reactivated, deleted |
| Legal Documents | Audit → Legal Documents (`/audit?tab=legal-documents`) | Admin legal-document definition and version lifecycle. | Upload, publish, archive, restore |
| Notifications | Audit → Notifications (`/audit?tab=notifications`) | Admin bulk-notification send history. | `NOTIFICATION_BROADCAST_PROCESSED` |

The audit pages support search, event-type filtering, date-range filtering, and export where the page exposes it. Access has no success/failure status filter.

There is no Document Logs audit tab. SiteDocument and DocumentLog were removed.

Failed admin portal access is a Security event (`ADMIN_ACCESS_DENIED`), not Access.

## Legal Documents and Acceptances

| Area | Admin Location | What It Shows |
| ---- | -------------- | ------------- |
| Legal Documents | Legal Documents (`/legal-documents`) plus Audit → Legal Documents | LegalDocument definitions and LegalDocumentVersion lifecycle (draft, published, archived), audience, onboarding/public/show-in-account visibility. |
| Legal Acceptances | Legal Acceptances (`/legal-document-acceptances`) | Immutable acceptance evidence: document type, exact version, file hash, organization, user, timestamp, IP, user agent, acknowledgement wording, and exact-version PDF download. |

Permissions: `document_management.view` and `document_management.manage` (manage is for Legal Documents mutations only; acceptances are read-only).

## Organization Activity

Organization detail **Activity** is not a single mixed audit log.

On **investor** organizations the tab shows two panels:

1. **Wallet Activity** (first) — cash statement for that organization (`GET /v1/admin/organizations/investor/:id/balance-activity`). Posted wallet rows plus in-flight deposits that have not credited available cash yet. This is operational money, not Audit History and not `PaymentAuditLog`.
2. **Onboarding activity** (below) — curated onboarding timeline for that organization.

On **issuer** organizations the tab is the onboarding timeline only.

Use the onboarding timeline for:

- Onboarding start, restart, rejection, approval, completion, and review/amendment status changes.
- Admin actions such as final onboarding approval, AML approval, SSM approval, onboarding restart, or organization profile updates.
- Investor-specific sophisticated status changes.
- Issuer director invitation and director verification outcomes.

The onboarding timeline is best for answering "what happened to this organization's onboarding?" rather than searching across all users. Raw onboarding history for every organization is Audit → Onboarding. Wallet rows answer "what happened to this investor's cash?"

## Application Activity

Issuer application detail pages show **two** surfaces:

- **Activity** — curated review and offer milestones (`RecentActivityCard`).
- **Audit History** — raw application audit rows for the same application.

Signing package history is stored separately (`SigningAuditLog`) and is merged into the curated application timeline reader.

Use the application timeline for:

- Application creation, submission, resubmission, rejection, withdrawal, completion, and reopen for review.
- Amendment requests sent to the issuer.
- Facility and invoice offer events, including sent, acceptance submitted/resubmitted, approved for signing, accepted, rejected, retracted, withdrawn, and expired.
- Signing package sent / declined / expired (package completed is stored for audit; the admin curated timeline hides `SIGNING_PACKAGE_COMPLETED` and shows offer accepted instead).

Section and item review decisions are written as `APPLICATION_SECTION_REVIEW_UPDATED` and `APPLICATION_ITEM_REVIEW_UPDATED`. Item-level rows stay on raw Audit History. Section-level rows appear in curated Activity only when the new status is amendment-required.

There is no live `APPLICATION_APPROVED` application audit event. Starting under-review writes `APPLICATION_REVIEW_STARTED`.

## Note, payment, and finance

- Note detail: curated note timeline plus raw Note Audit History (`notes.view`).
- Gateway payment detail: `PaymentAuditLog` timeline (`gateway_payments.view`). Provider webhook records are not business audit history. In-flight deposits on the investor org Activity tab are wallet overlay rows, not this timeline.
- Investor withdrawals: withdrawal detail Audit History (`investor_withdrawals.view`).
- Reconciliation exceptions: recon Audit History (`gateway_reconciliation.view`).
- Platform finance trustee signature: Note audit history (`platform_settings.view`).

## Notification Logs

Notification Management links to Audit → Notifications for admin-sent custom broadcasts. These logs record the sending admin, audience counts, notification type, message, IP, and device.

Use notification logs for broadcast or one-time custom sends. Automated lifecycle notifications create user notifications, but the notification log view is for admin-initiated sends.

## Choosing the Right Log

| Question | Start Here |
| -------- | ---------- |
| Did this user sign in, sign up, or log out? | Audit → Access |
| Did admin portal access fail? | Audit → Security (`ADMIN_ACCESS_DENIED`) |
| Did this account have a password, email, profile, role, invitation, or membership change? | Audit → Security |
| Who published or archived a legal document version? | Audit → Legal Documents (history) plus Legal Documents (current state); acceptances for user evidence |
| Did a user accept a specific legal document version? | Legal Acceptances |
| Who changed a product or workflow configuration? | Audit → Product |
| What happened during this organization's onboarding? | Organization detail → Activity (Onboarding activity panel), or Audit → Onboarding |
| What happened to this investor's cash? | Organization detail → Activity (Wallet Activity panel). This is not Audit History. |
| What happened during this issuer application review? | Application detail → Activity, then Audit History |
| Who sent a custom notification? | Audit → Notifications |

## Reading Log Metadata

- IP address and device fields identify where the action came from. Treat them as investigative signals, not proof of identity by themselves.
- Metadata contains the business context for the event, such as target user, previous and new values, review section, invoice number, offer amount, or workflow snapshot.
- Some logging is best-effort. If a non-critical log write fails, the business action may still complete.
- Contextual timelines may show a cleaner activity label than the raw event type. Export or detail views preserve the underlying metadata for deeper review.
