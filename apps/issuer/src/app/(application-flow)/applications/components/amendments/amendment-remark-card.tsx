"use client";

/**
 * Guide: docs/guides/application-flow/amendment-flow.md — Amendment remark card displayed per step when flagged
 * Uses CashSouk brand tokens (primary) for cohesive error/action-required state.
 */

import * as React from "react";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

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
    <div className="rounded-xl border-2 border-primary/55 bg-primary/10 p-4 sm:p-5 flex gap-3 sm:gap-4 shadow-sm">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20 border-2 border-primary/45"
        aria-hidden
      >
        <ExclamationTriangleIcon className="h-5 w-5 text-primary" />
      </div>
      <div className="min-w-0 pt-0.5">
        <p className="font-semibold text-primary text-[15px] sm:text-base leading-snug tracking-tight">
          Amendment required
        </p>
        <ul className="mt-2 pl-4 list-disc text-sm sm:text-[15px] text-foreground leading-6 sm:leading-7">
          {lines.map((line, idx) => (
            <li key={idx}>{line}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
