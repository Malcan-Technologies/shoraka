"use client";

import * as React from "react";
import { parse, isValid, format } from "date-fns";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CalendarPopover } from "./calendar-popover";

type DateInputSize = "default" | "compact";

interface DateInputProps {
  value: string; // yyyy-MM-dd
  onChange: (v: string) => void;
  className?: string;
  isInvalid?: boolean;
  defaultCalendarMonth?: Date;
  size?: DateInputSize;
  onLocalValueChange?: (day: string, month: string, year: string) => void;
}

/** Size presets for responsive DateInput */
const sizePresets: Record<DateInputSize, {
  container: string;
  text: string;
  input: string;
  icon: string;
}> = {
  default: {
    container: "px-3 h-11 text-sm",
    text: "px-1",
    input: "text-base",
    icon: "h-4 w-4",
  },
  compact: {
    container: "px-2 h-8 text-xs",
    text: "px-0.5",
    input: "text-xs",
    icon: "h-3 w-3",
  },
};

export function DateInput({
  value,
  onChange,
  className,
  isInvalid,
  defaultCalendarMonth,
  size = "default",
  onLocalValueChange,
}: DateInputProps) {
  const [day, setDay] = React.useState("");
  const [month, setMonth] = React.useState("");
  const [year, setYear] = React.useState("");
  const [open, setOpen] = React.useState(false);

  const preset = sizePresets[size];

  /** Load value from parent into inputs */
  React.useEffect(() => {
    if (!value) {
      setDay("");
      setMonth("");
      setYear("");
      return;
    }

    const [y, m, d] = value.split("-");
    setDay(d || "");
    setMonth(m || "");
    setYear(y || "");
  }, [value]);

  /** Validate date logic: parses and checks if it's a valid calendar date */
  const isValidDate = (d: string, m: string, y: string): boolean => {
    if (d.length !== 2 || m.length !== 2 || y.length !== 4) return false;

    const formatted = `${d}/${m}/${y}`;
    const parsed = parse(formatted, "dd/MM/yyyy", new Date());

    // isValid checks if parsed date is a real date
    // format check ensures no overflow (e.g., Feb 31 becomes Mar 3)
    if (!isValid(parsed)) return false;
    if (format(parsed, "dd/MM/yyyy") !== formatted) return false;

    return true;
  };

  /** Emit ISO only when full valid date */
  const tryEmitDate = (d: string, m: string, y: string) => {
    if (isValidDate(d, m, y)) {
      const parsed = parse(`${d}/${m}/${y}`, "dd/MM/yyyy", new Date());
      onChange(format(parsed, "yyyy-MM-dd"));
    }
  };

  /** Pad single digits with 0 on blur */
  const padIfSingleDigit = (v: string) =>
    v.length === 1 ? `0${v}` : v;

  const handleBlur = () => {
    const paddedDay = padIfSingleDigit(day);
    const paddedMonth = padIfSingleDigit(month);

    setDay(paddedDay);
    setMonth(paddedMonth);

    // Notify parent of current local state (even if invalid)
    if (onLocalValueChange) {
      onLocalValueChange(paddedDay, paddedMonth, year);
    }

    tryEmitDate(paddedDay, paddedMonth, year);
  };

  /** Input handlers: only allow digits and enforce max length */
const handleDay = (v: string) => {
  if (!/^\d*$/.test(v) || v.length > 2) return;

  if (v.length === 1) {
    if (Number(v) > 3) return; // first digit max 3
  }

  if (v.length === 2) {
    const first = Number(v[0]);
    const second = Number(v[1]);

    if (first === 0 && second === 0) return; // block 00
    if (first === 3 && second > 1) return;   // block 32–39
    if (Number(v) > 31) return;
  }

  setDay(v);
};


const handleMonth = (v: string) => {
  if (!/^\d*$/.test(v) || v.length > 2) return;

  if (v.length === 1) {
    if (Number(v) > 1) return; // first digit max 1
  }

  if (v.length === 2) {
    const first = Number(v[0]);
    const second = Number(v[1]);

    if (first === 0 && second === 0) return; // block 00
    if (first === 1 && second > 2) return;   // block 13–19
    if (Number(v) > 12) return;
  }

  setMonth(v);
};


const handleYear = (v: string) => {
  if (!/^\d*$/.test(v) || v.length > 4) return;
  setYear(v);
};


  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <div
          className={cn(
            "flex items-center rounded-xl border bg-background transition-colors cursor-text",
            isInvalid ? "border-destructive" : "border-input",
            preset.container,
            className
          )}
        >
          <input
            value={day}
            onChange={(e) => handleDay(e.target.value)}
            onBlur={handleBlur}
            placeholder="DD"
            className={cn(
              "w-6 text-center bg-transparent outline-none",
              preset.input
            )}
          />

          <span className={cn("text-muted-foreground", preset.text)}>/</span>

          <input
            value={month}
            onChange={(e) => handleMonth(e.target.value)}
            onBlur={handleBlur}
            placeholder="MM"
            className={cn(
              "w-6 text-center bg-transparent outline-none",
              preset.input
            )}
          />

          <span className={cn("text-muted-foreground", preset.text)}>/</span>

          <input
            value={year}
            onChange={(e) => handleYear(e.target.value)}
            onBlur={handleBlur}
            placeholder="YYYY"
            className={cn(
              "w-10 text-center bg-transparent outline-none",
              preset.input
            )}
          />

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(true);
            }}
            className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
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
          className="z-50"
        >
          <CalendarPopover
            selected={value || undefined}
            defaultMonth={defaultCalendarMonth}
            onSelect={(iso) => {
              onChange(iso);
              setOpen(false);
            }}
          />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
