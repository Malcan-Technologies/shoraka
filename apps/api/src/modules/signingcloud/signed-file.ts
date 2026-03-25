/**
 * Extract signed PDF bytes from SigningCloud `/contract/file` decrypted JSON.
 */

import { logger } from "../../lib/logger";

function looksLikePdf(buf: Buffer): boolean {
  return buf.length >= 5 && buf.slice(0, 5).toString() === "%PDF-";
}

function tryDecodeBase64(value: string): Buffer | null {
  try {
    const buf = Buffer.from(value.trim(), "base64");
    if (buf.length > 200 && looksLikePdf(buf)) return buf;
  } catch {
    /* ignore */
  }
  return null;
}

function findPdfInObject(obj: Record<string, unknown>, depth = 0): Buffer | null {
  if (depth > 4) return null;
  const keys = ["file", "filedata", "pdf", "content", "filecontent", "base64", "data"];
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.length > 200) {
      const decoded = tryDecodeBase64(v);
      if (decoded) return decoded;
    }
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const inner = findPdfInObject(v as Record<string, unknown>, depth + 1);
      if (inner) return inner;
    }
  }
  return null;
}

export function extractSignedPdfBufferFromFileResponse(decrypted: Record<string, unknown>): Buffer | null {
  const direct = findPdfInObject(decrypted);
  if (direct) return direct;

  const nested = decrypted.data;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const inner = findPdfInObject(nested as Record<string, unknown>);
    if (inner) return inner;
  }

  return null;
}

export async function fetchPdfIfUrl(maybeUrl: unknown): Promise<Buffer | null> {
  if (typeof maybeUrl !== "string" || !maybeUrl.startsWith("http")) return null;
  try {
    const res = await fetch(maybeUrl);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (looksLikePdf(buf)) return buf;
  } catch (e) {
    logger.warn({ err: e }, "Failed to fetch PDF from URL in SigningCloud file response");
  }
  return null;
}
