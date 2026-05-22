"use client";

import { formatCurrency } from "@cashsouk/config";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface WithdrawConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: number;
  onConfirm: () => void;
}

export function WithdrawConfirmDialog({
  open,
  onOpenChange,
  amount,
  onConfirm,
}: WithdrawConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-xl p-0">
        <DialogHeader className="border-b px-6 pb-4 pt-6 text-center">
          <DialogTitle className="text-xl font-semibold">Withdrawal Request Confirmation</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 px-6 py-8 text-center">
          <p className="text-muted-foreground">You have requested to withdraw</p>
          <p className="text-3xl font-bold text-primary">{formatCurrency(amount)}</p>
        </div>

        <DialogFooter className="flex-row gap-3 border-t px-6 py-4 sm:justify-between sm:space-x-0">
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1 rounded-xl"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" variant="action" className="h-11 flex-1 rounded-xl" onClick={onConfirm}>
            Confirm
          </Button>
        </DialogFooter>

        <p className="border-t px-6 py-4 text-center text-xs text-muted-foreground">
          This process takes 2-3 business days. By clicking confirm, I accept the{" "}
          <button type="button" className="text-primary underline-offset-2 hover:underline">
            Terms and Conditions
          </button>
        </p>
      </DialogContent>
    </Dialog>
  );
}
