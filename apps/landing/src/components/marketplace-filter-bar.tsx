"use client";

import * as React from "react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@cashsouk/ui";

const CATEGORIES = [
  "All",
  "Food & Beverage",
  "Manufacturing",
  "Technology",
  "Healthcare",
] as const;

const FILTER_SELECTS = [
  {
    id: "industry",
    label: "Industry",
    values: ["All industries", "Food & Beverage", "Manufacturing", "Technology", "Healthcare"],
  },
  {
    id: "risk",
    label: "Risk Score",
    values: ["Any", "A only", "B and above", "C and above"],
  },
  {
    id: "profit",
    label: "Profit",
    values: ["Any", "Up to 10%", "10–15%", "15%+"],
  },
  {
    id: "tenor",
    label: "Tenor",
    values: ["Any", "≤30 days", "31–60 days", "60+ days"],
  },
] as const;

export function MarketplaceFilterBar() {
  const [activeCategory, setActiveCategory] = React.useState<string>(CATEGORIES[0]);

  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-4 shadow-sm md:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div
          className="flex flex-wrap items-center gap-2 md:gap-3"
          role="tablist"
          aria-label="Categories"
        >
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveCategory(cat)}
                className={
                  isActive
                    ? "rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    : "rounded-full bg-muted/60 px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                }
              >
                {cat}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {FILTER_SELECTS.map((f) => (
            <Select key={f.id} defaultValue={`${f.id}-0`}>
              <SelectTrigger className="h-10 w-[140px] rounded-xl border-border text-[15px] md:w-[152px]">
                <SelectValue placeholder={f.label} />
              </SelectTrigger>
              <SelectContent>
                {f.values.map((v, i) => (
                  <SelectItem key={v} value={`${f.id}-${i}`}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}
        </div>
      </div>
    </div>
  );
}

export function MarketplaceShowMore() {
  return (
    <div className="flex justify-center pt-4">
      <button
        type="button"
        className="inline-flex items-center gap-1.5 rounded-sm text-sm font-semibold text-primary hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        Show more
        <ChevronDownIcon className="size-4" aria-hidden />
      </button>
    </div>
  );
}
