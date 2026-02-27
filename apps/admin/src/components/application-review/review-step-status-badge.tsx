"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";

interface ReviewStepStatusBadgeProps {
  status: string;
}

const STATUS_CONFIG: Record<
  string,
  { badgeClass: string; iconClass: string; Icon: React.ComponentType<{ className?: string }>; label: string }
> = {
  APPROVED: {
    badgeClass: "border-green-500/30 bg-green-500/10 text-foreground",
    iconClass: "text-green-600",
    Icon: CheckCircleIcon,
    label: "Approved",
  },
  REJECTED: {
    badgeClass: "border-red-500/30 bg-red-500/10 text-foreground",
    iconClass: "text-red-600",
    Icon: XCircleIcon,
    label: "Rejected",
  },
  AMENDMENT_REQUESTED: {
    badgeClass: "border-yellow-500/30 bg-yellow-500/10 text-foreground",
    iconClass: "text-yellow-600",
    Icon: ExclamationTriangleIcon,
    label: "Amendment Requested",
  },
  PENDING: {
    badgeClass: "border-blue-500/30 bg-blue-500/10 text-foreground",
    iconClass: "text-blue-600",
    Icon: ClockIcon,
    label: "Pending",
  },
};

function toLabel(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function ReviewStepStatusBadge({ status }: ReviewStepStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? {
    ...STATUS_CONFIG.PENDING,
    label: toLabel(status),
  };
  const Icon = config.Icon;

  return (
    <Badge
      variant="outline"
      className={config.badgeClass}
    >
      <Icon className={`h-3.5 w-3.5 mr-1 ${config.iconClass}`} />
      {config.label}
    </Badge>
  );
}
