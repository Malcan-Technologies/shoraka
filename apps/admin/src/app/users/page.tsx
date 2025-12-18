"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SidebarTrigger } from "../../components/ui/sidebar";
import { Separator } from "../../components/ui/separator";
import { SystemHealthIndicator } from "../../components/system-health-indicator";
import { UsersTable } from "../../components/users-table";
import { UsersTableToolbar } from "../../components/users-table-toolbar";
import { useUsers } from "../../hooks/use-users";
import type { GetUsersParams, UserRole } from "@cashsouk/types";

// Mock users removed - using API data

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState("all");
  const [investorOnboardedFilter, setInvestorOnboardedFilter] = React.useState("all");
  const [issuerOnboardedFilter, setIssuerOnboardedFilter] = React.useState("all");
  const [currentPage, setCurrentPage] = React.useState(1);
  const pageSize = 10;

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

  const { data, isLoading, error } = useUsers(apiParams);

  const handleReload = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
  };

  const handleUserUpdate = () => {
    // User updates are handled by mutations in the edit dialog
    // This function is kept for compatibility but doesn't need to do anything
    // as React Query will automatically refetch
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
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-lg font-semibold">Users</h1>
        <div className="ml-auto">
          <SystemHealthIndicator />
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="max-w-7xl mx-auto w-full px-2 md:px-4 py-8 space-y-6">
          <UsersTableToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            roleFilter={roleFilter}
            onRoleFilterChange={setRoleFilter}
            investorOnboardedFilter={investorOnboardedFilter}
            onInvestorOnboardedFilterChange={setInvestorOnboardedFilter}
            issuerOnboardedFilter={issuerOnboardedFilter}
            onIssuerOnboardedFilterChange={setIssuerOnboardedFilter}
            totalCount={totalUsers}
            filteredCount={totalUsers}
            onClearFilters={handleClearFilters}
            onReload={handleReload}
            isLoading={isLoading}
          />

          {error && (
            <div className="text-center py-8 text-destructive">
              Error loading users: {error instanceof Error ? error.message : "Unknown error"}
            </div>
          )}

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
            onUserUpdate={handleUserUpdate}
          />
        </div>
      </div>
    </>
  );
}

