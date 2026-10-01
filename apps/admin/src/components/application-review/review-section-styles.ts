import { formatCurrency } from "@cashsouk/config";
import { REVIEW_EMPTY_LABEL } from "@/lib/resubmit-comparison/shared-format";

/**
 * Shared typography and layout tokens for admin application review sections.
 * Aligned with BRANDING.md and used by Business, Facility, Company tabs.
 */

/** Pure implementations live in shared-format (jest-safe); re-exported here for UI callers. */
export {
  REVIEW_EMPTY_LABEL,
  formatFileSize,
  formatReviewDate,
} from "@/lib/resubmit-comparison/shared-format";

/**
 * Section/subsection title: text-base font-semibold per BRANDING.
 * Used for ReviewFieldBlock, ApplicationFinancialReviewContent subsections, SectionComments.
 */
export const reviewSectionHeaderClass = "text-base font-semibold text-foreground";

/** Main card title (tab-level): icon + title in header. */
export const reviewCardTitleClass = "text-base font-semibold text-foreground";

/** Empty state text: consistent across all tabs. */
export const reviewEmptyStateClass = "text-sm text-muted-foreground";
export const reviewLabelClass = "text-sm font-medium text-foreground leading-6";
export const reviewValueClass =
  "min-h-[36px] min-w-0 w-full overflow-hidden rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm text-muted-foreground flex items-center break-words";
export const reviewValueClassTextArea =
  "min-h-[60px] min-w-0 w-full overflow-hidden rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm text-muted-foreground flex items-start break-words";

/**
 * Resubmit comparison field shell (border/background only).
 * Before column: add text-muted-foreground. After column: add text-foreground.
 */
export const comparisonCellSurfaceShellClass =
  "min-h-[36px] w-full rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm break-words flex items-center";

export const comparisonCellSurfaceMultilineShellClass =
  "min-h-[60px] w-full rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm break-words whitespace-pre-wrap flex items-start";

/**
 * File chip row in comparison — same border/radius/padding/tint as comparisonCellSurfaceShellClass,
 * with items-start + gap for icon + multi-line filenames. Used everywhere document pairs render (all tabs + supporting docs modal).
 */
export const comparisonFileChipRowShellClass =
  "min-h-[36px] w-full rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm break-words flex items-start gap-2";

/**
 * When earlier ≠ later: Before uses status-rejected (red tint); After uses status-action (yellow–amber).
 * Tokens match packages/config status-badges STATUS_BADGE_GROUPS (expired_closed / issuer_action).
 */
export const comparisonSurfaceChangedBeforeClass =
  "ring-2 ring-status-rejected-text/30 bg-status-rejected-bg dark:ring-red-400/35 dark:bg-red-950/45";

export const comparisonSurfaceChangedAfterClass =
  "ring-2 ring-status-action-text/30 bg-status-action-bg dark:ring-amber-400/35 dark:bg-amber-950/45";

/**
 * Before | After comparison columns — shared gutter with modal scrollbar-gutter: stable.
 * Vertical rule on md+; stacked on small screens.
 */
export const comparisonSplitRowGridClass = "grid grid-cols-1 gap-0 md:grid-cols-2";
/** No column tint — only vertical rule; sticky bar in modal carries Before/After fills. */
export const comparisonSplitBeforeColClass =
  "min-w-0 border-b border-border py-3 md:border-b-0 md:border-r md:border-border md:py-0 md:pr-6";
export const comparisonSplitAfterColClass = "min-w-0 py-3 md:py-0 md:pl-6";

/** Row grid: items-center so label vertically aligns with input center (h-11). Matches application flow gap-x-6 gap-y-4. */
const ROW_GRID_BASE =
  "grid min-w-0 w-full grid-cols-1 sm:grid-cols-[220px_1fr] gap-x-6 gap-y-4 mt-4 items-center [&>*]:min-w-0";

/** Indented row grid for content under section headers. */
export const reviewRowGridClass = `pl-3 ${ROW_GRID_BASE}`;

/**
 * Resubmit comparison rows in the live review grid language: 220px label column (as reviewRowGridClass),
 * then Before | After. Stacks on small screens (label, Before, After) with side captions.
 */
const COMPARISON_ROW_COLUMNS = "md:grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)]";

/** Wrapper for a list of comparison rows under a block header (live: mt-4 + gap-y-4). */
export const comparisonRowListClass = "mt-4 space-y-4";

/** One comparison row: label | Before | After. */
export const comparisonRowGridClass = `pl-3 grid min-w-0 w-full grid-cols-1 ${COMPARISON_ROW_COLUMNS} gap-x-6 gap-y-2 items-start [&>*]:min-w-0`;

/** Label cell: live label typography, nudged to sit on the first line of a 36px value cell. */
export const comparisonLabelColClass = `${reviewLabelClass} md:pt-1.5`;

/** Before/After caption: visible when the row stacks; screen-reader only on md+ (columns carry it visually). */
export const comparisonSideCaptionClass = "mb-1 block text-meta text-muted-foreground md:sr-only";

/** Helper text under a value cell (live: under the value). */
export const comparisonValueHintClass = "mt-1 text-xs text-muted-foreground";

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
