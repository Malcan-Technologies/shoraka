---
title: Note Money Flow and Servicing Guide
description: Admin guide for note funding, repayment pools, issuer residuals, fees, arrears, defaults, withdrawals, and audit trail.
category: Note Operations
tags:
  - admin
  - notes
  - finance
order: 20
updated: 2026-04-28
---

## Purpose

Use this guide when reviewing or operating note money flows in the admin portal. It explains the five platform buckets, how investor funding and paymaster repayment move through the platform, how issuer application fees are handled, and which PDF letters and audit records must be generated.

## Five Platform Buckets

The note operating model uses five core buckets:

- `Investor Pool` - investor deposits, investment commitments, investor repayments, and investor withdrawals.
- `Repayment Pool` - paymaster financing repayments before settlement allocation.
- `Operating Account` - CashSouk application fees, platform fees, and service fees.
- `Ta'widh Account` - Syariah compensation component of late payment charges.
- `Gharamah Account` - Syariah penalty/charity component of late payment charges.

Issuer application fees are not shown in the original money-flow diagram, but they should be included. When the issuer submits a financing application, the application or financing processing fee is paid into the Operating Account.

## Flowchart for Review

```mermaid
flowchart TD
  investor["Investor"] -->|"Investor deposit"| investorPool["Investor Pool"]
  investorPool -->|"Net note disbursement"| issuer["SME / Issuer"]
  investorPool -->|"Platform fee at disbursement, max 3%"| operating["Operating Account"]
  issuer -->|"Application fee on submission"| operating
  paymaster["Buyer / Paymaster"] -->|"Financing repayment"| repaymentPool["Repayment Pool"]
  issuer -->|"Repayment on behalf of paymaster"| repaymentPool
  repaymentPool -->|"Investor principal plus net profit / return"| investorPool
  repaymentPool -->|"Service fee from profit, up to 15%"| operating
  repaymentPool -->|"Issuer residual for unfunded portion"| issuer
  issuer -->|"Late fee set at repayment receipt"| repaymentPool
  repaymentPool -->|"Ta'widh allocation"| tawidh["Ta'widh Account"]
  repaymentPool -->|"Gharamah allocation"| gharamah["Gharamah Account"]
  investorPool -->|"Withdrawal request"| withdrawalLetter["Withdrawal PDF letter"]
  withdrawalLetter -->|"Manual trustee submission"| trustee["Trustee"]
  repaymentPool -->|"Arrears letter after grace plus 14 days"| arrearsLetter["Arrears PDF letter"]
  arrearsLetter -->|"Admin manually marks default"| defaultLetter["Default PDF letter"]
  operating --> audit["Audit Trail"]
  investorPool --> audit
  repaymentPool --> audit
  tawidh --> audit
  gharamah --> audit

  class investorPool,repaymentPool pool
  class operating operatingAccount
  class tawidh,gharamah syariahAccount
  class withdrawalLetter,arrearsLetter,defaultLetter documentStep
  class audit auditStep

  classDef pool fill:#dbeafe,stroke:#2563eb,color:#0f172a
  classDef operatingAccount fill:#fee2e2,stroke:#dc2626,color:#0f172a
  classDef syariahAccount fill:#dcfce7,stroke:#16a34a,color:#0f172a
  classDef documentStep fill:#fef3c7,stroke:#d97706,color:#0f172a
  classDef auditStep fill:#f3e8ff,stroke:#9333ea,color:#0f172a
```

## Admin Operating Rules

- Platform fee is not a global setting. It is set per note at the point of disbursement and capped at 3%.
- Service fee is not a global setting. It is determined per customer/note, deducted from investor profit when paymaster repayment is received, and standard capped up to 15% of profit.
- Grace period should be configurable as a global admin setting, with a standard default of 7 days.
- Ta'widh defaults should be configurable, manually set at receipt time, and capped at 1% per annum.
- Gharamah defaults should be configurable, manually set at receipt time, and capped at 9% per annum.
- Late fees should be calculated and posted only when repayment funds are received. They should not be accrued or posted by a daily cron job.
- Arrears threshold should be configurable, with a standard default of 14 days after the grace period. With the 7-day grace period, arrears starts 21 days after the missed payment date.
- Default is not automatic. Admin can manually mark the note as default any time after the note is already in arrears.
- Financing repayment is paid by the buyer/paymaster into the Repayment Pool.
- Issuer can also pay into the Repayment Pool on behalf of the paymaster, likely from the issuer portal. Admin should reconcile it as a valid repayment while preserving the payment source.
- Late fees are borne by the issuer, but deducted from repayment proceeds before returning any issuer residual.
- If a note is funded below 100%, the paymaster still repays the source invoice/contract obligation. After investor settlement, service fee, and approved late charges, the unfunded residual balance is returned to the issuer. Platform fee has already been deducted at disbursement.
- Example: if the note is 60% funded and the paymaster repays 100%, investors receive the funded 60% principal plus net profit pro rata, and the issuer receives the remaining 40% less approved late fees, service fee, and investor profit.

## Settlement Waterfall Example

```mermaid
flowchart TD
  funded["Note funded 60%"] --> disburse["Disburse funded amount"]
  disburse --> platformFee["Deduct platform fee at disbursement, max 3%"]
  platformFee --> issuerNet["Net funded proceeds to issuer"]
  paymaster["Paymaster repays 100%"] --> repaymentPool["Repayment Pool"]
  repaymentPool --> investorPrincipal["60% funded principal"]
  repaymentPool --> investorProfit["Investor profit on funded portion"]
  investorProfit --> serviceFee["Deduct service fee up to 15% of profit"]
  serviceFee --> operating["Operating Account"]
  investorPrincipal --> investorRatio["Split by investor allocation ratio"]
  investorProfit --> investorRatio
  investorRatio --> investors["Investors receive principal plus net profit"]
  repaymentPool --> lateFees["Issuer-borne late fees if any"]
  lateFees --> tawidh["Ta'widh"]
  lateFees --> gharamah["Gharamah"]
  repaymentPool --> issuerResidual["Issuer residual return"]
  issuerResidual --> formula["40% unfunded residual minus late fees, service fee, and investor profit"]
  formula --> issuer["Issuer"]

  class repaymentPool pool
  class platformFee,serviceFee,operating fee
  class tawidh,gharamah syariahAccount
  class investorPrincipal,investorProfit,investorRatio,investors investorStep
  class issuerNet,issuerResidual,formula issuerStep

  classDef pool fill:#dbeafe,stroke:#2563eb,color:#0f172a
  classDef fee fill:#fee2e2,stroke:#dc2626,color:#0f172a
  classDef syariahAccount fill:#dcfce7,stroke:#16a34a,color:#0f172a
  classDef investorStep fill:#fef3c7,stroke:#d97706,color:#0f172a
  classDef issuerStep fill:#ede9fe,stroke:#7c3aed,color:#0f172a
```

## Withdrawal Letters

Investor withdrawal and other pool withdrawal flows should generate a PDF template letter before funds are manually submitted to the trustee.

The letter should include:

- withdrawal reference,
- source bucket,
- beneficiary name,
- beneficiary bank details or masked reference,
- amount and currency,
- reason,
- requested by,
- reviewed by,
- approval timestamps,
- trustee submission status,
- related note or investor reference where applicable.

The admin portal should keep the generated PDF, submission status, and activity timeline entry. Completion should only be marked after manual trustee submission is confirmed.

## Arrears and Default Letters

Arrears and default should be generated from templates and attached to the note timeline.

- The 7-day grace period controls whether late fees are applied when repayment funds are received.
- Arrears begins after the grace period plus the configured arrears threshold. Standard timing is 7 days of grace plus 14 arrears-threshold days.
- At arrears, generate an arrears/default warning letter PDF.
- Default is a manual admin action available once the note is in arrears.
- When admin marks default, generate a default letter PDF.
- Admin should review generated letters before any external submission or communication.

## Audit Trail

Every money-flow action should be auditable:

- setting changes,
- application fee receipt,
- note funding close,
- disbursement,
- paymaster repayment receipt,
- issuer-on-behalf-of-paymaster repayment receipt,
- settlement preview and approval,
- ledger posting,
- issuer residual return,
- late-fee calculation and allocation,
- withdrawal letter generation,
- trustee submission marking,
- arrears/default letter generation,
- manual overrides and waivers.

Audit entries should include actor, role, timestamp, before/after values where relevant, IP address, user agent, correlation ID, related note/application IDs, and generated document references.

