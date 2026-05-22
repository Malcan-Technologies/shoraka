"use client";

import { toast } from "sonner";
import { Label, MoneyInput } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useInvestorBalanceTestTopupMutation } from "@/components/dev-balance-topup";
import { MIN_DEPOSIT_AMOUNT } from "./transactions-mock-data";
import { parseMoneyAmount } from "./transaction-utils";

interface DepositDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  investorOrganizationId: string | undefined;
  amount: string;
  onAmountChange: (value: string) => void;
  validationError: string | null;
  onValidationErrorChange: (error: string | null) => void;
  onBankTransfer: () => void;
  onFpx: () => void;
}

export function DepositDialog({
  open,
  onOpenChange,
  investorOrganizationId,
  amount,
  onAmountChange,
  validationError,
  onValidationErrorChange,
  onBankTransfer,
  onFpx,
}: DepositDialogProps) {
  const topUp = useInvestorBalanceTestTopupMutation();

  async function handleDevTopup() {
    const parsed = parseMoneyAmount(amount);
    if (!parsed || parsed <= 0) {
      onValidationErrorChange("Enter a valid amount for dev top-up");
      return;
    }
    if (!investorOrganizationId) {
      toast.error("Select an investor organization first");
      return;
    }

    onValidationErrorChange(null);
    try {
      await topUp.mutateAsync({ investorOrganizationId, amount: parsed });
      toast.success(`Test top-up: RM ${parsed.toLocaleString("en-MY")}`);
      onAmountChange("");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test top-up failed");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-xl p-0">
        <DialogHeader className="border-b px-6 pb-4 pt-6 text-center">
          <DialogTitle className="text-xl font-semibold">Deposit</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 px-6 py-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Deposit amount</Label>
            <MoneyInput
              value={amount}
              onValueChange={(value) => {
                onAmountChange(value);
                if (validationError) onValidationErrorChange(null);
              }}
              prefix="RM"
              placeholder="0.00"
              inputClassName="h-11 rounded-xl"
            />
            {validationError ? (
              <p className="text-right text-xs text-destructive">{validationError}</p>
            ) : (
              <p className="text-right text-xs text-muted-foreground">
                Min. amount - RM {MIN_DEPOSIT_AMOUNT}
              </p>
            )}
          </div>

          <div className="space-y-3 pt-2">
            <Button
              type="button"
              variant="action"
              className="h-11 w-full rounded-xl"
              onClick={onBankTransfer}
            >
              Bank Transfer
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full rounded-xl border-primary text-primary hover:bg-primary/5"
              onClick={onFpx}
            >
              FPX
            </Button>
          </div>

          <div className="rounded-lg border border-dashed border-amber-700/35 bg-amber-50/80 px-3 py-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-amber-900/80">
              Dev top-up
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 h-9 w-full border-amber-700/40 bg-white text-sm text-amber-950 hover:bg-amber-100/80"
              disabled={!investorOrganizationId || topUp.isPending}
              onClick={() => void handleDevTopup()}
            >
              {topUp.isPending ? "Topping up..." : "Dev topup"}
            </Button>
          </div>
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <p className="w-full text-center text-xs text-muted-foreground">
            Please ensure all deposits come from your own bank account. Cashsouk does not accept
            deposits from third-party accounts.
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
