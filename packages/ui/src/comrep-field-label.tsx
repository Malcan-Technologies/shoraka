"use client";

import { Label } from "./components/label";
import { InfoTooltip } from "./info-tooltip";
import { cn } from "./lib/utils";

export function ComRepFieldLabel({
  label,
  htmlFor,
  required = false,
  optional = false,
  help,
  className,
}: {
  label: string;
  htmlFor?: string;
  /** Programmatic required state. Not shown as an asterisk. */
  required?: boolean;
  /** Visible Optional marker in edit mode. */
  optional?: boolean;
  help?: string;
  className?: string;
}) {
  const showOptional = optional && !required;
  return (
    <div className={cn("space-y-1", className)}>
      <Label
        htmlFor={htmlFor}
        className="inline-flex items-center gap-1 text-ui font-medium leading-none"
      >
        <span>{label}</span>
        {help ? (
          <InfoTooltip content={help} className="max-w-sm" iconClassName="h-4 w-4 shrink-0" />
        ) : null}
      </Label>
      {showOptional ? (
        <p className="text-meta font-normal text-muted-foreground">Optional</p>
      ) : null}
    </div>
  );
}
