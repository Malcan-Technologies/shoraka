import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EyeIcon } from "@heroicons/react/24/outline";
import { format } from "date-fns";

export type AuditTableLog = {
  id: string;
  eventType: string;
  occurredAt: string;
  createdAt?: string | null;
  actorName: string | null;
  actorEmail: string | null;
  actorType?: string | null;
  actorUserId?: string | null;
  subjectUserId?: string | null;
  organizationId?: string | null;
  organizationKind?: string | null;
  organizationType?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  source?: string | null;
  portal?: string | null;
  ipAddress: string | null;
  userAgent?: string | null;
  deviceInfo: string | null;
  correlationId?: string | null;
  metadata: Record<string, unknown>;
};

function eventLabel(eventType: string) {
  return eventType
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function AccessLogTableRow({
  log,
  onViewDetails,
}: {
  log: AuditTableLog;
  onViewDetails: () => void;
}) {
  return (
    <TableRow className="hover:bg-muted/50">
      <TableCell className="text-sm text-muted-foreground">
        {format(new Date(log.occurredAt), "MMM dd, yyyy HH:mm")}
      </TableCell>
      <TableCell className="min-w-[180px] max-w-[280px]">
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium truncate" title={log.actorName ?? undefined}>
            {log.actorName || "—"}
          </span>
          <span className="text-xs text-muted-foreground truncate" title={log.actorEmail ?? undefined}>
            {log.actorEmail || "—"}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="text-xs">
          {eventLabel(log.eventType)}
        </Badge>
      </TableCell>
      <TableCell className="font-mono text-sm text-muted-foreground">{log.ipAddress || "—"}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{log.deviceInfo || "—"}</TableCell>
      <TableCell>
        <Button size="sm" variant="ghost" onClick={onViewDetails} className="h-8 px-2">
          <EyeIcon className="h-4 w-4 mr-1" />
          View
        </Button>
      </TableCell>
    </TableRow>
  );
}
