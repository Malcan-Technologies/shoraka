"use client";

import { CheckIcon } from "@heroicons/react/24/outline";
import { formatCurrency } from "@cashsouk/config";
import { formatWithdrawalReference } from "@cashsouk/types";
import { Button } from "@/components/ui/button";
import { InvestorActionDialog } from "@/components/investor-action-dialog";

interface WithdrawSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: number;
  displayReference?: string | null;
}

export function WithdrawSuccessDialog({
  open,
  onOpenChange,
  amount,
  displayReference,
}: WithdrawSuccessDialogProps) {
  const reference = displayReference?.trim()
    ? formatWithdrawalReference({ displayReference })
    : null;
  return (
    <InvestorActionDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={
        <div className="flex size-11 items-center justify-center rounded-2xl bg-status-success-bg text-status-success-text">
          <CheckIcon className="size-6" strokeWidth={2.2} />
        </div>
      }
      title="Withdrawal requested"
      description="We've received your request. It should reach your bank account in 2–3 business days."
      footer={
        <Button
          type="button"
          variant="action"
          className="h-11 w-full rounded-xl"
          onClick={() => onOpenChange(false)}
        >
          Done
        </Button>
      }
    >
      <div className="rounded-2xl border border-border bg-muted/40 px-5 py-6 text-center">
        <p className="text-ui text-muted-foreground">Amount on the way</p>
        <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-foreground">
          {formatCurrency(amount)}
        </p>
        {reference ? (
          <p className="mt-3 font-mono text-ui text-muted-foreground">Reference {reference}</p>
        ) : null}
      </div>
    </InvestorActionDialog>
  );
}
