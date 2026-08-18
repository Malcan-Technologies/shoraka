"use client";

import * as React from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { cn } from "../lib/utils";
import { Button } from "./button";

export interface FilterChip {
  id: string;
  label: string;
  onRemove: () => void;
}

export interface FilterChipsProps extends React.HTMLAttributes<HTMLDivElement> {
  chips: FilterChip[];
  onClearAll?: () => void;
  clearAllLabel?: string;
}

export function FilterChips({
  chips,
  onClearAll,
  clearAllLabel = "Clear all",
  className,
  ...props
}: FilterChipsProps) {
  if (chips.length === 0) return null;

  return (
    <div
      className={cn("flex flex-wrap items-center gap-2", className)}
      {...props}
    >
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          onClick={chip.onRemove}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 text-ui text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span>{chip.label}</span>
          <XMarkIcon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <span className="sr-only">Remove {chip.label}</span>
        </button>
      ))}
      {onClearAll ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className="px-2 text-muted-foreground"
        >
          {clearAllLabel}
        </Button>
      ) : null}
    </div>
  );
}
