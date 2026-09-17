"use client";

import { DocumentTextIcon } from "@heroicons/react/24/outline";
import {
  formatInvestorReturnRatePercent,
  marketplaceAmountTitle,
  marketplaceCardDaysLeftLabel,
  marketplaceCardTenureLabel,
  marketplaceInvestorSummary,
} from "@cashsouk/types";
import { FundingProgress, InfoTooltip, SoukscoreRiskRatingBadge } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { MarketplaceReturnRateTooltip } from "@/investments/components/investment-return-breakdown";
import { cn } from "@/lib/utils";
import { MarketplaceFailedFundingTooltip } from "./marketplace-failed-funding-tooltip";
import { MarketplaceNoteIdentity } from "./marketplace-note-identity";
import {
  marketplaceAdvertisedGrossReturnLabel,
  marketplaceExactFundedGoalLabel,
  marketplaceFundingBarClasses,
  marketplaceFundingProgressCaption,
  marketplaceInvestActionLabel,
  type FeaturedMarketplaceTag,
  type MarketplaceNote,
} from "./marketplace-note-model";

function MarketplaceNoteMetrics({
  note,
  size,
}: {
  note: MarketplaceNote;
  size: "featured" | "listing";
}) {
  const valueClass = cn(
    "font-bold tabular-nums leading-none tracking-tight",
    size === "featured" ? "text-3xl" : "text-2xl"
  );

  return (
    <div className="grid grid-cols-2 items-start gap-x-4 gap-y-1 border-t border-border pt-4">
      <div className="flex min-h-5 items-center gap-1 text-meta font-semibold uppercase tracking-wider text-muted-foreground">
        {marketplaceAdvertisedGrossReturnLabel(note)}
        <MarketplaceReturnRateTooltip />
      </div>
      <div className="flex min-h-5 items-center gap-1 text-meta font-semibold uppercase tracking-wider text-muted-foreground">
        <span>{marketplaceCardTenureLabel(note)}</span>
        {note.timing.tooltip ? (
          <InfoTooltip content={note.timing.tooltip} iconClassName="h-3.5 w-3.5" />
        ) : null}
      </div>
      <p className={cn(valueClass, "text-primary")}>
        {formatInvestorReturnRatePercent(note.annualReturn)}
      </p>
      <p className={cn(valueClass, "text-foreground")}>{note.timing.compactValue}</p>
    </div>
  );
}

function MarketplaceNoteFunding({ note }: { note: MarketplaceNote }) {
  const bar = marketplaceFundingBarClasses(note);

  return (
    <div>
      <FundingProgress
        percent={note.fundingPercent}
        thresholdPercent={note.minimumFundingPercent}
        fillClassName={bar.fill}
        trackClassName={bar.track}
        aria-label={`${note.fundingPercent}% funded. ${note.minimumFundingPercent}% minimum required for funding to succeed.`}
      />
      <div className="mt-2 flex flex-wrap justify-between gap-2 text-meta tabular-nums text-muted-foreground">
        <span className="inline-flex items-center gap-1 font-semibold text-foreground">
          {marketplaceFundingProgressCaption(note)}
          {note.listingKind === "open" ? (
            <MarketplaceFailedFundingTooltip minimumPercent={note.minimumFundingPercent} />
          ) : null}
        </span>
        <span title={marketplaceAmountTitle(note)}>{marketplaceExactFundedGoalLabel(note)}</span>
        <span>{marketplaceCardDaysLeftLabel(note)}</span>
      </div>
      <p className="mt-2 text-ui text-muted-foreground">{marketplaceInvestorSummary(note)}</p>
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
    <div className="mt-auto flex flex-col gap-2 pt-5">
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

export function MarketplaceNoteCard({
  note,
  variant = "listing",
  featuredTag,
  onInvest,
  onViewProspectus,
}: {
  note: MarketplaceNote;
  variant?: "listing" | "featured";
  featuredTag?: FeaturedMarketplaceTag;
  onInvest: (note: MarketplaceNote) => void;
  onViewProspectus?: (note: MarketplaceNote) => void;
}) {
  const featured = variant === "featured";

  return (
    <article className="relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm md:p-5">
      {featured ? (
        <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] bg-primary" />
      ) : null}

      {featured && featuredTag ? (
        <span className="inline-flex min-w-0 items-center gap-1.5 text-meta font-semibold uppercase tracking-wider text-primary">
          <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
          <span className="truncate">{featuredTag}</span>
        </span>
      ) : null}

      <div className={featured && featuredTag ? "mt-3.5" : undefined}>
        <MarketplaceNoteIdentity
          note={note}
          leadSize="md"
          trailing={
            note.riskScore ? (
              <SoukscoreRiskRatingBadge riskRating={note.riskScore} className="shrink-0" />
            ) : undefined
          }
        />
      </div>
      <div className="mt-5">
        <MarketplaceNoteMetrics note={note} size={featured ? "featured" : "listing"} />
      </div>
      <div className="mt-4">
        <MarketplaceNoteFunding note={note} />
      </div>
      <MarketplaceNoteActions
        note={note}
        onInvest={onInvest}
        onViewProspectus={onViewProspectus}
      />
    </article>
  );
}
