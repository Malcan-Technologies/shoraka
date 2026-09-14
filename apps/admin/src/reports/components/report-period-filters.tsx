"use client";

import * as React from "react";
import {
  REPORT_AS_OF_PRESET_LABELS,
  REPORT_AS_OF_PRESETS,
  REPORT_BREAKDOWN_LABELS,
  REPORT_RANGE_PRESET_LABELS,
  REPORT_RANGE_PRESETS,
  matchReportAsOfPreset,
  matchReportRangePreset,
  resolveReportAsOfPreset,
  resolveReportRangePreset,
  todayMytYmd,
  type ReportAsOfPreset,
  type ReportDefinition,
  type ReportQuery,
  type ReportRangePreset,
} from "@cashsouk/types";
import { ListToolbar, ListToolbarFilterTrigger, type FilterChip } from "@cashsouk/ui";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  defaultReportQuery,
  isDefaultPeriodQuery,
  reportBreakdownChipLabel,
  reportFilterKind,
  reportPeriodChipLabel,
  validateCustomAsOf,
  validateCustomRange,
} from "@/reports/utils/report-period-filters";

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-border px-2 py-2 last:border-b-0">
      <p className="px-2 pb-1.5 text-meta font-medium text-muted-foreground">{title}</p>
      {children}
    </section>
  );
}

function FilterOption({
  selected,
  onSelect,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
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

export function ReportPeriodFilters({
  definition,
  query,
  onQueryChange,
  onReload,
  isLoading,
  rowCount,
  children,
}: {
  definition: ReportDefinition;
  query: ReportQuery;
  onQueryChange: (query: ReportQuery) => void;
  onReload?: () => void;
  isLoading?: boolean;
  rowCount?: number;
  children?: React.ReactNode;
}) {
  const kind = reportFilterKind(definition);
  const today = todayMytYmd();
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(query);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) setDraft(query);
  }, [open, query]);

  if (kind === "none") return null;

  const rangePreset: ReportRangePreset =
    draft.from && draft.to ? matchReportRangePreset(draft.from, draft.to) ?? "custom" : "custom";
  const asOfPreset: ReportAsOfPreset =
    draft.asOf ? matchReportAsOfPreset(draft.asOf) ?? "custom" : "custom";
  const nonDefaultPeriod = !isDefaultPeriodQuery(definition, query);
  const nonDefaultBreakdown =
    Boolean(definition.breakdownOptions?.length) && (query.groupBy ?? "start_month") !== "start_month";
  const activeCount = Number(nonDefaultPeriod) + Number(nonDefaultBreakdown);

  const applyDraft = (next: ReportQuery) => {
    onQueryChange(next);
    setError(null);
    setOpen(false);
  };

  const handleRangePreset = (preset: ReportRangePreset) => {
    if (preset === "custom") {
      setDraft((current) => ({ ...current, from: current.from ?? "", to: current.to ?? "" }));
      setError(null);
      return;
    }
    applyDraft({ ...query, ...resolveReportRangePreset(preset) });
  };

  const handleAsOfPreset = (preset: ReportAsOfPreset) => {
    if (preset === "custom") {
      setDraft((current) => ({ ...current, asOf: current.asOf ?? today }));
      setError(null);
      return;
    }
    applyDraft({ ...query, asOf: resolveReportAsOfPreset(preset) });
  };

  const handleApply = () => {
    if (kind === "range") {
      const message = validateCustomRange(draft.from ?? "", draft.to ?? "", today);
      if (message) {
        setError(message);
        return;
      }
      applyDraft({ ...query, from: draft.from, to: draft.to });
      return;
    }
    const message = validateCustomAsOf(draft.asOf ?? "", today);
    if (message) {
      setError(message);
      return;
    }
    applyDraft({ ...query, asOf: draft.asOf });
  };

  const chips: FilterChip[] = [];
  const periodLabel = reportPeriodChipLabel(query);
  if (periodLabel) {
    chips.push({
      id: "period",
      label: periodLabel,
      onRemove: () => {
        const next = defaultReportQuery(definition);
        onQueryChange(
          definition.breakdownOptions?.length ? { ...next, groupBy: query.groupBy } : next
        );
      },
    });
  }
  const breakdownLabel = definition.breakdownOptions?.length
    ? reportBreakdownChipLabel(query.groupBy ?? "start_month")
    : null;
  if (breakdownLabel) {
    chips.push({
      id: "breakdown",
      label: breakdownLabel,
      onRemove: () => onQueryChange({ ...query, groupBy: "start_month" }),
    });
  }

  return (
    <ListToolbar
      appliedFilters={chips}
      onClearFilters={() => onQueryChange(defaultReportQuery(definition))}
      onReload={onReload}
      isLoading={isLoading}
      countLabel={rowCount == null ? undefined : `${rowCount} ${rowCount === 1 ? "row" : "rows"}`}
      filterGroups={
        <>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <ListToolbarFilterTrigger label="Period" count={activeCount} />
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-0">
              <div className="max-h-[min(28rem,70vh)] overflow-y-auto py-1">
                {kind === "range" ? (
                  <FilterSection title="Period">
                    {REPORT_RANGE_PRESETS.map((preset) => (
                      <FilterOption
                        key={preset}
                        selected={rangePreset === preset}
                        onSelect={() => handleRangePreset(preset)}
                      >
                        {REPORT_RANGE_PRESET_LABELS[preset]}
                      </FilterOption>
                    ))}
                  </FilterSection>
                ) : (
                  <FilterSection title="As of">
                    {REPORT_AS_OF_PRESETS.map((preset) => (
                      <FilterOption
                        key={preset}
                        selected={asOfPreset === preset}
                        onSelect={() => handleAsOfPreset(preset)}
                      >
                        {REPORT_AS_OF_PRESET_LABELS[preset]}
                      </FilterOption>
                    ))}
                  </FilterSection>
                )}
                {definition.breakdownOptions?.length ? (
                  <FilterSection title="Breakdown">
                    {definition.breakdownOptions.map((option) => (
                      <FilterOption
                        key={option}
                        selected={(query.groupBy ?? "start_month") === option}
                        onSelect={() => {
                          const next = { ...query, groupBy: option };
                          setDraft((current) => ({ ...current, groupBy: option }));
                          onQueryChange(next);
                        }}
                      >
                        {REPORT_BREAKDOWN_LABELS[option]}
                      </FilterOption>
                    ))}
                  </FilterSection>
                ) : null}
                <FilterSection title="Custom dates">
                  {kind === "range" ? (
                    <div className="space-y-2 px-2 pb-1">
                      <div className="space-y-1">
                        <Label htmlFor="report-from" className="text-meta">
                          From
                        </Label>
                        <Input
                          id="report-from"
                          type="date"
                          max={today}
                          value={draft.from ?? ""}
                          onChange={(event) =>
                            setDraft((current) => ({ ...current, from: event.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="report-to" className="text-meta">
                          To
                        </Label>
                        <Input
                          id="report-to"
                          type="date"
                          max={today}
                          value={draft.to ?? ""}
                          onChange={(event) =>
                            setDraft((current) => ({ ...current, to: event.target.value }))
                          }
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1 px-2 pb-1">
                      <Label htmlFor="report-as-of" className="text-meta">
                        As of
                      </Label>
                      <Input
                        id="report-as-of"
                        type="date"
                        max={today}
                        value={draft.asOf ?? ""}
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, asOf: event.target.value }))
                        }
                      />
                    </div>
                  )}
                  {error ? <p className="px-2 pb-1 text-meta text-destructive">{error}</p> : null}
                  <div className="flex justify-end gap-2 px-2 pb-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDraft(query);
                        setError(null);
                        setOpen(false);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="button" size="sm" onClick={handleApply}>
                      Apply
                    </Button>
                  </div>
                </FilterSection>
              </div>
            </PopoverContent>
          </Popover>
        </>
      }
    >
      {children}
    </ListToolbar>
  );
}
