"use client";

import * as React from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/solid";
import {
  InvestmentListingCard,
  type InvestmentListingData,
} from "./investment-listing-card";

const LISTING_SAMPLES: InvestmentListingData[] = [
  {
    title: "Invoice financing (Islamic)",
    sector: "Food & Beverages",
    noteRef: "00011",
    daysLeft: 14,
    funded: 3000,
    goal: 24000,
    ratePercent: 15,
    tenorDays: 45,
    score: "A",
  },
  {
    title: "Purchase order financing",
    sector: "Wholesale & retail",
    noteRef: "00024",
    daysLeft: 9,
    funded: 12000,
    goal: 50000,
    ratePercent: 12,
    tenorDays: 60,
    score: "A+",
  },
  {
    title: "Asset-light receivables",
    sector: "Logistics",
    noteRef: "00008",
    daysLeft: 21,
    funded: 48000,
    goal: 72000,
    ratePercent: 13.5,
    tenorDays: 90,
    score: "A",
  },
  {
    title: "SME invoice facility",
    sector: "Manufacturing",
    noteRef: "00033",
    daysLeft: 6,
    funded: 18500,
    goal: 40000,
    ratePercent: 14,
    tenorDays: 30,
    score: "B+",
  },
  {
    title: "Shariah-compliant trade line",
    sector: "Healthcare supplies",
    noteRef: "00041",
    daysLeft: 18,
    funded: 62000,
    goal: 95000,
    ratePercent: 11.75,
    tenorDays: 75,
    score: "A",
  },
  {
    title: "Working capital (Islamic)",
    sector: "Technology services",
    noteRef: "00019",
    daysLeft: 11,
    funded: 9200,
    goal: 28000,
    ratePercent: 16,
    tenorDays: 45,
    score: "A-",
  },
  {
    title: "Anchor buyer programme",
    sector: "Consumer goods",
    noteRef: "00052",
    daysLeft: 4,
    funded: 71000,
    goal: 88000,
    ratePercent: 12.25,
    tenorDays: 120,
    score: "A+",
  },
];

const AUTO_SCROLL_PX_PER_SEC = 62;

function loopSegmentWidth(el: HTMLElement) {
  return el.scrollWidth > 2 ? el.scrollWidth / 2 : 0;
}

export function InvestmentListingsCarousel() {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const pausedRef = React.useRef(false);

  const [pauseHover, setPauseHover] = React.useState(false);
  const [pauseHiddenTab, setPauseHiddenTab] = React.useState(false);
  const [respectMotion, setRespectMotion] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => setRespectMotion(mq.matches);
    read();
    mq.addEventListener("change", read);
    return () => mq.removeEventListener("change", read);
  }, []);

  React.useEffect(() => {
    const onVis = () => setPauseHiddenTab(document.visibilityState === "hidden");
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  React.useEffect(() => {
    pausedRef.current = pauseHover || pauseHiddenTab || respectMotion;
  }, [pauseHover, pauseHiddenTab, respectMotion]);

  const normalizeLoop = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const loop = loopSegmentWidth(el);
    if (loop < 1) return;
    while (el.scrollLeft >= loop) {
      el.scrollLeft -= loop;
    }
    while (el.scrollLeft < 0) {
      el.scrollLeft += loop;
    }
  }, []);

  const scrollByCard = React.useCallback((direction: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) return;
    const slide = el.querySelector("[data-carousel-slide]") as HTMLElement | null;
    const step = (slide?.getBoundingClientRect().width ?? 320) + 24;
    el.scrollBy({ left: direction * step, behavior: "smooth" });
  }, []);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => normalizeLoop();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [normalizeLoop]);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => normalizeLoop());
    ro.observe(el);
    return () => ro.disconnect();
  }, [normalizeLoop]);

  React.useEffect(() => {
    if (respectMotion || LISTING_SAMPLES.length < 2) return;

    let raf = 0;
    let last = performance.now();

    const loop = (now: number) => {
      const el = scrollRef.current;
      if (el && !pausedRef.current) {
        const dt = Math.min((now - last) / 1000, 0.064);
        last = now;
        const half = loopSegmentWidth(el);
        if (half > 1) {
          el.scrollLeft += AUTO_SCROLL_PX_PER_SEC * dt;
          while (el.scrollLeft >= half) {
            el.scrollLeft -= half;
          }
        }
      } else {
        last = now;
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [respectMotion]);

  return (
    <div
      className="relative w-full"
      onMouseEnter={() => setPauseHover(true)}
      onMouseLeave={() => setPauseHover(false)}
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 hidden w-12 bg-gradient-to-r from-muted/35 to-transparent md:block" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 hidden w-12 bg-gradient-to-l from-muted/35 to-transparent md:block" />

      <div
        ref={scrollRef}
        role="region"
        aria-label="Featured investment listings"
        className="flex gap-6 overflow-x-auto overflow-y-hidden overscroll-x-contain pb-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{
          paddingLeft:
            "max(1.5rem, calc((100vw - min(100vw, 80rem)) / 2 + 1.5rem))",
          paddingRight:
            "max(1.5rem, calc((100vw - min(100vw, 80rem)) / 2 + 1.5rem))",
        }}
      >
        {LISTING_SAMPLES.map((data, i) => (
          <div
            key={`${data.noteRef}-set-a-${i}`}
            data-carousel-slide
            className="w-[min(22rem,calc(100vw-3rem))] shrink-0 sm:w-[min(24rem,calc(100vw-3.5rem))] lg:w-[min(26rem,calc(100vw-4rem))]"
          >
            <InvestmentListingCard data={data} showDownloadLink />
          </div>
        ))}
        {LISTING_SAMPLES.map((data, i) => (
          <div
            key={`${data.noteRef}-set-b-${i}`}
            data-carousel-slide
            aria-hidden
            className="w-[min(22rem,calc(100vw-3rem))] shrink-0 sm:w-[min(24rem,calc(100vw-3.5rem))] lg:w-[min(26rem,calc(100vw-4rem))]"
          >
            <InvestmentListingCard data={data} showDownloadLink />
          </div>
        ))}
      </div>

      <div className="mt-8 flex justify-center gap-2">
        <button
          type="button"
          onClick={() => scrollByCard(-1)}
          className="flex size-10 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="Scroll listings left"
        >
          <ChevronLeftIcon className="size-5" />
        </button>
        <button
          type="button"
          onClick={() => scrollByCard(1)}
          className="flex size-10 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="Scroll listings right"
        >
          <ChevronRightIcon className="size-5" />
        </button>
      </div>
    </div>
  );
}
