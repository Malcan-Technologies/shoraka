"use client";

import { MarketplaceNoteCard } from "./marketplace-note-card";
import { MarketplaceSnapCarousel } from "./marketplace-snap-carousel";
import {
  assignFeaturedMarketplaceTags,
  type MarketplaceNote,
} from "./marketplace-note-model";

export function MarketplaceFeaturedSection({
  notes,
  onInvest,
  onViewProspectus,
}: {
  notes: MarketplaceNote[];
  onInvest: (note: MarketplaceNote) => void;
  onViewProspectus: (note: MarketplaceNote) => void;
}) {
  if (notes.length === 0) return null;

  const featuredTags = assignFeaturedMarketplaceTags(notes);

  return (
    <section>
      <MarketplaceSnapCarousel
        compact
        ariaLabel="Featured marketplace notes"
        header={
          <div className="space-y-1">
            <p className="text-meta font-semibold uppercase tracking-wider text-primary">
              Featured
            </p>
            <p className="text-ui text-muted-foreground">
              Highlighted notes still open for funding.
              <span>
                {" "}
                · {notes.length} {notes.length === 1 ? "note" : "notes"}
              </span>
            </p>
          </div>
        }
        items={notes.map((note) => ({
          key: note.id,
          node: (
            <MarketplaceNoteCard
              note={note}
              variant="featured"
              featuredTag={featuredTags.get(note.id)}
              onInvest={onInvest}
              onViewProspectus={onViewProspectus}
            />
          ),
        }))}
      />
    </section>
  );
}
