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
