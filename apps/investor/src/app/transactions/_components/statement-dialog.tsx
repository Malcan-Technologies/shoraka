"use client";

import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { toast } from "sonner";
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
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
}

export function StatementDialog({
  open,
  onOpenChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}: StatementDialogProps) {
  function validateDates(): string | null {
    if (!startDate || !endDate) return "Please select both start and end dates.";
    if (new Date(startDate) > new Date(endDate)) return "Start date must be before end date.";
    return null;
  }

  function handleDownload(format: "csv" | "pdf") {
    const error = validateDates();
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(`Statement (${format.toUpperCase()}) download will be available once wired to the API.`);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-xl p-0">
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
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 gap-2 rounded-xl border-primary text-primary hover:bg-primary/5"
              onClick={() => handleDownload("csv")}
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              Download as CSV
            </Button>
            <Button
              type="button"
              variant="action"
              className="h-11 gap-2 rounded-xl"
              onClick={() => handleDownload("pdf")}
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              Download as PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
