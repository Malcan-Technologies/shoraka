"use client";

import { StatusBadge } from "@cashsouk/ui";
import { toTitleCase } from "@cashsouk/types";
import { getAdminStatusToken } from "@/lib/admin-status-token";
import { getReviewStatusPresentation } from "./status-presentation";

interface ReviewStepStatusBadgeProps {
  status: string;
  size?: "sm" | "md";
  /** Override presentation label (e.g. acceptance "Changes Requested"). */
  label?: string;
}

export function ReviewStepStatusBadge({
  status,
  size = "md",
  label,
}: ReviewStepStatusBadgeProps) {
  const presentation = getReviewStatusPresentation(status);
  const displayText = toTitleCase(label ?? presentation.label);

  return (
    <StatusBadge
      label={displayText || presentation.label}
      status={getAdminStatusToken(status)}
      className={size === "sm" ? "text-meta px-1.5 py-0 shrink-0" : undefined}
    />
  );
}
