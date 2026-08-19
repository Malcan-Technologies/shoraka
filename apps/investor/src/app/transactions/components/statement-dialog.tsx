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
  InvestorActionDialog,
  InvestorActionDialogIcon,
} from "@/components/investor-action-dialog";
import { cn } from "@/lib/utils";
import {
  STATEMENT_PERIOD_PRESETS,
  matchStatementPeriodPreset,
  mytTodayKey,
  statementPeriodRange,
  type StatementPeriodPreset,
} from "./statement-period";

interface StatementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  investorOrganizationId?: string;
}

function validateDates(startDate: string, endDate: string): string | null {
  if (!startDate || !endDate) return "Please select both start and end dates.";
  if (new Date(startDate) > new Date(endDate)) return "Start date must be before end date.";
  return null;
}

function StatementDateInput({
  id,
  label,
  value,
  max,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  max: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-ui font-medium">
        {label}
      </Label>
      <Input
        id={id}
        type="date"
        value={value}
        max={max}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className={cn(
          "h-11 rounded-xl",
          value
            ? "text-foreground"
            : "text-muted-foreground [&::-webkit-calendar-picker-indicator]:opacity-40 [&::-webkit-datetime-edit]:text-muted-foreground [&::-webkit-datetime-edit-fields-wrapper]:text-muted-foreground"
        )}
      />
    </div>
  );
}

export function StatementDialog({
  open,
  onOpenChange,
  investorOrganizationId,
}: StatementDialogProps) {
  const { getAccessToken } = useAuthToken();
  const apiClient = React.useMemo(() => createApiClient(undefined, getAccessToken), [getAccessToken]);
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const today = mytTodayKey();
  const selectedPreset = matchStatementPeriodPreset(startDate, endDate);

  React.useEffect(() => {
    if (!open) return;
    setStartDate("");
    setEndDate("");
    setIsDownloading(false);
  }, [open]);

  function applyPreset(preset: StatementPeriodPreset) {
    const range = statementPeriodRange(preset);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
  }

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
    <InvestorActionDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={
        <InvestorActionDialogIcon>
          <ArrowDownTrayIcon className="size-6" />
        </InvestorActionDialogIcon>
      }
      title="Download statement"
      description="Choose a period, then download PDF or CSV."
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1 rounded-xl"
            onClick={() => handleDownload("csv")}
            disabled={isDownloading}
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            {isDownloading ? "Downloading…" : "CSV"}
          </Button>
          <Button
            type="button"
            variant="action"
            className="h-11 flex-1 rounded-xl"
            onClick={() => handleDownload("pdf")}
            disabled={isDownloading}
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            {isDownloading ? "Downloading…" : "PDF"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-ui text-muted-foreground">Quick period</p>
        <div className="flex flex-wrap gap-2">
          {STATEMENT_PERIOD_PRESETS.map((preset) => {
            const selected = selectedPreset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={selected}
                disabled={isDownloading}
                onClick={() => applyPreset(preset.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-ui transition-colors",
                  selected
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border bg-background text-muted-foreground hover:border-foreground/20 hover:text-foreground"
                )}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatementDateInput
          id="statement-start"
          label="From"
          value={startDate}
          max={today}
          disabled={isDownloading}
          onChange={setStartDate}
        />
        <StatementDateInput
          id="statement-end"
          label="To"
          value={endDate}
          max={today}
          disabled={isDownloading}
          onChange={setEndDate}
        />
      </div>
    </InvestorActionDialog>
  );
}
