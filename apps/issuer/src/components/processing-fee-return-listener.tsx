"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ProcessingFeeReturnDialog } from "@/components/processing-fee-return-dialog";
import {
  readIssuerPendingSubmitAfterFee,
  storeIssuerPendingSubmitAfterFee,
} from "@/hooks/use-application-processing-fee";
import {
  buildApplicationEditReturnTo,
  parseApplicationIdFromEditPath,
} from "@/lib/application-processing-fee-routes";
import {
  clearProcessingFeeAwaitingConfirmation,
  dismissProcessingFeeReturnPinState,
  markProcessingFeeAwaitingConfirmation,
  nextProcessingFeeReturnPinState,
  processingFeePendingForApplication,
  resolvePendingProcessingFeeResumeFeeId,
  resolveProcessingFeeReturnDestination,
  resolveProcessingFeeReturnIds,
} from "@/lib/application-processing-fee-confirmation";

export function ProcessingFeeReturnListener({
  onSubmitAfterPayment,
}: {
  onSubmitAfterPayment: (applicationId: string) => Promise<void>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pending = readIssuerPendingSubmitAfterFee();

  const urlFeeId = searchParams.get("processingFeeReturn");
  const urlApplicationId =
    parseApplicationIdFromEditPath(pathname) ?? pending?.applicationId ?? null;
  const pendingResumeFeeId = resolvePendingProcessingFeeResumeFeeId(
    pending,
    urlApplicationId
  );

  const [pinState, setPinState] = React.useState({
    pinnedFeeId: urlFeeId ?? pendingResumeFeeId,
    pinnedApplicationId: urlApplicationId,
    dismissed: false,
  });

  const nextPin = nextProcessingFeeReturnPinState(
    pinState,
    urlFeeId,
    urlApplicationId,
    pendingResumeFeeId
  );
  if (nextPin !== pinState) {
    setPinState(nextPin);
  }

  const { feeId, applicationId } = resolveProcessingFeeReturnIds(pinState);

  React.useEffect(() => {
    if (!feeId || !applicationId) return;
    const current = processingFeePendingForApplication(
      readIssuerPendingSubmitAfterFee(),
      applicationId
    );
    storeIssuerPendingSubmitAfterFee(
      markProcessingFeeAwaitingConfirmation(
        {
          applicationId,
          returnTo: current?.returnTo ?? buildApplicationEditReturnTo(applicationId),
          declarationsSaved: current?.declarationsSaved ?? true,
          feeId: current?.feeId,
        },
        feeId
      )
    );
  }, [applicationId, feeId]);

  const dismissToRetry = React.useCallback(() => {
    if (!applicationId) return;
    const current = processingFeePendingForApplication(
      readIssuerPendingSubmitAfterFee(),
      applicationId
    );
    if (current) {
      storeIssuerPendingSubmitAfterFee(clearProcessingFeeAwaitingConfirmation(current));
    }
    const initial = processingFeePendingForApplication(pending, applicationId);
    setPinState(dismissProcessingFeeReturnPinState);
    router.replace(
      resolveProcessingFeeReturnDestination({
        action: "retry-payment",
        applicationId,
        pendingReturnTo: current?.returnTo ?? initial?.returnTo,
      })
    );
  }, [applicationId, pending, router, setPinState]);

  const leaveForNow = React.useCallback(() => {
    if (!applicationId) return;
    const current = processingFeePendingForApplication(
      readIssuerPendingSubmitAfterFee(),
      applicationId
    );
    if (feeId) {
      storeIssuerPendingSubmitAfterFee(
        markProcessingFeeAwaitingConfirmation(
          current ?? {
            applicationId,
            returnTo: buildApplicationEditReturnTo(applicationId),
            declarationsSaved: true,
          },
          feeId
        )
      );
    }
    setPinState(dismissProcessingFeeReturnPinState);
    router.replace(
      resolveProcessingFeeReturnDestination({
        action: "leave-for-now",
        applicationId,
      })
    );
  }, [applicationId, feeId, router, setPinState]);

  const submitHandler = React.useCallback(async () => {
    if (!applicationId) {
      throw new Error("Application ID is missing");
    }
    await onSubmitAfterPayment(applicationId);
  }, [applicationId, onSubmitAfterPayment]);

  if (!feeId || !applicationId) {
    return null;
  }

  return (
    <ProcessingFeeReturnDialog
      applicationId={applicationId}
      feeId={feeId}
      open
      onDismissToRetry={dismissToRetry}
      onLeaveForNow={leaveForNow}
      onSubmitAfterPayment={submitHandler}
    />
  );
}
