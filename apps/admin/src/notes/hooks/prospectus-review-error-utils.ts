type ApiErrorShape = {
  code?: string;
  message?: string;
  details?: unknown;
};

/**
 * Prospectus Review validation errors return:
 *   { success: false, error: { message, details } }
 * where `details` is typically an array of field-level errors: { path, message }.
 *
 * Extract the first useful detail.message (deterministic) and fall back to the
 * top-level error.message when details are missing/unknown.
 */
export function prospectusReviewErrorMessage(
  error: ApiErrorShape | undefined
): string {
  const details = error?.details;

  const firstDetailMessage = (() => {
    if (!details) return null;
    if (Array.isArray(details)) {
      for (const d of details) {
        if (d && typeof d === "object") {
          const msg = (d as { message?: unknown }).message;
          if (typeof msg === "string" && msg.trim()) return msg.trim();
        }
      }
    }
    return null;
  })();

  return firstDetailMessage ?? error?.message ?? "Request failed";
}

