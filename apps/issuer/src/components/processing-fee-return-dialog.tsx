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
  isTerminalProcessingFeeStatus,
  useApplicationProcessingFeeQuery,
} from "@/hooks/use-application-processing-fee";
import { getApiMutationErrorCode } from "@/hooks/use-applications";
import {
  ApplicationSubmittedSuccessView,
  ApplicationSubmittingView,
  OnboardingFeeConfirmingView,
  OnboardingFeeFailureView,
} from "@/components/onboarding-fee-return-views";

const PAYMENT_CONFIRM_TIMEOUT_MS = 20_000;
const SUCCESS_REDIRECT_DELAY_MS = 2_500;

type DialogPhase = "confirming" | "submitting" | "submitted" | "failed";

interface ProcessingFeeReturnDialogProps {
  applicationId: string;
  feeId: string;
  open: boolean;
  onDismissToRetry: () => void;
  onSubmitAfterPayment: () => Promise<void>;
}

export function ProcessingFeeReturnDialog({
  applicationId,
  feeId,
  open,
  onDismissToRetry,
  onSubmitAfterPayment,
}: ProcessingFeeReturnDialogProps) {
  const router = useRouter();
  const [pollTimedOut, setPollTimedOut] = React.useState(false);
  const [phase, setPhase] = React.useState<DialogPhase>("confirming");
  const [submitFailed, setSubmitFailed] = React.useState(false);
  const submitStartedRef = React.useRef(false);

  const feeQuery = useApplicationProcessingFeeQuery(applicationId, feeId, {
    pollUntilTerminal: open && phase === "confirming",
  });
  const fee = feeQuery.data;
  const refetchFee = feeQuery.refetch;

  const hasDefinitiveSuccess = fee?.status === "COMPLETED";
  const hasDefinitiveFailure =
    fee != null && isTerminalProcessingFeeStatus(fee.status) && fee.status !== "COMPLETED";

  const shouldRunTimeout = open && phase === "confirming" && !hasDefinitiveSuccess && !hasDefinitiveFailure;

  React.useEffect(() => {
    if (!open) {
      setPollTimedOut(false);
      setSubmitFailed(false);
      submitStartedRef.current = false;
      setPhase("confirming");
      return;
    }

    if (!shouldRunTimeout) {
      setPollTimedOut(false);
      return;
    }

    const timer = window.setTimeout(() => setPollTimedOut(true), PAYMENT_CONFIRM_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [open, feeId, shouldRunTimeout]);

  React.useEffect(() => {
    if (!open || phase !== "confirming" || !hasDefinitiveSuccess || submitStartedRef.current) {
      return;
    }

    submitStartedRef.current = true;
    setPhase("submitting");

    void (async () => {
      try {
        await onSubmitAfterPayment();
        clearIssuerPendingSubmitAfterFee();
        setPhase("submitted");
      } catch (error) {
        if (getApiMutationErrorCode(error) === "PROCESSING_FEE_REQUIRED") {
          submitStartedRef.current = false;
          setPhase("confirming");
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
  }, [hasDefinitiveSuccess, onSubmitAfterPayment, open, phase, refetchFee]);

  React.useEffect(() => {
    if (!open || phase !== "submitted") return;

    const timer = window.setTimeout(() => {
      router.replace("/applications");
    }, SUCCESS_REDIRECT_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [open, phase, router]);

  const handleTryAgain = React.useCallback(() => {
    onDismissToRetry();
  }, [onDismissToRetry]);

  const resolvedPhase: DialogPhase = React.useMemo(() => {
    if (phase === "submitting" || phase === "submitted" || phase === "failed") return phase;
    if (hasDefinitiveFailure) return "failed";
    if (feeQuery.isError) return "failed";
    if (pollTimedOut) return "failed";
    return "confirming";
  }, [feeQuery.isError, hasDefinitiveFailure, phase, pollTimedOut]);

  const failureReason = React.useMemo(() => {
    if (hasDefinitiveFailure) return "failed" as const;
    if (feeQuery.isError) return "error" as const;
    if (pollTimedOut) return "timeout" as const;
    return "failed" as const;
  }, [feeQuery.isError, hasDefinitiveFailure, pollTimedOut]);

  React.useEffect(() => {
    if (!open || resolvedPhase !== "failed" || submitFailed) return;
    toast.error("Processing fee payment was not completed. Please try again.");
  }, [open, resolvedPhase, submitFailed]);

  const dialogTitle =
    resolvedPhase === "confirming"
      ? "Confirming your payment"
      : resolvedPhase === "submitting"
        ? "Submitting your application"
        : resolvedPhase === "submitted"
          ? "Application submitted"
          : "Payment not completed";

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
          if (
            resolvedPhase === "submitting" ||
            resolvedPhase === "submitted" ||
            resolvedPhase === "failed"
          ) {
            event.preventDefault();
          }
        }}
      >
        <DialogTitle className="sr-only">{dialogTitle}</DialogTitle>
        {resolvedPhase === "confirming" ? (
          <OnboardingFeeConfirmingView onCancel={handleTryAgain} />
        ) : null}
        {resolvedPhase === "submitting" ? <ApplicationSubmittingView /> : null}
        {resolvedPhase === "submitted" ? (
          <ApplicationSubmittedSuccessView
            onContinue={() => {
              router.replace("/applications");
            }}
          />
        ) : null}
        {resolvedPhase === "failed" ? (
          <OnboardingFeeFailureView
            reason={submitFailed ? "error" : failureReason}
            status={fee?.status}
            amount={fee?.amount}
            onTryAgain={handleTryAgain}
            title={submitFailed ? "Could not submit application" : undefined}
            description={
              submitFailed
                ? "Your payment was received, but we could not submit the application. Please try again or contact support if this continues."
                : undefined
            }
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
