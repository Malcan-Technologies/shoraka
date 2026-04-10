"use client";

/**
 * SECTION: Question-style field in resubmit comparison
 * WHY: Same Before | After grid and value surface as document comparison (no left accent bar).
 * INPUT: label, before/after strings, multiline flag
 * OUTPUT: Label on top, two columns, muted rounded cell per value
 * WHERE USED: All section comparison modes that use text fields
 */

import {
  REVIEW_EMPTY_LABEL,
  comparisonCellSurfaceClass,
  comparisonCellSurfaceMultilineClass,
} from "./review-section-styles";

function valueLooksEmpty(value: string): boolean {
  return (
    value === REVIEW_EMPTY_LABEL ||
    value === "—" ||
    value.trim() === ""
  );
}

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
  const Cell = ({ value }: { value: string }) => {
    const muted = valueLooksEmpty(value);
    if (multiline) {
      return (
        <div className={comparisonCellSurfaceMultilineClass}>
          <span className={muted ? "text-muted-foreground" : undefined}>{value}</span>
        </div>
      );
    }
    return (
      <div className={comparisonCellSurfaceClass}>
        <span className={muted ? "text-muted-foreground" : "text-foreground"}>{value}</span>
      </div>
    );
  };

  return (
    <div
      className="py-2 space-y-3"
      role="row"
      aria-label={changed ? `${label}, highlighted in change list` : label}
    >
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-0">
        <div className="md:pr-4 md:border-r md:border-border space-y-2 min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Before</p>
          <Cell value={before} />
        </div>
        <div className="md:pl-4 space-y-2 min-w-0 pt-4 md:pt-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">After</p>
          <Cell value={after} />
        </div>
      </div>
    </div>
  );
}
