/**
 * Normalize SigningCloud API failures without logging image hex or decrypted payloads.
 */

export type SigningCloudProviderErrorCode =
  | "ALREADY_SIGNED"
  | "MISSING_IMAGE"
  | "MISSING_KEYWORD"
  | "MISSING_COORDINATES"
  | "BOUNDS"
  | "CONTRACT_LOCKED"
  | "INVALID_PARAMETER"
  | "PROVIDER";

export class SigningCloudProviderError extends Error {
  constructor(
    readonly code: SigningCloudProviderErrorCode,
    message: string,
    readonly result?: number
  ) {
    super(message);
    this.name = "SigningCloudProviderError";
  }
}

/** `/signature/auto`: this signer already completed the grouped automatic-sign request. */
export const SIGNINGCLOUD_RESULT_KEYWORD_ALREADY_SIGNED = 78;
/** `/signature/auto`: the contract has no remaining unsigned automatic fields. */
export const SIGNINGCLOUD_RESULT_DOCUMENT_ALREADY_SIGNED = 96;

const ALREADY_SIGNED_RESULTS = new Set([
  SIGNINGCLOUD_RESULT_KEYWORD_ALREADY_SIGNED,
  SIGNINGCLOUD_RESULT_DOCUMENT_ALREADY_SIGNED,
]);

export function classifySigningCloudMessage(
  message: string,
  result?: number
): SigningCloudProviderErrorCode {
  if (result != null && ALREADY_SIGNED_RESULTS.has(result)) return "ALREADY_SIGNED";
  const text = message.trim().toLowerCase();
  if (/already/.test(text) && /sign/.test(text)) return "ALREADY_SIGNED";
  if (
    (/stamp|seal|signimg|signature image|image/.test(text) &&
      /miss|not found|empty|invalid/.test(text)) ||
    text.includes("stamp image is empty")
  ) {
    return "MISSING_IMAGE";
  }
  if (/keyword/.test(text)) return "MISSING_KEYWORD";
  if (/signset|coordinate/.test(text) && /miss|not found|empty/.test(text)) {
    return "MISSING_COORDINATES";
  }
  if (/bound|out of range|pageindex|overlap/.test(text)) return "BOUNDS";
  if (/lock|locked|in progress/.test(text)) return "CONTRACT_LOCKED";
  if (/parameter|param|invalid/.test(text) || result === 1) return "INVALID_PARAMETER";
  return "PROVIDER";
}

export function signingCloudProviderError(message: string, result?: number): SigningCloudProviderError {
  const trimmed = message.trim();
  const fallback =
    result == null ? "SigningCloud request failed" : `SigningCloud request failed (result=${result})`;
  return new SigningCloudProviderError(
    classifySigningCloudMessage(trimmed || fallback, result),
    trimmed || fallback,
    result
  );
}
