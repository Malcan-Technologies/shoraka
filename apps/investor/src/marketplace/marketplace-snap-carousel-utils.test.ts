import {
  clampMarketplaceSlideIndex,
  marketplaceCarouselOverflows,
  marketplaceSlideWidthClass,
  nearestMarketplaceSlideIndex,
  nextMarketplaceSlideIndex,
} from "./marketplace-snap-carousel-utils";

describe("marketplace carousel helpers", () => {
  it("uses a full-width slide for a single featured note", () => {
    expect(marketplaceSlideWidthClass(1)).toBe("w-full");
    expect(marketplaceSlideWidthClass(3)).toBe("w-[min(34rem,calc(100%-3rem))] shrink-0");
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
});
