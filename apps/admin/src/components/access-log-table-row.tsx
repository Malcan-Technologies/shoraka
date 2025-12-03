import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckIcon, XMarkIcon, EyeIcon } from "@heroicons/react/24/outline";
import { format } from "date-fns";
import type { EventType, AccessLogResponse } from "@cashsouk/types";

interface AccessLog extends Omit<AccessLogResponse, "created_at"> {
  created_at: Date;
}

interface AccessLogTableRowProps {
  log: AccessLog;
  onViewDetails: () => void;
}

const eventTypeColors: Partial<Record<EventType, string>> = {
  LOGIN: "bg-blue-100 text-blue-800 border-blue-200",
  LOGOUT: "bg-gray-100 text-gray-800 border-gray-200",
  SIGNUP: "bg-green-100 text-green-800 border-green-200",
  ROLE_ADDED: "bg-purple-100 text-purple-800 border-purple-200",
  ROLE_SWITCHED: "bg-orange-100 text-orange-800 border-orange-200",
  ONBOARDING_COMPLETED: "bg-teal-100 text-teal-800 border-teal-200",
  KYC_STATUS_UPDATED: "bg-yellow-100 text-yellow-800 border-yellow-200",
  ONBOARDING_STATUS_UPDATED: "bg-indigo-100 text-indigo-800 border-indigo-200",
};

export function AccessLogTableRow({ log, onViewDetails }: AccessLogTableRowProps) {
  return (
    <TableRow className="hover:bg-muted/50">
      <TableCell className="text-[15px] text-muted-foreground">
        {format(log.created_at, "MMM dd, yyyy HH:mm")}
      </TableCell>
      <TableCell>
        <div className="flex flex-col">
          <span className="text-[15px] font-medium">
            {log.user.first_name} {log.user.last_name}
          </span>
          <span className="text-xs text-muted-foreground">{log.user.email}</span>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={`text-xs ${eventTypeColors[log.event_type]}`}>
          {log.event_type.replace(/_/g, " ")}
        </Badge>
      </TableCell>
      <TableCell className="font-mono text-sm text-muted-foreground">
        {log.ip_address || "—"}
      </TableCell>
      <TableCell className="text-[15px] text-muted-foreground">{log.device_info || "—"}</TableCell>
      <TableCell>
        {log.success ? (
          <div className="flex items-center gap-1.5 text-green-600">
            <CheckIcon className="h-4 w-4" />
            <span className="text-xs font-medium">Success</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-red-600">
            <XMarkIcon className="h-4 w-4" />
            <span className="text-xs font-medium">Failed</span>
          </div>
        )}
      </TableCell>
      <TableCell>
        <Button size="sm" variant="ghost" onClick={onViewDetails} className="h-8">
          <EyeIcon className="h-4 w-4 mr-1" />
          View
        </Button>
      </TableCell>
    </TableRow>
  );
}
