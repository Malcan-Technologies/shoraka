"use client";

import { Tabs, TabsList, TabsTrigger } from "@cashsouk/ui";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { UsersTable } from "../../components/users-table";
import { UsersTableToolbar } from "../../components/users-table-toolbar";
import { useUsers } from "../../hooks/use-users";
import { RequirePermission } from "../../components/require-permission";
import { AdminPageHeader } from "../../components/admin-page-header";
import { usePermissions } from "../../hooks/use-permissions";
import type { GetUsersParams, UserRole } from "@cashsouk/types";

const ROLE_TABS = [
  { id: "all", label: "All" },
  { id: "ISSUER", label: "Issuer" },
  { id: "INVESTOR", label: "Investor" },
  { id: "ADMIN", label: "Admin" },
] as const;

type RoleTabId = (typeof ROLE_TABS)[number]["id"];

function isRoleTabId(value: string): value is RoleTabId {
  return ROLE_TABS.some((tab) => tab.id === value);
}

export default function UserAccountsPage() {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canView = can("users.view");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<RoleTabId>("all");
  const [investorOnboardedFilter, setInvestorOnboardedFilter] = React.useState("all");
  const [issuerOnboardedFilter, setIssuerOnboardedFilter] = React.useState("all");
  const [currentPage, setCurrentPage] = React.useState(1);
  const pageSize = 20;

  // Build API params from filters
  const apiParams = React.useMemo(() => {
    const params: GetUsersParams = {
      page: currentPage,
      pageSize,
    };

    if (searchQuery) {
      params.search = searchQuery;
    }

    if (roleFilter !== "all") {
      params.role = roleFilter as UserRole | undefined;
    }

    if (investorOnboardedFilter === "completed") {
      params.investorOnboarded = true;
    } else if (investorOnboardedFilter === "not_completed") {
      params.investorOnboarded = false;
    }

    if (issuerOnboardedFilter === "completed") {
      params.issuerOnboarded = true;
    } else if (issuerOnboardedFilter === "not_completed") {
      params.issuerOnboarded = false;
    }

    return params;
  }, [currentPage, pageSize, searchQuery, roleFilter, investorOnboardedFilter, issuerOnboardedFilter]);

  const { data, isLoading, error } = useUsers(apiParams, { enabled: canView });

  const handleReload = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setRoleFilter("all");
    setInvestorOnboardedFilter("all");
    setIssuerOnboardedFilter("all");
    setCurrentPage(1);
  };

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, roleFilter, investorOnboardedFilter, issuerOnboardedFilter]);

  const users = data?.users || [];
  const totalUsers = data?.pagination.totalCount || 0;
  const loading = isLoading;

  return (
    <RequirePermission permission="users.view">
      <>
            <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="w-full space-y-6 px-2 py-8 md:px-4">
          <AdminPageHeader
            title="User Accounts"
            description="Search and manage platform user accounts across investor, issuer, and admin roles."
          />
          <UsersTableToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            roleFilter={roleFilter}
            investorOnboardedFilter={investorOnboardedFilter}
            onInvestorOnboardedFilterChange={setInvestorOnboardedFilter}
            issuerOnboardedFilter={issuerOnboardedFilter}
            onIssuerOnboardedFilterChange={setIssuerOnboardedFilter}
            totalCount={totalUsers}
            filteredCount={totalUsers}
            onClearFilters={handleClearFilters}
            onRefresh={handleReload}
            isLoading={isLoading}
          />

          {error && (
            <div className="text-center py-8 text-destructive">
              Error loading user accounts: {error instanceof Error ? error.message : "Unknown error"}
            </div>
          )}

          <Tabs
            value={roleFilter}
            onValueChange={(value) => {
              if (isRoleTabId(value)) setRoleFilter(value);
            }}
          >
            <TabsList className="flex h-auto w-fit max-w-full flex-wrap justify-start">
              {ROLE_TABS.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <UsersTable
            users={users
              .filter((u) => u.user_id) // Filter out users without user_id
              .map((u) => ({
                ...u,
                user_id: u.user_id!, // Assert non-null since we filtered
                created_at: new Date(u.created_at),
                updated_at: new Date(u.updated_at),
                password_changed_at: u.password_changed_at ? new Date(u.password_changed_at) : null,
              }))}
            loading={loading}
            currentPage={currentPage}
            pageSize={pageSize}
            totalUsers={totalUsers}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>
      </>
    </RequirePermission>
  );
}

