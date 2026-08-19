"use client";

import { formatCurrency, getBankAccountField, useOrganization } from "@cashsouk/config";
import { ArrowUpTrayIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import {
  InvestorActionDialog,
  InvestorActionDialogIcon,
} from "@/components/investor-action-dialog";
import { formatBankAccountHint } from "@/components/investor-money-copy";
import { useOrganizationDetail } from "@/hooks/use-organization-detail";

interface WithdrawConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: number;
  onConfirm: () => void;
  isLoading?: boolean;
  errorMessage?: string | null;
}

export function WithdrawConfirmDialog({
  open,
  onOpenChange,
  amount,
  onConfirm,
  isLoading = false,
  errorMessage = null,
}: WithdrawConfirmDialogProps) {
  const { activeOrganization } = useOrganization();
  const { data: orgDetail } = useOrganizationDetail(activeOrganization?.id, open);
  const bankName = getBankAccountField(orgDetail?.bankAccountDetails, "Bank");
  const accountHint = formatBankAccountHint(
    getBankAccountField(orgDetail?.bankAccountDetails, "Bank account number") || ""
  );
  const destination =
    bankName && accountHint && accountHint !== "Not set"
      ? `${bankName} · ${accountHint}`
      : bankName || "your registered bank account";

  return (
    <InvestorActionDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={
        <InvestorActionDialogIcon>
          <ArrowUpTrayIcon className="size-6" />
        </InvestorActionDialogIcon>
      }
      title="Confirm withdrawal"
      description={`We'll send this to ${destination}.`}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1 rounded-xl"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Back
          </Button>
          <Button
            type="button"
            variant="action"
            className="h-11 flex-1 rounded-xl"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? "Sending…" : "Send withdrawal"}
          </Button>
        </>
      }
      footnote="Withdrawals usually arrive in 2–3 business days."
    >
      <div className="rounded-2xl border border-border bg-muted/40 px-5 py-6 text-center">
        <p className="text-ui text-muted-foreground">You're withdrawing</p>
        <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-foreground">
          {formatCurrency(amount)}
        </p>
        {errorMessage ? <p className="mt-3 text-ui text-destructive">{errorMessage}</p> : null}
      </div>
    </InvestorActionDialog>
  );
}
