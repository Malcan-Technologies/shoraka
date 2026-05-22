"use client";

import Link from "next/link";
import { Label, MoneyInput } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MIN_WITHDRAWAL_AMOUNT } from "./transactions.types";

// Placeholder until withdraw flow reads linked bank account from the API.
const PLACEHOLDER_BANK_DETAILS = {
  bankName: "RHB Islamic Bank Berhad",
  accountNumber: "465874838",
} as const;

interface WithdrawRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: string;
  onAmountChange: (value: string) => void;
  validationError: string | null;
  onSubmit: () => void;
  onSeeWithdrawalHistory: () => void;
}

export function WithdrawRequestDialog({
  open,
  onOpenChange,
  amount,
  onAmountChange,
  validationError,
  onSubmit,
  onSeeWithdrawalHistory,
}: WithdrawRequestDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-xl p-0" aria-describedby={undefined}>
        <DialogHeader className="border-b px-6 pb-4 pt-6 text-center">
          <DialogTitle className="text-xl font-semibold">Withdrawal Request</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 px-6 pb-2">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Withdrawal amount</Label>
            <MoneyInput
              value={amount}
              onValueChange={onAmountChange}
              prefix="RM"
              placeholder="0.00"
              inputClassName="h-11 rounded-xl"
            />
            {validationError ? (
              <p className="text-right text-xs text-destructive">{validationError}</p>
            ) : (
              <p className="text-right text-xs text-muted-foreground">
                Min. amount - RM {MIN_WITHDRAWAL_AMOUNT}
              </p>
            )}
          </div>

          <div className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Bank: </span>
              <span className="font-medium">{PLACEHOLDER_BANK_DETAILS.bankName}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Account number: </span>
              <span className="font-medium">{PLACEHOLDER_BANK_DETAILS.accountNumber}</span>
            </p>
          </div>
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
          <Button type="button" variant="action" className="h-11 flex-1 rounded-xl" onClick={onSubmit}>
            Submit
          </Button>
        </DialogFooter>

        <div className="border-t px-6 py-4 text-center">
          <Link
            href="/transactions"
            className="text-sm font-medium text-primary hover:underline"
            onClick={onSeeWithdrawalHistory}
          >
            See Withdrawal History →
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
