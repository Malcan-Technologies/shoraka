"use client";

import * as React from "react";
import { parse, isValid, format } from "date-fns";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CalendarPopover } from "./calendar-popover"; // adjust path if needed

export function DateInput({
  value,
  onChange,
  className,
}: {
  value: string; // ISO yyyy-MM-dd
  onChange: (v: string) => void;
  className?: string;
}) {
  const [day, setDay] = React.useState("");
  const [month, setMonth] = React.useState("");
  const [year, setYear] = React.useState("");
  const [open, setOpen] = React.useState(false);

  const dayRef = React.useRef<HTMLInputElement>(null);
  const monthRef = React.useRef<HTMLInputElement>(null);
  const yearRef = React.useRef<HTMLInputElement>(null);

  /* ============================================================
     Sync ISO value → segmented fields
     ============================================================ */
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

  /* ============================================================
     Emit ISO when full valid date
     ============================================================ */
  const tryEmitDate = (d: string, m: string, y: string) => {
    if (d.length === 2 && m.length === 2 && y.length === 4) {
      const formatted = `${d}/${m}/${y}`;
      const parsed = parse(formatted, "dd/MM/yyyy", new Date());

      if (isValid(parsed) && format(parsed, "dd/MM/yyyy") === formatted) {
        onChange(format(parsed, "yyyy-MM-dd"));
      }
    }
  };

  /* ============================================================
     Handlers
     ============================================================ */
  const handleDay = (v: string) => {
    if (!/^\d*$/.test(v) || v.length > 2) return;
    setDay(v);
    if (v.length === 2) monthRef.current?.focus();
    tryEmitDate(v, month, year);
  };

  const handleMonth = (v: string) => {
    if (!/^\d*$/.test(v) || v.length > 2) return;
    setMonth(v);
    if (v.length === 2) yearRef.current?.focus();
    tryEmitDate(day, v, year);
  };

  const handleYear = (v: string) => {
    if (!/^\d*$/.test(v) || v.length > 4) return;
    setYear(v);
    tryEmitDate(day, month, v);
  };

  const handleBackspace =
  (current: string, prevRef?: React.RefObject<HTMLInputElement | null>) =>
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace" && current.length === 0) {
        prevRef?.current?.focus();
      }
    };

  /* ============================================================
     Render
     ============================================================ */
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <div
          className={cn(
            "flex items-center px-3 h-9 rounded-md border border-input bg-background text-sm",
            className
          )}
        >
          <input
            ref={dayRef}
            value={day}
            onChange={(e) => handleDay(e.target.value)}
            onFocus={(e) => e.target.select()}
            onKeyDown={handleBackspace(day)}
            placeholder="DD"
            className="w-6 text-center bg-transparent outline-none"
          />

          <span className="px-1 text-muted-foreground">/</span>

          <input
            ref={monthRef}
            value={month}
            onChange={(e) => handleMonth(e.target.value)}
            onFocus={(e) => e.target.select()}
            onKeyDown={handleBackspace(month, dayRef)}
            placeholder="MM"
            className="w-6 text-center bg-transparent outline-none"
          />

          <span className="px-1 text-muted-foreground">/</span>

          <input
            ref={yearRef}
            value={year}
            onChange={(e) => handleYear(e.target.value)}
            onFocus={(e) => e.target.select()}
            onKeyDown={handleBackspace(year, monthRef)}
            placeholder="YYYY"
            className="w-10 text-center bg-transparent outline-none"
          />

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(true);
            }}
            className="ml-auto text-muted-foreground"
          >
            <CalendarIcon className="h-4 w-4" />
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
