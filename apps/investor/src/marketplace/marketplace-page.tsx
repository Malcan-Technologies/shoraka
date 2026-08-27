"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { formatCurrency, useOrganization } from "@cashsouk/config";
import {
  EmptyState,
  ListToolbar,
  LoadingState,
  PageShell,
  Pagination,
  LEGAL_REACCEPTANCE_REDIRECT,
  legalReacceptanceInterceptMessage,
  portalPageGutterClassName,
  useHeader,
} from "@cashsouk/ui";
import {
  MARC_SME_GRADES,
  isNoteMoneyAmount,
  type MarketplaceListingFilter,
} from "@cashsouk/types";
import { Button } from "@/components/ui/button";
import { DepositDialog } from "@/app/transactions/components/deposit-dialog";
import { InvestmentListSection } from "@/investments/components/investment-list-section";
import { ONBOARDING_INDUSTRY_OPTIONS } from "@/investments/industry-filter-options";
import {
  useCommitInvestment,
  useInvestorPortfolio,
  useMarketplaceNotes,
  useOpenMarketplaceProspectus,
} from "@/investments/hooks/use-marketplace-notes";
import { cn } from "@/lib/utils";
import { MarketplaceCashBar } from "./marketplace-cash-bar";
import { MarketplaceFeaturedSection } from "./marketplace-featured-section";
import {
  MarketplaceFilterToolbar,
  marketplaceFilterChips,
} from "./marketplace-filter-toolbar";
import { MarketplaceInvestDialog } from "./marketplace-invest-dialogs";
import { MarketplaceNoteCard } from "./marketplace-note-card";
import {
  DEFAULT_MARKETPLACE_FILTERS,
  marketplaceHasActiveFilters,
  marketplaceNoteMatchesFilters,
  sortFeaturedMarketplaceNotes,
  toMarketplaceNote,
  type MarketplaceNote,
  type MarketplaceNoteFilters,
} from "./marketplace-note-model";

const MARKETPLACE_PAGE_SIZE_OPTIONS = [10, 25, 50];

function parseMarketplaceListPageParam(value: string | null): number {
  if (!value) return 1;
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}

function parseMarketplacePageSizeParam(value: string | null): number {
  const parsed = Number.parseInt(value?.trim() ?? "", 10);
  if (MARKETPLACE_PAGE_SIZE_OPTIONS.includes(parsed)) return parsed;
  return 10;
}

function formatDefaultCommitAmount(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) return "0";
  if (amount >= 1000) {
    return amount.toLocaleString("en-MY", { maximumFractionDigits: 0 });
  }
  return amount.toLocaleString("en-MY", { maximumFractionDigits: 2 });
}

function filtersFromSearchParams(params: URLSearchParams): MarketplaceNoteFilters {
  const industryParam = params.get("industry");
  const riskParam = params.get("risk");
  const profitParam = params.get("profit");
  const tenorParam = params.get("tenor");
  const listingParam = params.get("listing");

  return {
    search: params.get("q") ?? "",
    industry:
      industryParam &&
      ONBOARDING_INDUSTRY_OPTIONS.includes(
        industryParam as (typeof ONBOARDING_INDUSTRY_OPTIONS)[number]
      )
        ? industryParam
        : "all",
    risk:
      riskParam &&
      MARC_SME_GRADES.includes(riskParam as (typeof MARC_SME_GRADES)[number])
        ? riskParam
        : "all",
    profit: profitParam && ["low", "mid", "high"].includes(profitParam) ? profitParam : "all",
    tenor: tenorParam && ["short", "medium", "long"].includes(tenorParam) ? tenorParam : "all",
    listing:
      listingParam && ["open", "funded", "failed", "all"].includes(listingParam)
        ? (listingParam as MarketplaceListingFilter)
        : "open",
  };
}

export function MarketplacePage() {
  const { setTitle } = useHeader();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { activeOrganization } = useOrganization();
  const { data: portfolio, isLoading: isPortfolioLoading } = useInvestorPortfolio(
    activeOrganization?.id
  );
  const commitInvestment = useCommitInvestment();
  const openMarketplaceProspectus = useOpenMarketplaceProspectus();
  const availableBalance = Number(portfolio?.availableBalance ?? 0);

  const initialFilters = filtersFromSearchParams(searchParams);
  const [search, setSearch] = useState(initialFilters.search);
  const [debouncedSearch, setDebouncedSearch] = useState(initialFilters.search);
  const [filters, setFilters] = useState<MarketplaceNoteFilters>(initialFilters);
  const [currentPage, setCurrentPage] = useState(parseMarketplaceListPageParam(searchParams.get("page")));
  const [pageSize, setPageSize] = useState(parseMarketplacePageSizeParam(searchParams.get("pageSize")));

  const [activeNote, setActiveNote] = useState<MarketplaceNote | null>(null);
  const [investmentAmount, setInvestmentAmount] = useState("10,000");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositError, setDepositError] = useState<string | null>(null);

  useEffect(() => {
    setTitle("");
    return () => setTitle("");
  }, [setTitle]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const effectiveFilters = useMemo(
    () => ({ ...filters, search: debouncedSearch }),
    [debouncedSearch, filters]
  );

  useEffect(() => {
    const params = new URLSearchParams();
    const trimmedSearch = search.trim();
    if (trimmedSearch) params.set("q", trimmedSearch);
    if (filters.industry !== "all") params.set("industry", filters.industry);
    if (filters.risk !== "all") params.set("risk", filters.risk);
    if (filters.profit !== "all") params.set("profit", filters.profit);
    if (filters.tenor !== "all") params.set("tenor", filters.tenor);
    if (filters.listing !== "open") params.set("listing", filters.listing);
    if (currentPage > 1) params.set("page", String(currentPage));
    if (pageSize !== 10) params.set("pageSize", String(pageSize));
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [currentPage, filters, pageSize, pathname, router, search]);

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
  } = useMarketplaceNotes({ page: 1, pageSize: 100, includeClosed: true });

  const isLoading = isFeaturedLoading || isListLoading;
  const error = listError ?? featuredError;

  const marketplaceNotes = useMemo(
    () => (listData?.notes ?? []).map((note) => toMarketplaceNote(note)),
    [listData?.notes]
  );
  const featuredNotes = useMemo(
    () =>
      sortFeaturedMarketplaceNotes(
        (featuredData?.notes ?? [])
          .map((note) => toMarketplaceNote(note))
          .filter((note) => note.isFeatured)
      ),
    [featuredData?.notes]
  );
  const featuredIds = useMemo(() => new Set(featuredNotes.map((note) => note.id)), [featuredNotes]);
  const catalogNotes = useMemo(
    () => marketplaceNotes.filter((note) => !featuredIds.has(note.id)),
    [featuredIds, marketplaceNotes]
  );
  const filtersAreActive = marketplaceHasActiveFilters(effectiveFilters);
  const listingSource = filtersAreActive ? marketplaceNotes : catalogNotes;

  const filteredNotes = useMemo(
    () => listingSource.filter((note) => marketplaceNoteMatchesFilters(note, effectiveFilters)),
    [effectiveFilters, listingSource]
  );

  const hasActiveFilters = marketplaceHasActiveFilters({ ...filters, search });
  const appliedFilters = useMemo(
    () =>
      marketplaceFilterChips(effectiveFilters, (next) => {
        setFilters(next);
        setCurrentPage(1);
      }),
    [effectiveFilters]
  );

  const totalPages = filteredNotes.length === 0 ? 0 : Math.ceil(filteredNotes.length / pageSize);
  const effectivePage = totalPages === 0 ? 1 : Math.min(currentPage, totalPages);
  const visibleNotes = filteredNotes.slice(
    (effectivePage - 1) * pageSize,
    (effectivePage - 1) * pageSize + pageSize
  );

  function handleClearFilters() {
    setSearch("");
    setDebouncedSearch("");
    setFilters(DEFAULT_MARKETPLACE_FILTERS);
    setCurrentPage(1);
  }

  function openProspectus(note: MarketplaceNote) {
    void openMarketplaceProspectus(note.id).catch((err) =>
      toast.error(err instanceof Error ? err.message : "Prospectus unavailable")
    );
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
      setValidationError("Enter an amount you'd like to invest.");
      return;
    }
    if (!isNoteMoneyAmount(parsedAmount)) {
      setValidationError("Use up to two decimal places.");
      return;
    }
    if (parsedAmount > availableBalance) {
      setValidationError("You don't have enough available cash for this amount.");
      return;
    }
    if (parsedAmount < activeNote.minInvestment || parsedAmount > activeNote.maxInvestment) {
      setValidationError(
        `This note accepts from ${formatCurrency(activeNote.minInvestment)} to ${formatCurrency(activeNote.maxInvestment)}.`
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
      toast.error("Choose an investor organization first.");
      return;
    }
    const parsedAmount = parseAmount(investmentAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Enter an amount you'd like to invest.");
      return;
    }
    if (!isNoteMoneyAmount(parsedAmount)) {
      toast.error("Use up to two decimal places.");
      return;
    }
    if (parsedAmount > availableBalance) {
      toast.error("You don't have enough available cash for this amount.");
      return;
    }
    if (
      parsedAmount + 1e-9 < activeNote.minInvestment ||
      parsedAmount > activeNote.maxInvestment + 1e-9
    ) {
      toast.error(
        `This note accepts from ${formatCurrency(activeNote.minInvestment)} to ${formatCurrency(activeNote.maxInvestment)}.`
      );
      return;
    }
    try {
      await commitInvestment.mutateAsync({
        noteId: activeNote.id,
        amount: parsedAmount,
        investorOrganizationId: activeOrganization.id,
      });
      toast.success("You're in. Your investment is reserved.");
      setIsConfirmDialogOpen(false);
      closeInvestDialog();
    } catch (err) {
      const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
      if (code === "LEGAL_REACCEPTANCE_REQUIRED") {
        toast.message(legalReacceptanceInterceptMessage("investor"));
        setIsConfirmDialogOpen(false);
        router.push(LEGAL_REACCEPTANCE_REDIRECT);
        return;
      }
      toast.error(err instanceof Error ? err.message : "Failed to commit investment");
    }
  }

  const openListingCount = marketplaceNotes.filter((note) => note.listingKind === "open").length;
  const listingCountLabel = hasActiveFilters
    ? `${filteredNotes.length} of ${marketplaceNotes.length} notes`
    : `${filteredNotes.length} ${filteredNotes.length === 1 ? "note" : "notes"}`;

  return (
    <div className={cn(portalPageGutterClassName, "space-y-6")}>
      <PageShell
        title="Marketplace"
        description="Compare published notes and commit from your available cash."
      >
        <MarketplaceCashBar
          availableBalance={availableBalance}
          openListingCount={openListingCount}
          isLoading={isPortfolioLoading || isLoading}
          onDeposit={() => setDepositOpen(true)}
        />

        {error ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-ui text-destructive">
            {error instanceof Error ? error.message : "Failed to load marketplace"}
          </div>
        ) : null}

        {isLoading ? <LoadingState variant="cards" rows={3} /> : null}

        {!isLoading && !error ? (
          <ListToolbar
            searchValue={search}
            onSearchChange={(value) => {
              setSearch(value);
              setCurrentPage(1);
            }}
            searchPlaceholder="Search by purpose, note, industry, or product"
            appliedFilters={appliedFilters}
            onClearFilters={hasActiveFilters ? handleClearFilters : undefined}
            onReload={() => {
              void Promise.all([refetchFeaturedNotes(), refetchMarketplaceList()]);
            }}
            isLoading={isLoading}
            countLabel={listingCountLabel}
            filterGroups={
              <MarketplaceFilterToolbar
                filters={effectiveFilters}
                onChange={(next) => {
                  setFilters(next);
                  setCurrentPage(1);
                }}
              />
            }
          />
        ) : null}

        {!isLoading && !error && !filtersAreActive && featuredNotes.length > 0 ? (
          <MarketplaceFeaturedSection
            notes={featuredNotes}
            onInvest={openInvestDialog}
            onViewProspectus={openProspectus}
          />
        ) : null}

        {!isLoading && !error && marketplaceNotes.length === 0 && featuredNotes.length === 0 ? (
          <EmptyState
            title="No notes on the marketplace"
            message="Published notes will appear here when they open for funding."
          />
        ) : null}

        {!isLoading && !error && filteredNotes.length === 0 && hasActiveFilters ? (
          <EmptyState
            variant="no-results"
            title="No matching notes"
            message="Try a different search or clear your filters."
            action={
              <Button variant="outline" className="rounded-xl" onClick={handleClearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : null}

        {!isLoading && !error && filteredNotes.length > 0 ? (
          <>
            <InvestmentListSection
              title={featuredNotes.length > 0 ? "All notes" : "Notes"}
              count={filteredNotes.length}
              items={visibleNotes.map((note) => ({
                key: note.id,
                node: (
                  <MarketplaceNoteCard
                    note={note}
                    onInvest={openInvestDialog}
                    onViewProspectus={openProspectus}
                  />
                ),
              }))}
            />
            {filteredNotes.length > 10 || pageSize !== 10 ? (
              <Pagination
                page={effectivePage}
                pageSize={pageSize}
                total={filteredNotes.length}
                onPageChange={setCurrentPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setCurrentPage(1);
                }}
                pageSizeOptions={MARKETPLACE_PAGE_SIZE_OPTIONS}
                itemLabel="notes"
              />
            ) : null}
          </>
        ) : null}
      </PageShell>

      <MarketplaceInvestDialog
        note={activeNote}
        amount={investmentAmount}
        availableBalance={availableBalance}
        agreedToTerms={agreedToTerms}
        validationError={validationError}
        isConfirming={isConfirmDialogOpen}
        isPending={commitInvestment.isPending}
        canConfirm={Boolean(activeOrganization?.id && activeNote?.investable)}
        onAmountChange={(value) => {
          setInvestmentAmount(value);
          if (validationError) setValidationError(null);
        }}
        onAgreedToTermsChange={setAgreedToTerms}
        onCancel={closeInvestDialog}
        onInvest={handleInvestAction}
        onConfirm={() => void handleConfirmInvestment()}
        onBackFromConfirm={() => setIsConfirmDialogOpen(false)}
        onViewProspectus={openProspectus}
      />

      <DepositDialog
        open={depositOpen}
        onOpenChange={setDepositOpen}
        investorOrganizationId={activeOrganization?.id}
        amount={depositAmount}
        onAmountChange={setDepositAmount}
        validationError={depositError}
        onValidationErrorChange={setDepositError}
        returnTo="/marketplace"
      />
    </div>
  );
}
