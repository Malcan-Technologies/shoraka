"use client";

import * as React from "react";
import {
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./alert-dialog";
import { buttonVariants } from "./button";
import { cn } from "../lib/utils";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
  onConfirm,
  isLoading = false,
}: ConfirmDialogProps) {
  const [isConfirming, setIsConfirming] = React.useState(false);
  const isSubmittingRef = React.useRef(false);
  const busy = isLoading || isConfirming;

  const handleConfirm = async (event: React.MouseEvent) => {
    event.preventDefault();
    if (isSubmittingRef.current || busy) return;
    isSubmittingRef.current = true;
    setIsConfirming(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      isSubmittingRef.current = false;
      setIsConfirming(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    // Block dismiss (Escape / overlay) while the confirm mutation is in flight.
    if (!nextOpen && busy) return;
    onOpenChange(nextOpen);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="sm:max-w-[425px]">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            {variant === "destructive" ? (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <ExclamationTriangleIcon className="h-5 w-5 text-destructive" />
              </div>
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <InformationCircleIcon className="h-5 w-5 text-primary" />
              </div>
            )}
            <AlertDialogTitle>{title}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="pt-2 text-left">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy} className="rounded-xl">
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={handleConfirm}
            className={cn(
              "rounded-xl",
              variant === "destructive" &&
                buttonVariants({ variant: "destructive" })
            )}
          >
            {busy ? "Processing…" : confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
