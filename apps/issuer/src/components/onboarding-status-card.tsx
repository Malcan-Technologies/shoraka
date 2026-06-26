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
 * Issuer onboarding steps (post org creation):
 * 1. User Agreement — tncAccepted
 * 2. Onboarding fee — onboardingFeePaidAt (company accounts)
 * 3. Onboarding (eKYB) — RegTank submitted (status past PENDING)
 * 4. Approval — onboardingStatus === COMPLETED
 */
function getOnboardingSteps(organization: Organization): OnboardingStep[] {
  const isRejected = organization.onboardingStatus === "REJECTED";
  const isCompany = organization.type === "COMPANY";

  const tncComplete = !isRejected && organization.tncAccepted === true;
  const feeComplete =
    !isRejected &&
    (!isCompany || Boolean(organization.onboardingFeePaidAt));
  const postRegTankStatuses = new Set([
    "PENDING_APPROVAL",
    "PENDING_AML",
    "PENDING_AMENDMENT",
    "PENDING_SSM_REVIEW",
    "PENDING_FINAL_APPROVAL",
    "COMPLETED",
  ]);
  const onboardingComplete =
    !isRejected && postRegTankStatuses.has(organization.onboardingStatus);
  const accountApprovalComplete = organization.onboardingStatus === "COMPLETED";

  let currentStepId = "";
  if (isRejected) {
    currentStepId = "";
  } else if (!tncComplete) {
    currentStepId = "tnc";
  } else if (!feeComplete) {
    currentStepId = "fee";
  } else if (!onboardingComplete) {
    currentStepId = "onboarding";
  } else if (!accountApprovalComplete) {
    currentStepId = "approval";
  }

  const steps: OnboardingStep[] = [
    {
      id: "tnc",
      label: "User Agreement",
      isCompleted: tncComplete,
      isCurrent: currentStepId === "tnc",
    },
  ];

  if (isCompany) {
    steps.push({
      id: "fee",
      label: "Onboarding Fee",
      isCompleted: feeComplete,
      isCurrent: currentStepId === "fee",
    });
  }

  steps.push(
    {
      id: "onboarding",
      label: "Onboarding",
      isCompleted: onboardingComplete,
      isCurrent: currentStepId === "onboarding",
      isRejected,
    },
    {
      id: "approval",
      label: "Approval",
      isCompleted: accountApprovalComplete,
      isCurrent: currentStepId === "approval",
    }
  );

  return steps;
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
      organization.onboardingStatus === "PENDING_AML" ||
      organization.onboardingStatus === "PENDING_AMENDMENT") &&
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
            Apply for financing and manage your financing applications from your dashboard
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
