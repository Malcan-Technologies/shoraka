"use client";

import * as React from "react";
import { ExclamationCircleIcon } from "@heroicons/react/24/outline";
import {
  buildApplicationProcessingFeeCallbackUrl,
  formatCurrency,
  openCurlecFpxCheckout,
  resolvePortalCheckoutPayer,
  useAuthToken,
  useOrganization,
} from "@cashsouk/config";
import type { ApplicationProcessingFeeResponse } from "@cashsouk/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@cashsouk/ui";
import {
  normalizeProcessingFeeAmount,
  readIssuerPendingSubmitAfterFee,
  storeIssuerPendingSubmitAfterFee,
  useApplicationProcessingFeeOrder,
  useApplicationProcessingFeeQuery,
} from "@/hooks/use-application-processing-fee";
import { buildApplicationEditReturnTo } from "@/lib/application-processing-fee-routes";
import {
  PROCESSING_FEE_CONFIRMING_COPY,
  deriveProcessingFeePayStepModel,
  isProcessingFeeAwaitingConfirmation,
  resolvePendingProcessingFeeResumeFeeId,
} from "@/lib/application-processing-fee-confirmation";
import {
  isIssuerFeeCaptureMismatchHeldError,
  PaymentUnderReviewNotice,
} from "@/components/payment-under-review-notice";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface ApplicationProcessingFeeStepProps {
  applicationId: string;
  initialFee?: ApplicationProcessingFeeResponse | null;
  onBack: () => void;
  onFeeAlreadyPaid: () => void;
}

export function ApplicationProcessingFeeStep({
  applicationId,
  initialFee,
  onBack,
  onFeeAlreadyPaid,
}: ApplicationProcessingFeeStepProps) {
  const { getAccessToken } = useAuthToken();
  const { activeOrganization } = useOrganization();
  const pending = readIssuerPendingSubmitAfterFee();
  const awaitingConfirmation = isProcessingFeeAwaitingConfirmation(pending, applicationId);
  const resumeFeeId = resolvePendingProcessingFeeResumeFeeId(pending, applicationId);
  const feeOrderQuery = useApplicationProcessingFeeOrder(
    applicationId,
    !resumeFeeId && (!initialFee || awaitingConfirmation || initialFee?.status === "PAID"),
    {
      pollWhileConfirming:
        !resumeFeeId && (awaitingConfirmation || initialFee?.status === "PAID"),
    }
  );
  const savedFeeQuery = useApplicationProcessingFeeQuery(
    resumeFeeId ? applicationId : undefined,
    resumeFeeId ?? undefined,
    { pollUntilTerminal: Boolean(resumeFeeId) }
  );
  const resolvedFee = savedFeeQuery.data ?? feeOrderQuery.data ?? initialFee ?? null;
  const [error, setError] = React.useState<string | null>(null);
  const [isOpeningCheckout, setIsOpeningCheckout] = React.useState(false);
  const checkoutOpenInFlightRef = React.useRef(false);

  const payModel = deriveProcessingFeePayStepModel({
    status: resolvedFee?.status,
    heldError: isIssuerFeeCaptureMismatchHeldError(feeOrderQuery.error),
    awaitingConfirmation,
  });

  React.useEffect(() => {
    if (resumeFeeId) return;
    if (resolvedFee?.status === "COMPLETED") {
      onFeeAlreadyPaid();
    }
  }, [onFeeAlreadyPaid, resolvedFee?.status, resumeFeeId]);

  const handlePayFee = async () => {
    if (
      checkoutOpenInFlightRef.current ||
      isOpeningCheckout ||
      !payModel.showPayCta
    ) {
      return;
    }

    checkoutOpenInFlightRef.current = true;
    setIsOpeningCheckout(true);

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

      if (!resolvedFee) {
        setError("Could not load the processing fee amount. Please try again.");
        return;
      }

      setError(null);

      if (resolvedFee.status === "COMPLETED") {
        onFeeAlreadyPaid();
        return;
      }

      if (
        !deriveProcessingFeePayStepModel({
          status: resolvedFee.status,
          awaitingConfirmation,
        }).showPayCta
      ) {
        return;
      }

      const returnTo = buildApplicationEditReturnTo(applicationId);
      storeIssuerPendingSubmitAfterFee({
        applicationId,
        returnTo,
        declarationsSaved: true,
        feeId: resolvedFee.id,
        awaitingConfirmation: false,
      });

      const callbackUrl = buildApplicationProcessingFeeCallbackUrl(resolvedFee.id, returnTo);

      await openCurlecFpxCheckout({
        keyId: resolvedFee.curlecKeyId,
        orderId: resolvedFee.curlecOrderId,
        amountMyr: normalizeProcessingFeeAmount(resolvedFee.amount) ?? resolvedFee.amount,
        callbackUrl,
        description: "Application processing fee",
        prefillName: checkoutContact.name ?? "Applicant",
        prefillEmail: checkoutContact.email,
        prefillContact: checkoutContact.contact,
        onDismiss: () => setIsOpeningCheckout(false),
      });
    } catch (err) {
      if (isIssuerFeeCaptureMismatchHeldError(err)) {
        setError(null);
        return;
      }
      const message = err instanceof Error ? err.message : "Could not start payment";
      setError(message);
    } finally {
      checkoutOpenInFlightRef.current = false;
      setIsOpeningCheckout(false);
    }
  };

  const feeAmount = normalizeProcessingFeeAmount(resolvedFee?.amount);
  const isLoadingAmount = !initialFee && feeOrderQuery.isLoading && payModel.state === "ready-to-pay";

  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold">{payModel.headline}</h2>
        <p className="text-ui text-muted-foreground">{payModel.description}</p>
      </div>

      {error && payModel.showPayCta ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <div className="flex items-start gap-3">
            <ExclamationCircleIcon className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        </div>
      ) : null}

      {payModel.showUnderReview ? <PaymentUnderReviewNotice /> : null}

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Application processing fee</CardTitle>
          <CardDescription>Charged once per application at first submission</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl bg-muted/50 px-4 py-3 text-center">
            <p className="text-sm text-muted-foreground">
              {payModel.showPayCta ? "Amount due" : "Fee amount"}
            </p>
            {isLoadingAmount ? (
              <Skeleton className="mx-auto mt-2 h-9 w-32" />
            ) : (
              <p className="text-2xl font-semibold tabular-nums">
                {feeAmount != null ? formatCurrency(feeAmount) : "—"}
              </p>
            )}
          </div>
          {payModel.state === "confirming" ? (
            <div className="flex justify-center py-2" role="status" aria-live="polite">
              <div
                className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent"
                aria-hidden
              />
              <span className="sr-only">{PROCESSING_FEE_CONFIRMING_COPY.title}</span>
            </div>
          ) : null}
          {payModel.showPayCta ? (
            <Button
              type="button"
              variant="action"
              className="h-11 w-full rounded-xl"
              disabled={isOpeningCheckout || isLoadingAmount || !resolvedFee}
              onClick={() => void handlePayFee()}
            >
              {isOpeningCheckout
                ? "Opening checkout..."
                : isLoadingAmount
                  ? "Loading fee..."
                  : payModel.ctaLabel}
            </Button>
          ) : null}
          <p className="text-center text-xs text-muted-foreground">
            {payModel.state === "confirming"
              ? "Do not start another FPX payment while this one is confirming."
              : payModel.showUnderReview
                ? "No further payment is required while this fee is under review."
                : "This fee is non-refundable. Resubmissions after an amendment request do not require another payment."}
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <Button type="button" variant="outline" onClick={onBack}>
          Back to application
        </Button>
      </div>
    </div>
  );
}
