/**
 * SECTION: Render stored CTOS HTML to PDF
 * WHY: Admin downloads need a print-ready file; Playwright drives headless Chromium for faithful layout
 * INPUT: Full HTML document string (from report_html)
 * OUTPUT: PDF bytes as Buffer
 * WHERE USED: Admin CTOS PDF routes (organization + application)
 */

import { existsSync } from "fs";
import { chromium } from "playwright";

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

export async function renderCtosHtmlToPdfBuffer(html: string): Promise<Buffer> {
  console.log("Creating PDF from CTOS HTML, html length:", html.length);
  const executablePath = resolveChromiumExecutablePath();
  console.log("Chromium path from env or defaults:", executablePath ?? "(playwright bundled)");

  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: 120_000 });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "12mm", bottom: "12mm", left: "10mm", right: "10mm" },
    });
    console.log("PDF created, size bytes:", pdf.length);
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
