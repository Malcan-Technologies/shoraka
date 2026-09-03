import * as React from "react";
import { cn } from "../lib/utils";

export type ProfileReadFieldProps = {
  label: string;
  value?: React.ReactNode;
  missing?: boolean;
  locked?: boolean;
  multiline?: boolean;
  hint?: React.ReactNode;
  className?: string;
};

function isEmptyValue(value: React.ReactNode): boolean {
  return value === null || value === undefined || value === "";
}

export function ProfileReadField({
  label,
  value,
  missing = false,
  locked = false,
  multiline = false,
  hint,
  className,
}: ProfileReadFieldProps) {
  const empty = isEmptyValue(value);
  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-ui font-medium leading-none text-foreground">{label}</p>
      <div
        className={cn(
          "w-full rounded-md border px-3 text-ui",
          multiline ? "min-h-[120px] whitespace-pre-wrap py-2.5" : "flex min-h-11 items-center",
          missing
            ? "border-status-action-text/40 bg-[hsl(var(--status-action-bg)/0.35)] text-foreground"
            : "border-input bg-muted text-foreground"
        )}
      >
        <span className={cn("min-w-0 break-words", empty && "text-muted-foreground")}>
          {empty ? "—" : value}
        </span>
      </div>
      {missing ? <p className="text-meta text-status-action-text">Required</p> : null}
      {locked && !missing ? (
        <p className="text-meta text-muted-foreground">This field cannot be edited</p>
      ) : null}
      {hint ? <div className="text-meta text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

export function ProfileFieldGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("grid gap-4 sm:grid-cols-2", className)}>{children}</div>;
}
