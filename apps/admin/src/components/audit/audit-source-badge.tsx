"use client";

import { StatusBadge, type StatusToken } from "@cashsouk/ui";
import { formatAuditSourceLabel } from "./audit-presentation";

function sourceToken(source: string): StatusToken {
  const key = source.trim().toUpperCase();
  if (key === "ADMIN" || key === "PORTAL") return "active";
  if (key === "SYSTEM" || key === "SYSTEM_JOB" || key === "JOB") return "neutral";
  if (key === "WEBHOOK") return "in-progress";
  return "submitted";
}

export function AuditSourceBadge({
  source,
  className,
}: {
  source: string | null | undefined;
  className?: string;
}) {
  if (!source?.trim()) return null;
  return (
    <StatusBadge
      label={formatAuditSourceLabel(source)}
      status={sourceToken(source)}
      className={className}
    />
  );
}
