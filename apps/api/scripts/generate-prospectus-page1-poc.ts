/**
 * Dev-only helper: write prospectus page-1 POC PDF to a local temp folder.
 * Not a public API endpoint.
 *
 * Usage (from apps/api):
 *   pnpm prospectus:page1-poc
 *
 * Local WSL note: if Chromium fails on missing shared libraries, install host deps
 * (libnspr4, libnss3, libasound2) or point LD_LIBRARY_PATH at extracted libs.
 */

import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { chromium } from "playwright";
import {
  buildProspectusPage1Document,
  renderProspectusPage1Pdf,
} from "../src/modules/notes/prospectus/render-prospectus-page1";

async function writePreviewPng(html: string, outPath: string): Promise<void> {
  let browser;
  let page;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    });
    page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: 120_000 });
    await page.setViewportSize({ width: 794, height: 1123 });
    await page.screenshot({ path: outPath, fullPage: false });
  } finally {
    if (page) {
      await page.close().catch(() => undefined);
    }
    if (browser) {
      await browser.close().catch(() => undefined);
    }
  }
}

async function main() {
  const outDir = path.resolve(__dirname, "../tmp/prospectus");
  mkdirSync(outDir, { recursive: true });

  const pdfPath = path.join(outDir, "prospectus-page1-poc.pdf");
  const pngPath = path.join(outDir, "prospectus-page1-poc.png");
  const html = buildProspectusPage1Document();
  const pdf = await renderProspectusPage1Pdf();
  writeFileSync(pdfPath, pdf);
  await writePreviewPng(html, pngPath);

  // eslint-disable-next-line no-console
  console.log(`Wrote prospectus page-1 POC PDF (${pdf.length} bytes) to ${pdfPath}`);
  // eslint-disable-next-line no-console
  console.log(`Wrote prospectus page-1 preview PNG to ${pngPath}`);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
