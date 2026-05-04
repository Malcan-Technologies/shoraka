"use client";

import * as React from "react";
import { CheckIcon, XMarkIcon } from "@heroicons/react/24/solid";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import type { Organization } from "@cashsouk/config";
import { useOrganization } from "@cashsouk/config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  buildDirectorShareholderDisplayRowForEmailEligibility,
  filterVisiblePeopleRows,
} from "@cashsouk/types";
import { UnifiedKycAmlReadonlyRows } from "@cashsouk/ui";
import { toast } from "sonner";

interface OnboardingStep {
  id: string;
  label: string;
  isCompleted: boolean;
  isCurrent: boolean;
  isRejected?: boolean;
}

interface OnboardingStatusCardProps {
  organization: Organization;
  userName?: string;
  actionButton?: React.ReactNode;
}

/**
 * Determine the current onboarding step based on organization status
 * Steps for Investor Portal:
 * 1. Onboarding - Complete when organization exists (user has submitted onboarding), or Rejected if status is REJECTED
 * 2. Accepting User Agreement - Complete when tncAccepted === true
 * 3. Account Approval - Complete when onboardingStatus === 'COMPLETED' (admin approved)
 * 4. Deposit - Complete when depositReceived === true
 */
function getOnboardingSteps(organization: Organization): OnboardingStep[] {
  const isRejected = organization.onboardingStatus === "REJECTED";

  // Onboarding is complete once the organization exists (user submitted their KYC form)
  // If we're showing this component, the organization exists, so onboarding is always complete
  // UNLESS it was rejected
  const onboardingComplete = !isRejected;
  const tncComplete = !isRejected && organization.tncAccepted === true;
  const accountApprovalComplete = organization.onboardingStatus === "COMPLETED";
  const depositComplete = organization.depositReceived === true;

  // Determine current step (first incomplete step)
  let currentStepId = "";
  if (isRejected) {
    // If rejected, no current step - we show the rejection state
    currentStepId = "";
  } else if (!tncComplete) {
    currentStepId = "tnc";
  } else if (!accountApprovalComplete) {
    currentStepId = "approval";
  } else if (!depositComplete) {
    currentStepId = "deposit";
  }
  // If all complete, currentStepId remains ""

  return [
    {
      id: "onboarding",
      label: "Onboarding",
      isCompleted: onboardingComplete,
      isCurrent: false, // Never current since it's always complete when org exists (or rejected)
      isRejected,
    },
    {
      id: "tnc",
      label: "User Agreement",
      isCompleted: tncComplete,
      isCurrent: currentStepId === "tnc",
    },
    {
      id: "approval",
      label: "Approval",
      isCompleted: accountApprovalComplete,
      isCurrent: currentStepId === "approval",
    },
    {
      id: "deposit",
      label: "Deposit",
      isCompleted: depositComplete,
      isCurrent: currentStepId === "deposit",
    },
  ];
}

type OrganizationWithPeople = Organization & {
  people?: import("@cashsouk/types").ApplicationPersonRow[];
};

export function OnboardingStatusCard({
  organization,
  userName,
  actionButton,
}: OnboardingStatusCardProps) {
  const { refreshAmlStatus, refreshOrganizations } = useOrganization();
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const steps = getOnboardingSteps(organization);
  const allComplete = steps.every((step) => step.isCompleted);

  const orgWithPeople = organization as OrganizationWithPeople;
  const corporateUnifiedRows = React.useMemo(() => {
    if (organization.type !== "COMPANY") return [];
    const people = orgWithPeople.people ?? [];
    return filterVisiblePeopleRows(people).map((person) => ({
      ...buildDirectorShareholderDisplayRowForEmailEligibility(person, null),
      __person: person,
    }));
  }, [organization, orgWithPeople.people]);

  const showCorporatePeopleStatus =
    organization.type === "COMPANY" &&
    (organization.onboardingStatus === "PENDING_APPROVAL" ||
      organization.onboardingStatus === "PENDING_AML") &&
    corporateUnifiedRows.length > 0;

  const handleRefreshAml = async () => {
    if (!organization.id) return;
    
    setIsRefreshing(true);
    try {
      await refreshAmlStatus(organization.id);
      await refreshOrganizations();
      toast.success("AML status refreshed successfully");
    } catch (error) {
      toast.error("Failed to refresh AML status", {
        description: error instanceof Error ? error.message : "An unknown error occurred",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Don't show if all steps are complete
  if (allComplete) {
    return null;
  }

  // Get display name
  const displayName =
    userName ||
    (organization.type === "PERSONAL"
      ? "Personal Account"
      : organization.name || "Company Account");

  return (
    <div className="w-full">
      {/* Welcome header with action button */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">
            Welcome back, {displayName}!
          </h2>
          <p className="text-muted-foreground mt-1">
            Browse and invest in verified financing opportunities from your dashboard
          </p>
        </div>
        {actionButton}
      </div>

      {/* Stepper */}
      <div className="relative">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <React.Fragment key={step.id}>
              {/* Step circle and label */}
              <div className="flex flex-col items-center relative z-10">
                <div
                  className={`
                    flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all
                    ${
                      step.isRejected
                        ? "bg-destructive border-destructive text-destructive-foreground"
                        : step.isCompleted
                          ? "bg-primary border-primary text-primary-foreground"
                          : step.isCurrent
                            ? "bg-background border-primary border-[3px] ring-4 ring-primary/20"
                            : "bg-muted border-muted-foreground/30 text-muted-foreground"
                    }
                  `}
                >
                  {step.isRejected ? (
                    <XMarkIcon className="w-5 h-5" />
                  ) : step.isCompleted ? (
                    <CheckIcon className="w-5 h-5" />
                  ) : step.isCurrent ? (
                    <div className="w-3 h-3 rounded-full bg-primary" />
                  ) : (
                    <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
                  )}
                </div>
                <span
                  className={`
                    mt-2 text-xs md:text-sm font-medium text-center w-[80px] md:w-[100px] min-h-[2.5rem]
                    ${step.isRejected ? "text-destructive" : step.isCurrent ? "text-primary" : step.isCompleted ? "text-foreground" : "text-muted-foreground"}
                  `}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="flex-1 h-0.5 mx-2 -mt-6">
                  <div
                    className={`h-full transition-all ${
                      step.isRejected
                        ? "bg-destructive/30"
                        : step.isCompleted
                          ? "bg-primary"
                          : "bg-muted-foreground/30"
                    }`}
                  />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
      
      {showCorporatePeopleStatus ? (
        <Card className="mt-6">
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base">Directors and shareholders</CardTitle>
                <CardDescription>
                  Combined verification status for each party (identity checks and screening).
                </CardDescription>
              </div>
              {organization.onboardingStatus === "PENDING_AML" ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefreshAml}
                  disabled={isRefreshing}
                  className="gap-2 shrink-0"
                >
                  <ArrowPathIcon className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <UnifiedKycAmlReadonlyRows
              rows={corporateUnifiedRows}
              isRefreshing={organization.onboardingStatus === "PENDING_AML" && isRefreshing}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export { getOnboardingSteps };
export type { OnboardingStep };
