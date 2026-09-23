import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import {
  automaticSignerKeywordPair,
  documentExecutionSlotsForPackageKey,
  executionRoleHasSignDate,
  normalizeSigningEmail,
  type DocumentExecutionRepeatCounts,
  type OperatorDocumentExecutionRole,
  type OperatorDocumentKind,
} from "@cashsouk/types";
import { extractPdfTextItems } from "../../src/modules/applications/joint-several-guarantee/jsg-signing-placement";
import type { ProviderSignerDetail } from "../../src/modules/signing/provider/adapter";
import { SigningCloudProvider } from "../../src/modules/signing/provider/signingcloud-adapter";
import {
  SMOKE_SIGNATURE_HEIGHT_PX,
  SMOKE_SIGNATURE_WIDTH_PX,
  transparentSignaturePng,
} from "./signingcloud-smoke-images";

export type AutomaticPlacement = {
  email: string;
  keyword: string;
  dateKeyword?: string;
  slotKey: string;
  roleKey: OperatorDocumentExecutionRole;
  slotIndex: number;
};

export type AutomaticSmokeDoc = {
  key: string;
  label: string;
  providerRef: string;
  automaticPlacements: AutomaticPlacement[];
};

const MAX_NUMBERED_AUTO_EMAILS = 8;
const SMOKE_SIGNATURE_PNG = transparentSignaturePng();

export function maskSmokeEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "(invalid email)";
  return `${local.slice(0, 1)}***@${domain}`;
}

export function readAutomaticEmailPool(): string[] {
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

export function requireDistinctFromManual(manualEmail: string, autos: readonly string[]): void {
  const manual = normalizeSigningEmail(manualEmail);
  if (autos.some((email) => normalizeSigningEmail(email) === manual)) {
    throw new Error("SIGNINGCLOUD_SMOKE_SIGNER_EMAIL cannot also be an automatic signer.");
  }
}

function placeholderAutoEmails(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `auto${index + 1}@example.invalid`);
}

export function assignAutomaticSlotEmails(
  slots: Array<{ roleKey: OperatorDocumentExecutionRole; slotIndex: number }>,
  layoutOnly: boolean
): Array<{ email: string; roleKey: OperatorDocumentExecutionRole; slotIndex: number }> {
  const pool = readAutomaticEmailPool();
  const emails = pool.length > 0 ? pool : layoutOnly ? placeholderAutoEmails(2) : [];
  if (emails.length === 0) {
    throw new Error(
      "Live auto-sign requires SIGNINGCLOUD_SMOKE_AUTO_EMAIL and SIGNINGCLOUD_SMOKE_AUTO_EMAIL_2 (or SIGNINGCLOUD_SMOKE_AUTO_EMAILS)."
    );
  }
  if (!layoutOnly && emails.length < 2) {
    throw new Error(
      "Live auto-sign requires two automatic sandbox emails (SIGNINGCLOUD_SMOKE_AUTO_EMAIL and SIGNINGCLOUD_SMOKE_AUTO_EMAIL_2, or SIGNINGCLOUD_SMOKE_AUTO_EMAILS)."
    );
  }
  return slots.map((slot, index) => ({
    ...slot,
    email: emails[index % emails.length]!,
  }));
}

export function groupAutomaticPlacements(
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

export function ownersFromPlacements(placements: AutomaticPlacement[]) {
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

export function slotsForDocument(
  documentKey: string,
  repeats?: DocumentExecutionRepeatCounts | null
): Array<{ roleKey: OperatorDocumentExecutionRole; slotIndex: number }> {
  return documentExecutionSlotsForPackageKey(documentKey, repeats);
}

export function repeatsFromPlacements(placements: AutomaticPlacement[]) {
  const count = (role: string) =>
    placements.filter((placement) => placement.slotKey.startsWith(`${role}:`)).length;
  return {
    issuerSignatoryCount: count("FA_ISSUER_WITNESS") || undefined,
    jsgGuarantorSignatureCount: count("JSG_GUARANTOR_WITNESS") || undefined,
    assignorSignatoryCount: count("DOA_ASSIGNOR_WITNESS") || undefined,
  };
}

export function automaticRows<T>(
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

export async function pdfText(pdf: Buffer): Promise<string> {
  return (await extractPdfTextItems(pdf)).map((item) => item.text).join("\n");
}

export function assertKeywords(text: string, placements: AutomaticPlacement[], label: string): void {
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

function isAutoEmail(email: string, autos: readonly string[]): boolean {
  const value = normalizeSigningEmail(email);
  return autos.some((auto) => normalizeSigningEmail(auto) === value);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function pollUntil(
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
      `${doc.label} ${label} ${attempt}/${attempts}: ${details.signers.map((signer) => `${maskSmokeEmail(signer.email)}=${signer.status}`).join(", ") || "none"}`
    );
    if (details.signers.length > 0 && matches(details.signers)) return details.signers;
    if (attempt < attempts) await sleep(Number.isFinite(pollMs) ? pollMs : 15_000);
  }
  throw new Error(`${doc.label} did not reach ${label}`);
}

export async function autoSignDoc(
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
  doc: { key: string; label: string; providerRef: string },
  outDir: string,
  filePrefix: string
): Promise<void> {
  const file = await provider.fetchSignedDocument({ providerRef: doc.providerRef });
  if (!file.pdfBuffer.slice(0, 5).equals(Buffer.from("%PDF-"))) {
    throw new Error(`${doc.label} signed file is not a PDF`);
  }
  const sha256 = crypto.createHash("sha256").update(file.pdfBuffer).digest("hex");
  if (sha256 !== file.sha256) throw new Error(`${doc.label} SHA-256 mismatch`);
  const pdfPath = path.join(outDir, `${filePrefix}-${doc.key}-signed.pdf`);
  fs.writeFileSync(pdfPath, file.pdfBuffer);
  console.log(
    `${doc.label}: signed PDF ${file.pdfBuffer.length} bytes sha256=${sha256} file=${path.basename(pdfPath)}`
  );
}

export function readSavedAutomaticDocs(
  layoutFile: string,
  missingMessage: string
): AutomaticSmokeDoc[] {
  if (!fs.existsSync(layoutFile)) {
    throw new Error(missingMessage);
  }
  const parsed = JSON.parse(fs.readFileSync(layoutFile, "utf8")) as Array<{
    key?: string;
    label?: string;
    providerRef?: string | null;
    automaticPlacements?: AutomaticPlacement[];
  }>;
  const docs = parsed.filter(
    (row): row is {
      key: string;
      label: string;
      providerRef: string;
      automaticPlacements?: AutomaticPlacement[];
    } => Boolean(row.key && row.label && row.providerRef)
  );
  if (docs.length === 0) {
    throw new Error("Saved layout has no uploaded provider refs.");
  }
  return docs.map((row) => ({
    key: row.key,
    label: row.label,
    providerRef: row.providerRef,
    automaticPlacements: row.automaticPlacements ?? [],
  }));
}

export async function completeAfterManuals(
  provider: SigningCloudProvider,
  docs: AutomaticSmokeDoc[],
  outDir: string,
  filePrefix: string
): Promise<void> {
  for (const doc of docs) {
    if (doc.automaticPlacements.length === 0) {
      throw new Error(
        `${doc.label} has no automatic placements. Re-run wrap-smoke with SIGNINGCLOUD_SMOKE_AUTO_EMAIL and SIGNINGCLOUD_SMOKE_AUTO_EMAIL_2 so CashSouk keywords are stamped, then sign the issuer fields, then auto-sign.`
      );
    }
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
    await fetchSignedPdf(provider, doc, outDir, filePrefix);
  }
}
