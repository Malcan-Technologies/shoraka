import * as React from "react";
import { cn } from "../lib/utils";

export type StickyFormFooterSaveState = "idle" | "unsaved" | "saved" | "saving";

export interface StickyFormFooterProps
  extends React.HTMLAttributes<HTMLElement> {
  back?: React.ReactNode;
  primary?: React.ReactNode;
  saveState?: StickyFormFooterSaveState;
  saveStateLabel?: string;
}

const SAVE_STATE_LABELS: Record<StickyFormFooterSaveState, string> = {
  idle: "",
  unsaved: "Unsaved changes",
  saved: "All changes saved",
  saving: "Saving…",
};

export function StickyFormFooter({
  back,
  primary,
  saveState = "idle",
  saveStateLabel,
  className,
  ...props
}: StickyFormFooterProps) {
  const label = saveStateLabel ?? SAVE_STATE_LABELS[saveState];

  return (
    <footer
      className={cn(
        "sticky bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="shrink-0">{back}</div>
        <div
          className={cn(
            "min-w-0 flex-1 text-center text-ui",
            saveState === "unsaved" && "text-status-action-text",
            saveState === "saved" && "text-status-success-text",
            saveState === "saving" && "text-muted-foreground",
            saveState === "idle" && "text-muted-foreground"
          )}
          aria-live="polite"
        >
          {label}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {primary}
        </div>
      </div>
    </footer>
  );
}
