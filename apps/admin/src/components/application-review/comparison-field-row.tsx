"use client";

/**
 * SECTION: Three-column before / label / after row for resubmit comparison
 * WHY: Matches admin review typography with centered question labels per plan.
 * INPUT: label text, before/after nodes, changed flag
 * OUTPUT: Grid row with highlight when `changed`
 * WHERE USED: Section comparison modes
 */

import { cn } from "@/lib/utils";
import { ReviewValue } from "./review-value";
import { reviewLabelClass, reviewValueClass } from "./review-section-styles";

export function ComparisonFieldRow({
  label,
  before,
  after,
  changed,
  multiline,
}: {
  label: string;
  before: string;
  after: string;
  changed: boolean;
  multiline?: boolean;
}) {
  console.log("ComparisonFieldRow render:", { label, changed, multiline: !!multiline });
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-3 py-2.5 px-2 rounded-xl border border-border/60 md:grid-cols-[1fr_minmax(200px,280px)_1fr] md:gap-4 md:items-start",
        changed ? "border-l-4 border-l-accent bg-accent/5" : "bg-muted/30"
      )}
      role="row"
      aria-label={changed ? `${label}, changed` : label}
    >
      <div className="order-1 md:order-none">
        <p className="text-xs font-medium text-muted-foreground md:hidden mb-1">Before</p>
        {multiline ? (
          <ReviewValue value={before} multiline />
        ) : (
          <div className={reviewValueClass}>{before}</div>
        )}
      </div>
      <div
        className={cn(
          reviewLabelClass,
          "text-[17px] leading-7 font-medium order-2 md:order-none md:text-center"
        )}
      >
        {label}
        {changed ? (
          <span className="sr-only"> — changed</span>
        ) : null}
      </div>
      <div className="order-3 md:order-none">
        <p className="text-xs font-medium text-muted-foreground md:hidden mb-1">After</p>
        {multiline ? (
          <ReviewValue value={after} multiline />
        ) : (
          <div className={reviewValueClass}>{after}</div>
        )}
      </div>
    </div>
  );
}
