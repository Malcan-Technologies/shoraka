"use client";

import { Suspense, startTransition, useMemo } from "react";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/auth";
import {
  formatCurrency,
  useOrganization,
  getOnboardingStep,
  getOnboardingStepRoute,
} from "@cashsouk/config";
import {
  filterVisiblePeopleRows,
  FINANCING_TENURE_MAX_DAYS,
  FINANCING_TENURE_MIN_DAYS,
  MARKETPLACE_MIN_COMMIT_MYR,
} from "@cashsouk/types";
import { checkAndRedirectForPendingInvitation } from "../lib/invitation-redirect";
import { ExclamationTriangleIcon, PlusIcon } from "@heroicons/react/24/outline";
import { getOnboardingSteps } from "../components/onboarding-status-card";
import { InvestorProfileCompletenessBanner } from "../components/profile-completeness-banner";
import { DepositDialog } from "@/app/transactions/components/deposit-dialog";
import {
  DirectorShareholderAlertCard,
  INVESTOR_DIRECTOR_SHAREHOLDER_ALERT_COPY,
  PageShell,
  useHeader,
  welcomeBackTitle,
} from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { InvestNowButton } from "../components/invest-now-button";
import {
  useInvestorInvestments,
  useInvestorPortfolio,
  useInvestorPortfolioHistory,
  useMarketplaceNotes,
} from "../investments/hooks/use-marketplace-notes";
import {
  investorDashboardWelcomeSubhead,
  resolveInvestorDashboardState,
} from "../investments/dashboard-state";
import { marketplaceOpenTotals } from "../investments/dashboard-presentation";
import { toMarketplaceNote } from "../marketplace/marketplace-note-model";
import { InvestorDashboardOnboarding } from "../components/dashboard/investor-dashboard-onboarding";
import { InvestorDashboardApproval } from "../components/dashboard/investor-dashboard-approval";
import { InvestorDashboardNew } from "../components/dashboard/investor-dashboard-new";
import { InvestorDashboardActive } from "../components/dashboard/investor-dashboard-active";

const TENOR_RANGE_LABEL = `${FINANCING_TENURE_MIN_DAYS}–${FINANCING_TENURE_MAX_DAYS}`;

function InvestorDashboardContent() {
  const { setTitle } = useHeader();

  useEffect(() => {
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
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositError, setDepositError] = useState<string | null>(null);

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

  const orgId = activeOrganization?.id;
  const flowStep = activeOrganization
    ? getOnboardingStep(activeOrganization, "investor")
    : null;
  const completedOrgId = flowStep === "completed" ? orgId : undefined;
  const portfolioQuery = useInvestorPortfolio(orgId);
  const historyQuery = useInvestorPortfolioHistory("ALL", completedOrgId);
  const marketplaceQuery = useMarketplaceNotes({ pageSize: 50 });
  const holdingsQuery = useInvestorInvestments(completedOrgId);

  const visiblePeopleForDsAlert = useMemo(
    () => filterVisiblePeopleRows(activeOrganization?.people ?? []),
    [activeOrganization?.people]
  );

  const steps = activeOrganization ? getOnboardingSteps(activeOrganization) : [];
  const remainingStepCount = steps.filter((step) => !step.isCompleted).length;
  const bookReady = flowStep !== "completed" || portfolioQuery.isFetched;
  const dashboardState =
    flowStep && bookReady
      ? resolveInvestorDashboardState({
          step: flowStep,
          investmentCount: portfolioQuery.data?.investmentCount ?? 0,
        })
      : null;

  const marketplaceNotes = marketplaceQuery.data?.notes ?? [];
  const openTotals = marketplaceOpenTotals(
    marketplaceNotes.map(toMarketplaceNote),
    marketplaceQuery.data?.pagination.totalCount ?? marketplaceNotes.length
  );

  const cashflowTotal = portfolioQuery.data?.cashflowNext90Days?.totalAmount ?? 0;
  const subhead = dashboardState
    ? investorDashboardWelcomeSubhead({
        state: dashboardState,
        remainingStepCount,
        next90DayCashflowLabel:
          dashboardState === "active" && cashflowTotal > 0 ? formatCurrency(cashflowTotal) : null,
      })
    : "Loading your portfolio.";

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

  const getGreetingName = () => {
    if (!activeOrganization) return "";
    if (activeOrganization.firstName?.trim()) return activeOrganization.firstName.trim();
    if (activeOrganization.firstName && activeOrganization.lastName) {
      return `${activeOrganization.firstName} ${activeOrganization.lastName}`;
    }
    if (activeOrganization.type === "COMPANY" && activeOrganization.name) {
      return activeOrganization.name;
    }
    return activeOrganization.type === "PERSONAL" ? "Personal Account" : "Company Account";
  };

  const displayName = getGreetingName();
  const isRejected = dashboardState === "rejected";
  const showCompleteness = dashboardState === "new" || dashboardState === "active";

  return (
    <>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0 relative">
        {isRejected && (
          <div className="absolute inset-0 z-50 flex items-center justify-center rounded-lg bg-foreground/50">
            <div className="mx-4 max-w-md rounded-xl border border-status-rejected-text/40 bg-card p-8">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-status-rejected-bg">
                  <ExclamationTriangleIcon className="h-5 w-5 text-status-rejected-text" />
                </div>
                <div>
                  <h3 className="mb-2 text-section-title text-status-rejected-text">
                    Account has been rejected
                  </h3>
                  <p className="text-body text-muted-foreground">
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
            className="[&_h1]:text-primary"
            title={welcomeBackTitle(displayName)}
            description={subhead}
            action={
              dashboardState === "active" ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 shrink-0 gap-2 rounded-xl border-primary text-primary hover:bg-primary/5"
                    onClick={() => setDepositOpen(true)}
                  >
                    <PlusIcon className="h-4 w-4" />
                    Deposit
                  </Button>
                  <InvestNowButton className="h-11 shrink-0 gap-2 rounded-xl font-semibold" />
                </>
              ) : undefined
            }
          >
            <div className="flex flex-col gap-6">
              {flowStep === "completed" && !bookReady ? (
                <p className="text-ui text-muted-foreground">Loading your portfolio.</p>
              ) : null}

              {activeOrganization?.type === "COMPANY" ? (
                <DirectorShareholderAlertCard
                  visiblePeople={visiblePeopleForDsAlert}
                  enabled={dashboardState === "active"}
                  copy={INVESTOR_DIRECTOR_SHAREHOLDER_ALERT_COPY}
                />
              ) : null}

              {dashboardState === "onboarding" && activeOrganization ? (
                <InvestorDashboardOnboarding
                  steps={steps}
                  organizationId={activeOrganization.id}
                  tenorLabel={`${TENOR_RANGE_LABEL} day`}
                />
              ) : null}

              {dashboardState === "approval" && activeOrganization ? (
                <InvestorDashboardApproval
                  onboardingStatus={activeOrganization.onboardingStatus}
                  amlApproved={activeOrganization.amlApproved}
                  submittedAt={activeOrganization.submittedAt}
                />
              ) : null}

              {dashboardState === "new" ? (
                <InvestorDashboardNew
                  availableBalance={
                    portfolioQuery.isFetched ? Number(portfolioQuery.data?.availableBalance ?? 0) : null
                  }
                  openNoteCount={
                    marketplaceQuery.isFetched ? openTotals.count : null
                  }
                  seekingFunding={openTotals.seekingFunding}
                  tenorLabel={TENOR_RANGE_LABEL}
                  minCommitMyr={MARKETPLACE_MIN_COMMIT_MYR}
                  onDeposit={() => setDepositOpen(true)}
                />
              ) : null}

              {dashboardState === "active" && portfolioQuery.data ? (
                <InvestorDashboardActive
                  portfolio={portfolioQuery.data}
                  historyPoints={historyQuery.data?.points ?? []}
                  marketplaceNotes={marketplaceNotes}
                  marketplaceTotalCount={openTotals.count}
                  seekingFunding={openTotals.seekingFunding}
                  holdings={holdingsQuery.data?.notes ?? []}
                  onDeposit={() => setDepositOpen(true)}
                />
              ) : null}

              {showCompleteness ? (
                <InvestorProfileCompletenessBanner
                  organizationId={activeOrganization?.id}
                  onboarded
                />
              ) : null}
            </div>
          </PageShell>
        </div>
      </div>
      <DepositDialog
        open={depositOpen}
        onOpenChange={setDepositOpen}
        investorOrganizationId={orgId}
        amount={depositAmount}
        onAmountChange={setDepositAmount}
        validationError={depositError}
        onValidationErrorChange={setDepositError}
        returnTo="/"
      />
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
