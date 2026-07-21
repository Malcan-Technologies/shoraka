export type ProspectusPreviewPages = {
  page1: string;
  page2: string;
  page3: string;
};

export function stripPreviewBanner(html: string): string {
  return html.replace(
    /<div[^>]*data-prospectus-preview-banner[^>]*>[\s\S]*?<\/div>/i,
    ""
  );
}

/** Clean all pages once when the API payload changes. */
export function cleanProspectusPreviewHtml(
  html: ProspectusPreviewPages | null | undefined
): ProspectusPreviewPages | null {
  if (!html) return null;
  return {
    page1: stripPreviewBanner(html.page1),
    page2: stripPreviewBanner(html.page2),
    page3: stripPreviewBanner(html.page3),
  };
}

/**
 * Admin preview iframe only: hide in-document horizontal scroll so the outer
 * frame is the single H-scrollbar. Does not change A4 layout or print/PDF CSS.
 * Not used for “Open in New Tab” (browser window should scroll freely).
 */
export function withAdminPreviewScrollLock(html: string): string {
  const lock =
    '<style data-admin-preview-scroll-lock>html,body{overflow-x:hidden!important}</style>';
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${lock}</head>`);
  }
  return `${lock}${html}`;
}

/** Sheet shell: viewport-bound, no outer sheet scroll. */
export const PREVIEW_SHEET_CONTENT_CLASS =
  "flex h-dvh w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(56rem,96vw)]";

/**
 * Body fills remaining height; does not scroll.
 * Grey canvas (`bg-muted/40`) is preview-only chrome around the A4 frame.
 */
export const PREVIEW_SHEET_BODY_CLASS =
  "relative min-h-0 flex-1 overflow-hidden bg-muted/40 p-4 md:p-6";

/**
 * Only horizontal scroll container for Admin Prospectus preview.
 * Iframe stays A4-wide (`min-w-[210mm]`); this frame scrolls when the sheet is narrower.
 */
export const PREVIEW_DOCUMENT_FRAME_CLASS =
  "mx-auto block h-full w-full max-w-[210mm] overflow-x-auto overflow-y-hidden overscroll-contain rounded-xl border bg-transparent shadow-none";

/**
 * Fixed A4-wide iframe — no own horizontal scrollbar (document H overflow locked via
 * {@link withAdminPreviewScrollLock}). Vertical scroll stays inside the iframe document.
 */
export const PREVIEW_IFRAME_CLASS =
  "block h-full w-full min-h-0 min-w-[210mm] border-0 bg-transparent";
