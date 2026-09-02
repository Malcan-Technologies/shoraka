import { renderHtmlToPdfBuffer } from "../../../lib/playwright/render-html-to-pdf";

/** Playwright HTML → PDF using the Prospectus production Chromium settings. */
export async function renderConfirmationHtmlToPdfBuffer(html: string): Promise<Buffer> {
  return renderHtmlToPdfBuffer(html, { logLabel: "investment-settlement-confirmation" });
}
