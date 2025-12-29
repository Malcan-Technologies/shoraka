"use client";

import { Suspense } from "react";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../lib/auth";
import { useOrganization } from "@cashsouk/config";
import { SidebarTrigger } from "../components/ui/sidebar";
import { Separator } from "../components/ui/separator";
import { Button } from "../components/ui/button";
import { PlusIcon } from "@heroicons/react/24/outline";
import { OnboardingStatusCard, getOnboardingSteps } from "../components/onboarding-status-card";
import { TermsAcceptanceCard } from "../components/terms-acceptance-card";
import { DepositCard } from "../components/deposit-card";
import { AccountOverviewCard } from "../components/account-overview-card";

function InvestorDashboardContent() {
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

  // Check onboarding status after authentication is confirmed
  useEffect(() => {
    if (isAuthenticated && !isOrgLoading) {
      // If no organizations at all, redirect to onboarding
      if (organizations.length === 0) {
        if (!hasRedirected.current) {
          hasRedirected.current = true;
          router.push("/onboarding-start");
        }
        return;
      }

      // If active organization exists and is onboarded, show dashboard
      if (activeOrganization && isOnboarded) {
        setCheckingOnboarding(false);
        hasRedirected.current = false;
        return;
      }

      // If active organization is pending approval, show dashboard with limited access
      if (activeOrganization && isPendingApproval) {
        setCheckingOnboarding(false);
        hasRedirected.current = false;
        return;
      }

      // If active organization exists but not onboarded (and not pending approval), redirect to onboarding
      if (activeOrganization && !isOnboarded && !isPendingApproval) {
        if (!hasRedirected.current) {
          hasRedirected.current = true;
          router.push("/onboarding-start");
        }
        return;
      }

      // No active organization but has organizations
      // This can happen when state is still settling or there's a mismatch
      // Check if any organization is onboarded or pending approval and show dashboard if so
      if (!activeOrganization && organizations.length > 0) {
        const anyOnboarded = organizations.some((org) => org.onboardingStatus === "COMPLETED");
        const anyPendingApproval = organizations.some(
          (org) =>
            org.onboardingStatus === "PENDING_APPROVAL" || org.onboardingStatus === "PENDING_AML"
        );
        if (anyOnboarded || anyPendingApproval) {
          // There's an onboarded or pending approval org but no active one selected yet
          // The context should auto-select one, just wait a bit
          return;
        } else {
          // No onboarded or pending approval orgs, redirect to onboarding
          if (!hasRedirected.current) {
            hasRedirected.current = true;
            router.push("/onboarding-start");
          }
          return;
        }
      }
    } else if (isAuthenticated === false) {
      setCheckingOnboarding(false);
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
  const needsDeposit = currentStep?.id === "deposit";
  const isAwaitingApproval = currentStep?.id === "approval";

  // Account overview is enabled only when onboarding is complete
  const isAccountEnabled = activeOrganization?.onboardingStatus === "COMPLETED";

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-lg font-semibold">Dashboard</h1>
      </header>
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
                    Invest now
                  </Button>
                }
              />

              {/* Step-specific cards */}
              {needsTncAcceptance && <TermsAcceptanceCard organizationId={activeOrganization.id} />}

              {needsDeposit && <DepositCard organizationId={activeOrganization.id} />}

              {isAwaitingApproval && (
                <div className="rounded-xl border bg-card p-6">
                  <h3 className="text-lg font-semibold mb-2">Awaiting Approval</h3>
                  <p className="text-muted-foreground">
                    Your account is currently under review. You will be notified once the approval
                    process is complete.
                  </p>
                </div>
              )}
            </section>
          )}

          {/* Welcome Section - only shown when all steps are complete */}
          {allStepsComplete && (
            <section className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold mb-2">Welcome back, {displayName}!</h2>
                <p className="text-[17px] leading-7 text-muted-foreground">
                  Browse and invest in verified loan opportunities from your dashboard.
                </p>
              </div>
              <Button asChild className="gap-2">
                <Link href="/investments">
                  <PlusIcon className="h-4 w-4" />
                  Invest now
                </Link>
              </Button>
            </section>
          )}

          {/* Account Overview Card - always visible, disabled when onboarding incomplete */}
          <AccountOverviewCard isDisabled={!isAccountEnabled} />
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
