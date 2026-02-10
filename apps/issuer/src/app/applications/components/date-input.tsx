"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { CalendarIcon } from "@heroicons/react/24/outline";
import { CalendarPopover } from "./calendar-popover";
import { format, parseISO, isValid } from "date-fns";

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
   * Popover calendar DateInput
   *
   * Shows a button with formatted date and a calendar icon.
   * Clicking opens an inline popover calendar (CalendarPopover) that lets user pick a date.
   * This matches the invoice.html visual with a calendar popover.
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

  const containerRef = React.useRef<HTMLDivElement>(null);
  const [popoverPos, setPopoverPos] = React.useState({ top: 0, left: 0 });

  React.useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  React.useEffect(() => {
    if (!open || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scrollTop = window.scrollY;
    const scrollLeft = window.scrollX;
    
    // Position calendar below button, with max-height check for viewport
    const topPos = rect.bottom + scrollTop + 8; // 8px gap
    const leftPos = rect.left + scrollLeft;
    
    // Adjust if going off-screen to the right
    const adjustedLeft = Math.max(0, Math.min(leftPos, window.innerWidth - 300));
    
    setPopoverPos({ top: topPos, left: adjustedLeft });
  }, [open]);

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center justify-between w-full px-3 h-9 text-left rounded-md border border-input text-sm ${className ?? ""}`}
        aria-expanded={open}
      >
        <span className={display ? "text-foreground truncate" : "text-muted-foreground"}>
          {display || placeholder || "Enter date"}
        </span>
        <CalendarIcon className="h-4 w-4 text-muted-foreground ml-2 shrink-0" />
      </button>

      {open && (
        <div className="fixed z-50" style={{ top: `${popoverPos.top}px`, left: `${popoverPos.left}px` }}>
          <CalendarPopover
            selected={value || undefined}
            onSelect={(iso) => {
              onChange(iso);
              setOpen(false);
            }}
          />
        </div>
      )}
      {/* Hidden native input for form compatibility */}
      <Input id={id} type="hidden" value={value || ""} onChange={() => {}} className="hidden" />
    </div>
  );
}

