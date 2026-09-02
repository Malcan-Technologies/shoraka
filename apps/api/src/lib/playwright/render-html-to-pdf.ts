/**
 * Render an HTML document to PDF via Playwright Chromium.
 *
 * Production settings match the Prospectus path: ECS installs system Chromium
 * and sets PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium.
 * Callers must not introduce a second launch/PDF configuration.
 */

import { existsSync } from "fs";
import { chromium, type Browser, type Page } from "playwright";
import { logger } from "../logger";

export const PLAYWRIGHT_CHROMIUM_LAUNCH_ARGS = [
  "--no-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
] as const;

export const PLAYWRIGHT_HTML_TO_PDF_OPTIONS = {
  format: "A4" as const,
  printBackground: true,
  preferCSSPageSize: true,
  scale: 1,
  margin: { top: "0", right: "0", bottom: "0", left: "0" },
};

export const PLAYWRIGHT_SET_CONTENT_OPTIONS = {
  waitUntil: "load" as const,
  timeout: 120_000,
};

export function resolveChromiumExecutablePath(): string | undefined {
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

export type RenderHtmlToPdfOptions = {
  /** Debug log label, e.g. "prospectus". Does not change PDF output. */
  logLabel?: string;
};

export async function renderHtmlToPdfBuffer(
  html: string,
  options?: RenderHtmlToPdfOptions
): Promise<Buffer> {
  const label = options?.logLabel ?? "HTML";
  logger.debug({ htmlLength: html.length }, `Creating PDF from ${label} HTML`);
  const executablePath = resolveChromiumExecutablePath();
  logger.debug({ executablePath: executablePath ?? "(playwright bundled)" }, "Chromium path");

  let browser: Browser | undefined;
  let page: Page | undefined;

  try {
    browser = await chromium.launch({
      headless: true,
      ...(executablePath ? { executablePath } : {}),
      args: [...PLAYWRIGHT_CHROMIUM_LAUNCH_ARGS],
    });

    page = await browser.newPage();
    await page.setContent(html, PLAYWRIGHT_SET_CONTENT_OPTIONS);
    const pdf = await page.pdf(PLAYWRIGHT_HTML_TO_PDF_OPTIONS);
    logger.debug({ pdfSizeBytes: pdf.length }, `${label} PDF created`);
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
