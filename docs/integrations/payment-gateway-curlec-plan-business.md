# Payment Gateway (Curlec) — Business Overview

Plain-language companion to the technical plan (`payment-gateway-curlec-plan.md`). This describes what we are building, what changes for our users and our team, and what stays manual for now.

## What we are building

Today, no real money moves through the platform — deposits and fees are simulated. We are integrating **Curlec** (Razorpay's Malaysian payment gateway) so customers can pay us online through their own bank using **FPX** (the standard Malaysian online banking payment method, the same one used by most e-commerce sites).

The gateway handles **money coming in** only:

| Who pays | What they pay | When | Where the money belongs |
|---|---|---|---|
| Investor | Initial deposit (minimum RM100) | After their account is approved, to activate investing | Investor Pool |
| Investor | Wallet top-ups (any amount ≥ RM100) | Anytime | Investor Pool |
| Issuer (SME) | Onboarding fee (RM150) | Before starting the eKYB/KYC onboarding process | Operating Account |
| Issuer (SME) | Financing processing fee (RM50) | When submitting a financing application | Operating Account |

Fee amounts will be settings the admin team can change — not fixed in code.

Money **going out** (disbursements to issuers, moving funds between our bank accounts, investor withdrawals) is **not** part of this project. That continues as today — trustee instruction letters, with the trustee acting as the checker — until the RHB bank API integration is ready in a later phase.

## How a payment works (customer view)

1. Customer clicks Pay / Deposit on our portal.
2. A secure Curlec payment window opens; they pick their bank.
3. They are taken to their own bank's login page and approve the payment.
4. They return to our portal and see confirmation. Their wallet/fee status updates automatically within moments.

No card details, no manual bank transfer references, no waiting for us to confirm receipt by hand.

## The AML name check (investors only)

Regulation requires that money an investor deposits comes from a bank account **in their own name**. So for every investor deposit:

- We compare the name on the paying bank account against the name on the investor's CashSouk account.
- **Match** → the wallet is credited automatically.
- **No match (or name can't be confirmed automatically)** → the money is **never** credited. The deposit goes into a "held" queue for our operations team, who will verify it, contact the investor if needed, and refund the money manually through the Curlec dashboard. The system tracks every held deposit until the refund is confirmed, so nothing falls through the cracks.

Issuers paying fees do **not** need a name check, and issuer fees are **non-refundable** — including if their onboarding or application is later rejected.

> **Open question we must settle with Curlec before build:** their standard reports may not always include the payer's bank account name for FPX payments. We've designed the process so that if the name isn't available automatically, the deposit simply waits in the held queue for a quick manual check by ops — but we should confirm with our Curlec account manager exactly how we'll receive the payer name.

## Where the money physically sits

All payments collected by Curlec settle into **one** company bank account (typically 1–2 business days after payment). Our internal ledger keeps an exact record of how much of that money belongs to which bucket (Investor Pool vs Operating Account). Physically moving money between actual bank accounts remains a manual, trustee-checked process until the RHB bank API is integrated.

In short: **the ledger is the source of truth for who owns what; the bank balances catch up via manual transfers for now.**

## Reconciliation (making sure nothing is lost)

Every day, the system will automatically:

- Cross-check every payment Curlec says it received against our own records.
- Match Curlec's settlement reports (the actual bank deposits, minus their transaction fees) against what we expected.
- Flag anything that doesn't match — a payment we missed, an amount that's off, a settlement that's late — on an admin exceptions page.

The goal: the exceptions list is empty every day, and when it isn't, the team sees it immediately rather than discovering it at month-end.

## What the admin team gets

- A **payments screen**: every gateway payment, its status, and full history.
- A **held deposits queue**: review name-check failures, record refunds.
- A **reconciliation page**: daily settlement matching and exceptions.
- **Fee settings**: change the onboarding fee, processing fee, and minimum deposit without a developer.
- Indicators on existing screens: whether an issuer has paid their onboarding fee, whether an application's processing fee is paid.

## Delivery in phases

| Phase | What ships | What it means for the business |
|---|---|---|
| 1. Foundation | Curlec account connected, core plumbing, fee settings | Nothing visible yet; everything below depends on it |
| 2. Investor deposits | Real deposits with name check + held/refund handling | Investors can fund wallets with real money |
| 3. Issuer onboarding fee | RM150 collected before eKYB starts | Onboarding fee revenue begins |
| 4. Application processing fee | RM50 collected at application submission | Processing fee revenue begins |
| 5. Reconciliation | Daily automated matching + exceptions page | Finance/ops confidence; audit-ready records |
| 6. Hardening | Full testing, go-live checks, ops runbook | Production launch readiness |

Phases 3 and 4 don't depend on Phase 2, so issuer fees and investor deposits can be built in parallel once the foundation is done.

## What we need from non-dev stakeholders

1. **Curlec account setup** — live merchant account, FPX enabled, and written confirmation of (a) how we receive the payer's bank account name, and (b) FPX per-transaction limits.
2. **Ops process sign-off** — the manual refund procedure for held deposits (who reviews, who refunds, expected turnaround).
3. **Finance sign-off** — treatment of Curlec's transaction fees (MDR) in our accounts, and the interim manual process for moving settled money into the right bank accounts.
4. **Confirmation of fee amounts** — RM150 / RM50 / RM100 minimum are the working defaults.
