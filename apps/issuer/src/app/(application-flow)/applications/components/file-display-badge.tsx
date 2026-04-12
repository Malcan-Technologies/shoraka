"use client";

/**
 * Consistent filename display across application flow.
 * Compact badge style (width based on filename), native browser title for full name on hover.
 * Matches invoice / review: rounded-xl border, check chip, optional trailing (e.g. remove).
 */
import * as React from "react";
import { CheckIcon as CheckIconSolid } from "@heroicons/react/24/solid";
import { cn } from "@/lib/utils";

export function FileDisplayBadge({
  fileName,
  className,
  trailing,
  size = "default",
  truncate = true,
  maxChars,
}: {
  fileName: string;
  className?: string;
  trailing?: React.ReactNode;
  size?: "default" | "sm" | "xs";
  /** When false, filename expands to show full (for supporting docs, legal docs). Tables use truncate. */
  truncate?: boolean;
  /** Optional hard text cap before CSS truncation (e.g. 40 chars). */
  maxChars?: number;
}) {
  const textClass =
    size === "xs" ? "text-[10px]" : size === "sm" ? "text-xs" : "text-[14px]";
  const iconSize = size === "xs" ? "h-1.5 w-1.5" : size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5";
  const boxSize = size === "xs" ? "w-2.5 h-2.5" : size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5";
  const height = size === "xs" ? "h-6" : size === "sm" ? "h-8" : "h-6";
  const gapClass = size === "xs" ? "gap-1.5" : "gap-2";
  const padClass = size === "xs" ? "px-1.5 py-[1px]" : "px-2 py-[2px]";

  const displayedFileName =
    truncate && typeof maxChars === "number" && maxChars > 0 && fileName.length > maxChars
      ? `${fileName.slice(0, Math.max(0, maxChars - 1))}…`
      : fileName;

  return (
    <div
      title={fileName}
      className={cn(
        "inline-flex items-center border border-input bg-background rounded-xl",
        gapClass,
        padClass,
        height,
        truncate && "min-w-0 max-w-full overflow-hidden",
        className
      )}
    >
      <div className={`${boxSize} rounded-sm bg-foreground flex items-center justify-center shrink-0`}>
        <CheckIconSolid className={`${iconSize} text-background`} />
      </div>
      <span className={`${textClass} font-medium ${truncate ? "truncate min-w-0" : ""}`}>
        {displayedFileName}
      </span>
      {trailing}
    </div>
  );
}
