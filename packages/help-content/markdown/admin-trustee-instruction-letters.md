---
title: Trustee Instruction Letters
description: When and where to generate PDF instruction letters on the redesigned Admin Note Detail page.
category: Note Operations
tags:
  - admin
  - notes
  - trustee
  - finance
order: 22
updated: 2026-08-24
---

## What these letters are

Trustee instruction letters are **PDF documents** you generate in the admin portal and provide to the **trustee** so they can execute (or record) specific money movements. Each letter summarises the instruction: what it is for, amounts, references, and sometimes beneficiary or pool details.

You generate the file, review it, then submit it. If **Automatically email trustee** is enabled in **Settings → Platform Finance → Trustee Letter**, the action is **Email to Trustee**: SES acceptance is shown as delivered, and the workflow stays **Submitted to trustee** until you later confirm the trustee processed the payment. If that setting is off, the action is **Mark submitted to trustee** and you deliver the letter manually. After the first email is delivered, **Resend Email to Trustee** stays available until the financial workflow is marked disbursed or completed. Resend uses the latest configured recipients and the current signed PDF, updates the delivery timestamp, and does not complete the workflow.

## Where you work (Note Detail tabs)

Open the note from **Notes**, then use the tab bar:

| Tab | Trustee letters / actions |
|-----|---------------------------|
| **Disbursement** | Issuer disbursement (initial funding payout to issuer bank account) |
| **Servicing & Settlement** | Settlement trustee instruction after post (pools + issuer refund allocation) |
| **Late Payment** | Arrears and default correspondence PDFs |

The **Activity timeline** on the right records when letters were generated and links to stored PDFs where applicable. The **Workflow Status** card mirrors tab progress dots.

## Issuer disbursement (initial funding payout)

**When:** After funding closes and the note is **Funded**, before the note becomes **Active**.

**Where:** **Disbursement** tab → **Issuer Disbursement** card.

**Flow:**

1. Complete **Tawarruq transaction / certificate** steps when shown on the card. Callbacks may update Tawarruq order status, but the certificate step completes only after **Fetch Tawarruq Certificate** stores the PDF (use **Query Status**, fetch, or reload on an open page).
2. Confirm **beneficiary details** are complete (snapshotted onto the letter).
3. **Generate** the trustee letter (PDF).
4. Click **Email to Trustee** when auto-send is on, or **Mark submitted to trustee** when it is off.
5. Use **Resend Email to Trustee** if needed until you mark disbursed. It updates the delivery timestamp only.
6. Mark **disbursed / complete** when the trustee confirms payout. This moves the note to **Active** and starts servicing.

## Settlement trustee instruction (after settlement post)

**When:** Only **after settlement is posted**, when the posted waterfall includes amounts that require trustee instruction (investor pool movements, service fee, Ta'widh/Gharamah account allocations, and/or **issuer refund allocation**).

**Where:** **Servicing & Settlement** tab → settlement waterfall area → **Trustee submission** block. Use **Finance → Settlements** for the platform-wide queue.

**What it documents:** The trustee instruction for all posted pool movements from the repayment waterfall — including service fee to Operating account and issuer refund allocation when applicable. Ledger credits/debits were created at post; the PDF is the instruction and audit record for the trustee.

**Flow:**

1. **Settlement posted** — automatic when you post the waterfall.
2. **Generate** the settlement trustee instruction PDF (required before submit).
3. Click **Email to Trustee** when auto-send is on, or **Mark submitted to trustee** when it is off.
4. Use **Resend Email to Trustee** if needed until you mark the instruction completed. It updates the delivery timestamp only.
5. Mark **instruction completed** when the trustee confirms processing. Until then, the status badge shows **Active · servicing** and the settlement strip shows **Trustee instruction** as the current step.

**Issuer refund allocation** is included in this instruction when the waterfall has a positive issuer refund amount. It is **not** a separate Note Detail card or lifecycle workflow.

## Arrears and default letters

**When:** While servicing, for formal **arrears** communication, or when handling **default** paperwork.

**Where:** **Late Payment** tab → **Arrears and Default Documents**.

Generate **Arrears Letter** or **Default Letter** as appropriate. Review before external use. Copies appear in the generated letters list and the Activity timeline.

## Investor and other withdrawals

Investor withdrawal instructions and certain **admin adjustment** withdrawals follow the same pattern elsewhere in the admin portal (finance queues or withdrawal detail): draft → PDF → submitted → completed. Generate the letter **before** marking submitted unless policy says otherwise.

## Quick reference

| Letter type | Note Detail tab | Trustee payout to external bank? |
| ----------- | --------------- | -------------------------------- |
| Issuer disbursement | Disbursement | Yes (issuer bank account) |
| Settlement trustee instruction | Servicing & Settlement | Pools + issuer refund via trustee instruction; may include external beneficiary when issuer refund > 0 |
| Arrears / default | Late Payment | Correspondence; follow collections process |

If unsure which letter applies, use the **note timeline** and **Finance → Buckets** activity to see what has been posted, then match the instruction to the movement the trustee must act on.
