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
    <div className="w-[200px] rounded-lg border bg-card shadow-lg z-50">
      <div className="flex items-center justify-between px-1 py-1 border-b">
        <button
          type="button"
          className="p-1 rounded hover:bg-muted/50"
          onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
        >
          ‹
        </button>
        <div className="flex items-center gap-2">
          <select
            value={currentMonth.getMonth()}
            onChange={(e) => {
              const m = Number(e.target.value);
              setCurrentMonth(new Date(currentMonth.getFullYear(), m, 1));
            }}
            className="bg-transparent text-xs"
          >
            {Array.from({ length: 12 }).map((_, i) => (
              <option key={i} value={i}>
                {format(new Date(2000, i, 1), "LLLL")}
              </option>
            ))}
          </select>
          <select
            value={currentMonth.getFullYear()}
            onChange={(e) => {
              const y = Number(e.target.value);
              setCurrentMonth(new Date(y, currentMonth.getMonth(), 1));
            }}
            className="bg-transparent text-xs"
          >
            {Array.from({ length: 201 }).map((_, idx) => {
              const y = 1900 + idx;
              return (
                <option key={y} value={y}>
                  {y}
                </option>
              );
            })}
          </select>
        </div>
        <button
          type="button"
          className="p-1 rounded hover:bg-muted/50"
          onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
        >
          ›
        </button>
      </div>
      <div className="p-1 space-y-1">
        <div className="grid grid-cols-7 gap-0.5 text-[11px] font-medium text-muted-foreground pb-1 border-b">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
            <div key={d} className="text-center h-5 flex items-center justify-center">{d}</div>
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
                    className={`h-7 w-7 rounded text-[11px] font-medium ${isSelected
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

