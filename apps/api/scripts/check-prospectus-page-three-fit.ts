/**
 * SECTION: Measure Page 3 A4 fit after spacing polish
 * WHY: Confirm no clipping, source/footer visible, DNA = —, PDF = 3 pages
 *
 * Run: pnpm --filter @cashsouk/api exec tsx scripts/check-prospectus-page-three-fit.ts
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

const OUT_DIR = join(process.cwd(), "../../tmp/prospectus-p3-fit");

function countPdfPages(pdf: Buffer): number {
  return (pdf.toString("latin1").match(/\/Type\s*\/Page(?!s)\b/g) ?? []).length;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const page1 = buildProspectusPageOneHtml(SAMPLE_PROSPECTUS_PAGE_ONE);
  const page2 = buildProspectusPageTwoHtml(SAMPLE_PROSPECTUS_PAGE_TWO);
  const page3 = buildProspectusPageThreeHtml(SAMPLE_PROSPECTUS_PAGE_THREE);
  const documentHtml = combineProspectusPagesHtml({ page1, page2, page3 });

  writeFileSync(join(OUT_DIR, "document.html"), documentHtml, "utf8");
  writeFileSync(join(OUT_DIR, "page-3.html"), page3, "utf8");

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });

  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 1600 } });
    await page.setContent(documentHtml, { waitUntil: "load" });
    await page.locator(".prospectus-page-three").screenshot({
      path: join(OUT_DIR, "preview-page-3.png"),
    });

    const fit = await page.evaluate(() => {
      const p3 = document.querySelector(".prospectus-page-three") as HTMLElement | null;
      if (!p3) return null;
      const pageRect = p3.getBoundingClientRect();
      const footer = p3.querySelector(".prospectus-footer") as HTMLElement | null;
      const source = p3.querySelector(".source") as HTMLElement | null;
      const coverageRows = p3.querySelectorAll(".coverage-table tbody tr").length;
      const text = p3.innerText;
      let maxBottom = 0;
      for (const el of [...p3.children] as HTMLElement[]) {
        maxBottom = Math.max(maxBottom, el.getBoundingClientRect().bottom);
      }
      const footerRect = footer?.getBoundingClientRect();
      const sourceRect = source?.getBoundingClientRect();
      return {
        pageHeightPx: pageRect.height,
        contentBottomPx: maxBottom - pageRect.top,
        overflowPx: maxBottom - pageRect.bottom,
        footerVisible: footerRect ? footerRect.bottom <= pageRect.bottom + 0.5 : false,
        sourceVisible: sourceRect ? sourceRect.bottom <= pageRect.bottom + 0.5 : false,
        coverageRows,
        hasDataNotAvailable: text.includes("Data not available"),
        hasNA: /\bN\/A\b/.test(text),
        sourceText: source?.textContent?.trim() ?? null,
      };
    });

    await page.emulateMedia({ media: "print" });
    await page.locator(".prospectus-page-three").screenshot({
      path: join(OUT_DIR, "print-page-3.png"),
    });
    await page.close();

    const pdf = await renderProspectusHtmlToPdfBuffer(documentHtml);
    writeFileSync(join(OUT_DIR, "prospectus-3-pages.pdf"), pdf);
    const pageCount = countPdfPages(pdf);

    const report = { fit, pdfPageCount: pageCount, outDir: OUT_DIR };
    writeFileSync(join(OUT_DIR, "fit-report.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));

    if (!fit || fit.overflowPx > 0.5 || !fit.footerVisible || !fit.sourceVisible) {
      process.exitCode = 1;
      console.error("Page 3 fit check failed");
    }
    if (fit?.hasDataNotAvailable || fit?.hasNA) {
      process.exitCode = 1;
      console.error("Page 3 still shows unavailable placeholder text");
    }
    if (pageCount !== 3) {
      process.exitCode = 1;
      console.error(`Expected 3 PDF pages, got ${pageCount}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
