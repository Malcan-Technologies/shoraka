"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { EventType, ExportAccessLogsParams, SecurityEventType } from "@cashsouk/types";
import { toast } from "sonner";
import { auditExportButtonClassName } from "@/components/audit/audit-log-shell";

interface AccessLogsExportButtonProps {
  filters: Omit<ExportAccessLogsParams, "format" | "page" | "pageSize" | "eventType" | "eventTypes"> & {
    eventType?: EventType | SecurityEventType;
    eventTypes?: (EventType | SecurityEventType)[];
  };
  kind?: "access" | "security";
  disabled?: boolean;
}

export function AccessLogsExportButton({
  filters,
  kind = "access",
  disabled = false,
}: AccessLogsExportButtonProps) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(undefined, getAccessToken);
  const [isExporting, setIsExporting] = React.useState(false);

  const handleExport = async (format: "csv" | "json") => {
    try {
      setIsExporting(true);
      const params: ExportAccessLogsParams = {
        ...filters,
        eventType: filters.eventType as ExportAccessLogsParams["eventType"],
        eventTypes: filters.eventTypes as ExportAccessLogsParams["eventTypes"],
        format,
      };

      const blob =
        kind === "security"
          ? await apiClient.exportSecurityLogs({
              search: filters.search,
              eventType: filters.eventType as SecurityEventType | undefined,
              eventTypes: filters.eventTypes as SecurityEventType[] | undefined,
              dateRange: filters.dateRange,
              userId: filters.userId,
              format,
            })
          : await apiClient.exportAccessLogs(params);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${kind === "security" ? "security-logs" : "access-logs"}-${new Date().toISOString().split("T")[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(`${kind === "security" ? "Security" : "Access"} logs exported as ${format.toUpperCase()}`);
    } catch (error) {
      toast.error("Failed to export access logs", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          disabled={isExporting || disabled}
          className={auditExportButtonClassName()}
        >
          <ArrowDownTrayIcon className="h-4 w-4" />
          {isExporting ? "Exporting..." : "Export"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport("csv")} disabled={isExporting}>
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("json")} disabled={isExporting}>
          Export as JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

