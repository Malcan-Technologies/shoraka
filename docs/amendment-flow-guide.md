# Amendment Flow File Guide

A practical debugging guide for the amendment flow.

---

## 1) Backend Files

### Fetching amendment remarks

**File:** `apps/api/src/modules/applications/service.ts`

**Responsibility:** `getAmendmentContext` loads raw remarks from the database and returns them with the application.

**Bugs likely here:** Remarks not returned, wrong remarks, missing scope/scope_key fields.

---

### Resubmit logic

**File:** `apps/api/src/modules/applications/service.ts`

**Responsibility:** `resubmitApplication` checks acknowledgements, creates revision snapshot, deletes remarks, advances review cycle.

**Bugs likely here:** Resubmit blocked incorrectly, missing acknowledgements error, remarks not deleted, wrong invoices deleted.

---

### Acknowledge workflow logic

**File:** `apps/api/src/modules/applications/service.ts`

**Responsibility:** `acknowledgeWorkflow` adds a section key to the application's acknowledged list so resubmit can proceed.

**Bugs likely here:** Acknowledgement not saved, wrong key stored, resubmit still fails after acknowledge.

---

### API routes (entry points)

**File:** `apps/api/src/modules/applications/controller.ts`

**Responsibility:** Routes that call the service: `GET /:id/amendment-context`, acknowledge endpoint, resubmit endpoint.

**Bugs likely here:** Wrong route, auth blocking, wrong params passed to service.

---

## 2) Frontend Files

### Loading amendment context

**File:** `apps/issuer/src/app/applications/edit/[id]/page.tsx`

**Responsibility:** Fetches `/amendment-context` when app is AMENDMENT_REQUESTED, stores result in `amendmentContext` state.

**Bugs likely here:** Context not fetched, fetched at wrong time, wrong URL, state not updated.

---

### Building flaggedSections / flaggedItems

**File:** `apps/issuer/src/app/applications/edit/[id]/page.tsx`

**Responsibility:** Two useMemos: one builds `flaggedSections` (scope === "section"), one builds `flaggedItems` (scope === "item", tab = split(":")[0]).

**Bugs likely here:** Empty sets when remarks exist, wrong scope_key in set, wrong tab key in map.

---

### Stepper red indicator logic

**File:** `apps/issuer/src/app/applications/edit/[id]/page.tsx` (computes `amendmentSteps`)

**File:** `apps/issuer/src/app/applications/components/progress-indicator.tsx` (renders red)

**Responsibility:** Edit page computes which step numbers are flagged; progress-indicator receives `amendmentSteps` and styles those steps red.

**Bugs likely here:** Wrong step numbers in array, stepKey mismatch with workflow, progress-indicator not applying red style.

---

### Tab locking logic

**File:** `apps/issuer/src/app/applications/edit/[id]/page.tsx`

**Responsibility:** `isStepFlagged` = flaggedSections.has(stepKey) OR flaggedItems has that stepKey. If not flagged → step is read-only (locked).

**Bugs likely here:** Step locked when it should be editable, step editable when it should be locked, wrong stepKey used.

---

### Item unlock logic

**File:** `apps/issuer/src/app/applications/steps/invoice-details-step.tsx`

**Responsibility:** Uses `flaggedInvoiceRemarks` (index from scope_key) to know which invoice rows are editable.

**File:** `apps/issuer/src/app/applications/steps/supporting-documents-step.tsx`

**Responsibility:** Uses `flaggedItems.get("supporting_documents")` and builds full scope_key per doc to know which docs are editable.

**File:** `apps/issuer/src/app/applications/steps/contract-details-step.tsx`

**Responsibility:** Uses `flaggedSections` / `flaggedItems` to know if contract step is editable (no item-level for contract).

**Bugs likely here:** Wrong index parsed from scope_key, wrong scope_key built for doc match, step key typo ("supporting_documents" vs "invoice_details").

---

## 3) If something breaks, check here first

| Symptom | Check this file first |
|---------|------------------------|
| Red step not showing | `edit/[id]/page.tsx` (amendmentSteps useMemo) |
| Step shows red but should not | `edit/[id]/page.tsx` (flaggedSections / flaggedItems logic) |
| Item not unlocking | The step file (invoice-details-step, supporting-documents-step) |
| Item unlocking when it should not | Same step file — scope_key match logic |
| Remarks not loading | `edit/[id]/page.tsx` (fetch effect) or `service.ts` (getAmendmentContext) |
| Resubmit fails | `service.ts` (resubmitApplication) |
| Resubmit says "missing acknowledgements" | `service.ts` (requiredSectionKeys vs acknowledged) |
| Tab locked when it should be editable | `edit/[id]/page.tsx` (isStepFlagged) |
| Tab editable when it should be locked | Same |

---

## 4) How to mentally trace amendment flow

1. **Database** — Remarks live in `application_review_remarks`. Each has `scope`, `scope_key`, `remark`.

2. **API** — `getAmendmentContext` reads those rows and returns them. No parsing. Raw.

3. **Frontend state** — Edit page fetches, stores in `amendmentContext`. Then builds `flaggedSections` and `flaggedItems` from remarks.

4. **Stepper** — Edit page passes `amendmentSteps` (step numbers) to ProgressIndicator. ProgressIndicator renders those steps red.

5. **Tab** — Edit page uses `isStepFlagged` to decide if current step is editable. If not flagged → read-only. Passes `stepReadOnly` to step components.

6. **Item** — Each step component gets `flaggedSections` and `flaggedItems`. It checks: is my step key in there? Is this specific item's scope_key in the set? If yes → editable. If no → locked.

---

**Flow in one line:** Database → API returns raw → Frontend builds sets → Stepper gets step numbers → Tab gets read-only flag → Item gets editable flag from scope_key match.

---

## 5) Edit page amendment flow (detailed)

Step-by-step trace of how the edit page handles amendments.

### Amendment context (source of truth)

- `amendmentContext` holds `{ review_cycle, remarks }`.
- Remarks come from the API (`/amendment-context`) when status is `AMENDMENT_REQUESTED`.
- Or from mock data when `devPreviewAmendment` is on.
- Each remark has `scope`, `scope_key`, `remark`.

### Building flaggedSections and flaggedItems

From `amendmentContext.remarks`:

- **flaggedSections**: if `scope === "section"`, add `scope_key` to a Set.
- **flaggedItems**: if `scope === "item"`, take `scope_key.split(":")[0]` as tab, add the full `scope_key` to a Map under that tab.

Examples:

- `scope_key: "contract_details"` → `flaggedSections` has `"contract_details"`.
- `scope_key: "invoice_details:0:Invoice"` → `flaggedItems.get("invoice_details")` has `"invoice_details:0:Invoice"`.

### Where the "true step" comes from

- `effectiveWorkflow` = product workflow steps (e.g. `[{ id: "contract_details_1", name: "Contract Details" }, ...]`).
- `stepFromUrl` = `?step=3` → 3.
- `currentStepConfig` = `effectiveWorkflow[stepFromUrl - 1]` → the step at that index.
- `currentStepId` = `currentStepConfig.id` (e.g. `"contract_details_1"`).
- `currentStepKey` = `getStepKeyFromStepId(currentStepId)` → strips `_1` and returns `"contract_details"`.

So the "true step" for the current tab is `currentStepKey` (e.g. `"contract_details"`, `"invoice_details"`).

### How comparison works

**Tab locking:**

- `isStepFlagged = flaggedSections.has(currentStepKey) || (flaggedItems.get(currentStepKey)?.size ?? 0) > 0`
- `currentStepKey` = step key for the current tab.
- If that key is in `flaggedSections` or has entries in `flaggedItems` → step is flagged.
- `stepReadOnly = isAmendmentModeEffective && !isStepFlagged` → if flagged, editable; if not, read-only.

**Stepper red dots:**

- Loop over `effectiveWorkflow`.
- For each step, `key = getStepKeyFromStepId(step.id)`.
- If `flaggedSections.has(key)` or `flaggedItems.get(key)?.size > 0` → add that step index + 1 to `amendmentSteps`.
- `ProgressIndicator` gets `amendmentSteps` and marks those step numbers red.

### End-to-end flow

1. **Context** → API returns remarks with `scope` and `scope_key`.
2. **Sets** → `flaggedSections` and `flaggedItems` are built from those remarks.
3. **Current step** → `currentStepKey = getStepKeyFromStepId(effectiveWorkflow[stepFromUrl - 1].id)`.
4. **Tab locking** → `currentStepKey` is checked against `flaggedSections` and `flaggedItems`.
5. **Stepper** → Each workflow step's `getStepKeyFromStepId(step.id)` is checked against the same sets.

### Key detail

Admin remarks use keys like `"contract_details"`, `"invoice_details"`, `"supporting_documents"`.

Product workflow uses IDs like `"contract_details_1"`, `"invoice_details_1"`.

`getStepKeyFromStepId` turns `"contract_details_1"` into `"contract_details"` so both sides use the same key for comparison.
