"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CheckIcon } from "@heroicons/react/24/outline";

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
        const isMissing = !tab.optional && tab.missingCount != null && tab.missingCount > 0;
        const isComplete = !tab.optional && !isMissing;
        const status = tab.optional
          ? "Optional"
          : isMissing
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
                "inline-flex items-center gap-1 text-xs font-normal",
                tab.optional
                  ? "text-muted-foreground"
                  : isMissing
                    ? "text-amber-700 dark:text-amber-400"
                    : "text-emerald-700 dark:text-emerald-400"
              )}
            >
              {isComplete ? <CheckIcon className="h-3.5 w-3.5" aria-hidden /> : null}
              {status}
            </span>
          </Button>
        );
      })}
    </div>
  );
}
