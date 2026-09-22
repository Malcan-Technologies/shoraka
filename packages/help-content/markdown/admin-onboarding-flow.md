---
title: Admin Onboarding Flow Guide
description: Admin-facing guide to issuer and investor onboarding, including individual and company account paths.
category: Onboarding
tags:
  - admin
  - onboarding
order: 5
updated: 2026-09-19
---

## Purpose

Use this guide to understand what issuers and investors experience during onboarding, what admins need to review, and which fees or deposits apply before an account becomes fully active.

## Account Types

- **Issuer:** company accounts only. Personal issuer accounts are not available.
- **Investor:** personal or company. A person can hold both and switch organisations in the sidebar.

## Issuer Onboarding

Issuers are SMEs or businesses that want to raise financing using an invoice or contract.

High-level issuer flow:

1. Issuer signs up or signs in and creates the company organisation.
2. Issuer accepts the legal documents, then pays the RM 150 onboarding fee in the portal checkout.
3. Issuer completes company verification (eKYB) with CashSouk’s verification partner.
4. Admin reviews the submission and supporting checks.
5. Admin approves, requests follow-up, or rejects the onboarding.
6. Once approved, required directors and shareholders finish their own checks from **Organisation → People & Access**. Adding a person can start RegTank AML; if AML is stuck and no RegTank record exists, investigate before treating the party as screened. Person Email is for signing and onboarding; Account Email is the linked login and stays read-only. After KYC/AML complete, Person Email can be corrected without restarting those checks. CTOS/RegTank-imported directors can still have a blank Person Email; that blocks offer Continue until someone adds it on People & Access.
7. The issuer can create financing applications only after the organisation is approved and required people plus Complete Profile fields are done.

Issuer financing applications have a separate RM 50 application processing fee, paid once at first submission through the portal payment checkout. Resubmitting after an amendment request does not charge the fee again.

The pay button is currently labelled **Pay with FPX**. Checkout opens CashSouk’s payment gateway (Malaysian online banking / FPX). The checkout window is branded by the gateway provider (currently Curlec / Razorpay). Do not tell issuers a second payment method exists unless the live screen shows one.

If confirmation takes longer than 20 seconds, the issuer sees **Still confirming your payment** and the portal keeps checking. Tell them not to pay again. They can leave and return to the same application; a new payment is offered only after the earlier attempt is confirmed as failed or expired.

## Investor Onboarding

Investors are not charged an onboarding fee.

High-level investor flow:

1. Investor signs up or signs in.
2. Investor chooses individual or company onboarding.
3. Investor completes identity, suitability, bank, declaration, and company information where required.
4. Admin reviews onboarding and compliance checks.
5. Once approved, the investor must deposit at least RM 100 to unlock the account.
6. The RM 100 deposit remains investor money and can be used for investments after the account is active.

## Admin Review Focus

For issuer onboarding, verify:

- identity or company information,
- eKYC/KYB status,
- directors, shareholders, and controllers where applicable,
- SSM and business details where applicable,
- fee receipt status on the live payment record,
- admin approval and rejection reasons.

For investor onboarding, verify:

- identity or company information,
- suitability and declarations,
- sophisticated investor status where applicable,
- AML/KYC/KYB checks,
- minimum RM 100 deposit status after approval.

## Important Distinctions

- Issuer onboarding fee: RM 150, paid in portal checkout before company verification continues.
- Issuer application processing fee: RM 50, paid in portal checkout on the first submission of each financing application.
- Investor onboarding fee: none.
- Investor activation deposit: minimum RM 100 after onboarding approval. This deposit can be used for investments.
- Application fees, onboarding fees, and investor deposits must not be mixed with note repayment or investor settlement accounting.
