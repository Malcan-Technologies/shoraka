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
  onConfirm: (remark: string) => void | Promise<void>;
  isPending?: boolean;
}

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
  onConfirm,
  isPending,
}: ApplicationReviewRemarkDialogProps) {
  const [remark, setRemark] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const handleConfirm = async () => {
    const trimmed = remark.trim();
    if (!optional && !trimmed) {
      setError("Remark is required");
      return;
    }
    setError(null);
    try {
      await onConfirm(trimmed);
      setRemark("");
      onOpenChange(false);
    } catch {
      setError("Failed to submit. Please try again.");
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setRemark("");
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
          <div className="space-y-2">
            <Label htmlFor="review-remark">
              {remarkLabel ?? (optional ? "Remark (optional)" : "Remark (required)")}
            </Label>
            <Textarea
              id="review-remark"
              placeholder={remarkPlaceholder}
              value={remark}
              onChange={(e) => {
                setRemark(e.target.value);
                setError(null);
              }}
              className="min-h-[160px] rounded-xl resize-y"
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">
              One item per line (e.g. Missing contract number)
            </p>
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
            disabled={isPending || (!optional && !remark.trim())}
          >
            {isPending ? "Submitting..." : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
