# Amendment Flow Guide

This guide explains how the amendment flow works when an application is in `AMENDMENT_REQUESTED` status. It covers the database structure, API behavior, and how the frontend displays and locks steps based on reviewer remarks.

---

## Overview

When an admin requests amendments on an application, the status changes to `AMENDMENT_REQUESTED`. The issuer must fix the flagged sections or items, acknowledge each flagged step, and then resubmit. Only sections and items that have amendment remarks can be edited. All other steps are read-only until resubmit.

---

## Database Structure

### Application Table

The `applications` table stores two fields used by the amendment flow.

**`review_cycle`** (integer, default 1) — Tracks which submission round the application is in. Each resubmit increments this value.

**`amendment_acknowledged_workflow_ids`** (string array, default empty) — Stores workflow step IDs that the issuer has acknowledged. When the issuer saves a flagged step, the frontend calls the acknowledge endpoint with that step’s workflow ID. The backend appends it to this array. Resubmit requires all flagged steps (except financial and final declarations) to be acknowledged before proceeding. The `declarations` column is always allowed to PATCH during `AMENDMENT_REQUESTED` (final confirmations) even when no amendment remark targets that section.

### ApplicationReviewRemark Table

Remarks are stored in `application_review_remarks` (Prisma model: `ApplicationReviewRemark`). Schema file: `apps/api/prisma/schema.prisma`.

Important fields:

- **`application_id`** — Links the remark to an application.
- **`scope`** — Either `"section"` (whole step) or `"item"` (specific row, e.g. one invoice or one document).
- **`scope_key`** — Identifies the section or item. Examples: `"contract_details"`, `"invoice_details:0:Invoice"`, `"supporting_documents:doc:financial_docs:0:Latest_Management_Account"`.
- **`action_type`** — Must be `"REQUEST_AMENDMENT"` for amendment remarks. The amendment logic filters by this value.
- **`remark`** — The reviewer’s text.
- **`author_user_id`** — Who wrote the remark.
- **`submitted_at`** — When the remark was submitted. Only remarks with non-null `submitted_at` are used.

There is a unique constraint on `(application_id, scope, scope_key)`, so each section or item has at most one amendment remark.

### ApplicationRevision Table

On resubmit, a snapshot of the application is stored in `application_revisions` (Prisma model: `ApplicationRevision`). Each row has `application_id`, `review_cycle`, `snapshot` (JSON), and `submitted_at`. The snapshot includes application data, contract, invoices, and issuer organization. This is used for audit and history.

---

## What Is Stored vs Calculated

**Stored in the database:** Application status, `review_cycle`, `amendment_acknowledged_workflow_ids`, and all rows in `application_review_remarks` and `application_revisions`.

**Calculated on the frontend:** `flaggedSections` and `flaggedItems` are derived from the remarks returned by the API. The stepper’s red indicators and tab locking are computed from these sets. The frontend does not store them; it rebuilds them whenever `amendmentContext` changes.

---

## API Endpoints

### GET /v1/applications/:id/amendment-context

**File:** `apps/api/src/modules/applications/controller.ts` (route), `apps/api/src/modules/applications/service.ts` (`getAmendmentContext`), `apps/api/src/modules/applications/amendments/service.ts` (`loadAmendmentRemarks`).

Returns `{ application, review_cycle, remarks }`. The service verifies the user has access to the application, loads it, then calls `loadAmendmentRemarks`. Remarks are filtered by `action_type = "REQUEST_AMENDMENT"` and `submitted_at IS NOT NULL`, ordered by `created_at` ascending. The response is raw; no extra parsing is done.

### POST /v1/applications/:id/acknowledge-workflow

**File:** `apps/api/src/modules/applications/controller.ts` (route), `apps/api/src/modules/applications/service.ts` (`acknowledgeWorkflow`), `apps/api/src/modules/applications/amendments/service.ts` (`acknowledgeWorkflow`).

Body: `{ workflowId: string }`. Appends `workflowId` to `amendment_acknowledged_workflow_ids` if not already present. Only allowed when status is `AMENDMENT_REQUESTED`. The frontend calls this when the user saves a flagged step.

### POST /v1/applications/:id/resubmit

**File:** `apps/api/src/modules/applications/controller.ts` (route), `apps/api/src/modules/applications/service.ts` (`resubmitApplication`), `apps/api/src/modules/applications/amendments/service.ts` (`resubmitApplication`).

Resubmits the application. The amendments service:

1. Verifies status is `AMENDMENT_REQUESTED`.
2. Loads all `REQUEST_AMENDMENT` remarks and builds `requiredSectionKeys` (section keys and, for item remarks, the first part of `scope_key`).
3. Skips `financial*` and `review_and_submit` for acknowledgement checks.
4. Compares `requiredSectionKeys` with `amendment_acknowledged_workflow_ids` (converted to step keys by stripping `_\d+`). If any required step is missing, throws `MISSING_ACKNOWLEDGEMENTS`.
5. In a transaction: deletes `REQUEST_AMENDMENT` remarks, deletes `AMENDMENT_REQUESTED` review items and review records, creates an `ApplicationRevision` snapshot, increments `review_cycle`, clears `amendment_acknowledged_workflow_ids`, and sets status to `RESUBMITTED`.
6. Creates an `ApplicationLog` entry with `event_type: "APPLICATION_RESUBMITTED"`.

---

## Frontend Behavior

### Loading Amendment Context

**File:** `apps/issuer/src/app/(application-flow)/applications/edit/[id]/page.tsx`.

When status is `AMENDMENT_REQUESTED`, the edit page fetches `/v1/applications/:id/amendment-context` and stores the result in `amendmentContext` state. The response includes `review_cycle` and `remarks`. A dev-only mock is available when `devPreviewAmendment` is true.

### Building flaggedSections and flaggedItems

**File:** `apps/issuer/src/app/(application-flow)/applications/edit/[id]/page.tsx`.

From `amendmentContext.remarks`:

- **flaggedSections** — For each remark with `scope === "section"`, add `scope_key` to a Set.
- **flaggedItems** — For each remark with `scope === "item"`, use `scope_key.split(":")[0]` as the tab key and add the full `scope_key` to a Map under that tab.

Example: `scope_key: "invoice_details:0:Invoice"` adds `"invoice_details:0:Invoice"` to `flaggedItems.get("invoice_details")`.

### Stepper Red Indicators

**File:** `apps/issuer/src/app/(application-flow)/applications/edit/[id]/page.tsx` (computes `amendmentFlaggedStepKeys`), `apps/issuer/src/app/(application-flow)/applications/components/progress-indicator.tsx` (renders).

`amendmentFlaggedStepKeys` is the union of all keys in `flaggedSections` and all keys in `flaggedItems`. When in amendment mode, `review_and_submit` is always included. The edit page passes `amendmentFlaggedStepKeys`, `acknowledgedWorkflowIds`, and `stepKeys` to `ProgressIndicator`, which marks flagged steps with a red indicator.

### Tab Locking

**File:** `apps/issuer/src/app/(application-flow)/applications/edit/[id]/page.tsx`.

`currentStepKey` is derived from the current workflow step via `getStepKeyFromStepId` (e.g. `"contract_details_1"` → `"contract_details"`). `isStepFlagged` is true if `flaggedSections.has(currentStepKey)` or `flaggedItems` has entries for that key. `stepReadOnly = isAmendmentModeEffective && !isStepFlagged`. When `stepReadOnly` is true, the step is read-only and the user can only navigate, not save.

### Item-Level Unlocking

**File:** `apps/issuer/src/app/(application-flow)/applications/steps/invoice-details-step.tsx`, `supporting-documents-step.tsx`, `contract-details-step.tsx`.

For invoice details, the step uses `flaggedItems.get("invoice_details")` to know which invoice rows are editable. For supporting documents, it uses `flaggedItems.get("supporting_documents")` and builds full `scope_key` values to match documents. Contract details use section-level flags only; there is no item-level unlocking for that step.

### Resubmit Button

**File:** `apps/issuer/src/app/(application-flow)/applications/edit/[id]/page.tsx`.

The Resubmit button is enabled when `allAmendmentStepsAcknowledged` is true. That excludes `financial*` and `review_and_submit` from the acknowledgement check. The frontend maps `amendment_acknowledged_workflow_ids` to step keys via `getStepKeyFromStepId` to compute `acknowledgedWorkflowIds`.

---

## Key File Reference

| Purpose | File |
|---------|------|
| Prisma schema | `apps/api/prisma/schema.prisma` |
| Amendment logic | `apps/api/src/modules/applications/amendments/service.ts` |
| Main application service | `apps/api/src/modules/applications/service.ts` |
| API routes | `apps/api/src/modules/applications/controller.ts` |
| Edit page (context, flags, locking) | `apps/issuer/src/app/(application-flow)/applications/edit/[id]/page.tsx` |
| Stepper | `apps/issuer/src/app/(application-flow)/applications/components/progress-indicator.tsx` |
| Amendment remark card | `apps/issuer/src/app/(application-flow)/applications/components/amendments/amendment-remark-card.tsx` |
| Invoice step | `apps/issuer/src/app/(application-flow)/applications/steps/invoice-details-step.tsx` |
| Supporting documents step | `apps/issuer/src/app/(application-flow)/applications/steps/supporting-documents-step.tsx` |
| Contract step | `apps/issuer/src/app/(application-flow)/applications/steps/contract-details-step.tsx` |

---

## Debugging Checklist

| Symptom | Check |
|---------|------|
| Red step not showing | `amendmentFlaggedStepKeys` in edit page |
| Step shows red but should not | `flaggedSections` / `flaggedItems` logic |
| Item not unlocking | Step file (invoice-details, supporting-documents) scope_key matching |
| Remarks not loading | Fetch effect in edit page or `getAmendmentContext` in service |
| Resubmit fails | `resubmitApplication` in amendments service |
| Resubmit says "missing acknowledgements" | `requiredSectionKeys` vs `acknowledgedWorkflowIds` in amendments service |
| Tab locked when it should be editable | `isStepFlagged` in edit page |
| Tab editable when it should be locked | Same |
