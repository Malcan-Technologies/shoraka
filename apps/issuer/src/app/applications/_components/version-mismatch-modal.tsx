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
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

interface VersionMismatchModalProps {
  open: boolean;
  onConfirm: () => void;
  isPending: boolean;
}

export function VersionMismatchModal({
  open,
  onConfirm,
  isPending,
}: VersionMismatchModalProps) {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-full bg-warning/10">
              <ExclamationTriangleIcon className="h-6 w-6 text-warning" />
            </div>
            <DialogTitle>Product Updated</DialogTitle>
          </div>
          <DialogDescription className="text-base">
            The rules for this financing type have been updated since you started your application. 
            To ensure everything is correct, you need to restart your application from the beginning.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4">
          <Button
            type="button"
            className="w-full bg-primary text-primary-foreground hover:opacity-90"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? "Restarting..." : "Restart Application"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
