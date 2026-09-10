"use client";

import Link from "next/link";
import { Card, CardContent, StatusBadge } from "@cashsouk/ui";
import { formatCurrency } from "@cashsouk/config";
import {
  formatInvestorReturnRatePercent,
  formatNoteReferenceDisplay,
  type NoteListItem,
} from "@cashsouk/types";
import { InvestNowButton } from "@/components/invest-now-button";
import { cn } from "@/lib/utils";
import {
  marketplaceFundingBarClasses,
  marketplaceListingUrgency,
  marketplaceNoteHeadline,
  toMarketplaceNote,
} from "@/marketplace/marketplace-note-model";

const STRIP_LIMIT = 4;

export function InvestorDashboardMarketplaceStrip({
  notes,
  totalCount,
  seekingFunding,
}: {
  notes: NoteListItem[];
  totalCount: number;
  seekingFunding: number | null;
}) {
  const strip = notes.slice(0, STRIP_LIMIT);
  const countLabel = `${totalCount} ${totalCount === 1 ? "note" : "notes"} open`;
  const fundingLabel =
    seekingFunding != null ? ` · ${formatCurrency(seekingFunding)} seeking funding` : "";

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-section-title text-primary">Live on the marketplace</h2>
          <p className="mt-1 text-ui text-muted-foreground">
            {countLabel}
            {fundingLabel}
          </p>
        </div>
        <Link href="/marketplace" className="text-ui font-medium text-primary">
          See all notes →
        </Link>
      </div>
      {strip.length === 0 ? (
        <p className="text-ui text-muted-foreground">No notes are open for funding right now.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {strip.map((note) => (
            <MarketplaceStripCard key={note.id} note={note} />
          ))}
        </div>
      )}
    </section>
  );
}

function MarketplaceStripCard({ note }: { note: NoteListItem }) {
  const market = toMarketplaceNote(note);
  const title = note.issuerName?.trim() || marketplaceNoteHeadline(market);
  const closing = market.daysLeft != null && market.daysLeft <= 1;
  const bar = marketplaceFundingBarClasses(market);

  return (
    <Card className="flex flex-col rounded-2xl shadow-sm">
      <CardContent className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-ui font-semibold text-foreground">{title}</p>
            <p className="mt-0.5 text-meta tabular-nums text-muted-foreground">
              {formatNoteReferenceDisplay(note.noteReference)}
              {note.issuerIndustry?.trim() ? ` · ${note.issuerIndustry.trim()}` : null}
            </p>
          </div>
          <StatusBadge
            label={closing ? "Closing" : "Open"}
            status={closing ? "action" : "submitted"}
            size="sm"
            showDot
          />
        </div>
        <div className="mt-4 flex gap-5">
          <div>
            <p className="text-meta text-muted-foreground">Expected return</p>
            <p className="text-lg font-bold tabular-nums tracking-tight text-primary">
              {formatInvestorReturnRatePercent(market.annualReturn)}
            </p>
          </div>
          <div>
            <p className="text-meta text-muted-foreground">Tenor</p>
            <p className="text-lg font-bold tabular-nums tracking-tight text-foreground">
              {market.tenorDays != null ? `${market.tenorDays}d` : "—"}
            </p>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-meta tabular-nums text-muted-foreground">
            <span>
              {formatCurrency(market.fundedAmount)} of {formatCurrency(market.goalAmount)}
            </span>
            <span className="font-semibold text-foreground">{market.fundingPercent}%</span>
          </div>
          <div className={cn("mt-1.5 h-2 overflow-hidden rounded-full", bar.track)}>
            <div
              className={cn("h-full rounded-full", closing ? "bg-status-action-text" : bar.fill)}
              style={{ width: `${market.fundingPercent}%` }}
            />
          </div>
          <p className="mt-1.5 text-meta text-muted-foreground">
            {marketplaceListingUrgency(market)}
            {market.investorCount > 0
              ? ` · ${market.investorCount} ${market.investorCount === 1 ? "investor" : "investors"}`
              : null}
          </p>
        </div>
        <InvestNowButton
          href={`/investments/${note.id}`}
          showIcon={false}
          className="mt-4 h-10 w-full rounded-xl font-semibold"
        >
          Invest
        </InvestNowButton>
      </CardContent>
    </Card>
  );
}
