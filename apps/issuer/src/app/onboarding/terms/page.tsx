"use client";

import { useRouter } from "next/navigation";
import { getOnboardingRouteForOrg, useOrganization } from "@cashsouk/config";
import { OnboardingLayout, LegalDocumentsReview } from "@cashsouk/ui";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function OnboardingTermsPage() {
  const router = useRouter();
  const { activeOrganization } = useOrganization();

  if (!activeOrganization) {
    return null;
  }

  return (
    <OnboardingLayout
      organization={activeOrganization}
      portalType="issuer"
      currentRouteStep="terms"
    >
      <LegalDocumentsReview
        organizationId={activeOrganization.id}
        portalType="issuer"
        apiUrl={API_URL}
        mode="onboarding"
        onComplete={() =>
          router.push(getOnboardingRouteForOrg(activeOrganization, "issuer"))
        }
      />
    </OnboardingLayout>
  );
}
