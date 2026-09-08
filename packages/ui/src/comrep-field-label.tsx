"use client";

import { Label } from "./components/label";
import { InfoTooltip } from "./info-tooltip";
import { cn } from "./lib/utils";

export function ComRepFieldLabel({
  label,
  htmlFor,
  required = false,
  help,
  className,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  help?: string;
  className?: string;
}) {
  return (
    <Label
      htmlFor={htmlFor}
      className={cn("inline-flex items-center gap-1 text-ui font-medium leading-none", className)}
    >
      <span>{label}</span>
      {required ? <span className="text-destructive"> *</span> : null}
      {help ? (
        <InfoTooltip content={help} className="max-w-sm" iconClassName="h-4 w-4 shrink-0" />
      ) : null}
    </Label>
  );
}
