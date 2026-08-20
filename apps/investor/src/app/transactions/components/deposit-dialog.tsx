"use client";

import { PlusIcon } from "@heroicons/react/24/outline";
import { InvestorDepositForm } from "@/components/investor-deposit-form";
import {
  InvestorActionDialog,
  InvestorActionDialogIcon,
} from "@/components/investor-action-dialog";
import { PORTFOLIO_TRANSACTIONS_HREF } from "@/portfolio/portfolio-tabs";

interface DepositDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  investorOrganizationId: string | undefined;
  amount: string;
  onAmountChange: (value: string) => void;
  validationError: string | null;
  onValidationErrorChange: (error: string | null) => void;
  returnTo?: string;
}

export function DepositDialog({
  open,
  onOpenChange,
  investorOrganizationId,
  amount,
  onAmountChange,
  validationError,
  onValidationErrorChange,
  returnTo = PORTFOLIO_TRANSACTIONS_HREF,
}: DepositDialogProps) {
  return (
    <InvestorActionDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={
        <InvestorActionDialogIcon>
          <PlusIcon className="size-6" />
        </InvestorActionDialogIcon>
      }
      title="Add cash"
      description="Pay from your own bank account. Once it clears, the money is ready to invest."
    >
      <InvestorDepositForm
        investorOrganizationId={investorOrganizationId}
        amount={amount}
        onAmountChange={onAmountChange}
        validationError={validationError}
        onValidationErrorChange={onValidationErrorChange}
        returnTo={returnTo}
        onStarted={() => onOpenChange(false)}
      />
    </InvestorActionDialog>
  );
}
