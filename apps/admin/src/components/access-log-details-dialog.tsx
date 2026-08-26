"use client";

import type { AccessLogResponse } from "@cashsouk/types";
import { AuditDetailDrawer } from "@/components/audit/audit-detail-drawer";
import { accessLogToAuditDetail } from "@/components/audit/audit-adapters";

interface AccessLog extends Omit<AccessLogResponse, "created_at" | "event_type"> {
  created_at: Date;
  event_type: string;
}

interface AccessLogDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  log: AccessLog | null;
  labelOverrides?: Record<string, string>;
}

export function AccessLogDetailsDialog({
  open,
  onOpenChange,
  log,
  labelOverrides,
}: AccessLogDetailsDialogProps) {
  return (
    <AuditDetailDrawer
      open={open}
      onOpenChange={onOpenChange}
      record={log ? accessLogToAuditDetail(log, labelOverrides) : null}
    />
  );
}
