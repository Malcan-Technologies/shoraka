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

/** Small calendar popover
 *
 * Props:
 * - selected: optional ISO string (yyyy-MM-dd)
 * - onSelect: (isoString) => void
 */
export function CalendarPopover({
  selected,
  onSelect,
}: {
  selected?: string;
  onSelect: (iso: string) => void;
}) {
  const initialMonth = React.useMemo(() => (selected ? parseISO(selected) : new Date()), [selected]);
  const [currentMonth, setCurrentMonth] = React.useState<Date>(initialMonth);

  React.useEffect(() => {
    if (selected) setCurrentMonth(parseISO(selected));
  }, [selected]);

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

  return (
    <div className="w-[280px] rounded-lg border bg-card shadow-lg z-50">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <button
          type="button"
          className="p-1 rounded hover:bg-muted/50"
          onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
        >
          ‹
        </button>
        <div className="text-sm font-semibold">{format(currentMonth, "MMMM yyyy")}</div>
        <button
          type="button"
          className="p-1 rounded hover:bg-muted/50"
          onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
        >
          ›
        </button>
      </div>
      <div className="p-3 space-y-2">
        <div className="grid grid-cols-7 gap-1 text-xs font-medium text-muted-foreground pb-2 border-b">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
            <div key={d} className="text-center h-6 flex items-center justify-center">{d}</div>
          ))}
        </div>
        <div className="space-y-1">
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-1">
              {week.map((day) => {
                const iso = format(day, "yyyy-MM-dd");
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isSelected = selected ? isSameDay(parseISO(selected), day) : false;
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => onSelect(iso)}
                    className={`h-8 w-8 rounded text-sm font-medium ${
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

