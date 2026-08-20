import {
  chunkQueuePages,
  countTilesThatFit,
  dashboardQueueDescription,
  formatQueueCount,
  NEXT_ACTIONS_ARROW_RESERVE_PX,
  nextQueuePageIndex,
  queuesNeedingAttention,
  sortQueuesByPriority,
  urgencyVariant,
  visibleQueuePageSize,
  type QuickActionQueue,
} from "./quick-action-queues";

function queue(partial: Partial<QuickActionQueue> & Pick<QuickActionQueue, "id">): QuickActionQueue {
  return {
    title: partial.id,
    shortTitle: partial.id,
    description: "",
    count: 0,
    countLabel: "open",
    href: "/",
    icon: () => null,
    variant: "default",
    isLoading: false,
    ...partial,
  };
}

describe("urgencyVariant", () => {
  it("escalates from default to warning to urgent", () => {
    expect(urgencyVariant(0, 5, 0)).toBe("default");
    expect(urgencyVariant(1, 5, 0)).toBe("warning");
    expect(urgencyVariant(6, 5, 0)).toBe("urgent");
  });
});

describe("sortQueuesByPriority", () => {
  it("orders by urgency then by open count", () => {
    const sorted = sortQueuesByPriority([
      queue({ id: "low", count: 9, variant: "default" }),
      queue({ id: "urgent-small", count: 2, variant: "urgent" }),
      queue({ id: "warn-high", count: 8, variant: "warning" }),
      queue({ id: "urgent-high", count: 4, variant: "urgent" }),
    ]);
    expect(sorted.map((item) => item.id)).toEqual([
      "urgent-high",
      "urgent-small",
      "warn-high",
      "low",
    ]);
  });
});

describe("queuesNeedingAttention", () => {
  it("drops loading and empty queues", () => {
    const open = queuesNeedingAttention([
      queue({ id: "loading", count: 4, isLoading: true, variant: "urgent" }),
      queue({ id: "empty", count: 0, variant: "urgent" }),
      queue({ id: "open", count: 2, variant: "warning" }),
    ]);
    expect(open.map((item) => item.id)).toEqual(["open"]);
  });
});

describe("chunkQueuePages", () => {
  it("pages queues into groups of three", () => {
    expect(chunkQueuePages(["a", "b", "c", "d", "e"], 3)).toEqual([
      ["a", "b", "c"],
      ["d", "e"],
    ]);
  });

  it("returns no pages for an empty list", () => {
    expect(chunkQueuePages([], 3)).toEqual([]);
  });
});

describe("nextQueuePageIndex", () => {
  it("wraps to the first page after the last", () => {
    expect(nextQueuePageIndex(0, 3)).toBe(1);
    expect(nextQueuePageIndex(2, 3)).toBe(0);
    expect(nextQueuePageIndex(4, 1)).toBe(0);
  });
});

describe("visibleQueuePageSize", () => {
  it("shows more tiles as the header slot grows", () => {
    expect(countTilesThatFit(200)).toBe(1);
    expect(countTilesThatFit(224)).toBe(1);
    expect(countTilesThatFit(496)).toBe(2);
    expect(countTilesThatFit(1100)).toBeGreaterThanOrEqual(4);
  });

  it("reserves space for a single next arrow only when queues overflow", () => {
    const wide = 800;
    const withoutPager = visibleQueuePageSize(wide, 2);
    const withPager = visibleQueuePageSize(wide, 12);
    expect(withoutPager).toBe(countTilesThatFit(wide));
    expect(withPager).toBe(countTilesThatFit(wide, NEXT_ACTIONS_ARROW_RESERVE_PX));
    expect(withPager).toBeLessThanOrEqual(withoutPager);
    expect(NEXT_ACTIONS_ARROW_RESERVE_PX).toBeLessThan(80);
  });
});

describe("formatQueueCount", () => {
  it("caps large counts", () => {
    expect(formatQueueCount(12)).toBe("12");
    expect(formatQueueCount(100)).toBe("99+");
  });
});

describe("dashboardQueueDescription", () => {
  it("summarizes loading, empty, clear, and open queues", () => {
    expect(
      dashboardQueueDescription({
        ready: false,
        queueCount: 4,
        attentionCount: 2,
        totalOpenItems: 9,
      })
    ).toBe("Review queues and platform health from your dashboard.");
    expect(
      dashboardQueueDescription({
        ready: true,
        queueCount: 0,
        attentionCount: 0,
        totalOpenItems: 0,
      })
    ).toBe("No queues available for your role.");
    expect(
      dashboardQueueDescription({
        ready: true,
        queueCount: 4,
        attentionCount: 0,
        totalOpenItems: 0,
      })
    ).toBe("All queues are clear.");
    expect(
      dashboardQueueDescription({
        ready: true,
        queueCount: 4,
        attentionCount: 1,
        totalOpenItems: 1,
      })
    ).toBe("1 item needs attention.");
    expect(
      dashboardQueueDescription({
        ready: true,
        queueCount: 4,
        attentionCount: 3,
        totalOpenItems: 12,
      })
    ).toBe("12 items across 3 queues need attention.");
  });
});
