/**
 * Convert an HTML document to PDF via Gotenberg Chromium
 * (`GOTENBERG_URL` → POST /forms/chromium/convert/html).
 * Timeout and missing-service errors follow convert-docx-to-pdf.ts.
 */

const CONVERT_TIMEOUT_MS = 90_000;

export class HtmlToPdfError extends Error {
  constructor(
    message: string,
    readonly code: "GOTENBERG_MISSING" | "GOTENBERG_UNAVAILABLE" | "CONVERSION_FAILED" =
      "CONVERSION_FAILED"
  ) {
    super(message);
    this.name = "HtmlToPdfError";
  }
}

/** Base URL for Gotenberg when configured (no trailing slash). */
export function resolveGotenbergUrl(): string | null {
  const raw = process.env.GOTENBERG_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}

/**
 * Convert a complete HTML document string to PDF using Gotenberg Chromium.
 * Requires `GOTENBERG_URL` (e.g. http://127.0.0.1:3100).
 */
export async function convertHtmlToPdf(html: string): Promise<Buffer> {
  const gotenbergUrl = resolveGotenbergUrl();
  if (!gotenbergUrl) {
    throw new HtmlToPdfError(
      "PDF export requires Gotenberg. Set GOTENBERG_URL (e.g. http://127.0.0.1:3100) and run: docker compose -f docker-compose.gotenberg.yml up -d",
      "GOTENBERG_MISSING"
    );
  }

  const form = new FormData();
  form.append(
    "files",
    new Blob([html], { type: "text/html" }),
    "index.html"
  );
  form.append("paperWidth", "8.27");
  form.append("paperHeight", "11.7");
  form.append("marginTop", "0.4");
  form.append("marginBottom", "0.4");
  form.append("marginLeft", "0.4");
  form.append("marginRight", "0.4");
  form.append("printBackground", "true");
  form.append("preferCssPageSize", "true");
  form.append("scale", "1");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONVERT_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${gotenbergUrl}/forms/chromium/convert/html`, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("abort")) {
      throw new HtmlToPdfError(
        `Gotenberg PDF conversion timed out after ${CONVERT_TIMEOUT_MS / 1000}s`
      );
    }
    throw new HtmlToPdfError(
      `Gotenberg unreachable at ${gotenbergUrl}: ${message}. Is the container running?`,
      "GOTENBERG_UNAVAILABLE"
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const detail = (await response.text()).trim().slice(0, 500);
    throw new HtmlToPdfError(
      `Gotenberg returned ${response.status}${detail ? `: ${detail}` : ""}`,
      response.status >= 500 ? "GOTENBERG_UNAVAILABLE" : "CONVERSION_FAILED"
    );
  }

  const pdf = Buffer.from(await response.arrayBuffer());
  if (pdf.length < 5 || pdf.subarray(0, 4).toString("ascii") !== "%PDF") {
    throw new HtmlToPdfError("Gotenberg response was not a PDF");
  }
  return pdf;
}
