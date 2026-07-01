"use client";

import * as React from "react";
import { ExclamationCircleIcon } from "@heroicons/react/24/outline";
import {
  buildApplicationProcessingFeeCallbackUrl,
  createApiClient,
  formatCurrency,
  openCurlecFpxCheckout,
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

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function resolveCheckoutContact(
  organization: { name?: string | null } | null | undefined,
  fallbackName?: string
) {
  return {
    email: "",
    contact: "+60000000000",
    name: organization?.name?.trim() || fallbackName || undefined,
  };
}

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

  React.useEffect(() => {
    if (resolvedFee?.status === "COMPLETED") {
      onFeeAlreadyPaid();
    }
  }, [onFeeAlreadyPaid, resolvedFee?.status]);

  const handlePayFee = async () => {
    let checkoutContact = resolveCheckoutContact(activeOrganization);

    if (!checkoutContact.email) {
      const apiClient = createApiClient(API_URL, getAccessToken);
      const me = await apiClient.get<{
        user: { email: string; first_name?: string; last_name?: string };
      }>("/v1/auth/me");
      if (me.success && me.data.user.email) {
        checkoutContact = {
          email: me.data.user.email,
          contact: checkoutContact.contact || "+60000000000",
          name:
            checkoutContact.name ??
            ([me.data.user.first_name, me.data.user.last_name].filter(Boolean).join(" ") ||
              "Applicant"),
        };
      }
    }

    if (!checkoutContact.email) {
      setError("We could not find an email address for this account");
      return;
    }

    if (!resolvedFee) {
      setError("Could not load the processing fee amount. Please try again.");
      return;
    }

    try {
      setIsOpeningCheckout(true);
      setError(null);

      if (resolvedFee.status === "COMPLETED") {
        onFeeAlreadyPaid();
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
        prefillName: checkoutContact.name,
        prefillEmail: checkoutContact.email,
        prefillContact: checkoutContact.contact,
        onDismiss: () => setIsOpeningCheckout(false),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not start payment";
      setError(message);
    } finally {
      setIsOpeningCheckout(false);
    }
  };

  const feeAmount = normalizeProcessingFeeAmount(resolvedFee?.amount);
  const isLoadingAmount = !initialFee && feeOrderQuery.isLoading;

  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold">Pay processing fee</h2>
        <p className="text-[15px] text-muted-foreground">
          Your declarations have been saved. Complete this one-time fee to submit your application
          for review.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <div className="flex items-start gap-3">
            <ExclamationCircleIcon className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        </div>
      ) : null}

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Application processing fee</CardTitle>
          <CardDescription>Charged once per application at first submission</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl bg-muted/50 px-4 py-3 text-center">
            <p className="text-sm text-muted-foreground">Amount due</p>
            {isLoadingAmount ? (
              <Skeleton className="mx-auto mt-2 h-9 w-32" />
            ) : (
              <p className="text-2xl font-semibold tabular-nums">
                {feeAmount != null ? formatCurrency(feeAmount) : "—"}
              </p>
            )}
          </div>
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
          <p className="text-center text-xs text-muted-foreground">
            This fee is non-refundable. Resubmissions after an amendment request do not require
            another payment.
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
