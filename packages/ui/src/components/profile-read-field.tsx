import * as React from "react";
import { cn } from "../lib/utils";

import { PROFILE_LOCKED_VERIFIED_DURING_ONBOARDING, PROFILE_REQUIRED_EMPTY_LABEL } from "@cashsouk/types";

const PROFILE_READ_EMPTY_DASH = "—";

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
  /**
   * Requiredness from completeness/validators — not an asterisk.
   * Required + empty in customer read mode shows {@link PROFILE_REQUIRED_EMPTY_LABEL}.
   */
  required?: boolean;
  className?: string;
};

export function isProfileReadValueEmpty(value: React.ReactNode): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length === 0 || trimmed === PROFILE_READ_EMPTY_DASH;
  }
  return false;
}

export function ProfileReadField({
  label,
  value,
  missing = false,
  locked = false,
  lockReason,
  multiline = false,
  hint,
  required = false,
  className,
}: ProfileReadFieldProps) {
  const empty = isProfileReadValueEmpty(value);
  const promptRequiredEmpty = required && empty;
  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-meta text-muted-foreground">{label}</p>
      <div
        className={cn(
          "text-ui break-words",
          multiline && "whitespace-pre-wrap",
          promptRequiredEmpty && "text-destructive",
          !promptRequiredEmpty && empty && "text-muted-foreground",
          !promptRequiredEmpty && missing && "text-status-action-text"
        )}
      >
        {promptRequiredEmpty ? PROFILE_REQUIRED_EMPTY_LABEL : empty ? PROFILE_READ_EMPTY_DASH : value}
      </div>
      {locked && !missing && !promptRequiredEmpty ? (
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
