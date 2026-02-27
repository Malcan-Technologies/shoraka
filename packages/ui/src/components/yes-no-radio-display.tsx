"use client";

import { cn } from "../lib/utils";

/**
 * Read-only Yes/No display that visually matches the issuer form's CustomRadio component.
 * Shows both Yes and No options with the selected one highlighted (primary fill, white inner dot),
 * and the unselected one in muted grey. Use for admin review UIs.
 */
export function YesNoRadioDisplay({
  value,
  className,
}: {
  /** true = Yes, false = No, null = not provided */
  value: boolean | null;
  className?: string;
}) {
  const labelClass = "text-sm md:text-base leading-6";
  const selectedLabelClass = cn(labelClass, "text-foreground");
  const unselectedLabelClass = cn(labelClass, "text-muted-foreground");

  if (value === null) {
    return (
      <span className={cn("text-sm text-muted-foreground", className)}>
        Not provided
      </span>
    );
  }

  const yesChecked = value === true;
  const noChecked = value === false;

  return (
    <div className={cn("flex gap-6 items-center", className)}>
      <div className="flex items-center gap-2 pointer-events-none">
        <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
          <span
            className={cn(
              "pointer-events-none relative block h-5 w-5 shrink-0 rounded-full",
              yesChecked ? "bg-primary" : "border-2 border-muted-foreground/50 bg-muted/30"
            )}
            aria-hidden
          >
            {yesChecked && (
              <span
                className="absolute inset-1 rounded-full bg-white"
                aria-hidden
              />
            )}
            {!yesChecked && (
              <span
                className="absolute inset-1.5 rounded-full bg-muted-foreground/40"
                aria-hidden
              />
            )}
          </span>
        </span>
        <span className={yesChecked ? selectedLabelClass : unselectedLabelClass}>
          Yes
        </span>
      </div>
      <div className="flex items-center gap-2 pointer-events-none">
        <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
          <span
            className={cn(
              "pointer-events-none relative block h-5 w-5 shrink-0 rounded-full",
              noChecked ? "bg-primary" : "border-2 border-muted-foreground/50 bg-muted/30"
            )}
            aria-hidden
          >
            {noChecked && (
              <span
                className="absolute inset-1 rounded-full bg-white"
                aria-hidden
              />
            )}
            {!noChecked && (
              <span
                className="absolute inset-1.5 rounded-full bg-muted-foreground/40"
                aria-hidden
              />
            )}
          </span>
        </span>
        <span className={noChecked ? selectedLabelClass : unselectedLabelClass}>
          No
        </span>
      </div>
    </div>
  );
}
