"use client";

import { DocumentTextIcon } from "@heroicons/react/24/outline";
import {
  formatCompactMarketplaceAmountPair,
  formatInvestorReturnRatePercent,
  marketplaceAmountTitle,
  marketplaceCardDaysLeftLabel,
  marketplaceCardRateLabel,
  marketplaceCardTenureLabel,
  marketplaceInvestorSummary,
} from "@cashsouk/types";
import { FundingProgress, InfoTooltip, SoukscoreRiskRatingBadge, cn } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { MarketplaceReturnRateTooltip } from "@/investments/components/investment-return-breakdown";
import { MarketplaceFailedFundingTooltip } from "./marketplace-failed-funding-tooltip";
import { MarketplaceNoteIdentity } from "./marketplace-note-identity";
import {
  marketplaceFundingBarClasses,
  marketplaceInvestActionLabel,
  type MarketplaceNote,
} from "./marketplace-note-model";

const COMPARE_COLUMNS =
  "lg:grid-cols-[minmax(14rem,2fr)_7rem_7.5rem_5.5rem_minmax(12rem,1.25fr)_minmax(8.75rem,9.5rem)]";

function CompareFundingCell({ note }: { note: MarketplaceNote }) {
  const bar = marketplaceFundingBarClasses(note);

  return (
    <div className="min-w-0">
      <FundingProgress
        percent={note.fundingPercent}
        thresholdPercent={note.minimumFundingPercent}
        fillClassName={bar.fill}
        trackClassName={bar.track}
        aria-label={`${note.fundingPercent}% funded. ${note.minimumFundingPercent}% minimum required for funding to succeed.`}
      />
      <div className="mt-1.5 flex flex-wrap justify-between gap-2 text-meta tabular-nums text-muted-foreground">
        <span className="inline-flex items-center gap-1 font-semibold text-foreground">
          {note.fundingPercent}% funded
          {note.listingKind === "open" ? (
            <MarketplaceFailedFundingTooltip minimumPercent={note.minimumFundingPercent} />
          ) : null}
        </span>
        <span title={marketplaceAmountTitle(note)}>
          {formatCompactMarketplaceAmountPair(note.fundedAmount, note.goalAmount)}
        </span>
      </div>
      <p className="mt-2 text-ui text-muted-foreground">{marketplaceInvestorSummary(note)}</p>
    </div>
  );
}

function CompareActionCell({
  note,
  onInvest,
  onViewProspectus,
}: {
  note: MarketplaceNote;
  onInvest: (note: MarketplaceNote) => void;
  onViewProspectus: (note: MarketplaceNote) => void;
}) {
  return (
    <div className="flex w-full flex-col gap-2">
      <Button
        variant="action"
        className="h-10 w-full rounded-xl"
        disabled={!note.investable}
        onClick={() => note.investable && onInvest(note)}
      >
        {marketplaceInvestActionLabel(note)}
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="h-10 w-full rounded-xl text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        onClick={() => onViewProspectus(note)}
      >
        <DocumentTextIcon className="h-4 w-4" />
        View prospectus
      </Button>
    </div>
  );
}

export function MarketplaceCompareTable({
  notes,
  onInvest,
  onViewProspectus,
}: {
  notes: readonly MarketplaceNote[];
  onInvest: (note: MarketplaceNote) => void;
  onViewProspectus: (note: MarketplaceNote) => void;
}) {
  return (
    <div
      role="table"
      aria-label="Marketplace notes"
      className="overflow-hidden rounded-2xl border border-border bg-card"
    >
      <div className="lg:hidden">
        {notes.map((note) => (
          <article
            key={note.id}
            className="space-y-4 border-b border-border px-4 py-5 last:border-b-0"
          >
            <MarketplaceNoteIdentity
              note={note}
              leadSize="md"
              trailing={
                note.riskScore ? (
                  <SoukscoreRiskRatingBadge riskRating={note.riskScore} className="shrink-0" />
                ) : undefined
              }
            />
            <div className="grid grid-cols-2 items-start gap-x-4 gap-y-1 border-t border-border pt-4">
              <div className="flex min-h-5 items-center gap-1 text-meta font-semibold uppercase tracking-wider text-muted-foreground">
                {marketplaceCardRateLabel(note)}
                <MarketplaceReturnRateTooltip />
              </div>
              <div className="flex min-h-5 items-center gap-1 text-meta font-semibold uppercase tracking-wider text-muted-foreground">
                <span>{marketplaceCardTenureLabel(note)}</span>
                {note.timing.tooltip ? (
                  <InfoTooltip content={note.timing.tooltip} iconClassName="h-3.5 w-3.5" />
                ) : null}
              </div>
              <div className="text-2xl font-bold tabular-nums leading-none tracking-tight text-primary">
                {formatInvestorReturnRatePercent(note.annualReturn)}
              </div>
              <div>
                <div className="text-2xl font-bold tabular-nums leading-none tracking-tight text-foreground">
                  {note.timing.compactValue}
                </div>
                <p className="mt-1 text-meta tabular-nums text-muted-foreground">
                  {marketplaceCardDaysLeftLabel(note)}
                </p>
              </div>
            </div>
            <CompareFundingCell note={note} />
            <CompareActionCell
              note={note}
              onInvest={onInvest}
              onViewProspectus={onViewProspectus}
            />
          </article>
        ))}
      </div>

      <div className="hidden lg:block">
        <div
          role="row"
          className={cn(
            "grid items-center gap-4 border-b border-border bg-muted/40 px-4 py-3 text-meta font-semibold uppercase tracking-wider text-muted-foreground",
            COMPARE_COLUMNS
          )}
        >
          <div role="columnheader">Note</div>
          <div role="columnheader">Rate</div>
          <div role="columnheader">Tenure</div>
          <div role="columnheader">Grade</div>
          <div role="columnheader">Funding</div>
          <div role="columnheader" className="text-right">
            Action
          </div>
        </div>
        {notes.map((note) => (
          <div
            key={note.id}
            role="row"
            className={cn(
              "grid items-start gap-4 border-b border-border px-4 py-3 last:border-b-0",
              COMPARE_COLUMNS
            )}
          >
            <div role="cell" className="min-w-0">
              <MarketplaceNoteIdentity note={note} leadSize="md" />
            </div>
            <div role="cell">
              <p className="text-ui font-semibold tabular-nums text-primary">
                {formatInvestorReturnRatePercent(note.annualReturn)}
              </p>
              <p className="mt-0.5 inline-flex items-center gap-1 text-meta text-muted-foreground">
                {marketplaceCardRateLabel(note)}
                <MarketplaceReturnRateTooltip />
              </p>
            </div>
            <div role="cell">
              <p className="inline-flex items-center gap-1 text-ui font-semibold tabular-nums text-foreground">
                {note.timing.compactValue}
                {note.timing.tooltip ? (
                  <InfoTooltip content={note.timing.tooltip} iconClassName="h-3.5 w-3.5" />
                ) : null}
              </p>
              <p className="mt-0.5 text-meta text-muted-foreground">
                {marketplaceCardDaysLeftLabel(note)}
              </p>
            </div>
            <div role="cell">
              <SoukscoreRiskRatingBadge riskRating={note.riskScore} />
            </div>
            <div role="cell" className="min-w-0">
              <CompareFundingCell note={note} />
            </div>
            <div role="cell">
              <CompareActionCell
                note={note}
                onInvest={onInvest}
                onViewProspectus={onViewProspectus}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
