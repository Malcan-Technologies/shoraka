export type ProspectusPreviewPages = {
  page1: string;
  page2: string;
  page3: string;
  page4?: string;
  page5?: string;
  allPages: string;
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
    page4: html.page4 ? stripPreviewBanner(html.page4) : undefined,
    page5: html.page5 ? stripPreviewBanner(html.page5) : undefined,
    allPages: stripPreviewBanner(html.allPages),
  };
}

/**
 * Admin preview iframe only: hide in-document horizontal scroll so the outer
 * frame is the single H-scrollbar. Does not change A4 layout or print/PDF CSS.
 * Not used for “Open in New Tab” (browser window should scroll freely).
 * Vertical scrolling stays inside the iframe document (one page or All Pages).
 *
 * Also prevents html/body from owning a fixed 210mm width — only `.page` does.
 * `scrollbar-gutter: stable` plus the slightly wider iframe leave room for the
 * vertical scrollbar so 210mm pages are not clipped on the right.
 */
export function withAdminPreviewScrollLock(html: string): string {
  const lock =
    '<style data-admin-preview-scroll-lock>' +
    "html,body{overflow-x:hidden!important;overflow-y:auto!important;width:100%!important;min-width:0!important;max-width:none!important;scrollbar-gutter:stable}" +
    ".document{width:100%!important;min-width:0!important;max-width:none!important}" +
    ".page{margin-left:auto!important;margin-right:auto!important}" +
    "</style>";
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
 * Horizontal padding lives here so it does not inflate the A4 iframe width.
 */
export const PREVIEW_SHEET_BODY_CLASS =
  "relative min-h-0 flex-1 overflow-hidden bg-muted/40 p-4 md:p-6";

/**
 * Only horizontal scroll container for Admin Prospectus preview.
 * Takes the full body width (not capped at 210mm) so a bordered A4 child
 * does not always overflow by ~2px.
 * Vertical scroll remains inside the iframe (single page or stacked All Pages).
 */
export const PREVIEW_DOCUMENT_FRAME_CLASS =
  "block h-full w-full overflow-x-auto overflow-y-hidden overscroll-contain";

/**
 * Centres the fixed-width iframe; shrink-wraps to A4 so wide viewports need no H-scroll.
 * Visual chrome (border/radius) sits here — outside the iframe’s exact 210mm box.
 */
export const PREVIEW_DOCUMENT_INNER_CLASS =
  "mx-auto block h-full w-max max-w-none rounded-xl border bg-transparent shadow-none";

/**
 * A4-wide iframe plus room for the vertical scrollbar.
 * Generated PDF/A4 dimensions stay 210mm — only Admin preview chrome is wider.
 */
export const PREVIEW_IFRAME_CLASS =
  "block h-full min-h-0 w-[calc(210mm+18px)] min-w-[calc(210mm+18px)] max-w-[calc(210mm+18px)] border-0 bg-transparent";

/** Inline styles reinforce A4 width plus scrollbar gutter (Tailwind arbitrary mm units). */
export const PREVIEW_IFRAME_STYLE = {
  width: "calc(210mm + 18px)",
  minWidth: "calc(210mm + 18px)",
  maxWidth: "calc(210mm + 18px)",
} as const;
