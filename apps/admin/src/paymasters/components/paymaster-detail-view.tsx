"use client";

import { format } from "date-fns";
import { BuildingOffice2Icon } from "@heroicons/react/24/outline";
import { isPaymasterVerified } from "@cashsouk/types";
import { Skeleton, StatusBadge } from "@cashsouk/ui";
import {
  AdminDetailTabPanel,
  AdminDetailTabs,
  AdminEntityHeader,
  AdminEntitySummaryCard,
  AdminRelatedRecordsRail,
  useAdminDetailTabState,
  type AdminDetailTab,
} from "@/components/admin-detail";
import { usePermissions } from "@/hooks/use-permissions";
import { adminTabStatusLabel, getAdminStatusToken } from "@/lib/admin-status-token";
import { CopyableText } from "@/organizations/components/organization-profile-helpers";
import { PaymasterActivityPanel } from "@/paymasters/components/paymaster-activity-panel";
import { PaymasterIdentityCard } from "@/paymasters/components/paymaster-identity-card";
import { PaymasterLinkedRecordsPanel } from "@/paymasters/components/paymaster-linked-records-panel";
import { PaymasterNoticesCard } from "@/paymasters/components/paymaster-notices-card";
import { PaymasterVerificationCard } from "@/paymasters/components/paymaster-verification-card";
import { useAdminPaymasterDetail } from "@/paymasters/hooks/use-paymasters";
import {
  isPaymasterDetailTabId,
  paymasterIdentityTabStatus,
  type PaymasterDetailTabId,
} from "@/paymasters/utils/paymaster-detail-tabs";

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

export function PaymasterDetailView({ paymasterId }: { paymasterId: string }) {
  const { can } = usePermissions();
  const canManage = can("paymasters.manage");
  const { data, isLoading, error } = useAdminPaymasterDetail(paymasterId);

  const { activeTab, setActiveTab } = useAdminDetailTabState<PaymasterDetailTabId>({
    isValidTab: isPaymasterDetailTabId,
    computedTab: "identity",
  });
  const resolvedTab: PaymasterDetailTabId = activeTab ?? "identity";

  if (isLoading) return <PageSkeleton />;
  if (error || !data) {
    return (
      <p className="text-ui text-destructive">
        {error instanceof Error ? error.message : "Paymaster not found"}
      </p>
    );
  }

  const verified = isPaymasterVerified(data.verificationStatus);
  const identityTab = paymasterIdentityTabStatus(data.verificationStatus);
  const tabs: AdminDetailTab<PaymasterDetailTabId>[] = [
    {
      id: "identity",
      label: "Identity",
      statusToken: identityTab.statusToken,
      statusLabel: identityTab.statusLabel,
    },
    {
      id: "linked-records",
      label: "Linked records",
      statusToken: "neutral",
      statusLabel: adminTabStatusLabel("neutral"),
    },
    {
      id: "activity",
      label: "Activity",
      statusToken: "neutral",
      statusLabel: adminTabStatusLabel("neutral"),
    },
  ];

  return (
    <div className="space-y-6">
      <AdminEntityHeader
        variant="hero"
        tone={verified ? "success" : "action"}
        backHref="/paymasters"
        backLabel="Paymasters"
        eyebrow="Paymaster detail"
        title={data.legalName}
        subtitle={<span className="font-mono">{data.registrationNumber}</span>}
        icon={BuildingOffice2Icon}
        chips={
          <>
            <StatusBadge label="Paymaster" status="neutral" showDot={false} />
            {data.entityType ? (
              <StatusBadge label={data.entityType} status="submitted" showDot={false} />
            ) : null}
            <StatusBadge
              label={verified ? "Verified" : "Unverified"}
              status={getAdminStatusToken(data.verificationStatus)}
            />
          </>
        }
        summaryCards={[
          <AdminEntitySummaryCard
            key="issuers"
            label="Linked issuers"
            value={String(data.issuers.length)}
          />,
          <AdminEntitySummaryCard
            key="financings"
            label="Financings"
            value={String(data.financings.length)}
          />,
          <AdminEntitySummaryCard
            key="notices"
            label="Notices"
            value={String(data.notices.length)}
          />,
        ]}
        metrics={[
          { label: "Country", value: data.registrationCountry || "—" },
          {
            label: "SSM / registration",
            value: data.registrationNumber ? (
              <CopyableText
                value={data.registrationNumber}
                label="SSM / registration number"
                className="font-mono"
              />
            ) : (
              "—"
            ),
          },
          { label: "Created", value: format(new Date(data.createdAt), "dd MMM yyyy") },
        ]}
      />

      <AdminRelatedRecordsRail
        main={
          <AdminDetailTabs tabs={tabs} value={resolvedTab} onValueChange={setActiveTab}>
            <AdminDetailTabPanel value="identity" preserveMount>
              <PaymasterIdentityCard paymaster={data} />
            </AdminDetailTabPanel>
            <AdminDetailTabPanel value="linked-records" preserveMount>
              <PaymasterLinkedRecordsPanel paymaster={data} />
            </AdminDetailTabPanel>
            <AdminDetailTabPanel value="activity" preserveMount>
              <PaymasterActivityPanel paymasterId={data.id} legalName={data.legalName} />
            </AdminDetailTabPanel>
          </AdminDetailTabs>
        }
      >
        <PaymasterVerificationCard paymaster={data} canManage={canManage} />
        <PaymasterNoticesCard notices={data.notices} />
      </AdminRelatedRecordsRail>
    </div>
  );
}
