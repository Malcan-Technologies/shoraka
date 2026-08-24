"use client";

import * as React from "react";
import { toast } from "sonner";
import { Label, MoneyInput } from "@cashsouk/ui";
import {
  resolvePortalCheckoutPayer,
  useAuthToken,
  useOrganization,
} from "@cashsouk/config";
import { Button } from "@/components/ui/button";
import {
  clearInvestorDepositIntent,
  getOrCreateInvestorDepositIntent,
  isDepositIntentTerminalError,
  useCreateInvestorDepositMutation,
  useInvestorDepositLimitsQuery,
} from "@/hooks/use-investor-deposit";
import {
  buildDepositCallbackUrl,
  openCurlecFpxCheckout,
} from "@/lib/curlec-checkout";
import { parseMoneyAmount } from "@/app/transactions/components/transaction-utils";
import {
  depositLimitsHint,
  depositMinimumError,
  depositTypedAmountError,
} from "@/components/investor-money-copy";
import { PORTFOLIO_TRANSACTIONS_HREF } from "@/portfolio/portfolio-tabs";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

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

export function InvestorDepositForm({
  investorOrganizationId,
  amount,
  onAmountChange,
  validationError,
  onValidationErrorChange,
  returnTo = PORTFOLIO_TRANSACTIONS_HREF,
  disabled = false,
  onStarted,
}: InvestorDepositFormProps) {
  const { getAccessToken } = useAuthToken();
  const { activeOrganization } = useOrganization();
  const createDeposit = useCreateInvestorDepositMutation();
  const depositLimitsQuery = useInvestorDepositLimitsQuery();
  const [isOpeningCheckout, setIsOpeningCheckout] = React.useState(false);

  const minAmount = depositLimitsQuery.data?.minAmount;
  const maxAmount = depositLimitsQuery.data?.maxAmount;

  async function openCheckout(
    created: {
      id: string;
      curlecKeyId: string;
      curlecOrderId: string;
      amount: number;
    },
    payer: { email: string; contact?: string; name?: string }
  ) {
    onStarted?.();
    setIsOpeningCheckout(true);
    const callbackUrl = buildDepositCallbackUrl(created.id, returnTo);
    await openCurlecFpxCheckout({
      keyId: created.curlecKeyId,
      orderId: created.curlecOrderId,
      amountMyr: created.amount,
      callbackUrl,
      description: "Investor deposit",
      prefillName: payer.name,
      prefillEmail: payer.email,
      prefillContact: payer.contact,
      onDismiss: () => setIsOpeningCheckout(false),
    });
  }

  async function handleContinue() {
    const parsed = parseMoneyAmount(amount);
    if (minAmount == null || maxAmount == null) {
      toast.error("We're still loading deposit limits. Try again in a moment.");
      return;
    }

    if (!parsed) {
      onValidationErrorChange(depositMinimumError(minAmount));
      return;
    }

    const amountError = depositTypedAmountError(parsed, minAmount, maxAmount);
    if (amountError) {
      onValidationErrorChange(amountError);
      return;
    }

    if (!investorOrganizationId) {
      toast.error("Choose an investor organization first.");
      return;
    }

    const payer = await resolvePortalCheckoutPayer({
      apiUrl: API_URL,
      getAccessToken,
      organization: activeOrganization,
    });
    if (!payer.email) {
      toast.error("We couldn't find an email for this account.");
      return;
    }

    onValidationErrorChange(null);

    try {
      const depositIntentId = getOrCreateInvestorDepositIntent(investorOrganizationId, parsed);
      const created = await createDeposit.mutateAsync({
        investorOrganizationId,
        amount: parsed,
        depositIntentId,
      });
      await openCheckout(created, { email: payer.email, contact: payer.contact, name: payer.name });
    } catch (error) {
      if (isDepositIntentTerminalError(error)) {
        try {
          clearInvestorDepositIntent(investorOrganizationId);
          const freshIntentId = getOrCreateInvestorDepositIntent(investorOrganizationId, parsed);
          const created = await createDeposit.mutateAsync({
            investorOrganizationId,
            amount: parsed,
            depositIntentId: freshIntentId,
          });
          await openCheckout(created, {
            email: payer.email,
            contact: payer.contact,
            name: payer.name,
          });
          return;
        } catch (retryError) {
          setIsOpeningCheckout(false);
          toast.error(retryError instanceof Error ? retryError.message : "We couldn't start your deposit.");
          return;
        }
      }

      setIsOpeningCheckout(false);
      toast.error(error instanceof Error ? error.message : "We couldn't start your deposit.");
    }
  }

  const isBusy = createDeposit.isPending || isOpeningCheckout;
  const limitsReady = minAmount != null && maxAmount != null;
  const parsedAmount = parseMoneyAmount(amount);
  const liveError = limitsReady
    ? depositTypedAmountError(parsedAmount, minAmount, maxAmount)
    : null;
  const fieldError = liveError ?? validationError;
  const amountHintId = fieldError ? "deposit-amount-error" : "deposit-amount-hint";
  const amountInRange = limitsReady && parsedAmount > 0 && !liveError;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label className="text-ui text-foreground">How much would you like to add?</Label>
        <MoneyInput
          value={amount}
          onValueChange={(value) => {
            onAmountChange(value);
            if (validationError) onValidationErrorChange(null);
          }}
          prefix="RM"
          placeholder="0.00"
          invalid={Boolean(fieldError)}
          describedBy={amountHintId}
          inputClassName="h-11 rounded-xl"
          disabled={disabled || isBusy || !limitsReady}
        />
        {fieldError ? (
          <p id="deposit-amount-error" className="text-ui text-destructive">
            {fieldError}
          </p>
        ) : depositLimitsQuery.isLoading ? (
          <p id="deposit-amount-hint" className="text-meta text-muted-foreground">
            Loading how much you can add…
          </p>
        ) : limitsReady ? (
          <p id="deposit-amount-hint" className="text-meta text-muted-foreground">
            {depositLimitsHint(minAmount, maxAmount)}
          </p>
        ) : (
          <p id="deposit-amount-hint" className="text-ui text-destructive">
            We couldn&apos;t load deposit limits. Try again shortly.
          </p>
        )}
      </div>

      <div className="space-y-3">
        <Button
          type="button"
          variant="action"
          className="h-11 w-full rounded-xl"
          disabled={disabled || isBusy || !investorOrganizationId || !amountInRange}
          onClick={() => void handleContinue()}
        >
          {createDeposit.isPending
            ? "Preparing your payment…"
            : isOpeningCheckout
              ? "Opening your bank…"
              : "Continue to FPX"}
        </Button>
        <p className="text-center text-meta leading-5 text-muted-foreground">
          You&apos;ll be taken to your bank to finish the payment. Deposits must come from an account in
          your name — we can&apos;t accept transfers from someone else.
        </p>
      </div>
    </div>
  );
}
