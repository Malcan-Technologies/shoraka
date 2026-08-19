"use client";

import * as React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  attentionCarouselOverflows,
  attentionSlideWidthClass,
  nearestAttentionSlideIndex,
  nextAttentionSlideIndex,
  type AttentionSlideVariant,
} from "./attention-snap-carousel-utils";

export function AttentionSnapCarousel({
  items,
  ariaLabel,
  variant = "featured",
  previousLabel = "Previous item",
  nextLabel = "Next item",
}: {
  items: Array<{ key: string; node: React.ReactNode }>;
  ariaLabel: string;
  variant?: AttentionSlideVariant;
  previousLabel?: string;
  nextLabel?: string;
}) {
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [overflows, setOverflows] = React.useState(false);
  const count = items.length;
  const showControls = count > 1 && overflows;
  const slideWidthClass = attentionSlideWidthClass(count, variant);

  const readSlideState = React.useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const slides = Array.from(el.querySelectorAll<HTMLElement>("[data-attention-slide]"));
    const nextOverflows = attentionCarouselOverflows(el.scrollWidth, el.clientWidth);
    const nextIndex = nearestAttentionSlideIndex(
      slides.map((slide) => slide.offsetLeft),
      el.scrollLeft
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
    const slide = el.querySelectorAll<HTMLElement>("[data-attention-slide]")[index];
    if (!slide) return;
    el.scrollTo({
      left: slide.offsetLeft,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }, []);

  if (count === 0) return null;

  return (
    <div className="space-y-3">
      <div
        ref={scrollerRef}
        role="region"
        aria-roledescription="carousel"
        aria-label={ariaLabel}
        className={cn(
          "flex gap-4 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          count > 1 ? "snap-x snap-mandatory" : null
        )}
      >
        {items.map((item, index) => (
          <div
            key={item.key}
            data-attention-slide
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${count}`}
            className={cn("flex", slideWidthClass, count > 1 ? "snap-start" : null)}
          >
            {item.node}
          </div>
        ))}
      </div>

      {showControls ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-ui text-muted-foreground" aria-live="polite">
            {activeIndex + 1} of {count}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={previousLabel}
              onClick={() => scrollToIndex(nextAttentionSlideIndex(activeIndex, count, -1))}
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={nextLabel}
              onClick={() => scrollToIndex(nextAttentionSlideIndex(activeIndex, count, 1))}
            >
              <ChevronRightIcon className="h-5 w-5" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
