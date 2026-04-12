"use client";

/**
 * Guide: docs/guides/application-flow/amendment-flow.md — Amendment remark card displayed per step when flagged
 * Uses CashSouk brand tokens (primary) for cohesive error/action-required state.
 */

import * as React from "react";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import {
  AMENDMENT_CALLOUT_BODY,
  AMENDMENT_CALLOUT_CONTENT,
  AMENDMENT_CALLOUT_ICON_WRAP,
  AMENDMENT_CALLOUT_ROOT,
  AMENDMENT_CALLOUT_TITLE,
} from "./amendment-callout-styles";

/** Default intro line shown when step is flagged for amendment */
const DEFAULT_INTRO = "This section requires amendments before it can be approved.";

interface AmendmentRemarkCardProps {
  remarks: string[];
  /** If true, prepend default intro as first bullet */
  showDefaultIntro?: boolean;
}

/**
 * Top card shown when a step has amendment remarks.
 * Renders "Amendment required" with bullet list of remark lines.
 */
export function AmendmentRemarkCard({ remarks, showDefaultIntro = true }: AmendmentRemarkCardProps) {
  const lines = React.useMemo(() => {
    const fromRemarks = remarks.flatMap((r) => (r || "").split("\n").filter(Boolean));
    if (showDefaultIntro) {
      return [DEFAULT_INTRO, ...fromRemarks];
    }
    return fromRemarks;
  }, [remarks, showDefaultIntro]);

  if (lines.length === 0) return null;

  return (
    <div
      className={`${AMENDMENT_CALLOUT_ROOT} border-primary/55 bg-primary/10 text-foreground`}
    >
      <div
        className={`${AMENDMENT_CALLOUT_ICON_WRAP} bg-primary/20 border-primary/45`}
        aria-hidden
      >
        <ExclamationTriangleIcon className="h-5 w-5 text-primary" />
      </div>
      <div className={AMENDMENT_CALLOUT_BODY}>
        <p className={`${AMENDMENT_CALLOUT_TITLE} text-primary`}>Amendment required</p>
        <ul className={`${AMENDMENT_CALLOUT_CONTENT} pl-4 list-disc space-y-1.5 text-foreground`}>
          {lines.map((line, idx) => (
            <li key={idx}>{line}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
