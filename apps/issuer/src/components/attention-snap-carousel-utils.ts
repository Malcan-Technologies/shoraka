export type AttentionSlideVariant = "featured" | "wide";

export function attentionSlideWidthClass(
  count: number,
  variant: AttentionSlideVariant = "featured"
): string {
  if (count <= 1) {
    return variant === "wide" ? "w-full" : "w-full max-w-xl";
  }
  if (variant === "wide") {
    return "w-[min(40rem,calc(100%-1.75rem))] shrink-0";
  }
  return "w-[min(21rem,calc(100%-2.75rem))] shrink-0";
}

export function clampAttentionSlideIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  if (index < 0) return 0;
  if (index >= count) return count - 1;
  return index;
}

export function nextAttentionSlideIndex(
  current: number,
  count: number,
  direction: -1 | 1
): number {
  if (count <= 0) return 0;
  return (clampAttentionSlideIndex(current, count) + direction + count) % count;
}

export function attentionCarouselOverflows(scrollWidth: number, clientWidth: number): boolean {
  return scrollWidth - clientWidth > 8;
}

export function nearestAttentionSlideIndex(
  slideOffsets: readonly number[],
  scrollLeft: number
): number {
  if (slideOffsets.length === 0) return 0;
  let closest = 0;
  let min = Number.POSITIVE_INFINITY;
  for (let i = 0; i < slideOffsets.length; i += 1) {
    const distance = Math.abs(slideOffsets[i] - scrollLeft);
    if (distance < min) {
      min = distance;
      closest = i;
    }
  }
  return closest;
}
