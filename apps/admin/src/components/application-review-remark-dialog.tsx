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
  onConfirm: (remark: string) => void | Promise<void>;
  isPending?: boolean;
}

export function ApplicationReviewRemarkDialog({
  open,
  onOpenChange,
  title,
  description,
  remarkLabel = "Remark (required)",
  remarkPlaceholder = "Enter your remark or requested changes...",
  submitLabel,
  variant = "destructive",
  onConfirm,
  isPending,
}: ApplicationReviewRemarkDialogProps) {
  const [remark, setRemark] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const handleConfirm = async () => {
    const trimmed = remark.trim();
    if (!trimmed) {
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
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="review-remark">{remarkLabel}</Label>
            <Textarea
              id="review-remark"
              placeholder={remarkPlaceholder}
              value={remark}
              onChange={(e) => {
                setRemark(e.target.value);
                setError(null);
              }}
              className="min-h-[100px] rounded-xl resize-none"
              disabled={isPending}
            />
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
            disabled={isPending || !remark.trim()}
          >
            {isPending ? "Submitting..." : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
