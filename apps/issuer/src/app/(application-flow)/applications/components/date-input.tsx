 "use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CalendarPopover } from "./calendar-popover";
import { parse, isValid, format, parseISO } from "date-fns";

type DateInputSize = "default" | "compact";

interface DateInputProps {
  value: string; // raw user text (e.g., "1/2/2025" or "" or iso)
  onChange: (v: string) => void;
  className?: string;
  inputClassName?: string;
  popoverClassName?: string;
  isInvalid?: boolean;
  defaultCalendarMonth?: Date;
  size?: DateInputSize;
  placeholder?: string;
  disabled?: boolean;
}

/** Size presets for responsive DateInput */
const sizePresets: Record<DateInputSize, {
  container: string;
  input: string;
  icon: string;
}> = {
  default: {
    container: "px-3 h-11 text-sm",
    input: "text-base",
    icon: "h-4 w-4",
  },
  compact: {
    container: "px-3 h-9 text-sm",
    input: "text-sm",
    icon: "h-3 w-3",
  },
};

export function DateInput({
  value,
  onChange,
  className,
  inputClassName,
  popoverClassName,
  isInvalid,
  defaultCalendarMonth,
  size = "default",
  placeholder,
  disabled,
}: DateInputProps) {
  const [open, setOpen] = React.useState(false);
  const preset = sizePresets[size];

  // If the provided value is ISO or a parseable d/M/yyyy, derive ISO for calendar selection only.
  let isoSelected: string | undefined = undefined;
  if (value) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      isoSelected = value;
    } else {
      try {
        const parsed = parse(value, "d/M/yyyy", new Date());
        if (isValid(parsed)) {
          isoSelected = format(parsed, "yyyy-MM-dd");
        }
      } catch {
        // ignore parse errors
      }
    }
  }

  const handleBlur = () => {
    if (!value) return;
    try {
      const parsed = parse(value, "d/M/yyyy", new Date());
      if (isValid(parsed)) {
        const normalized = format(parsed, "dd/MM/yyyy");
        if (normalized !== value) {
          onChange(normalized);
        }
      }
    } catch {
      // do nothing on parse failure
    }
  };

  /** Keep calendar open when using shadcn Select inside it (Select content is portaled to body). */
  const isFromNestedSelect = (target: EventTarget | null) => {
    const el = target instanceof HTMLElement ? target : null;
    if (!el) return false;
    return Boolean(
      el.closest("[data-radix-select-content]") ||
        el.closest("[data-radix-select-viewport]") ||
        el.closest("[data-slot='select-content']")
    );
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <div
          className={cn(
            "relative flex items-center rounded-xl border bg-background transition-colors",
            disabled ? "cursor-not-allowed bg-muted" : "cursor-text",
            preset.container,
            isInvalid && "border-destructive focus-within:border-2 focus-within:border-destructive",
            !isInvalid && "border-input focus-within:border-primary",
            className && !className.includes("border") && className
          )}
        >
          <input
            value={value}
            onChange={(e) => !disabled && onChange(e.target.value)}
            onBlur={handleBlur}
            placeholder={placeholder ?? "Enter date"}
            maxLength={10}
            readOnly={disabled}
            disabled={disabled}
            className={cn(
              "bg-transparent outline-none flex-1 placeholder:text-muted-foreground",
              preset.input,
              // reserve space for right icon
              size === "compact" ? "pr-8" : "pr-10",
              inputClassName
            )}
          />

          <button
            type="button"
            onClick={(e) => {
              if (disabled) return;
              e.stopPropagation();
              setOpen(true);
            }}
            disabled={disabled}
            className={cn(
              "absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors",
              size === "compact" ? "p-1" : "p-2"
            )}
            aria-label="Open calendar"
          >
            <CalendarIcon className={preset.icon} />
          </button>
        </div>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side="bottom"
          align="start"
          sideOffset={6}
          collisionPadding={8}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => {
            if (isFromNestedSelect(e.target)) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if (isFromNestedSelect(e.target)) e.preventDefault();
          }}
          className={cn("z-50", popoverClassName)}
        >
          <CalendarPopover
            selected={isoSelected}
            defaultMonth={defaultCalendarMonth}
            onSelect={(iso) => {
              try {
                const parsed = parseISO(iso);
                if (isValid(parsed)) {
                  const formatted = format(parsed, "dd/MM/yyyy");
                  onChange(formatted);
                } else {
                  onChange(iso);
                }
              } catch {
                onChange(iso);
              }
              setOpen(false);
            }}
          />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
