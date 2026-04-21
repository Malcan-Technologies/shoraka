/**
 * Shared table styles for admin application pages.
 * Matches BRANDING.md: text-[15px] body, text-sm font-semibold header,
 * odd:bg-muted/40, hover:bg-muted, numeric right-aligned.
 * All colors use design tokens (muted, foreground, border).
 */

export const applicationTableHeaderClass =
  "text-sm font-semibold text-foreground px-4 py-3";
export const applicationTableHeaderNumericClass =
  "text-sm font-semibold text-foreground px-4 py-3 text-right tabular-nums";
export const applicationTableHeaderCenterClass =
  "text-sm font-semibold text-foreground px-4 py-3 text-center";

/** Header row background. Matches other admin tables. */
export const applicationTableHeaderBgClass = "bg-muted/20";

export const applicationTableRowClass =
  "border-b border-border last:border-b-0 transition-colors odd:bg-muted/40 hover:bg-muted";
export const applicationTableRowGreyedClass =
  "border-b border-border bg-muted/30 text-muted-foreground cursor-not-allowed hover:bg-muted/40";

export const applicationTableCellClass = "text-[15px] px-4 py-3 align-middle";
export const applicationTableCellMutedClass =
  "text-[15px] px-4 py-3 align-middle text-muted-foreground";
export const applicationTableCellNumericClass =
  "text-[15px] px-4 py-3 align-middle text-right tabular-nums";
export const applicationTableCellCenterClass =
  "text-[15px] px-4 py-3 align-middle text-center";

export const applicationTableWrapperClass =
  "rounded-xl border border-border bg-card overflow-hidden";

/** Expandable row: card-like with light border. */
export const applicationTableExpandableRowClass =
  "border-b border-border bg-card hover:bg-card";

/**
 * Expandable content: compact for table context (many rows).
 * BRANDING: text-[15px] tables, text-sm headers, rounded-xl.
 */
export const applicationTableExpandableContentClass =
  "mx-4 mb-2 mt-1 px-4 py-3";

/** Three-column grid. Aligned with review tab card padding rhythm. */
export const applicationTableExpandableGridClass =
  "grid gap-4 md:grid-cols-3 md:gap-6 max-w-6xl mx-auto [&>div]:min-w-0 [&>div:not(:last-child)]:md:border-r [&>div:not(:last-child)]:md:border-border [&>div:not(:last-child)]:md:pr-6";

/** Section title. Matches application flow sectionTitleClassName. */
export const applicationTableExpandableSectionTitleClass =
  "text-sm font-semibold text-foreground mb-2 pb-1 border-b-2 border-border inline-block";

/** Label. Matches formLabelClassName (text-sm) + muted for hierarchy. */
export const applicationTableExpandableLabelClass =
  "text-sm font-medium text-muted-foreground leading-6";

/** Value. BRANDING text-[15px] for tables. */
export const applicationTableExpandableValueClass =
  "text-[15px] leading-6 text-foreground tabular-nums";

/** Vertical spacing between field blocks. */
export const applicationTableExpandableFieldGapClass = "space-y-2";

/** Single field block: label → value gap (review-field-block uses space-y-3 sections). */
export const applicationTableExpandableFieldBlockClass = "space-y-0.5";
