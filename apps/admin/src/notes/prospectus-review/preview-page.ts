import type { ProspectusWorkflowStepId } from "./labels";

/** Single-page tabs used for focused checking. */
export type ProspectusPreviewPageKey = "page1" | "page2" | "page3";

/** Preview sheet tabs including the combined three-page document. */
export type ProspectusPreviewTab = ProspectusPreviewPageKey | "allPages";

export const PROSPECTUS_PREVIEW_TABS: ProspectusPreviewTab[] = [
  "page1",
  "page2",
  "page3",
  "allPages",
];

export const PROSPECTUS_PREVIEW_TAB_LABELS: Record<ProspectusPreviewTab, string> = {
  page1: "Page 1",
  page2: "Page 2",
  page3: "Page 3",
  allPages: "All Pages",
};

export const PROSPECTUS_STEP_PREVIEW_PAGE = {
  0: "page1",
  1: "page2",
  2: "page3",
} as const satisfies Record<Exclude<ProspectusWorkflowStepId, 3>, ProspectusPreviewPageKey>;

export function resolvePreviewPageForStep(
  step: ProspectusWorkflowStepId,
  lastViewedPage: ProspectusPreviewTab | null
): ProspectusPreviewTab {
  if (step === 3) return lastViewedPage ?? "page1";
  return PROSPECTUS_STEP_PREVIEW_PAGE[step];
}

export function prospectusPreviewIframeTitle(tab: ProspectusPreviewTab): string {
  return tab === "allPages"
    ? "Prospectus All Pages Preview"
    : `Prospectus ${PROSPECTUS_PREVIEW_TAB_LABELS[tab]} Preview`;
}

/** Open in New Tab uses the HTML for the currently selected preview tab. */
export function resolveOpenInNewTabHtml(
  pages: Record<ProspectusPreviewTab, string>,
  tab: ProspectusPreviewTab
): string {
  return pages[tab];
}
