"use client";

import * as React from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  format,
  isSameMonth,
  isSameDay,
  parseISO,
} from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Small calendar popover
 *
 * Props:
 * - selected: optional ISO string (yyyy-MM-dd)
 * - onSelect: (isoString) => void
 */
export function CalendarPopover({
  selected,
  onSelect,
  defaultMonth,
}: {
  selected?: string;
  onSelect: (iso: string) => void;
  defaultMonth?: Date;
}) {
  const initialMonth = React.useMemo(() => {
    if (selected) return parseISO(selected);
    if (defaultMonth) return defaultMonth;
    return new Date();
  }, [selected, defaultMonth]);

  const [currentMonth, setCurrentMonth] = React.useState<Date>(initialMonth);

  React.useEffect(() => {
    if (selected) setCurrentMonth(parseISO(selected));
  }, [selected]);

  const nowY = new Date().getFullYear();
  const viewY = currentMonth.getFullYear();
  const yearMin = Math.min(nowY - 30, viewY);
  const yearMax = Math.max(nowY + 5, viewY);
  const yearOptions = React.useMemo(() => {
    const out: number[] = [];
    for (let y = yearMin; y <= yearMax; y++) out.push(y);
    return out;
  }, [yearMin, yearMax]);

  const start = startOfWeek(startOfMonth(currentMonth));
  const end = endOfWeek(endOfMonth(currentMonth));

  const weeks: Date[][] = [];
  let cursor = start;
  while (cursor <= end) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(cursor);
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }

  const selectContentClass =
    "z-[60] max-h-52 min-w-[var(--radix-select-trigger-width)] sm:min-w-0";

  return (
    <div className="w-[220px] rounded-lg border bg-card shadow-lg z-50">
      <div className="flex items-center gap-0.5 px-0.5 py-1 border-b">
        <button
          type="button"
          className="p-1 rounded shrink-0 hover:bg-muted/50"
          onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
        >
          ‹
        </button>
        <div className="flex items-center gap-0.5 flex-1 min-w-0">
          <Select
            value={String(currentMonth.getMonth())}
            onValueChange={(v) => {
              const m = Number(v);
              setCurrentMonth(new Date(currentMonth.getFullYear(), m, 1));
            }}
          >
            <SelectTrigger
              className="h-8 flex-1 min-w-0 px-1.5 text-xs border-0 shadow-none bg-transparent focus:ring-1 focus:ring-primary/30 [&>span]:truncate"
              aria-label="Month"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" className={selectContentClass}>
              {Array.from({ length: 12 }).map((_, i) => (
                <SelectItem key={i} value={String(i)} className="text-xs">
                  {format(new Date(2000, i, 1), "MMM")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(currentMonth.getFullYear())}
            onValueChange={(v) => {
              const y = Number(v);
              setCurrentMonth(new Date(y, currentMonth.getMonth(), 1));
            }}
          >
            <SelectTrigger
              className="h-8 w-[4.25rem] shrink-0 px-1 text-xs border-0 shadow-none bg-transparent focus:ring-1 focus:ring-primary/30"
              aria-label="Year"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" className={selectContentClass}>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)} className="text-xs font-mono tabular-nums">
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <button
          type="button"
          className="p-1 rounded shrink-0 hover:bg-muted/50"
          onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
        >
          ›
        </button>
      </div>
      <div className="p-1 space-y-1">
        <div className="grid grid-cols-7 gap-0.5 text-[11px] font-medium text-muted-foreground pb-1 border-b">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
            <div key={d} className="text-center h-5 flex items-center justify-center">
              {d}
            </div>
          ))}
        </div>
        <div className="space-y-0.5">
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-0.5" style={{ gridAutoRows: "28px" }}>
              {week.map((day) => {
                const iso = format(day, "yyyy-MM-dd");
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isSelected = selected ? isSameDay(parseISO(selected), day) : false;
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => onSelect(iso)}
                    className={`h-7 w-7 rounded text-[11px] font-medium ${
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : isCurrentMonth
                          ? "text-foreground hover:bg-muted/50"
                          : "text-muted-foreground/40"
                    }`}
                  >
                    {format(day, "d")}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
