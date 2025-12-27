"use client";

import * as React from "react";
import { SidebarTrigger } from "../../components/ui/sidebar";
import { Separator } from "../../components/ui/separator";
import { SystemHealthIndicator } from "../../components/system-health-indicator";
import { OnboardingQueueTable } from "../../components/onboarding-queue-table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import {
  useOnboardingApplications,
  useInvalidateOnboardingApplications,
} from "../../hooks/use-onboarding-applications";
import type { OnboardingApprovalStatus, PortalType, OrganizationTypeEnum } from "@cashsouk/types";

type PortalFilter = "all" | PortalType;
type TypeFilter = "all" | OrganizationTypeEnum;
type StatusFilter = "all" | OnboardingApprovalStatus;

export default function OnboardingApprovalPage() {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [portalFilter, setPortalFilter] = React.useState<PortalFilter>("all");
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [currentPage, setCurrentPage] = React.useState(1);
  const pageSize = 10;

  const invalidate = useInvalidateOnboardingApplications();

  // Debounce search query
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Build query params
  const queryParams = React.useMemo(
    () => ({
      page: currentPage,
      pageSize,
      search: debouncedSearch || undefined,
      portal: portalFilter !== "all" ? portalFilter : undefined,
      type: typeFilter !== "all" ? typeFilter : undefined,
      status: statusFilter !== "all" ? statusFilter : undefined,
    }),
    [currentPage, pageSize, debouncedSearch, portalFilter, typeFilter, statusFilter]
  );

  const { data, isLoading, isError, error, refetch, isFetching } =
    useOnboardingApplications(queryParams);

  const handleReload = () => {
    invalidate();
    refetch();
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setDebouncedSearch("");
    setPortalFilter("all");
    setTypeFilter("all");
    setStatusFilter("all");
    setCurrentPage(1);
  };

  const hasFilters =
    searchQuery !== "" || portalFilter !== "all" || typeFilter !== "all" || statusFilter !== "all";

  // Get applications data
  const applications = data?.applications || [];
  const totalApplications = data?.pagination?.totalCount || 0;

  // Count items requiring admin action (excludes PENDING_ONBOARDING which is user action)
  const pendingCount = applications.filter(
    (app) =>
      app.status === "PENDING_SSM_REVIEW" ||
      app.status === "PENDING_APPROVAL" ||
      app.status === "PENDING_AML"
  ).length;

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-lg font-semibold">Onboarding Approval</h1>
        {pendingCount > 0 && (
          <Badge variant="destructive" className="ml-2">
            {pendingCount} pending
          </Badge>
        )}
        <div className="ml-auto">
          <SystemHealthIndicator />
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="max-w-7xl mx-auto w-full px-2 md:px-4 py-8 space-y-6">
          {/* Description */}
          <div className="rounded-2xl border bg-card p-6">
            <h2 className="text-xl font-semibold mb-2">Onboarding Approval Queue</h2>
            <p className="text-muted-foreground text-[15px] leading-relaxed">
              Review and approve user onboarding applications. Personal applications go directly to
              RegTank for approval. Company applications require SSM verification on our side before
              proceeding to RegTank.
            </p>
          </div>

          {/* Error State */}
          {isError && (
            <div className="rounded-2xl border border-destructive/50 bg-destructive/5 p-6">
              <div className="flex items-center gap-3 text-destructive">
                <ExclamationTriangleIcon className="h-5 w-5" />
                <div>
                  <p className="font-medium">Failed to load applications</p>
                  <p className="text-sm text-muted-foreground">
                    {error instanceof Error ? error.message : "An unexpected error occurred"}
                  </p>
                </div>
              </div>
              <Button variant="outline" onClick={handleReload} className="mt-4">
                Try Again
              </Button>
            </div>
          )}

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or company..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-11 rounded-xl"
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 h-11 rounded-xl">
                  <FunnelIcon className="h-4 w-4" />
                  Portal
                  {portalFilter !== "all" && (
                    <Badge variant="secondary" className="ml-1">
                      1
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Portal</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={portalFilter}
                  onValueChange={(v) => {
                    setPortalFilter(v as PortalFilter);
                    setCurrentPage(1);
                  }}
                >
                  <DropdownMenuRadioItem value="all">All Portals</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="investor">Investor</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="issuer">Issuer</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 h-11 rounded-xl">
                  <FunnelIcon className="h-4 w-4" />
                  Type
                  {typeFilter !== "all" && (
                    <Badge variant="secondary" className="ml-1">
                      1
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Onboarding Type</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={typeFilter}
                  onValueChange={(v) => {
                    setTypeFilter(v as TypeFilter);
                    setCurrentPage(1);
                  }}
                >
                  <DropdownMenuRadioItem value="all">All Types</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="PERSONAL">Personal</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="COMPANY">Company</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 h-11 rounded-xl">
                  <FunnelIcon className="h-4 w-4" />
                  Status
                  {statusFilter !== "all" && (
                    <Badge variant="secondary" className="ml-1">
                      1
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Status</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={statusFilter}
                  onValueChange={(v) => {
                    setStatusFilter(v as StatusFilter);
                    setCurrentPage(1);
                  }}
                >
                  <DropdownMenuRadioItem value="all">All Statuses</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="PENDING_SSM_REVIEW">
                    Pending SSM Review
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="PENDING_ONBOARDING">
                    In Progress
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="PENDING_APPROVAL">
                    Pending Approval
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="PENDING_AML">Pending AML</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="APPROVED">Approved</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="REJECTED">Rejected</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="EXPIRED">Expired</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="CANCELLED">Cancelled</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            {hasFilters && (
              <Button
                variant="ghost"
                onClick={handleClearFilters}
                className="gap-2 h-11 rounded-xl"
              >
                <XMarkIcon className="h-4 w-4" />
                Clear
              </Button>
            )}

            <Button
              variant="outline"
              onClick={handleReload}
              disabled={isLoading || isFetching}
              className="gap-2 h-11 rounded-xl"
            >
              <ArrowPathIcon
                className={`h-4 w-4 ${isLoading || isFetching ? "animate-spin" : ""}`}
              />
              Reload
            </Button>

            <Badge variant="secondary" className="h-11 px-4 rounded-xl text-sm">
              {totalApplications} {totalApplications === 1 ? "application" : "applications"}
            </Badge>
          </div>

          {/* Queue Table */}
          <OnboardingQueueTable
            applications={applications}
            loading={isLoading}
            currentPage={currentPage}
            pageSize={pageSize}
            totalApplications={totalApplications}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>
    </>
  );
}
