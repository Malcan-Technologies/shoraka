import { formatCurrency } from "@cashsouk/config";
import { format } from "date-fns";

/**
 * Shared typography and layout tokens for admin application review sections.
 * Aligned with BRANDING.md and used by Business, Contract, Company tabs.
 */

export const REVIEW_EMPTY_LABEL = "Not provided";

export const reviewSectionHeaderClass = "text-sm font-semibold";
export const reviewLabelClass = "text-sm font-normal text-foreground";
export const reviewValueClass =
  "min-h-[36px] w-full rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm text-muted-foreground flex items-center";
export const reviewValueClassTextArea =
  "min-h-[60px] w-full rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm text-muted-foreground flex items-start";

const ROW_GRID_BASE =
  "grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-x-8 gap-y-4 mt-3 w-full items-start";

/** Indented row grid for content under section headers.*/
export const reviewRowGridClass = `pl-3 ${ROW_GRID_BASE}`;

export interface FormatReviewValueOptions {
  emptyLabel?: string;
  formatCurrency?: boolean;
}

/**
 * Formats a value for display in review sections. Handles null, empty, number, string.
 */
export function formatReviewValue(
  v: unknown,
  options: FormatReviewValueOptions = {}
): string {
  const { emptyLabel = REVIEW_EMPTY_LABEL, formatCurrency: formatAsCurrency = false } = options;
  if (v == null || v === "") return emptyLabel;
  if (typeof v === "number") {
    if (Number.isNaN(v)) return emptyLabel;
    return formatAsCurrency ? formatCurrency(v) : String(v);
  }
  if (typeof v === "string") return v.trim() || emptyLabel;
  return String(v);
}

/**
 * Formats a date string for review display (dd MMM yyyy).
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
