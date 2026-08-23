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
import type { ExportAccessLogsParams, ExportSecurityLogsParams } from "@cashsouk/types";
import { toast } from "sonner";
import {
  auditExportFilename,
  downloadAuditExport,
  truncatedExportDescription,
} from "@/lib/download-audit-export";

interface AccessLogsExportButtonProps {
  kind: "access" | "security";
  filters:
    | Omit<ExportAccessLogsParams, "format" | "page" | "pageSize">
    | Omit<ExportSecurityLogsParams, "format" | "page" | "pageSize">;
}

export function AccessLogsExportButton({ kind, filters }: AccessLogsExportButtonProps) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(undefined, getAccessToken);
  const [isExporting, setIsExporting] = React.useState(false);

  const handleExport = async (format: "csv" | "json") => {
    try {
      setIsExporting(true);
      const result =
        kind === "access"
          ? await apiClient.exportAccessLogs({ ...filters, format } as ExportAccessLogsParams)
          : await apiClient.exportSecurityLogs({ ...filters, format } as ExportSecurityLogsParams);
      downloadAuditExport(result.blob, auditExportFilename(`${kind}-logs`, format));
      if (result.truncated) {
        toast.warning("Export truncated", { description: truncatedExportDescription() });
      } else {
        toast.success(
          `${kind === "access" ? "Access" : "Security"} logs exported as ${format.toUpperCase()}`
        );
      }
    } catch (error) {
      toast.error("Failed to export logs", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={isExporting} className="gap-2">
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
