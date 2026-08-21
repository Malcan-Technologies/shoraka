"use client";

import * as React from "react";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import type { Organization, PortalType } from "@cashsouk/config";
import {
  getOnboardingStepperSteps,
  useOrganization,
  ONBOARDING_REFRESH_LABEL,
  ONBOARDING_REFRESH_LOADING_LABEL,
} from "@cashsouk/config";
import {
  buildDirectorShareholderDisplayRowForEmailEligibility,
  filterVisiblePeopleRows,
  formatPeopleRolesLine,
  isMissingGovernmentIdPerson,
  resolveDirectorShareholderCtosEmptyWarning,
  type ApplicationPersonRow,
  type DirectorShareholderListSource,
} from "@cashsouk/types";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/card";
import { Button } from "../components/button";
import { StatusBadge } from "../components/status-badge";
import { OnboardingStepper } from "./onboarding-stepper";
import { DirectorShareholderCtosEmptyAlert } from "../director-shareholder-ctos-empty-alert";
import { DirectorShareholderUnresolvedIdentitySection } from "../director-shareholder-unresolved-identity-card";
import { UnifiedKycAmlReadonlyRows } from "../components/unified-kyc-aml-readonly-rows";

type OrganizationWithPeople = Organization & {
  people?: ApplicationPersonRow[];
  directorShareholderListSource?: DirectorShareholderListSource;
  ctosDirectorShareholderWarning?: string | null;
};

export interface OnboardingStatusCardProps {
  organization: Organization;
  /** Which portal this dashboard belongs to — drives the stepper shape (fee step, deposit step, etc). */
  portal: PortalType;
  /** Optional action shown above the stepper (PageShell owns the welcome heading). */
  actionButton?: React.ReactNode;
}

/**
 * Onboarding status card shared by the investor and issuer dashboards. Company accounts see
 * a Directors/shareholders breakdown; personal accounts see a simpler AML status line — both
 * use the same self-service "Refresh status" action (`refreshAmlStatus`), since the backend
 * AML refresh already supports both account types.
 */
export function OnboardingStatusCard({
  organization,
  portal,
  actionButton,
}: OnboardingStatusCardProps) {
  const { refreshAmlStatus, refreshOrganizations } = useOrganization();
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const steps = getOnboardingStepperSteps(organization, portal);
  const allComplete = steps.every((step) => step.isCompleted);

  const isCompany = organization.type === "COMPANY";
  const orgWithPeople = organization as OrganizationWithPeople;
  const corporateUnifiedRows = React.useMemo(() => {
    if (!isCompany) return [];
    const people = orgWithPeople.people ?? [];
    return filterVisiblePeopleRows(people)
      .filter((person) => !isMissingGovernmentIdPerson(person))
      .map((person) => ({
        ...buildDirectorShareholderDisplayRowForEmailEligibility(person, null),
        __person: person,
      }));
  }, [isCompany, orgWithPeople.people]);

  const unresolvedCorporatePeople = React.useMemo(() => {
    if (!isCompany) return [];
    return filterVisiblePeopleRows(orgWithPeople.people ?? []).filter((p) =>
      isMissingGovernmentIdPerson(p)
    );
  }, [isCompany, orgWithPeople.people]);

  const resolvedCtosEmptyWarning = React.useMemo(
    () =>
      resolveDirectorShareholderCtosEmptyWarning({
        directorShareholderListSource: orgWithPeople.directorShareholderListSource ?? null,
        ctosDirectorShareholderWarning: orgWithPeople.ctosDirectorShareholderWarning ?? null,
      }),
    [orgWithPeople.directorShareholderListSource, orgWithPeople.ctosDirectorShareholderWarning]
  );

  const isPendingAml = organization.onboardingStatus === "PENDING_AML";

  const showCorporatePeopleStatus =
    isCompany &&
    (organization.onboardingStatus === "PENDING_APPROVAL" ||
      isPendingAml ||
      organization.onboardingStatus === "PENDING_AMENDMENT") &&
    (corporateUnifiedRows.length > 0 ||
      unresolvedCorporatePeople.length > 0 ||
      Boolean(resolvedCtosEmptyWarning));

  // Personal accounts have no director/shareholder list, but the same self-service AML
  // refresh already works for them on the backend — show status + Refresh here instead of
  // silently hiding the action (it was previously only rendered inside the company-only block).
  const showPersonalAmlStatus = !isCompany && isPendingAml;

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

  const refreshButton = (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRefreshAml}
      disabled={isRefreshing}
      aria-busy={isRefreshing || undefined}
      className="gap-2 shrink-0"
    >
      <ArrowPathIcon className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
      {isRefreshing ? ONBOARDING_REFRESH_LOADING_LABEL : ONBOARDING_REFRESH_LABEL}
    </Button>
  );

  return (
    <div className="w-full">
      {actionButton ? (
        <div className="mb-6 flex justify-end">{actionButton}</div>
      ) : null}

      <OnboardingStepper steps={steps} />

      {showCorporatePeopleStatus ? (
        <Card className="mt-6">
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base">Directors and shareholders</CardTitle>
                <CardDescription>
                  Combined verification status for each party (identity checks and KYB/related-party
                  screening).
                </CardDescription>
              </div>
              {isPendingAml ? refreshButton : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {resolvedCtosEmptyWarning ? (
              <DirectorShareholderCtosEmptyAlert message={resolvedCtosEmptyWarning} />
            ) : null}
            {corporateUnifiedRows.length > 0 ? (
              <UnifiedKycAmlReadonlyRows
                rows={corporateUnifiedRows}
                isRefreshing={isPendingAml && isRefreshing}
              />
            ) : null}
            {unresolvedCorporatePeople.length > 0 ? (
              <DirectorShareholderUnresolvedIdentitySection
                people={unresolvedCorporatePeople.map((p) => ({
                  name: p.name,
                  role: formatPeopleRolesLine(p),
                  sharePercentage: p.sharePercentage,
                  eodRequestId: p.requestId,
                  onboardingStatus: p.onboarding?.status ?? null,
                  amlStatus: p.screening?.status ?? null,
                  kycId: p.onboarding?.id ?? null,
                }))}
              />
            ) : null}
            {corporateUnifiedRows.length === 0 &&
            unresolvedCorporatePeople.length === 0 &&
            resolvedCtosEmptyWarning ? (
              <p className="text-sm text-muted-foreground">
                No directors or shareholders are available from CTOS.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {showPersonalAmlStatus ? (
        <Card className="mt-6">
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base">AML Approval</CardTitle>
                <CardDescription>KYC screening in RegTank is being reviewed.</CardDescription>
              </div>
              {refreshButton}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-meta text-muted-foreground">Status</span>
              <StatusBadge label="Pending Review" status="submitted" size="sm" />
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export function getOnboardingSteps(organization: Organization, portal: PortalType) {
  return getOnboardingStepperSteps(organization, portal);
}

export type { OnboardingStepperStep as OnboardingStep } from "@cashsouk/config";
