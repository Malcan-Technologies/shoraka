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
  useIssuerOnboardingFeeQuery,
} from "@/hooks/use-issuer-onboarding-fee";

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
  const { startCorporateOnboarding, switchOrganization, refreshOrganizations } = useOrganization();
  const feeQuery = useIssuerOnboardingFeeQuery(feeId, { pollUntilTerminal: true });
  const [isStartingEkyc, setIsStartingEkyc] = React.useState(false);
  const ekycStartedRef = React.useRef(false);

  const fee = feeQuery.data;
  const isConfirming =
    feeQuery.isLoading || feeQuery.isError || !fee || !isTerminalOnboardingFeeStatus(fee.status);

  React.useEffect(() => {
    if (!fee || fee.status !== "COMPLETED" || ekycStartedRef.current) return;

    const pending = readIssuerPendingOnboarding();
    if (!pending) {
      toast.error("Could not resume onboarding. Please try again from the onboarding page.");
      return;
    }

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
    onOpenChange,
    refreshOrganizations,
    router,
    startCorporateOnboarding,
    switchOrganization,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md rounded-2xl border-0 p-0 shadow-lg"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">
          {isConfirming || isStartingEkyc ? "Confirming your payment" : "Onboarding fee status"}
        </DialogTitle>
        <div className="space-y-4 p-8 text-center">
          {isConfirming || isStartingEkyc ? (
            <>
              <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <h2 className="text-lg font-semibold">
                {isStartingEkyc ? "Starting identity verification..." : "Confirming your payment"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isStartingEkyc
                  ? "Please wait while we prepare your eKYB session."
                  : "This usually takes a few seconds after FPX completes."}
              </p>
            </>
          ) : fee?.status === "COMPLETED" ? (
            <>
              <h2 className="text-lg font-semibold">Payment received</h2>
              <p className="text-sm text-muted-foreground">
                Your onboarding fee of RM {fee.amount.toFixed(2)} was successful.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold">Payment not completed</h2>
              <p className="text-sm text-muted-foreground">
                Status: {fee?.status ?? "unknown"}. Please try again from the onboarding page.
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
