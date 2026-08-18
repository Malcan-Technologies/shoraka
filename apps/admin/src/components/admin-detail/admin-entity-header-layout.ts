import { cn } from "@/lib/utils";

export const HERO_SUMMARY_CARD_LIMIT = 3;

/** Layout for hero KPI wells: full-width when stacked, up to 20rem each when the row has room. */
export function heroSummaryClusterClass(count: number): string {
  const n = Math.max(0, Math.min(count, HERO_SUMMARY_CARD_LIMIT));
  return cn(
    "grid w-full items-stretch gap-3",
    n <= 1 ? "grid-cols-1" : n === 2 ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-3",
    "lg:flex lg:min-w-0 lg:grow-0 lg:shrink lg:justify-end",
    n <= 1 && "lg:w-[20rem] lg:max-w-[min(20rem,calc(100%-14rem))]",
    n === 2 && "lg:w-[41rem] lg:max-w-[min(41rem,calc(100%-14rem))]",
    n >= 3 && "lg:w-[62rem] lg:max-w-[min(62rem,calc(100%-14rem))]"
  );
}
