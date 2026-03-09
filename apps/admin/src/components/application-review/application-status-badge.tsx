import { Badge } from "@/components/ui/badge";
import {
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  ClipboardDocumentCheckIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ArchiveBoxIcon,
} from "@heroicons/react/24/outline";
import React from "react";
import { getReviewStatusPresentation } from "./status-presentation";

interface ApplicationStatusBadgeProps {
  status: string;
  size?: "sm" | "md" | "lg";
  label?: string;
}

const STATUS_CONFIG: Record<string, {
  icon: React.ComponentType<{ className?: string }>;
}> = {
  SUBMITTED: { icon: ClipboardDocumentCheckIcon },
  UNDER_REVIEW: { icon: ClockIcon },
  AMENDMENT_REQUESTED: { icon: ExclamationTriangleIcon },
  RESUBMITTED: { icon: ArrowPathIcon },
  APPROVED: { icon: CheckCircleIcon },
  REJECTED: { icon: XCircleIcon },
  DRAFT: { icon: ClockIcon },
  ARCHIVED: { icon: ArchiveBoxIcon },
};

export function ApplicationStatusBadge({ status, size = "md", label }: ApplicationStatusBadgeProps) {
  const Icon = STATUS_CONFIG[status]?.icon ?? ClockIcon;
  const presentation = getReviewStatusPresentation(status);
  const iconSize =
    size === "sm" ? "h-3 w-3" : size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5";
  const sizeClasses =
    size === "sm" ? "text-xs px-1.5 py-0" : size === "lg" ? "text-sm px-2.5 py-1" : "";
  const displayLabel = label ?? presentation.label;

  return (
    <Badge
      variant="outline"
      className={`${presentation.badgeClass} ${sizeClasses}`}
    >
      <Icon className={`${iconSize} mr-1 ${presentation.iconClass}`} />
      {displayLabel}
    </Badge>
  );
}
