# Marketplace wiring and minimal investor balance

This guide describes the investor marketplace quick-commit flow and the minimal transaction-backed balance used for interaction testing.

## Overview

- **Marketplace list** (`apps/investor/src/app/investments/page.tsx`): lists published notes from `GET /v1/marketplace/notes`, filters locally, and commits investments from the confirm dialog via `POST /v1/marketplace/notes/:id/investments`.
- **Available balance** is read from `GET /v1/investor/portfolio` (`availableBalance`). The header shows this value instead of a hardcoded amount.
- **Portfolio totals**: `portfolioTotal` = `availableBalance` + `totalInvestment` (sum of `NoteInvestment` rows in `COMMITTED` or `CONFIRMED` for accessible orgs). This matches the account overview donut chart on the home page.

## Data model (API / Prisma)

| Table | Purpose |
| ----- | ------- |
| `investor_balances` | One row per `investor_organization_id`; `available_amount` is the spendable pool cash for commits. |
| `investor_balance_transactions` | Append-only `IN` / `OUT` rows (balance increases vs decreases) with `source`: `MANUAL_TOPUP`, `NOTE_INVESTMENT_COMMIT`, `NOTE_INVESTMENT_RELEASE`. |

Money fields use `numeric(18,6)` (Prisma `Decimal`).

## Commit flow

1. Investor must have access to `investorOrganizationId` and `deposit_received` on the org (unchanged).
2. Note must be `PUBLISHED` with `funding_status` `OPEN` and remaining capacity (unchanged).
3. In the same DB transaction as `NoteInvestment` creation, the API debits `available_amount` by the commit amount. If the debit would go negative, the API returns `422` with `INSUFFICIENT_INVESTOR_BALANCE` and rolls back.

## Funding failure release

When admin **fails funding** on a note, committed investments are marked `RELEASED` and each affected org receives a **credit** of the investment amount (`NOTE_INVESTMENT_RELEASE`), restoring pool cash for interaction testing.

## Test top-up (non-production)

Enable only when you intentionally allow fake credits (e.g. local or staging). This flag is enforced by the API route; never set in production.

```bash
INVESTOR_BALANCE_TEST_TOPUP_ENABLED=true
```

**Investor UI:** The marketplace header includes a dashed **Dev only** panel with preset top-up buttons next to available balance. Calls succeed only when the API flag is `true`; otherwise the API returns `TEST_TOPUP_DISABLED`. **Removing for production:** delete `apps/investor/src/app/investments/_components/investments-dev-balance-topup.tsx` and remove its import/usage from `apps/investor/src/app/investments/page.tsx`.

**Request** (investor JWT):

```http
POST /v1/investor/balance/test-topup
Content-Type: application/json

{
  "investorOrganizationId": "<org-cuid>",
  "amount": 50000
}
```

**Response**: same shape as `GET /v1/investor/portfolio` after the credit.

Never enable this in production without additional controls.

## Shared types and SDK

- `InvestorPortfolioResponse` in `packages/types` (`investor` portfolio fields).
- `ApiClient.getInvestorPortfolio()` and `postInvestorBalanceTestTopup()` in `packages/config`.

## Known limitations (this phase)

- No real payment rail or bank deposit reconciliation; `MANUAL_TOPUP` is for testing only.
- Balance is **not** automatically adjusted when notes repay or settle; that remains tied to the broader note ledger and future wallet work.
- Existing orgs have **no** balance row until first top-up or credit; effective available balance is treated as `0` until then.

## Tests

- `apps/api/src/modules/notes/investor-balance.test.ts` — unit coverage for debit success / insufficient funds path (mocked transaction client).
