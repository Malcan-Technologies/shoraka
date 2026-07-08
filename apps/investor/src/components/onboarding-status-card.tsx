"use client";

import * as React from "react";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import type { Organization } from "@cashsouk/config";
import { getOnboardingStepperSteps, useOrganization } from "@cashsouk/config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, OnboardingStepper, DirectorShareholderCtosEmptyAlert, UnifiedKycAmlReadonlyRows } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import {
  buildDirectorShareholderDisplayRowForEmailEligibility,
  filterVisiblePeopleRows,
  resolveDirectorShareholderCtosEmptyWarning,
} from "@cashsouk/types";
import { toast } from "sonner";

interface OnboardingStatusCardProps {
  organization: Organization;
  userName?: string;
  actionButton?: React.ReactNode;
}

type OrganizationWithPeople = Organization & {
  people?: import("@cashsouk/types").ApplicationPersonRow[];
  directorShareholderListSource?: import("@cashsouk/types").DirectorShareholderListSource;
  ctosDirectorShareholderWarning?: string | null;
};

export function OnboardingStatusCard({
  organization,
  userName,
  actionButton,
}: OnboardingStatusCardProps) {
  const { refreshAmlStatus, refreshOrganizations } = useOrganization();
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const steps = getOnboardingStepperSteps(organization, "investor");
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

  const resolvedCtosEmptyWarning = React.useMemo(
    () =>
      resolveDirectorShareholderCtosEmptyWarning({
        directorShareholderListSource: orgWithPeople.directorShareholderListSource ?? null,
        ctosDirectorShareholderWarning: orgWithPeople.ctosDirectorShareholderWarning ?? null,
      }),
    [orgWithPeople.directorShareholderListSource, orgWithPeople.ctosDirectorShareholderWarning]
  );

  const showCorporatePeopleStatus =
    organization.type === "COMPANY" &&
    (organization.onboardingStatus === "PENDING_APPROVAL" ||
      organization.onboardingStatus === "PENDING_AML" ||
      organization.onboardingStatus === "PENDING_AMENDMENT") &&
    (corporateUnifiedRows.length > 0 || Boolean(resolvedCtosEmptyWarning));

  const handleRefreshAml = async () => {
    if (!organization.id) return;

    setIsRefreshing(true);
    try {
      const result = await refreshAmlStatus(organization.id);
      await refreshOrganizations();
      if (result.advanced) {
        toast.success("AML screening approved. Onboarding has advanced to Final Approval.");
      } else {
        toast.info("AML status refreshed. RegTank approval is still pending.");
      }
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
            Browse and invest in verified financing opportunities from your dashboard
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
            {resolvedCtosEmptyWarning ? (
              <DirectorShareholderCtosEmptyAlert message={resolvedCtosEmptyWarning} />
            ) : null}
            {corporateUnifiedRows.length > 0 ? (
              <UnifiedKycAmlReadonlyRows
                rows={corporateUnifiedRows}
                isRefreshing={organization.onboardingStatus === "PENDING_AML" && isRefreshing}
              />
            ) : resolvedCtosEmptyWarning ? (
              <p className="text-sm text-muted-foreground">
                No directors or shareholders are available from CTOS.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export function getOnboardingSteps(organization: Organization) {
  return getOnboardingStepperSteps(organization, "investor");
}

export type { OnboardingStepperStep as OnboardingStep } from "@cashsouk/config";
