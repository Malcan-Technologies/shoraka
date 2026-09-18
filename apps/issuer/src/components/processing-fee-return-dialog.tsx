"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  clearIssuerPendingSubmitAfterFee,
  useApplicationProcessingFeeQuery,
} from "@/hooks/use-application-processing-fee";
import { getApiMutationErrorCode } from "@/hooks/use-applications";
import {
  PROCESSING_FEE_CONFIRM_TIMEOUT_MS,
  deriveProcessingFeeReturnDialogView,
  type ProcessingFeeReturnInternalPhase,
} from "@/lib/application-processing-fee-confirmation";
import {
  ApplicationSubmittedSuccessView,
  ApplicationSubmittingView,
  OnboardingFeeConfirmingView,
  OnboardingFeeFailureView,
  OnboardingFeeUnderReviewView,
} from "@/components/onboarding-fee-return-views";

const SUCCESS_REDIRECT_DELAY_MS = 2_500;

interface ProcessingFeeReturnDialogProps {
  applicationId: string;
  feeId: string;
  open: boolean;
  onDismissToRetry: () => void;
  onLeaveForNow: () => void;
  onSubmitAfterPayment: () => Promise<void>;
}

export function ProcessingFeeReturnDialog({
  applicationId,
  feeId,
  open,
  onDismissToRetry,
  onLeaveForNow,
  onSubmitAfterPayment,
}: ProcessingFeeReturnDialogProps) {
  const router = useRouter();
  const [confirmDelayed, setConfirmDelayed] = React.useState(false);
  const [phase, setPhase] = React.useState<ProcessingFeeReturnInternalPhase>("confirming");
  const [submitFailed, setSubmitFailed] = React.useState(false);
  const submitStartedRef = React.useRef(false);

  const feeQuery = useApplicationProcessingFeeQuery(applicationId, feeId, {
    pollUntilTerminal: open && phase === "confirming",
  });
  const fee = feeQuery.data;
  const refetchFee = feeQuery.refetch;

  const resolved = deriveProcessingFeeReturnDialogView({
    elapsedMs: confirmDelayed ? PROCESSING_FEE_CONFIRM_TIMEOUT_MS : 0,
    internalPhase: phase,
    submitFailed,
    status: fee?.status,
    isQueryError: feeQuery.isError && fee == null,
  });

  const shouldRunTimeout = open && resolved.shouldPoll;

  React.useEffect(() => {
    if (!open) {
      setConfirmDelayed(false);
      setSubmitFailed(false);
      submitStartedRef.current = false;
      setPhase("confirming");
      return;
    }

    if (!shouldRunTimeout) {
      return;
    }

    if (confirmDelayed) return;

    const timer = window.setTimeout(
      () => setConfirmDelayed(true),
      PROCESSING_FEE_CONFIRM_TIMEOUT_MS
    );
    return () => window.clearTimeout(timer);
  }, [open, feeId, shouldRunTimeout, confirmDelayed]);

  React.useEffect(() => {
    if (!open || !resolved.shouldAutoSubmit || submitStartedRef.current) {
      return;
    }

    submitStartedRef.current = true;
    setPhase("submitting");

    void (async () => {
      try {
        await onSubmitAfterPayment();
        clearIssuerPendingSubmitAfterFee(applicationId);
        setPhase("submitted");
      } catch (error) {
        if (getApiMutationErrorCode(error) === "PROCESSING_FEE_REQUIRED") {
          submitStartedRef.current = false;
          setPhase("confirming");
          setConfirmDelayed(false);
          void refetchFee();
          return;
        }
        const message = error instanceof Error ? error.message : "Failed to submit application";
        toast.error(message);
        setSubmitFailed(true);
        setPhase("failed");
        submitStartedRef.current = false;
      }
    })();
  }, [applicationId, onSubmitAfterPayment, open, refetchFee, resolved.shouldAutoSubmit]);

  React.useEffect(() => {
    if (!open || phase !== "submitted") return;

    const timer = window.setTimeout(() => {
      router.replace("/applications");
    }, SUCCESS_REDIRECT_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [open, phase, router]);

  React.useEffect(() => {
    if (!open || resolved.phase !== "failed" || submitFailed || !resolved.showPayRetry) return;
    toast.error("Processing fee payment was not completed. Please try again.");
  }, [open, resolved.phase, resolved.showPayRetry, submitFailed]);

  const handleDialogOpenChange = React.useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      return;
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent
        className="max-w-md border-0 bg-transparent p-0 shadow-none"
        aria-describedby={undefined}
        onPointerDownOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => {
          event.preventDefault();
        }}
      >
        <DialogTitle className="sr-only">{resolved.dialogTitle}</DialogTitle>
        {resolved.phase === "confirming" ? (
          <OnboardingFeeConfirmingView
            title={resolved.title}
            description={resolved.description}
          />
        ) : null}
        {resolved.phase === "delayed" ? (
          <OnboardingFeeConfirmingView
            title={resolved.title}
            description={resolved.description}
            onLeave={resolved.showLeaveForNow ? onLeaveForNow : undefined}
          />
        ) : null}
        {resolved.phase === "submitting" ? <ApplicationSubmittingView /> : null}
        {resolved.phase === "submitted" ? (
          <ApplicationSubmittedSuccessView
            onContinue={() => {
              router.replace("/applications");
            }}
          />
        ) : null}
        {resolved.phase === "under-review" ? (
          <OnboardingFeeUnderReviewView onContinue={onLeaveForNow} />
        ) : null}
        {resolved.phase === "failed" ? (
          <OnboardingFeeFailureView
            reason={submitFailed ? "error" : resolved.failureReason}
            status={fee?.status}
            amount={fee?.amount}
            onTryAgain={onDismissToRetry}
            onLeave={resolved.showLeaveForNow ? onLeaveForNow : undefined}
            showTryAgain={resolved.showPayRetry || submitFailed}
            title={resolved.title}
            description={resolved.description}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
