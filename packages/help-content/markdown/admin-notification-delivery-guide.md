---
title: Notification Delivery Guide
description: Complete reference for registered notification types—triggers, recipients, channels, and portal scope.
category: Platform Operations
tags:
  - admin
order: 20
updated: 2026-05-13
---

## Purpose

Use this guide when checking what end users receive from CashSouk notifications. Notifications can appear in the portal notification list, be sent by email, or both, depending on the notification type, global settings in Notification Management, per-user preferences (where the type is user-configurable), and in some cases hard-coded send paths (for example note lifecycle helpers always deliver to the platform inbox only).

## How channels work

- **Platform** means the notification appears in the user's portal notification center and unread badge for the relevant portal scope.
- **Email** means the notification is sent to the user's account email when the send path allows it and type-level email is enabled.
- Admins can globally enable or disable platform and email delivery for each notification type in **Settings → Notification Management → Configuration**.
- For **user-configurable** types, recipients can also turn platform or email off in their own preferences. Non-configurable types follow the global type defaults (and any non-overridable send flags in code).
- If both platform and email are off for a recipient for a given send, the notification is skipped.
- **Portal scope** comes from each type's configured targets (issuer-only, investor-only, or both). Issuer application and offer notifications appear in the issuer portal; investor-only types in the investor portal; authentication and onboarding types apply to both portals where configured.

## Who receives org-scoped notifications

- **Issuer financing application and commercial offers:** the issuer organization's **owner** plus organization members whose role is **Owner** or **Organization Admin**. Other issuer members do not receive these notifications.
- **Issuer note lifecycle events:** the issuer organization's **owner** plus **every** user linked as a member of that issuer organization.
- **Investor note lifecycle events:** every member of each **investor organization** that has a qualifying investment on the note (normally **confirmed** commitments; settlement-posted uses the investor organizations captured for that settlement).

## Automated vs manual vs registered-only

- **Automatic:** sent by application code when the described business event happens (subject to channel preferences).
- **Manual:** sent by an admin from Notification Management (Custom & Groups).
- **Registered only:** the type exists in Notification Management and the template registry, but **no production sender** currently calls it. These may still appear in configuration and can be used for future wiring or admin test sends.

---

## Authentication

| Type ID | Name | Portal scope (seed) | Default channels (seed) | User configurable | Delivery | Sent when | Recipient |
| ------- | ---- | -------------------- | ------------------------- | ----------------- | -------- | --------- | --------- |
| `password_changed` | Password Changed | Investor + Issuer | Platform + email | No | Automatic | User successfully changes password (`AuthService`). | That user. |
| `login_new_device` | Login from New Device | Investor + Issuer | Platform + email | Yes | Registered only | No automatic sender today. | Intended: that user. |

---

## Onboarding and identity

| Type ID | Name | Portal scope (seed) | Default channels (seed) | User configurable | Delivery | Sent when | Recipient |
| ------- | ---- | -------------------- | ------------------------- | ----------------- | -------- | --------- | --------- |
| `onboarding_approved` | Onboarding Approved | Investor + Issuer | Platform + email | No | Automatic | Admin completes final onboarding approval (`AdminService`). | Onboarding user. |
| `onboarding_rejected` | Onboarding Rejected | Investor + Issuer | Platform + email | No | Automatic | RegTank webhooks reject individual or COD onboarding (`cod-handler`, `individual-onboarding-handler`). | Onboarding user. |
| `kyc_approved` | KYC Approved | Investor + Issuer | Platform + email | No | Registered only | No automatic sender today. | Intended: that user. |
| `kyc_rejected` | KYC Rejected | Investor + Issuer | Platform + email | No | Registered only | No automatic sender today. | Intended: that user. |

---

## Issuer application and offers

| Type ID | Name | Portal scope (seed) | Default channels (seed) | User configurable | Delivery | Sent when | Recipient |
| ------- | ---- | -------------------- | ------------------------- | ----------------- | -------- | --------- | --------- |
| `application_amendments_requested` | Application Amendments Requested | Issuer | Platform + email | Yes | Automatic | Admin submits pending amendments (`AdminService`). | Issuer org owner + Owner/Org Admin members. |
| `application_approved` | Application Approved | Issuer | Platform + email | Yes | Automatic | Admin sets application to approved (`AdminService`). | Issuer org owner + Owner/Org Admin members. |
| `application_rejected` | Application Rejected | Issuer | Platform + email | Yes | Automatic | Admin sets application to rejected (`AdminService`). | Issuer org owner + Owner/Org Admin members. |
| `contract_offer_sent` | Contract Offer Sent | Issuer | Platform + email | Yes | Automatic | Admin sends contract offer (`AdminService`). | Issuer org owner + Owner/Org Admin members. |
| `invoice_offer_sent` | Invoice Offer Sent | Issuer | Platform + email | Yes | Automatic | Admin sends invoice offer (`AdminService`). | Issuer org owner + Owner/Org Admin members. |
| `offer_retracted_or_reset` | Offer Retracted or Reset | Issuer | Platform only (email off in seed) | Yes | Automatic | Admin retracts or resets a sent contract or invoice offer (`AdminService`). | Issuer org owner + Owner/Org Admin members. |
| `offer_expired` | Offer Expired | Issuer | Platform + email | Yes | Automatic | Offer expiry job withdraws an expired offer (`lib/jobs/offer-expiry`). | Issuer org owner + Owner/Org Admin members. |
| `offer_expiry_reminder_24h` | Offer Expiry Reminder (24h) | Issuer | Platform + email | Yes | Automatic | Offer expiry job finds an offer expiring within 24 hours (`lib/jobs/offer-expiry`). | Issuer org owner + Owner/Org Admin members. |
| `application_resubmitted_confirmation` | Application Resubmitted Confirmation | Issuer | Platform only (email off in seed) | Yes | Automatic | Issuer resubmits after amendments (`ApplicationService`). | Issuer org owner + Owner/Org Admin members. |
| `application_withdrawn_confirmation` | Application Withdrawn Confirmation | Issuer | Platform only (email off in seed) | Yes | Automatic | Issuer withdraws or paths that withdraw the application (`ApplicationService`). | Issuer org owner + Owner/Org Admin members. |
| `application_completed` | Application Completed | Issuer | Platform only (email off in seed) | Yes | Automatic | Application reaches completed status (`ApplicationService`). | Issuer org owner + Owner/Org Admin members. |

---

## Directors and shareholders (issuer)

| Type ID | Name | Portal scope (seed) | Default channels (seed) | User configurable | Delivery | Sent when | Recipient |
| ------- | ---- | -------------------- | ------------------------- | ----------------- | -------- | --------- | --------- |
| `director_shareholder_action_required` | Director/Shareholder Action Required | Issuer | Platform + email | No | Automatic | After a new issuer organization CTOS snapshot shows individuals needing onboarding; also via `notifyIssuerDirectorShareholderActionRequired` (`director-shareholder-notifications`). | **Organization owner** (current senders). |
| `director_shareholder_mismatch` | Directors/Shareholders Update Required | Issuer | Platform + email | No | Registered only | Type and resolution hooks exist (`director-shareholder-notifications` resolves stale rows); **no current create/send path**. | N/a for new sends. |

---

## Note lifecycle (issuer)

All rows below are sent with **`sendTypedPlatformOnly`**: email is suppressed at send time regardless of user preferences. Seed defaults are platform-only for email as well.

| Type ID | Name | Portal scope (seed) | Default channels (seed) | User configurable | Delivery | Sent when | Recipient |
| ------- | ---- | -------------------- | ------------------------- | ----------------- | -------- | --------- | --------- |
| `note_published` | Note published | Issuer | Platform only | Yes | Automatic | Note published to marketplace (`NoteService` → `notifyNotePublished`). | Issuer org owner + all issuer org members. |
| `note_funding_succeeded` | Note funding succeeded | Issuer | Platform only | Yes | Automatic | Funding closes successfully (`notifyNoteFundingSucceeded`). | Issuer org owner + all issuer org members. |
| `note_funding_failed_issuer` | Note funding failed | Issuer | Platform only | Yes | Automatic | Funding fails minimum threshold (`notifyNoteFundingFailed`). | Issuer org owner + all issuer org members. |
| `note_active_issuer` | Note active | Issuer | Platform only | Yes | Automatic | Note becomes active after disbursement path (`notifyNoteActivated`). | Issuer org owner + all issuer org members. |
| `note_repaid_issuer` | Note repaid | Issuer | Platform only | Yes | Automatic | Issuer-side full repayment / repaid signal (`notifyNoteIssuerRepaid`). | Issuer org owner + all issuer org members. |
| `note_arrears` | Note in arrears | Issuer | Platform only | Yes | Automatic | Note enters arrears (`notifyNoteArrears`). | Issuer org owner + all issuer org members. |
| `note_defaulted` | Note defaulted (issuer) | Issuer | Platform only | Yes | Automatic | Note marked defaulted (`notifyNoteDefaulted`). | Issuer org owner + all issuer org members. |

---

## Note lifecycle (investor)

Same **platform-only send path** as issuer note events (`sendTypedPlatformOnly`).

| Type ID | Name | Portal scope (seed) | Default channels (seed) | User configurable | Delivery | Sent when | Recipient |
| ------- | ---- | -------------------- | ------------------------- | ----------------- | -------- | --------- | --------- |
| `note_funding_failed_investor` | Note funding failed | Investor | Platform only | Yes | Automatic | Listing did not complete; commitment released (`notifyNoteFundingFailed`). | All members of each affected investor organization (organizations passed into failure handler). |
| `note_active_investor` | Note active | Investor | Platform only | Yes | Automatic | Note activated (`notifyNoteActivated` to confirmed investors). | Investor orgs with **confirmed** investments on the note. |
| `note_payment_received` | Note repayment recorded | Investor | Platform only | Yes | Automatic | Repayment recorded on note (`notifyNotePaymentReceived`). | Confirmed investors on the note. |
| `note_settlement_posted` | Note settlement posted | Investor | Platform only | Yes | Automatic | Settlement posted (`notifyNoteSettlementPosted`). | Members of investor organizations included in that settlement batch. |
| `note_arrears_investor` | Note in arrears | Investor | Platform only | Yes | Automatic | Note in arrears (`notifyNoteArrears`). | Confirmed investors on the note. |
| `note_defaulted_investor` | Note defaulted | Investor | Platform only | Yes | Automatic | Note marked defaulted (`notifyNoteDefaulted`). | Confirmed investors on the note. |

---

## Withdrawals and finance

| Type ID | Name | Portal scope (seed) | Default channels (seed) | User configurable | Delivery | Sent when | Recipient |
| ------- | ---- | -------------------- | ------------------------- | ----------------- | -------- | --------- | --------- |
| `withdrawal_submitted_to_trustee` | Withdrawal submitted to trustee | Investor + Issuer | Platform only (email off in seed) | Yes | Registered only | Template and type exist; **no `sendTyped` caller** in the API today (timeline may log the event separately). | Intended: withdrawing user (per future wiring). |

---

## Admin-sent (manual) notifications

Admins send these from **Notification Management → Custom & Groups**.

| Type ID | Name | Portal scope (seed) | Default channels (seed) | User configurable | Typical use | Recipients |
| ------- | ---- | -------------------- | ------------------------- | ----------------- | ----------- | ---------- |
| `system_announcement` | System Announcement | Investor + Issuer | Platform + email | Yes | Platform updates, maintenance, operations. | Admin-selected audience (all users, investors, issuers, specific IDs, saved groups). |
| `new_product_alert` | New Product Alert | Investor | Platform + email | Yes | New product or listing announcements. | Usually investors or investor groups. |

Custom sends are recorded under **Notification Logs** (admin-initiated audit). Automated lifecycle notifications create rows in user inboxes but do not rely on that log for delivery audit.

---

## Admin checks

- Use **Notification Management → Configuration** for global platform and email defaults per type.
- Use **Custom & Groups** for broadcasts and saved recipient groups.
- Use **Notification Logs** for admin-initiated sends only—not as a full trace of every automated lifecycle notification.
- For **application and offer** notifications, recipients are the issuer **owner** plus **Owner** and **Organization Admin** members—not every issuer org member.
- For **note** notifications, recipients include **all** members on the issuer or investor organization side as implemented in org member resolution.
- Prefer this article plus source modules (`apps/api/src/modules/notification/registry.ts`, `seed-data.ts`, and service call sites) when validating a type is automatic vs manual.
