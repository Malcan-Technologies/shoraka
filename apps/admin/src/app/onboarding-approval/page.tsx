"use client";

import * as React from "react";
import { AdminPageHeader } from "../../components/admin-page-header";
import { OnboardingQueueTable } from "../../components/onboarding-queue-table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
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
import { RequirePermission } from "../../components/require-permission";
import type {
  OnboardingApprovalStatusFilter,
  PortalType,
  OrganizationTypeEnum,
} from "@cashsouk/types";

type PortalFilter = "all" | PortalType;
type TypeFilter = "all" | OrganizationTypeEnum;
/** `ALL` is the empty filter; omit it from the API query. */
type StatusFilter = OnboardingApprovalStatusFilter | "ALL";

const STATUS_OPTIONS: { value: OnboardingApprovalStatusFilter; label: string }[] = [
  { value: "PENDING_ALL", label: "All pending" },
  { value: "PENDING_ONBOARDING", label: "In progress" },
  { value: "PENDING_SSM_REVIEW", label: "Pending SSM" },
  { value: "PENDING_APPROVAL", label: "Pending approval" },
  { value: "PENDING_AMENDMENT", label: "Amendment in progress" },
  { value: "PENDING_AML", label: "Pending AML" },
  { value: "PENDING_FINAL_APPROVAL", label: "Pending final approval" },
  { value: "COMPLETED", label: "Completed" },
  { value: "REJECTED", label: "Rejected" },
  { value: "EXPIRED", label: "Expired" },
  { value: "CANCELLED", label: "Cancelled" },
];

export default function OnboardingApprovalPage() {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [portalFilter, setPortalFilter] = React.useState<PortalFilter>("all");
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("PENDING_ALL");
  const [currentPage, setCurrentPage] = React.useState(1);
  const pageSize = 20;

  const invalidate = useInvalidateOnboardingApplications();

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const queryParams = React.useMemo(
    () => ({
      page: currentPage,
      pageSize,
      search: debouncedSearch || undefined,
      portal: portalFilter !== "all" ? portalFilter : undefined,
      type: typeFilter !== "all" ? typeFilter : undefined,
      status: statusFilter !== "ALL" ? statusFilter : undefined,
    }),
    [currentPage, pageSize, debouncedSearch, portalFilter, typeFilter, statusFilter]
  );

  const { data, isLoading, isError, error, refetch, isFetching } =
    useOnboardingApplications(queryParams);

  const handleReload = () => {
    invalidate();
    refetch();
  };

  const handleStatusChange = (value: StatusFilter) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setDebouncedSearch("");
    setPortalFilter("all");
    setTypeFilter("all");
    setStatusFilter("ALL");
    setCurrentPage(1);
  };

  const hasStatusFilter = statusFilter !== "ALL";
  const hasFilters =
    searchQuery !== "" ||
    portalFilter !== "all" ||
    typeFilter !== "all" ||
    hasStatusFilter;

  const applications = data?.applications || [];
  const totalApplications = data?.pagination?.totalCount || 0;

  return (
    <RequirePermission permission="onboarding.view">
      <>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="w-full space-y-6 px-2 py-8 md:px-4">
            <AdminPageHeader
              title="Onboarding Approval"
              description="Review investor and issuer onboarding. Personal applications complete RegTank first; company applications include SSM verification and AML screening before final approval."
            />

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

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[200px] flex-1">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or company..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-11 rounded-xl bg-card pl-9"
                />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-11 gap-2 rounded-xl bg-card">
                    <FunnelIcon className="h-4 w-4" />
                    Portal
                    {portalFilter !== "all" && (
                      <Badge
                        variant="secondary"
                        className="ml-1 flex h-5 w-5 items-center justify-center rounded-full p-0 text-xs bg-primary text-primary-foreground"
                      >
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
                  <Button variant="outline" className="h-11 gap-2 rounded-xl bg-card">
                    <FunnelIcon className="h-4 w-4" />
                    Type
                    {typeFilter !== "all" && (
                      <Badge
                        variant="secondary"
                        className="ml-1 flex h-5 w-5 items-center justify-center rounded-full p-0 text-xs bg-primary text-primary-foreground"
                      >
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
                  <Button variant="outline" className="h-11 gap-2 rounded-xl bg-card">
                    <FunnelIcon className="h-4 w-4" />
                    Status
                    {hasStatusFilter && (
                      <Badge
                        variant="secondary"
                        className="ml-1 flex h-5 w-5 items-center justify-center rounded-full p-0 text-xs bg-primary text-primary-foreground"
                      >
                        1
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Status</DropdownMenuLabel>
                  <DropdownMenuCheckboxItem
                    checked={statusFilter === "ALL"}
                    onCheckedChange={() => handleStatusChange("ALL")}
                  >
                    All statuses
                  </DropdownMenuCheckboxItem>
                  {STATUS_OPTIONS.map((option) => (
                    <DropdownMenuCheckboxItem
                      key={option.value}
                      checked={statusFilter === option.value}
                      onCheckedChange={() =>
                        handleStatusChange(statusFilter === option.value ? "ALL" : option.value)
                      }
                    >
                      {option.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {hasFilters && (
                <Button
                  variant="ghost"
                  onClick={handleClearFilters}
                  className="h-11 gap-2 rounded-xl"
                >
                  <XMarkIcon className="h-4 w-4" />
                  Clear
                </Button>
              )}

              <Button
                variant="outline"
                onClick={handleReload}
                disabled={isLoading || isFetching}
                className="h-11 gap-2 rounded-xl bg-card"
              >
                <ArrowPathIcon
                  className={`h-4 w-4 ${isLoading || isFetching ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>

              <Badge variant="secondary" className="h-11 rounded-xl px-4 text-sm">
                {totalApplications} {totalApplications === 1 ? "application" : "applications"}
              </Badge>
            </div>

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
    </RequirePermission>
  );
}
