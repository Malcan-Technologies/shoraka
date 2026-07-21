/**
 * SECTION: Audit Investor Prospectus responsive preview + PDF page behaviour
 * WHY: Capture browser widths + PDF evidence without changing prospectus content
 *
 * Run: pnpm --filter @cashsouk/api exec tsx scripts/audit-prospectus-a4-pdf.ts
 */

import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { chromium } from "playwright";
import { combineProspectusPagesHtml } from "../src/modules/notes/prospectus/combine-prospectus-pages-html";
import { buildProspectusPageOneHtml } from "../src/modules/notes/prospectus/prospectus-page-one.html";
import { SAMPLE_PROSPECTUS_PAGE_ONE } from "../src/modules/notes/prospectus/prospectus-page-one.sample-data";
import { buildProspectusPageThreeHtml } from "../src/modules/notes/prospectus/prospectus-page-three.html";
import { SAMPLE_PROSPECTUS_PAGE_THREE } from "../src/modules/notes/prospectus/prospectus-page-three.sample-data";
import { buildProspectusPageTwoHtml } from "../src/modules/notes/prospectus/prospectus-page-two.html";
import { SAMPLE_PROSPECTUS_PAGE_TWO } from "../src/modules/notes/prospectus/prospectus-page-two.sample-data";
import { renderProspectusHtmlToPdfBuffer } from "../src/modules/notes/prospectus/render-prospectus-html-to-pdf";

const WIDTHS = [1920, 1366, 1024, 768] as const;
const OUT_DIR = join(process.cwd(), "../../tmp/prospectus-a4-audit");

function countPdfPages(pdf: Buffer): number {
  const text = pdf.toString("latin1");
  return (text.match(/\/Type\s*\/Page(?!s)\b/g) ?? []).length;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const page1 = buildProspectusPageOneHtml(SAMPLE_PROSPECTUS_PAGE_ONE);
  const page2 = buildProspectusPageTwoHtml(SAMPLE_PROSPECTUS_PAGE_TWO);
  const page3 = buildProspectusPageThreeHtml(SAMPLE_PROSPECTUS_PAGE_THREE);
  const documentHtml = combineProspectusPagesHtml({ page1, page2, page3 });

  writeFileSync(join(OUT_DIR, "document.html"), documentHtml, "utf8");

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });

  const report: Record<string, unknown> = {
    outDir: OUT_DIR,
    viewportChecks: [] as unknown[],
    pdf: {} as Record<string, unknown>,
  };

  try {
    for (const width of WIDTHS) {
      const page = await browser.newPage({ viewport: { width, height: 1100 } });
      await page.setContent(documentHtml, { waitUntil: "load" });

      const metrics = await page.evaluate(() => {
        const pages = [...document.querySelectorAll<HTMLElement>(".page")];
        const first = pages[0];
        const cs = first ? getComputedStyle(first) : null;
        const hero = document.querySelector<HTMLElement>(".hero-grid");
        const heroCs = hero ? getComputedStyle(hero) : null;
        const htmlBg = getComputedStyle(document.documentElement).backgroundColor;
        return {
          pageCount: pages.length,
          pageWidth: cs?.width ?? null,
          pageHeight: cs?.height ?? null,
          pageMinWidth: cs?.minWidth ?? null,
          pageMinHeight: cs?.minHeight ?? null,
          pageBackground: cs?.backgroundColor ?? null,
          htmlBackground: htmlBg,
          heroGridColumns: heroCs?.gridTemplateColumns ?? null,
          bodyScrollWidth: document.body.scrollWidth,
          viewportInnerWidth: window.innerWidth,
        };
      });

      const shotPath = join(OUT_DIR, `preview-${width}px.png`);
      await page.screenshot({ path: shotPath, fullPage: true });
      (report.viewportChecks as unknown[]).push({ width, metrics, screenshot: shotPath });
      await page.close();
    }

    const printPage = await browser.newPage({ viewport: { width: 1200, height: 1600 } });
    await printPage.setContent(documentHtml, { waitUntil: "load" });
    await printPage.emulateMedia({ media: "print" });

    const printMetrics = await printPage.evaluate(() => {
      const first = document.querySelector<HTMLElement>(".page");
      const cs = first ? getComputedStyle(first) : null;
      return {
        htmlBackground: getComputedStyle(document.documentElement).backgroundColor,
        bodyBackground: getComputedStyle(document.body).backgroundColor,
        pageBackground: cs?.backgroundColor ?? null,
        pageBoxShadow: cs?.boxShadow ?? null,
        documentPadding: getComputedStyle(document.querySelector(".document")!).padding,
      };
    });

    const pageHandles = await printPage.$$(".page");
    for (let i = 0; i < pageHandles.length; i++) {
      const path = join(OUT_DIR, `print-page-${i + 1}.png`);
      await pageHandles[i].screenshot({ path });
    }
    report.printEmulated = printMetrics;
    await printPage.close();
  } finally {
    await browser.close();
  }

  const pdf = await renderProspectusHtmlToPdfBuffer(documentHtml);
  const pdfPath = join(OUT_DIR, "prospectus-3-pages.pdf");
  writeFileSync(pdfPath, pdf);
  const pageCount = countPdfPages(pdf);
  const pdfLatin = pdf.toString("latin1");
  const hasEcecec = /ececec|#ececec/i.test(pdfLatin);

  report.pdf = {
    path: pdfPath,
    bytes: pdf.length,
    pageCount,
    renderer: {
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: 0,
      method: "page.pdf (Chromium print of HTML .page nodes, not viewport screenshot)",
    },
    greyPreviewColorEmbedded: hasEcecec,
  };

  writeFileSync(join(OUT_DIR, "audit-report.json"), JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
  if (pageCount !== 3) {
    process.exitCode = 1;
    console.error(`Expected 3 PDF pages, got ${pageCount}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
