/**
 * SECTION: Combine frozen Prospectus page HTML into one printable A4 document
 * WHY: Investor documentHtml and multi-page PDF need three `.page` nodes, not three full HTML docs
 * CONSTRAINT: Does not alter page body markup — only wraps extracted `.page` sections
 */

import { PROSPECTUS_DOCUMENT_CSS } from "./prospectus-document-styles";
import { PROSPECTUS_STRATO_CSS } from "./prospectus-strato-styles";

export type ProspectusPageHtmlBundle = {
  page1: string;
  page2: string;
  page3: string;
  page4?: string;
  page5?: string;
};

/**
 * Extract the A4 `.page` section from a single-page Prospectus HTML document.
 * Balances nested `<section>` tags (pages contain inner sections).
 */
export function extractProspectusPageSection(html: string): string {
  const startMatch = html.match(/<section\b[^>]*\bclass="[^"]*\bpage\b[^"]*"[^>]*>/i);
  if (!startMatch || startMatch.index === undefined) {
    throw new Error("Prospectus HTML is missing a .page section");
  }

  const start = startMatch.index;
  const openTagRe = /<section\b[^>]*>/gi;
  const closeTagRe = /<\/section>/gi;
  let depth = 0;
  let cursor = start;

  while (cursor < html.length) {
    openTagRe.lastIndex = cursor;
    closeTagRe.lastIndex = cursor;
    const open = openTagRe.exec(html);
    const close = closeTagRe.exec(html);

    const nextOpen = open?.index ?? Number.POSITIVE_INFINITY;
    const nextClose = close?.index ?? Number.POSITIVE_INFINITY;

    if (nextClose === Number.POSITIVE_INFINITY && nextOpen === Number.POSITIVE_INFINITY) {
      break;
    }

    if (nextOpen < nextClose && open) {
      depth += 1;
      cursor = open.index + open[0].length;
      continue;
    }

    if (close) {
      depth -= 1;
      cursor = close.index + close[0].length;
      if (depth === 0) {
        return html.slice(start, cursor);
      }
    }
  }

  throw new Error("Prospectus HTML .page section is not closed");
}

/**
 * Build one HTML document with three fixed A4 `.page` nodes for browser preview and PDF.
 * Shared CSS is applied once; page content sections are copied unchanged.
 */
export function combineProspectusPagesHtml(html: ProspectusPageHtmlBundle): string {
  const extracted = [
    extractProspectusPageSection(html.page1),
    extractProspectusPageSection(html.page2),
    extractProspectusPageSection(html.page3),
  ];
  if (html.page4) extracted.push(extractProspectusPageSection(html.page4));
  if (html.page5) extracted.push(extractProspectusPageSection(html.page5));
  const pages = extracted.join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Prospectus</title>
  <style>
${PROSPECTUS_DOCUMENT_CSS}
${PROSPECTUS_STRATO_CSS}
  </style>
</head>
<body>
  <main class="document">
${pages}
  </main>
</body>
</html>`;
}
