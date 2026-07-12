"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  buildIssuerOnboardingFeeCallbackUrl,
  createApiClient,
  getOnboardingStepperSteps,
  openCurlecFpxCheckout,
  useAuthToken,
  useOrganization,
} from "@cashsouk/config";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Logo,
  OnboardingStepper,
  Skeleton,
  useHeader,
} from "@cashsouk/ui";
import { ExclamationCircleIcon } from "@heroicons/react/24/solid";
import { isAwaitingCompanyTnc } from "@/lib/issuer-onboarding-flow";
import { ISSUER_ONBOARDING_FEE_RETURN_TO } from "@/lib/issuer-onboarding-fee-routes";
import {
  storeIssuerPendingOnboarding,
  useCreateIssuerOnboardingFeeMutation,
  useIssuerOnboardingFeeStatusQuery,
} from "@/hooks/use-issuer-onboarding-fee";
import type { IssuerOnboardingFeeResponse } from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const CHECKOUT_OPEN_TIMEOUT_MS = 20_000;

function resolveCheckoutContact(
  activeOrganization: ReturnType<typeof useOrganization>["activeOrganization"]
) {
  if (!activeOrganization) {
    return { email: "", contact: "", name: undefined as string | undefined };
  }

  const member =
    activeOrganization.members.find((entry) => entry.role === "ORGANIZATION_ADMIN") ??
    activeOrganization.members[0];

  const name =
    activeOrganization.firstName && activeOrganization.lastName
      ? `${activeOrganization.firstName} ${activeOrganization.lastName}`
      : (activeOrganization.name ?? undefined);

  return {
    email: member?.email ?? "",
    contact: activeOrganization.phoneNumber?.trim() || "+60000000000",
    name,
  };
}

export default function OnboardingFeePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const suppressBootstrap = Boolean(searchParams.get("onboardingFeeReturn"));
  const { setTitle } = useHeader();
  const { getAccessToken } = useAuthToken();
  const { activeOrganization, isLoading: orgLoading } = useOrganization();
  const createFee = useCreateIssuerOnboardingFeeMutation();
  const [confirmedFee, setConfirmedFee] = useState<IssuerOnboardingFeeResponse | null>(null);
  const [isOpeningCheckout, setIsOpeningCheckout] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const checkoutOpenInFlightRef = useRef(false);

  const statusQuery = useIssuerOnboardingFeeStatusQuery(activeOrganization?.id);
  const resolvedFee = confirmedFee ?? createFee.data ?? statusQuery.data?.latestPayment ?? null;
  const feeAmount = resolvedFee?.amount ?? statusQuery.data?.amount ?? null;
  const steps = activeOrganization
    ? getOnboardingStepperSteps(activeOrganization, "issuer", "fee")
    : [];

  useEffect(() => {
    setTitle("Onboarding");
  }, [setTitle]);

  useEffect(() => {
    if (orgLoading) return;
    if (!activeOrganization) return;
    if (isAwaitingCompanyTnc(activeOrganization)) {
      setIsBootstrapping(false);
      router.replace("/onboarding/terms");
      return;
    }
    if (suppressBootstrap) {
      setIsBootstrapping(false);
      return;
    }

    if (statusQuery.isLoading) return;
    if (statusQuery.isError) {
      setError(statusQuery.error instanceof Error ? statusQuery.error.message : "Could not load fee");
    }

    if (statusQuery.data?.latestPayment?.status === "COMPLETED" || statusQuery.data?.isPaid) {
      router.replace("/onboarding/verify");
      return;
    }

    setIsBootstrapping(false);
  }, [activeOrganization, orgLoading, router, statusQuery, suppressBootstrap]);

  if (orgLoading || isBootstrapping) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {steps.length > 0 ? (
          <div className="w-full min-w-0 px-6 pt-6 sm:px-8 sm:pt-8 lg:px-10">
            <OnboardingStepper steps={steps} />
          </div>
        ) : null}
        <div className="flex flex-1 flex-col items-center justify-center bg-muted/30 p-4">
          <div className="w-full max-w-md space-y-8">
            <Skeleton className="mx-auto h-8 w-32" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!activeOrganization) {
    return null;
  }

  const companyName = activeOrganization.name?.trim() ?? "";

  function resetPayFlowState() {
    checkoutOpenInFlightRef.current = false;
    setIsOpeningCheckout(false);
  }

  async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string) {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
        }),
      ]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  const handlePayFee = async () => {
    if (checkoutOpenInFlightRef.current) {
      return;
    }

    if (!companyName) {
      toast.error("Missing company name");
      return;
    }

    checkoutOpenInFlightRef.current = true;
    setIsOpeningCheckout(true);

    let checkoutContact = resolveCheckoutContact(activeOrganization);
    try {
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
                companyName),
          };
        }
      }

      if (!checkoutContact.email) {
        toast.error("We could not find an email address for this account");
        return;
      }

      setError(null);

      // Always re-request before opening checkout so EXPIRED/FAILED never reuses stale local order.
      const fee = await withTimeout(
        createFee.mutateAsync({ issuerOrganizationId: activeOrganization.id }),
        CHECKOUT_OPEN_TIMEOUT_MS,
        "Payment request timed out. Please try again."
      );

      setConfirmedFee(fee);

      if (fee.status === "COMPLETED") {
        router.replace("/onboarding/verify");
        return;
      }

      storeIssuerPendingOnboarding({ orgId: activeOrganization.id, companyName });

      const callbackUrl = buildIssuerOnboardingFeeCallbackUrl(
        fee.id,
        ISSUER_ONBOARDING_FEE_RETURN_TO
      );

      if (!fee.curlecKeyId || !fee.curlecOrderId) {
        throw new Error("Payment order is incomplete. Please try again.");
      }

      await withTimeout(
        openCurlecFpxCheckout({
          keyId: fee.curlecKeyId,
          orderId: fee.curlecOrderId,
          amountMyr: fee.amount,
          callbackUrl,
          description: "Issuer onboarding fee",
          prefillName: checkoutContact.name,
          prefillEmail: checkoutContact.email,
          prefillContact: checkoutContact.contact,
          onDismiss: resetPayFlowState,
        }),
        CHECKOUT_OPEN_TIMEOUT_MS,
        "Checkout is taking too long to open. Please try again."
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not start payment";
      if (message.includes("TNC_REQUIRED")) {
        setError("Please accept the Terms and Conditions before paying.");
        router.replace("/onboarding/terms");
      } else {
        setError(message);
      }
    } finally {
      resetPayFlowState();
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {steps.length > 0 ? (
        <div className="w-full min-w-0 px-6 pt-6 sm:px-8 sm:pt-8 lg:px-10">
          <OnboardingStepper steps={steps} />
        </div>
      ) : null}

      <div className="flex flex-1 flex-col items-center justify-center bg-muted/30 p-4 pb-10 sm:pb-12">
        <div className="flex w-full max-w-md flex-col items-center space-y-8">
          <Logo />

          <div className="w-full space-y-6">
            <div className="space-y-2 text-center">
              <h2 className="text-xl font-semibold">Pay onboarding fee</h2>
              <p className="text-[15px] text-muted-foreground">
                A one-time fee is required after accepting the user agreement to start company
                verification (eKYB).
              </p>
            </div>

            {error ? (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                <div className="flex items-start gap-3">
                  <ExclamationCircleIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              </div>
            ) : null}

            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Issuer onboarding fee</CardTitle>
                <CardDescription>
                  {companyName ? `For ${companyName}` : "Company account setup"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl bg-muted/50 px-4 py-3 text-center">
                  <p className="text-sm text-muted-foreground">Amount due</p>
                  <p className="text-2xl font-semibold tabular-nums">
                    RM {feeAmount != null ? feeAmount.toFixed(2) : "—"}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="action"
                  className="h-11 w-full rounded-xl"
                  disabled={isOpeningCheckout}
                  onClick={() => void handlePayFee()}
                >
                  {isOpeningCheckout
                    ? "Opening checkout..."
                    : "Pay with FPX"}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  This fee is non-refundable and unlocks eKYB verification for your company account.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
