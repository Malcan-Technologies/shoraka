import {
  formatInvestorReturnRatePercent,
  marketplaceCardDaysLeftLabel,
  type MarketplaceNote,
} from "@cashsouk/types";
import { SoukscoreRiskRatingBadge, cn } from "@cashsouk/ui";
import {
  MarketplaceNoteFundingRow,
  MarketplaceNoteHeadlineBlock,
  MarketplaceNoteInvestActions,
  MarketplaceNoteRateTenure,
} from "./marketplace-note-card-shared";

const COMPARE_GRID_CLASS =
  "grid-cols-[minmax(14rem,2.4fr)_5.25rem_5.25rem_5.25rem_minmax(11rem,1.5fr)_8.75rem]";

export function MarketplaceCompareTable({ notes }: { notes: readonly MarketplaceNote[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="lg:hidden">
        {notes.map((note) => (
          <article key={note.id} className="space-y-4 border-b border-border px-4 py-5 last:border-b-0 sm:px-5">
            <MarketplaceNoteHeadlineBlock
              note={note}
              trailing={
                note.riskScore ? (
                  <SoukscoreRiskRatingBadge riskRating={note.riskScore} className="shrink-0" />
                ) : undefined
              }
            />
            <MarketplaceNoteRateTenure note={note} size="listing" />
            <MarketplaceNoteFundingRow note={note} />
            <MarketplaceNoteInvestActions note={note} className="mt-0 pt-0" />
          </article>
        ))}
      </div>

      <div className="hidden lg:block">
        <div
          className={cn(
            "grid gap-4 border-b border-border bg-muted/40 px-5 py-3.5 text-meta font-semibold uppercase tracking-wider text-muted-foreground",
            COMPARE_GRID_CLASS
          )}
        >
          <div>Note</div>
          <div className="text-right">Rate</div>
          <div className="text-right">Tenure</div>
          <div className="text-right">Grade</div>
          <div>Funding</div>
          <div />
        </div>
        {notes.map((note) => (
          <div
            key={note.id}
            className={cn(
              "grid items-start gap-4 border-b border-border px-5 py-4 last:border-b-0 odd:bg-muted/40 hover:bg-muted",
              COMPARE_GRID_CLASS
            )}
          >
            <MarketplaceNoteHeadlineBlock note={note} />
            <div className="text-right">
              <div className="text-xl font-bold tabular-nums tracking-tight text-primary">
                {formatInvestorReturnRatePercent(note.annualReturn)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-ui font-medium tabular-nums text-foreground">
                {note.timing.compactValue}
              </div>
              <div className="mt-1 text-meta tabular-nums text-muted-foreground">
                {marketplaceCardDaysLeftLabel(note)}
              </div>
            </div>
            <div className="flex justify-end">
              <SoukscoreRiskRatingBadge riskRating={note.riskScore} />
            </div>
            <MarketplaceNoteFundingRow note={note} />
            <MarketplaceNoteInvestActions note={note} className="mt-0 pt-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
