---
title: Notifications
description: How CashSouk notifications work, what users receive, and how to turn portal and email alerts on or off.
category: Platform Operations
tags:
  - admin
  - notifications
order: 19
updated: 2026-08-26
---

## What notifications are

CashSouk can alert issuers and investors in two ways:

- **On the platform** — a message in the portal bell and notifications list
- **By email** — the same update sent to the account email address

Most alerts can be turned on or off for the whole platform. **Password changed** alerts always go out both ways. That is a security requirement and cannot be switched off.

Custom announcements you send from this page are separate from the automatic alerts below. Invitation emails, signing links, and one-time codes are also sent separately and are not controlled here.

## How to manage them

Open **Settings → Notifications**.

1. Use the **Investor**, **Issuer**, or **Both** filter to find the right list.
2. Use **Platform** to show or hide the in-portal message.
3. Use **Email** to send or stop the matching email.
4. If both switches are off, that alert is not sent at all.

**Reset to default** turns Platform and Email back on for every type and adds any types that are missing. Confirm in the popup before you continue.

Delivery history is under **Audit → Notifications**, not on this settings page. **Admin** rows are broadcasts you sent. **System** rows are automatic alerts. **Recipients** is how many people we tried to reach. **Delivery** is how many of those were selected for the portal or for email — it is not proof that an email was opened.

## What issuers receive

Issuers hear from CashSouk when:

- Their account is approved or rejected
- Their password is changed
- A financing application needs changes, is rejected, is resubmitted, is withdrawn, or is completed
- Acceptance documents need updates
- A facility or invoice offer is sent, pulled back, about to expire, or has expired
- A director or shareholder still needs to finish onboarding
- An upfront facility fee is due or has been paid
- Late payment charges are due or have been received
- A note is published, funded, fails to fund, becomes active, is repaid, falls into arrears, or is marked in default
- A withdrawal has been submitted to the trustee
- CashSouk sends a general announcement

## What investors receive

Investors hear from CashSouk when:

- Their account is approved or rejected
- Their password is changed
- A director or shareholder still needs to finish onboarding
- A note they reserved fails to fund, becomes active, records a repayment, posts a settlement, falls into arrears, or is marked in default
- A withdrawal has been submitted to the trustee
- CashSouk announces a new product or sends a general announcement

## Custom messages

Use **Custom & Groups** to send a one-off message to all users, investors only, issuers only, specific people, or a saved group. You choose the title, message, optional link, and whether it goes to the portal, email, or both. Review the summary in the confirmation dialog before the message is sent.

That send appears in **Audit → Notifications** as **one Admin row**, with the recipient count for the whole audience. People who received it still see the message in their own portal; the log does not list each person on a separate line.
