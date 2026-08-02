"use client";

import { useRouter } from "next/navigation";
import { useOrganization } from "@cashsouk/config";
import {
  OnboardingLayout,
  TermsAcceptanceCard,
  LegalDocumentsAcceptance,
} from "@cashsouk/ui";
import { TERMS_AND_CONDITIONS } from "@/content/terms-and-conditions";
import { TNC_LAST_UPDATED } from "@/content/tnc-metadata";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function OnboardingTermsPage() {
  const router = useRouter();
  const { activeOrganization } = useOrganization();

  if (!activeOrganization) {
    return null;
  }

  const handleAccepted = () => {
    router.push("/onboarding/verify");
  };

  return (
    <OnboardingLayout
      organization={activeOrganization}
      portalType="investor"
      currentRouteStep="terms"
    >
      <LegalDocumentsAcceptance
        organizationId={activeOrganization.id}
        portalType="investor"
        apiUrl={API_URL}
        onAccepted={handleAccepted}
        fallback={
          <TermsAcceptanceCard
            organizationId={activeOrganization.id}
            termsMarkdown={TERMS_AND_CONDITIONS}
            lastUpdated={TNC_LAST_UPDATED}
            onAccepted={handleAccepted}
          />
        }
      />
    </OnboardingLayout>
  );
}
