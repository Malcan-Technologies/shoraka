"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { BuildingOffice2Icon, UserIcon, ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { PortalBadge, Skeleton, StatusBadge } from "@cashsouk/ui";
import { formatCurrency } from "@cashsouk/config";
import { formatOrganizationReference, type PortalType } from "@cashsouk/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  AdminDetailTabPanel,
  AdminDetailTabs,
  AdminEntityHeader,
  AdminEntitySummaryCard,
  AdminRelatedRecordsRail,
  useAdminDetailTabState,
  type AdminDetailTab,
} from "@/components/admin-detail";
import { OrganizationActivityTimeline } from "@/components/organization-activity-timeline";
import { OrganizationIssuerCtosReportsCard } from "@/components/organization-issuer-ctos-reports-card";
import { OrganizationTypeBadge } from "@/components/organization-type-badge";
import { RequirePermission } from "@/components/require-permission";
import {
  useOrganizationDetail,
  useUpdateSophisticatedStatus,
} from "@/hooks/use-organization-detail";
import { usePermissions } from "@/hooks/use-permissions";
import { accountHref, orgListHref } from "@/lib/admin-directory-hrefs";
import { adminTabStatusLabel } from "@/lib/admin-status-token";
import { getOrganizationOnboardingPresentation } from "@/lib/organization-status";
import { OrganizationKycResponseCard } from "./organization-kyc-response-card";
import { OrganizationLegalAcceptancesPanel } from "./organization-legal-acceptances-panel";
import { OrganizationLinkedRecordsPanel } from "./organization-linked-records-panel";
import { OrganizationPeoplePanel } from "./organization-people-panel";
import { OrganizationWalletActivityPanel } from "./organization-wallet-activity-panel";
import { CopyableText } from "./organization-profile-helpers";
import { OrganizationProfilePanel } from "./organization-profile-panel";
import { OrganizationQuickLinksCard } from "./organization-quick-links-card";
import {
  isOrgDetailTabId,
  isOrgPeopleTabAvailable,
  organizationTabStatus,
  type OrgDetailTabId,
} from "@/organizations/utils/organization-detail-tabs";

function formatHeaderAmount(amount: number): string {
  return formatCurrency(Math.ceil(amount), { decimals: 0 });
}

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-24" />
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="p-6 md:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
              <Skeleton className="h-12 w-12 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-72 max-w-full" />
                <Skeleton className="h-4 w-48" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:flex">
              <Skeleton className="h-20 w-full rounded-xl sm:w-48" />
              <Skeleton className="h-20 w-full rounded-xl sm:w-48" />
            </div>
          </div>
        </div>
        <div className="border-t px-6 py-4 md:px-8">
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
      <Skeleton className="h-56 w-full rounded-2xl" />
    </div>
  );
}

export function OrganizationDetailPage({ portal }: { portal: PortalType }) {
  const { can } = usePermissions();
  const canManage = can("organizations.manage");
  const canView = can("organizations.view");
  const canViewAcceptances = can("document_management.view");
  const canViewAccounts = can("users.view");
  const params = useParams();
  const organizationId = params.id as string;

  const { data: org, isLoading, error } = useOrganizationDetail(portal, organizationId, {
    enabled: canView,
  });
  const updateSophisticatedMutation = useUpdateSophisticatedStatus();
  const [showSophisticatedDialog, setShowSophisticatedDialog] = React.useState(false);
  const [pendingSophisticatedStatus, setPendingSophisticatedStatus] = React.useState<boolean | null>(
    null
  );
  const [sophisticatedReason, setSophisticatedReason] = React.useState("");

  const canShowPeopleTab = isOrgPeopleTabAvailable(org?.type);

  const { activeTab, setActiveTab } = useAdminDetailTabState<OrgDetailTabId>({
    isValidTab: (value: string): value is OrgDetailTabId => {
      if (!isOrgDetailTabId(value)) return false;
      return value !== "acceptances" || canViewAcceptances;
    },
    computedTab: "organization",
  });
  const resolvedTab: OrgDetailTabId =
    activeTab === "people" && org && !canShowPeopleTab
      ? "organization"
      : (activeTab ?? "organization");

  React.useEffect(() => {
    if (!org) return;
    if (activeTab === "people" && !isOrgPeopleTabAvailable(org.type)) {
      setActiveTab("organization");
    }
  }, [activeTab, org, setActiveTab]);

  const handleSophisticatedToggle = (checked: boolean) => {
    if (!organizationId) return;
    setPendingSophisticatedStatus(checked);
    setSophisticatedReason("");
    setShowSophisticatedDialog(true);
  };

  const handleConfirmSophisticatedChange = () => {
    if (!organizationId || pendingSophisticatedStatus === null || !sophisticatedReason.trim()) {
      return;
    }
    updateSophisticatedMutation.mutate(
      {
        organizationId,
        isSophisticatedInvestor: pendingSophisticatedStatus,
        reason: sophisticatedReason.trim(),
      },
      {
        onSuccess: () => {
          toast.success(
            pendingSophisticatedStatus
              ? "Marked as sophisticated investor"
              : "Removed sophisticated investor status"
          );
          setShowSophisticatedDialog(false);
          setPendingSophisticatedStatus(null);
          setSophisticatedReason("");
        },
        onError: (err) => {
          toast.error(`Failed to update status: ${err.message}`);
        },
      }
    );
  };

  const handleCancelSophisticatedChange = () => {
    setShowSophisticatedDialog(false);
    setPendingSophisticatedStatus(null);
    setSophisticatedReason("");
  };

  const displayName = React.useMemo(() => {
    if (!org) return "";
    if (org.type === "COMPANY") return org.name || "Unnamed Company";
    return org.firstName && org.lastName
      ? `${org.firstName} ${org.lastName}`
      : `${org.owner.firstName} ${org.owner.lastName}`;
  }, [org]);

  const tabs = React.useMemo<AdminDetailTab<OrgDetailTabId>[]>(() => {
    if (!org) return [];
    const orgTab = organizationTabStatus(org.onboardingStatus);
    return [
      {
        id: "organization",
        label: "Organization",
        statusToken: orgTab.statusToken,
        statusLabel: orgTab.statusLabel,
      },
      ...(canShowPeopleTab
        ? [
            {
              id: "people" as const,
              label: "People",
              statusToken: "neutral" as const,
              statusLabel: adminTabStatusLabel("neutral"),
            },
          ]
        : []),
      {
        id: "linked-records",
        label: "Linked records",
        statusToken: "neutral",
        statusLabel: adminTabStatusLabel("neutral"),
      },
      ...(canViewAcceptances
        ? [
            {
              id: "acceptances" as const,
              label: "Acceptances",
              statusToken: "neutral" as const,
              statusLabel: adminTabStatusLabel("neutral"),
            },
          ]
        : []),
      {
        id: "activity",
        label: "Activity",
        statusToken: "neutral",
        statusLabel: adminTabStatusLabel("neutral"),
      },
    ];
  }, [canShowPeopleTab, canViewAcceptances, org]);

  const onboardingPresentation = org
    ? getOrganizationOnboardingPresentation(org.onboardingStatus, { completedLabel: "Onboarded" })
    : null;

  const ownerName = org ? `${org.owner.firstName} ${org.owner.lastName}` : "";
  const ownerMetric = org
    ? {
        label: "Owner",
        value: canViewAccounts ? (
          <Link
            href={accountHref(org.owner.userId)}
            className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {ownerName}
          </Link>
        ) : (
          ownerName
        ),
      }
    : null;
  const emailMetric = org
    ? {
        label: "Email",
        value: org.owner.email.trim() ? (
          <CopyableText value={org.owner.email.trim()} label="Email" truncate />
        ) : (
          "—"
        ),
      }
    : null;
  const phoneMetric = org
    ? {
        label: "Phone",
        value: org.phoneNumber?.trim() ? (
          <CopyableText value={org.phoneNumber.trim()} label="Phone" truncate />
        ) : (
          "—"
        ),
      }
    : null;
  const onboardedMetric = org
    ? {
        label: "Onboarded",
        value: org.onboardedAt ? format(new Date(org.onboardedAt), "dd MMM yyyy") : "—",
      }
    : null;
  const headerMetrics =
    org && ownerMetric && emailMetric && phoneMetric
      ? portal === "investor" && onboardedMetric
        ? [ownerMetric, emailMetric, phoneMetric, onboardedMetric]
        : [ownerMetric, emailMetric, phoneMetric]
      : [];
  const summaryCards = !org
    ? []
    : portal === "investor"
      ? [
          <AdminEntitySummaryCard
            key="wallet"
            label="Wallet balance"
            value={formatHeaderAmount(org.walletBalance ?? 0)}
          />,
          <AdminEntitySummaryCard
            key="invested"
            label="Invested"
            value={formatHeaderAmount(org.investedAmount ?? 0)}
          />,
        ]
      : [
          <AdminEntitySummaryCard
            key="approved-facility"
            label="Approved facility"
            value={formatHeaderAmount(org.approvedFacilityAmount ?? 0)}
          />,
          <AdminEntitySummaryCard
            key="active-notes"
            label="Active notes"
            value={formatHeaderAmount(org.activeNotesAmount ?? 0)}
          />,
        ];

  return (
    <RequirePermission permission="organizations.view">
      <>
        <div className="flex-1 overflow-y-auto">
          <div className="w-full space-y-6 px-4 py-6 md:px-6 md:py-8 lg:px-8">
            {isLoading ? <PageSkeleton /> : null}

            {error ? (
              <div className="py-8 text-center text-destructive">
                Error loading organization:{" "}
                {error instanceof Error ? error.message : "Unknown error"}
              </div>
            ) : null}

            {org && onboardingPresentation ? (
              <div className="space-y-6">
                <AdminEntityHeader
                  variant="hero"
                  heroTint={portal === "issuer" ? "issuer" : "investor"}
                  backHref={orgListHref(portal)}
                  backLabel={portal === "issuer" ? "Issuers" : "Investors"}
                  eyebrow={portal === "issuer" ? "Issuer detail" : "Investor detail"}
                  title={displayName}
                  subtitle={`${formatOrganizationReference({
                    displayReference: org.displayReference,
                    id: org.id,
                  })} · ${ownerName}`}
                  icon={org.type === "COMPANY" ? BuildingOffice2Icon : UserIcon}
                  chips={
                    <>
                      <PortalBadge portal={org.portal} />
                      <OrganizationTypeBadge type={org.type} />
                      <StatusBadge
                        label={onboardingPresentation.label}
                        status={onboardingPresentation.status}
                      />
                    </>
                  }
                  summaryCards={summaryCards}
                  actions={
                    portal === "investor" || org.regtankPortalUrl ? (
                      <>
                        {portal === "investor" ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <div className="whitespace-nowrap text-meta text-muted-foreground">
                                Sophisticated Investor
                              </div>
                              <Switch
                                checked={org.isSophisticatedInvestor}
                                onCheckedChange={handleSophisticatedToggle}
                                disabled={updateSophisticatedMutation.isPending || !canManage}
                                title={
                                  !canManage
                                    ? "You do not have permission to perform this action."
                                    : undefined
                                }
                              />
                              {org.isSophisticatedInvestor ? (
                                <StatusBadge label="Yes" status="success" />
                              ) : (
                                <StatusBadge label="No" status="neutral" />
                              )}
                            </div>
                            {org.sophisticatedInvestorReason ? (
                              <p className="max-w-xs text-meta text-muted-foreground">
                                {org.sophisticatedInvestorReason}
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                        {org.regtankPortalUrl ? (
                          <Button variant="outline" size="sm" asChild className="gap-1.5">
                            <a href={org.regtankPortalUrl} target="_blank" rel="noopener noreferrer">
                              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                              Open in RegTank
                            </a>
                          </Button>
                        ) : null}
                      </>
                    ) : undefined
                  }
                  metrics={headerMetrics}
                />

                <AdminRelatedRecordsRail
                  main={
                    <AdminDetailTabs tabs={tabs} value={resolvedTab} onValueChange={setActiveTab}>
                      <AdminDetailTabPanel value="organization" preserveMount>
                        <OrganizationProfilePanel
                          key={organizationId}
                          org={org}
                          portal={portal}
                          organizationId={organizationId}
                          displayName={displayName}
                        />
                      </AdminDetailTabPanel>
                      {canShowPeopleTab ? (
                        <AdminDetailTabPanel value="people" preserveMount>
                          <OrganizationPeoplePanel
                            key={organizationId}
                            org={org}
                            portal={portal}
                            organizationId={organizationId}
                            displayName={displayName}
                          />
                        </AdminDetailTabPanel>
                      ) : null}
                      <AdminDetailTabPanel value="linked-records" preserveMount>
                        <OrganizationLinkedRecordsPanel
                          key={organizationId}
                          portal={portal}
                          organizationId={organizationId}
                        />
                      </AdminDetailTabPanel>
                      {canViewAcceptances ? (
                        <AdminDetailTabPanel value="acceptances" preserveMount>
                          <OrganizationLegalAcceptancesPanel
                            key={organizationId}
                            portal={portal}
                            organizationId={organizationId}
                          />
                        </AdminDetailTabPanel>
                      ) : null}
                      <AdminDetailTabPanel value="activity" preserveMount>
                        {portal === "investor" ? (
                          <div className="space-y-6">
                            <OrganizationWalletActivityPanel
                              key={`${organizationId}-wallet`}
                              organizationId={organizationId}
                            />
                            <OrganizationActivityTimeline
                              key={`${organizationId}-onboarding`}
                              organizationId={organizationId}
                              variant="panel"
                              title="Onboarding activity"
                            />
                          </div>
                        ) : (
                          <OrganizationActivityTimeline
                            key={organizationId}
                            organizationId={organizationId}
                            variant="panel"
                          />
                        )}
                      </AdminDetailTabPanel>
                    </AdminDetailTabs>
                  }
                >
                  {org.kycResponse ? <OrganizationKycResponseCard data={org.kycResponse} /> : null}
                  <OrganizationIssuerCtosReportsCard
                    organizationId={organizationId}
                    portal={portal}
                  />
                  <OrganizationQuickLinksCard org={org} />
                </AdminRelatedRecordsRail>
              </div>
            ) : null}
          </div>
        </div>

        <AlertDialog open={showSophisticatedDialog} onOpenChange={setShowSophisticatedDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {pendingSophisticatedStatus
                  ? "Mark as Sophisticated Investor"
                  : "Remove Sophisticated Investor Status"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {pendingSophisticatedStatus
                  ? "Please provide a reason for granting sophisticated investor status to this organization."
                  : "Please provide a reason for removing sophisticated investor status from this organization."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <Label htmlFor="sophisticated-reason" className="text-ui font-medium">
                Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="sophisticated-reason"
                placeholder={
                  pendingSophisticatedStatus
                    ? "e.g., Manual verification of net assets exceeding RM3,000,000"
                    : "e.g., Re-evaluation of investor classification"
                }
                value={sophisticatedReason}
                onChange={(event) => setSophisticatedReason(event.target.value)}
                className="mt-2"
                rows={3}
              />
              {sophisticatedReason.trim() === "" ? (
                <p className="mt-1 text-meta text-muted-foreground">Reason is required to proceed.</p>
              ) : null}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleCancelSophisticatedChange}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmSophisticatedChange}
                disabled={!sophisticatedReason.trim() || updateSophisticatedMutation.isPending}
              >
                {updateSophisticatedMutation.isPending ? "Updating..." : "Confirm"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    </RequirePermission>
  );
}
