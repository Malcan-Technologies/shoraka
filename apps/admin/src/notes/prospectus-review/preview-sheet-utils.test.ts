import {
  PREVIEW_DOCUMENT_FRAME_CLASS,
  PREVIEW_IFRAME_CLASS,
  PREVIEW_SHEET_BODY_CLASS,
  PREVIEW_SHEET_CONTENT_CLASS,
  cleanProspectusPreviewHtml,
  stripPreviewBanner,
  withAdminPreviewScrollLock,
} from "./preview-sheet-utils";
import {
  PROSPECTUS_PREVIEW_TAB_LABELS,
  PROSPECTUS_PREVIEW_TABS,
  PROSPECTUS_STEP_PREVIEW_PAGE,
  prospectusPreviewIframeTitle,
  resolveOpenInNewTabHtml,
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

  it("keeps a single horizontal scroll container on the outer frame", () => {
    expect(PREVIEW_DOCUMENT_FRAME_CLASS).toContain("w-full");
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

  it("locks iframe document horizontal overflow for Admin preview only", () => {
    const withHead =
      "<!DOCTYPE html><html><head><title>t</title></head><body><section class=\"page\">A4</section></body></html>";
    const locked = withAdminPreviewScrollLock(withHead);
    expect(locked).toContain("data-admin-preview-scroll-lock");
    expect(locked).toContain("overflow-x:hidden!important");
    expect(locked).toContain("</head>");
    expect(locked.indexOf("data-admin-preview-scroll-lock")).toBeLessThan(
      locked.indexOf("</head>")
    );
    expect(withAdminPreviewScrollLock("<body>x</body>")).toMatch(
      /^<style data-admin-preview-scroll-lock>/
    );
  });

  it("strips the preview banner once and keeps page HTML stable for the same payload", () => {
    const page1 =
      '<div data-prospectus-preview-banner="1">Banner</div><html><body>P1</body></html>';
    const payload = {
      page1,
      page2: "<html><body>P2</body></html>",
      page3: "<html><body>P3</body></html>",
      allPages: "<html><body>ALL</body></html>",
    };
    const cleaned = cleanProspectusPreviewHtml(payload);
    expect(cleaned?.page1).toBe("<html><body>P1</body></html>");
    expect(cleaned?.page1).not.toContain("data-prospectus-preview-banner");
    expect(cleaned?.allPages).toBe("<html><body>ALL</body></html>");
    expect(stripPreviewBanner(page1)).toBe(cleaned?.page1);
    expect(cleanProspectusPreviewHtml(payload)).toEqual(cleaned);
  });

  it("exposes Page 1–3 and All Pages tabs without Previous/Next navigation", () => {
    expect(PROSPECTUS_PREVIEW_TABS).toEqual([
      "page1",
      "page2",
      "page3",
      "allPages",
    ]);
    expect(PROSPECTUS_PREVIEW_TAB_LABELS).toEqual({
      page1: "Page 1",
      page2: "Page 2",
      page3: "Page 3",
      allPages: "All Pages",
    });
    expect(prospectusPreviewIframeTitle("page1")).toBe(
      "Prospectus Page 1 Preview"
    );
    expect(prospectusPreviewIframeTitle("allPages")).toBe(
      "Prospectus All Pages Preview"
    );
  });

  it("opens the selected tab HTML in a new tab (page or combined)", () => {
    const pages = {
      page1: "<html>P1</html>",
      page2: "<html>P2</html>",
      page3: "<html>P3</html>",
      allPages: "<html>ALL</html>",
    };
    expect(resolveOpenInNewTabHtml(pages, "page2")).toBe("<html>P2</html>");
    expect(resolveOpenInNewTabHtml(pages, "allPages")).toBe("<html>ALL</html>");
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
    expect(resolvePreviewPageForStep(3, "allPages")).toBe("allPages");
  });
});
