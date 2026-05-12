"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@cashsouk/ui";
import { SOUKSCORE_RISK_RATING_GRADES, type NoteListItem } from "@cashsouk/types";
import { computeMarketplaceCommitBounds } from "@/lib/marketplace-commit-bounds";
import {
  PublicMarketplaceNoteCard,
  type PublicMarketplaceNote,
} from "./public-marketplace-note-card";

function resolveMarketplaceDaysLeft(maturityDate?: string | null): number | null {
  if (!maturityDate) return null;

  const target = new Date(maturityDate);
  if (Number.isNaN(target.getTime())) {
    return null;
  }

  const millisRemaining = target.getTime() - Date.now();
  return Math.max(1, Math.ceil(millisRemaining / (1000 * 60 * 60 * 24)));
}
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
  const tenorDays = resolveMarketplaceDaysLeft(note.maturityDate);

  return {
    id: note.id,
    noteCode: note.noteReference.trim() || null,
    title: note.productName?.trim() || note.title.trim() || null,
    industry: note.issuerIndustry?.trim() || null,
    fundedAmount: note.fundedAmount,
    goalAmount: note.targetAmount,
    annualReturn: note.profitRatePercent,
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

  const [industryFilter, setIndustryFilter] = useState(initialIndustry);
  const [riskFilter, setRiskFilter] = useState(initialRisk);
  const [profitFilter, setProfitFilter] = useState(initialProfit);
  const [tenorFilter, setTenorFilter] = useState(initialTenor);
  const [currentPage, setCurrentPage] = useState(initialPage);

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
    if (industryFilter !== "all") params.set("industry", industryFilter);
    if (riskFilter !== "all") params.set("risk", riskFilter);
    if (profitFilter !== "all") params.set("profit", profitFilter);
    if (tenorFilter !== "all") params.set("tenor", tenorFilter);
    if (currentPage > 1) params.set("page", String(currentPage));

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [currentPage, industryFilter, pathname, profitFilter, riskFilter, router, tenorFilter]);

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

  const marketplaceNotes = useMemo(() => notes.map((note) => toMarketplaceNote(note)), [notes]);

  const featuredNotes = useMemo(
    () =>
      marketplaceNotes
        .filter((note) => note.isFeatured)
        .sort((left, right) => {
          const leftRank = left.featuredRank ?? Number.MAX_SAFE_INTEGER;
          const rightRank = right.featuredRank ?? Number.MAX_SAFE_INTEGER;
          if (leftRank !== rightRank) return leftRank - rightRank;
          return (left.title ?? "").localeCompare(right.title ?? "");
        }),
    [marketplaceNotes]
  );

  const filteredNotes = useMemo(() => {
    return marketplaceNotes.filter((note) => !note.isFeatured).filter((note) => {
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
        matchesIndustry &&
        matchesRisk &&
        matchesProfit &&
        matchesTenor
      );
    });
  }, [industryFilter, marketplaceNotes, profitFilter, riskFilter, tenorFilter]);

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
  const hasActiveFilters =
    industryFilter !== "all" || riskFilter !== "all" || profitFilter !== "all" || tenorFilter !== "all";

  return (
    <div className="space-y-8 md:space-y-10">
      {featuredNotes.length > 0 ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              Featured investment opportunities
            </h2>
            <p className="mt-1 text-sm text-slate-500">Top picks curated for you</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {featuredNotes.slice(0, FEATURED_MARKETPLACE_NOTES_LIMIT).map((note) => (
              <PublicMarketplaceNoteCard key={note.id} note={note} />
            ))}
          </div>
        </section>
      ) : null}

      {filteredNotes.length > 0 || hasActiveFilters ? (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 md:flex-row md:items-center md:justify-between">
            <div className="grid grid-cols-2 gap-2 md:ml-auto md:flex md:items-center">
              <Select value={industryFilter} onValueChange={handleIndustryChange}>
                <SelectTrigger className="h-9 w-[170px] rounded-lg border-slate-200 px-3 text-xs text-slate-700 focus:ring-slate-300 md:w-[220px]">
                  <SelectValue placeholder="Industry" className="truncate" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All industries</SelectItem>
                  {ONBOARDING_INDUSTRY_OPTIONS.map((industry) => (
                    <SelectItem key={industry} value={industry}>
                      {industry}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={riskFilter} onValueChange={handleRiskChange}>
                <SelectTrigger className="h-9 w-[120px] rounded-lg border-slate-200 px-3 text-xs text-slate-700 focus:ring-slate-300">
                  <SelectValue placeholder="Risk Score" className="truncate" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All risk scores</SelectItem>
                  {SOUKSCORE_RISK_RATING_GRADES.map((grade) => (
                    <SelectItem key={grade} value={grade}>
                      {grade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={profitFilter} onValueChange={handleProfitChange}>
                <SelectTrigger className="h-9 w-[120px] rounded-lg border-slate-200 px-3 text-xs text-slate-700 focus:ring-slate-300">
                  <SelectValue placeholder="Profit" className="truncate" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All profit bands</SelectItem>
                  <SelectItem value="low">Below 14%</SelectItem>
                  <SelectItem value="mid">14% - 15%</SelectItem>
                  <SelectItem value="high">Above 15%</SelectItem>
                </SelectContent>
              </Select>

              <Select value={tenorFilter} onValueChange={handleTenorChange}>
                <SelectTrigger className="h-9 w-[120px] rounded-lg border-slate-200 px-3 text-xs text-slate-700 focus:ring-slate-300">
                  <SelectValue placeholder="Tenor" className="truncate" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All tenors</SelectItem>
                  <SelectItem value="short">Up to 30 days</SelectItem>
                  <SelectItem value="medium">31 - 45 days</SelectItem>
                  <SelectItem value="long">46+ days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {visibleNotes.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleNotes.map((note) => (
                <PublicMarketplaceNoteCard key={note.id} note={note} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
              No notes match your current search and filters.
            </div>
          )}

          {totalPages > 1 ? (
            <nav
              className="flex flex-col items-center gap-3 pt-2 sm:flex-row sm:justify-center"
              aria-label="Listings pagination"
            >
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1 border-slate-200 px-3 text-slate-700"
                  onClick={goToPreviousPage}
                  disabled={effectivePage <= 1}
                  aria-label="Previous page"
                >
                  <ChevronLeftIcon className="size-4" aria-hidden />
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1 border-slate-200 px-3 text-slate-700"
                  onClick={goToNextPage}
                  disabled={effectivePage >= totalPages}
                  aria-label="Next page"
                >
                  Next
                  <ChevronRightIcon className="size-4" aria-hidden />
                </Button>
              </div>
              <p className="text-sm text-slate-600">
                Page {effectivePage} of {totalPages}
              </p>
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
