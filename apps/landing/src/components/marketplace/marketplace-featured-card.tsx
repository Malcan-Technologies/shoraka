import {
  deriveFeaturedMarketplaceTag,
  type MarketplaceNote,
} from "@cashsouk/types";
import { SoukscoreRiskRatingBadge } from "@cashsouk/ui";
import {
  MarketplaceNoteFundingRow,
  MarketplaceNoteHeadlineBlock,
  MarketplaceNoteInvestActions,
  MarketplaceNoteRateTenure,
} from "./marketplace-note-card-shared";

export function MarketplaceFeaturedCard({
  note,
  featuredNotes,
}: {
  note: MarketplaceNote;
  featuredNotes: readonly MarketplaceNote[];
}) {
  const tag = deriveFeaturedMarketplaceTag(note, featuredNotes);

  return (
    <article className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="h-[3px] bg-primary" aria-hidden="true" />
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-meta font-semibold uppercase tracking-wider text-primary">
          <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
          <span className="truncate">{tag}</span>
        </span>
        <div className="mt-3.5">
          <MarketplaceNoteHeadlineBlock
            note={note}
            trailing={
              note.riskScore ? (
                <SoukscoreRiskRatingBadge riskRating={note.riskScore} className="shrink-0" />
              ) : undefined
            }
          />
        </div>
        <div className="mt-5">
          <MarketplaceNoteRateTenure note={note} size="featured" />
        </div>
        <div className="mt-4">
          <MarketplaceNoteFundingRow note={note} />
        </div>
        <MarketplaceNoteInvestActions note={note} />
      </div>
    </article>
  );
}
