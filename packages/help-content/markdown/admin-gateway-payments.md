---
title: Gateway Payments
description: Search, filter, and open Curlec money-in payments from the Admin portal.
category: Finance
tags:
  - admin
  - finance
  - gateway
  - payments
order: 25
updated: 2026-08-24
---

## Open Gateway Payments

Open **Finance → Payments → Gateway Payments**.

---

## Search

Use the search field at the top of the page.

You can search by:

- Gateway Payment ID
- Order reference
- Payment reference
- Refund reference
- Settlement ID
- Payer name
- Investor or issuer organisation name
- Organisation registration number
- Corporate business name
- Payment purpose, such as Investor Deposit, Onboarding Fee, Facility Fee, or Late Payment Charges
- Gateway account, such as Operating or Investor Pool
- Exact payment amount, such as 100, RM 100, or MYR 100

Results update automatically as you type.

Clear the search when you want to remove the search text.

---

## Filters

Open **Filters** to choose:

- Status
- Gateway account
- Purpose

Click **Clear** to remove active filters and search.

---

## Late Payment Charges

**Late Payment Charges** are separately billed late charges when they did not fit into the issuer residual on settlement.

- The issuer pays via FPX. This does **not** block investor settlement. Investor principal and profit still follow the dates and worked example in **Note Money Flow and Servicing Guide**.
- The issuer portal shows the shortfall as **Action required**.
- Use purpose **Late Payment Charges** to find these rows.
- Status **Needs attention** means the payment is held for review (for example a name check). **Paid** is still in progress; **Completed** is the final success.

---

## Refresh

Refresh reloads the latest Gateway Payment information shown in CashSouk.

---

## Results table

The table shows:

| Column | What it shows |
| --- | --- |
| Created | When the payment was created |
| Organization | The related organisation |
| Purpose | The payment purpose |
| Amount | The payment amount |
| Status | The payment status |
| Account | The gateway account |
| References | Order, payment, and settlement references when available |
| Actions | Available actions for the row |

The count near the filters shows how many payments match the current search and filters.

---

## References

References may include Order, Payment, and Settlement.

Click the copy control next to a reference to copy the full value.

---

## View

Click **View** to open the Gateway Payment detail page.

---

## Pagination

Use the previous and next controls at the bottom of the table to move between pages.

The footer shows the current result range and page.

---

## Detail page

The detail page shows the saved payment information and the actions available for that payment.

### Refresh

Reloads the latest saved payment information.

### Start refund

Starts the refund action for the payment.

### Retry refund

Retries a refund that requires another refund attempt.

### Retry wallet update

Retries the CashSouk wallet update for the payment.

### Approve name check

Approves the name check for the payment.

### Reject name check

Rejects the name check for the payment.

### View receipt

Opens the payment receipt.

### Download receipt

Downloads the payment receipt.

### Retry receipt

Retries receipt generation.

Actions appear only when they apply to the payment.

---

## Activity

Activity shows recorded events for the Gateway Payment.
