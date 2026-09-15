import * as fs from "node:fs";
import * as path from "node:path";

const CURLEC_API_BASE = "https://api.razorpay.com";

export interface CurlecConfig {
  keyId: string;
  keySecret: string;
}

export function requireCurlecConfig(): CurlecConfig {
  const keyId = process.env.CURLEC_KEY_ID?.trim() ?? "";
  const keySecret = process.env.CURLEC_KEY_SECRET?.trim() ?? "";

  if (!keyId || !keySecret) {
    throw new Error(
      "Missing Curlec credentials. Set CURLEC_KEY_ID and CURLEC_KEY_SECRET in apps/api/.env"
    );
  }

  return { keyId, keySecret };
}

function basicAuthHeader(config: CurlecConfig): string {
  return `Basic ${Buffer.from(`${config.keyId}:${config.keySecret}`).toString("base64")}`;
}

export interface CurlecRequestOptions {
  /** Short label for console sections, e.g. "create-order" */
  label: string;
  /** Optional filename under output/, e.g. "01-order.json" */
  saveAs?: string;
}

/** Minimal Curlec REST helper for sandbox spikes — not production code. */
export async function curlecRequest<T = unknown>(
  method: "GET" | "POST",
  apiPath: string,
  options: CurlecRequestOptions,
  body?: Record<string, unknown>
): Promise<T> {
  const config = requireCurlecConfig();
  const url = `${CURLEC_API_BASE}${apiPath}`;

  console.log(`\n=== ${options.label} — request ===`);
  console.log(`${method} ${url}`);
  if (body) {
    console.log(JSON.stringify(body, null, 2));
  }

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: basicAuthHeader(config),
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }

  console.log(`\n=== ${options.label} — response (${response.status}) ===`);
  console.log(typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2));

  if (!response.ok) {
    throw new Error(`${options.label} failed with HTTP ${response.status}`);
  }

  if (options.saveAs) {
    const outDir = path.resolve(__dirname, "..", "output");
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, options.saveAs);
    fs.writeFileSync(outPath, JSON.stringify(parsed, null, 2) + "\n", "utf8");
    console.log(`\nSaved → ${outPath}`);
  }

  return parsed as T;
}

/** Walk JSON and print paths whose keys look name-related (H1 inspection aid). */
export function printNameLikeFields(value: unknown, prefix = ""): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => printNameLikeFields(item, `${prefix}[${index}]`));
    return;
  }

  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      const pathKey = prefix ? `${prefix}.${key}` : key;
      if (/name|buyer|holder|account|fpx|acquirer|customer/i.test(key)) {
        console.log(`  ${pathKey}: ${JSON.stringify(nested)}`);
      }
      printNameLikeFields(nested, pathKey);
    }
  }
}
