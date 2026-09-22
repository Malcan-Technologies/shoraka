"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken, useOrganization } from "@cashsouk/config";
import { IdentityVerifyStep, OnboardingLayout } from "@cashsouk/ui";
import { IssuerCompanySealCard } from "@/components/issuer-company-seal-card";
import { FeeReceiptActions } from "@/components/fee-receipt-actions";
import { useIssuerOnboardingFeeStatusQuery } from "@/hooks/use-issuer-onboarding-fee";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function OnboardingVerifyPage() {
  const router = useRouter();
  const { getAccessToken } = useAuthToken();
  const { activeOrganization, startCorporateOnboarding, refreshOrganizations } = useOrganization();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const sealQuery = useQuery({
    queryKey: ["issuer-company-seal", activeOrganization?.id],
    enabled: Boolean(activeOrganization?.id),
    queryFn: async () => {
      const res = await apiClient.getIssuerCompanySeal(activeOrganization!.id);
      if (!res.success) throw new Error(res.error.message);
      return res.data.seal;
    },
  });

  const feeStatusQuery = useIssuerOnboardingFeeStatusQuery(activeOrganization?.id);

  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const result = await apiClient.get<{
        userId: string;
        user: {
          first_name: string | null;
          last_name: string | null;
        };
      }>("/v1/auth/me");
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    staleTime: 1000 * 60 * 5,
    enabled: Boolean(activeOrganization),
  });

  const canEditCompanySeal = Boolean(
    activeOrganization?.isOwner ||
      activeOrganization?.members?.find((m) => m.id === currentUser?.userId)
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!activeOrganization) {
    return null;
  }
  const isExpiredCompany =
    String(activeOrganization.regtankOnboardingStatus ?? "").toUpperCase() === "EXPIRED";

  const handleContinue = async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (sealQuery.isLoading) {
        setIsLoading(false);
        setError("Loading company seal…");
        return;
      }
      if (!sealQuery.data) {
        setIsLoading(false);
        setError("Please upload a company seal in Issuer Profile before continuing onboarding.");
        return;
      }

      const org = activeOrganization;
      const companyName = org.name?.trim() ?? "";
      const { verifyLink } = await startCorporateOnboarding(org.id, companyName);
      await refreshOrganizations();
      window.location.assign(verifyLink);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to start identity verification";
      if (message.includes("ONBOARDING_FEE_REQUIRED")) {
        router.replace("/onboarding/fee");
        return;
      }
      if (message.includes("TNC_REQUIRED")) {
        router.replace("/onboarding/terms");
        return;
      }
      setError(message);
      setIsLoading(false);
    }
  };

  return (
    <OnboardingLayout
      organization={activeOrganization}
      portalType="issuer"
      currentRouteStep="verify"
      variant="step-centered"
      title="Onboarding"
      description="Complete company verification (eKYB) with our verification partner."
    >
      <IssuerCompanySealCard
        organizationId={activeOrganization.id}
        canEdit={canEditCompanySeal}
      />

      {feeStatusQuery.data?.latestPayment?.status === "COMPLETED" &&
      feeStatusQuery.data?.latestPayment?.id ? (
        <div className="mt-6">
          <p className="text-sm font-semibold">Onboarding Fee Receipt</p>
          <p className="mt-1 text-xs text-muted-foreground">
            View or download your receipt for this payment.
          </p>
          <FeeReceiptActions
            endpoint={`/v1/issuer/onboarding-fee/${feeStatusQuery.data.latestPayment.id}/receipt/pdf`}
            receiptActionLabel="onboarding fee receipt"
          />
        </div>
      ) : null}

      <IdentityVerifyStep
        onContinue={handleContinue}
        isLoading={isLoading}
        error={error}
        title={isExpiredCompany ? "Company onboarding expired" : "Company verification (eKYB)"}
        description={
          isExpiredCompany
            ? "Your previous company onboarding session expired. Start again to create a fresh verification session."
            : "You will be redirected to our verification partner to complete company checks (eKYB)."
        }
        continueLabel={isExpiredCompany ? "Restart onboarding" : undefined}
      />
    </OnboardingLayout>
  );
}
