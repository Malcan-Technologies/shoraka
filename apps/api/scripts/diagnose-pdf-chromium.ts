#!/usr/bin/env tsx
/**
 * Read-only diagnostic: compare CTOS vs Prospectus Playwright launch for PDF.
 * Does not modify application code. Safe to delete after investigation.
 *
 * Usage: pnpm --filter @cashsouk/api exec tsx scripts/diagnose-pdf-chromium.ts
 */
import { existsSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { chromium } from "playwright";

function resolveChromiumExecutablePath(): string | undefined {
  const fromEnv = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.trim();
  if (fromEnv) return fromEnv;
  const candidates = ["/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/lib/chromium/chrome"];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return undefined;
}

/** Exact CTOS launch options from render-ctos-html-to-pdf.ts */
async function runCtosStyleDiagnostic(): Promise<{ ok: boolean; detail: string; pdfBytes?: number }> {
  const executablePath = resolveChromiumExecutablePath();
  const label = `CTOS options executablePath=${executablePath ?? "(playwright bundled)"}`;
  console.log(`\n=== ${label} ===`);
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      ...(executablePath ? { executablePath } : {}),
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    });
    console.log("CTOS: chromium.launch OK");
    const page = await browser.newPage();
    console.log("CTOS: newPage OK");
    await page.setContent("<html><body><h1>CTOS diagnostic</h1></body></html>", {
      waitUntil: "load",
      timeout: 120_000,
    });
    console.log("CTOS: setContent OK");
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "12mm", bottom: "12mm", left: "10mm", right: "10mm" },
    });
    console.log("CTOS: page.pdf OK bytes=", pdf.length);
    return { ok: true, detail: label, pdfBytes: pdf.length };
  } catch (error) {
    const msg = error instanceof Error ? error.stack ?? error.message : String(error);
    console.error("CTOS FAILED:\n", msg);
    return { ok: false, detail: msg };
  } finally {
    if (browser) {
      await browser.close().catch((e) => console.error("CTOS browser.close error", e));
      console.log("CTOS: browser.close done");
    }
  }
}

/** Exact Prospectus launch options from render-prospectus-html-to-pdf.ts */
async function runProspectusStyleDiagnostic(): Promise<{
  ok: boolean;
  detail: string;
  pdfBytes?: number;
}> {
  const executablePath = resolveChromiumExecutablePath();
  const label = `Prospectus options executablePath=${executablePath ?? "(playwright bundled)"}`;
  console.log(`\n=== ${label} ===`);
  let browser;
  let page;
  try {
    browser = await chromium.launch({
      headless: true,
      ...(executablePath ? { executablePath } : {}),
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    });
    console.log("Prospectus: chromium.launch OK");
    page = await browser.newPage();
    console.log("Prospectus: newPage OK");
    await page.setContent("<html><body><h1>Prospectus diagnostic</h1></body></html>", {
      waitUntil: "load",
      timeout: 120_000,
    });
    console.log("Prospectus: setContent OK");
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      scale: 1,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    console.log("Prospectus: page.pdf OK bytes=", pdf.length);
    return { ok: true, detail: label, pdfBytes: pdf.length };
  } catch (error) {
    const msg = error instanceof Error ? error.stack ?? error.message : String(error);
    console.error("Prospectus FAILED:\n", msg);
    return { ok: false, detail: msg };
  } finally {
    if (page) {
      await page.close().catch(() => undefined);
      console.log("Prospectus: page.close done");
    }
    if (browser) {
      await browser.close().catch(() => undefined);
      console.log("Prospectus: browser.close done");
    }
  }
}

async function main() {
  console.log("CWD:", process.cwd());
  console.log("NODE_ENV:", process.env.NODE_ENV);
  console.log("PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH:", process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? "<unset>");
  const resolved = resolveChromiumExecutablePath();
  console.log("resolveChromiumExecutablePath():", resolved ?? "<undefined → Playwright bundled>");

  const ctos = await runCtosStyleDiagnostic();
  const prospectus = await runProspectusStyleDiagnostic();

  const outDir = join(process.cwd(), "tmp");
  mkdirSync(outDir, { recursive: true });
  const summary = {
    cwd: process.cwd(),
    envExecutable: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? null,
    resolvedExecutable: resolved ?? null,
    ctos: { ok: ctos.ok, pdfBytes: ctos.pdfBytes ?? null, errorPreview: ctos.ok ? null : ctos.detail.slice(0, 500) },
    prospectus: {
      ok: prospectus.ok,
      pdfBytes: prospectus.pdfBytes ?? null,
      errorPreview: prospectus.ok ? null : prospectus.detail.slice(0, 500),
    },
    launchOptionsIdenticalExceptPdfCall: true,
    note:
      "Both flows use the same chromium.launch args and the same resolveChromiumExecutablePath(). Differences are only page.pdf options and Prospectus closing page before browser.",
  };
  const outPath = join(outDir, "pdf-chromium-diagnostic.json");
  writeFileSync(outPath, JSON.stringify(summary, null, 2));
  console.log("\n=== SUMMARY ===");
  console.log(JSON.stringify(summary, null, 2));
  console.log("Wrote", outPath);
  process.exit(ctos.ok && prospectus.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
