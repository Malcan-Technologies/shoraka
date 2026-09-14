"use client";

import { useId } from "react";
import { cn } from "../lib/utils";

export type ChoiceChipOption<T extends string> = {
  value: T;
  label: string;
};

export function ChoiceChips<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<ChoiceChipOption<T>>;
  onChange: (value: T) => void;
  className?: string;
}) {
  const groupId = useId();

  return (
    <div className={cn("min-w-0", className)}>
      <div id={`${groupId}-label`} className="mb-2 text-meta font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        role="radiogroup"
        aria-labelledby={`${groupId}-label`}
        className="flex flex-wrap gap-1.5"
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className={cn(
                "h-8 rounded-full border px-3 text-ui font-normal",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:bg-muted"
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
