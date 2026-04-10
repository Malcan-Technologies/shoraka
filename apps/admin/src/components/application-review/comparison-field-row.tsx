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
  comparisonSurfaceChangedAfterClass,
  comparisonSurfaceChangedBeforeClass,
  comparisonSplitAfterColClass,
  comparisonSplitBeforeColClass,
  comparisonSplitRowGridClass,
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

  const Cell = ({ value, side }: { value: string; side: "before" | "after" }) => {
    const muted = valueLooksEmpty(value);
    const base = multiline ? comparisonCellSurfaceMultilineClass : comparisonCellSurfaceClass;
    const strikeThrough =
      side === "before" && valuesDiffer && !valueLooksEmpty(value);
    const changedHighlight =
      valuesDiffer &&
      (side === "before" ? comparisonSurfaceChangedBeforeClass : comparisonSurfaceChangedAfterClass);
    return (
      <div className={cn(base, changedHighlight)}>
        <span
          className={cn(
            muted ? "text-muted-foreground" : "text-foreground",
            strikeThrough &&
              "line-through decoration-muted-foreground/80 decoration-1 [text-decoration-skip-ink:none]"
          )}
        >
          {value}
        </span>
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
      <div className={comparisonSplitRowGridClass}>
        <div className={comparisonSplitBeforeColClass}>
          <Cell value={before} side="before" />
        </div>
        <div className={comparisonSplitAfterColClass}>
          <Cell value={after} side="after" />
        </div>
      </div>
    </div>
  );
}
