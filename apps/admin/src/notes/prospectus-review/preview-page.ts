import type { ProspectusWorkflowStepId } from "./labels";

export type ProspectusPreviewPageKey = "page1" | "page2" | "page3";

/**
 * Workflow step → prospectus preview page.
 * Preview & Approval (step 6) is not mapped; callers use the last viewed page.
 */
export const PROSPECTUS_STEP_PREVIEW_PAGE = {
  0: "page1", // Core Terms
  1: "page1", // Investor Highlights
  2: "page2", // Issuer & Paymaster
  3: "page2", // Credit & Invoice Details
  4: "page3", // Financial Review
  5: "page3", // Investor Takeaways
} as const satisfies Record<Exclude<ProspectusWorkflowStepId, 6>, ProspectusPreviewPageKey>;

/**
 * Resolve which preview page to show when opening the sheet.
 * Final step keeps the last viewed page for this session, else Page 1.
 */
export function resolvePreviewPageForStep(
  step: ProspectusWorkflowStepId,
  lastViewedPage: ProspectusPreviewPageKey | null
): ProspectusPreviewPageKey {
  if (step === 6) return lastViewedPage ?? "page1";
  return PROSPECTUS_STEP_PREVIEW_PAGE[step];
}
