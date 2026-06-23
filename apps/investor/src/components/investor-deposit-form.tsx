"use client";

import * as React from "react";
import { toast } from "sonner";
import { Label, MoneyInput } from "@cashsouk/ui";
import { useOrganization, type Organization } from "@cashsouk/config";
import { Button } from "@/components/ui/button";
import { useCreateInvestorDepositMutation } from "@/hooks/use-investor-deposit";
import {
  buildDepositCallbackUrl,
  openCurlecFpxCheckout,
} from "@/lib/curlec-checkout";
import { MIN_DEPOSIT_AMOUNT } from "@/app/transactions/components/transactions.types";
import { parseMoneyAmount } from "@/app/transactions/components/transaction-utils";

interface InvestorDepositFormProps {
  investorOrganizationId: string | undefined;
  amount: string;
  onAmountChange: (value: string) => void;
  validationError: string | null;
  onValidationErrorChange: (error: string | null) => void;
  returnTo?: string;
  disabled?: boolean;
  onStarted?: () => void;
}

function resolveCheckoutContact(activeOrganization: Organization | null) {
  if (!activeOrganization) {
    return { email: "", contact: "", name: undefined as string | undefined };
  }

  const member =
    activeOrganization.members.find((entry) => entry.role === "ORGANIZATION_ADMIN") ??
    activeOrganization.members[0];

  const name =
    activeOrganization.firstName && activeOrganization.lastName
      ? `${activeOrganization.firstName} ${activeOrganization.lastName}`
      : activeOrganization.name ?? undefined;

  return {
    email: member?.email ?? "",
    contact: activeOrganization.phoneNumber?.trim() || "+60000000000",
    name,
  };
}

export function InvestorDepositForm({
  investorOrganizationId,
  amount,
  onAmountChange,
  validationError,
  onValidationErrorChange,
  returnTo = "/transactions",
  disabled = false,
  onStarted,
}: InvestorDepositFormProps) {
  const { activeOrganization } = useOrganization();
  const createDeposit = useCreateInvestorDepositMutation();
  const [isOpeningCheckout, setIsOpeningCheckout] = React.useState(false);

  async function handleContinue() {
    const parsed = parseMoneyAmount(amount);
    if (!parsed || parsed < MIN_DEPOSIT_AMOUNT) {
      onValidationErrorChange(`Minimum deposit is RM ${MIN_DEPOSIT_AMOUNT}`);
      return;
    }

    if (!investorOrganizationId) {
      toast.error("Select an investor organization first");
      return;
    }

    const checkoutContact = resolveCheckoutContact(activeOrganization);
    if (!checkoutContact.email) {
      toast.error("We could not find an email address for this account");
      return;
    }

    onValidationErrorChange(null);

    try {
      const created = await createDeposit.mutateAsync({
        investorOrganizationId,
        amount: parsed,
      });
      onStarted?.();
      setIsOpeningCheckout(true);

      const callbackUrl = buildDepositCallbackUrl(created.id, returnTo);

      await openCurlecFpxCheckout({
        keyId: created.curlecKeyId,
        orderId: created.curlecOrderId,
        amountMyr: created.amount,
        callbackUrl,
        prefillName: checkoutContact.name,
        prefillEmail: checkoutContact.email,
        prefillContact: checkoutContact.contact,
        onDismiss: () => setIsOpeningCheckout(false),
      });
    } catch (error) {
      setIsOpeningCheckout(false);
      toast.error(error instanceof Error ? error.message : "Could not start deposit");
    }
  }

  const isBusy = createDeposit.isPending || isOpeningCheckout;

  return (
    <div className="space-y-4">
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
          disabled={disabled || isBusy}
        />
        {validationError ? (
          <p className="text-right text-xs text-destructive">{validationError}</p>
        ) : (
          <p className="text-right text-xs text-muted-foreground">
            Min. amount - RM {MIN_DEPOSIT_AMOUNT}
          </p>
        )}
      </div>

      <Button
        type="button"
        variant="action"
        className="h-11 w-full rounded-xl"
        disabled={disabled || isBusy || !investorOrganizationId}
        onClick={() => void handleContinue()}
      >
        {createDeposit.isPending
          ? "Preparing deposit..."
          : isOpeningCheckout
            ? "Opening checkout..."
            : "Pay with FPX"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Please ensure deposits come from your own bank account. Cashsouk does not accept third-party
        transfers.
      </p>
    </div>
  );
}
