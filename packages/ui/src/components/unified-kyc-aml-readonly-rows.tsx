"use client";

import type { DirectorShareholderDisplayRow } from "@cashsouk/types";
import { getDisplayAmlStatus, regtankDisplayStatusBadgeClass } from "@cashsouk/types";
import { Badge } from "./badge";
import { cn } from "../lib/utils";
import {
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";

export interface UnifiedKycAmlReadonlyRowsProps {
  rows: DirectorShareholderDisplayRow[];
  showKycColumn: boolean;
  showAmlColumn: boolean;
  isRefreshing?: boolean;
}

function normalizeStatusText(raw: string): string {
  const t = raw.trim();
  if (!t) return "STATUS_UNAVAILABLE";
  const mapped: Record<string, string> = {
    "KYC Approved": "APPROVED",
    "KYC Pending": "PENDING",
    "KYC Failed": "REJECTED",
    "AML Approved": "APPROVED",
    "AML Pending": "PENDING",
    "AML Failed": "REJECTED",
    "Not Started": "NOT_STARTED",
    "Status unavailable": "STATUS_UNAVAILABLE",
    Sent: "SENT",
  };
  if (mapped[t]) return mapped[t];
  return t.toUpperCase().replace(/\s+/g, "_");
}

function kycBadge(row: DirectorShareholderDisplayRow) {
  const label = normalizeStatusText(row.status);
  const cls = regtankDisplayStatusBadgeClass(label);
  if (label === "APPROVED" || label === "REJECTED") {
    return (
      <Badge variant="outline" className={cn("border-transparent text-[11px] font-normal", cls)}>
        {label === "APPROVED" ? (
          <CheckCircleIcon className="h-3 w-3 mr-1 shrink-0" aria-hidden />
        ) : (
          <XCircleIcon className="h-3 w-3 mr-1 shrink-0" aria-hidden />
        )}
        {label}
      </Badge>
    );
  }
  if (label === "PENDING" || label === "SENT") {
    return (
      <Badge variant="outline" className={cn("border-transparent text-[11px] font-normal", cls)}>
        <ClockIcon className="h-3 w-3 mr-1 shrink-0" aria-hidden />
        {label}
      </Badge>
    );
  }
  if (label === "STATUS_UNAVAILABLE") {
    return (
      <Badge variant="outline" className={cn("border-transparent text-[11px] font-normal", cls)}>
        <ExclamationTriangleIcon className="h-3 w-3 mr-1 shrink-0" aria-hidden />
        {label}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={cn("border-transparent text-[11px] font-normal", cls)}>
      <ClockIcon className="h-3 w-3 mr-1 shrink-0" aria-hidden />
      {label}
    </Badge>
  );
}

function amlBadge(display: string) {
  const cls = regtankDisplayStatusBadgeClass(display);
  if (display === "APPROVED") {
    return (
      <Badge variant="outline" className={cn("border-transparent text-[11px] font-normal", cls)}>
        <CheckCircleIcon className="h-3 w-3 mr-1 shrink-0" aria-hidden />
        {display}
      </Badge>
    );
  }
  if (display === "REJECTED") {
    return (
      <Badge variant="outline" className={cn("border-transparent text-[11px] font-normal", cls)}>
        <XCircleIcon className="h-3 w-3 mr-1 shrink-0" aria-hidden />
        {display}
      </Badge>
    );
  }
  if (display === "PENDING") {
    return (
      <Badge variant="outline" className={cn("border-transparent text-[11px] font-normal", cls)}>
        <ClockIcon className="h-3 w-3 mr-1 shrink-0" aria-hidden />
        {display}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={cn("border-transparent text-[11px] font-normal", cls)}>
      <ExclamationTriangleIcon className="h-3 w-3 mr-1 shrink-0" aria-hidden />
      {display}
    </Badge>
  );
}

function amlCell(row: DirectorShareholderDisplayRow) {
  const amlRaw = row.amlStatus?.trim() ?? "";
  const regtankRaw = row.ctosRegtankStatus?.trim() ?? "";
  const statusRaw = row.status?.trim() ?? "";

  const fallbackFromStatus =
    statusRaw &&
    statusRaw !== "Not Started" &&
    statusRaw !== "Status unavailable" &&
    statusRaw !== "Sent"
      ? statusRaw
      : "";

  const rawDisplay =
    amlRaw ||
    (regtankRaw ? getDisplayAmlStatus(regtankRaw) : "") ||
    fallbackFromStatus ||
    getDisplayAmlStatus("STATUS_UNAVAILABLE");
  const display = normalizeStatusText(rawDisplay);
  return amlBadge(display);
}

export function UnifiedKycAmlReadonlyRows({
  rows,
  showKycColumn,
  showAmlColumn,
  isRefreshing,
}: UnifiedKycAmlReadonlyRowsProps) {
  if (rows.length === 0) return null;

  return (
    <div
      className={cn("divide-y rounded-lg border bg-card", isRefreshing && "opacity-70")}
      aria-busy={isRefreshing || undefined}
    >
      {rows.map((row) => (
        <div key={row.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{row.name}</p>
            {row.email ? (
              <p className="text-xs text-muted-foreground break-all">{row.email}</p>
            ) : null}
            <p className="text-xs text-muted-foreground mt-0.5">{row.role}</p>
            {row.type === "COMPANY" && row.registrationNumber?.trim() ? (
              <p className="text-xs text-muted-foreground font-mono mt-0.5">
                SSM {row.registrationNumber}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {showKycColumn ? kycBadge(row) : null}
            {showAmlColumn ? amlCell(row) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
