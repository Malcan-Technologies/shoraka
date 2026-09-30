type ApiErrorShape = {
  code?: string;
  message?: string;
  details?: unknown;
};

/**
 * A Note created before financial snapshots existed cannot be reviewed; the API returns 409 with
 * this code. The copy does not ask for a new Note: the same invoice cannot create another one.
 */
export const NOTE_FINANCIAL_SNAPSHOT_MISSING_CODE = "NOTE_FINANCIAL_SNAPSHOT_MISSING";
export const NOTE_FINANCIAL_SNAPSHOT_MISSING_TITLE = "Prospectus unavailable";
export const NOTE_FINANCIAL_SNAPSHOT_MISSING_MESSAGE =
  "This Note was created before the required financial snapshot was available. Prospectus review cannot continue for this Note.";

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

/** Review load failure that keeps the API error code, so the page can render a known state. */
export class ProspectusReviewLoadError extends Error {
  constructor(
    message: string,
    public readonly code: string | null
  ) {
    super(message);
    this.name = "ProspectusReviewLoadError";
  }
}

export function isNoteFinancialSnapshotMissingError(error: unknown): boolean {
  return (
    error instanceof ProspectusReviewLoadError &&
    error.code === NOTE_FINANCIAL_SNAPSHOT_MISSING_CODE
  );
}
