"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import type { MarketplaceNote } from "@cashsouk/types";
import { Button } from "@cashsouk/ui";
import { MarketplaceFeaturedCard } from "./marketplace-featured-card";
import { marketplaceNotesCountLabel } from "./marketplace-note-display";

function trackEdges(element: HTMLDivElement) {
  return {
    atStart: element.scrollLeft <= 4,
    atEnd: element.scrollLeft + element.clientWidth >= element.scrollWidth - 4,
  };
}

export function MarketplaceFeaturedTrack({ notes }: { notes: readonly MarketplaceNote[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  const updateEdges = useCallback(() => {
    const element = trackRef.current;
    if (!element) return;
    setAtStart(trackEdges(element).atStart);
    setAtEnd(trackEdges(element).atEnd);
  }, []);

  useEffect(() => {
    const element = trackRef.current;
    if (!element) return;
    const frame = window.requestAnimationFrame(updateEdges);
    element.addEventListener("scroll", updateEdges, { passive: true });
    window.addEventListener("resize", updateEdges);
    return () => {
      window.cancelAnimationFrame(frame);
      element.removeEventListener("scroll", updateEdges);
      window.removeEventListener("resize", updateEdges);
    };
  }, [notes, updateEdges]);

  const scrollByCard = (direction: -1 | 1) => {
    const element = trackRef.current;
    if (!element) return;
    const card = element.firstElementChild as HTMLElement | null;
    const gap = Number.parseFloat(getComputedStyle(element).columnGap || getComputedStyle(element).gap) || 16;
    const step = card ? card.getBoundingClientRect().width + gap : element.clientWidth * 0.8;
    element.scrollBy({ left: direction * step, behavior: "smooth" });
  };

  if (notes.length === 0) return null;

  return (
    <section>
      <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
          <span className="text-meta font-semibold uppercase tracking-wider text-primary">
            Featured
          </span>
          <span className="text-ui text-muted-foreground">Selected by the CashSouk credit team</span>
          <span className="text-meta tabular-nums text-muted-foreground">
            · {marketplaceNotesCountLabel(notes.length)}
          </span>
        </div>
        <div className="flex items-center gap-3.5 sm:ml-auto">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="rounded-full"
              aria-label="Previous featured notes"
              disabled={atStart}
              onClick={() => scrollByCard(-1)}
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="rounded-full"
              aria-label="More featured notes"
              disabled={atEnd}
              onClick={() => scrollByCard(1)}
            >
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div
        ref={trackRef}
        className="mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto overflow-y-hidden pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {notes.map((note) => (
            <div key={note.id} className="w-[min(20rem,calc(100%-2.5rem))] flex-none snap-start">
            <MarketplaceFeaturedCard note={note} featuredNotes={notes} />
          </div>
        ))}
      </div>
    </section>
  );
}
