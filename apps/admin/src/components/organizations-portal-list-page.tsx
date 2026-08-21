"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import type {
  GetOrganizationsParams,
  OnboardingStatusEnum,
  OrganizationTypeEnum,
  PortalType,
} from "@cashsouk/types";
import { OrganizationsTable } from "./organizations-table";
import { OrganizationsTableToolbar } from "./organizations-table-toolbar";
import { AdminPageHeader } from "./admin-page-header";
import { useOrganizations } from "../hooks/use-organizations";
import { usePermissions } from "../hooks/use-permissions";

const PAGE_COPY: Record<PortalType, { title: string; description: string; errorNoun: string }> = {
  issuer: {
    title: "Issuers",
    description: "Browse issuer records, onboarding status, and membership.",
    errorNoun: "issuers",
  },
  investor: {
    title: "Investors",
    description: "Browse investor records, onboarding status, and membership.",
    errorNoun: "investors",
  },
};

export function OrganizationsPortalListPage({ portal }: { portal: PortalType }) {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canView = can("organizations.view");
  const copy = PAGE_COPY[portal];
  const [searchQuery, setSearchQuery] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [onboardingStatusFilter, setOnboardingStatusFilter] = React.useState("COMPLETED");
  const [currentPage, setCurrentPage] = React.useState(1);
  const pageSize = 20;

  const apiParams = React.useMemo((): GetOrganizationsParams => {
    const params: GetOrganizationsParams = {
      page: currentPage,
      pageSize,
      portal,
    };

    if (searchQuery) {
      params.search = searchQuery;
    }

    if (typeFilter !== "all") {
      params.type = typeFilter as OrganizationTypeEnum;
    }

    if (onboardingStatusFilter !== "all") {
      params.onboardingStatus = onboardingStatusFilter as OnboardingStatusEnum;
    }

    return params;
  }, [currentPage, pageSize, portal, searchQuery, typeFilter, onboardingStatusFilter]);

  const { data, isLoading, error } = useOrganizations(apiParams, { enabled: canView });

  const handleReload = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "organizations"] });
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setTypeFilter("all");
    setOnboardingStatusFilter("all");
    setCurrentPage(1);
  };

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, typeFilter, onboardingStatusFilter]);

  const organizations = data?.organizations || [];
  const totalOrganizations = data?.pagination.totalCount || 0;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="w-full space-y-6 px-2 py-8 md:px-4">
        <AdminPageHeader title={copy.title} description={copy.description} />
        <OrganizationsTableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          onboardingStatusFilter={onboardingStatusFilter}
          onOnboardingStatusFilterChange={setOnboardingStatusFilter}
          totalCount={totalOrganizations}
          filteredCount={totalOrganizations}
          onClearFilters={handleClearFilters}
          onRefresh={handleReload}
          isLoading={isLoading}
        />

        {error ? (
          <div className="py-8 text-center text-destructive">
            Error loading {copy.errorNoun}: {error instanceof Error ? error.message : "Unknown error"}
          </div>
        ) : null}

        <OrganizationsTable
          portal={portal}
          organizations={organizations}
          loading={isLoading}
          currentPage={currentPage}
          pageSize={pageSize}
          totalOrganizations={totalOrganizations}
          onPageChange={setCurrentPage}
        />
      </div>
    </div>
  );
}
