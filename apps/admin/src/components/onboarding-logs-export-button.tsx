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
import type { ExportOnboardingLogsParams } from "@cashsouk/types";
import { toast } from "sonner";

interface OnboardingLogsExportButtonProps {
  filters: Omit<ExportOnboardingLogsParams, "format" | "page" | "pageSize">;
}

export function OnboardingLogsExportButton({ filters }: OnboardingLogsExportButtonProps) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(undefined, getAccessToken);
  const [isExporting, setIsExporting] = React.useState(false);

  const handleExport = async (format: "csv" | "json") => {
    try {
      setIsExporting(true);
      const params: ExportOnboardingLogsParams = {
        ...filters,
        format,
      };

      const blob = await apiClient.exportOnboardingLogs(params);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `onboarding-logs-${new Date().toISOString().split("T")[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(`Onboarding logs exported as ${format.toUpperCase()}`);
    } catch (error) {
      toast.error("Failed to export onboarding logs", {
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

