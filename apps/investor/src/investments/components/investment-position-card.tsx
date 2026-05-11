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
import type { NoteListItem } from "@cashsouk/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getInvestmentStatusLabel } from "@/investments/sort-investments";

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

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-MY", {
    year: "numeric",
    month: "short",
    day: "numeric",
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
};

export function InvestmentPositionCard({
  note,
  detailHref = `/investments/${note.id}`,
  showDetailLink = true,
  footerRows = [],
  investmentDateValue,
}: InvestmentPositionCardProps) {
  const repaymentSummary = note.investorRepaymentSummary ?? null;
  const expectedReturn = Number(
    repaymentSummary?.expectedReturnRatePercent ?? note.profitRatePercent ?? 0
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
  const totalExpectedAmount = Number(
    repaymentSummary?.expectedPayoutAmount ??
      investedAmount + investedAmount * (expectedReturn / 100)
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
  const returnLabel = isPendingConfirmation
    ? "Expected return"
    : hasActualReturn
      ? "Actual return"
      : "Pending settlement";
  const displayDate = formatDate(investmentDateValue ?? note.updatedAt);

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
              <p className="text-sm font-semibold leading-none text-muted-foreground md:text-base">
                {note.riskRating}
              </p>
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
            <p className="mt-1 text-sm text-muted-foreground">{returnLabel}</p>
            {footerRows.length > 0 ? (
              <div className="mt-3 space-y-2 border-t border-border/60 pt-2">
                {footerRows.map((row) => {
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
              </div>
            ) : showDetailLink ? (
              <div className="mt-3 border-t border-border/60 pt-2">
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
  );
}
