"use client";

import * as React from "react";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import type { Organization } from "@cashsouk/config";
import { getOnboardingStepperSteps, useOrganization } from "@cashsouk/config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, OnboardingStepper } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import {
  buildDirectorShareholderDisplayRowForEmailEligibility,
  filterVisiblePeopleRows,
} from "@cashsouk/types";
import { UnifiedKycAmlReadonlyRows } from "@cashsouk/ui";
import { toast } from "sonner";

interface OnboardingStatusCardProps {
  organization: Organization;
  userName?: string;
  actionButton?: React.ReactNode;
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
  const steps = getOnboardingStepperSteps(organization, "issuer");
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

  if (allComplete) {
    return null;
  }

  const displayName =
    userName ||
    (organization.type === "PERSONAL"
      ? "Personal Account"
      : organization.name || "Company Account");

  return (
    <div className="w-full">
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

      <OnboardingStepper steps={steps} />

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

export function getOnboardingSteps(organization: Organization) {
  return getOnboardingStepperSteps(organization, "issuer");
}

export type { OnboardingStepperStep as OnboardingStep } from "@cashsouk/config";
