/**
 * Low-level SigningCloud SignServer HTTP calls (token, upload, manual signing, detail, file).
 */

import * as crypto from "crypto";
import { Readable } from "stream";
import {
  decryptSigningCloudResponse,
  encryptPayload,
  assertSigningCloudSuccess,
  type SigningCloudEncryptedResponse,
} from "../../lib/signingcloud/crypto";
import { logger } from "../../lib/logger";

const PDF_PAGE_HEIGHT_PT = 841.89;

/** Signature rectangle — matches offer-letter-pdf “Please sign below:” band (contract + invoice). */
const SIGNATURE_FIELD = {
  fieldtype: "sign",
  top: 270,
  left: 50,
  height: 30,
  width: 100,
  pageindex: 1,
} as const;

export interface SigningCloudEnvConfig {
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
}

/**
 * Resolve config from env. Callers must validate availability before user-facing flows.
 */
export function readSigningCloudConfigFromEnv(): SigningCloudEnvConfig | null {
  const baseUrl = process.env.SC_BASE_URL?.trim();
  const apiKey = process.env.SC_API_KEY?.trim();
  const apiSecret = process.env.SC_API_SECRET?.trim();
  if (!baseUrl || !apiKey || !apiSecret) return null;
  return { baseUrl, apiKey, apiSecret };
}

function buildSignsetJsonString(): string {
  return JSON.stringify([SIGNATURE_FIELD]);
}

/**
 * SigningCloud returns "Invalid back URL" for many http URLs (e.g. localhost) in staging/production.
 * Default: only send `backUrl` when the URL is https. Set SIGNINGCLOUD_ALLOW_HTTP_BACK_URL=true to pass
 * http through if your tenant allows it.
 */
export function sanitizeSigningCloudBackUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const trimmed = url.trim();
  try {
    const u = new URL(trimmed);
    const allowHttp = process.env.SIGNINGCLOUD_ALLOW_HTTP_BACK_URL === "true";
    if (u.protocol === "https:") return u.toString();
    if (u.protocol === "http:" && allowHttp) return u.toString();
  } catch {
    return null;
  }
  return null;
}

/** Default 25m — SigningCloud tokens are ~30m; refresh before expiry. Override with SIGNINGCLOUD_ACCESS_TOKEN_TTL_MS. */
const DEFAULT_SIGNINGCLOUD_ACCESS_TOKEN_TTL_MS = 25 * 60 * 1000;

function signingCloudAccessTokenCacheKey(cfg: SigningCloudEnvConfig): string {
  const base = cfg.baseUrl.trim().replace(/\/$/, "");
  return `${base}\0${cfg.apiKey}`;
}

type CachedSigningCloudAccessToken = { token: string; expiresAt: number };

const signingCloudAccessTokenCache = new Map<string, CachedSigningCloudAccessToken>();
const signingCloudAccessTokenInFlight = new Map<string, Promise<string>>();

async function fetchSigningCloudAccessTokenFromApi(cfg: SigningCloudEnvConfig): Promise<string> {
  const url = `${cfg.baseUrl}/signserver/v1/accesstoken?client_id=${encodeURIComponent(cfg.apiKey)}`;
  const res = await fetch(url);
  const body = (await res.json()) as SigningCloudEncryptedResponse;
  assertSigningCloudSuccess(body);
  const decrypted = decryptSigningCloudResponse<{ at?: string }>(body, cfg.apiSecret);
  const at = decrypted.at;
  if (!at || typeof at !== "string") {
    throw new Error("SigningCloud accesstoken response missing `at`");
  }
  return at;
}

/**
 * Fetch SigningCloud `at` (access token) for SignServer API calls
 * Caches in-memory per process with TTL (default 25m) and deduplicates concurrent fetches.
 */
export async function getSigningCloudAccessToken(cfg: SigningCloudEnvConfig): Promise<string> {
  const key = signingCloudAccessTokenCacheKey(cfg);
  const now = Date.now();
  const cached = signingCloudAccessTokenCache.get(key);
  if (cached && now < cached.expiresAt) {
    return cached.token;
  }

  const existing = signingCloudAccessTokenInFlight.get(key);
  if (existing) {
    return existing;
  }

  const promise = (async () => {
    try {
      const token = await fetchSigningCloudAccessTokenFromApi(cfg);
      signingCloudAccessTokenCache.set(key, {
        token,
        expiresAt: Date.now() + DEFAULT_SIGNINGCLOUD_ACCESS_TOKEN_TTL_MS,
      });
      return token;
    } finally {
      signingCloudAccessTokenInFlight.delete(key);
    }
  })();

  signingCloudAccessTokenInFlight.set(key, promise);
  return promise;
}

export async function uploadPdfToSigningCloud(params: {
  cfg: SigningCloudEnvConfig;
  accessToken: string;
  pdfBuffer: Buffer;
  contractName: string;
  signerEmail: string;
}): Promise<{ contractnum: string; raw: Record<string, unknown> }> {
  const { cfg, accessToken, pdfBuffer, contractName, signerEmail } = params;
  const uploadFileHash = crypto.createHash("sha256").update(pdfBuffer).digest("hex");

  const rawPayload = {
    contractInfo: {
      contractnum: "",
      contractname: contractName,
      signernum: 1,
      signerinfo: [
        {
          email: signerEmail,
          authtype: "0",
          caprovide: "1",
          signset: buildSignsetJsonString(),
        },
      ],
    },
    uploadFileHash,
    type: "pdf",
  };

  const { data, mac } = encryptPayload(JSON.stringify(rawPayload), cfg.apiSecret);

  const formData = new FormData();
  formData.append("accesstoken", accessToken);
  formData.append("data", data);
  formData.append("mac", mac);
  formData.append("uploadFile", new Blob([pdfBuffer], { type: "application/pdf" }), "offer-letter.pdf");

  const res = await fetch(`${cfg.baseUrl}/signserver/v1/contract/file2`, {
    method: "POST",
    body: formData,
  });
  const body = (await res.json()) as SigningCloudEncryptedResponse & Record<string, unknown>;
  assertSigningCloudSuccess(body);
  const decrypted = decryptSigningCloudResponse<Record<string, unknown>>(body, cfg.apiSecret);
  const contractnum =
    typeof decrypted.contractnum === "string"
      ? decrypted.contractnum
      : typeof (decrypted as { contractnumber?: string }).contractnumber === "string"
        ? (decrypted as { contractnumber: string }).contractnumber
        : "";
  if (!contractnum) {
    logger.error({ decrypted }, "SigningCloud upload response missing contractnum");
    throw new Error("SigningCloud upload did not return contractnum");
  }
  return { contractnum, raw: decrypted };
}

export async function startManualSigning(params: {
  cfg: SigningCloudEnvConfig;
  accessToken: string;
  contractnum: string;
  signerEmail: string;
  /** Redirect signer after signing (SigningCloud `backUrl`). */
  redirectUrl?: string | null;
  /** Server callback after signing completes (SigningCloud `callUrl`). */
  callbackUrl?: string | null;
}): Promise<Record<string, unknown>> {
  const { cfg, accessToken, contractnum, signerEmail, redirectUrl, callbackUrl } = params;
  const rawPayload: Record<string, unknown> = {
    contractnum,
    signerInfo: { email: signerEmail },
  };
  const backUrl = sanitizeSigningCloudBackUrl(redirectUrl);
  if (redirectUrl?.trim() && !backUrl) {
    logger.warn(
      { redirectUrl: redirectUrl.trim() },
      "SigningCloud backUrl omitted (invalid for provider). Use an https URL (e.g. ngrok) or set SIGNINGCLOUD_ISSUER_RETURN_URL / ISSUER_URL to https; optional SIGNINGCLOUD_ALLOW_HTTP_BACK_URL=true if your tenant allows http."
    );
  }
  if (backUrl) {
    rawPayload.backUrl = backUrl;
  }
  if (callbackUrl) {
    rawPayload.callUrl = callbackUrl;
  }

  const { data, mac } = encryptPayload(JSON.stringify(rawPayload), cfg.apiSecret);
  const formBody = new URLSearchParams({
    accesstoken: accessToken,
    data,
    mac,
  });

  const res = await fetch(`${cfg.baseUrl}/signserver/v1/contract/signature/manual`, {
    method: "POST",
    body: formBody.toString(),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  const body = (await res.json()) as SigningCloudEncryptedResponse;
  assertSigningCloudSuccess(body);
  return decryptSigningCloudResponse<Record<string, unknown>>(body, cfg.apiSecret);
}

export function extractSigningUrlFromManualSigningResponse(decrypted: Record<string, unknown>): string | null {
  const tryString = (v: unknown): string | null =>
    typeof v === "string" && v.startsWith("http") ? v : null;

  const direct =
    tryString(decrypted.previewurl) ||
    tryString(decrypted.signingurl) ||
    tryString(decrypted.signurl) ||
    tryString(decrypted.url) ||
    tryString(decrypted.redirecturl);
  if (direct) return direct;

  const nested = decrypted.data;
  if (nested && typeof nested === "object") {
    const d = nested as Record<string, unknown>;
    return (
      tryString(d.previewurl) ||
      tryString(d.signingurl) ||
      tryString(d.signurl) ||
      tryString(d.url) ||
      null
    );
  }
  return null;
}

export async function getContractDetailsData(params: {
  cfg: SigningCloudEnvConfig;
  accessToken: string;
  contractnum: string;
}): Promise<Record<string, unknown>> {
  const { cfg, accessToken, contractnum } = params;
  const { data, mac } = encryptPayload(JSON.stringify({ contractnum }), cfg.apiSecret);
  const qs = new URLSearchParams({ accesstoken: accessToken, data, mac });
  const res = await fetch(`${cfg.baseUrl}/signserver/v1/contract/details/data?${qs.toString()}`);
  const body = (await res.json()) as SigningCloudEncryptedResponse;
  assertSigningCloudSuccess(body);
  return decryptSigningCloudResponse<Record<string, unknown>>(body, cfg.apiSecret);
}

/**
 * Download signed contract file (decrypted JSON envelope; `pdfdata` is hex per SignServer docs).
 * `isReqCertOfCompletion: false` returns the PDF only; `true` returns a .zip with cert + contract.
 */
export async function getContractFileData(params: {
  cfg: SigningCloudEnvConfig;
  accessToken: string;
  contractnum: string;
}): Promise<Record<string, unknown>> {
  const { cfg, accessToken, contractnum } = params;
  const { data, mac } = encryptPayload(
    JSON.stringify({ contractnum, isReqCertOfCompletion: false }),
    cfg.apiSecret
  );
  const qs = new URLSearchParams({ accesstoken: accessToken, data, mac });
  const res = await fetch(`${cfg.baseUrl}/signserver/v1/contract/file?${qs.toString()}`);
  const body = (await res.json()) as SigningCloudEncryptedResponse;
  assertSigningCloudSuccess(body);
  return decryptSigningCloudResponse<Record<string, unknown>>(body, cfg.apiSecret);
}

export function pdfBufferFromStream(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

export { PDF_PAGE_HEIGHT_PT, SIGNATURE_FIELD };
