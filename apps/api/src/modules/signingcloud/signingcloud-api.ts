/**
 * Low-level SigningCloud SignServer HTTP calls (token, upload, manual signing, detail, file).
 */

import * as crypto from "crypto";
import { Readable } from "stream";
import {
  decryptSigningCloudResponse,
  encryptPayload,
  assertSigningCloudSuccess,
  parseSigningCloudHttpBody,
  type SigningCloudEncryptedResponse,
} from "../../lib/signingcloud/crypto";
import { logger } from "../../lib/logger";
import { validateSigningRedirectUrl } from "../../lib/signing/redirect-url";
import { SIGNING_CLOUD_STACKED_SIGN_FIELD } from "../signing/signature-field-geometry";
import { SigningCloudProviderError, signingCloudProviderError } from "./signingcloud-errors";

const SIGNINGCLOUD_HTTP_TIMEOUT_MS = 25_000;

async function signingCloudFetch(url: string, init?: RequestInit): Promise<globalThis.Response> {
  try {
    return await fetch(url, {
      ...init,
      signal: init?.signal ?? AbortSignal.timeout(SIGNINGCLOUD_HTTP_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new Error(`SigningCloud request timed out after ${SIGNINGCLOUD_HTTP_TIMEOUT_MS / 1000}s`);
    }
    const raw = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not reach SigningCloud: ${raw}`);
  }
}

async function readSigningCloudEncryptedResponse(
  res: globalThis.Response
): Promise<SigningCloudEncryptedResponse> {
  const text = await res.text();
  if (!text.trim()) {
    logger.error(
      {
        url: res.url,
        httpStatus: res.status,
        contentType: res.headers.get("content-type"),
        bodyLength: text.length,
      },
      "SigningCloud HTTP body was empty"
    );
  } else if (res.status >= 400) {
    logger.error(
      {
        url: res.url,
        httpStatus: res.status,
        contentType: res.headers.get("content-type"),
        bodyPreview: text.trim().slice(0, 180),
      },
      "SigningCloud HTTP error"
    );
  }
  return parseSigningCloudHttpBody(text, res.status);
}

const PDF_PAGE_HEIGHT_PT = 841.89;

/** Signature rectangle — aligned with offer-letter-pdf authorisation block (contract + invoice). */
const SIGNATURE_FIELD = SIGNING_CLOUD_STACKED_SIGN_FIELD;

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

/**
 * Organisation-seal fields (`fieldtype: "seal"`) stay on unless explicitly disabled.
 * Set SC_ENABLE_SEAL_FIELD=false while SigningCloud's seal type is unavailable.
 */
export function isSigningCloudSealFieldEnabled(): boolean {
  return process.env.SC_ENABLE_SEAL_FIELD?.trim().toLowerCase() !== "false";
}

function buildSignsetJsonString(): string {
  return JSON.stringify([{ ...SIGNATURE_FIELD, pageindex: 1 }]);
}

/**
 * Signature rectangle for signer at `index`, stacked vertically so multiple signers
 * on the same document do not overlap. Used by the multi-signer upload path until
 * per-signer coordinates are configured per document.
 */
function defaultSignsetForSignerIndex(index: number): string {
  const verticalGap = SIGNATURE_FIELD.height + 20;
  return JSON.stringify([
    {
      ...SIGNATURE_FIELD,
      pageindex: 1,
      top: SIGNATURE_FIELD.top - index * verticalGap,
    },
  ]);
}

export function assertAutomaticSignsetJson(signsetJson: string | undefined): string {
  if (!signsetJson?.trim()) {
    throw signingCloudProviderError("Missing signature attribute in signset", 1);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(signsetJson);
  } catch {
    throw signingCloudProviderError("Missing signature attribute in signset", 1);
  }
  const hasSignature =
    Array.isArray(parsed) &&
    parsed.some(
      (row) => row && typeof row === "object" && (row as { fieldtype?: unknown }).fieldtype === "sign"
    );
  if (!hasSignature) {
    throw signingCloudProviderError("Missing signature attribute in signset", 1);
  }
  return integerSignsetJson(signsetJson);
}

const SIGNSET_INT_KEYS = ["top", "left", "width", "height", "pageindex"] as const;

/** SigningCloud file2 returns HTTP 404 with an empty body when coordinates are not integers. */
export function integerSignsetJson(signsetJson: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(signsetJson);
  } catch {
    return signsetJson;
  }
  if (!Array.isArray(parsed)) return signsetJson;
  return JSON.stringify(
    parsed.map((row) => {
      if (!row || typeof row !== "object") return row;
      const next: Record<string, unknown> = { ...(row as Record<string, unknown>) };
      for (const key of SIGNSET_INT_KEYS) {
        const value = next[key];
        if (typeof value === "number" && Number.isFinite(value)) next[key] = Math.round(value);
      }
      return next;
    })
  );
}

export interface MultiSignerUploadSigner {
  email: string;
  /** Pre-serialized SigningCloud signset JSON string; falls back to a stacked default. */
  signsetJson?: string;
  /** Coordinate boxes for automatic countersigners. Empty arrays are rejected by file2. */
  automatic?: boolean;
}

/**
 * Upload a PDF that requires multiple signers (SigningCloud `signerinfo` array).
 * Mirrors uploadPdfToSigningCloud but supports 1..N signers, each with their own
 * signature field. The single-signer helper is preserved for the existing offer flow.
 */
export async function uploadPdfToSigningCloudMultiSigner(params: {
  cfg: SigningCloudEnvConfig;
  accessToken: string;
  pdfBuffer: Buffer;
  contractName: string;
  signers: MultiSignerUploadSigner[];
}): Promise<{ contractnum: string; raw: Record<string, unknown> }> {
  const { cfg, accessToken, pdfBuffer, contractName, signers } = params;
  if (signers.length === 0) {
    throw new Error("uploadPdfToSigningCloudMultiSigner requires at least one signer");
  }
  const uploadFileHash = crypto.createHash("sha256").update(pdfBuffer).digest("hex");

  const rawPayload = {
    contractInfo: {
      contractnum: "",
      contractname: contractName,
      signernum: signers.length,
      signerinfo: signers.map((s, index) => ({
        email: s.email,
        authtype: "0",
        caprovide: "1",
        signset: integerSignsetJson(
          s.automatic
            ? assertAutomaticSignsetJson(s.signsetJson)
            : (s.signsetJson ?? defaultSignsetForSignerIndex(index))
        ),
      })),
    },
    uploadFileHash,
    type: "pdf",
  };

  const { data, mac } = encryptPayload(JSON.stringify(rawPayload), cfg.apiSecret);

  const formData = new FormData();
  formData.append("accesstoken", accessToken);
  formData.append("data", data);
  formData.append("mac", mac);
  formData.append("uploadFile", new Blob([pdfBuffer], { type: "application/pdf" }), "document.pdf");

  const res = await signingCloudFetch(`${cfg.baseUrl}/signserver/v1/contract/file2`, {
    method: "POST",
    body: formData,
  });
  const body = await readSigningCloudEncryptedResponse(res);
  assertSigningCloudSuccess(body);
  const decrypted = decryptSigningCloudResponse<Record<string, unknown>>(body, cfg.apiSecret);
  const contractnum =
    typeof decrypted.contractnum === "string"
      ? decrypted.contractnum
      : typeof (decrypted as { contractnumber?: string }).contractnumber === "string"
        ? (decrypted as { contractnumber: string }).contractnumber
        : "";
  if (!contractnum) {
    logger.error({ decrypted }, "SigningCloud multi-signer upload response missing contractnum");
    throw new Error("SigningCloud upload did not return contractnum");
  }
  return { contractnum, raw: decrypted };
}

/**
 * SigningCloud returns "Invalid back URL" for many http URLs (e.g. localhost) in staging/production.
 * Default: only send `backUrl` when the URL is https. Set SIGNINGCLOUD_ALLOW_HTTP_BACK_URL=true to pass
 * http through if your tenant allows it.
 */
export function sanitizeSigningCloudBackUrl(url: string | null | undefined): string | null {
  return validateSigningRedirectUrl(url);
}

/** Default 25m — SigningCloud tokens are ~30m; refresh before expiry. Override with SC_ACCESS_TOKEN_TTL_MS. */
const DEFAULT_SIGNINGCLOUD_ACCESS_TOKEN_TTL_MS = 25 * 60 * 1000;

export function signingCloudAccessTokenTtlMs(): number {
  const raw = process.env.SC_ACCESS_TOKEN_TTL_MS?.trim();
  const parsed = raw ? Number(raw) : NaN;
  if (Number.isFinite(parsed) && parsed >= 60_000) return Math.floor(parsed);
  return DEFAULT_SIGNINGCLOUD_ACCESS_TOKEN_TTL_MS;
}

function signingCloudAccessTokenCacheKey(cfg: SigningCloudEnvConfig): string {
  const base = cfg.baseUrl.trim().replace(/\/$/, "");
  return `${base}\0${cfg.apiKey}`;
}

type CachedSigningCloudAccessToken = { token: string; expiresAt: number };

const signingCloudAccessTokenCache = new Map<string, CachedSigningCloudAccessToken>();
const signingCloudAccessTokenInFlight = new Map<string, Promise<string>>();

async function fetchSigningCloudAccessTokenFromApi(cfg: SigningCloudEnvConfig): Promise<string> {
  const url = `${cfg.baseUrl}/signserver/v1/accesstoken?client_id=${encodeURIComponent(cfg.apiKey)}`;
  const res = await signingCloudFetch(url);
  const body = await readSigningCloudEncryptedResponse(res);
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
        expiresAt: Date.now() + signingCloudAccessTokenTtlMs(),
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

  const res = await signingCloudFetch(`${cfg.baseUrl}/signserver/v1/contract/file2`, {
    method: "POST",
    body: formData,
  });
  const body = await readSigningCloudEncryptedResponse(res);
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
      "SigningCloud backUrl omitted (invalid for provider). Use an https ISSUER_URL (e.g. ngrok); optional SIGNINGCLOUD_ALLOW_HTTP_BACK_URL=true if your tenant allows http."
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

  const res = await signingCloudFetch(`${cfg.baseUrl}/signserver/v1/contract/signature/manual`, {
    method: "POST",
    body: formBody.toString(),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  const body = await readSigningCloudEncryptedResponse(res);
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
  const res = await signingCloudFetch(`${cfg.baseUrl}/signserver/v1/contract/details/data?${qs.toString()}`);
  const body = await readSigningCloudEncryptedResponse(res);
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
  const res = await signingCloudFetch(`${cfg.baseUrl}/signserver/v1/contract/file?${qs.toString()}`);
  const body = await readSigningCloudEncryptedResponse(res);
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

function assertSigningCloudCall(body: SigningCloudEncryptedResponse): void {
  if (body.result === 0) return;
  throw signingCloudProviderError(body.message ?? "", body.result);
}

async function postEncryptedSignServer(params: {
  cfg: SigningCloudEnvConfig;
  accessToken: string;
  path: string;
  payload: Record<string, unknown>;
  formFields?: Record<string, string>;
}): Promise<Record<string, unknown>> {
  const { cfg, accessToken, path, payload, formFields } = params;
  const { data, mac } = encryptPayload(JSON.stringify(payload), cfg.apiSecret);
  // Keyword params must be readable before the encrypted `data` blob. Staging
  // rejects `/signature/auto` unless signkeyword/scSignkeyword are HTTP params;
  // putting them after a large signimg hex causes "signkeyword is mandatory".
  const formBody = new URLSearchParams();
  if (formFields) {
    for (const [key, value] of Object.entries(formFields)) {
      formBody.append(key, value);
    }
  }
  formBody.append("accesstoken", accessToken);
  formBody.append("data", data);
  formBody.append("mac", mac);
  const query = formFields ? `?${new URLSearchParams(formFields).toString()}` : "";
  const res = await signingCloudFetch(`${cfg.baseUrl}${path}${query}`, {
    method: "POST",
    body: formBody.toString(),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  const body = await readSigningCloudEncryptedResponse(res);
  assertSigningCloudCall(body);
  if (!body.data || !body.mac) return {};
  return decryptSigningCloudResponse<Record<string, unknown>>(body, cfg.apiSecret);
}

export async function uploadSignerStampImage(params: {
  cfg: SigningCloudEnvConfig;
  accessToken: string;
  signerEmail: string;
  imageBytes: Buffer;
  contentType: "image/png" | "image/jpeg";
}): Promise<Record<string, unknown>> {
  const { cfg, accessToken, signerEmail, imageBytes, contentType } = params;
  if (imageBytes.length === 0) {
    throw signingCloudProviderError("Stamp image is empty");
  }
  return postEncryptedSignServer({
    cfg,
    accessToken,
    path: "/signserver/v1/user/stampimg",
    payload: {
      email: signerEmail,
      img: imageBytes.toString("hex"),
      imgtype: contentType === "image/png" ? "png" : "jpg",
    },
  });
}

export async function autoSignContract(params: {
  cfg: SigningCloudEnvConfig;
  accessToken: string;
  contractnum: string;
  signerEmail: string;
  keyword: string;
  dateKeyword?: string | null;
  dateFormat?: string | null;
  signatureImageBytes: Buffer;
  widthPx: number;
  heightPx: number;
  callbackUrl?: string | null;
}): Promise<{ alreadySigned: boolean; raw: Record<string, unknown> | null }> {
  const {
    cfg,
    accessToken,
    contractnum,
    signerEmail,
    keyword,
    dateKeyword,
    dateFormat,
    signatureImageBytes,
    widthPx,
    heightPx,
    callbackUrl,
  } = params;
  if (!keyword.trim()) {
    throw signingCloudProviderError("keyword not found");
  }
  if (signatureImageBytes.length === 0) {
    throw signingCloudProviderError("missing signature image");
  }
  const signKeyword = keyword.trim();
  const dateKey = dateKeyword?.trim() || "";
  const signerInfo: Record<string, unknown> = {
    email: signerEmail,
    keyword: signKeyword,
    signkeyword: signKeyword,
    scSignkeyword: signKeyword,
  };
  const payload: Record<string, unknown> = {
    contractnum,
    signerInfo,
    keyword: signKeyword,
    signkeyword: signKeyword,
    scSignkeyword: signKeyword,
    signimg: signatureImageBytes.toString("hex"),
    imgwidth: widthPx,
    imgheight: heightPx,
  };
  const formFields: Record<string, string> = {
    keyword: signKeyword,
    signkeyword: signKeyword,
    scSignkeyword: signKeyword,
  };
  if (dateKey) {
    const format = dateFormat?.trim() || "dd/MM/yyyy";
    signerInfo.datekeyword = dateKey;
    payload.datekeyword = dateKey;
    payload.dateformat = format;
    signerInfo.dateformat = format;
    formFields.datekeyword = dateKey;
    formFields.dateformat = format;
  }
  if (callbackUrl?.trim()) payload.callUrl = callbackUrl.trim();
  try {
    const raw = await postEncryptedSignServer({
      cfg,
      accessToken,
      path: "/signserver/v1/contract/signature/auto",
      payload,
      formFields,
    });
    return { alreadySigned: false, raw };
  } catch (error) {
    if (error instanceof SigningCloudProviderError && error.code === "ALREADY_SIGNED") {
      return { alreadySigned: true, raw: null };
    }
    throw error;
  }
}

export { PDF_PAGE_HEIGHT_PT, SIGNATURE_FIELD };
