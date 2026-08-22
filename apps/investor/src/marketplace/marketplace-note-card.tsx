"use client";

import type { ReactNode } from "react";
import { BanknotesIcon, DocumentTextIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import { StarIcon } from "@heroicons/react/24/solid";
import { formatInvestorReturnRatePercent } from "@cashsouk/types";
import { Button } from "@/components/ui/button";
import { MarketplaceReturnRateTooltip } from "@/investments/components/investment-return-breakdown";
import {
  InvestmentKpiBox,
  LARGE_METRIC_CLASS,
  formatRiskScore,
} from "@/investments/components/investment-card-metrics";
import { cn } from "@/lib/utils";
import { MarketplaceFailedFundingTooltip } from "./marketplace-failed-funding-tooltip";
import { MarketplaceNoteIdentity } from "./marketplace-note-identity";
import {
  marketplaceFundingBarClasses,
  marketplaceFundingSummary,
  marketplaceInvestActionLabel,
  marketplaceInvestAnyAmountLabel,
  marketplaceInvestorSummary,
  marketplaceListingUrgency,
  type MarketplaceNote,
} from "./marketplace-note-model";

function MarketplaceHighlight({
  icon: Icon,
  children,
}: {
  icon: typeof BanknotesIcon;
  children: ReactNode;
}) {
  return (
    <p className="flex items-start gap-2 text-ui text-foreground">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

function MarketplaceFundingBar({ note }: { note: MarketplaceNote }) {
  const threshold = note.minimumFundingPercent;
  const showThreshold = threshold > 0 && threshold < 100;
  const bar = marketplaceFundingBarClasses(note);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="relative pt-4">
          {showThreshold ? (
            <span
              className="pointer-events-none absolute top-0 -translate-x-1/2 text-meta leading-none text-muted-foreground"
              style={{ left: `${threshold}%` }}
            >
              {threshold}%
            </span>
          ) : null}
          <div
            className="relative h-1.5"
            role="img"
            aria-label={`${note.fundingPercent}% funded. ${threshold}% minimum required for funding to succeed.`}
          >
            <div className={cn("absolute inset-0 overflow-hidden rounded-full", bar.track)}>
              <div
                className={cn("h-full rounded-full transition-all", bar.fill)}
                style={{ width: `${note.fundingPercent}%` }}
              />
            </div>
            {showThreshold ? (
              <span
                aria-hidden="true"
                className="absolute top-1/2 z-10 h-3.5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground"
                style={{ left: `${threshold}%` }}
              />
            ) : null}
          </div>
        </div>
        <p className="text-ui text-muted-foreground">
          {marketplaceFundingSummary(note)} · {marketplaceListingUrgency(note)}
        </p>
      </div>
      <div className="space-y-1.5">
        {note.investable ? (
          <MarketplaceHighlight icon={BanknotesIcon}>
            <span className="inline-flex items-center gap-1.5">
              {marketplaceInvestAnyAmountLabel(note)}
              <MarketplaceFailedFundingTooltip minimumPercent={note.minimumFundingPercent} />
            </span>
          </MarketplaceHighlight>
        ) : null}
        <MarketplaceHighlight icon={UserGroupIcon}>
          {marketplaceInvestorSummary(note)}
        </MarketplaceHighlight>
      </div>
    </div>
  );
}

function MarketplaceNoteMetrics({
  note,
  className,
}: {
  note: MarketplaceNote;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-3 items-stretch gap-2", className)}>
      <div className="flex min-h-28 flex-col items-center justify-center rounded-xl border border-border bg-muted/40 px-2 py-3 text-center">
        <p className={cn("font-semibold tabular-nums text-foreground", LARGE_METRIC_CLASS)}>
          {formatInvestorReturnRatePercent(note.annualReturn)}
        </p>
        <p className="mt-1 inline-flex items-center justify-center gap-1 text-ui text-muted-foreground">
          p.a.
          <MarketplaceReturnRateTooltip />
        </p>
      </div>
      <InvestmentKpiBox
        value={formatRiskScore(note.riskScore)}
        label="Score"
        valueClassName="text-foreground"
      />
      <InvestmentKpiBox
        value={note.tenorDays != null ? String(note.tenorDays) : "—"}
        label="Days"
        valueClassName="text-foreground"
      />
    </div>
  );
}

function MarketplaceNoteActions({
  note,
  onInvest,
  onViewProspectus,
}: {
  note: MarketplaceNote;
  onInvest: (note: MarketplaceNote) => void;
  onViewProspectus?: (note: MarketplaceNote) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="action"
        className="h-10 w-full rounded-xl"
        disabled={!note.investable}
        onClick={() => note.investable && onInvest(note)}
      >
        {marketplaceInvestActionLabel(note)}
      </Button>
      <Button
        variant="ghost"
        className="h-10 w-full rounded-xl text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        onClick={() => onViewProspectus?.(note)}
      >
        <DocumentTextIcon className="h-4 w-4" />
        View prospectus
      </Button>
    </div>
  );
}

function FeaturedMark() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-ui font-normal text-primary-foreground">
      <StarIcon className="h-3.5 w-3.5" aria-hidden="true" />
      Featured
    </span>
  );
}

export function MarketplaceNoteCard({
  note,
  variant = "listing",
  orientation = "row",
  onInvest,
  onViewProspectus,
}: {
  note: MarketplaceNote;
  variant?: "listing" | "featured";
  orientation?: "row" | "stack";
  onInvest: (note: MarketplaceNote) => void;
  onViewProspectus?: (note: MarketplaceNote) => void;
}) {
  const featured = variant === "featured";
  const stacked = featured && orientation === "stack";

  return (
    <article
      className={cn(
        "relative flex h-full w-full flex-col overflow-hidden rounded-2xl border",
        featured
          ? "border-primary/25 bg-card shadow-brand"
          : "gap-4 border-border bg-card p-4 shadow-sm md:p-5",
        featured && stacked ? "gap-6 p-6 pl-7 md:gap-8 md:p-8 md:pl-9" : null,
        featured && !stacked ? "gap-4 p-6 pl-7 md:p-8 md:pl-9" : null,
        !stacked ? "sm:flex-row sm:items-start sm:justify-between sm:gap-8" : null
      )}
    >
      {featured ? (
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-primary" />
      ) : null}
      <div className={cn("min-w-0 flex-1", stacked ? "space-y-5" : "space-y-4")}>
        <MarketplaceNoteIdentity
          note={note}
          featuredMark={featured ? <FeaturedMark /> : null}
          leadSize={featured ? "lg" : "md"}
          className={stacked ? "gap-4" : undefined}
        />
        <MarketplaceFundingBar note={note} />
      </div>

      <div
        className={cn(
          "flex w-full shrink-0 flex-col",
          stacked ? "gap-5" : "gap-3",
          stacked ? null : "sm:w-96"
        )}
      >
        <MarketplaceNoteMetrics note={note} className={stacked ? "gap-3" : undefined} />
        <MarketplaceNoteActions
          note={note}
          onInvest={onInvest}
          onViewProspectus={onViewProspectus}
        />
      </div>
    </article>
  );
}
