"use client";

import * as React from "react";
import { ExclamationCircleIcon } from "@heroicons/react/24/outline";
import {
  buildIssuerFacilityFeeCallbackUrl,
  formatCurrency,
  openCurlecFpxCheckout,
  resolvePortalCheckoutPayer,
  useAuthToken,
  useOrganization,
} from "@cashsouk/config";
import { Card, CardContent, CardHeader, CardTitle, Progress } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { PaymentUnderReviewNotice } from "@/components/payment-under-review-notice";
import {
  isFacilityFeeHeldError,
  useCreateFacilityFeePaymentMutation,
} from "@/hooks/use-facility-fee-payment";
import { buildFacilityFeeContractReturnTo } from "@/lib/facility-fee-payment-routes";
import {
  deriveFacilityFeePaymentCardModel,
  mapFacilityFeeOwnershipError,
  type FacilityFeePaymentCardModel,
} from "@/lib/facility-fee-payment-ui";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function FacilityFeePaymentCard({
  contractId,
  upfrontAmount,
  paidAmount,
  outstanding,
  perTxnMaxAmount,
  held = false,
  onBusyChange,
}: {
  contractId: string;
  upfrontAmount: number;
  paidAmount: number;
  outstanding: number;
  perTxnMaxAmount?: number | null;
  held?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const { getAccessToken } = useAuthToken();
  const { activeOrganization } = useOrganization();
  const createPayment = useCreateFacilityFeePaymentMutation();
  const [error, setError] = React.useState<string | null>(null);
  const [isOpeningCheckout, setIsOpeningCheckout] = React.useState(false);
  const [heldFromApi, setHeldFromApi] = React.useState(false);
  const [knownPerTxnMax, setKnownPerTxnMax] = React.useState<number | null>(
    perTxnMaxAmount ?? null
  );
  const checkoutOpenInFlightRef = React.useRef(false);
  const resolvedPerTxnMax = knownPerTxnMax ?? perTxnMaxAmount ?? null;

  const model = deriveFacilityFeePaymentCardModel({
    upfrontAmount,
    paidAmount,
    outstanding,
    perTxnMaxAmount: resolvedPerTxnMax,
    held: held || heldFromApi,
  });
  const isBusy = createPayment.isPending || isOpeningCheckout;

  React.useEffect(() => {
    onBusyChange?.(isBusy);
  }, [isBusy, onBusyChange]);

  const handlePay = React.useCallback(async () => {
    if (checkoutOpenInFlightRef.current || isBusy || !model.ctaLabel) return;

    checkoutOpenInFlightRef.current = true;
    setIsOpeningCheckout(true);
    setError(null);

    try {
      const checkoutContact = await resolvePortalCheckoutPayer({
        apiUrl: API_URL,
        getAccessToken,
        organization: activeOrganization,
      });

      if (!checkoutContact.email) {
        setError("We could not find an email address for this account");
        return;
      }

      const payment = await createPayment.mutateAsync(contractId);
      setKnownPerTxnMax(payment.perTxnMaxAmount);
      if (payment.status === "HELD") {
        setHeldFromApi(true);
        return;
      }

      const callbackUrl = buildIssuerFacilityFeeCallbackUrl(
        payment.id,
        buildFacilityFeeContractReturnTo(contractId)
      );

      await openCurlecFpxCheckout({
        keyId: payment.curlecKeyId,
        orderId: payment.curlecOrderId,
        amountMyr: payment.amount,
        callbackUrl,
        description: "Upfront facility fee",
        prefillName: checkoutContact.name ?? "Issuer",
        prefillEmail: checkoutContact.email,
        prefillContact: checkoutContact.contact,
        onDismiss: () => setIsOpeningCheckout(false),
      });
    } catch (err) {
      if (isFacilityFeeHeldError(err)) {
        setHeldFromApi(true);
        setError(null);
        return;
      }
      setError(mapFacilityFeeOwnershipError(err));
    } finally {
      checkoutOpenInFlightRef.current = false;
      setIsOpeningCheckout(false);
    }
  }, [activeOrganization, contractId, createPayment, getAccessToken, isBusy, model.ctaLabel]);

  return (
    <FacilityFeePaymentCardView
      model={model}
      perTxnMaxAmount={resolvedPerTxnMax}
      error={error}
      isBusy={isBusy}
      onPay={() => void handlePay()}
    />
  );
}

export function FacilityFeePaymentCardView({
  model,
  perTxnMaxAmount,
  error,
  isBusy,
  onPay,
}: {
  model: FacilityFeePaymentCardModel;
  perTxnMaxAmount?: number | null;
  error?: string | null;
  isBusy?: boolean;
  onPay?: () => void;
}) {
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="text-xl sm:text-2xl">Upfront facility fee</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {model.state === "held" ? (
          <PaymentUnderReviewNotice
            title="Facility fee payment under review"
            description="We received a payment notification, but CashSouk needs to review it. You do not need to make another payment."
          />
        ) : null}

        {error && model.state !== "held" ? (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4" role="alert">
            <div className="flex items-start gap-3">
              <ExclamationCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <p className="text-ui text-destructive">{error}</p>
            </div>
          </div>
        ) : null}

        {model.state === "none" ? (
          <p className="text-ui leading-6 text-muted-foreground">
            No upfront facility fee is required. You can start drawdowns when the facility is
            approved.
          </p>
        ) : (
          <>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <AmountCell label="Upfront requested" value={formatCurrency(model.upfrontAmount)} />
              <AmountCell label="Credited" value={formatCurrency(model.creditedAmount)} />
              <AmountCell label="Outstanding" value={formatCurrency(model.outstanding)} />
            </dl>
            <div className="space-y-2">
              <Progress
                value={model.progressPercent}
                aria-label="Upfront facility fee progress"
              />
              <p className="text-meta text-muted-foreground">
                {model.progressPercent}% of the requested upfront amount credited
              </p>
            </div>
            {model.requiresMultiplePayments && perTxnMaxAmount != null ? (
              <p className="text-ui leading-6 text-muted-foreground">
                Each FPX payment is capped at {formatCurrency(perTxnMaxAmount)}. You will need more
                than one payment to finish this upfront amount.
              </p>
            ) : (
              <p className="text-ui leading-6 text-muted-foreground">
                Pay the requested upfront amount to unlock drawdowns. Any remaining facility fee is
                collected later on successful drawdowns.
              </p>
            )}
            {model.state === "complete" ? (
              <p className="text-ui font-medium leading-6 text-foreground" role="status">
                Upfront facility fee is paid. Drawdowns are unlocked.
              </p>
            ) : null}
            {model.ctaLabel && onPay ? (
              <Button
                type="button"
                variant="action"
                className="h-11 rounded-xl"
                disabled={isBusy}
                aria-busy={isBusy}
                onClick={onPay}
              >
                {isBusy ? "Opening checkout..." : model.ctaLabel}
              </Button>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function AmountCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5">
      <dt className="text-meta font-medium leading-5 text-muted-foreground">{label}</dt>
      <dd className="text-base font-semibold tabular-nums leading-7 text-foreground">{value}</dd>
    </div>
  );
}
