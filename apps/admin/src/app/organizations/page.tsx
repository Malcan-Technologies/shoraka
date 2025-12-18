"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SidebarTrigger } from "../../components/ui/sidebar";
import { Separator } from "../../components/ui/separator";
import { SystemHealthIndicator } from "../../components/system-health-indicator";
import { OrganizationsTable } from "../../components/organizations-table";
import { OrganizationsTableToolbar } from "../../components/organizations-table-toolbar";
import { useOrganizations } from "../../hooks/use-organizations";
import type {
  GetOrganizationsParams,
  PortalType,
  OrganizationTypeEnum,
  OnboardingStatusEnum,
} from "@cashsouk/types";

export default function OrganizationsPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [portalFilter, setPortalFilter] = React.useState("all");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [onboardingStatusFilter, setOnboardingStatusFilter] = React.useState("all");
  const [currentPage, setCurrentPage] = React.useState(1);
  const pageSize = 10;

  // Build API params from filters
  const apiParams = React.useMemo(() => {
    const params: GetOrganizationsParams = {
      page: currentPage,
      pageSize,
    };

    if (searchQuery) {
      params.search = searchQuery;
    }

    if (portalFilter !== "all") {
      params.portal = portalFilter as PortalType;
    }

    if (typeFilter !== "all") {
      params.type = typeFilter as OrganizationTypeEnum;
    }

    if (onboardingStatusFilter !== "all") {
      params.onboardingStatus = onboardingStatusFilter as OnboardingStatusEnum;
    }

    return params;
  }, [currentPage, pageSize, searchQuery, portalFilter, typeFilter, onboardingStatusFilter]);

  const { data, isLoading, error } = useOrganizations(apiParams);

  const handleReload = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "organizations"] });
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setPortalFilter("all");
    setTypeFilter("all");
    setOnboardingStatusFilter("all");
    setCurrentPage(1);
  };

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, portalFilter, typeFilter, onboardingStatusFilter]);

  const organizations = data?.organizations || [];
  const totalOrganizations = data?.pagination.totalCount || 0;
  const loading = isLoading;

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-lg font-semibold">Organizations</h1>
        <div className="ml-auto">
          <SystemHealthIndicator />
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="max-w-7xl mx-auto w-full px-2 md:px-4 py-8 space-y-6">
          <OrganizationsTableToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            portalFilter={portalFilter}
            onPortalFilterChange={setPortalFilter}
            typeFilter={typeFilter}
            onTypeFilterChange={setTypeFilter}
            onboardingStatusFilter={onboardingStatusFilter}
            onOnboardingStatusFilterChange={setOnboardingStatusFilter}
            totalCount={totalOrganizations}
            filteredCount={totalOrganizations}
            onClearFilters={handleClearFilters}
            onReload={handleReload}
            isLoading={isLoading}
          />

          {error && (
            <div className="text-center py-8 text-destructive">
              Error loading organizations:{" "}
              {error instanceof Error ? error.message : "Unknown error"}
            </div>
          )}

          <OrganizationsTable
            organizations={organizations}
            loading={loading}
            currentPage={currentPage}
            pageSize={pageSize}
            totalOrganizations={totalOrganizations}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>
    </>
  );
}

