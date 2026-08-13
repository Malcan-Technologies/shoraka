"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import type { AuditTableLog } from "./access-log-table-row";

interface AccessLogDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  log: AuditTableLog | null;
}

function eventLabel(eventType: string) {
  return eventType
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function AccessLogDetailsDialog({ open, onOpenChange, log }: AccessLogDetailsDialogProps) {
  if (!log) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Audit event</DialogTitle>
          <DialogDescription>
            {format(new Date(log.occurredAt), "MMM dd, yyyy HH:mm:ss")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline">{eventLabel(log.eventType)}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">Actor</p>
              <p className="font-medium">{log.actorName || "—"}</p>
              <p className="text-muted-foreground">{log.actorEmail || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">IP / Device</p>
              <p className="font-mono">{log.ipAddress || "—"}</p>
              <p>{log.deviceInfo || "—"}</p>
            </div>
          </div>
          <Separator />
          <div>
            <p className="text-sm text-muted-foreground mb-2">Metadata</p>
            <pre className="text-xs bg-muted rounded-md p-3 overflow-x-auto">
              {JSON.stringify(log.metadata, null, 2)}
            </pre>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
