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
  storeIssuerPendingSubmitAfterFee,
  useApplicationProcessingFeeOrder,
} from "@/hooks/use-application-processing-fee";
import { buildApplicationEditReturnTo } from "@/lib/application-processing-fee-routes";
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
  const feeOrderQuery = useApplicationProcessingFeeOrder(applicationId, !initialFee);
  const resolvedFee = initialFee ?? feeOrderQuery.data ?? null;
  const [error, setError] = React.useState<string | null>(null);
  const [isOpeningCheckout, setIsOpeningCheckout] = React.useState(false);
  const checkoutOpenInFlightRef = React.useRef(false);

  const isUnderReview =
    resolvedFee?.status === "HELD" ||
    initialFee?.status === "HELD" ||
    isIssuerFeeCaptureMismatchHeldError(feeOrderQuery.error);

  React.useEffect(() => {
    if (resolvedFee?.status === "COMPLETED") {
      onFeeAlreadyPaid();
    }
  }, [onFeeAlreadyPaid, resolvedFee?.status]);

  const handlePayFee = async () => {
    if (checkoutOpenInFlightRef.current || isOpeningCheckout || isUnderReview) {
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

      if (resolvedFee.status === "HELD") {
        return;
      }

      const returnTo = buildApplicationEditReturnTo(applicationId);
      storeIssuerPendingSubmitAfterFee({
        applicationId,
        returnTo,
        declarationsSaved: true,
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
  const isLoadingAmount = !initialFee && feeOrderQuery.isLoading && !isUnderReview;

  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold">
          {isUnderReview ? "Processing fee" : "Pay processing fee"}
        </h2>
        <p className="text-[15px] text-muted-foreground">
          {isUnderReview
            ? "Your payment is being verified before the application can be submitted."
            : "Your declarations have been saved. Complete this one-time fee to submit your application for review."}
        </p>
      </div>

      {error && !isUnderReview ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <div className="flex items-start gap-3">
            <ExclamationCircleIcon className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        </div>
      ) : null}

      {isUnderReview ? <PaymentUnderReviewNotice /> : null}

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Application processing fee</CardTitle>
          <CardDescription>Charged once per application at first submission</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl bg-muted/50 px-4 py-3 text-center">
            <p className="text-sm text-muted-foreground">
              {isUnderReview ? "Fee amount" : "Amount due"}
            </p>
            {isLoadingAmount ? (
              <Skeleton className="mx-auto mt-2 h-9 w-32" />
            ) : (
              <p className="text-2xl font-semibold tabular-nums">
                {feeAmount != null ? formatCurrency(feeAmount) : "—"}
              </p>
            )}
          </div>
          {isUnderReview ? null : (
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
                  : "Pay with FPX"}
            </Button>
          )}
          <p className="text-center text-xs text-muted-foreground">
            {isUnderReview
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
