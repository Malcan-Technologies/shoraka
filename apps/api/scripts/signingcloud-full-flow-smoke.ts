/**
 * SigningCloud sandbox smoke for the production signing sequence:
 * issuer signs manually (FA/DoA include one company-seal field unless
 * SC_ENABLE_SEAL_FIELD=false; designation is printed in the PDF, not a
 * SigningCloud textfield), then CashSouk auto-signs once per automatic
 * signer after those manuals are provider-confirmed.
 *
 * Required:
 *   GOTENBERG_URL
 *   SC_BASE_URL, SC_API_KEY, SC_API_SECRET
 *   SIGNINGCLOUD_SMOKE_SIGNER_EMAIL
 *   SIGNINGCLOUD_SMOKE_AUTO_EMAIL
 *   SIGNINGCLOUD_SMOKE_AUTO_EMAIL_2
 *     or SIGNINGCLOUD_SMOKE_AUTO_EMAILS=a@x,b@x
 *
 * Smoke fixtures stay small enough for two automatic sandbox emails:
 * one issuer/guarantor/assignor block, one witness, both CashSouk
 * representative pairs. Lines are round-robin’d across the email pool.
 *
 * Optional:
 *   SIGNINGCLOUD_SMOKE_DOCS=fa,jsg,doa     default all three
 *   SIGNINGCLOUD_SMOKE_LAYOUT_ONLY=1       render + place fields (no upload)
 *   SIGNINGCLOUD_SMOKE_SKIP_SIGN=1         upload, stamp, write session URLs, exit
 *   SIGNINGCLOUD_SMOKE_CONTINUE=1          resume auto-sign + signed-PDF check
 *   SIGNINGCLOUD_SMOKE_POLL_MS             default 15000
 *   SIGNINGCLOUD_SMOKE_POLL_ATTEMPTS       default 20
 *
 * Does not print secrets, access tokens, or hosted session URLs.
 * Session URLs go under apps/api/tmp/signingcloud-smoke/ (gitignored).
 */
import { config as loadEnv } from "dotenv";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline/promises";
import { stdin as input, stdout as output } from "process";
import { automaticSignerKeywordPair, executionRoleHasSignDate, normalizeSigningEmail, type OperatorDocumentExecutionRole, type OperatorDocumentKind } from "@cashsouk/types";
import PizZip from "pizzip";
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
import {
  buildAutomaticSigningCloudSignsetsFromPdf,
  ensureAutomaticSigningKeywords,
} from "../src/modules/signing/automatic-signing-keywords";
import { extractPdfTextItems } from "../src/modules/applications/joint-several-guarantee/jsg-signing-placement";
import { buildDocumentProviderSigners } from "../src/modules/signing/provider-signers";
import { SigningCloudProvider } from "../src/modules/signing/provider/signingcloud-adapter";
import {
  isSigningCloudSealFieldEnabled,
  readSigningCloudConfigFromEnv,
} from "../src/modules/signingcloud/signingcloud-api";
import { SigningCloudProviderError } from "../src/modules/signingcloud/signingcloud-errors";
import type { ProviderSignerDetail } from "../src/modules/signing/provider/adapter";
import {
  opaqueRgbPng,
  SMOKE_SIGNATURE_HEIGHT_PX,
  SMOKE_SIGNATURE_WIDTH_PX,
  transparentSignaturePng,
} from "./lib/signingcloud-smoke-images";

loadEnv({ path: path.join(__dirname, "../.env.local") });
loadEnv({ path: path.join(__dirname, "../.env") });

const includeSeal = isSigningCloudSealFieldEnabled();
const SMOKE_SEAL_PNG = opaqueRgbPng(200, 200, [120, 24, 28]);
const SMOKE_SIGNATURE_PNG = transparentSignaturePng();

type DocKey = "fa" | "jsg" | "doa";
type SmokeField = { fieldtype?: string };

type AutomaticPlacement = {
  email: string;
  keyword: string;
  dateKeyword?: string;
  slotKey: string;
  roleKey: OperatorDocumentExecutionRole;
  slotIndex: number;
};

type PreparedDoc = {
  key: DocKey;
  label: string;
  pdf: Buffer;
  documentKey: string;
  requiresSeal: boolean;
  manualSignsets: SmokeField[][];
  automaticPlacements: AutomaticPlacement[];
};

type UploadedDoc = PreparedDoc & {
  providerRef: string;
  signingUrl: string;
};

function captureDir(): string {
  const dir = path.join(__dirname, "../tmp/signingcloud-smoke");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function sessionsPath(outDir: string): string {
  return path.join(outDir, "full-flow-sessions.txt");
}

function layoutPath(outDir: string): string {
  return path.join(outDir, "full-flow-layout.json");
}

function parseDocs(): DocKey[] {
  const raw = process.env.SIGNINGCLOUD_SMOKE_DOCS?.trim() || "fa,jsg,doa";
  const keys = raw.split(",").map((part) => part.trim().toLowerCase());
  const allowed: DocKey[] = [];
  for (const key of keys) {
    if (key !== "fa" && key !== "jsg" && key !== "doa") {
      throw new Error(`SIGNINGCLOUD_SMOKE_DOCS expected fa|jsg|doa, got ${key}`);
    }
    if (!allowed.includes(key)) allowed.push(key);
  }
  if (allowed.length === 0) throw new Error("SIGNINGCLOUD_SMOKE_DOCS selected no documents.");
  return allowed;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "(invalid email)";
  return `${local.slice(0, 1)}***@${domain}`;
}

function fieldTypes(signsets: SmokeField[][]): string {
  return signsets
    .map((fields) => fields.map((field) => field.fieldtype ?? "?").join("+"))
    .join(" | ");
}

function assertKeywords(text: string, placements: AutomaticPlacement[], label: string): void {
  const byKeyword = new Map<string, number>();
  for (const placement of placements) {
    byKeyword.set(placement.keyword, (byKeyword.get(placement.keyword) ?? 0) + 1);
    if (!placement.dateKeyword || !executionRoleHasSignDate(placement.roleKey)) continue;
    const dateKey = `${placement.dateKeyword}::date`;
    byKeyword.set(dateKey, (byKeyword.get(dateKey) ?? 0) + 1);
  }
  for (const [key, expected] of byKeyword) {
    const keyword = key.endsWith("::date") ? key.slice(0, -6) : key;
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const count = (text.match(new RegExp(`${escaped}(?![A-Z0-9_])`, "g")) ?? []).length;
    if (count !== expected) {
      throw new Error(`${label}: expected ${expected} ${keyword}, found ${count}`);
    }
  }
}

function logAutomaticPacking(label: string, placements: AutomaticPlacement[]): void {
  const emails = new Set(placements.map((placement) => placement.email));
  const keywords = new Set(
    placements.flatMap((placement) =>
      [placement.keyword, placement.dateKeyword].filter((value): value is string => Boolean(value))
    )
  );
  console.log(`${label}: ${emails.size} automatic signers, ${keywords.size} unique keywords`);
}

function assertSealFieldCount(signsets: SmokeField[][], label: string): void {
  const seals = signsets.flat().filter((field) => field.fieldtype === "seal");
  const expected = includeSeal ? 1 : 0;
  if (seals.length !== expected) {
    throw new Error(`${label}: expected ${expected} company-seal field(s), found ${seals.length}`);
  }
}

const MAX_NUMBERED_AUTO_EMAILS = 8;

function readAutomaticEmailPool(): string[] {
  const listed = (process.env.SIGNINGCLOUD_SMOKE_AUTO_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const numbered: string[] = [];
  const first = process.env.SIGNINGCLOUD_SMOKE_AUTO_EMAIL?.trim();
  if (first) numbered.push(first);
  for (let index = 2; index <= MAX_NUMBERED_AUTO_EMAILS; index += 1) {
    const value = process.env[`SIGNINGCLOUD_SMOKE_AUTO_EMAIL_${index}`]?.trim();
    if (value) numbered.push(value);
  }
  const witness = process.env.SIGNINGCLOUD_SMOKE_WITNESS_EMAIL?.trim();
  const merged: string[] = [];
  const seen = new Set<string>();
  for (const email of [...listed, ...numbered, ...(witness ? [witness] : [])]) {
    const key = normalizeSigningEmail(email);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(email);
  }
  return merged;
}

function placeholderAutoEmails(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `auto${index + 1}@example.invalid`);
}

function assignAutomaticSlotEmails(
  slots: Array<{ roleKey: OperatorDocumentExecutionRole; slotIndex: number }>,
  layoutOnly: boolean
): Array<{ email: string; roleKey: OperatorDocumentExecutionRole; slotIndex: number }> {
  const pool = readAutomaticEmailPool();
  const emails = pool.length > 0 ? pool : layoutOnly ? placeholderAutoEmails(2) : [];
  if (emails.length === 0) {
    throw new Error(
      "Live upload requires SIGNINGCLOUD_SMOKE_AUTO_EMAIL and SIGNINGCLOUD_SMOKE_AUTO_EMAIL_2 (or SIGNINGCLOUD_SMOKE_AUTO_EMAILS)."
    );
  }
  return slots.map((slot, index) => ({
    ...slot,
    email: emails[index % emails.length]!,
  }));
}

function requireDistinctFromManual(manualEmail: string, autos: readonly string[]): void {
  const manual = normalizeSigningEmail(manualEmail);
  if (autos.some((email) => normalizeSigningEmail(email) === manual)) {
    throw new Error("SIGNINGCLOUD_SMOKE_SIGNER_EMAIL cannot also be an automatic signer.");
  }
}

function groupAutomaticPlacements(
  documentKind: OperatorDocumentKind,
  rows: Array<{ email: string; roleKey: OperatorDocumentExecutionRole; slotIndex: number }>
): AutomaticPlacement[] {
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const email = normalizeSigningEmail(row.email);
    const list = groups.get(email) ?? [];
    list.push({ ...row, email });
    groups.set(email, list);
  }
  const placements: AutomaticPlacement[] = [];
  for (const [email, group] of groups) {
    const pair = automaticSignerKeywordPair(documentKind, email, group);
    for (const row of group) {
      placements.push({
        email,
        keyword: pair.signKeyword,
        dateKeyword: pair.dateKeyword,
        slotKey: `${row.roleKey}:${row.slotIndex}`,
        roleKey: row.roleKey,
        slotIndex: row.slotIndex,
      });
    }
  }
  return placements;
}

function ownersFromPlacements(placements: AutomaticPlacement[]) {
  const byKeyword = new Map<
    string,
    {
      signKeyword: string;
      dateKeyword?: string;
      placements: Array<{ roleKey: OperatorDocumentExecutionRole; slotIndex: number }>;
    }
  >();
  for (const placement of placements) {
    const owner = byKeyword.get(placement.keyword) ?? {
      signKeyword: placement.keyword,
      dateKeyword: placement.dateKeyword,
      placements: [],
    };
    owner.placements.push({
      roleKey: placement.roleKey,
      slotIndex: placement.slotIndex,
    });
    byKeyword.set(placement.keyword, owner);
  }
  return [...byKeyword.values()];
}

async function pdfText(pdf: Buffer): Promise<string> {
  return (await extractPdfTextItems(pdf)).map((item) => item.text).join("\n");
}

function automaticRows<T extends SmokeField>(
  label: string,
  placements: AutomaticPlacement[],
  signsetsBySlot: Map<string, T[]>
): Array<{ email: string; executionMode: "AUTOMATIC"; signset: T[] }> {
  const byEmail = new Map<string, T[]>();
  for (const placement of placements) {
    const slotFields = signsetsBySlot.get(placement.slotKey) ?? [];
    if (slotFields.length === 0) {
      throw new Error(`${label}: missing automatic signature box for ${placement.slotKey}`);
    }
    const fields = byEmail.get(placement.email) ?? [];
    fields.push(...slotFields);
    byEmail.set(placement.email, fields);
  }
  return [...byEmail.entries()].map(([email, signset]) => ({
    email,
    executionMode: "AUTOMATIC" as const,
    signset,
  }));
}

async function prepareFa(layoutOnly: boolean): Promise<PreparedDoc> {
  const fixture = createFacilityAgreementFixture();
  fixture.issuer_signatories = fixture.issuer_signatories.slice(0, 1);
  const names = fixture.issuer_signatories.map((row) => row.name);
  const repeats = { issuerSignatoryCount: names.length };
  const slots: Array<{ roleKey: OperatorDocumentExecutionRole; slotIndex: number }> = [
    { roleKey: "FA_INVESTOR", slotIndex: 1 },
    { roleKey: "FA_INVESTOR", slotIndex: 2 },
    { roleKey: "FA_AGENT", slotIndex: 1 },
    { roleKey: "FA_AGENT", slotIndex: 2 },
    { roleKey: "FA_ISSUER_WITNESS", slotIndex: 1 },
  ];
  let pdf = await convertDocxToPdf(renderFacilityAgreementDocx(fixture));
  const automaticPlacements = groupAutomaticPlacements(
    "FA",
    assignAutomaticSlotEmails(slots, layoutOnly)
  );
  pdf = await ensureAutomaticSigningKeywords(
    pdf,
    "facility_agreement",
    repeats,
    ownersFromPlacements(automaticPlacements)
  );
  assertKeywords(await pdfText(pdf), automaticPlacements, "Facility Agreement");
  logAutomaticPacking("Facility Agreement", automaticPlacements);
  const manualSignsets = await buildFaSigningCloudSignsetsFromPdf(
    pdf,
    [{ name: names[0]!, appliesCompanySeal: true }],
    { includeSeal }
  );
  assertSealFieldCount(manualSignsets, "Facility Agreement");
  return {
    key: "fa",
    label: "Facility Agreement",
    pdf,
    documentKey: "facility_agreement",
    requiresSeal: includeSeal,
    manualSignsets,
    automaticPlacements,
  };
}

async function prepareJsg(layoutOnly: boolean): Promise<PreparedDoc> {
  const fixture = createJsgFixture();
  fixture.guarantors_corporate = [];
  fixture.guarantors_individual = fixture.guarantors_individual.slice(0, 1);
  fixture.schedule_guarantors = fixture.schedule_guarantors.slice(0, 1);
  const names = fixture.guarantors_individual.map((row) => row.name).filter(Boolean);
  const repeats = { jsgGuarantorSignatureCount: names.length };
  const slots: Array<{ roleKey: OperatorDocumentExecutionRole; slotIndex: number }> = [
    { roleKey: "JSG_OPERATOR", slotIndex: 1 },
    { roleKey: "JSG_OPERATOR", slotIndex: 2 },
    { roleKey: "JSG_GUARANTOR_WITNESS", slotIndex: 1 },
    { roleKey: "JSG_OPERATOR_WITNESS", slotIndex: 1 },
  ];
  let pdf = await convertDocxToPdf(renderJsgDocx(fixture));
  const automaticPlacements = groupAutomaticPlacements(
    "JSG",
    assignAutomaticSlotEmails(slots, layoutOnly)
  );
  pdf = await ensureAutomaticSigningKeywords(
    pdf,
    "guarantor_agreement",
    repeats,
    ownersFromPlacements(automaticPlacements)
  );
  assertKeywords(await pdfText(pdf), automaticPlacements, "Joint and Several Guarantee");
  logAutomaticPacking("Joint and Several Guarantee", automaticPlacements);
  const manualSignsets = await buildJsgSigningCloudSignsetsFromPdf(pdf, names);
  return {
    key: "jsg",
    label: "Joint and Several Guarantee",
    pdf,
    documentKey: "guarantor_agreement",
    requiresSeal: false,
    manualSignsets,
    automaticPlacements,
  };
}

async function prepareDoa(layoutOnly: boolean): Promise<PreparedDoc> {
  const fixture = createDeedOfAssignmentFixture();
  fixture.assignor_signatories = fixture.assignor_signatories.slice(0, 1);
  const names = fixture.assignor_signatories.map((row) => row.name);
  const repeats = { assignorSignatoryCount: names.length };
  const slots: Array<{ roleKey: OperatorDocumentExecutionRole; slotIndex: number }> = [
    { roleKey: "DOA_SSP", slotIndex: 1 },
    { roleKey: "DOA_SSP", slotIndex: 2 },
    { roleKey: "DOA_ASSIGNOR_WITNESS", slotIndex: 1 },
  ];
  const docx = renderDeedOfAssignmentDocx(fixture, {
    bytes: SMOKE_SEAL_PNG,
    contentType: "image/png",
  });
  const stampPart = new PizZip(docx).file("word/media/ssp-company-stamp.png");
  if (!stampPart) {
    throw new Error("Deed of Assignment: SSP company stamp was not embedded in the DOCX");
  }
  let pdf = await convertDocxToPdf(docx);
  const automaticPlacements = groupAutomaticPlacements(
    "DOA",
    assignAutomaticSlotEmails(slots, layoutOnly)
  );
  pdf = await ensureAutomaticSigningKeywords(
    pdf,
    "deed_of_assignment",
    repeats,
    ownersFromPlacements(automaticPlacements)
  );
  assertKeywords(await pdfText(pdf), automaticPlacements, "Deed of Assignment");
  logAutomaticPacking("Deed of Assignment", automaticPlacements);
  const manualSignsets = await buildDoaSigningCloudSignsetsFromPdf(
    pdf,
    [{ name: names[0]!, appliesCompanySeal: true }],
    { includeSeal }
  );
  assertSealFieldCount(manualSignsets, "Deed of Assignment");
  return {
    key: "doa",
    label: "Deed of Assignment",
    pdf,
    documentKey: "deed_of_assignment",
    requiresSeal: includeSeal,
    manualSignsets,
    automaticPlacements,
  };
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForOperator(): Promise<void> {
  if (!input.isTTY || !output.isTTY) {
    throw new Error(
      "No TTY to wait for issuer signing. Re-run with SIGNINGCLOUD_SMOKE_CONTINUE=1 after signing, or set SIGNINGCLOUD_SMOKE_SKIP_SIGN=1."
    );
  }
  const rl = readline.createInterface({ input, output });
  try {
    await rl.question(
      includeSeal
        ? "Open each full-flow session URL from the gitignored sessions file, sign every issuer/guarantor field (including the seal), then press Enter… "
        : "Open each full-flow session URL from the gitignored sessions file, sign every issuer/guarantor field, then press Enter… "
    );
  } finally {
    rl.close();
  }
}

function isAutoEmail(email: string, autos: readonly string[]): boolean {
  const value = normalizeSigningEmail(email);
  return autos.some((auto) => normalizeSigningEmail(auto) === value);
}

async function pollUntil(
  provider: SigningCloudProvider,
  doc: { label: string; providerRef: string },
  matches: (signers: ProviderSignerDetail[]) => boolean,
  label: string
): Promise<ProviderSignerDetail[]> {
  const pollMs = Number(process.env.SIGNINGCLOUD_SMOKE_POLL_MS ?? 15_000);
  const attempts = Number(process.env.SIGNINGCLOUD_SMOKE_POLL_ATTEMPTS ?? 20);
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const details = await provider.getContractDetails({ providerRef: doc.providerRef });
    console.log(
      `${doc.label} ${label} ${attempt}/${attempts}: ${details.signers.map((signer) => `${maskEmail(signer.email)}=${signer.status}`).join(", ") || "none"}`
    );
    if (details.signers.length > 0 && matches(details.signers)) return details.signers;
    if (attempt < attempts) await sleep(Number.isFinite(pollMs) ? pollMs : 15_000);
  }
  throw new Error(`${doc.label} did not reach ${label}`);
}

async function autoSignDoc(
  provider: SigningCloudProvider,
  doc: { label: string; providerRef: string; automaticPlacements: AutomaticPlacement[] }
): Promise<void> {
  const seen = new Set<string>();
  for (const placement of doc.automaticPlacements) {
    const email = normalizeSigningEmail(placement.email);
    if (seen.has(email)) continue;
    seen.add(email);
    const result = await provider.autoSign({
      providerRef: doc.providerRef,
      signerEmail: placement.email,
      keyword: placement.keyword,
      dateKeyword: placement.dateKeyword,
      dateFormat: placement.dateKeyword ? "dd/MM/yyyy" : undefined,
      signatureImageBytes: SMOKE_SIGNATURE_PNG,
      widthPx: SMOKE_SIGNATURE_WIDTH_PX,
      heightPx: SMOKE_SIGNATURE_HEIGHT_PX,
    });
    console.log(
      result.alreadySigned
        ? `${doc.label}: ${placement.keyword} already signed`
        : `${doc.label}: auto-signed ${placement.keyword}${placement.dateKeyword ? ` + ${placement.dateKeyword}` : ""}`
    );
  }
}

async function fetchSignedPdf(
  provider: SigningCloudProvider,
  doc: { key: DocKey; label: string; providerRef: string },
  outDir: string
): Promise<void> {
  const file = await provider.fetchSignedDocument({ providerRef: doc.providerRef });
  if (!file.pdfBuffer.slice(0, 5).equals(Buffer.from("%PDF-"))) {
    throw new Error(`${doc.label} signed file is not a PDF`);
  }
  const sha256 = crypto.createHash("sha256").update(file.pdfBuffer).digest("hex");
  if (sha256 !== file.sha256) throw new Error(`${doc.label} SHA-256 mismatch`);
  const pdfPath = path.join(outDir, `full-flow-${doc.key}-signed.pdf`);
  fs.writeFileSync(pdfPath, file.pdfBuffer);
  console.log(
    `${doc.label}: signed PDF ${file.pdfBuffer.length} bytes sha256=${sha256} file=${path.basename(pdfPath)}`
  );
}

function writeState(docs: UploadedDoc[], outDir: string): void {
  const sessions = docs
    .map((doc) => `${doc.key}\t${doc.label}\t${doc.providerRef}\t${doc.signingUrl}`)
    .join("\n");
  fs.writeFileSync(sessionsPath(outDir), `${sessions}\n`);
  fs.writeFileSync(
    layoutPath(outDir),
    `${JSON.stringify(
      docs.map((doc) => ({
        key: doc.key,
        label: doc.label,
        providerRef: doc.providerRef,
        requiresSeal: doc.requiresSeal,
        manualFields: fieldTypes(doc.manualSignsets),
        automaticPlacements: doc.automaticPlacements,
      })),
      null,
      2
    )}\n`
  );
  console.log(
    `Hosted session URLs written to ${path.relative(path.join(__dirname, ".."), sessionsPath(outDir))} (gitignored; do not commit)`
  );
}

function readSavedDocs(outDir: string): Array<Pick<UploadedDoc, "key" | "label" | "providerRef" | "automaticPlacements">> {
  const layoutFile = layoutPath(outDir);
  if (!fs.existsSync(layoutFile)) {
    throw new Error("No saved full-flow layout. Run the smoke upload first.");
  }
  const parsed = JSON.parse(fs.readFileSync(layoutFile, "utf8")) as Array<{
    key: DocKey;
    label: string;
    providerRef: string;
    automaticPlacements: AutomaticPlacement[];
  }>;
  if (parsed.length === 0) throw new Error("Saved full-flow layout is empty.");
  return parsed;
}

async function completeAfterManuals(
  provider: SigningCloudProvider,
  docs: Array<{
    key: DocKey;
    label: string;
    providerRef: string;
    automaticPlacements: AutomaticPlacement[];
  }>,
  outDir: string
): Promise<void> {
  for (const doc of docs) {
    const autos = doc.automaticPlacements.map((placement) => placement.email);
    await pollUntil(
      provider,
      doc,
      (signers) =>
        signers
          .filter((signer) => !isAutoEmail(signer.email, autos))
          .every((signer) => signer.status === "SIGNED"),
      "manual"
    );
    await autoSignDoc(provider, doc);
    await pollUntil(
      provider,
      doc,
      (signers) => signers.length > 0 && signers.every((signer) => signer.status === "SIGNED"),
      "complete"
    );
    await fetchSignedPdf(provider, doc, outDir);
  }
}

function repeatsFromPlacements(placements: AutomaticPlacement[]) {
  const count = (role: string) =>
    placements.filter((placement) => placement.slotKey.startsWith(`${role}:`)).length;
  return {
    issuerSignatoryCount: count("FA_ISSUER_WITNESS") || undefined,
    jsgGuarantorSignatureCount: count("JSG_GUARANTOR_WITNESS") || undefined,
    assignorSignatoryCount: count("DOA_ASSIGNOR_WITNESS") || undefined,
  };
}

async function uploadDoc(
  provider: SigningCloudProvider,
  doc: PreparedDoc,
  manualEmail: string
): Promise<UploadedDoc> {
  const automaticBySlot = await buildAutomaticSigningCloudSignsetsFromPdf(
    doc.pdf,
    doc.documentKey,
    repeatsFromPlacements(doc.automaticPlacements)
  );
  const signers = [
    ...buildDocumentProviderSigners(
      doc.manualSignsets.map((signset) => ({ email: manualEmail, signset }))
    ),
    ...buildDocumentProviderSigners(
      automaticRows(doc.label, doc.automaticPlacements, automaticBySlot)
    ),
  ];
  const automaticCount = signers.filter((signer) => signer.executionMode === "AUTOMATIC").length;
  if (automaticCount < 2) {
    throw new Error(`${doc.label}: expected at least two automatic recipients, got ${automaticCount}`);
  }
  console.log(`${doc.label}: creating SigningCloud contract (${signers.length} signers)`);
  const { providerRef } = await provider.createDocumentContract({
    pdfBuffer: doc.pdf,
    contractName: `CashSouk full-flow smoke ${new Date().toISOString()} — ${doc.label}`,
    signers,
  });
  if (doc.requiresSeal) {
    console.log(`${doc.label}: uploading company seal (200×200 PNG)`);
    await provider.uploadSignerStamp({
      signerEmail: manualEmail,
      imageBytes: SMOKE_SEAL_PNG,
      contentType: "image/png",
    });
    console.log(`${doc.label}: uploaded company seal for ${maskEmail(manualEmail)}`);
  }
  const session = await provider.startSignerSession({
    providerRef,
    signerEmail: manualEmail,
  });
  console.log(
    `${doc.label}: manual ${fieldTypes(doc.manualSignsets)}; automatic ${[...new Set(doc.automaticPlacements.map((row) => row.keyword))].join(", ")}`
  );
  return { ...doc, providerRef, signingUrl: session.signingUrl };
}

async function main(): Promise<void> {
  const layoutOnly = process.env.SIGNINGCLOUD_SMOKE_LAYOUT_ONLY === "1";
  const skipSign = process.env.SIGNINGCLOUD_SMOKE_SKIP_SIGN === "1";
  const resume = process.env.SIGNINGCLOUD_SMOKE_CONTINUE === "1";
  const selected = parseDocs();
  const outDir = captureDir();
  const manualEmail = process.env.SIGNINGCLOUD_SMOKE_SIGNER_EMAIL?.trim() ?? "";
  const autoPool = readAutomaticEmailPool();

  if (resume) {
    if (!readSigningCloudConfigFromEnv()) {
      throw new Error("SigningCloud is not configured (SC_BASE_URL, SC_API_KEY, SC_API_SECRET)");
    }
    const saved = readSavedDocs(outDir);
    await completeAfterManuals(new SigningCloudProvider(), saved, outDir);
    console.log(
      includeSeal
        ? "Full-flow smoke complete: manuals signed, company seal applied, CashSouk auto-signed."
        : "Full-flow smoke complete: manuals signed, CashSouk auto-signed."
    );
    return;
  }

  if (!resolveGotenbergUrl()) {
    throw new Error("GOTENBERG_URL is required");
  }
  if (!layoutOnly && !readSigningCloudConfigFromEnv()) {
    throw new Error("SigningCloud is not configured (SC_BASE_URL, SC_API_KEY, SC_API_SECRET)");
  }
  if (!layoutOnly) {
    if (!manualEmail) {
      throw new Error("Live upload requires SIGNINGCLOUD_SMOKE_SIGNER_EMAIL.");
    }
    if (autoPool.length < 2) {
      throw new Error(
        "Live upload requires two automatic sandbox emails (SIGNINGCLOUD_SMOKE_AUTO_EMAIL and SIGNINGCLOUD_SMOKE_AUTO_EMAIL_2, or SIGNINGCLOUD_SMOKE_AUTO_EMAILS)."
      );
    }
    requireDistinctFromManual(manualEmail, autoPool);
  }

  const prepared: PreparedDoc[] = [];
  for (const key of selected) {
    if (key === "fa") prepared.push(await prepareFa(layoutOnly));
    if (key === "jsg") prepared.push(await prepareJsg(layoutOnly));
    if (key === "doa") prepared.push(await prepareDoa(layoutOnly));
  }
  for (const doc of prepared) {
    console.log(`${doc.label} layout: ${fieldTypes(doc.manualSignsets)}`);
  }
  if (layoutOnly) {
    for (const doc of prepared) {
      const pdfPath = path.join(outDir, `full-flow-${doc.key}-layout.pdf`);
      fs.writeFileSync(pdfPath, doc.pdf);
      console.log(`${doc.label}: layout PDF ${doc.pdf.length} bytes file=${path.basename(pdfPath)}`);
    }
    console.log("Layout-only full-flow smoke complete (no SigningCloud upload).");
    return;
  }

  const provider = new SigningCloudProvider();
  const uploaded: UploadedDoc[] = [];
  for (const doc of prepared) {
    try {
      uploaded.push(await uploadDoc(provider, doc, manualEmail));
    } catch (error) {
      throw new Error(`${doc.label}: ${formatSmokeError(error)}`);
    }
  }
  writeState(uploaded, outDir);

  if (skipSign) {
    console.log(
      "Skipping wait/auto-sign (SIGNINGCLOUD_SMOKE_SKIP_SIGN=1). Sign the issuer fields, then re-run with SIGNINGCLOUD_SMOKE_CONTINUE=1."
    );
    return;
  }

  await waitForOperator();
  await completeAfterManuals(provider, uploaded, outDir);
  console.log(
    includeSeal
      ? "Full-flow smoke complete: manuals signed, company seal applied, CashSouk auto-signed."
      : "Full-flow smoke complete: manuals signed, CashSouk auto-signed."
  );
}

function formatSmokeError(error: unknown): string {
  if (error instanceof SigningCloudProviderError) {
    const result = error.result == null ? "" : ` result=${error.result}`;
    const hint =
      error.result === 126
        ? " One signer has too many sign/date/seal keywords. Re-upload; CONTINUE cannot fix an already stacked contract."
        : "";
    return `SigningCloud ${error.code}${result}: ${error.message}${hint}`;
  }
  if (error instanceof Error) return error.message;
  return String(error);
}

main().catch((error) => {
  console.error(formatSmokeError(error));
  process.exitCode = 1;
});
