"use client";

import { Suspense } from "react";
import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../lib/auth";
import { useOrganization } from "@cashsouk/config";
import { checkAndRedirectForPendingInvitation } from "../lib/invitation-redirect";
import { Button } from "../components/ui/button";
import { PlusIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { OnboardingStatusCard, getOnboardingSteps } from "../components/onboarding-status-card";
import { TermsAcceptanceCard } from "../components/terms-acceptance-card";
import { AccountOverviewCard } from "../components/account-overview-card";
import { RepaymentPerformanceCard } from "../components/repayment-performance-card";
import { useHeader } from "@cashsouk/ui";

function IssuerDashboardContent() {
  const { setTitle } = useHeader();

  // Set header title
  useEffect(() => {
    setTitle("Dashboard");
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
  const hasRedirected = useRef(false);

  // Determine whether the dashboard can be shown (derived, no setState needed)
  const canShowDashboard = useMemo(() => {
    if (!isAuthenticated || isOrgLoading) return false;
    if (organizations.length === 0) return false;
    if (!activeOrganization) {
      // No active org selected yet — check if any org qualifies
      return organizations.some(
        (org) =>
          org.onboardingStatus === "COMPLETED" ||
          org.onboardingStatus === "PENDING_APPROVAL" ||
          org.onboardingStatus === "PENDING_AML" ||
          org.onboardingStatus === "REJECTED"
      );
    }
    return (
      isOnboarded ||
      isPendingApproval ||
      activeOrganization.onboardingStatus === "REJECTED"
    );
  }, [isAuthenticated, isOrgLoading, organizations, activeOrganization, isOnboarded, isPendingApproval]);

  // Side-effect only: redirects that need router.push
  useEffect(() => {
    if (!isAuthenticated || isOrgLoading) return;

    const hasPendingInvitation = checkAndRedirectForPendingInvitation();
    if (hasPendingInvitation) return;

    if (organizations.length === 0) {
      if (!hasRedirected.current) {
        hasRedirected.current = true;
        router.push("/onboarding-start");
      }
      return;
    }

    if (activeOrganization && isOnboarded) {
      hasRedirected.current = false;
      return;
    }

    if (activeOrganization && isPendingApproval) {
      hasRedirected.current = false;
      return;
    }

    if (activeOrganization && activeOrganization.onboardingStatus === "REJECTED") {
      hasRedirected.current = false;
      return;
    }

    if (activeOrganization && !isOnboarded && !isPendingApproval) {
      if (!hasRedirected.current) {
        hasRedirected.current = true;
        router.push("/onboarding-start");
      }
      return;
    }

    if (!activeOrganization && organizations.length > 0) {
      const anyQualified = organizations.some(
        (org) =>
          org.onboardingStatus === "COMPLETED" ||
          org.onboardingStatus === "PENDING_APPROVAL" ||
          org.onboardingStatus === "PENDING_AML" ||
          org.onboardingStatus === "REJECTED"
      );
      if (!anyQualified && !hasRedirected.current) {
        hasRedirected.current = true;
        router.push("/onboarding-start");
      }
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

  // Show loading while checking auth or onboarding
  if (isAuthenticated === null || isOrgLoading || !canShowDashboard) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, redirect will happen in useAuth hook
  if (!isAuthenticated) {
    return null;
  }

  // Get display name from organization - use firstName + lastName from RegTank data
  const getDisplayName = () => {
    if (!activeOrganization) return "";

    // Use firstName + lastName if available (from RegTank onboarding)
    if (activeOrganization.firstName && activeOrganization.lastName) {
      return `${activeOrganization.firstName} ${activeOrganization.lastName}`;
    }

    // Fallback to organization name for company accounts
    if (activeOrganization.type === "COMPANY" && activeOrganization.name) {
      return activeOrganization.name;
    }

    // Default fallback
    return activeOrganization.type === "PERSONAL" ? "Personal Account" : "Company Account";
  };

  const displayName = getDisplayName();

  // Determine current onboarding step
  const steps = activeOrganization ? getOnboardingSteps(activeOrganization) : [];
  const allStepsComplete = activeOrganization ? steps.every((step) => step.isCompleted) : false;
  const currentStep = steps.find((step) => step.isCurrent);

  // Check if user needs to complete specific steps
  const needsTncAcceptance = currentStep?.id === "tnc";
  const isAwaitingApproval = currentStep?.id === "approval";
  const isRejected = activeOrganization?.onboardingStatus === "REJECTED";
  const isAccountEnabled = activeOrganization?.onboardingStatus === "COMPLETED";

  return (
    <>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="space-y-8 p-2 md:p-4">
          {/* Onboarding Status Section - shown when not all steps are complete */}
          {activeOrganization && !allStepsComplete && (
            <section className="space-y-6">
              <OnboardingStatusCard
                organization={activeOrganization}
                userName={displayName}
                actionButton={
                  <Button disabled className="gap-2 opacity-50 cursor-not-allowed">
                    <PlusIcon className="h-4 w-4" />
                    Get Financed
                  </Button>
                }
              />

              {/* Step-specific cards */}
              {needsTncAcceptance && <TermsAcceptanceCard organizationId={activeOrganization.id} />}

              {isAwaitingApproval && (
                <div className="rounded-xl border bg-card p-6">
                  <h3 className="text-lg font-semibold mb-2">Awaiting Approval</h3>
                  <p className="text-muted-foreground">
                    Your account is currently under review. You will be notified once the approval
                    process is complete.
                  </p>
                </div>
              )}

              {isRejected && (
                <div className="rounded-xl border border-destructive/50 bg-destructive/5 p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                        <ExclamationTriangleIcon className="h-5 w-5 text-destructive" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-destructive mb-2">
                        Onboarding Rejected
                      </h3>
                      <p className="text-muted-foreground">
                        Your onboarding application has been rejected. If you believe this was a
                        mistake, please contact our support team to request a review of your
                        application.
                      </p>
                      <p className="text-sm text-muted-foreground mt-3">
                        Email:{" "}
                        <a
                          href="mailto:support@cashsouk.my"
                          className="text-primary hover:underline"
                        >
                          support@cashsouk.my
                        </a>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Welcome Section - only shown when all steps are complete */}
          {allStepsComplete && (
            <>
              <section className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Welcome back, {displayName}!</h2>
                  <p className="text-[17px] leading-7 text-muted-foreground">
                    Manage your financing requests and track your applications from your dashboard.
                  </p>
                </div>
                <Button asChild className="gap-2">
                  <Link href="/applications/new">
                    <PlusIcon className="h-4 w-4" />
                    Get Financed
                  </Link>
                </Button>
              </section>

              <AccountOverviewCard isDisabled={!isAccountEnabled} />
              <RepaymentPerformanceCard isDisabled={!isAccountEnabled} />
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default function IssuerDashboardPage() {
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
      <IssuerDashboardContent />
    </Suspense>
  );
}
