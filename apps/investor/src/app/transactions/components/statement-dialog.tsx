"use client";

import * as React from "react";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { toast } from "sonner";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { ExportInvestorBalanceStatementParams } from "@cashsouk/types";
import { Label } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface StatementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  investorOrganizationId?: string;
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
}

function validateDates(startDate: string, endDate: string): string | null {
  if (!startDate || !endDate) return "Please select both start and end dates.";
  if (new Date(startDate) > new Date(endDate)) return "Start date must be before end date.";
  return null;
}

export function StatementDialog({
  open,
  onOpenChange,
  investorOrganizationId,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}: StatementDialogProps) {
  const { getAccessToken } = useAuthToken();
  const apiClient = React.useMemo(() => createApiClient(undefined, getAccessToken), [getAccessToken]);
  const [isDownloading, setIsDownloading] = React.useState(false);

  async function handleDownload(format: ExportInvestorBalanceStatementParams["format"]) {
    const error = validateDates(startDate, endDate);
    if (error) {
      toast.error(error);
      return;
    }

    try {
      setIsDownloading(true);
      const blob = await apiClient.exportInvestorBalanceStatement({
        startDate,
        endDate,
        format,
        investorOrganizationId,
      });

      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `transaction-statement-${startDate}-to-${endDate}.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(anchor);

      toast.success(`Statement downloaded as ${format.toUpperCase()}`);
      onOpenChange(false);
    } catch (downloadError) {
      toast.error("Failed to download statement", {
        description: downloadError instanceof Error ? downloadError.message : "Unknown error",
      });
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-xl p-0" aria-describedby={undefined}>
        <DialogHeader className="border-b px-6 pb-4 pt-6 text-center">
          <DialogTitle className="text-xl font-semibold">Statement</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 px-6 py-6">
          <p className="text-center text-sm text-muted-foreground">Select statement period</p>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="statement-start" className="text-sm font-medium">
                Starting from
              </Label>
              <Input
                id="statement-start"
                type="date"
                value={startDate}
                onChange={(event) => onStartDateChange(event.target.value)}
                className="h-11 rounded-xl"
                disabled={isDownloading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="statement-end" className="text-sm font-medium">
                End date
              </Label>
              <Input
                id="statement-end"
                type="date"
                value={endDate}
                onChange={(event) => onEndDateChange(event.target.value)}
                className="h-11 rounded-xl"
                disabled={isDownloading}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 gap-2 rounded-xl border-primary text-primary hover:bg-primary/5"
              onClick={() => handleDownload("csv")}
              disabled={isDownloading}
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              {isDownloading ? "Downloading..." : "Download as CSV"}
            </Button>
            <Button
              type="button"
              variant="action"
              className="h-11 gap-2 rounded-xl"
              onClick={() => handleDownload("pdf")}
              disabled={isDownloading}
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              {isDownloading ? "Downloading..." : "Download as PDF"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
