import {
  clampMarketplaceSlideIndex,
  marketplaceCarouselOverflows,
  marketplaceSlideWidthClass,
  nearestMarketplaceSlideIndex,
  nextMarketplaceSlideIndex,
} from "./marketplace-snap-carousel-utils";

describe("marketplace carousel helpers", () => {
  it("keeps compact featured cards at a fixed width even for a single note", () => {
    expect(marketplaceSlideWidthClass(1, true)).toBe(
      "w-[min(20rem,calc(100%-2.5rem))] shrink-0 flex-none"
    );
    expect(marketplaceSlideWidthClass(3, true)).toBe(
      "w-[min(20rem,calc(100%-2.5rem))] shrink-0 flex-none"
    );
    expect(marketplaceSlideWidthClass(1)).toBe("w-full");
    expect(marketplaceSlideWidthClass(3)).toBe("w-[min(34rem,calc(100%-2.5rem))] shrink-0");
  });

  it("wraps slide indexes and clamps out-of-range values", () => {
    expect(nextMarketplaceSlideIndex(0, 3, -1)).toBe(2);
    expect(nextMarketplaceSlideIndex(2, 3, 1)).toBe(0);
    expect(clampMarketplaceSlideIndex(9, 3)).toBe(2);
    expect(nextMarketplaceSlideIndex(0, 0, 1)).toBe(0);
  });

  it("shows controls only when the row actually overflows", () => {
    expect(marketplaceCarouselOverflows(640, 640)).toBe(false);
    expect(marketplaceCarouselOverflows(800, 640)).toBe(true);
  });

  it("picks the nearest slide from scroll position", () => {
    expect(nearestMarketplaceSlideIndex([0, 336, 672], 340)).toBe(1);
    expect(nearestMarketplaceSlideIndex([], 10)).toBe(0);
  });

  it("treats a track pinned at the end as the last slide", () => {
    expect(
      nearestMarketplaceSlideIndex([0, 336, 672], 412, { clientWidth: 580, scrollWidth: 992 })
    ).toBe(2);
    expect(
      nearestMarketplaceSlideIndex([0, 336, 672], 0, { clientWidth: 580, scrollWidth: 992 })
    ).toBe(0);
  });
});
