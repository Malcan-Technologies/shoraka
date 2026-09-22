/**
 * Opt-in wrap inspect smoke for generated Word templates.
 *
 * Renders LO / FA / JSG / DOA with realistically long merge strings, converts
 * to PDF via Gotenberg, and writes DOCX, PDF, wrap-hit JSON, and page PNGs
 * under apps/api/tmp/generated-docs-wrap-smoke (gitignored).
 *
 * Required:
 *   GOTENBERG_URL  e.g. http://127.0.0.1:3100
 *   docker compose -f docker-compose.gotenberg.yml up -d
 *
 * From apps/api:
 *   pnpm generated-docs:wrap-smoke
 */
import { config as loadEnv } from "dotenv";
import * as fs from "fs";
import { createRequire } from "module";
import * as os from "os";
import * as path from "path";
import PizZip from "pizzip";
import { PDFDocument } from "pdf-lib";
import { createDeedOfAssignmentFixture } from "../src/modules/applications/deed-of-assignment/doa-fixture";
import { renderDeedOfAssignmentDocx } from "../src/modules/applications/deed-of-assignment/render-doa-docx";
import { createFacilityAgreementFixture } from "../src/modules/applications/facility-agreement/fa-fixture";
import { renderFacilityAgreementDocx } from "../src/modules/applications/facility-agreement/render-fa-docx";
import { createJsgFixture } from "../src/modules/applications/joint-several-guarantee/jsg-fixture";
import { extractPdfTextItems } from "../src/modules/applications/joint-several-guarantee/jsg-signing-placement";
import { renderJsgDocx } from "../src/modules/applications/joint-several-guarantee/render-jsg-docx";
import { createFacilityLoFixture } from "../src/modules/applications/letter-of-offer/facility-lo-fixture";
import { renderFacilityLoDocx } from "../src/modules/applications/letter-of-offer/render-facility-lo-docx";
import {
  convertDocxToPdf,
  resolveGotenbergUrl,
} from "../src/modules/applications/letter-of-offer/convert-docx-to-pdf";
import {
  DOA_ASSIGNOR_COLON_TWIPS,
  DOA_SSP_COLON_TWIPS,
  DOA_SSP_VALUE_HANGING_TWIPS,
  DOA_SSP_WRAP_LEFT_TWIPS,
  FA_ISSUER_WITNESS_COLON_TWIPS,
  JSG_OPERATOR_COLON_TWIPS,
  JSG_OPERATOR_VALUE_HANGING_TWIPS,
  JSG_OPERATOR_WRAP_LEFT_TWIPS,
  LO_ATTENTION_POSITION_LEFT_TWIPS,
  LO_ATTENTION_WRAP_LEFT_TWIPS,
  paragraphContaining,
  paragraphPinsFaExecutionValueWrap,
  paragraphPinsHangingValueWrap,
  xmlHasTableHangingLabelWrap,
} from "../src/modules/generated-documents/hanging-execution-label";
import {
  LONG_PERSON_NAME,
  LONG_SC_DESIGNATION,
  withLongDeedOfAssignmentStrings,
  withLongFacilityAgreementStrings,
  withLongFacilityLoStrings,
  withLongJsgStrings,
} from "../src/modules/generated-documents/long-merge-strings";

loadEnv({ path: path.join(__dirname, "../.env.local") });
loadEnv({ path: path.join(__dirname, "../.env") });

const requireFromScript = createRequire(__filename);
const API_ROOT = path.join(__dirname, "..");

type WrapJob = {
  key: "lo" | "fa" | "jsg" | "doa";
  label: string;
  minX: number;
  render: () => Buffer;
  assertXml: (xml: string) => void;
};

type WrapHit = {
  pageindex: number;
  x: number;
  yTop: number;
  text: string;
};

function captureDir(): string {
  const dir = path.join(API_ROOT, "tmp/generated-docs-wrap-smoke");
  fs.mkdirSync(dir, { recursive: true });
  for (const name of fs.readdirSync(dir)) {
    if (/\.(docx|pdf|png|json)$/.test(name)) fs.unlinkSync(path.join(dir, name));
  }
  return dir;
}

function rel(filePath: string): string {
  return path.relative(API_ROOT, filePath);
}

function xmlOf(docx: Buffer): string {
  return new PizZip(docx).file("word/document.xml")?.asText() ?? "";
}

function hangingValueParagraphs(
  xml: string,
  wrapLeftTwips: number,
  hangingTwips?: number,
  tabPosTwips?: number
): string[] {
  return [...xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)]
    .map((match) => match[0])
    .filter((pXml) => {
      if (hangingTwips == null) return paragraphPinsHangingValueWrap(pXml, wrapLeftTwips);
      return paragraphPinsHangingValueWrap(pXml, wrapLeftTwips, hangingTwips, tabPosTwips ?? wrapLeftTwips);
    });
}

function expectHangingCount(
  xml: string,
  wrapLeftTwips: number,
  needle: string,
  count: number,
  label: string,
  hangingTwips?: number,
  tabPosTwips?: number
): void {
  const hits = hangingValueParagraphs(xml, wrapLeftTwips, hangingTwips, tabPosTwips).filter((pXml) =>
    pXml.includes(needle)
  );
  if (hits.length !== count) {
    throw new Error(`${label}: expected ${count} hanging paragraph(s) for ${needle}, got ${hits.length}`);
  }
}

function isDesignationWrapHit(text: string): boolean {
  return text.includes("Non-Independent") || text.trim() === "Independent";
}

function designationHits(items: WrapHit[]): WrapHit[] {
  return items.filter((item) => isDesignationWrapHit(item.text));
}

function assertDesignationNotAtLeftMargin(items: WrapHit[], minX: number, label: string): WrapHit[] {
  const hits = designationHits(items);
  if (hits.length === 0) {
    throw new Error(`${label}: PDF has no wrapped SC designation tokens`);
  }
  for (const hit of hits) {
    if (hit.x <= minX) {
      throw new Error(
        `${label}: wrapped designation ${JSON.stringify(hit.text)} is at x=${hit.x.toFixed(1)} on page ${hit.pageindex}, expected > ${minX}`
      );
    }
  }
  return hits;
}

function inspectPages(key: WrapJob["key"], items: WrapHit[]): number[] {
  const pages = new Set<number>();
  for (const hit of designationHits(items)) pages.add(hit.pageindex);
  if (key === "lo") {
    for (const item of items) {
      if (item.text.includes("Attention")) pages.add(item.pageindex);
    }
  }
  if (key === "fa") {
    for (const item of items) {
      if (item.text.includes("Name of Witness") || /company stamp/i.test(item.text)) pages.add(item.pageindex);
    }
  }
  if (key === "jsg") {
    for (const item of items) {
      if (item.text.includes("Full Name") || item.text.includes("Signature of Guarantor")) pages.add(item.pageindex);
    }
  }
  if (key === "doa") {
    for (const item of items) {
      if (item.text.includes("NRIC / Passport") || item.text.includes("In the presence of")) {
        pages.add(item.pageindex);
      }
    }
  }
  return [...pages].sort((a, b) => a - b);
}

async function extractPdfPage(pdf: Buffer, pageindex: number): Promise<Buffer> {
  const src = await PDFDocument.load(pdf);
  const out = await PDFDocument.create();
  const [copied] = await out.copyPages(src, [pageindex - 1]);
  out.addPage(copied);
  return Buffer.from(await out.save());
}

function useHomePlaywrightBrowsersIfNeeded(): void {
  const configured = process.env.PLAYWRIGHT_BROWSERS_PATH;
  const hasChromium = (dir: string | undefined): boolean =>
    Boolean(dir && fs.existsSync(dir) && fs.readdirSync(dir).some((name) => name.startsWith("chromium")));
  if (hasChromium(configured)) return;
  const homeCache = path.join(os.homedir(), ".cache/ms-playwright");
  if (hasChromium(homeCache)) process.env.PLAYWRIGHT_BROWSERS_PATH = homeCache;
}

async function rasterizePdfPages(
  overlays: Array<{ key: string; pageindex: number; pdf: Buffer }>,
  outDir: string
): Promise<void> {
  if (overlays.length === 0) return;
  useHomePlaywrightBrowsersIfNeeded();
  const { chromium } = await import("playwright");
  let browser: Awaited<ReturnType<typeof chromium.launch>>;
  try {
    browser = await chromium.launch();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.log(`Skipping page rasterize (${detail.split("\n")[0] ?? "Playwright unavailable"}).`);
    return;
  }
  const pdfjsRoot = path.dirname(requireFromScript.resolve("pdfjs-dist/package.json"));
  const pdfJs = fs.readFileSync(path.join(pdfjsRoot, "legacy/build/pdf.min.js"), "utf8");
  const worker = fs.readFileSync(path.join(pdfjsRoot, "legacy/build/pdf.worker.min.js"), "utf8");
  try {
    for (const overlay of overlays) {
      const page = await browser.newPage({ viewport: { width: 900, height: 1300 } });
      const b64 = overlay.pdf.toString("base64");
      const html = `<!doctype html><html><body style="margin:0;background:#fff">
<canvas id="c"></canvas>
<script>${pdfJs}</script>
<script>
  pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(
    new Blob([${JSON.stringify(worker)}], { type: "text/javascript" })
  );
  const data = Uint8Array.from(atob(${JSON.stringify(b64)}), (c) => c.charCodeAt(0));
  (async () => {
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    const pdfPage = await pdf.getPage(1);
    const viewport = pdfPage.getViewport({ scale: 1.7 });
    const canvas = document.getElementById("c");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await pdfPage.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    document.title = "ready";
  })().catch((err) => { document.title = "error"; document.body.innerText = String(err); });
</script>
</body></html>`;
      await page.setContent(html, { waitUntil: "load" });
      await page.waitForFunction(() => document.title === "ready" || document.title === "error", {
        timeout: 30_000,
      });
      if ((await page.title()) !== "ready") {
        await page.close();
        throw new Error(`Could not rasterize ${overlay.key} page ${overlay.pageindex}`);
      }
      const pngPath = path.join(outDir, `${overlay.key}-page-${overlay.pageindex}.png`);
      await page.locator("#c").screenshot({ path: pngPath });
      await page.close();
      console.log(`Wrote page ${rel(pngPath)}`);
    }
  } finally {
    await browser.close();
  }
}

function assertLoXml(xml: string): void {
  if (!xml.includes(LONG_SC_DESIGNATION) || !xml.includes(LONG_PERSON_NAME)) {
    throw new Error("Letter of Offer: missing long Attention name or designation");
  }
  if (
    !paragraphPinsHangingValueWrap(
      paragraphContaining(xml, LONG_PERSON_NAME),
      LO_ATTENTION_WRAP_LEFT_TWIPS,
      LO_ATTENTION_WRAP_LEFT_TWIPS
    )
  ) {
    throw new Error("Letter of Offer: Attention name is missing hanging wrap");
  }
  const position = paragraphContaining(xml, LONG_SC_DESIGNATION);
  if (!position.includes(`w:left="${LO_ATTENTION_POSITION_LEFT_TWIPS}"`)) {
    throw new Error("Letter of Offer: Attention position is missing left indent");
  }
  if (position.includes("w:firstLine=")) {
    throw new Error("Letter of Offer: Attention position still uses first-line indent");
  }
}

function assertFaXml(xml: string): void {
  const hits = [...xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)]
    .map((match) => match[0])
    .filter((pXml) => paragraphPinsFaExecutionValueWrap(pXml) && pXml.includes(LONG_SC_DESIGNATION));
  if (hits.length !== 4) {
    throw new Error(
      `Facility Agreement: expected 4 hanging designation paragraphs, got ${hits.length}`
    );
  }
  if (!xmlHasTableHangingLabelWrap(xml, "Name of Witness")) {
    throw new Error("Facility Agreement Issuer: Name of Witness is missing hanging wrap");
  }
  if (!xmlHasTableHangingLabelWrap(xml, "NRIC", FA_ISSUER_WITNESS_COLON_TWIPS)) {
    throw new Error("Facility Agreement Issuer: witness NRIC does not share the Name of Witness colon");
  }
}

function assertJsgXml(xml: string): void {
  expectHangingCount(
    xml,
    JSG_OPERATOR_WRAP_LEFT_TWIPS,
    LONG_SC_DESIGNATION,
    2,
    "JSG Operator",
    JSG_OPERATOR_VALUE_HANGING_TWIPS,
    JSG_OPERATOR_COLON_TWIPS
  );
  if (!xmlHasTableHangingLabelWrap(xml, "NRIC No.")) {
    throw new Error("JSG guarantor: NRIC No. is missing hanging wrap");
  }
}

function assertDoaXml(xml: string): void {
  if (!xml.includes(LONG_SC_DESIGNATION) || !xml.includes(LONG_PERSON_NAME)) {
    throw new Error("Deed of Assignment: missing long SSP name or designation");
  }
  expectHangingCount(
    xml,
    DOA_SSP_WRAP_LEFT_TWIPS,
    LONG_SC_DESIGNATION,
    2,
    "Deed of Assignment SSP",
    DOA_SSP_VALUE_HANGING_TWIPS,
    DOA_SSP_COLON_TWIPS
  );
  if (!xmlHasTableHangingLabelWrap(xml, "NRIC / Passport No")) {
    throw new Error("Deed of Assignment Assignor: NRIC is missing hanging wrap");
  }
  if (!xmlHasTableHangingLabelWrap(xml, "Name", DOA_ASSIGNOR_COLON_TWIPS)) {
    throw new Error("Deed of Assignment Assignor: Name does not share the NRIC colon");
  }
  if (!xmlHasTableHangingLabelWrap(xml, "Designation", DOA_ASSIGNOR_COLON_TWIPS)) {
    throw new Error("Deed of Assignment Assignor: Designation does not share the NRIC colon");
  }
}

const JOBS: WrapJob[] = [
  {
    key: "lo",
    label: "Letter of Offer",
    minX: 90,
    render: () => renderFacilityLoDocx(withLongFacilityLoStrings(createFacilityLoFixture())),
    assertXml: assertLoXml,
  },
  {
    key: "fa",
    label: "Facility Agreement",
    minX: 80,
    render: () => renderFacilityAgreementDocx(withLongFacilityAgreementStrings(createFacilityAgreementFixture())),
    assertXml: assertFaXml,
  },
  {
    key: "jsg",
    label: "Joint Several Guarantee",
    minX: 160,
    render: () => renderJsgDocx(withLongJsgStrings(createJsgFixture())),
    assertXml: assertJsgXml,
  },
  {
    key: "doa",
    label: "Deed of Assignment",
    minX: 80,
    render: () => renderDeedOfAssignmentDocx(withLongDeedOfAssignmentStrings(createDeedOfAssignmentFixture())),
    assertXml: assertDoaXml,
  },
];

async function main(): Promise<void> {
  if (!resolveGotenbergUrl()) {
    throw new Error(
      "GOTENBERG_URL is required. Set it (e.g. http://127.0.0.1:3100) and run: docker compose -f docker-compose.gotenberg.yml up -d"
    );
  }

  const outDir = captureDir();
  const summary: Array<{
    key: WrapJob["key"];
    label: string;
    docx: string;
    pdf: string;
    inspectPages: number[];
    wrapHits: WrapHit[];
  }> = [];
  const rasterJobs: Array<{ key: string; pageindex: number; pdf: Buffer }> = [];

  for (const job of JOBS) {
    console.log(`Rendering ${job.label} with long merge strings…`);
    const docx = job.render();
    job.assertXml(xmlOf(docx));

    const docxPath = path.join(outDir, `${job.key}.docx`);
    fs.writeFileSync(docxPath, docx);
    console.log(`Wrote ${rel(docxPath)} (${docx.length} bytes)`);

    const pdf = await convertDocxToPdf(docx, { fileName: `${job.key}-wrap-smoke.docx` });
    const pdfPath = path.join(outDir, `${job.key}.pdf`);
    fs.writeFileSync(pdfPath, pdf);
    console.log(`Wrote ${rel(pdfPath)} (${pdf.length} bytes)`);

    const items = (await extractPdfTextItems(pdf)).map((item) => ({
      pageindex: item.pageindex,
      x: item.x,
      yTop: item.yTop,
      text: item.text,
    }));
    const wrapHits = assertDesignationNotAtLeftMargin(items, job.minX, job.label);
    const pages = inspectPages(job.key, items);
    for (const hit of wrapHits) {
      console.log(
        `  wrap hit page=${hit.pageindex} x=${hit.x.toFixed(1)} y=${hit.yTop.toFixed(1)} ${JSON.stringify(hit.text)}`
      );
    }
    for (const pageindex of pages) {
      rasterJobs.push({ key: job.key, pageindex, pdf: await extractPdfPage(pdf, pageindex) });
    }
    summary.push({
      key: job.key,
      label: job.label,
      docx: path.basename(docxPath),
      pdf: path.basename(pdfPath),
      inspectPages: pages,
      wrapHits,
    });
  }

  const summaryPath = path.join(outDir, "wrap-hits.json");
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`Wrote ${rel(summaryPath)}`);

  await rasterizePdfPages(rasterJobs, outDir);
  console.log(`Wrap smoke complete. Inspect files under ${rel(outDir)} (gitignored; do not commit)`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
