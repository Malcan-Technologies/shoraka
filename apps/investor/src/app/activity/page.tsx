"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getDefaultActivityDomains,
  getFilterableActivityDomains,
  sameActivityDomainSet,
  type GetActivitiesParams,
} from "@cashsouk/types";
import { useOrganization } from "@cashsouk/config";
import {
  ActivityFeed,
  PageShell,
  portalPageGutterClassName,
  useHeader,
} from "@cashsouk/ui";
import { cn } from "@/lib/utils";
import { useActivities } from "../../hooks/use-activities";

const PAGE_SIZE = 10;

export default function ActivityPage() {
  const { setTitle } = useHeader();
  const { activeOrganization } = useOrganization();
  const onboardingComplete = activeOrganization?.onboardingStatus === "COMPLETED";
  const availableDomains = getFilterableActivityDomains("investor");
  const defaultDomains = useMemo(
    () => getDefaultActivityDomains("investor", { onboardingComplete }),
    [onboardingComplete]
  );

  useEffect(() => {
    setTitle("");
    return () => setTitle("");
  }, [setTitle]);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [domains, setDomains] = useState<NonNullable<GetActivitiesParams["domains"]>>(defaultDomains);
  const [dateRange, setDateRange] = useState("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setDomains(defaultDomains);
    setPage(1);
  }, [defaultDomains]);

  const apiDateRangeByUi: Record<string, GetActivitiesParams["dateRange"] | undefined> = {
    all: undefined,
    "24h": "24h",
    "7d": "7d",
    "30d": "30d",
  };

  const handleDomainsChange = useCallback((values: NonNullable<GetActivitiesParams["domains"]>) => {
    setDomains(values);
    setPage(1);
  }, []);

  const handleDateRangeChange = useCallback((value: string) => {
    setDateRange(value);
    setPage(1);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, refetch } = useActivities({
    page,
    limit: PAGE_SIZE,
    search: debouncedSearch || undefined,
    domains: domains.length > 0 ? domains : undefined,
    dateRange: apiDateRangeByUi[dateRange],
  });

  const pagination = data?.pagination;
  const hasActiveFilters =
    Boolean(debouncedSearch) ||
    dateRange !== "all" ||
    !sameActivityDomainSet(domains, defaultDomains);

  const handleClearFilters = () => {
    setSearch("");
    setDomains(defaultDomains);
    setDateRange("all");
    setPage(1);
  };

  return (
    <div className={cn(portalPageGutterClassName, "space-y-6")}>
      <PageShell
        title="Activity"
        description="Milestones across your onboarding and investments."
      >
        <ActivityFeed
          portal="investor"
          activities={data?.activities ?? []}
          isLoading={isLoading}
          searchQuery={search}
          onSearchChange={setSearch}
          availableDomains={availableDomains}
          domainFilters={domains}
          defaultDomains={defaultDomains}
          onDomainFiltersChange={handleDomainsChange}
          dateRangeFilter={dateRange}
          onDateRangeFilterChange={handleDateRangeChange}
          totalCount={pagination?.unfilteredTotal || 0}
          filteredCount={pagination?.total || 0}
          onClearFilters={handleClearFilters}
          onReload={() => refetch()}
          hasActiveFilters={hasActiveFilters}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </PageShell>
    </div>
  );
}
