---
title: Facility and Invoice Fee Configuration
description: How to set facility fees, drawdown fees, and extra invoice fees, and how those fees are collected, waived, or paused.
category: Application Review
tags:
  - admin
  - fees
  - facility
  - invoices
order: 12
updated: 2026-08-23
---

## Overview

Use this guide when you are sending a facility offer or an invoice offer, or when you need to waive a fee or pause a facility.

CashSouk charges two kinds of financing fee:

- A **facility fee** is a one-off charge for approving a line of credit. It is owed in full when the issuer accepts the facility offer. You choose later how much of it to collect on each successful invoice drawdown.
- A **drawdown fee** is a percentage of the money investors actually put into that invoice. It is taken only if the note funds successfully.

You can also add **named extra fees** on an invoice offer, such as a legal fee. Those are agreed with the issuer before they accept, then taken from the disbursement if funding succeeds.

Nothing is charged if the note fails to fund.

## Facility fee

Set the facility fee rate on the **facility offer**. The allowed range is **0% to 1%**, with up to two decimal places. Use 0% if you do not want to charge a facility fee.

When the issuer accepts, the portal records the **full amount owed** as approved facility × rate. For example, a RM 10 million facility at 1% owes RM 100,000, even if the issuer later draws only part of the line.

That amount is legally due on acceptance. Collection is flexible: you decide, invoice by invoice, how much of the remaining balance to take from a successful disbursement. You do not have to collect anything on a given invoice.

On the facility page you will see **owed**, **charged**, **waived**, and **remaining**.

Invoice-only applications have no facility, so they have no facility fee.

## Drawdown fee and extra invoice fees

Set these on the **invoice offer**, before you send it.

- **Drawdown fee** is a percentage of the amount actually funded, not the invoice face value and not the offer target. If investors fund RM 80,000 of a RM 100,000 offer at 3%, the drawdown fee is RM 2,400.
- **Facility fee collected** is the exact ringgit amount you want to take from this invoice toward the remaining facility fee. It stays that exact amount even if the note is only partly funded. Enter RM 0.00 if you are not collecting any facility fee on this invoice.
- **Additional fees** are optional named lines. Each line is either a fixed ringgit amount or a percentage of funds raised. Names must be unique. You can add up to 10 lines.

Once the issuer accepts the invoice offer, these terms are locked. Do not change them after acceptance.

## Sending an invoice offer

On the Invoice tab, fill in the financing terms as usual, then complete the fee section.

The portal shows totals **at full funding** and **at 80% funding** (the usual minimum for a note to succeed). You cannot send the offer if all fees would be more than the money raised at either of those points. Fixed ringgit lines, including facility fee collection, are the usual reason an 80% check fails.

The amount you can collect toward the facility fee cannot be more than what is still remaining **and not already promised** on other open offers or notes for the same facility. The editor shows **Available for this offer** for this invoice.

If the facility is disabled, you cannot send a new invoice offer against it.

## What happens after the issuer accepts

The issuer sees the same fee schedule on the offer and on the offer letter.

If the note later funds:

- Percentage fees (drawdown fee, and any extra line priced as a percent) use the **actual funded amount**.
- Fixed ringgit fees, including the facility collection you entered, stay the same even at partial funding.
- The net payout to the issuer is funded amount minus all of those fees.

If remaining facility fee is unexpectedly less than the locked collection on that note, closing funding will fail rather than silently taking a smaller amount. Resolve the balance (or waive collection for that note) and try again.

## Worked example

Facility of RM 10 million at 1% facility fee: **RM 100,000 owed**.

Invoice offer for RM 1 million, with:

- 2% drawdown fee
- RM 10,000 facility fee collection
- no extra lines

| | Fully funded (RM 1,000,000) | 80% funded (RM 800,000) |
| --- | --- | --- |
| Drawdown fee | RM 20,000 | RM 16,000 |
| Facility fee collection | RM 10,000 | RM 10,000 |
| **Net to issuer** | **RM 970,000** | **RM 774,000** |

After a full-funding close, RM 90,000 of facility fee would still remain.

## Waiving fees

You can waive in two places. Both need a reason, and the issuer can see that a waiver was applied.

- **Waive remaining facility fee** on the facility. This writes off what is still uncharged. Amounts already collected stay collected; there is no refund. You cannot waive again if nothing remains.
- **Waive this note’s facility collection** on the note, any time after the note is created and before funding closes (including while it is still a draft). That note will not take the locked facility amount. Drawdown fee and extra lines still apply. The remaining balance on the facility does not change.

## Turning a facility off or on

Use the **Facility enabled** switch on the facility page.

- **Disable** stops new invoice applications and new invoice offers on that facility. The issuer also cannot accept an invoice offer that is still waiting, and you cannot create or publish a note from that facility until you turn it back on. You must enter a reason. The issuer sees that the facility is disabled and why. You cannot disable while notes from this facility are live on the marketplace; fail or close those notes first. Notes that have already funded continue as normal.
- **Enable** allows new drawdowns again and clears the disable reason.

Older facilities with no enable/disable setting are treated as enabled.

## Older invoices without the current fee schedule

Some invoices were offered before this fee model. Those still use the previous rule at disbursement: facility fee is a percentage of the amount funded, up to what is still owed, and they do not take balance already promised to newer invoices that have an exact collection amount.

When you open such an invoice, the fee editor stays on those older terms. An ordinary resend does **not** convert it. To move it onto the current model (exact facility collection and extra named lines), choose **Use current fee schedule**. That starts from RM 0.00 facility collection; it does not guess an amount from the old percentage. After that, the offer letter uses the current wording.

New invoice offers always use the current fee schedule.

## Where to look

- **Application → Facility** — facility fee rate on the facility offer.
- **Application → Invoice** — drawdown fee, facility collection, and extra lines on the invoice offer.
- **Facility detail** — owed / charged / waived / remaining, waive remaining fee, enable or disable.
- **Note detail** — waive this note’s facility collection while the note is still a draft or while the campaign is open, before funding closes.
- **Note → Disbursement** — actual fees taken after a successful close.
- Help article **Note Money Flow and Servicing Guide** — where the deducted fees sit in the operating account.
