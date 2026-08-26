"use client";

import * as React from "react";
import { ExclamationCircleIcon } from "@heroicons/react/24/outline";
import {
  buildIssuerExcessLateChargeCallbackUrl,
  formatCurrency,
  openCurlecFpxCheckout,
  resolvePortalCheckoutPayer,
  useAuthToken,
  useOrganization,
} from "@cashsouk/config";
import { Card, CardContent, CardHeader, CardTitle, InfoTooltip, Progress } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { PaymentUnderReviewNotice } from "@/components/payment-under-review-notice";
import {
  isExcessLateChargeHeldError,
  useCreateExcessLateChargePaymentMutation,
} from "@/hooks/use-excess-late-charge-payment";
import { buildExcessLateChargeNoteReturnTo } from "@/lib/excess-late-charge-payment-routes";
import {
  deriveExcessLateChargePaymentCardModel,
  mapExcessLateChargeOwnershipError,
  type ExcessLateChargePaymentCardModel,
} from "@/lib/excess-late-charge-payment-ui";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function ExcessLateChargePaymentCard({
  noteId,
  owedAmount,
  paidAmount,
  outstanding,
  noteReference,
  perTxnMaxAmount,
  held = false,
}: {
  noteId: string;
  owedAmount: number;
  paidAmount: number;
  outstanding: number;
  noteReference: string;
  perTxnMaxAmount?: number | null;
  held?: boolean;
}) {
  const { getAccessToken } = useAuthToken();
  const { activeOrganization } = useOrganization();
  const createPayment = useCreateExcessLateChargePaymentMutation();
  const [error, setError] = React.useState<string | null>(null);
  const [isOpeningCheckout, setIsOpeningCheckout] = React.useState(false);
  const [heldFromApi, setHeldFromApi] = React.useState(false);
  const [knownPerTxnMax, setKnownPerTxnMax] = React.useState<number | null>(
    perTxnMaxAmount ?? null
  );
  const checkoutOpenInFlightRef = React.useRef(false);
  const resolvedPerTxnMax = knownPerTxnMax ?? perTxnMaxAmount ?? null;

  const model = deriveExcessLateChargePaymentCardModel({
    owedAmount,
    paidAmount,
    outstanding,
    noteReference,
    perTxnMaxAmount: resolvedPerTxnMax,
    held: held || heldFromApi,
  });
  const isBusy = createPayment.isPending || isOpeningCheckout;

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

      const payment = await createPayment.mutateAsync(noteId);
      setKnownPerTxnMax(payment.perTxnMaxAmount);
      if (payment.status === "HELD") {
        setHeldFromApi(true);
        return;
      }

      const callbackUrl = buildIssuerExcessLateChargeCallbackUrl(
        payment.id,
        buildExcessLateChargeNoteReturnTo(noteId)
      );

      await openCurlecFpxCheckout({
        keyId: payment.curlecKeyId,
        orderId: payment.curlecOrderId,
        amountMyr: payment.amount,
        callbackUrl,
        description: "Late payment charges",
        prefillName: checkoutContact.name ?? "Issuer",
        prefillEmail: checkoutContact.email,
        prefillContact: checkoutContact.contact,
        onDismiss: () => setIsOpeningCheckout(false),
      });
    } catch (err) {
      if (isExcessLateChargeHeldError(err)) {
        setHeldFromApi(true);
        setError(null);
        return;
      }
      setError(mapExcessLateChargeOwnershipError(err));
    } finally {
      checkoutOpenInFlightRef.current = false;
      setIsOpeningCheckout(false);
    }
  }, [activeOrganization, createPayment, getAccessToken, isBusy, model.ctaLabel, noteId]);

  return (
    <ExcessLateChargePaymentCardView
      model={model}
      perTxnMaxAmount={resolvedPerTxnMax}
      error={error}
      isBusy={isBusy}
      onPay={() => void handlePay()}
    />
  );
}

export function ExcessLateChargePaymentCardView({
  model,
  perTxnMaxAmount,
  error,
  isBusy,
  onPay,
}: {
  model: ExcessLateChargePaymentCardModel;
  perTxnMaxAmount?: number | null;
  error?: string | null;
  isBusy?: boolean;
  onPay?: () => void;
}) {
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl">
          {model.title}
          <InfoTooltip content="These are late payment charges that were not covered by the repayment received." />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {model.state === "held" ? (
          <PaymentUnderReviewNotice
            title="Late charge payment under review"
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
            No separately billed late charges are due on this note.
          </p>
        ) : (
          <>
            <p className="text-ui leading-6 text-muted-foreground">{model.description}</p>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <AmountCell label="Late charges due" value={formatCurrency(model.owedAmount)} />
              <AmountCell label="Paid" value={formatCurrency(model.creditedAmount)} />
              <AmountCell label="Outstanding" value={formatCurrency(model.outstanding)} />
            </dl>
            <div className="space-y-2">
              <Progress value={model.progressPercent} aria-label="Late charges progress" />
              <p className="text-meta text-muted-foreground">
                {model.progressPercent}% of the late charges paid
              </p>
            </div>
            {model.requiresMultiplePayments && perTxnMaxAmount != null ? (
              <p className="text-ui leading-6 text-muted-foreground">
                Each FPX payment is capped at {formatCurrency(perTxnMaxAmount)}. You will need more
                than one payment to finish this amount.
              </p>
            ) : null}
            {model.state === "complete" ? (
              <p className="text-ui font-medium leading-6 text-foreground" role="status">
                Late payment charges are paid.
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
