"use client";

import { StarIcon } from "@heroicons/react/24/solid";
import { MarketplaceNoteCard } from "./marketplace-note-card";
import { MarketplaceSnapCarousel } from "./marketplace-snap-carousel";
import type { MarketplaceNote } from "./marketplace-note-model";

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

  const orientation = notes.length === 1 ? "row" : "stack";

  return (
    <section className="space-y-6 rounded-2xl border border-secondary/40 bg-secondary/15 p-6 md:p-8">
      <div className="flex items-start gap-2">
        <StarIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">Featured</h2>
          <p className="text-ui text-muted-foreground">
            Highlighted notes still open for funding.
          </p>
        </div>
      </div>
      <MarketplaceSnapCarousel
        ariaLabel="Featured marketplace notes"
        items={notes.map((note) => ({
          key: note.id,
          node: (
            <MarketplaceNoteCard
              note={note}
              variant="featured"
              orientation={orientation}
              onInvest={onInvest}
              onViewProspectus={onViewProspectus}
            />
          ),
        }))}
      />
    </section>
  );
}
