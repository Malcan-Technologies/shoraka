"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  Input,
} from "@cashsouk/ui";
import {
  SOUKSCORE_RISK_RATING_GRADES,
  formatNoteReferenceDisplay,
  resolveNetExpectedReturnRatePercent,
  type NoteListItem,
} from "@cashsouk/types";
import { computeMarketplaceCommitBounds } from "@/lib/marketplace-commit-bounds";
import { resolveMarketplaceListingDaysLeft } from "@/lib/marketplace-listing-days";
import {
  PublicMarketplaceNoteCard,
  type PublicMarketplaceNote,
} from "./public-marketplace-note-card";
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

function toMarketplaceNote(note: NoteListItem): PublicMarketplaceNote {
  const { investable } = computeMarketplaceCommitBounds(note.targetAmount, note.fundedAmount);
  const tenorDays = resolveMarketplaceListingDaysLeft(note.listingClosesAt);

  return {
    id: note.id,
    noteCode: note.noteReference.trim() || null,
    issuerName: note.issuerName?.trim() || null,
    noteTitle: note.title?.trim() || null,
    productName: note.productName?.trim() || null,
    industry: note.issuerIndustry?.trim() || null,
    fundedAmount: note.fundedAmount,
    goalAmount: note.targetAmount,
    annualReturn: resolveNetExpectedReturnRatePercent(note),
    tenorDays,
    riskScore: note.riskRating,
    daysLeft: tenorDays,
    investable,
    isFeatured: note.featuredActive,
    featuredRank: note.featuredRank ?? undefined,
  };
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
    SOUKSCORE_RISK_RATING_GRADES.includes(
      initialRiskParam as (typeof SOUKSCORE_RISK_RATING_GRADES)[number]
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

  useEffect(() => {
    setSearch(initialSearch);
    setDebouncedSearch(initialSearch.trim());
  }, [initialSearch]);

  const isFirstDebouncedSearchPageReset = useRef(true);
  useEffect(() => {
    if (isFirstDebouncedSearchPageReset.current) {
      isFirstDebouncedSearchPageReset.current = false;
      return;
    }
    setCurrentPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    setIndustryFilter(initialIndustry);
    setRiskFilter(initialRisk);
    setProfitFilter(initialProfit);
    setTenorFilter(initialTenor);
  }, [initialIndustry, initialProfit, initialRisk, initialTenor]);

  useEffect(() => {
    setCurrentPage(initialPage);
  }, [initialPage]);

  useEffect(() => {
    const params = new URLSearchParams();
    const trimmedSearch = search.trim();
    if (trimmedSearch) params.set("q", trimmedSearch);
    if (industryFilter !== "all") params.set("industry", industryFilter);
    if (riskFilter !== "all") params.set("risk", riskFilter);
    if (profitFilter !== "all") params.set("profit", profitFilter);
    if (tenorFilter !== "all") params.set("tenor", tenorFilter);
    if (currentPage > 1) params.set("page", String(currentPage));

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [currentPage, industryFilter, pathname, profitFilter, riskFilter, router, search, tenorFilter]);

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
    () =>
      marketplaceNotes
        .filter((note) => note.isFeatured)
        .sort((left, right) => {
          const leftRank = left.featuredRank ?? Number.MAX_SAFE_INTEGER;
          const rightRank = right.featuredRank ?? Number.MAX_SAFE_INTEGER;
          if (leftRank !== rightRank) return leftRank - rightRank;
          return (left.noteCode ?? "").localeCompare(right.noteCode ?? "");
        }),
    [marketplaceNotes]
  );

  const filteredNotes = useMemo(() => {
    return marketplaceNotes.filter((note) => !note.isFeatured).filter((note) => {
      const matchesSearch =
        normalizedSearchQuery.length === 0 ||
        (note.noteTitle ?? "").toLowerCase().includes(normalizedSearchQuery) ||
        (note.productName ?? "").toLowerCase().includes(normalizedSearchQuery) ||
        (note.issuerName ?? "").toLowerCase().includes(normalizedSearchQuery) ||
        (note.industry ?? "").toLowerCase().includes(normalizedSearchQuery) ||
        (note.noteCode ?? "").toLowerCase().includes(normalizedSearchQuery) ||
        formatNoteReferenceDisplay(note.noteCode).toLowerCase().includes(normalizedSearchQuery);
      const matchesIndustry = industryFilter === "all" || note.industry === industryFilter;
      const matchesRisk =
        riskFilter === "all" ||
        (note.riskScore?.trim().toUpperCase() ?? "") === riskFilter;
      const matchesProfit =
        profitFilter === "all" ||
        (note.annualReturn !== null &&
          ((profitFilter === "low" && note.annualReturn < 14) ||
            (profitFilter === "mid" && note.annualReturn >= 14 && note.annualReturn <= 15) ||
            (profitFilter === "high" && note.annualReturn > 15)));
      const matchesTenor =
        tenorFilter === "all" ||
        (note.tenorDays !== null &&
          ((tenorFilter === "short" && note.tenorDays <= 30) ||
            (tenorFilter === "medium" && note.tenorDays > 30 && note.tenorDays <= 45) ||
            (tenorFilter === "long" && note.tenorDays > 45)));

      return (
        matchesSearch &&
        matchesIndustry &&
        matchesRisk &&
        matchesProfit &&
        matchesTenor
      );
    });
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

  return (
    <div className="space-y-8 md:space-y-10">
      {featuredNotes.length > 0 ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">
              Featured investment opportunities
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Top picks curated for you</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 md:items-stretch">
            {featuredNotes.slice(0, FEATURED_MARKETPLACE_NOTES_LIMIT).map((note) => (
              <PublicMarketplaceNoteCard key={note.id} note={note} />
            ))}
          </div>
        </section>
      ) : null}

      {filteredNotes.length > 0 || hasActiveFilters ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[200px] flex-1">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by notes, industry, or reference"
                className="h-11 rounded-xl pl-9"
              />
            </div>
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
                <DropdownMenuRadioGroup value={riskFilter} onValueChange={handleRiskChange}>
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
                <DropdownMenuRadioGroup value={tenorFilter} onValueChange={handleTenorChange}>
                  <DropdownMenuRadioItem value="all">All tenors</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="short">Up to 30 days</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="medium">31 - 45 days</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="long">46+ days</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            {hasActiveFilters ? (
              <Button variant="ghost" onClick={handleClearFilters} className="h-11 gap-2 rounded-xl">
                <XMarkIcon className="h-4 w-4" />
                Clear
              </Button>
            ) : null}

            <Button
              variant="outline"
              type="button"
              onClick={handleReload}
              disabled={isRefreshPending}
              className="h-11 gap-2 rounded-xl"
            >
              <ArrowPathIcon className={`h-4 w-4 ${isRefreshPending ? "animate-spin" : ""}`} />
              Reload
            </Button>

            <Badge
              variant="secondary"
              className="h-11 rounded-xl border-transparent bg-muted px-4 text-sm font-medium text-muted-foreground"
            >
              {filteredListingsCount}{" "}
              {filteredListingsCount === 1 ? "listing" : "listings"}
              {hasActiveFilters ? ` of ${nonFeaturedMarketplaceCount}` : null}
            </Badge>
          </div>

          {visibleNotes.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 md:items-stretch">
              {visibleNotes.map((note) => (
                <PublicMarketplaceNoteCard key={note.id} note={note} />
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
              className="flex flex-col gap-3 border-t px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6"
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
