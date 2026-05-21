"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  BanknotesIcon,
  CalendarDaysIcon,
  PercentBadgeIcon,
  ScaleIcon,
} from "@heroicons/react/24/outline";
import { formatCurrency } from "@cashsouk/config";
import {
  formatInvestorReturnRatePercent,
  formatNoteReferenceDisplay,
  resolveNetExpectedReturnRatePercent,
  roundNoteMoney,
  type NoteListItem,
} from "@cashsouk/types";
import { getNoteDerivedStatusLabel, NoteStatusBadge, SoukscoreRiskRatingBadge } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function resolveTenureDays(maturityDate: string | null) {
  if (!maturityDate) return 0;
  const now = new Date();
  const maturity = new Date(maturityDate);
  const duration = maturity.getTime() - now.getTime();
  return Math.max(0, Math.ceil(duration / (1000 * 60 * 60 * 24)));
}

function HeaderDivider({ className }: { className?: string }) {
  return <span className={cn("h-4 w-px shrink-0 bg-border", className)} aria-hidden="true" />;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export type InvestmentPositionCardFooterRow = {
  label: string;
  value: string;
  icon?: React.ElementType;
};

type InvestmentPositionCardProps = {
  note: NoteListItem;
  detailHref?: string;
  showDetailLink?: boolean;
  footerRows?: InvestmentPositionCardFooterRow[];
  investmentDateValue?: string | null;
  className?: string;
};

export function InvestmentPositionCard({
  note,
  detailHref = `/investments/${note.id}`,
  showDetailLink = true,
  footerRows = [],
  investmentDateValue,
  className,
}: InvestmentPositionCardProps) {
  const repaymentSummary = note.investorRepaymentSummary ?? null;
  const expectedReturn = Number(
    repaymentSummary?.expectedReturnRatePercent ??
      resolveNetExpectedReturnRatePercent(note) ??
      0
  );
  const tenureDays = resolveTenureDays(note.maturityDate);
  const repaymentReceived = Number(
    repaymentSummary?.receivedPayoutAmount ?? note.settlementSummary?.grossReceiptAmount ?? 0
  );
  const investedAmount = Number(
    repaymentSummary?.investedPrincipal ??
      note.settlementSummary?.investorPoolAmount ??
      note.fundedAmount
  );
  const yourProfit = roundNoteMoney(repaymentReceived - investedAmount, 2);
  const investorStatusLabel = getNoteDerivedStatusLabel(note, { viewer: "investor" });
  const yourProfitDisplayed =
    investorStatusLabel === "Settled" ? yourProfit : Math.max(0, yourProfit);
  const isInvestorSettled = investorStatusLabel === "Settled";
  const repaymentAmountDisplay =
    !isInvestorSettled && repaymentReceived <= 0 ? "—" : formatCurrency(repaymentReceived);
  const profitAmountDisplay =
    !isInvestorSettled && yourProfitDisplayed <= 0 ? "—" : formatCurrency(yourProfitDisplayed);
  const hasRiskRating = Boolean(note.riskRating && note.riskRating.trim() !== "");
  const hasActualReturn = typeof repaymentSummary?.actualReturnRatePercent === "number";
  const actualReturn = hasActualReturn
    ? `${Number(repaymentSummary?.actualReturnRatePercent).toFixed(1)}%`
    : "-";
  const returnLabel = "Actual return";
  const displayDate = formatDate(investmentDateValue ?? note.updatedAt);
  const resolvedFooterRows: InvestmentPositionCardFooterRow[] = [
    { label: "Maturity date", value: formatDate(note.maturityDate) },
    ...footerRows.filter((row) => row.label !== "Maturity date"),
  ];

  return (
    <div className={cn("rounded-xl border border-border bg-card p-3 sm:p-4", className)}>
      <div className="space-y-3 border-b border-border pb-3">
        <div className="grid grid-cols-1 gap-3 min-[520px]:grid-cols-[minmax(0,1fr)_auto] min-[520px]:items-start">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
            <h3 className="break-words text-base font-semibold leading-snug tracking-tight text-foreground">
              {formatNoteReferenceDisplay(note.noteReference)}
            </h3>
            {hasRiskRating ? (
              <>
                <HeaderDivider className="hidden min-[380px]:block" />
                <SoukscoreRiskRatingBadge
                  riskRating={note.riskRating}
                  className="shrink-0 border px-2 py-0.5 text-sm font-semibold leading-none tracking-tight"
                />
              </>
            ) : null}
          </div>
          <div className="flex min-w-0 justify-start min-[520px]:justify-end">
            <NoteStatusBadge
              note={note}
              viewer="investor"
              className="max-w-full text-xs font-semibold"
            />
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <p className="break-words text-sm leading-snug text-muted-foreground">
            Repayment received:{" "}
            <span className="font-semibold text-foreground tabular-nums">
              {repaymentAmountDisplay}
            </span>
          </p>
          <p className="break-words text-sm leading-snug text-muted-foreground">
            Your profit:{" "}
            <span className="font-semibold text-foreground tabular-nums">
              {profitAmountDisplay}
            </span>
          </p>
        </div>
      </div>

      <div className="mt-3">
        <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] xl:items-start">
          <div className="grid min-w-0 grid-cols-1 gap-2 lg:grid-cols-2">
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
                    {formatInvestorReturnRatePercent(expectedReturn)}
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

          <div className="flex min-w-0 flex-col rounded-xl bg-muted/20 p-2.5 text-center">
            <p className="mt-1 text-[clamp(2rem,5vw,3.25rem)] font-semibold leading-none tracking-tight text-foreground">
              {actualReturn}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{returnLabel}</p>
            <div className="mt-3 space-y-2 border-t border-border/60 pt-2">
              {resolvedFooterRows.map((row) => {
                const RowIcon = row.icon ?? CalendarDaysIcon;
                return (
                  <div
                    key={row.label}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <div className="inline-flex items-center gap-2 text-muted-foreground">
                      <RowIcon className="h-4 w-4" />
                      {row.label}
                    </div>
                    <span className="font-medium text-foreground">{row.value}</span>
                  </div>
                );
              })}
              {showDetailLink ? (
                <div className="flex justify-end pt-1">
                  <Button asChild variant="link" className="h-auto p-0 text-sm text-primary">
                    <Link href={detailHref} className="inline-flex items-center gap-1.5">
                      View details
                      <ArrowRightIcon className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
