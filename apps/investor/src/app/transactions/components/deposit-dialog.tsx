"use client";

import { InvestorDepositForm } from "@/components/investor-deposit-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DepositDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  investorOrganizationId: string | undefined;
  amount: string;
  onAmountChange: (value: string) => void;
  validationError: string | null;
  onValidationErrorChange: (error: string | null) => void;
}

export function DepositDialog({
  open,
  onOpenChange,
  investorOrganizationId,
  amount,
  onAmountChange,
  validationError,
  onValidationErrorChange,
}: DepositDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-xl p-0" aria-describedby={undefined}>
        <DialogHeader className="border-b px-6 pb-4 pt-6 text-center">
          <DialogTitle className="text-xl font-semibold">Deposit</DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4">
          <InvestorDepositForm
            investorOrganizationId={investorOrganizationId}
            amount={amount}
            onAmountChange={onAmountChange}
            validationError={validationError}
            onValidationErrorChange={onValidationErrorChange}
            returnTo="/transactions"
            onStarted={() => onOpenChange(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
