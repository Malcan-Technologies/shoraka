/**
 * SECTION: Render payment receipt HTML to PDF
 * WHY: Reuse the CTOS/prospectus Chromium pattern for A4 finance receipts
 */

import { existsSync } from "fs";
import { chromium, type Browser, type Page } from "playwright";
import { logger } from "../../../lib/logger";

function resolveChromiumExecutablePath(): string | undefined {
  const fromEnv = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  const candidates = ["/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/lib/chromium/chrome"];
  for (const p of candidates) {
    if (existsSync(p)) {
      return p;
    }
  }
  return undefined;
}

export async function renderReceiptHtmlToPdfBuffer(html: string): Promise<Buffer> {
  logger.debug({ htmlLength: html.length }, "Creating PDF from payment receipt HTML");
  const executablePath = resolveChromiumExecutablePath();

  let browser: Browser | undefined;
  let page: Page | undefined;

  try {
    browser = await chromium.launch({
      headless: true,
      ...(executablePath ? { executablePath } : {}),
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    });
    page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: 120_000 });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "14mm", bottom: "14mm", left: "12mm", right: "12mm" },
    });
    logger.debug({ pdfSizeBytes: pdf.length }, "Payment receipt PDF created");
    return Buffer.from(pdf);
  } finally {
    if (page) {
      await page.close().catch(() => undefined);
    }
    if (browser) {
      await browser.close().catch(() => undefined);
    }
  }
}
