"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import {
  Button,
  ChoiceChips,
  Input,
  ListToolbarFilterTrigger,
  SegmentedControl,
} from "@cashsouk/ui";
import {
  DEFAULT_MARKETPLACE_SORT,
  DEFAULT_MARKETPLACE_VIEW,
  MARKETPLACE_SORT_OPTIONS,
  MARKETPLACE_TENURE_FILTER_LABELS,
  MARC_SME_GRADES,
  marketplaceHasActiveFilters,
  marketplaceNoteMatchesFilters,
  marketplaceSectorOptions,
  parseMarketplaceSort,
  parseMarketplaceViewMode,
  sortFeaturedMarketplaceNotes,
  sortMarketplaceNotes,
  toMarketplaceNote,
  type MarketplaceSortId,
  type MarketplaceViewMode,
  type NoteListItem,
} from "@cashsouk/types";
import { MarketplaceCompareTable } from "./marketplace-compare-table";
import { MarketplaceFeaturedTrack } from "./marketplace-featured-track";
import { MarketplaceListingCard } from "./marketplace-listing-card";
import { marketplaceNotesCountLabel } from "./marketplace-note-display";

const MARKETPLACE_LISTINGS_PAGE_SIZE = 9;

const PROFIT_FILTER_VALUES = ["all", "low", "mid", "high"] as const;
type ProfitFilterValue = (typeof PROFIT_FILTER_VALUES)[number];

const GRADE_CHIP_OPTIONS = [
  { value: "all", label: "Any" },
  ...MARC_SME_GRADES.map((grade) => ({ value: grade, label: grade })),
];

const TENURE_CHIP_OPTIONS = [
  { value: "all", label: "Any" },
  { value: "short", label: MARKETPLACE_TENURE_FILTER_LABELS.short },
  { value: "medium", label: MARKETPLACE_TENURE_FILTER_LABELS.medium },
  { value: "long", label: MARKETPLACE_TENURE_FILTER_LABELS.long },
];

const PROFIT_CHIP_OPTIONS: ReadonlyArray<{ value: ProfitFilterValue; label: string }> = [
  { value: "all", label: "Any" },
  { value: "low", label: "Below 14%" },
  { value: "mid", label: "14% - 15%" },
  { value: "high", label: "Above 15%" },
];

const SORT_CONTROL_OPTIONS = MARKETPLACE_SORT_OPTIONS.map((option) => ({
  value: option.id,
  label: option.label,
}));

const VIEW_CONTROL_OPTIONS: ReadonlyArray<{ value: MarketplaceViewMode; label: string }> = [
  { value: "table", label: "List" },
  { value: "cards", label: "Cards" },
];

function parseIndustryParam(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "all") return "all";
  return trimmed;
}

function parseRiskParam(value: string | null | undefined): string {
  if (value && MARC_SME_GRADES.includes(value as (typeof MARC_SME_GRADES)[number])) {
    return value;
  }
  return "all";
}

function parseProfitParam(value: string | null | undefined): ProfitFilterValue {
  if (value && (PROFIT_FILTER_VALUES as readonly string[]).includes(value)) {
    return value as ProfitFilterValue;
  }
  return "all";
}

function parseTenorParam(value: string | null | undefined): string {
  if (value && ["short", "medium", "long"].includes(value)) return value;
  return "all";
}

function parsePageParam(value: string | null | undefined): number {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function marketplaceQueryString(input: {
  search: string;
  industry: string;
  risk: string;
  profit: string;
  tenor: string;
  page: number;
  sort: MarketplaceSortId;
  view: MarketplaceViewMode;
}) {
  const params = new URLSearchParams();
  const trimmedSearch = input.search.trim();
  if (trimmedSearch) params.set("q", trimmedSearch);
  if (input.industry !== "all") params.set("industry", input.industry);
  if (input.risk !== "all") params.set("risk", input.risk);
  if (input.profit !== "all") params.set("profit", input.profit);
  if (input.tenor !== "all") params.set("tenor", input.tenor);
  if (input.sort !== DEFAULT_MARKETPLACE_SORT) params.set("sort", input.sort);
  if (input.view !== DEFAULT_MARKETPLACE_VIEW) params.set("view", input.view);
  if (input.page > 1) params.set("page", String(input.page));
  return params.toString();
}

export type PublicMarketplaceBrowserProps = {
  notes: NoteListItem[];
  initialFilters?: {
    q?: string;
    industry?: string;
    risk?: string;
    profit?: string;
    tenor?: string;
    page?: number;
    sort?: string;
    view?: string;
  };
};

export function PublicMarketplaceBrowser({
  notes,
  initialFilters,
}: PublicMarketplaceBrowserProps) {
  const pathname = usePathname();
  const initialSearch = initialFilters?.q ?? "";
  const [search, setSearch] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [industryFilter, setIndustryFilter] = useState(parseIndustryParam(initialFilters?.industry));
  const [riskFilter, setRiskFilter] = useState(parseRiskParam(initialFilters?.risk));
  const [profitFilter, setProfitFilter] = useState(parseProfitParam(initialFilters?.profit));
  const [tenorFilter, setTenorFilter] = useState(parseTenorParam(initialFilters?.tenor));
  const [sort, setSort] = useState(parseMarketplaceSort(initialFilters?.sort));
  const [view, setView] = useState(parseMarketplaceViewMode(initialFilters?.view));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(Math.max(1, initialFilters?.page ?? 1));

  const marketplaceNotes = useMemo(() => notes.map((note) => toMarketplaceNote(note)), [notes]);
  const featuredNotes = useMemo(
    () => sortFeaturedMarketplaceNotes(marketplaceNotes.filter((note) => note.isFeatured)),
    [marketplaceNotes]
  );

  const normalizedSearchQuery = debouncedSearch.trim().toLowerCase();
  const effectiveFilters = useMemo(
    () => ({
      search: normalizedSearchQuery,
      industry: industryFilter,
      risk: riskFilter,
      profit: profitFilter,
      tenor: tenorFilter,
      listing: "open" as const,
    }),
    [industryFilter, normalizedSearchQuery, profitFilter, riskFilter, tenorFilter]
  );
  const hasActiveFilters = marketplaceHasActiveFilters(effectiveFilters);
  // Featured sits above the filters and is never constrained by them.
  // When search or filters are active, include featured notes in the listing so a
  // matching query can still find them; otherwise keep them out of the catalog to
  // avoid duplicating the strip above.
  const filteredNotes = useMemo(() => {
    const listingNotes = hasActiveFilters
      ? marketplaceNotes
      : marketplaceNotes.filter((note) => !note.isFeatured);
    return listingNotes.filter((note) => marketplaceNoteMatchesFilters(note, effectiveFilters));
  }, [effectiveFilters, hasActiveFilters, marketplaceNotes]);

  const sortedNotes = useMemo(
    () => sortMarketplaceNotes(filteredNotes, sort),
    [filteredNotes, sort]
  );

  const totalPages =
    sortedNotes.length === 0 ? 0 : Math.ceil(sortedNotes.length / MARKETPLACE_LISTINGS_PAGE_SIZE);
  const effectivePage = totalPages === 0 ? 1 : Math.min(currentPage, totalPages);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const query = marketplaceQueryString({
      search: debouncedSearch,
      industry: industryFilter,
      risk: riskFilter,
      profit: profitFilter,
      tenor: tenorFilter,
      page: effectivePage,
      sort,
      view,
    });
    const next = query ? `${pathname}?${query}` : pathname;
    const current = `${pathname}${window.location.search}`;
    if (current === next) return;
    window.history.replaceState(window.history.state, "", next);
  }, [
    debouncedSearch,
    effectivePage,
    industryFilter,
    pathname,
    profitFilter,
    riskFilter,
    sort,
    tenorFilter,
    view,
  ]);

  useEffect(() => {
    const applySearch = (params: URLSearchParams) => {
      const nextSearch = params.get("q") ?? "";
      setSearch(nextSearch);
      setDebouncedSearch(nextSearch.trim());
      setIndustryFilter(parseIndustryParam(params.get("industry")));
      setRiskFilter(parseRiskParam(params.get("risk")));
      setProfitFilter(parseProfitParam(params.get("profit")));
      setTenorFilter(parseTenorParam(params.get("tenor")));
      setSort(parseMarketplaceSort(params.get("sort")));
      setView(parseMarketplaceViewMode(params.get("view")));
      setCurrentPage(parsePageParam(params.get("page")));
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

  const handleProfitChange = (value: ProfitFilterValue) => {
    setProfitFilter(value);
    setCurrentPage(1);
  };

  const handleTenorChange = (value: string) => {
    setTenorFilter(value);
    setCurrentPage(1);
  };

  const handleSortChange = (value: MarketplaceSortId) => {
    setSort(value);
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

  const goToPreviousPage = () => {
    setCurrentPage(Math.max(1, effectivePage - 1));
  };

  const goToNextPage = () => {
    if (totalPages <= 0) {
      setCurrentPage(1);
      return;
    }
    setCurrentPage(Math.min(totalPages, effectivePage + 1));
  };
  const sliceStart = (effectivePage - 1) * MARKETPLACE_LISTINGS_PAGE_SIZE;
  const visibleNotes = sortedNotes.slice(sliceStart, sliceStart + MARKETPLACE_LISTINGS_PAGE_SIZE);
  const filteredListingsCount = sortedNotes.length;
  const listingRangeStart = filteredListingsCount === 0 ? 0 : sliceStart + 1;
  const listingRangeEnd = Math.min(
    sliceStart + MARKETPLACE_LISTINGS_PAGE_SIZE,
    filteredListingsCount
  );
  const catalogEmpty = marketplaceNotes.length === 0;
  const noFilterMatches = hasActiveFilters && !catalogEmpty && filteredListingsCount === 0;
  const chipFilterCount =
    (industryFilter !== "all" ? 1 : 0) +
    (riskFilter !== "all" ? 1 : 0) +
    (profitFilter !== "all" ? 1 : 0) +
    (tenorFilter !== "all" ? 1 : 0);
  const sectorChipOptions = useMemo(() => {
    const sectors = marketplaceSectorOptions(marketplaceNotes);
    if (industryFilter !== "all" && !sectors.includes(industryFilter)) {
      sectors.push(industryFilter);
    }
    return [
      { value: "all", label: "All sectors" },
      ...sectors.map((sector) => ({ value: sector, label: sector })),
    ];
  }, [industryFilter, marketplaceNotes]);

  return (
    <div className="space-y-11">
      {featuredNotes.length > 0 ? <MarketplaceFeaturedTrack notes={featuredNotes} /> : null}

      <section>
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h2 className="min-w-0 text-lg font-semibold tracking-tight text-foreground">
            All open notes
          </h2>
          <span className="shrink-0 text-ui tabular-nums text-muted-foreground">
            {marketplaceNotesCountLabel(filteredListingsCount)} available
          </span>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 sm:px-5">
          <div className="flex flex-col gap-3">
            <Input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by purpose, sector or note reference"
              aria-label="Search by purpose, sector or note reference"
              className="h-11 w-full min-w-0 rounded-xl border-border bg-muted/40 px-4 text-ui shadow-none"
            />
            <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
              <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                <span className="text-ui text-muted-foreground">Sort</span>
                <SegmentedControl
                  ariaLabel="Sort notes"
                  value={sort}
                  options={SORT_CONTROL_OPTIONS}
                  onChange={handleSortChange}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <SegmentedControl
                  ariaLabel="Marketplace view"
                  value={view}
                  options={VIEW_CONTROL_OPTIONS}
                  onChange={setView}
                />
                <ListToolbarFilterTrigger
                  label="Filters"
                  count={chipFilterCount}
                  aria-expanded={filtersOpen}
                  onClick={() => setFiltersOpen((open) => !open)}
                />
                <span className="hidden text-ui tabular-nums text-muted-foreground sm:inline">
                  {marketplaceNotesCountLabel(filteredListingsCount)}
                </span>
                {chipFilterCount > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-10 text-ui"
                    onClick={handleClearFilters}
                  >
                    Clear
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          {filtersOpen ? (
            <div className="mt-4 grid gap-5 border-t border-border pt-4 sm:flex sm:flex-wrap sm:items-end sm:gap-x-8 sm:gap-y-5">
              <ChoiceChips
                label="Grade"
                value={riskFilter}
                options={GRADE_CHIP_OPTIONS}
                onChange={handleRiskChange}
              />
              <ChoiceChips
                label="Tenure"
                value={tenorFilter}
                options={TENURE_CHIP_OPTIONS}
                onChange={handleTenorChange}
              />
              <ChoiceChips
                label="Profit"
                value={profitFilter}
                options={PROFIT_CHIP_OPTIONS}
                onChange={handleProfitChange}
              />
              <ChoiceChips
                label="Sector"
                value={industryFilter}
                options={sectorChipOptions}
                onChange={handleIndustryChange}
              />
            </div>
          ) : null}
        </div>

        <div className="mt-7">
          {catalogEmpty ? (
            <div className="rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground">
              <p>No marketplace notes are available right now.</p>
            </div>
          ) : noFilterMatches ? (
            <div className="rounded-2xl border border-border bg-card px-6 py-14 text-center">
              <p className="text-body font-semibold text-foreground">No notes match these filters</p>
              <p className="mt-2 text-ui text-muted-foreground">
                Widen the grade or tenure range, or clear the filters to see all open listings.
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-5 h-10 rounded-xl"
                onClick={handleClearFilters}
              >
                Clear filters
              </Button>
            </div>
          ) : view === "table" ? (
            <MarketplaceCompareTable notes={visibleNotes} />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:items-stretch xl:grid-cols-3">
              {visibleNotes.map((note) => (
                <MarketplaceListingCard key={note.id} note={note} />
              ))}
            </div>
          )}
        </div>

        {totalPages > 1 ? (
          <nav
            className="mt-4 flex flex-col gap-3 border-t border-border px-0 py-4 sm:flex-row sm:items-center sm:justify-between"
            aria-label="Listings pagination"
          >
            <div className="text-ui text-muted-foreground">
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
              <div className="text-ui font-medium">
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

        <p className="mt-5 max-w-3xl text-meta leading-relaxed text-muted-foreground">
          Grades follow the MARC SME scale. Profit rates are indicative and shown before fees;
          funding progress updates live. Capital is at risk — read the prospectus for each note
          before investing.
        </p>
      </section>
    </div>
  );
}
