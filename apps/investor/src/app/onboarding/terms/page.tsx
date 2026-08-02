"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useOrganization } from "@cashsouk/config";
import {
  OnboardingLayout,
  TermsAcceptanceCard,
  LegalDocumentsReview,
  resolveLegalDocumentsReviewMode,
  useHeader,
} from "@cashsouk/ui";
import { TERMS_AND_CONDITIONS } from "@/content/terms-and-conditions";
import { TNC_LAST_UPDATED } from "@/content/tnc-metadata";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function OnboardingTermsPage() {
  const router = useRouter();
  const { setTitle } = useHeader();
  const { activeOrganization } = useOrganization();

  const handleEmptyReacceptance = useCallback(() => {
    router.replace("/");
  }, [router]);

  const mode = resolveLegalDocumentsReviewMode(activeOrganization?.onboardingStatus);

  useEffect(() => {
    if (mode === "reacceptance") {
      setTitle("Review legal documents");
    }
  }, [mode, setTitle]);

  if (!activeOrganization) {
    return null;
  }

  if (mode === "reacceptance") {
    return (
      <div className="flex min-h-0 flex-1 flex-col p-4 md:p-6">
        <LegalDocumentsReview
          organizationId={activeOrganization.id}
          portalType="investor"
          apiUrl={API_URL}
          mode="reacceptance"
          onComplete={() => router.push("/")}
          onEmptyReacceptance={handleEmptyReacceptance}
        />
      </div>
    );
  }

  return (
    <OnboardingLayout
      organization={activeOrganization}
      portalType="investor"
      currentRouteStep="terms"
    >
      <LegalDocumentsReview
        organizationId={activeOrganization.id}
        portalType="investor"
        apiUrl={API_URL}
        mode="onboarding"
        onComplete={() => router.push("/onboarding/verify")}
        fallback={
          <TermsAcceptanceCard
            organizationId={activeOrganization.id}
            termsMarkdown={TERMS_AND_CONDITIONS}
            lastUpdated={TNC_LAST_UPDATED}
            onAccepted={() => router.push("/onboarding/verify")}
          />
        }
      />
    </OnboardingLayout>
  );
}
