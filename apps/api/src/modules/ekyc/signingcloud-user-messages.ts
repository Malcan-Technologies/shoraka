/** Shown when SigningCloud rejects our account or the service is not configured. */
export const EKYC_UNAVAILABLE_CONTACT_SUPPORT =
  "Identity verification is temporarily unavailable on our side. Please contact CashSouk support for assistance.";

/** Shown for other SigningCloud outages where a retry may succeed. */
export const EKYC_UNAVAILABLE_RETRY_OR_SUPPORT =
  "We couldn't start identity verification. Please try again in a few minutes, or contact CashSouk support if this continues.";

type SigningCloudVendorError = {
  result?: number;
  message?: string;
};

export function parseSigningCloudErrorText(text: string): SigningCloudVendorError {
  const resultFromSuffix = text.match(/\(result=(\d+)\)/i)?.[1];
  const jsonFragment = text.match(/\{[^{}]+\}/)?.[0];

  if (jsonFragment) {
    try {
      const parsed = JSON.parse(jsonFragment) as SigningCloudVendorError;
      return {
        result:
          typeof parsed.result === "number"
            ? parsed.result
            : resultFromSuffix
              ? Number(resultFromSuffix)
              : undefined,
        message: typeof parsed.message === "string" ? parsed.message : undefined,
      };
    } catch {
      // Fall through to suffix-only parsing.
    }
  }

  if (resultFromSuffix) {
    return { result: Number(resultFromSuffix), message: text };
  }

  return { message: text };
}

export const EKYC_PROVIDER_UNAVAILABLE_CODE = "EKYC_PROVIDER_UNAVAILABLE";

export function isEkycProviderUnavailable(
  errorCode: string,
  vendor?: SigningCloudVendorError
): boolean {
  if (errorCode === EKYC_PROVIDER_UNAVAILABLE_CODE || errorCode === "SIGNINGCLOUD_NOT_CONFIGURED") {
    return true;
  }

  const vendorMessage = vendor?.message?.toLowerCase() ?? "";
  return (
    vendor?.result === 44 ||
    vendorMessage.includes("account not allow") ||
    vendorMessage.includes("not allow to use api")
  );
}

export function signingCloudEkycUserMessage(
  errorCode: string,
  vendor?: SigningCloudVendorError
): string {
  const vendorMessage = vendor?.message?.toLowerCase() ?? "";

  if (
    vendor?.result === 44 ||
    vendorMessage.includes("account not allow") ||
    vendorMessage.includes("not allow to use api")
  ) {
    return EKYC_UNAVAILABLE_CONTACT_SUPPORT;
  }

  if (errorCode === "SIGNINGCLOUD_NOT_CONFIGURED") {
    return EKYC_UNAVAILABLE_CONTACT_SUPPORT;
  }

  if (errorCode.startsWith("SIGNINGCLOUD_")) {
    return EKYC_UNAVAILABLE_RETRY_OR_SUPPORT;
  }

  return EKYC_UNAVAILABLE_RETRY_OR_SUPPORT;
}

export function signingCloudEkycPublicErrorCode(
  errorCode: string,
  vendor?: SigningCloudVendorError
): string {
  return isEkycProviderUnavailable(errorCode, vendor)
    ? EKYC_PROVIDER_UNAVAILABLE_CODE
    : errorCode;
}
