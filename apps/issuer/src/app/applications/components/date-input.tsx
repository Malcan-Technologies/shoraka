"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { CalendarIcon } from "@heroicons/react/24/outline";
import { CalendarPopover } from "./calendar-popover";
import { format, parseISO, isValid } from "date-fns";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@cashsouk/ui";

export function DateInput({
  id,
  value,
  onChange,
  placeholder,
  className,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  /**
   * Radix Popover-based DateInput
   *
   * Uses Radix UI Popover for proper anchoring.
   * - Automatically positions above/below based on viewport space
   * - Follows scroll naturally (not detached)
   * - No fixed positioning
   * - Portal-based to avoid overflow clipping
   */
  const [open, setOpen] = React.useState(false);

  const display = React.useMemo(() => {
    if (!value) return "";
    try {
      const d = parseISO(value);
      if (isValid(d)) {
        return format(d, "MMM d, yyyy");
      }
    } catch {
      return value;
    }
    return value;
  }, [value]);

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center justify-between w-full px-3 h-9 text-left rounded-md border border-input text-sm",
            className
          )}
          aria-expanded={open}
        >
          <span className={display ? "text-foreground truncate" : "text-muted-foreground"}>
            {display || placeholder || "Enter date"}
          </span>
          <CalendarIcon className="h-4 w-4 text-muted-foreground ml-2 shrink-0" />
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side="bottom"
          align="start"
          sideOffset={8}
          collisionPadding={8}
          className="z-50 w-[280px] rounded-lg border bg-card shadow-lg outline-none"
        >
          <CalendarPopover
            selected={value || undefined}
            onSelect={(iso) => {
              onChange(iso);
              setOpen(false);
            }}
          />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>

      {/* Hidden native input for form compatibility */}
      <Input id={id} type="hidden" value={value || ""} onChange={() => {}} className="hidden" />
    </PopoverPrimitive.Root>
  );
}
