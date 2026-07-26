/**
 * Dev-only: render sample Pages 1–3 to PNG + combined PDF for Heroicon visual check.
 *
 * Usage (from apps/api):
 *   pnpm exec tsx scripts/generate-prospectus-icon-visuals.ts
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { SAMPLE_PROSPECTUS_PAGE_ONE } from "../src/modules/notes/prospectus/prospectus-page-one.sample-data";
import { buildProspectusPageOneHtml } from "../src/modules/notes/prospectus/prospectus-page-one.html";
import { SAMPLE_PROSPECTUS_PAGE_TWO } from "../src/modules/notes/prospectus/prospectus-page-two.sample-data";
import { buildProspectusPageTwoHtml } from "../src/modules/notes/prospectus/prospectus-page-two.html";
import { SAMPLE_PROSPECTUS_PAGE_THREE } from "../src/modules/notes/prospectus/prospectus-page-three.sample-data";
import { buildProspectusPageThreeHtml } from "../src/modules/notes/prospectus/prospectus-page-three.html";
import { combineProspectusPagesHtml } from "../src/modules/notes/prospectus/combine-prospectus-pages-html";

async function main() {
  const outDir = path.resolve(__dirname, "../tmp/prospectus/icon-visuals");
  mkdirSync(outDir, { recursive: true });

  const page1 = buildProspectusPageOneHtml(SAMPLE_PROSPECTUS_PAGE_ONE);
  const page2 = buildProspectusPageTwoHtml(SAMPLE_PROSPECTUS_PAGE_TWO);
  const page3 = buildProspectusPageThreeHtml(SAMPLE_PROSPECTUS_PAGE_THREE);
  const all = combineProspectusPagesHtml({ page1, page2, page3 });

  writeFileSync(path.join(outDir, "page-1.html"), page1, "utf8");
  writeFileSync(path.join(outDir, "page-2.html"), page2, "utf8");
  writeFileSync(path.join(outDir, "page-3.html"), page3, "utf8");
  writeFileSync(path.join(outDir, "all-pages.html"), all, "utf8");

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 900, height: 1280 },
    deviceScaleFactor: 2,
  });

  for (const [name, html] of [
    ["page-1", page1],
    ["page-2", page2],
    ["page-3", page3],
  ] as const) {
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    const pageNode = page.locator(".page").first();
    await pageNode.screenshot({
      path: path.join(outDir, `${name}.png`),
      type: "png",
    });
    await page.close();
  }

  const pdfPage = await context.newPage();
  await pdfPage.setContent(all, { waitUntil: "networkidle" });
  const pdfPath = path.join(outDir, "prospectus-3-pages.pdf");
  await pdfPage.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
  });
  await browser.close();

  // eslint-disable-next-line no-console
  console.log(`Wrote icon visuals to ${outDir}`);
  // eslint-disable-next-line no-console
  console.log(`PDF: ${pdfPath}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
