"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
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

  const [industryFilter, setIndustryFilter] = useState(initialIndustry);
  const [riskFilter, setRiskFilter] = useState(initialRisk);
  const [profitFilter, setProfitFilter] = useState(initialProfit);
  const [tenorFilter, setTenorFilter] = useState(initialTenor);
  const [displayCount, setDisplayCount] = useState(6);

  useEffect(() => {
    setIndustryFilter(initialIndustry);
    setRiskFilter(initialRisk);
    setProfitFilter(initialProfit);
    setTenorFilter(initialTenor);
  }, [initialIndustry, initialProfit, initialRisk, initialTenor]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (industryFilter !== "all") params.set("industry", industryFilter);
    if (riskFilter !== "all") params.set("risk", riskFilter);
    if (profitFilter !== "all") params.set("profit", profitFilter);
    if (tenorFilter !== "all") params.set("tenor", tenorFilter);

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [industryFilter, pathname, profitFilter, riskFilter, router, tenorFilter]);

  useEffect(() => {
    setDisplayCount(6);
  }, [industryFilter, profitFilter, riskFilter, tenorFilter]);

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

  const visibleNotes = filteredNotes.slice(0, displayCount);
  const hasMoreNotes = displayCount < filteredNotes.length;
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
            {featuredNotes.slice(0, 6).map((note) => (
              <PublicMarketplaceNoteCard key={note.id} note={note} />
            ))}
          </div>
        </section>
      ) : null}

      {filteredNotes.length > 0 || hasActiveFilters ? (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 md:flex-row md:items-center md:justify-between">
            <div className="grid grid-cols-2 gap-2 md:ml-auto md:flex md:items-center">
              <Select value={industryFilter} onValueChange={setIndustryFilter}>
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

              <Select value={riskFilter} onValueChange={setRiskFilter}>
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

              <Select value={profitFilter} onValueChange={setProfitFilter}>
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

              <Select value={tenorFilter} onValueChange={setTenorFilter}>
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

          {hasMoreNotes ? (
            <div className="flex justify-center pt-2">
              <Button
                variant="ghost"
                className="text-slate-700 hover:bg-transparent hover:text-slate-900"
                onClick={() => setDisplayCount((count) => count + 3)}
              >
                Show more
              </Button>
            </div>
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
