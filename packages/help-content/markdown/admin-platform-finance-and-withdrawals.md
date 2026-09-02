---
title: Platform Finance Settings and Investor Withdrawals
description: Configure late payment rules, trustee letter details, and money flow accounts; process investor withdrawal requests from the admin portal.
category: Finance
tags:
  - admin
  - finance
  - trustee
  - withdrawals
order: 24
updated: 2026-08-24
---

## Platform Finance Settings

Open **Settings → Platform Finance** to manage platform-wide finance and trustee letter settings.

The page has tabs for late payment, gateway fees, offer deadlines, trustee letters, document authorisation, and money-flow accounts. Edit the fields you need, then click the save button for that tab.

### Late Payment

Use this tab to set default late-payment rules used in note servicing.

You can configure:

- Grace period days (default 7). During grace, profit has already stopped at maturity and no Ta'widh or Gharamah applies
- Arrears threshold days
- Ta'widh rate cap %
- Default Ta'widh rate %
- Gharamah rate cap %
- Default Gharamah rate %

After grace, profit can continue to the cleared date (capped by invoice value minus funded principal) and late charges may apply. A late-charge shortfall billed separately to the issuer does not block investor settlement.

When you finish editing, click **Save Late Payment**.

### Gateway Fees

Use this tab to set payment-gateway amounts:

- Issuer onboarding fee
- Application processing fee
- Minimum and maximum investor deposit
- **Facility fee payment gateway transaction limit** — this caps each FPX facility-fee transaction, not the overall upfront amount on a facility offer

When you finish editing, click **Save Gateway Fees**.

### Trustee Letter

Use this tab to set the default header and reference details that appear on trustee instruction letters.

You can configure:

- Trustee name
- Trustee address lines
- Attention person
- Default contact person
- Authorised signatory label
- Platform display name
- Automatically email trustee, plus the trustee To address and optional CC list

These values are used when the system generates trustee instruction PDFs. If automatic email is enabled, the submit action is **Email to Trustee**; SES acceptance is shown as delivered, and the workflow stays submitted until payment execution is confirmed. If it is disabled, the action is **Mark submitted to trustee**. After the first email is delivered, **Resend Email to Trustee** remains available until the withdrawal is completed or cancelled; it uses the latest configured recipients and updates the delivery timestamp without completing the workflow.

When you finish editing, click **Save Trustee Letter**.

### Document Authorisation

Use this tab to set the platform-wide authorised signatory name and company stamps used on official PDFs.

You can configure:

- Authorised Signatory Name (Islamic Investment Note Certificate only)
- Islamic Investment Note Certificate company stamp
- Whether the Settlement & Hibah Receipt uses the same stamp, or a separate receipt stamp

New certificates and receipts use the settings in force when that version is first generated. Changing these settings does not rewrite an already READY PDF. To apply updated signatory or stamp details, Admin can **Regenerate / Reissue** the READY document; that creates a new version and leaves the previous version stored.

Investment Settlement Confirmation does not use these fields.

When you finish editing, click **Save Document Authorisation**.

### Money Flow Accounts

Use this tab to set the bank account details used in trustee instruction letters for platform money buckets.

Configure each of these accounts:

- **Investor Pool**
- **Repayment Pool**
- **Operating Account**
- **Ta'widh Account**
- **Gharamah Account**

For each account, enter:

- Bank name
- Account name
- Account number

When you finish editing, click **Save Money Flow Accounts**.

---

## Investor Withdrawals

Open **Finance → Investor Withdrawals** to review and process investor cash withdrawal requests.

### List page

The list shows all investor withdrawal requests. Use it to:

- See who requested a withdrawal and for how much
- Check the current status
- See when the request was made
- See when the instruction was submitted to the trustee (if applicable)
- Click **Open** to go to the withdrawal detail page

### Detail page

The detail page shows the full withdrawal record:

- Withdrawal summary (reference, status, amount, dates)
- Investor details
- Beneficiary and bank details
- Trustee letter status
- Processing timeline

Processing actions are available on the detail page according to the withdrawal status below.

---

## Processing actions by status

### Draft

**Available actions:**

- Edit beneficiary
- Generate letter

**How to process:**

1. Open the withdrawal and review the beneficiary and bank details.
2. If details are wrong, click **Edit beneficiary**, update the fields, and save.
3. Click **Generate letter** to create the trustee instruction PDF.

### Letter generated

**Available actions:**

- Download letter
- **Email to Trustee** when automatic trustee email is enabled, or **Mark submitted to trustee** when it is disabled

**How to process:**

1. Download and review the generated trustee letter.
2. Click **Email to Trustee** if automatic trustee email is enabled. SES acceptance is shown as delivered; the withdrawal stays submitted until you confirm the trustee processed the payment. A send failure leaves it unsubmitted. If automatic email is disabled, deliver the letter manually and click **Mark submitted to trustee**.

### Submitted to trustee

**Available actions:**

- Download letter
- **Resend Email to Trustee** after a previous email delivery
- Mark completed

**How to process:**

1. Confirm the trustee has completed the payment instruction.
2. Click **Mark completed**. Use **Resend Email to Trustee** only if the letter must be emailed again; this updates the delivery timestamp and does not mark the withdrawal completed.

### Completed

**Available actions:**

- Download letter

No further processing is required.

### Cancelled

No processing actions are available.

---

## Dashboard and sidebar

- The **Dashboard** includes a quick action for **Investor Withdrawals** so you can open the queue quickly.
- The **sidebar** under **Finance → Investor Withdrawals** shows a badge count for withdrawals that still need action.
- The badge count includes withdrawals in **Draft**, **Letter generated**, and **Submitted to trustee**.
- The count clears as withdrawals are marked **Completed**.
