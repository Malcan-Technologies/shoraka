"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { getReviewStatusPresentation } from "./status-presentation";

interface ReviewStepStatusBadgeProps {
  status: string;
  size?: "sm" | "md";
}

const STATUS_CONFIG: Record<
  string,
  { Icon: React.ComponentType<{ className?: string }> }
> = {
  APPROVED: { Icon: CheckCircleIcon },
  REJECTED: { Icon: XCircleIcon },
  AMENDMENT_REQUESTED: { Icon: ExclamationTriangleIcon },
  PENDING: { Icon: ClockIcon },
};

export function ReviewStepStatusBadge({ status, size = "md" }: ReviewStepStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING;
  const presentation = getReviewStatusPresentation(status);
  const Icon = config.Icon;
  const isCompact = size === "sm";
  const iconSize = isCompact ? "h-3 w-3" : "h-3.5 w-3.5";
  const sizeClass = isCompact ? "text-[11px] px-1.5 py-0 shrink-0" : "";

  return (
    <Badge
      variant="outline"
      className={`${presentation.badgeClass} ${sizeClass}`}
    >
      <Icon className={`${iconSize} mr-1 shrink-0 ${presentation.iconClass}`} />
      {presentation.label}
    </Badge>
  );
}
