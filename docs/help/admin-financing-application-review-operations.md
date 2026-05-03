---
title: Financing Application Review — Operations Guide
description: Plain-language steps for operations when approving, rejecting, or requesting changes on issuer financing applications in the admin portal.
category: Application Review
tags:
  - admin
  - operations
order: 11
updated: 2026-05-04
---

## Purpose

This guide is for the operations team. It explains **what you do in the admin portal** when an issuer submits a financing application: how review steps unlock, what **Approve**, **Reject**, and **Request amendment** mean, and how those choices affect the issuer.

It does not cover system internals. For **what to verify** in each area (financials, documents, CTOS, offers, and so on), use the companion guide: [Issuer Application Review Guide](./admin-issuer-application-flow.md).

## Big picture

1. The issuer completes and submits a financing application.
2. You open it in the admin portal and work through the **tabs** (sections) the product requires.
3. For each section—or for individual **rows** inside a section (such as one invoice or one document)—you record a review outcome.
4. Some tabs stay locked until earlier tabs are approved. You cannot skip ahead.
5. When everything required is approved, you may send **contract** and **invoice** offers where the product requires them. The issuer then accepts, signs, or rejects those offers on their side.
6. The case finishes when required offers are accepted or signed, or when the application is **rejected** or **withdrawn**.

## Sections and line items

- **Section (tab):** A whole area of the application, for example company details or contract details.
- **Line item:** A single row inside a section that has many rows, for example one uploaded document or one invoice.

Documents and invoices are reviewed **per line item**. Approving or changing one document does not automatically fix another. Use the exact row that needs attention.

## What “Approve” means

- **Approve a section:** You are satisfied that this whole tab meets requirements. It counts toward unlocking the next stage.
- **Approve a line item:** You are satisfied with that one document or invoice. The section’s overall state follows from its items.

Approving a section does not replace item-level work where the product expects item-by-item review.

## What “Reject” means

- **Reject a section or item:** You are recording that this part does **not** pass review. Use this when the problem is serious or final for that piece of the application—not when the issuer can simply upload a clearer file or fix a typo.

If the issuer should **fix and resubmit** something, prefer **Request amendment** (see below) so they get clear instructions.

- **Reject the whole application:** Stops the case. The issuer cannot continue this application as a live financing request. Use this when the business decision is to close the file, not when you only need corrections.

## What “Request amendment” means

Use this when the issuer can **correct, replace, or clarify** information.

**How it works in practice:**

1. Add a **clear remark** on the exact section or line item that needs work. Say what is wrong and what you need (for example: “Replace invoice PDF; first page is unreadable.”).
2. When all remarks are ready, use **Request amendment** (send to issuer) so they are delivered together. Until you send, remarks can be grouped and checked.
3. After sending, the application shows as **Amendment requested** on your side. The issuer sees that they must take action. They can edit **only** the parts you flagged, confirm they have addressed each point, and **resubmit**.
4. After resubmission, you get a **new review round**. Compare what changed against your earlier remarks before approving again.

Use amendments for fixable issues. Use rejection when the file should not proceed.

## Order of work (gating)

You cannot approve or send offers in a random order.

- Typically you can start with **financial**, **company**, **business**, and **documents**.
- **Contract or customer** review becomes available after those are in good shape.
- **Invoice** review becomes available after prerequisites and contract or customer review are approved, when the product includes those steps.
- **Final application approval** is only possible when **every required section** is approved.

If a tab is locked, finish the earlier tabs first. The [Issuer Application Review Guide](./admin-issuer-application-flow.md) describes exceptions (for example existing contracts that skip some steps).

## Offers after review

- **Contract offer:** Facility- or contract-level terms. Send only when customer or paymaster details and upstream review are correct. Issuer must accept or sign before invoices that depend on that contract can be treated as approved at facility level.
- **Invoice offer:** Per-invoice terms. Send when that invoice row is ready. Offered amounts and dates must fit product rules. If an invoice was rejected earlier, it usually needs to be set back to a pending state before a new offer can be sent—follow what the portal allows on that row.

Do not send an offer until the portal shows the right tab unlocked and you have confirmed the numbers and parties.

## Status cheat sheet (admin list)

| What you see (approx.) | What it means for you |
|------------------------|------------------------|
| Draft | Issuer still editing. Nothing for you to approve yet. |
| Submitted / Under review | Ready for your section and item reviews. |
| Contract pending / Invoice pending | Upstream review done; contract or invoice stage is active. Next step is often to send or finish offers. |
| Amendment requested | Waiting on issuer to fix flagged items and resubmit. |
| Resubmitted | Issuer sent changes back. Start a new review pass. |
| Contract sent / Invoices sent | Offers are with the issuer; wait for accept, sign, or reject. |
| Approved / Completed | Required outcomes are met for this application. |
| Withdrawn / Rejected / Archived | Case is closed; no further progression on this application. |

Issuer-facing labels (for example “Action required” or “Offer received”) differ from admin filters; both refer to the same underlying stage. If an issuer calls and describes their screen, use the [Issuer Application Review Guide](./admin-issuer-application-flow.md) status list to align language.

## Practical tips for the team

- Write amendment notes so someone unfamiliar with the file could act on them without a phone call.
- One remark per problem area reduces confusion.
- Pull fresh credit or company data when directors, shareholders, or company facts changed since the last approval (details in the issuer review guide).
- Use the **activity** or **audit** views if your deployment includes them, to see who approved or sent what and when ([Admin audit and activity logs](./admin-audit-and-activity-logs.md)).

## Related guides

- [Issuer Application Review Guide](./admin-issuer-application-flow.md) — checklist of what to verify per tab, CTOS, KYC, guarantors, offers.
- [Admin onboarding flow](./admin-onboarding-flow.md) — separate process for account onboarding before issuers can apply.
