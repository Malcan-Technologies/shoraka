## Admin Note Detail Activity Timeline Ordering

================================================================================
1. Purpose
================================================================================

The Admin Note Detail Activity Timeline is a curated activity feed of `NoteAuditLog` rows.
It is displayed `newest-first`.
The timeline must be deterministic when multiple events are created with the same timestamp.

Raw Audit History on the same page is a separate `ContextualAuditHistoryPanel` over `NoteAuditLog`.

================================================================================
2. Why deterministic sorting is needed
================================================================================

Some events are created very close together, sometimes in the same transaction, or with the same timestamp precision.

Example:

- `NOTE_FUNDING_CLOSED`
- `DISBURSEMENT_INITIATED`

Operationally:
Close funding happens first.
Issuer disbursement withdrawal creation (audited as `DISBURSEMENT_INITIATED`) happens after.

Because the timeline is `newest-first`, if both have the same timestamp, the UI should show:

1. `DISBURSEMENT_INITIATED`
2. `NOTE_FUNDING_CLOSED`

Without secondary sorting, the DB may return same-timestamp rows in inconsistent order.

`CLOSE_FUNDING` is not a live note `event_type`. It may appear as withdrawal-instruction `metadata.source` and as a CSV/display alias. Legacy/display compatibility alias; not emitted by current audit writers.

================================================================================
3. Current sorting rule
================================================================================

Primary sort:

- `occurredAt` / `occurred_at` descending (newest event first), falling back to `createdAt`

Secondary sort (only when timestamps tie):

- lifecycle priority
- because the timeline is `newest-first`, later lifecycle steps appear first when timestamps match

Final fallback:

- `id` only when timestamp and lifecycle priority are also identical
- `id` is only used for deterministic ordering and does not override business lifecycle order

Implementation: `apps/api/src/modules/notes/admin-note-events-sorting.ts`.

================================================================================
4. Current lifecycle priority map
================================================================================

Priority numbers increase from earliest → latest lifecycle step (`ADMIN_NOTE_EVENT_LIFECYCLE_PRIORITY`):

1. `NOTE_CREATED`
2. `NOTE_TERMS_UPDATED`
3. `NOTE_PROSPECTUS_REVIEW_CREATED`
4. `NOTE_PROSPECTUS_APPROVED`
5. `NOTE_PROSPECTUS_INVALIDATED`
6. `NOTE_PUBLISHED`
7. `INVESTMENT_COMMITTED`
8. `NOTE_FUNDING_CLOSED`
9. `NOTE_FUNDING_FAILED`
10. `DISBURSEMENT_INITIATED`
11. `SHORAKA_ORDER_SUBMITTED`
12. `SHORAKA_CERTIFICATE_RECEIVED`
13. `DISBURSEMENT_LETTER_GENERATED`
14. `DISBURSEMENT_SUBMITTED_TO_TRUSTEE`
15. `DISBURSEMENT_BENEFICIARY_UPDATED`
16. `DISBURSEMENT_COMPLETED`
17. `NOTE_ACTIVATED`
18. `REPAYMENT_SUBMITTED`
19. `REPAYMENT_RECEIVED`
20. `REPAYMENT_REJECTED`
21. `SETTLEMENT_PREVIEWED`
22. `SETTLEMENT_APPROVED`
23. `SETTLEMENT_POSTED`
24. `SERVICE_FEE_TRUSTEE_LETTER_GENERATED`
25. `SERVICE_FEE_TRUSTEE_SUBMITTED`
26. `SERVICE_FEE_TRUSTEE_COMPLETED`
27. `RESIDUAL_RETURN_LETTER_GENERATED`
28. `RESIDUAL_RETURN_SUBMITTED_TO_TRUSTEE`
29. `RESIDUAL_RETURN_COMPLETED`
30. `NOTE_SERVICING_STATUS_CHANGED`
31. `ARREARS_LETTER_GENERATED`
32. `DEFAULT_NOTICE_GENERATED`
33. `NOTE_MARKED_DEFAULT`
34. `NOTE_UNPUBLISHED`
35. `TRUSTEE_SIGNATURE_UPDATED`

Unknown event types use `UNKNOWN_EVENT_PRIORITY = 999` (`NOTE_CAMPAIGN_PAUSED` / `NOTE_CAMPAIGN_RESUMED` are live events and currently use this fallback unless added to the map).

Tawarruq Transaction actions are logged as:

- `SHORAKA_ORDER_SUBMITTED` → CSV/display “Tawarruq order submitted”
- `SHORAKA_CERTIFICATE_RECEIVED` → CSV/display “Tawarruq Certificate fetched”

`SHORAKA_CERTIFICATE_FETCHED` and `NOTE_DEFAULT_MARKED` are CSV/display aliases only. Legacy/display compatibility alias; not emitted by current audit writers.

Keep the timeline display rule unchanged (`newest-first` with deterministic tie-breakers).

================================================================================
5. Important example
================================================================================

If `NOTE_FUNDING_CLOSED` and `DISBURSEMENT_INITIATED` have the same timestamp:

Lifecycle order:
`NOTE_FUNDING_CLOSED`
→ `DISBURSEMENT_INITIATED`

Newest-first display order:
`DISBURSEMENT_INITIATED`
→ `NOTE_FUNDING_CLOSED`

This is expected and correct for the Admin Note Detail Activity Timeline because it is an activity feed, not an oldest-first lifecycle stepper.

================================================================================
6. Activity feed vs lifecycle stepper
================================================================================

Admin Note Detail Activity Timeline is `newest-first`.
A lifecycle stepper, if added later, should be `oldest-first`.

Do not change the Activity Timeline to oldest-first unless the product decision changes.

================================================================================
7. Related implementation files
================================================================================

- `apps/api/src/modules/notes/admin-note-events-sorting.ts`
- `apps/api/src/modules/notes/mapper.ts`
- `apps/api/src/modules/notes/repository.ts`
- `apps/api/src/modules/notes/admin-note-events-sorting.test.ts`

Brief explanation:

- repository fetches note audit rows newest-first
- mapper maps `NoteAuditLog` for the note detail response
- `admin-note-events-sorting.ts` applies deterministic lifecycle sort as a tie-breaker
- tests cover same-timestamp sorting behavior

================================================================================
8. Maintenance rule
================================================================================

When adding a new note event type:

1. Decide where it belongs in the note lifecycle.
2. Add it to `ADMIN_NOTE_EVENT_LIFECYCLE_PRIORITY` if same-timestamp ordering matters.
3. Add/update tests for same-timestamp ordering if it can occur near another event.
4. Keep unknown events safe with fallback priority.
