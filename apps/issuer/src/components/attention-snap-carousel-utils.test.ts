import {
  attentionCarouselOverflows,
  attentionSlideWidthClass,
  clampAttentionSlideIndex,
  nearestAttentionSlideIndex,
  nextAttentionSlideIndex,
} from "@/components/attention-snap-carousel-utils";

describe("attention carousel helpers", () => {
  it("uses a full-width featured card for a single item", () => {
    expect(attentionSlideWidthClass(1)).toBe("w-full max-w-xl");
    expect(attentionSlideWidthClass(1, "wide")).toBe("w-full");
    expect(attentionSlideWidthClass(3)).toContain("shrink-0");
    expect(attentionSlideWidthClass(3, "wide")).toContain("40rem");
  });

  it("wraps slide indexes and clamps out-of-range values", () => {
    expect(nextAttentionSlideIndex(0, 3, -1)).toBe(2);
    expect(nextAttentionSlideIndex(2, 3, 1)).toBe(0);
    expect(clampAttentionSlideIndex(9, 3)).toBe(2);
    expect(nextAttentionSlideIndex(0, 0, 1)).toBe(0);
  });

  it("shows controls only when the row actually overflows", () => {
    expect(attentionCarouselOverflows(640, 640)).toBe(false);
    expect(attentionCarouselOverflows(800, 640)).toBe(true);
  });

  it("picks the nearest slide from scroll position", () => {
    expect(nearestAttentionSlideIndex([0, 336, 672], 340)).toBe(1);
    expect(nearestAttentionSlideIndex([], 10)).toBe(0);
  });
});
