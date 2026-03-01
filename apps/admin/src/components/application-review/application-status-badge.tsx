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

interface ApplicationStatusBadgeProps {
  status: string;
  size?: "sm" | "md" | "lg";
  label?: string;
}

const STATUS_STYLE: Record<
  string,
  { badgeClass: string; iconClass: string }
> = {
  blue: {
    badgeClass: "border-blue-500/30 bg-blue-500/10 text-foreground",
    iconClass: "text-blue-600",
  },
  yellow: {
    badgeClass: "border-yellow-500/30 bg-yellow-500/10 text-foreground",
    iconClass: "text-yellow-600",
  },
  orange: {
    badgeClass: "border-orange-500/30 bg-orange-500/10 text-foreground",
    iconClass: "text-orange-600",
  },
  green: {
    badgeClass: "border-green-500/30 bg-green-500/10 text-foreground",
    iconClass: "text-green-600",
  },
  red: {
    badgeClass: "border-red-500/30 bg-red-500/10 text-foreground",
    iconClass: "text-red-600",
  },
  amber: {
    badgeClass: "border-amber-500/30 bg-amber-500/10 text-foreground",
    iconClass: "text-amber-600",
  },
  slate: {
    badgeClass: "border-slate-500/30 bg-slate-500/10 text-foreground",
    iconClass: "text-slate-600",
  },
};

const STATUS_CONFIG: Record<string, {
  color: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}> = {
  SUBMITTED: { color: "blue", icon: ClipboardDocumentCheckIcon, label: "Submitted" },
  UNDER_REVIEW: { color: "blue", icon: ClockIcon, label: "Under Review" },
  AMENDMENT_REQUESTED: { color: "yellow", icon: ExclamationTriangleIcon, label: "Amendment Requested" },
  RESUBMITTED: { color: "orange", icon: ArrowPathIcon, label: "Resubmitted" },
  APPROVED: { color: "green", icon: CheckCircleIcon, label: "Approved" },
  REJECTED: { color: "red", icon: XCircleIcon, label: "Rejected" },
  DRAFT: { color: "amber", icon: ClockIcon, label: "Draft" },
  ARCHIVED: { color: "slate", icon: ArchiveBoxIcon, label: "Archived" },
};

export function ApplicationStatusBadge({ status, size = "md", label }: ApplicationStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? {
    color: "amber",
    icon: ClockIcon,
    label: status.charAt(0).toUpperCase() + status.slice(1).toLowerCase(),
  };
  const Icon = config.icon;
  const iconSize =
    size === "sm" ? "h-3 w-3" : size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5";
  const sizeClasses =
    size === "sm" ? "text-xs px-1.5 py-0" : size === "lg" ? "text-sm px-2.5 py-1" : "";
  const displayLabel = label ?? config.label;
  const style = STATUS_STYLE[config.color] ?? STATUS_STYLE.amber;

  return (
    <Badge
      variant="outline"
      className={`${style.badgeClass} ${sizeClasses}`}
    >
      <Icon className={`${iconSize} mr-1 ${style.iconClass}`} />
      {displayLabel}
    </Badge>
  );
}
