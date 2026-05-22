---
title: Shoraka STP Admin Guide
description: How admins use the Shoraka STP section on the Admin Note Detail page for ISSUER_DISBURSEMENT withdrawals.
category: Notes and Financing
tags:
  - admin
  - shoraka
  - stp
  - notes
order: 80
updated: 2026-05-22
---

## Purpose
Use this guide when you need to understand and operate the **Shoraka STP** section inside the Admin Note Detail page.

Shoraka STP supports Islamic financing proof (Tawarruq / commodity buy-and-sell) for **issuer disbursement** flows.

## When this appears
You will see the Shoraka STP section:
- Inside the **Issuer Disbursement** card
- Only for withdrawals with `ISSUER_DISBURSEMENT`
- It does not apply to residual return / settlement / investor flows

## Admin flow (step-by-step)
1. Funding closes
2. An **Issuer Disbursement** withdrawal is created
3. Admin submits a Shoraka order
4. If Shoraka status is:
   - `Active` or `Pending Sell`: wait and/or click **Query Status**
   - `Completed`: click **Fetch Certificate**
5. The certificate PDF is stored in S3
6. **Mark Disbursed** becomes available only after the certificate has been fetched

> Note: Shoraka callbacks may also update the status automatically, so you may see status changes without manually querying each time.

## Status meanings (what you should do)

| Provider status | What it means in Cashsouk | What you should do |
|---|---|---|
| `Not submitted` | No Shoraka order yet | Click **Submit Shoraka Order** |
| `Active` | Shoraka is still matching / processing | Click **Query Status** later |
| `Pending Sell` | Sell side is still pending | Click **Query Status** later; contact ops if stuck |
| `Completed` | Trade is complete; certificate can be fetched | Click **Fetch Certificate** |
| `Certificate ready` | Certificate PDF is stored in S3 | Proceed with disbursement |
| `Cancelled` | Manual review required | Contact ops |
| `Take Delivery` | Manual review required | Contact ops |
| `Unknown` | Manual review required | Contact ops |

## Buttons (what each one does)
- **Submit Shoraka Order**
  - Creates the Shoraka trade order.
  - Blocked during the unsafe cutoff window (see below).
- **Query Status**
  - Calls Shoraka to refresh the latest provider status.
  - The backend also accepts Shoraka callbacks, which may update the stored status.
- **Fetch Certificate**
  - Downloads the Shoraka certificate PDF and stores it in S3.
  - Only allowed when the provider status is `Completed`.
- **View Certificate**
  - Opens the stored certificate PDF from S3.
- **Mark Disbursed**
  - Disabled until `shoraka_trade_orders.certificate_s3_key` exists.
  - Backend also enforces this, so direct API calls will be rejected if the certificate is missing.

## Cutoff rule (MYT)
Shoraka order submission is blocked from **11:30 PM to 12:30 AM MYT**.

During this window:
- Orders may remain `Active` and may require cancellation.
- Please submit after **12:30 AM** if you hit the cutoff.

This cutoff does not block:
- Query Status
- Fetch Certificate
- View Certificate

## Order date and value date (display only)
- `orderDate` = the trade/order submission date to Shoraka.
- `valueDate` = the intended disbursement date on Cashsouk side.

STP team guidance says both should be the same date. Common practice is to disburse on the same date reflected on the certificate.
Strict validation is not enforced yet pending Shariah advisor confirmation.

## If you get stuck
- `Active` for a long time
  - Click **Query Status** later
  - If it stays stuck, contact Shoraka / Tawarruq operations
- `Pending Sell` for a long time
  - Click **Query Status** later
  - If it stays stuck, contact operations
- `Cancelled` / `Take Delivery` / `Unknown`
  - Manual review required: human/ops team must check

