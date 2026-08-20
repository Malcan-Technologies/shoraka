import type { ComponentType } from "react";

export type QueueUrgency = "default" | "warning" | "urgent";

export type QuickActionQueue = {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  count: number;
  countLabel: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  variant: QueueUrgency;
  isLoading: boolean;
};

export const NEXT_ACTIONS_PAGE_SIZE = 3;
export const NEXT_ACTIONS_AUTO_ADVANCE_MS = 7000;
/** Matches `md:min-w-[14rem]` on each next-to-do tile. */
export const NEXT_ACTIONS_TILE_MIN_PX = 224;
/** Matches `xl:gap-12` between tiles so the fit count does not overflow. */
export const NEXT_ACTIONS_TILE_GAP_PX = 48;
/** One `h-10` next arrow plus gap. */
export const NEXT_ACTIONS_ARROW_RESERVE_PX = 56;

const VARIANT_RANK: Record<QueueUrgency, number> = {
  urgent: 0,
  warning: 1,
  default: 2,
};

export function urgencyVariant(count: number, urgentAt: number, warnAt: number): QueueUrgency {
  if (count > urgentAt) return "urgent";
  if (count > warnAt) return "warning";
  return "default";
}

export function sortQueuesByPriority(queues: QuickActionQueue[]): QuickActionQueue[] {
  return [...queues].sort((a, b) => {
    const rank = VARIANT_RANK[a.variant] - VARIANT_RANK[b.variant];
    if (rank !== 0) return rank;
    return (b.count ?? 0) - (a.count ?? 0);
  });
}

export function queuesNeedingAttention(queues: QuickActionQueue[]): QuickActionQueue[] {
  return sortQueuesByPriority(
    queues.filter((queue) => !queue.isLoading && queue.count > 0)
  );
}

export function chunkQueuePages<T>(items: T[], pageSize: number): T[][] {
  if (items.length === 0) return [];
  const size = Math.max(1, pageSize);
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    pages.push(items.slice(i, i + size));
  }
  return pages;
}

export function nextQueuePageIndex(current: number, pageCount: number): number {
  if (pageCount <= 1) return 0;
  return (current + 1) % pageCount;
}

export function countTilesThatFit(availablePx: number, reservedPx = 0): number {
  const usable = availablePx - reservedPx;
  if (usable < NEXT_ACTIONS_TILE_MIN_PX) return 1;
  return Math.floor(
    (usable + NEXT_ACTIONS_TILE_GAP_PX) / (NEXT_ACTIONS_TILE_MIN_PX + NEXT_ACTIONS_TILE_GAP_PX)
  );
}

/** How many tiles to show for the measured header slot, leaving room for the next arrow when paging. */
export function visibleQueuePageSize(containerPx: number, itemCount: number): number {
  if (containerPx <= 0) return NEXT_ACTIONS_PAGE_SIZE;
  const openFit = countTilesThatFit(containerPx);
  if (itemCount <= 0 || itemCount <= openFit) {
    return Math.max(1, openFit);
  }
  return Math.max(1, countTilesThatFit(containerPx, NEXT_ACTIONS_ARROW_RESERVE_PX));
}

export function formatQueueCount(count: number): string {
  return count > 99 ? "99+" : String(count);
}

export function dashboardQueueDescription(input: {
  ready: boolean;
  queueCount: number;
  attentionCount: number;
  totalOpenItems: number;
}): string {
  if (!input.ready) {
    return "Review queues and platform health from your dashboard.";
  }
  if (input.queueCount === 0) {
    return "No queues available for your role.";
  }
  if (input.attentionCount === 0) {
    return "All queues are clear.";
  }
  if (input.attentionCount === 1) {
    return input.totalOpenItems === 1
      ? "1 item needs attention."
      : `${input.totalOpenItems} items need attention.`;
  }
  return `${input.totalOpenItems} items across ${input.attentionCount} queues need attention.`;
}
