"use client";

import { StatusBadge, type StatusToken } from "@cashsouk/ui";
import { formatAuditEventLabel } from "./audit-presentation";

function eventToken(eventType: string, status?: string | null): StatusToken {
  const statusKey = status?.trim().toLowerCase() ?? "";
  if (statusKey === "failed" || statusKey === "rejected" || statusKey === "error") return "rejected";
  if (statusKey === "success" || statusKey === "completed" || statusKey === "approved") return "success";
  if (statusKey === "pending" || statusKey === "in_progress") return "in-progress";
  const type = eventType.toUpperCase();
  if (type.includes("REJECT") || type.includes("FAIL") || type.includes("REVOKE")) return "rejected";
  if (type.includes("APPROVE") || type.includes("COMPLETE") || type.includes("SUCCESS")) return "success";
  if (type.includes("CREATE") || type.includes("PUBLISH") || type.includes("ACTIVE")) return "active";
  if (type.includes("UPDATE") || type.includes("CHANGE")) return "in-progress";
  return "neutral";
}

export function AuditEventBadge({
  eventType,
  label,
  status,
  overrides,
  className,
}: {
  eventType: string;
  label?: string;
  status?: string | null;
  overrides?: Record<string, string>;
  className?: string;
}) {
  return (
    <StatusBadge
      label={label ?? formatAuditEventLabel(eventType, overrides)}
      status={eventToken(eventType, status)}
      className={className}
    />
  );
}
