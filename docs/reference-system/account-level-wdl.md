# Account-level withdrawal canonical references

Account-level `WithdrawalInstruction` rows (no `note_id`) allocate:

```text
WDL-{YYYYMM}-{XXX}
```

Product-linked withdrawals (note-linked issuer disbursement, residual, etc.) still allocate:

```text
WDL-{PRODUCT_CODE}-{YYYYMM}-{XXX}
```

Both are stored on `withdrawal_instructions.display_reference`. Allocation happens at create time only (`createWithdrawalInstructionWithDisplayReference`). Historical account-level rows may remain `null` and must not be backfilled.

## Flows

### `createInvestorWithdrawal` (investor API)

- **Entry point:** `POST /v1/investor/balance/withdraw`
- **Service:** `NoteService.createInvestorWithdrawal`
- **Characteristics:** `withdrawal_type = INVESTOR_WITHDRAWAL`, `note_id = null`
- **Reference:** account-scoped `WDL-{YYYYMM}-{XXX}`

### Admin non-note withdrawal (`createWithdrawal` without `noteId`)

- Same account-scoped allocator path when no note is linked

## Display

UI uses `formatWithdrawalReference({ displayReference, id })`:

- Canonical present → show `WDL-…` as stored
- Canonical null (historical) → short-id fallback `#XXXXXXXX`
- Do not generate a fake `WDL-` value in the frontend
