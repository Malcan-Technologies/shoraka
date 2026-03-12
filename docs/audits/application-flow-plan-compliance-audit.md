# Codebase Validation Audit: Application Flow + Amendment + Progress + Product Version Architecture

**Plan:** Application Flow + Amendment + Progress + Product Version Architecture  
**Audit Date:** 2025-03-12  
**Build Status:** `pnpm build` — **PASSED**

---

# Compliance Summary

## Fully Compliant

- **Amendment acknowledgement logic** — Save & Continue appends `currentStepId` (workflow id) to backend via `acknowledge-workflow`; acknowledgements are never removed on back navigation; backend stores in `amendment_acknowledged_workflow_ids`
- **Amendment acknowledgement display** — `acknowledgedWorkflowIds` derived from `amendment_acknowledged_workflow_ids`; frontend maps workflow ids to step keys for comparison
- **Backend update protection** — `verifyApplicationEditable()` rejects non-DRAFT and non-AMENDMENT_REQUESTED; called by `updateStep`, `acknowledgeWorkflow`, `archiveApplication`, `updateApplicationStatus`
- **Product ID source** — `use-product-version-guard.ts` extracts `product_id` from `(application?.financing_type as any)?.product_id`
- **Product usage tracking** — No `is_used` or similar columns on product tables; usage derived from applications
- **Archived application frontend block** — Edit page sets `isEditBlocked` when status is not DRAFT/AMENDMENT_REQUESTED; redirects to `/applications` via `router.replace("/applications")`
- **Step bounds guard (upper)** — `stepFromUrl > maxStepInWorkflow` redirects to `Math.min(maxAllowed, maxStepInWorkflow)` or `totalSteps`
- **last_completed_step not updated in amendment mode** — `handleSaveAndContinue` only updates `wizardState` when `application?.status !== "AMENDMENT_REQUESTED"`; backend `updateStep` skips `last_completed_step` when status is AMENDMENT_REQUESTED
- **review_and_submit never checked in amendment mode** — Progress indicator explicitly sets `isCompleted = false` when `stepKey === "review_and_submit"` in amendment mode

## Partially Compliant

- **Progress indicator (normal flow)**
  - **What exists:** Flagged steps use acknowledgement logic; `review_and_submit` never checked in amendment mode
  - **What is missing:** Non-flagged steps in amendment mode use `stepNumber <= (lastCompletedStep ?? currentStep - 1)` instead of always checked; normal flow uses `lastCompletedStep` for completion instead of `stepIndex < currentStep`
  - **Location:** `progress-indicator.tsx` line 106–111

- **Progress indicator (amendment non-flagged)**
  - **What exists:** Flagged steps follow acknowledgement logic
  - **What is missing:** When `isAmendmentMode && !isFlagged`, the code falls through to `stepNumber <= (lastCompletedStep ?? currentStep - 1)` instead of always `checked (✔)`
  - **Location:** `progress-indicator.tsx` line 106–111

- **Lower bound guard (requestedStep < 1)**
  - **What exists:** `stepFromUrl < 1` triggers redirect
  - **What is missing:** Redirects to `maxAllowed` instead of `step 1`; `parseInt` of invalid values (e.g. `?step=NaN`) yields `NaN`, and `NaN < 1` is false, so NaN is not handled
  - **Location:** `edit/[id]/page.tsx` lines 611–615

- **Amendment flow sequential guard**
  - **What exists:** `last_completed_step` is not updated in amendment mode
  - **What is missing:** SCENARIO 3 (`stepFromUrl > maxAllowed`) runs for all flows; amendment mode should skip this guard and allow free navigation within `[1, totalSteps]`
  - **Location:** `edit/[id]/page.tsx` lines 629–636

- **Archived application backend protection**
  - **What exists:** Frontend blocks and redirects; `verifyApplicationEditable` rejects mutations on archived applications
  - **What is missing:** `getApplication` does not reject archived applications; backend still returns application data; plan requires backend to reject load requests for archived applications in the edit route

- **Next button on final step**
  - **What exists:** On `review_and_submit`, the button becomes "Submit" or "Resubmit for Review" instead of "Save and Continue"; no explicit "Next" that would navigate beyond workflow
  - **What is missing:** No explicit disable/hide when `currentStep === totalSteps` for non-review steps (e.g. if workflow had a step after review); current design uses contextual button (Submit on last step) which effectively prevents navigation beyond

## Missing

- **Amendment refresh behavior** — When no `?step` in amendment mode, system redirects to step 1 instead of first unacknowledged amendment step; if all acknowledged, should redirect to Review & Submit
  - **Location:** `edit/[id]/page.tsx` lines 575–586
  - **Current:** `targetStep = isAmendmentMode ? 1 : wizardState.allowedMaxStep`

- **Product version guard in amendment mode** — `useProductVersionGuard` always runs product validation; does not skip when `application.status === "AMENDMENT_REQUESTED"`
  - **Location:** `use-product-version-guard.ts` — no status check before `checkNow` logic

- **Resubmit error message** — Backend returns `"All amendment steps must be completed before resubmitting"`; plan requires `"All amendments must be acknowledged before resubmitting."`
  - **Location:** `apps/api/src/modules/applications/amendments/service.ts` line 140

## Contradictions / Risks

- **Progress indicator uses lastCompletedStep for UI**
  - **Risk:** When user navigates back, steps after `currentStep` but before `lastCompletedStep` may show as completed (plan: they should show upcoming). Example: user on step 4, goes back to step 3 — plan expects ✔✔●○○; current logic can show ✔✔✔●○ if `lastCompletedStep` is 3.
  - **Recommended fix:** Change completion logic to `stepIndex < currentStep` for normal flow; for amendment non-flagged, always `checked`.

- **Lower bound redirect target**
  - **Risk:** When `step=0` or `step=-1`, redirect goes to `maxAllowed` (e.g. step 5) instead of step 1; user may land on a step they cannot access in normal flow.
  - **Recommended fix:** Redirect to `step = 1` when `requestedStep < 1`.

- **NaN step handling**
  - **Risk:** `parseInt("abc")` returns `NaN`; `NaN < 1`, `NaN > totalSteps`, `NaN > maxAllowed` are all false; user may see broken or unexpected behavior.
  - **Recommended fix:** Add `!Number.isFinite(stepFromUrl)` guard and redirect to step 1 (or appropriate default).

- **Amendment flow blocks free navigation**
  - **Risk:** In amendment mode, users cannot jump to any step via URL; they are forced to sequential access if `requestedStep > maxAllowed`.
  - **Recommended fix:** Skip SCENARIO 3 when `application.status === "AMENDMENT_REQUESTED"`.

- **Product validation blocks amendment flow**
  - **Risk:** If product was updated or deleted after submission, amendment flow is blocked by version mismatch modal; plan says amendment must operate on original configuration and skip validation.
  - **Recommended fix:** In `useProductVersionGuard`, return early with `isMismatch: false` when `application.status === "AMENDMENT_REQUESTED"`.

---

## File-by-File Findings

### `apps/issuer/src/app/(application-flow)/applications/components/progress-indicator.tsx`

| Matches Plan | Does Not Match |
|--------------|----------------|
| Flagged steps use acknowledgement logic | Non-flagged steps use `lastCompletedStep`; should always be checked in amendment mode |
| review_and_submit never checked in amendment | Normal flow uses `stepNumber <= (lastCompletedStep ?? currentStep - 1)`; plan requires `stepIndex < currentStep` |
| Receives amendmentFlaggedStepKeys, acknowledgedWorkflowIds | Receives and uses `lastCompletedStep` for UI; plan says must not |

### `apps/issuer/src/app/(application-flow)/applications/edit/[id]/page.tsx`

| Matches Plan | Does Not Match |
|--------------|----------------|
| Blocks edit when status not DRAFT/AMENDMENT_REQUESTED | Amendment refresh: redirects to step 1 instead of first unacknowledged |
| SCENARIO 1 handles step < 1 | Redirects to `maxAllowed` instead of step 1 |
| SCENARIO 2 handles step > totalSteps | SCENARIO 3 runs for amendment mode; should be skipped |
| Passes lastCompletedStep to ProgressIndicator | Plan says progress indicator should not depend on it |
| Acknowledges workflow on Save & Continue in amendment | — |
| Does not update wizardState in amendment mode | — |

### `apps/issuer/src/hooks/use-product-version-guard.ts`

| Matches Plan | Does Not Match |
|--------------|----------------|
| Extracts product_id from financing_type | Does not skip validation when status is AMENDMENT_REQUESTED |
| Compares product.version with application.product_version | Runs for all statuses; plan says skip in amendment |

### `apps/api/src/modules/applications/amendments/service.ts`

| Matches Plan | Does Not Match |
|--------------|----------------|
| Enforces requiredSectionKeys ⊆ acknowledgedStepKeys | Error message: "All amendment steps must be completed before resubmitting" — plan requires "All amendments must be acknowledged before resubmitting." |

### `apps/api/src/modules/applications/service.ts`

| Matches Plan | Does Not Match |
|--------------|----------------|
| verifyApplicationEditable rejects ARCHIVED, SUBMITTED, etc. | getApplication does not reject archived; returns application for any status |
| updateStep, acknowledgeWorkflow, archiveApplication call verifyApplicationEditable | — |

---

## Recommended Implementation Order

1. **Progress indicator refactor** — Change completion logic to `stepIndex < currentStep` for normal flow; add explicit `else if amendment mode AND step NOT flagged → checked` branch; stop passing/using `lastCompletedStep` for UI.
2. **Lower bound guard fix** — When `requestedStep < 1` or `!Number.isFinite(stepFromUrl)`, redirect to step 1.
3. **Amendment flow navigation** — Skip SCENARIO 3 when `application.status === "AMENDMENT_REQUESTED"`.
4. **Amendment refresh** — Compute first unacknowledged step (excluding financial*, review_and_submit per resubmit rules); if all acknowledged, redirect to Review & Submit step index.
5. **Product version guard** — Add early return in `checkNow` when `application.status === "AMENDMENT_REQUESTED"`; set `isMismatch: false`, `blockReason: null`.
6. **Resubmit error message** — Update to exact string: `"All amendments must be acknowledged before resubmitting."`
7. **Archived application backend** — Add status check in `getApplication` (or equivalent edit-route entry point); return 403 and appropriate error when status is ARCHIVED.
8. **Next button safeguard** — Add explicit check: when `currentStep === effectiveWorkflow.length` and not on review_and_submit, ensure primary action does not navigate beyond (current design may already satisfy via Submit button on last step).

---

## Build Result

```
pnpm build — PASSED (exit code 0)
```

No build failures. All packages compiled successfully.
