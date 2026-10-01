"use client";

import type { ReactNode } from "react";

/**
 * SECTION: Question-style field in resubmit comparison
 * WHY: Optional change highlight when values differ, in one of two layouts.
 * INPUT: label, before/after strings, multiline flag, optional helper hint, layout
 * OUTPUT: "split" (default): label on top + two columns (live paymaster identity panel).
 *         "grid": 220px label | Before | After (captioned when stacked) for the resubmit comparison modal.
 * WHERE USED: Resubmit comparison rows (layout="grid" via ComparisonProjectedRow); SubmittedVerifiedPaymasterIdentity (split)
 */

import { YesNoRadioDisplay } from "@cashsouk/ui";
import { cn } from "@/lib/utils";
import { comparisonTextValuesDiffer } from "@/lib/resubmit-comparison/projection-types";
import {
  REVIEW_EMPTY_LABEL,
  comparisonCellSurfaceMultilineShellClass,
  comparisonCellSurfaceShellClass,
  comparisonSurfaceChangedAfterClass,
  comparisonSurfaceChangedBeforeClass,
  comparisonLabelColClass,
  comparisonRowGridClass,
  comparisonSideCaptionClass,
  comparisonSplitAfterColClass,
  comparisonSplitBeforeColClass,
  comparisonSplitRowGridClass,
  comparisonValueHintClass,
  reviewLabelClass,
} from "./review-section-styles";

/** "split": label on top, two columns (pre-grid markup, live panels). "grid": label | Before | After. */
export type ComparisonRowLayout = "split" | "grid";

const comparisonSplitRowRootClass = "py-2 space-y-3";

function valueLooksEmpty(value: string): boolean {
  return value === REVIEW_EMPTY_LABEL || value === "—" || value.trim() === "";
}

const yesNoRadioScaleClass = "inline-block scale-[0.88] origin-left";

function ComparisonYesNoCell({
  value,
  side,
  valuesDiffer,
  grid,
}: {
  value: boolean | null;
  side: "before" | "after";
  valuesDiffer: boolean;
  /** Grid layout only: let the cell shrink so long values wrap inside the column. */
  grid?: boolean;
}) {
  const shell = comparisonCellSurfaceShellClass;
  const changedHighlight =
    valuesDiffer &&
    (side === "before" ? comparisonSurfaceChangedBeforeClass : comparisonSurfaceChangedAfterClass);
  return (
    <div
      className={cn(
        shell,
        grid && "min-w-0",
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
  grid,
}: {
  value: string;
  side: "before" | "after";
  multiline?: boolean;
  valuesDiffer: boolean;
  /** Grid layout only: let the cell shrink so long values wrap inside the column. */
  grid?: boolean;
}) {
  const shell = multiline ? comparisonCellSurfaceMultilineShellClass : comparisonCellSurfaceShellClass;
  const strikeThrough = side === "before" && valuesDiffer && !valueLooksEmpty(value);
  const changedHighlight =
    valuesDiffer &&
    (side === "before" ? comparisonSurfaceChangedBeforeClass : comparisonSurfaceChangedAfterClass);
  const tone = side === "before" ? "text-muted-foreground" : "text-foreground";
  return (
    <div className={cn(shell, grid && "min-w-0", tone, changedHighlight)}>
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

/** Before/After value slot: stacked-only caption, the cell, then optional helper text. */
export function ComparisonSideSlot({
  side,
  hint,
  children,
}: {
  side: "before" | "after";
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <span className={comparisonSideCaptionClass}>{side === "before" ? "Before" : "After"}</span>
      {children}
      {hint ? <p className={comparisonValueHintClass}>{hint}</p> : null}
    </div>
  );
}

export { unknownToTriBool } from "@/lib/resubmit-comparison/shared-format";

/**
 * SECTION: Yes/No comparison row
 * WHY: Matches issuer/admin Yes–No radios instead of plain "Yes"/"No" text.
 * INPUT: label, before/after tri-bool, changed flag (aria only; highlight is value-based)
 * OUTPUT: Same grid as ComparisonFieldRow with YesNoRadioDisplay per column
 * WHERE USED: Business, contract, customer comparison when a field is yes/no
 */

export function ComparisonYesNoRadioRow({
  label,
  beforeValue,
  afterValue,
  changed,
  className,
  layout = "split",
}: {
  label: ReactNode;
  beforeValue: boolean | null;
  afterValue: boolean | null;
  changed: boolean;
  /** Layout override for the row root (e.g. drop the pl-3 indent inside an already indented body). */
  className?: string;
  /** Defaults to "split" (live markup); the resubmit comparison passes "grid". */
  layout?: ComparisonRowLayout;
}) {
  const valuesDiffer = beforeValue !== afterValue;
  const labelForAria = typeof label === "string" ? label : "Yes or no field";
  const ariaLabel =
    valuesDiffer || changed ? `${labelForAria}, values differ between revisions` : labelForAria;
  const beforeCell = (
    <ComparisonYesNoCell
      value={beforeValue}
      side="before"
      valuesDiffer={valuesDiffer}
      grid={layout === "grid"}
    />
  );
  const afterCell = (
    <ComparisonYesNoCell
      value={afterValue}
      side="after"
      valuesDiffer={valuesDiffer}
      grid={layout === "grid"}
    />
  );

  if (layout === "grid") {
    return (
      <div className={cn(comparisonRowGridClass, className)} role="row" aria-label={ariaLabel}>
        <p className={comparisonLabelColClass}>{label}</p>
        <ComparisonSideSlot side="before">{beforeCell}</ComparisonSideSlot>
        <ComparisonSideSlot side="after">{afterCell}</ComparisonSideSlot>
      </div>
    );
  }

  return (
    <div className={cn(comparisonSplitRowRootClass, className)} role="row" aria-label={ariaLabel}>
      <p className={reviewLabelClass}>{label}</p>
      <div className={comparisonSplitRowGridClass}>
        <div className={comparisonSplitBeforeColClass}>{beforeCell}</div>
        <div className={comparisonSplitAfterColClass}>{afterCell}</div>
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
  hint,
  className,
  layout = "split",
}: {
  label: string;
  before: string;
  after: string;
  changed: boolean;
  multiline?: boolean;
  /** Helper text shown once, under the After value. */
  hint?: string;
  /** Layout override for the row root (e.g. drop the pl-3 indent inside an already indented body). */
  className?: string;
  /** Defaults to "split" (live markup); the resubmit comparison passes "grid". */
  layout?: ComparisonRowLayout;
}) {
  const valuesDiffer = comparisonTextValuesDiffer(before, after);
  const ariaLabel = valuesDiffer || changed ? `${label}, values differ between revisions` : label;
  const beforeCell = (
    <ComparisonTextCell
      value={before}
      side="before"
      multiline={multiline}
      valuesDiffer={valuesDiffer}
      grid={layout === "grid"}
    />
  );
  const afterCell = (
    <ComparisonTextCell
      value={after}
      side="after"
      multiline={multiline}
      valuesDiffer={valuesDiffer}
      grid={layout === "grid"}
    />
  );

  if (layout === "grid") {
    return (
      <div className={cn(comparisonRowGridClass, className)} role="row" aria-label={ariaLabel}>
        <p className={comparisonLabelColClass}>{label}</p>
        <ComparisonSideSlot side="before">{beforeCell}</ComparisonSideSlot>
        <ComparisonSideSlot side="after" hint={hint}>
          {afterCell}
        </ComparisonSideSlot>
      </div>
    );
  }

  return (
    <div className={cn(comparisonSplitRowRootClass, className)} role="row" aria-label={ariaLabel}>
      <p className={reviewLabelClass}>{label}</p>
      <div className={comparisonSplitRowGridClass}>
        <div className={comparisonSplitBeforeColClass}>{beforeCell}</div>
        <div className={comparisonSplitAfterColClass}>
          {afterCell}
          {hint ? <p className={comparisonValueHintClass}>{hint}</p> : null}
        </div>
      </div>
    </div>
  );
}
