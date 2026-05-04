"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useHeader } from "@cashsouk/ui";
import { useOrganization } from "@cashsouk/config";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MarketplaceNote, NoteCard as MarketplaceMockNoteCard } from "@/components/marketplace/note-card";
import { InvestmentsDevBalanceTopup } from "./_components/investments-dev-balance-topup";
import { computeMarketplaceCommitBounds } from "@/investments/marketplace-commit-bounds";
import {
  useCommitInvestment,
  useInvestorPortfolio,
  useMarketplaceNotes,
} from "@/investments/hooks/use-marketplace-notes";
import type { NoteListItem } from "@cashsouk/types";
import { SOUKSCORE_RISK_RATING_GRADES } from "@cashsouk/types";

const MARKETPLACE_ACTION_BUTTON_CLASS =
  "bg-slate-950 text-white hover:bg-slate-900";
const MARKETPLACE_SECONDARY_BUTTON_CLASS =
  "bg-slate-100 text-slate-700 hover:bg-slate-200";

const DEFAULT_TENOR_DAYS = 30;
const MARKETPLACE_INDUSTRY_PLACEHOLDER = "Industry";
const MARKETPLACE_PRODUCT_PLACEHOLDER = "Product name (TBD)";
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

function daysUntil(dateValue?: string | null) {
  if (!dateValue) return DEFAULT_TENOR_DAYS;
  const now = new Date();
  const target = new Date(dateValue);
  const millis = target.getTime() - now.getTime();
  return Math.max(1, Math.ceil(millis / (1000 * 60 * 60 * 24)));
}

function currency(amount: number) {
  return `RM ${amount.toLocaleString("en-MY")}`;
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
  const tenorDays = daysUntil(note.maturityDate);

  return {
    id: note.id,
    noteCode: note.noteReference,
    title: note.productName ?? MARKETPLACE_PRODUCT_PLACEHOLDER,
    industry: note.issuerIndustry ?? MARKETPLACE_INDUSTRY_PLACEHOLDER,
    fundedAmount: note.fundedAmount,
    goalAmount: note.targetAmount,
    annualReturn: note.profitRatePercent ?? 0,
    tenorDays,
    riskScore: note.riskRating ?? "—",
    daysLeft: tenorDays,
    minInvestment: minCommit,
    maxInvestment: maxCommit,
    investable,
    isFeatured: note.featuredActive,
    featuredRank: note.featuredRank ?? undefined,
  };
}

export default function InvestmentsPage() {
  const { setTitle } = useHeader();
  const { activeOrganization } = useOrganization();
  const { data: portfolio } = useInvestorPortfolio();
  const commitInvestment = useCommitInvestment();
  const availableBalance = Number(portfolio?.availableBalance ?? 0);

  const [search, setSearch] = useState("");
  const { data, isLoading, error } = useMarketplaceNotes({ search, page: 1, pageSize: 100 });
  const [industryFilter, setIndustryFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [profitFilter, setProfitFilter] = useState("all");
  const [tenorFilter, setTenorFilter] = useState("all");
  const [displayCount, setDisplayCount] = useState(6);

  const [activeNote, setActiveNote] = useState<MarketplaceNote | null>(null);
  const [investmentAmount, setInvestmentAmount] = useState("10,000");
  const [agreedToTerms, setAgreedToTerms] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);

  useEffect(() => {
    setTitle("Investments");
  }, [setTitle]);

  const marketplaceNotes = useMemo(
    () => (data?.notes ?? []).map((note) => toMarketplaceNote(note)),
    [data?.notes]
  );

  const featuredNotes = useMemo(
    () =>
      marketplaceNotes
        .filter((note) => note.isFeatured)
        .sort((left, right) => {
          const leftRank = left.featuredRank ?? Number.MAX_SAFE_INTEGER;
          const rightRank = right.featuredRank ?? Number.MAX_SAFE_INTEGER;
          if (leftRank !== rightRank) return leftRank - rightRank;
          return left.title.localeCompare(right.title);
        }),
    [marketplaceNotes]
  );
  const featuredPreviewNotes = featuredNotes.slice(0, 6);

  const filteredNotes = useMemo(() => {
    return marketplaceNotes.filter((note) => !note.isFeatured).filter((note) => {
      const query = search.trim().toLowerCase();
      const matchesSearch =
        query.length === 0 ||
        note.title.toLowerCase().includes(query) ||
        note.industry.toLowerCase().includes(query) ||
        note.noteCode.toLowerCase().includes(query);

      const matchesIndustry = industryFilter === "all" || note.industry === industryFilter;
      const matchesRisk = riskFilter === "all" || note.riskScore === riskFilter;
      const matchesProfit =
        profitFilter === "all" ||
        (profitFilter === "low" && note.annualReturn < 14) ||
        (profitFilter === "mid" && note.annualReturn >= 14 && note.annualReturn <= 15) ||
        (profitFilter === "high" && note.annualReturn > 15);
      const matchesTenor =
        tenorFilter === "all" ||
        (tenorFilter === "short" && note.tenorDays <= 30) ||
        (tenorFilter === "medium" && note.tenorDays > 30 && note.tenorDays <= 45) ||
        (tenorFilter === "long" && note.tenorDays > 45);

      return (
        matchesSearch &&
        matchesIndustry &&
        matchesRisk &&
        matchesProfit &&
        matchesTenor
      );
    });
  }, [industryFilter, marketplaceNotes, profitFilter, riskFilter, search, tenorFilter]);

  const visibleNotes = filteredNotes.slice(0, displayCount);
  const hasMoreNotes = displayCount < filteredNotes.length;

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
      <div className="mx-auto w-full max-w-[1240px] space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Investment Marketplace</h1>
          <p className="text-sm text-slate-500">
            Browse published notes and commit funds from your investor pool.
          </p>
        </div>
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 md:flex-row md:items-center md:justify-between md:p-6">
          <div className="relative w-full md:max-w-2xl">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by investment notes, industry, company"
              className="h-11 rounded-xl border-slate-200 bg-white pl-9 text-sm text-slate-700 placeholder:text-slate-500 focus-visible:ring-slate-300"
            />
          </div>
          <div className="flex w-full flex-col items-stretch gap-3 md:w-auto md:items-end">
            <div className="text-sm font-medium text-slate-700 md:text-base md:text-right">
              Available balance:{" "}
              <span className="font-semibold text-slate-900">{currency(availableBalance)}</span>
            </div>
            <InvestmentsDevBalanceTopup investorOrganizationId={activeOrganization?.id} />
          </div>
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

        {!isLoading && marketplaceNotes.length > 0 ? (
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:p-6">
            <div>
              <div>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900">Featured investment opportunities</h2>
              <p className="mt-1 text-sm text-slate-500">Top picks curated for you</p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {featuredPreviewNotes.map((note) => (
                <MarketplaceMockNoteCard key={note.id} note={note} onInvest={openInvestDialog} />
              ))}
              {featuredPreviewNotes.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-8 text-sm text-slate-500">
                  No featured notes are available right now.
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {!isLoading && marketplaceNotes.length > 0 ? (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 md:flex-row md:items-center md:justify-between">
            <div className="grid grid-cols-2 gap-2 md:ml-auto md:flex md:items-center">
              <Select value={industryFilter} onValueChange={setIndustryFilter}>
                <SelectTrigger className="h-9 w-[170px] md:w-[220px] rounded-lg border-slate-200 px-3 text-xs text-slate-700 focus:ring-slate-300">
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

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleNotes.map((note) => (
              <MarketplaceMockNoteCard key={note.id} note={note} onInvest={openInvestDialog} />
            ))}
          </div>

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

        {!isLoading && !error && marketplaceNotes.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
            No marketplace notes are available right now.
          </div>
        ) : null}
      </div>

      <Dialog open={Boolean(activeNote)} onOpenChange={(open) => !open && closeInvestDialog()}>
        <DialogContent className="max-w-md rounded-xl border-slate-200 bg-white p-0">
          <DialogHeader className="space-y-3 border-b border-slate-200 px-4 pb-4 pt-5">
            <DialogTitle className="text-2xl font-semibold tracking-tight text-slate-900">
              {activeNote?.title}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="text-xs text-slate-500">
                {activeNote?.industry} | Note: {activeNote?.noteCode}
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
                variant="default"
                className={`h-9 flex-1 rounded-lg ${MARKETPLACE_ACTION_BUTTON_CLASS}`}
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
              variant="default"
              className={`h-9 rounded-lg ${MARKETPLACE_ACTION_BUTTON_CLASS}`}
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
