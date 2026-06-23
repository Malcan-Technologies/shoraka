"use client";

import {
  DepositCompleteView,
  DepositConfirmingView,
} from "@/components/deposit-complete-view";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { isTerminalDepositStatus } from "@/hooks/use-investor-deposit";
import { useInvestorDepositReturn } from "@/hooks/use-investor-deposit-return";

interface DepositReturnDialogProps {
  depositId: string;
  returnTo: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DepositReturnDialog({
  depositId,
  returnTo,
  open,
  onOpenChange,
}: DepositReturnDialogProps) {
  const depositQuery = useInvestorDepositReturn(depositId);
  const deposit = depositQuery.data;
  const isConfirming =
    depositQuery.isLoading ||
    depositQuery.isError ||
    !deposit ||
    !isTerminalDepositStatus(deposit.status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md rounded-2xl border-0 p-0 shadow-lg"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">
          {isConfirming ? "Confirming your payment" : "Deposit status"}
        </DialogTitle>
        {isConfirming ? (
          <DepositConfirmingView />
        ) : (
          <DepositCompleteView
            amount={deposit.amount}
            status={deposit.status}
            returnTo={returnTo}
            onContinue={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
