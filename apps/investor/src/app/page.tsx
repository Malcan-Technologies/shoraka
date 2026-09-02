"use client";

import { Suspense, startTransition, useMemo } from "react";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/auth";
import {
  useOrganization,
  getOnboardingStep,
  getOnboardingStepRoute,
} from "@cashsouk/config";
import { filterVisiblePeopleRows } from "@cashsouk/types";
import { checkAndRedirectForPendingInvitation } from "../lib/invitation-redirect";
import { Button } from "../components/ui/button";
import { PlusIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { OnboardingStatusCard, getOnboardingSteps } from "../components/onboarding-status-card";
import { DepositCard } from "../components/deposit-card";
import { InvestorProfileCompletenessBanner } from "../components/profile-completeness-banner";
import { AccountOverviewCard } from "../components/account-overview-card";
import { PortfolioOverviewCard } from "../components/portfolio-overview-card";
import { DashboardInvestmentsSection } from "../components/dashboard-investments-section";
import {
  DirectorShareholderAlertCard,
  INVESTOR_DIRECTOR_SHAREHOLDER_ALERT_COPY,
  PageShell,
  useHeader,
  welcomeBackTitle,
} from "@cashsouk/ui";
import { InvestNowButton } from "../components/invest-now-button";

function InvestorDashboardContent() {
  const { setTitle } = useHeader();

  useEffect(() => {
    // PageShell owns the title.
    setTitle("");
    return () => setTitle("");
  }, [setTitle]);

  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const {
    activeOrganization,
    isLoading: isOrgLoading,
    isOnboarded,
    isPendingApproval,
    organizations,
  } = useOrganization();
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (isAuthenticated && !isOrgLoading) {
      const hasPendingInvitation = checkAndRedirectForPendingInvitation();
      if (hasPendingInvitation) return;

      if (organizations.length === 0) {
        if (!hasRedirected.current) {
          hasRedirected.current = true;
          router.push("/onboarding/account");
        }
        return;
      }

      if (activeOrganization) {
        const flowStep = getOnboardingStep(activeOrganization, "investor");
        if (flowStep === "terms" || flowStep === "fee" || flowStep === "verify") {
          if (!hasRedirected.current) {
            hasRedirected.current = true;
            router.replace(getOnboardingStepRoute(flowStep));
          }
          return;
        }
      }

      if (activeOrganization && (isOnboarded || isPendingApproval || activeOrganization.onboardingStatus === "REJECTED")) {
        startTransition(() => setCheckingOnboarding(false));
        hasRedirected.current = false;
        return;
      }

      if (activeOrganization && !isOnboarded && !isPendingApproval) {
        const flowStep = getOnboardingStep(activeOrganization, "investor");
        if (flowStep === "approval" || flowStep === "deposit") {
          startTransition(() => setCheckingOnboarding(false));
          hasRedirected.current = false;
          return;
        }
      }

      if (!activeOrganization && organizations.length > 0) {
        const anyDashboardReady = organizations.some((org) => {
          const step = getOnboardingStep(org, "investor");
          return ["approval", "deposit", "completed", "rejected"].includes(step);
        });
        if (!anyDashboardReady && !hasRedirected.current) {
          hasRedirected.current = true;
          router.push("/onboarding/account");
        }
        return;
      }
    } else if (isAuthenticated === false) {
      startTransition(() => setCheckingOnboarding(false));
    }
  }, [
    isAuthenticated,
    isOrgLoading,
    activeOrganization,
    isOnboarded,
    isPendingApproval,
    organizations,
    router,
  ]);

  const visiblePeopleForDsAlert = useMemo(
    () => filterVisiblePeopleRows(activeOrganization?.people ?? []),
    [activeOrganization?.people]
  );

  if (isAuthenticated === null || checkingOnboarding || isOrgLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const getDisplayName = () => {
    if (!activeOrganization) return "";

    if (activeOrganization.firstName && activeOrganization.lastName) {
      return `${activeOrganization.firstName} ${activeOrganization.lastName}`;
    }

    if (activeOrganization.type === "COMPANY" && activeOrganization.name) {
      return activeOrganization.name;
    }

    return activeOrganization.type === "PERSONAL" ? "Personal Account" : "Company Account";
  };

  const displayName = getDisplayName();

  const steps = activeOrganization ? getOnboardingSteps(activeOrganization) : [];
  const allStepsComplete = activeOrganization ? steps.every((step) => step.isCompleted) : false;
  const currentStep = steps.find((step) => step.isCurrent);

  const needsDeposit = currentStep?.id === "deposit";
  const isAwaitingApproval = currentStep?.id === "approval";
  const isRejected = activeOrganization?.onboardingStatus === "REJECTED";
  const isAccountEnabled = activeOrganization?.onboardingStatus === "COMPLETED";

  return (
    <>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0 relative">
        {isRejected && (
          <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center rounded-lg">
            <div className="bg-card rounded-xl border border-destructive/50 p-8 max-w-md mx-4">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                    <ExclamationTriangleIcon className="h-5 w-5 text-destructive" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-destructive mb-2">
                    Account has been rejected
                  </h3>
                  <p className="text-muted-foreground">
                    Your onboarding application has been rejected. If you believe this was a mistake,
                    please contact our support team.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="p-2 md:p-4">
          <PageShell
            title={welcomeBackTitle(displayName)}
            description={
              allStepsComplete
                ? "Browse and invest in verified financing opportunities from your dashboard."
                : "Complete onboarding to start investing."
            }
            action={
              allStepsComplete ? (
                <InvestNowButton className="h-11 shrink-0 gap-2 rounded-xl font-semibold" />
              ) : (
                <Button disabled className="h-11 shrink-0 gap-2 rounded-xl font-semibold opacity-50">
                  <PlusIcon className="h-4 w-4" />
                  Invest now
                </Button>
              )
            }
          >
            <div className="space-y-8">
              {activeOrganization?.type === "COMPANY" ? (
                <DirectorShareholderAlertCard
                  visiblePeople={visiblePeopleForDsAlert}
                  enabled={activeOrganization.onboardingStatus === "COMPLETED"}
                  copy={INVESTOR_DIRECTOR_SHAREHOLDER_ALERT_COPY}
                />
              ) : null}

              <InvestorProfileCompletenessBanner
                organizationId={activeOrganization?.id}
                onboarded={isAccountEnabled}
              />

              {activeOrganization && !allStepsComplete ? (
                <section className="space-y-6">
                  <OnboardingStatusCard organization={activeOrganization} />

                  {needsDeposit && <DepositCard organizationId={activeOrganization.id} />}

                  {isAwaitingApproval && (
                    <div className="rounded-xl border bg-card p-6">
                      <h3 className="mb-2 text-lg font-semibold">Awaiting Approval</h3>
                      <p className="text-muted-foreground">
                        Your account is currently under review. You will be notified once the
                        approval process is complete.
                      </p>
                    </div>
                  )}
                </section>
              ) : null}

              <AccountOverviewCard isDisabled={!isAccountEnabled} />

              {isAccountEnabled ? (
                <>
                  <PortfolioOverviewCard />
                  <DashboardInvestmentsSection />
                </>
              ) : null}
            </div>
          </PageShell>
        </div>
      </div>
    </>
  );
}

export default function InvestorDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      }
    >
      <InvestorDashboardContent />
    </Suspense>
  );
}
