/**
 * Extract signed PDF bytes from SigningCloud `/contract/file` decrypted JSON.
 * SignServer documents `pdfdata` as a hexadecimal string (PDF bytes). We decode that first,
 * then fall back to deep-scan for base64-embedded PDFs and https URLs for other tenants.
 */

import { logger } from "../../lib/logger";

/** Minimum decoded size to treat as a real PDF (avoids false positives on short random base64). */
export const MIN_SIGNED_PDF_BYTES = 100;

const MAX_OBJECT_DEPTH = 14;
const MIN_BASE64_CHARS = 32;
/** Hex encodes two nybbles per byte; below this we skip hex decode attempts. */
const MIN_HEX_CHARS_FOR_PDF = MIN_SIGNED_PDF_BYTES * 2;

function looksLikePdf(buf: Buffer): boolean {
  return buf.length >= 5 && buf.slice(0, 5).toString() === "%PDF-";
}

/**
 * SignServer API: `pdfdata` is the PDF file as a hexadecimal string.
 */
export function tryDecodeHexStringToPdf(s: string): Buffer | null {
  const t = s.trim().replace(/^0x/i, "").replace(/\s+/g, "");
  if (t.length < MIN_HEX_CHARS_FOR_PDF || t.length % 2 !== 0) return null;
  if (!/^[0-9a-fA-F]+$/.test(t)) return null;
  try {
    const buf = Buffer.from(t, "hex");
    if (buf.length >= MIN_SIGNED_PDF_BYTES && looksLikePdf(buf)) {
      return buf;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function tryDecodeBase64StringToPdf(s: string): Buffer | null {
  const t = s.trim();
  if (t.length < MIN_BASE64_CHARS) return null;
  const variants = [t, t.replace(/-/g, "+").replace(/_/g, "/")];
  for (const v of variants) {
    try {
      const buf = Buffer.from(v, "base64");
      if (buf.length >= MIN_SIGNED_PDF_BYTES && looksLikePdf(buf)) {
        return buf;
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

function tryDecodeStringToEmbeddedPdf(s: string): Buffer | null {
  return tryDecodeHexStringToPdf(s) ?? tryDecodeBase64StringToPdf(s);
}

/**
 * Recursively find any string that decodes (hex per docs, else base64) to a PDF.
 */
function deepFindPdfBuffer(value: unknown, depth: number): Buffer | null {
  if (depth > MAX_OBJECT_DEPTH) return null;

  if (typeof value === "string") {
    return tryDecodeStringToEmbeddedPdf(value);
  }

  if (!value || typeof value !== "object") return null;

  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = deepFindPdfBuffer(item, depth + 1);
      if (hit) return hit;
    }
    return null;
  }

  const o = value as Record<string, unknown>;
  for (const k of Object.keys(o)) {
    const hit = deepFindPdfBuffer(o[k], depth + 1);
    if (hit) return hit;
  }
  return null;
}

export function extractSignedPdfBufferFromFileResponse(decrypted: Record<string, unknown>): Buffer | null {
  const pdfdata = decrypted.pdfdata ?? decrypted.PdfData;
  if (typeof pdfdata === "string") {
    const fromHex = tryDecodeHexStringToPdf(pdfdata);
    if (fromHex) return fromHex;
  }
  return deepFindPdfBuffer(decrypted, 0);
}

function collectHttpsUrls(value: unknown, depth: number, out: string[]): void {
  if (depth > MAX_OBJECT_DEPTH) return;
  if (typeof value === "string") {
    const s = value.trim();
    if (s.startsWith("http://") || s.startsWith("https://")) {
      out.push(s);
    }
    return;
  }
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) {
      collectHttpsUrls(item, depth + 1, out);
    }
    return;
  }
  for (const v of Object.values(value)) {
    collectHttpsUrls(v, depth + 1, out);
  }
}

export async function fetchPdfIfUrl(maybeUrl: unknown): Promise<Buffer | null> {
  if (typeof maybeUrl !== "string" || !maybeUrl.trim()) return null;
  const u = maybeUrl.trim();
  if (!u.startsWith("http://") && !u.startsWith("https://")) return null;
  try {
    const res = await fetch(u);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length >= MIN_SIGNED_PDF_BYTES && looksLikePdf(buf)) return buf;
  } catch (e) {
    logger.warn({ err: e }, "Failed to fetch PDF from URL in SigningCloud file response");
  }
  return null;
}

/**
 * Resolve signed PDF from `/contract/file` JSON: `pdfdata` hex (documented), then embedded strings, then https URLs.
 */
export async function resolveSignedPdfFromContractFileResponse(
  fileData: Record<string, unknown>
): Promise<Buffer | null> {
  const embedded = extractSignedPdfBufferFromFileResponse(fileData);
  if (embedded && embedded.length >= MIN_SIGNED_PDF_BYTES) {
    return embedded;
  }

  const urls: string[] = [];
  collectHttpsUrls(fileData, 0, urls);
  const seen = new Set<string>();
  for (const raw of urls) {
    if (seen.has(raw)) continue;
    seen.add(raw);
    const buf = await fetchPdfIfUrl(raw);
    if (buf) return buf;
  }
  return null;
}
