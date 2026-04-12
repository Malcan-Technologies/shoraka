"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { AMENDMENT_CALLOUT_CONTENT } from "./amendment-callout-styles";

const DEFAULT_MAX_ITEMS = 6;

type AmendmentExpandableBulletListProps = {
  lines: string[];
  /** Bullet rows before “Show more” (ignored when collapsible is false). */
  maxItemsWhenCollapsed?: number;
  /** When false, all lines render and no toggle is shown (e.g. modal uses outer scroll). */
  collapsible?: boolean;
  listClassName?: string;
  itemClassName?: string;
  emptyFallback?: string;
};

export function AmendmentExpandableBulletList({
  lines,
  maxItemsWhenCollapsed = DEFAULT_MAX_ITEMS,
  collapsible = true,
  listClassName,
  itemClassName,
  emptyFallback = "No details provided.",
}: AmendmentExpandableBulletListProps) {
  const [expanded, setExpanded] = React.useState(false);
  const safeLines = lines.length > 0 ? lines : [emptyFallback];
  const isEmpty = lines.length === 0;
  const needsToggle =
    collapsible && safeLines.length > maxItemsWhenCollapsed;
  const visibleLines =
    !collapsible || expanded || !needsToggle
      ? safeLines
      : safeLines.slice(0, maxItemsWhenCollapsed);
  const hiddenCount = safeLines.length - maxItemsWhenCollapsed;

  return (
    <div className="min-w-0">
      <ul
        className={cn(
          AMENDMENT_CALLOUT_CONTENT,
          "list-disc space-y-1.5 pl-4 text-foreground",
          isEmpty && "text-muted-foreground",
          listClassName
        )}
      >
        {visibleLines.map((line, idx) => (
          <li key={idx} className={cn("break-words whitespace-pre-wrap", itemClassName)}>
            {line}
          </li>
        ))}
      </ul>
      {needsToggle ? (
        <button
          type="button"
          className="mt-2 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
        >
          {expanded ? "Show less" : `Show more (${hiddenCount})`}
        </button>
      ) : null}
    </div>
  );
}
