"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  onConfirm: () => void;
  onCancel: () => void;
  /** Exit wizard variant: title "Exit Application", message about dashboard, button "Leave Application". */
  variant?: "unsaved" | "exit";
  /** When variant=exit and hasUnsavedChanges, prepend unsaved warning to the message. */
  hasUnsavedChanges?: boolean;
}

export function UnsavedChangesModal({
  onConfirm,
  onCancel,
  variant = "unsaved",
  hasUnsavedChanges = false,
}: Props) {
  const isExit = variant === "exit";
  const title = isExit ? "Exit Application" : "Unsaved changes";
  const description = isExit
    ? hasUnsavedChanges
      ? "You have unsaved changes. You will be navigated back to the dashboard page. Any unsaved changes will be lost."
      : "You will be navigated back to the dashboard page. Any unsaved changes will be lost."
    : "You have unsaved changes. If you leave now, they will be lost.";
  const confirmLabel = isExit ? "Leave Application" : "Don't Save";

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} className="mr-2">
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

