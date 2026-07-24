"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useOrganization } from "@cashsouk/config";
import { IdentityVerifyStep, OnboardingLayout } from "@cashsouk/ui";

export default function OnboardingVerifyPage() {
  const router = useRouter();
  const { activeOrganization, startCorporateOnboarding, refreshOrganizations } = useOrganization();
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
