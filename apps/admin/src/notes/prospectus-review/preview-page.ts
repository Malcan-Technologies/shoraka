import type { ProspectusWorkflowStepId } from "./labels";

export type ProspectusPreviewPageKey = "page1" | "page2" | "page3";

export const PROSPECTUS_STEP_PREVIEW_PAGE = {
  0: "page1",
  1: "page2",
  2: "page3",
} as const satisfies Record<Exclude<ProspectusWorkflowStepId, 3>, ProspectusPreviewPageKey>;

export function resolvePreviewPageForStep(
  step: ProspectusWorkflowStepId,
  lastViewedPage: ProspectusPreviewPageKey | null
): ProspectusPreviewPageKey {
  if (step === 3) return lastViewedPage ?? "page1";
  return PROSPECTUS_STEP_PREVIEW_PAGE[step];
}
