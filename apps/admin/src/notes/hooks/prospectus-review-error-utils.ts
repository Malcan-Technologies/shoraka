type ApiErrorShape = {
  code?: string;
  message?: string;
  details?: unknown;
};

/** A Note created before financial snapshots existed cannot be reviewed; the API returns 409 with this code. */
export const NOTE_FINANCIAL_SNAPSHOT_MISSING_CODE = "NOTE_FINANCIAL_SNAPSHOT_MISSING";
export const NOTE_FINANCIAL_SNAPSHOT_MISSING_MESSAGE =
  "Financial snapshot is missing for this Note. Please recreate the Note after Financial Review approval.";

/**
 * Prospectus Review validation errors return:
 *   { success: false, error: { code, message, details } }
 * where `details` is typically an array of field-level errors: { path, message }.
 *
 * A known error code maps to its user-facing copy first. Otherwise extract the first useful
 * detail.message (deterministic) and fall back to the top-level error.message when details
 * are missing/unknown.
 */
export function prospectusReviewErrorMessage(
  error: ApiErrorShape | undefined
): string {
  if (error?.code === NOTE_FINANCIAL_SNAPSHOT_MISSING_CODE) {
    return NOTE_FINANCIAL_SNAPSHOT_MISSING_MESSAGE;
  }
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

