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
updated: 2026-06-22
---

## Platform Finance Settings

Open **Settings → Platform Finance** to manage platform-wide finance and trustee letter settings.

The page has three tabs. Edit the fields you need, then click the save button for that tab.

### Late Payment

Use this tab to set default late-payment rules used in note servicing.

You can configure:

- Grace period days
- Arrears threshold days
- Ta'widh rate cap %
- Default Ta'widh rate %
- Gharamah rate cap %
- Default Gharamah rate %

When you finish editing, click **Save Late Payment**.

### Trustee Letter

Use this tab to set the default header and reference details that appear on trustee instruction letters.

You can configure:

- Trustee name
- Trustee address lines
- Attention person
- Default contact person
- Authorised signatory label
- Platform display name
- Default value date
- Default reference prefix

These values are used when the system generates trustee instruction PDFs.

When you finish editing, click **Save Trustee Letter**.

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
- Submit to trustee

**How to process:**

1. Download and review the generated trustee letter.
2. Submit the instruction to the trustee using your operating procedure (outside the portal).
3. After submission, click **Submit to trustee** in the portal.

### Submitted to trustee

**Available actions:**

- Download letter
- Mark completed

**How to process:**

1. Confirm the trustee has completed the payment instruction.
2. Click **Mark completed**.

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
