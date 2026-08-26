"use client";

import { useId, type ReactNode } from "react";
import { ListToolbarFilterTrigger } from "@cashsouk/ui";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export const AUDIT_DATE_RANGE_OPTIONS = [
  { value: "all", label: "All time" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
] as const;

export function AuditLogFilters({
  activeCount,
  children,
}: {
  activeCount: number;
  children: ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <ListToolbarFilterTrigger label="Filters" count={activeCount} />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-0">
        <div className="max-h-[min(24rem,70vh)] overflow-y-auto py-1">{children}</div>
      </PopoverContent>
    </Popover>
  );
}

export function AuditLogFilterSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-border px-2 py-2 last:border-b-0">
      <p className="px-2 pb-1.5 text-meta font-medium text-muted-foreground">{title}</p>
      {children}
    </section>
  );
}

export function AuditLogFilterOption({
  selected,
  onSelect,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center rounded-md px-2 py-1.5 text-left text-ui",
        selected ? "bg-accent text-accent-foreground" : "hover:bg-muted"
      )}
      onClick={onSelect}
    >
      {children}
    </button>
  );
}

export function AuditLogDateRangeOptions({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <AuditLogFilterSection title="Date">
      {AUDIT_DATE_RANGE_OPTIONS.map((option) => (
        <AuditLogFilterOption
          key={option.value}
          selected={value === option.value}
          onSelect={() => onChange(option.value)}
        >
          {option.label}
        </AuditLogFilterOption>
      ))}
    </AuditLogFilterSection>
  );
}

export function AuditLogDateFields({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
}: {
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
}) {
  const fromId = useId();
  const toId = useId();

  return (
    <div className="space-y-2 px-2 py-1">
      <div className="space-y-1">
        <label className="text-meta text-muted-foreground" htmlFor={fromId}>
          From
        </label>
        <Input
          id={fromId}
          type="date"
          value={dateFrom}
          onChange={(event) => onDateFromChange(event.target.value)}
          className="h-10 rounded-xl bg-card"
        />
      </div>
      <div className="space-y-1">
        <label className="text-meta text-muted-foreground" htmlFor={toId}>
          To
        </label>
        <Input
          id={toId}
          type="date"
          value={dateTo}
          onChange={(event) => onDateToChange(event.target.value)}
          className="h-10 rounded-xl bg-card"
        />
      </div>
    </div>
  );
}
