# Account-level withdrawal canonical reference inspection

Phase 4A inspect-only report for non-note-linked `WithdrawalInstruction` records (primarily investor portal withdrawals and admin non-note withdrawals).

## Flows in scope

### `createInvestorWithdrawal` (investor API)

- **Entry point:** `POST /v1/investor/withdrawals` (`apps/api/src/modules/notes/controller.ts`)
- **Service:** `NoteService.createInvestorWithdrawal` (`apps/api/src/modules/notes/service.ts`)
- **Characteristics:**
  - `withdrawal_type = INVESTOR_WITHDRAWAL`
  - `note_id = null`
  - `investor_organization_id` set
  - Debits investor balance ledger (`debitInvestorBalanceForWithdrawal`)
  - **No product-scoped `display_reference` allocated** (account-level path in `createWithdrawalInstructionWithDisplayReference`)

### Admin non-note withdrawal (`createWithdrawal`)

- **Entry point:** `POST /v1/admin/notes/withdrawals` (admin notes module)
- **Service:** `NoteService.createWithdrawal`
- **Characteristics:**
  - `note_id` optional
  - When `note_id` is omitted, behaves as account-level withdrawal with no canonical `WDL-{PRODUCT}-...` reference
  - Used for manual admin adjustments and non-note-linked payouts

## Exposure surfaces

| Surface | Investor withdrawals | Admin non-note withdrawals |
|--------|----------------------|----------------------------|
| Investor UI | Yes — investor portal withdrawal request/history (`apps/investor`) | No |
| Admin UI | Yes — Finance → Investor Withdrawals list/detail | Yes — admin withdrawal create when no `noteId` |
| Emails | Operational notifications may reference internal IDs; no canonical WDL today | Same |
| Trustee letters | Investor withdrawal letters use `display_reference` when present; account-level withdrawals currently have empty/absent `ourRef` fallback to internal id in filename only | Non-note admin withdrawals generally do not generate product trustee letters |
| Exports / reconciliation | Transaction ledger uses `INVESTOR_WITHDRAWAL_REQUEST` source; references internal withdrawal id | Admin exports/reconciliation use internal ids |
| External communication | Investors see withdrawal list items by internal id unless UI is later updated | Trustee/external comms lack a stable business reference today |

## Option comparison

### Option A — `WDL-YYYYMM-XXX` (organization/account-scoped format)

**Pros**

- Gives every withdrawal a user/business-facing canonical reference without falsely associating to a product
- Consistent "every money movement has a reference" operational story
- Enables trustee letters, exports, and support comms to use one format family

**Cons**

- Requires new allocator rules distinct from product-scoped `WDL-{PRODUCT}-...`
- Historical account-level withdrawals remain without references unless backfilled
- Must ensure parsing/search distinguishes product vs account WDL formats

### Option B — remain without canonical reference (current behavior)

**Pros**

- No migration/backfill for historical account-level withdrawals
- Avoids implying product linkage where none exists
- Smallest implementation surface for Phase 4A

**Cons**

- Investor/admin support continues to rely on internal CUID fragments
- Trustee letters and exports lack a stable business reference for account withdrawals
- As canonical references roll out elsewhere, these withdrawals remain inconsistent

## Recommendation

**Defer implementation; plan Option A for a later phase.**

Account-level withdrawals are real money movements with investor/admin visibility, so they will eventually need a canonical reference. However, introducing `WDL-YYYYMM-XXX` should be a deliberate follow-up phase that:

1. Defines allocator behavior separately from product-scoped WDL
2. Covers investor UI, admin finance views, exports, and trustee letter `ourRef` together
3. Includes an explicit backfill decision for historical account-level withdrawals

Until then, keep account-level withdrawals unallocated (current Phase 3 behavior) and do **not** introduce `GEN`, guessed product association, or mixed-format ambiguity in product-scoped flows.
