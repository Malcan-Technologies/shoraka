"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface ApplicationReviewRemarkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  remarkLabel?: string;
  remarkPlaceholder?: string;
  submitLabel: string;
  variant?: "destructive" | "default";
  /** When true, remark is optional and user can submit without entering text */
  optional?: boolean;
  commonReasons?: readonly string[];
  onConfirm: (remark: string) => void | Promise<void>;
  isPending?: boolean;
}

const OTHER_REASON_VALUE = "__other__";

export function ApplicationReviewRemarkDialog({
  open,
  onOpenChange,
  title,
  description,
  remarkLabel,
  remarkPlaceholder = "Enter one amendment per line. Each line will appear as a bullet point.",
  submitLabel,
  variant = "destructive",
  optional = false,
  commonReasons = [],
  onConfirm,
  isPending,
}: ApplicationReviewRemarkDialogProps) {
  const [remark, setRemark] = React.useState("");
  const [selectedReason, setSelectedReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const hasCommonReasons = commonReasons.length > 0;
  const requiresReasonSelection = hasCommonReasons && !optional;
  const isOtherReasonSelected = selectedReason === OTHER_REASON_VALUE;
  const trimmedRemark = remark.trim();
  const confirmDisabled = (() => {
    if (isPending) return true;
    if (optional) return false;
    if (!hasCommonReasons) return !trimmedRemark;
    if (!selectedReason) return true;
    if (isOtherReasonSelected) return !trimmedRemark;
    return false;
  })();

  const handleConfirm = async () => {
    if (requiresReasonSelection && !selectedReason) {
      setError("Reason is required");
      return;
    }

    if (!optional && !hasCommonReasons && !trimmedRemark) {
      setError("Remark is required");
      return;
    }

    if (!optional && isOtherReasonSelected && !trimmedRemark) {
      setError("Additional context is required when Other is selected");
      return;
    }

    const resolvedRemark = (() => {
      if (!hasCommonReasons) return trimmedRemark;
      if (selectedReason === OTHER_REASON_VALUE) return trimmedRemark;
      if (!selectedReason) return trimmedRemark;
      return trimmedRemark ? `${selectedReason}\n${trimmedRemark}` : selectedReason;
    })();

    setError(null);
    try {
      await onConfirm(resolvedRemark);
      setRemark("");
      setSelectedReason("");
      onOpenChange(false);
    } catch {
      setError("Failed to submit. Please try again.");
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setRemark("");
      setSelectedReason("");
      setError(null);
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {hasCommonReasons && (
            <div className="space-y-2">
              <Label htmlFor="common-reasons">Reason (required)</Label>
              <Select
                value={selectedReason}
                onValueChange={(value) => {
                  setSelectedReason(value);
                  setError(null);
                }}
                disabled={isPending}
              >
                <SelectTrigger id="common-reasons" className="rounded-xl">
                  <SelectValue placeholder="Select a primary reason" />
                </SelectTrigger>
                <SelectContent>
                  {commonReasons.map((reason) => (
                    <SelectItem key={reason} value={reason}>
                      {reason}
                    </SelectItem>
                  ))}
                  <SelectItem value={OTHER_REASON_VALUE}>Other (manual reason)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="review-remark">
              {remarkLabel ??
                (hasCommonReasons
                  ? isOtherReasonSelected
                    ? "Additional context (required)"
                    : "Additional context (optional)"
                  : optional
                    ? "Remark (optional)"
                    : "Remark (required)")}
            </Label>
            <Textarea
              id="review-remark"
              placeholder={
                hasCommonReasons
                  ? isOtherReasonSelected
                    ? "Enter the primary reason and any details."
                    : "Add any extra details (optional)."
                  : remarkPlaceholder
              }
              value={remark}
              onChange={(e) => {
                setRemark(e.target.value);
                setError(null);
              }}
              className="min-h-[160px] rounded-xl resize-y"
              disabled={isPending}
            />
            {hasCommonReasons ? (
              <p className="text-xs text-muted-foreground">
                Select one primary reason. Add extra details if needed.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                One item per line (e.g. Missing contract number)
              </p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            className={`rounded-xl ${variant === "destructive" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}`}
            onClick={handleConfirm}
            disabled={confirmDisabled}
          >
            {isPending ? "Submitting..." : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
