/**
 * SECTION: Render prospectus HTML to PDF via Playwright
 * WHY: Reuse the CTOS Chromium pattern for faithful A4 print output without changing CTOS
 * INPUT: Full HTML document string
 * OUTPUT: PDF bytes as Buffer
 *
 * Launch args, setContent wait, and page.pdf options live in the shared helper so
 * Investment Settlement Confirmation can reuse this exact production path.
 */

import { renderHtmlToPdfBuffer } from "../../../lib/playwright/render-html-to-pdf";

export async function renderProspectusHtmlToPdfBuffer(html: string): Promise<Buffer> {
  return renderHtmlToPdfBuffer(html, { logLabel: "prospectus" });
}
