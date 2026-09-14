"use client";

import * as React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  marketplaceCarouselOverflows,
  marketplaceSlideWidthClass,
  nearestMarketplaceSlideIndex,
  nextMarketplaceSlideIndex,
} from "./marketplace-snap-carousel-utils";

function CarouselNavButtons({
  activeIndex,
  count,
  wrap = true,
  onScrollTo,
}: {
  activeIndex: number;
  count: number;
  wrap?: boolean;
  onScrollTo: (index: number) => void;
}) {
  const atStart = activeIndex <= 0;
  const atEnd = activeIndex >= count - 1;
  return (
    <div className="flex shrink-0 gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Previous featured note"
        disabled={!wrap && atStart}
        onClick={() => onScrollTo(nextMarketplaceSlideIndex(activeIndex, count, -1))}
      >
        <ChevronLeftIcon className="h-5 w-5" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Next featured note"
        disabled={!wrap && atEnd}
        onClick={() => onScrollTo(nextMarketplaceSlideIndex(activeIndex, count, 1))}
      >
        <ChevronRightIcon className="h-5 w-5" />
      </Button>
    </div>
  );
}

export function MarketplaceSnapCarousel({
  items,
  ariaLabel,
  compact = false,
  header,
}: {
  items: Array<{ key: string; node: React.ReactNode }>;
  ariaLabel: string;
  compact?: boolean;
  header?: React.ReactNode;
}) {
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [overflows, setOverflows] = React.useState(false);
  const count = items.length;
  const showHeaderControls = Boolean(header) && count > 1 && overflows;
  const showFooterControls = !header && count > 1 && overflows;
  const slideWidthClass = marketplaceSlideWidthClass(count, compact);

  const readSlideState = React.useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const slides = Array.from(el.querySelectorAll<HTMLElement>("[data-marketplace-slide]"));
    const nextOverflows = marketplaceCarouselOverflows(el.scrollWidth, el.clientWidth);
    const nextIndex = nearestMarketplaceSlideIndex(
      slides.map((slide) => slide.offsetLeft),
      el.scrollLeft,
      { clientWidth: el.clientWidth, scrollWidth: el.scrollWidth }
    );
    setOverflows((prev) => (prev === nextOverflows ? prev : nextOverflows));
    setActiveIndex((prev) => (prev === nextIndex ? prev : nextIndex));
  }, []);

  React.useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    readSlideState();
    const frame = requestAnimationFrame(readSlideState);
    const observer = new ResizeObserver(() => readSlideState());
    observer.observe(el);
    el.addEventListener("scroll", readSlideState, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      el.removeEventListener("scroll", readSlideState);
    };
  }, [count, readSlideState]);

  const scrollToIndex = React.useCallback((index: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const slide = el.querySelectorAll<HTMLElement>("[data-marketplace-slide]")[index];
    if (!slide) return;
    el.scrollTo({
      left: slide.offsetLeft,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }, []);

  if (count === 0) return null;

  return (
    <div className="space-y-4">
      {header ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">{header}</div>
          {showHeaderControls ? (
            <CarouselNavButtons
              activeIndex={activeIndex}
              count={count}
              wrap={!compact}
              onScrollTo={scrollToIndex}
            />
          ) : null}
        </div>
      ) : null}

      <div
        ref={scrollerRef}
        role="region"
        aria-roledescription="carousel"
        aria-label={ariaLabel}
        className={cn(
          "flex overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          compact ? "gap-4 snap-x snap-mandatory" : "gap-6",
          !compact && count > 1 ? "snap-x snap-mandatory" : null
        )}
      >
        {items.map((item, index) => (
          <div
            key={item.key}
            data-marketplace-slide
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${count}`}
            className={cn("flex", slideWidthClass, compact || count > 1 ? "snap-start" : null)}
          >
            {item.node}
          </div>
        ))}
      </div>

      {showFooterControls ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-ui text-muted-foreground" aria-live="polite">
            {activeIndex + 1} of {count}
          </p>
          <CarouselNavButtons activeIndex={activeIndex} count={count} onScrollTo={scrollToIndex} />
        </div>
      ) : null}
    </div>
  );
}
