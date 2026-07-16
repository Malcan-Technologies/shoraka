/**
 * SECTION: Render prospectus HTML to PDF via Playwright
 * WHY: Reuse the CTOS Chromium pattern for faithful A4 print output without changing CTOS
 * INPUT: Full HTML document string
 * OUTPUT: PDF bytes as Buffer
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

export async function renderProspectusHtmlToPdfBuffer(html: string): Promise<Buffer> {
  logger.debug({ htmlLength: html.length }, "Creating PDF from prospectus HTML");
  const executablePath = resolveChromiumExecutablePath();
  logger.debug({ executablePath: executablePath ?? "(playwright bundled)" }, "Chromium path");

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
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    logger.debug({ pdfSizeBytes: pdf.length }, "Prospectus PDF created");
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
