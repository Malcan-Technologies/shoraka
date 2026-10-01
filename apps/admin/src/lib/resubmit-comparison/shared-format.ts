/**
 * SECTION: Pure display formatters for resubmit comparison projections
 * WHY: Projections must emit the exact strings the review UI shows, and run under jest
 *      (node) without pulling UI modules or the @cashsouk/config barrel.
 * INPUT: Raw snapshot values
 * OUTPUT: Display strings
 * WHERE USED: company / business / documents projections and their section renderers;
 *             review-section-styles and comparison-field-row re-export the shared helpers
 */

import { format } from "date-fns";

/** Source of REVIEW_EMPTY_LABEL (re-exported by review-section-styles). */
export const REVIEW_EMPTY_LABEL = "Not provided";

/** Same output as formatReviewValue(v, { emptyLabel }) without the currency option. */
export function formatReviewText(v: unknown, emptyLabel: string = REVIEW_EMPTY_LABEL): string {
  if (v == null || v === "") return emptyLabel;
  if (typeof v === "number") {
    if (Number.isNaN(v)) return emptyLabel;
    return String(v);
  }
  if (typeof v === "string") return v.trim() || emptyLabel;
  return String(v);
}

/**
 * Formats file size for display: B, KB, or MB depending on magnitude.
 * Re-exported by review-section-styles.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Formats a date string for review display (dd MMM yyyy).
 * Re-exported by review-section-styles.
 */
export function formatReviewDate(
  dateStr: string | null | undefined,
  options: { emptyLabel?: string } = {}
): string {
  const { emptyLabel = REVIEW_EMPTY_LABEL } = options;
  if (!dateStr) return emptyLabel;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return format(date, "dd MMM yyyy");
}

/**
 * Yes/no tri-state: true / "yes", false / "no", else null.
 * Re-exported as unknownToTriBool (comparison-field-row) and offerAcceptanceTriBool.
 */
export function unknownToTriBool(v: unknown): boolean | null {
  if (v === true || v === "yes") return true;
  if (v === false || v === "no") return false;
  return null;
}

export function reviewStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export function isPlainObjectRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}
