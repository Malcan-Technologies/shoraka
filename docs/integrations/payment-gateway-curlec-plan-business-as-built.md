# Payment Gateway (Curlec) — Business Overview (As Built)

Implementation snapshot (Jul 2026). Compare against the initial plan in `payment-gateway-curlec-plan-business.md`.

Plain-language companion to the technical as-built reference (`payment-gateway-curlec-plan-as-built.md`) and ops runbook (`payment-gateway-curlec-ops-runbook.md`).

## What we built

CashSouk collects real money via **Curlec** (Razorpay's Malaysian payment gateway) using **FPX** (standard Malaysian online banking). Customers pay from their own bank; no card details or manual transfer references.

The gateway handles **money coming in** only:

| Who pays | What they pay | When | Where the money belongs |
|---|---|---|---|
| Investor | Initial deposit (minimum RM100, configurable) | After account approval, to activate investing | Investor Pool |
| Investor | Wallet top-ups (≥ minimum) | Anytime | Investor Pool |
| Issuer (SME) | Onboarding fee (default RM150) | Before starting eKYB/KYC | Operating Account |
| Issuer (SME) | Financing processing fee (default RM50) | When submitting a financing application | Operating Account |

Fee amounts are admin-configurable under **Settings → Platform Finance → Gateway Fees** — not fixed in code.

Money **going out** (disbursements, bucket transfers, investor withdrawals) is **not** part of this integration. That continues via trustee instruction letters until the RHB bank API is ready.

## How a payment works (customer view)

1. Customer clicks Pay / Deposit on our portal.
2. A secure Curlec payment window opens; they pick their bank.
3. They approve the payment at their bank.
4. They return to our portal. Wallet or fee status updates within moments via webhook.

## The AML name check (investors only)

Regulation requires investor deposits to come from a bank account **in the investor's own name**.

| Result | What happens |
|---|---|
| **Match** | Wallet credited automatically |
| **Clear mismatch** | Auto-refunded via Curlec; wallet never credited |
| **Name unavailable or ambiguous** | Goes to admin **name-check review** queue; wallet not credited until ops approves or rejects |

Issuers paying fees do **not** need a name check. Issuer fees are **non-refundable**.

> **Pre-launch confirmation needed:** Verify with your Curlec account manager that production FPX payments return the payer bank account name via API/webhook. If not, more deposits will land in the manual review queue.

## Where the money physically sits

All Curlec payments settle into **one** company bank account (typically T+1–2 business days after capture). Our internal ledger records how much belongs to each bucket (Investor Pool vs Operating Account). Physical movement between bank accounts remains manual/trustee-checked until RHB API integration.

**The ledger is the source of truth for who owns what; bank balances catch up via manual transfers for now.**

## Reconciliation (making sure nothing is lost)

Every day the system:

- Fetches Curlec's settlement report for the previous day (MYT).
- Matches each settled payment to our internal records.
- Stamps settlement metadata (`settled_at`, gateway fees) on matched payments.
- Flags orphans (Curlec payment we don't have) and amount mismatches on an admin exceptions page.

**Captured ≠ settled.** Wallets are credited at capture (seconds). Reconciliation confirms the money actually reached our bank days later. In Curlec test mode, settlements never occur — recon will always show 0 scanned.

The goal: **open exceptions = 0** most days. When they aren't, ops investigates immediately.

See `payment-gateway-curlec-ops-runbook.md` for daily workflow and `payment-gateway-curlec-recon-testing.md` for dev testing.

## What the admin team gets

- **Gateway Payments** — every payment, status, event history, name-check approve/reject, refund actions.
- **Reconciliation** — daily runs, scanned/matched/stamped counts, exception queue.
- **Gateway Fees settings** — change fees and deposit limits without a developer.
- **Badges** on existing screens — issuer onboarding fee paid, application processing fee paid.

## Delivery status

| Phase | Status | Notes |
|---|---|---|
| 1. Foundation | **Done** | Models, Curlec client, webhooks, fee settings |
| 2. Investor deposits | **Done** | FPX checkout, name check, auto-refund, wallet + ledger |
| 3. Issuer onboarding fee | **Done** | Gates eKYB start |
| 4. Application processing fee | **Done** | Gates application submit |
| 5. Reconciliation | **Done** | Daily job, admin page, exception resolve |
| 6. Hardening | **In progress** | Live FPX smoke, prod env wiring, remove dev simulator |

## Pre-launch needs from stakeholders

1. **Curlec live account** — FPX enabled, auto-capture, webhook URL + secret, written confirmation of payer name field and FPX limits.
2. **Ops sign-off** — name-check review SLA, held-deposit escalation, daily recon review owner.
3. **Finance sign-off** — MDR treatment (tracked on payment row, not ledger-posted yet), manual bucket transfer process.
4. **Engineering** — prod `CURLEC_*` in SSM, remove dev recon simulator, live smoke tests for all four payment paths.
