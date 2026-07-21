"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type ProspectusTabItem<T extends string> = {
  id: T;
  label: string;
  missingCount?: number;
  optional?: boolean;
};

export function ProspectusInternalTabs<T extends string>({
  tabs,
  value,
  onChange,
  "aria-label": ariaLabel = "Section tabs",
}: {
  tabs: Array<ProspectusTabItem<T>>;
  value: T;
  onChange: (id: T) => void;
  "aria-label"?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex flex-wrap gap-2 border-b border-border pb-3"
    >
      {tabs.map((tab) => {
        const selected = value === tab.id;
        const status =
          tab.optional
            ? "Optional"
            : tab.missingCount != null && tab.missingCount > 0
              ? `${tab.missingCount} missing`
              : "Complete";
        return (
          <Button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            size="sm"
            variant={selected ? "secondary" : "outline"}
            className={cn("h-9 gap-2", selected && "font-semibold")}
            onClick={() => onChange(tab.id)}
          >
            <span>{tab.label}</span>
            <span
              className={cn(
                "text-xs font-normal",
                tab.optional
                  ? "text-muted-foreground"
                  : tab.missingCount != null && tab.missingCount > 0
                    ? "text-amber-700 dark:text-amber-400"
                    : "text-muted-foreground"
              )}
            >
              {status}
            </span>
          </Button>
        );
      })}
    </div>
  );
}
