"use client";

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
    <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 flex gap-3">
      <ExclamationTriangleIcon className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
      <div>
        <h4 className="font-semibold text-destructive">Amendment required</h4>
        <ul className="mt-2 pl-4 list-disc text-sm text-muted-foreground">
          {lines.map((line, idx) => (
            <li key={idx}>{line}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
