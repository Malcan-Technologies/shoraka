"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/auth";
import {
  useOrganization,
  getOnboardingStep,
  getOnboardingStepRoute,
  formatCurrency,
} from "@cashsouk/config";
import { checkAndRedirectForPendingInvitation } from "../lib/invitation-redirect";
import { filterVisiblePeopleRows, formatNoteDateEnMy } from "@cashsouk/types";
import { welcomeBackTitle } from "@cashsouk/ui";
import { DirectorShareholderAlertCard } from "../components/director-shareholder-alert-card";
import { getOnboardingSteps } from "../components/onboarding-status-card";
import { NextActionBanner } from "../components/dashboard/next-action-banner";
import { IssuerProfileCompletenessBanner } from "../components/profile-completeness-banner";
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
import { ApplyForFinancingButton } from "../components/apply-for-financing-button";
import {
  issuerDashboardSubhead,
  resolveApprovalReviewIndex,
  resolveIssuerDashboardState,
  resolveOnboardingSubmittedAt,
} from "../components/dashboard/resolve-issuer-dashboard-state";
import { formatMytDateTime } from "../components/dashboard/issuer-dashboard-display";
import { IssuerDashboardOnboarding } from "../components/dashboard/issuer-dashboard-onboarding";
import { IssuerDashboardApproval } from "../components/dashboard/issuer-dashboard-approval";
import { IssuerDashboardNew } from "../components/dashboard/issuer-dashboard-new";
import { IssuerDashboardActive } from "../components/dashboard/issuer-dashboard-active";
import {
  IssuerDashboardPendingAmendment,
  IssuerDashboardRejected,
} from "../components/dashboard/issuer-dashboard-terminal";
import type { IssuerDashboardBook } from "@cashsouk/types";

const EMPTY_BOOK: IssuerDashboardBook = {
  outstandingAmount: 0,
  liveNoteCount: 0,
  nextRepayment: null,
  availableLimit: null,
  approvedLimit: null,
  drawnAmount: null,
  drawnPercent: null,
  repaymentSchedule: [],
  upcomingRepayments: [],
  fundingProgress: [],
  outstandingOverTime: [],
  costOfFinancingYtd: {
    year: 0,
    total: 0,
    profitOnNotes: 0,
    drawdownFees: 0,
    facilityFees: 0,
    tawidh: 0,
    effectivePercent: null,
  },
};

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

  const { data: issuerDashboard, isLoading: dashboardLoading } = useIssuerDashboard(activeOrganization?.id);
  const { data: notesData } = useIssuerNotes();
  const { applications, isLoading: applicationsLoading } = useApplicationsData();

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
  const remainingOnboardingSteps = steps.filter((step) => !step.isCompleted && !step.isRejected).length;
  const onboardingStep = activeOrganization
    ? getOnboardingStep(activeOrganization, "issuer")
    : "account";
  const completedAccount =
    onboardingStep === "completed" || activeOrganization?.onboardingStatus === "COMPLETED";
  if (completedAccount && (applicationsLoading || Boolean(activeOrganization?.id && dashboardLoading))) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }
  const book = issuerDashboard?.book ?? EMPTY_BOOK;
  const dashboardState = resolveIssuerDashboardState({
    onboardingStep,
    onboardingStatus: activeOrganization?.onboardingStatus,
    applicationCount: applications.length,
    liveNoteCount: book.liveNoteCount,
  });
  const isAccountEnabled = dashboardState === "active" || dashboardState === "new";

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

  const nextRepaymentLine = (() => {
    const next = book.nextRepayment;
    if (!next) return null;
    const due = formatNoteDateEnMy(next.dueDate);
    if (!due) return null;
    return `${formatCurrency(next.amount, { decimals: 0 })} is due on ${due}.`;
  })();

  const submittedAt = activeOrganization
    ? resolveOnboardingSubmittedAt(activeOrganization)
    : null;

  return (
    <div className={cn(issuerMainContentClassName, issuerPageGutterClassName, "gap-6")}>
      <section className="flex min-w-0 flex-col gap-6">
        <header className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1.5">
            <h1 className="text-page-title text-primary">{welcomeBackTitle(displayName)}</h1>
            <p className="max-w-[70ch] text-pretty text-body text-muted-foreground">
              {issuerDashboardSubhead({
                state: dashboardState,
                remainingOnboardingSteps,
                pendingTitle: dashboardPendingAction?.title,
                nextRepaymentLine,
              })}
            </p>
          </div>
          {dashboardState === "active" ? (
            <ApplyForFinancingButton className="h-11 shrink-0 rounded-xl font-semibold" />
          ) : null}
        </header>

        {activeOrganization?.type === "COMPANY" ? (
          <DirectorShareholderAlertCard
            visiblePeople={visiblePeopleForDsAlert}
            enabled={activeOrganization.onboardingStatus === "COMPLETED"}
          />
        ) : null}

        <IssuerProfileCompletenessBanner
          organizationId={activeOrganization?.id}
          onboarded={isAccountEnabled}
        />

        {dashboardState === "active" && dashboardPendingAction ? (
          <NextActionBanner
            title={dashboardPendingAction.title}
            description={dashboardPendingAction.description}
            href={dashboardPendingAction.href}
            ctaLabel={dashboardPendingAction.ctaLabel}
            tone={dashboardPendingAction.tone}
          />
        ) : null}

        {dashboardState === "rejected" ? <IssuerDashboardRejected /> : null}
        {dashboardState === "pending_amendment" ? <IssuerDashboardPendingAmendment /> : null}

        {dashboardState === "onboarding" && activeOrganization ? (
          <IssuerDashboardOnboarding steps={steps} orgName={orgDisplayName} />
        ) : null}

        {dashboardState === "approval" && activeOrganization ? (
          <IssuerDashboardApproval
            submittedLabel={formatMytDateTime(submittedAt)}
            reviewIndex={resolveApprovalReviewIndex({
              onboardingStatus: activeOrganization.onboardingStatus,
              ssmChecked: activeOrganization.ssmChecked,
              ssmApproved: activeOrganization.ssmApproved,
            })}
          />
        ) : null}

        {dashboardState === "new" ? (
          <IssuerDashboardNew availableLimit={book.availableLimit} approvedLimit={book.approvedLimit} />
        ) : null}

        {dashboardState === "active" ? (
          <IssuerDashboardActive
            book={book}
            onTimePercent={issuerDashboard?.repaymentPerformance.onTimePercent ?? null}
            pastDueCount={issuerDashboard?.repaymentPerformance.pastDueCount ?? null}
            applications={applications}
            invoices={issuerDashboard?.invoices ?? []}
          />
        ) : null}
      </section>
    </div>
  );
}

export default function IssuerDashboardPage() {
  return <IssuerDashboardContent />;
}
