# Marketplace feature and account balances

This guide explains how the investor marketplace works end to end and how investor account balances are debited and credited through note lifecycle events.

## Feature scope

- Investor marketplace browsing and commit flow.
- Investor portfolio totals and available balance.
- Admin note actions that impact investor balances.
- Transaction and ledger records used for audit and reconciliation.

## Main user flow

1. Investor opens marketplace (`apps/investor/src/app/investments/page.tsx`) and loads published open notes from `GET /v1/marketplace/notes`.
2. Investor selects a note and commits from the UI dialog via `POST /v1/marketplace/notes/:id/investments`.
3. API creates a `note_investments` row and debits the investor organization's `available_amount` in the same transaction.
4. Admin closes funding (`/v1/admin/notes/:id/funding/close`) or fails funding (`/v1/admin/notes/:id/funding/fail`).
5. During servicing, repayment and settlement are handled in note operations.
6. When settlement is posted (`/v1/admin/notes/:id/settlements/:settlementId/post`), investor balances are credited with principal + net profit allocation.

## API endpoints involved

### Marketplace and portfolio

- `GET /v1/marketplace/notes`
- `GET /v1/marketplace/notes/:id`
- `POST /v1/marketplace/notes/:id/investments`
- `GET /v1/investor/portfolio`
- `GET /v1/investor/investments`

### Admin note actions affecting balances

- `POST /v1/admin/notes/:id/funding/fail` (releases committed capital back to investors)
- `POST /v1/admin/notes/:id/settlements/:settlementId/post` (releases principal + net profit back to investors)

### Dev-only testing endpoint

- `POST /v1/investor/balance/test-topup` (guarded by env flag)

## Data model

| Table | Purpose |
| ----- | ------- |
| `investor_balances` | One row per investor organization with spendable cash in `available_amount`. |
| `investor_balance_transactions` | Append-only movement log using `IN` and `OUT` direction with source attribution. |
| `note_investments` | Investment commitment records linked to notes and investor organizations. |
| `note_settlements` | Settlement snapshots, approvals, and posting state used to derive investor payout allocations. |
| `note_ledger_entries` | Note-level operational bucket ledger (Investor Pool, Repayment Pool, Operating, Ta'widh, Gharamah). |

All money columns use `numeric(18,6)` through Prisma `Decimal`.

## Balance movement rules

### 1) Commit investment

- Trigger: `POST /v1/marketplace/notes/:id/investments`
- Preconditions:
  - investor org is owned/member-accessible by actor
  - `deposit_received = true`
  - note is `PUBLISHED` and `funding_status = OPEN`
  - amount respects remaining capacity and minimum ticket
- Result:
  - `investor_balances.available_amount` decreases
  - transaction row written as:
    - `direction = OUT`
    - `source = NOTE_INVESTMENT_COMMIT`

### 2) Funding failure release

- Trigger: `POST /v1/admin/notes/:id/funding/fail`
- Result:
  - committed investments become `RELEASED`
  - each affected investor org is credited by committed amount
  - transaction row written as:
    - `direction = IN`
    - `source = NOTE_INVESTMENT_RELEASE`

### 3) Settlement payout release

- Trigger: `POST /v1/admin/notes/:id/settlements/:settlementId/post`
- Result:
  - settlement allocations are read from `note_settlements.preview_snapshot.allocations`
  - each investor org receives `principal + profitNet`
  - transaction row written as:
    - `direction = IN`
    - `source = NOTE_INVESTMENT_RELEASE`
    - metadata includes `releaseReason = SETTLEMENT_PAYOUT`, `settlementId`, `principal`, `profitNet`
  - note moves to `REPAID` and servicing `SETTLED`
  - related `note_investments` move to `SETTLED`

## Portfolio numbers shown in investor app

`GET /v1/investor/portfolio` returns:

- `availableBalance`: sum of accessible org `investor_balances.available_amount`
- `totalInvestment`: sum of `note_investments.amount` in `COMMITTED` or `CONFIRMED`
- `portfolioTotal`: `availableBalance + totalInvestment`
- `investmentCount`: count of matching investment rows

This is what powers the account overview figures in investor UI.

## Dev top-up (non-production only)

Enable only for local/staging testing:

```bash
INVESTOR_BALANCE_TEST_TOPUP_ENABLED=true
```

When this endpoint is used, the API also posts an `INVESTOR_POOL` ledger credit so bucket reporting stays aligned with simulated inflow.

Do not enable this flag in production.

## Key implementation files

- `apps/investor/src/app/investments/page.tsx`
- `apps/investor/src/investments/hooks/use-marketplace-notes.ts`
- `apps/api/src/modules/notes/controller.ts`
- `apps/api/src/modules/notes/service.ts`
- `apps/api/src/modules/notes/investor-balance.ts`
- `apps/api/prisma/schema.prisma`
- `packages/config/src/api-client.ts`

## Current constraints

- No real bank rail reconciliation in this flow; production top-ups should come from controlled finance operations, not test endpoints.
- `investor_balance_transactions.source` currently uses `NOTE_INVESTMENT_RELEASE` for both funding-fail release and settlement payout release; reporting can distinguish by metadata but not by enum value yet.
- If an org has never received any balance movement, it may not have a row until first upsert path creates it.
