# Amendment Flow (overview)

This document describes the Loan Amendment Flow implementation.

Key concepts
- application.review_cycle: integer that advances when a resubmission occurs.
- application.amendment_acknowledged_workflow_ids: text[] of workflow step ids the applicant has acknowledged during amendment.
- Admin review tables are not versioned. Cleanup is based on scope_key patterns.

Endpoints
- GET /v1/applications/:id/amendment-context
  - Returns active REQUEST_AMENDMENT remarks for the application (no review_cycle filter).
  - Remarks are returned raw (scope, scope_key). No parsing.

- POST /v1/applications/:id/acknowledge-workflow
  - Body: { workflowId }
  - Appends workflowId to application's amendment_acknowledged_workflow_ids (deduped).

- POST /v1/applications/:id/resubmit
  - Validates all required workflowIds (derived from active remarks) are acknowledged.
  - Creates ApplicationRevision snapshot (snapshot contains product reference, application, contract, invoices, issuer_organization).
  - Deletes/cleans admin review rows using scope_key matching with exceptions:
    - Preserve contract-related rows if contract.status === 'APPROVED'
    - Delete invoice rows only for invoices that had REQUEST_AMENDMENT
  - Increments application.review_cycle, sets status = UNDER_REVIEW, clears acknowledgements.
  - Inserts ApplicationLog event APPLICATION_RESUBMITTED.

Utilities
- `packages/types/src/review-scope.ts`
  - Simple string comparison: section scope_key, item tab = scope_key.split(":")[0].

