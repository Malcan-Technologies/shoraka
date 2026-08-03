"use client";

/**
 * Guide: docs/guides/application-flow/amendment-flow.md — Amendment remark card displayed per step when flagged
 * Uses CashSouk brand tokens (primary) for cohesive error/action-required state.
 */

import * as React from "react";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import {
  AMENDMENT_CALLOUT_BODY,
  AMENDMENT_CALLOUT_ICON_WRAP,
  AMENDMENT_CALLOUT_ROOT,
  AMENDMENT_CALLOUT_TITLE,
} from "./amendment-callout-styles";
import { AmendmentExpandableBulletList } from "./amendment-expandable-bullet-list";

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
      className={`${AMENDMENT_CALLOUT_ROOT} border-status-rejected-text/40 bg-status-rejected-bg text-foreground`}
    >
      <div
        className={`${AMENDMENT_CALLOUT_ICON_WRAP} border-status-rejected-text/40 bg-status-rejected-bg`}
        aria-hidden
      >
        <ExclamationTriangleIcon className="h-5 w-5 text-status-rejected-text" />
      </div>
      <div className={AMENDMENT_CALLOUT_BODY}>
        <p className={`${AMENDMENT_CALLOUT_TITLE} text-status-rejected-text`}>Amendment required</p>
        <AmendmentExpandableBulletList lines={lines} />
      </div>
    </div>
  );
}
