---
title: Trustee Instruction Letters
description: When and where to generate PDF instruction letters for the trustee—issuer payouts, service fee pool transfers, arrears, and default.
category: Note Operations
tags:
  - admin
  - notes
  - trustee
  - finance
order: 22
updated: 2026-05-18
---

## What these letters are

Trustee instruction letters are **PDF documents** you generate in the admin portal and provide to the **trustee** so they can execute (or record) specific money movements. Each letter summarises the instruction: what it is for, amounts, references, and sometimes beneficiary or pool details.

They are **not** sent automatically to the trustee from the portal. You generate the file, review it, then follow your operating procedure to deliver it and track confirmation.

## Where you work

Most letters are created from the **note detail** page, in the **servicing and settlement** area (settlement panel). Open the note from **Notes**, then scroll to the settlement workflow.

The **Activity timeline** on the same note records when letters were generated and links to stored PDFs where applicable.

## Issuer disbursement (initial funding payout)

**When:** After funding closes and the note is **Funded**, before the note becomes **Active**.

**Where:** At the top of the settlement panel, use the **Issuer Disbursement** card.

**Flow:**

1. Confirm **beneficiary details** (bank name, account number, and any other required fields) are complete. These details are snapshotted onto the letter.
2. **Generate** the trustee letter (PDF).
3. When your process allows, mark the instruction **submitted to trustee** after the trustee has received it.
4. When the trustee confirms the money has left the trust account, mark **disbursed / complete**. Completing this step is what moves the note to **Active** and starts servicing.

If you need a revised PDF after beneficiary details change, update details while the withdrawal is still in **Draft**, then generate again as needed.

## Issuer residual refund (after settlement)

**When:** After you **post** the settlement waterfall for a repaid note, when there is a **residual amount** owed back to the issuer.

**Where:** In the settlement panel, the **Issuer Residual Refund** card (below the waterfall and pool summaries).

**Flow:** Same pattern as disbursement: beneficiary details → **Generate** letter → **Submitted to trustee** → **Disbursed / complete** when the trustee confirms payment. Completing the residual withdrawal is part of closing out the note as fully repaid.

## Service fee — internal pool transfer

**When:** Only **after settlement has been posted**, when the posted settlement includes a **service fee** above the portal’s small-amount threshold (the instruction card appears only in that case).

**Where:** In the settlement panel, section **3. Settlement Waterfall**, under the pool summary cards. Look for **Trustee instruction — service fee (internal pools)**. Use **Finance → Service Fee** for the platform-wide queue of notes that still need a PDF, a trustee submission, or marking the instruction complete.

**What it documents:** The allocation of the **service fee** from the **Repayment pool** to the **Operating account**. Credits and debits for that allocation were created when you posted settlement; the PDF is still the **instruction and audit record** you give the trustee so they can process or record the **internal pool** movement. There is **no** payout to an external bank account.

**Flow (mirrors other trustee letters, without a bank beneficiary):**

1. **Settlement posted** — automatic once the waterfall is posted (this step is reflected on the note lifecycle sub-stepper).
2. **Generate** the trustee letter (PDF). You must generate before you can mark submitted.
3. When your process allows, mark **submitted to trustee** after the trustee has received the signed instruction.
4. When the trustee confirms they have processed the internal allocation, mark **instruction completed**. Until this is done, counters and registries may still treat the note as having open service-fee trustee work.

You can **generate** a new PDF if the trustee asks for a revised copy before submission; generations are listed with **View** and **Download**. After you mark **submitted**, **PDF generation is locked**. The note **Activity timeline** records service-fee letter events (generated, submitted, completed).

## Arrears and default letters

**When:** While the note is in servicing and you need formal **arrears** communication, or after the note is in **arrears** and you are handling **default** paperwork.

**Where:** In the settlement panel, section **4. Arrears and Default Documents**, use **Generate Arrears Letter** or **Generate Default Letter** as appropriate.

These PDFs support your collections and default workflow. Review each letter before external use. Generated copies appear in the **Generated Letters** list on the same section and in the note **Activity timeline**.

## Investor and other withdrawals

Investor withdrawal instructions and certain **admin adjustment** withdrawals follow the same high-level idea: a **draft withdrawal**, **PDF letter**, then **submitted** and **completed** states in the withdrawal workflow you use elsewhere in the admin portal (for example, finance queues or note-linked withdrawal detail). Always generate the letter **before** marking submitted, unless your internal policy says otherwise.

## Quick reference

| Letter type | Typical location on note | Trustee payout to external bank? |
| ----------- | ------------------------ | -------------------------------- |
| Issuer disbursement | Issuer Disbursement card | Yes |
| Issuer residual | Issuer Residual Refund card | Yes |
| Service fee (pools) | Settlement waterfall / pool summaries area; **Finance → Service Fee** queue | No external bank payout — internal pools; PDF + submitted + instruction completed |
| Arrears / default | Section 4 of the settlement panel | Usually correspondence; follow your collections process |

If you are unsure which letter applies, use the **note timeline** and **Finance → Buckets** activity to see what has already been posted, then match the instruction to the movement you need the trustee to act on.
