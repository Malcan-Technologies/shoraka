/**
 * Opt-in SigningCloud sandbox smoke for the three CA-signed generated documents.
 *
 * Generates current FA / JSG / DOA fixture PDFs through Gotenberg, computes
 * production signsets, and uploads disposable contracts using one verified
 * sandbox email for every field (duplicate-email merge).
 *
 * Required:
 *   SIGNINGCLOUD_SMOKE_SIGNER_EMAIL  existing verified SigningCloud sandbox user
 *     (falls back to the latest verified signingcloud_ekyc email)
 *   SC_BASE_URL, SC_API_KEY, SC_API_SECRET
 *   GOTENBERG_URL
 *
 * Optional:
 *   SIGNINGCLOUD_SMOKE_LAYOUT_ONLY=1     render PDFs, overlays, and field pages (no upload)
 *   SIGNINGCLOUD_SMOKE_SKIP_SIGN=1       upload, capture overlays, then exit
 *   SIGNINGCLOUD_SMOKE_INSPECT_HOSTED=1  screenshot hosted sessions after upload
 *   SIGNINGCLOUD_SMOKE_INSPECT_ONLY=1    screenshot existing gitignored sessions (no upload)
 *   SIGNINGCLOUD_SMOKE_POLL_MS           default 15000
 *   SIGNINGCLOUD_SMOKE_POLL_ATTEMPTS     default 20
 *   SIGNINGCLOUD_SMOKE_VERIFY_REFS=fa:n,jsg:n,doa:n  skip generate/upload; poll + hash signed PDFs
 *
 * Does not print API secrets, access tokens, webhook secrets, or hosted session URLs.
 * Session URLs are written under apps/api/tmp/ (gitignored).
 */
import { config as loadEnv } from "dotenv";
import * as crypto from "crypto";
import * as fs from "fs";
import { createRequire } from "module";
import * as path from "path";
import * as readline from "readline/promises";
import { stdin as input, stdout as output } from "process";
import { PDFDocument, rgb } from "pdf-lib";
import { createFacilityAgreementFixture } from "../src/modules/applications/facility-agreement/fa-fixture";
import { renderFacilityAgreementDocx } from "../src/modules/applications/facility-agreement/render-fa-docx";
import { buildFaSigningCloudSignsetsFromPdf } from "../src/modules/applications/facility-agreement/fa-signing-placement";
import { createJsgFixture } from "../src/modules/applications/joint-several-guarantee/jsg-fixture";
import { renderJsgDocx } from "../src/modules/applications/joint-several-guarantee/render-jsg-docx";
import { buildJsgSigningCloudSignsetsFromPdf } from "../src/modules/applications/joint-several-guarantee/jsg-signing-placement";
import { createDeedOfAssignmentFixture } from "../src/modules/applications/deed-of-assignment/doa-fixture";
import { renderDeedOfAssignmentDocx } from "../src/modules/applications/deed-of-assignment/render-doa-docx";
import { buildDoaSigningCloudSignsetsFromPdf } from "../src/modules/applications/deed-of-assignment/doa-signing-placement";
import { convertDocxToPdf, resolveGotenbergUrl } from "../src/modules/applications/letter-of-offer/convert-docx-to-pdf";
import { buildDocumentProviderSigners } from "../src/modules/signing/provider-signers";
import { SigningCloudProvider } from "../src/modules/signing/provider/signingcloud-adapter";
import { readSigningCloudConfigFromEnv } from "../src/modules/signingcloud/signingcloud-api";
import { PrismaClient } from "@prisma/client";

loadEnv({ path: path.join(__dirname, "../.env.local") });
loadEnv({ path: path.join(__dirname, "../.env") });

const requireFromScript = createRequire(__filename);

type SmokeField = {
  pageindex?: number;
  top?: number;
  left?: number;
  height?: number;
  width?: number;
};

type SmokeDoc = {
  key: "fa" | "jsg" | "doa";
  label: string;
  signerNames: string[];
  pdf: Buffer;
  signsets: SmokeField[][];
  fieldCount: number;
  pages: number[];
  providerRef: string;
  signingUrl: string;
};

function captureDir(): string {
  const dir = path.join(__dirname, "../tmp/signingcloud-smoke");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function resolveSignerEmail(): Promise<string> {
  const fromEnv = process.env.SIGNINGCLOUD_SMOKE_SIGNER_EMAIL?.trim();
  if (fromEnv) return fromEnv;

  const prisma = new PrismaClient();
  try {
    const row = await prisma.signingCloudEkyc.findFirst({
      where: { status: "verified" },
      orderBy: { completed_at: "desc" },
      select: { email: true },
    });
    if (!row?.email.trim()) {
      throw new Error(
        "Missing SIGNINGCLOUD_SMOKE_SIGNER_EMAIL and no verified signingcloud_ekyc row"
      );
    }
    return row.email;
  } finally {
    await prisma.$disconnect();
  }
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "(invalid email)";
  const visible = local.slice(0, 1);
  return `${visible}***@${domain}`;
}

function summarizeFields(signsets: SmokeField[][]): { fieldCount: number; pages: number[] } {
  const pages = new Set<number>();
  let fieldCount = 0;
  for (const signset of signsets) {
    for (const field of signset) {
      fieldCount += 1;
      if (typeof field.pageindex === "number") pages.add(field.pageindex);
    }
  }
  return { fieldCount, pages: [...pages].sort((a, b) => a - b) };
}

function printFieldGeometry(label: string, signerNames: string[], signsets: SmokeField[][]): void {
  console.log(`${label} field geometry:`);
  signsets.forEach((fields, index) => {
    const name = signerNames[index] ?? `signer-${index + 1}`;
    for (const field of fields) {
      console.log(
        `  ${name}: page=${field.pageindex} top=${field.top} left=${field.left} width=${field.width} height=${field.height}`
      );
    }
  });
}

async function overlayExecutionPages(
  pdf: Buffer,
  signsets: SmokeField[][]
): Promise<Array<{ pageindex: number; pdf: Buffer }>> {
  const src = await PDFDocument.load(pdf);
  const fields = signsets.flat();
  const pages = [...new Set(fields.map((field) => field.pageindex ?? 0).filter((page) => page > 0))].sort(
    (a, b) => a - b
  );
  const overlays: Array<{ pageindex: number; pdf: Buffer }> = [];
  for (const pageindex of pages) {
    const out = await PDFDocument.create();
    const [copied] = await out.copyPages(src, [pageindex - 1]);
    out.addPage(copied);
    const page = out.getPage(0);
    const { height: pageHeight } = page.getSize();
    for (const field of fields) {
      if (field.pageindex !== pageindex) continue;
      const width = field.width ?? 120;
      const height = field.height ?? 36;
      const left = field.left ?? 0;
      const top = field.top ?? 0;
      page.drawRectangle({
        x: left,
        y: pageHeight - top - height,
        width,
        height,
        borderColor: rgb(0.82, 0.12, 0.12),
        borderWidth: 1.5,
        color: rgb(0.82, 0.12, 0.12),
        opacity: 0.14,
        borderOpacity: 1,
      });
    }
    overlays.push({ pageindex, pdf: Buffer.from(await out.save()) });
  }
  return overlays;
}

async function rasterizePdfPages(
  overlays: Array<{ key: string; pageindex: number; pdf: Buffer }>,
  outDir: string
): Promise<void> {
  if (overlays.length === 0) return;
  const { chromium } = await import("playwright");
  const pdfjsRoot = path.dirname(requireFromScript.resolve("pdfjs-dist/package.json"));
  const pdfJs = fs.readFileSync(path.join(pdfjsRoot, "legacy/build/pdf.min.js"), "utf8");
  const worker = fs.readFileSync(path.join(pdfjsRoot, "legacy/build/pdf.worker.min.js"), "utf8");
  const browser = await chromium.launch();
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
      const title = await page.title();
      if (title !== "ready") {
        await page.close();
        throw new Error(`Could not rasterize ${overlay.key} page ${overlay.pageindex}`);
      }
      const pngPath = path.join(outDir, `${overlay.key}-page-${overlay.pageindex}.png`);
      await page.locator("#c").screenshot({ path: pngPath });
      await page.close();
      console.log(`Wrote overlay ${path.relative(path.join(__dirname, ".."), pngPath)}`);
    }
  } finally {
    await browser.close();
  }
}

async function jumpToExecutionPage(
  page: import("playwright").Page,
  targetPage: number | undefined
): Promise<void> {
  if (!targetPage) return;
  const goTo = page.getByRole("textbox", { name: /go to/i });
  await goTo.waitFor({ timeout: 8_000 });
  await goTo.fill(String(targetPage));
  await goTo.press("Enter");
  await sleep(2_500);
}

async function inspectHostedSessions(
  docs: Array<Pick<SmokeDoc, "key" | "label" | "pages" | "signingUrl">>,
  outDir: string
): Promise<void> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    for (const doc of docs) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      try {
        await page.goto(doc.signingUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
        await sleep(4_000);
        const coverPath = path.join(outDir, `${doc.key}-hosted.png`);
        await page.screenshot({ path: coverPath });
        await jumpToExecutionPage(page, doc.pages[0]).catch(() => undefined);
        const executionPath = path.join(outDir, `${doc.key}-hosted-execution.png`);
        await page.screenshot({ path: executionPath });
        console.log(
          `${doc.label} hosted inspect: title=${JSON.stringify(await page.title())} cover=${path.basename(coverPath)} execution=${path.basename(executionPath)}`
        );
      } catch (error) {
        const name = error instanceof Error ? error.name : "Error";
        throw new Error(`${doc.label} hosted inspect failed (${name})`);
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
}

function readSavedSessions(
  outDir: string
): Array<Pick<SmokeDoc, "key" | "label" | "pages" | "providerRef" | "signingUrl">> {
  const filePath = path.join(outDir, "sessions.txt");
  if (!fs.existsSync(filePath)) {
    throw new Error("No saved sandbox sessions. Run the smoke upload first.");
  }
  const pageByKey: Record<string, number[]> = {};
  const layoutPath = path.join(outDir, "layout.json");
  if (fs.existsSync(layoutPath)) {
    const parsed = JSON.parse(fs.readFileSync(layoutPath, "utf8")) as Array<{ key: string; pages?: number[] }>;
    for (const row of parsed) {
      if (row.key && Array.isArray(row.pages)) pageByKey[row.key] = row.pages;
    }
  }
  if (!pageByKey.fa) pageByKey.fa = [44];
  if (!pageByKey.jsg) pageByKey.jsg = [12];
  if (!pageByKey.doa) pageByKey.doa = [10];
  return fs
    .readFileSync(filePath, "utf8")
    .trim()
    .split("\n")
    .map((line) => {
      const [key, label, providerRef, signingUrl] = line.split("\t");
      if (key !== "fa" && key !== "jsg" && key !== "doa") {
        throw new Error("Saved sandbox session file is malformed");
      }
      if (!label || !providerRef || !signingUrl) {
        throw new Error("Saved sandbox session file is missing columns");
      }
      return {
        key,
        label,
        providerRef,
        signingUrl,
        pages: pageByKey[key] ?? [],
      };
    });
}

function writeLayoutSummary(
  jobs: Array<{ key: string; label: string; fieldCount: number; pages: number[] }>,
  uploaded: Array<Pick<SmokeDoc, "key" | "providerRef">>,
  outDir: string
): void {
  const refs = Object.fromEntries(uploaded.map((doc) => [doc.key, doc.providerRef]));
  const summary = jobs.map((job) => ({
    key: job.key,
    label: job.label,
    fieldCount: job.fieldCount,
    pages: job.pages,
    providerRef: refs[job.key] ?? null,
  }));
  fs.writeFileSync(path.join(outDir, "layout.json"), `${JSON.stringify(summary, null, 2)}\n`);
}

function writeSessionUrls(docs: SmokeDoc[], outDir: string): void {
  const filePath = path.join(outDir, "sessions.txt");
  const body = docs.map((doc) => `${doc.key}\t${doc.label}\t${doc.providerRef}\t${doc.signingUrl}`).join("\n");
  fs.writeFileSync(filePath, `${body}\n`, { encoding: "utf8" });
  console.log(
    `Hosted session URLs written to ${path.relative(path.join(__dirname, ".."), filePath)} (gitignored; do not commit)`
  );
}

async function waitForOperator(): Promise<void> {
  if (!input.isTTY || !output.isTTY) {
    throw new Error(
      "No TTY to wait for signing. Re-run after signing with SIGNINGCLOUD_SMOKE_VERIFY_REFS, or unset SIGNINGCLOUD_SMOKE_SKIP_SIGN only in an interactive shell."
    );
  }
  const rl = readline.createInterface({ input, output });
  try {
    await rl.question(
      "Open each session URL from the gitignored sessions file, confirm fields sit on the execution line, sign every field, then press Enter… "
    );
  } finally {
    rl.close();
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function parseVerifyRefs(): Array<{ key: "fa" | "jsg" | "doa"; label: string; providerRef: string }> | null {
  const raw = process.env.SIGNINGCLOUD_SMOKE_VERIFY_REFS?.trim();
  if (!raw) return null;
  const labels: Record<"fa" | "jsg" | "doa", string> = {
    fa: "Facility Agreement",
    jsg: "Joint and Several Guarantee",
    doa: "Deed of Assignment",
  };
  return raw.split(",").map((part) => {
    const [keyRaw, providerRef] = part.split(":").map((item) => item.trim());
    if (keyRaw !== "fa" && keyRaw !== "jsg" && keyRaw !== "doa") {
      throw new Error(`SIGNINGCLOUD_SMOKE_VERIFY_REFS expected fa|jsg|doa, got ${keyRaw}`);
    }
    if (!providerRef) {
      throw new Error(`SIGNINGCLOUD_SMOKE_VERIFY_REFS missing provider ref for ${keyRaw}`);
    }
    return { key: keyRaw, label: labels[keyRaw], providerRef };
  });
}

async function verifySignedDocuments(
  provider: SigningCloudProvider,
  docs: Array<{ label: string; providerRef: string }>
): Promise<void> {
  const pollMs = Number(process.env.SIGNINGCLOUD_SMOKE_POLL_MS ?? 15_000);
  const attempts = Number(process.env.SIGNINGCLOUD_SMOKE_POLL_ATTEMPTS ?? 20);
  for (const doc of docs) {
    let signed = false;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const details = await provider.getContractDetails({ providerRef: doc.providerRef });
      const allSigned =
        details.signers.length > 0 && details.signers.every((signer) => signer.status === "SIGNED");
      const completed = details.documentState === 4 || allSigned;
      console.log(
        `${doc.label} poll ${attempt}/${attempts}: documentState=${details.documentState ?? "n/a"} signers=${details.signers.map((s) => s.status).join(",") || "none"}`
      );
      if (completed) {
        signed = true;
        break;
      }
      if (attempt < attempts) await sleep(Number.isFinite(pollMs) ? pollMs : 15_000);
    }
    if (!signed) {
      throw new Error(`${doc.label} was not confirmed signed by SigningCloud`);
    }

    const file = await provider.fetchSignedDocument({ providerRef: doc.providerRef });
    if (!file.pdfBuffer.slice(0, 5).equals(Buffer.from("%PDF-"))) {
      throw new Error(`${doc.label} signed file is not a PDF`);
    }
    const sha256 = crypto.createHash("sha256").update(file.pdfBuffer).digest("hex");
    if (sha256 !== file.sha256) {
      throw new Error(`${doc.label} SHA-256 mismatch`);
    }
    console.log(`${doc.label}: signed PDF ${file.pdfBuffer.length} bytes sha256=${sha256}`);
  }
}

async function main(): Promise<void> {
  const layoutOnly = process.env.SIGNINGCLOUD_SMOKE_LAYOUT_ONLY === "1";
  const skipSign = process.env.SIGNINGCLOUD_SMOKE_SKIP_SIGN === "1";
  const inspectHosted = process.env.SIGNINGCLOUD_SMOKE_INSPECT_HOSTED === "1";
  const inspectOnly = process.env.SIGNINGCLOUD_SMOKE_INSPECT_ONLY === "1";
  const verifyRefs = parseVerifyRefs();
  const outDir = captureDir();

  if (inspectOnly) {
    const saved = readSavedSessions(outDir);
    await inspectHostedSessions(saved, outDir);
    if (readSigningCloudConfigFromEnv()) {
      const provider = new SigningCloudProvider();
      for (const doc of saved) {
        const details = await provider.getContractDetails({ providerRef: doc.providerRef });
        console.log(
          `${doc.label} provider state: documentState=${details.documentState ?? "n/a"} signers=${details.signers.map((s) => s.status).join(",") || "none"}`
        );
      }
    }
    console.log("Hosted inspect-only complete.");
    return;
  }

  if (verifyRefs) {
    if (!readSigningCloudConfigFromEnv()) {
      throw new Error("SigningCloud is not configured (SC_BASE_URL, SC_API_KEY, SC_API_SECRET)");
    }
    await verifySignedDocuments(new SigningCloudProvider(), verifyRefs);
    console.log("Sandbox smoke verify complete for FA, JSG, and DOA.");
    return;
  }

  if (!resolveGotenbergUrl()) {
    throw new Error("GOTENBERG_URL is required to render the fixture PDFs");
  }
  if (!layoutOnly && !readSigningCloudConfigFromEnv()) {
    throw new Error("SigningCloud is not configured (SC_BASE_URL, SC_API_KEY, SC_API_SECRET)");
  }
  const signerEmail = layoutOnly ? "layout-only@example.invalid" : await resolveSignerEmail();

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const provider = layoutOnly ? null : new SigningCloudProvider();

  const faNames = createFacilityAgreementFixture().issuer_signatories.map((row) => row.name);
  const doaNames = createDeedOfAssignmentFixture().assignor_signatories.map((row) => row.name);
  const jsgNames = ["Ali Bin Abu", "Siti Binti Ahmad", "Nora Abdullah", "Farid Hassan"];

  console.log("Rendering fixture PDFs through Gotenberg…");
  const [faPdf, jsgPdf, doaPdf] = await Promise.all([
    convertDocxToPdf(renderFacilityAgreementDocx(createFacilityAgreementFixture())),
    convertDocxToPdf(renderJsgDocx(createJsgFixture())),
    convertDocxToPdf(renderDeedOfAssignmentDocx(createDeedOfAssignmentFixture())),
  ]);

  const jobs = [
    {
      key: "fa" as const,
      label: "Facility Agreement",
      signerNames: faNames,
      pdf: faPdf,
      signsets: await buildFaSigningCloudSignsetsFromPdf(faPdf, faNames),
    },
    {
      key: "jsg" as const,
      label: "Joint and Several Guarantee",
      signerNames: jsgNames,
      pdf: jsgPdf,
      signsets: await buildJsgSigningCloudSignsetsFromPdf(jsgPdf, jsgNames),
    },
    {
      key: "doa" as const,
      label: "Deed of Assignment",
      signerNames: doaNames,
      pdf: doaPdf,
      signsets: await buildDoaSigningCloudSignsetsFromPdf(doaPdf, doaNames),
    },
  ];

  const overlayPages: Array<{ key: string; pageindex: number; pdf: Buffer }> = [];
  const uploaded: SmokeDoc[] = [];
  for (const job of jobs) {
    const summary = summarizeFields(job.signsets);
    if (job.signsets.length !== job.signerNames.length) {
      throw new Error(
        `${job.label} signset count ${job.signsets.length} does not match signer count ${job.signerNames.length}`
      );
    }
    const signers = buildDocumentProviderSigners(
      job.signsets.map((signset) => ({ email: signerEmail, signset }))
    );
    if (signers.length !== 1) {
      throw new Error(`${job.label} expected one merged sandbox signer, got ${signers.length}`);
    }
    printFieldGeometry(job.label, job.signerNames, job.signsets);
    const overlays = await overlayExecutionPages(job.pdf, job.signsets);
    for (const overlay of overlays) {
      overlayPages.push({ key: job.key, pageindex: overlay.pageindex, pdf: overlay.pdf });
    }
    if (layoutOnly || !provider) {
      console.log(
        `${job.label}: ${summary.fieldCount} fields on page(s) ${summary.pages.join(", ")} for ${job.signerNames.length} named slots (layout only)`
      );
      continue;
    }
    const { providerRef } = await provider.createDocumentContract({
      pdfBuffer: job.pdf,
      contractName: `CashSouk disposable smoke ${stamp} — ${job.label}`,
      signers,
    });
    const session = await provider.startSignerSession({
      providerRef,
      signerEmail,
    });
    uploaded.push({
      key: job.key,
      label: job.label,
      signerNames: job.signerNames,
      pdf: job.pdf,
      signsets: job.signsets,
      fieldCount: summary.fieldCount,
      pages: summary.pages,
      providerRef,
      signingUrl: session.signingUrl,
    });
    console.log(
      `${job.label}: ${summary.fieldCount} fields on page(s) ${summary.pages.join(", ")} for ${job.signerNames.length} named slots, merged to ${maskEmail(signerEmail)} providerRef=${providerRef}`
    );
  }

  await rasterizePdfPages(overlayPages, outDir);
  writeLayoutSummary(
    jobs.map((job) => ({ ...job, ...summarizeFields(job.signsets) })),
    uploaded,
    outDir
  );

  if (layoutOnly) {
    console.log("Layout-only smoke complete (no SigningCloud upload).");
    return;
  }

  writeSessionUrls(uploaded, outDir);

  if (inspectHosted) {
    await inspectHostedSessions(uploaded, outDir);
  }

  if (skipSign) {
    console.log("Skipping wait/verify (SIGNINGCLOUD_SMOKE_SKIP_SIGN=1).");
    return;
  }

  await waitForOperator();
  await verifySignedDocuments(provider as SigningCloudProvider, uploaded);
  console.log("Sandbox smoke complete for FA, JSG, and DOA.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
