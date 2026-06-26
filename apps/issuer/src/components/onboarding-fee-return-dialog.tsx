"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useOrganization } from "@cashsouk/config";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  clearIssuerPendingOnboarding,
  isTerminalOnboardingFeeStatus,
  readIssuerPendingOnboarding,
  storeIssuerPendingOnboarding,
  useIssuerOnboardingFeeQuery,
  type IssuerPendingOnboarding,
} from "@/hooks/use-issuer-onboarding-fee";
import { ISSUER_ONBOARDING_FEE_RETURN_TO } from "@/lib/issuer-onboarding-fee-routes";
import {
  OnboardingFeeConfirmingView,
  OnboardingFeeFailureView,
  OnboardingFeeStartingEkycView,
  OnboardingFeeSuccessView,
} from "@/components/onboarding-fee-return-views";

/** Only used when Curlec never returns a terminal status (payment still pending). */
const PAYMENT_CONFIRM_TIMEOUT_MS = 20_000;

type DialogPhase = "confirming" | "starting-ekyc" | "success" | "failed";

interface OnboardingFeeReturnDialogProps {
  feeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OnboardingFeeReturnDialog({
  feeId,
  open,
  onOpenChange,
}: OnboardingFeeReturnDialogProps) {
  const router = useRouter();
  const { startCorporateOnboarding, switchOrganization, refreshOrganizations, organizations } =
    useOrganization();
  const [pollTimedOut, setPollTimedOut] = React.useState(false);
  const [isStartingEkyc, setIsStartingEkyc] = React.useState(false);
  const ekycStartedRef = React.useRef(false);
  const orgsRefreshAttemptedRef = React.useRef(false);

  const feeQuery = useIssuerOnboardingFeeQuery(feeId, {
    pollUntilTerminal: open,
  });
  const fee = feeQuery.data;

  const hasDefinitiveSuccess = fee?.status === "COMPLETED";
  const hasDefinitiveFailure =
    fee != null &&
    isTerminalOnboardingFeeStatus(fee.status) &&
    fee.status !== "COMPLETED";

  const shouldRunTimeout = open && !hasDefinitiveSuccess && !hasDefinitiveFailure;

  React.useEffect(() => {
    if (!open) {
      setPollTimedOut(false);
      ekycStartedRef.current = false;
      return;
    }

    if (!shouldRunTimeout) {
      setPollTimedOut(false);
      return;
    }

    const timer = window.setTimeout(() => setPollTimedOut(true), PAYMENT_CONFIRM_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [open, feeId, shouldRunTimeout]);

  const handleTryAgain = React.useCallback(() => {
    onOpenChange(false);
    router.replace(ISSUER_ONBOARDING_FEE_RETURN_TO);
  }, [onOpenChange, router]);

  const phase: DialogPhase = React.useMemo(() => {
    if (isStartingEkyc) return "starting-ekyc";
    if (hasDefinitiveSuccess) return "success";
    if (hasDefinitiveFailure) return "failed";
    if (feeQuery.isError) return "failed";
    if (pollTimedOut) return "failed";
    return "confirming";
  }, [feeQuery.isError, hasDefinitiveFailure, hasDefinitiveSuccess, isStartingEkyc, pollTimedOut]);

  const failureReason = React.useMemo(() => {
    if (hasDefinitiveFailure) return "failed" as const;
    if (feeQuery.isError) return "error" as const;
    if (pollTimedOut) return "timeout" as const;
    return "failed" as const;
  }, [feeQuery.isError, hasDefinitiveFailure, pollTimedOut]);

  const resolvePendingOnboarding = React.useCallback((): IssuerPendingOnboarding | null => {
    const stored = readIssuerPendingOnboarding();
    if (stored) return stored;

    const orgId = fee?.issuerOrganizationId;
    if (!orgId) return null;

    const org = organizations.find((entry) => entry.id === orgId);
    const companyName = org?.name?.trim();
    if (!companyName) return null;

    return { orgId, companyName };
  }, [fee?.issuerOrganizationId, organizations]);

  React.useEffect(() => {
    if (!open) {
      orgsRefreshAttemptedRef.current = false;
    }
  }, [open]);

  React.useEffect(() => {
    if (!fee || fee.status !== "COMPLETED" || ekycStartedRef.current || isStartingEkyc) return;

    const stored = readIssuerPendingOnboarding();
    if (!stored && fee.issuerOrganizationId) {
      const org = organizations.find((entry) => entry.id === fee.issuerOrganizationId);
      if (!org?.name?.trim()) {
        if (!orgsRefreshAttemptedRef.current) {
          orgsRefreshAttemptedRef.current = true;
          void refreshOrganizations();
        }
        return;
      }
    }

    const pending = resolvePendingOnboarding();
    if (!pending) {
      toast.error("Could not continue onboarding. Please try again from the onboarding page.");
      handleTryAgain();
      return;
    }

    storeIssuerPendingOnboarding(pending);

    ekycStartedRef.current = true;
    setIsStartingEkyc(true);

    void (async () => {
      try {
        await refreshOrganizations();
        const { verifyLink } = await startCorporateOnboarding(pending.orgId, pending.companyName);
        switchOrganization(pending.orgId);
        clearIssuerPendingOnboarding();
        window.open(verifyLink, "_blank");
        onOpenChange(false);
        router.push("/");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to start eKYB";
        if (message.includes("ONBOARDING_FEE_REQUIRED")) {
          toast.error("Onboarding fee is still pending. Please complete payment first.");
          handleTryAgain();
        } else {
          toast.error(message);
        }
        ekycStartedRef.current = false;
      } finally {
        setIsStartingEkyc(false);
      }
    })();
  }, [
    fee,
    handleTryAgain,
    isStartingEkyc,
    onOpenChange,
    organizations,
    refreshOrganizations,
    resolvePendingOnboarding,
    router,
    startCorporateOnboarding,
    switchOrganization,
  ]);

  const dialogTitle =
    phase === "confirming"
      ? "Confirming your payment"
      : phase === "starting-ekyc"
        ? "Starting verification"
        : phase === "success"
          ? "Payment successful"
          : "Payment not completed";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md border-0 bg-transparent p-0 shadow-none"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">{dialogTitle}</DialogTitle>
        {phase === "confirming" ? (
          <OnboardingFeeConfirmingView onCancel={handleTryAgain} />
        ) : null}
        {phase === "starting-ekyc" ? <OnboardingFeeStartingEkycView /> : null}
        {phase === "success" && fee ? <OnboardingFeeSuccessView amount={fee.amount} /> : null}
        {phase === "failed" ? (
          <OnboardingFeeFailureView
            reason={failureReason}
            status={fee?.status}
            amount={fee?.amount}
            onTryAgain={handleTryAgain}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
