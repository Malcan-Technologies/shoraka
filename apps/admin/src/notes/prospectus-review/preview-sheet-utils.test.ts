import {
  PREVIEW_DOCUMENT_FRAME_CLASS,
  PREVIEW_IFRAME_CLASS,
  PREVIEW_SHEET_BODY_CLASS,
  PREVIEW_SHEET_CONTENT_CLASS,
  cleanProspectusPreviewHtml,
  stripPreviewBanner,
} from "./preview-sheet-utils";
import {
  PROSPECTUS_STEP_PREVIEW_PAGE,
  resolvePreviewPageForStep,
} from "./preview-page";

describe("prospectus preview sheet utils", () => {
  it("keeps the sheet viewport-bound without an outer scroll container", () => {
    expect(PREVIEW_SHEET_CONTENT_CLASS).toContain("h-dvh");
    expect(PREVIEW_SHEET_CONTENT_CLASS).toContain("overflow-hidden");
    expect(PREVIEW_SHEET_BODY_CLASS).toContain("min-h-0");
    expect(PREVIEW_SHEET_BODY_CLASS).toContain("flex-1");
    expect(PREVIEW_SHEET_BODY_CLASS).toContain("overflow-hidden");
    expect(PREVIEW_SHEET_BODY_CLASS).not.toContain("overflow-y-auto");
  });

  it("gives vertical scrolling to the iframe and only horizontal overflow to the frame", () => {
    expect(PREVIEW_DOCUMENT_FRAME_CLASS).toContain("overflow-x-auto");
    expect(PREVIEW_DOCUMENT_FRAME_CLASS).toContain("overflow-y-hidden");
    expect(PREVIEW_DOCUMENT_FRAME_CLASS).toContain("overscroll-contain");
    expect(PREVIEW_DOCUMENT_FRAME_CLASS).toContain("max-w-[210mm]");
    expect(PREVIEW_SHEET_BODY_CLASS).toContain("bg-muted/40");
    expect(PREVIEW_IFRAME_CLASS).toContain("h-full");
    expect(PREVIEW_IFRAME_CLASS).toContain("min-h-0");
    expect(PREVIEW_IFRAME_CLASS).toContain("min-w-[210mm]");
    expect(PREVIEW_IFRAME_CLASS).toContain("block");
  });

  it("strips the preview banner once and keeps page HTML stable for the same payload", () => {
    const page1 =
      '<div data-prospectus-preview-banner="1">Banner</div><html><body>P1</body></html>';
    const payload = {
      page1,
      page2: "<html><body>P2</body></html>",
      page3: "<html><body>P3</body></html>",
    };
    const cleaned = cleanProspectusPreviewHtml(payload);
    expect(cleaned?.page1).toBe("<html><body>P1</body></html>");
    expect(cleaned?.page1).not.toContain("data-prospectus-preview-banner");
    expect(stripPreviewBanner(page1)).toBe(cleaned?.page1);
    expect(cleanProspectusPreviewHtml(payload)).toEqual(cleaned);
  });

  it("does not blank cached pages while a refresh is in flight", () => {
    const hasCachedHtml = true;
    const isLoading = false;
    const isFetching = true;
    const showInitialLoading = isLoading && !hasCachedHtml;
    const keepShowingCached = Boolean(hasCachedHtml && !showInitialLoading);
    expect(showInitialLoading).toBe(false);
    expect(keepShowingCached).toBe(true);
    expect(isFetching).toBe(true);
  });

  it("maps workflow steps to the matching prospectus preview page", () => {
    expect(PROSPECTUS_STEP_PREVIEW_PAGE).toEqual({
      0: "page1",
      1: "page2",
      2: "page3",
    });
    expect(resolvePreviewPageForStep(0, null)).toBe("page1");
    expect(resolvePreviewPageForStep(1, null)).toBe("page2");
    expect(resolvePreviewPageForStep(2, null)).toBe("page3");
    expect(resolvePreviewPageForStep(3, null)).toBe("page1");
    expect(resolvePreviewPageForStep(3, "page3")).toBe("page3");
  });
});
