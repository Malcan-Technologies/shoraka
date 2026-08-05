/**
 * SigningCloud implementation of the SigningProvider interface. One SigningCloud
 * "contract" per document; multi-signer via the signerinfo array.
 */
import * as crypto from "crypto";
import {
  readSigningCloudConfigFromEnv,
  getSigningCloudAccessToken,
  uploadPdfToSigningCloudMultiSigner,
  startManualSigning,
  extractSigningUrlFromManualSigningResponse,
  getContractFileData,
  getContractDetailsData,
  type SigningCloudEnvConfig,
} from "../../signingcloud/signingcloud-api";
import type {
  SigningProvider,
  CreateDocumentContractInput,
  StartSignerSessionInput,
  FetchSignedDocumentResult,
  ProviderContractDetails,
  ProviderSignerDetail,
  ProviderSignerStatus,
} from "./adapter";
import { normalizeSigningEmail } from "@cashsouk/types";
import { logger } from "../../../lib/logger";

function requireConfig(): SigningCloudEnvConfig {
  const cfg = readSigningCloudConfigFromEnv();
  if (!cfg) {
    throw new Error("SigningCloud is not configured (SC_BASE_URL, SC_API_KEY, SC_API_SECRET)");
  }
  return cfg;
}

/** SigningCloud returns signed PDF bytes as a hex string under `pdfdata`. */
function bufferFromHexPdfData(raw: Record<string, unknown>): Buffer {
  const hex =
    typeof raw.pdfdata === "string"
      ? raw.pdfdata
      : typeof (raw.data as { pdfdata?: string })?.pdfdata === "string"
        ? (raw.data as { pdfdata: string }).pdfdata
        : "";
  if (!hex) {
    throw new Error("SigningCloud file response missing pdfdata");
  }
  if (hex.length % 2 !== 0) {
    throw new Error("SigningCloud pdfdata hex length is not even");
  }
  const buffer = Buffer.from(hex, "hex");
  if (buffer.length !== hex.length / 2) {
    throw new Error("SigningCloud pdfdata contains invalid hex characters");
  }
  if (buffer.length < 4 || buffer.subarray(0, 4).toString("ascii") !== "%PDF") {
    throw new Error("SigningCloud pdfdata is not a valid PDF");
  }
  return buffer;
}

/** SigningCloud signstate: 0 pending, 1 signed, 2 rejected (also accepts string labels). */
function mapSignState(value: unknown): ProviderSignerStatus {
  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    if (s === "1" || s === "signed" || s === "complete" || s === "completed") return "SIGNED";
    if (s === "2" || s === "rejected" || s === "declined") return "REJECTED";
    if (s === "0" || s === "pending" || s === "unsigned") return "PENDING";
  }
  const n = typeof value === "number" ? value : Number(value);
  if (n === 1) return "SIGNED";
  if (n === 2) return "REJECTED";
  if (Number.isFinite(n) && n !== 0) {
    logger.warn({ signState: value }, "SigningCloud returned unknown signstate");
  }
  return "PENDING";
}

function readFirstString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function readSignStateRaw(obj: Record<string, unknown>): unknown {
  for (const key of ["signstate", "signState", "SignState", "sign_state", "status", "signerstatus"]) {
    if (key in obj) return obj[key];
  }
  return undefined;
}

function unwrapDetailObject(raw: Record<string, unknown>): Record<string, unknown> {
  let detail: Record<string, unknown> = raw;
  for (const nestKey of ["data", "Data", "contractInfo", "contractinfo", "result"]) {
    const nested = detail[nestKey];
    if (typeof nested === "string" && nested.trim()) {
      try {
        const parsed = JSON.parse(nested) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          detail = parsed as Record<string, unknown>;
          continue;
        }
      } catch {
        // keep current detail
      }
    } else if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      detail = nested as Record<string, unknown>;
    }
  }
  return detail;
}

function extractSignerRows(detail: Record<string, unknown>): unknown[] {
  for (const key of ["addressee", "Addressee", "signerinfo", "signerInfo", "signers", "SignerInfo"]) {
    const rows = detail[key];
    if (Array.isArray(rows)) return rows;
  }
  return [];
}

/**
 * Normalize Get Document Detail payload. Decrypted body may be the detail object
 * directly or nest it under `data` / `contractInfo` (object or JSON string).
 * Signer rows may appear as `addressee` or `signerinfo`.
 */
export function parseSigningCloudContractDetails(
  raw: Record<string, unknown>
): ProviderContractDetails {
  const detail = unwrapDetailObject(raw);
  const rows = extractSignerRows(detail);
  const signers: ProviderSignerDetail[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    const emailRaw = readFirstString(item, ["email", "Email", "signeremail", "signerEmail"]);
    if (!emailRaw) continue;
    const email = normalizeSigningEmail(emailRaw);
    const name = readFirstString(item, ["realname", "realName", "name", "Name"]);
    signers.push({
      email,
      status: mapSignState(readSignStateRaw(item)),
      name,
    });
  }

  const stateRaw = detail.state ?? detail.State ?? detail.documentstate ?? detail.documentState;
  const documentState =
    typeof stateRaw === "number"
      ? stateRaw
      : typeof stateRaw === "string" && stateRaw.trim()
        ? Number(stateRaw)
        : null;

  return {
    documentState: Number.isFinite(documentState) ? documentState : null,
    signers,
  };
}

export class SigningCloudProvider implements SigningProvider {
  readonly name = "signingcloud";

  async createDocumentContract(
    input: CreateDocumentContractInput
  ): Promise<{ providerRef: string }> {
    const cfg = requireConfig();
    const accessToken = await getSigningCloudAccessToken(cfg);
    const { contractnum } = await uploadPdfToSigningCloudMultiSigner({
      cfg,
      accessToken,
      pdfBuffer: input.pdfBuffer,
      contractName: input.contractName,
      signers: input.signers.map((s) => ({
        email: s.email,
        signsetJson:
          s.signset != null
            ? typeof s.signset === "string"
              ? s.signset
              : JSON.stringify(s.signset)
            : undefined,
      })),
    });
    return { providerRef: contractnum };
  }

  async startSignerSession(input: StartSignerSessionInput): Promise<{ signingUrl: string }> {
    const cfg = requireConfig();
    const accessToken = await getSigningCloudAccessToken(cfg);
    const decrypted = await startManualSigning({
      cfg,
      accessToken,
      contractnum: input.providerRef,
      signerEmail: input.signerEmail,
      redirectUrl: input.redirectUrl ?? null,
      callbackUrl: input.callbackUrl ?? null,
    });
    const signingUrl = extractSigningUrlFromManualSigningResponse(decrypted);
    if (!signingUrl) {
      throw new Error("SigningCloud did not return a signing URL");
    }
    return { signingUrl };
  }

  async fetchSignedDocument(input: { providerRef: string }): Promise<FetchSignedDocumentResult> {
    const cfg = requireConfig();
    const accessToken = await getSigningCloudAccessToken(cfg);
    const raw = await getContractFileData({ cfg, accessToken, contractnum: input.providerRef });
    const pdfBuffer = bufferFromHexPdfData(raw);
    const sha256 = crypto.createHash("sha256").update(pdfBuffer).digest("hex");
    return { pdfBuffer, sha256 };
  }

  async getContractDetails(input: { providerRef: string }): Promise<ProviderContractDetails> {
    const cfg = requireConfig();
    const accessToken = await getSigningCloudAccessToken(cfg);
    const raw = await getContractDetailsData({
      cfg,
      accessToken,
      contractnum: input.providerRef,
    });
    return parseSigningCloudContractDetails(raw);
  }
}
