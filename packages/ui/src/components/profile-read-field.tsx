import * as React from "react";
import { cn } from "../lib/utils";

import { PROFILE_LOCKED_VERIFIED_DURING_ONBOARDING } from "@cashsouk/types";

export type ProfileReadFieldProps = {
  label: string;
  value?: React.ReactNode;
  missing?: boolean;
  locked?: boolean;
  lockReason?: string;
  multiline?: boolean;
  hint?: React.ReactNode;
  /** Ignored in read mode. Kept so edit/read call sites can share props. */
  help?: string;
  /** Ignored in read mode. Required/optional markers belong on edit controls. */
  required?: boolean;
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
  lockReason,
  multiline = false,
  hint,
  className,
}: ProfileReadFieldProps) {
  const empty = isEmptyValue(value);
  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-meta text-muted-foreground">{label}</p>
      <div
        className={cn(
          "text-ui break-words",
          multiline && "whitespace-pre-wrap",
          empty && "text-muted-foreground",
          missing && "text-status-action-text"
        )}
      >
        {empty ? "—" : value}
      </div>
      {locked && !missing ? (
        <p className="text-meta text-muted-foreground">
          {lockReason ?? PROFILE_LOCKED_VERIFIED_DURING_ONBOARDING}
        </p>
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
