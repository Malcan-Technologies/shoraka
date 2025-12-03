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
import { createApiClient } from "@cashsouk/config";
import type { ExportAccessLogsParams } from "@cashsouk/types";
import { toast } from "sonner";

const apiClient = createApiClient();

interface AccessLogsExportButtonProps {
  filters: Omit<ExportAccessLogsParams, "format" | "page" | "pageSize">;
}

export function AccessLogsExportButton({ filters }: AccessLogsExportButtonProps) {
  const [isExporting, setIsExporting] = React.useState(false);

  const handleExport = async (format: "csv" | "json") => {
    try {
      setIsExporting(true);
      const params: ExportAccessLogsParams = {
        ...filters,
        format,
      };

      const blob = await apiClient.exportAccessLogs(params);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `access-logs-${new Date().toISOString().split("T")[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(`Access logs exported as ${format.toUpperCase()}`);
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

