import * as React from "react";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

export const STATUS_TOKEN_KEYS = [
  "action",
  "submitted",
  "in-progress",
  "success",
  "active",
  "completed",
  "rejected",
  "neutral",
] as const;

export type StatusToken = (typeof STATUS_TOKEN_KEYS)[number];

const statusBadgeVariants = cva(
  "inline-flex w-fit max-w-full shrink-0 items-center rounded-full border border-transparent px-2.5 py-0.5 text-ui font-normal",
  {
    variants: {
      status: {
        action: "bg-status-action-bg text-status-action-text",
        submitted: "bg-status-submitted-bg text-status-submitted-text",
        "in-progress": "bg-status-in-progress-bg text-status-in-progress-text",
        success: "bg-status-success-bg text-status-success-text",
        active: "bg-status-active-bg text-status-active-text",
        completed: "bg-status-completed-bg text-status-completed-text",
        rejected: "bg-status-rejected-bg text-status-rejected-text",
        neutral: "bg-status-neutral-bg text-status-neutral-text",
      },
    },
    defaultVariants: {
      status: "neutral",
    },
  }
);

const statusDotVariants: Record<StatusToken, string> = {
  action: "bg-status-action-text",
  submitted: "bg-status-submitted-text",
  "in-progress": "bg-status-in-progress-text",
  success: "bg-status-success-text",
  active: "bg-status-active-text",
  completed: "bg-status-completed-text",
  rejected: "bg-status-rejected-text",
  neutral: "bg-status-neutral-text",
};

const statusBgVariants: Record<StatusToken, string> = {
  action: "bg-status-action-bg",
  submitted: "bg-status-submitted-bg",
  "in-progress": "bg-status-in-progress-bg",
  success: "bg-status-success-bg",
  active: "bg-status-active-bg",
  completed: "bg-status-completed-bg",
  rejected: "bg-status-rejected-bg",
  neutral: "bg-status-neutral-bg",
};

/** Dot fill per status token, for surfaces that show a bare dot (e.g. tab strips). */
export const STATUS_TOKEN_DOT_CLASS: Record<StatusToken, string> = statusDotVariants;

/** Badge wash per status token — pair with `STATUS_TOKEN_DOT_CLASS` for mini-badge dots. */
export const STATUS_TOKEN_BG_CLASS: Record<StatusToken, string> = statusBgVariants;

/** Compact stepper / count-chip chrome. Prefer `size="sm"` over copying this string. */
export const STATUS_BADGE_COMPACT_CLASS = "text-meta px-1.5 py-0";

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  label: string;
  showDot?: boolean;
  /** `check` is the circled checkmark (Verified / Required). Defaults to check when the label is “Verified”. */
  marker?: "dot" | "check";
  /** `sm` is compact steppers (`text-meta`). Default matches admin table chips. */
  size?: "default" | "sm";
}

function isVerifiedLabel(label: string) {
  return label.trim().toLowerCase() === "verified";
}

export function StatusBadge({
  label,
  status = "neutral",
  showDot = true,
  marker,
  size = "default",
  className,
  ...props
}: StatusBadgeProps) {
  const token = status ?? "neutral";
  const resolvedMarker: "dot" | "check" | "none" =
    showDot === false && marker == null
      ? "none"
      : marker ?? (isVerifiedLabel(label) ? "check" : "dot");

  return (
    <span
      className={cn(
        statusBadgeVariants({ status: token }),
        size === "sm" && STATUS_BADGE_COMPACT_CLASS,
        className
      )}
      {...props}
    >
      {resolvedMarker === "check" ? (
        <CheckCircleIcon
          className={cn("shrink-0", size === "sm" ? "mr-1 h-3 w-3" : "mr-1 h-3.5 w-3.5")}
          aria-hidden
        />
      ) : resolvedMarker === "dot" ? (
        <span
          className={cn(
            "mr-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
            statusDotVariants[token]
          )}
          aria-hidden
        />
      ) : null}
      {label}
    </span>
  );
}

/** Standard Verified chip: green success token + circled check, never stretched. */
export function VerifiedBadge({
  size = "default",
  className,
  ...props
}: Omit<StatusBadgeProps, "label" | "status" | "marker" | "showDot">) {
  return (
    <StatusBadge
      label="Verified"
      status="success"
      marker="check"
      size={size}
      className={className}
      {...props}
    />
  );
}

/** Account-page Required chip: same chrome as Verified. */
export function RequiredBadge({
  size = "default",
  className,
  ...props
}: Omit<StatusBadgeProps, "label" | "status" | "marker" | "showDot">) {
  return (
    <StatusBadge
      label="Required"
      status="success"
      marker="check"
      size={size}
      className={className}
      {...props}
    />
  );
}
