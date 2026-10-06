"use client";

import * as React from "react";
import Link from "next/link";
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
  useInvestorInvestmentLimitQuery,
} from "@/hooks/use-investor-deposit";
import {
  buildDepositCallbackUrl,
  openCurlecFpxCheckout,
} from "@/lib/curlec-checkout";
import { parseMoneyAmount } from "@/app/transactions/components/transaction-utils";
import {
  depositHeadroomBlockedHint,
  depositLimitsHint,
  depositMinimumError,
  depositTypedAmountError,
  INVESTOR_TYPE_REQUIRED_DEPOSIT_MESSAGE,
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
  const investmentLimitQuery = useInvestorInvestmentLimitQuery(investorOrganizationId);
  const [isOpeningCheckout, setIsOpeningCheckout] = React.useState(false);

  const minAmount = depositLimitsQuery.data?.minAmount;
  const platformMaxAmount = depositLimitsQuery.data?.maxAmount;
  const investmentLimit = investmentLimitQuery.data;
  // The API rejects every deposit until the investor sets their type, so block before FPX.
  const classificationRequired = investmentLimit?.classificationRequired === true;
  const maxAmount =
    investmentLimit?.depositMaxAmount ?? platformMaxAmount;
  const depositBlockedByLimit =
    !classificationRequired &&
    minAmount != null &&
    maxAmount != null &&
    investmentLimit?.limit != null &&
    maxAmount < minAmount;

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
    if (classificationRequired) {
      onValidationErrorChange(INVESTOR_TYPE_REQUIRED_DEPOSIT_MESSAGE);
      return;
    }
    if (depositBlockedByLimit && investmentLimit?.limit != null) {
      onValidationErrorChange(
        depositHeadroomBlockedHint(maxAmount, minAmount, {
          tier: investmentLimit.tier,
          limit: investmentLimit.limit,
          pendingDeposits: investmentLimit.pendingDeposits,
        })
      );
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

  React.useEffect(() => {
    if (!depositBlockedByLimit && !classificationRequired) return;
    if (amount.trim() === "") return;
    onAmountChange("");
    if (validationError) onValidationErrorChange(null);
  }, [
    amount,
    classificationRequired,
    depositBlockedByLimit,
    onAmountChange,
    onValidationErrorChange,
    validationError,
  ]);

  const isBusy = createDeposit.isPending || isOpeningCheckout;
  const limitsReady = minAmount != null && maxAmount != null && !investmentLimitQuery.isLoading;
  const parsedAmount = parseMoneyAmount(amount);
  const liveError = limitsReady && !classificationRequired
    ? depositBlockedByLimit && investmentLimit?.limit != null
      ? depositHeadroomBlockedHint(maxAmount, minAmount, {
          tier: investmentLimit.tier,
          limit: investmentLimit.limit,
          pendingDeposits: investmentLimit.pendingDeposits,
        })
      : depositTypedAmountError(parsedAmount, minAmount, maxAmount)
    : null;
  const fieldError = liveError ?? validationError;
  const amountHintId = fieldError ? "deposit-amount-error" : "deposit-amount-hint";
  const amountInRange =
    limitsReady &&
    parsedAmount > 0 &&
    !liveError &&
    !depositBlockedByLimit &&
    !classificationRequired;

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
          disabled={
            disabled || isBusy || !limitsReady || depositBlockedByLimit || classificationRequired
          }
        />
        {limitsReady && classificationRequired ? (
          <p id={amountHintId} className="text-ui text-destructive">
            {INVESTOR_TYPE_REQUIRED_DEPOSIT_MESSAGE}{" "}
            <Link href="/profile?focus=completeness" className="font-medium underline">
              Go to profile
            </Link>
          </p>
        ) : fieldError ? (
          <p id="deposit-amount-error" className="text-ui text-destructive">
            {fieldError}
          </p>
        ) : depositLimitsQuery.isLoading || investmentLimitQuery.isLoading ? (
          <p id="deposit-amount-hint" className="text-meta text-muted-foreground">
            Loading how much you can add…
          </p>
        ) : limitsReady ? (
          <p id="deposit-amount-hint" className="text-meta text-muted-foreground">
            {depositLimitsHint(
              minAmount,
              maxAmount,
              investmentLimit
                ? {
                    tier: investmentLimit.tier,
                    limit: investmentLimit.limit,
                    depositHeadroom: investmentLimit.depositHeadroom,
                  }
                : null
            )}
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
