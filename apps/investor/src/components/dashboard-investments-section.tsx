"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  BanknotesIcon,
  CalendarDaysIcon,
  PercentBadgeIcon,
  ScaleIcon,
} from "@heroicons/react/24/outline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useInvestorInvestments } from "@/investments/hooks/use-marketplace-notes";
import type { NoteListItem } from "@cashsouk/types";
import { cn } from "@/lib/utils";
import {
  getInvestmentStatusLabel,
  investmentSortOptions,
  sortInvestorInvestments,
  type InvestmentSortOption,
} from "@/investments/sort-investments";

function formatCurrency(value: number) {
  const isWholeNumber = Number.isInteger(value);
  return `RM ${value.toLocaleString("en-MY", {
    minimumFractionDigits: isWholeNumber ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function resolveTenureDays(maturityDate: string | null) {
  if (!maturityDate) return 0;
  const now = new Date();
  const maturity = new Date(maturityDate);
  const duration = maturity.getTime() - now.getTime();
  return Math.max(0, Math.ceil(duration / (1000 * 60 * 60 * 24)));
}

function getStatusTone(note: NoteListItem) {
  const label = getInvestmentStatusLabel(note);
  if (label === "Active" || label === "Settled") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (label === "Pending confirmation") {
    return "border-border bg-muted text-muted-foreground";
  }
  return "border-border bg-muted text-foreground";
}

function HeaderDivider({ className }: { className?: string }) {
  return <span className={cn("h-4 w-px shrink-0 bg-border", className)} aria-hidden="true" />;
}

function InvestmentRow({ note }: { note: NoteListItem }) {
  const repaymentSummary = note.investorRepaymentSummary ?? null;
  const expectedReturn = Number(repaymentSummary?.expectedReturnRatePercent ?? note.profitRatePercent ?? 0);
  const tenureDays = resolveTenureDays(note.maturityDate);
  const repaymentReceived = Number(repaymentSummary?.receivedPayoutAmount ?? note.settlementSummary?.grossReceiptAmount ?? 0);
  const investedAmount = Number(repaymentSummary?.investedPrincipal ?? note.settlementSummary?.investorPoolAmount ?? note.fundedAmount);
  const totalExpectedAmount = Number(
    repaymentSummary?.expectedPayoutAmount ?? investedAmount + investedAmount * (expectedReturn / 100)
  );
  const statusLabel = getInvestmentStatusLabel(note);
  const hasRiskRating = Boolean(note.riskRating && note.riskRating.trim() !== "");
  const isPendingConfirmation = statusLabel === "Pending confirmation";
  const hasActualReturn = typeof repaymentSummary?.actualReturnRatePercent === "number";
  const actualReturn = isPendingConfirmation
    ? "NA"
    : hasActualReturn
      ? `${Number(repaymentSummary?.actualReturnRatePercent).toFixed(1)}%`
      : "—";
  const progressValue = Number(
    repaymentSummary?.progressPercent ??
      (note.targetAmount > 0 ? Math.min(100, (note.fundedAmount / note.targetAmount) * 100) : 0)
  );
  const returnLabel = isPendingConfirmation ? "Expected return" : hasActualReturn ? "Actual return" : "Pending settlement";
  const displayDate = new Date(note.updatedAt).toLocaleDateString("en-MY", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex flex-col gap-2.5 border-b border-border pb-2.5 lg:flex-row lg:items-center lg:gap-4">
        <div className="flex items-center gap-3 lg:shrink-0">
          <h3 className="text-l font-semibold leading-none tracking-tight text-foreground">
            {note.noteReference.replace("NOTE-", "Note ")}
          </h3>
          {hasRiskRating ? (
            <>
              <HeaderDivider />
              <p className="text-sm font-semibold leading-none text-muted-foreground md:text-base">{note.riskRating}</p>
            </>
          ) : null}
        </div>
        <HeaderDivider className="hidden lg:block" />
        <div className="min-w-0 flex-1 lg:pr-6">
          <div className="mb-1.5 flex items-center justify-between gap-1.5 text-xs leading-tight">
            <p className="min-w-0 text-sm text-muted-foreground">
              <span className="font-semibold text-sm text-foreground">
                {formatCurrency(repaymentReceived)}
              </span>{" "}
              (Repayment received)
            </p>
            <p className="min-w-0 text-right text-sm text-muted-foreground">
              <span className="font-semibold text-sm text-foreground">
                {formatCurrency(totalExpectedAmount)}
              </span>{" "}
              (Principal + Expected profit)
            </p>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-foreground transition-all"
              style={{ width: `${Math.max(0, Math.min(100, progressValue))}%` }}
            />
          </div>
        </div>
        <div className="lg:flex lg:w-[12rem] lg:justify-end">
          <Badge
            variant="outline"
            className={cn(
              "w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold lg:shrink-0",
              getStatusTone(note)
            )}
          >
            {statusLabel}
            {statusLabel === "Active" && tenureDays > 0 ? ` (${tenureDays} days)` : ""}
          </Badge>
        </div>
      </div>

      <div className="mt-1.5">
        <div className="grid gap-2 xl:grid-cols-[1.7fr_0.8fr]">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl bg-muted/20 p-2">
              <div className="flex items-start gap-2">
                <div className="rounded-xl bg-muted p-2 text-muted-foreground">
                  <BanknotesIcon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm leading-tight text-muted-foreground">Your investment</p>
                  <p className="text-lg font-semibold leading-none tracking-tight text-foreground md:text-xl">
                    {formatCurrency(investedAmount)}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-xl bg-muted/20 p-2">
              <div className="flex items-start gap-2">
                <div className="rounded-xl bg-muted p-2 text-muted-foreground">
                  <PercentBadgeIcon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm leading-tight text-muted-foreground">Expected Return</p>
                  <p className="text-lg font-semibold leading-none tracking-tight text-foreground md:text-xl">
                    {expectedReturn.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-xl bg-muted/20 p-2">
              <div className="flex items-start gap-2">
                <div className="rounded-xl bg-muted p-2 text-muted-foreground">
                  <ScaleIcon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm leading-tight text-muted-foreground">Tenure</p>
                  <p className="text-lg font-semibold leading-none tracking-tight text-foreground md:text-xl">
                    {tenureDays} days
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-xl bg-muted/20 p-2">
              <div className="flex items-start gap-2">
                <div className="rounded-xl bg-muted p-2 text-muted-foreground">
                  <CalendarDaysIcon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm leading-tight text-muted-foreground">Investment date</p>
                  <p className="text-lg font-semibold leading-none tracking-tight text-foreground md:text-xl">
                    {displayDate}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-muted/20 p-2.5 text-center">
            <p className="mt-2 text-[clamp(2.4rem,4.8vw,3.4rem)] font-semibold leading-none tracking-tight text-foreground">
              {actualReturn}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {returnLabel}
            </p>
            <div className="mt-3 border-t border-border/60 pt-2">
              <Button asChild variant="link" className="h-auto p-0 text-sm text-primary">
                <Link href={`/investments/${note.id}`} className="inline-flex items-center gap-1.5">
                  View details
                  <ArrowRightIcon className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DashboardInvestmentsSection() {
  const { data, isLoading, error } = useInvestorInvestments();
  const notes = data?.notes ?? [];
  const [sortOption, setSortOption] = useState<InvestmentSortOption>("most_relevant");
  const sortedNotes = useMemo(() => sortInvestorInvestments(notes, sortOption), [notes, sortOption]);

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-col items-start justify-between gap-3 pb-2 sm:flex-row sm:items-center">
        <CardTitle className="text-xl font-semibold">Investments</CardTitle>
        <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Select value={sortOption} onValueChange={(value) => setSortOption(value as InvestmentSortOption)}>
            <SelectTrigger className="h-9 w-full rounded-lg text-xs sm:w-[190px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              {investmentSortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button asChild variant="outline" size="sm">
            <Link href="/investments" className="inline-flex items-center gap-2">
              View all
            </Link>
          </Button>
        </div>
      </CardHeader>
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
          <div className="grid gap-3">
            {sortedNotes.slice(0, 3).map((note) => (
              <InvestmentRow key={note.id} note={note} />
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
