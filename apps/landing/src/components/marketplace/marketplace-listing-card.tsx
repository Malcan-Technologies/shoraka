import type { MarketplaceNote } from "@cashsouk/types";
import { SoukscoreRiskRatingBadge } from "@cashsouk/ui";
import {
  MarketplaceNoteFundingRow,
  MarketplaceNoteHeadlineBlock,
  MarketplaceNoteInvestActions,
  MarketplaceNoteRateTenure,
} from "./marketplace-note-card-shared";

export function MarketplaceListingCard({ note }: { note: MarketplaceNote }) {
  return (
    <article className="flex h-full w-full min-w-0 flex-col rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <MarketplaceNoteHeadlineBlock
        note={note}
        trailing={
          note.riskScore ? (
            <SoukscoreRiskRatingBadge riskRating={note.riskScore} className="shrink-0" />
          ) : undefined
        }
      />
      <div className="mt-5">
        <MarketplaceNoteRateTenure note={note} size="listing" />
      </div>
      <div className="mt-4">
        <MarketplaceNoteFundingRow note={note} />
      </div>
      <MarketplaceNoteInvestActions note={note} />
    </article>
  );
}
