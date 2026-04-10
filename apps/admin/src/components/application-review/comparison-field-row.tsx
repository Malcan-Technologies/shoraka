"use client";

/**
 * SECTION: Question-style field in resubmit comparison
 * WHY: Two-column grid with optional change highlight when values differ.
 * INPUT: label, before/after strings, multiline flag
 * OUTPUT: Label on top, earlier/later cells; ring + tint when content differs
 * WHERE USED: All section comparison modes that use text fields
 */

import { cn } from "@/lib/utils";
import {
  REVIEW_EMPTY_LABEL,
  comparisonCellSurfaceClass,
  comparisonCellSurfaceMultilineClass,
  comparisonSurfaceChangedClass,
} from "./review-section-styles";

function valueLooksEmpty(value: string): boolean {
  return value === REVIEW_EMPTY_LABEL || value === "—" || value.trim() === "";
}

function normalizedForCompare(value: string): string {
  if (valueLooksEmpty(value)) return "";
  return value.trim();
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
  const valuesDiffer = normalizedForCompare(before) !== normalizedForCompare(after);

  const Cell = ({ value }: { value: string }) => {
    const muted = valueLooksEmpty(value);
    const base = multiline ? comparisonCellSurfaceMultilineClass : comparisonCellSurfaceClass;
    return (
      <div className={cn(base, valuesDiffer && comparisonSurfaceChangedClass)}>
        <span className={muted ? "text-muted-foreground" : "text-foreground"}>{value}</span>
      </div>
    );
  };

  return (
    <div
      className="py-2 space-y-3"
      role="row"
      aria-label={
        valuesDiffer || changed ? `${label}, values differ between revisions` : label
      }
    >
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-0">
        <div className="md:pr-4 md:border-r md:border-border min-w-0">
          <Cell value={before} />
        </div>
        <div className="md:pl-4 min-w-0 pt-4 md:pt-0">
          <Cell value={after} />
        </div>
      </div>
    </div>
  );
}
