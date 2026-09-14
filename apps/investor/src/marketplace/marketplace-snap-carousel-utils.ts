export function marketplaceSlideWidthClass(count: number, compact = false): string {
  if (compact) return "w-[min(20rem,calc(100%-2.5rem))] shrink-0 flex-none";
  if (count <= 1) return "w-full";
  return "w-[min(34rem,calc(100%-2.5rem))] shrink-0";
}

export function clampMarketplaceSlideIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  if (index < 0) return 0;
  if (index >= count) return count - 1;
  return index;
}

export function nextMarketplaceSlideIndex(
  current: number,
  count: number,
  direction: -1 | 1
): number {
  if (count <= 0) return 0;
  return (clampMarketplaceSlideIndex(current, count) + direction + count) % count;
}

export function marketplaceCarouselOverflows(scrollWidth: number, clientWidth: number): boolean {
  return scrollWidth - clientWidth > 8;
}

export function nearestMarketplaceSlideIndex(
  slideOffsets: readonly number[],
  scrollLeft: number,
  viewport?: { clientWidth: number; scrollWidth: number }
): number {
  if (slideOffsets.length === 0) return 0;
  if (viewport) {
    if (scrollLeft <= 4) return 0;
    if (scrollLeft + viewport.clientWidth >= viewport.scrollWidth - 8) {
      return slideOffsets.length - 1;
    }
  }
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
