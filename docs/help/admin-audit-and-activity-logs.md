---
title: Audit and Activity Logs Guide
description: Where admins can find access, security, document, product, organization, and application logs.
category: Platform Operations
tags:
  - admin
order: 30
updated: 2026-04-28
---

## Purpose

Use this guide to understand which admin log to check when investigating user access, security-sensitive account changes, document changes, product configuration changes, onboarding history, or issuer application review activity.

## Audit Pages

| Log           | Admin Location        | What It Shows                                                                                                                  | Common Triggers                                                                                                                                                                           |
| ------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Access Logs   | Audit > Access Logs   | Authentication and access events with user, portal, IP address, device, success status, and metadata.                          | Login, signup, logout, failed admin portal access, and selected admin access actions.                                                                                                     |
| Security Logs | Audit > Security Logs | Security-sensitive account events with user, IP address, device, and metadata.                                                 | Password changes, email verification changes, role additions, role switches, and profile updates. Failed password or email verification attempts are also recorded with failure metadata. |
| Document Logs | Audit > Document Logs | Admin changes to site documents with document ID, event type, IP address, device, and metadata.                                | Document created, metadata updated, file replaced, archived, or restored.                                                                                                                 |
| Product Logs  | Audit > Product Logs  | Product lifecycle changes with product ID, admin, IP address, device, and a metadata snapshot of the product workflow/version. | Product created, updated, or deleted.                                                                                                                                                     |

The audit pages support search, event-type filtering, date-range filtering, and export where the page exposes it. Use the exported file when a review needs evidence outside the admin portal.

## Organization Activity

Organization detail pages show an activity timeline for onboarding and organization review history. This is separate from the sidebar Audit pages and is filtered to the organization being viewed.

Use the organization timeline for:

- Onboarding start, resume, cancellation, reset, rejection, and status updates.
- RegTank KYC, KYB, AML, COD, and SSM/T&C approval milestones when those flows write onboarding logs.
- Admin actions such as final onboarding approval, AML approval, SSM approval, onboarding approval, or onboarding restart/cancellation.
- Investor-specific sophisticated status changes.

The timeline is best for answering "what happened to this organization?" rather than searching across all users.

## Application Activity

Issuer application detail pages show a recent activity timeline for the selected application. This is application-scoped and records review decisions and offer lifecycle events.

Use the application timeline for:

- Application creation, submission, resubmission, approval, rejection, withdrawal, completion, and reset to under review.
- Section-level review decisions: approved, rejected, amendment requested, or reset to pending.
- Item-level review decisions for invoices and supporting documents.
- Amendment request submission and issuer resubmission history.
- Contract and invoice offer events, including sent, accepted, rejected, retracted, withdrawn, and expired.
- Admin remarks, review cycle information, IP address, device, and structured metadata where available.

This timeline is the most reliable place to reconstruct the review path for a specific issuer financing application.
If the activity timeline is unavailable, ask support to verify that the application log access path is enabled for admin reviewers.

## Notification Logs

Notification Management has its own logs for admin-sent custom notifications. These logs record the sending admin, recipient target, recipient count, notification type, message, IP address, and device.

Use notification logs for broadcast or one-time custom sends. Automated lifecycle notifications create user notifications, but the notification log view is for admin-initiated sends.

## Choosing the Right Log

| Question                                                          | Start Here                                   |
| ----------------------------------------------------------------- | -------------------------------------------- |
| Did this user sign in, sign up, log out, or fail admin access?    | Access Logs                                  |
| Did this account have a password, email, profile, or role change? | Security Logs                                |
| Who changed a public/site document?                               | Document Logs                                |
| Who changed a product or workflow configuration?                  | Product Logs                                 |
| What happened during this organization's onboarding?              | Organization detail > Activity               |
| What happened during this issuer application review?              | Application detail > Recent Activity         |
| Who sent a custom notification?                                   | Settings > Notifications > Notification Logs |

## Reading Log Metadata

- IP address and device fields identify where the action came from. Treat them as investigative signals, not proof of identity by themselves.
- Metadata contains the business context for the event, such as target user, previous and new values, review section, invoice number, offer amount, or workflow snapshot.
- Some logging is best-effort. If a non-critical log write fails, the business action may still complete.
- Contextual timelines may show a cleaner activity label than the raw event type; export or detail views preserve the underlying metadata for deeper review.
