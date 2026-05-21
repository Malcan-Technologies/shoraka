"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useOrganization } from "@cashsouk/config";
import { useHeader } from "@cashsouk/ui";
import {
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MarketplaceNote, NoteCard as MarketplaceMockNoteCard } from "@/components/marketplace/note-card";
import { InvestmentsDevBalanceTopup } from "./_components/investments-dev-balance-topup";
import { InvestorInvestmentsList } from "@/components/dashboard-investments-section";
import { computeMarketplaceCommitBounds } from "@/investments/marketplace-commit-bounds";
import {
  useCommitInvestment,
  useInvestorPortfolio,
  useMarketplaceNotes,
} from "@/investments/hooks/use-marketplace-notes";
import { ONBOARDING_INDUSTRY_OPTIONS } from "@/investments/industry-filter-options";
import {
  formatNoteReferenceDisplay,
  resolveNetExpectedReturnRatePercent,
  SOUKSCORE_RISK_RATING_GRADES,
  type NoteListItem,
} from "@cashsouk/types";

const MARKETPLACE_SECONDARY_BUTTON_CLASS =
  "bg-slate-100 text-slate-700 hover:bg-slate-200";

function resolveMarketplaceListingDaysLeft(listingClosesAt?: string | null): number | null {
  if (!listingClosesAt) return null;

  const target = new Date(listingClosesAt);
  if (Number.isNaN(target.getTime())) {
    return null;
  }

  const millisRemaining = target.getTime() - Date.now();
  return Math.max(0, Math.ceil(millisRemaining / (1000 * 60 * 60 * 24)));
}
const MARKETPLACE_LISTINGS_PAGE_SIZE = 9;

function parseMarketplaceListPageParam(value: string | null): number {
  if (!value) return 1;
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}

function currency(amount: number) {
  return `RM ${amount.toLocaleString("en-MY")}`;
}

function textOrDash(value?: string | null) {
  return value && value.trim().length > 0 ? value : "-";
}

function formatDefaultCommitAmount(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) return "0";
  if (amount >= 1000) {
    return amount.toLocaleString("en-MY", { maximumFractionDigits: 0 });
  }
  return amount.toLocaleString("en-MY", { maximumFractionDigits: 2 });
}

function toMarketplaceNote(note: NoteListItem): MarketplaceNote {
  const { minCommit, maxCommit, investable } = computeMarketplaceCommitBounds(
    note.targetAmount,
    note.fundedAmount
  );
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
    minInvestment: minCommit,
    maxInvestment: maxCommit,
    investable,
    isFeatured: note.featuredActive,
    featuredRank: note.featuredRank ?? undefined,
  };
}

export function MarketplacePage() {
  const { setTitle } = useHeader();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { activeOrganization } = useOrganization();
  const { data: portfolio } = useInvestorPortfolio();
  const commitInvestment = useCommitInvestment();
  const availableBalance = Number(portfolio?.availableBalance ?? 0);

  const initialSearch = searchParams.get("q") ?? "";
  const initialIndustryParam = searchParams.get("industry");
  const initialRiskParam = searchParams.get("risk");
  const initialProfitParam = searchParams.get("profit");
  const initialTenorParam = searchParams.get("tenor");

  const initialIndustry =
    initialIndustryParam && ONBOARDING_INDUSTRY_OPTIONS.includes(initialIndustryParam as (typeof ONBOARDING_INDUSTRY_OPTIONS)[number])
      ? initialIndustryParam
      : "all";
  const initialRisk =
    initialRiskParam && SOUKSCORE_RISK_RATING_GRADES.includes(initialRiskParam as (typeof SOUKSCORE_RISK_RATING_GRADES)[number])
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

  const pageFromUrl = parseMarketplaceListPageParam(searchParams.get("page"));

  const [search, setSearch] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [industryFilter, setIndustryFilter] = useState(initialIndustry);
  const [riskFilter, setRiskFilter] = useState(initialRisk);
  const [profitFilter, setProfitFilter] = useState(initialProfit);
  const [tenorFilter, setTenorFilter] = useState(initialTenor);
  const [currentPage, setCurrentPage] = useState(pageFromUrl);

  const [activeNote, setActiveNote] = useState<MarketplaceNote | null>(null);
  const [investmentAmount, setInvestmentAmount] = useState("10,000");
  const [agreedToTerms, setAgreedToTerms] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [reloadSpin, setReloadSpin] = useState(false);

  useEffect(() => {
    setTitle("Marketplace");
  }, [setTitle]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setCurrentPage(pageFromUrl);
  }, [pageFromUrl]);

  const isFirstDebouncedSearchPageReset = useRef(true);
  useEffect(() => {
    if (isFirstDebouncedSearchPageReset.current) {
      isFirstDebouncedSearchPageReset.current = false;
      return;
    }
    setCurrentPage(1);
  }, [debouncedSearch]);

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

  const {
    data: featuredData,
    isLoading: isFeaturedLoading,
    error: featuredError,
    refetch: refetchFeaturedNotes,
  } = useMarketplaceNotes({ page: 1, pageSize: 100, featuredOnly: true });
  const {
    data: listData,
    isLoading: isListLoading,
    error: listError,
    refetch: refetchMarketplaceList,
  } = useMarketplaceNotes({ page: 1, pageSize: 100 });

  const isLoading = isFeaturedLoading || isListLoading;
  const error = listError ?? featuredError;

  const marketplaceNotes = useMemo(
    () => (listData?.notes ?? []).map((note) => toMarketplaceNote(note)),
    [listData?.notes]
  );
  const nonFeaturedMarketplaceCount = useMemo(
    () => marketplaceNotes.filter((note) => !note.isFeatured).length,
    [marketplaceNotes]
  );
  const normalizedSearchQuery = debouncedSearch.trim().toLowerCase();

  const featuredNotes = useMemo(
    () =>
      (featuredData?.notes ?? [])
        .map((note) => toMarketplaceNote(note))
        .filter((note) => note.isFeatured)
        .sort((left, right) => {
          const leftRank = left.featuredRank ?? Number.MAX_SAFE_INTEGER;
          const rightRank = right.featuredRank ?? Number.MAX_SAFE_INTEGER;
          if (leftRank !== rightRank) return leftRank - rightRank;
          return (left.noteCode ?? "").localeCompare(right.noteCode ?? "");
        }),
    [featuredData?.notes]
  );
  const featuredPreviewNotes = featuredNotes.slice(0, 6);

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
      const matchesRisk = riskFilter === "all" || note.riskScore === riskFilter;
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
  }, [industryFilter, marketplaceNotes, normalizedSearchQuery, profitFilter, riskFilter, tenorFilter]);

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

  function handleClearFilters() {
    setSearch("");
    setDebouncedSearch("");
    setIndustryFilter("all");
    setRiskFilter("all");
    setProfitFilter("all");
    setTenorFilter("all");
    setCurrentPage(1);
  }

  function handleReload() {
    setReloadSpin(true);
    void Promise.all([refetchFeaturedNotes(), refetchMarketplaceList()]).finally(() => {
      setTimeout(() => setReloadSpin(false), 500);
    });
  }

  function handleIndustryChange(value: string) {
    setIndustryFilter(value);
    setCurrentPage(1);
  }

  function handleRiskChange(value: string) {
    setRiskFilter(value);
    setCurrentPage(1);
  }

  function handleProfitChange(value: string) {
    setProfitFilter(value);
    setCurrentPage(1);
  }

  function handleTenorChange(value: string) {
    setTenorFilter(value);
    setCurrentPage(1);
  }

  function openInvestDialog(note: MarketplaceNote) {
    if (!note.investable) return;
    setActiveNote(note);
    setInvestmentAmount(formatDefaultCommitAmount(note.minInvestment));
    setAgreedToTerms(true);
    setValidationError(null);
    setIsConfirmDialogOpen(false);
  }

  function closeInvestDialog() {
    setActiveNote(null);
    setValidationError(null);
    setIsConfirmDialogOpen(false);
  }

  function parseAmount(value: string) {
    return Number(value.replaceAll(",", "").replaceAll(" ", ""));
  }

  function handleInvestAction() {
    if (!activeNote) return;
    if (!activeNote.investable) {
      setValidationError("This note is fully allocated.");
      return;
    }

    const parsedAmount = parseAmount(investmentAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setValidationError("Please enter a valid investment amount.");
      return;
    }

    if (parsedAmount > availableBalance) {
      setValidationError("You have insufficient balance");
      return;
    }

    if (parsedAmount < activeNote.minInvestment || parsedAmount > activeNote.maxInvestment) {
      setValidationError(
        `Investment amount must be between ${currency(activeNote.minInvestment)} and ${currency(activeNote.maxInvestment)}.`
      );
      return;
    }

    setValidationError(null);
    setIsConfirmDialogOpen(true);
  }

  async function handleConfirmInvestment() {
    if (!activeNote) return;
    if (!activeNote.investable) {
      toast.error("This note is fully allocated.");
      return;
    }
    if (!activeOrganization?.id) {
      toast.error("Select an investor organization first");
      return;
    }
    const parsedAmount = parseAmount(investmentAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Invalid investment amount");
      return;
    }
    try {
      await commitInvestment.mutateAsync({
        noteId: activeNote.id,
        amount: parsedAmount,
        investorOrganizationId: activeOrganization.id,
      });
      toast.success("Investment committed");
      setIsConfirmDialogOpen(false);
      closeInvestDialog();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to commit investment");
    }
  }

  return (
    <div className="flex-1 bg-white p-4 md:p-8">
      <div className="w-full space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Investment Marketplace</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse published notes and commit funds from your investor pool.
          </p>
        </div>

        {error ? (
          <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load marketplace"}
          </div>
        ) : null}

        {isLoading ? (
          <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
            Loading marketplace...
          </div>
        ) : null}

        {!isLoading && !error ? (
          <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0 space-y-1.5">
                <p className="text-sm font-medium text-muted-foreground">Available balance</p>
                <p className="text-3xl font-semibold leading-none tracking-tight text-foreground tabular-nums sm:text-4xl">
                  {currency(availableBalance)}
                </p>
              </div>
              <div className="flex shrink-0 justify-end sm:justify-end">
                <InvestmentsDevBalanceTopup investorOrganizationId={activeOrganization?.id} />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[200px] flex-1">
                <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by investment notes, industry, or company"
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
                  <DropdownMenuRadioGroup
                    value={industryFilter}
                    onValueChange={(value) => handleIndustryChange(value)}
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
                    onValueChange={(value) => handleRiskChange(value)}
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
                    onValueChange={(value) => handleProfitChange(value)}
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
                    onValueChange={(value) => handleTenorChange(value)}
                  >
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
                {filteredListingsCount}{" "}
                {filteredListingsCount === 1 ? "listing" : "listings"}
                {hasActiveFilters ? ` of ${nonFeaturedMarketplaceCount}` : null}
              </Badge>
            </div>
          </div>
        ) : null}

        {!isLoading && featuredNotes.length > 0 ? (
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:p-6">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-foreground">Featured investment opportunities</h2>
              <p className="mt-1 text-sm text-muted-foreground">Top picks curated for you</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 md:items-stretch">
              {featuredPreviewNotes.map((note) => (
                <MarketplaceMockNoteCard key={note.id} note={note} onInvest={openInvestDialog} />
              ))}
            </div>
          </section>
        ) : null}

        {!isLoading && (marketplaceNotes.length > 0 || hasActiveFilters) ? (
        <section className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 md:items-stretch">
            {visibleNotes.map((note) => (
              <MarketplaceMockNoteCard key={note.id} note={note} onInvest={openInvestDialog} />
            ))}
          </div>

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

        {!isLoading && !error && marketplaceNotes.length === 0 && featuredNotes.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
            No marketplace notes are available right now.
          </div>
        ) : null}

        {!isLoading && !error && visibleNotes.length === 0 && hasActiveFilters ? (
          <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
            <p>No notes match your current search and filters.</p>
            <Button variant="link" className="mt-2" onClick={handleClearFilters}>
              Clear filters
            </Button>
          </div>
        ) : null}
      </div>

      <Dialog open={Boolean(activeNote)} onOpenChange={(open) => !open && closeInvestDialog()}>
        <DialogContent className="max-w-md rounded-xl border-slate-200 bg-white p-0">
          <DialogHeader className="space-y-3 border-b border-slate-200 px-4 pb-4 pt-5">
            <DialogTitle className="text-2xl font-semibold tracking-tight text-slate-900">
              {textOrDash(formatNoteReferenceDisplay(activeNote?.noteCode))}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="text-xs text-slate-500">
                {textOrDash(activeNote?.industry)} | Product: {textOrDash(activeNote?.productName)}
                {activeNote?.noteTitle?.trim() ? ` | ${activeNote.noteTitle.trim()}` : ""}
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-4 pb-4">
            <div className="space-y-2">
              <Label htmlFor="investment-amount" className="text-xs text-slate-900">
                Investment amount
              </Label>
              <Input
                id="investment-amount"
                value={`RM ${investmentAmount}`}
                onChange={(event) => {
                  const normalizedValue = event.target.value.replace("RM", "").trim();
                  setInvestmentAmount(normalizedValue);
                  if (validationError) setValidationError(null);
                }}
                className="h-9 rounded-lg border-slate-200 text-slate-700 focus-visible:ring-slate-300"
                aria-invalid={Boolean(validationError)}
              />
              {validationError ? (
                <p className="text-right text-xs text-destructive">{validationError}</p>
              ) : null}
            </div>

            <div className="flex items-start gap-2 pt-1">
              <Checkbox
                id="terms"
                checked={agreedToTerms}
                onCheckedChange={(checked) => setAgreedToTerms(Boolean(checked))}
                className="mt-0.5 border-slate-300 data-[state=checked]:border-slate-950 data-[state=checked]:bg-slate-950 data-[state=checked]:text-white"
              />
              <Label htmlFor="terms" className="text-xs font-normal text-slate-500">
                I agree to the{" "}
                <button type="button" className="text-slate-900 underline-offset-2 hover:underline">
                  Terms and Conditions
                </button>
              </Label>
            </div>

            <DialogFooter className="flex-row gap-2 border-t border-slate-200 pt-4 sm:justify-between sm:space-x-0">
              <Button
                type="button"
                variant="default"
                className={`h-9 flex-1 rounded-lg shadow-none ${MARKETPLACE_SECONDARY_BUTTON_CLASS}`}
                onClick={closeInvestDialog}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="action"
                className="h-9 flex-1 rounded-lg"
                onClick={handleInvestAction}
                disabled={!agreedToTerms || !activeNote?.investable}
              >
                Invest
              </Button>
            </DialogFooter>

            <p className="text-center text-xs text-slate-500">
              {activeNote
                ? `Min. investment : ${currency(activeNote.minInvestment)} | Max. investment : ${currency(activeNote.maxInvestment)}`
                : null}
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent className="max-w-sm rounded-xl border-slate-200 bg-white p-0">
          <DialogHeader className="border-b border-slate-200 px-4 py-4 text-center">
            <DialogTitle className="text-xl font-semibold text-slate-900">Confirm investment</DialogTitle>
            <DialogDescription className="pt-3 text-sm text-slate-700">
              Are you sure you want to invest{" "}
              <span className="font-semibold">RM {parseAmount(investmentAmount).toLocaleString("en-MY")}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 p-4">
            <Button
              type="button"
              variant="default"
              className={`h-9 rounded-lg shadow-none ${MARKETPLACE_SECONDARY_BUTTON_CLASS}`}
              onClick={() => setIsConfirmDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="action"
              className="h-9 rounded-lg"
              onClick={() => void handleConfirmInvestment()}
              disabled={
                commitInvestment.isPending || !activeOrganization?.id || !activeNote?.investable
              }
            >
              {commitInvestment.isPending ? "Confirming..." : "Confirm"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function InvestmentsPage() {
  const { setTitle } = useHeader();

  useEffect(() => {
    setTitle("Investments");
  }, [setTitle]);

  return (
    <div className="flex-1 bg-white p-4 md:p-8">
      <div className="w-full space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Your Investments</h1>
          <p className="text-sm text-slate-500">
            Track all notes you have invested in, sorted by relevance or performance.
          </p>
        </div>
        <InvestorInvestmentsList showStatusFilter />
      </div>
    </div>
  );
}
