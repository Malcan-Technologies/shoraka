"use client";

import { useParams } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { UserIcon } from "@heroicons/react/24/outline";
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
import { RequirePermission } from "@/components/require-permission";
import { UserRoleBadges } from "@/components/user-role-badges";
import { useUserDetail } from "@/hooks/use-users";
import { usePermissions } from "@/hooks/use-permissions";
import { CopyableText } from "@/organizations/components/organization-profile-helpers";
import { UserAccountIdentityCard } from "./user-account-identity-card";
import { UserAccountOrganizationsPanel } from "./user-account-organizations-panel";
import { UserAccountProfilePanel } from "./user-account-profile-panel";
import {
  isUserAccountTabId,
  userAccountTabStatus,
  userOrganizationsTabStatus,
  type UserAccountTabId,
} from "@/accounts/utils/user-account-tabs";

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

export function UserAccountDetailPage() {
  const { can } = usePermissions();
  const canView = can("users.view");
  const params = useParams();
  const routeUserId = params.id as string;
  const { data: user, isLoading, error } = useUserDetail(routeUserId, { enabled: canView });

  const { activeTab, setActiveTab } = useAdminDetailTabState<UserAccountTabId>({
    isValidTab: isUserAccountTabId,
    computedTab: "account",
  });
  const resolvedTab: UserAccountTabId = activeTab ?? "account";

  const displayName = user
    ? `${user.first_name} ${user.last_name}`.trim() || user.email
    : "";
  const organizations = user
    ? [...user.organizations.investor, ...user.organizations.issuer]
    : [];
  const accountTab = userAccountTabStatus(user?.email_verified ?? false);
  const organizationsTab = userOrganizationsTabStatus(organizations);
  const tabs: AdminDetailTab<UserAccountTabId>[] = [
    {
      id: "account",
      label: "Account",
      statusToken: accountTab.statusToken,
      statusLabel: accountTab.statusLabel,
    },
    {
      id: "organizations",
      label: "Organizations",
      statusToken: organizationsTab.statusToken,
      statusLabel: organizationsTab.statusLabel,
    },
  ];

  return (
    <RequirePermission permission="users.view">
      <div className="flex-1 overflow-y-auto">
        <div className="w-full space-y-6 px-4 py-6 md:px-6 md:py-8 lg:px-8">
          {isLoading ? <PageSkeleton /> : null}

          {error ? (
            <div className="py-8 text-center text-destructive">
              Error loading user: {error instanceof Error ? error.message : "Unknown error"}
            </div>
          ) : null}

          {user ? (
            <div className="space-y-6">
              <AdminEntityHeader
                variant="hero"
                tone={user.email_verified ? "success" : "action"}
                backHref="/accounts"
                backLabel="User Accounts"
                eyebrow="Account detail"
                title={displayName}
                subtitle={
                  <>
                    <span className="font-mono">{user.user_id ?? "—"}</span>
                    {" · "}
                    {user.email}
                  </>
                }
                icon={UserIcon}
                chips={
                  <>
                    <StatusBadge
                      label={user.email_verified ? "Email verified" : "Email unverified"}
                      status={user.email_verified ? "success" : "action"}
                    />
                    <UserRoleBadges roles={user.roles} />
                  </>
                }
                summaryCards={[
                  <AdminEntitySummaryCard
                    key="investor-orgs"
                    label="Investor orgs"
                    value={user.stats.investorOrganizations}
                  />,
                  <AdminEntitySummaryCard
                    key="issuer-orgs"
                    label="Issuer orgs"
                    value={user.stats.issuerOrganizations}
                  />,
                  <AdminEntitySummaryCard
                    key="access-logs"
                    label="Access logs"
                    value={user.stats.accessLogs}
                  />,
                ]}
                metrics={[
                  {
                    label: "Phone",
                    value: user.phone?.trim() ? (
                      <CopyableText value={user.phone.trim()} label="Phone" truncate />
                    ) : (
                      "—"
                    ),
                  },
                  {
                    label: "Password changed",
                    value: user.password_changed_at
                      ? formatDistanceToNow(new Date(user.password_changed_at), {
                          addSuffix: true,
                        })
                      : "Never",
                  },
                  { label: "Created", value: format(new Date(user.created_at), "PPp") },
                  {
                    label: "Updated",
                    value: formatDistanceToNow(new Date(user.updated_at), { addSuffix: true }),
                  },
                ]}
              />

              <AdminRelatedRecordsRail
                main={
                  <AdminDetailTabs tabs={tabs} value={resolvedTab} onValueChange={setActiveTab}>
                    <AdminDetailTabPanel value="account" preserveMount>
                      <UserAccountProfilePanel user={user} routeUserId={routeUserId} />
                    </AdminDetailTabPanel>
                    <AdminDetailTabPanel value="organizations" preserveMount>
                      <UserAccountOrganizationsPanel user={user} />
                    </AdminDetailTabPanel>
                  </AdminDetailTabs>
                }
              >
                <UserAccountIdentityCard user={user} />
              </AdminRelatedRecordsRail>
            </div>
          ) : null}
        </div>
      </div>
    </RequirePermission>
  );
}
