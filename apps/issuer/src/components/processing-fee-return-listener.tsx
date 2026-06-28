"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ProcessingFeeReturnDialog } from "@/components/processing-fee-return-dialog";
import { readIssuerPendingSubmitAfterFee } from "@/hooks/use-application-processing-fee";

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
    pending?.applicationId ?? pathname.match(/^\/applications\/edit\/([^/]+)/)?.[1] ?? null;

  // Pin on first render so wizard resume logic cannot strip the param before effects run.
  const pinnedFeeIdRef = React.useRef<string | null>(null);
  const pinnedApplicationIdRef = React.useRef<string | null>(null);
  const [dismissed, setDismissed] = React.useState(false);

  if (!dismissed) {
    if (urlFeeId) pinnedFeeIdRef.current = urlFeeId;
    if (urlApplicationId) pinnedApplicationIdRef.current = urlApplicationId;
  }

  const feeId = dismissed ? null : pinnedFeeIdRef.current;
  const applicationId = dismissed ? null : pinnedApplicationIdRef.current;

  const dismissToRetry = React.useCallback(() => {
    if (!applicationId) return;
    pinnedFeeIdRef.current = null;
    pinnedApplicationIdRef.current = null;
    setDismissed(true);
    const destination =
      pending?.returnTo ?? `/applications/edit/${applicationId}?continue=processingFee`;
    router.replace(destination);
  }, [applicationId, pending?.returnTo, router]);

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
      onSubmitAfterPayment={submitHandler}
    />
  );
}
