"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useOrganization } from "@cashsouk/config";
import { IdentityVerifyStep, OnboardingLayout } from "@cashsouk/ui";

export default function OnboardingVerifyPage() {
  const router = useRouter();
  const {
    activeOrganization,
    startIndividualOnboarding,
    startCorporateOnboarding,
    refreshOrganizations,
  } = useOrganization();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!activeOrganization) {
    return null;
  }

  const isCompany = activeOrganization.type === "COMPANY";
  const isExpiredPersonal =
    !isCompany && String(activeOrganization.regtankOnboardingStatus ?? "").toUpperCase() === "EXPIRED";
  const isExpiredCompany =
    isCompany && String(activeOrganization.regtankOnboardingStatus ?? "").toUpperCase() === "EXPIRED";

  const handleContinue = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const org = activeOrganization;
      const { verifyLink } = isCompany
        ? await startCorporateOnboarding(org.id, org.name ?? "")
        : await startIndividualOnboarding(org.id);

      await refreshOrganizations();
      window.location.assign(verifyLink);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to start identity verification";
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
      portalType="investor"
      currentRouteStep="verify"
      variant="step-centered"
      title="Onboarding"
      description={
        isCompany
          ? "Complete company verification (eKYB) with our verification partner."
          : "Complete personal verification (eKYC) with our verification partner."
      }
    >
      <IdentityVerifyStep
        onContinue={handleContinue}
        isLoading={isLoading}
        error={error}
        title={
          isExpiredCompany
            ? "Company onboarding expired"
            : isExpiredPersonal
              ? "Personal onboarding expired"
            : isCompany
              ? "Company verification (eKYB)"
              : "Personal verification (eKYC)"
        }
        description={
          isExpiredCompany
            ? "Your previous company onboarding session expired. Start again to create a fresh verification session."
            : isExpiredPersonal
              ? "Your previous verification link has expired. Restart onboarding to generate a new verification link and continue."
            : isCompany
              ? "You will be redirected to our verification partner to complete company checks (eKYB)."
              : "You will be redirected to our verification partner to complete personal checks (eKYC)."
        }
        continueLabel={isExpiredCompany || isExpiredPersonal ? "Restart onboarding" : undefined}
      />
    </OnboardingLayout>
  );
}
