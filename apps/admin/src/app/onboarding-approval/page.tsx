"use client";

import * as React from "react";
import { AdminPageHeader } from "../../components/admin-page-header";
import { OnboardingQueueTable } from "../../components/onboarding-queue-table";
import { ListToolbar, ListToolbarFilterTrigger, type FilterChip } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
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

  const appliedFilters: FilterChip[] = [];
  if (portalFilter !== "all") {
    appliedFilters.push({
      id: "portal",
      label: `Portal: ${portalFilter === "investor" ? "Investor" : "Issuer"}`,
      onRemove: () => {
        setPortalFilter("all");
        setCurrentPage(1);
      },
    });
  }
  if (typeFilter !== "all") {
    appliedFilters.push({
      id: "type",
      label: `Type: ${typeFilter === "PERSONAL" ? "Personal" : "Company"}`,
      onRemove: () => {
        setTypeFilter("all");
        setCurrentPage(1);
      },
    });
  }
  if (hasStatusFilter) {
    appliedFilters.push({
      id: "status",
      label: `Status: ${STATUS_OPTIONS.find((option) => option.value === statusFilter)?.label ?? statusFilter}`,
      onRemove: () => handleStatusChange("ALL"),
    });
  }

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

            <ListToolbar
              searchValue={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Search by name, email, or company..."
              appliedFilters={appliedFilters}
              onClearFilters={hasFilters ? handleClearFilters : undefined}
              onReload={handleReload}
              isLoading={isLoading || isFetching}
              countLabel={`${totalApplications} ${
                totalApplications === 1 ? "application" : "applications"
              }`}
              filterGroups={
                <>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <ListToolbarFilterTrigger
                        label="Portal"
                        count={portalFilter !== "all" ? 1 : 0}
                      />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuLabel>Portal</DropdownMenuLabel>
                      <DropdownMenuRadioGroup
                        value={portalFilter}
                        onValueChange={(value) => {
                          setPortalFilter(value as PortalFilter);
                          setCurrentPage(1);
                        }}
                      >
                        <DropdownMenuRadioItem value="all">All portals</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="investor">Investor</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="issuer">Issuer</DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <ListToolbarFilterTrigger label="Type" count={typeFilter !== "all" ? 1 : 0} />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuLabel>Onboarding type</DropdownMenuLabel>
                      <DropdownMenuRadioGroup
                        value={typeFilter}
                        onValueChange={(value) => {
                          setTypeFilter(value as TypeFilter);
                          setCurrentPage(1);
                        }}
                      >
                        <DropdownMenuRadioItem value="all">All types</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="PERSONAL">Personal</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="COMPANY">Company</DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <ListToolbarFilterTrigger label="Status" count={hasStatusFilter ? 1 : 0} />
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
                </>
              }
            />

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
