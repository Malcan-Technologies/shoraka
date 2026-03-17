"use client";

/**
 * Consistent filename display across application flow.
 * Compact badge style (width based on filename), native browser title for full name on hover.
 */
import * as React from "react";
import { CheckIcon as CheckIconSolid } from "@heroicons/react/24/solid";

export function FileDisplayBadge({
  fileName,
  className,
  trailing,
  size = "default",
  truncate = true,
}: {
  fileName: string;
  className?: string;
  trailing?: React.ReactNode;
  size?: "default" | "sm";
  /** When false, filename expands to show full (for supporting docs, legal docs). Tables use truncate. */
  truncate?: boolean;
}) {
  const textClass = size === "sm" ? "text-xs" : "text-[14px]";
  const iconSize = size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5";
  const boxSize = size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5";
  const height = size === "sm" ? "h-8" : "h-6";

  return (
    <div
      title={fileName}
      className={`inline-flex items-center gap-2 border border-border rounded-sm px-2 py-[2px] ${height} ${truncate ? "min-w-0 max-w-full overflow-hidden" : ""} ${className ?? ""}`}
    >
      <div className={`${boxSize} rounded-sm bg-foreground flex items-center justify-center shrink-0`}>
        <CheckIconSolid className={`${iconSize} text-background`} />
      </div>
      <span className={`${textClass} font-medium ${truncate ? "truncate min-w-0" : ""}`}>{fileName}</span>
      {trailing}
    </div>
  );
}
