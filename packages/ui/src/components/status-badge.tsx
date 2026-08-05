import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

export const STATUS_TOKEN_KEYS = [
  "action",
  "submitted",
  "in-progress",
  "success",
  "completed",
  "rejected",
  "neutral",
] as const;

export type StatusToken = (typeof STATUS_TOKEN_KEYS)[number];

const statusBadgeVariants = cva(
  "inline-flex items-center rounded-full border border-transparent px-3 py-1 text-xs font-semibold",
  {
    variants: {
      status: {
        action: "bg-status-action-bg text-status-action-text",
        submitted: "bg-status-submitted-bg text-status-submitted-text",
        "in-progress": "bg-status-in-progress-bg text-status-in-progress-text",
        success: "bg-status-success-bg text-status-success-text",
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
  completed: "bg-status-completed-text",
  rejected: "bg-status-rejected-text",
  neutral: "bg-status-neutral-text",
};

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  label: string;
  showDot?: boolean;
}

export function StatusBadge({
  label,
  status = "neutral",
  showDot = true,
  className,
  ...props
}: StatusBadgeProps) {
  const token = status ?? "neutral";

  return (
    <span
      className={cn(statusBadgeVariants({ status: token }), className)}
      {...props}
    >
      {showDot ? (
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
