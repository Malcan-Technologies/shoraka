"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../lib/auth";
import {
  useOrganization,
  getOnboardingStep,
  getOnboardingStepRoute,
} from "@cashsouk/config";
import { checkAndRedirectForPendingInvitation } from "../lib/invitation-redirect";
import { Button } from "../components/ui/button";
import { PlusIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { filterVisiblePeopleRows } from "@cashsouk/types";
import { DirectorShareholderAlertCard } from "../components/director-shareholder-alert-card";
import { OnboardingStatusCard, getOnboardingSteps } from "../components/onboarding-status-card";
import { RecentApplicationsCard } from "../components/dashboard/recent-applications-card";
import { RecentFinancingCard } from "../components/dashboard/recent-financing-card";
import { RecentActivityCard } from "../components/dashboard/recent-activity-card";
import { NextActionBanner } from "../components/dashboard/next-action-banner";
import { WhereThingsStandCard } from "../components/dashboard/where-things-stand-card";
import { RepaymentPerformanceCard } from "../components/repayment-performance-card";
import { PageShell, welcomeBackTitle } from "@cashsouk/ui";
import { useIssuerDashboard } from "../hooks/use-issuer-dashboard";
import { useApplicationsData } from "./(application-management)/applications/use-applications-data";
import { buildIssuerFinancingPendingAction } from "@/lib/issuer-financing-actionable";
import {
  buildIssuerApplicationsPendingAction,
  pickIssuerDashboardPendingAction,
} from "@/lib/issuer-pending-actions";
import { useIssuerNotes } from "@/notes/hooks/use-issuer-notes";
import { issuerMainContentClassName, issuerPageGutterClassName } from "@/lib/issuer-layout";
import { cn } from "@/lib/utils";

function onboardingStepCta(stepId: string | undefined): { href: string; label: string } | null {
  switch (stepId) {
    case "tnc":
      return { href: "/onboarding/terms", label: "Continue agreement" };
    case "fee":
      return { href: "/onboarding/fee", label: "Pay onboarding fee" };
    case "verify":
      return { href: "/onboarding/verify", label: "Continue onboarding" };
    default:
      return null;
  }
}

function IssuerDashboardContent() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const {
    activeOrganization,
    isLoading: isOrgLoading,
    organizations,
  } = useOrganization();
  const hasRedirected = useRef(false);

  const visiblePeopleForDsAlert = useMemo(
    () => filterVisiblePeopleRows(activeOrganization?.people ?? []),
    [activeOrganization?.people]
  );

  const { data: issuerDashboard } = useIssuerDashboard(activeOrganization?.id);
  const { data: notesData } = useIssuerNotes();
  const { applications } = useApplicationsData();

  const orgDisplayName = useMemo(() => {
    if (!activeOrganization) return "";
    if (activeOrganization.firstName && activeOrganization.lastName) {
      return `${activeOrganization.firstName} ${activeOrganization.lastName}`;
    }
    if (activeOrganization.type === "COMPANY" && activeOrganization.name) {
      return activeOrganization.name;
    }
    return activeOrganization.type === "PERSONAL" ? "Personal Account" : "Company Account";
  }, [activeOrganization]);

  const displayName = useMemo(
    () => issuerDashboard?.user.displayName?.trim() || orgDisplayName,
    [issuerDashboard?.user.displayName, orgDisplayName]
  );

  const canShowDashboard = useMemo(() => {
    if (!isAuthenticated || isOrgLoading) return false;
    if (organizations.length === 0) return false;
    if (!activeOrganization) {
      return organizations.some((org) => {
        const step = getOnboardingStep(org, "issuer");
        return ["approval", "deposit", "completed", "rejected"].includes(step);
      });
    }
    const step = getOnboardingStep(activeOrganization, "issuer");
    return ["approval", "deposit", "completed", "rejected"].includes(step);
  }, [isAuthenticated, isOrgLoading, organizations, activeOrganization]);

  useEffect(() => {
    if (!isAuthenticated || isOrgLoading) return;

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
      const flowStep = getOnboardingStep(activeOrganization, "issuer");
      if (flowStep === "terms" || flowStep === "fee" || flowStep === "verify") {
        if (!hasRedirected.current) {
          hasRedirected.current = true;
          router.replace(getOnboardingStepRoute(flowStep));
        }
        return;
      }
    }

    hasRedirected.current = false;
  }, [isAuthenticated, isOrgLoading, activeOrganization, organizations, router]);

  if (isAuthenticated === null || isOrgLoading || !canShowDashboard) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const steps = activeOrganization ? getOnboardingSteps(activeOrganization) : [];
  const allStepsComplete = activeOrganization ? steps.every((step) => step.isCompleted) : false;
  const currentStep = steps.find((step) => step.isCurrent);
  const onboardingCta = onboardingStepCta(currentStep?.id);

  const isAwaitingApproval = currentStep?.id === "approval";
  const isRejected = activeOrganization?.onboardingStatus === "REJECTED";
  const isAccountEnabled = activeOrganization?.onboardingStatus === "COMPLETED";

  const applicationsPendingAction = isAccountEnabled
    ? buildIssuerApplicationsPendingAction(applications)
    : null;
  const financingPendingAction = isAccountEnabled
    ? buildIssuerFinancingPendingAction({
        contracts: issuerDashboard?.contracts ?? [],
        invoices: issuerDashboard?.invoices ?? [],
        notes: notesData?.notes ?? [],
      })
    : null;
  const dashboardPendingAction = pickIssuerDashboardPendingAction({
    applications: applicationsPendingAction,
    financing: financingPendingAction,
  });

  const nextAction = (() => {
    if (!allStepsComplete && onboardingCta && currentStep) {
      return {
        title: `Next: ${currentStep.label}`,
        description: "Finish this step to unlock financing applications.",
        href: onboardingCta.href,
        ctaLabel: onboardingCta.label,
        tone: "action" as const,
      };
    }
    if (dashboardPendingAction) {
      return {
        title: dashboardPendingAction.title,
        description: dashboardPendingAction.description,
        href: dashboardPendingAction.href,
        ctaLabel: dashboardPendingAction.ctaLabel,
        tone: dashboardPendingAction.tone,
      };
    }
    return null;
  })();

  return (
    <div className={cn(issuerMainContentClassName, issuerPageGutterClassName, "gap-6 md:gap-8")}>
      <PageShell
        title={welcomeBackTitle(displayName)}
        description={
          allStepsComplete
            ? "Manage your financing from here."
            : "Complete onboarding to unlock financing applications."
        }
        action={
          !allStepsComplete && onboardingCta ? (
            <Button asChild className="h-11 shrink-0 gap-2 rounded-xl font-semibold">
              <Link href={onboardingCta.href}>
                <PlusIcon className="h-4 w-4" />
                {onboardingCta.label}
              </Link>
            </Button>
          ) : null
        }
      >
        <div className="space-y-8">
            {activeOrganization?.type === "COMPANY" ? (
              <DirectorShareholderAlertCard
                visiblePeople={visiblePeopleForDsAlert}
                enabled={activeOrganization.onboardingStatus === "COMPLETED"}
              />
            ) : null}

            {nextAction ? (
              <NextActionBanner
                title={nextAction.title}
                description={nextAction.description}
                href={nextAction.href}
                ctaLabel={nextAction.ctaLabel}
                tone={nextAction.tone}
              />
            ) : null}

            {activeOrganization && !allStepsComplete ? (
              <section className="space-y-6">
                <OnboardingStatusCard organization={activeOrganization} />

                {isAwaitingApproval ? (
                  <div className="rounded-xl border bg-card p-6">
                    <h3 className="mb-2 text-lg font-semibold">Awaiting approval</h3>
                    <p className="text-muted-foreground">
                      Your account is under review. You will be notified once approval is complete.
                    </p>
                  </div>
                ) : null}

                {activeOrganization?.onboardingStatus === "PENDING_AMENDMENT" ? (
                  <div className="rounded-xl border border-status-action-text/30 bg-status-action-bg p-6">
                    <h3 className="mb-2 text-lg font-semibold">Changes requested</h3>
                    <p className="text-muted-foreground">
                      Your onboarding was sent back for updates. Complete the updated submission so
                      our team can review it again.
                    </p>
                  </div>
                ) : null}

                {isRejected ? (
                  <div className="rounded-xl border border-destructive/50 bg-destructive/5 p-6">
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                        <ExclamationTriangleIcon className="h-5 w-5 text-destructive" />
                      </div>
                      <div>
                        <h3 className="mb-2 text-lg font-semibold text-destructive">
                          Onboarding rejected
                        </h3>
                        <p className="text-muted-foreground">
                          Your onboarding application was rejected. If you believe this was a
                          mistake, contact support to request a review.
                        </p>
                        <p className="mt-3 text-sm text-muted-foreground">
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
                ) : null}
              </section>
            ) : null}

            {isAccountEnabled ? (
              <div className="space-y-8">
                <WhereThingsStandCard organizationId={activeOrganization?.id} />
                <RepaymentPerformanceCard
                  onTimeRate={issuerDashboard?.repaymentPerformance.onTimePercent ?? null}
                  pastDueCount={issuerDashboard?.repaymentPerformance.pastDueCount ?? null}
                  lateRepaymentsLastSixMonthsCount={
                    issuerDashboard?.repaymentPerformance.lateRepaymentsLastSixMonthsCount ?? null
                  }
                />
                <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
                  <RecentApplicationsCard />
                  <RecentFinancingCard organizationId={activeOrganization?.id} />
                </div>
                <RecentActivityCard />
              </div>
            ) : null}
        </div>
      </PageShell>
    </div>
  );
}

export default function IssuerDashboardPage() {
  return <IssuerDashboardContent />;
}
