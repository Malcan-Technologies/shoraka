"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ProcessingFeeReturnDialog } from "@/components/processing-fee-return-dialog";
import { readIssuerPendingSubmitAfterFee } from "@/hooks/use-application-processing-fee";
import { parseApplicationIdFromEditPath } from "@/lib/application-processing-fee-routes";

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
    pending?.applicationId ?? parseApplicationIdFromEditPath(pathname) ?? null;

  // Pin on first sight so wizard resume logic cannot strip the param before effects run.
  const [pinnedFeeId, setPinnedFeeId] = React.useState<string | null>(urlFeeId);
  const [pinnedApplicationId, setPinnedApplicationId] = React.useState<string | null>(
    urlApplicationId
  );
  const [dismissed, setDismissed] = React.useState(false);

  if (!dismissed) {
    if (urlFeeId && urlFeeId !== pinnedFeeId) {
      setPinnedFeeId(urlFeeId);
    }
    if (urlApplicationId && urlApplicationId !== pinnedApplicationId) {
      setPinnedApplicationId(urlApplicationId);
    }
  }

  const feeId = dismissed ? null : pinnedFeeId;
  const applicationId = dismissed ? null : pinnedApplicationId;

  const dismissToRetry = React.useCallback(() => {
    if (!applicationId) return;
    setPinnedFeeId(null);
    setPinnedApplicationId(null);
    setDismissed(true);
    const destination =
      pending?.returnTo ?? `/applications/${applicationId}/edit?continue=processingFee`;
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
