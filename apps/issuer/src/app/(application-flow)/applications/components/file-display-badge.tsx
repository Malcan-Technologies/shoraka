"use client";

/**
 * Consistent filename display across application flow (invoice, supporting docs, review).
 * Rounded-xl chip; success mark is Sonner’s built-in success SVG at toast `[data-icon]` size.
 */
import * as React from "react";
import { cn } from "@/lib/utils";
import { formLockedFileSurfaceClassName } from "@/app/(application-flow)/applications/components/form-control";
import { SonnerSuccessIcon } from "@/components/ui/sonner-success-icon";

/**
 * Icon slot matches Sonner styled toast `[data-icon]`: 16×16 (see sonner dist/styles.css).
 */
const SIZE_STYLES = {
  sm: {
    row: "h-9 gap-1.5 px-2 py-1",
    iconSlot: "h-4 w-4",
    text: "text-xs",
  },
  default: {
    row: "h-9 gap-2 px-2.5 py-1",
    iconSlot: "h-4 w-4",
    text: "text-sm",
  },
  xs: {
    row: "h-6 gap-1 px-1.5 py-px",
    iconSlot: "h-3.5 w-3.5",
    text: "text-[10px]",
  },
} as const;

export function FileDisplayBadge({
  fileName,
  className,
  trailing,
  size = "default",
  truncate = true,
  maxChars,
  /** Shrink-to-fit chip (supporting docs); long names ellipsis inside a max width. */
  inlineChip = false,
  /** View-only / locked step: muted chip (no strong check contrast). */
  locked = false,
}: {
  fileName: string;
  className?: string;
  trailing?: React.ReactNode;
  size?: keyof typeof SIZE_STYLES;
  /** When false, filename expands to show full (for supporting docs, legal docs). Tables use truncate. */
  truncate?: boolean;
  /** Optional hard text cap before CSS truncation (e.g. 40 chars). */
  maxChars?: number;
  inlineChip?: boolean;
  locked?: boolean;
}) {
  const s = SIZE_STYLES[size];

  const displayedFileName =
    truncate &&
    !inlineChip &&
    typeof maxChars === "number" &&
    maxChars > 0 &&
    fileName.length > maxChars
      ? `${fileName.slice(0, Math.max(0, maxChars - 1))}…`
      : fileName;

  return (
    <div
      title={fileName}
      className={cn(
        "items-center border border-input bg-background rounded-xl",
        inlineChip ? "flex" : "inline-flex",
        s.row,
        "min-w-0 max-w-full overflow-hidden",
        locked && formLockedFileSurfaceClassName,
        className
      )}
    >
      <div
        className={cn(
          s.iconSlot,
          "flex shrink-0 items-center justify-center text-foreground",
          locked && "text-muted-foreground"
        )}
      >
        <SonnerSuccessIcon className="h-full w-full" />
      </div>
      <span
        className={cn(
          s.text,
          "font-medium block leading-tight",
          truncate && "min-w-0 flex-1 truncate",
          locked && "text-muted-foreground"
        )}
      >
        {displayedFileName}
      </span>
      {trailing ? (
        <span className="inline-flex shrink-0 items-center">{trailing}</span>
      ) : null}
    </div>
  );
}
