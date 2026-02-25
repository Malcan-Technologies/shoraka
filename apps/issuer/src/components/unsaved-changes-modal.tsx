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
}

export function UnsavedChangesModal({ onConfirm, onCancel }: Props) {
  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Unsaved changes</DialogTitle>
          <DialogDescription>
            You have unsaved changes. If you leave now, they will be lost.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} className="mr-2">
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Don't Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

