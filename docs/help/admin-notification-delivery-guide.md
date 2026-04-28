---
title: Notification Delivery Guide
description: What notifications are sent, when they are triggered, who receives them, and which channels are used.
category: Platform Operations
tags:
  - admin
order: 20
updated: 2026-04-28
---

## Purpose

Use this guide when checking what users receive from CashSouk notifications. Notifications can appear in the portal notification list, be sent by email, or both, depending on the notification type, global settings, and the user's preferences.

## How Channels Work

- Platform means the notification appears in the user's portal notification center and unread badge.
- Email means the notification is sent immediately to the user's account email address.
- Admins can globally enable or disable platform and email delivery for each notification type in Notification Management.
- User-configurable notification types can also be disabled by the recipient in their preferences.
- If both platform and email are disabled for a recipient, the notification is skipped.
- Portal scope controls where the notification appears. Issuer application notifications are scoped to the issuer portal, investor notifications to the investor portal, and shared account notifications to both portals.

## Automated Notifications

| Notification                     | Sent When                                                                                                                                             | Recipient                                          | Channel           |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ----------------- |
| Password Changed                 | A user successfully changes their account password.                                                                                                   | The user who changed the password.                 | Platform + email. |
| Onboarding Approved              | Admin completes final onboarding approval for an investor or issuer organization.                                                                     | The onboarding user.                               | Platform + email. |
| Onboarding Rejected              | RegTank individual or COD rejection webhook rejects the onboarding organization.                                                                      | The onboarding user.                               | Platform + email. |
| Application Amendments Requested | Admin submits amendment requests during application review.                                                                                           | Issuer organization owner and organization admins. | Platform + email. |
| Application Approved             | Admin marks the issuer application as approved.                                                                                                       | Issuer organization owner and organization admins. | Platform + email. |
| Application Rejected             | Admin marks the issuer application as rejected.                                                                                                       | Issuer organization owner and organization admins. | Platform + email. |
| Contract Offer Sent              | Admin sends a contract offer for an approved application.                                                                                             | Issuer organization owner and organization admins. | Platform + email. |
| Invoice Offer Sent               | Admin sends an invoice offer for an approved invoice.                                                                                                 | Issuer organization owner and organization admins. | Platform + email. |
| Offer Updated                    | Admin retracts or resets a previously sent contract or invoice offer.                                                                                 | Issuer organization owner and organization admins. | Platform only.    |
| Offer Expiring Soon              | The offer-expiry job finds a contract or invoice offer expiring within 24 hours.                                                                      | Issuer organization owner and organization admins. | Platform + email. |
| Offer Expired                    | The offer-expiry job withdraws an expired contract or invoice offer.                                                                                  | Issuer organization owner and organization admins. | Platform + email. |
| Application Resubmitted          | Issuer resubmits an application after completing requested amendments.                                                                                | Issuer organization owner and organization admins. | Platform only.    |
| Application Withdrawn            | Issuer withdraws an application, rejects a contract offer that withdraws the application, or rejects an invoice offer that withdraws the application. | Issuer organization owner and organization admins. | Platform only.    |
| Application Completed            | Issuer accepts or completes the required contract or invoice flow and the application reaches completed status.                                       | Issuer organization owner and organization admins. | Platform only.    |

## Admin-Sent Notifications

Admins can send one-time custom notifications from Notification Management.

| Type                | Typical Use                                                          | Recipients                                                         | Channel                                 |
| ------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------- |
| System Announcement | Platform updates, maintenance notices, or operational announcements. | All users, investors, issuers, specific user IDs, or saved groups. | Admin chooses platform, email, or both. |
| New Product Alert   | Announcing a new investment opportunity.                             | Usually investors, specific user IDs, or saved investor groups.    | Admin chooses platform, email, or both. |

Custom notifications are recorded in the notification logs with the sending admin, target type, recipient count, timestamp, IP address, device, title, and message.

## Configured But Not Currently Automatic

Some notification types are registered and can be configured, but there is no current automatic sender path for them:

- Login from New Device
- KYC Approved
- KYC Rejected

These types should not be treated as active automated alerts until the related sender flow is implemented.

## Admin Checks

- Use Notification Management > Configuration to confirm the global platform and email switches for each type.
- Use Notification Management > Custom & Groups for one-time announcements and saved recipient groups.
- Use Notification Management > Notification Logs to audit custom sends. Automated lifecycle notifications create user notifications, but the admin log view is for admin-initiated custom sends.
- For issuer application notifications, remember that recipients are the issuer organization owner plus members with Owner or Organization Admin roles.
