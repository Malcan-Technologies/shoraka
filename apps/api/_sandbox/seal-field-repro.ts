/**
 * Temporary SigningCloud sandbox: one signer, one sign box, one seal box.
 * Captures decrypted request/response envelopes for a provider report.
 *
 * Does not print secrets, access tokens, or hosted session URLs.
 *
 * From apps/api:
 *   SIGNINGCLOUD_SMOKE_SIGNER_EMAIL=you@sandbox \
 *     pnpm --filter @cashsouk/api signingcloud:seal-repro
 *
 * Sign the hosted URL in the gitignored session file, then:
 *   SEAL_REPRO_CONTINUE=1 pnpm --filter @cashsouk/api signingcloud:seal-repro
 *
 * Optional:
 *   SEAL_REPRO_FIELDTYPE=seal|stamp     default seal (production)
 *   SEAL_REPRO_STAMP=after|before|both|none   default after (production)
 *   SEAL_REPRO_CAPROVIDE=1              default 1 (production file2)
 *   SEAL_REPRO_SEAL_SIZE=44             PDF box edge in pt (production 44)
 */
import { config as loadEnv } from "dotenv";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import {
  decryptSigningCloudResponse,
  encryptPayload,
  parseSigningCloudHttpBody,
  type SigningCloudEncryptedResponse,
} from "../src/lib/signingcloud/crypto";
import {
  extractSigningUrlFromManualSigningResponse,
  integerSignsetJson,
  readSigningCloudConfigFromEnv,
  type SigningCloudEnvConfig,
} from "../src/modules/signingcloud/signingcloud-api";
import { extractSignedPdfBufferFromFileResponse } from "../src/modules/signingcloud/signed-file";
import { LAYOUT_DETECTED_SEAL_FIELD } from "../src/modules/signing/signature-field-geometry";
import { opaqueRgbPng } from "../scripts/lib/signingcloud-smoke-images";

loadEnv({ path: path.join(__dirname, "../.env.local") });
loadEnv({ path: path.join(__dirname, "../.env") });

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const STAMP_RGB = [120, 24, 28] as const;
const HTTP_TIMEOUT_MS = 25_000;
const FILE_DOWNLOAD_TIMEOUT_MS = 60_000;

type StampOrder = "before" | "after" | "both" | "none";
type SignField = {
  fieldtype: string;
  pageindex: number;
  top: number;
  left: number;
  height: number;
  width: number;
};

type CallRecord = {
  step: number;
  name: string;
  startedAt: string;
  elapsedMs: number;
  request: Record<string, unknown>;
  response: Record<string, unknown>;
};

type ReproState = {
  contractnum: string;
  signerEmail: string;
  fieldtype: string;
  stampOrder: StampOrder;
  caprovide: string;
  unsignedSha256: string;
  signset: SignField[];
};

const outDir = path.join(__dirname, "../tmp/signingcloud-smoke/seal-repro");
const transcriptPath = path.join(outDir, "transcript.json");
let calls: CallRecord[] = [];
let step = 0;

function loadExistingTranscript(): void {
  if (!fs.existsSync(transcriptPath)) return;
  const parsed = JSON.parse(fs.readFileSync(transcriptPath, "utf8")) as { calls?: CallRecord[] };
  if (!Array.isArray(parsed.calls)) return;
  calls = parsed.calls;
  step = calls.reduce((max, call) => Math.max(max, call.step), 0);
}

function stampOrderFromEnv(): StampOrder {
  const raw = (process.env.SEAL_REPRO_STAMP ?? "after").trim().toLowerCase();
  if (raw === "before" || raw === "after" || raw === "both" || raw === "none") return raw;
  throw new Error("SEAL_REPRO_STAMP must be before|after|both|none");
}

function sha256(buf: Buffer | string): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "(invalid email)";
  return `${local.slice(0, 1)}***@${domain}`;
}

function maskToken(value: string): { redacted: true; chars: number; sha256: string } {
  return { redacted: true, chars: value.length, sha256: sha256(value) };
}

function cipherSummary(value: string): { chars: number; sha256: string; preview: string } {
  return {
    chars: value.length,
    sha256: sha256(value),
    preview: `${value.slice(0, 24)}…`,
  };
}

function blobSummary(label: string, bytes: Buffer, extra?: Record<string, unknown>) {
  return {
    kind: label,
    bytes: bytes.length,
    sha256: sha256(bytes),
    ...extra,
  };
}

function redactQuery(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.search = parsed.search ? "?redacted" : "";
    return parsed.toString();
  } catch {
    return "(invalid url)";
  }
}

function redact(value: unknown, key = ""): unknown {
  const lower = key.toLowerCase();
  if (
    lower === "at" ||
    lower === "accesstoken" ||
    lower === "accesscode" ||
    lower.includes("secret") ||
    lower.includes("apikey")
  ) {
    return typeof value === "string" ? maskToken(value) : "[redacted]";
  }
  if (lower === "img" || lower === "signimg" || lower === "pdfdata" || lower === "stampimg") {
    if (typeof value !== "string") return value;
    const hex = value.replace(/\s+/g, "");
    const decoded = hex.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(hex) ? Buffer.from(hex, "hex") : null;
    return {
      encoding: decoded ? "hex" : "string",
      chars: value.length,
      decodedBytes: decoded?.length ?? null,
      sha256: sha256(decoded ?? value),
    };
  }
  if (typeof value === "string" && /^https?:\/\//i.test(value)) {
    return redactQuery(value);
  }
  if (Array.isArray(value)) return value.map((item) => redact(item, key));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([child, childValue]) => [
        child,
        redact(childValue, child),
      ])
    );
  }
  return value;
}

function envelopeSummary(body: SigningCloudEncryptedResponse) {
  return {
    result: body.result,
    message: body.message ?? "",
    data: typeof body.data === "string" && body.data ? cipherSummary(body.data) : null,
    mac: typeof body.mac === "string" && body.mac ? cipherSummary(body.mac) : null,
  };
}

function headerMap(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of headers.entries()) {
    if (key.toLowerCase() === "set-cookie") continue;
    out[key] = value;
  }
  return out;
}

function requireConfig(): SigningCloudEnvConfig {
  const cfg = readSigningCloudConfigFromEnv();
  if (!cfg) {
    throw new Error("SigningCloud is not configured (SC_BASE_URL, SC_API_KEY, SC_API_SECRET)");
  }
  return cfg;
}

function requireSignerEmail(): string {
  const email = process.env.SIGNINGCLOUD_SMOKE_SIGNER_EMAIL?.trim();
  if (!email) throw new Error("SIGNINGCLOUD_SMOKE_SIGNER_EMAIL is required");
  return email;
}

function fieldtypeFromEnv(): string {
  const value = process.env.SEAL_REPRO_FIELDTYPE?.trim() || "seal";
  if (!value) throw new Error("SEAL_REPRO_FIELDTYPE is empty");
  return value;
}

function sealSizeFromEnv(): number {
  const raw = process.env.SEAL_REPRO_SEAL_SIZE?.trim();
  const parsed = raw ? Number(raw) : LAYOUT_DETECTED_SEAL_FIELD.width;
  if (!Number.isInteger(parsed) || parsed < 8 || parsed > 300) {
    throw new Error("SEAL_REPRO_SEAL_SIZE must be an integer from 8 to 300");
  }
  return parsed;
}

function caprovideFromEnv(): string {
  return process.env.SEAL_REPRO_CAPROVIDE?.trim() || "1";
}

function ensureOutDir(): void {
  fs.mkdirSync(outDir, { recursive: true });
}

function writeJson(name: string, value: unknown): void {
  fs.writeFileSync(path.join(outDir, name), `${JSON.stringify(value, null, 2)}\n`);
}

async function signedFetch(
  url: string,
  init: RequestInit,
  timeoutMs = HTTP_TIMEOUT_MS
): Promise<{ res: Response; text: string }> {
  const res = await fetch(url, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  return { res, text };
}

function persistCalls(): void {
  let existing: Record<string, unknown> = {};
  if (fs.existsSync(transcriptPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(transcriptPath, "utf8")) as Record<string, unknown>;
    } catch {
      existing = {};
    }
  }
  fs.writeFileSync(transcriptPath, `${JSON.stringify({ ...existing, calls }, null, 2)}\n`);
}

function recordCall(
  name: string,
  started: number,
  request: Record<string, unknown>,
  response: Record<string, unknown>
): CallRecord {
  const record: CallRecord = {
    step: (step += 1),
    name,
    startedAt: new Date(started).toISOString(),
    elapsedMs: Date.now() - started,
    request,
    response,
  };
  calls.push(record);
  persistCalls();
  console.log(`  ${record.step}. ${name}  HTTP ${String(response.httpStatus)}  ${record.elapsedMs}ms`);
  return record;
}

async function getAccessToken(cfg: SigningCloudEnvConfig): Promise<string> {
  const started = Date.now();
  const url = `${cfg.baseUrl}/signserver/v1/accesstoken?client_id=${encodeURIComponent(cfg.apiKey)}`;
  const { res, text } = await signedFetch(url, { method: "GET" });
  const envelope = parseSigningCloudHttpBody(text, res.status);
  const decrypted =
    envelope.result === 0 && envelope.data && envelope.mac
      ? decryptSigningCloudResponse<{ at?: string }>(envelope, cfg.apiSecret)
      : null;
  recordCall(
    "GET /signserver/v1/accesstoken",
    started,
    {
      method: "GET",
      url: `${cfg.baseUrl}/signserver/v1/accesstoken`,
      query: { client_id: "[redacted]" },
    },
    {
      httpStatus: res.status,
      headers: headerMap(res.headers),
      envelope: envelopeSummary(envelope),
      decrypted: redact(decrypted),
    }
  );
  if (envelope.result !== 0 || !decrypted?.at) {
    throw new Error(`accesstoken failed: ${envelope.message || "unknown"} (result=${envelope.result})`);
  }
  return decrypted.at;
}

async function postEncrypted(params: {
  cfg: SigningCloudEnvConfig;
  accessToken: string;
  name: string;
  path: string;
  payload: Record<string, unknown>;
  formFields?: Record<string, string>;
  allowEmptyData?: boolean;
}): Promise<Record<string, unknown> | null> {
  const { cfg, accessToken, name, path: apiPath, payload, formFields, allowEmptyData } = params;
  const started = Date.now();
  const { data, mac } = encryptPayload(JSON.stringify(payload), cfg.apiSecret);
  const formBody = new URLSearchParams();
  if (formFields) {
    for (const [key, value] of Object.entries(formFields)) formBody.append(key, value);
  }
  formBody.append("accesstoken", accessToken);
  formBody.append("data", data);
  formBody.append("mac", mac);
  const query = formFields ? `?${new URLSearchParams(formFields).toString()}` : "";
  const url = `${cfg.baseUrl}${apiPath}${query}`;
  const { res, text } = await signedFetch(url, {
    method: "POST",
    body: formBody.toString(),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  const envelope = parseSigningCloudHttpBody(text, res.status);
  let decrypted: Record<string, unknown> | null = null;
  if (envelope.data && envelope.mac) {
    decrypted = decryptSigningCloudResponse<Record<string, unknown>>(envelope, cfg.apiSecret);
  }
  recordCall(
    name,
    started,
    {
      method: "POST",
      url: `${cfg.baseUrl}${apiPath}`,
      contentType: "application/x-www-form-urlencoded",
      queryFormFields: formFields ? Object.keys(formFields) : [],
      formFieldNames: ["accesstoken", "data", "mac", ...Object.keys(formFields ?? {})],
      ciphertext: { data: cipherSummary(data), mac: cipherSummary(mac) },
      decryptedPayload: redact(payload),
    },
    {
      httpStatus: res.status,
      headers: headerMap(res.headers),
      envelope: envelopeSummary(envelope),
      decrypted: redact(decrypted),
    }
  );
  if (envelope.result !== 0) {
    throw new Error(`${name} failed: ${envelope.message || "unknown"} (result=${envelope.result})`);
  }
  if (!decrypted && !allowEmptyData) {
    throw new Error(`${name} succeeded with no encrypted payload`);
  }
  return decrypted;
}

async function getEncrypted(params: {
  cfg: SigningCloudEnvConfig;
  accessToken: string;
  name: string;
  path: string;
  payload: Record<string, unknown>;
  timeoutMs?: number;
}): Promise<Record<string, unknown>> {
  const { cfg, accessToken, name, path: apiPath, payload, timeoutMs } = params;
  const started = Date.now();
  const { data, mac } = encryptPayload(JSON.stringify(payload), cfg.apiSecret);
  const qs = new URLSearchParams({ accesstoken: accessToken, data, mac });
  const { res, text } = await signedFetch(`${cfg.baseUrl}${apiPath}?${qs.toString()}`, { method: "GET" }, timeoutMs);
  const envelope = parseSigningCloudHttpBody(text, res.status);
  const decrypted =
    envelope.data && envelope.mac
      ? decryptSigningCloudResponse<Record<string, unknown>>(envelope, cfg.apiSecret)
      : null;
  recordCall(
    name,
    started,
    {
      method: "GET",
      url: `${cfg.baseUrl}${apiPath}`,
      queryFieldNames: ["accesstoken", "data", "mac"],
      ciphertext: { data: cipherSummary(data), mac: cipherSummary(mac) },
      decryptedPayload: redact(payload),
    },
    {
      httpStatus: res.status,
      headers: headerMap(res.headers),
      envelope: envelopeSummary(envelope),
      decrypted: redact(decrypted),
    }
  );
  if (envelope.result !== 0 || !decrypted) {
    throw new Error(`${name} failed: ${envelope.message || "unknown"} (result=${envelope.result})`);
  }
  return decrypted;
}

async function uploadContract(params: {
  cfg: SigningCloudEnvConfig;
  accessToken: string;
  pdf: Buffer;
  contractName: string;
  signerEmail: string;
  signsetJson: string;
  caprovide: string;
}): Promise<{ contractnum: string; raw: Record<string, unknown> }> {
  const { cfg, accessToken, pdf, contractName, signerEmail, signsetJson, caprovide } = params;
  const started = Date.now();
  const uploadFileHash = sha256(pdf);
  const payload = {
    contractInfo: {
      contractnum: "",
      contractname: contractName,
      signernum: 1,
      signerinfo: [
        {
          email: signerEmail,
          authtype: "0",
          caprovide,
          signset: signsetJson,
        },
      ],
    },
    uploadFileHash,
    type: "pdf",
  };
  const { data, mac } = encryptPayload(JSON.stringify(payload), cfg.apiSecret);
  const formData = new FormData();
  formData.append("accesstoken", accessToken);
  formData.append("data", data);
  formData.append("mac", mac);
  formData.append("uploadFile", new Blob([new Uint8Array(pdf)], { type: "application/pdf" }), "seal-repro.pdf");
  const { res, text } = await signedFetch(`${cfg.baseUrl}/signserver/v1/contract/file2`, {
    method: "POST",
    body: formData,
  });
  const envelope = parseSigningCloudHttpBody(text, res.status);
  const decrypted =
    envelope.data && envelope.mac
      ? decryptSigningCloudResponse<Record<string, unknown>>(envelope, cfg.apiSecret)
      : null;
  recordCall(
    "POST /signserver/v1/contract/file2",
    started,
    {
      method: "POST",
      url: `${cfg.baseUrl}/signserver/v1/contract/file2`,
      contentType: "multipart/form-data",
      formFieldNames: ["accesstoken", "data", "mac", "uploadFile"],
      ciphertext: { data: cipherSummary(data), mac: cipherSummary(mac) },
      decryptedPayload: redact(payload),
      uploadFile: blobSummary("application/pdf", pdf, { filename: "seal-repro.pdf" }),
      signsetParsed: JSON.parse(signsetJson) as SignField[],
      notes: [
        "signerinfo[0].signset is a JSON string (not an array), matching production file2.",
        `caprovide=${caprovide} matches production multi-signer upload.`,
      ],
    },
    {
      httpStatus: res.status,
      headers: headerMap(res.headers),
      envelope: envelopeSummary(envelope),
      decrypted: redact(decrypted),
    }
  );
  if (envelope.result !== 0 || !decrypted) {
    throw new Error(`file2 failed: ${envelope.message || "unknown"} (result=${envelope.result})`);
  }
  const contractnum =
    typeof decrypted.contractnum === "string"
      ? decrypted.contractnum
      : typeof decrypted.contractnumber === "string"
        ? decrypted.contractnumber
        : "";
  if (!contractnum) throw new Error("file2 did not return contractnum");
  return { contractnum, raw: decrypted };
}

async function uploadStamp(
  cfg: SigningCloudEnvConfig,
  accessToken: string,
  signerEmail: string,
  image: Buffer,
  when: "before-file2" | "after-file2"
): Promise<void> {
  await postEncrypted({
    cfg,
    accessToken,
    name: `POST /signserver/v1/user/stampimg (${when})`,
    path: "/signserver/v1/user/stampimg",
    allowEmptyData: true,
    payload: {
      email: signerEmail,
      img: image.toString("hex"),
      imgtype: "png",
    },
  });
}

/** SigningCloud `top` is from the top of the page (y down). pdf-lib `y` is from the bottom. */
function pdfYFromSigningCloudTop(top: number, height: number): number {
  return PAGE_HEIGHT - top - height;
}

function buildSignset(fieldtype: string, sealSize: number): SignField[] {
  const sign: SignField = {
    fieldtype: "sign",
    pageindex: 1,
    top: 220,
    left: 72,
    width: 180,
    height: 36,
  };
  const seal: SignField = {
    fieldtype,
    pageindex: 1,
    top: 300,
    left: 178,
    width: sealSize,
    height: sealSize,
  };
  return [sign, seal];
}

async function buildUnsignedPdf(signset: SignField[]): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const black = rgb(0.12, 0.12, 0.12);
  const ink = rgb(0.55, 0.08, 0.12);
  const sign = signset.find((field) => field.fieldtype === "sign");
  const seal = signset.find((field) => field.fieldtype !== "sign");
  page.drawText("CashSouk seal-field repro", { x: 72, y: 780, size: 16, font: bold, color: black });
  page.drawText("Sign and seal overlays should sit on these rectangles (SigningCloud top = from top of page).", {
    x: 72,
    y: 760,
    size: 9,
    font,
    color: black,
  });
  if (sign) {
    const y = pdfYFromSigningCloudTop(sign.top, sign.height);
    page.drawText("Sign here", { x: sign.left, y: y + sign.height + 10, size: 11, font: bold, color: black });
    page.drawLine({
      start: { x: sign.left, y },
      end: { x: sign.left + sign.width, y },
      thickness: 0.8,
      color: black,
    });
  }
  if (seal) {
    const y = pdfYFromSigningCloudTop(seal.top, seal.height);
    page.drawText("Company Stamp:", {
      x: 72,
      y: y + Math.max(0, Math.round((seal.height - 11) / 2)),
      size: 11,
      font,
      color: black,
    });
  }
  for (const field of signset) {
    const y = pdfYFromSigningCloudTop(field.top, field.height);
    page.drawRectangle({
      x: field.left,
      y,
      width: field.width,
      height: field.height,
      borderColor: field.fieldtype === "sign" ? black : ink,
      borderWidth: 1,
    });
    page.drawText(
      `${field.fieldtype}  page=${field.pageindex}  top=${field.top}  left=${field.left}  ${field.width}x${field.height}`,
      {
        x: field.left,
        y: y - 12,
        size: 8,
        font,
        color: ink,
      }
    );
  }
  return Buffer.from(await pdf.save());
}

function countImageMarkers(pdf: Buffer): number {
  return (pdf.toString("latin1").match(/\/Subtype\s*\/Image/g) ?? []).length;
}

async function analyzePdf(label: string, pdf: Buffer): Promise<Record<string, unknown>> {
  const doc = await PDFDocument.load(pdf);
  return {
    label,
    bytes: pdf.length,
    sha256: sha256(pdf),
    magic: pdf.slice(0, 8).toString("latin1"),
    pageCount: doc.getPageCount(),
    imageMarkers: countImageMarkers(pdf),
    containsCompanyStampLabel: pdf.toString("latin1").includes("Company Stamp:"),
  };
}

function writeSessionUrl(url: string): void {
  fs.writeFileSync(path.join(outDir, "session.txt"), `${url}\n`);
}

function writeReport(input: {
  cfg: SigningCloudEnvConfig;
  signerEmail: string;
  fieldtype: string;
  stampOrder: StampOrder;
  caprovide: string;
  signset: SignField[];
  stamp: Buffer;
  unsigned: Buffer;
  contractnum?: string;
  signed?: Buffer | null;
  error?: string;
}): void {
  const analysisPromiseSkipped = input.signed
    ? null
    : "Signed PDF not downloaded yet. Re-run with SEAL_REPRO_CONTINUE=1 after signing.";
  const body = [
    "# SigningCloud organisation-seal field — sandbox repro",
    "",
    "Isolated contract: one manual signer, one `sign` field, one organisation-seal field.",
    "No CashSouk automatic keywords. No Facility Agreement / DoA templates.",
    "",
    "## Observed issue",
    "",
    "The hosted signing UI shows a Seal field and accepts an image (green check).",
    "After Sign, the flattened PDF contains the handwritten signature but not the seal.",
    "",
    "## Environment",
    "",
    `- Base URL: ${input.cfg.baseUrl}`,
    `- Signer: ${maskEmail(input.signerEmail)}`,
    `- Field type sent: \`${input.fieldtype}\``,
    `- Stamp upload order: \`${input.stampOrder}\``,
    `- file2 \`caprovide\`: \`${input.caprovide}\``,
    `- Encryption: AES-256-ECB over JSON; MAC = SHA256(ciphertext + apiSecret)`,
    `- Generated: ${new Date().toISOString()}`,
    "",
    "## Signset sent in file2 (parsed)",
    "",
    "```json",
    JSON.stringify(input.signset, null, 2),
    "```",
    "",
    "Production sends `signerinfo[].signset` as a **JSON string** of that array, with integer coordinates.",
    "",
    "## Stamp image (`POST /signserver/v1/user/stampimg`)",
    "",
    `- Format: opaque RGB PNG ${STAMP_RGB[0]},${STAMP_RGB[1]},${STAMP_RGB[2]} (200×200 px)`,
    `- Bytes: ${input.stamp.length}`,
    `- SHA-256: ${sha256(input.stamp)}`,
    `- Payload keys: \`email\`, \`img\` (hex), \`imgtype: \"png\"\` — not \`stampimg\``,
    `- Endpoint is user-level, not contract-level. It is not referenced from the signset.`,
    "",
    "## Unsigned PDF",
    "",
    `- Bytes: ${input.unsigned.length}`,
    `- SHA-256: ${sha256(input.unsigned)}`,
    `- Page: A4 ${PAGE_WIDTH}×${PAGE_HEIGHT} pt`,
    `- SigningCloud \`top\` is from the top of the page. Printed rectangles use \`y = ${PAGE_HEIGHT} - top - height\`.`,
    "",
    input.contractnum ? `## Contract\n\n- contractnum: \`${input.contractnum}\`\n` : "",
    "## HTTP calls (see transcript.json for full redacted envelopes)",
    "",
    ...calls.map(
      (call) =>
        `- ${call.step}. \`${call.name}\` — HTTP ${String(call.response.httpStatus)} in ${call.elapsedMs}ms`
    ),
    "",
    "## Attachments in this folder",
    "",
    "- `unsigned.pdf` — uploaded source",
    "- `seal.png` — stamp bytes sent as `img` hex",
    "- `transcript.json` — every call, decrypted payloads, secrets stripped",
    "- `session.txt` — hosted signing URL (do not commit; do not paste the query string)",
    "- `signed.pdf` — present after CONTINUE",
    "",
    "## Signed PDF",
    "",
    analysisPromiseSkipped ??
      "See `signed-analysis.json`. Unsigned PDF has no images. One image after sign = signature only (seal missing). Two images = signature + seal.",
    "",
    input.error ? `## Error\n\n${input.error}\n` : "",
    "## Questions for SigningCloud",
    "",
    "1. Is `fieldtype: \"seal\"` the correct signset value to flatten an organisation stamp? Should it be `stamp`?",
    "2. Does `/user/stampimg` bind to seal fields on later contracts, or only to the user profile?",
    "3. Must the stamp exist before `file2`, or is after-upload (our production order) supported?",
    "4. Does the hosted UI overlay flatten into `/contract/file` for seal fields, or is that overlay session-only?",
    "5. Are extra signset keys required (`required`, image id, keyword)?",
    "",
  ].join("\n");
  fs.writeFileSync(path.join(outDir, "REPORT.md"), body);
  writeJson("transcript.json", {
    purpose: "SigningCloud seal-field flatten repro",
    generatedAt: new Date().toISOString(),
    baseUrl: input.cfg.baseUrl,
    signerEmailMasked: maskEmail(input.signerEmail),
    fieldtype: input.fieldtype,
    stampOrder: input.stampOrder,
    caprovide: input.caprovide,
    signset: input.signset,
    stamp: blobSummary("image/png", input.stamp, { widthPx: 200, heightPx: 200, rgb: STAMP_RGB }),
    unsignedPdf: blobSummary("application/pdf", input.unsigned),
    contractnum: input.contractnum ?? null,
    error: input.error ?? null,
    calls,
  });
}

function readState(): ReproState {
  const file = path.join(outDir, "state.json");
  if (!fs.existsSync(file)) {
    throw new Error("No seal-repro state. Run the upload first.");
  }
  return JSON.parse(fs.readFileSync(file, "utf8")) as ReproState;
}

async function runContinue(): Promise<void> {
  loadExistingTranscript();
  const cfg = requireConfig();
  const state = readState();
  const stamp = fs.readFileSync(path.join(outDir, "seal.png"));
  const unsigned = fs.readFileSync(path.join(outDir, "unsigned.pdf"));
  console.log(`Seal repro CONTINUE for ${state.contractnum}`);
  const accessToken = await getAccessToken(cfg);
  const details = await getEncrypted({
    cfg,
    accessToken,
    name: "GET /signserver/v1/contract/details/data",
    path: "/signserver/v1/contract/details/data",
    payload: { contractnum: state.contractnum },
  });
  writeJson("details-after-sign.json", redact(details));
  const fileData = await getEncrypted({
    cfg,
    accessToken,
    name: "GET /signserver/v1/contract/file",
    path: "/signserver/v1/contract/file",
    payload: { contractnum: state.contractnum, isReqCertOfCompletion: false },
    timeoutMs: FILE_DOWNLOAD_TIMEOUT_MS,
  });
  const signed = extractSignedPdfBufferFromFileResponse(fileData);
  if (!signed) throw new Error("Signed file response did not contain a PDF");
  fs.writeFileSync(path.join(outDir, "signed.pdf"), signed);
  const unsignedAnalysis = await analyzePdf("unsigned", unsigned);
  const signedAnalysis = await analyzePdf("signed", signed);
  writeJson("signed-analysis.json", {
    unsigned: unsignedAnalysis,
    signed: signedAnalysis,
    interpretation: {
      unsignedImageMarkers: unsignedAnalysis.imageMarkers,
      signedImageMarkers: signedAnalysis.imageMarkers,
      likelySealMissing:
        Number(signedAnalysis.imageMarkers) <= 1
          ? "Signed PDF has at most one /Subtype /Image marker. A completed sign+seal flatten should usually embed two images."
          : "Signed PDF has more than one image marker; inspect signed.pdf for the maroon 200×200 stamp.",
    },
  });
  writeReport({
    cfg,
    signerEmail: state.signerEmail,
    fieldtype: state.fieldtype,
    stampOrder: state.stampOrder,
    caprovide: state.caprovide || caprovideFromEnv(),
    signset: state.signset,
    stamp,
    unsigned,
    contractnum: state.contractnum,
    signed,
  });
  console.log(`Wrote ${path.relative(path.join(__dirname, ".."), outDir)} (signed.pdf + REPORT.md)`);
}

async function runUpload(): Promise<void> {
  const cfg = requireConfig();
  const signerEmail = requireSignerEmail();
  const fieldtype = fieldtypeFromEnv();
  const stampOrder = stampOrderFromEnv();
  const caprovide = caprovideFromEnv();
  const sealSize = sealSizeFromEnv();
  const signset = buildSignset(fieldtype, sealSize);
  const signsetJson = integerSignsetJson(JSON.stringify(signset));
  const stamp = opaqueRgbPng(200, 200, STAMP_RGB);
  const unsigned = await buildUnsignedPdf(JSON.parse(signsetJson) as SignField[]);
  ensureOutDir();
  fs.writeFileSync(path.join(outDir, "seal.png"), stamp);
  fs.writeFileSync(path.join(outDir, "unsigned.pdf"), unsigned);

  const ctx = {
    cfg,
    signerEmail,
    fieldtype,
    stampOrder,
    caprovide,
    signset: JSON.parse(signsetJson) as SignField[],
    stamp,
    unsigned,
  };

  try {
    console.log(
      `Seal repro upload: fieldtype=${fieldtype} stamp=${stampOrder} signer=${maskEmail(signerEmail)}`
    );
    const accessToken = await getAccessToken(cfg);
    if (stampOrder === "before" || stampOrder === "both") {
      await uploadStamp(cfg, accessToken, signerEmail, stamp, "before-file2");
    }
    const { contractnum } = await uploadContract({
      cfg,
      accessToken,
      pdf: unsigned,
      contractName: `CashSouk seal repro ${new Date().toISOString()}`,
      signerEmail,
      signsetJson,
      caprovide,
    });
    if (stampOrder === "after" || stampOrder === "both") {
      await uploadStamp(cfg, accessToken, signerEmail, stamp, "after-file2");
    }
    const details = await getEncrypted({
      cfg,
      accessToken,
      name: "GET /signserver/v1/contract/details/data (before sign)",
      path: "/signserver/v1/contract/details/data",
      payload: { contractnum },
    });
    writeJson("details-before-sign.json", redact(details));
    const manual = await postEncrypted({
      cfg,
      accessToken,
      name: "POST /signserver/v1/contract/signature/manual",
      path: "/signserver/v1/contract/signature/manual",
      payload: {
        contractnum,
        signerInfo: { email: signerEmail },
      },
    });
    const signingUrl = extractSigningUrlFromManualSigningResponse(manual ?? {});
    if (!signingUrl) throw new Error("manual signing did not return a URL");
    writeSessionUrl(signingUrl);
    writeJson("state.json", {
      contractnum,
      signerEmail,
      fieldtype,
      stampOrder,
      caprovide,
      unsignedSha256: sha256(unsigned),
      signset: ctx.signset,
    } satisfies ReproState);
    writeReport({ ...ctx, contractnum, signed: null });
    console.log(
      `Hosted URL: ${path.relative(path.join(__dirname, ".."), path.join(outDir, "session.txt"))}`
    );
    console.log(
      `Report packet: ${path.relative(path.join(__dirname, ".."), outDir)}  (gitignored)`
    );
    console.log("Sign the seal + signature, then: SEAL_REPRO_CONTINUE=1 pnpm --filter @cashsouk/api signingcloud:seal-repro");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeReport({ ...ctx, error: message, signed: null });
    throw error;
  }
}

async function main(): Promise<void> {
  ensureOutDir();
  if (process.env.SEAL_REPRO_CONTINUE === "1") {
    await runContinue();
    return;
  }
  await runUpload();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
