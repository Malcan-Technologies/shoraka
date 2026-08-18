"use client";

import * as React from "react";
import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from "@cashsouk/ui";
import type {
  GetOrganizationsParams,
  OnboardingStatusEnum,
  OrganizationTypeEnum,
} from "@cashsouk/types";
import { OrganizationsTable } from "../../components/organizations-table";
import { OrganizationsTableToolbar } from "../../components/organizations-table-toolbar";
import { RequirePermission } from "../../components/require-permission";
import { AdminPageHeader } from "../../components/admin-page-header";
import { useOrganizations } from "../../hooks/use-organizations";

const ORG_TABS = [
  { id: "issuer", label: "Issuers" },
  { id: "investor", label: "Investors" },
] as const;

type OrgTabId = (typeof ORG_TABS)[number]["id"];

function isOrgTabId(value: string | null): value is OrgTabId {
  return ORG_TABS.some((tab) => tab.id === value);
}

function OrganizationsPageFallback() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="w-full space-y-6 px-2 py-8 md:px-4">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    </div>
  );
}

function OrganizationsPageContent() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const requestedTab = searchParams.get("tab");
  const activeTab: OrgTabId = isOrgTabId(requestedTab) ? requestedTab : "issuer";

  React.useEffect(() => {
    if (requestedTab === activeTab) return;
    router.replace(`${pathname}?tab=${activeTab}`);
  }, [activeTab, requestedTab, pathname, router]);

  const [searchQuery, setSearchQuery] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [onboardingStatusFilter, setOnboardingStatusFilter] = React.useState("COMPLETED");
  const [investorPage, setInvestorPage] = React.useState(1);
  const [issuerPage, setIssuerPage] = React.useState(1);
  const pageSize = 20;

  const buildParams = React.useCallback(
    (portal: OrgTabId, page: number): GetOrganizationsParams => {
      const params: GetOrganizationsParams = {
        page,
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
    },
    [pageSize, searchQuery, typeFilter, onboardingStatusFilter]
  );

  const investorParams = React.useMemo(
    () => buildParams("investor", investorPage),
    [buildParams, investorPage]
  );
  const issuerParams = React.useMemo(
    () => buildParams("issuer", issuerPage),
    [buildParams, issuerPage]
  );

  const {
    data: investorData,
    isLoading: investorLoading,
    error: investorError,
  } = useOrganizations(investorParams);

  const {
    data: issuerData,
    isLoading: issuerLoading,
    error: issuerError,
  } = useOrganizations(issuerParams);

  const handleReload = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "organizations"] });
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setTypeFilter("all");
    setOnboardingStatusFilter("all");
    setInvestorPage(1);
    setIssuerPage(1);
  };

  React.useEffect(() => {
    setInvestorPage(1);
    setIssuerPage(1);
  }, [searchQuery, typeFilter, onboardingStatusFilter]);

  const handleTabChange = (value: string) => {
    if (!isOrgTabId(value)) return;
    router.replace(`${pathname}?tab=${value}`);
  };

  const investorOrganizations = investorData?.organizations || [];
  const totalInvestorOrganizations = investorData?.pagination.totalCount || 0;
  const issuerOrganizations = issuerData?.organizations || [];
  const totalIssuerOrganizations = issuerData?.pagination.totalCount || 0;

  const activeTotal =
    activeTab === "issuer" ? totalIssuerOrganizations : totalInvestorOrganizations;
  const activeLoading = activeTab === "issuer" ? issuerLoading : investorLoading;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="w-full space-y-6 px-2 py-8 md:px-4">
        <AdminPageHeader
          title="Organizations"
          description="Browse issuer and investor organizations, onboarding status, and membership."
        />
        <OrganizationsTableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          onboardingStatusFilter={onboardingStatusFilter}
          onOnboardingStatusFilterChange={setOnboardingStatusFilter}
          totalCount={activeTotal}
          filteredCount={activeTotal}
          onClearFilters={handleClearFilters}
          onRefresh={handleReload}
          isLoading={activeLoading}
        />

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="flex h-auto w-fit max-w-full flex-wrap justify-start">
            {ORG_TABS.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="issuer" className="mt-0 space-y-4">
            {issuerError ? (
              <div className="py-8 text-center text-destructive">
                Error loading issuer organizations:{" "}
                {issuerError instanceof Error ? issuerError.message : "Unknown error"}
              </div>
            ) : null}

            <OrganizationsTable
              portal="issuer"
              organizations={issuerOrganizations}
              loading={issuerLoading}
              currentPage={issuerPage}
              pageSize={pageSize}
              totalOrganizations={totalIssuerOrganizations}
              onPageChange={setIssuerPage}
            />
          </TabsContent>

          <TabsContent value="investor" className="mt-0 space-y-4">
            {investorError ? (
              <div className="py-8 text-center text-destructive">
                Error loading investor organizations:{" "}
                {investorError instanceof Error ? investorError.message : "Unknown error"}
              </div>
            ) : null}

            <OrganizationsTable
              portal="investor"
              organizations={investorOrganizations}
              loading={investorLoading}
              currentPage={investorPage}
              pageSize={pageSize}
              totalOrganizations={totalInvestorOrganizations}
              onPageChange={setInvestorPage}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default function OrganizationsPage() {
  return (
    <RequirePermission permission="organizations.view">
      <Suspense fallback={<OrganizationsPageFallback />}>
        <OrganizationsPageContent />
      </Suspense>
    </RequirePermission>
  );
}
