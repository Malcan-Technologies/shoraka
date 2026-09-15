# Curlec M0 Findings — Payment Gateway Spike

**Date:** 2026-06-15  
**Environment:** Curlec test mode (`api.razorpay.com`)  
**Spike location:** this directory (`apps/api/_sandbox/razorpay/`)

Local spike doc — stays in `_sandbox` until production integration starts. Production plan: [payment-gateway-curlec-plan.md](../../../docs/integrations/payment-gateway-curlec-plan.md).

## What we tested

End-to-end walking skeleton:

1. `POST /v1/orders` — create order (RM 100.00 / 10_000 sen)
2. Curlec Standard Checkout — FPX, mock bank **Success**
3. `GET /v1/payments/:id` and `GET /v1/orders/:id/payments` — inspect captured payment payload

Sample IDs from the successful run:

| Artifact | ID |
|---|---|
| Order | `order_T4DQxzVLkVDGlZ` |
| Payment | `pay_T4Dhs9iQK3irbH` |

Raw JSON: `output/01-order.json`, `output/03-payment.json`, `output/03-order-payments.json`.

## H1 — FPX payer bank account name

**Status:** Open — name source not confirmed yet; defer until Curlec responds or a webhook/settlement sample is inspected.

### Payment API (test mode)

After a captured FPX payment, `GET /v1/payments/pay_T4Dhs9iQK3irbH` returned:

| Field | Value | AML-usable? |
|---|---|---|
| `method` | `fpx` | — |
| `status` | `captured` | — |
| `bank` | `MB2U` | No — bank code only |
| `acquirer_data.fpx_data` | `null` | No payer name |
| `acquirer_data.arn` | `null` | Reference only |
| `email` / `contact` | checkout prefill | No — not bank account holder |
| `notes.expected_name` | our order metadata | No — we wrote this |

Order payments list (`GET /v1/orders/.../payments`) returned the same shape — no additional name fields.

### Working assumption for build (until disproven)

- Do **not** rely on checkout `prefill.name` or `payment.email` for AML.
- Implement M5 with **`NAME_CHECK_PENDING` as the default** after capture when no programmatic payer name is available; ops verifies against the Curlec dashboard and approves or holds/refunds.
- If a name field appears later (webhook payload, settlement report, or account-manager-enabled API), wire it into the existing discrete name-check step — no schema change required beyond fields already planned on `GatewayPayment`.

### Still to check (non-blocking for M1)

- [ ] `payment.captured` webhook payload — does it include a buyer/account-holder name not present in the fetch API?
- [ ] Written confirmation from Curlec account manager on FPX buyer name source (API / webhook / report / dashboard only)
- [ ] Settlement report column list (Phase 5 recon; may also carry payer name)

## H2 — FPX transaction limits

**Status:** Confirmed at working level (pending formal Curlec reply).

| Limit | Value | Notes |
|---|---|---|
| Per-transaction max (FPX) | **RM 30,000** | Standard FPX B2C cap; sufficient for launch min deposit (RM 100) and typical top-ups |
| Increase | Available on request | Raise via Razorpay/Curlec account manager if large investor top-ups are needed |

**Build implication:** Enforce `min(platform_min_deposit, 30_000)` in deposit order creation until a configured max is added to `PlatformFinanceSetting`. Document the 30k cap in investor deposit UI validation messages.

## Other confirmations

| Item | Result |
|---|---|
| Test API keys | Valid — order creation HTTP 200 |
| FPX checkout (test mode) | Mock bank Success → `captured` |
| Auto-capture | Works — no manual capture call required |
| Amount units | Sen at API boundary (10_000 = RM 100.00); store MYR in Postgres per plan |
| MDR on test payment | `fee: 100` sen (RM 1.00) on RM 100.00 payment — track on `GatewayPayment` in recon, not ledger |

## M0 gate

| Gate item | Status |
|---|---|
| Spike: create order → pay → fetch payment | **Pass** |
| H1 documented | **Pass** (open item tracked; default path chosen) |
| H2 documented | **Pass** (30k + raise-on-request) |
| Proceed to M1 (schema) | **Yes** |

## Open questions (carry forward)

1. Where does the FPX bank account holder name appear, if anywhere? (Curlec account manager)
2. Should we add `investor_max_deposit_amount` to `PlatformFinanceSetting` now, or hardcode 30_000 until limits are formalized?
