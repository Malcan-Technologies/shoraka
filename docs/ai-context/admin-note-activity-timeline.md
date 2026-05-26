## Admin Note Detail Activity Timeline Ordering

================================================================================
1. Purpose
================================================================================

The Admin Note Detail Activity Timeline is an activity feed for note events.
It is displayed `newest-first`.
The timeline must be deterministic when multiple events are created with the same timestamp.

================================================================================
2. Why deterministic sorting is needed
================================================================================

Some events are created very close together, sometimes in the same transaction, or with the same timestamp precision.

Example:
- `CLOSE_FUNDING`
- `ISSUER_DISBURSEMENT_WITHDRAWAL_CREATED`

Operationally:
Close Funding happens first.
Issuer Disbursement Withdrawal Created happens after.

Because the timeline is `newest-first`, if both have the same timestamp, the UI should show:
1. `ISSUER_DISBURSEMENT_WITHDRAWAL_CREATED`
2. `CLOSE_FUNDING`

Without secondary sorting, the DB may return same-timestamp rows in inconsistent order.

================================================================================
3. Current sorting rule
================================================================================

Primary sort:
- `createdAt` / `created_at` descending (newest event first)

Secondary sort (only when timestamps tie):
- lifecycle priority
- because the timeline is `newest-first`, later lifecycle steps appear first when `created_at` matches

Final fallback:
- `id` only when timestamp and lifecycle priority are also identical
- `id` is only used for deterministic ordering and does not override business lifecycle order

================================================================================
4. Current lifecycle priority map
================================================================================

Priority numbers increase from earliest → latest lifecycle step.

1. `NOTE_CREATED_FROM_INVOICE`
2. `PUBLISH`
3. `INVESTMENT_COMMITTED`
4. `CLOSE_FUNDING`
5. `ISSUER_DISBURSEMENT_WITHDRAWAL_CREATED`
6. `SHORAKA_ORDER_SUBMITTED`
7. `SHORAKA_CERTIFICATE_FETCHED`
8. `WITHDRAWAL_LETTER_GENERATED`
9. `WITHDRAWAL_SUBMITTED_TO_TRUSTEE`
10. `WITHDRAWAL_COMPLETED`
11. `PAYMENT_RECEIVED`
12. `ISSUER_PAYMENT_SUBMITTED`
13. `SETTLEMENT_PREVIEWED`
14. `SETTLEMENT_APPROVED`
15. `SERVICE_FEE_TRUSTEE_LETTER_GENERATED`
16. `SERVICE_FEE_TRUSTEE_LETTER_SUBMITTED`
17. `SERVICE_FEE_TRUSTEE_INSTRUCTION_COMPLETED`
18. `ISSUER_RESIDUAL_WITHDRAWAL_CREATED`
19. `ARREARS_LETTER_GENERATED`
20. `DEFAULT_LETTER_GENERATED`
21. `NOTE_DEFAULT_MARKED`

Unknown event types use `UNKNOWN_EVENT_PRIORITY = 999`.

Tawarruq Transaction actions are now logged in the activity timeline as:
- `SHORAKA_ORDER_SUBMITTED` → label: “Tawarruq order submitted”
- `SHORAKA_CERTIFICATE_FETCHED` → label: “Tawarruq Certificate fetched”

Keep the timeline display rule unchanged (`newest-first` with deterministic tie-breakers).

================================================================================
5. Important example
================================================================================

If `CLOSE_FUNDING` and `ISSUER_DISBURSEMENT_WITHDRAWAL_CREATED` have the same timestamp:

Lifecycle order:
`CLOSE_FUNDING`
→ `ISSUER_DISBURSEMENT_WITHDRAWAL_CREATED`

Newest-first display order:
`ISSUER_DISBURSEMENT_WITHDRAWAL_CREATED`
→ `CLOSE_FUNDING`

This is expected and correct for the Admin Note Detail Activity Timeline because it is an activity feed, not an oldest-first lifecycle stepper.

================================================================================
6. Activity feed vs lifecycle stepper
================================================================================

Admin Note Detail Activity Timeline is `newest-first`.
A lifecycle stepper, if added later, should be `oldest-first`.

Do not change the Activity Timeline to oldest-first unless the product decision changes.

================================================================================
7. Known item to confirm
================================================================================

`ISSUER_PAYMENT_SUBMITTED` currently appears after `PAYMENT_RECEIVED` in the lifecycle priority map.

This should be confirmed with business/product:
- If `ISSUER_PAYMENT_SUBMITTED` means issuer submitted repayment proof before admin records/approves receipt, it may need to move before `PAYMENT_RECEIVED`.
- If it is an admin-side event after payment receipt, the current order is acceptable.

Do not change this order without confirming the meaning of `ISSUER_PAYMENT_SUBMITTED`.

================================================================================
8. Related implementation files
================================================================================

- `apps/api/src/modules/notes/admin-note-events-sorting.ts`
- `apps/api/src/modules/notes/mapper.ts`
- `apps/api/src/modules/notes/repository.ts`
- `apps/api/src/modules/notes/admin-note-events-sorting.test.ts`

Brief explanation:
- `repository.ts` fetches events newest-first by `created_at desc`
- `mapper.ts` maps note events for the note detail response
- `admin-note-events-sorting.ts` applies deterministic lifecycle sort as a tie-breaker
- `admin-note-events-sorting.test.ts` covers same-timestamp sorting behavior

================================================================================
9. Maintenance rule
================================================================================

When adding a new note event type:
1. Decide where it belongs in the note lifecycle.
2. Add it to `ADMIN_NOTE_EVENT_LIFECYCLE_PRIORITY` if same-timestamp ordering matters.
3. Add/update tests for same-timestamp ordering if it can occur near another event.
4. Keep unknown events safe with fallback priority.

