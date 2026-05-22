"use client";

import { CheckIcon } from "@heroicons/react/24/outline";
import { formatCurrency } from "@cashsouk/config";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";

interface WithdrawSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: number;
}

export function WithdrawSuccessDialog({ open, onOpenChange, amount }: WithdrawSuccessDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-xl px-6 py-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-800">
          <CheckIcon className="h-8 w-8 text-white" strokeWidth={2.5} />
        </div>

        <div className="mt-6 space-y-2">
          <p className="text-muted-foreground">Your withdrawal request for</p>
          <p className="text-3xl font-bold text-primary">{formatCurrency(amount)}</p>
          <p className="text-lg font-semibold">has been submitted successfully</p>
          <p className="text-sm text-muted-foreground">
            The amount will be credited to your account within 2-3 business days
          </p>
        </div>

        <Button
          type="button"
          variant="action"
          className="mt-8 h-11 w-full rounded-xl"
          onClick={() => onOpenChange(false)}
        >
          OK
        </Button>
      </DialogContent>
    </Dialog>
  );
}
