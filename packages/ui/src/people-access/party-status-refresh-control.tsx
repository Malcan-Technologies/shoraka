"use client";

import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { cn } from "../lib/utils";

export function PartyStatusRefreshControl({
  busy,
  disabled,
  onRefresh,
}: {
  busy: boolean;
  disabled?: boolean;
  onRefresh: () => void;
}) {
  return (
    <button
      type="button"
      aria-label="Refresh status"
      disabled={disabled || busy}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (disabled || busy) return;
        onRefresh();
      }}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
    >
      <ArrowPathIcon className={cn("h-3.5 w-3.5", busy && "animate-spin")} aria-hidden />
    </button>
  );
}
