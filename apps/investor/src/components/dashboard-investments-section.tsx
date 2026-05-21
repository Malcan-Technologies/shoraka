"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useInvestorInvestments } from "@/investments/hooks/use-marketplace-notes";
import { ONBOARDING_INDUSTRY_OPTIONS } from "@/investments/industry-filter-options";
import { sortInvestorInvestments } from "@/investments/sort-investments";
import { InvestmentPositionCard } from "@/investments/components/investment-position-card";
import { cn } from "@/lib/utils";
import {
  resolveNetExpectedReturnRatePercent,
  SOUKSCORE_RISK_RATING_GRADES,
  type NoteListItem,
} from "@cashsouk/types";
import { getNoteDerivedStatusLabel } from "@cashsouk/ui";

export function DashboardInvestmentsSection() {
  return <InvestorInvestmentsList limit={3} showViewAllButton />;
}

type InvestorInvestmentsListProps = {
  limit?: number;
  showViewAllButton?: boolean;
  showStatusFilter?: boolean;
};

const INVESTMENTS_PAGE_SIZE = 10;

function resolveTenorDaysLeft(maturityDate?: string | null): number | null {
  if (!maturityDate) return null;
  const target = new Date(maturityDate);
  if (Number.isNaN(target.getTime())) return null;
  const millisRemaining = target.getTime() - Date.now();
  return Math.max(1, Math.ceil(millisRemaining / (1000 * 60 * 60 * 24)));
}

function matchesInvestmentsSearch(note: NoteListItem, query: string): boolean {
  if (query.length === 0) return true;
  const haystacks = [
    note.noteReference,
    note.title,
    note.productName ?? "",
    note.issuerName ?? "",
    note.issuerIndustry ?? "",
    note.productCategory ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return haystacks.includes(query);
}

export function InvestorInvestmentsList({
  limit,
  showViewAllButton = false,
  showStatusFilter = false,
}: InvestorInvestmentsListProps) {
  const { data, isLoading, error, refetch } = useInvestorInvestments();
  const notes = useMemo(() => data?.notes ?? [], [data?.notes]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [industryFilter, setIndustryFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [profitFilter, setProfitFilter] = useState<string>("all");
  const [tenorFilter, setTenorFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [reloadSpin, setReloadSpin] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const isFirstDebouncedSearchPageReset = useRef(true);
  useEffect(() => {
    if (!showStatusFilter) return;
    if (isFirstDebouncedSearchPageReset.current) {
      isFirstDebouncedSearchPageReset.current = false;
      return;
    }
    setCurrentPage(1);
  }, [debouncedSearch, showStatusFilter]);

  const sortedNotes = useMemo(() => sortInvestorInvestments(notes, "most_relevant"), [notes]);

  const availableStatusLabels = useMemo(() => {
    const labels = new Set<string>();
    for (const note of sortedNotes) {
      labels.add(getNoteDerivedStatusLabel(note, { viewer: "investor" }));
    }
    return [...labels].sort((a, b) => a.localeCompare(b));
  }, [sortedNotes]);

  useEffect(() => {
    if (statusFilter === "all") return;
    if (!availableStatusLabels.includes(statusFilter)) {
      setStatusFilter("all");
      setCurrentPage(1);
    }
  }, [availableStatusLabels, statusFilter]);

  const normalizedSearch = debouncedSearch.trim().toLowerCase();

  const filteredNotes = useMemo(() => {
    return sortedNotes.filter((note) => {
      const matchesStatus =
        statusFilter === "all" ||
        getNoteDerivedStatusLabel(note, { viewer: "investor" }) === statusFilter;
      const matchesSearch = matchesInvestmentsSearch(note, normalizedSearch);
      const matchesIndustry =
        industryFilter === "all" || (note.issuerIndustry?.trim() ?? "") === industryFilter;
      const matchesRisk = riskFilter === "all" || (note.riskRating ?? "") === riskFilter;
      const annualReturn = resolveNetExpectedReturnRatePercent(note);
      const matchesProfit =
        profitFilter === "all" ||
        (annualReturn !== null &&
          ((profitFilter === "low" && annualReturn < 14) ||
            (profitFilter === "mid" && annualReturn >= 14 && annualReturn <= 15) ||
            (profitFilter === "high" && annualReturn > 15)));
      const tenorDays = resolveTenorDaysLeft(note.maturityDate);
      const matchesTenor =
        tenorFilter === "all" ||
        (tenorDays !== null &&
          ((tenorFilter === "short" && tenorDays <= 30) ||
            (tenorFilter === "medium" && tenorDays > 30 && tenorDays <= 45) ||
            (tenorFilter === "long" && tenorDays > 45)));

      return (
        matchesStatus &&
        matchesSearch &&
        matchesIndustry &&
        matchesRisk &&
        matchesProfit &&
        matchesTenor
      );
    });
  }, [
    industryFilter,
    normalizedSearch,
    profitFilter,
    riskFilter,
    sortedNotes,
    statusFilter,
    tenorFilter,
  ]);

  const isDashboardPreview = typeof limit === "number";
  const totalFiltered = filteredNotes.length;
  const totalPages =
    isDashboardPreview || totalFiltered === 0
      ? 0
      : Math.ceil(totalFiltered / INVESTMENTS_PAGE_SIZE);
  const effectivePage = totalPages === 0 ? 1 : Math.min(currentPage, totalPages);
  const sliceStart = (effectivePage - 1) * INVESTMENTS_PAGE_SIZE;

  const visibleNotes = useMemo(() => {
    if (isDashboardPreview) {
      return filteredNotes.slice(0, limit);
    }
    return filteredNotes.slice(sliceStart, sliceStart + INVESTMENTS_PAGE_SIZE);
  }, [filteredNotes, isDashboardPreview, limit, sliceStart]);

  const startIndex = totalFiltered === 0 ? 0 : sliceStart + 1;
  const endIndex = Math.min(sliceStart + INVESTMENTS_PAGE_SIZE, totalFiltered);

  const showPaginationFooter =
    !isDashboardPreview && !isLoading && !error && totalPages > 1 && totalFiltered > 0;

  const activeStatusFilterCount = statusFilter === "all" ? 0 : 1;
  const hasFilters =
    search.trim().length > 0 ||
    industryFilter !== "all" ||
    riskFilter !== "all" ||
    profitFilter !== "all" ||
    tenorFilter !== "all" ||
    activeStatusFilterCount > 0;

  function handleReload() {
    setReloadSpin(true);
    void refetch().finally(() => {
      setTimeout(() => setReloadSpin(false), 500);
    });
  }

  function handleClearFilters() {
    setSearch("");
    setDebouncedSearch("");
    setIndustryFilter("all");
    setRiskFilter("all");
    setProfitFilter("all");
    setTenorFilter("all");
    setStatusFilter("all");
    setCurrentPage(1);
  }

  return (
    <Card className="w-full">
      {!showStatusFilter ? (
        <CardHeader className="flex flex-col items-start justify-between gap-3 pb-2 sm:flex-row sm:items-center">
          <CardTitle className="text-xl font-semibold">Investments</CardTitle>
          <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center">
            {showViewAllButton ? (
              <Button asChild variant="outline" size="sm">
                <Link href="/investments" className="inline-flex items-center gap-2">
                  View all
                </Link>
              </Button>
            ) : null}
          </div>
        </CardHeader>
      ) : (
        <CardHeader className="space-y-4 pb-4 pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[200px] flex-1">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by note, product, issuer, or industry"
                className="h-11 rounded-xl pl-9"
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-11 gap-2 rounded-xl">
                  <FunnelIcon className="h-4 w-4" />
                  Status
                  {statusFilter !== "all" ? (
                    <Badge
                      variant="secondary"
                      className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary p-0 text-xs text-primary-foreground"
                    >
                      1
                    </Badge>
                  ) : null}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-[min(24rem,var(--radix-dropdown-menu-content-available-height))] w-80 overflow-y-auto">
                <DropdownMenuLabel>Status</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={statusFilter}
                  onValueChange={(value) => {
                    setStatusFilter(value);
                    setCurrentPage(1);
                  }}
                >
                  <DropdownMenuRadioItem value="all">All statuses</DropdownMenuRadioItem>
                  {availableStatusLabels.map((label) => (
                    <DropdownMenuRadioItem key={label} value={label}>
                      {label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-11 gap-2 rounded-xl">
                  <FunnelIcon className="h-4 w-4" />
                  Industry
                  {industryFilter !== "all" ? (
                    <Badge
                      variant="secondary"
                      className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary p-0 text-xs text-primary-foreground"
                    >
                      1
                    </Badge>
                  ) : null}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="max-h-[min(24rem,var(--radix-dropdown-menu-content-available-height))] w-80 overflow-y-auto"
              >
                <DropdownMenuLabel>Industry</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={industryFilter}
                  onValueChange={(value) => {
                    setIndustryFilter(value);
                    setCurrentPage(1);
                  }}
                >
                  <DropdownMenuRadioItem value="all">All industries</DropdownMenuRadioItem>
                  {ONBOARDING_INDUSTRY_OPTIONS.map((industry) => (
                    <DropdownMenuRadioItem key={industry} value={industry}>
                      {industry}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-11 gap-2 rounded-xl">
                  <FunnelIcon className="h-4 w-4" />
                  Risk score
                  {riskFilter !== "all" ? (
                    <Badge
                      variant="secondary"
                      className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary p-0 text-xs text-primary-foreground"
                    >
                      1
                    </Badge>
                  ) : null}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Risk score</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={riskFilter}
                  onValueChange={(value) => {
                    setRiskFilter(value);
                    setCurrentPage(1);
                  }}
                >
                  <DropdownMenuRadioItem value="all">All risk scores</DropdownMenuRadioItem>
                  {SOUKSCORE_RISK_RATING_GRADES.map((grade) => (
                    <DropdownMenuRadioItem key={grade} value={grade}>
                      {grade}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-11 gap-2 rounded-xl">
                  <FunnelIcon className="h-4 w-4" />
                  Profit
                  {profitFilter !== "all" ? (
                    <Badge
                      variant="secondary"
                      className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary p-0 text-xs text-primary-foreground"
                    >
                      1
                    </Badge>
                  ) : null}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Profit band</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={profitFilter}
                  onValueChange={(value) => {
                    setProfitFilter(value);
                    setCurrentPage(1);
                  }}
                >
                  <DropdownMenuRadioItem value="all">All profit bands</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="low">Below 14%</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="mid">14% - 15%</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="high">Above 15%</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-11 gap-2 rounded-xl">
                  <FunnelIcon className="h-4 w-4" />
                  Tenor
                  {tenorFilter !== "all" ? (
                    <Badge
                      variant="secondary"
                      className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary p-0 text-xs text-primary-foreground"
                    >
                      1
                    </Badge>
                  ) : null}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Tenor</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={tenorFilter}
                  onValueChange={(value) => {
                    setTenorFilter(value);
                    setCurrentPage(1);
                  }}
                >
                  <DropdownMenuRadioItem value="all">All tenors</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="short">Up to 30 days</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="medium">31 - 45 days</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="long">46+ days</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            {hasFilters ? (
              <Button variant="ghost" onClick={handleClearFilters} className="h-11 gap-2 rounded-xl">
                <XMarkIcon className="h-4 w-4" />
                Clear
              </Button>
            ) : null}
            <Button
              variant="outline"
              onClick={handleReload}
              disabled={isLoading || reloadSpin}
              className="h-11 gap-2 rounded-xl"
            >
              <ArrowPathIcon
                className={`h-4 w-4 ${isLoading || reloadSpin ? "animate-spin" : ""}`}
              />
              Reload
            </Button>
            <Badge
              variant="secondary"
              className="h-11 rounded-xl border-transparent bg-muted px-4 text-sm font-medium text-muted-foreground"
            >
              {totalFiltered} {totalFiltered === 1 ? "investment" : "investments"}
              {hasFilters ? ` of ${sortedNotes.length}` : null}
            </Badge>
          </div>
        </CardHeader>
      )}
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
            Loading your investments...
          </div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load investments."}
          </div>
        ) : null}

        {!isLoading && !error && notes.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center">
            <p className="text-[17px] leading-7 text-muted-foreground">
              You have not invested in any notes yet. Explore marketplace opportunities to start
              building your portfolio.
            </p>
          </div>
        ) : null}

        {!isLoading && !error ? (
          <div
            className={cn(
              showStatusFilter
                ? "grid grid-cols-1 gap-6 sm:gap-8 md:grid-cols-2 md:items-stretch"
                : "flex flex-col gap-3"
            )}
          >
            {visibleNotes.map((note) => (
              <InvestmentPositionCard
                key={note.id}
                note={note}
                className={cn(showStatusFilter && "h-full bg-muted/50")}
              />
            ))}
          </div>
        ) : null}

        {!isLoading && !error && notes.length > 0 && visibleNotes.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
            <p>No investments match your search and filters.</p>
            {hasFilters ? (
              <Button variant="link" className="mt-2" onClick={handleClearFilters}>
                Clear filters
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardContent>

      {showPaginationFooter ? (
        <div className="flex flex-col gap-3 border-t px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6">
          <div className="text-sm text-muted-foreground">
            Showing {startIndex}-{endIndex} of {totalFiltered}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.max(1, effectivePage - 1))}
              disabled={effectivePage <= 1}
              aria-label="Previous page"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </Button>
            <div className="text-sm font-medium">
              Page {effectivePage} of {totalPages}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.min(totalPages, effectivePage + 1))}
              disabled={effectivePage >= totalPages}
              aria-label="Next page"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
