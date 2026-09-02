/**
 * Convert a filled .docx to PDF via Gotenberg
 * (`GOTENBERG_URL` → POST /forms/libreoffice/convert).
 *
 * Shared by Letter of Offer, generated documents, the Islamic
 * Investment Note Certificate, and the Settlement & Hibah Receipt.
 * Callers must not put route suffixes in GOTENBERG_URL.
 */

const CONVERT_TIMEOUT_MS = 90_000;
const DEFAULT_UPLOAD_NAME = "letter-of-offer.docx";

export class DocxToPdfError extends Error {
  constructor(
    message: string,
    readonly code: "GOTENBERG_MISSING" | "GOTENBERG_UNAVAILABLE" | "CONVERSION_FAILED" =
      "CONVERSION_FAILED"
  ) {
    super(message);
    this.name = "DocxToPdfError";
  }
}

/** Base URL for Gotenberg when configured (no trailing slash). */
export function resolveGotenbergUrl(): string | null {
  const raw = process.env.GOTENBERG_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}

export type ConvertDocxToPdfOptions = {
  /** Upload filename sent to Gotenberg. Must be .docx; default preserves LO. */
  fileName?: string;
};

function uploadFileName(fileName?: string): string {
  const raw = fileName?.trim() || DEFAULT_UPLOAD_NAME;
  return raw.toLowerCase().endsWith(".docx") ? raw : `${raw}.docx`;
}

/**
 * Convert a .docx buffer to PDF using Gotenberg LibreOffice.
 * Requires `GOTENBERG_URL` (e.g. http://127.0.0.1:3100).
 */
export async function convertDocxToPdf(
  docxBuffer: Buffer,
  options?: ConvertDocxToPdfOptions
): Promise<Buffer> {
  const gotenbergUrl = resolveGotenbergUrl();
  if (!gotenbergUrl) {
    throw new DocxToPdfError(
      "PDF export requires Gotenberg. Set GOTENBERG_URL (e.g. http://127.0.0.1:3100) and run: docker compose -f docker-compose.gotenberg.yml up -d",
      "GOTENBERG_MISSING"
    );
  }

  const form = new FormData();
  form.append(
    "files",
    new Blob([docxBuffer], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }),
    uploadFileName(options?.fileName)
  );

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONVERT_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${gotenbergUrl}/forms/libreoffice/convert`, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("abort")) {
      throw new DocxToPdfError(
        `Gotenberg PDF conversion timed out after ${CONVERT_TIMEOUT_MS / 1000}s`
      );
    }
    throw new DocxToPdfError(
      `Gotenberg unreachable at ${gotenbergUrl}: ${message}. Is the container running?`,
      "GOTENBERG_UNAVAILABLE"
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const detail = (await response.text()).trim().slice(0, 500);
    throw new DocxToPdfError(
      `Gotenberg returned ${response.status}${detail ? `: ${detail}` : ""}`,
      response.status >= 500 ? "GOTENBERG_UNAVAILABLE" : "CONVERSION_FAILED"
    );
  }

  const pdf = Buffer.from(await response.arrayBuffer());
  if (pdf.length < 5 || pdf.subarray(0, 4).toString("ascii") !== "%PDF") {
    throw new DocxToPdfError("Gotenberg response was not a PDF");
  }
  return pdf;
}
