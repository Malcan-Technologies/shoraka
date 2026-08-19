"use client";

import { getBankAccountField, useOrganization } from "@cashsouk/config";
import { Label, MoneyInput } from "@cashsouk/ui";
import { MinusIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import {
  InvestorActionDialog,
  InvestorActionDialogIcon,
} from "@/components/investor-action-dialog";
import { formatBankAccountHint, withdrawMinimumHint } from "@/components/investor-money-copy";
import { useOrganizationDetail } from "@/hooks/use-organization-detail";
import { MIN_WITHDRAWAL_AMOUNT } from "./transactions.types";

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
  const { activeOrganization } = useOrganization();
  const { data: orgDetail, isLoading: isBankDetailsLoading } = useOrganizationDetail(
    activeOrganization?.id,
    open
  );
  const bankDetails = orgDetail?.bankAccountDetails;
  const bankName = isBankDetailsLoading
    ? "Loading…"
    : getBankAccountField(bankDetails, "Bank") || "Not set";
  const accountNumber = isBankDetailsLoading
    ? "Loading…"
    : getBankAccountField(bankDetails, "Bank account number") || "Not set";
  const accountHint = formatBankAccountHint(accountNumber);
  const bankReady = !isBankDetailsLoading && bankName !== "Not set" && accountNumber !== "Not set";

  return (
    <InvestorActionDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={
        <InvestorActionDialogIcon>
          <MinusIcon className="size-6" />
        </InvestorActionDialogIcon>
      }
      title="Withdraw cash"
      description="We'll send this to your registered bank account."
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1 rounded-xl"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" variant="action" className="h-11 flex-1 rounded-xl" onClick={onSubmit}>
            Review withdrawal
          </Button>
        </>
      }
      footnote={
        <button
          type="button"
          className="text-ui font-medium text-foreground underline-offset-2 hover:underline"
          onClick={onSeeWithdrawalHistory}
        >
          View withdrawal history
        </button>
      }
    >
      <div className="space-y-2">
        <Label className="text-ui text-foreground">How much would you like to withdraw?</Label>
        <MoneyInput
          value={amount}
          onValueChange={onAmountChange}
          prefix="RM"
          placeholder="0.00"
          inputClassName="h-11 rounded-xl"
        />
        {validationError ? (
          <p className="text-ui text-destructive">{validationError}</p>
        ) : (
          <p className="text-meta text-muted-foreground">{withdrawMinimumHint(MIN_WITHDRAWAL_AMOUNT)}</p>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3">
        <p className="text-meta text-muted-foreground">Pays to</p>
        {bankReady ? (
          <>
            <p className="mt-1 text-ui font-medium text-foreground">{bankName}</p>
            <p className="text-ui text-muted-foreground">{accountHint}</p>
          </>
        ) : isBankDetailsLoading ? (
          <p className="mt-1 text-ui text-muted-foreground">Loading your bank details…</p>
        ) : (
          <p className="mt-1 text-ui text-muted-foreground">
            Add your bank details in Profile before withdrawing.
          </p>
        )}
      </div>
    </InvestorActionDialog>
  );
}
