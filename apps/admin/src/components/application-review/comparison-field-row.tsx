"use client";

import type { ReactNode } from "react";

/**
 * SECTION: Question-style field in resubmit comparison
 * WHY: Two-column grid with optional change highlight when values differ.
 * INPUT: label, before/after strings, multiline flag
 * OUTPUT: Label on top, earlier/later cells; ring + tint when content differs
 * WHERE USED: All section comparison modes that use text fields
 */

import { YesNoRadioDisplay } from "@cashsouk/ui";
import { cn } from "@/lib/utils";
import {
  REVIEW_EMPTY_LABEL,
  comparisonCellSurfaceMultilineShellClass,
  comparisonCellSurfaceShellClass,
  comparisonSurfaceChangedAfterClass,
  comparisonSurfaceChangedBeforeClass,
  comparisonSplitAfterColClass,
  comparisonSplitBeforeColClass,
  comparisonSplitRowGridClass,
  reviewLabelClass,
} from "./review-section-styles";

function valueLooksEmpty(value: string): boolean {
  return value === REVIEW_EMPTY_LABEL || value === "—" || value.trim() === "";
}

function normalizedForCompare(value: string): string {
  if (valueLooksEmpty(value)) return "";
  return value.trim();
}

const yesNoRadioScaleClass = "inline-block scale-[0.88] origin-left";

function ComparisonYesNoCell({
  value,
  side,
  valuesDiffer,
}: {
  value: boolean | null;
  side: "before" | "after";
  valuesDiffer: boolean;
}) {
  const shell = comparisonCellSurfaceShellClass;
  const changedHighlight =
    valuesDiffer &&
    (side === "before" ? comparisonSurfaceChangedBeforeClass : comparisonSurfaceChangedAfterClass);
  return (
    <div
      className={cn(
        shell,
        "items-start justify-start",
        side === "before" ? "text-muted-foreground" : "text-foreground",
        changedHighlight
      )}
    >
      <span className={yesNoRadioScaleClass}>
        <YesNoRadioDisplay value={value} comparisonMuted={side === "before"} />
      </span>
    </div>
  );
}

function ComparisonTextCell({
  value,
  side,
  multiline,
  valuesDiffer,
}: {
  value: string;
  side: "before" | "after";
  multiline?: boolean;
  valuesDiffer: boolean;
}) {
  const shell = multiline ? comparisonCellSurfaceMultilineShellClass : comparisonCellSurfaceShellClass;
  const strikeThrough = side === "before" && valuesDiffer && !valueLooksEmpty(value);
  const changedHighlight =
    valuesDiffer &&
    (side === "before" ? comparisonSurfaceChangedBeforeClass : comparisonSurfaceChangedAfterClass);
  const tone = side === "before" ? "text-muted-foreground" : "text-foreground";
  return (
    <div className={cn(shell, tone, changedHighlight)}>
      <span
        className={cn(
          strikeThrough &&
            "line-through decoration-muted-foreground/80 decoration-1 [text-decoration-skip-ink:none]"
        )}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * SECTION: Yes/No comparison row
 * WHY: Matches issuer/admin Yes–No radios instead of plain "Yes"/"No" text.
 * INPUT: label, before/after tri-bool, changed flag from field_changes
 * OUTPUT: Same grid as ComparisonFieldRow with YesNoRadioDisplay per column
 * WHERE USED: Business, contract, customer comparison when a field is yes/no
 */
export function unknownToTriBool(v: unknown): boolean | null {
  if (v === true || v === "yes") return true;
  if (v === false || v === "no") return false;
  return null;
}

export function ComparisonYesNoRadioRow({
  label,
  beforeValue,
  afterValue,
  changed,
}: {
  label: ReactNode;
  beforeValue: boolean | null;
  afterValue: boolean | null;
  changed: boolean;
}) {
  const valuesDiffer = beforeValue !== afterValue;
  const labelForAria = typeof label === "string" ? label : "Yes or no field";

  return (
    <div
      className="py-2 space-y-3"
      role="row"
      aria-label={
        valuesDiffer || changed
          ? `${labelForAria}, values differ between revisions`
          : labelForAria
      }
    >
      <p className={reviewLabelClass}>{label}</p>
      <div className={comparisonSplitRowGridClass}>
        <div className={comparisonSplitBeforeColClass}>
          <ComparisonYesNoCell value={beforeValue} side="before" valuesDiffer={valuesDiffer} />
        </div>
        <div className={comparisonSplitAfterColClass}>
          <ComparisonYesNoCell value={afterValue} side="after" valuesDiffer={valuesDiffer} />
        </div>
      </div>
    </div>
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
  const valuesDiffer = normalizedForCompare(before) !== normalizedForCompare(after);

  return (
    <div
      className="py-2 space-y-3"
      role="row"
      aria-label={
        valuesDiffer || changed ? `${label}, values differ between revisions` : label
      }
    >
      <p className={reviewLabelClass}>{label}</p>
      <div className={comparisonSplitRowGridClass}>
        <div className={comparisonSplitBeforeColClass}>
          <ComparisonTextCell
            value={before}
            side="before"
            multiline={multiline}
            valuesDiffer={valuesDiffer}
          />
        </div>
        <div className={comparisonSplitAfterColClass}>
          <ComparisonTextCell
            value={after}
            side="after"
            multiline={multiline}
            valuesDiffer={valuesDiffer}
          />
        </div>
      </div>
    </div>
  );
}
