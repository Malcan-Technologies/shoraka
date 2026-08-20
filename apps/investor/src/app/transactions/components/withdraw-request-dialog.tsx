"use client";

import Link from "next/link";
import { getBankAccountField, useOrganization } from "@cashsouk/config";
import { Label, MoneyInput } from "@cashsouk/ui";
import { MinusIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import {
  InvestorActionDialog,
  InvestorActionDialogIcon,
} from "@/components/investor-action-dialog";
import { PROFILE_BANKING_HREF } from "@/app/profile/profile-tabs";
import {
  formatBankAccountHint,
  withdrawLimitsHint,
  withdrawTypedAmountError,
} from "@/components/investor-money-copy";
import { useOrganizationDetail } from "@/hooks/use-organization-detail";
import { parseMoneyAmount } from "./transaction-utils";
import { MIN_WITHDRAWAL_AMOUNT } from "./transactions.types";

interface WithdrawRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: string;
  onAmountChange: (value: string) => void;
  availableBalance: number;
  validationError: string | null;
  onSubmit: () => void;
  onSeeWithdrawalHistory: () => void;
}

export function WithdrawRequestDialog({
  open,
  onOpenChange,
  amount,
  onAmountChange,
  availableBalance,
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
  const maxAmount = Math.max(0, availableBalance);
  const parsedAmount = parseMoneyAmount(amount);
  const liveError = withdrawTypedAmountError(
    parsedAmount,
    MIN_WITHDRAWAL_AMOUNT,
    maxAmount
  );
  const fieldError = liveError ?? validationError;
  const amountHintId = fieldError ? "withdraw-amount-error" : "withdraw-amount-hint";
  const amountInRange = parsedAmount > 0 && !liveError;

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
          <Button
            type="button"
            variant="action"
            className="h-11 flex-1 rounded-xl"
            disabled={!amountInRange || !bankReady}
            onClick={onSubmit}
          >
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
          invalid={Boolean(fieldError)}
          describedBy={amountHintId}
          inputClassName="h-11 rounded-xl"
        />
        {fieldError ? (
          <p id="withdraw-amount-error" className="text-ui text-destructive">
            {fieldError}
          </p>
        ) : (
          <p id="withdraw-amount-hint" className="text-meta text-muted-foreground">
            {withdrawLimitsHint(MIN_WITHDRAWAL_AMOUNT, maxAmount)}
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <p className="text-meta text-muted-foreground">Pays to</p>
          {!isBankDetailsLoading ? (
            <Link
              href={PROFILE_BANKING_HREF}
              className="shrink-0 text-meta text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              onClick={() => onOpenChange(false)}
            >
              {bankReady ? "Change bank account" : "Add bank account"}
            </Link>
          ) : null}
        </div>
        {bankReady ? (
          <>
            <p className="mt-1 text-ui font-medium text-foreground">{bankName}</p>
            <p className="text-ui text-muted-foreground">{accountHint}</p>
          </>
        ) : isBankDetailsLoading ? (
          <p className="mt-1 text-ui text-muted-foreground">Loading your bank details…</p>
        ) : (
          <p className="mt-1 text-ui text-muted-foreground">
            Add your bank details before withdrawing.
          </p>
        )}
      </div>
    </InvestorActionDialog>
  );
}
