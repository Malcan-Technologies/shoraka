"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  ListToolbar,
  ListToolbarFilterTrigger,
  type FilterChip,
} from "@cashsouk/ui";
import {
  MARKETPLACE_TENURE_FILTER_LABELS,
  MARC_SME_GRADES,
  marketplaceNoteMatchesFilters,
  marketplaceTenureFilterLabel,
  sortFeaturedMarketplaceNotes,
  toMarketplaceNote,
  type NoteListItem,
} from "@cashsouk/types";
import {
  InvestmentListingCard,
  toInvestmentListingData,
} from "./investment-listing-card";
const ONBOARDING_INDUSTRY_OPTIONS = [
  "Agriculture, Forestry, Fishing",
  "Manufacturing",
  "Construction",
  "Wholesale / Retail Trade",
  "Transportation",
  "Hospitality",
  "Food & Beverage",
  "Information & Communication",
  "Technology (ICT)",
  "Insurance",
  "Legal Accounting",
  "Education",
  "Healthcare",
  "Real Estate",
  "Public Sector & Government",
  "Arts, Media & Entertainment",
  "Others",
] as const;

const FEATURED_MARKETPLACE_NOTES_LIMIT = 3;
const MARKETPLACE_LISTINGS_PAGE_SIZE = 9;

function marketplaceQueryString(input: {
  search: string;
  industry: string;
  risk: string;
  profit: string;
  tenor: string;
  page: number;
}) {
  const params = new URLSearchParams();
  const trimmedSearch = input.search.trim();
  if (trimmedSearch) params.set("q", trimmedSearch);
  if (input.industry !== "all") params.set("industry", input.industry);
  if (input.risk !== "all") params.set("risk", input.risk);
  if (input.profit !== "all") params.set("profit", input.profit);
  if (input.tenor !== "all") params.set("tenor", input.tenor);
  if (input.page > 1) params.set("page", String(input.page));
  return params.toString();
}

type PublicMarketplaceBrowserProps = {
  notes: NoteListItem[];
  initialFilters?: {
    q?: string;
    industry?: string;
    risk?: string;
    profit?: string;
    tenor?: string;
    page?: number;
  };
};

export function PublicMarketplaceBrowser({
  notes,
  initialFilters,
}: PublicMarketplaceBrowserProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isRefreshPending, startTransition] = useTransition();
  const initialSearch = initialFilters?.q ?? "";
  const initialIndustryParam = initialFilters?.industry;
  const initialRiskParam = initialFilters?.risk;
  const initialProfitParam = initialFilters?.profit;
  const initialTenorParam = initialFilters?.tenor;

  const initialIndustry =
    initialIndustryParam &&
    ONBOARDING_INDUSTRY_OPTIONS.includes(
      initialIndustryParam as (typeof ONBOARDING_INDUSTRY_OPTIONS)[number]
    )
      ? initialIndustryParam
      : "all";
  const initialRisk =
    initialRiskParam &&
    MARC_SME_GRADES.includes(
      initialRiskParam as (typeof MARC_SME_GRADES)[number]
    )
      ? initialRiskParam
      : "all";
  const initialProfit =
    initialProfitParam && ["low", "mid", "high"].includes(initialProfitParam)
      ? initialProfitParam
      : "all";
  const initialTenor =
    initialTenorParam && ["short", "medium", "long"].includes(initialTenorParam)
      ? initialTenorParam
      : "all";
  const initialPage = Math.max(1, initialFilters?.page ?? 1);

  const [search, setSearch] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [industryFilter, setIndustryFilter] = useState(initialIndustry);
  const [riskFilter, setRiskFilter] = useState(initialRisk);
  const [profitFilter, setProfitFilter] = useState(initialProfit);
  const [tenorFilter, setTenorFilter] = useState(initialTenor);
  const [currentPage, setCurrentPage] = useState(initialPage);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const isFirstDebouncedSearchPageReset = useRef(true);
  useEffect(() => {
    if (isFirstDebouncedSearchPageReset.current) {
      isFirstDebouncedSearchPageReset.current = false;
      return;
    }
    setCurrentPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    const query = marketplaceQueryString({
      search: debouncedSearch,
      industry: industryFilter,
      risk: riskFilter,
      profit: profitFilter,
      tenor: tenorFilter,
      page: currentPage,
    });
    const next = query ? `${pathname}?${query}` : pathname;
    const current = `${pathname}${window.location.search}`;
    if (current === next) return;
    window.history.replaceState(window.history.state, "", next);
  }, [
    currentPage,
    debouncedSearch,
    industryFilter,
    pathname,
    profitFilter,
    riskFilter,
    tenorFilter,
  ]);

  useEffect(() => {
    const applySearch = (params: URLSearchParams) => {
      const nextSearch = params.get("q") ?? "";
      const nextIndustry = params.get("industry") ?? "all";
      const nextRisk = params.get("risk") ?? "all";
      const nextProfit = params.get("profit") ?? "all";
      const nextTenor = params.get("tenor") ?? "all";
      const parsedPage = Number.parseInt(params.get("page") ?? "1", 10);
      setSearch(nextSearch);
      setDebouncedSearch(nextSearch.trim());
      setIndustryFilter(
        ONBOARDING_INDUSTRY_OPTIONS.includes(
          nextIndustry as (typeof ONBOARDING_INDUSTRY_OPTIONS)[number]
        )
          ? nextIndustry
          : "all"
      );
      setRiskFilter(
        MARC_SME_GRADES.includes(nextRisk as (typeof MARC_SME_GRADES)[number]) ? nextRisk : "all"
      );
      setProfitFilter(["low", "mid", "high"].includes(nextProfit) ? nextProfit : "all");
      setTenorFilter(["short", "medium", "long"].includes(nextTenor) ? nextTenor : "all");
      setCurrentPage(Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1);
    };

    const onPopState = () => applySearch(new URLSearchParams(window.location.search));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const handleIndustryChange = (value: string) => {
    setIndustryFilter(value);
    setCurrentPage(1);
  };

  const handleRiskChange = (value: string) => {
    setRiskFilter(value);
    setCurrentPage(1);
  };

  const handleProfitChange = (value: string) => {
    setProfitFilter(value);
    setCurrentPage(1);
  };

  const handleTenorChange = (value: string) => {
    setTenorFilter(value);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setIndustryFilter("all");
    setRiskFilter("all");
    setProfitFilter("all");
    setTenorFilter("all");
    setCurrentPage(1);
  };

  function handleReload() {
    startTransition(() => {
      router.refresh();
    });
  }

  const marketplaceNotes = useMemo(() => notes.map((note) => toMarketplaceNote(note)), [notes]);
  const nonFeaturedMarketplaceCount = useMemo(
    () => marketplaceNotes.filter((note) => !note.isFeatured).length,
    [marketplaceNotes]
  );

  const normalizedSearchQuery = debouncedSearch.trim().toLowerCase();

  const featuredNotes = useMemo(
    () => sortFeaturedMarketplaceNotes(marketplaceNotes.filter((note) => note.isFeatured)),
    [marketplaceNotes]
  );

  const filteredNotes = useMemo(() => {
    return marketplaceNotes
      .filter((note) => !note.isFeatured)
      .filter((note) =>
        marketplaceNoteMatchesFilters(note, {
          search: normalizedSearchQuery,
          industry: industryFilter,
          risk: riskFilter,
          profit: profitFilter,
          tenor: tenorFilter,
          listing: "open",
        })
      );
  }, [
    industryFilter,
    marketplaceNotes,
    normalizedSearchQuery,
    profitFilter,
    riskFilter,
    tenorFilter,
  ]);

  const totalPages =
    filteredNotes.length === 0
      ? 0
      : Math.ceil(filteredNotes.length / MARKETPLACE_LISTINGS_PAGE_SIZE);

  const goToPreviousPage = () => {
    setCurrentPage((page) => Math.max(1, page - 1));
  };

  const goToNextPage = () => {
    setCurrentPage((page) => {
      if (totalPages <= 0) return 1;
      return Math.min(totalPages, page + 1);
    });
  };

  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const effectivePage = totalPages === 0 ? 1 : Math.min(currentPage, totalPages);
  const sliceStart = (effectivePage - 1) * MARKETPLACE_LISTINGS_PAGE_SIZE;
  const visibleNotes = filteredNotes.slice(
    sliceStart,
    sliceStart + MARKETPLACE_LISTINGS_PAGE_SIZE
  );
  const filteredListingsCount = filteredNotes.length;
  const listingRangeStart = filteredListingsCount === 0 ? 0 : sliceStart + 1;
  const listingRangeEnd = Math.min(
    sliceStart + MARKETPLACE_LISTINGS_PAGE_SIZE,
    filteredListingsCount
  );
  const hasActiveFilters =
    search.trim().length > 0 ||
    industryFilter !== "all" ||
    riskFilter !== "all" ||
    profitFilter !== "all" ||
    tenorFilter !== "all";

  const appliedFilters = useMemo((): FilterChip[] => {
    const chips: FilterChip[] = [];
    if (industryFilter !== "all") {
      chips.push({
        id: "industry",
        label: `Industry: ${industryFilter}`,
        onRemove: () => handleIndustryChange("all"),
      });
    }
    if (riskFilter !== "all") {
      chips.push({
        id: "risk",
        label: `Risk: ${riskFilter}`,
        onRemove: () => handleRiskChange("all"),
      });
    }
    if (profitFilter !== "all") {
      const labels: Record<string, string> = {
        low: "Below 14%",
        mid: "14% - 15%",
        high: "Above 15%",
      };
      chips.push({
        id: "profit",
        label: `Profit: ${labels[profitFilter] ?? profitFilter}`,
        onRemove: () => handleProfitChange("all"),
      });
    }
    if (tenorFilter !== "all") {
      chips.push({
        id: "tenor",
        label: `Tenure: ${marketplaceTenureFilterLabel(tenorFilter) ?? tenorFilter}`,
        onRemove: () => handleTenorChange("all"),
      });
    }
    return chips;
  }, [industryFilter, profitFilter, riskFilter, tenorFilter]);

  return (
    <div className="space-y-8 md:space-y-10">
      {featuredNotes.length > 0 ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Featured investment opportunities
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Top picks curated for you</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 md:items-stretch">
            {featuredNotes.slice(0, FEATURED_MARKETPLACE_NOTES_LIMIT).map((note) => (
              <InvestmentListingCard
                key={note.id}
                data={toInvestmentListingData(note)}
                showProspectus
              />
            ))}
          </div>
        </section>
      ) : null}

      {filteredNotes.length > 0 || hasActiveFilters ? (
        <section className="space-y-4">
          <ListToolbar
            searchValue={search}
            onSearchChange={(value) => {
              setSearch(value);
              setCurrentPage(1);
            }}
            searchPlaceholder="Search by notes, industry, or reference"
            appliedFilters={appliedFilters}
            onClearFilters={hasActiveFilters ? handleClearFilters : undefined}
            onReload={handleReload}
            isLoading={isRefreshPending}
            countLabel={`${filteredListingsCount} ${
              filteredListingsCount === 1 ? "listing" : "listings"
            }${hasActiveFilters ? ` of ${nonFeaturedMarketplaceCount}` : ""}`}
            filterGroups={
              <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <ListToolbarFilterTrigger
                  label="Industry"
                  count={industryFilter !== "all" ? 1 : 0}
                  className="max-sm:px-3"
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="max-h-[min(24rem,var(--radix-dropdown-menu-content-available-height))] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto"
              >
                <DropdownMenuLabel>Industry</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={industryFilter} onValueChange={handleIndustryChange}>
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
                <ListToolbarFilterTrigger
                  label="Risk score"
                  count={riskFilter !== "all" ? 1 : 0}
                  className="max-sm:px-3"
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Risk score</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={riskFilter} onValueChange={handleRiskChange}>
                  <DropdownMenuRadioItem value="all">All risk scores</DropdownMenuRadioItem>
                  {MARC_SME_GRADES.map((grade) => (
                    <DropdownMenuRadioItem key={grade} value={grade}>
                      {grade}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <ListToolbarFilterTrigger
                  label="Profit"
                  count={profitFilter !== "all" ? 1 : 0}
                  className="max-sm:px-3"
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Profit band</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={profitFilter} onValueChange={handleProfitChange}>
                  <DropdownMenuRadioItem value="all">All profit bands</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="low">Below 14%</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="mid">14% - 15%</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="high">Above 15%</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <ListToolbarFilterTrigger
                  label="Tenure"
                  count={tenorFilter !== "all" ? 1 : 0}
                  className="max-sm:px-3"
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Tenure</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={tenorFilter} onValueChange={handleTenorChange}>
                  <DropdownMenuRadioItem value="all">Any tenure</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="short">
                    {MARKETPLACE_TENURE_FILTER_LABELS.short}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="medium">
                    {MARKETPLACE_TENURE_FILTER_LABELS.medium}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="long">
                    {MARKETPLACE_TENURE_FILTER_LABELS.long}
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
              </>
            }
          />

          {visibleNotes.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 md:items-stretch">
              {visibleNotes.map((note) => (
                <InvestmentListingCard
                  key={note.id}
                  data={toInvestmentListingData(note)}
                  showProspectus
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
              <p>No notes match your search and filters.</p>
              <Button variant="link" className="mt-2" onClick={handleClearFilters}>
                Clear filters
              </Button>
            </div>
          )}

          {totalPages > 1 ? (
            <nav
              className="flex flex-col gap-3 border-t px-0 py-4 sm:flex-row sm:items-center sm:justify-between"
              aria-label="Listings pagination"
            >
              <div className="text-sm text-muted-foreground">
                Showing {listingRangeStart}-{listingRangeEnd} of {filteredListingsCount}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={goToPreviousPage}
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
                  onClick={goToNextPage}
                  disabled={effectivePage >= totalPages}
                  aria-label="Next page"
                >
                  <ChevronRightIcon className="h-4 w-4" />
                </Button>
              </div>
            </nav>
          ) : null}
        </section>
      ) : null}

      {marketplaceNotes.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
          No marketplace notes are available right now.
        </div>
      ) : null}
    </div>
  );
}
