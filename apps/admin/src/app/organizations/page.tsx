"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SidebarTrigger } from "../../components/ui/sidebar";
import { Separator } from "../../components/ui/separator";
import { SystemHealthIndicator } from "../../components/system-health-indicator";
import { OrganizationsTable } from "../../components/organizations-table";
import { OrganizationsTableToolbar } from "../../components/organizations-table-toolbar";
import { useOrganizations } from "../../hooks/use-organizations";
import { Badge } from "../../components/ui/badge";
import {
  BanknotesIcon,
  BuildingOffice2Icon,
} from "@heroicons/react/24/outline";
import type {
  GetOrganizationsParams,
  OrganizationTypeEnum,
  OnboardingStatusEnum,
} from "@cashsouk/types";

export default function OrganizationsPage() {
  const queryClient = useQueryClient();
  
  // Shared filters for both tables
  const [searchQuery, setSearchQuery] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [onboardingStatusFilter, setOnboardingStatusFilter] = React.useState("COMPLETED");
  
  // Separate pagination for each table
  const [investorPage, setInvestorPage] = React.useState(1);
  const [issuerPage, setIssuerPage] = React.useState(1);
  const pageSize = 10;

  // Build API params for investor organizations
  const investorParams = React.useMemo(() => {
    const params: GetOrganizationsParams = {
      page: investorPage,
      pageSize,
      portal: "investor",
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
  }, [investorPage, pageSize, searchQuery, typeFilter, onboardingStatusFilter]);

  // Build API params for issuer organizations
  const issuerParams = React.useMemo(() => {
    const params: GetOrganizationsParams = {
      page: issuerPage,
      pageSize,
      portal: "issuer",
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
  }, [issuerPage, pageSize, searchQuery, typeFilter, onboardingStatusFilter]);

  const { 
    data: investorData, 
    isLoading: investorLoading, 
    error: investorError 
  } = useOrganizations(investorParams);

  const { 
    data: issuerData, 
    isLoading: issuerLoading, 
    error: issuerError 
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

  // Reset pagination when filters change
  React.useEffect(() => {
    setInvestorPage(1);
    setIssuerPage(1);
  }, [searchQuery, typeFilter, onboardingStatusFilter]);

  const investorOrganizations = investorData?.organizations || [];
  const totalInvestorOrganizations = investorData?.pagination.totalCount || 0;

  const issuerOrganizations = issuerData?.organizations || [];
  const totalIssuerOrganizations = issuerData?.pagination.totalCount || 0;

  const totalOrganizations = totalInvestorOrganizations + totalIssuerOrganizations;

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
        <div className="max-w-7xl mx-auto w-full px-2 md:px-4 py-8 space-y-8">
          {/* Shared Toolbar */}
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
            onReload={handleReload}
            isLoading={investorLoading || issuerLoading}
          />

          {/* Investor Organizations Section */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <BanknotesIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Investor Organizations</h2>
                <p className="text-sm text-muted-foreground">
                  Manage investor accounts and sophisticated investor classifications
                </p>
              </div>
              <Badge variant="secondary" className="ml-auto">
                {totalInvestorOrganizations} {totalInvestorOrganizations === 1 ? "organization" : "organizations"}
              </Badge>
            </div>

            {investorError && (
              <div className="text-center py-8 text-destructive">
                Error loading investor organizations:{" "}
                {investorError instanceof Error ? investorError.message : "Unknown error"}
              </div>
            )}

            <OrganizationsTable
              portal="investor"
              organizations={investorOrganizations}
              loading={investorLoading}
              currentPage={investorPage}
              pageSize={pageSize}
              totalOrganizations={totalInvestorOrganizations}
              onPageChange={setInvestorPage}
            />
          </section>

          {/* Issuer Organizations Section */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                <BuildingOffice2Icon className="h-5 w-5 text-accent" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Issuer Organizations</h2>
                <p className="text-sm text-muted-foreground">
                  Manage issuer accounts and business entities
                </p>
              </div>
              <Badge variant="secondary" className="ml-auto">
                {totalIssuerOrganizations} {totalIssuerOrganizations === 1 ? "organization" : "organizations"}
              </Badge>
            </div>

            {issuerError && (
              <div className="text-center py-8 text-destructive">
                Error loading issuer organizations:{" "}
                {issuerError instanceof Error ? issuerError.message : "Unknown error"}
              </div>
            )}

            <OrganizationsTable
              portal="issuer"
              organizations={issuerOrganizations}
              loading={issuerLoading}
              currentPage={issuerPage}
              pageSize={pageSize}
              totalOrganizations={totalIssuerOrganizations}
              onPageChange={setIssuerPage}
            />
          </section>
        </div>
      </div>
    </>
  );
}
