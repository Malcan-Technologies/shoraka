# Marketplace feature and account balances

This guide explains the current marketplace surfaces end to end and how investor account balances, portfolio history, and activity are derived from note lifecycle events.

## Feature scope

- Investor marketplace browsing and commit flow.
- Public marketplace browsing on landing surfaces.
- Investor portfolio totals and available balance.
- Investor portfolio history chart and balance activity feed.
- Admin note actions that impact investor balances.
- Transaction and ledger records used for audit and reconciliation.

## Main user flows

### Authenticated investor flow

1. Investor opens the marketplace at `apps/investor/src/app/investments/page.tsx` and loads published open notes from `GET /v1/marketplace/notes`.
2. Investor opens a note detail at `apps/investor/src/app/investments/[id]/page.tsx`.
3. Investor commits from the marketplace dialog via `POST /v1/marketplace/notes/:id/investments`.
4. API creates a `note_investments` row and debits the investor organization's `available_amount` in the same transaction.
5. Portfolio widgets read:
   - `GET /v1/investor/portfolio` for balances and counts
   - `GET /v1/investor/portfolio/history` for the chart series
   - `GET /v1/investor/balance/activity` for note and balance activity shown in the investment detail view
6. Admin closes funding (`/v1/admin/notes/:id/funding/close`) or fails funding (`/v1/admin/notes/:id/funding/fail`).
7. During servicing, repayment and settlement are handled in note operations.
8. When settlement is posted (`/v1/admin/notes/:id/settlements/:settlementId/post`), investor balances are credited with principal + net profit allocation.

### Public landing flow

1. Anonymous users see featured opportunities in the landing carousel and on the marketing `/marketplace` route.
2. These landing surfaces load read-only note data from `GET /v1/public/marketplace/notes`.
3. Landing cards reuse the same marketplace card language as the investor marketplace, but the CTA leads to `/get-started` instead of opening an invest dialog.

## API endpoints involved

### Marketplace and portfolio

- `GET /v1/marketplace/notes`
- `GET /v1/marketplace/notes/:id`
- `POST /v1/marketplace/notes/:id/investments`
- `GET /v1/public/marketplace/notes`
- `GET /v1/investor/portfolio`
- `GET /v1/investor/portfolio/history`
- `GET /v1/investor/balance/activity`
- `GET /v1/investor/investments`

### Admin note actions affecting balances

- `POST /v1/admin/notes/:id/funding/fail` (releases committed capital back to investors)
- `POST /v1/admin/notes/:id/settlements/:settlementId/post` (releases principal + net profit back to investors)

### Dev-only testing endpoint

- `POST /v1/investor/balance/test-topup`

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

`GET /v1/investor/portfolio/history` returns the historical portfolio time series used by the investor chart. The chart now plots `portfolioTotal` and carries the latest known value forward to today for the selected range.

`GET /v1/investor/balance/activity` returns the investor-facing activity list used in the investment detail page.

## Dev top-up (non-production only)

When this endpoint is used, the API also posts an `INVESTOR_POOL` ledger credit so bucket reporting stays aligned with simulated inflow.

The dev top-up path also marks `investor_organizations.deposit_received = true` so local testing can proceed through marketplace commit checks without a separate manual deposit step.

This helper exists for local and staging-style testing only. Remove or lock down the route before production hardening.

## Key implementation files

- `apps/landing/src/app/(marketing)/marketplace/page.tsx`
- `apps/landing/src/components/landing-convenience-listings.tsx`
- `apps/landing/src/components/investment-listings-carousel.tsx`
- `apps/landing/src/components/investment-listing-card.tsx`
- `apps/investor/src/app/investments/page.tsx`
- `apps/investor/src/app/investments/[id]/page.tsx`
- `apps/investor/src/investments/hooks/use-marketplace-notes.ts`
- `apps/investor/src/components/portfolio-overview-card.tsx`
- `apps/api/src/modules/notes/controller.ts`
- `apps/api/src/modules/notes/service.ts`
- `apps/api/src/modules/notes/investor-balance.ts`
- `apps/api/prisma/schema.prisma`
- `packages/config/src/api-client.ts`

## Current constraints

- No real bank rail reconciliation in this flow; production top-ups should come from controlled finance operations, not test endpoints.
- `investor_balance_transactions.source` currently uses `NOTE_INVESTMENT_RELEASE` for both funding-fail release and settlement payout release; reporting can distinguish by metadata but not by enum value yet.
- If an org has never received any balance movement, it may not have a row until first upsert path creates it.
- The landing marketplace remains read-only. Note detail and investment actions live in the investor app.
